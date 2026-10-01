// Kıvılcım Sineği: minik koyu gövde, ışıyan karın, titreyen iki zar kanat. Işığının rengi doğduğu biyoma uyar
// (Kor'da turuncu, Fırtına'da mavi, Boşluk'ta mor, Yaratılış'ta beyaz, Kehribar'da sarı). Ölünce ışığı söner, düşer.
import { dot } from '../soft3d.js';
import { D, ss, at, turn, frame, ball, leaf } from '../boss/rig.js';
import { mobView, ramp } from './common.js';

const M = { BODY: 1, GLOW: 2, WING: 3, OFF: 4 };
const GLOWS = {
  6: ['#7a2408', '#c0461a', '#ff7a2a', '#ffb050', '#ffe79a'], 9: ['#2a1c6a', '#5a40c0', '#9a80ff', '#c0b0ff', '#f0e8ff'], 11: ['#0e2e6a', '#2060c0', '#4a9aff', '#9ad0ff', '#e8f6ff'],
  19: ['#7a6a48', '#c0aa78', '#ffe8b0', '#fff4d8', '#ffffff'], 24: ['#6a3a08', '#b8701a', '#ffb040', '#ffd070', '#fff0c0'],
};
function mats(glow) {
  const m = [];
  m[M.BODY] = { ramp: ramp('#0a0808', '#1c1614', '#30262a', '#4a3c40', '#6a5a5c') };
  m[M.GLOW] = { ramp: ramp(...glow), flat: true, soft: true, glow: 1 };
  m[M.WING] = { ramp: ramp('#8890a0', '#a8b0c0', '#c8d0e0', '#e0e8f4', '#ffffff'), flat: true, soft: true, dither: 2, back: M.WING };
  m[M.OFF] = { ramp: ramp('#1a1210', '#2c2018', '#44301e', '#5c4226', '#765632'), flat: true, soft: true };
  return m;
}

function build(g, P) {
  const T = turn(frame([0, P.py, 0]), 0, P.pitch, P.roll);
  ball(g, at(T, -0.9, 0, 0), 1.25, P.lit > 0.5 ? M.GLOW : M.OFF, 5);
  ball(g, at(T, 0.6, 0.2, 0), 0.95, M.BODY, 5);
  dot(g, at(T, 1.5, 0.3, 0), M.BODY, 4);
  for (const s of [-1, 1]) leaf(g, at(T, 0.4, 0.8, s * 0.3), at(T, 0.9, 1 + P.flap * 2 * s, s * 2.9), at(T, -1.5, 1.2 + P.flap * 2 * s, s * 2.6), M.WING, s);
  return { head: at(T, 0, 2, 0) };
}

function pose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0;
  let flap = Math.sin(t * 62 + o.wob * 9), pitch = 8, roll = Math.sin(t * 7 + o.wob) * 12, py = Math.sin(t * 11 + o.wob * 3) * 0.8, lit = 1;
  if (dead) { const d = o.dying; flap = 0; roll = 150 * ss(0, 0.5, d); py = -4 * d * d; lit = 0; }
  return { rate: 60, flap, pitch: pitch * D, roll: roll * D, py, lit, zoom: e.scale || 1 };
}

const defs = {};
export function flyDef(bio) {
  const k = GLOWS[bio] ? bio : 6;
  return defs[k] || (defs[k] = { w: 16, h: 16, ox: 8, oy: 8, scale: 1, tilt: 0.25, center: true, mats: mats(GLOWS[k]), stride: 20, foot: 3, top: 4, shadow: 0, body: 4, crease: 1.2, outline: [10, 6, 8], turnRate: 14, view: o => mobView(o, 0.4), pose, build });
}
