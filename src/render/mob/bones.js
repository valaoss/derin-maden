// Kemik Yığını: leğen, eğri omurga, içi boş göğüs kafesi, tepesinde kafatası; yere basan iki uzun kol kemiğinin üstünde sallanarak yürür.
// Vurmadan önce iki kolunu kaldırır. Ölünce dağılır, kafatası yuvarlanıp yerde kalır (Kafatası: çenesi takırdar, gözü giderek parlar;
// kırılmazsa yığın onun çevresinde yeniden toplanır).
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, ss, at, turn, shift, frame, ell, ball, bone, ik, reach } from '../boss/rig.js';
import { mobView, ramp, fr } from './common.js';

const M = { BONE: 1, RIB: 2, DARK: 3, EYE: 4 };
const MATS = [], BONE = ramp('#1a1410', '#4a3e30', '#8a7a60', '#bcaa8a', '#ece0c4');
MATS[M.BONE] = { ramp: BONE };
// kaburgalar: şeritler arası boş
MATS[M.RIB] = { ramp: BONE, px: (u, v, i, out) => { if (fr(v * 4.5 + 0.2) < 0.42) out.id = 0; return i; } };
MATS[M.DARK] = { ramp: ramp('#060404', '#0e0a08', '#1a1410', '#2a2018', '#3a2e22'), flat: true, soft: true };
MATS[M.EYE] = { ramp: ramp('#5a4a10', '#b89a20', '#ffe060', '#fff0a0', '#ffffe0'), flat: true, soft: true, glow: 1 };

// kafatası: kafa topu, alt çene, göz çukurları (içinde ışık), burun
function skull(g, H, jaw, lit, A, o) {
  ball(g, H.p, 2.1, M.BONE, 7);
  ell(g, frame(at(H, 1, -1.7 - jaw * 0.8, 0), H.f, H.u, H.r), 1.4, 0.6, 1.3, M.BONE, 6, 3);
  dot(g, at(H, 2.05, -0.5, 0), M.DARK, 0);
  for (const s of [-1, 1]) {
    const q = at(H, 1.75, 0.35, s * 0.85);
    dot(g, q, M.DARK, 0); dot(g, q, M.DARK, 0, 0, 1);
    if (lit > 0.3) dot(g, q, M.EYE, lit > 0.7 ? 3 : 1);
    if (A && s > 0 === Math.cos(o.view) >= 0) A.eye = q;
  }
}

function build(g, P, o) {
  const A = {}, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll);
  ball(g, at(T, -1.6, 0.2, 0), 1.6, M.BONE, 5);
  line(g, at(T, -1.6, 0.8, 0), at(T, -0.9, 2.6, 0), M.BONE, 3); line(g, at(T, -0.9, 2.6, 0), at(T, 0.9, 4.8, 0), M.BONE, 3);
  ell(g, turn(shift(T, 0.4, 3.2, 0), 0, -0.5), 2.5, 2.5, 2.8, M.RIB, 8, 6);
  if (P.head > 0.5) skull(g, turn(shift(T, 2.2, 6.2 + P.headY, 0), P.headYaw, P.headP), P.jaw, P.lit, A, o);
  for (const s of [-1, 1]) {
    const i = s > 0 ? 0 : 1, sh = at(T, 1, 4.4, s * 2.8), hand = reach(sh, P.hands[i], 7.2), el = ik(sh, hand, 3.6, 3.8, [-0.7, 0.5, s]);
    bone(g, sh, el, 0.7, 0.55, M.BONE, 1, 5); ball(g, el, 0.8, M.BONE, 5); bone(g, el, hand, 0.6, 0.5, M.BONE, 1, 5); ball(g, hand, 0.95, M.BONE, 5);
  }
  A.head = at(T, 2.2, 8.6, 0); A.mouth = at(T, 4, 5, 0);
  return A;
}

function pose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 2.6 + o.wob);
  let px = 0, py = 1.8 + br * 0.15, pitch = -8, roll = 0, headY = br * 0.15, headP = 0, headYaw = Math.sin(t * 1.3 + o.wob) * 0.2, jaw = 0.1, lit = 1, head = 1, rate = 22;
  const hands = [[3.6, 0.9, 3.6], [3.6, 0.9, -3.6]];
  if (w > 0.01) {
    // kollarının üstünde yürür: sırayla öne atar, gövde basan kola yaslanır
    for (const i of [0, 1]) { const c = o.ph + i * 0.5, k = c - Math.floor(c); hands[i][0] += (k < 0.6 ? 1 - 2 * k / 0.6 : 2 * (k - 0.6) / 0.4 - 1) * 2.2 * w; hands[i][1] += k < 0.6 ? 0 : Math.sin((k - 0.6) / 0.4 * Math.PI) * 1.6 * w; }
    const sw = Math.sin(o.ph * TAU); roll += sw * 6 * w; py += Math.abs(Math.cos(o.ph * TAU)) * 0.5 * w; headYaw = sw * 0.12 * w; jaw = 0.2 + 0.2 * Math.abs(sw);
  }
  const wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  if (wd > 0.001) { pitch += 14 * wd; jaw = Math.max(jaw, wd); for (const i of [0, 1]) { const s = i ? -1 : 1; hands[i] = [lerp(hands[i][0], 1.5, wd), lerp(hands[i][1], 9.5, wd), s * lerp(3.6, 2.6, wd)]; } rate = 32; }
  if (l > 0.001) { pitch -= 18 * l; px += 1.8 * l; jaw = 1; for (const i of [0, 1]) { const s = i ? -1 : 1; hands[i] = [lerp(hands[i][0], 6.5, l), lerp(hands[i][1], 0.9, l), s * lerp(3.6, 2.2, l)]; } rate = 44; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; pitch += 8 * h; headP += 0.3 * h; roll += near * 6 * h; jaw = 0.8; }
  if (dead) {
    // dağılır: gövde çöker, kollar iki yana düşer; kafatası kopar (yeniden toplanacaksa yerde ayrı durur)
    const d = o.dying, k = ss(0, 0.4, d);
    py = lerp(py, 0.2, k); pitch = lerp(pitch, -50, k); roll = near * 30 * k; lit = 1 - ss(0, 0.3, d); jaw = 0.6; rate = 60;
    head = (e.risen | 0) < (e.d.rise || 0) ? 0 : 1; headY = -4.5 * k; headP = -1.2 * k;
    for (const i of [0, 1]) { const s = i ? -1 : 1; hands[i] = [lerp(hands[i][0], 1, k), 0.6, s * lerp(3.6, 6.5, k)]; }
  }
  for (const h of hands) h[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, headY, headP, headYaw, jaw, lit, head, hands, zoom: e.scale || 1 };
}

export const BONES = { w: 44, h: 44, ox: 22, oy: 33, scale: 1, tilt: 0.3, mats: MATS, stride: 8, foot: 6, top: 10, shadow: 7, body: 12, crease: 1.6, outline: [12, 8, 6], turnRate: 7, view: o => mobView(o, 0.5), pose, build };

// yerde kalan kafatası: toplanma yaklaştıkça hızlı takırdar, gözü parlar
function skullBuild(g, P, o) {
  const A = {}, H = turn(frame([0, 2 + P.py, 0]), 0, P.pitch, P.roll);
  skull(g, H, P.jaw, P.lit, A, o);
  A.head = at(H, 0, 3, 0);
  return A;
}
function skullPose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, k = 1 - Math.min(1, (e.riseT ?? 2.5) / 2.5), f = 10 + k * 22;
  if (dead) return { rate: 60, py: -1 * o.dying, pitch: -0.6 * o.dying, roll: 0.9 * o.dying, jaw: 0.4, lit: 0, zoom: 1 };
  return { rate: 50, py: Math.abs(Math.sin(t * f)) * (0.3 + k * 0.9), pitch: Math.sin(t * f * 0.5) * 0.12, roll: 0.15, jaw: Math.abs(Math.sin(t * f)) * (0.3 + k * 0.5), lit: 0.4 + k * 0.6, zoom: 1 };
}
export const SKULL = { w: 20, h: 20, ox: 10, oy: 14, scale: 0.85, tilt: 0.3, mats: MATS, stride: 8, foot: 3, top: 5, shadow: 3, body: 4, crease: 1.6, outline: [12, 8, 6], turnRate: 7, view: o => mobView(o, 0.6), pose: skullPose, build: skullBuild };
