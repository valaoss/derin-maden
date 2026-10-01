// Sıvı alanı: hücre simülasyonundan piksel çözünürlüğünde tek parça bir sıvı gövdesi çıkarır ve boyar (su ve lav). DOM gerektirmez.
// 1) hücreler: seviye zamanda yumuşatılır, düşen akışın izi kısa süre kalır (damla damla gelen su kesintisiz sütun olur);
//    altı dolu olan hücre DURAN, olmayan AKAN sayılır
// 2) ham maske: duran hücrede komşularına eğimli yüzey; akan hücrede kaynağına yapışık sütun (kaynak taşı, basamak kenarı, üstteki akış)
// 3) duvara göre normalleştirilmiş bulanıklık + eşik: dış köşe yuvarlanır, iç köşe dolar, yakın parçalar birleşir, düz yüzey yerinde kalır
// 4) boyama: derinlik tonları, yüzey çizgisi, kırılan ışık; akışta aşağı kayan köpük şeritleri; lavda kabuk, damar, kabarcık
import { COLS, ROWS, TILE } from '../config.js';
import { TD } from '../data/tiles.js';

const R = 3, WIN = (2 * R + 1) ** 2, REST = 1, FALL = 2;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const fr = x => x - Math.floor(x), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hash = n => fr(Math.sin(n * 127.1 + 3.7) * 43758.5453), hash2 = (a, b) => fr(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
const wave = (x, t, k) => k ? Math.sin(x * 0.095 - t * 1.2) * 0.6 + Math.sin(x * 0.24 + t * 0.8) * 0.3 : Math.sin(x * 0.075 - t * 2.1) * 0.9 + Math.sin(x * 0.19 + t * 3.3) * 0.4;

// hücre durumu (çizime özel; simülasyona dokunmaz)
let own = null, lev, wet, kind, type, hc, sl, sr, st, fc, hx, ys, y2, nl, nr, ff, fs, near, yp, ypF, rowT, frame = 0, lastT = 0, wallKey = '';
// piksel tamponları (görünür sıvının çevresi kadar)
let cap = 0, raw, wall, tmp, sum, sumw, mask, strm, rgba, glow;
export const field = () => ({ lev, type, kind, hc, ys, ff });

function reset(lq, t) {
  const n = lq.length; own = lq; lastT = -1e9;
  lev = new Float32Array(n); wet = new Float32Array(n); hc = new Float32Array(n); sl = new Float32Array(n); sr = new Float32Array(n); st = new Float32Array(n); fc = new Float32Array(n); hx = new Float32Array(n); ys = new Float32Array(n); y2 = new Float32Array(n); nl = new Int32Array(n); nr = new Int32Array(n);
  kind = new Uint8Array(n); type = new Uint8Array(n); ff = new Uint8Array(n); fs = new Uint8Array(n); near = new Uint8Array(n); yp = new Float32Array(n); ypF = new Int32Array(n); rowT = new Float64Array(ROWS).fill(-1e9); frame = 0;
  for (let i = 0; i < n; i++) { lev[i] = lq[i]; wet[i] = lq[i] ? 1 : 0; }
}
function room(n) {
  if (n <= cap) return; cap = Math.ceil(n * 1.3); wallKey = '';
  raw = new Uint8Array(cap); wall = new Uint8Array(cap); tmp = new Uint8Array(cap); sum = new Uint8Array(cap); sumw = new Uint8Array(cap); mask = new Uint8Array(cap); strm = new Uint8Array(cap);
  rgba = new Uint8ClampedArray(cap * 4); glow = new Uint8ClampedArray(cap * 4);
}
// kutu bulanıklığı (yarıçap R): pencere toplamı, kenarda değer yinelenir
function blur(src, dst, w, h) {
  for (let y = 0; y < h; y++) {
    const o = y * w; let s = src[o] * (R + 1); for (let x = 1; x <= R; x++) s += src[o + Math.min(w - 1, x)];
    for (let x = 0; x < w; x++) { tmp[o + x] = s; s += src[o + Math.min(w - 1, x + R + 1)] - src[o + Math.max(0, x - R)]; }
  }
  for (let x = 0; x < w; x++) {
    let s = tmp[x] * (R + 1); for (let y = 1; y <= R; y++) s += tmp[Math.min(h - 1, y) * w + x];
    for (let y = 0; y < h; y++) { dst[y * w + x] = s; s += tmp[Math.min(h - 1, y + R + 1) * w + x] - tmp[Math.max(0, y - R) * w + x]; }
  }
}

// r0..r1: görünen satırlar; fixed: sabit su hücreleri (göl), hücre başına seviye. Dönen: { x, y, w, h, rgba, glow } (dünya pikseli) ya da null
export function rasterLiquids(G, r0, r1, t, fixed = null) {
  const lq = G.lq, lk = G.lk, map = G.map; if (!lq) return null;
  if (own !== lq) reset(lq, t);
  const jump = t < lastT || t - lastT > 0.5, dt = clamp(t - lastT, 0, 0.1); lastT = t;
  const ra = Math.max(1, r0 - 3), rb = Math.min(ROWS - 2, r1 + 3), solid = i => TD[map[i]].solid;
  // lav ağır akar (birimler seyrek gelir): izi ve seviyesi daha yavaş söner
  const up = 1 - Math.exp(-dt * 12), dn = [1 - Math.exp(-dt * 4), 1 - Math.exp(-dt * 1.5)], dry = [dt * 2.2, dt * 0.8];
  let c0 = COLS, c1 = -1, q0 = ROWS, q1 = -1, kinds = 0;
  for (let c = 0; c < COLS; c++) type[(ra - 1) * COLS + c] = type[(rb + 1) * COLS + c] = 0;
  frame++;
  for (let r = ra; r <= rb; r++) {
    // görüşe yeni giren satır (bir süredir güncellenmemiş): eski seviyeden yumuşatılmaz, gerçek duruma oturur
    const stale = jump || t - rowT[r] > 0.25; rowT[r] = t;
    for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c; type[i] = 0;
    if (solid(i)) { lev[i] = wet[i] = 0; continue; }
    let a = lq[i]; if (a) kind[i] = lk[i];
    if (fixed && fixed[i] > a) { a = fixed[i]; kind[i] = 0; }
    wet[i] = stale ? (a ? 1 : 0) : a ? Math.min(1, wet[i] + dt * 10) : Math.max(0, wet[i] - dry[kind[i]]);
    lev[i] = stale ? a : lev[i] + (a - lev[i]) * (a > lev[i] ? up : dn[kind[i]]); if (!a && lev[i] < 0.06) lev[i] = 0;
    if (lev[i] > 0 || wet[i] > 0) { if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < q0) q0 = r; if (r > q1) q1 = r; kinds |= 1 << kind[i]; }
    }
  }
  if (c1 < 0) return null;
  if (jump) for (let c = c0; c <= c1; c++) {
    let lastR = -1;
    for (let r = ra; r <= rb; r++) {
      const i = r * COLS + c; if (solid(i)) { lastR = -1; continue; }
      // ilk karede akış izi: sıvı hücresinin altındaki boşluk (zemine ya da sıradaki sıvıya kadar) akış sayılır
      if (!lq[i]) { if (lastR >= 0 && r - lastR <= 12) { wet[i] = 1; kind[i] = lk[lastR * COLS + c]; if (r > q1) q1 = r; } continue; }
      lastR = r;
    }
  }
  q1 = Math.min(rb, q1 + 3);
  // sınıflandırma (aşağıdan yukarı): altı kaya ya da dolu duran sıvıysa durur, değilse düşer
  for (let r = q1; r >= q0; r--) for (let c = c0; c <= c1; c++) {
    const i = r * COLS + c; if (solid(i) || !(lev[i] > 0 || wet[i] > 0)) continue;
    const b = i + COLS, k = kind[i];
    const sup = solid(b) || (fixed && fixed[i] > 0) || (r === rb ? lq[b] >= 7 && lk[b] === k : type[b] === REST && kind[b] === k && (lq[b] >= 7 || lev[b] > 6));
    type[i] = sup ? (lev[i] > 0 ? REST : 0) : FALL;
  }
  const same = (j, k, ty) => type[j] === ty && kind[j] === k;
  // havuza giren akışın son hücresi (sıvıya dayanır ama dolu değildir) yüzey değil akıştır: döküldüğü yerde tümsek olmaz
  for (let r = q0; r <= q1; r++) for (let c = c0; c <= c1; c++) {
    const i = r * COLS + c; if (type[i] === REST && lq[i] < 8 && !solid(i + COLS) && !(fixed && fixed[i]) && same(i - COLS, kind[i], FALL)) type[i] = FALL;
  }
  // yüzey: her sıvı sütununun tepe hücresi bir düğümdür; komşu düğümlerle yumuşatılır (akışın döküldüğü yerde tümsek kalmaz)
  const nodes = [], topOf = (j, k) => { while (same(j - COLS, k, REST)) j -= COLS; return j; };
  // komşu düğüm: >=0 düğüm, -1 duvar, -2 kuru kenar, -3 taşma kenarı (yanında akış başlar)
  const side = (i, k, s) => {
    const j = i + s; if (solid(j)) return -1;
    if (same(j, k, REST)) return topOf(j, k);
    // yandaki yüzey daha aşağıda: bu sütunun sıvısı o satıra iniyorsa aynı gövdedir
    for (let a = i + COLS, b = j + COLS, q = 0; q < 3 && same(a, k, REST) && !solid(b); a += COLS, b += COLS, q++) if (same(b, k, REST)) return b;
    return same(j, k, FALL) ? -3 : -2;
  };
  for (let r = q0; r <= q1; r++) for (let c = c0; c <= c1; c++) {
    const i = r * COLS + c; if (type[i] !== REST) continue;
    if (same(i - COLS, kind[i], REST)) { hc[i] = TILE; continue; }
    nodes.push(i); ys[i] = (r + 1) * TILE - clamp(lev[i] * 2, 3, TILE); nl[i] = side(i, kind[i], -1); nr[i] = side(i, kind[i], 1);
  }
  for (let it = 0; it < 6; it++) {
    for (const i of nodes) y2[i] = ((nl[i] >= 0 ? ys[nl[i]] : ys[i]) + 2 * ys[i] + (nr[i] >= 0 ? ys[nr[i]] : ys[i])) / 4;
    for (const i of nodes) ys[i] = y2[i];
  }
  // y2: sütunun dibi (yüzey bunun üstünde, en çok bir hücre yukarıda kalır)
  for (const i of nodes) {
    const b = (Math.floor(i / COLS) + 1) * TILE; let j = i; while (same(j + COLS, kind[i], REST)) j += COLS;
    // yüzey kendi hücresinin üstüne taşmaz (sıvısız hücrede su çizilmez) ve kareler arasında sıçramaz
    y2[i] = (Math.floor(j / COLS) + 1) * TILE; ys[i] = clamp(ys[i], b - TILE, y2[i] - 2);
    if (ypF[i] === frame - 1 && !jump) ys[i] = yp[i] + (ys[i] - yp[i]) * (1 - Math.exp(-dt * 14));
    yp[i] = ys[i]; ypF[i] = frame; hc[i] = clamp(b - ys[i], 0, TILE);
  }
  // akış sütunları (satır satır, yukarıdan aşağı): konum kaynağından gelir. Ardından aynı satırdaki duran diziler: besleme ve yatay akış
  for (let r = q0; r <= q1; r++) {
    const row = r * COLS;
    for (let c = c0; c <= c1; c++) {
      const i = row + c; hx[i] = 0; fc[i] = 0; fs[i] = 0;
      // taşma kenarı boşken de (birimler seyrek geçer) akış oradan başlar: yanında zemindeki tabaka, altında aynı sıvının akışı varsa
      if (!type[i] && !solid(i) && !solid(i + COLS)) for (const j of [i - 1, i + 1]) {
        if (type[j] !== REST || !solid(j + COLS)) continue;
        for (let q = 1, d = i + COLS; q <= (kind[j] ? 12 : 3) && r + q <= rb && !solid(d); q++, d += COLS) if (same(d, kind[j], FALL) || (q <= 3 && same(d, kind[j], REST))) { type[i] = FALL; kind[i] = kind[j]; break; }
        if (type[i]) break;
      }
      const k = kind[i];
      if (type[i] !== FALL) continue;
      const wd = clamp(5 + Math.max(lev[i], wet[i] * 0.8) * 2.3, 6, TILE), ab = i - COLS;
      let a = 8 - wd / 2, b = 8 + wd / 2, top = 0, fed = 0;
      if (same(ab, k, FALL)) {
        fed = ff[ab];
        const w2 = (sr[ab] - sl[ab]) * 0.6 + wd * 0.4;
        if (sl[ab] <= 0.01 && sr[ab] >= TILE - 0.01) { a = 8 - w2 / 2; b = 8 + w2 / 2; }
        else if (sl[ab] <= 0.01) { a = 0; b = w2; } else if (sr[ab] >= TILE - 0.01) { a = TILE - w2; b = TILE; }
        else { const m = (sl[ab] + sr[ab]) / 2; a = m - w2 / 2; b = m + w2 / 2; }
      } else if (TD[map[ab]].spring) fed = 1;
      else {
        // taşma kenarı: zemindeki tabakadan (ya da yanı açılmış havuzdan) taşan su o kenara yapışık düşer, tabakanın yüzeyinden başlar
        const d1 = i + COLS, d2 = d1 + COLS, drop = !solid(d1) && !same(d1, k, REST) && !solid(d2) && !same(d2, k, REST);
        const L = same(i - 1, k, REST) && (solid(i - 1 + COLS) || drop), Rr = same(i + 1, k, REST) && (solid(i + 1 + COLS) || drop);
        if (L && Rr) { a = 0; b = TILE; top = TILE - Math.max(hc[i - 1], hc[i + 1]); }
        else if (L) { a = 0; b = wd; top = TILE - hc[i - 1]; }
        else if (Rr) { a = TILE - wd; b = TILE; top = TILE - hc[i + 1]; }
        fed = L || Rr ? 1 : 0;
      }
      // beslenmeyen başıboş birim (akışın dibinde yana sıçrayan su): iz bırakmaz, dar çizilir; havuzun hemen üstündeyse hiç çizilmez
      if (!fed) {
        // tek tıklık sıçramalar (akışın dibinde bir an beliren birimler) çizilmez: birim aynı hücrede kalıcı olmalı
        if (!lq[i] || lk[i] !== k || wet[i] < 0.6 || (!same(ab, k, FALL) && same(i + COLS, k, REST))) { type[i] = 0; continue; }
        const w = Math.min(wd, 8); a = 8 - w / 2; b = 8 + w / 2;
      }
      ff[i] = fed; fs[i] = 1; sl[i] = clamp(a, 0, TILE); sr[i] = clamp(b, 0, TILE); st[i] = top;
      // beslenen akış kesintisizdir: birimler seyrek gelse de (damla damla lav) kaynaktan en son görülen birime kadar tek sütundur;
      // simülasyon sınıra dayanınca suyu zemine iki hücre kala emer, o yüzden yakın zemine / havuza kadar da uzar
      const d = i + COLS;
      if (fed && r < q1 && !solid(d) && !type[d]) for (let q = 1, j = d; q <= (k ? 12 : 4) && r + q <= rb; q++, j += COLS) {
        const land = solid(j) || same(j, k, REST); if (!land && !same(j, k, FALL)) continue;
        if (q > 1 && (!land || q <= 3)) { type[d] = FALL; kind[d] = k; }
        break;
      }
    }
    // yan yana beslenen sütunlar tek perde olur
    for (let c = c0; c <= c1; c++) {
      const i = row + c; if (type[i] !== FALL || !ff[i]) continue;
      if (c > 0 && same(i - 1, kind[i], FALL) && ff[i - 1]) sl[i] = 0;
      if (c < COLS - 1 && same(i + 1, kind[i], FALL) && ff[i + 1]) sr[i] = TILE;
    }
    for (let c = c0; c <= c1; c++) {
      const i = row + c, k = kind[i]; if (type[i] !== REST) continue;
      let e = c; while (e < c1 && same(row + e + 1, k, REST)) e++;
      const inl = q => { const up = row - COLS + q; return TD[map[up]].spring || (same(up, k, FALL) && ff[up]) || (same(up, k, REST) && fs[up] === 1); };
      // dar olukta kaynaktan beslenen dolu hücreler durgun su değil akıştır (şelalenin oluğu)
      let fed = 0; if (e - c < 2 && (solid(row + c - 1) || solid(row + e + 1))) for (let q = c; q <= e; q++) if (inl(q)) fed = 1;
      // yatay akış: giriş (üstten dökülen) ile çıkış (taşma kenarı) arası tam hızla akar; çıkıştan uzaklaştıkça durulur
      const oL = c > 0 && same(row + c - 1, k, FALL) && ff[row + c - 1], oR = e < COLS - 1 && same(row + e + 1, k, FALL) && ff[row + e + 1];
      for (let q = c; q <= e; q++) {
        const j = row + q; fs[j] = fed; fc[j] = same(j - COLS, k, FALL) ? 0.7 : 0; if (fed) continue;
        let v = 0;
        if (oR) { let near = false; for (let p = q; p >= c; p--) if (inl(p)) near = true; v += near ? 1 : Math.exp(-(e - q) / 3); }
        if (oL) { let near = false; for (let p = q; p <= e; p++) if (inl(p)) near = true; v -= near ? 1 : Math.exp(-(q - c) / 3); }
        if (!oL && !oR) for (let p = c; p <= e; p++) if (p !== q && inl(p)) v += Math.sign(q - p) * 0.6 * Math.exp(-Math.abs(q - p) / 2);
        hx[j] = clamp(v, -1, 1);
      }
      c = e;
    }
  }

  // ---- piksel tamponu: sıvının çevresi + bir hücre pay
  const cb0 = Math.max(0, c0 - 1), cb1 = Math.min(COLS - 1, c1 + 1), qb0 = Math.max(0, q0 - 1), qb1 = Math.min(ROWS - 1, q1 + 1);
  const BW = (cb1 - cb0 + 1) * TILE, BH = (qb1 - qb0 + 1) * TILE, n = BW * BH, bx = cb0 * TILE, by = qb0 * TILE;
  room(n); rgba.fill(0, 0, n * 4); glow.fill(0, 0, n * 4);
  const rect = (buf, x0, y0, x1, y1) => { x0 = Math.max(0, Math.round(x0)); x1 = Math.min(BW, Math.round(x1)); for (let y = Math.max(0, Math.round(y0)); y < Math.min(BH, Math.round(y1)); y++) buf.fill(1, y * BW + x0, y * BW + x1); };
  const key = (G.mapVersion | 0) + ':' + cb0 + ':' + cb1 + ':' + qb0 + ':' + qb1;
  if (key !== wallKey) {
    wallKey = key; wall.fill(0, 0, n);
    for (let r = qb0; r <= qb1; r++) for (let c = cb0; c <= cb1; c++) if (solid(r * COLS + c)) rect(wall, c * TILE - bx, r * TILE - by, c * TILE - bx + TILE, r * TILE - by + TILE);
    blur(wall, sumw, BW, BH);
  }
  const put = (wx, wy, cr, cg, cb, ca, ga = 0) => {
    const x = Math.round(wx) - bx, y = Math.round(wy) - by; if (x < 0 || y < 0 || x >= BW || y >= BH || wall[y * BW + x]) return;
    const o = (y * BW + x) * 4; rgba[o] = cr; rgba[o + 1] = cg; rgba[o + 2] = cb; rgba[o + 3] = ca;
    if (ga) { glow[o] = cr; glow[o + 1] = cg; glow[o + 2] = cb; glow[o + 3] = ga; }
  };
  const hits = [];
  for (let k = 0; k < 2; k++) {
    if (!(kinds >> k & 1)) continue;
    raw.fill(0, 0, n); strm.fill(0, 0, n);
    for (let r = q0; r <= q1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * COLS + c; if (!type[i] || kind[i] !== k) continue;
      const x = c * TILE - bx, y = r * TILE - by;
      if (type[i] === FALL) { rect(raw, x + sl[i], y + st[i], x + sr[i], y + TILE); rect(strm, x + sl[i], y + st[i], x + sr[i], y + TILE); continue; }
      const ab = i - COLS;
      if (same(ab, k, REST)) continue;
      // yüzey: komşu düğümle ortalanır; duvara düz dayanır; kuru zemine doğru incelir; taştığı kenarda alçalır. Altındaki sütun dibe kadar dolar
      const h = hc[i], bot = (r + 1) * TILE, edge = j => j >= 0 ? (ys[i] + ys[j]) / 2 : j === -1 ? ys[i] : j === -3 ? ys[i] + h * 0.25 : Math.max(ys[i], bot - Math.min(h, 2));
      const yl = edge(nl[i]), yr = edge(nr[i]), amp = Math.min(1, (y2[i] - ys[i]) / 6), lim = r * TILE, end = Math.min(BH, y2[i] - by);
      for (let px = 0; px < TILE; px++) {
        const f = (px + 0.5) / TILE, yy = Math.max(lim, Math.round((f < 0.5 ? yl + (ys[i] - yl) * f * 2 : ys[i] + (yr - ys[i]) * (f - 0.5) * 2) - wave(bx + x + px, t, k) * amp)) - by;
        for (let q = Math.max(0, yy); q < end; q++) raw[q * BW + x + px] = 1;
      }
      if (same(ab, k, FALL)) { rect(raw, x + sl[ab], y, x + sr[ab], y + TILE); rect(strm, x + sl[ab], y, x + sr[ab], ys[i] + 2 - by); if (!fs[i]) hits.push({ k, x: c * TILE + (sl[ab] + sr[ab]) / 2, y: ys[i], w: sr[ab] - sl[ab], s: hash2(c, r) }); }
    }
    blur(raw, sum, BW, BH);
    for (let p = 0; p < n; p++) mask[p] = !wall[p] && sum[p] > 0 && sum[p] * 2 >= WIN - sumw[p] ? 1 : 0;
    // hücre değerlerinin (akış oranı, yatay akış) pikselde yumuşak örneklenmesi: yalnız bu sıvının hücreleri ağırlık alır
    const cell = (arr, wx, wy) => {
      const gx = wx / TILE - 0.5, gy = wy / TILE - 0.5, cx = Math.floor(gx), cy = Math.floor(gy), fx = gx - cx, fy = gy - cy; let v = 0, w = 0;
      for (let q = 0; q < 4; q++) {
        const c = cx + (q & 1), r = cy + (q >> 1); if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
        const j = r * COLS + c; if (!type[j] || kind[j] !== k) continue;
        const ww = ((q & 1) ? fx : 1 - fx) * ((q >> 1) ? fy : 1 - fy); v += arr[j] * ww; w += ww;
      }
      return w > 0 ? v / w : 0;
    };
    // çevresinde akış / yatay akış / köpürme olan hücreler: yalnız oralarda örnekleme yapılır (durgun havuz pikselleri hızlı geçer)
    for (let r = qb0; r <= qb1; r++) for (let c = cb0; c <= cb1; c++) {
      let v = 0;
      for (let y = Math.max(0, r - 1); y <= Math.min(ROWS - 1, r + 1); y++) for (let x = Math.max(0, c - 1); x <= Math.min(COLS - 1, c + 1); x++) { const j = y * COLS + x; if (type[j] && kind[j] === k) v |= (fs[j] ? 1 : 0) | (hx[j] ? 2 : 0) | (fc[j] ? 4 : 0); }
      near[r * COLS + c] = v;
    }
    for (let x = 0; x < BW; x++) {
      let d = 0;
      for (let y = 0; y < BH; y++) {
        const p = y * BW + x; if (!mask[p]) { d = 0; continue; }
        d = y > 0 && mask[p - BW] ? d + 1 : y > 0 && wall[p - BW] ? 9 : 0;
        const wx = bx + x, wy = by + y, o = p * 4, nf = near[Math.floor(wy / TILE) * COLS + Math.floor(wx / TILE)], F = strm[p] ? 1 : nf & 1 ? cell(fs, wx + 0.5, wy + 0.5) : 0, B = BAYER[(wy & 3) * 4 + (wx & 3)];
        const Hv = F > 0.7 || !(nf & 2) ? 0 : cell(hx, wx + 0.5, wy + 0.5), dirH = Hv > 0.25 + B * 0.3 ? 1 : Hv < -0.25 - B * 0.3 ? -1 : 0;
        const eL = x > 0 && !mask[p - 1] && !wall[p - 1], eR = x < BW - 1 && !mask[p + 1] && !wall[p + 1];
        let cr, cg, cb, ca, ga = 0;
        if (F > 0.3 + B * 0.4) {
          // akış: sütun başına hızı ve boyu farklı şeritler aşağı kayar; gövde hep doludur
          const h1 = hash(wx), h2 = hash(wx + 61), sp = k ? 34 + 22 * h1 : 150 + 90 * h1, ln = 16 + 22 * h2, ph = (wy - t * sp) / ln + h1 * 9, id = Math.floor(ph), v = ph - id, hs = hash2(id, wx);
          const streak = h2 > 0.4 && v < 0.18 + hs * 0.42, head = streak && (v < 0.06 || hs > 0.82);
          if (k) {
            cr = 236; cg = 98; cb = 30; ca = 255; ga = 150;
            if (streak) { cr = 255; cg = head ? 226 : 176; cb = head ? 130 : 66; ga = 255; } else if (h1 < 0.24) { cr = 160; cg = 44; cb = 20; ga = 90; }
            if (eL || eR) { cr = 255; cg = 204; cb = 96; ga = 255; }
          } else {
            cr = 66; cg = 152; cb = 210; ca = 170; ga = 26;
            if (streak) { cr = head ? 236 : 170; cg = head ? 250 : 222; cb = head ? 255 : 245; ca = head ? 236 : 205; ga = head ? 70 : 40; } else if (h1 < 0.2) { cr = 34; cg = 104; cb = 172; ca = 176; }
            if ((eL || eR) && hash2(wx, Math.floor((wy - t * sp * 0.5) / 3)) < 0.82) { cr = 190; cg = 234; cb = 250; ca = 216; ga = 50; }
          }
        } else if (k) {
          // lav: sıcak yüzey, derinde koyu; yavaş kayan parlak damarlar ve kararmış kabuk parçaları
          const u = wx * 0.16 + Math.sin(wy * 0.11 + t * 0.7) * 1.6 - t * (0.5 + dirH * 1.5), v = wy * 0.17 + Math.sin(wx * 0.09 - t * 0.4);
          const heat = Math.sin(u) * Math.cos(v) + Math.sin(u * 1.9 + v * 0.7) * 0.35, dd = d + Math.sin(wx * 0.21 + t * 0.6) * 1.5;
          if (d === 0) { cr = 255; cg = Math.sin(wx * 0.22 - t * 2) > 0.5 ? 236 : 204; cb = cg > 220 ? 150 : 96; ga = 255; }
          else if (d === 1) { cr = 255; cg = 150; cb = 52; ga = 230; }
          else {
            if (dd < 6) { cr = 228; cg = 86; cb = 28; } else if (dd < 14) { cr = 190; cg = 54; cb = 20; } else if (dd < 26) { cr = 146; cg = 36; cb = 16; } else { cr = 104; cg = 24; cb = 13; }
            ga = dd < 6 ? 150 : dd < 14 ? 110 : 80;
            if (heat > 0.78) { cr = 255; cg = dd < 10 ? 176 : 128; cb = dd < 10 ? 64 : 38; ga = 255; }
            else if (heat > 0.62 && dd < 9) { cr = 255; cg = 128; cb = 38; ga = 220; }
            else if (heat < -0.66) { cr = 66; cg = 28; cb = 23; ga = 30; if (heat > -0.72) { cr = 122; cg = 50; cb = 34; } }
          }
          if ((eL || eR) && d > 0) { cr = 255; cg = 170; cb = 60; ga = 230; }
          ca = 255;
        } else {
          // su: yarı saydam, derinlikle koyulaşır; yüzeyde parlak çizgi, içinde kırılan ışık; akışın döküldüğü yerde köpürür
          const dd = d + Math.sin(wx * 0.21 + t * 0.9) * 1.5;
          if (d === 0) { const sk = Math.sin(wx * 0.4 - t * (dirH ? dirH * 9 : 2.1)) > 0.72; cr = sk ? 228 : 176; cg = sk ? 250 : 232; cb = sk ? 255 : 246; ca = sk ? 245 : 232; ga = sk ? 60 : 34; }
          else if (d === 1) { cr = 110; cg = 196; cb = 232; ca = 190; }
          else {
            if (dd < 7) { cr = 58; cg = 150; cb = 206; ca = 150; } else if (dd < 16) { cr = 40; cg = 116; cb = 180; ca = 165; } else if (dd < 30) { cr = 27; cg = 84; cb = 142; ca = 178; } else { cr = 18; cg = 58; cb = 106; ca = 190; }
            // kırılan ışık: derinlikte kayan kısa yatay çizgiler
            const row = wy >> 2; if ((wy & 3) === 1 && Math.sin(wx * 0.35 + row * 2.3 + t * (1.1 + (row & 1) * 0.6)) > 0.86) { cr += 44; cg += 52; cb += 30; ca += 12; }
            if (dirH) {
              // yatay akış: satır başına hızı farklı kısa şeritler akış yönünde kayar
              const h1 = hash(wy * 1.3 + 17), h2 = hash(wy + 91), ph = (wx * dirH - t * (60 + 50 * h1)) / (14 + 20 * h2) + h1 * 9, id = Math.floor(ph), v = ph - id, hs = hash2(id, wy);
              cr = dd < 10 ? 60 : 44; cg = dd < 10 ? 146 : 122; cb = dd < 10 ? 206 : 188; ca = 170;
              if (h2 > 0.4 && v < 0.2 + hs * 0.4) { const hd = v < 0.06 || hs > 0.85; cr = hd ? 214 : 150; cg = hd ? 244 : 214; cb = hd ? 255 : 242; ca = hd ? 226 : 200; }
            }
            const A = nf & 4 ? cell(fc, wx + 0.5, wy + 0.5) : 0;
            if (A > 0.04 && hash2(wx >> 1, Math.floor((wy + t * 26) / 2)) > 0.86 - A * 0.5) { cr = 168; cg = 222; cb = 244; ca = 205; }
          }
        }
        rgba[o] = cr; rgba[o + 1] = cg; rgba[o + 2] = cb; rgba[o + 3] = ca;
        // ışık katmanı ana katmanın üstüne eklenir: lav karanlıkta parlar ama aydınlıkta patlamaz
        if (ga) { glow[o] = cr; glow[o + 1] = cg; glow[o + 2] = cb; glow[o + 3] = k ? ga * 0.4 : ga; }
      }
    }
    // lav kabarcıkları ve yükselen korlar; su havuzunda yükselen kabarcıklar
    for (let r = q0; r <= q1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * COLS + c; if (type[i] !== REST || kind[i] !== k || same(i - COLS, k, REST) || solid(i - COLS)) continue;
      const s = hash2(c, r + 7), h = hc[i], x = c * TILE + 3 + s * 9, y = ys[i] - wave(x, t, k) * Math.min(1, h / 6);
      if (fs[i] || fc[i] > 0) continue;
      if (k && h > 5) {
        const age = (t * 0.55 + s * 3) % 3;
        if (age < 0.65) {
          const z = Math.round(Math.sin(age / 0.65 * Math.PI) * 3);
          for (let q = -z; q <= z; q++) { put(x + q, y - z * 0.6 - 1, 255, q === -z ? 240 : 196, q === -z ? 176 : 80, 255, 255); put(x + q, y - z * 0.6, 150, 44, 18, 255, 60); if (z > 1) put(x + q, y - z * 0.6 + 1, 196, 60, 22, 255, 110); }
        } else if (age < 1) { const a = (age - 0.65) / 0.35; for (let q = 0; q < 3; q++) put(x + (q - 1) * a * 8, y - Math.sin(a * Math.PI) * (4 + q), 255, q === 1 ? 224 : 140, q === 1 ? 128 : 40, 255, 255); }
        const em = (t * 0.35 + s) % 1, al = Math.sin(em * Math.PI) * 200;
        put(x + Math.sin(t + c) * em * 5, y - em * 15, 255, 207, 112, al, al);
      } else if (!k && h > 7 && s > 0.6) {
        const age = (t * 0.4 + s) % 1; if (age < 0.7) { const yy = (r + 1) * TILE - age * h; put(c * TILE + 4 + s * 7, yy, 154, 230, 245, 110); put(c * TILE + 5 + s * 7, yy, 154, 230, 245, 110); }
      }
    }
  }
  // akışın çarptığı yer: köpük şapkası, sıçrayan damlalar, yüzeyde yayılan halka, yükselen serpinti
  for (const h of hits) {
    const k = h.k, half = h.w / 2, rate = k ? 0.9 : 2.1;
    for (let x = -half - 2; x <= half + 2; x++) { const j = hash2(Math.round(h.x + x), Math.floor(t * (k ? 6 : 14))); k ? put(h.x + x, h.y - (j > 0.6 ? 1 : 0), 255, 226, 130, 255, 255) : put(h.x + x, h.y - (j > 0.5 ? 1 : 0), 240, 252, 255, 236, 60); if (!k) put(h.x + x, h.y + 1, 190, 234, 250, 215); }
    for (let q = 0; q < 8; q++) {
      const age = fr(t * rate + q / 8 + h.s), sg = q % 2 ? 1 : -1, x = h.x + sg * (half + 1 + age * ((k ? 6 : 10) + (q % 3) * 3)), y = h.y - Math.sin(age * Math.PI) * (4 + (q % 3) * 2.5);
      k ? put(x, y, 255, age < 0.5 ? 214 : 150, age < 0.5 ? 110 : 50, 255, 255) : put(x, y, 226, 246, 255, 235 - age * 120, 40);
    }
    const ring = fr(t * 1.4 + h.s), al = (1 - ring) * 220;
    for (const sg of [-1, 1]) for (let q = 0; q < 3; q++) k ? put(h.x + sg * (half + 3 + ring * 12 + q), h.y, 255, 190, 80, 255, al) : put(h.x + sg * (half + 3 + ring * 12 + q), h.y, 200, 240, 252, al);
    if (!k) for (let q = 0; q < 5; q++) { const age = fr(t * 0.5 + q / 5 + h.s); put(h.x + (hash(q + h.s * 31) - 0.5) * (h.w + 8) + Math.sin(age * 4 + q) * 3, h.y - 3 - age * 14, 220, 240, 250, 70 * (1 - age)); }
  }
  return { x: bx, y: by, w: BW, h: BH, rgba, glow, lava: !!(kinds & 2) };
}
