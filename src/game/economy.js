// Harcama: yükseltmeler, yapılar, barikatlar, onarım, perk'ler.
import { TILE, GROUND_ROW } from '../config.js';
import { T } from '../data/tiles.js';
import { UPGRADES, BUILDS, BARRICADE, REPAIR, PERKS } from '../data/balance.js';
import { G, App } from './state.js';
import { tileAt, setTile, idx } from '../world/map.js';
import { makeStructure, recompute, hasPerk } from './run.js';
import { sparks, ring, dust } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

export function canAfford(cost) { for (const k in cost) if ((G.store[k] || 0) < cost[k]) return false; return true; }
function pay(cost) { for (const k in cost) G.store[k] -= cost[k]; emit('store'); }

export function upgradeCost(key) {
  const u = UPGRADES[key], l = G.lvl[key];
  return l < u.costs.length ? u.costs[l] : null;
}
export function buyUpgrade(key) {
  const c = upgradeCost(key);
  if (!c || !canAfford(c)) { sfx.deny(); return false; }
  pay(c); G.lvl[key]++; recompute();
  sfx.buy(); haptic(15);
  const p = G.player; ring(p.x, p.y, '#f2c14e', 18); sparks(p.x, p.y, '#ffe79a', 10, 70);
  emit('upgraded', key);
  return true;
}

export function buildOnPad(type, pad) {
  const b = BUILDS[type];
  if (G.structures.some(s => s.pad === pad)) return false;
  if (!canAfford(b.cost)) { sfx.deny(); return false; }
  pay(b.cost);
  const s = makeStructure(type, pad);
  G.structures.push(s);
  sfx.build(); haptic(20);
  dust(s.x, s.y, 5); sparks(s.x, s.y, '#ffe79a', 8, 60);
  return true;
}

export function buyBarricade() {
  if (!canAfford(BARRICADE.cost)) { sfx.deny(); return false; }
  pay(BARRICADE.cost); G.barricades++; sfx.buy(); return true;
}
// Barikatı oyuncunun baktığı boş hücreye, yoksa arkasına koy
export function barricadeTarget() {
  const p = G.player;
  if (p.dead || G.barricades <= 0 || p.y < GROUND_ROW * TILE) return null;
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
  const vert = Math.abs(p.dy) >= Math.abs(p.dx);
  const fx = vert ? 0 : Math.sign(p.dx) || p.face, fy = vert ? Math.sign(p.dy) || 1 : 0;
  for (const [dc, dr] of [[fx, fy], [-fx, -fy]]) {
    const tc = c + dc, tr = r + dr;
    if (tr < GROUND_ROW) continue;
    if (tileAt(tc, tr) !== T.AIR) continue;
    if (G.enemies.some(e => Math.floor(e.x / TILE) === tc && Math.floor(e.y / TILE) === tr)) continue;
    return { c: tc, r: tr };
  }
  return null;
}
export function placeBarricade() {
  const t = barricadeTarget();
  if (!t) { sfx.deny(); return false; }
  setTile(t.c, t.r, T.BARRICADE); G.bhp[idx(t.c, t.r)] = BARRICADE.hp;
  G.barricades--;
  sfx.build(); haptic(20); dust(t.c * TILE + 8, t.r * TILE + 8, 4);
  return true;
}

export function repairBase() {
  const b = G.base;
  if (b.hp >= b.maxHp || !canAfford(REPAIR.cost)) { sfx.deny(); return false; }
  pay(REPAIR.cost); b.hp = Math.min(b.maxHp, b.hp + REPAIR.amount);
  sfx.buy(); sparks(b.x, b.y - 10, '#5fe0b8', 12, 60);
  return true;
}

export function perkChoices() {
  const n = (App.meta.lv.kalintiBil ? 4 : 3);
  const pool = Object.keys(PERKS).filter(k => !G.perks.includes(k));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
export function applyPerk(k) {
  G.perks.push(k);
  if (k === 'kaleUs') { recompute(); G.base.hp = G.base.maxHp; }
  recompute();
  const p = G.player; ring(p.x, p.y, '#ffd24a', 24); sparks(p.x, p.y, '#ffd24a', 14, 90);
  sfx.buy();
}
