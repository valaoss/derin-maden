// Harita sürprizleri: yeraltı gölleri (olta at, bir şey çıkar), portal taşı çiftleri (yakına ışınlar),
// yenebilir mantarlar (küçültür, büyütür, hızlandırır ya da zehirler). Yerleşim tohumdan, etkiler simülasyonda.
import { COLS, ROWS, TILE, GROUND_ROW, STRATUM_ROWS, STRATA_COUNT, PLAY_MIN_COL, PLAY_MAX_COL, CENTER_COL } from '../config.js';
import { T, isPlain } from '../data/tiles.js';
import { LAKE, PORTAL, SHROOM, ITEMS, ITEM_KEYS } from '../data/balance.js';
import { mulberry32 } from '../core/util.js';
import { rnd } from '../core/rng.js';
import { G } from './state.js';
import { isUnlocked, isLocal } from './run.js';
import { itemMax, offer, perkChoices } from './chests.js';
import { poisonPlayer } from './player.js';
import { sfx } from '../audio/audio.js';
import { emit } from '../core/events.js';

export const SHROOM_KINDS = ['mini', 'dev', 'hiz', 'zehir'];

export function placeWonders(g, seed) {
  const R = mulberry32((seed | 0) ^ 0x5eed1a4e), lakes = [], portals = [], shrooms = [];
  const ok = (c, r) => r > GROUND_ROW && r < ROWS - 3 && (c < PLAY_MIN_COL || c > PLAY_MAX_COL || isPlain(g.map[r * COLS + c]));
  const box = (c, r, w, h, m = 1) => {
    if (c < PLAY_MIN_COL || c + w - 1 > PLAY_MAX_COL || (c <= CENTER_COL + 1 && c + w - 1 >= CENTER_COL - 1)) return false;
    for (let y = r - m; y <= r + h; y++) for (let x = c - m; x < c + w + m; x++) if (!ok(x, y)) return false;
    return true;
  };
  const carve = (c, r, w, h) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) g.map[y * COLS + x] = T.AIR; };
  const col = w => PLAY_MIN_COL + Math.floor(R() * (PLAY_MAX_COL - PLAY_MIN_COL - w + 2));
  const find = (w, h, r0, r1, m, test) => { for (let i = 0; i < 120; i++) { const c = col(w), r = r0 + Math.floor(R() * (r1 - r0)); if (box(c, r, w, h, m) && (!test || test(c, r))) return [c, r]; } return null; };
  // göl yatağı: suyun iki yanı ve altı kırılmaz (kazılırsa su havada kalırdı); üstü ve üst yanları açık kalır
  const bed = (c, r) => { if (c >= PLAY_MIN_COL && c <= PLAY_MAX_COL) g.map[r * COLS + c] = T.LAKEBED; };
  const shore = (c, r) => [c - 1, c + LAKE.w].every(x => ok(x, r + LAKE.h - 1) && ok(x, r + LAKE.h));
  const basin = (c, r, w, h) => { for (let x = c - 1; x <= c + w; x++) bed(x, r + h); bed(c - 1, r + h - 1); bed(c + w, r + h - 1); };
  for (let s = 0; s < STRATA_COUNT; s++) {
    const top = GROUND_ROW + s * STRATUM_ROWS + 3, bot = top + STRATUM_ROWS - 8;
    if (R() < LAKE.chance) { const q = find(LAKE.w, LAKE.h, top, bot, 0, shore); if (q) { carve(q[0], q[1], LAKE.w, LAKE.h); basin(q[0], q[1], LAKE.w, LAKE.h); lakes.push({ c: q[0], r: q[1], w: LAKE.w, h: LAKE.h, fish: LAKE.fish }); } }
    if (R() < PORTAL.chance) {
      const a = find(1, 1, top, bot);
      if (a) {
        let b = null;
        for (let i = 0; i < 40 && !b; i++) {
          const dr = (PORTAL.min + Math.floor(R() * (PORTAL.max - PORTAL.min + 1))) * (R() < 0.5 ? -1 : 1), c = col(1), r = a[1] + dr;
          if (Math.hypot(c - a[0], dr) <= PORTAL.max + 2 && box(c, r, 1, 1)) b = [c, r];
        }
        if (b) { carve(a[0], a[1], 1, 1); carve(b[0], b[1], 1, 1); portals.push({ a, b, hue: portals.length % 3 }); }
      }
    }
    for (let n = 0; n < SHROOM.per; n++) {
      if (R() >= SHROOM.chance) continue;
      const q = find(1, 1, top, bot + 4);
      if (q) { carve(q[0], q[1], 1, 1); shrooms.push({ c: q[0], r: q[1], hue: Math.floor(R() * 4), eaten: false }); }
    }
  }
  return { lakes, portals, shrooms };
}

const inLake = (p, L) => p.x >= L.c * TILE && p.x <= (L.c + L.w) * TILE && p.y >= L.r * TILE && p.y <= (L.r + L.h) * TILE;
export function lakeAt(p) {
  if (!p || p.dead || p.ride) return -1;
  return (G.lakes || []).findIndex(L => L.fish > 0 && inLake(p, L));
}

export function castLine(p) {
  const li = lakeAt(p);
  if (li < 0 || p.fish) { if (isLocal(p)) sfx.deny(); return false; }
  p.fish = { t: LAKE.bite + rnd() * LAKE.biteVar, li };
  emit('fishCast', { pi: p.i, li });
  return true;
}

function catchRoll() {
  const deep = G.maxStratum | 0, r = rnd() * 100;
  if (r < 35) { const id = ['iron', 'water', 'cobalt'][Math.floor(rnd() * 3)]; return { k: 'res', id, n: 6 + Math.floor(rnd() * 6) + deep * 2 }; }
  if (r < 60) return { k: 'gold', n: 10 + deep * 3 };
  if (r < 75) return { k: 'res', id: 'crystal', n: 2 + Math.floor(rnd() * 3) + (deep >> 1) };
  if (r < 88) return { k: 'heal' };
  if (r < 97) { const ks = ITEM_KEYS.filter(k => !ITEMS[k].build && isUnlocked(k) && (G.items[k] | 0) < itemMax(k)); if (ks.length) return { k: 'item', id: ks[Math.floor(rnd() * ks.length)] }; return { k: 'gold', n: 10 + deep * 3 }; }
  return { k: 'chest' };
}

function grant(p, g) {
  if (g.k === 'res' || g.k === 'gold') { const id = g.k === 'gold' ? 'gold' : g.id; G.store[id] += g.n; G.collected[id] += g.n; emit('storePop', id); }
  else if (g.k === 'item') G.items[g.id] = Math.min(itemMax(g.id), (G.items[g.id] | 0) + 1);
  else if (g.k === 'heal') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
  else offer(p, 'wood', perkChoices('wood'));
  emit('store');
}

function eatShroom(p) {
  const k = SHROOM_KINDS[Math.floor(rnd() * SHROOM_KINDS.length)];
  p.shroom = { k, t: k === 'zehir' ? SHROOM.poisonT : k === 'hiz' ? SHROOM.haste : SHROOM.dur, tick: 0 };
  if (k === 'hiz') p.hasteT = Math.max(p.hasteT || 0, SHROOM.haste);
  emit('shroom', { pi: p.i, k, x: p.x, y: p.y });
}

export function updateWonders(dt) {
  if (G.tutorial) return;
  for (const p of G.players) {
    if (p.portCd > 0) p.portCd -= dt;
    const S = p.shroom;
    if (S) {
      if (S.k === 'zehir' && !p.dead && (S.tick -= dt) <= 0) { S.tick = 0.5; poisonPlayer(p, SHROOM.poisonDmg); }
      if ((S.t -= dt) <= 0 || p.dead) { p.shroom = null; emit('shroomEnd', { pi: p.i, k: S.k }); }
    }
    if (p.eat && (p.eat.t -= dt) <= 0) { p.eat = null; if (!p.dead) eatShroom(p); }
    if (p.fish) {
      const L = G.lakes[p.fish.li];
      if (p.dead || p.ride || !L || !inLake(p, L)) { p.fish = null; emit('fishLost', { pi: p.i }); }
      else if ((p.fish.t -= dt) <= 0) {
        const got = catchRoll(), li = p.fish.li;
        p.fish = null; L.fish--; grant(p, got);
        emit('fishDone', { pi: p.i, li, got });
      }
    }
    if (p.dead || p.ride) continue;
    for (const s of G.shrooms || []) {
      if (s.eaten || p.eat || Math.abs(p.x - (s.c * TILE + 8)) > SHROOM.reach || Math.abs(p.y - (s.r * TILE + 8)) > SHROOM.reach) continue;
      s.eaten = true; p.eat = { t: SHROOM.eat };
      emit('shroomEat', { pi: p.i, x: s.c * TILE + 8, y: s.r * TILE + 12, hue: s.hue });
    }
    // portal: üstüne basınca eşine ışınlar; oradan inmeden geri dönmez
    let on = null;
    (G.portals || []).forEach((P, i) => { for (const [from, to, key] of [[P.a, P.b, i * 2], [P.b, P.a, i * 2 + 1]]) if (!on && Math.abs(p.x - (from[0] * TILE + 8)) <= PORTAL.reach && Math.abs(p.y - (from[1] * TILE + 8)) <= PORTAL.reach) on = { from, to, key, P }; });
    if (!on) { p.portLock = -1; continue; }
    if (on.key === p.portLock || p.portCd > 0) continue;
    const fx = on.from[0] * TILE + 8, fy = on.from[1] * TILE + 8, tx = on.to[0] * TILE + 8, ty = on.to[1] * TILE + 8;
    p.x = p.px = tx; p.y = p.py = ty; p.dig = null; p.fish = null; p.portCd = PORTAL.cd; p.portLock = on.key ^ 1;
    emit('portal', { pi: p.i, x0: fx, y0: fy, x1: tx, y1: ty, hue: on.P.hue });
    if (isLocal(p)) sfx.warp();
  }
}
