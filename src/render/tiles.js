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
const MAT_SEED = { dirt: 11, stone: 23, hard: 37, dense: 53, bedrock: 71, found: 83, vault: 97, moss: 101, ice: 113, bone: 127, magma: 131, obsidian: 139, void: 149,
  quick: 151, storm: 157, gilt: 163, gate: 167, fungus: 173, glass: 179, titan: 181, chrono: 191, blood: 193, echo: 197, genesis: 199,
  mute: 211, tide: 223, flesh: 227, mirror: 229, amber: 233, magnet: 239, hunger: 241, rootwood: 251, sea: 257, zero: 263, falls: 269 };
const CLEAR = [0, 0, 0], EMBER = [[120, 30, 10], [220, 90, 30], [255, 170, 60], [255, 240, 180]];
const gemCache = new Map();
function gemRamp(gem) { let r = gemCache.get(gem); if (!r) { r = gem.map(hexToRgb); gemCache.set(gem, r); } return r; }

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
    case 'vault': {
      // kilitli kaya: çapraz bantlı, ortasında kilit rozeti; "buraya kazma işlemez" okunur
      const lx = ((wx % 16) + 16) % 16, ly = ((wy % 16) + 16) % 16;
      if (lx === 0 || ly === 0 || lx === 15 || ly === 15) return 1;
      const cx = lx - 7.5, cy = ly - 7.5, d2 = cx * cx + cy * cy;
      if (d2 < 3) return 4;
      if (d2 < 9) return 0;
      if (d2 < 13) return 3;
      if (((lx + ly) & 3) === 0) return 3;
      return h < 0.05 ? 1 : 2;
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
    case 'moss': {
      // yumuşak toprak + üstte yosun lekeleri, ince kök çizgileri
      const m = vnoise(wx / 9, wy / 6, s + 5);
      const root = ((wx + Math.floor(vnoise(0, wy / 7, s + 8) * 5)) % 11) === 0 && hash2(wx, wy >> 2, s + 9) < 0.6;
      if (root) return 1;
      if (h < 0.02) return 4;
      return m > 0.66 ? 3 : m < 0.3 ? 1 : 2;
    }
    case 'ice': {
      // buz: geniş açık levhalar, çapraz çatlaklar, seyrek parlak nokta
      const crack = (((wx - wy) & 15) === 0 && hash2((wx - wy) >> 4, wy >> 3, s + 2) < 0.5) || (((wx + wy) & 21) === 0 && hash2((wx + wy), 0, s + 3) < 0.4);
      if (crack) return 1;
      if (h < 0.02) return 4;
      const f = vnoise(wx / 8, wy / 8, s + 4);
      return f > 0.62 ? 3 : f > 0.3 ? 2 : 3;
    }
    case 'bone': {
      // kemik yığını: yatay uzun kemikler ve eklem yumruları
      const by = (wy + Math.floor(vnoise(wx / 13, 0, s + 6) * 4)) % 7;
      const bx = (wx + Math.floor(hash2(0, wy / 7 | 0, s + 7) * 9)) % 13;
      if (by === 0) return 1;
      if (by === 1 && bx > 1 && bx < 11) return 4;
      if (by === 2 && (bx === 1 || bx === 11)) return 3;
      if (by >= 4 && by <= 5 && (bx < 2 || bx > 10)) return 3;
      return h < 0.04 ? 1 : 2;
    }
    case 'magma': {
      // kor kayası: koyu kabuk, arasında parlayan kırmızı damarlar
      const v = vnoise(wx / 6, wy / 6, s + 3);
      const vein = Math.abs(v - 0.5) < 0.035;
      if (vein) return 4;
      if (Math.abs(v - 0.5) < 0.07) return 3;
      return n > 0.6 ? 2 : 1;
    }
    case 'obsidian': {
      // obsidyen: cam gibi keskin kırıklar, nadir parlak kenar
      const f = vnoise(wx / 5, wy / 5, s + 9);
      const edge = (((wx * 3 + wy * 2) % 17) === 0) && hash2(wx >> 1, wy >> 1, s) < 0.5;
      if (edge) return 4;
      if (h < 0.012) return 4;
      return f > 0.66 ? 3 : f > 0.42 ? 2 : 1;
    }
    case 'void': {
      // boşluk: koyu, içinde seyrek yıldız noktaları ve mor girdap izleri
      const sw = vnoise(wx / 10, wy / 10, s + 2);
      if (h < 0.01) return 4;
      if (Math.abs(sw - 0.5) < 0.03) return 3;
      return sw > 0.62 ? 2 : 1;
    }
    case 'quick': {
      // cıva: yatay dalga bantları, gümüş parlama noktaları
      const w = Math.sin(wx / 5 + vnoise(wx / 9, wy / 9, s) * 6) * 1.5;
      const band = ((Math.floor(wy + w) % 6) + 6) % 6;
      if (band === 0) return 3; if (band === 1) return 4; if (band === 3) return 1;
      return h < 0.02 ? 4 : 2;
    }
    case 'storm': {
      // fırtına taşı: koyu mavi, çapraz zikzak yıldırım çizgileri
      const z = (((wx + Math.floor(vnoise(0, wy / 4, s + 2) * 7) - wy * 2) % 23) + 23) % 23;
      if (z === 0 && hash2(wx >> 2, wy >> 2, s) < 0.7) return 4;
      if (z === 1) return 3;
      if (h < 0.01) return 4;
      return n > 0.6 ? 2 : 1;
    }
    case 'gilt': {
      // yaldızlı taş: kahverengi bloklar, altın derz çizgileri
      const lx = ((wx % 12) + 12) % 12, ly = ((wy % 8) + 8) % 8, row = Math.floor(wy / 8) & 1;
      if (ly === 0 || (lx === 0 && !row) || (lx === 6 && row)) return 4;
      if (ly === 1) return 1;
      if (h < 0.03) return 4;
      return n > 0.62 ? 3 : 2;
    }
    case 'gate': {
      // saray kapısı: dikey altın kalaslar, perçinler
      const lx = ((wx % 8) + 8) % 8, ly = ((wy % 16) + 16) % 16;
      if (lx === 0) return 0; if (lx === 1) return 4; if (lx === 7) return 1;
      if ((ly === 4 || ly === 12) && lx === 4) return 4;
      return ly < 2 || ly > 13 ? 3 : 2;
    }
    case 'fungus': {
      // mantar eti: yumuşak mor doku, açık benekler, ince lif çizgileri
      const m = vnoise(wx / 6, wy / 6, s + 5);
      const spot = hash2(wx >> 2, wy >> 2, s + 1) < 0.08 && (wx & 3) > 0 && (wx & 3) < 3 && (wy & 3) > 0 && (wy & 3) < 3;
      if (spot) return 4;
      if ((((wx + wy * 3) % 13) + 13) % 13 === 0) return 1;
      return m > 0.62 ? 3 : m < 0.3 ? 1 : 2;
    }
    case 'glass': {
      // cam: geniş açık levhalar, keskin çapraz kırıklar, beyaz yansıma çizgisi
      const f = vnoise(wx / 10, wy / 10, s + 4), d1 = (((wx - wy) % 9) + 9) % 9;
      const crack = (d1 === 0 && hash2((wx - wy) / 9 | 0, wy >> 4, s) < 0.6) || ((((wx + wy * 2) % 17) + 17) % 17 === 0);
      if (crack) return 1;
      if (d1 === 1 && f > 0.5) return 4;
      return f > 0.55 ? 3 : 2;
    }
    case 'titan': {
      // dev kabuğu: iri şaşırtmalı pullar, koyu derzler, üst kenarda ışık
      const px = wx + ((Math.floor(wy / 6) & 1) ? 4 : 0), lx = ((px % 8) + 8) % 8, ly = ((wy % 6) + 6) % 6;
      if (ly === 0 || lx === 0) return 1;
      if (ly === 1 && lx > 1 && lx < 6) return 3;
      if (h < 0.02) return 4;
      return 2;
    }
    case 'chrono': {
      // kronit: bronz, eş merkezli saat halkaları ve akrep çizgisi
      const cx = Math.floor(wx / 24) * 24 + 12, cy = Math.floor(wy / 24) * 24 + 12, d = Math.hypot(wx - cx, wy - cy);
      const ring = Math.floor(d) % 5;
      if (ring === 0) return 3; if (ring === 1 && d < 11) return 4;
      if (Math.abs((wx - cx) - (wy - cy) * 0.5) < 0.7 && d < 10) return 1;
      return n > 0.6 ? 2 : 1;
    }
    case 'blood': {
      // kan taşı: koyu kızıl, aşağı akan damla izleri ve parlak damarlar
      const drip = (((wx + Math.floor(vnoise(0, wy / 5, s + 2) * 3)) % 7) + 7) % 7 === 0 && hash2(wx >> 1, 0, s) < 0.5;
      if (drip) return 4;
      const v = vnoise(wx / 5, wy / 9, s + 3);
      if (Math.abs(v - 0.5) < 0.03) return 3;
      return n > 0.62 ? 2 : 1;
    }
    case 'echo': {
      // yankı taşı: gri-mor, eş merkezli dalga halkaları
      const cx = Math.floor(wx / 32) * 32 + 16, cy = Math.floor(wy / 32) * 32 + 16, d = Math.hypot(wx - cx, wy - cy);
      const r2 = Math.floor(d + vnoise(wx / 6, wy / 6, s) * 3) % 6;
      if (r2 === 0) return 3; if (r2 === 1) return 1;
      if (h < 0.01) return 4;
      return 2;
    }
    case 'genesis': {
      // yaratılış taşı: açık mermer, ince koyu damarlar, seyrek altın-beyaz pırıltı
      const v = vnoise(wx / 7, wy / 4, s + 3), m = vnoise(wx / 13, wy / 13, s + 8);
      if (Math.abs(v - 0.5) < 0.03) return 1;
      if (h < 0.03) return 4;
      return m > 0.6 || m < 0.35 ? 3 : 2;
    }
    case 'falls': {
      // ıslak kayağan: dikey su izleri, arada yosun lekesi
      const st = vnoise(wx / 2.5, wy / 16, s + 5);
      if (st > 0.72) return 3;
      if (st < 0.22) return 1;
      if (vnoise(wx / 5, wy / 5, s + 9) > 0.7 && h < 0.5) return 4;
      return n > 0.6 ? 3 : 2;
    }
    case 'mute': {
      // sağır taş: yumuşak gri keçe, yatay sessiz çizgiler
      const band = ((wy + Math.floor(vnoise(wx / 14, wy / 20, s + 2) * 4)) % 5 + 5) % 5;
      if (band === 0 && h < 0.8) return 1;
      if (h < 0.01) return 3;
      return n > 0.62 ? 3 : 2;
    }
    case 'tide': {
      // gelgit taşı: ıslak, dalgalı açık çizgiler, damla izleri
      const w = Math.sin(wx / 4 + vnoise(wx / 8, wy / 8, s) * 5) * 1.3, band = ((Math.floor(wy + w) % 7) + 7) % 7;
      if (band === 0) return 3; if (band === 1) return 1;
      if (h < 0.02) return 4;
      return n > 0.6 ? 2 : 1;
    }
    case 'flesh': {
      // yaşayan kaya: kıvrık etli kıvrımlar, koyu damarlar
      const v = vnoise(wx / 5, wy / 5, s + 3), m = vnoise(wx / 9, wy / 9, s + 7);
      if (Math.abs(v - 0.5) < 0.03) return 1;
      if (Math.abs(m - 0.5) < 0.02) return 4;
      return m > 0.58 ? 3 : 2;
    }
    case 'mirror': {
      // ayna taşı: büyük levhalar, çapraz beyaz yansıma bantları
      const lx = ((wx % 16) + 16) % 16, ly = ((wy % 12) + 12) % 12, d1 = (((wx + wy) % 14) + 14) % 14;
      if (lx === 0 || ly === 0) return 1;
      if (d1 === 0 || d1 === 1) return 4;
      return n > 0.55 ? 3 : 2;
    }
    case 'amber': {
      // kehribar taşı: sarımsı katmanlar, içinde koyu kabarcıklar
      const band = ((wy + Math.floor(vnoise(wx / 12, 0, s + 2) * 5)) % 8 + 8) % 8;
      if (hash2(wx >> 1, wy >> 1, s + 5) < 0.03) return 1;
      if (band === 0) return 4;
      return band < 3 ? 3 : 2;
    }
    case 'magnet': {
      // mıknatıs taşı: pas kabuk, dikey çelik lifler
      const col = ((wx + Math.floor(vnoise(0, wy / 6, s + 4) * 3)) % 5 + 5) % 5;
      if (col === 0) return 1;
      if (col === 1 && h < 0.6) return 3;
      if (h < 0.015) return 4;
      return n > 0.62 ? 2 : 1;
    }
    case 'hunger': {
      // açlık taşı: kurumuş, kemirilmiş delikler
      const cx = Math.floor(wx / 6), cy = Math.floor(wy / 6), hole = hash2(cx, cy, s + 1) < 0.22;
      if (hole) { const dx = wx - (cx * 6 + 3), dy = wy - (cy * 6 + 3); if (dx * dx + dy * dy < 3) return 0; if (dx * dx + dy * dy < 5) return 1; }
      if (h < 0.02) return 4;
      return n > 0.6 ? 3 : 2;
    }
    case 'rootwood': {
      // kök odunu: dikey lifler, budak halkaları
      const col = ((wx + Math.floor(vnoise(0, wy / 11, s + 4) * 4)) % 4 + 4) % 4;
      if (col === 0) return 1;
      const cx = Math.floor(wx / 20) * 20 + 10, cy = Math.floor(wy / 20) * 20 + 10, d = Math.hypot(wx - cx, wy - cy);
      if (hash2(cx, cy, s) < 0.35 && d < 5 && Math.floor(d) % 2 === 0) return 4;
      return n > 0.6 ? 3 : 2;
    }
    case 'sea': {
      // sessiz deniz: çok koyu, yavaş dalgalar ve biyolüminesan noktalar
      const w = vnoise(wx / 12, wy / 6, s + 2);
      if (h < 0.006) return 4;
      if (Math.abs(w - 0.5) < 0.025) return 3;
      return w > 0.6 ? 2 : 1;
    }
    case 'zero': {
      // sıfır taşı: saf beyaz-gri, keskin ızgara kırıkları
      const lx = ((wx % 10) + 10) % 10, ly = ((wy % 10) + 10) % 10;
      if ((lx === 0 || ly === 0) && hash2(wx >> 3, wy >> 3, s) < 0.5) return 1;
      if (h < 0.02) return 4;
      return n > 0.58 ? 3 : 2;
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
        if (col) put(px, py, col); else put(px, py, CLEAR, 0);
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
  const blend = m => m && m !== mat0 && m !== 'found' && mat0 !== 'found' && m !== 'vault' && mat0 !== 'vault' && m !== 'gate' && mat0 !== 'gate';
  const dN = blend(mN), dS = blend(mS), dW = blend(mW), dE = blend(mE);
  const grass = eN && r === GROUND_ROW && mat0 === 'dirt';
  const ember = TD[t].ember, gem = TD[t].gem ? gemRamp(TD[t].gem) : null;
  const ore = TD[t].ore;
  const OR = ore && !(G.buried && G.buried[r * COLS + c]) ? rgb['o_' + ore] : null;
  const R0 = rgb['m_' + mat0], s0 = MAT_SEED[mat0], wall0 = rgb['w_' + hostMat(r)][0];
  for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
    // dışbükey köşe yuvarlama
    const cut = (eN && eW && px + py < 2) || (eN && eE && (15 - px) + py < 2) ||
                (eS && eW && px + (15 - py) < 2) || (eS && eE && (15 - px) + (15 - py) < 2);
    const wx = x0 + px, wy = y0 + py;
    if (cut) {
      // arkası: boşluk rengi
      if (r < GROUND_ROW + 1 && eN) put(px, py, CLEAR, 0);
      else put(px, py, wall0);
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
    const R = mat === mat0 ? R0 : rgb['m_' + mat], s = mat === mat0 ? s0 : MAT_SEED[mat];
    let i = seam ? 1 : baseShade(mat, wx, wy, s);
    if (OR) {
      const g = gemAt(c, r, px, py);
      if (g) { put(px, py, OR[g - 1]); continue; }
    }
    if (gem) {
      const g = gemAt(c, r, px, py);
      if (g) { put(px, py, gem[g - 1]); continue; }
    }
    if (ember) {
      const g = gemAt(c, r, px, py);
      if (g) { put(px, py, EMBER[g - 1]); continue; }
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

// Parçalar tembel üretilir: sefer başında yalnız yüzey, kalanı boşta kalan zamanda kameraya yakın olandan başlayarak.
// Kameradan çok uzaklaşan parça bırakılır (bellek); gerekince haritadan yeniden boyanır.
const NEAR = 4, KEEP = 10;
let camC = 0, idleQ = false;
export function resetTiles() {
  chunks = new Array(Math.ceil(ROWS / CH_ROWS)).fill(null);
  camC = 0;
}
export function prebuildTiles(camY = 0) {
  camC = Math.max(0, Math.floor(camY / CH_H));
  for (let i = Math.max(0, camC - 1); i <= Math.min(chunks.length - 1, camC + 2); i++) if (!chunks[i]) chunks[i] = makeChunk(i);
  queueIdle();
}
function nextMissing() {
  for (let d = 0; d <= NEAR; d++) for (const i of [camC + d, camC - d]) if (i >= 0 && i < chunks.length && !chunks[i]) return i;
  return -1;
}
function idleWork(dl) {
  idleQ = false;
  for (let i = 0; i < chunks.length; i++) if (chunks[i] && Math.abs(i - camC) > KEEP) chunks[i] = null;
  do { const i = nextMissing(); if (i < 0) return; chunks[i] = makeChunk(i); } while (dl && dl.timeRemaining && dl.timeRemaining() > 12);
  queueIdle();
}
function queueIdle() {
  if (idleQ || typeof window === 'undefined' || nextMissing() < 0) return;
  idleQ = true;
  if (window.requestIdleCallback) window.requestIdleCallback(idleWork, { timeout: 400 }); else setTimeout(idleWork, 40);
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
  if (c0 !== camC) { camC = c0; queueIdle(); }
  for (let i = c0; i <= c1; i++) {
    if (!chunks[i]) chunks[i] = makeChunk(i);
    ctx.drawImage(chunks[i].cv, -camX, i * CH_H - camY);
  }
}
