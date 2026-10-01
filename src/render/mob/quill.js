// Kristal Kirpi: tombul koyu gövde, sivri burun, sırtında biyomun kristalinden ışıyan dikenler (Kobalt'ta mavi, Buz'da açık mavi,
// Kristal'de mor, Cam'da camgöbeği, Deniz'de lacivert, Sıfır'da beyaz). Vurulunca dikenlerini fırlatır: sırtı bir süre kütük kalır,
// dikenler yeniden uzar. Ölünce yan yatar, dikenleri söner.
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, ss, mad, at, turn, shift, frame, ell, ball, spike } from '../boss/rig.js';
import { mobView, ramp } from './common.js';

const M = { BODY: 1, CRY: 2, EYE: 3, DARK: 4 };
const CRYS = {
  3: ['#141c5a', '#2c48c8', '#5a86ff', '#9ab8ff', '#e0e8ff'], 4: ['#1e4a6a', '#2f7a9a', '#5ab0cc', '#bff4ff', '#ffffff'], 7: ['#3a0e52', '#9030c8', '#e070ff', '#f0b0ff', '#ffe8ff'],
  14: ['#1e3a44', '#2e5a68', '#5a98a8', '#a8e0ec', '#f0ffff'], 28: ['#0c1a3a', '#16305a', '#3a6aa8', '#7ab0e0', '#d0f0ff'], 29: ['#3a3a3a', '#6a6a6a', '#a8a8a8', '#e0e0e0', '#ffffff'],
};
function mats(cry) {
  const m = [];
  m[M.BODY] = { ramp: ramp('#0c0a10', '#201c2a', '#383244', '#544c62', '#7a7088') };
  m[M.CRY] = { ramp: ramp(...cry), glow: 1 };
  m[M.EYE] = { ramp: ramp('#7a1010', '#c02a1a', '#ff4a3a', '#ff7a5a', '#ffc0a0'), flat: true, soft: true, glow: 1 };
  m[M.DARK] = { ramp: ramp('#060508', '#0e0c12', '#1a1620', '#28222e', '#383040'), flat: true, soft: true };
  return m;
}
// diken yönleri: sırtın üst yarısına yayılmış
const QUILLS = [];
for (let i = 0; i < 13; i++) { const y = 0.25 + 0.75 * (i + 0.5) / 13, r = Math.sqrt(1 - y * y), a = i * 2.39996; QUILLS.push([Math.cos(a) * r * 0.9 - 0.25, y, Math.sin(a) * r, 2.6 + (i * 7 % 5) * 0.45]); }

function build(g, P, o) {
  const A = {}, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll);
  ell(g, frame(at(T, -0.3, 0, 0), T.f, T.u, T.r), 3.7, 2.9, 3.2, M.BODY, 9, 5);
  const H = shift(T, 3.2, -0.7, 0);
  ball(g, H.p, 1.5, M.BODY, 6); dot(g, at(H, 1.7, -0.1, 0), M.DARK, 0);
  for (const s of [-1, 1]) { const q = at(H, 0.9, 0.6, s * 0.9); dot(g, q, M.EYE, 3); if (s > 0 === Math.cos(o.view) >= 0) A.eye = q; }
  for (const [x, y, z, L] of QUILLS) {
    const b = at(T, -0.3 + x * 3.2, y * 2.5, z * 2.8);
    spike(g, b, mad(b, mad(mad([0, 0, 0], T.f, x), mad(mad([0, 0, 0], T.u, y), T.r, z), 1), L * P.spk), 0.75, M.CRY, 3);
  }
  for (let i = 0; i < 4; i++) { const s = i & 1 ? -1 : 1, hip = at(T, i < 2 ? 1.8 : -1.8, -2, s * 1.9); line(g, hip, P.feet[i], M.BODY, 2); }
  A.head = at(T, 0, 6, 0); A.mouth = at(H, 1.6, -0.3, 0);
  return A;
}

function pose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, cd = e.d.quillCd || 2.5;
  let px = 0, py = 3.2 + Math.sin(t * 3 + o.wob) * 0.12, pitch = 0, roll = 0, rate = 26;
  // dikenler: fırlattıktan sonra kütük, bekleme doldukça uzar
  let spk = e.quillCd > 0 ? lerp(0.25, 1, ss(0.15, 1, 1 - e.quillCd / cd)) : 1 + Math.sin(t * 4 + o.wob) * 0.04;
  const feet = [[2.2, 0, 2.4], [2.2, 0, -2.4], [-2.2, 0, 2.4], [-2.2, 0, -2.4]];
  if (w > 0.01) {
    for (let i = 0; i < 4; i++) { const c = o.ph + (i === 0 || i === 3 ? 0 : 0.5), k = c - Math.floor(c); feet[i][0] += (k < 0.6 ? 1 - 2 * k / 0.6 : 2 * (k - 0.6) / 0.4 - 1) * 1.4 * w; feet[i][1] += k < 0.6 ? 0 : Math.sin((k - 0.6) / 0.4 * Math.PI) * 0.9 * w; }
    roll += Math.sin(o.ph * TAU) * 5 * w; py += Math.abs(Math.sin(o.ph * TAU)) * 0.3 * w;
  }
  const wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  if (wd > 0.001) { px -= 0.8 * wd; pitch += 8 * wd; }
  if (l > 0.001) { px += 2 * l; pitch -= 10 * l; rate = 40; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; py -= 0.5 * h; roll += near * 8 * h; }
  if (dead) { const d = o.dying, k = ss(0, 0.45, d); roll = near * 110 * k; py = lerp(py, 2.6, k) + Math.sin(k * Math.PI) * 2; spk = lerp(spk, 0.2, ss(0.2, 0.7, d)); rate = 60; }
  for (const f of feet) f[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, spk, feet, zoom: e.scale || 1 };
}

const defs = {};
export function urchinDef(bio) {
  const k = CRYS[bio] ? bio : 7;
  return defs[k] || (defs[k] = { w: 40, h: 38, ox: 20, oy: 28, scale: 0.88, tilt: 0.34, mats: mats(CRYS[k]), stride: 6, foot: 6, top: 11, shadow: 7, body: 10, crease: 1.6, outline: [8, 6, 12], turnRate: 7, wrap: ['roll'], view: o => mobView(o, 0.45), pose, build });
}
