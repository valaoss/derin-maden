// Poseidon: denizlerin efendisi. İlk hâli üç dişli mızraklı bir tanrı: koyu fırtına rengi ten, tenin altında yanan şimşek damarları,
// uzun siyah saç ve sakal, altın kemerli yırtık beyaz etek, altın bileklikler; ayaklarının altında kabaran suyun üstünde durur.
// Öfkelenince su kozasına sarınır ve içinden yengeç gövdeli bir dev çıkar: geniş kabuk, altı eklemli bacak, iki dev kıskaç,
// kabuktan yükselen taş ve sudan gövde, başında yengeç bacaklarından taç, elinde dev mızrak. Dev kameraya dönük durur, yana yana yürür.
import { dot } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mad, mix, norm, cross, sub, at, turn, frame, bone, ball, ell, tube, skin, spike, leaf, ik, reach, aimLocal, meleeK, viewOf, hash, scaleGeo } from './rig.js';
import { biped } from './biped.js';
import { POSEIDON } from '../../data/balance.js';

const M = { POOL: 21, SKIN: 1, VEIN: 2, FACE: 3, HAIR: 4, CLOTH: 5, CLOTH_B: 6, GOLD: 7, TRI: 8, EYE: 9, WATER: 10, MIST: 11, FOAM: 12, ORB: 13, TGLOW: 14, STONE: 15, SHELL: 16, CLAW: 17, HORN: 18, DARK: 19, BEARD: 20 };
const S = { hip: 20, spine: 11.5, neck: 3.4, headX: 0.5, shW: 6.6, shY: -0.6, hipW: 2.4, arm: [8.6, 8.2], leg: [10, 9.6], ankle: 1.4 };
// devin gövdesi kabuğun üstünden yükselir (bacakları yok: kalça kabuğa gömülü)
const S2 = { hip: 22, spine: 17, neck: 6.4, headX: 1.2, shW: 12.5, shY: -1, hipW: 4, arm: [14, 13], leg: [4, 4], ankle: 0 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
let glowK = 1, now = 0;
// şimşek damarı: uzuv boyunca kıvrılan ve çevresini dolanan ince parlak çizgiler; nabız gibi atar
const veins = (su, sv, w, id) => (u, v, i, out) => {
  const a = Math.abs(fr(u * su + Math.sin(v * TAU * 2 + u * 0.3) * 0.16) - 0.5), b = Math.abs(fr(v * sv + Math.sin(u * 0.55) * 0.13) - 0.5);
  if (glowK > 0.05 && (a < w || b < w * 0.8)) { out.id = id; return 0.3 + 0.55 * glowK * (0.8 + 0.2 * Math.sin(now * 4 - u * 0.5)); }
  return i;
};
const swirl = (u, v, i) => Math.min(0.7, i) + (fr(v * 3 + u * 0.08 - now * 0.9) < 0.25 ? 0.2 : 0);
const SEA = ramp('#0c2c5c', '#1c5ca4', '#3a9ad8', '#8ad8ff', '#e8fbff');
const MATS = [];
MATS[M.SKIN] = { ramp: ramp('#0a0e18', '#141c2c', '#243248', '#384c68', '#58708e'), px: veins(0.085, 1.5, 0.03, M.VEIN) };
MATS[M.VEIN] = { ramp: ramp('#2a7ac8', '#5ab4f0', '#9ad8ff', '#d8f4ff', '#ffffff'), flat: true, glow: 1 };
MATS[M.FACE] = { ramp: ramp('#1c2430', '#34425a', '#526684', '#7890ac', '#a8bcd0') };
MATS[M.HAIR] = { ramp: ramp('#020306', '#06080e', '#0c1018', '#161c28', '#283244') };
MATS[M.CLOTH] = { ramp: ramp('#6a7684', '#98a4b0', '#c4ced8', '#e6ecf2', '#ffffff'), back: M.CLOTH_B };
MATS[M.CLOTH_B] = { ramp: ramp('#3a4450', '#5a6672', '#7e8a96', '#a2aeba', '#c6d0da') };
MATS[M.GOLD] = { ramp: ramp('#3a2408', '#7a5214', '#c08a28', '#f0c050', '#fff0a8') };
MATS[M.TRI] = { ramp: ramp('#0e0a08', '#261a12', '#4a3622', '#7c5e38', '#b8945a') };
MATS[M.EYE] = { ramp: ramp('#5ab4f0', '#9ad8ff', '#d8f4ff', '#f4fcff', '#ffffff'), flat: true, glow: 1 };
MATS[M.WATER] = { ramp: SEA, dither: 2, soft: true, glow: 0.45, px: swirl, back: M.WATER };
MATS[M.MIST] = { ramp: SEA, dither: 1, soft: true, glow: 0.3, px: swirl, back: M.MIST };
MATS[M.FOAM] = { ramp: ramp('#8ac8e8', '#b8e4f8', '#dcf4ff', '#f4fcff', '#ffffff'), flat: true, glow: 0.8 };
MATS[M.ORB] = { ramp: SEA, soft: true, glow: 0.6, px: swirl };
MATS[M.TGLOW] = { ramp: ramp('#2a7ac8', '#5ab4f0', '#9ad8ff', '#d8f4ff', '#ffffff'), flat: true, glow: 1, soft: true };
// devin gövdesi: ıslak taş; çatlaklarından köpük ışır
MATS[M.STONE] = { ramp: ramp('#050b14', '#0c1a28', '#173044', '#284e68', '#4c88a4'), px: veins(0.055, 2, 0.03, M.FOAM) };
// ayak altındaki su: düz, konturuz
MATS[M.POOL] = { ramp: ramp('#0c2c5c', '#164c8c', '#2a7ac0', '#4aa4e0', '#8ad8ff'), soft: true, glow: 0.35, px: (u, v, i) => i * 0.8 + (fr(u * 0.5 - now * 0.7) < 0.2 ? 0.2 : 0) };
MATS[M.SHELL] = { ramp: ramp('#140806', '#32140c', '#602814', '#984420', '#d87c44'), px: (u, v, i) => i - (fr(u * 0.27) < 0.13 ? 0.2 : 0) + (hash(Math.floor(u * 1.3) * 7 + Math.floor(v * 9)) < 0.12 ? 0.22 : 0) };
MATS[M.CLAW] = { ramp: ramp('#2a0e08', '#64200e', '#b04a1c', '#ee8a3c', '#ffd89a'), px: (u, v, i) => i + u * 0.012 };
MATS[M.HORN] = { ramp: ramp('#0c0404', '#22090a', '#481410', '#7a2a1a', '#b85a34'), px: (u, v, i) => i - (fr(u * 0.32) < 0.3 ? 0.24 : 0) };
MATS[M.DARK] = { ramp: ramp('#020408', '#04080e', '#081018', '#0c1824', '#142434'), flat: true };
MATS[M.BEARD] = { ramp: ramp('#3a6a8a', '#6aa0c0', '#a0d0e8', '#d0ecf8', '#ffffff'), glow: 0.3, px: (u, v, i) => i + (fr(u * 0.4 - now * 1.6) < 0.3 ? 0.2 : 0) };

// üç dişli mızrak. grip: tutulan nokta, bd: yön, side: dişlerin açıldığı eksen, gk: tutuşun sap üstündeki yeri (0 dip .. 1 boyun), k: kalınlık
function trident(g, grip, bd, side, L, gk, k, m, acc) {
  const butt = mad(grip, bd, -L * 0.78 * gk), neck = mad(butt, bd, L * 0.78), tip = mad(neck, bd, L * 0.22);
  bone(g, butt, neck, 0.6 * k, 0.6 * k, m, 1, 5, true);
  spike(g, butt, mad(butt, bd, -2.4 * k), 0.8 * k, acc, 4);
  ball(g, mad(butt, bd, L * 0.3), 0.95 * k, acc, 5); ball(g, mad(neck, bd, -1.5 * k), 1.1 * k, acc, 5);
  bone(g, mad(neck, side, -3.5 * k), mad(neck, side, 3.5 * k), 0.85 * k, 0.85 * k, m, 1, 5, true);
  tube(g, [neck, mad(neck, bd, L * 0.12), tip], [0.9 * k, 0.75 * k, 0.12 * k], 5, m);
  for (const s of [-1, 1]) {
    const a = mad(neck, side, s * 3.3 * k);
    tube(g, [a, mad(mad(a, bd, L * 0.07), side, s * 0.9 * k), mad(mad(a, bd, L * 0.18), side, s * 0.2 * k)], [0.8 * k, 0.65 * k, 0.12 * k], 5, m);
    spike(g, mad(mad(a, bd, L * 0.1), side, s * 0.7 * k), mad(mad(a, bd, L * 0.06), side, s * 2.3 * k), 0.5 * k, acc, 3);
  }
  return tip;
}
// mızrağın gövdeye göre yönü: a = yükselme (0 ileri, 90 yukarı), out = yana açılma; dişler kameraya dönük düzlemde açılır
function aimOf(fw, sd, cam, a, out) {
  const ca = Math.cos(a), bd = norm([fw[0] * ca + sd[0] * out, Math.sin(a), fw[2] * ca + sd[2] * out]);
  let side = cross(bd, cam); if (Math.hypot(side[0], side[1], side[2]) < 0.2) side = cross(bd, [0, 1, 0]);
  return [bd, norm(side)];
}
// ayak altında kabaran su: yayvan tümsek, kenarında köpük
function mound(g, x, r, h, t, n = 9) {
  ell(g, frame([x, h * 0.25, 0]), r, h, r, M.POOL, 10, 4);
  for (let i = 0; i < n; i++) { const a = i / n * TAU + t * 0.9, k = 0.75 + 0.25 * Math.sin(t * 3 + i * 2.1); dot(g, [x + Math.cos(a) * r * k, h * (0.4 + 0.5 * Math.abs(Math.sin(t * 2.3 + i))), Math.sin(a) * r * k], M.FOAM, 3 + (i & 1)); }
}
// su kozası (dönüşüm) ve su sütunu (sudan çıkış)
// burst: koza patlar (genişler, seyrelir, dağılır)
function cocoon(g, c, k0, tall, t, burst) {
  const F = turn(frame(c), t * 2.2), k = k0 * (1 + 0.8 * burst);
  ell(g, F, 17 * k, tall * k, 17 * k, burst > 0.6 ? M.MIST : burst > 0.25 || k0 <= 0.92 ? M.WATER : M.ORB, 12, 7); if (burst < 0.6) ell(g, F, 20 * k, tall * 1.1 * k, 20 * k, M.MIST, 12, 6);
  for (let i = 0; i < 14; i++) { const a = i * 2.4 + t * 5, y = (fr(i * 0.37 + t * 0.6) - 0.5) * 2 * tall * k * 0.8, r = 17.5 * k * Math.sqrt(Math.max(0.05, 1 - (y / (tall * k)) * (y / (tall * k)))); dot(g, [c[0] + Math.cos(a) * r, c[1] + y, c[2] + Math.sin(a) * r], M.FOAM, 4); }
}
function column(g, x, h, r, t) {
  const pts = [], n = 7;
  for (let i = 0; i <= n; i++) { const k = i / n; pts.push([x + Math.sin(t * 7 + k * 5) * 1.6 * k, k * h, Math.cos(t * 6 + k * 4) * 1.6 * k]); }
  tube(g, pts, i => r * (1.25 - 0.5 * i / n) * (1 + 0.1 * Math.sin(t * 9 + i)), 9, M.WATER); tube(g, pts, i => r * 1.5 * (1.2 - 0.6 * i / n), 9, M.MIST);
  for (let i = 0; i < 12; i++) { const k = fr(i * 0.31 + t * 1.3), a = i * 2.1 + t * 6; dot(g, [x + Math.cos(a) * r * 1.2, k * h, Math.sin(a) * r * 1.2], M.FOAM, 4); }
}

// ---------- tanrı ----------
function buildGod(g, P, o, A) {
  const t = o.t, K = biped(P, S), { pel, waist, chest, head } = K, br = 1 + P.br;
  const fw = norm([pel.f[0], 0, pel.f[2]]), sd = [fw[2], 0, -fw[0]], cam = [Math.sin(o.view), 0, Math.cos(o.view)];
  mound(g, P.x * 0.5, 6.5 * P.mound, 2.2 * P.mound, t);
  // bacaklar: çıplak ayak, altın halhallar
  for (const L of [K.legR, K.legL]) {
    bone(g, L.hip, L.knee, 2.5, 2, M.SKIN, 1.15); ball(g, L.knee, 2, M.SKIN, 6); bone(g, L.knee, L.ank, 2, 1.3, M.SKIN, 1.28);
    bone(g, mad(L.ank, [0, 1, 0], 2.6), mad(L.ank, [0, 1, 0], 0.8), 1.75, 1.6, M.GOLD, 1, 6);
    bone(g, [L.ank[0], L.foot[1] + 1, L.ank[2]], mad([L.foot[0], L.foot[1] + 0.7, L.foot[2]], fw, 3.4), 1.3, 0.9, M.FACE, 1, 5, true);
  }
  // etek: belden baldıra inen yırtık beyaz kumaş; önü yırtmaçlı, hareketle geride kalır
  const N = 9, rows = [[], [], [], []];
  for (let j = 0; j <= N; j++) {
    const a = j / N * TAU + 0.9, c = Math.cos(a), s = Math.sin(a), rag = (j % 2 ? 0 : 2.4) + hash(j % N) * 1.6;
    for (let i = 0; i < 4; i++) {
      const k = i / 3, R = 1 + k * 0.45, sw = Math.sin(t * 2.2 + j * 1.3 + i) * 0.55 * k + P.drag * 5 * k * k, p = at(pel, c * 4.3 * R, 0.8 - k * (11.5 + rag), s * 5.9 * R);
      rows[i].push([p[0] - fw[0] * sw, p[1] + P.drag * 1.6 * k * k, p[2] - fw[2] * sw]);
    }
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < N; j++) {
    if (j === 8 && i > 0) continue;
    leaf(g, rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], M.CLOTH); leaf(g, rows[i][j], rows[i + 1][j + 1], rows[i + 1][j], M.CLOTH);
  }
  // gövde: dar bel, geniş göğüs ve omuzlar
  skin(g, [
    { p: at(pel, 0, -2.4, 0), u: pel.f, rx: 3.5, ry: 3 }, { p: at(pel, 0, 0.6, 0), u: pel.f, rx: 3.9, ry: 3.2 }, { p: waist.p, u: waist.f, rx: 3.2, ry: 2.7 },
    { p: at(chest, 0.4, -4.4, 0), u: chest.f, rx: 5 * br, ry: 3.8 * br }, { p: at(chest, 0.5, -1.2, 0), u: chest.f, rx: 6.5, ry: 4.4 * br },
    { p: at(chest, 0, 1.4, 0), u: chest.f, rx: 3, ry: 2.6 }, { p: at(chest, 0.4, 3.2, 0), u: chest.f, rx: 1.8, ry: 1.8 },
  ], 10, M.SKIN, { sub: 2 });
  ell(g, frame(at(pel, 0, 0.9, 0), pel.f, pel.u, pel.r), 4.7, 1.3, 6.3, M.GOLD, 10, 3);
  ball(g, at(pel, 4.7, 0.8, 0), 1.3, M.GOLD, 5);
  // kollar: omuz, pazı, altın bileklik
  for (const Ar of [K.R, K.L]) {
    ball(g, Ar.sh, 2.7, M.SKIN, 6); bone(g, Ar.sh, Ar.el, 2.5, 1.9, M.SKIN, 1.28); ball(g, Ar.el, 1.8, M.SKIN, 5); bone(g, Ar.el, Ar.wr, 1.8, 1.4, M.SKIN, 1.2);
    bone(g, mix(Ar.el, Ar.wr, 0.5), mix(Ar.el, Ar.wr, 0.95), 1.95, 1.75, M.GOLD, 1, 6); ball(g, at(Ar.hand, 1.1, 0, 0), 1.6, M.FACE, 5);
  }
  // baş: sert yüz, kara kaşlar, ışıyan gözler; uzun saç geride dalgalanır, sakal göğse iner
  ell(g, frame(at(head, 0.3, 2.7, 0), head.f, head.u, head.r), 2.5, 3, 2.4, M.FACE, 9, 6);
  ell(g, frame(at(head, -1.3, 3.7, 0), head.f, head.u, head.r), 2.5, 2.8, 2.8, M.HAIR, 9, 5);
  tube(g, [at(head, 2.2, 3.7, -1.8), at(head, 2.75, 3.4, 0), at(head, 2.2, 3.7, 1.8)], [0.45, 0.55, 0.45], 4, M.HAIR);
  for (let i = -2; i <= 2; i++) {
    const b = at(head, -2.7 + Math.abs(i) * 0.5, 3.4 - Math.abs(i) * 0.5, i * 1.2), sw = Math.sin(t * 1.9 + i * 1.4), dr = 1.6 + P.drag * 5;
    tube(g, [b, [b[0] - fw[0] * dr, b[1] - 3.6, b[2] - fw[2] * dr + sw * 0.4], [b[0] - fw[0] * (dr * 1.7 + sw * 0.5), b[1] - 7.6 + P.drag * 2.4, b[2] - fw[2] * dr * 1.7 + sw * 0.9]], [1.2, 1, 0.35], 5, M.HAIR);
  }
  ell(g, frame(at(head, 1.6, 0.9, 0), head.f, head.u, head.r), 1.3, 1.5, 1.8, M.HAIR, 7, 4);
  tube(g, [at(head, 2, 0.3, 0), at(head, 2.3, -1.3, 0), at(head, 1.9, -2.6 + Math.sin(t * 2) * 0.2, 0)], [1.15, 0.9, 0.3], 5, M.HAIR);
  for (const s of [-1, 1]) { const e = at(head, 2.75, 2.9, s * 1.05); dot(g, e, M.EYE, P.eye > 0.5 ? 4 : 1); if (s > 0 === !(P.near < 0)) A.eye = e; }
  // mızrak: elde; fırlatılınca yoktur, sudan yeniden biçimlenir
  const H = K.R.hand, grip = at(H, 1.1, 0, 0), [bd, side] = aimOf(fw, sd, cam, P.triA, P.triOut);
  if (P.tri > 0.06) A.tip = trident(g, grip, bd, side, 36 * Math.min(1, P.tri), P.grip, P.tri < 0.98 ? 1.15 : 1, P.tri < 0.98 ? M.TGLOW : M.TRI, P.tri < 0.98 ? M.TGLOW : M.GOLD);
  else { A.tip = grip; if (P.triW > 0.05) for (let i = 0; i < 5; i++) dot(g, mad(grip, [Math.sin(t * 9 + i * 2), Math.cos(t * 7 + i), Math.sin(t * 5 + i * 3)], 2.2), M.FOAM, 4); }
  A.chest = at(chest, 4, -2.4, 0); A.hand = grip; A.head = at(head, 0, 3, 0); A.mouth = at(head, 3, 1.4, 0);
}

// ---------- dev ----------
const HIPS = [[6.5, -1, 17], [0, -1.6, 20], [-6.5, -1, 17]];
function buildTitan(g, P, o, A) {
  const t = o.t, T = turn(frame([P.x, 15 + P.y, 0]), 0, P.pitch, P.roll);
  const K = biped({ x: P.x - 3, y: P.y, lean: P.lean, twist: P.twist, roll: P.roll, bend: P.bend, head: P.head, armR: P.armR, armL: P.armL, footR: [0, 0, 3], footL: [0, 0, -3] }, S2), { pel, waist, chest, head } = K;
  const fw = norm([pel.f[0], 0, pel.f[2]]), sd = [fw[2], 0, -fw[0]], cam = [Math.sin(o.view), 0, Math.cos(o.view)], br = 1 + P.br;
  mound(g, P.x, 30, 2.6, t, 18);
  // altı bacak: diz yukarıda, sivri uç yerde
  for (let i = 0; i < 6; i++) {
    const k = i >> 1, s = i & 1 ? -1 : 1, hip = at(T, HIPS[k][0], HIPS[k][1], HIPS[k][2] * s), ft = reach(hip, P.feet[i], 38), knee = ik(hip, ft, 17, 22, [0.1 * (1 - k), 1, s * 0.5]), mid = mix(knee, ft, 0.55);
    bone(g, hip, knee, 2.9, 2.2, M.SHELL, 1.15, 6); ball(g, knee, 2.4, M.SHELL, 6); bone(g, knee, mid, 2.2, 1.6, M.SHELL, 1.1, 6); bone(g, mid, ft, 1.6, 0.3, M.CLAW, 1, 5, true);
    spike(g, knee, mad(mad(knee, [0, 1, 0], 3.4), T.r, s * 1.4), 1, M.HORN, 3);
  }
  // kabuk: enine geniş; kenarında dikenler, sırtında ikinci bir kubbe
  ell(g, T, 13.5, 8, 24, M.SHELL, 14, 7);
  ell(g, frame(at(T, -4, 4, 0), T.f, T.u, T.r), 9, 6, 16, M.SHELL, 12, 5);
  for (let i = -3; i <= 3; i++) { const a = i * 0.4, c = Math.cos(a), s = Math.sin(a); spike(g, at(T, 12.6 * c, 0.6, 23 * s), at(T, 17.4 * c, 2.2 - Math.abs(i) * 0.3, 29.5 * s), 1.7, M.HORN, 4); }
  // kıskaçlar: omuz kabuğun ön köşesinde; bilekte iri pençe, üst parmak açılıp kapanır
  for (const [s, tg, open] of [[1, P.pinR, P.open[0]], [-1, P.pinL, P.open[1]]]) {
    const sh = at(T, 10, 1.5, s * 19), W = reach(sh, at(T, tg[0], tg[1], tg[2] * s), 26.5), el = ik(sh, W, 14, 13, [0.25, 1, s * 0.6]);
    const d = norm(sub(W, el)), u = norm(cross(cross(d, [0, 1, 0.001]), d)), r = cross(d, u);
    bone(g, sh, el, 3.4, 2.8, M.SHELL, 1.2, 7); ball(g, el, 3, M.SHELL, 6); bone(g, el, W, 2.8, 3, M.SHELL, 1.15, 7);
    ell(g, frame(mad(W, d, 5), d, u, r), 7.4, 5, 4, M.CLAW, 10, 6);
    tube(g, [mad(mad(W, d, 9), u, -2.2), mad(mad(W, d, 15), u, -1.9), mad(mad(W, d, 19.5), u, 0.4)], [3, 2.1, 0.3], 6, M.CLAW);
    tube(g, [mad(mad(W, d, 7), u, 2.6), mad(mad(W, d, 13), u, 3.1 + open * 5.4), mad(mad(W, d, 18.5), u, 1.4 + open * 9)], [2.7, 1.9, 0.3], 6, M.CLAW);
    if (s > 0 === !(P.near < 0)) A.claw = mad(W, d, 14);
  }
  // gövde: kabuktan yükselen ıslak taş; göğüs kafesi geniş, omuzlar kabuk zırhlı
  skin(g, [
    { p: at(pel, 0, -6, 0), u: pel.f, rx: 9.5, ry: 7.5 }, { p: at(pel, 0, 0, 0), u: pel.f, rx: 8.4, ry: 6.6 }, { p: waist.p, u: waist.f, rx: 7.4, ry: 5.8 },
    { p: at(chest, 0.6, -6.5, 0), u: chest.f, rx: 10.5 * br, ry: 7.6 * br }, { p: at(chest, 0.8, -1.6, 0), u: chest.f, rx: 13.6, ry: 8.8 * br },
    { p: at(chest, 0, 2.4, 0), u: chest.f, rx: 6.4, ry: 5.4 }, { p: at(chest, 0.8, 5, 0), u: chest.f, rx: 3.8, ry: 3.6 },
  ], 12, M.STONE, { sub: 2 });
  for (const [s, Ar] of [[1, K.R], [-1, K.L]]) {
    ball(g, Ar.sh, 5.2, M.STONE, 7); bone(g, Ar.sh, Ar.el, 4.8, 3.8, M.STONE, 1.25); ball(g, Ar.el, 3.7, M.STONE, 6); bone(g, Ar.el, Ar.wr, 3.7, 2.9, M.STONE, 1.18); ball(g, at(Ar.hand, 2, 0, 0), 3.5, M.STONE, 6);
    ell(g, frame(mad(Ar.sh, chest.u, 2.6), chest.f, chest.u, chest.r), 5.4, 3.4, 5.6, M.SHELL, 8, 4);
    spike(g, mad(Ar.sh, chest.u, 4.6), mad(mad(Ar.sh, chest.u, 10.5), chest.r, s * 4.5), 1.7, M.HORN, 4); spike(g, mad(mad(Ar.sh, chest.u, 3.4), chest.r, s * 3.4), mad(mad(Ar.sh, chest.u, 5.5), chest.r, s * 9.5), 1.4, M.HORN, 4);
  }
  // baş: kaş çıkıntısı, ışıyan gözler, kükreyince açılan ağız; sakalı sarkan su; başının ardında yengeç bacaklarından taç
  const h = (x, y, z) => at(head, x, y, z), jaw = P.jaw;
  ell(g, frame(h(0.6, 5, 0), head.f, head.u, head.r), 5, 5.8, 4.9, M.STONE, 10, 6);
  tube(g, [h(3.9, 6.6, -3.8), h(5.3, 5.8, 0), h(3.9, 6.6, 3.8)], [1.1, 1.35, 1.1], 5, M.DARK);
  if (jaw > 0.08) ell(g, frame(h(4.6, 2.3 - jaw * 0.8, 0), head.f, head.u, head.r), 1.2, 0.6 + jaw * 1.6, 2, M.DARK, 7, 4);
  for (const s of [-1, 1]) { const e = h(5.1, 5.2, s * 2.1); dot(g, e, M.EYE, P.eye > 0.5 ? 4 : 1); dot(g, e, M.EYE, P.eye > 0.5 ? 4 : 0, 1, 0); dot(g, e, M.EYE, P.eye > 0.5 ? 3 : 0, 0, 1); dot(g, e, M.EYE, P.eye > 0.5 ? 2 : 0, 1, 1); if (s > 0 === !(P.near < 0)) A.eye = e; }
  for (let i = -2; i <= 2; i++) { const b = h(4 - Math.abs(i) * 0.7, 1.4 - jaw * 1.2, i * 1.7), sw = Math.sin(t * 2.3 + i * 1.3); tube(g, [b, [b[0] + fw[0] * 0.6, b[1] - 4, b[2] + sw * 0.5], [b[0] + fw[0] * 0.2, b[1] - (8.5 - Math.abs(i) * 1.6), b[2] + sw * 1.1]], [1.5, 1.2, 0.3], 5, M.BEARD); }
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.44 * (0.8 + 0.2 * P.crown) + Math.sin(t * 1.3 + i) * 0.03, c = Math.cos(a), s = Math.sin(a), L = (13 - Math.abs(i) * 1.2) * P.crown;
    const b = h(-2.6, 2 + 7.6 * c, 5 * s), m2 = h(-3.8, 2 + (7.6 + L * 0.5) * c, (5 + L * 0.62) * s), tp = h(-2.6, 3.4 + (7.6 + L) * c, (5 + L * 1.25) * s);
    bone(g, b, m2, 1.5, 1.1, M.HORN, 1.1, 5); ball(g, m2, 1.2, M.HORN, 5); bone(g, m2, tp, 1.1, 0.2, M.HORN, 1, 5, true);
  }
  // dev mızrak
  const H = K.R.hand, grip = at(H, 2.2, 0, 0), [bd, side] = aimOf(fw, sd, cam, P.triA, P.triOut);
  A.tip = trident(g, grip, bd, side, 62, P.grip, 1.9, M.TRI, M.GOLD);
  // boş elde biçimlenen su mızrakları (fırlatmadan önce)
  if (P.cast > 0.05) { const c = at(K.L.hand, 3, 0, 0), [b2, s2] = aimOf(fw, sd, cam, P.castA, 0); for (const k of [-1, 0, 1]) trident(g, mad(c, s2, k * 6), b2, s2, 30 * P.cast, 0.5, 1.2, M.TGLOW, M.TGLOW); }
  A.chest = at(chest, 8, -3, 0); A.hand = at(K.L.hand, 3, 0, 0); A.head = h(0, 5, 0); A.mouth = h(4.4, 2, 0);
}

function build(g, P, o) {
  glowK = P.glow; now = o.t;
  const A = {};
  if (P.form > 0.5) { buildTitan(g, P.T, o, A); if (P.grow < 0.995) scaleGeo(g, [0, 0, 0], lerp(0.32, 1, P.grow)); } else buildGod(g, P, o, A);
  if (P.col > 0.03) column(g, 0, 58 * P.col, 7.5, o.t);
  if (P.orb > 0.03) cocoon(g, [0, 26, 0], P.orb, 27, o.t, P.burst);
  return A;
}

// ---------- duruşlar ----------
const DIE_T = 2.6, MORPH = POSEIDON.morphAt, SIDE = { spear: 1, wave: 1, melee: 1 };
const titan = o => o.rage && o.rageT > MORPH;
// tanrı saldırırken hedefe döner (darbe yandan okunur); dev hep kameraya dönüktür
const view = o => titan(o) ? viewOf(o.yaw, o.act === 'spear' && !o.dying ? 0.85 : 1.22, 0.22) : viewOf(o.yaw, !o.dying && SIDE[o.act] ? 0.4 : 0.85 - 0.3 * (o.dying ? 0 : o.walk), 0.4);

function poseGod(o) {
  const t = o.t, A = o.A, B = o.e.bs || {}, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 2 + o.wob), sway = Math.sin(t * 0.9 + o.wob);
  const armed = B.armed !== false, ap = clamp(aimLocal(Math.cos(o.aim || 0), Math.sin(o.aim || 0), o.view)[1], -1, 1) / D;
  let x = 0, y = Math.sin(t * 1.6 + o.wob) * 0.6, lean = 2, twist = 0, roll = sway * 1, rate = 20, lookW = 0.8, eye = 1, glow = 0.85 + 0.15 * br, drag = 0, moundK = 1, col = 0, orb = 0, orbY = 1, sink = 0, alpha = 1, shadow = 0.5;
  let tri = armed ? 1 : 0, triW = 0, triA = 90, triOut = 0.16, grip = 0.5;
  const bend = [0, 0, 0], head = [2, 0, 0], R = { sw: 44, ab: 20, tw: 0, el: 30 }, L = { sw: -4 + br, ab: 12, tw: 0, el: 20 }, fR = [0.4, 0, 2.4], fL = [-1.2, 0, -2.4];
  if (!armed) {
    // mızrak gitti: eli boşta, avucunda su toplanır ve mızrak yeniden biçimlenir
    const k = B.reform > 0 ? 1 - B.reform / POSEIDON.spear.reform : 0;
    R.sw = 46; R.ab = 22; R.el = 46; triW = 1; tri = k > 0.05 ? k * 0.97 : 0; triA = 80; grip = 0.5;
  }
  if (w > 0.01) {
    // süzülür: gövde öne eğilir, bacaklar ve etek geride kalır, mızrak öne yatar
    lean += 9 * w; fR[0] -= 2 * w; fL[0] -= 3.6 * w; fL[1] += 1.6 * w; R.sw += 14 * w; triA -= 34 * w; L.sw -= 16 * w; L.ab += 6 * w; L.el += 14 * w; drag = w; moundK = 1 + 0.25 * w; head[0] += 4 * w;
  }
  if (o.act === 'spear' && A) {
    lookW = 0.3; rate = 34;
    if (o.stage === 'aim') {
      // mızrağı omzunun üstünde geriye çeker, öbür eliyle hedefi gösterir; gövde geriye döner
      const k = ss(0, 1, o.wind);
      R.sw = lerp(R.sw, 152, k); R.ab = lerp(R.ab, 22, k); R.el = lerp(R.el, 98, k); triA = lerp(triA, ap, k); triOut *= 1 - k; grip = lerp(grip, 0.46, k);
      L.sw = lerp(L.sw, 84 + ap, k); L.ab = lerp(L.ab, 6, k); L.el = lerp(L.el, 4, k);
      bend[1] -= 34 * k; lean -= 9 * k; bend[0] -= 6 * k; x -= 1.6 * k; fR[0] -= 3.4 * k; fL[0] += 3 * k; glow = 1 + 0.4 * k; y -= 0.8 * k;
    } else {
      // fırlatış: gövde öne savrulur, kol hedefe uzanır; mızrak elden çıkmıştır
      const f = ss(0, 0.1, o.sinceStage), rec = ss(0.22, 0.5, o.sinceStage), k = f * (1 - rec);
      R.sw = lerp(152, 62 + ap, f) * (1 - rec) + R.sw * rec; R.el = lerp(98, 4, f) * (1 - rec) + R.el * rec; R.ab = lerp(22, 4, k);
      bend[1] += lerp(-34, 30, f) * (1 - rec); lean += lerp(-9, 16, f) * (1 - rec); x += lerp(-1.6, 3, f) * (1 - rec); L.sw -= 30 * k; L.ab += 16 * k; fL[0] += 3 * k; fR[0] -= 2 * k; tri = 0; rate = 46;
    }
  } else if (o.act === 'wave' && A) {
    lookW = 0.3; rate = 34;
    if (o.stage === 'wind') {
      // mızrağı iki eliyle omzunun ardına kaldırır, gövdesi geriye gerilir
      const k = ss(0, 1, o.wind);
      R.sw = lerp(R.sw, 150, k); R.ab = lerp(R.ab, 12, k); R.el = lerp(R.el, 62, k); L.sw = lerp(L.sw, 128, k); L.ab = lerp(L.ab, -14, k); L.el = lerp(L.el, 74, k);
      triA = lerp(triA, 142, k); triOut *= 1 - k; grip = lerp(grip, 0.3, k); lean -= 11 * k; bend[0] -= 12 * k; head[0] += 6 * k; y += 0.8 * k; fL[0] += 2.6 * k; fR[0] -= 2.6 * k; glow = 1 + 0.3 * k;
    } else {
      // öne ve aşağı doğru geniş bir yay çizerek indirir: mızrağın ucundan su dalgası kopar
      const f = ss(0, 0.14, o.sinceStage), rec = ss(0.26, 0.5, o.sinceStage), k = f * (1 - rec), q = (1 - rec);
      R.sw = lerp(R.sw, lerp(150, 52 + ap, f), q); R.ab = lerp(R.ab, 8, q); R.el = lerp(R.el, lerp(62, 8, f), q); L.sw = lerp(L.sw, lerp(128, 40, f), q); L.ab = lerp(L.ab, lerp(-14, 10, f), q); L.el = lerp(L.el, lerp(74, 30, f), q);
      triA = lerp(triA, lerp(142, -4 + ap, f), q); triOut *= 1 - q; grip = lerp(grip, 0.3, q); lean += lerp(-11, 18, f) * q; bend[0] += lerp(-12, 12, f) * q; x += 2.6 * k; y -= 1.6 * k; fL[0] += 3.4 * k; fR[0] -= 2 * k; rate = 46;
    }
  } else if (o.act === 'melee') {
    // mızrağı kalçasına çeker, sonra bütün gövdesiyle ileri saplar
    const [up, dn] = meleeK(o);
    R.sw += -44 * up + (62 + ap) * dn; R.ab += 4 * up - 10 * dn; R.el += 26 * up - 58 * dn; L.sw += 40 * up - 30 * dn; L.el += 40 * up - 10 * dn; L.ab += -10 * up + 14 * dn;
    triA = lerp(triA, ap, Math.max(up, dn)); triOut *= 1 - Math.max(up, dn); grip = lerp(lerp(grip, 0.74, up), 0.2, dn); bend[1] += -22 * up + 18 * dn; lean += -6 * up + 20 * dn; x += -1.6 * up + 4.6 * dn; y -= 1.4 * up + 1 * dn;
    fL[0] += 2 * up + 4.4 * dn; fR[0] -= 2 * up + 2.6 * dn; glow = 1 + 0.3 * dn; rate = 46; lookW = 0.3;
  } else if (o.act === 'spout' || (o.prev === 'spout' && !o.act && o.since < 0.4)) {
    // mızrağı göğe kaldırır, öbür avucunu yukarı açar; başı geriye düşer, damarları parlar, altındaki su kabarır
    const k = o.act === 'spout' ? ss(0, 0.7, o.wind) : 1 - ss(0, 0.4, o.since);
    R.sw = lerp(R.sw, 168, k); R.ab = lerp(R.ab, 10, k); R.el = lerp(R.el, 10, k); L.sw = lerp(L.sw, 112, k); L.ab = lerp(L.ab, 36, k); L.el = lerp(L.el, 34, k);
    triA = lerp(triA, 90, k); triOut *= 1 - k; grip = lerp(grip, 0.42, k); head[0] += 12 * k; lean -= 5 * k; bend[0] -= 6 * k; y += 2.4 * k; moundK = 1 + 0.6 * k; glow = 1 + 0.5 * k; lookW *= 1 - k; rate = 30;
  }
  if (o.rage) {
    // dönüşüm: mızrağın dibini yere vurur, çöker; su çevresinde yükselip kozaya kapanır
    const q = o.rageT, c = ss(0, 0.35, q);
    R.sw = lerp(R.sw, 40, c); R.el = lerp(R.el, 70, c); triA = lerp(triA, 90, c); triOut *= 1 - c; y -= 3.2 * c; lean += 8 * c; head[0] -= 12 * c; L.sw = lerp(L.sw, 30, c); L.el = lerp(L.el, 96, c); glow = 1 + 0.6 * c;
    orb = ss(0.25, 1.25, q); moundK = 1 + c; lookW = 0; rate = 34; x += Math.sin(t * 55) * 0.3 * c;
  }
  if (o.intro >= 0) {
    // sudan çıkış: su sütunu yükselir, içinden doğrulur; sütun dökülürken mızrağını kaldırır, damarları tutuşur
    const i = o.intro, up = bump(0.5, 0.66, 0.84, 0.98, i);
    col = bump(0, 0.22, 0.5, 0.72, i); sink = (1 - ss(0.16, 0.52, i)) * 52; glow = ss(0.55, 0.8, i) * (1 + 0.6 * up); moundK = 1 + 0.8 * (1 - ss(0.6, 1, i));
    R.sw = lerp(R.sw, 166, up); R.el = lerp(R.el, 8, up); triA = lerp(triA, 90, up); head[0] += 16 * up; lean -= 6 * up; L.ab += 26 * up; L.sw += 10 * up; lookW = 0; eye = i > 0.5 ? 1 : 0;
  }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt, back = clamp(o.hx * Math.cos(o.view), -1, 1); lean -= 8 * h; head[0] += 10 * h; x += back * 1.4 * h; bend[1] += near * 9 * h; L.ab += 12 * h; glow = 1.4; }
  if (dead) {
    // dizlerinin üstüne çöker, mızrağına yaslanır; damarları söner ve suya karışır
    const d = o.dying * DIE_T, kn = ss(0.2, 0.9, d);
    y -= 8 * kn; lean += 22 * kn; head[0] -= 26 * kn; fR[0] -= 4 * kn; fL[0] -= 2 * kn; R.sw = lerp(R.sw, 50, kn); R.el = lerp(R.el, 60, kn); triA = lerp(triA, 84, kn); L.sw = lerp(L.sw, 10, kn);
    glow = 1 - ss(0.3, 1.4, d); eye = d < 1 ? 1 : 0; sink = ss(1.2, 2.5, d) * 46; alpha = 1 - ss(2.1, 2.6, d); moundK = 1 + ss(1, 2, d); lookW = 0;
  }
  const [ly0, lp0] = aimLocal(o.tx, o.ty + 34, o.view), ly = clamp(ly0, -1.2, 1.2) * lookW, lp = clamp(lp0, -0.6, 0.5) * lookW;
  const rad = a => ({ sw: a.sw * D, ab: a.ab * D, tw: a.tw * D, el: Math.max(0, a.el) * D });
  return {
    form: 0, zoom: 1.2, rate, x, y, lean: lean * D, twist: twist * D, roll: roll * D, bend: [bend[0] * D, bend[1] * D + ly * 0.3, bend[2] * D], head: [head[0] * D + lp * 0.5, head[1] * D + ly * 0.6, 0],
    armR: rad(R), armL: rad(L), footR: fR, footL: fL, tri, triW, triA: triA * D, triOut, grip, glow, eye, near, drag, mound: moundK, col, orb, orbY, sink, alpha, shadow, br: 0.03 * br, burst: 0, grow: 0,
  };
}

const REST = [[14, 0, 36], [0, 0, 42], [-13.5, 0, 35]];
function poseTitan(o) {
  const t = o.t, A = o.A, dead = o.dying > 0, w = dead ? 0 : o.walk, br = Math.sin(t * 1.5 + o.wob), q = o.rageT - MORPH;
  // madencinin bulunduğu yan (kameraya dönük dururken sağ el ekranın solundadır)
  const ps = o.tx >= 0 ? -1 : 1, ap = clamp(aimLocal(Math.cos(o.aim || 0), Math.sin(o.aim || 0), o.view)[1], -0.9, 1) / D;
  let x = 0, y = br * 0.5, pitch = 2, roll = Math.sin(t * 0.7) * 1, lean = 4, twist = 0, rate = 18, lookW = 0.35, eye = 1, jaw = 0, crown = 1, glow = 0.8 + 0.2 * br, triA = 84, triOut = 0, grip = 0.42, cast = 0, castA = 0, sink = 0, alpha = 1, shadow = 1;
  const bend = [2, 0, 0], head = [4, 0, 0], R = { sw: 22, ab: 48, tw: 0, el: 52 }, L = { sw: 8 + br * 1.5, ab: 26, tw: 0, el: 40 };
  const snap = (t * 0.43 + o.wob) % 1 < 0.1 ? 0 : 1, pin = [[15, 11 + br * 0.6, 28], [15, 11 - br * 0.6, 28]], open = [0.25 + 0.3 * snap, 0.3 + 0.25 * (((t * 0.37 + 0.5) % 1) < 0.1 ? 0 : 1)];
  const feet = []; for (let i = 0; i < 6; i++) { const k = i >> 1, s = i & 1 ? -1 : 1; feet.push([REST[k][0], 0, REST[k][2] * s]); }
  if (w > 0.01) {
    // yengeç yürüyüşü: yana doğru, üçer üçer adım; gövde adımla yalpalar, kıskaçlar dengeyi tutar
    const mz = o.vx >= 0 ? -1 : 1;
    for (let i = 0; i < 6; i++) { const c = o.ph + (((i >> 1) + (i & 1)) % 2) * 0.5, u = c - Math.floor(c), dz = u < 0.6 ? 8 * (1 - 2 * u / 0.6) : 8 * (2 * ss(0.6, 1, u) - 1), dy = u < 0.6 ? 0 : Math.sin((u - 0.6) / 0.4 * Math.PI) * 7; feet[i][2] += dz * mz * w; feet[i][1] += dy * w; }
    y += Math.sin(o.ph * 2 * TAU) * 0.9 * w; roll += Math.sin(o.ph * TAU) * 3 * w - mz * 3 * w; bend[2] += mz * 3 * w; pin[0][1] += 2 * w; pin[1][1] += 2 * w;
  }
  const P = ps > 0 ? 0 : 1;   // madencinin yanındaki kıskaç
  if (o.act === 'melee') {
    // kıskacını yana ve yukarı açar, sonra madencinin üstüne indirip kapatır
    const [up, dn] = meleeK(o), k = Math.max(up, dn);
    pin[P] = [lerp(15, 4, up) + 8 * dn, lerp(11, 30, up) * (1 - dn) + 1 * dn, lerp(28, 30, up) + 10 * dn]; open[P] = lerp(open[P], 1, up) * (1 - dn);
    roll += ps * (-5 * up + 8 * dn) * 1; bend[2] += ps * (-8 * up + 12 * dn); lean += 6 * dn; y += 1.5 * up - 3 * dn; jaw = 0.5 * k; rate = 46; lookW = 0.4;
  } else if (o.act === 'slam' && A) {
    lookW = 0.2; rate = 36;
    if (o.stage === 'raise') {
      // şaha kalkar: iki kıskaç ve mızrak başının üstünde
      const k = ss(0, 0.85, o.wind);
      pin[0] = [lerp(15, 9, k), lerp(11, 34, k), lerp(28, 20, k)]; pin[1] = [lerp(15, 9, k), lerp(11, 34, k), lerp(28, 20, k)]; open[0] = open[1] = lerp(0.4, 1, k);
      R.sw = lerp(R.sw, 172, k); R.el = lerp(R.el, 14, k); R.ab = lerp(R.ab, 16, k); triA = lerp(triA, 100, k); L.sw = lerp(L.sw, 150, k); L.el = lerp(L.el, 30, k);
      lean -= 14 * k; bend[0] -= 12 * k; head[0] += 16 * k; y += 3.5 * k; pitch += 8 * k; jaw = 0.8 * k; crown = 1 + 0.25 * k; glow = 1 + 0.4 * k;
      for (const i of [0, 1]) feet[i][1] += 5 * k;
    } else {
      // yeri döver: her şey birden iner, gövde çöker, sonra ağır ağır doğrulur
      const imp = 1 - ss(0.1, 0.7, o.sinceStage), hit = 1 - ss(0, 0.2, o.sinceStage);
      pin[0] = [lerp(15, 26, imp), lerp(11, -1, imp), lerp(28, 18, imp)]; pin[1] = [lerp(15, 26, imp), lerp(11, -1, imp), lerp(28, 18, imp)]; open[0] = open[1] = 0.1;
      R.sw = lerp(R.sw, 74, imp); R.el = lerp(R.el, 10, imp); triA = lerp(triA, -6, imp); L.sw = lerp(L.sw, 70, imp); L.el = lerp(L.el, 20, imp);
      lean += 22 * imp; bend[0] += 12 * imp; head[0] -= 8 * imp; y -= 5.5 * imp; pitch -= 5 * imp; x += Math.sin(t * 50) * 0.5 * hit; jaw = 0.5 * imp; rate = 50;
    }
  } else if (o.act === 'spear' && A) {
    lookW = 0.3; rate = 34;
    if (o.stage === 'aim') {
      // boş elini geriye kaldırır: avucunun üstünde üç su mızrağı biçimlenir
      const k = ss(0, 1, o.wind);
      L.sw = lerp(L.sw, 158, k); L.ab = lerp(L.ab, 24, k); L.el = lerp(L.el, 80, k); bend[1] += 24 * k; lean -= 8 * k; cast = ss(0.1, 0.8, o.wind); castA = ap; glow = 1 + 0.4 * k; jaw = 0.3 * k;
      R.sw += 10 * k;
    } else {
      const f = ss(0, 0.12, o.sinceStage), rec = ss(0.24, 0.5, o.sinceStage), k = f * (1 - rec);
      L.sw = lerp(L.sw, lerp(158, 66 + ap, f), 1 - rec); L.el = lerp(L.el, lerp(80, 6, f), 1 - rec); bend[1] += lerp(24, -22, f) * (1 - rec); lean += lerp(-8, 14, f) * (1 - rec); x += 2.5 * k; jaw = 0.7 * k; rate = 46;
    }
  } else if (o.act === 'spout' || (o.prev === 'spout' && !o.act && o.since < 0.4)) {
    // mızrağı göğe diker, boş avucunu açar, başını geriye atıp kükrer; kıskaçlar iki yana açılır
    const k = o.act === 'spout' ? ss(0, 0.7, o.wind) : 1 - ss(0, 0.4, o.since);
    R.sw = lerp(R.sw, 166, k); R.el = lerp(R.el, 10, k); R.ab = lerp(R.ab, 14, k); triA = lerp(triA, 90, k); triOut *= 1 - k; L.sw = lerp(L.sw, 118, k); L.ab = lerp(L.ab, 40, k); L.el = lerp(L.el, 30, k);
    head[0] += 24 * k; lean -= 8 * k; bend[0] -= 8 * k; jaw = 0.9 * k; crown = 1 + 0.3 * k; glow = 1 + 0.6 * k; y += 2 * k;
    for (const i of [0, 1]) { pin[i] = [lerp(15, 8, k), lerp(11, 20, k), lerp(28, 34, k)]; open[i] = lerp(open[i], 1, k); }
    lookW *= 1 - k;
  }
  if (q < 1.6 && !dead) {
    // kozadan çıkış: koza patlarken içinden büyüyerek çıkar, kıskaçlarını ve kollarını açıp kükrer
    const roar = bump(0.2, 0.45, 1.1, 1.6, q);
    y += 3 * roar; lean -= 12 * roar; bend[0] -= 12 * roar; head[0] += 26 * roar; jaw = Math.max(jaw, roar); crown = 1 + 0.35 * roar; glow = 1 + 0.6 * roar;
    for (const i of [0, 1]) { pin[i] = [lerp(pin[i][0], 6, roar), lerp(pin[i][1], 26, roar), lerp(pin[i][2], 34, roar)]; open[i] = lerp(open[i], 1, roar); }
    R.sw = lerp(R.sw, 150, roar); R.ab = lerp(R.ab, 34, roar); R.el = lerp(R.el, 16, roar); triA = lerp(triA, 96, roar); L.sw = lerp(L.sw, 60, roar); L.ab = lerp(L.ab, 70, roar); L.el = lerp(L.el, 20, roar);
    x += Math.sin(t * 45) * 0.4 * roar; lookW *= 1 - roar; rate = 30;
  }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; lean -= 7 * h; head[0] += 10 * h; x += clamp(o.hx * Math.cos(o.view), -1, 1) * 1.5 * h; roll += 4 * h; open[0] = open[1] = 0.9; glow = 1.4; jaw = Math.max(jaw, 0.4 * h); }
  if (dead) {
    // acıyla kükrer; bacakları tek tek çöker, gövde öne yığılır, mızrak elinden kayar; taş suya döner ve dağılır
    const d = o.dying * DIE_T, pain = bump(0, 0.15, 0.5, 0.9, d), kn = ss(0.4, 1.3, d), fall = ss(1, 1.9, d);
    jaw = Math.max(0.9 * pain, 0.3 * fall); head[0] += 20 * pain - 44 * fall; crown = 1 - 0.6 * fall; glow = 1 - ss(0.3, 1.6, d); eye = d < 1.4 ? 1 : 0;
    y -= 7 * kn + 3 * fall; lean += 14 * kn + 46 * fall; bend[0] += 10 * kn + 10 * fall; roll += Math.sin(d * 14) * 3 * (1 - kn);
    for (let i = 0; i < 6; i++) { const k2 = ss(0.3 + (i % 3) * 0.2, 1 + (i % 3) * 0.2, d); feet[i][0] *= 1 + 0.25 * k2; feet[i][2] *= 1 + 0.18 * k2; }
    for (const i of [0, 1]) { pin[i] = [lerp(pin[i][0], 24, kn), lerp(pin[i][1], 0, kn), lerp(pin[i][2], 26, kn)]; open[i] = lerp(open[i], 0.6, kn); }
    R.sw = lerp(R.sw, 30, kn) + 30 * fall; R.el = lerp(R.el, 12, kn); triA = lerp(triA, 8, fall); triOut = lerp(triOut, -0.8, fall); L.sw = lerp(L.sw, 20, kn) + 40 * fall; L.el = lerp(L.el, 10, kn);
    sink = ss(1.5, 2.6, d) * 60; alpha = 1 - ss(2.2, 2.6, d); lookW = 0; shadow = 1 - fall; rate = 30;
  }
  const [ly0, lp0] = aimLocal(o.tx, o.ty + 60, o.view), ly = clamp(ly0, -1.1, 1.1) * lookW, lp = clamp(lp0, -0.5, 0.5) * lookW;
  const rad = a => ({ sw: a.sw * D, ab: a.ab * D, tw: a.tw * D, el: Math.max(0, a.el) * D });
  return {
    form: 1, zoom: 1, rate, glow, sink, alpha, shadow, col: 0, orb: q < 0.5 && !dead ? 1 : 0, burst: ss(0, 0.45, q), grow: dead ? 1 : ss(0, 0.5, q),
    T: { x, y, pitch: pitch * D, roll: roll * D, lean: lean * D, twist: twist * D, bend: [bend[0] * D, bend[1] * D + ly * 0.25, bend[2] * D], head: [head[0] * D + lp * 0.5, head[1] * D + ly * 0.6, 0],
      armR: rad(R), armL: rad(L), feet, pinR: pin[0], pinL: pin[1], open, triA: triA * D, triOut, grip, cast, castA: castA * D, jaw, eye, crown, near: Math.cos(o.view) >= 0 ? 1 : -1, br: 0.03 * br },
  };
}
const pose = o => titan(o) ? poseTitan(o) : poseGod(o);

export const POSEIDON3D = { w: 236, h: 176, ox: 118, oy: 152, scale: 1.1, tilt: 0.18, mats: MATS, stride: 20, shadow: 18, body: 56, turnRate: 3.4, outline: [5, 9, 18], ownDeath: true, view, pose, build };
