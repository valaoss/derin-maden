// Sıvı çizimi: alan çizicisinin (liquidfield.js) çıktısını tuvale aktarır; ışık katmanı, lav ışıkları, buhar.
// Göller de sabit su hücresi olarak aynı çiziciden geçer. Saniyede 30 kez kurulur, ana ve ışık katmanı aynı kareyi paylaşır.
import { COLS, ROWS, TILE } from '../config.js';
import { G } from '../game/state.js';
import { on } from '../core/events.js';
import { rasterLiquids, field } from './liquidfield.js';

const FPS = 30, LAKE_LEVEL = 5, steam = [];
on('steam', d => { if (steam.length < 40) steam.push({ x: d.x, y: d.y, t0: G.time }); });
let cv, cx, gcv, gx, R = null, stamp = -1, of = null, fixed = null;
const cells = [];

// keşfedilen göllerin su satırı
function lakes() {
  for (const i of cells) fixed[i] = 0; cells.length = 0;
  for (const L of G.lakes || []) {
    const r = L.r + L.h - 1; if (!G.rev[r * COLS + L.c] && !G.rev[r * COLS + L.c + L.w - 1]) continue;
    for (let c = L.c; c < L.c + L.w; c++) { fixed[r * COLS + c] = LAKE_LEVEL; cells.push(r * COLS + c); }
  }
  return cells.length ? fixed : null;
}
function upload(x, c, buf, w, h) {
  if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
  x.putImageData(new ImageData(buf.subarray(0, w * h * 4), w, h), 0, 0);
}

export function drawLiquids(ctx, r0, r1) {
  if (!G.lq) return;
  if (!cv) { cv = document.createElement('canvas'); cx = cv.getContext('2d'); gcv = document.createElement('canvas'); gx = gcv.getContext('2d'); }
  const t = G.time, q = Math.floor(t * FPS);
  if (of !== G.lq) { of = G.lq; fixed = new Uint8Array(G.lq.length); cells.length = 0; steam.length = 0; stamp = -1; }
  if (q !== stamp) {
    stamp = q; R = rasterLiquids(G, r0, r1, t, lakes());
    if (R) { upload(cx, cv, R.rgba, R.w, R.h); upload(gx, gcv, R.glow, R.w, R.h); }
  }
  if (R) ctx.drawImage(cv, 0, 0, R.w, R.h, R.x, R.y, R.w, R.h);
  // buhar: su lava değdiğinde
  for (let n = steam.length - 1; n >= 0; n--) {
    const s = steam[n], age = t - s.t0;
    if (age > 1.6 || age < 0) { steam.splice(n, 1); continue; }
    for (let k = 0; k < 5; k++) {
      ctx.globalAlpha = (1 - age / 1.6) * (0.32 - k * 0.035);
      const size = Math.round(2 + age * 3), x = Math.round(s.x + Math.sin(age * 2 + k * 1.4) * age * 7 - size / 2), y = Math.round(s.y - age * 25 - k * 3);
      ctx.fillStyle = '#dee5eb'; ctx.fillRect(x, y, size, 2); ctx.fillStyle = '#eef1f4'; ctx.fillRect(x + 1, y - 1, Math.max(1, size - 2), 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ışık katmanı: lav kendi ışığıyla, su yüzeyi ve köpüğü soluk görünür; lavın çevresine sıcak hale
export function drawLiquidGlow(ctx, r0, r1, glow) {
  if (!G.lq || !R || of !== G.lq) return;
  ctx.drawImage(gcv, 0, 0, R.w, R.h, R.x, R.y, R.w, R.h);
  if (!R.lava) return;
  const F = field(), t = G.time;
  for (let r = Math.max(1, r0); r <= Math.min(ROWS - 2, r1); r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c; if (!F.type[i] || F.kind[i] !== 1) continue;
    if (F.type[i] === 2) { if (r % 2 === 0) glow(c * TILE + 8, r * TILE + 8, 'rgba(255,113,25,0.35)', 16, 0.7); continue; }
    if (F.type[i - COLS] === 1 || (c + r) % 2) continue;
    glow(c * TILE + 8, F.ys[i] + 3, 'rgba(255,113,25,0.5)', 21, 0.6 + Math.sin(t * 1.7 + c * 0.8) * 0.12);
  }
}
export function liquidLights(r0, r1, out) {
  if (!G.lq || !R || !R.lava || of !== G.lq) return;
  const F = field();
  for (let r = Math.max(1, r0); r <= Math.min(ROWS - 2, r1); r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c; if (!F.type[i] || F.kind[i] !== 1) continue;
    if (F.type[i] === 2) { if (r % 3 === 0) out.push({ x: c * TILE + 8, y: r * TILE + 8, s: 1.8 }); continue; }
    if (F.type[i - COLS] !== 1 && (c + r) % 2 === 0) out.push({ x: c * TILE + 8, y: F.ys[i] + 4, s: 2.4 + Math.sin(G.time * 1.7 + c * 0.8) * 0.15 });
  }
}
