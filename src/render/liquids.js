// Liquid rendering is independent of the simulation: continuous world-space flow, depth and surface effects.
import { COLS, ROWS, TILE } from '../config.js';
import { TD, T } from '../data/tiles.js';
import { G } from '../game/state.js';
import { on } from '../core/events.js';
import { hash2, clamp } from '../core/util.js';

const steam = [];
on('steam', d => { if (steam.length < 40) steam.push({ x: d.x, y: d.y, t0: G.time }); });
const FADE = 0.65;
let seenOf, seen, seenK, levels, lastT = 0, flow, flow2;
let X;
const rect = (col, x, y, w = 1, h = 1) => { if (h <= 0 || w <= 0) return; X.fillStyle = col; X.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };
const solid = i => i < 0 || i >= G.map.length || !TD[G.map[i]] || TD[G.map[i]].solid;
const liquid = (i, k) => i >= 0 && i < G.lq.length && G.lq[i] > 0 && G.lk[i] === k && !solid(i);
const water = ['rgba(52,140,192,0.5)', 'rgba(36,106,162,0.56)', 'rgba(26,78,130,0.62)', 'rgba(18,56,100,0.68)'];
const lava = ['#da4a19', '#b83213', '#8c220f', '#65170d'];
const wave = (x, t, k) => k ? Math.sin(x * 0.095 - t * 1.2) * 0.65 + Math.sin(x * 0.24 + t * 0.8) * 0.3 : Math.sin(x * 0.075 - t * 2.1) * 1.05 + Math.sin(x * 0.19 + t * 3.3) * 0.45;

// Düşen akış: dar, yarı saydam gövde; düzensiz uzunlukta köpük/kor çizgileri; yalnız dış kenarlarda parlak hat ve serpinti.
function fall(k, c, r, strength, t, joinL = false, joinR = false, yy0 = 0) {
  const y0 = r * TILE, width = Math.round((k ? 8 : 7) * (0.45 + strength * 0.55));
  const speed = k ? 34 : 118;
  for (let yy = yy0; yy < TILE; yy++) {
    const y = y0 + yy, bend = Math.sin(y * 0.07 - t * (k ? 1.1 : 2.6)) * (k ? 0.5 : 0.9);
    // yan yana akan sütunlar tek geniş perde olur: birleşen kenar hücre sınırına kadar dolar
    const x = joinL ? c * TILE : Math.round(c * TILE + 8 + bend - width / 2), xe = joinR ? c * TILE + TILE : (joinL ? c * TILE + 8 + bend + width / 2 : x + width), w = Math.max(3, Math.round(xe - x));
    rect(k ? 'rgba(232,84,28,0.92)' : 'rgba(58,146,200,0.58)', x, y, w, 1);
    rect(k ? 'rgba(178,48,22,0.9)' : 'rgba(22,90,152,0.42)', x + 2, y, w - 4, 1);
    if (!joinL) rect(k ? '#ffb040' : 'rgba(190,236,248,0.55)', x, y, 1, 1);
    if (!joinR) rect(k ? '#ff8a2c' : 'rgba(120,200,235,0.5)', x + w - 1, y, 1, 1);
    // hızları ve boyları farklı şeritler: ritmik kesik çizgi yerine rastgele köpük
    for (let lane = 0; lane < 3; lane++) {
      const seg = 13 + lane * 6, ph = y - t * speed * (0.8 + lane * 0.14) + hash2(lane, c, 3) * 97;
      const idx = Math.floor(ph / seg), h = hash2(idx, lane * 7 + c, 5), inside = ph - idx * seg;
      if (h > 0.35 && inside < 2 + h * 6) {
        const bright = h > 0.8;
        rect(k ? (bright ? '#ffe89a' : '#ffb347') : (bright ? 'rgba(232,250,255,0.9)' : 'rgba(170,225,245,0.6)'), x + 1 + Math.floor(lane * (w - 2) / 3) + (h > 0.6 ? 1 : 0), y, 1, 1);
      }
    }
    // dış serpinti
    const sp = hash2(Math.floor(y - t * speed * 0.9), c, 9);
    if (!joinL && sp > 0.9) rect(k ? 'rgba(255,150,60,0.6)' : 'rgba(200,240,255,0.35)', x - 1 - Math.floor((sp - 0.9) * 20), y, 1, 1);
    if (!joinR && sp < 0.1) rect(k ? 'rgba(255,150,60,0.6)' : 'rgba(200,240,255,0.35)', x + w + Math.floor(sp * 20), y, 1, 1);
    if (k && sp > 0.5 && sp < 0.53) rect('#5a1a10', x + 2 + Math.floor((sp - 0.5) * 100) % Math.max(1, w - 4), y, 1, 1);
  }
}

function texture(k, x, y, top, bottom, depth, t) {
  if (k) {
    // Sıcak kanallar yavaş akar; üstte düzensiz, kararmış kabuk parçaları yüzer.
    for (let yy = Math.ceil(top + 2); yy < bottom; yy += 2) for (let xx = x; xx < x + TILE; xx += 2) {
      const u = xx * 0.16 + Math.sin(yy * 0.11 + t * 0.7) * 1.6 - t * 0.5, v = yy * 0.17 + Math.sin(xx * 0.09 - t * 0.4);
      const heat = Math.sin(u) * Math.cos(v) + Math.sin(u * 1.9 + v * 0.7) * 0.35;
      if (heat > 0.78) rect(depth < 2 ? '#ffa93a' : '#e0601f', xx, yy, 2, 1);
      else if (heat > 0.62 && depth < 1) rect('#ff7d24', xx, yy, 1, 1);
      if (heat < -0.66 && hash2(xx, yy, 6) > 0.35) { const w = 2 + Math.floor(hash2(xx, yy, 7) * 3); rect('#3f1c17', xx, yy, w, 1); rect('#7a3222', xx + w - 1, yy, 1, 1); }
    }
  } else {
    // Kırılan ışık: dünya koordinatlı, kareler arası dikişsiz; derinde sönük yatay ışık bantları
    for (let yy = Math.ceil(top + 2); yy < bottom; yy += 2) for (let xx = x; xx < x + TILE; xx += 2) {
      const a = Math.sin(xx * 0.15 + yy * 0.2 + t * 1.0), b = Math.sin(xx * 0.11 - yy * 0.17 - t * 0.7);
      if (a + b > 1.55) rect(depth < 2 ? 'rgba(150,230,240,0.26)' : 'rgba(80,165,210,0.16)', xx, yy, 2, 1);
      else if (a + b < -1.6 && depth > 0) rect('rgba(8,30,60,0.22)', xx, yy, 2, 1);
    }
    if (depth > 0) for (let yy = Math.ceil(top); yy < bottom; yy++) { const g = Math.sin(yy * 0.9 + x * 0.05 - t * 0.35); if (g > 0.93) rect('rgba(110,200,235,0.1)', x, yy, TILE, 1); }
  }
}

function surface(k, c, r, height, hl, hr, t) {
  const x = c * TILE, y = r * TILE, pal = k ? lava : water;
  for (let px = 0; px < TILE; px++) {
    const f = (px + 0.5) / TILE, h0 = f < 0.5 ? hl + (height - hl) * f * 2 : height + (hr - height) * (f - 0.5) * 2;
    const h = clamp(Math.round(h0 + wave(x + px, t, k) * Math.min(1, h0 / 5)), 1, TILE);
    const top = y + TILE - h;
    rect(pal[0], x + px, top, 1, h);
    if (h > 7) rect(pal[1], x + px, Math.max(top + 4, y + 12), 1, Math.min(4, h - 4));
    rect(k ? '#ffb942' : 'rgba(151,223,237,0.9)', x + px, top, 1, 1);
    if (k && (Math.sin((x + px) * 0.22 - t * 2) > 0.5)) rect('#ffe991', x + px, top, 1, 1);
    if (!k && Math.sin((x + px) * 0.17 - t * 2.1) > 0.72) rect('#defbff', x + px, top, 1, 1);
  }
  const tp = y + TILE - height;
  X.save(); X.beginPath();
  for (let px = 0; px < TILE; px++) { const f = (px + 0.5) / TILE, h0 = f < 0.5 ? hl + (height - hl) * f * 2 : height + (hr - height) * (f - 0.5) * 2; const h = clamp(Math.round(h0 + wave(x + px, t, k) * Math.min(1, h0 / 5)), 1, TILE); X.rect(x + px, y + TILE - h + 1, 1, h - 1); }
  X.clip(); texture(k, x, y, tp, y + TILE, 0, t); X.restore();
  if (k) {
    const seed = hash2(c, r, 12), age = ((t * 0.55 + seed * 3) % 3);
    const bx = x + 3 + seed * 9, by = tp + wave(bx, t, 1);
    if (age < 0.65 && height > 4) {
      const size = Math.sin(age / 0.65 * Math.PI) * 3;
      rect('#73200d', bx - size, by - size * 0.6, size * 2 + 1, 2);
      rect('#ffc350', bx - size, by - size * 0.6 - 1, size * 2 + 1, 1);
      rect('#fff1b0', bx - size, by - size * 0.6 - 1, 1, 1);
    } else if (age < 1 && height > 4) {
      const a = (age - 0.65) / 0.35;
      for (let n = 0; n < 3; n++) rect(n === 1 ? '#ffe080' : '#ff8c27', bx + (n - 1) * a * 8, by - Math.sin(a * Math.PI) * (4 + n), 1, 1);
    }
    const ember = ((t * 0.35 + seed) % 1);
    X.globalAlpha = Math.sin(ember * Math.PI) * 0.6;
    rect('#ffcf70', bx + Math.sin(t + c) * ember * 5, by - ember * 15, 1, 1); X.globalAlpha = 1;
  } else {
    const s = hash2(c, r, 8), age = ((t * 0.4 + s) % 1);
    if (age < 0.65 && height > 7 && s > 0.65) {
      const by = y + TILE - age * height;
      rect('rgba(154,230,245,0.4)', x + 4 + s * 7, by, 2, 1);
      rect('rgba(154,230,245,0.4)', x + 4 + s * 7, by + 1, 1, 1);
    }
  }
}

function splash(k, x, top, t, seed) {
  for (let n = 0; n < 7; n++) {
    const age = ((t * (k ? 1.1 : 2.2) + n / 7 + seed) % 1);
    const sign = n % 2 ? 1 : -1, spread = 2 + age * (k ? 8 : 12);
    rect(k ? '#ffba46' : '#e2faff', x + sign * spread, top - Math.sin(age * Math.PI) * (3 + n % 3 * 2), 1, age < 0.4 ? 2 : 1);
    if (age > 0.55) rect(k ? '#ff9130' : 'rgba(177,233,244,0.65)', x + sign * spread, top + 1, 2, 1);
  }
  rect(k ? '#ffd565' : 'rgba(233,253,255,0.88)', x - 4, top - 1, 9, 2);
  const ring = (t * 1.5 + seed) % 1;
  X.globalAlpha = 1 - ring;
  rect(k ? '#ffb23d' : '#bceefa', x - 4 - ring * 11, top + 1, 3, 1);
  rect(k ? '#ffb23d' : '#bceefa', x + 3 + ring * 11, top + 1, 3, 1); X.globalAlpha = 1;
}

export function drawLiquids(ctx, r0, r1) {
  if (!G.lq) return;
  X = ctx; r0 = Math.max(0, r0); r1 = Math.min(ROWS - 1, r1);
  const t = G.time, lq = G.lq, lk = G.lk;
  if (seenOf !== lq) { seenOf = lq; seen = new Float32Array(lq.length).fill(-99); seenK = new Uint8Array(lq.length); levels = new Float32Array(lq.length); flow = new Uint8Array(lq.length); flow2 = new Uint8Array(lq.length); lastT = t; steam.length = 0; }
  const ease = 1 - Math.exp(-Math.min(0.1, Math.max(0, t - lastT)) * 9); lastT = t;
  for (let r = Math.max(0, r0 - 1); r <= Math.min(ROWS - 1, r1 + 1); r++) for (let c = 0; c < COLS; c++) { const i = r * COLS + c; levels[i] = lq[i] ? levels[i] ? levels[i] + (lq[i] - levels[i]) * ease : lq[i] : 0; }
  // Sınıflandırma (aşağıdan yukarıya): altı katı ya da dolu gövdeyse gövde/yüzey, yoksa akış.
  // Havada asılı kalan hücreler ve havuz kenarından taşan su akış olarak çizilir; havuz tek gövde + tek yüzeydir.
  const rb = Math.min(ROWS - 1, r1 + 12), rt = Math.max(0, r0 - 8);
  // Kaynaktan beslenen dar oluk (1-2 hücre geniş, iki yanı kaya): hücreler dolu olsa da bu bir şelaledir, durgun havuz değil.
  const fed = flow2;
  for (let c = 0; c < COLS; c++) for (let r = rb; r >= rt; r--) {
    const i = r * COLS + c, bI = i + COLS;
    if (!lq[i] || solid(i)) { flow[i] = 0; continue; }
    const rest = solid(bI) || (flow[bI] === 1 && lk[bI] === lk[i]);
    flow[i] = rest ? (lq[i] >= 8 ? 1 : 2) : 3;   // 1 gövde, 2 yüzey, 3 akış
  }
  for (let r = rt; r <= rb; r++) {
    let c = 0;
    while (c < COLS) {
      const i = r * COLS + c;
      if (!flow[i]) { fed[i] = 0; c++; continue; }
      const k = lk[i]; let e = c; while (e + 1 < COLS && flow[r * COLS + e + 1] && lk[r * COLS + e + 1] === k) e++;
      const narrow = e - c + 1 <= 2 && (solid(i - 1) || solid(r * COLS + e + 1));   // dar oluk: en az bir yanı kaya (öteki yan anlık boş olabilir)
      let f = 0;
      for (let q = c; q <= e; q++) { const j = r * COLS + q, up = j - COLS, tu = G.map[up]; if (tu === T.SPRING || tu === T.LAVAVENT || (fed[up] && lq[up] && lk[up] === k)) f = 1; }
      // dar dikey boşlukta 2+ hücre yüksek duran su da akış gibi çizilir (dar kuyuda blok görünmez)
      if (!f && narrow) for (let q = c; q <= e; q++) { const j = r * COLS + q, up = j - COLS, dn = j + COLS; if ((lq[up] && lk[up] === k && !solid(up)) || (lq[dn] && lk[dn] === k && !solid(dn) && lq[dn] >= 8)) f = 1; }
      for (let q = c; q <= e; q++) { const j = r * COLS + q; fed[j] = narrow && f ? 1 : 0; if (fed[j] && flow[j] !== 3) flow[j] = 3; }
      c = e + 1;
    }
  }
  const isTop = i => flow[i] === 2 || (flow[i] === 1 && flow[i - COLS] !== 1);
  const hOf = i => flow[i] === 1 ? TILE : levels[i] * 2;
  for (let c = 0; c < COLS; c++) {
    let depth = 0;
    for (let r = rt; r <= r1; r++) {
      const i = r * COLS + c, k = lk[i], x = c * TILE, y = r * TILE, kind = flow[i];
      if (!kind) {
        depth = 0; const strength = 1 - (t - seen[i]) / FADE;
        if (r >= r0 && !solid(i) && strength > 0) fall(seenK[i], c, r, strength * 0.8, t);
        continue;
      }
      if (kind === 3) {
        depth = 0; seen[i] = t; seenK[i] = k;
        if (r < r0) continue;
        const fromAbove = (lq[i - COLS] && lk[i - COLS] === k && !solid(i - COLS)) || seen[i - COLS] > t - FADE || G.map[i - COLS] === T.SPRING || G.map[i - COLS] === T.LAVAVENT;
        if (solid(i + COLS)) {
          // basamak: düşen su yere çarpar, sığ bir tabaka olarak yana akar ve kenardan devam eder
          if (fromAbove) fall(k, c, r, 0.7, t, false, false, 0);
          const sh = 5 + Math.sin(t * 3 + c) * 0.5;
          surface(k, c, r, sh, sh, sh, t); splash(k, x + 8, y + TILE - sh, t, c);
          continue;
        }
        // yandan beslenen akış: basamak seviyesinden aşağı başlar, hücre tepesinden değil
        fall(k, c, r, 0.55 + 0.45 * Math.min(1, lq[i] / 4), t, flow[i - 1] === 3 && lk[i - 1] === k, flow[i + 1] === 3 && lk[i + 1] === k, fromAbove ? 0 : 10);
        continue;
      }
      seen[i] = -99;
      const top = isTop(i); depth = top ? 0 : depth + 1;
      const impact = seen[i - COLS] > t - 0.3 && seenK[i - COLS] === k;
      if (r < r0) continue;
      if (!top) {
        // gövde: düz kutu değil, derinlikle koyulaşan yarı saydam katmanlar; kaya dokusu hafif görünür
        const pal = k ? lava : water, d = Math.min(3, depth);
        rect(pal[d], x, y, TILE, TILE);
        if (d < 3) { rect(pal[d + 1], x, y + 8, TILE, 8); if (!k) rect('rgba(8,28,58,0.18)', x, y + 13, TILE, 3); }
        if (!k && depth === 1) rect('rgba(120,200,235,0.08)', x, y, TILE, 2);
        texture(k, x, y, y, y + TILE, depth, t);
        continue;
      }
      // yüzey: komşu yüzeylerle yumuşatılır; akışın düştüğü yerde yüzey çizgisi komşulara uyar
      let height = hOf(i);
      const nb = j => flow[j] && lk[j] === k && isTop(j);
      if (impact) { const sides = [i - 1, i + 1].filter(nb); if (sides.length) height = Math.min(height, sides.reduce((sum, j) => sum + hOf(j), 0) / sides.length + 1); }
      const side = j => nb(j) ? (height + hOf(j)) / 2 : flow[j] === 1 && lk[j] === k ? TILE : height;
      if (impact) fall(k, c, r, 0.8, t);
      surface(k, c, r, height, side(i - 1), side(i + 1), t);
      if (impact) splash(k, x + 8, y + TILE - height, t, hash2(c, r, 4));
    }
  }
  for (let n = steam.length - 1; n >= 0; n--) {
    const s = steam[n], age = t - s.t0;
    if (age > 1.6 || age < 0) { steam.splice(n, 1); continue; }
    for (let q = 0; q < 5; q++) {
      X.globalAlpha = (1 - age / 1.6) * (0.32 - q * 0.035);
      const size = 2 + age * 3, xx = s.x + Math.sin(age * 2 + q * 1.4) * age * 7, yy = s.y - age * 25 - q * 3;
      rect('#dee5eb', xx - size / 2, yy, size, 2); rect('#eef1f4', xx - size / 2 + 1, yy - 1, Math.max(1, size - 2), 1);
    }
  }
  X.globalAlpha = 1;
}

export function drawLiquidGlow(ctx, r0, r1, glow) {
  if (!G.lq) return;
  X = ctx;
  for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c, k = G.lk[i]; if (!liquid(i, k) || !flow) continue;
    // akış karanlıkta hafif görünür: su soluk mavi, lav kor
    if (flow[i] === 3) { glow(c * TILE + 8, r * TILE + 8, k ? 'rgba(255,113,25,0.35)' : 'rgba(120,200,240,0.16)', k ? 16 : 12, k ? 0.8 : 0.35); continue; }
    if (flow[i - COLS] && flow[i - COLS] !== 3) continue;
    const height = (levels && seenOf === G.lq ? levels[i] : G.lq[i]) * 2, x = c * TILE, y = r * TILE + TILE - height;
    if (k) {
      const pulse = 0.65 + Math.sin(G.time * 1.7 + c * 0.8) * 0.13;
      glow(x + 8, y + 3, 'rgba(255,113,25,0.5)', 21, pulse);
      for (let px = 0; px < TILE; px += 2) rect('#ffc766', x + px, y + wave(x + px, G.time, 1), 2, 1);
    }
  }
}
export function liquidLights(r0, r1, out) {
  if (!G.lq) return;
  for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (liquid(i, 1) && !liquid(i - COLS, 1) && (c + r) % 2 === 0) out.push({ x: c * TILE + 8, y: r * TILE + TILE - G.lq[i] * 2 + 4, s: 2.4 + Math.sin(G.time * 1.7 + c * 0.8) * 0.15 });
  }
}

export const _liqDebug = () => ({ flow, seen, levels });
