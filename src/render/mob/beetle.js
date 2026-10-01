// Altın Böceği: parlak altın kanat kınları (ortası dikişli), koyu baş ve boynuz, altı ince bacak. Madenciyi görünce
// üçer üçer basan bacaklarıyla seğirterek kaçar. Ölünce sırtüstü döner, bacakları titrer.
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, ss, at, turn, frame, ell, ball, spike, ik } from '../boss/rig.js';
import { mobView, ramp, fr } from './common.js';

const M = { GOLD: 1, DARK: 2, LEG: 3, EYE: 4 };
const MATS = [];
// kın: ortada dikiş, sırtta parlak şerit
MATS[M.GOLD] = { ramp: ramp('#4a2e06', '#9a6a12', '#e0a020', '#ffd24a', '#fff4c0'), px: (u, v, i) => i + (Math.abs(fr(u / 4 + 0.5) - 0.5) < 0.035 ? -0.4 : v > 0.72 ? 0.12 : 0), glow: 0.5 };
MATS[M.DARK] = { ramp: ramp('#0e0a06', '#2a1e0e', '#4a3418', '#6e5024', '#9a7438') };
MATS[M.LEG] = { ramp: ramp('#0a0806', '#1e160c', '#3a2a14', '#5a4220', '#806030'), flat: true, soft: true };
MATS[M.EYE] = { ramp: ramp('#7a1010', '#c02a1a', '#ff4a3a', '#ff7a5a', '#ffc0a0'), flat: true, soft: true, glow: 1 };

const REST = [[3.2, 3.4], [0.2, 4.2], [-3.2, 3.6]], HIP = [1.6, 0, -1.6];
function build(g, P, o) {
  const A = {}, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), near = Math.cos(o.view) >= 0 ? 1 : -1;
  ell(g, frame(at(T, -0.8, 0.5, 0), T.f, T.u, T.r), 3.3, 2, 2.6, M.GOLD, 10, 5);
  ell(g, frame(at(T, 2.3, 0.2, 0), T.f, T.u, T.r), 1.4, 1.4, 2.1, M.DARK, 8, 4);
  ball(g, at(T, 3.7, -0.1, 0), 1, M.DARK, 5);
  spike(g, at(T, 4, 0.5, 0), at(T, 5.6, 2.2, 0), 0.45, M.DARK, 3);
  for (const s of [-1, 1]) {
    dot(g, at(T, 4.3, 0.2, s * 0.6), M.EYE, 3);
    line(g, at(T, 4.2, 0.4, s * 0.5), at(T, 5.8, 0.6 + Math.sin(o.t * 9 + s) * 0.4, s * 1.8), M.LEG, 3);
    for (let k = 0; k < 3; k++) {
      const hip = at(T, HIP[k], -0.9, s * 1.5), ft = P.feet[k * 2 + (s > 0 ? 0 : 1)], kn = ik(hip, ft, 2.4, 2.8, [0, 1, s * 0.7]), c = s * near > 0 ? 1 : 0;
      line(g, hip, kn, M.LEG, 2 + c); line(g, kn, ft, M.LEG, 1 + c);
    }
  }
  A.head = at(T, 0, 4, 0); A.mouth = at(T, 4.6, -0.3, 0);
  return A;
}

function pose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1;
  let px = 0, py = 2.1 + Math.sin(t * 3 + o.wob) * 0.08, pitch = 2, roll = 0, rate = 34;
  const feet = []; for (let k = 0; k < 3; k++) for (const s of [1, -1]) feet.push([REST[k][0], 0, REST[k][1] * s]);
  if (w > 0.01) {
    // üçlü adım: bir yanın ön ve arkası, öbür yanın ortası birlikte basar
    for (let i = 0; i < 6; i++) { const c = o.ph + ((i >> 1) + (i & 1)) % 2 * 0.5, k = c - Math.floor(c); feet[i][0] += (k < 0.55 ? 1 - 2 * k / 0.55 : 2 * (k - 0.55) / 0.45 - 1) * 1.5 * w; feet[i][1] += k < 0.55 ? 0 : Math.sin((k - 0.55) / 0.45 * Math.PI) * 1.2 * w; }
    roll += Math.sin(o.ph * TAU) * 3 * w; py += Math.abs(Math.sin(o.ph * TAU * 2)) * 0.15 * w;
  }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; py -= 0.5 * h; roll += near * 12 * h; }
  if (dead) {
    const d = o.dying, k = ss(0, 0.45, d), tw = (1 - ss(0.4, 0.85, d)) * k;
    roll = near * 180 * k; py = lerp(py, 2, k) + Math.sin(k * Math.PI) * 2.6; rate = 60;
    for (let i = 0; i < 6; i++) { const s = i & 1 ? -1 : 1; feet[i] = [lerp(feet[i][0], HIP[i >> 1] * 1.4, k), lerp(0, py + 2.6 + Math.sin(d * 46 + i * 1.7) * 1.2 * tw, k), lerp(feet[i][2], s * 2, k)]; }
  }
  for (const f of feet) f[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, feet, zoom: e.scale || 1 };
}

export const BEETLE = { w: 34, h: 28, ox: 17, oy: 21, scale: 0.8, tilt: 0.38, mats: MATS, stride: 6, foot: 4, top: 7, shadow: 5, body: 7, crease: 1.4, outline: [14, 8, 4], turnRate: 12, wrap: ['roll'], view: o => mobView(o, 0.4), pose, build };
