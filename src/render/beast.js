// Dev yaratık çizim yardımcıları: yerel iskelet (köken ayaklar, +x ileri, +y aşağı), yön ve ölçekle dünyaya çevrilir.
import { G } from '../game/state.js';

export const V = { X: null, OX: 0, OY: 0, F: 1, SC: 1 };
export function origin(ctx, ox, oy, f, sc) { V.X = ctx; V.OX = ox; V.OY = oy; V.F = f; V.SC = sc; }
export const wx = lx => V.OX + lx * V.F * V.SC;
export const wy = ly => V.OY + ly * V.SC;
export const bez = (a, b, c, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];
export function path(pts, close) { const X = V.X; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(wx(a), wy(b)) : X.moveTo(wx(a), wy(b))); if (close) X.closePath(); }
export function poly(col, pts) { V.X.fillStyle = col; path(pts, true); V.X.fill(); }
export function limb(col, w, pts) { const X = V.X; X.strokeStyle = col; X.lineWidth = w * V.SC; X.lineCap = 'round'; X.lineJoin = 'round'; path(pts); X.stroke(); X.lineWidth = 1; }
export function circ(col, lx, ly, r) { const X = V.X; X.fillStyle = col; X.beginPath(); X.arc(wx(lx), wy(ly), Math.max(0.5, r * V.SC), 0, Math.PI * 2); X.fill(); }
export function dot(col, lx, ly, w = 1, h = 1) { w = Math.max(1, Math.round(w * V.SC)); h = Math.max(1, Math.round(h * V.SC)); V.X.fillStyle = col; V.X.fillRect(Math.round(V.F > 0 ? wx(lx) : wx(lx) - w + 1), Math.round(wy(ly)), w, h); }
// kalınlığı azalan zincir (boyun, kuyruk): a -> c, b kontrol noktası
export function chain(col, a, b, c, r0, r1, n = 14) { for (let i = 0; i <= n; i++) { const k = i / n, [x, y] = bez(a, b, c, k); circ(col, x, y, r0 + (r1 - r0) * k); } }
export const FIRE = ['#b8281a', '#ff6a1a', '#ffb040', '#fff0b0'];
// dikey alev dili (dünya koordinatı)
export function flame(x, y, h, w, lean, seed, hot = false) {
  const X = V.X; h *= V.SC; w *= V.SC; if (h < 1) return;
  const t = G.time;
  for (let L = 0; L < 3; L++) {
    const hh = h * [1, 0.72, 0.42][L], ww = w * [1, 0.62, 0.3][L];
    X.fillStyle = FIRE[L + (L === 2 && hot ? 1 : 0)]; X.globalAlpha = [0.55, 0.8, 0.95][L];
    for (let yy = 0; yy < hh; yy++) {
      const f = yy / hh, cw = Math.max(1, Math.round(ww * Math.pow(1 - f, 0.8)));
      X.fillRect(Math.round(x + lean * f * hh * 0.6 + Math.sin(t * 11 + seed * 3 + yy * 0.6) * f * 1.6 - cw / 2), Math.round(y - yy), cw, 1);
    }
  }
  X.globalAlpha = 1;
}
// yumuşak karanlık leke (sis ve karartma)
let blob = null;
export function blobSprite() {
  if (blob) return blob;
  blob = document.createElement('canvas'); blob.width = blob.height = 64;
  const b = blob.getContext('2d'), g = b.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(1,2,6,1)'); g.addColorStop(0.55, 'rgba(1,2,6,0.7)'); g.addColorStop(1, 'rgba(1,2,6,0)');
  b.fillStyle = g; b.fillRect(0, 0, 64, 64);
  return blob;
}
export function vignette(ctx, px, py, vw, vh, a, rgb = '2,0,1') {
  const g = ctx.createRadialGradient(px, py, 30, px, py, Math.max(vw, vh) * 0.75);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${a.toFixed(3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
}
