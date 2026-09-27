// Sefer oluşturma, türetilmiş değerler ve kayıt/yükleme.
import { COLS, ROWS, TILE, GROUND_ROW, BASE_X, BASE_Y, CENTER_COL, PAD_COLS, PAD_Y } from '../config.js';
import { UPGRADES, PLAYER, BASE, WAVES, BUILDS } from '../data/balance.js';
import { generate } from '../world/gen.js';
import { createFields } from '../world/flow.js';
import { G, setG, App } from './state.js';

const emptyRes = () => ({ iron: 0, water: 0, cobalt: 0, crystal: 0 });

export function newRun({ tutorial = false, seed = (Math.random() * 1e9) | 0 } = {}) {
  const meta = App.meta, ml = meta.lv || {};
  const gen = generate(seed, { tutorial });
  const g = {
    seed, map: gen.map, heartRow: gen.heartRow,
    dmg: new Float32Array(COLS * ROWS), rev: new Uint8Array(COLS * ROWS), bhp: {},
    mapVersion: 1, dirty: [], dirtyDmg: false, flow: createFields(), flowVersion: -1, flowTimer: 0,
    time: 0, hitstop: 0,
    player: null,
    base: { x: BASE_X, y: BASE_Y, hp: 0, maxHp: 0, hurtT: 0 },
    bag: emptyRes(), store: emptyRes(), collected: emptyRes(),
    lvl: { drill: Math.min(2, ml.keskinUc | 0), bag: 0, armor: 0, blaster: Math.min(2, ml.ayarliBl | 0), lamp: 0 },
    perks: [], barricades: 0,
    structures: [], enemies: [], bullets: [], ebullets: [], orbs: [], particles: [], pIdx: 0, flashes: [], lightSrc: [],
    satchel: null,
    wave: { num: 0, phase: 'calm', t: tutorial ? Infinity : WAVES.firstCalm, nests: [], queue: [], rumbleT: 0 },
    stats: { maxDepth: 0, wavesCleared: 0, chests: 0, kills: 0, dug: 0, victory: false, time: 0 },
    maxStratum: 0,
    tutorial: tutorial ? { step: 0, t: 0, done: false } : null,
    cam: { x: 0, y: 0, px: 0, py: 0, trauma: 0, kx: 0, ky: 0 },
    combo: { n: 0, t: 0 },
    deposit: [], bagFullT: 0,
    paused: false, over: false,
  };
  g.store.iron = 8 * (ml.erzak | 0);
  g.player = {
    x: (CENTER_COL + 3) * TILE + 8, y: GROUND_ROW * TILE - 10, px: 0, py: 0,
    face: 1, dx: 0, dy: 1, hp: 0, maxHp: 0, iframes: 0, dead: false, respawnT: 0,
    dig: null, digT: 0, digAnim: 0, digDir: [0, 1], walkT: 0, moving: false, up: false,
    fireCd: 0, aim: 0, aimT: 0, carrying: false, hurtT: 0, shockCd: 0, squash: 0,
  };
  g.player.px = g.player.x; g.player.py = g.player.y;
  setG(g);
  recompute(true);
  if (ml.hazirTaret) g.structures.push(makeStructure('turret', 1));
  // yüzeyi baştan açığa çıkar
  for (let r = 0; r < GROUND_ROW + 1; r++) for (let c = 0; c < COLS; c++) g.rev[r * COLS + c] = 1;
  return g;
}

export function makeStructure(type, pad) {
  const b = BUILDS[type];
  return { type, pad, x: PAD_COLS[pad] * TILE + 8, y: PAD_Y, hp: b.hp, maxHp: b.hp, cd: 0.5, aim: -Math.PI / 2, buildT: 0.5, hurtT: 0 };
}

export function hasPerk(k) { return G.perks.includes(k); }

// Seviye/perk/meta'ya bağlı değerler
export function recompute(fill = false) {
  const ml = App.meta.lv || {};
  G.bagCap = UPGRADES.bag.cap[G.lvl.bag] + 4 * (ml.genisCanta | 0) + (hasPerk('derinCep') ? 12 : 0);
  const maxHp = UPGRADES.armor.hp[G.lvl.armor];
  const d = maxHp - G.player.maxHp;
  G.player.maxHp = maxHp;
  G.player.hp = fill ? maxHp : Math.min(maxHp, G.player.hp + Math.max(0, d));
  const bmax = BASE.hp + 60 * (ml.tahkimat | 0) + (hasPerk('kaleUs') ? 120 : 0);
  const bd = bmax - G.base.maxHp;
  G.base.maxHp = bmax;
  G.base.hp = fill ? bmax : Math.min(bmax, G.base.hp + Math.max(0, bd));
}

export function lampTiles() {
  return UPGRADES.lamp.radius[G.lvl.lamp] + (hasPerk('parlakFener') ? 2 : 0);
}
export function bagCount() { const b = G.bag; return b.iron + b.water + b.cobalt + b.crystal; }

// ---------- kayıt ----------
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

export function serialize() {
  const g = G;
  return {
    v: 4, seed: g.seed, heartRow: g.heartRow, map: b64(g.map), rev: b64(g.rev), bhp: g.bhp,
    base: { hp: g.base.hp }, bag: g.bag, store: g.store, collected: g.collected, lvl: g.lvl, perks: g.perks,
    barricades: g.barricades, structures: g.structures.map(s => ({ type: s.type, pad: s.pad, hp: s.hp })),
    wave: { num: g.wave.num, t: g.wave.phase === 'calm' ? g.wave.t : 12 },
    stats: g.stats, maxStratum: g.maxStratum, tutorial: g.tutorial,
    player: { x: g.player.x, y: g.player.y, hp: g.player.hp, carrying: g.player.carrying },
    satchel: g.satchel,
  };
}
export function deserialize(d) {
  const g = newRun({ seed: d.seed });
  g.map = unb64(d.map); g.rev = unb64(d.rev); g.bhp = d.bhp || {}; g.heartRow = d.heartRow;
  Object.assign(g.bag, d.bag); Object.assign(g.store, d.store); Object.assign(g.collected, d.collected);
  Object.assign(g.lvl, d.lvl); g.perks = d.perks || []; g.barricades = d.barricades | 0;
  g.structures = (d.structures || []).map(s => Object.assign(makeStructure(s.type, s.pad), { hp: s.hp, buildT: 0 }));
  g.wave.num = d.wave.num; g.wave.t = d.wave.t; g.wave.phase = 'calm';
  Object.assign(g.stats, d.stats); g.maxStratum = d.maxStratum | 0; g.tutorial = d.tutorial;
  if (g.tutorial && g.tutorial.step < 3) g.wave.t = Infinity;
  recompute(true);
  g.base.hp = Math.min(g.base.maxHp, d.base.hp);
  Object.assign(g.player, d.player); g.player.px = g.player.x; g.player.py = g.player.y;
  g.player.hp = Math.max(1, Math.min(g.player.maxHp, d.player.hp));
  g.satchel = d.satchel || null;
  g.mapVersion++;
  return g;
}
