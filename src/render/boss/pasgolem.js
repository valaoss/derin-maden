// Pas Golemi (Mıknatısın Kalbi): Mıknatıs Çekirdeği'nin madenin kendi demirinden topladığı dev. Gövdesi perçinli eski bir maden
// arabası (altında tekerlekleri), kolları bükülmüş ray, elleri tekerlek ve levhadan kıskaç; bacakları zincir sarılı paslı direkler.
// Başı tek yarıklı eski bir madenci feneri. Göğsünde nal mıknatıs: kırmızı kutup çeker, mavi iter (P.pole: r/b/d sönük/x ölü).
import { vert, tri, line, dot } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mad, mix, norm, sub, cross, dotp, at, dir, turn, frame, shift, ring, band, anyUp, bone, ball, tube, spike, prism, aimLocal, meleeK, viewOf, hash } from './rig.js';
import { biped, stride } from './biped.js';

const M = { RUST: 1, IRON: 2, RAIL: 3, INNER: 4, RED: 5, BLUE: 6, DIM: 7, LAMP: 8, GLASS: 9, CHAIN: 10, DEAD: 11, PLATE: 12, PILLAR: 13 };
const S = { hip: 20.5, spine: 16, neck: 8.6, headX: 0.4, shW: 13.4, shY: 2, hipW: 5.8, arm: [11.5, 11], leg: [9.4, 9], ankle: 3 };
// araba teknesi: göğüs çerçevesinde alt/üst kenar, alt ve üst yarı ölçüler [ileri, yana]
const CY0 = -14.5, CY1 = 5, CB = [7.8, 8.6], CT = [10.6, 11.4];
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb);
const fr = x => x - Math.floor(x), cell = (a, b) => fr(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
let heat = 0.5, now = 0, shake = 0;
// araba teknesi: altta, ortada ve ağızda perçinli demir kayış; aralarında preslenmiş kaburga ve pas lekeleri
const tub = (u, v, i, out) => {
  if (v < 1.4 || (v > 9 && v < 10.4) || v > 17.9) { out.id = M.IRON; return i + (fr(u / 3.4 + 0.5) < 0.24 ? 0.5 : 0); }
  return i - (fr(u / 5.4 + 0.25) < 0.14 ? 0.24 : 0) + (cell(Math.floor(u / 3), Math.floor(v / 4)) - 0.5) * 0.1;
};
// direk bacak: boyuna pas akıntısı
const pillar = (u, v, i) => i - (fr(v * 4 + 0.1) < 0.12 ? 0.1 : 0);
const hot = (u, v, i) => 0.08 + heat * 0.4 + (i - 0.5) * 0.6;
const MATS = [];
MATS[M.RUST] = { ramp: ramp('#1c0c08', '#41200f', '#6e3218', '#a64a22', '#e0603a'), px: tub };
MATS[M.PLATE] = { ramp: ramp('#1a0c09', '#432014', '#73361d', '#a8502a', '#dc7a42'), px: (u, v, i) => i + (cell(Math.floor(u / 1.5), Math.floor(v / 1.5)) - 0.5) * 0.16 };
MATS[M.PILLAR] = { ramp: ramp('#100a08', '#261813', '#3e281e', '#5c3c2a', '#84583a'), px: pillar };
MATS[M.IRON] = { ramp: ramp('#0a0707', '#1c1414', '#2a2020', '#463838', '#6e5c58') };
MATS[M.RAIL] = { ramp: ramp('#0c0b0e', '#232128', '#3b3740', '#5e5860', '#948a8a') };
MATS[M.INNER] = { ramp: ramp('#040202', '#080404', '#0e0706', '#160b08', '#20110c'), flat: true };
MATS[M.CHAIN] = { ramp: ramp('#0c0909', '#2a2222', '#4a4040', '#6e6260', '#a49490') };
MATS[M.RED] = { ramp: ramp('#5a0a08', '#b81c12', '#ff3a2a', '#ff7a52', '#ffc8a8'), flat: true, glow: 1, px: hot };
MATS[M.BLUE] = { ramp: ramp('#081a5a', '#1a52b8', '#3a8aff', '#70b8ff', '#c8e4ff'), flat: true, glow: 1, px: hot };
MATS[M.DIM] = { ramp: ramp('#4a1208', '#8e2a10', '#d8501e', '#f6803a', '#ffbc78'), flat: true, glow: 0.7, px: hot };
MATS[M.DEAD] = { ramp: ramp('#0c0606', '#1a0c0a', '#2a1410', '#3a1c14', '#4a261a'), flat: true };
MATS[M.LAMP] = { ramp: ramp('#6a3a08', '#c07a18', '#ffc840', '#fff090', '#ffffff'), flat: true, glow: 1 };
MATS[M.GLASS] = { ramp: ramp('#0a0806', '#14100a', '#201810', '#2c2216', '#3a2c1c'), flat: true };

// ---------- yardımcı şekiller ----------
// uv'li düz dörtgen; normal ref noktasından dışarı bakar
function pq(g, a, b, c, d, m, ref, uv = [0, 0, 0, 0, 0, 0, 0, 0]) {
  let n = norm(cross(sub(b, a), sub(c, a))); if (ref && dotp(n, sub(a, ref)) < 0) n = [-n[0], -n[1], -n[2]];
  const i = vert(g, a, n, uv[0], uv[1]), j = vert(g, b, n, uv[2], uv[3]), k = vert(g, c, n, uv[4], uv[5]), l = vert(g, d, n, uv[6], uv[7]);
  tri(g, i, j, k, m); tri(g, i, k, l, m);
}
// kesik kutu: F çerçevesinde y0..y1, alt yarı ölçüler [ax, az], üst [bx, bz]; top/bot: kapak malzemesi (0 açık); yüz sırası ön, sol, arka, sağ
function box(g, F, y0, y1, ax, az, bx, bz, m, top = m, bot = m) {
  const P = [];
  for (const [y, hx, hz] of [[y0, ax, az], [y1, bx, bz]]) for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) P.push(at(F, sx * hx, y, sz * hz));
  const c = at(F, 0, (y0 + y1) / 2, 0), h = y1 - y0;
  for (let j = 0; j < 4; j++) { const k = (j + 1) % 4, w = 2 * (j % 2 ? bx : bz); pq(g, P[j], P[k], P[k + 4], P[j + 4], m, c, [0, 0, w, 0, w, h, 0, h]); }
  if (top) pq(g, P[4], P[5], P[6], P[7], top, c);
  if (bot) pq(g, P[0], P[1], P[2], P[3], bot, c);
  return P;
}
// düz kapaklı silindir (tekerlek, fener gövdesi)
function disc(g, c, t, r, m, sides) {
  const R = norm(cross(t, anyUp(t))), U = cross(R, t), k = vert(g, c, t), b = g.nv;
  for (let j = 0; j <= sides; j++) { const a = j / sides * TAU; vert(g, mad(mad(c, R, Math.cos(a) * r), U, Math.sin(a) * r), t); }
  for (let j = 0; j < sides; j++) tri(g, k, b + j, b + j + 1, m);
}
function drum(g, a, b, r, m, sides = 8, mc = m) {
  const t = norm(sub(b, a)), up = anyUp(t), A = ring(g, a, t, up, r, r, sides, 0), B = ring(g, b, t, up, r, r, sides, 1);
  band(g, A, B, sides, m); disc(g, a, [-t[0], -t[1], -t[2]], r, mc, sides); disc(g, b, t, r, mc, sides);
}
// araba tekerleği: demir bandaj, paslı yüz, dönen parmaklar
function wheel(g, c, ax, r, w, rot) {
  drum(g, mad(c, ax, -w), mad(c, ax, w), r, M.IRON, 9, M.RUST);
  drum(g, mad(c, ax, -w - 0.5), mad(c, ax, w + 0.5), r * 0.3, M.IRON, 6);
  const R = norm(cross(ax, anyUp(ax))), U = cross(R, ax);
  for (const s of [-1, 1]) for (let j = 0; j < 4; j++) { const a = rot + j * TAU / 4, f = mad(c, ax, s * (w + 0.05)); line(g, mad(mad(f, R, Math.cos(a) * r * 0.3), U, Math.sin(a) * r * 0.3), mad(mad(f, R, Math.cos(a) * r * 0.85), U, Math.sin(a) * r * 0.85), M.IRON, 1); }
}
// zincir: a'dan sarkan halkalar; her halka bir öncekinden gecikmeli salınır, mıknatıs alanında havalanır (out yönüne)
const CH = { amp: 0.3, dx: 0, dz: 0, fw: [1, 0, 0], sd: [0, 0, 1], lift: 0 };
function chain(g, a, n, ph, out = [0, 0, 0]) {
  let p = a;
  for (let i = 0; i < n; i++) {
    const k = now * 2.3 + ph - i * 0.5, w = CH.amp * (0.3 + i * 0.09), sx = Math.sin(k) * w, sz = Math.cos(k * 0.8) * w * 0.5, fl = CH.lift * (1 + Math.sin(now * 13 + i + ph) * 0.15);
    const d = norm([CH.dx + sx * CH.fw[0] + sz * CH.sd[0] + out[0] * fl * 2, -1 + fl * 1.6, CH.dz + sx * CH.fw[2] + sz * CH.sd[2] + out[2] * fl * 2]), q = mad(p, d, 1.3); if (q[1] < 0.4) q[1] = 0.4;
    line(g, p, q, M.CHAIN, i % 2 ? 2 : 4); p = q;
  }
  return p;
}
// direğe sarılı zincir (sarmal)
function coil(g, a, b, r, turns, ph) {
  const t = norm(sub(b, a)), u = norm(cross(t, anyUp(t))), v = cross(t, u), n = Math.ceil(turns * 22);
  let prev = null;
  for (let i = 0; i <= n; i++) { const k = i / n, an = ph + k * turns * TAU, c = mad(mad(mix(a, b, k), u, Math.cos(an) * r), v, Math.sin(an) * r); if (prev) line(g, prev, c, M.CHAIN, i % 2 ? 1 : 3); prev = c; }
  return prev;
}
// ölüm: kopan parça çerçevesi yere düşüp yatar. i: parça no (gecikme ve yön), rest: yerdeki yükseklik
let FALL = 0;
function drop(F, i, rest = 1, spread = 9) {
  const k = clamp(FALL * 1.7 - hash(i) * 0.7, 0, 1); if (k <= 0) return F;
  const e = k * k, a = hash(i + 3) * TAU, p = [F.p[0] + Math.cos(a) * spread * k, lerp(F.p[1], rest, e) + Math.sin(k * Math.PI) * 2.5, F.p[2] + Math.sin(a) * spread * k];
  const f = norm(mix(F.f, [Math.cos(a), 0, Math.sin(a)], k)), u0 = norm(mix(F.u, [0, 1, 0], k)), r = norm(cross(f, u0));
  return frame(p, f, cross(r, f), r);
}

function build(g, P, o) {
  now = o.t; heat = P.heat; shake = P.shake; FALL = P.fall;
  const K = biped(P, S), A = {}, { pel, chest, head } = K, t = o.t;
  const fw = norm([pel.f[0], 0, pel.f[2]]), sd = [-fw[2], 0, fw[0]], jit = i => shake > 0.01 ? (cell(i, Math.floor(t * 24)) - 0.5) * shake : 0;
  Object.assign(CH, { amp: P.chain, dx: -fw[0] * P.drag, dz: -fw[2] * P.drag, fw, sd, lift: P.lift });
  const CM = P.pole === 'b' ? M.BLUE : P.pole === 'r' ? M.RED : P.pole === 'x' ? M.DEAD : M.DIM;
  const rot = o.ph * 2.4 + P.spinW, C = (x, y, z) => at(chest, x, y, z), K0 = y => (y - CY0) / (CY1 - CY0);
  const fx = y => lerp(CB[0], CT[0], K0(y)), wz = y => lerp(CB[1], CT[1], K0(y));
  // ---- gövde: maden arabası (ağzı açık, içi karanlık)
  box(g, chest, CY0, CY1, CB[0], CB[1], CT[0], CT[1], M.RUST, 0);
  const iy = CY1 - 2.4, ix = fx(iy) - 0.3, iz = wz(iy) - 0.3;
  pq(g, C(ix, iy, iz), C(ix, iy, -iz), C(-ix, iy, -iz), C(-ix, iy, iz), M.INNER, C(0, -20, 0));
  // ağız kenarı: parlak dudak
  const rim = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => C(a * (CT[0] + 0.2), CY1 + 0.2, b * (CT[1] + 0.2)));
  for (let j = 0; j < 4; j++) prism(g, rim[j], rim[(j + 1) % 4], 0.9, 0.9, M.PLATE, 4, Math.PI / 4);
  // içinde hurda: tekneden taşan demir parçaları
  for (let i = 0; i < 3; i++) prism(g, C(-4.5 + i * 1.6, iy, -7 + i * 6.6), C(-5.4 + i * 2.2 + jit(i), CY1 + 1.8 + hash(i) * 1.6, -8 + i * 7.4), 1.8, 1, i === 1 ? M.RAIL : M.IRON, 4, i);
  // alt şasi ve tekerlekler (yürürken döner)
  box(g, shift(pel, 0, -0.4, 0), -2.6, 2.4, 4.6, 6.2, 5.4, 7, M.IRON);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wheel(g, C(sx * 4.4, CY0 - 0.4, sz * (CB[1] + 0.9)), chest.r, 3.6, 0.8, rot);
  // göğüs: karanlık yuvada nal mıknatıs; kutup uçları ve aradaki çekirdek parlar
  const op = P.open, rz = 5 + op * 2.4, ry0 = -12.2, ry1 = 0.4, fq = (y, z) => C(fx(y) + 0.06, y, z);
  pq(g, fq(ry1, rz), fq(ry1, -rz), fq(ry0, -rz), fq(ry0, rz), M.INNER, C(0, -6, 0));
  const U = [[-3.4, -2], [-3.6, -6], [-2.8, -9.4], [0, -10.6], [2.8, -9.4], [3.6, -6], [3.4, -2]].map(([z, y]) => C(fx(y) + 1, y + jit(7) * 0.4, z));
  tube(g, U, [1.4, 1.5, 1.5, 1.5, 1.5, 1.5, 1.4], 6, M.RAIL);
  for (const s of [-1, 1]) tube(g, [C(fx(-2.2) + 1, -2.2, s * 3.4), C(fx(0.6) + 1, 0.6, s * 3.3)], [1.7, 1.55], 6, CM);
  const core = C(fx(-5.6) + 1.8 + heat * 0.3, -5.6, 0);
  ball(g, core, 2.2 + heat * 0.4, CM, 7);
  A.core = A.chest = core;
  // alan yayları: kutuplar arasında çatırdayan ışık
  if (heat > 0.95 && P.pole !== 'x') for (let j = 0; j < 2; j++) {
    let prev = C(fx(0.8) + 1.2, 0.9, -3.3); const n = 7, ph = Math.floor(t * 16) + j * 9, R = 3.4 + j * 2.2 + heat;
    for (let i = 1; i <= n; i++) { const a = Math.PI * i / n, q = C(fx(0.8) + 1.4 + Math.sin(a) * R * 0.7 + (cell(i, ph) - 0.5) * 1.2, 0.9 + Math.sin(a) * R * 0.6 + (cell(ph, i) - 0.5), -3.3 * Math.cos(a)); line(g, prev, q, CM, 4 - j); prev = q; }
  }
  // ön kapaklar: dış kenardan menteşeli kara demir; emerken açılır, ölünce düşer
  for (const s of [-1, 1]) {
    const a = op * 0.9, n = [Math.cos(a), 0, s * Math.sin(a)], w = [Math.sin(a), 0, -s * Math.cos(a)], yc = (ry0 + ry1) / 2, hz = s * (wz(yc) - 0.2), hw = (wz(yc) - 4.6) / 2;
    const F0 = turn(frame(C(fx(yc) + 0.5 + w[0] * hw, yc, hz + w[2] * hw), dir(chest, ...n), chest.u, dir(chest, ...w)), 0, -0.12), Fd = drop(F0, 3 + (s > 0 ? 1 : 0), 0.6, 8);
    box(g, Fd, ry0 - yc - 0.6, ry1 - yc + 0.6, 0.5, hw, 0.5, hw, M.IRON);
    for (const y of [-4.6, 0, 4.6]) dot(g, at(Fd, 0.6, y, s * (hw - 1)), M.RUST, 4);
  }
  // ---- omuzlar: perçinli, kat kat inen üç levha; kol kalktıkça levhalar da kalkar
  const arms = [[1, K.R], [-1, K.L]];
  for (const [s, Ar] of arms) {
    const d = norm(sub(Ar.el, Ar.sh)), rise = clamp(dotp(d, chest.u) + 0.6, 0, 1.5);
    ball(g, Ar.sh, 3.3, M.IRON, 6);
    let Fp = turn(frame(mad(Ar.sh, chest.u, 2.8 + rise * 1.2), chest.f, chest.u, chest.r), 0, 0, s * (0.3 + rise * 0.45));
    Fp = drop(shift(Fp, jit(s + 2) * 0.6, jit(s + 4) * 0.5, 0), s > 0 ? 0 : 1, 0.9, 11);
    for (let i = 0; i < 3; i++) {
      const L = turn(shift(Fp, 0, -i * 1.9, s * i * 2.7), 0, 0, s * i * 0.42), hx = 5 - i * 0.5, hz = 3.4 - i * 0.5;
      box(g, L, -0.7, 0.7, hx, hz, hx - 0.3, hz - 0.3, M.PLATE);
      dot(g, at(L, hx - 1.2, 0.8, s * (hz - 1)), M.IRON, 4); dot(g, at(L, -hx + 1.2, 0.8, s * (hz - 1)), M.IRON, 4);
    }
  }
  // ---- kollar: bükülmüş ray; dirsekte altıgen somun, ortada ek laması
  const rail = (a, b, ra, rb, up) => {
    prism(g, a, b, ra, rb, M.RAIL, 4, Math.PI / 4, 0.62, up);
    const m = mix(a, b, 0.55), t2 = norm(sub(b, a)), sdv = norm(cross(t2, up));
    box(g, frame(m, norm(cross(sdv, t2)), t2, sdv), -1.3, 1.3, 1.5, 1.8, 1.5, 1.8, M.IRON);
  };
  for (const [s, Ar] of arms) {
    const H = Ar.hand, up = mul3(chest.r, s), kink = mad(mix(Ar.el, Ar.wr, 0.5), H.u, 1.1);
    rail(Ar.sh, Ar.el, 2.5, 2.2, up);
    ball(g, Ar.el, 2.7, M.IRON, 6);
    prism(g, Ar.el, kink, 2.2, 2.1, M.RAIL, 4, Math.PI / 4, 0.62, up); prism(g, kink, Ar.wr, 2.1, 2, M.RAIL, 4, Math.PI / 4, 0.62, up);
    ball(g, kink, 1.5, M.IRON, 5);
    // kıskaç el: bilekte tekerlek, önünde iki kalın çene (cl: açıklık)
    const cl = P.cl[s > 0 ? 0 : 1], w0 = at(H, 2.6, 0, 0), hc = at(H, 7.5, 0, 0);
    wheel(g, w0, H.r, 4.1, 1.2, rot * 0.5 + s);
    for (const j of [-1, 1]) {
      const a = at(H, 3.6, j * 2.6, 0), b = at(H, 8.4, j * (3.1 + cl * 2.6), 0), c = at(H, 11.2, j * (1.4 + cl * 2.2), 0);
      prism(g, a, b, 1.7, 1.6, M.PLATE, 4, Math.PI / 4, 0.55, H.u); prism(g, b, c, 1.6, 1.1, M.PLATE, 4, Math.PI / 4, 0.55, H.u);
      spike(g, c, at(H, 10.6, j * (0.2 + cl * 1.6), 0), 0.9, M.IRON, 3);
      dot(g, at(H, 8.4, j * (3.1 + cl * 2.6), s * 1.1), M.IRON, 4);
    }
    if (P.lump > 0.05) prism(g, at(H, 6.2, -1.6 * P.lump, 0), at(H, 9.6, 2.4 * P.lump, 0.6), 2.6 * P.lump, 2 * P.lump, s > 0 ? M.IRON : M.RAIL, 5, t * 3 + s);
    // bilekten sarkan zincir ve kanca
    const e = chain(g, at(H, 1, -1.6, s * 1.4), 6, s * 1.7, mul3(H.f, 1));
    line(g, e, mad(e, [0, -1, 0], 1.2), M.RAIL, 4); line(g, mad(e, [0, -1, 0], 1.2), mad(mad(e, [0, -1, 0], 1.6), fw, 1.1), M.RAIL, 3);
    if (s > 0 === !(P.near < 0)) A.hand = hc;
  }
  // ---- bacaklar: kalın paslı direkler, sarılı zincir, demir taban
  for (const [s, L] of [[1, K.legR], [-1, K.legL]]) {
    bone(g, L.hip, L.knee, 4.4, 4, M.PILLAR, 1.04, 8);
    ball(g, L.knee, 3.8, M.IRON, 6);
    bone(g, L.knee, L.ank, 3.9, 4.8, M.PILLAR, 1, 8);
    const ff = frame([L.foot[0], L.foot[1], L.foot[2]], fw, [0, 1, 0], sd);
    box(g, shift(ff, 0.8, 0, 0), 0, 2.9, 5.8, 4.6, 5.2, 4.2, M.IRON);
    for (const x of [-3.6, 0, 3.6]) dot(g, at(ff, x + 0.8, 1.6, s * 4.5), M.RUST, 4);
    const end = coil(g, mix(L.knee, L.ank, 0.2), mix(L.knee, L.ank, 0.75), 4.7, 1.4, s * 1.3 + 0.4);
    chain(g, end, 4, s * 2.4 + 1);
    if (P.spark > 0.05 && L.foot[1] < 1) for (let i = 0; i < 4; i++) { const q = mad(mad(L.foot, fw, -2 - hash(i + Math.floor(t * 20)) * 7 * P.spark), [0, 1, 0], hash(i * 3 + Math.floor(t * 20)) * 3); dot(g, q, M.LAMP, i % 2 ? 3 : 4); }
  }
  // ---- sarkan zincirler: tekne yanından sarkık bir kangal ve iki uç
  {
    const zz = wz(1.6) + 0.5; let p = C(fx(1.6) - 0.6, 1.6, zz);
    for (let i = 1; i <= 10; i++) { const k = i / 10, q = mad(C(lerp(fx(1.6) - 0.6, -fx(1.6) + 0.6, k), 1.6 - Math.sin(k * Math.PI) * (5.2 - P.lift * 3), zz + Math.sin(k * Math.PI) * 0.6), [CH.dx, 0, CH.dz], Math.sin(k * Math.PI) * 2); line(g, p, q, M.CHAIN, i % 2 ? 2 : 4); p = q; }
    chain(g, C(-5.6, -7, wz(-7) + 0.3), 5, 0.6, chest.r); chain(g, C(-6, -9, -wz(-9) - 0.3), 5, 2.2, mul3(chest.r, -1));
  }
  // ---- baş: eski madenci feneri; tek yatay yarık, kafes çubukları, konik kapak ve kulp
  {
    const F = drop(head, 2, 3.4, 8), h = (x, y, z) => at(F, x, y, z);
    bone(g, C(0, CY1 - 3, 0), at(head, 0, -2.6, 0), 2.3, 2.1, M.RAIL, 1, 6);
    drum(g, h(0, -3.4, 0), h(0, -2.4, 0), 4.8, M.RUST, 10);
    drum(g, h(0, -2.5, 0), h(0, 2.4, 0), 4, M.IRON, 10);
    drum(g, h(0, 2.3, 0), h(0, 3.1, 0), 4.6, M.RUST, 10);
    prism(g, h(0, 3, 0), h(0, 5.2, 0), 4.2, 1.6, M.RUST, 8, 0.2);
    drum(g, h(0, 5.1, 0), h(0, 6, 0), 1.3, M.IRON, 6);
    const hk = [h(0, 5.8, -2.6), h(0, 8, -1.8), h(0, 8.7, 0), h(0, 8, 1.8), h(0, 5.8, 2.6)];
    for (let i = 0; i < 4; i++) line(g, hk[i], hk[i + 1], M.RAIL, i % 2 ? 3 : 4);
    // yarık: sersemken ve ölürken titrer
    const sm = P.slit > 0.5 ? M.LAMP : M.GLASS;
    for (let j = 0; j < 4; j++) { const a0 = -1.1 + j * 0.55, a1 = a0 + 0.55, p = (a, y) => h(Math.cos(a) * 4.2, y, Math.sin(a) * 4.2); pq(g, p(a0, -0.5), p(a1, -0.5), p(a1, 1), p(a0, 1), sm, F.p); }
    for (const a of [-1.55, 1.55, 2.6, -2.6]) line(g, h(Math.cos(a) * 4.2, -2.2, Math.sin(a) * 4.2), h(Math.cos(a) * 4.2, 2.2, Math.sin(a) * 4.2), M.RAIL, 3);
    A.eye = h(4.3, 0.25, 0); A.head = F.p;
    // sersemlik: başın çevresinde dönen kıvılcımlar
    if (P.daze > 0.05) for (let i = 0; i < 5; i++) { const a = t * 6 + i * TAU / 5, q = h(Math.cos(a) * 6.5, 7.5 + Math.sin(t * 9 + i) * 0.8, Math.sin(a) * 6.5); if (hash(i + Math.floor(t * 14)) < P.daze) { dot(g, q, M.LAMP, 4); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(g, q, M.LAMP, 2, dx, dy); } }
  }
  // ---- emme: madenin hurdası çekirdeğe doğru sarmal çizer
  if (P.suck > 0.05) for (let i = 0; i < 9; i++) {
    const k = fr(t * 0.9 + hash(i)), R = 22 * (1 - k) + 3, a = hash(i + 5) * TAU + k * 4, q = [core[0] + fw[0] * R * 0.6 + Math.cos(a) * R * 0.6 * sd[0], core[1] + Math.sin(a) * R * 0.5, core[2] + fw[2] * R * 0.6 + Math.cos(a) * R * 0.6 * sd[2]];
    if (k < P.suck) { const tl = norm(sub(core, q)); line(g, q, mad(q, tl, -2.2), M.CHAIN, 3); dot(g, q, i % 3 ? M.RAIL : M.RUST, 4); }
  }
  // ---- ölüm: gövdeden kopan levha ve somunlar
  if (FALL > 0) for (let i = 0; i < 6; i++) {
    const F0 = frame(C(-3 + hash(i + 20) * 10, -10 + hash(i + 30) * 12, (i % 2 ? 1 : -1) * 11), chest.f, chest.u, chest.r), Fb = drop(F0, 10 + i, 0.6, 12);
    if (Fb !== F0) box(g, Fb, -0.5, 0.5, 1.6 + hash(i) * 1.6, 1.4 + hash(i + 1) * 1.4, 1.4 + hash(i) * 1.4, 1.2 + hash(i + 1) * 1.2, i % 3 ? M.PLATE : M.IRON);
  }
  // yığılınca yerin altına taşan uzuvlar zemine yaslanır
  if (FALL > 0) { for (let i = 1; i < g.nv * 3; i += 3) if (g.p[i] < 0.2) g.p[i] = 0.2; for (const L of [g.lines, g.dots]) for (let i = 1, n = L === g.lines ? 8 : 7; i < L.length; i += n) { if (L[i] < 0.2) L[i] = 0.2; if (n === 8 && L[i + 3] < 0.2) L[i + 3] = 0.2; } }
  return A;
}
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// ---------- duruşlar ----------
const DIE_T = 2, FRONT = { magnet: 1, polarity: 1.3, absorb: 1.3, scrap: 1 };
const pole = v => v > 0 ? 'r' : v < 0 ? 'b' : 'd';
// dururken göğsündeki çekirdeği kameraya açar; vuruş ve hücum yandan okunur
const view = o => viewOf(o.yaw, o.dying ? 0.8 : FRONT[o.act] ? FRONT[o.act] : o.act === 'melee' || o.act === 'rail' ? 0.45 : 0.75 - 0.2 * o.walk, 0.45);
function pose(o) {
  const t = o.t, A = o.A, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1;
  const br = Math.sin(t * 1.6 + o.wob), creak = bump(0, 0.04, 0.1, 0.3, fr(t / 3.7 + o.wob));
  let x = 0, y = br * 0.45 - 0.6, lean = 5, twist = 0, roll = creak * 2, rate = 16, lookW = 0.6, sink = 0, shadow = 1, alpha = 1;
  let ht = 0.42 + 0.08 * br, pl = 'd', sh = creak * 0.5, chain = 0.3, drag = 0, lift = 0, open = 0, suck = 0, lump = 0, spark = 0, daze = 0, slit = 1, fall = 0, spinW = 0;
  const bend = [5 + br * 1.2, 0, 0], head = [-4 + br * 2, 0, creak * 6], R = { sw: 8 - br * 2, ab: 22 + creak * 6, tw: 0, el: 26 }, L = { sw: 4 + br * 2, ab: 20, tw: 0, el: 30 }, fR = [1.5, 0, 7.6], fL = [-1.5, 0, -7.6], cl = [0.25, 0.25];
  if (w > 0.01) {
    // ağır, sallantılı adım: her basışta gövde çöker, zincirler savrulur; kollar sarkık sallanır
    const ph = o.ph, a = stride(ph, 6, 3.6, 0.6), b = stride(ph + 0.5, 6, 3.6, 0.6), c1 = Math.cos(ph * TAU), s1 = Math.sin(ph * TAU), dip = Math.abs(Math.cos(ph * TAU));
    fR[0] += a[0] * w; fR[1] += a[1] * w; fL[0] += b[0] * w; fL[1] += b[1] * w;
    y -= (0.4 + 1.6 * (1 - dip)) * w; roll += s1 * 5 * w; twist -= c1 * 7 * w; bend[1] += c1 * 9 * w; head[1] -= c1 * 6 * w; lean += 3 * w;
    R.sw -= c1 * 14 * w; L.sw += c1 * 14 * w; chain += 0.5 * w; drag = 0.25 * w; sh += Math.pow(1 - dip, 6) * 0.6 * w;
  }
  const act = o.act, pol = A && Number.isFinite(A.pol) && A.pol ? pole(A.pol) : 'r';
  if (act === 'magnet' && A) {
    // kalkan: bacaklar açılır, iki kol çekirdeğin önünde kenetlenir, çekirdek göz alır
    const k = ss(0, 0.35, o.since) * (1 - ss(2.75, 3, o.since)), q = Math.sin(t * 30) * 0.25 * k;
    for (const a of [R, L]) { a.sw = lerp(a.sw, 82, k); a.ab = lerp(a.ab, 6, k); a.tw = lerp(a.tw, -85, k); a.el = lerp(a.el, 75, k); }
    fR[2] += 2 * k; fL[2] -= 2 * k; fR[0] += 1.5 * k; fL[0] -= 2.5 * k; y -= 2.6 * k; lean += 6 * k; bend[0] += 4 * k; head[0] += 4 * k; x += q;
    cl[0] = cl[1] = 0.25 + 0.75 * k; ht = lerp(ht, 1.55 + 0.1 * Math.sin(t * 20), k); pl = k > 0.05 ? pol : pl; lift = 0.3 * k; chain += 0.4 * k; rate = 22; lookW = 0.2;
  } else if (act === 'polarity' && A) {
    // kollar iki yana açılır, çekirdek kutbunun renginde dolar; sonra nabız gibi atar, gövde titrer, zincirler alanda havalanır
    const wd = o.stage === 'wind' ? ss(0, 1, o.wind) : 1, pu = o.stage === 'pulse' ? ss(0, 0.12, o.sinceStage) * (1 - ss(1.3, 1.5, o.sinceStage)) : 0, beat = Math.max(0, Math.sin(t * 15)), k = Math.max(wd * (o.stage === 'wind' ? 1 : 1 - ss(1.3, 1.5, o.sinceStage)), 0);
    for (const a of [R, L]) { a.sw = lerp(a.sw, 20, k); a.ab = lerp(a.ab, 62 + 6 * pu * beat, k); a.tw = lerp(a.tw, 55, k); a.el = lerp(a.el, 45, k); }
    y += 1 * k - 1.2 * pu * beat; lean -= 7 * k; bend[0] -= 6 * k; head[0] += 10 * k; x += Math.sin(t * 47) * 0.45 * pu; roll += Math.sin(t * 39) * 1.5 * pu;
    cl[0] = cl[1] = 0.25 + 0.75 * k; ht = lerp(ht, 0.9 + 0.5 * wd + pu * (0.15 + 0.3 * beat), k); pl = pol; sh = Math.max(sh, 0.5 * pu); lift = (0.25 * wd + 0.55 * pu) * (pol === 'b' ? 1 : 0.6); chain += 0.6 * pu; rate = 28; lookW = 0.3;
  } else if (act === 'scrap' || (o.prev === 'scrap' && !act && o.since < 0.45)) {
    // eğilip iki kıskaçla yerden hurda kepçeler, sonra kollarını başının üstüne savurup fırlatır
    const c = act ? o.since : 0.8 + o.since, dn = bump(0, 0.22, 0.3, 0.42, c), up = bump(0.32, 0.46, 0.62, 1.15, c);
    for (const a of [R, L]) { a.sw = lerp(a.sw + 22 * dn, 28, up); a.ab = lerp(a.ab - 6 * dn, 142, up); a.el = lerp(a.el + 30 * dn, 22, up); }
    y += -4 * dn + 1.2 * up; lean += 18 * dn - 12 * up; bend[0] += 12 * dn - 10 * up; head[0] += -6 * dn + 18 * up; fR[0] += 2 * dn; fL[0] -= 2 * dn;
    cl[0] = cl[1] = 0.6 * dn + 0.9 * up; lump = ss(0.12, 0.22, c) * (1 - ss(0.4, 0.46, c)); ht = Math.max(ht, 0.6 + 0.5 * up); chain += 0.8 * up; sh = Math.max(sh, 0.4 * up); rate = 34; lookW = 0.2;
  } else if (act === 'absorb' && A) {
    // geriye yaslanır, kollar ardına kadar açık; göğüs kapakları aralanır, çekirdek hurdayı içine çeker
    const c = o.since, k = ss(0, 0.35, c) * (1 - ss(1.75, 2, c)), q = Math.sin(t * 22);
    for (const a of [R, L]) { a.sw = lerp(a.sw, 32, k); a.ab = lerp(a.ab, 70, k); a.tw = lerp(a.tw, 30, k); a.el = lerp(a.el, 35, k); }
    lean -= 12 * k; bend[0] -= 10 * k; head[0] += 12 * k; y += 0.6 * k; x -= 1 * k + q * 0.2 * k; fR[0] += 2 * k; fL[0] -= 2 * k;
    open = k; suck = k; cl[0] = cl[1] = 0.25 + 0.75 * k; ht = lerp(ht, 1.35 + 0.15 * q, k); pl = A.pol < 0 ? 'b' : 'r'; lift = 0.5 * k; chain += 0.4 * k; sh = Math.max(sh, 0.25 * k); rate = 24; lookW = 0.1;
  } else if (act === 'rail' && A) {
    if (o.stage === 'aim') {
      // çömelir, omzunu öne verir; ayağıyla yeri eşeler
      const k = ss(0, 1, o.wind), sc = Math.max(0, Math.sin(t * 16));
      y -= 3.4 * k; lean += 16 * k; bend[0] += 8 * k; twist += 16 * near * k; bend[1] += 8 * near * k; head[0] += 10 * k;
      fR[0] -= 4 * k; fL[0] += 3 * k; (near > 0 ? fR : fL)[1] += sc * 1.8 * k; (near > 0 ? fR : fL)[0] -= sc * 2 * k;
      R.sw += 20 * k; L.sw += 20 * k; R.el += 30 * k; L.el += 30 * k; cl[0] = cl[1] = 0; ht = 0.5 + 0.5 * k; pl = pol; chain += 0.3 * k; rate = 24; lookW = 0.3;
    } else if (o.stage === 'dash') {
      // kaçak vagon gibi öne yatar; bacaklar hızla döner, tekerlekler fırıl fırıl, ayaklardan kıvılcım
      const k = ss(0, 0.12, o.sinceStage), ph = o.sinceStage * 3.2, a = stride(ph, 7.5, 4.6, 0.5), b = stride(ph + 0.5, 7.5, 4.6, 0.5), c1 = Math.cos(ph * TAU);
      fR[0] = lerp(fR[0], 3 + a[0], k); fR[1] = a[1] * k; fL[0] = lerp(fL[0], 3 + b[0], k); fL[1] = b[1] * k; x += 3 * k; y -= (2 + 1.2 * Math.abs(Math.sin(ph * TAU))) * k;
      lean += 30 * k; bend[0] += 10 * k; head[0] += 18 * k; twist += 10 * near * k + c1 * 5 * k; roll += Math.sin(ph * TAU) * 4 * k;
      R.sw += -32 * k - c1 * 20 * k; L.sw += -32 * k + c1 * 20 * k; R.ab += 12 * k; L.ab += 12 * k; R.el += 30 * k; L.el += 30 * k;
      cl[0] = cl[1] = 0; spinW = o.sinceStage * 30; spark = k; drag = 1.1 * k; chain += 0.5 * k; ht = 0.9; pl = pol; sh = 0.3 * k; rate = 40; lookW = 0;
    } else {
      // sersem: duvara çarpmış; sallanır, baş düşer, yarık cızırdar, kıvılcımlar uçuşur
      const k = bump(0, 0.12, 0.95, 1.2, o.sinceStage), c = t * 5;
      y -= 2.4 * k; lean += -6 * k + Math.sin(c) * 5 * k; roll += Math.cos(c * 0.8) * 9 * k; x += Math.sin(c) * 0.8 * k; head[0] -= 26 * k; head[2] += Math.sin(c - 0.6) * 22 * k; head[1] += Math.cos(c) * 10 * k;
      for (const a of [R, L]) { a.sw = lerp(a.sw, -4, k); a.ab = lerp(a.ab, 10, k); a.el = lerp(a.el, 6, k); }
      fR[2] += 1.5 * k; fL[2] -= 1.5 * k; daze = k; slit = hash(Math.floor(t * 13)) > 0.45 ? 1 : 0; ht = lerp(ht, 0.25 + 0.3 * hash(Math.floor(t * 9)), k); sh = 0.5 * k; chain += 0.5 * k; rate = 26; lookW = 0;
    }
  } else if (act === 'melee') {
    // yakın yandaki kıskacını başının üstüne kaldırır, çekiç gibi indirir
    const [up, dn] = meleeK(o), N = near > 0 ? R : L, O = near > 0 ? L : R;
    N.sw += 150 * up + 64 * dn; N.ab += -8 * up - 10 * dn; N.el += 30 * up - 18 * dn; O.sw += -10 * up + 14 * dn; O.ab += 8 * up;
    lean += -8 * up + 18 * dn; bend[0] += -6 * up + 12 * dn; twist += near * (-12 * up + 10 * dn); head[0] += 8 * up - 6 * dn; y += 0.8 * up - 3.2 * dn; x += -1 * up + 2.4 * dn;
    (near > 0 ? fR : fL)[0] += 3 * dn; cl[near > 0 ? 0 : 1] = 0; sh = Math.max(sh, 0.6 * dn); chain += 0.8 * dn; rate = 44; lookW = 0.3;
  }
  if (o.rage && !dead) {
    // öfke: önce kollarını kaldırıp kükrer (levhalar zangırdar); sonra çekirdek kırmızıyla mavi arasında çırpınır
    const r = o.rageT < 1.25 ? bump(0, 0.25, 0.85, 1.2, o.rageT) : 0;
    for (const a of [R, L]) { a.sw = lerp(a.sw, 30, r); a.ab = lerp(a.ab, 138, r); a.el = lerp(a.el, 38, r); }
    lean -= 12 * r; bend[0] -= 8 * r; head[0] += 22 * r; y += 1 * r; x += Math.sin(t * 50) * 0.4 * r; cl[0] = cl[1] = Math.max(cl[0], r);
    sh = Math.max(sh, 0.9 * r, 0.35); chain += 0.6 * r; lookW *= 1 - r;
    if (o.rageT > 0.9 && !A) { pl = fr(t * 3.1 + Math.sin(t * 7) * 0.3) < 0.5 ? 'r' : 'b'; ht = Math.max(ht, 0.95 + 0.2 * Math.sin(t * 17)); }
    else if (r > 0.05) { ht = Math.max(ht, 1.5 * r); pl = 'r'; }
  }
  if (o.hurt > 0 && !dead) {
    rate = Math.max(rate, 30);
    const h = o.hurt * o.hurt, back = clamp(o.hx * Math.cos(o.view), -1, 1);
    lean -= 8 * h; head[0] += 12 * h; head[2] += near * 8 * h; x += back * 1.4 * h; bend[1] += near * 6 * h; sh = Math.max(sh, 1.2 * h); slit = h > 0.4 && hash(Math.floor(t * 30)) > 0.5 ? 0 : slit; chain += 0.6 * h;
  }
  if (dead) {
    // titrer, çekirdek son bir kez parlayıp söner; levhalar ve baş kopar, dizlerinin üstüne çöker, öne devrilip hurda yığınına döner
    const d = o.dying * DIE_T, kn = ss(0.35, 1, d), tp = ss(0.85, 1.45, d), q = 1 - ss(0.2, 0.6, d);
    x += Math.sin(t * 55) * 0.5 * q; sh = 1.2 * q + 0.4 * kn * (1 - tp);
    ht = d < 0.25 ? 1.6 : Math.max(0, 1.2 * (1 - ss(0.25, 1.1, d))); pl = d < 0.25 ? 'r' : d < 1.1 ? 'd' : 'x'; slit = d < 0.7 && hash(Math.floor(t * 20)) > 0.35 ? 1 : 0;
    fall = clamp((d - 0.3) / 1.2, 0, 1);
    y -= 11 * kn + 3 * tp; lean += 10 * kn + 8 * tp; bend[0] += 6 * kn; bend[2] -= near * 26 * tp; x += 2 * tp; head[0] -= 20 * kn; roll -= near * 32 * tp;
    fR[0] = lerp(fR[0], -9, kn); fL[0] = lerp(fL[0], -7, kn); fR[2] += 1.5 * kn; fL[2] -= 1.5 * kn;
    for (const [f, s] of [[fR, 1], [fL, -1]]) { f[0] = lerp(f[0], -3, tp); f[2] = lerp(f[2], s * 5 - near * 6, tp); }
    for (const a of [R, L]) { a.sw = lerp(a.sw, 20, kn) + 30 * tp; a.ab = lerp(a.ab, 30, kn) + 14 * tp; a.el = lerp(a.el, 10, kn); }
    cl[0] = cl[1] = 0.6; chain = 0.3 * (1 - tp); lookW = 0; rate = 26; sink = ss(1.4, 2, d) * 6; alpha = 1 - ss(0.88, 1, o.dying);
  }
  const [ly0, lp0] = aimLocal(o.tx, o.ty + 40, o.view), ly = clamp(ly0, -1.1, 1.1) * lookW, lp = clamp(lp0, -0.5, 0.5) * lookW;
  const rad = a => ({ sw: a.sw * D, ab: a.ab * D, tw: a.tw * D, el: Math.max(0, a.el) * D });
  return {
    rate, x, y, lean: lean * D, twist: twist * D, roll: roll * D, bend: [bend[0] * D, bend[1] * D + ly * 0.25, bend[2] * D], head: [head[0] * D + lp * 0.3, head[1] * D + ly * 0.6, head[2] * D],
    armR: rad(R), armL: rad(L), footR: fR, footL: fL, poleR: [1, 0.1, 0.3], poleL: [1, 0.1, -0.3], near, heat: ht, pole: pl, shake: sh, chain, drag, lift, open, suck, lump, spark, daze, slit, fall, spinW, cl, sink, shadow, alpha,
  };
}
// çekirdeğin hâlesi kutbun renginde
function light(ctx, R, glow, a) {
  const p = R.at('core'), P = R.P; if (!p || P.pole === 'x') return;
  const col = P.pole === 'b' ? '#4a9aff' : P.pole === 'r' ? '#ff4a3a' : '#e0603a';
  glow(p[0], p[1], col, 8 + 14 * P.heat, a * clamp(P.heat * 0.35, 0, 0.6));
}

export const PASGOLEM3D = { w: 156, h: 128, ox: 78, oy: 108, scale: 1.2, tilt: 0.22, mats: MATS, stride: 23, shadow: 19, body: 46, bias: 0.75, turn: 0.45, turnRate: 3, outline: [10, 6, 6], ownDeath: true, view, pose, build, light };
