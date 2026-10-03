// Sefer oluşturma, türetilmiş değerler ve kayıt/yükleme.
import { placeCritters } from './critters.js';
import { placeWonders } from './wonders.js';
import { placeLiquids } from './liquids.js';
import { placeHoard } from './dragon.js';
import { placeTemple, dropTemple } from './poseidon.js';
import { makeSeals, syncSeals } from './seals.js';
import { makeLairs, lairsDone, loadLairs } from './lairs.js';
import { CRITTERS } from '../data/critters.js';
import { COLS, ROWS, TILE, GROUND_ROW, BASE_X, BASE_Y, CENTER_COL, STRATUM_ROWS, stratumOfRow, PLAY_MIN_COL, PLAY_MAX_COL } from '../config.js';
import { PERKS, RESONANCE } from '../data/relics.js';
import { MERCHANT, SHROOM, UPGRADES, PLAYER, BUILDS, ITEMS, ITEM_KEYS, SCHEMATICS, CONTRACTS, kademeMods, PICK_TIERS, RES_KEYS, MAT_KEYS, FORGE, FORGE_KEYS, OIL, MASTER_KEYS, PICK_TYPES, WEAPONS, EVOLVED, CARDS, CARD_KEYS, MODS, ADREN, TOOL_UP, BUILD_KEYS } from '../data/balance.js';
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

export const MP_MODS = { hp: 1.3, dmg: 1.15, noise: 1.15, oz: 1.5 };
export const SP_MODS = { hp: 1.15, dmg: 1.2, noise: 1.15 }; // tek başına da madenin dişi olsun

export function makePlayer(i, helm = i, name = '') {
  return {
    i, helm, name, x: (CENTER_COL + (i ? -3 : 3)) * TILE + 8, y: GROUND_ROW * TILE - 10, px: 0, py: 0,
    face: i ? -1 : 1, dx: 0, dy: 1, hp: 0, maxHp: 0, iframes: 0, dead: false,
    dig: null, digT: 0, digAnim: 0, digDir: [0, 1], walkT: 0, moving: false, up: false, upT: 0, downT: 0, reviveP: 0, gone: false, autoUp: false,
    wpn: 'blaster', pk: 'std', barrier: 0, barrierT: 0, adrenT: 0,
    pet: null, shroom: null, eat: null, fish: null, portCd: 0, portLock: -1, fireCd: 0, aim: 0, aimT: 0, carrying: false, ride: null, hurtT: 0, shockCd: 0, squash: 0, recallT: 0, gasT: 0,
    bag: emptyRes(), inp: { x: 0, y: 0, mag: 0 }, landT: 0, airT: 0, blindT: 0, fearT: 0, pullX: 0, pullY: 0, slowT: 0, webT: 0, burnT: 0,
  };
}

// meta: sefer boyunca sabit meta anlık görüntüsü (çok oyunculuda ev sahibininki)
export function metaSnapshot(m = App.meta) {
  return { lv: Object.assign({}, m.lv || {}), schem: (m.schem || []).slice(), relics: (m.relics || []).slice(), maxStratum: m.maxStratum | 0, beacons: (m.beacons || []).slice(), pets: (m.pets || []).slice(), rescued: (m.rescued || []).slice(), echo: m.echo ? Object.assign({}, m.echo) : null };
}

export function newRun({ tutorial = false, seed = (Math.random() * 1e9) | 0, kademe = 0, daily = null, mp = false, meta = null, localIdx = 0, helms = null, names = null, startStratum = 0, start = true } = {}) {
  const gm = meta || metaSnapshot(), ml = gm.lv;
  const mods = kademeMods(kademe);
  if (mp) { mods.hp *= MP_MODS.hp; mods.dmg *= MP_MODS.dmg; mods.noise *= MP_MODS.noise; mods.oz *= MP_MODS.oz; }
  else if (!tutorial) { mods.hp *= SP_MODS.hp; mods.dmg *= SP_MODS.dmg; mods.noise *= SP_MODS.noise; }
  const gen = generate(seed, { tutorial, hazard: mods.hazard });
  const g = {
    seed, rng: 1, map: gen.map, heartRow: gen.heartRow, order: gen.order, meta: gm, mp, localIdx,
    dmg: new Float32Array(COLS * ROWS), rev: new Uint8Array(COLS * ROWS), buried: gen.buried || new Uint8Array(COLS * ROWS), bhp: {},
    mapVersion: 1, dirty: [], cleared: [], dirtyDmg: false, flow: createFields(), flowVersion: -1, flowTimer: 0,
    time: 0, frame: 0, hitstop: 0,
    player: null, players: [],
    base: { x: BASE_X, y: BASE_Y, hp: 0, maxHp: 0, hurtT: 0 },
    store: Object.assign(emptyRes(), Object.fromEntries(MAT_KEYS.map(k => [k, 0]))), collected: emptyRes(),
    lvl: { drill: Math.min(2, ml.keskinUc | 0), sharp: 0, swing: 0, bag: 0, armor: 0, blaster: Math.min(2, ml.ayarliBl | 0), lamp: 0, ...Object.fromEntries(MASTER_KEYS.map(k => [k, 0])) },
    perks: [], perkLv: {}, rerolls: 0, items: emptyItems(), perkOffer: null, merchant: null, merchT: MERCHANT.first, wish: null, wishes: 0, balrog: null, serpent: null, hoard: null, temple: null,
    // owned: alınan eklentiler (hepsi çalışır); lv/xp/cards/evo: silah seviyesi, kartlar ve evrimler; pend: sıradaki kart teklifleri
    gear: { owned: [], cd: {}, active: {}, wOwn: ['blaster'], pOwn: ['std'], tLvl: {}, lv: 0, xp: 0, cards: {}, evo: {}, pend: [], forge: { w: 0, p: 0, a: 0 } },
    kademe, mods, daily, contracts: [],
    bombs: [], bells: [], slimes: [], fishT: 6, rocks: [], falls: [], gas: [], hazT: 0,
    structures: [], enemies: [], bullets: [], ebullets: [], orbs: [], particles: [], pIdx: 0, flashes: [], lightSrc: [],
    satchels: [], zaps: [], nums: [], pings: [], regrow: [], eggs: [], corpses: [], hungerT: 15, seaT: 0, nodeT: 0, seenStratum: 0, evt: makeEvents(), echo: null, stations: [], journey: makeJourney(mp ? 2 : 1),
    // uyanış: dalga yok; G.wave yalnızca gök rengi/ambiyans uyumu için türetilir
    wave: { num: 0, phase: 'calm', t: Infinity, nests: [], boss: false },
    threat: makeThreat(), nests: [], nestTotal: [], beacons: [], selfRevive: (ml.sigorta | 0) ? 1 : 0, allDownT: 0,
    stats: { maxDepth: 0, nests: 0, beacons: 0, bosses: 0, chests: 0, kills: 0, dug: 0, victory: false, time: 0, blasted: 0, crafted: 0, elites: 0 },
    maxStratum: 0, startStratum: 0,
    tutorial: tutorial ? { step: 0, t: 0, done: false } : null,
    cam: { x: 0, y: 0, px: 0, py: 0, trauma: 0, kx: 0, ky: 0 },
    combo: { n: 0, t: 0 },
    deposit: [], bagFullT: 0, flashWhite: 0,
    paused: false, over: false, oil: 0, dark: false,
  };
  g.store.iron = 8 * (ml.erzak | 0);
  g.store.gold = 4 * (ml.altinKese | 0) + ((gm.relics || []).includes('tac') ? 12 : 0);
  const hv = helms || [App.settings && App.settings.helm | 0, 1];
  const nv = names || ['', ''];
  g.players = [makePlayer(0, hv[0] | 0, nv[0] || '')];
  if (mp) g.players.push(makePlayer(1, hv[1] | 0, nv[1] || ''));
  for (const p of g.players) { p.px = p.x; p.py = p.y; }
  g.player = g.players[localIdx] || g.players[0];
  setG(g);
  seedRng(seed);
  recompute(true);
  if (ml.hazirTaret) g.items.direk = 1;
  // fener dolu, kemerde bir şişe; kurtarılan madencilerin katkısı
  const res = gm.rescued || [];
  g.oil = (OIL.full + OIL.perLamp * g.lvl.lamp) * (res.includes('ece') ? OIL.ece : 1);
  if (!tutorial) { g.items.yag = 1 + (res.includes('doruk') ? 1 : 0); if (res.includes('bora')) g.items.medkit = 1; if (res.includes('tamer')) g.store.kabuk = 6; }
  // her madenci sefere bir başlangıç eklentisi seçerek girer
  if (!tutorial && start) for (const p of g.players) g.gear.pend.push({ pi: p.i, kind: 'start' });
  Object.assign(g, tutorial ? { lq: null, lk: null, springs: [], lqT: 0 } : placeLiquids(g, seed));
  g.hoard = tutorial ? null : placeHoard(g);
  g.temple = tutorial ? null : placeTemple(g);
  g.critters = tutorial ? [] : placeCritters(g, seed, gm.pets || []);
  Object.assign(g, tutorial ? { lakes: [], portals: [], shrooms: [] } : placeWonders(g, seed));
  if (!tutorial && App.meta && CRITTERS[App.meta.pet]) g.player.pet = App.meta.pet;
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
  g.seals = makeSeals(g);
  g.lairs = tutorial ? null : makeLairs();
  if (!tutorial) g.contracts = pickContracts(seed);
  // yüzeyi baştan açığa çıkar
  for (let r = 0; r < GROUND_ROW + 1; r++) for (let c = 0; c < COLS; c++) g.rev[r * COLS + c] = 1;
  return g;
}

// left: Sondaj Matkabı'nın kalan blok hakkı; owner: kuran madenci (cevher ve kazı sayacı ona yazılır)
export function makeStructure(type, c, r, owner = 0) {
  const b = BUILDS[type];
  const hp = Math.round(b.hp * (1 + 0.3 * ((G.meta.lv || {}).tahkimat | 0)) * (1 + TOOL_UP.hp * toolLvl(type)));
  return { type, c, r, x: c * TILE + 8, y: r * TILE + 14, hp, maxHp: hp, buildT: 0.5, hurtT: 0, owner, left: b.blocks ? Math.round(b.blocks * toolPow(type)) : 0, prog: 0, on: 0 };
}

export function hasPerk(k) { return G.perks.includes(k); }
// kalıntı seviyesi (0: yok) ve o seviyedeki değer; soy sayısı ve rezonans (aynı soydan 3 kalıntı)
export function perkLv(k) { return G.perks.includes(k) ? (G.perkLv && G.perkLv[k]) || 1 : 0; }
export function pv(k) { const l = perkLv(k), d = PERKS[k]; return !l ? 0 : d.v ? d.v[Math.min(d.v.length, l) - 1] : 1; }
export function soyCount(s) { let n = 0; for (const k of G.perks) if (PERKS[k] && PERKS[k].soy === s) n++; return n; }
export function resonance(s) { return soyCount(s) >= RESONANCE; }
export function hasRelic(k) { return !!(G.meta.relics && G.meta.relics.includes(k)); }
// Son Direniş (düşük canda) ve Adrenalin: iki kat vuruş
export function lastStand(p) {
  const bond = hasPerk('kanBagi') && G.players.some(q => q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 96);
  const quiet = resonance('golge') && G.threat.level <= 1;
  return (p.hp < p.maxHp * 0.35 ? pv('sonDirenis') || 1 : 1) * (p.adrenT > 0 ? ADREN.dmg : 1) * (bond ? 1 + pv('kanBagi') : 1) * (quiet ? 1.4 : 1);
}
export function pickType(p = G.player) { return PICK_TYPES[p && p.pk] || PICK_TYPES.std; }
// elindeki silah: evrim seçildiyse evrimli tanım
export function weaponOf(p = G.player) { const k = p && WEAPONS[p.wpn] ? p.wpn : 'blaster', e = G.gear.evo[k]; return e === 0 || e === 1 ? EVOLVED[k][e] : WEAPONS[k]; }
export function cardLv(k) { return Math.min(CARDS[k].max, G.gear.cards[k] | 0); }
// Tezgâh kademesi (0..3): w silah, p kazma, a zırh
export function forgeLv(k) { return Math.min(FORGE.costs.length, (G.gear.forge && G.gear.forge[k]) | 0); }
export function toolLvl(k) { return Math.min(TOOL_UP.max, (G.gear.tLvl && G.gear.tLvl[k]) | 0); }
// alet gücü (şifa hızı, delinen blok): kendi seviyesi + Alet Ustası
export function toolPow(k) { return (1 + TOOL_UP.pow * toolLvl(k)) * (hasPerk('aletUstasi') ? 1.5 : 1); }

// Seviye/perk/meta'ya bağlı değerler
export function recompute(fill = false) {
  const ml = G.meta.lv || {};
  G.bagCap = Math.round((UPGRADES.bag.cap[G.lvl.bag] + 10 * (ml.genisCanta | 0)) * (1 + pv('derinCep')) * (hasPerk('acKazma') ? 0.65 : 1));
  const maxHp = Math.round((UPGRADES.armor.hp[G.lvl.armor] + (hasRelic('kalp') ? 40 : 0) + (G.lvl.muska ? 30 : 0)) * (forgeLv('a') ? FORGE.a.hp : 1) * (1 + pv('kalinKan')) * (hasPerk('camTop') ? 0.6 : 1));
  for (const p of G.players) {
    const d = maxHp - p.maxHp;
    p.maxHp = maxHp;
    p.hp = fill ? maxHp : Math.min(maxHp, p.hp + Math.max(0, d));
  }
  G.base.maxHp = 1; G.base.hp = 1; // kamp: can yok, güvenli bölge
}

// kazma: kademe + tür + keskinlik + hızlı sallama
export function pickDmg(p = G.player) { return (forgeLv('p') ? FORGE.p.dmg : 1) * PICK_TIERS[G.lvl.drill].dmg * pickType(p).dmg * UPGRADES.sharp.mult[G.lvl.sharp] * (hasRelic('kivilcim') ? 2 : 1) * (G.lvl.yildizCekirdek ? 1.4 : 1) * (hasRelic('sifirTasi') ? 1.4 : 1) * (resonance('toprak') ? 1.5 : 1) * (hasPerk('camTop') ? 1.8 : 1) * (hasPerk('acKazma') ? 2.2 : 1) * (p && p.shroom && p.shroom.k === 'dev' ? SHROOM.bigPick : 1); }
export function pickInterval(p = G.player) { return PICK_TIERS[G.lvl.drill].interval * pickType(p).int * UPGRADES.swing.mult[G.lvl.swing]; }
// kazı/kırma gürültü çarpanı: Sessiz Adım, Gölge rezonansı, Gürültü Tanrısı
export function perkNoise() { return (1 - pv('sessizAdim')) * (resonance('golge') ? 0.65 : 1) * (hasPerk('gurultuTanrisi') ? 1.6 : 1) * (G.meta.rescued && G.meta.rescued.includes('ilkim') ? 0.9 : 1); }
export function hasMod(k) { return G.gear.owned.includes(k); }

export function lampTiles() {
  const r = UPGRADES.lamp.radius[G.lvl.lamp] + (hasRelic('kivilcim') ? 1 : 0) + (hasRelic('arken') ? 3 : 0) + (G.lvl.inciFener ? 3 : 0);
  // Işık Yiyen yakındayken ya da Kavurgan'ın kül bulutunda fener söner
  const lp = G.player, eaten = lp && G.enemies.some(e => !e.dead && e.d.eatLight && Math.hypot(e.x - lp.x, e.y - lp.y) < e.d.eatLight) || lp && lp.darkT > G.time;
  if (eaten) return 2;
  // fener yağı: bitince tek blok; azalınca titrer
  if (!G.tutorial) { if (G.oil <= 0) return OIL.dark; const m = (OIL.full + OIL.perLamp * G.lvl.lamp) * OIL.low; if (G.oil < m) return Math.max(2.5, r * (0.45 + 0.4 * G.oil / m + 0.08 * Math.sin(G.time * 11))); }
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
    v: 8, seed: g.seed, rng: g.rng, heartRow: g.heartRow, order: g.order, map: b64(g.map), rev: b64(g.rev), buried: b64(g.buried), bhp: g.bhp, gear: { owned: g.gear.owned, wOwn: g.gear.wOwn, pOwn: g.gear.pOwn, tLvl: g.gear.tLvl, lv: g.gear.lv, xp: g.gear.xp, cards: g.gear.cards, evo: g.gear.evo, forge: g.gear.forge },
    base: { hp: g.base.hp }, bag: g.player.bag, store: g.store, collected: g.collected, lvl: g.lvl, perks: g.perks, perkLv: g.perkLv, rerolls: g.rerolls, merchant: g.merchant, merchT: g.merchT, wishes: g.wishes, critters: g.critters, lakes: g.lakes, portals: g.portals, shrooms: g.shrooms, lq: g.lq ? b64(g.lq) : null, lk: g.lk ? b64(g.lk) : null, lqT: g.lqT, balrogDone: !!(g.balrog && g.balrog.st === 'done'), serpentDone: !!(g.serpent && g.serpent.st === 'done'), lairs: lairsDone(), temple: g.temple ? { v: 1, st: g.temple.st === 'done' ? 'done' : 'wait' } : null, hoard: g.hoard ? { v: 2, st: g.hoard.st === 'done' ? 'done' : 'sleep', wake: g.hoard.st === 'sleep' ? g.hoard.wake : 0 } : null,
    items: g.items, structures: g.structures.map(s => ({ type: s.type, c: s.c, r: s.r, hp: s.hp, left: s.left })),
    kademe: g.kademe, daily: g.daily, contracts: g.contracts,
    threat: { noise: g.threat.noise, woke: g.threat.woke | 0, bossCd: Math.max(0, g.threat.bossCd || 0) }, evt: { t: g.evt.t }, seenStratum: g.seenStratum | 0,
    // açık teklif (sandık, silah kartı, başlangıç eklentisi) ve sıradakiler: uygulama kapanırsa ödül kaybolmasın
    offer: g.perkOffer, pend: g.gear.pend, beacons: g.beacons, stations: g.stations, selfRevive: g.selfRevive, startStratum: g.startStratum,
    stats: g.stats, maxStratum: g.maxStratum, tutorial: g.tutorial,
    player: { x: g.player.x, y: g.player.y, hp: g.player.hp, carrying: g.player.carrying, wpn: g.player.wpn, pk: g.player.pk, pet: g.player.pet },
    satchels: g.satchels, journey: g.journey, oil: g.oil,
  };
}
export function deserialize(d) {
  const g = newRun({ tutorial: !!d.tutorial, seed: d.seed, kademe: d.kademe | 0, daily: d.daily || null, start: false });
  g.map = unb64(d.map); g.rev = unb64(d.rev);
  g.buried = d.buried ? unb64(d.buried) : new Uint8Array(COLS * ROWS);
  if (g.map.length !== COLS * ROWS) throw new Error('harita boyutu uyumsuz'); g.bhp = d.bhp || {}; g.heartRow = d.heartRow; if (d.order) g.order = d.order;
  Object.assign(g.player.bag, d.bag); Object.assign(g.store, d.store); Object.assign(g.collected, d.collected);
  for (const k in d.lvl || {}) if (k in g.lvl) g.lvl[k] = Math.max(0, Math.min(UPGRADES[k].costs.length, d.lvl[k] | 0)); g.perks = (d.perks || []).filter(k => PERKS[k]); g.perkLv = d.perkLv || {}; g.rerolls = d.rerolls | 0;
  if (d.merchant && Array.isArray(d.merchant.goods)) g.merchant = d.merchant; if (d.merchT !== undefined) g.merchT = +d.merchT || 0; g.wishes = d.wishes | 0; if (Array.isArray(d.critters)) g.critters = d.critters.filter(c => CRITTERS[c.k]);
  for (const k of ['lakes', 'portals', 'shrooms']) if (Array.isArray(d[k])) g[k] = d[k];
  if (d.balrogDone) g.balrog = { st: 'done', t: 99 };
  if (d.serpentDone) g.serpent = { st: 'done', t: 99 };
  if (!d.tutorial) loadLairs(g, Array.isArray(d.lairs) ? d.lairs : []);
  if (!d.temple || d.temple.v !== 1) dropTemple(g); else if (g.temple) g.temple.st = d.temple.st === 'done' ? 'done' : 'wait'; // eski kayıt: haritada su tapınağı yok
  if (!d.hoard || d.hoard.v !== 2) g.hoard = null; // eski kayıt: haritada bu hazine salonu yok
  if (d.hoard && g.hoard) { g.hoard.st = d.hoard.st === 'done' ? 'done' : 'sleep'; g.hoard.wake = Math.max(0, Math.min(90, +d.hoard.wake || 0)); }
  if (d.lq && d.lk && g.lq) { const a = unb64(d.lq), b = unb64(d.lk); if (a.length === g.lq.length && b.length === g.lk.length) { g.lq = a; g.lk = b; g.lqT = d.lqT | 0; } }
  if (d.gear) { g.gear.owned = (d.gear.owned || []).filter(k => MODS[k]); g.gear.wOwn = (d.gear.wOwn || ['blaster']).filter(k => WEAPONS[k]); g.gear.pOwn = (d.gear.pOwn || ['std']).filter(k => PICK_TYPES[k]);
    g.gear.lv = Math.max(0, d.gear.lv | 0); g.gear.xp = Math.max(0, +d.gear.xp || 0);
    for (const k of CARD_KEYS) if (d.gear.cards && d.gear.cards[k]) g.gear.cards[k] = Math.min(CARDS[k].max, d.gear.cards[k] | 0);
    for (const k in d.gear.evo || {}) if (WEAPONS[k] && (d.gear.evo[k] === 0 || d.gear.evo[k] === 1)) g.gear.evo[k] = d.gear.evo[k];
    for (const k of FORGE_KEYS) g.gear.forge[k] = Math.max(0, Math.min(FORGE.costs.length, (d.gear.forge && d.gear.forge[k]) | 0));
    for (const k in d.gear.tLvl || {}) if (BUILD_KEYS.includes(k)) g.gear.tLvl[k] = Math.min(TOOL_UP.max, d.gear.tLvl[k] | 0); }
  for (const k of ITEM_KEYS) if (d.items && k in d.items) g.items[k] = Math.max(0, d.items[k] | 0);
  // kaldırılan aletler (Nöbetçi, Alev Kulesi, Havan): eski kayıttaki kemer ve kurulu olanların bedeli depoya iade edilir
  const OLD_TOOLS = { turret: { iron: 10 }, flame: { iron: 8, cobalt: 3 }, mortar: { iron: 12, cobalt: 4 } };
  for (const k in OLD_TOOLS) {
    const n = Math.max(0, (d.items && d.items[k]) | 0) + (d.structures || []).filter(s => s.type === k).length;
    for (const r in OLD_TOOLS[k]) g.store[r] += OLD_TOOLS[k][r] * n;
  }
  if (d.contracts) g.contracts = d.contracts;
  g.structures = (d.structures || []).filter(s => BUILDS[s.type] && s.c !== undefined).map(s => { const o = Object.assign(makeStructure(s.type, s.c, s.r), { hp: s.hp, buildT: 0 }); if (o.left && s.left > 0) o.left = Math.min(o.left, s.left | 0); return o; });
  g.threat = makeThreat(); if (d.threat) { g.threat.noise = Math.min(60, d.threat.noise || 0); g.threat.woke = Math.max(0, d.threat.woke | 0); g.threat.bossCd = Math.max(0, Math.min(120, +d.threat.bossCd || 0)); }
  if (d.evt) g.evt.t = Math.max(10, +d.evt.t || 0);
  g.beacons = d.beacons || []; g.selfRevive = d.selfRevive | 0; g.startStratum = d.startStratum | 0; g.stations = (d.stations || []).map(Number);
  Object.assign(g.stats, d.stats); g.maxStratum = d.maxStratum | 0; g.tutorial = d.tutorial;
  // görülen en derin biyom: eski kayıtta yoksa ulaşılan biyom sayılır (yoksa Dünya Tohumu yüklemede herkesi tam iyileştirir)
  g.seenStratum = d.seenStratum !== undefined ? d.seenStratum | 0 : g.maxStratum;
  const keysOk = o => o && Array.isArray(o.keys) && o.keys.length && o.keys.every(k => typeof k === 'string') && typeof o.chest === 'string';
  if (keysOk(d.offer)) g.perkOffer = { pi: 0, keys: d.offer.keys.slice(0, 6), chest: d.offer.chest };
  if (Array.isArray(d.pend)) g.gear.pend = d.pend.filter(o => o && (o.kind === 'start' || o.kind === 'lvl' || (o.kind === 'offer' && keysOk(o)))).slice(0, 12).map(o => Object.assign({}, o, { pi: 0 }));
  syncSeals(g);
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
  if (d.oil !== undefined) g.oil = Math.max(0, +d.oil || 0);
  g.cages = null;
  if (d.rng) g.rng = d.rng;
  g.mapVersion++;
  return g;
}
