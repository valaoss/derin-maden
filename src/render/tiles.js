// Prosedürel pixel-art tile "shader"ı + chunk önbelleği.
// Doku dünya koordinatında üretilir -> tile ızgarası görünmez, kaya tek bir kütle gibi okunur.
// Açık kenarlar autotile mantığıyla konturlanır, üstten ışık alır, dışbükey köşeler yuvarlanır.
import { COLS, ROWS, TILE, GROUND_ROW } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { MAT_RAMP, WALL_RAMP, ORE_RAMP, P } from '../data/palette.js';
import { hexToRgb, hash2, vnoise } from '../core/util.js';
import { G } from '../game/state.js';
import { hostMat } from '../world/map.js';

const CH_ROWS = 16;
const CH_H = CH_ROWS * TILE, CH_W = COLS * TILE;
let chunks = [];

const rgb = {};
function ramp(name, arr) { rgb[name] = arr.map(hexToRgb); }
for (const k in MAT_RAMP) ramp('m_' + k, MAT_RAMP[k]);
for (const k in WALL_RAMP) ramp('w_' + k, WALL_RAMP[k]);
for (const k in ORE_RAMP) ramp('o_' + k, ORE_RAMP[k]);
ramp('grass', [P.ink, P.grass0, P.grass1, P.grass2]);
const MAT_SEED = { dirt: 11, stone: 23, hard: 37, dense: 53, bedrock: 71, found: 83 };

// görsel olarak katı mı (barikat arka duvar üzerinde sprite olarak çizilir)
function vSolid(c, r) {
  if (c < 0 || c >= COLS || r >= ROWS) return true;
  if (r < 0) return false;
  const t = G.map[r * COLS + c];
  return TD[t].solid && t !== T.BARRICADE;
}
function tileMat(t, r) {
  const m = TD[t].mat;
  if (!m || m === 'host' || m === 'metal') return hostMat(r);
  return m;
}

// Malzemeye özgü taban tonu (0..4 rampa indeksi)
function baseShade(mat, wx, wy, s) {
  const n = vnoise(wx / 7, wy / 7, s);
  let i = n > 0.64 ? 3 : n < 0.32 ? 1 : 2;
  const h = hash2(wx, wy, s);
  switch (mat) {
    case 'dirt': {
      // çakıllar: 7px hücre başına seyrek taş
      const cx = Math.floor(wx / 7), cy = Math.floor(wy / 7);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const gx = cx + ox, gy = cy + oy;
        if (hash2(gx, gy, s + 1) > 0.26) continue;
        const px = gx * 7 + 1 + hash2(gx, gy, s + 2) * 5, py = gy * 7 + 1 + hash2(gx, gy, s + 3) * 5;
        const dx = wx - px, dy = wy - py, d2 = dx * dx + dy * dy * 1.4;
        if (d2 < 2.6) return dx + dy < -0.6 ? 4 : dx + dy > 0.9 ? 1 : 3;
      }
      const m = vnoise(wx / 11, wy / 9, s + 5);
      if (h < 0.03) return 1;
      if (h > 0.985) return 3;
      return m > 0.7 ? 3 : m < 0.22 ? 1 : 2;
    }
    case 'stone': {
      const band = (wy + Math.floor(vnoise(wx / 11, wy / 30, s + 4) * 6)) % 9;
      if (band === 0) return 1;
      if (band === 1 && h < 0.5) return 3;
      if (h < 0.03) return 4;
      return i;
    }
    case 'hard': {
      const f = vnoise(wx / 5, wy / 5, s + 9);
      const q = f > 0.6 ? 3 : f > 0.4 ? 2 : 1;
      if (h < 0.015) return 4;
      return q;
    }
    case 'dense': {
      if (h < 0.022) return 4;
      if (h < 0.06) return 3;
      return n > 0.6 ? 2 : 1;
    }
    case 'found': {
      // çelik temel plakaları: 16px levhalar, köşe perçinleri, üst kenar parlaklığı
      const lx = ((wx % 16) + 16) % 16, ly = ((wy % 16) + 16) % 16;
      if (lx === 0 || ly === 0) return 1;
      if ((lx === 3 || lx === 13) && (ly === 3 || ly === 13)) return 4;
      if (ly === 1) return 3;
      if (lx === 15 || ly === 15) return 1;
      return h < 0.04 ? 1 : 2;
    }
    default: // bedrock
      return n > 0.72 ? 3 : n > 0.4 ? 2 : 1;
  }
}

const GEM_BIG = [' 34 ', '3443', '2332', ' 22 ', '  1 '];
const GEM_SMALL = [' 4 ', '343', ' 2 '];
function gemAt(c, r, px, py) {
  // tile başına 3 taş, deterministik konumlar
  for (let g = 0; g < 3; g++) {
    const pat = g === 2 ? GEM_SMALL : GEM_BIG;
    const gx = 2 + Math.floor(hash2(c, r, 100 + g) * (13 - pat[0].length));
    const gy = 2 + Math.floor(hash2(c, r, 200 + g) * (13 - pat.length));
    const lx = px - gx, ly = py - gy;
    if (ly >= 0 && ly < pat.length && lx >= 0 && lx < pat[ly].length) {
      const ch = pat[ly][lx]; if (ch !== ' ') return +ch;
    }
  }
  return 0;
}

// Tek bir tile'ı ImageData'ya yaz
function paintTile(img, c, r, oy) {
  const data = img.data;
  const t = r >= 0 && r < ROWS ? G.map[r * COLS + c] : T.BEDROCK;
  const solid = vSolid(c, r);
  const x0 = c * TILE, y0 = r * TILE;
  const put = (px, py, col, a = 255) => {
    const o = ((py + y0 - oy) * CH_W + (px + x0)) * 4;
    data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = a;
  };
  if (!solid) {
    if (r < GROUND_ROW) {
      // yüzey havası: şeffaf, altındaki toprağın çimen uçları
      const grassBelow = r === GROUND_ROW - 1 && vSolid(c, r + 1) && c > 1 && c < COLS - 2;
      for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
        let col = null;
        if (grassBelow) {
          const wx = x0 + px, bh = Math.floor(hash2(wx, 5, 3) * 4) - (hash2(wx, 9, 3) < 0.35 ? 3 : 0);
          if (py >= TILE - bh) col = rgb.grass[py === TILE - bh ? 3 : 2];
        }
        if (col) put(px, py, col); else put(px, py, [0, 0, 0], 0);
      }
      return;
    }
    // kazılmış boşluk: koyu arka duvar + ortam kapatması (AO)
    const mat = hostMat(r), R = rgb['w_' + mat], s = MAT_SEED[mat] + 500;
    const sN = vSolid(c, r - 1), sS = vSolid(c, r + 1), sW = vSolid(c - 1, r), sE = vSolid(c + 1, r);
    const sNW = vSolid(c - 1, r - 1), sNE = vSolid(c + 1, r - 1);
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const wx = x0 + px, wy = y0 + py;
      const n = vnoise(wx / 6, wy / 4, s);
      let i = n > 0.6 ? 3 : n > 0.36 ? 2 : 1;
      if ((wy + Math.floor(vnoise(wx / 9, 0, s) * 3)) % 6 === 0 && hash2(wx >> 2, wy, s) < 0.7) i = Math.max(0, i - 1);
      let ao = 0;
      if (sN) ao = Math.max(ao, py < 2 ? 3 : py < 5 ? 2 : py < 8 ? 1 : 0);
      if (sW) ao = Math.max(ao, px < 2 ? 2 : px < 4 ? 1 : 0);
      if (sE) ao = Math.max(ao, px > 13 ? 2 : px > 11 ? 1 : 0);
      if (sS && py > 14) ao = Math.max(ao, 1);
      if (!sN && sNW && px < 3 && py < 3) ao = Math.max(ao, 1);
      if (!sN && sNE && px > 12 && py < 3) ao = Math.max(ao, 1);
      i = Math.max(0, i - ao);
      put(px, py, R[i]);
    }
    return;
  }
  // katı kaya
  const mat0 = tileMat(t, r);
  const eN = !vSolid(c, r - 1), eS = !vSolid(c, r + 1), eW = !vSolid(c - 1, r), eE = !vSolid(c + 1, r);
  // farklı malzemeli komşular: sınır paylaşılan gürültüyle dalgalanır (iki taraf aynı çizgiyi hesaplar)
  const nm = (cc, rr) => (vSolid(cc, rr) && rr >= GROUND_ROW ? tileMat(G.map[rr * COLS + cc] ?? T.BEDROCK, rr) : null);
  const mN = !eN ? nm(c, r - 1) : null, mS = !eS ? nm(c, r + 1) : null;
  const mW = !eW && c > 0 ? nm(c - 1, r) : null, mE = !eE && c < COLS - 1 ? nm(c + 1, r) : null;
  // çelik temel düz kenarlı kalır (insan yapımı)
  const blend = m => m && m !== mat0 && m !== 'found' && mat0 !== 'found';
  const dN = blend(mN), dS = blend(mS), dW = blend(mW), dE = blend(mE);
  const grass = eN && r === GROUND_ROW && mat0 === 'dirt';
  const ore = TD[t].ore;
  const OR = ore ? rgb['o_' + ore] : null;
  for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
    // dışbükey köşe yuvarlama
    const cut = (eN && eW && px + py < 2) || (eN && eE && (15 - px) + py < 2) ||
                (eS && eW && px + (15 - py) < 2) || (eS && eE && (15 - px) + (15 - py) < 2);
    const wx = x0 + px, wy = y0 + py;
    if (cut) {
      // arkası: boşluk rengi
      if (r < GROUND_ROW + 1 && eN) put(px, py, [0, 0, 0], 0);
      else put(px, py, rgb['w_' + hostMat(r)][0]);
      continue;
    }
    const corner = (eN && eW && px + py === 2) || (eN && eE && (15 - px) + py === 2) ||
                   (eS && eW && px + (15 - py) === 2) || (eS && eE && (15 - px) + (15 - py) === 2);
    let mat = mat0, seam = false;
    if (dW || dE || dN || dS) {
      if (dW) { const b = x0 + (vnoise(wy / 5, c * 7.3, 3) - 0.5) * 9; if (wx < b) mat = mW; if (Math.abs(wx - b) < 0.8) seam = true; }
      if (dE) { const b = x0 + TILE + (vnoise(wy / 5, (c + 1) * 7.3, 3) - 0.5) * 9; if (wx >= b) mat = mE; if (Math.abs(wx - b) < 0.8) seam = true; }
      if (dN) { const b = y0 + (vnoise(wx / 5, r * 5.1, 4) - 0.5) * 9; if (wy < b) mat = mN; if (Math.abs(wy - b) < 0.8) seam = true; }
      if (dS) { const b = y0 + TILE + (vnoise(wx / 5, (r + 1) * 5.1, 4) - 0.5) * 9; if (wy >= b) mat = mS; if (Math.abs(wy - b) < 0.8) seam = true; }
    }
    const R = rgb['m_' + mat], s = MAT_SEED[mat];
    let i = seam ? 1 : baseShade(mat, wx, wy, s);
    if (OR) {
      const g = gemAt(c, r, px, py);
      if (g) { put(px, py, OR[g - 1]); continue; }
    }
    // kenar ışığı: yukarıdan gelir
    if (eN) { if (py === 0) i = 0; else if (py === 1) i = 4; else if (py === 2) i = Math.max(i, 3); }
    if (eS) { if (py === 15) i = 0; else if (py === 14) i = 1; else if (py === 13) i = Math.min(i, 2); }
    if (eW) { if (px === 0) i = 0; else if (px === 1 && !(eN && py < 3)) i = Math.min(i + 1, 3); }
    if (eE) { if (px === 15) i = 0; else if (px === 14) i = Math.min(i, 1); }
    if (corner) i = 0;
    if (grass && py < 6) {
      const gd = 3 + Math.floor(hash2(wx, 1, 7) * 3);
      if (py < gd) { put(px, py, rgb.grass[py === 0 ? 3 : py === gd - 1 ? 1 : 2]); continue; }
      if (py === gd) { put(px, py, rgb.grass[1]); continue; }
    }
    put(px, py, R[i]);
  }
}

function makeChunk(ci) {
  const cv = document.createElement('canvas'); cv.width = CH_W; cv.height = CH_H;
  const cx = cv.getContext('2d');
  const img = cx.createImageData(CH_W, CH_H);
  const oy = ci * CH_H;
  const r0 = ci * CH_ROWS;
  for (let r = r0; r < Math.min(ROWS, r0 + CH_ROWS); r++) for (let c = 0; c < COLS; c++) paintTile(img, c, r, oy);
  cx.putImageData(img, 0, 0);
  return { cv, cx, img, oy, r0, built: true };
}

export function resetTiles() {
  chunks = new Array(Math.ceil(ROWS / CH_ROWS)).fill(null);
}
export function prebuildTiles() {
  for (let i = 0; i < chunks.length; i++) if (!chunks[i]) chunks[i] = makeChunk(i);
}

// Değişen tile'lar: 3x3 komşuluk yeniden boyanır
export function flushDirty() {
  const d = G.dirty;
  if (!d.length) return;
  const touched = new Map();
  for (let k = 0; k < d.length; k += 2) {
    const c0 = d[k], r0 = d[k + 1];
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const ci = Math.floor(r / CH_ROWS), ch = chunks[ci];
      if (!ch) continue;
      paintTile(ch.img, c, r, ch.oy);
      const rect = touched.get(ci) || { x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
      rect.x0 = Math.min(rect.x0, c * TILE); rect.x1 = Math.max(rect.x1, c * TILE + TILE);
      rect.y0 = Math.min(rect.y0, r * TILE - ch.oy); rect.y1 = Math.max(rect.y1, r * TILE + TILE - ch.oy);
      touched.set(ci, rect);
    }
  }
  for (const [ci, rc] of touched) {
    const ch = chunks[ci];
    ch.cx.putImageData(ch.img, 0, 0, rc.x0, rc.y0, rc.x1 - rc.x0, rc.y1 - rc.y0);
  }
  d.length = 0;
}

export function drawTiles(ctx, camX, camY, vw, vh) {
  const c0 = Math.max(0, Math.floor(camY / CH_H)), c1 = Math.min(chunks.length - 1, Math.floor((camY + vh) / CH_H));
  for (let i = c0; i <= c1; i++) {
    if (!chunks[i]) chunks[i] = makeChunk(i);
    ctx.drawImage(chunks[i].cv, -camX, i * CH_H - camY);
  }
}
