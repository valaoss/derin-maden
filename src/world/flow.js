// Oyunculara doğru akış alanları (Dijkstra, çok kaynaklı). Düşmanlar tünelleri izleyerek seni bulur; yüzey (kamp) hedef değildir.
import { COLS, ROWS, GROUND_ROW, TILE } from '../config.js';
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
      let i = n++;
      while (i > 0) { const p = (i - 1) >> 1; if (v[p] <= val) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    },
    pop() {
      const key = k[0], val = v[0]; n--;
      if (n > 0) { const lk = k[n], lv = v[n]; let i = 0;
        for (;;) { let m = i * 2 + 1; if (m >= n) break;
          if (m + 1 < n && v[m + 1] < v[m]) m++;
          if (v[m] >= lv) break; k[i] = k[m]; v[i] = v[m]; i = m; }
        k[i] = lk; v[i] = lv; }
      popVal = val; return key;
    },
  };
}
let popVal = 0;
const heap = makeHeap();

function cost(t, mode) {
  if (t === T.AIR) return 1;
  if (t === T.BARRICADE) return BARRICADE_COST;
  const d = TD[t];
  if (d.unbreakable || t === T.HEART) return INF;
  if (mode === FIELD.digAll) return 2 + d.hp * 1.5;
  if (mode === FIELD.dig1 && d.hp <= 1) return 3 + d.hp * 4;
  return INF;
}
// karo türü -> giriş maliyeti tablosu (alan başına bir kez kurulur)
const COST = [0, 1, 2].map(mode => { const a = new Float64Array(256).fill(INF); for (const t of Object.values(T)) a[t] = cost(t, mode); return a; });
const DIR = [1, -1, COLS, -COLS], FIRST = GROUND_ROW * COLS; // kamp güvenli: düşman yüzeye çıkmaz

export function createFields() { return [new Float32Array(N), new Float32Array(N), new Float32Array(N)]; }

function solve(field, mode, goals) {
  const map = G.map, w = COST[mode];
  field.fill(INF); heap.clear();
  for (const i of goals) { field[i] = 0; heap.push(i, 0); }
  while (heap.size) {
    const i = heap.pop(), d = popVal;
    if (d > field[i]) continue;
    const c = i % COLS;
    for (let k = 0; k < 4; k++) {
      if ((k === 0 && c === COLS - 1) || (k === 1 && c === 0)) continue;
      const j = i + DIR[k];
      if (j < FIRST || j >= N) continue;
      // bir hücreye girme maliyeti, o hücrenin maliyeti
      const nd = d + w[map[j]];
      if (nd < field[j]) { field[j] = nd; heap.push(j, nd); }
    }
  }
}

function goalCells() {
  const g = [];
  for (const p of G.players) {
    if (p.dead) continue;
    const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
    if (r >= GROUND_ROW && r < ROWS && c >= 0 && c < COLS) g.push(r * COLS + c);
  }
  return g;
}
// Üç alan ardışık üç adımda çözülür: kazarken her 0.2 sn'de tek karelik takılma olmaz (kilit adımda iki tarafta aynı sırayla).
let pending = 0, pendingGoals = null;
export function updateFlow(dt) {
  G.flowTimer -= dt;
  if (pending) { const m = 3 - pending; pending--; solve(G.flow[m], m, pendingGoals); return; }
  if (G.flowTimer > 0) return;
  const goals = goalCells(), key = goals.join(',');
  if (G.flowVersion === G.mapVersion && G.flowKey === key) return;
  G.flowVersion = G.mapVersion; G.flowKey = key; G.flowTimer = 0.2;
  solve(G.flow[0], FIELD.walk, goals);
  pending = 2; pendingGoals = goals;
}
export function forceFlow() { pending = 0; G.flowVersion = -1; G.flowKey = ''; G.flowTimer = 0; updateFlow(0); while (pending) updateFlow(0); }

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
