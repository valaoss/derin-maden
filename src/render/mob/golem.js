// Kaya Devi ve Obsidyen Devi: yontulmamış kaya bloklarından bir dev. Omuzlara doğru genişleyen köşeli gövde, sırtta kambur,
// omuzların arasına gömülü küçük baş, yere değen kaya yumruklar, kısa kalın bacaklar; göğsündeki çatlaktan ve gözlerinden ışık sızar.
// Ağır ağır yalpalayarak yürür; vurmadan önce iki yumruğunu başının üstüne kaldırıp yere indirir, kazarken sırayla yumruklar.
// Ölünce dizlerinin üstüne çöker, yüzüstü devrilir, ışığı söner.
import { dot, line } from '../soft3d.js';
import { D, lerp, ss, mad, at, turn, shift, frame, ball, prism, ik, reach } from '../boss/rig.js';
import { mobView, ramp } from './common.js';

const M = { ROCK: 1, DARK: 2, GLOW: 3 };
function mats(rock, dark, glow) {
  const m = [];
  m[M.ROCK] = { ramp: ramp(...rock) }; m[M.DARK] = { ramp: ramp(...dark) };
  m[M.GLOW] = { ramp: ramp(...glow), flat: true, soft: true, glow: 1 };
  return m;
}
const KIND = {
  brute: mats(['#181212', '#3a3030', '#5e5252', '#8a7c78', '#b8aaa4'], ['#120e0e', '#2a2222', '#463c3c', '#665a58', '#8a7c78'], ['#3a1a10', '#a03a1a', '#ff6a2a', '#ff9a4a', '#ffe0a0']),
  ogolem: mats(['#07050c', '#141020', '#2a2240', '#4a3e68', '#9a8cd0'], ['#050408', '#0e0b18', '#1e1830', '#362c50', '#5e5088'], ['#2a2048', '#6a50b0', '#c0a0ff', '#dcc8ff', '#ffffff']),
};
const STEP = 2.8;
function step(ph, lift) { const c = ph - Math.floor(ph); if (c < 0.62) return [STEP * (1 - 2 * c / 0.62), 0]; const k = (c - 0.62) / 0.38, e = k * k * (3 - 2 * k); return [STEP * (2 * e - 1), Math.sin(k * Math.PI) * lift]; }

function build(g, P, o) {
  const A = {}, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), gl = P.glow > 0.9 ? 4 : P.glow > 0.7 ? 3 : P.glow > 0.3 ? 2 : 0;
  // gövde: belden omuza genişleyen kaya; sırtta kambur
  prism(g, at(T, -0.3, -1, 0), at(T, 0.9, 6.8, 0), 3.9, 5.9, M.DARK, 6, 0.5, 0.8, T.f);
  prism(g, at(T, -1.8, 4.6, 0.6), at(T, -2.6, 9.4, 0.2), 3.7, 2.1, M.ROCK, 5, 0.9, 0.9, T.f);
  // göğüs çatlağı
  line(g, at(T, 4.4, 5.6, -1.6), at(T, 4.6, 3.8, 0.4), M.GLOW, gl); line(g, at(T, 4.6, 3.8, 0.4), at(T, 4.1, 2, -0.6), M.GLOW, gl);
  // baş: omuzların arasında, öne eğik blok; iki göz
  const H = turn(shift(T, 3, 8.1, 0), P.headY, P.headP);
  prism(g, at(H, -1.8, 0, 0), at(H, 2, -0.3, 0), 2.6, 2.1, M.ROCK, 5, 0.3, 0.9, H.u);
  for (const s of [-1, 1]) { const q = at(H, 2.25, 0.4, s * 0.95); dot(g, q, M.GLOW, gl); if (s > 0 === Math.cos(o.view) >= 0) A.eye = q; }
  // kollar: omuz kayası, kalın ön kol, blok yumruk
  for (const s of [-1, 1]) {
    const i = s > 0 ? 0 : 1, sh = at(T, 0.9, 6.9, s * 6.3), fist = reach(sh, P.hands[i], 9), el = ik(sh, fist, 4.6, 4.6, [-0.8, 0.25, s * 0.9]);
    ball(g, sh, 3.1, M.ROCK, 5);
    prism(g, sh, el, 2.1, 1.9, M.DARK, 5, 0.4); prism(g, el, fist, 2.2, 2.8, M.ROCK, 5, 0.9);
    prism(g, mad(fist, [0, 0.9, 0], 1), mad(fist, [0.4, -1.9, 0], 1), 3, 2.5, M.ROCK, 5, 0.2 + s);
  }
  // bacaklar: kısa, kalın; ayak düz blok
  for (const s of [-1, 1]) {
    const i = s > 0 ? 0 : 1, hip = at(T, -0.2, -0.6, s * 2.7), ft = reach(hip, mad(P.feet[i], [0, 1.2, 0], 1), 5.7), kn = ik(hip, ft, 3, 3, [1, 0.2, s * 0.3]);
    prism(g, hip, kn, 2.4, 2.1, M.DARK, 5, 0.3); prism(g, kn, ft, 2.1, 2.3, M.ROCK, 5, 0.7);
    prism(g, mad(ft, [-1.4, -0.3, 0], 1), mad(ft, [2.2, -0.5, 0], 1), 2.1, 1.7, M.ROCK, 4, 0.78, 0.7, [0, 1, 0]);
  }
  A.head = at(H, 0, 2.6, 0); A.mouth = at(H, 2.2, -0.6, 0);
  return A;
}

function pose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 1.8 + o.wob);
  let px = 0, py = 5 + br * 0.12, pitch = -15, roll = 0, headP = -6, headY = 0, glow = 0.6 + 0.2 * br, rate = 18;
  const feet = [[0.4, 0, 3], [0.4, 0, -3]], hands = [[4.2, 2.6 + br * 0.15, 7], [4.2, 2.6 - br * 0.15, -7]];
  if (w > 0.01) {
    // ağır adımlar: gövde basan ayağın üstüne yatar, kollar ters yöne sallanır
    for (const i of [0, 1]) { const [dx, dy] = step(o.ph + i * 0.5, 1.6); feet[i][0] += dx * w; feet[i][1] += dy * w; hands[1 - i][0] += dx * 0.8 * w; hands[1 - i][1] += Math.max(0, dx) * 0.3 * w; }
    const sw = Math.sin(o.ph * Math.PI * 2);
    py += Math.abs(Math.cos(o.ph * Math.PI * 2)) * 0.5 * w - 0.25 * w; roll += sw * 4.5 * w; pitch -= 3 * w; headY = sw * 0.08 * w;
  }
  const l = o.lunge;
  if (e.st === 'dig' && !dead) {
    // kazı: yumruklar sırayla kayaya iner
    const c = Math.sin(e.anim * 2), k = Math.abs(c), i = c > 0 ? 0 : 1, s = i ? -1 : 1;
    hands[i] = [lerp(hands[i][0], 8.6, k), lerp(hands[i][1], 6, k), s * lerp(7, 3.4, k)]; pitch -= 6 * k; roll += s * near * 3 * k; px += 0.8 * k; glow = 0.6 + 0.4 * k; rate = 30;
  } else {
    // darbe: iki yumruk başın üstüne kalkar, sonra yere iner
    const wd = ss(0, 1, o.wind) * (1 - l);
    if (wd > 0.001) { pitch += 16 * wd; py += 0.4 * wd; headP += 10 * wd; glow = Math.max(glow, wd); for (const i of [0, 1]) { const s = i ? -1 : 1; hands[i] = [lerp(hands[i][0], 1.5, wd), lerp(hands[i][1], 16.5, wd), s * lerp(7, 4, wd)]; } rate = 30; }
    if (l > 0.001) { pitch -= 22 * l; px += 1.6 * l; py -= 0.8 * l; glow = 1; for (const i of [0, 1]) { const s = i ? -1 : 1; hands[i] = [lerp(hands[i][0], 9, l), lerp(hands[i][1], 1.2, l), s * lerp(7, 3, l)]; } rate = 44; }
  }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; pitch += 7 * h; px -= 0.8 * h; headP += 12 * h; roll += near * 4 * h; glow = 1; }
  if (dead) {
    // dizlerinin üstüne çöker, yüzüstü devrilir; ışık söner
    const d = o.dying, k1 = ss(0, 0.3, d), k2 = ss(0.25, 0.7, d);
    py = lerp(py, 3, k1) - 0.6 * k2; pitch = lerp(pitch, -84, k2) + 6 * k1 * (1 - k2); px += 3.5 * k2; headP = lerp(headP, 14, k1); glow = 1 - ss(0.1, 0.55, d); roll += near * 6 * k2; rate = 50;
    for (const i of [0, 1]) { const s = i ? -1 : 1; hands[i] = [lerp(hands[i][0], 9.5, k2), lerp(hands[i][1], 1.2, k1), s * lerp(7, 8.4, k2)]; feet[i][0] -= 2.2 * k2; }
  }
  for (const f of feet) f[0] += px; for (const h of hands) h[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, headP: headP * D, headY, glow, feet, hands, zoom: e.scale || 1 };
}

const def = (type, o) => ({ ...o, mats: KIND[type], tilt: 0.32, crease: 1.8, turnRate: 5, view: o2 => mobView(o2, 0.62), pose, build });
export const BRUTE = def('brute', { w: 60, h: 56, ox: 30, oy: 42, scale: 0.84, stride: 7.6, foot: 8, top: 14, shadow: 9, body: 16, outline: [14, 8, 8] });
export const OGOLEM = def('ogolem', { w: 68, h: 62, ox: 34, oy: 46, scale: 0.95, stride: 8.6, foot: 9, top: 16, shadow: 10, body: 18, outline: [4, 2, 10] });
