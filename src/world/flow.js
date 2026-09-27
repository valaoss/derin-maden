// Üsse doğru akış alanları (Dijkstra). Düşmanlar oyuncunun açtığı tünelleri izler.
import { COLS, ROWS, GROUND_ROW, CENTER_COL } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { G } from '../game/state.js';

const N = COLS * ROWS;
const INF = 1e9;
export const FIELD = { walk: 0, dig1: 1, digAll: 2 };
const BARRICADE_COST = 14;

function makeHeap() {
  const k = new Int32Array(N * 4), v = new Float64Array(N * 4); let n = 0;
  return {
    clear() { n = 0; }, get size() { return n; },
    push(key, val) {
      let i = n++; k[i] = key; v[i] = val;
      while (i > 0) { const p = (i - 1) >> 1; if (v[p] <= v[i]) break;
        [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
    },
    pop() {
      const key = k[0], val = v[0]; n--;
      if (n > 0) { k[0] = k[n]; v[0] = v[n]; let i = 0;
        for (;;) { const l = i * 2 + 1, r = l + 1; let m = i;
          if (l < n && v[l] < v[m]) m = l; if (r < n && v[r] < v[m]) m = r;
          if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } }
      popVal = val; return key;
    },
  };
}
let popVal = 0;
const heap = makeHeap();

function cost(t, r, mode) {
  if (r < 3) return INF;
  if (t === T.AIR) return 1;
  if (t === T.BARRICADE) return BARRICADE_COST;
  const d = TD[t];
  if (d.unbreakable || t === T.HEART) return INF;
  if (mode === FIELD.digAll) return 2 + d.hp * 1.5;
  if (mode === FIELD.dig1 && d.hp <= 1) return 3 + d.hp * 4;
  return INF;
}

export function createFields() { return [new Float32Array(N), new Float32Array(N), new Float32Array(N)]; }

function solve(field, mode) {
  field.fill(INF); heap.clear();
  for (let r = 3; r < GROUND_ROW; r++) for (let c = CENTER_COL - 2; c <= CENTER_COL + 2; c++) {
    const i = r * COLS + c; field[i] = 0; heap.push(i, 0);
  }
  while (heap.size) {
    const i = heap.pop(), d = popVal;
    if (d > field[i]) continue;
    const c = i % COLS, r = (i / COLS) | 0;
    for (let k = 0; k < 4; k++) {
      const nc = c + (k === 0 ? 1 : k === 1 ? -1 : 0), nr = r + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const j = nr * COLS + nc;
      // bir hücreye girme maliyeti, o hücrenin maliyeti
      const w = cost(G.map[j], nr, mode);
      if (w >= INF) continue;
      const nd = d + w;
      if (nd < field[j]) { field[j] = nd; heap.push(j, nd); }
    }
  }
}

export function updateFlow(dt) {
  G.flowTimer -= dt;
  if (G.flowVersion === G.mapVersion || G.flowTimer > 0) return;
  G.flowVersion = G.mapVersion; G.flowTimer = 0.2;
  solve(G.flow[0], FIELD.walk);
  solve(G.flow[1], FIELD.dig1);
  solve(G.flow[2], FIELD.digAll);
}
export function forceFlow() { G.flowVersion = -1; G.flowTimer = 0; updateFlow(0); }

export function flowAt(mode, c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return INF;
  return G.flow[mode][r * COLS + c];
}
// En düşük değerli komşu (yoksa null)
export function nextStep(mode, c, r) {
  let best = flowAt(mode, c, r), bc = -1, br = -1;
  const f = G.flow[mode];
  for (let k = 0; k < 4; k++) {
    const nc = c + (k === 0 ? 1 : k === 1 ? -1 : 0), nr = r + (k === 2 ? -1 : k === 3 ? 1 : 0);
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
    const v = f[nr * COLS + nc];
    if (v < best) { best = v; bc = nc; br = nr; }
  }
  return bc < 0 ? null : { c: bc, r: br };
}
export const FLOW_INF = INF;
