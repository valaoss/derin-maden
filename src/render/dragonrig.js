// Hazine Ejderi 3B iskeleti: duruştan (dragonpose.js) her karede geometri kurar; hazır kare/sprite yok.
// Birim: tasarım pikseli. +x ileri (baş), +y yukarı, +z kameraya bakan yan. Zemin y = 0.
import { vert, tri, line, dot } from './soft3d.js';
import { TAU, sub, mul, mad, cross, len, norm, mix, lerp, hash, frame, turn, at, dir, move, ring, band, cap, bone, ball, tube, face, loft as loftK, catmull, ik, batWing } from './boss/rig.js';

export const M = { SKIN: 1, LIMB: 2, BELLY: 3, HORN: 4, MEMB: 5, MEMB_OUT: 6, MOUTH: 7, SPIKE: 8, EYE: 9, GOLD: 10, TONGUE: 11, HOT: 12 };
export const TAIL_N = 9, NECK_N = 5;
const TAIL_L = 4.6, NECK_L = 4.3, TORSO_L = 9.5, SIDES = 12, HEAD = 1.45;
const NECK_R = [[5.9, 6.7], [4.8, 5.3], [4.1, 4.5], [3.7, 4.0], [3.5, 3.7]];
const tailR = i => 0.5 + 5 * Math.pow(1 - i / TAIL_N, 0.9);
// kanat: kapalı ve açık yönler (göğüs çerçevesinde; z dışa). h: pazı, a: ön kol, f: parmaklar
const FOLD = { h: [-0.9, 0.35, 0.3], a: [0.95, -0.12, 0.02], f: [[-1, 0.04, 0.1], [-1, -0.24, 0.14], [-1, -0.52, 0.14], [-0.85, -0.85, 0.1]] };
const OPEN = { h: [-0.45, 0.7, 0.55], a: [0.25, 0.85, 0.45], f: [[0.3, 0.92, 0.2], [-0.4, 0.86, 0.3], [-0.85, 0.4, 0.34], [-0.9, -0.38, 0.22]] };
// uçuş: kanatlar yana, yere koşut açılır (önden ve üstten okunur)
const FLY = { h: [-0.15, 0.35, 0.92], a: [0.15, 0.2, 0.96], f: [[0.55, 0.12, 0.82], [0.05, 0.02, 1], [-0.5, -0.04, 0.86], [-0.88, -0.1, 0.46]] };
const FINGER = [20, 23, 22, 18];


// zemin: havadayken (P.air) aşağı çekilir, kuyruk ve baş serbest kalır
let FLOOR = 0;
const ground = (F, r) => { if (F.p[1] < FLOOR + r * 0.92) F.p[1] = FLOOR + r * 0.92; return F; };
const loft = (g, F, secs, sides, m, o) => loftK(g, F, secs, sides, m, { ...o, k: HEAD });

// ---------- parçalar ----------
function leg(g, hip, foot, ank, pole, l1, l2, r0) {
  let A = [foot[0] + ank[0], foot[1] + ank[1], foot[2]];
  const d = sub(A, hip), L = len(d), max = (l1 + l2) * 0.985;
  if (L > max) { A = mad(hip, d, max / L); foot = [A[0] - ank[0], A[1] - ank[1], A[2]]; }
  const K = ik(hip, A, l1, l2, pole), rk = r0 * 0.62, ra = Math.max(1.9, r0 * 0.44), pad = [foot[0], foot[1] + 1.5, foot[2]], toe = [foot[0] + 3.4, foot[1] + 1.1, foot[2]];
  bone(g, hip, K, r0, rk, M.LIMB, 1.12); ball(g, K, rk, M.LIMB); bone(g, K, A, rk * 0.95, ra, M.LIMB, 1.08); ball(g, A, ra, M.LIMB);
  bone(g, A, pad, ra, 2.1, M.LIMB); ball(g, pad, 2.15, M.LIMB); bone(g, pad, toe, 2.15, 1.4, M.LIMB, 1, 6, true);
  for (let k = -1; k <= 1; k++) line(g, [toe[0] + 0.5, toe[1] + 0.2, toe[2] + k * 1.4], [toe[0] + 2.6, foot[1] + 0.1, toe[2] + k * 1.9], M.HORN, 3);
}
const WING = { fold: FOLD, open: OPEN, fly: FLY, arm: [11, 13], fingers: FINGER, r: [1.9, 1.4, 1.35, 1], memb: M.MEMB, bone: M.LIMB, claw: M.HORN };
const wing = (g, C, s, W, ry) => batWing(g, C, at(C, -3.5, ry * 0.72, s * 3.8), at(C, -15, 2, s * 5.4), s, W, WING);
function head(g, F, P, A) {
  const K = HEAD, jaw = P.jaw, U = turn(F, 0, jaw * 0.3);
  const hinge = at(F, 0.4 * K, -0.9 * K, 0), Lw = turn(frame(hinge, F.f, F.u, F.r), 0, -jaw * 0.7);
  loft(g, Lw, [[-0.6, -0.5, 2.9, 1.3], [4.5, -0.45, 2.3, 1.05], [9, -0.35, 1.8, 0.85], [11.2, -0.2, 0.9, 0.5]], 8, M.SKIN, { ceil: 0.25, flat: M.TONGUE });
  loft(g, U, [[-3.2, 0.5, 2.7, 2.7], [-0.6, 1.0, 3.8, 3.3], [2.4, 1.3, 3.6, 3.0], [5, 0.9, 2.6, 2.1], [8.5, 0.65, 2.2, 1.7], [11, 0.6, 2.0, 1.6], [12.3, 0.25, 1.1, 0.9]], 10, M.LIMB, { floor: -0.75, flat: M.MOUTH });
  // ağız içi: çeneler açılınca ortadaki zar ve dil
  if (jaw > 0.08) {
    const n = F.r, a = at(F, 0.4 * K, -0.8 * K, 0), b = at(U, 8 * K, -0.75 * K, 0), c = at(Lw, 8 * K, 0.2 * K, 0);
    tri(g, vert(g, a, n), vert(g, b, n), vert(g, c, n), M.MOUTH);
    line(g, at(Lw, 2 * K, 0.5 * K, 0), at(Lw, 8.5 * K, (0.7 + jaw * 1.6) * K, 0), M.TONGUE, 3);
    for (const s of [-1, 1]) {
      for (const [x, w] of [[5.6, 2.2], [7.6, 2.0], [9.6, 1.8], [11.3, 1.5]]) dot(g, at(U, x * K, -1.2 * K, s * w * K), M.HORN, 4);
      for (const [x, w] of [[6.6, 1.9], [8.6, 1.6], [10.4, 1.2]]) dot(g, at(Lw, x * K, 0.75 * K, s * w * K), M.HORN, 3);
    }
  } else for (const s of [-1, 1]) dot(g, at(U, 10.4 * K, -1.1 * K, s * 1.7 * K), M.HORN, 4);
  for (const s of [-1, 1]) {
    tube(g, [[-1.6, 3.0, 2.0], [-4.6, 5.2, 3.4], [-7.6, 7.6, 3.9], [-9.4, 10.4, 3.4]].map(([x, y, z]) => at(U, x * K, y * K, z * s * K)), [1.9, 1.6, 1.1, 0.35], 6, M.HORN);
    tube(g, [[-1, 0.1, 3.3], [-4, -0.3, 4.7], [-6.6, 0.4, 5.1]].map(([x, y, z]) => at(U, x * K, y * K, z * s * K)), [1.05, 0.75, 0.25], 5, M.HORN);
    dot(g, at(U, 11.5 * K, 1.5 * K, s * 1.3 * K), M.LIMB, 0);
    // göz: kapalıyken koyu çizgi, aralanınca tek piksel, açıkken iki piksel ve çatık kaş
    const e = at(U, 3.1 * K, 2.15 * K, s * 3.45 * K);
    if (P.eye < 0.15) { dot(g, e, M.LIMB, 0); dot(g, e, M.LIMB, 0, -1, 0); }
    else if (P.eye < 0.6) { dot(g, e, M.EYE, 2); dot(g, e, M.LIMB, 0, -1, 0); }
    else { dot(g, e, M.EYE, 4); dot(g, e, M.EYE, 2, -1, 0); dot(g, e, M.LIMB, 0, 0, -1); dot(g, e, M.LIMB, 0, -1, -1); }
    if (s > 0 === !(P.near < 0)) A.eye = e;
  }
  tube(g, [at(U, 10.2 * K, 1.9 * K, 0), at(U, 10.6 * K, 3.5 * K, 0)], [0.8, 0.25], 5, M.HORN);
  A.mouth = at(F, 9.5 * K, (-0.7 - jaw * 2.6) * K, 0); A.nose = at(U, 12.6 * K, 1.4 * K, 0); A.head = F.p;
}

// ---------- ejder ----------
export function buildDragon(g, P) {
  FLOOR = -(P.air || 0) * 60;
  const A = {}, sq = P.squash, rad = (rx, ry, b) => [rx * (1 + 0.1 * sq) * (1 + b * 0.6), ry * (1 - 0.12 * sq) * (1 + b)];
  const rP = rad(6.6, 7.2, P.br[0]), rB = rad(7.6, 8.0, P.br[1]), rC = rad(7.6, 8.8, P.br[2]);
  const root = ground(turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), rP[1]);
  const belly = ground(move(root, TORSO_L), rB[1]), chest = ground(move(turn(belly, 0, P.arch), TORSO_L), rC[1]);
  // omurga eklemleri: kuyruk ucu -> boyun sonu (tek, kesintisiz deri)
  const J = [];
  let F = frame(root.p, mul(root.f, -1), root.u, mul(root.r, -1));
  for (let i = 0; i < TAIL_N; i++) { const r = tailR(i + 1); F = ground(move(turn(F, -P.tailY[i], P.tailP[i]), TAIL_L), r); J.unshift({ p: F.p, u: F.u, rx: r, ry: r, sp: 3.4 * (1 - (i + 1) / TAIL_N) }); }
  const tip = F;
  J.push({ p: root.p, u: root.u, rx: rP[0], ry: rP[1], sp: 3.8 }, { p: belly.p, u: belly.u, rx: rB[0], ry: rB[1], sp: 4.3 }, { p: chest.p, u: chest.u, rx: rC[0], ry: rC[1], sp: 4.4 });
  F = chest;
  for (let i = 0; i < NECK_N; i++) { const [rx, ry] = NECK_R[i]; F = ground(move(turn(F, P.neckY[i], P.neckP[i]), NECK_L), ry); J.push({ p: F.p, u: F.u, rx: rx * (1 + P.br[2] * 0.4), ry, sp: 3.6 - i * 0.45 }); }
  const headF = turn(F, P.head[1], P.head[0], P.head[2]);
  if (headF.p[1] < FLOOR + 2.3 * HEAD) headF.p[1] = FLOOR + 2.3 * HEAD;

  // uzak yan önce (derinlik tamponu sıradan bağımsız; yalnızca okunurluk için)
  const W = P.wing;
  wing(g, chest, -1, W, rC[1]);
  const hips = [[root, 2, -1.4, 5.8, 9, 8.5, 5.4], [root, 2, -1.4, -5.8, 9, 8.5, 5.4], [chest, -2.5, -3, 6, 8, 8.5, 4.4], [chest, -2.5, -3, -6, 8, 8.5, 4.4]];
  // havada ayaklar gövdeye toplanır (tuck); dalışta pençeler öne uzanır (claw)
  const tk = P.tuck || 0, cw = P.claw || 0;
  hips.forEach(([Fb, x, y, z, l1, l2, r0], i) => leg(g, at(Fb, x, y, z), tk > 0.01 ? mix(P.feet[i], at(Fb, x + (i > 1 ? 3 : 2) + cw * (i > 1 ? 4 : 6), y - 8.5 - cw * 4.5, z * 1.05), tk) : P.feet[i], P.ank[i], P.pole[i], l1, l2, r0));

  // gövde borusu, sırt dikenleri, sırtta biriken paralar
  const R = [];
  for (let i = 0; i < J.length - 1; i++) {
    const a = J[Math.max(0, i - 1)], b = J[i], c = J[i + 1], d = J[Math.min(J.length - 1, i + 2)];
    for (let s = 0; s < 3; s++) { const k = s / 3; R.push({ p: catmull(a.p, b.p, c.p, d.p, k), u: mix(b.u, c.u, k), rx: lerp(b.rx, c.rx, k), ry: lerp(b.ry, c.ry, k), sp: lerp(b.sp, c.sp, k) }); }
  }
  R.push(J[J.length - 1]);
  let u = 0, prev = -1, next = 3;
  for (let i = 0; i < R.length; i++) {
    const q = R[i], t = norm(sub(R[Math.min(R.length - 1, i + 1)].p, R[Math.max(0, i - 1)].p));
    if (i) u += len(sub(q.p, R[i - 1].p));
    const base = ring(g, q.p, t, q.u, q.rx, q.ry, SIDES, u), r = norm(cross(t, q.u)), up = cross(r, t);
    if (prev >= 0) band(g, prev, base, SIDES, M.SKIN); else cap(g, base, SIDES, mad(q.p, t, -0.6), mul(t, -1), M.SKIN);
    prev = base;
    if (u >= next && q.sp > 0.6) {
      const h = q.sp, c = mad(q.p, up, q.ry * 0.92), ref = mad(c, up, h * 0.3);
      const a = mad(c, t, h * 0.5), b = mad(mad(c, t, -h * 0.4), r, h * 0.3), d = mad(mad(c, t, -h * 0.4), r, -h * 0.3), top = mad(mad(c, up, h), t, -h * 0.55);
      face(g, a, b, top, M.HORN, ref); face(g, b, d, top, M.HORN, ref); face(g, d, a, top, M.HORN, ref);
      next = u + 4;
    }
    if (P.coins > 0.5 && i > 14 && i < 36 && hash(i) < 0.62) {
      const a = (0.2 + hash(i + 50) * 0.6) * Math.PI, c = mad(mad(q.p, r, Math.cos(a) * q.rx * 1.04), up, Math.sin(a) * q.ry * 1.04);
      dot(g, c, M.GOLD, hash(i + 9) < 0.5 ? 4 : 3); dot(g, c, M.GOLD, 2, 1, 0);
    }
  }
  // kuyruk ucu: ok başı
  { const b = mul(tip.f, 1), o = tip.p, a = mad(o, b, 6), s1 = mad(mad(o, b, 1.2), tip.u, 2.5), s2 = mad(mad(o, b, 1.2), tip.u, -2.5), n = tip.r;
    for (const [x, y, z] of [[o, s1, a], [o, a, s2]]) tri(g, vert(g, x, n), vert(g, y, n), vert(g, z, n), M.SPIKE); }
  wing(g, chest, 1, W, rC[1]);
  head(g, headF, P, A);
  A.chest = at(chest, 2, -2, 0); A.back = at(belly, 0, rB[1], 0);
  return A;
}
