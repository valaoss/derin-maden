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
