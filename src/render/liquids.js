// Sıvı çizimi: dinlenen su düz yüzeyli ve dalgalı, düşen su akış çizgili ince bir perde; şelalenin çarptığı yerde köpük.
// Lav koyu kabuklu, turuncu yüzeyli, kabarcıklı; ışık katmanında parlar. Buhar: su lavla buluşunca.
import { COLS, TILE } from '../config.js';
import { TD } from '../data/tiles.js';
import { G } from '../game/state.js';
import { on } from '../core/events.js';
import { hash2 } from '../core/util.js';

const steam = [];
on('steam', d => { if (steam.length < 40) steam.push({ x: d.x, y: d.y, t0: G.time }); });
let X;
const R = (col, x, y, w = 1, h = 1) => { X.fillStyle = col; X.fillRect(Math.round(x), Math.round(y), w, h); };
const W = { body: 'rgba(38,120,200,0.62)', deep: 'rgba(20,70,150,0.5)', top: '#8ad8ff', foam: '#e8f8ff', fall: 'rgba(70,160,230,0.7)', streak: '#bfeaff' };
const L = { body: '#c8401a', deep: '#8a2010', top: '#ffb040', crust: '#5a1a0a', hot: '#fff0a0' };

export function drawLiquids(ctx, r0, r1) {
  if (!G.lq) return;
  X = ctx; const t = G.time, lq = G.lq, lk = G.lk, map = G.map;
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c, a = lq[i]; if (!a) continue;
    const k = lk[i], x = c * TILE, y = r * TILE, up = lq[i - COLS] && lk[i - COLS] === k, b = i + COLS;
    const falling = !TD[map[b]].solid && lq[b] < 8;
    if (k === 0) {
      if (falling) {
        // düşen su: ortada perde, aşağı kayan açık çizgiler
        const w = Math.min(14, 4 + a), x0 = x + 8 - w / 2;
        R(W.fall, x0, y, w, 16);
        for (let q = 0; q < 3; q++) { const sy = (t * 60 + q * 6 + c * 5) % 16; R(W.streak, x0 + 1 + ((q * 3 + c) % Math.max(1, w - 2)), y + sy, 1, 3); }
        continue;
      }
      const h = up ? 16 : Math.max(2, a * 2), top = y + 16 - h;
      R(W.body, x, top, 16, h);
      if (h > 6) R(W.deep, x, y + 13, 16, 3);
      if (!up) {
        for (let px = 0; px < 16; px += 2) R(W.top, x + px, top + (Math.sin(t * 2.4 + (x + px) * 0.3) > 0.6 ? 1 : 0), 2, 1);
        const hi = (t * 8 + hash2(c, r, 3) * 16) % 16; R('#ffffff', x + hi, top + 2, 2, 1);
      }
      // şelalenin çarptığı yer: köpük
      if (lq[i - COLS] > 0 && lq[i - COLS] < 6 && lk[i - COLS] === 0 && lq[i] >= 7) {
        for (let q = 0; q < 4; q++) R(W.foam, x + 3 + hash2(c, Math.floor(t * 10) + q, 7) * 10, y + hash2(q, Math.floor(t * 10), c) * 4, 1, 1);
      }
    } else {
      const h = up ? 16 : Math.max(2, a * 2), top = y + 16 - h;
      if (falling) { const w = Math.min(12, 3 + a), x0 = x + 8 - w / 2; R(L.body, x0, y, w, 16); R(L.top, x0 + 1, y + (t * 30 + c * 7) % 16, 1, 4); continue; }
      R(L.body, x, top, 16, h); R(L.deep, x, y + 12, 16, 4);
      for (let q = 0; q < 3; q++) { const cx = (hash2(c, r, q) * 16 + t * (2 + q)) % 14; R(L.crust, x + cx, top + 3 + q * 3, 3, 1); }
      if (!up) {
        R(L.top, x, top, 16, 1);
        const bp = (t * 0.7 + hash2(c, r, 9)) % 1;
        if (bp < 0.25) { R(L.hot, x + 4 + hash2(r, c, 4) * 8, top - bp * 12, 2, 2); }
      }
    }
  }
  for (let n = steam.length - 1; n >= 0; n--) {
    const s = steam[n], a = t - s.t0; if (a > 1.2 || a < 0) { steam.splice(n, 1); continue; }
    X.globalAlpha = 0.7 * (1 - a / 1.2);
    for (let q = 0; q < 5; q++) R('#e8e8f0', s.x - 6 + q * 3 + Math.sin(a * 4 + q) * 2, s.y - a * 26 - q * 2, 2, 2);
    X.globalAlpha = 1;
  }
}

// ışık katmanı üstü: lav yüzeyi ve şelale perdesi hafifçe parlar
export function drawLiquidGlow(ctx, r0, r1, glow) {
  if (!G.lq) return;
  const lq = G.lq, lk = G.lk;
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c; if (!lq[i] || (lq[i - COLS] && lk[i - COLS] === lk[i])) continue;
    if (lk[i] === 1) glow(c * TILE + 8, r * TILE + 12, 'rgba(255,120,40,0.5)', 16, 0.55);
    else if (!TD[G.map[i + COLS]].solid && lq[i + COLS] < 8) glow(c * TILE + 8, r * TILE + 8, 'rgba(120,210,255,0.25)', 10, 0.5);
  }
}

// ışık kaynağı: lav yüzeyi çevresini aydınlatır
export function liquidLights(r0, r1, out) {
  if (!G.lq) return;
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (G.lq[i] && G.lk[i] === 1 && !(G.lq[i - COLS] && G.lk[i - COLS] === 1) && (c + r) % 2 === 0) out.push({ x: c * TILE + 8, y: r * TILE + 10, s: 2.4 });
  }
}
