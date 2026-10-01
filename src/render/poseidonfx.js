// Poseidon'un saldırı görselleri (ışık katmanında çizilir, karanlıkta da okunur): nişan çizgileri, uçan mızrak, su dalgası, hortum.
import { POSEIDON } from '../data/balance.js';
import { handOf, heartOf } from '../game/poseidon.js';

const W = ['#e8fbff', '#8ad8ff', '#3a9ad8', '#1c5ca4'], GOLD = '#f0c050', BRONZE = '#b8945a', DARK = '#3a2a1a';
const px = (ctx, x, y, w = 1, h = 1) => ctx.fillRect(Math.round(x), Math.round(y), w, h);
function seg(ctx, x0, y0, x1, y1, col, w = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); ctx.fillStyle = col;
  for (let i = 0; i <= n; i++) px(ctx, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, w, w);
}
function dash(ctx, x0, y0, a, len, col, off) {
  ctx.fillStyle = col; const o = ((off % 6) + 6) % 6, ca = Math.cos(a), sa = Math.sin(a);
  for (let d = 4 + o; d < len; d += 6) { px(ctx, x0 + ca * d, y0 + sa * d, 2, 1); px(ctx, x0 + ca * (d + 2), y0 + sa * (d + 2)); }
}
// üç dişli mızrak: (x, y) ortası, a yönü; water: sudan kopya
function spear(ctx, x, y, a, water, k = 1) {
  const ca = Math.cos(a), sa = Math.sin(a), L = 13 * k, nx = -sa, ny = ca;
  const tail = [x - ca * L, y - sa * L], neck = [x + ca * (L - 6), y + sa * (L - 6)], c0 = water ? W[2] : DARK, c1 = water ? W[0] : BRONZE, c2 = water ? W[0] : GOLD;
  seg(ctx, tail[0], tail[1], neck[0], neck[1], c0, 2); seg(ctx, tail[0], tail[1], neck[0], neck[1], c1);
  seg(ctx, neck[0] - nx * 4, neck[1] - ny * 4, neck[0] + nx * 4, neck[1] + ny * 4, c1);
  seg(ctx, neck[0], neck[1], x + ca * (L + 2), y + sa * (L + 2), c2);
  for (const s of [-1, 1]) seg(ctx, neck[0] + nx * 4 * s, neck[1] + ny * 4 * s, neck[0] + nx * 3.4 * s + ca * 6, neck[1] + ny * 3.4 * s + sa * 6, c2);
}
// su dalgası: önde köpüklü hilal, ardında solan su
function wave(ctx, w, t) {
  const ca = Math.cos(w.a), sa = Math.sin(w.a), nx = -sa, ny = ca, hw = w.hw, born = Math.min(1, w.left > 0 ? 1 : 0.5);
  for (let o = -hw; o <= hw; o++) {
    const q = o / hw, back = q * q * 9 + Math.sin(o * 0.7 + t * 14) * 0.8, bx = w.x + nx * o - ca * back, by = w.y + ny * o - sa * back;
    for (let d = 16; d >= 2; d--) { ctx.globalAlpha = born * (1 - d / 17) * 0.85; ctx.fillStyle = d > 10 ? W[3] : d > 5 ? W[2] : W[1]; px(ctx, bx - ca * d, by - sa * d, 2, 2); }
    ctx.globalAlpha = born; ctx.fillStyle = W[0]; px(ctx, bx, by, 2, 2); px(ctx, bx - ca * 1.5, by - sa * 1.5, 2, 2); if ((o + Math.floor(t * 20)) % 3 === 0) px(ctx, bx + ca * 3, by + sa * 3);
  }
  ctx.globalAlpha = 1;
}
// hortum: önce yerde dönen girdap; sonra kıvrılarak yükselen, yukarı doğru genişleyen su sütunu
function spout(ctx, s, t, glow) {
  const C = POSEIDON.spout, x = s.x, fy = s.fy;
  if (s.t < 0) {
    const k = 1 + s.t / C.warn, R = 15 - 5 * k, on = Math.floor(t * (8 + k * 18)) % 2 === 0;
    ctx.globalAlpha = 0.25 + 0.35 * k; ctx.fillStyle = W[2]; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(fy - 1), C.r + 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.6 + 0.4 * k; ctx.fillStyle = on || k > 0.75 ? W[0] : W[1];
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + t * 7, r = R * (0.45 + 0.55 * (i % 13) / 13); px(ctx, x + Math.cos(a) * r, fy - 1 + Math.sin(a) * r * 0.3); }
    for (let i = 0; i < 4; i++) { const h = (t * 30 + i * 9) % (10 + 16 * k); px(ctx, x + Math.sin(i * 2.1 + t * 5) * 5, fy - 2 - h); }
    ctx.globalAlpha = 1; glow(x, fy - 2, 'rgba(138,216,255,0.5)', 12, 0.3 + 0.5 * k);
    return;
  }
  const H = s.h * Math.min(1, s.t / 0.22), fade = Math.min(1, (s.life - s.t) / 0.35);
  for (let yy = 0; yy < H; yy++) {
    const hw = 3.5 + yy * 0.075 + Math.sin(yy * 0.21 - t * 11) * 1.4, cx = x + Math.sin(yy * 0.13 + t * 8) * (1 + yy * 0.035), y = fy - yy;
    ctx.globalAlpha = 0.6 * fade; ctx.fillStyle = W[3]; px(ctx, cx - hw - 1, y, Math.round(hw * 2) + 2, 1);
    ctx.globalAlpha = 0.75 * fade; ctx.fillStyle = W[2]; px(ctx, cx - hw + 1, y, Math.max(1, Math.round(hw * 2) - 2), 1);
    ctx.globalAlpha = fade; ctx.fillStyle = W[0];
    for (let k = 0; k < 2; k++) { const ph = yy * 0.33 - t * 15 + k * Math.PI; if (Math.cos(ph) > -0.2) px(ctx, cx + Math.sin(ph) * hw, y); }
    if ((yy + Math.floor(t * 30)) % 7 === 0) { ctx.fillStyle = W[1]; px(ctx, cx - hw - 1, y); px(ctx, cx + hw, y); }
  }
  // tepesinde saçılan köpük, dibinde kabaran su
  ctx.fillStyle = W[0];
  for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 9, r = 5 + s.h * 0.075 + (i % 3) * 3; px(ctx, x + Math.cos(a) * r, fy - H - 2 + Math.sin(a) * 2.5 - (i % 2) * 2); }
  ctx.globalAlpha = 0.7 * fade; ctx.fillStyle = W[1]; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(fy - 1), C.r + 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; glow(x, fy - H * 0.5, 'rgba(90,180,240,0.4)', Math.round(14 + s.h * 0.1), 0.7 * fade);
}

export function drawPoseidonFx(ctx, e, x, y, t, glow) {
  const B = e.bs, A = B.act, on = Math.floor(t * 14) % 2 === 0;
  for (const s of B.spouts || []) spout(ctx, s, t, glow);
  for (const w of B.waves || []) { wave(ctx, w, t); glow(w.x, w.y, 'rgba(138,216,255,0.4)', w.hw + 4, 0.7); }
  for (const s of B.spears || []) {
    if (s.st > 0 && (s.water || !s.wall)) { glow(s.x, s.y, 'rgba(232,251,255,0.7)', 12, s.st / 0.16); continue; }
    if (!(s.st > 0)) for (let i = 1; i <= 4; i++) { ctx.globalAlpha = 0.5 - i * 0.1; ctx.fillStyle = W[1]; px(ctx, s.x - Math.cos(s.a) * (12 + i * 5), s.y - Math.sin(s.a) * (12 + i * 5), 2, 1); }
    ctx.globalAlpha = 1; spear(ctx, s.x, s.y, s.a, s.water); glow(s.x, s.y, 'rgba(138,216,255,0.5)', 10, 0.8);
  }
  ctx.globalAlpha = 1;
  if (!A) return;
  if (A.k === 'spear' && A.stage === 'aim') {
    // nişan çizgisi: madenciyi izlerken mavi yanıp söner, kilitlenince kızarır
    const [hx, hy] = handOf(e), lock = A.st < POSEIDON.spear.aim * 0.33, n = A.n || 1;
    for (let i = 0; i < n; i++) if (on || lock) dash(ctx, hx, hy, A.a + (i - (n - 1) / 2) * 0.3, A.len || 100, lock ? '#ff5a3a' : W[1], -t * 70);
    glow(hx, hy, 'rgba(138,216,255,0.6)', Math.round(4 + e.wind * 8), 0.9);
  } else if (A.k === 'wave' && A.stage === 'wind') {
    // dalganın geçeceği şerit
    const [ox, oy] = heartOf(e), nx = -Math.sin(A.a), ny = Math.cos(A.a), lock = e.wind >= 0.45, c = lock ? '#ff5a3a' : W[1];
    if (on || lock) for (const s of [-1, 1]) dash(ctx, ox + nx * A.hw * s, oy + ny * A.hw * s, A.a, A.len || 100, c, -t * 60);
  } else if (A.k === 'slam' && A.stage === 'raise') {
    // zemin boyunca iki yana yürüyecek dalganın yüksekliği
    const c = e.wind > 0.6 ? '#ff5a3a' : W[1], yy = y - 4;
    if (on || e.wind > 0.6) for (const s of [0, Math.PI]) { dash(ctx, x, yy - A.hw, s, A.len, c, -t * 60); dash(ctx, x, yy + A.hw - 6, s, A.len, c, -t * 60); }
    glow(x, y - 30, 'rgba(138,216,255,0.5)', Math.round(20 + e.wind * 30), 0.3 + 0.5 * e.wind);
  }
}
