// Pirana: yandan basık gümüş gövde, kızıl karın, öne çıkık alt çene ve dişler, sarı göz. Suda kuyruğunu hızla çırparak yüzer;
// karada yan yatar, zıplayıp çırpınır. Isırırken çenesi açılır; ölünce karnı yukarı döner.
import { dot, line } from '../soft3d.js';
import { D, lerp, ss, at, turn, frame, ell, skin, leaf } from '../boss/rig.js';
import { mobView, ramp } from './common.js';

const M = { BODY: 1, BELLY: 2, FIN: 3, EYE: 4, TOOTH: 5, DARK: 6 };
const MATS = [];
// v: 0.25 sırt, 0.75 karın
MATS[M.BODY] = { ramp: ramp('#0e1a22', '#24424e', '#4a7684', '#7aa8b4', '#c0e0e8'), px: (u, v, i, out) => { if (v > 0.56 && v < 0.94) out.id = M.BELLY; return i; } };
MATS[M.BELLY] = { ramp: ramp('#3a0a0a', '#7a1a14', '#c0321e', '#ec5a32', '#ff9a6a') };
MATS[M.FIN] = { ramp: ramp('#0a1218', '#1a2e38', '#2e4a56', '#466874', '#648a96'), back: M.FIN };
MATS[M.EYE] = { ramp: ramp('#7a5a08', '#c09a10', '#ffd830', '#ffec80', '#ffffd0'), flat: true, soft: true, glow: 1 };
MATS[M.TOOTH] = { ramp: ramp('#8a8a80', '#b8b8ac', '#e0e0d4', '#f4f4ec', '#ffffff'), flat: true, soft: true };
MATS[M.DARK] = { ramp: ramp('#040608', '#080c10', '#101820', '#18242e', '#22323e'), flat: true, soft: true };

function build(g, P, o) {
  const A = {}, T = turn(frame([0, P.py, 0]), 0, P.pitch, P.roll), ph = o.t * P.beat + o.wob;
  // kuyruğa doğru büyüyen yanal dalga
  const zf = x => Math.sin(ph + x * 0.55) * P.amp * Math.max(0, (2.5 - x) / 7), at2 = (x, y, z = 0) => at(T, x, y, z + zf(x));
  skin(g, [
    { p: at2(-4.6, 0), u: T.u, rx: 0.3, ry: 0.8 }, { p: at2(-2.7, 0), u: T.u, rx: 0.8, ry: 1.9 }, { p: at2(-0.4, 0), u: T.u, rx: 1.3, ry: 2.7 },
    { p: at2(1.8, 0), u: T.u, rx: 1.3, ry: 2.5 }, { p: at2(3.4, -0.1), u: T.u, rx: 1.1, ry: 1.9 }, { p: at2(4.3, -0.3), u: T.u, rx: 0.6, ry: 1 },
  ], 8, M.BODY, { sub: 2 });
  // kuyruk ve sırt yüzgeci
  const tr = at2(-4.5, 0), ta = at2(-6.9, 2.3), tb = at2(-6.9, -2.1), tm = at2(-5.9, 0);
  leaf(g, tr, ta, tm, M.FIN); leaf(g, tr, tm, tb, M.FIN);
  leaf(g, at2(-1.4, 2.4), at2(1, 2.5), at2(-1.9, 4.3), M.FIN);
  leaf(g, at2(-1.6, -2.3), at2(-0.2, -2.5), at2(-1.8, -3.6), M.FIN);
  // alt çene ve dişler
  const jw = P.jaw;
  ell(g, frame(at(T, 3.5, -1.4 - jw * 0.9, 0), T.f, T.u, T.r), 1.3, 0.5, 0.9, M.BELLY, 6, 3);
  if (jw > 0.3) dot(g, at(T, 4.2, -0.9, 0), M.DARK, 0);
  for (const s of [-1, 1]) {
    dot(g, at(T, 4.5, -1 - jw * 0.7, s * 0.4), M.TOOTH, 4); dot(g, at(T, 3.9, -1 - jw * 0.7, s * 0.7), M.TOOTH, 3);
    const q = at(T, 3.1, 0.6, s * 1.15); dot(g, q, M.EYE, 3); dot(g, q, M.DARK, 0, 1, 0);
    if (s > 0 === Math.cos(o.view) >= 0) A.eye = q;
    line(g, at2(1.2, -1, s * 1.3), at2(0, -1.9, s * 2.2), M.FIN, 3);
  }
  A.head = at(T, 0, 4.5, 0); A.mouth = at(T, 4.6, -0.8, 0);
  return A;
}

function pose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, dry = e.wet === false && !dead, near = Math.cos(o.view) >= 0 ? 1 : -1;
  let py = Math.sin(t * 3 + o.wob) * 0.4, pitch = 0, roll = 0, amp = 1.1 + o.walk * 0.8, beat = 9 + o.walk * 7, jaw = 0.15 + 0.15 * Math.abs(Math.sin(t * 5 + o.wob)), rate = 30;
  // karada: yan yatar, zıplayıp çırpınır
  if (dry) { const f = Math.abs(Math.sin(t * 8 + o.wob)); roll = near * (82 + Math.sin(t * 16 + o.wob) * 10); py = -2 + f * 2.6; pitch = Math.sin(t * 8 + o.wob) * 14; amp = 2.4; beat = 16; jaw = 0.5 * f; rate = 40; }
  const wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  if (wd > 0.001) jaw = Math.max(jaw, wd);
  if (l > 0.001) { jaw = Math.max(jaw, 1 - l * 0.6); pitch -= 8 * l; }
  if (o.hurt > 0 && !dead) roll += near * 20 * o.hurt * o.hurt;
  if (dead) { const d = o.dying, k = ss(0, 0.5, d); roll = near * 180 * k; py = lerp(py, 1.5, k); amp = 0.3; beat = 4; jaw = 0.6; rate = 50; }
  return { rate, py, pitch: pitch * D, roll: roll * D, amp, beat, jaw, zoom: e.scale || 1 };
}

export const PIRANA = { w: 36, h: 30, ox: 18, oy: 15, scale: 0.8, tilt: 0.16, center: true, mats: MATS, stride: 12, foot: 5, top: 6, shadow: 0, body: 7, crease: 1.4, outline: [6, 12, 16], turnRate: 10, wrap: ['roll'], view: o => mobView(o, 0.3), pose, build };
