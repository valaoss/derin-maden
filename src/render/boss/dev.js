// Uyuyan Dev (Kalbin Yankısı): madenin dibinde uyuyan kambur taş titan. Yosunlu, çatlak plakalı yeşil-gri kaya gövde,
// omuzların arasına gömülü küçük baş ve iki kor yarık göz; yere değen kaya yumruklu uzun kollar, kısa kalın bacaklar.
// Kızıl nabız damarları gövdeyi sarıp göğüse akar; göğüs plakaları açılınca altında atan kalp kristali görünür.
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mad, norm, at, turn, frame, bone, ball, ell, tube, skin, spike, prism, quad, meleeK, viewOf, hash } from './rig.js';
import { biped, stride } from './biped.js';

const M = { ROCK: 1, ARM: 2, FIST: 3, HEAD: 4, PLATE: 5, MOSS: 6, LICHEN: 7, VEIN: 8, HEART: 9, EYE: 10, MAW: 11, HOLE: 12, SHARD: 13, RUBBLE: 14, IRON: 15 };
const S = { hip: 17, spine: 23, neck: 6, headX: 7.5, shW: 15.5, shY: -1.5, hipW: 8, arm: [15, 12.5], leg: [10, 9], ankle: 2.6 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb);
const fr = x => x - Math.floor(x), cell = (a, b) => fr(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
let heat = 0.4, now = 0, beat = 0, flow = 3, plate = 0;
// kaya plakaları (hücre deseni): en yakın çatlağa uzaklık; plate o plakanın tonu
function plates(u, v, sx, sy) {
  const x = u * sx, y = v * sy, ix = Math.floor(x), iy = Math.floor(y); let d1 = 9, d2 = 9, ax = 0, ay = 0, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wy = ((cy % sy) + sy) % sy, h = cell(cx, wy), px = cx + 0.15 + 0.7 * h, py = cy + 0.15 + 0.7 * cell(wy + 31, cx + 17), d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < d1) { d2 = d1; bx = ax; by = ay; d1 = d; ax = px; ay = py; plate = h; } else if (d < d2) { d2 = d; bx = px; by = py; }
  }
  return (d2 - d1) / (2 * Math.hypot(bx - ax, by - ay) + 1e-6);
}
// damar: nabız kalbe doğru akar (k: kalbe uzaklık); sönünce kara yarık
const vein = (k, i, out) => { if (heat < 0.06) return i - 0.5; out.id = M.VEIN; return 0.12 + heat * (0.42 + 0.3 * Math.sin(now * flow + k * 0.45)) + beat * 0.25 * heat; };
const crack = (d, w, i) => d < w ? i - 0.42 : i + (plate - 0.5) * 0.2;
// gövde: damarlar önde (v = 0.25) sıklaşır, göğse (u ~ 27) toplanır
const core = (u, v, i, out) => {
  const f = Math.max(0, Math.sin(v * TAU)), dv = plates(u + 40, v, 0.11, 5);
  if (dv < 0.008 + 0.04 * f * f * f) return vein(Math.abs(u - 27) + (1 - f) * 16, i, out);
  return crack(plates(u, v, 0.2, 13), 0.05, i);
};
// uzuvlar: tek damar boyuna kıvrılarak uzanır
const limb = sy => (u, v, i, out) => {
  const q = fr(v + Math.sin(u * 0.42) * 0.05 + Math.sin(u * 1.3) * 0.015);
  if (Math.abs(q - 0.3) < 0.026) return vein(u, i, out);
  return crack(plates(u, v, 0.24, sy), 0.055, i);
};
const MATS = [];
MATS[M.ROCK] = { ramp: ramp('#0a0e0c', '#18201b', '#28332b', '#3c4a3f', '#566557'), px: core };
MATS[M.ARM] = { ramp: ramp('#0c100d', '#1c251f', '#2e3a31', '#445448', '#617263'), px: limb(7) };
MATS[M.FIST] = { ramp: ramp('#0e110e', '#232a24', '#39443a', '#556355', '#7a8a78'), px: (u, v, i) => crack(plates(u, v, 0.5, 6), 0.06, i) };
MATS[M.HEAD] = { ramp: ramp('#0c100d', '#20291f', '#36433a', '#526253', '#748676'), px: (u, v, i) => crack(plates(u, v, 0.6, 5), 0.05, i) };
MATS[M.PLATE] = { ramp: ramp('#141814', '#2e362f', '#4a564b', '#6c7a6c', '#98a694'), px: (u, v, i) => crack(plates(u, v, 0.35, 3), 0.05, i) };
MATS[M.MOSS] = { ramp: ramp('#0a1208', '#16220e', '#243614', '#34501c', '#4c6a26'), px: (u, v, i) => i + (cell(Math.floor(u * 3), Math.floor(v * 9)) - 0.5) * 0.3 };
MATS[M.LICHEN] = { ramp: ramp('#3a3a1c', '#6a6a2c', '#9a9a44', '#c4c46a', '#e4e49a'), flat: true };
MATS[M.VEIN] = { ramp: ramp('#3a0612', '#801028', '#c02040', '#ff5a6a', '#ffd0d0'), flat: true, glow: 1 };
MATS[M.HEART] = { ramp: ramp('#600a1e', '#c02040', '#ff5a6a', '#ff9ca6', '#ffe4e6'), glow: 1, px: (u, v, i) => 0.36 + i * 0.4 + beat * 0.3 };
MATS[M.EYE] = { ramp: ramp('#5a1008', '#a82a10', '#ff6a2a', '#ffb060', '#fff0c0'), flat: true, glow: 1 };
MATS[M.MAW] = { ramp: ramp('#1a0408', '#3a0a12', '#80162a', '#d02c44', '#ff7a88'), flat: true, glow: 0.6, px: () => 0.2 + heat * 0.45 };
MATS[M.HOLE] = { ramp: ramp('#060304', '#100608', '#200a10', '#3a1018', '#5a1824'), flat: true, px: () => 0.15 + heat * 0.35 };
MATS[M.SHARD] = { ramp: ramp('#5a0c22', '#a01c3a', '#e04460', '#ff8a9c', '#ffd8e0'), glow: 0.5 };
MATS[M.IRON] = { ramp: ramp('#100c0a', '#2a1c14', '#4a3020', '#6e4a2c', '#9a6a3c') };
MATS[M.RUBBLE] = { ramp: ramp('#100e0c', '#2a2620', '#463f34', '#6a604e', '#948670') };

// kutu: çerçevede [x0..x1] x [y0..y1] x [z0..z1]
function box(g, F, x0, x1, y0, y1, z0, z1, m) {
  const c = at(F, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), p = (x, y, z) => at(F, x, y, z);
  quad(g, p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1), m, c); quad(g, p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1), m, c);
  quad(g, p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1), m, c); quad(g, p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), m, c);
  quad(g, p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), m, c); quad(g, p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), m, c);
}
// yosun yaması: yüzeye yaslanan basık elipsoit, üstünde liken benekleri
function moss(g, c, n, r, i) {
  const up = norm(n), F = frame(c, norm([up[1], -up[0], 0.0001]), up, [0, 0, 1]);
  ell(g, frame(c, F.f, up, norm([F.f[1] * up[2] - F.f[2] * up[1], F.f[2] * up[0] - F.f[0] * up[2], F.f[0] * up[1] - F.f[1] * up[0]])), r, r * 0.2, r * 0.9, M.MOSS, 6, 3);
  for (let k = 0; k < 3; k++) dot(g, mad(mad(c, up, r * 0.3), [hash(i + k) - 0.5, 0, hash(i + k + 5) - 0.5], r * 1.1), M.LICHEN, 1 + (k % 3));
}

// yumruk yere gömülmesin: dirsek bükülerek kaldırılır (kazarken biraz gömülebilir)
function reachGround(P) {
  const Q = { ...P }, floor = 0.6 - 2.6 * P.dig; let K = biped(Q, S);
  for (const [key, side] of [['armR', 'R'], ['armL', 'L']]) for (let i = 0; i < 6; i++) {
    const lo = at(K[side].hand, 4.4, 0.4, 0)[1] - 6.6; if (lo >= floor) break;
    Q[key] = { ...Q[key], el: Math.min(2.6, Q[key].el + clamp((floor - lo) * 0.05, 0.03, 0.45)) }; K = biped(Q, S);
  }
  return K;
}

function build(g, P, o) {
  heat = P.heat; now = o.t; beat = P.beat; flow = P.flow;
  const K = reachGround(P), A = {}, { pel, waist, chest, head } = K, t = o.t, br = 1 + P.br, near = P.near;
  // gövde: dar kalça, fıçı göğüs, dev omuz kütlesi ve sırtta kambur
  skin(g, [
    { p: at(pel, -0.5, -4, 0), u: pel.f, rx: 6.5, ry: 5.5 }, { p: at(pel, 0, 0, 0), u: pel.f, rx: 9.6, ry: 7.6 }, { p: waist.p, u: waist.f, rx: 10.4, ry: 8.4 },
    { p: at(chest, 0.6, -7, 0), u: chest.f, rx: 13.4 * br, ry: 10.4 * br }, { p: at(chest, 0, -1, 0), u: chest.f, rx: 16.4, ry: 11.4 * br },
    { p: at(chest, -2.8, 4.4, 0), u: chest.f, rx: 13, ry: 9.4 }, { p: at(chest, -0.8, 8.4, 0), u: chest.f, rx: 7.6, ry: 6.4 }, { p: at(chest, 1.6, 9.8, 0), u: chest.f, rx: 3.6, ry: 3.4 },
  ], 12, M.ROCK, { sub: 2 });
  // sırt kamburu: yosun örtüsü, kaya dikenleri ve kalbin büyüttüğü kızıl kristaller
  moss(g, at(chest, -4.2, 9.4, 0), chest.u, 8.4, 1); moss(g, at(chest, -9, 4.2, 4), mad(chest.u, chest.f, -0.8), 5, 7); moss(g, at(pel, -7.6, 2, -3), mad(pel.u, pel.f, -1.4), 4.4, 13);
  for (let i = 0; i < 4; i++) { const z = (i - 1.5) * 4.4, b = at(chest, -7.6 + Math.abs(z) * 0.3, 5.6 - Math.abs(z) * 0.4, z); spike(g, b, mad(mad(b, chest.u, 4.4 - Math.abs(z) * 0.3), chest.f, -3.2), 2, i % 3 ? M.FIST : M.SHARD, 4); }
  spike(g, at(chest, -9.6, -1, 3), at(chest, -14.4, 0.4, 5.4), 1.4, M.SHARD, 4); spike(g, at(chest, -9.4, -4, -2.6), at(chest, -13.6, -4.4, -4.4), 1.2, M.SHARD, 4);
  // göğüs: kızıl ışıklı oyuk, içinde kalp kristali; önünde menteşeli iki taş kapak
  const hc = at(chest, 8.4, -6, 0), hs = 1 + 0.14 * P.beat + 0.22 * P.open;
  ell(g, frame(at(chest, 8.2, -6, 0), chest.f, chest.u, chest.r), 2.2, 7, 7, M.HOLE, 8, 4);
  prism(g, mad(hc, chest.u, -3.6 * hs), mad(hc, chest.u, 3.4 * hs), 3.2 * hs, 3.2 * hs, M.HEART, 6, now * 0.6, 0.7, chest.f);
  spike(g, mad(hc, chest.u, 3.2 * hs), mad(hc, chest.u, 6.4 * hs), 3.2 * hs, M.HEART, 6); spike(g, mad(hc, chest.u, -3.4 * hs), mad(hc, chest.u, -7 * hs), 3.2 * hs, M.HEART, 6);
  for (const s of [-1, 1]) {
    const PF = turn(frame(at(chest, 9.4, -5.8, s * 7.2), chest.f, chest.u, chest.r), s * (0.4 + P.open * 1.3), 0.45 * (1 - P.open), 0);
    box(g, PF, -1.6, 0, -6.2, 6, s > 0 ? -7.6 : 0, s > 0 ? 0 : 7.6, M.PLATE);
    if (P.open < 0.5) line(g, at(PF, 0.3, -4 + s, -s * 3.2), at(PF, 0.3, 1.5 + s, -s * 5.6), M.VEIN, heat > 0.9 ? 4 : 2);
  }
  // kapaklar arasındaki yarık: kalbin ışığı sızar
  if (P.open < 0.4 && heat > 0.05) { const q = at(chest, 12.2 + P.open * 3, -1.6, 0); line(g, mad(q, chest.u, 1.6), mad(q, chest.u, -10.4), M.VEIN, Math.min(4, 1 + Math.round(heat * 2 + P.beat))); }
  // baş: omuzların arasına gömülü, kalın kaş, yarık kor gözler, aşağı açılan ağır çene
  const jaw = P.jaw, JF = turn(frame(at(head, -1.6, -1.4, 0), head.f, head.u, head.r), 0, -jaw * 0.7);
  ell(g, frame(at(head, -0.4, 1, 0), head.f, head.u, head.r), 5, 4.4, 5.2, M.HEAD, 8, 5);
  ell(g, frame(at(head, 1.6, -1, 0), head.f, head.u, head.r), 3.8, 2.4, 4, M.MAW, 6, 3);
  ell(g, frame(at(JF, 3.4, -0.6, 0), JF.f, JF.u, JF.r), 4.4, 2.3, 5, M.HEAD, 8, 4);
  for (const s of [-1, 1]) spike(g, at(JF, 6.2, 0.8, s * 2.4), at(JF, 6.6, 3 + jaw * 0.6, s * 2.6), 0.9, M.LICHEN, 3);
  // kaş: ortada çatık, iki yana kalın kaya sırtı
  tube(g, [at(head, 1.2, 2.8, -5), at(head, 3.6, 2.6, -2.6), at(head, 4.6, 1.8, 0), at(head, 3.6, 2.6, 2.6), at(head, 1.2, 2.8, 5)], [1.4, 1.7, 1.3, 1.7, 1.4], 5, M.HEAD);
  moss(g, at(head, -2, 5, 0), mad(head.u, head.f, -0.3), 3.6, 21);
  for (const s of [-1, 1]) {
    const e = at(head, 4.4, 0.9, s * 2.3), lit = P.eye;
    dot(g, e, M.EYE, lit > 0.5 ? 4 : lit > 0.15 ? 2 : 0); dot(g, e, M.EYE, lit > 0.5 ? 3 : lit > 0.15 ? 1 : 0, s * (near > 0 ? 1 : -1), 0);
    if (s > 0 === near > 0) A.eye = e;
  }
  A.mouth = at(JF, 4, 1, 0); A.head = head.p;
  // kollar: dağ gibi omuz, kalın ön kol, kaya yumruk
  for (const [s, Ar] of [[1, K.R], [-1, K.L]]) {
    ell(g, frame(mad(Ar.sh, chest.u, 1.4), chest.f, chest.u, chest.r), 7.4, 7, 7, M.ROCK, 9, 5);
    moss(g, at(frame(Ar.sh, chest.f, chest.u, chest.r), -0.6, 7.6, s * 1.2), mad(chest.u, chest.r, s * 0.35), 5.2, s > 0 ? 31 : 41);
    spike(g, at(frame(Ar.sh, chest.f, chest.u, chest.r), -2, 6.4, s * 4), at(frame(Ar.sh, chest.f, chest.u, chest.r), -4, 10.2, s * 7.4), 1.6, M.FIST, 4);
    bone(g, Ar.sh, Ar.el, 5.4, 4.2, M.ARM, 1.12, 8); ball(g, Ar.el, 4.4, M.FIST, 7);
    bone(g, Ar.el, Ar.wr, 4.6, 5.6, M.ARM, 1.16, 8);
    const H = Ar.hand, fc = at(H, 4.4, 0.4, 0);
    ell(g, frame(fc, H.f, H.u, H.r), 6.4, 6.6, 7, M.FIST, 8, 5);
    bone(g, at(H, -1.4, 0, 0), at(H, 0.6, 0, 0), 5.9, 5.9, M.IRON, 1, 8);
    for (let k = 0; k < 4; k++) prism(g, at(H, 5.4, 3, (k - 1.5) * 2.7), at(H, 8.8, 3.4, (k - 1.5) * 2.8), 1.7, 1.5, M.FIST, 4, 0.8, 1, H.u);
    prism(g, at(H, 2.6, -2.6, -s * 3.6), at(H, 6.2, -2, -s * 4), 1.4, 1.3, M.FIST, 4, 0.4, 1, H.u);
    if (s > 0 === near > 0) A.hand = mad(fc, H.f, 2);
    // gömülme: yumruğun çevresinde kalkan moloz
    if (P.dig > 0.05 && fc[1] < 10) for (let k = 0; k < 6; k++) {
      const a = k / 6 * TAU + s, r = 6 + 2 * hash(k + s * 3), c = [fc[0] + Math.cos(a) * r, Math.max(0.5, fc[1] - 3) + hash(k * 7) * 2 * P.dig, fc[2] + Math.sin(a) * r];
      prism(g, c, mad(c, [Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3], (1.6 + 2.2 * hash(k + 9)) * P.dig), 1.7 * P.dig, 0.6, M.RUBBLE, 4, k);
      // yere akan damar: yumruktan dışa kıvrılan çatlak
      if (heat > 0.5) { const b = [fc[0], 0.2, fc[2]], L = (8 + 6 * hash(k + 2)) * P.dig, m = [b[0] + Math.cos(a + 0.3) * L * 0.5, 0.2, b[2] + Math.sin(a + 0.3) * L * 0.5]; line(g, b, m, M.VEIN, 4); line(g, m, [b[0] + Math.cos(a) * L, 0.2, b[2] + Math.sin(a) * L], M.VEIN, 3); }
    }
  }
  // bacaklar: kısa, kütük gibi; yassı taş ayak
  const fw = norm([pel.f[0], 0, pel.f[2]]), sd = [fw[2], 0, -fw[0]];
  for (const L of [K.legR, K.legL]) {
    bone(g, L.hip, L.knee, 6.6, 5.4, M.ARM, 1.18, 8); ball(g, L.knee, 5.2, M.FIST, 7); bone(g, L.knee, L.ank, 5.2, 5.6, M.ARM, 1.08, 8);
    const ft = [L.foot[0], L.foot[1] + 2.2, L.foot[2]];
    ell(g, frame(mad(ft, fw, 1.6), fw, [0, 1, 0], sd), 6, 2.6, 4.6, M.FIST, 8, 4);
    for (let k = -1; k <= 1; k++) ball(g, mad(mad(ft, fw, 6.6), sd, k * 2.6), 1.5, M.FIST, 5);
  }
  A.chest = A.heart = hc;
  return A;
}

// ---------- duruşlar ----------
const DIE_T = 2.2;
// çift vuruş (lub-dub)
const lub = ph => { const c = ph - Math.floor(ph); return bump(0, 0.05, 0.09, 0.2, c) + 0.6 * bump(0.2, 0.26, 0.3, 0.46, c); };
const view = o => viewOf(o.yaw, o.dying ? 0.8 : o.act === 'heart' ? 1.05 : o.act === 'pulse' || o.act === 'inhale' ? 0.85 : o.act === 'melee' || o.act === 'fist' ? 0.5 : 0.72 - 0.2 * o.walk, 0.4);
function pose(o) {
  const t = o.t, A = o.A, rage = o.rage ? 1 : 0, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1;
  const br = Math.sin(t * 1.25 + o.wob), sway = Math.sin(t * 0.55 + o.wob);
  let x = 0, y = br * 0.5, lean = 24, twist = 0, roll = sway * 1.2, jaw = 0.06, eye = 0.6 + 0.2 * br, open = 0, ht = 0.38 + rage * 0.4, swell = 0, dig = 0, sink = 0, rate = 14, shadow = 1;
  let bt = lub(t / (rage ? 0.75 : 1.25) + o.wob), flow = rage ? 6 : 3.4;
  const bend = [6 - br * 1.5, 0, 0], head = [24 + br * 2, 0, sway * 3], N = { sw: 16 + br * 1.5, ab: 16 + br, tw: 0, el: 10 }, F = { sw: 16 + br * 1.5, ab: 16 + br, tw: 0, el: 10 };
  const fN = [0.5, 0, 9.5], fF = [-0.5, 0, 9.5];
  if (w > 0.01) {
    // ağır yürüyüş: her adımda gövde basan yana yatar ve çöker, kollar ters yönde salınıp yeri yoklar
    const ph = o.ph, a = stride(ph, 6.4, 3.6, 0.64), b = stride(ph + 0.5, 6.4, 3.6, 0.64), c1 = Math.cos(ph * TAU), s1 = Math.sin(ph * TAU), dip = Math.pow(Math.abs(Math.cos(ph * TAU)), 3);
    fN[0] += a[0] * w; fN[1] += a[1] * w; fF[0] += b[0] * w; fF[1] += b[1] * w;
    y -= (0.4 + 1.6 * dip) * w; roll += s1 * 5 * w; twist -= c1 * 10 * w; bend[1] += c1 * 8 * w; head[2] -= s1 * 4 * w; lean += 4 * w;
    N.sw -= c1 * 16 * w; F.sw += c1 * 16 * w; N.el += (8 + c1 * 8) * w; F.el += (8 - c1 * 8) * w; N.ab += 4 * w; F.ab += 4 * w; head[0] -= dip * 3 * w;
  }
  if (o.act === 'pulse' && A) {
    if (o.stage === 'wind') {
      // kollar iki yana açılır, göğüs kabarır, damarlar kızarır; kapakların arasından kalp ışığı sızar
      const k = ss(0, 1, o.wind), q = Math.sin(t * 46) * 0.35 * k * k;
      lean -= 18 * k; bend[0] -= 10 * k; head[0] += 4 * k; y += 1.6 * k; x += q; swell = 0.7 * k; ht += 1.3 * k; open = 0.14 * k; jaw = 0.25 * k; bt = Math.max(bt, k * k);
      for (const a of [N, F]) { a.sw += -6 * k; a.ab += 74 * k; a.el += 18 * k; }
      flow = 9; rate = 18;
    } else {
      // göğüs öne fırlar, dalga çıkar; geri teper ve toparlanır
      const s = o.sinceStage, th = bump(0, 0.05, 0.12, 0.4, s), rc = bump(0.08, 0.18, 0.25, 0.5, s);
      lean -= 18 * th - 6 * rc; bend[0] -= 22 * th; x += 3.4 * th - 1.6 * rc; y += 1.2 * th; head[0] += 14 * th; jaw = 0.7 * th; swell = 1 * th; ht += 1.6 * (1 - ss(0.1, 0.5, s)); open = 0.22 * th; bt = Math.max(bt, th);
      for (const a of [N, F]) { a.sw += -34 * th; a.ab += 84 * th + 30 * rc; a.el += 6 * th; }
      flow = 9; rate = 40;
    }
  } else if (o.act === 'fist' && A) {
    if (o.stage === 'wind') {
      // yakın yumruğu başının üstüne kaldırır, gövde geriye ve yana gerilir
      const k = ss(0, 1, o.wind);
      N.sw += 150 * k; N.ab -= 10 * k; N.el += 18 * k; F.ab += 22 * k; F.sw -= 10 * k; lean -= 16 * k; bend[0] -= 6 * k; twist -= 14 * k * 1; head[0] += 8 * k; y += 1.4 * k; jaw = 0.3 * k; ht += 0.5 * k; rate = 22;
    } else {
      // bütün ağırlığıyla yere indirir: gövde öne çöker, sarsılır; yavaşça doğrulur
      const s = o.sinceStage, h = ss(0, 0.08, s), rec = ss(0.2, 0.45, s), dn = h * (1 - rec), up = 1 - h, sh = Math.sin(t * 52) * 0.6 * bump(0.06, 0.1, 0.16, 0.3, s);
      N.sw += 150 * up + 50 * dn; N.ab -= 10 * up; N.el += 18 * up - 14 * dn; F.ab += 22 * up + 14 * dn; lean += -16 * up + 26 * dn; bend[0] += -6 * up + 10 * dn; twist += -14 * up + 12 * dn;
      x += 3 * dn + sh; y += -3.6 * dn; head[0] -= 8 * dn; jaw = 0.5 * dn; fN[0] += 3 * dn; ht += 0.6 * dn; dig = 0.6 * dn; rate = 50;
    }
  } else if (o.act === 'inhale' && A) {
    if (o.stage === 'suck') {
      // geriye yaslanıp derin soluk çeker: çene ardına kadar açılır, göğüs şişer
      const k = ss(0, 1, clamp(o.sinceStage / 1.6, 0, 1)), q = Math.sin(t * 30) * 0.25 * k;
      lean -= 26 * k; bend[0] -= 14 * k; head[0] += 26 * k; jaw = k; swell = 1.2 * k; y += 1.8 * k; x -= 1.6 * k + q; ht += 0.5 * k;
      for (const a of [N, F]) { a.ab += 24 * k; a.sw -= 10 * k; a.el += 16 * k; }
      rate = 16;
    } else {
      // öne savrulup soluğu boşaltır
      const s = o.sinceStage, k = ss(0, 0.1, s) * (1 - ss(0.35, 0.6, s)), q = Math.sin(t * 40) * 0.4 * k;
      lean += 14 * k; bend[0] += 10 * k; head[0] += 4 * k; jaw = 1; x += 3.2 * k + q; y -= 1 * k; swell = -0.4 * k;
      for (const a of [N, F]) { a.ab += 18 * k; a.sw -= 6 * k; a.el += 10 * k; }
      fN[0] += 2 * k; rate = 34;
    }
  } else if (o.act === 'veins' && A) {
    // diz çöker, iki yumruğunu yere gömer ve orada tutar: damarlar yere akar
    const c = o.since, k = ss(0, 0.3, c), h = ss(0.28, 0.36, c), sh = Math.sin(t * 50) * 0.5 * bump(0.33, 0.36, 0.42, 0.6, c);
    y -= 6.5 * k; lean += 26 * k - 4 * h; bend[0] += 6 * k; head[0] += 4 * k + 6 * h; x += 1.5 * k + sh; jaw = 0.4 * h;
    for (const a of [N, F]) { a.sw += 26 * k + 14 * h; a.ab += 14 * k - 4 * h; a.el = lerp(a.el, 0, k); }
    N.sw += 40 * k * (1 - h); F.sw += 40 * k * (1 - h); dig = h; ht += 1.1 * h; flow = 8; rate = 34;
  } else if (o.act === 'heart' && A) {
    // tek dizinin üstüne çöker, göğüs kapakları açılır: kalp çıplak atar (zayıf an); sonunda kapanır
    const c = o.since, k = ss(0, 0.45, c) * (1 - ss(2.4, 2.75, c));
    open = ss(0.3, 0.75, c) * (1 - ss(2.3, 2.65, c)); y -= 6 * k; lean -= 16 * k; bend[0] -= 6 * k; head[0] -= 10 * k; head[2] += 8 * k; jaw = 0.3 * k;
    fN[0] += 6 * k; fF[0] -= 9 * k; fF[1] += 0.6 * k;
    for (const a of [N, F]) { a.sw -= 26 * k; a.ab += 30 * k; a.el += 10 * k; }
    bt = lub(t / 0.62) * (0.4 + 0.6 * open) + open * 0.3; ht += 0.8 * open; flow = 7; rate = 18;
  } else if (o.act === 'melee') {
    // ters el: yakın kolu göğsün önünden karşıya alır, omzunu açarak madencinin üstünden savurur
    const [up, dn] = meleeK(o);
    N.sw += 30 * up + 50 * dn; N.ab += -72 * up + 70 * dn; N.el += 50 * up - 10 * dn; twist += -22 * up + 26 * dn; lean += 4 * up + 6 * dn; bend[1] += -10 * up + 12 * dn;
    F.ab += 10 * up; x += -1 * up + 2.4 * dn; head[0] += 4 * up; jaw = 0.4 * dn; fN[0] += 2.4 * dn; rate = 40;
  }
  if (rage && o.rageT < 1.6) {
    // uyanış kükremesi: doğrulur, yumruklar iki yanda kalkar, ağzı ardına kadar açılır; damarlar alevlenir
    const k = bump(0, 0.22, 0.95, 1.35, o.rageT), q = Math.sin(t * 50) * 0.4 * k;
    lean -= 26 * k; bend[0] -= 10 * k; head[0] += 22 * k; jaw = Math.max(jaw, k); x += q; y += 1.5 * k; swell = Math.max(swell, 0.8 * k); ht += 1.2 * k; eye = 1;
    for (const a of [N, F]) { a.sw -= 18 * k; a.ab += 58 * k; a.el += 24 * k; }
    rate = 26;
  }
  if (rage && !dead) eye = Math.max(eye, 0.9);
  if (o.hurt > 0 && !dead) {
    const h = o.hurt * o.hurt, back = clamp(o.hx * Math.cos(o.view), -1, 1);
    lean -= 8 * h; head[0] += 10 * h; head[2] += 8 * near * h; x += back * 1.4 * h; jaw = Math.max(jaw, 0.4 * h); N.ab += 10 * h; F.ab += 10 * h; ht += 0.5 * h; eye = 1;
  }
  if (dead) {
    // damarlar söner; önce dizlerinin üstüne çöker, sonra yüzüstü yere kapaklanır
    const d = o.dying * DIE_T, kn = ss(0.1, 0.75, d), fall = ss(0.85, 1.5, d), thud = Math.sin(t * 44) * 0.4 * bump(1.4, 1.5, 1.55, 1.75, d);
    y += -8 * kn + 5 * fall; lean += 6 * kn + 58 * fall; bend[0] += 10 * kn + 4 * fall; head[0] += -20 * kn + 12 * fall; x += 2 * kn + 8 * fall + thud; jaw = 0.4 * kn;
    for (const a of [N, F]) { a.sw = lerp(a.sw, 6, kn) + 130 * fall; a.ab = lerp(a.ab, 18, kn) + 14 * fall; a.el = lerp(a.el, 4, kn) + 10 * fall; }
    fN[0] -= 2 * kn; fF[0] -= 3 * kn; roll *= 1 - kn; twist *= 1 - kn;
    ht *= 1 - ss(0.2, 1.7, d); bt *= 1 - ss(0, 1.2, d); eye = (1 - ss(0.6, 1.3, d)) * 0.8; open = 0; rate = 24;
  }
  const rad = a => ({ sw: a.sw * D, ab: a.ab * D, tw: a.tw * D, el: Math.max(0, a.el) * D });
  const R = near > 0 ? N : F, L = near > 0 ? F : N;
  return {
    rate, x, y, lean: lean * D, twist: twist * D, roll: roll * D, bend: bend.map(v => v * D), head: head.map(v => v * D), armR: rad(R), armL: rad(L),
    footR: near > 0 ? fN : fF, footL: (([a, b, c]) => [a, b, -c])(near > 0 ? fF : fN), jaw, eye, open, heat: ht, beat: bt, flow, br: 0.025 * br + 0.07 * swell, dig, near, sink, shadow,
  };
}

export const DEV3D = { w: 200, h: 172, ox: 100, oy: 150, scale: 1.2, tilt: 0.2, mats: MATS, stride: 26, shadow: 24, body: 66, bias: 0.72, turn: 0.4, turnRate: 3, outline: [6, 10, 8], hold: ['veins', 'heart'], view, pose, build };
