// Yaratık sprite'ları: 14x11 piksel sanatından mürekkep çerçeveli 16x13 tuval (sağa bakar), önbellekli.
// Uyurken gözler kapanır: üst sıra deri rengine, alt sıra koyu çizgiye döner.
import { CRITTERS } from '../data/critters.js';
import { P } from '../data/palette.js';

export const CW = 16, CH = 13;
const cache = new Map();
export function critterSprite(k, flip = false, closed = false) {
  const id = k + (flip ? 'f' : '') + (closed ? 'c' : '');
  if (cache.has(id)) return cache.get(id);
  const d = CRITTERS[k], rows = d.art, W = rows[0].length, H = rows.length;
  const cv = document.createElement('canvas'); cv.width = W + 2; cv.height = H + 2;
  const x = cv.getContext('2d'), at = (i, j) => rows[j] && rows[j][i] && rows[j][i] !== '.';
  const px = i => flip ? W - i : i + 1;
  const eye = ch => ch === 'e' || ch === 'k';
  const col = ch => ch === 'k' ? P.ink : ch === 'e' || ch === 'w' ? '#ffffff' : ch === 'p' ? (d.pal.p || '#ff8aa8') : d.pal[ch] || d.pal.a;
  const skin = (i, j) => { for (let q = i - 1; q >= 0; q--) { const ch = rows[j][q]; if (ch !== '.' && !eye(ch)) return col(ch); } return d.pal.a; };
  x.fillStyle = P.ink;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (at(i, j)) for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) x.fillRect(px(i) + (flip ? -a : a), j + 1 + b, 1, 1);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!at(i, j)) continue;
    const ch = rows[j][i];
    let c = col(ch);
    if (closed && eye(ch)) c = j > 0 && eye(rows[j - 1][i]) ? d.pal.c : skin(i, j);
    x.fillStyle = c; x.fillRect(px(i), j + 1, 1, 1);
  }
  cache.set(id, cv);
  return cv;
}
export function critterURL(k, dark = false) {
  const s = critterSprite(k), cv = document.createElement('canvas'); cv.width = CW * 2; cv.height = CH * 2;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, CW * 2, CH * 2);
  if (dark) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#2a2238'; x.fillRect(0, 0, CW * 2, CH * 2); }
  return cv.toDataURL();
}

// ---------- canlı çizim ----------
// Dünyada 1/1.15 ölçekte çizilir. Yürürken ön ve arka ayak çifti sırayla kalkar, gövde adımla hafifçe zıplar;
// dönüş anında değil: gövde yatay ölçekte daralıp öbür yana açılır. Yarasa kanat çırpar, balık süzülür, salyangoz uzayıp kısalır.
export const CSC = 1 / 1.15;
const MODE = { gozYarasa: 'fly', boslukBalik: 'swim', yildizSalyangoz: 'slide' };
// o: { turn: -1..1 (yön ve dönüş), ph: adım fazı, walk: 0..1, t, closed, seed }
export function drawCritter(ctx, k, x, feet, o = {}) {
  const t = o.t || 0, seed = o.seed || 0, mode = MODE[k] || 'walk', walk = o.walk || 0, ph = o.ph || 0;
  const blink = !o.closed && ((t + seed * 1.7) % 3.6) < 0.13;
  const s = critterSprite(k, false, o.closed || blink), W = s.width, H = s.height;
  let sx = 1, sy = 1, tilt = 0, bob = 0, lift = 0;
  const breathe = Math.sin(t * 2.6 + seed) * (o.closed ? 0.05 : 0.025);
  sy += breathe; sx -= breathe * 0.5;
  if (mode === 'fly') { bob = 4 + Math.sin(t * 5 + seed) * 1.5; sy += Math.sin(t * 16 + seed) * 0.1; tilt = walk * 0.12; }
  else if (mode === 'swim') { bob = 3 + Math.sin(t * 2.2 + seed) * 1.2; tilt = Math.sin(t * 3 + seed) * 0.1 + walk * 0.08; sx += Math.sin(t * 6) * 0.03 * (1 + walk); }
  else if (mode === 'slide') { sx += Math.sin(ph * 2) * 0.1 * walk; sy -= Math.sin(ph * 2) * 0.07 * walk; }
  else { lift = Math.sin(ph) * walk; bob = Math.abs(Math.sin(ph)) * walk * 1.2; tilt = Math.sin(ph) * walk * 0.05 + walk * 0.04; sy -= Math.cos(ph * 2) * 0.04 * walk; }
  const turn = Math.abs(o.turn ?? 1) < 0.25 ? Math.sign(o.turn || 1) * 0.25 : (o.turn ?? 1);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(feet - bob));
  if (tilt) ctx.rotate(-tilt * Math.sign(turn));
  ctx.scale(turn * CSC * sx, CSC * sy);
  if (mode === 'walk') {
    // gövde (alttaki iki sıra hariç), sonra ayaklar: yarısı sırayla kalkar
    const legH = 2, half = Math.floor(W / 2), la = Math.max(0, lift) * 1.6, lb = Math.max(0, -lift) * 1.6;
    ctx.drawImage(s, 0, 0, W, H - legH, -W / 2, -H, W, H - legH);
    ctx.drawImage(s, 0, H - legH, half, legH, -W / 2, -legH - la, half, legH);
    ctx.drawImage(s, half, H - legH, W - half, legH, -W / 2 + half, -legH - lb, W - half, legH);
  } else ctx.drawImage(s, -W / 2, -H);
  ctx.restore();
  return bob;
}
