// Örümcek: küçük baş-göğüs, arkada kalkık tüylü karın, dizleri gövdenin üstüne çıkan sekiz bacak (dörder dörder adımlar),
// öne uzanan iki duyarga, zehir dişleri, karanlıkta parlayan gözler. Saldırmadan önce ön bacaklarını kaldırıp şaha kalkar;
// ölünce sırtüstü döner, bacaklarını karnına toplar. Örümcekçik ve Örümcek Ana (sırtında yumurta kesesi) aynı iskelet.
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, ss, at, turn, shift, frame, ell, ball, ik, reach } from '../boss/rig.js';
import { mobView, ramp, fr } from './common.js';

const M = { BODY: 1, ABD: 2, LEG: 3, EYE: 4, FANG: 5, MARK: 6, EGG: 7 };
// tüy: ışık bandının kenarını tarayan ince tutamlar
const hair = (u, v, i) => i + (fr(u * 2.3 + Math.sin(v * 9) * 0.6) < 0.5 ? 0.05 : -0.05);
function mats(body, abd, leg) {
  const m = [];
  m[M.BODY] = { ramp: ramp(...body) };
  m[M.ABD] = { ramp: ramp(...abd), px: hair };
  m[M.LEG] = { ramp: ramp(...leg), soft: true, flat: true };
  m[M.EYE] = { ramp: ramp('#7a1010', '#c02a1a', '#ff4a3a', '#ff7a5a', '#ffc0a0'), flat: true, soft: true, glow: 1 };
  m[M.FANG] = { ramp: ramp('#1c0a08', '#3c140c', '#642414', '#96401e', '#d08040'), flat: true, soft: true };
  m[M.MARK] = { ramp: ramp('#5a4a40', '#8a7860', '#b8a888', '#e0d4b8', '#fff8e8'), flat: true, soft: true };
  m[M.EGG] = { ramp: ramp('#8a80a0', '#b8b0cc', '#dcd6ec', '#f4f0ff', '#ffffff'), glow: 0.5 };
  return m;
}
const KIND = {
  spider: { mats: mats(['#0e0a16', '#241a34', '#3e2e56', '#5e4a7c', '#8a74aa'], ['#0c0812', '#1e1430', '#36264e', '#523c70', '#7a629a'], ['#08060c', '#1c1628', '#3a2e4e', '#62507e', '#9482b0']), ab: 1, marks: 3 },
  spiderling: { mats: mats(['#141020', '#30264a', '#52427a', '#7a68a4', '#a898cc'], ['#120e1c', '#2a2040', '#483a6c', '#6e5c98', '#9c8cc0'], ['#0c0a12', '#241c34', '#463a60', '#74649a', '#a898cc']), ab: 0.86, marks: 0 },
  broodmother: { mats: mats(['#0a0610', '#1c1028', '#321c48', '#4e2e6c', '#74509a'], ['#08050e', '#180c24', '#2c1840', '#462860', '#6a4688'], ['#08060c', '#1c1628', '#3a2e4e', '#62507e', '#9482b0']), ab: 1.3, marks: 0, eggs: true },
};

// bacak kökleri (göğüs boyunca) ve durma yerleri: önden arkaya dört çift
const HIP = [1.9, 0.9, -0.1, -1], REST = [[7.4, 4.4], [3.8, 7.6], [-2.6, 8], [-7, 5.4]], L1 = 5, L2 = 6.6, STEP = 2.2;
const group = i => ((i >> 1) + (i & 1)) % 2;
function step(ph, lift) { const c = ph - Math.floor(ph); if (c < 0.6) return [STEP * (1 - 2 * c / 0.6), 0]; const k = (c - 0.6) / 0.4, e = k * k * (3 - 2 * k); return [STEP * (2 * e - 1), Math.sin(k * Math.PI) * lift]; }

function build(g, P, o, K) {
  const A = {}, t = o.t, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), near = Math.cos(o.view) >= 0 ? 1 : -1;
  // karın: göğsün arkasında, hafif kalkık; yürürken iki yana sallanır
  const Ab = turn(shift(T, -1.5, 0.2, 0), P.sway, P.abP), ab = K.ab * P.ab, C = frame(at(Ab, -3.3 * ab, 0.5, 0), Ab.f, Ab.u, Ab.r);
  ell(g, C, 3.7 * ab, 2.9 * ab, 3.2 * ab, M.ABD, 9, 5);
  for (let i = 0; i < K.marks; i++) { const x = 1.9 - i * 1.7; dot(g, at(C, x * ab, 2.9 * ab * Math.sqrt(1 - x * x / 13.7) + 0.2, 0), M.MARK, i ? 3 : 4); }
  dot(g, at(C, -3.8 * ab, -0.4, 0), M.FANG, 2);
  // yumurta kesesi: karnın sırtına yapışık soluk toplar
  if (K.eggs) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, r = i % 2 ? 1.5 : 0.7; ball(g, at(C, Math.cos(a) * r - 0.4, 3.5 + (i % 2 ? 0 : 0.7) + P.egg * 0.5, Math.sin(a) * r * 1.2), 1.15 + P.egg * 0.25, M.EGG, 5); }
  // baş-göğüs
  ell(g, frame(at(T, 0.7, 0, 0), T.f, T.u, T.r), 2.7, 1.7, 2.3, M.BODY, 8, 4);
  // bacaklar: uyluk yukarı, baldır aşağı; diz gövdenin üstünde. Uzak yandakiler koyu kalır
  for (let i = 0; i < 8; i++) {
    const k = i >> 1, s = i & 1 ? -1 : 1, hip = at(T, HIP[k], -0.3, s * 1.6), ft = reach(hip, P.feet[i], L1 + L2 - 0.3), kn = ik(hip, ft, L1, L2, [0.25 - k * 0.17, 1, s * 0.45]);
    const c = s * near > 0 ? 1 : 0;
    line(g, hip, kn, M.LEG, 2 + c); line(g, kn, ft, M.LEG, 1 + c); if (c) dot(g, kn, M.LEG, 4);
  }
  // duyargalar, zehir dişleri, gözler (arkadan bakınca görünmez)
  const pw = Math.sin(t * 5 + o.wob) * 0.35, front = Math.sin(o.view) > -0.4;
  for (const s of [-1, 1]) {
    line(g, at(T, 2.7, -0.2, s * 1.1), at(T, 4.5 + P.fang * 0.5, -1 + pw * s + P.fang * 0.9, s * (1.2 + P.fang * 0.6)), M.LEG, 3);
    line(g, at(T, 2.9, -0.7, s * 0.6), at(T, 3.1 + P.fang * 0.9, -1.6 + P.fang * 0.2, s * (0.5 + P.fang * 0.6)), M.FANG, P.fang > 0.5 ? 4 : 2);
    if (front) { dot(g, at(T, 3.3, 0.6, s * 0.7), M.EYE, P.eye > 0.5 ? 3 : 0); dot(g, at(T, 2.7, 1.2, s * 1.5), M.EYE, P.eye > 0.5 ? 1 : 0); }
  }
  A.mouth = at(T, 4, -0.8, 0); A.head = at(T, 2, 1.5, 0);
  return A;
}

function pose(o, K) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 3 + o.wob);
  let px = 0, py = 3.5 + br * 0.12, pitch = 0, roll = 0, abP = 8, sway = 0, fang = 0.15, eye = 1, ab = 1 + br * 0.02, egg = 0.5 + 0.5 * Math.sin(t * 4 + o.wob), rate = 30;
  const feet = []; for (let i = 0; i < 8; i++) { const k = i >> 1, s = i & 1 ? -1 : 1; feet.push([REST[k][0], 0, REST[k][1] * s]); }
  // arada bir tek bacağını oynatır
  if (!dead && w < 0.2) { const q = (t * 0.6 + o.wob) % 3; if (q < 0.4) { const i = Math.floor(o.wob * 7 + Math.floor(t * 0.2)) % 4; feet[i][1] += Math.sin(q / 0.4 * Math.PI) * 1.6; } }
  if (w > 0.01) {
    // koşu: çapraz dörtlüler sırayla basar, gövde hafifçe yalpalar
    for (let i = 0; i < 8; i++) { const [dx, dy] = step(o.ph + group(i) * 0.5 + (i >> 1) * 0.06, 1.7); feet[i][0] += dx * w; feet[i][1] += dy * w; }
    py += Math.sin(o.ph * 2 * TAU) * 0.22 * w; roll += Math.sin(o.ph * TAU) * 3 * w; sway = Math.sin(o.ph * TAU + 1) * 0.14 * w; abP += 3 * w;
  }
  // şaha kalkış (ağ atmadan / ısırmadan önce): ön iki çift havada, dişler açık
  const rear = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  if (rear > 0.001) {
    pitch += 24 * rear; py += 0.9 * rear; px -= 1 * rear; abP -= 12 * rear; fang = Math.max(fang, rear);
    for (const i of [0, 1, 2, 3]) { const s = i & 1 ? -1 : 1, hi = i < 2; feet[i] = [lerp(feet[i][0], hi ? 7 : 6.4, rear), lerp(feet[i][1], (hi ? 8.5 : 4) + Math.sin(t * 26 + i * 2) * 0.5, rear), lerp(feet[i][2], s * (hi ? 3.4 : 7), rear)]; }
  }
  // hamle: gövde öne atılır, ön bacaklar saplanır
  if (l > 0.001) { px += 2.4 * l; pitch -= 12 * l; py -= 0.5 * l; fang = Math.max(fang, l); for (const i of [0, 1]) { const s = i ? -1 : 1; feet[i] = [lerp(feet[i][0], 9, l), lerp(feet[i][1], 1, l), lerp(feet[i][2], s * 2.6, l)]; } }
  if (K.eggs && l > 0.001) { ab -= 0.14 * l; egg = 1.6; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; py -= 0.9 * h; roll += near * 9 * h; pitch += 6 * h; for (const f of feet) { f[0] *= 1 - 0.22 * h; f[2] *= 1 - 0.22 * h; } }
  if (dead) {
    // sırtüstü döner, bacaklar birkaç kez çırpınıp karnın üstünde kıvrılır
    const d = o.dying, k = ss(0, 0.4, d), tw = (1 - ss(0.35, 0.8, d)) * k;
    roll = near * 180 * k; py = lerp(py, 2.4, k) + Math.sin(k * Math.PI) * 3; pitch = 0; abP = lerp(abP, -4, k); eye = 1 - ss(0.3, 0.6, d); fang = 0.5; rate = 60;
    for (let i = 0; i < 8; i++) { const kk = i >> 1, s = i & 1 ? -1 : 1; feet[i] = [lerp(feet[i][0], HIP[kk] * 1.7 + 0.5, k), lerp(0, py + 3.6 + Math.sin(d * 50 + i * 1.9) * 1.6 * tw, k), lerp(feet[i][2], s * (1.6 + tw * 2), k)]; }
  }
  for (const f of feet) f[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, abP: abP * D, sway, fang, eye, ab, egg, feet, zoom: e.scale || 1 };
}

const def = (type, o) => ({ ...o, mats: KIND[type].mats, tilt: 0.4, crease: 1.6, outline: [10, 6, 14], turnRate: 11, wrap: ['roll'], view: o2 => mobView(o2, 0.38), pose: o2 => pose(o2, KIND[type]), build: (g, P, o2) => build(g, P, o2, KIND[type]) });
export const SPIDER = def('spider', { w: 48, h: 34, ox: 24, oy: 26, scale: 1, stride: 7.3, foot: 5, top: 9, shadow: 8, body: 9 });
export const SPIDERLING = def('spiderling', { w: 28, h: 22, ox: 14, oy: 16, scale: 0.52, stride: 8, foot: 3, top: 5, shadow: 4, body: 5 });
export const BROODMOTHER = def('broodmother', { w: 76, h: 56, ox: 38, oy: 42, scale: 1.55, stride: 11.4, foot: 9, top: 15, shadow: 13, body: 14 });
