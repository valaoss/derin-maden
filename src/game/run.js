// Sefer oluşturma, türetilmiş değerler ve kayıt/yükleme.
import { COLS, ROWS, TILE, GROUND_ROW, BASE_X, BASE_Y, CENTER_COL, STRATUM_ROWS, stratumOfRow, PLAY_MIN_COL, PLAY_MAX_COL } from '../config.js';
import { UPGRADES, PLAYER, BUILDS, ITEMS, ITEM_KEYS, SCHEMATICS, CONTRACTS, kademeMods, MOD_SLOTS, PICK_TIERS, ROLES, RES_KEYS, MASTER_KEYS, PICK_TYPES, WEAPONS, ADREN, TOOL_UP, WEAPON_UP, BUILD_KEYS } from '../data/balance.js';
import { T, TD } from '../data/tiles.js';
import { makeThreat, scanNests } from './threat.js';
import { makeEvents } from './events.js';
import { makeJourney } from './journey.js';
import { generate } from '../world/gen.js';
import { createFields } from '../world/flow.js';
import { G, setG, App } from './state.js';
import { seedRng } from '../core/rng.js';

const emptyRes = () => Object.fromEntries(RES_KEYS.map(k => [k, 0]));
// biyom grubu (0..3): kontrat hedefleri ve ambiyans için
export const stratumGroup = s => Math.min(3, Math.floor(Math.max(0, s) * 0.4));
const emptyItems = () => Object.fromEntries(ITEM_KEYS.map(k => [k, 0]));

// ---------- şemalar (kalıcı, meta'da) ----------
// Simülasyon meta'yı G.meta üzerinden okur: çok oyunculuda iki taraf da ev sahibinin meta'sını kullanır.
export function isUnlocked(key) {
  const d = ITEMS[key] || BUILDS[key];
  return !d.schematic || (G.meta.schem || []).includes(key);
}
// sandık açılınca sıradaki şemayı aç; açılan anahtarı döner
export function unlockSchematic() {
  const m = G.meta; m.schem = m.schem || [];
  const next = SCHEMATICS.find(s => !m.schem.includes(s.key));
  if (!next) return null;
  m.schem.push(next.key);
  // yerel kalıcı kayda da işle (misafir de şemayı kazanır)
  const lm = App.meta; lm.schem = lm.schem || [];
  if (!lm.schem.includes(next.key)) lm.schem.push(next.key);
  return next;
}

// ---------- kontratlar ----------
function pickContracts(seed) {
  let x = (seed ^ 0x5bd1e995) >>> 0;
  const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  const st = stratumGroup(G.meta.maxStratum | 0);
  const pool = Object.keys(CONTRACTS).filter(k => (CONTRACTS[k].minStratum || 0) <= st);
  const out = [];
  while (out.length < 2 && pool.length) {
    const k = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    out.push({ k, n: CONTRACTS[k].vals[st], done: false });
  }
  return out;
}
export function contractProgress(c) { return Math.min(c.n, CONTRACTS[c.k].stat(G)); }

export const MP_MODS = { hp: 1.3, noise: 1.15, oz: 1.5 };
export const SP_MODS = { hp: 1.15, dmg: 1.2, noise: 1.15 }; // tek başına da madenin dişi olsun

export function makePlayer(i, helm = i, name = '', role = '') {
  return {
    i, helm, name, role: ROLES[role] ? role : '', x: (CENTER_COL + (i ? -3 : 3)) * TILE + 8, y: GROUND_ROW * TILE - 10, px: 0, py: 0,
    face: i ? -1 : 1, dx: 0, dy: 1, hp: 0, maxHp: 0, iframes: 0, dead: false,
    dig: null, digT: 0, digAnim: 0, digDir: [0, 1], walkT: 0, moving: false, up: false, upT: 0, downT: 0, reviveP: 0, gone: false, autoUp: false,
    wpn: 'blaster', pk: 'std', barrier: 0, barrierT: 0, adrenT: 0,
    fireCd: 0, aim: 0, aimT: 0, carrying: false, ride: null, hurtT: 0, shockCd: 0, squash: 0, recallT: 0, gasT: 0,
    bag: emptyRes(), inp: { x: 0, y: 0, mag: 0 }, landT: 0, airT: 0, blindT: 0, fearT: 0, pullX: 0, pullY: 0, slowT: 0, webT: 0, burnT: 0,
  };
}

// meta: sefer boyunca sabit meta anlık görüntüsü (çok oyunculuda ev sahibininki)
export function metaSnapshot(m = App.meta) {
  return { lv: Object.assign({}, m.lv || {}), schem: (m.schem || []).slice(), relics: (m.relics || []).slice(), maxStratum: m.maxStratum | 0, beacons: (m.beacons || []).slice(), echo: m.echo ? Object.assign({}, m.echo) : null };
}

export function newRun({ tutorial = false, seed = (Math.random() * 1e9) | 0, kademe = 0, daily = null, mp = false, meta = null, localIdx = 0, helms = null, names = null, roles = null, startStratum = 0 } = {}) {
  const gm = meta || metaSnapshot(), ml = gm.lv;
  const mods = kademeMods(kademe);
  if (mp) { mods.hp *= MP_MODS.hp; mods.noise *= MP_MODS.noise; mods.oz *= MP_MODS.oz; }
  else if (!tutorial) { mods.hp *= SP_MODS.hp; mods.dmg *= SP_MODS.dmg; mods.noise *= SP_MODS.noise; }
  const gen = generate(seed, { tutorial, hazard: mods.hazard });
  const g = {
    seed, rng: 1, map: gen.map, heartRow: gen.heartRow, order: gen.order, meta: gm, mp, localIdx,
    dmg: new Float32Array(COLS * ROWS), rev: new Uint8Array(COLS * ROWS), buried: gen.buried || new Uint8Array(COLS * ROWS), bhp: {},
    mapVersion: 1, dirty: [], cleared: [], dirtyDmg: false, flow: createFields(), flowVersion: -1, flowTimer: 0,
    time: 0, frame: 0, hitstop: 0,
    player: null, players: [],
    base: { x: BASE_X, y: BASE_Y, hp: 0, maxHp: 0, hurtT: 0 },
    store: emptyRes(), collected: emptyRes(),
    lvl: { drill: Math.min(2, ml.keskinUc | 0), sharp: 0, swing: 0, bag: 0, armor: 0, blaster: Math.min(2, ml.ayarliBl | 0), lamp: 0, ...Object.fromEntries(MASTER_KEYS.map(k => [k, 0])) },
    perks: [], items: emptyItems(), perkOffer: null,
    gear: { owned: [], eq: [], cd: {}, active: {}, wOwn: ['blaster'], pOwn: ['std'], wLvl: {}, tLvl: {} },
    kademe, mods, daily, contracts: [],
    bombs: [], rocks: [], falls: [], gas: [], shells: [], hazT: 0,
    structures: [], enemies: [], bullets: [], ebullets: [], orbs: [], particles: [], pIdx: 0, flashes: [], lightSrc: [],
    satchels: [], zaps: [], pings: [], regrow: [], eggs: [], corpses: [], hungerT: 15, seaT: 0, nodeT: 0, seenStratum: 0, evt: makeEvents(), echo: null, stations: [], journey: makeJourney(mp ? 2 : 1),
    // uyanış: dalga yok; G.wave yalnızca gök rengi/ambiyans uyumu için türetilir
    wave: { num: 0, phase: 'calm', t: Infinity, nests: [], boss: false },
    threat: makeThreat(), nests: [], nestTotal: [], beacons: [], selfRevive: (ml.sigorta | 0) ? 1 : 0, allDownT: 0,
    stats: { maxDepth: 0, nests: 0, beacons: 0, bosses: 0, chests: 0, kills: 0, dug: 0, victory: false, time: 0, blasted: 0, crafted: 0, elites: 0 },
    maxStratum: 0, startStratum: 0,
    tutorial: tutorial ? { step: 0, t: 0, done: false } : null,
    cam: { x: 0, y: 0, px: 0, py: 0, trauma: 0, kx: 0, ky: 0 },
    combo: { n: 0, t: 0 },
    deposit: [], bagFullT: 0, flashWhite: 0,
    paused: false, over: false,
  };
  g.store.iron = 8 * (ml.erzak | 0);
  g.store.gold = 4 * (ml.altinKese | 0) + ((gm.relics || []).includes('tac') ? 12 : 0);
  const hv = helms || [App.settings && App.settings.helm | 0, 1];
  const nv = names || ['', ''];
  const rv = roles || [App.settings && App.settings.role || '', ''];
  g.players = [makePlayer(0, hv[0] | 0, nv[0] || '', rv[0] || '')];
  if (mp) g.players.push(makePlayer(1, hv[1] | 0, nv[1] || '', rv[1] || ''));
  for (const p of g.players) { p.px = p.x; p.py = p.y; }
  g.player = g.players[localIdx] || g.players[0];
  setG(g);
  seedRng(seed);
  recompute(true);
  if (ml.hazirTaret) g.items.turret = 1;
  if (g.players.some(p => p.role === 'yikici')) g.items.dynamite = Math.max(g.items.dynamite | 0, 3);
  g.nests = scanNests();
  for (const n of g.nests) { const s = stratumOfRow(n.r); g.nestTotal[s] = (g.nestTotal[s] | 0) + 1; }
  // fener asansörü: temizlenmiş biyomların altına iniş (merkez şaft açılır, oyuncular oraya başlar)
  if (startStratum > 0) {
    const rTop = GROUND_ROW + startStratum * STRATUM_ROWS;
    for (let r = GROUND_ROW + 3; r <= rTop + 1; r++) { const i = r * COLS + CENTER_COL; if (g.map[i] !== T.FOUNDATION && g.map[i] !== T.BEDROCK) g.map[i] = T.AIR; }
    g.startStratum = startStratum; g.maxStratum = startStratum;
    for (let s = 1; s <= startStratum; s++) g.stations.push(s);
    for (const p of g.players) { p.x = CENTER_COL * TILE + 8 + (p.i ? -3 : 3); p.y = (rTop + 1) * TILE + 8; p.px = p.x; p.py = p.y; }
    g.stats.maxDepth = startStratum * STRATUM_ROWS;
  }
  // ölüm yankısı: önceki seferde kaybedilen çanta aynı derinlikte bekler (tek oyunculu)
  if (!tutorial && !mp && !daily && gm.echo && gm.echo.bag) {
    const e = gm.echo, c = Math.max(PLAY_MIN_COL, Math.min(PLAY_MAX_COL, e.c | 0)), r = Math.max(GROUND_ROW + 2, Math.min(ROWS - 3, e.r | 0));
    const d = TD[g.map[r * COLS + c]];
    if (!d.unbreakable && !d.chest && !d.heart && !d.nest) {
      g.map[r * COLS + c] = T.AIR;
      g.satchels.push({ x: c * TILE + 8, y: r * TILE + 8, bag: Object.assign(emptyRes(), e.bag), heart: false, owner: -1, echo: true });
      g.echo = { c, r };
    }
  }
  if (!tutorial) g.contracts = pickContracts(seed);
  // yüzeyi baştan açığa çıkar
  for (let r = 0; r < GROUND_ROW + 1; r++) for (let c = 0; c < COLS; c++) g.rev[r * COLS + c] = 1;
  return g;
}

export function makeStructure(type, c, r) {
  const b = BUILDS[type];
  const hp = Math.round(b.hp * (1 + 0.3 * ((G.meta.lv || {}).tahkimat | 0)) * (teamHas('muhendis') ? ROLES.muhendis.buildHp : 1) * (1 + TOOL_UP.hp * toolLvl(type)));
  return { type, c, r, x: c * TILE + 8, y: r * TILE + 14, hp, maxHp: hp, cd: 0.5, aim: -Math.PI / 2, buildT: 0.5, hurtT: 0 };
}

export function hasPerk(k) { return G.perks.includes(k); }
export function hasRelic(k) { return !!(G.meta.relics && G.meta.relics.includes(k)); }
export function roleOf(p) { return ROLES[p.role] || {}; }
export function teamHas(role) { return G.players.some(p => p.role === role); }
// Son Direniş (düşük canda) ve Adrenalin: iki kat vuruş
export function lastStand(p) {
  const bond = hasPerk('kanBagi') && G.players.some(q => q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 96);
  return (hasPerk('sonDirenis') && p.hp < p.maxHp * 0.35 ? 2 : 1) * (p.adrenT > 0 ? ADREN.dmg : 1) * (bond ? 1.25 : 1);
}
export function pickType(p = G.player) { return PICK_TYPES[p && p.pk] || PICK_TYPES.std; }
export function weaponOf(p = G.player) { return WEAPONS[p && p.wpn] || WEAPONS.blaster; }
export function weaponLvl(k) { return Math.min(WEAPON_UP.max, (G.gear.wLvl && G.gear.wLvl[k]) | 0); }
export function toolLvl(k) { return Math.min(TOOL_UP.max, (G.gear.tLvl && G.gear.tLvl[k]) | 0); }
// alet hasarı: kendi seviyesi + Silah Gücü (aletler derinde de işe yarasın)
export function toolDmgMul(k) { return (1 + TOOL_UP.dmg * toolLvl(k)) * (1 + 0.15 * G.lvl.blaster) * (hasPerk('taretAsiri') ? 1.5 : 1); }

// Seviye/perk/meta'ya bağlı değerler
export function recompute(fill = false) {
  const ml = G.meta.lv || {};
  G.bagCap = Math.round((UPGRADES.bag.cap[G.lvl.bag] + 10 * (ml.genisCanta | 0)) * (hasPerk('derinCep') ? 1.5 : 1));
  const maxHp = Math.round((UPGRADES.armor.hp[G.lvl.armor] + (hasRelic('kalp') ? 40 : 0) + (G.lvl.muska ? 30 : 0)) * (hasPerk('kristalDeri') ? 1.35 : 1));
  for (const p of G.players) {
    const d = maxHp - p.maxHp;
    p.maxHp = maxHp;
    p.hp = fill ? maxHp : Math.min(maxHp, p.hp + Math.max(0, d));
  }
  G.base.maxHp = 1; G.base.hp = 1; // kamp: can yok, güvenli bölge
}

// kazma: kademe + tür + keskinlik + hızlı sallama
export function pickDmg(p = G.player) { return PICK_TIERS[G.lvl.drill].dmg * pickType(p).dmg * UPGRADES.sharp.mult[G.lvl.sharp] * (hasRelic('kivilcim') ? 2 : 1) * (G.lvl.yildizCekirdek ? 1.4 : 1) * (hasRelic('sifirTasi') ? 1.4 : 1); }
export function pickInterval(p = G.player) { return PICK_TIERS[G.lvl.drill].interval * pickType(p).int * UPGRADES.swing.mult[G.lvl.swing]; }
export function modSlots() { return MOD_SLOTS + (hasPerk('dorduncuYuva') ? 1 : 0); }
export function hasMod(k) { return G.gear.eq.includes(k); }

export function lampTiles() {
  const r = UPGRADES.lamp.radius[G.lvl.lamp] + (hasPerk('parlakFener') ? 2 : 0) + (hasRelic('kivilcim') ? 1 : 0) + (hasRelic('arken') ? 3 : 0) + (G.lvl.inciFener ? 3 : 0);
  // Işık Yiyen yakındayken fener söner
  const lp = G.player, eaten = lp && G.enemies.some(e => !e.dead && e.d.eatLight && Math.hypot(e.x - lp.x, e.y - lp.y) < e.d.eatLight);
  if (eaten) return 2;
  return G.evt && G.evt.darkT > 0 && !G.lvl.inciFener ? Math.max(2, Math.ceil(r / 2)) : r;
}
export function bagCount(p = G.player) { let n = 0; for (const k of RES_KEYS) n += p.bag[k] || 0; return n; }
export function isLocal(p) { return p === G.player; }
// ses için: yerel oyuncuya yakın mı (partnerin uzaktaki kazısı sessiz kalır)
export function hear(p, x = p.x, y = p.y) { const l = G.player; return p === l || Math.hypot(l.x - x, l.y - y) < 170; }

// ---------- kayıt ----------
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

export function serialize() {
  const g = G;
  return {
    v: 8, seed: g.seed, rng: g.rng, heartRow: g.heartRow, order: g.order, map: b64(g.map), rev: b64(g.rev), buried: b64(g.buried), bhp: g.bhp, gear: { owned: g.gear.owned, eq: g.gear.eq, wOwn: g.gear.wOwn, pOwn: g.gear.pOwn, wLvl: g.gear.wLvl, tLvl: g.gear.tLvl },
    base: { hp: g.base.hp }, bag: g.player.bag, store: g.store, collected: g.collected, lvl: g.lvl, perks: g.perks,
    items: g.items, structures: g.structures.map(s => ({ type: s.type, c: s.c, r: s.r, hp: s.hp })),
    kademe: g.kademe, daily: g.daily, contracts: g.contracts,
    threat: { noise: g.threat.noise }, evt: { t: g.evt.t }, beacons: g.beacons, stations: g.stations, selfRevive: g.selfRevive, startStratum: g.startStratum,
    stats: g.stats, maxStratum: g.maxStratum, tutorial: g.tutorial,
    player: { x: g.player.x, y: g.player.y, hp: g.player.hp, carrying: g.player.carrying, role: g.player.role, wpn: g.player.wpn, pk: g.player.pk },
    satchels: g.satchels, journey: g.journey,
  };
}
export function deserialize(d) {
  const g = newRun({ seed: d.seed, kademe: d.kademe | 0, daily: d.daily || null });
  g.map = unb64(d.map); g.rev = unb64(d.rev);
  g.buried = d.buried ? unb64(d.buried) : new Uint8Array(COLS * ROWS);
  if (g.map.length !== COLS * ROWS) throw new Error('harita boyutu uyumsuz'); g.bhp = d.bhp || {}; g.heartRow = d.heartRow; if (d.order) g.order = d.order;
  Object.assign(g.player.bag, d.bag); Object.assign(g.store, d.store); Object.assign(g.collected, d.collected);
  for (const k in d.lvl || {}) if (k in g.lvl) g.lvl[k] = Math.max(0, Math.min(UPGRADES[k].costs.length, d.lvl[k] | 0)); g.perks = d.perks || [];
  if (d.gear) { g.gear.owned = d.gear.owned || []; g.gear.eq = d.gear.eq || []; g.gear.wOwn = (d.gear.wOwn || ['blaster']).filter(k => WEAPONS[k]); g.gear.pOwn = (d.gear.pOwn || ['std']).filter(k => PICK_TYPES[k]);
    for (const k in d.gear.wLvl || {}) if (WEAPONS[k]) g.gear.wLvl[k] = Math.min(WEAPON_UP.max, d.gear.wLvl[k] | 0);
    for (const k in d.gear.tLvl || {}) if (BUILD_KEYS.includes(k)) g.gear.tLvl[k] = Math.min(TOOL_UP.max, d.gear.tLvl[k] | 0); }
  for (const k of ITEM_KEYS) if (d.items && d.items[k]) g.items[k] = d.items[k] | 0;
  if (d.contracts) g.contracts = d.contracts;
  g.structures = (d.structures || []).filter(s => BUILDS[s.type] && s.c !== undefined).map(s => Object.assign(makeStructure(s.type, s.c, s.r), { hp: s.hp, buildT: 0 }));
  g.threat = makeThreat(); if (d.threat) g.threat.noise = Math.min(60, d.threat.noise || 0);
  if (d.evt) g.evt.t = Math.max(10, +d.evt.t || 0);
  g.beacons = d.beacons || []; g.selfRevive = d.selfRevive | 0; g.startStratum = d.startStratum | 0; g.stations = (d.stations || []).map(Number);
  Object.assign(g.stats, d.stats); g.maxStratum = d.maxStratum | 0; g.tutorial = d.tutorial;
  g.nests = scanNests(); g.nestTotal = [];
  for (const n of g.nests) { const s = stratumOfRow(n.r); g.nestTotal[s] = (g.nestTotal[s] | 0) + 1; }
  for (const s of g.beacons) g.nestTotal[s] = Math.max(g.nestTotal[s] | 0, 1);
  recompute(true);
  Object.assign(g.player, d.player); g.player.px = g.player.x; g.player.py = g.player.y;
  if (!g.gear.wOwn.includes(g.player.wpn)) g.player.wpn = 'blaster';
  if (!g.gear.pOwn.includes(g.player.pk)) g.player.pk = 'std';
  g.player.hp = Math.max(1, Math.min(g.player.maxHp, d.player.hp));
  g.satchels = d.satchels || (d.satchel ? [d.satchel] : []);
  if (d.journey && d.journey.p) g.journey = d.journey;
  if (d.rng) g.rng = d.rng;
  g.mapVersion++;
  return g;
}
