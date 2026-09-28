// Tile tabanlı ışık: kaynaklardan Dijkstra ile yayılır, kayadan zor geçer.
// Sonuç her karede görünür pencere için hesaplanır (~17x40 hücre).
import { COLS, ROWS, GROUND_ROW, TILE, CENTER_COL, STRATUM_ROWS } from '../config.js';
import { TD, T } from '../data/tiles.js';
import { G } from '../game/state.js';
import { TORCH } from '../data/balance.js';

const MAXC = COLS * 64;
const rem = new Float32Array(MAXC);
const hk = new Int32Array(MAXC * 12), hv = new Float32Array(MAXC * 12); let hn = 0;
function push(k, v) { let i = hn++; hk[i] = k; hv[i] = v;
  while (i > 0) { const p = (i - 1) >> 1; if (hv[p] >= hv[i]) break;
    const tk = hk[p], tv = hv[p]; hk[p] = hk[i]; hv[p] = hv[i]; hk[i] = tk; hv[i] = tv; i = p; } }
let popV = 0;
function pop() { const k = hk[0]; popV = hv[0]; hn--;
  if (hn > 0) { hk[0] = hk[hn]; hv[0] = hv[hn]; let i = 0;
    for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < hn && hv[l] > hv[m]) m = l; if (r < hn && hv[r] > hv[m]) m = r;
      if (m === i) break; const tk = hk[m], tv = hv[m]; hk[m] = hk[i]; hv[m] = hv[i]; hk[i] = tk; hv[i] = tv; i = m; } }
  return k; }

export const lightWin = { r0: 0, rows: 0, data: new Float32Array(MAXC) };

function ambient(r) {
  if (r < GROUND_ROW) return 1;
  return Math.max(0, 0.6 - (r - GROUND_ROW) * 0.036);
}

// sources: [{x,y,s}] dünya pikseli, s = blok cinsinden güç
export function computeLight(r0, r1, sources, revFloor = 0.26) {
  r0 = Math.max(0, r0); r1 = Math.min(ROWS - 1, r1);
  const rows = r1 - r0 + 1, n = rows * COLS;
  rem.fill(0, 0, n); hn = 0;
  const seed = (c, r, s) => {
    if (r < r0 || r > r1 || c < 0 || c >= COLS) return;
    const i = (r - r0) * COLS + c; if (s > rem[i]) { rem[i] = s; push(i, s); }
  };
  for (const L of sources) seed(Math.floor(L.x / TILE), Math.floor(L.y / TILE), L.s);
  // gün ışığı şafttan süzülür
  if (r0 < GROUND_ROW) for (let c = 0; c < COLS; c++) seed(c, Math.min(GROUND_ROW - 1, r1), 7.5);
  while (hn) {
    const i = pop(), v = popV;
    if (v < rem[i]) continue;
    const c = i % COLS, rr = (i / COLS) | 0, r = rr + r0;
    const t = G.map[r * COLS + c];
    const passCost = TD[t].solid ? 2.3 : 1;
    const out = v - passCost;
    if (out <= 0) continue;
    if (c > 0 && out > rem[i - 1]) { rem[i - 1] = out; push(i - 1, out); }
    if (c < COLS - 1 && out > rem[i + 1]) { rem[i + 1] = out; push(i + 1, out); }
    if (rr > 0 && out > rem[i - COLS]) { rem[i - COLS] = out; push(i - COLS, out); }
    if (rr < rows - 1 && out > rem[i + COLS]) { rem[i + COLS] = out; push(i + COLS, out); }
    // çapraz yayılım: ışık daire gibi dağılsın (Manhattan elması değil)
    const od = v - passCost * 1.414;
    if (od > 0) {
      if (c > 0 && rr > 0 && od > rem[i - COLS - 1]) { rem[i - COLS - 1] = od; push(i - COLS - 1, od); }
      if (c < COLS - 1 && rr > 0 && od > rem[i - COLS + 1]) { rem[i - COLS + 1] = od; push(i - COLS + 1, od); }
      if (c > 0 && rr < rows - 1 && od > rem[i + COLS - 1]) { rem[i + COLS - 1] = od; push(i + COLS - 1, od); }
      if (c < COLS - 1 && rr < rows - 1 && od > rem[i + COLS + 1]) { rem[i + COLS + 1] = od; push(i + COLS + 1, od); }
    }
  }
  const D = lightWin.data;
  for (let rr = 0; rr < rows; rr++) {
    const r = rr + r0, a = ambient(r);
    for (let c = 0; c < COLS; c++) {
      const i = rr * COLS + c, wi = r * COLS + c;
      const v = rem[i] / 4.2;
      let b = v >= 1 ? 1 : v * (2 - v);
      if (b > 0.35) G.rev[wi] = 1;
      if (G.rev[wi] && b < revFloor) b = revFloor;
      if (b < a) b = a;
      if (r >= GROUND_ROW && b < 0.045) b = 0.045;
      D[i] = b;
    }
  }
  lightWin.r0 = r0; lightWin.rows = rows;
}

export function lightSourcesFor(g, lampTiles) {
  const L = g.lightSrc; L.length = 0;
  for (const p of g.players) if (!p.dead) L.push({ x: p.x, y: p.y, s: lampTiles });
  for (const s of g.satchels) L.push({ x: s.x, y: s.y, s: 2.5 });
  for (const e of g.enemies) { if (e.dead) continue; if (e.type === 'glarer') L.push({ x: e.x, y: e.y, s: e.flashT > 0 ? 9 : 2.6 }); else if (e.d.boom) L.push({ x: e.x, y: e.y, s: 1.6 }); }
  L.push({ x: g.base.x, y: g.base.y, s: 7 });
  for (const s of g.structures) L.push({ x: s.x, y: s.y - 4, s: s.type === 'lamp' ? 7 : s.type === 'heal' ? 3.6 : s.type === 'flame' && s.firing ? 4.2 : 3 });
  for (const t of g.torches) L.push({ x: t.c * TILE + 8, y: t.r * TILE + 6, s: TORCH.light });
  // asansör istasyonu fenerleri
  for (const s of g.stations || []) L.push({ x: CENTER_COL * TILE + 8, y: (GROUND_ROW + s * STRATUM_ROWS + 1) * TILE + 4, s: 4 });
  for (const b of g.bombs) L.push({ x: b.x, y: b.y - 6, s: 1.8 });
  for (const f of g.flashes) L.push({ x: f.x, y: f.y, s: f.s * (f.t / f.t0) });
  return L;
}

export function glowTileSources(g, r0, r1, out) {
  for (let r = Math.max(GROUND_ROW, r0); r <= Math.min(ROWS - 1, r1); r++) for (let c = 0; c < COLS; c++) {
    const t = g.map[r * COLS + c];
    if (t === T.CHEST) out.push({ x: c * TILE + 8, y: r * TILE + 8, s: 2.6 });
    else if (t === T.NEST) out.push({ x: c * TILE + 8, y: r * TILE + 8, s: 2.4 });
    else if (t === T.HEART) out.push({ x: c * TILE + 8, y: r * TILE + 8, s: 6.5 });
    else if (TD[t].ore === 'crystal' || TD[t].ore === 'cobalt') out.push({ x: c * TILE + 8, y: r * TILE + 8, s: 1.9 });
    else if (TD[t].ore === 'gold') out.push({ x: c * TILE + 8, y: r * TILE + 8, s: 1.6 });
    else if (TD[t].ember) out.push({ x: c * TILE + 8, y: r * TILE + 8, s: 3.2 });
  }
}
