// Sıvı çizimi: dinlenen su düz yüzeyli ve dalgalı, düşen su akış çizgili ince bir perde; şelalenin çarptığı yerde köpük.
// Lav koyu kabuklu, turuncu yüzeyli, kabarcıklı; ışık katmanında parlar. Buhar: su lavla buluşunca.
import { COLS, ROWS, TILE } from '../config.js';
import { TD } from '../data/tiles.js';
import { G } from '../game/state.js';
import { on } from '../core/events.js';
import { hash2 } from '../core/util.js';

const steam = [];
on('steam', d => { if (steam.length < 40) steam.push({ x: d.x, y: d.y, t0: G.time }); });
let X;
const R = (col, x, y, w = 1, h = 1) => { X.fillStyle = col; X.fillRect(Math.round(x), Math.round(y), w, h); };
// su: derinlikle koyulaşan renk kademeleri (hücre sınırında bant oluşmaz), lav: yüzeyde parlak, dipte koyu
const WD = ['rgba(52,138,214,0.62)', 'rgba(40,116,196,0.7)', 'rgba(30,96,178,0.78)', 'rgba(22,76,156,0.84)'];
const LD = ['#d8501e', '#b83a16', '#962a10', '#7a200c'];
const W = { top: '#9ae0ff', foam: '#e8f8ff', fall: 'rgba(70,160,230,0.72)', fallD: 'rgba(40,120,205,0.55)', streak: '#cff0ff' };
const L = { top: '#ffb040', crust: '#5a1a0a', hot: '#fff0a0', fall: '#d8501e', fallD: '#a8300f' };

// şelale perdesi: kaynak sınırda aç-kapa akar ve sıvı paketler halinde düşer; hücre son görüldüğü andan
// FADE sn boyunca perde olarak kalır, incelerek söner. Böylece akış kesintisiz görünür.
const FADE = 0.7;
let seen = null, seenK = null, lv = null, seenOf = null, lastT = 0;
// düşen sıvı: sabit genişlikte perde; çizgiler dünya y'sine bağlı, hücreden hücreye kesintisiz akar
function drawFall(k, c, r, f, t) {
  const x = c * TILE, y = r * TILE, full = k ? 10 : 12, w = Math.max(2, Math.round(full * (0.35 + 0.65 * f) / 2) * 2);
  const x0 = x + 8 - w / 2;
  R(k ? L.fall : W.fall, x0, y, w, 16);
  if (w > 4) R(k ? L.fallD : W.fallD, x0 + 2, y, w - 4, 16);
  R(k ? L.top : W.top, x0, y, 1, 16); R(k ? L.top : W.top, x0 + w - 1, y, 1, 16);
  const sp = k ? 40 : 95, P = k ? 22 : 18, col = k ? L.hot : W.streak;
  for (let q = 1; q < w - 1; q += 3) {
    const o = (t * sp + hash2(c, q, 5) * P) % P;
    for (let yy = -P; yy < 16; yy += P) { const a = Math.max(0, yy + o), b = Math.min(16, yy + o + 4); if (b > a) R(col, x0 + q, y + a, 1, b - a); }
  }
}

export function drawLiquids(ctx, r0, r1) {
  if (!G.lq) return;
  X = ctx; const t = G.time, lq = G.lq, lk = G.lk, map = G.map;
  if (seenOf !== lq) { seen = new Float32Array(COLS * ROWS).fill(-99); seenK = new Uint8Array(COLS * ROWS); lv = new Float32Array(COLS * ROWS); seenOf = lq; lastT = t; }
  const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
  const ease = Math.min(1, dt * 7);
  const liq = (i, k) => lq[i] && lk[i] === k && !TD[map[i]].solid;
  // yumuşatılmış seviye: benzetim birim birim atlar, görüntü akar
  const level = i => lv[i];
  for (let r = r0 - 1; r <= r1 + 1; r++) for (let c = 0; c < COLS; c++) { const i = r * COLS + c; if (i < 0 || i >= lv.length) continue; lv[i] = lq[i] ? (lv[i] ? lv[i] + (lq[i] - lv[i]) * ease : lq[i]) : 0; }
  // aşağı akan hücreler (alttan yukarı): altı dolmamış ya da yine aşağı akıyor, yanında durgun su yok
  const flow = new Uint8Array((r1 - r0 + 1) * COLS);
  for (let c = 0; c < COLS; c++) {
    let below = 0;
    for (let r = Math.min(ROWS - 2, r1 + 10); r >= r0; r--) {
      const i = r * COLS + c, b = i + COLS;
      const k = lk[i], sup = j => lq[j] && lk[j] === k && !TD[map[j]].solid && (TD[map[j + COLS]].solid || lq[j + COLS] >= 8);
      const rest = j => sup(j) && (sup(j - 1) || sup(j + 1));   // durgun havuz: en az iki hücre genişliğinde
      below = lq[i] && !TD[map[i]].solid && !TD[map[b]].solid && (lq[b] < 8 || (below && lk[b] === k)) && !rest(i - 1) && !rest(i + 1) ? 1 : 0;
      if (r <= r1) flow[(r - r0) * COLS + c] = below;
    }
  }
  for (let c = 0; c < COLS; c++) {
    // derinlik: yukarıdan aynı sıvıyla dolu kaç hücre var
    let depth = 0;
    for (let r = r0 - 6; r < r0; r++) { const i = r * COLS + c; depth = i >= 0 && lq[i] ? (liq(i - COLS, lk[i]) ? depth + 1 : 0) : 0; }
    for (let r = r0; r <= r1; r++) {
      const i = r * COLS + c, a = lq[i];
      if (!a) {
        depth = 0;
        const f = 1 - (t - seen[i]) / FADE;
        if (f > 0 && !TD[map[i]].solid) drawFall(seenK[i], c, r, f, t);
        continue;
      }
      const k = lk[i], up = liq(i - COLS, k), b = i + COLS, x = c * TILE, y = r * TILE;
      depth = up ? depth + 1 : 0;
      const chute = TD[map[i - 1]].solid && TD[map[i + 1]].solid && !TD[map[b]].solid && lq[b] && lk[b] === k;
      const falling = flow[(r - r0) * COLS + c] || chute;
      if (falling) { seen[i] = t; seenK[i] = k; drawFall(k, c, r, 1, t); continue; }
      // dar geçit (yanlarında aynı sıvı yok) ve üstünden akış geliyor: perde devam eder; altı kayaysa
      // akış yana döner, havuzsa suya karışır. Tek hücrelik dolu kare bloklar oluşmaz.
      const pool = j => liq(j, k) && !flow[(r - r0) * COLS + (j - r * COLS)];
      if (!pool(i - 1) && !pool(i + 1) && seen[i - COLS] > t - 0.3) {
        drawFall(k, c, r, 1, t);
        if (TD[map[b]].solid) for (const d of [-1, 1]) if (seen[i + d] > t - 0.3) {
          const x0 = d > 0 ? x + 8 : x - 8; R(k ? L.fall : W.fall, x0, y + 9, 16, 7); R(k ? L.top : W.top, x0, y + 9, 16, 1);
        }
        continue;
      }
      seen[i] = -99;
      const pal = k ? LD : WD;
      if (up) {
        // tam dolu iç hücre: derinlik kademesi, üst yarı bir önceki kademeye geçiş
        const d0 = Math.min(3, depth - 1), d1 = Math.min(3, depth);
        R(pal[d0], x, y, 16, 8); R(pal[d1], x, y + 8, 16, 8);
        if (k) for (let q = 0; q < 2; q++) { const cx = (hash2(c, r, q) * 16 + t * (1.5 + q)) % 14; R(L.crust, x + cx, y + 4 + q * 7, 3, 1); }
        continue;
      }
      // yüzey hücresi: köşe yükseklikleri komşularla ortalanır, yüzey kesintisiz bir eğri olur
      // şelalenin çarptığı hücre: düşen paket bir an yüzeyi yükseltir; görüntü komşu yüzeyle hizalanır
      let me = level(i) * 2;
      if (seen[i - COLS] > t - 0.3) { let n = 0, sum = 0; for (const j of [i - 1, i + 1]) if (liq(j, k) && !liq(j - COLS, k)) { sum += level(j) * 2; n++; } if (n) me = Math.min(me, sum / n + 1); }
      const side = j => liq(j, k) && !liq(j - COLS, k) ? (level(j) * 2 + me) / 2 : me;
      const hl = side(i - 1), hr = side(i + 1);
      for (let px = 0; px < 16; px += 2) {
        const f = (px + 1) / 16, h0 = hl + (me - hl) * Math.min(1, f * 2) + (hr - me) * Math.max(0, f * 2 - 1);
        const wave = Math.sin(t * (k ? 1.6 : 2.6) + (x + px) * 0.35) * (k ? 0.5 : 0.8) * Math.min(1, h0 / 6);
        const h = Math.max(1, Math.min(16, Math.round(h0 + wave))), top = y + 16 - h;
        R(pal[0], x + px, top, 2, h);
        if (h > 8) R(pal[1], x + px, y + 12, 2, 4);
        R(k ? L.top : W.top, x + px, top, 2, 1);
      }
      if (k) {
        for (let q = 0; q < 2; q++) { const cx = (hash2(c, r, q) * 16 + t * (2 + q)) % 14; R(L.crust, x + cx, y + 16 - me + 3 + q * 3, 3, 1); }
        const bp = (t * 0.7 + hash2(c, r, 9)) % 1;
        if (bp < 0.25 && me > 3) R(L.hot, x + 4 + hash2(r, c, 4) * 8, y + 16 - me - bp * 12, 2, 2);
      } else {
        const hi = (t * 8 + hash2(c, r, 3) * 16) % 14; if (me > 3) R('rgba(255,255,255,0.8)', x + hi, y + 16 - me + 2, 2, 1);
      }
      // şelalenin çarptığı yer: köpük ve sıçrayan damlalar
      if (seen[i - COLS] > t - 0.2 && seenK[i - COLS] === k) {
        const tp = y + 16 - me, s = Math.floor(t * 12);
        for (let q = 0; q < 6; q++) R(k ? L.hot : W.foam, x + 2 + hash2(c, s + q, 7) * 12, tp - 1 + hash2(q, s, c) * 3, 1, 1);
        for (let q = 0; q < 3; q++) { const u = ((t * 2.2 + q / 3) % 1); R(k ? L.top : W.foam, x + 8 + (q - 1) * (2 + u * 6), tp - Math.sin(u * Math.PI) * 5, 1, 1); }
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
