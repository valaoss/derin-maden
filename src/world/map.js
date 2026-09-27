import { COLS, ROWS, TILE, GROUND_ROW, stratumOfRow } from '../config.js';
import { T, TD, HOST_MAT } from '../data/tiles.js';
import { G } from '../game/state.js';

export function idx(c, r) { return r * COLS + c; }
export function inWorld(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
export function tileAt(c, r) {
  if (c < 0 || c >= COLS || r >= ROWS) return T.BEDROCK;
  if (r < 0) return T.AIR;
  return G.map[r * COLS + c];
}
export function solidAt(c, r) { return TD[tileAt(c, r)].solid; }
export function solidAtPx(x, y) { return solidAt(Math.floor(x / TILE), Math.floor(y / TILE)); }

export function hostMat(r) { return HOST_MAT[Math.max(0, stratumOfRow(r))]; }
export function matOf(c, r) {
  const d = TD[tileAt(c, r)];
  if (!d.mat) return hostMat(r);
  return d.mat === 'host' ? hostMat(r) : d.mat;
}

export function setTile(c, r, t) {
  if (!inWorld(c, r)) return;
  const i = idx(c, r);
  if (G.map[i] === t) return;
  G.map[i] = t;
  G.dmg[i] = 0;
  G.mapVersion++;
  G.dirty.push(c, r);
}

// Kazı hasarı: kırıldıysa true döner
export function damageTile(c, r, amount) {
  const i = idx(c, r);
  const t = G.map[i];
  const hp = TD[t].hp;
  G.dmg[i] += amount;
  G.dirtyDmg = true;
  return G.dmg[i] >= hp - 1e-6;
}
export function tileDamage01(c, r) {
  const i = idx(c, r), t = G.map[i];
  const hp = TD[t].hp;
  return hp > 0 && isFinite(hp) ? Math.min(1, G.dmg[i] / hp) : 0;
}

export function isUnderground(r) { return r >= GROUND_ROW; }
