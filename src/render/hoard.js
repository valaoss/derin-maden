// Hazine salonu sahnesi: kemerli tavan, mangallı sütunlar, sallanan sancaklar, tavandan süzülen ışık huzmeleri,
// madeni paralarla kaplı yığın ve üstünde taç, kupa, kalkan, saplanmış kılıç, düşmüş bir madencinin kemikleri.
import { TILE, COLS } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { G } from '../game/state.js';
import { hash2 } from '../core/util.js';

const GOLDS = ['#8a5a10', '#b8801a', '#e0a82a', '#ffd24a', '#fff0a0'];
let X;
const R = (col, x, y, w = 1, h = 1) => { X.fillStyle = col; X.fillRect(Math.round(x), Math.round(y), w, h); };
const near = H => H && Math.abs(G.cam.y + 150 - (H.r0 + H.r1) * 8) < 420;
const isGold = (c, r) => G.map[r * COLS + c] === T.GOLD;
const solid = (c, r) => TD[G.map[r * COLS + c]].solid;

// ---------- madeni para dokusu ----------
const coinCv = [];
function coinTile(v) {
  if (coinCv[v]) return coinCv[v];
  const cv = document.createElement('canvas'); cv.width = cv.height = 16; const c = cv.getContext('2d');
  c.fillStyle = GOLDS[1]; c.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash2(i, v, 3) * 16), y = Math.floor(hash2(v, i, 7) * 16), k = hash2(i, v, 11);
    c.fillStyle = GOLDS[0]; c.fillRect(x, y + 1, 3, 1);
    c.fillStyle = k < 0.35 ? GOLDS[2] : k < 0.85 ? GOLDS[3] : GOLDS[4]; c.fillRect(x, y, 3, 1); c.fillRect(x + 1, y - 1, 1, 1);
    if (k > 0.9) { c.fillStyle = '#ffffff'; c.fillRect(x + 1, y, 1, 1); }
  }
  return (coinCv[v] = cv);
}
let pat = null;
export function coinPattern(ctx) { return pat || (pat = ctx.createPattern(coinTile(0), 'repeat')); }

// yığındaki altın karoları paraya döner; üstü açık karolarda paralar kenardan taşar
function coins(H) {
  for (let r = H.r0; r <= H.r1; r++) for (let c = H.c0; c <= H.c1; c++) {
    if (!isGold(c, r)) continue;
    const x = c * TILE, y = r * TILE;
    X.drawImage(coinTile(Math.floor(hash2(c, r, 1) * 4)), x, y);
    if (!solid(c, r - 1)) {
      for (let i = 0; i < 7; i++) { const cx = x + Math.floor(hash2(c, i, r) * 14), h = Math.floor(hash2(i, c, 5) * 3); R(GOLDS[0], cx, y - h + 1, 3, 1); R(GOLDS[3 + (i % 2)], cx, y - h, 3, 1); }
      if (!isGold(c - 1, r) && !solid(c - 1, r)) for (let k = 0; k < 16; k += 3) R(GOLDS[2], x - 1 - Math.floor(k / 6), y + k, 2, 1);
      if (!isGold(c + 1, r) && !solid(c + 1, r)) for (let k = 0; k < 16; k += 3) R(GOLDS[2], x + 15 + Math.floor(k / 6), y + k, 2, 1);
    }
  }
}
// bir sütunun yığın üstü (hazine eşyaları oraya konur)
function topOf(H, c) { for (let r = H.r0 + 2; r <= H.r1 + 1; r++) if (solid(c, r)) return isGold(c, r) ? r * TILE : null; return null; }

// ---------- eşyalar ----------
function crown(x, y, t) { R('#6a4a10', x - 5, y - 4, 11, 5); R('#ffd24a', x - 4, y - 4, 9, 3); for (const k of [-4, 0, 4]) R('#ffd24a', x + k, y - 7, 1, 3); R('#fff0a0', x - 4, y - 4, 9, 1); R('#e02a3a', x, y - 3); R('#3a8aff', x - 3, y - 3); R('#3ae08a', x + 3, y - 3); }
function goblet(x, y) { R('#6a4a10', x - 3, y - 9, 7, 5); R('#e0a82a', x - 2, y - 9, 5, 4); R('#fff0a0', x - 2, y - 9, 1, 3); R('#b8801a', x, y - 5, 1, 3); R('#e0a82a', x - 2, y - 2, 5, 2); R('#c02a4a', x - 1, y - 8, 3, 1); }
function shield(x, y) { X.fillStyle = '#3a1a10'; X.beginPath(); X.arc(x, y - 7, 7, 0, Math.PI * 2); X.fill(); X.fillStyle = '#8a1a1a'; X.beginPath(); X.arc(x, y - 7, 6, 0, Math.PI * 2); X.fill(); X.strokeStyle = '#e0a82a'; X.beginPath(); X.arc(x, y - 7, 5.5, 0, Math.PI * 2); X.stroke(); R('#ffd24a', x - 1, y - 8, 3, 3); R('#e0a82a', x - 6, y - 7, 12, 1); }
function sword(x, y) { R('#2a2a34', x - 1, y - 20, 3, 17); R('#c8d0dc', x, y - 20, 1, 16); R('#ffffff', x, y - 20, 1, 3); R('#6a4a10', x - 4, y - 23, 9, 2); R('#ffd24a', x - 4, y - 23, 9, 1); R('#5a3a20', x, y - 27, 1, 4); R('#e02a3a', x - 1, y - 29, 3, 2); }
function bones(x, y) { R('#d8d0b8', x - 6, y - 3, 7, 5); R('#1a1410', x - 5, y - 2, 2, 2); R('#1a1410', x - 2, y - 2, 2, 2); R('#d8d0b8', x - 4, y + 2 - 1, 3, 1); R('#8a8a90', x - 7, y - 5, 9, 2); R('#b8b8c0', x - 6, y - 5, 7, 1); R('#d8d0b8', x + 3, y - 1, 8, 1); R('#d8d0b8', x + 4, y + 1 - 1, 6, 1); R('#6a4a2a', x + 8, y - 6, 1, 6); R('#8a8a90', x + 6, y - 7, 5, 2); }
function stack(x, y, n) { for (let i = 0; i < n; i++) { R(GOLDS[0], x - 3, y - i * 2 - 1, 7, 2); R(GOLDS[3], x - 3, y - i * 2 - 2, 7, 1); } R(GOLDS[4], x - 2, y - n * 2 - 1, 5, 1); }

// ---------- ana katman ----------
export function drawHall(ctx) {
  const H = G.hoard; if (!near(H)) return;
  X = ctx; const t = G.time, x0 = H.c0 * TILE, x1 = (H.c1 + 1) * TILE, top = H.r0 * TILE, flo = (H.r1 + 1) * TILE;
  // sütunlar: kenarlarda, yivli, başlıklı; üstlerinde mangal
  for (const px of [x0 + 7, x1 - 7]) {
    const py0 = (H.r0 + 3) * TILE, py1 = flo - 16;
    R('#3a2a10', px - 6, py0, 12, py1 - py0); R('#a8802a', px - 5, py0, 10, py1 - py0);
    for (let k = -3; k <= 3; k += 3) R('#7a5a18', px + k, py0 + 3, 1, py1 - py0 - 6);
    R('#e8c060', px - 4, py0, 1, py1 - py0);
    R('#3a2a10', px - 8, py0 - 4, 16, 5); R('#c8a040', px - 7, py0 - 4, 14, 3); R('#3a2a10', px - 8, py1 - 2, 16, 4); R('#c8a040', px - 7, py1 - 2, 14, 2);
    const by = (H.r0 + 6) * TILE; R('#2a1a14', px - 6, by, 12, 4); R('#4a3a30', px - 5, by, 10, 1); R('#2a1a14', px - 1, by + 4, 3, 5);
  }
  // sancaklar: kemerden sarkar, rüzgârsız bir havada ağır ağır sallanır
  for (const [bx, s] of [[x0 + 40, 0], [x1 - 40, 1]]) {
    const by = (H.r0 + 1) * TILE + 2, L = 46, sw = Math.sin(t * 0.9 + s * 2);
    R('#5a4a30', bx - 9, by - 2, 18, 2);
    for (let y = 0; y < L; y++) {
      const off = Math.round(sw * y / L * 2), notch = y > L - 6 && ((bx + y * 3) % 7 < 3) ? 3 : 0;
      R(y === 0 || y > L - 3 ? '#4a0810' : '#6a0a14', bx - 7 + off + notch, by + y, 14 - notch * 2, 1);
      R('#d8a040', bx - 7 + off + notch, by + y, 1, 1); R('#d8a040', bx + 6 + off - notch, by + y, 1, 1);
    }
    // ejder başı işlemesi
    const ex = bx + Math.round(sw), ey = by + 14;
    R('#d8a040', ex - 3, ey, 6, 4); R('#d8a040', ex + 3, ey + 1, 3, 2); R('#d8a040', ex - 4, ey - 3, 2, 3); R('#d8a040', ex, ey - 3, 2, 3); R('#6a0a14', ex + 1, ey + 1, 1, 1); R('#d8a040', ex - 2, ey + 4, 1, 4); R('#d8a040', ex + 1, ey + 4, 1, 3);
  }
  // duvar süsleri: çapraz kılıçların önünde kalkan
  for (const tx of [x0 + 26, x1 - 26]) {
    const ty = (H.r0 + 5) * TILE;
    X.strokeStyle = '#8a8a96'; X.lineWidth = 1; X.beginPath(); X.moveTo(tx - 8, ty - 8); X.lineTo(tx + 8, ty + 8); X.moveTo(tx + 8, ty - 8); X.lineTo(tx - 8, ty + 8); X.stroke();
    R('#d8d8e0', tx - 8, ty - 8); R('#d8d8e0', tx + 7, ty - 8); R('#6a4a10', tx - 9, ty + 7, 3, 2); R('#6a4a10', tx + 6, ty + 7, 3, 2);
    X.fillStyle = '#2a1008'; X.beginPath(); X.arc(tx, ty, 6, 0, Math.PI * 2); X.fill(); X.fillStyle = '#7a1a14'; X.beginPath(); X.arc(tx, ty, 5, 0, Math.PI * 2); X.fill();
    R('#d8a040', tx - 1, ty - 5, 2, 10); R('#d8a040', tx - 5, ty - 1, 10, 2); R('#fff0a0', tx - 1, ty - 1, 2, 2);
  }
  // avize: kemerin ortasından zincirle sarkar, hafifçe salınır
  {
    const ax = (x0 + x1) / 2 + Math.sin(t * 0.6) * 1.5, ay = (H.r0 + 1) * TILE;
    for (let y = 0; y < 20; y += 2) R(y % 4 ? '#4a4a52' : '#6a6a74', ax - 0.5 + Math.sin(t * 0.6) * y / 20, ay + y, 1, 2);
    R('#2a2226', ax - 13, ay + 20, 26, 3); R('#5a5048', ax - 12, ay + 20, 24, 1); R('#2a2226', ax - 1, ay + 23, 3, 3);
    for (let i = 0; i < 5; i++) { const cx = ax - 12 + i * 6; R('#e8e0d0', cx, ay + 16, 1, 4); R('#2a2226', cx - 1, ay + 19, 3, 1); }
  }
  coins(H);
  // hazine eşyaları: yığının üstünde, altı kazıldıysa kaybolur
  const put = (c, f, ...a) => { const y = topOf(H, c); if (y !== null) f(c * TILE + 8 + (a[0] || 0), y + 1, t, a[1]); };
  put(H.c0 + 1, (x, y) => shield(x, y), -2);
  put(H.c0 + 2, (x, y) => crown(x, y), 1);
  put(H.c0 + 1, (x, y) => bones(x, y), 6);
  put(H.c1 - 1, (x, y) => sword(x, y), 2);
  put(H.c1 - 2, (x, y) => goblet(x, y), -3);
  put(H.c0 + 3, (x, y) => goblet(x, y), 4);
  put(H.c1, (x, y) => stack(x, y, 4), -4);
  put(H.c0, (x, y) => stack(x, y, 3), 3);
  // yığından yuvarlanan paralar
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.35 + i * 0.27) % 1, c = H.c0 + 2 + Math.floor(hash2(i, 3, 9) * (H.c1 - H.c0 - 4)), y0 = topOf(H, c); if (y0 === null) continue;
    const dir = c < (H.c0 + H.c1) / 2 ? -1 : 1, x = c * TILE + 8 + dir * k * 30, y = y0 - 2 + k * k * 30;
    if (solid(Math.floor(x / TILE), Math.floor(y / TILE))) continue;
    R(Math.floor(t * 12 + i) % 2 ? GOLDS[4] : GOLDS[2], x, y, Math.floor(t * 12 + i) % 2 ? 2 : 1, 1);
  }
}

// ---------- ışık katmanı ----------
export function drawHallGlow(ctx, glow) {
  const H = G.hoard; if (!near(H)) return;
  X = ctx; const t = G.time, x0 = H.c0 * TILE, x1 = (H.c1 + 1) * TILE, mid = (x0 + x1) / 2;
  // tavandaki çatlaktan süzülen ışık huzmeleri ve içinde uçuşan toz
  for (const [ox, sk] of [[-10, 0.35], [14, 0.22]]) {
    const ty = H.r0 * TILE + 8, by = (H.r1 - 3) * TILE;
    X.globalAlpha = 0.07 + 0.02 * Math.sin(t * 0.7 + ox);
    X.fillStyle = '#ffe0a0'; X.beginPath(); X.moveTo(mid + ox - 3, ty); X.lineTo(mid + ox + 4, ty); X.lineTo(mid + ox + 16 + (by - ty) * sk, by); X.lineTo(mid + ox - 12 + (by - ty) * sk, by); X.fill();
    for (let i = 0; i < 7; i++) { const k = (t * 0.05 + i * 0.141) % 1, y = ty + k * (by - ty); X.globalAlpha = 0.5 * Math.sin(k * Math.PI); R('#fff0c0', mid + ox + (y - ty) * sk + Math.sin(t * 0.8 + i * 2) * 6, y); }
  }
  X.globalAlpha = 1;
  // mangallar
  for (const px of [x0 + 7, x1 - 7]) {
    const by = (H.r0 + 6) * TILE;
    glow(px, by - 4, 'rgba(255,150,60,0.5)', 26, 0.8 + 0.2 * Math.sin(t * 9 + px));
    for (let i = 0; i < 9; i++) { const k = (t * 1.6 + i * 0.11) % 1, w = Math.sin(t * 13 + i * 3); X.globalAlpha = 1 - k; R(k < 0.3 ? '#fff0b0' : k < 0.6 ? '#ffb040' : '#ff5a1a', px - 4 + (i % 9) + w * k * 2, by - k * 12, 1, 2); }
    X.globalAlpha = 1;
  }
  // avize mumları
  { const ax = (x0 + x1) / 2 + Math.sin(t * 0.6) * 1.5, ay = (H.r0 + 1) * TILE;
    for (let i = 0; i < 5; i++) { const cx = ax - 12 + i * 6, f = Math.sin(t * 11 + i * 2); R('#ffb040', cx, ay + 14 + (f > 0.6 ? -1 : 0), 1, 2); R('#fff0b0', cx, ay + 15, 1, 1); }
    glow(ax, ay + 14, 'rgba(255,200,110,0.45)', 22, 0.8 + 0.1 * Math.sin(t * 7)); }
  // mücevher ve eşya parıltıları
  for (let i = 0; i < 10; i++) {
    const c = H.c0 + (i % (H.c1 - H.c0 + 1)), y0 = topOf(H, c); if (y0 === null) continue;
    const k = (t * 0.4 + hash2(i, 2, 7) * 5) % 2.4; if (k > 0.3) continue;
    const x = c * TILE + 3 + hash2(i, 5, 1) * 10, y = y0 + 3 + hash2(i, 6, 1) * 20, s = Math.sin(k / 0.3 * Math.PI);
    X.globalAlpha = s; const col = ['#ff5a6a', '#5ab0ff', '#5aff9a', '#fff0a0'][i % 4]; R(col, x - 1, y, 3, 1); R(col, x, y - 1, 1, 3); X.globalAlpha = 1;
    glow(x, y, 'rgba(255,240,200,0.4)', 5, s);
  }
  // yığının sıcak ışıltısı
  glow(mid, (H.r1 - 1) * TILE, 'rgba(255,200,90,0.16)', 70, 0.8);
}
export function hallLights(out) {
  const H = G.hoard; if (!near(H)) return;
  const by = (H.r0 + 6) * TILE - 4;
  out.push({ x: (H.c0 + H.c1 + 1) * TILE / 2, y: (H.r0 + 2) * TILE, s: 2.6 }, { x: H.c0 * TILE + 7, y: by, s: 3.4 }, { x: (H.c1 + 1) * TILE - 7, y: by, s: 3.4 }, { x: (H.c0 + H.c1 + 1) * TILE / 2, y: (H.r1 - 2) * TILE, s: 2.4 });
}
export const hallCenter = H => (H.r0 + H.r1 + 1) * TILE / 2;
