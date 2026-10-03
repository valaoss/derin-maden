// Yerde sürünen küçükler: Kemirgen, Cevher Faresi, Kabukbiti, Kristalböcek, Kor Böceği, Demir Kene, Tozböcek, Kemikçi.
// Hepsi aynı iskelet: gövde çerçevesi + çapraz basan bacak çiftleri; gövdeyi her tür kendi çizer.
// Saldırmadan önce geri çekilip kalkar, hamlede öne atılır; ölünce devrilir, bacakları titrer.
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, ss, at, turn, frame, ell, ball, spike, prism, ik } from '../boss/rig.js';
import { mobView, ramp, fr } from './common.js';

const M = { A: 1, B: 2, LEG: 3, EYE: 4, GLOW: 5, HOT: 6, C: 7 };
const EYE = { ramp: ramp('#7a1010', '#c02a1a', '#ff4a3a', '#ff7a5a', '#ffc0a0'), flat: true, soft: true, glow: 1 };
// a: ana gövde, b: ikinci parça (baş, kese, karın), leg: bacak; x: ek malzemeler (GLOW, HOT, C)
function mats(a, b, leg, x = {}, px) {
  const m = [];
  m[M.A] = { ramp: ramp(...a), px }; m[M.B] = { ramp: ramp(...b) }; m[M.LEG] = { ramp: ramp(...leg), flat: true, soft: true }; m[M.EYE] = EYE;
  for (const k in x) m[M[k]] = x[k];
  return m;
}
let HEAT = 0;   // Kor Böceği: çatlakların genişliği (kurulurken ayarlanır, aynı karede çizilir)
const head = (g, T, x, y, r, eye = 0.55) => { ball(g, at(T, x, y, 0), r, M.B, 5); for (const s of [-1, 1]) dot(g, at(T, x + r * 0.75, y + r * 0.3, s * r * eye), M.EYE, 3); };
const feelers = (g, T, o, x, y, L, m = M.LEG) => { for (const s of [-1, 1]) line(g, at(T, x, y, s * 0.5), at(T, x + L, y + 0.5 + Math.sin(o.t * 9 + s + o.wob) * 0.4, s * (0.6 + L * 0.6)), m, 3); };

// ---------- gövdeler ----------
// kemirgen ve fare: tüylü gövde, sivri burun, kulaklar, kuyruk. Kemirgen tıknaz, kazıcı pençeli; fare ince, uzun kuyruklu, altın dişli
function rat(g, T, P, o, K) {
  const f = K.fare, near = Math.cos(o.view) >= 0 ? 1 : -1, tw = Math.sin(o.t * (4 + 8 * o.walk) + o.wob) * (0.5 + o.walk);
  ell(g, frame(at(T, -0.6, 0, 0), T.f, T.u, T.r), f ? 3.1 : 3, f ? 1.75 : 2.1, f ? 1.8 : 2.2, M.A, 8, 4);
  ball(g, at(T, 2.4, 0.2, 0), f ? 1.4 : 1.6, M.A, 6);
  spike(g, at(T, 3.1, 0.1, 0), at(T, f ? 5.4 : 4.9, -0.3, 0), f ? 0.85 : 1.1, M.A, 4);
  dot(g, at(T, f ? 5.4 : 4.9, -0.2, 0), M.B, 3);
  dot(g, at(T, f ? 4.6 : 4.2, -1, 0), f ? M.GLOW : M.C, 4);
  for (const s of [-1, 1]) {
    dot(g, at(T, 1.9, 1.7, s * (f ? 1.3 : 1.1)), M.B, 3); if (f) dot(g, at(T, 1.9, 1.7, s * 1.3), M.B, 4, 0, -1);
      }
  dot(g, at(T, 3.4, 0.7, near * 1.05), M.EYE, 2);
  // kuyruk: fare uzun ve kıvrık, kemirgen kısa
  let p = at(T, -3.5, 0, 0); const n = f ? 4 : 2;
  for (let i = 1; i <= n; i++) { const q = at(T, -3.5 - i * 1.3, (f ? 0.9 : 0.3) * i - 0.12 * i * i * (f ? 1 : 0), tw * i * 0.3); line(g, p, q, M.B, 2); p = q; }
  // çalıntı kesesi: sırtta şişkin çuval, ağzından altın parlar
  if (f && P.sack > 0.05) { const k = P.sack, c = at(T, -1, 1.6 + k * 1.3, 0); ball(g, c, 1 + k * 1.5, M.C, 6); dot(g, at(T, -1, 3 + k * 2.9, 0), M.GLOW, 4); dot(g, at(T, -0.2, 2.9 + k * 2.6, 0.5), M.GLOW, 3); }
}
// kabukbiti: üst üste binen üç zırh halkası, altından çıkan küçük baş
function louse(g, T, P, o) {
  for (const [x, y, rx, ry, rz] of [[-2.7, 0, 2.3, 2, 2.7], [-0.4, 0.4, 2.5, 2.6, 3.2], [1.9, 0.1, 2.2, 2.2, 2.8]]) ell(g, frame(at(T, x, y, 0), T.f, T.u, T.r), rx, ry, rz, M.A, 8, 4);
  head(g, T, 4, -0.7, 1.15); feelers(g, T, o, 4.6, -0.5, 1.6);
}
// kristalböcek: mor gövde, sırtında büyüyen kristal kümesi; patlamaya yaklaştıkça yanıp söner
function crystal(g, T, P, o) {
  const k = 1 + P.hot * 0.35, m = P.hot > 0.05 && Math.sin(o.t * (18 + P.hot * 40)) > 0 ? M.HOT : M.GLOW;
  ell(g, frame(at(T, -0.4, 0, 0), T.f, T.u, T.r), 3.2, 1.9, 2.6, M.A, 8, 4);
  head(g, T, 3.2, -0.3, 1.2); feelers(g, T, o, 3.9, -0.1, 1.4);
  for (const [x, z, tx, ty, tz, r] of [[-0.6, 0, -0.9, 4.7, 0.2, 1], [1, 0.9, 2.2, 3.8, 1.8, 0.8], [-1.9, -0.9, -3.4, 3.6, -1.6, 0.8], [0.2, -1.2, 0.6, 3.2, -2.4, 0.6]])
    prism(g, at(T, x, 1, z), at(T, x + (tx - x) * k, 1 + (ty - 1) * k, z + (tz - z) * k), r * k, 0.15, m, 4, x);
}
// kor böceği: kara kabuk, içinden kor sızan çatlaklar; iki boynuz
function ember(g, T, P, o) {
  HEAT = P.hot + 0.12 * Math.sin(o.t * 3 + o.wob);
  ell(g, frame(at(T, -0.5, 0.2, 0), T.f, T.u, T.r), 3.3, 2.3, 2.8, M.A, 10, 5);
  head(g, T, 3.1, -0.4, 1.3);
  for (const s of [-1, 1]) spike(g, at(T, 3.6, -0.2, s * 0.8), at(T, 5.3, 0.5, s * 0.5), 0.45, M.B, 3);
}
// demir kene: top gibi çelik kubbe (perçinli plakalar), altında et; küçük baş, iki kıskaç
function tick(g, T, P, o) {
  ell(g, frame(at(T, -0.6, 0.6, 0), T.f, T.u, T.r), 3.5, 3.1, 3.5, M.A, 10, 5);
  head(g, T, 3.3, -0.8, 1.1, 0.7);
  for (const s of [-1, 1]) line(g, at(T, 4, -1, s * 0.6), at(T, 5.2 + P.bite * 0.5, -1.2, s * (0.9 - P.bite * 0.7)), M.C, 4);
}
// tozböcek: tek damla gövde, tek göz
function mote(g, T) { ell(g, frame(at(T, 0, 0, 0), T.f, T.u, T.r), 2, 1.35, 1.6, M.A, 6, 3); dot(g, at(T, 1.9, 0.2, 0), M.B, 1); dot(g, at(T, 1.6, 0.5, 0), M.EYE, 2); }
// kemikçi: omur dizisi gövde, kafatası baş, sırt dikenleri, kuyruk dikeni
function bony(g, T, P, o) {
  const sw = Math.sin(o.ph * TAU) * 0.5 * o.walk;
  [[1, 0, 1.5], [-0.7, 0.25, 1.3], [-2.2, 0.3, 1.1], [-3.5, 0.2, 0.85]].forEach(([x, y, r], i) => {
    ball(g, at(T, x, y, sw * i), r, M.A, 5);
    line(g, at(T, x, y + r, sw * i), at(T, x - 0.6, y + r + 1.1, sw * i), M.LEG, 4);
  });
  spike(g, at(T, -4, 0.2, sw * 3), at(T, -6.3, 1.2, sw * 5), 0.5, M.A, 3);
  ell(g, frame(at(T, 2.9, 0.4, 0), T.f, T.u, T.r), 1.8, 1.4, 1.6, M.C, 7, 4);
  for (const s of [-1, 1]) { dot(g, at(T, 4.6, 0.7, s * 0.9), M.EYE, 3); line(g, at(T, 4.2, -0.7, s * 0.6), at(T, 4.9 + P.bite * 0.6, -1.5, s * (0.7 + P.bite * 0.5)), M.C, 3); }
}

// ---------- türler ----------
// py: gövde yüksekliği; hip: [x, y, z] kökler; rest: [x, z] basış yerleri; L: uyluk, baldır; step/lift: adım; flip: ölüm devrilmesi (derece)
const BUG3 = { hip: [[1.6, -0.9, 1.6], [0, -0.9, 1.8], [-1.6, -0.9, 1.6]], rest: [[3.4, 3.6], [0.2, 4.4], [-3.4, 3.8]], L: [2.4, 2.8], step: 1.4, lift: 1.1, flip: 180 };
const KIND = {
  rodent: { body: rat, py: 2.3, hip: [[1.5, -0.9, 1.3], [-1.9, -0.9, 1.5]], rest: [[2.6, 1.9], [-2, 2.1]], L: [1.5, 1.6], step: 1.3, lift: 1, flip: 100, claw: true, rear: 16,
    mats: mats(['#2c1810', '#4e2e20', '#6e4430', '#8a5a3a', '#b07c54'], ['#6a3a3a', '#a86060', '#d88a8a', '#e8a8a0', '#ffd0c8'], ['#24140e', '#40261a', '#6a4430', '#a87858', '#d8a27a'], { B: { ramp: ramp('#6a3a3a', '#a86060', '#d88a8a', '#e8a8a0', '#ffd0c8'), flat: true, soft: true }, C: { ramp: ramp('#8a8070', '#b8b0a0', '#e0dcd0', '#f4f0e8', '#ffffff'), flat: true, soft: true } }) },
  fare: { body: rat, fare: true, py: 2.2, hip: [[1.4, -0.8, 1.1], [-2, -0.8, 1.3]], rest: [[2.6, 1.7], [-2.2, 1.9]], L: [1.5, 1.6], step: 1.6, lift: 1.1, flip: 100, rear: 10, legTone: 2,
    mats: mats(['#26260e', '#42421c', '#62622e', '#9a9a50', '#c8c880'], ['#6a4040', '#a86a6a', '#e0a0a0', '#f0c0c0', '#ffe0e0'], ['#30301a', '#585830', '#8a8a50', '#b8b878', '#e0e0a8'],
      { B: { ramp: ramp('#6a4040', '#a86a6a', '#e0a0a0', '#f0c0c0', '#ffe0e0'), flat: true, soft: true }, GLOW: { ramp: ramp('#8a5a0a', '#c8901a', '#ffd24a', '#ffe88a', '#fff8d0'), flat: true, soft: true, glow: 1 }, C: { ramp: ramp('#2a1c0e', '#4a321a', '#6e4c28', '#96703e', '#c09a5e'), px: (u, v, i) => i + (fr(u * 1.5) < 0.2 ? -0.12 : 0) } }) },
  bug: { ...BUG3, body: louse, py: 2.3, rear: 10,
    mats: mats(['#0e1c14', '#24472e', '#3f7a44', '#5e9e56', '#8ac470'], ['#080e0a', '#16241c', '#26402e', '#3a5c40', '#588058'], ['#060a08', '#101c14', '#1c3022', '#2e4a32', '#487048'], {}, (u, v, i) => i + (v > 0.7 ? 0.14 : v < 0.34 ? -0.2 : 0)) },
  boomer: { ...BUG3, body: crystal, py: 2.1, rear: 0, crouch: 0.5,
    mats: mats(['#1c0a26', '#38144e', '#5a2274', '#7c389c', '#a45cc4'], ['#0c0612', '#200c2c', '#381448', '#522064', '#743a8a'], ['#0a0610', '#1c0c28', '#341844', '#502a66', '#74468e'],
      { GLOW: { ramp: ramp('#7a2a9a', '#b048d8', '#e070ff', '#f0a8ff', '#ffd8ff'), glow: 1 }, HOT: { ramp: ramp('#e070ff', '#f0a8ff', '#ffd8ff', '#fff0ff', '#ffffff'), glow: 1 } }) },
  magmite: { ...BUG3, body: ember, py: 2.2, rear: 6, crouch: 0.3,
    mats: mats(['#120606', '#24100c', '#3a1410', '#5a2018', '#7a3020'], ['#0c0404', '#1c0a08', '#30100c', '#481a12', '#64281a'], ['#0a0404', '#1a0806', '#2e100a', '#481a10', '#6a2c18'],
      { GLOW: { ramp: ramp('#a03a10', '#d05a2a', '#ff9a4a', '#ffc070', '#ffe8a8'), flat: true, soft: true, glow: 1 } },
      // çatlaklar: kabuğun üstünde dallanan ince kor damarları; ısındıkça genişler
      (u, v, i, q) => { if (v > 0.3 && Math.min(Math.abs(fr(u * 0.75 + Math.sin(v * 12) * 0.22) - 0.5), Math.abs(fr(v * 3.1 + Math.sin(u * 2.6) * 0.25) - 0.5) * 0.8) < 0.045 + HEAT * 0.05) { q.id = M.GLOW; return 0.5 + HEAT * 0.4; } return i; }) },
  kene: { body: tick, py: 2.6, hip: [[1.8, -1.2, 1.9], [0.6, -1.3, 2.3], [-0.8, -1.3, 2.4], [-2.2, -1.2, 2]], rest: [[4.6, 3.6], [1.8, 5.4], [-1.6, 5.6], [-4.6, 4]], L: [2.8, 3.2], step: 1.3, lift: 1, flip: 180, rear: 12,
    mats: mats(['#3a4050', '#5e667a', '#8a92a8', '#b4bcd0', '#e6ecf6'], ['#2a1412', '#48241e', '#6e3a32', '#a8604e', '#c88470'], ['#1c2028', '#343a48', '#565e72', '#808aa0', '#b0b8cc'],
      { C: { ramp: ramp('#3a4050', '#5e667a', '#8a92a8', '#b4bcd0', '#e6ecf6'), flat: true, soft: true } },
      // sırtın tepesi şişkin et; çevresinde çelik plakalar, dikişler ve perçin sırası
      (u, v, i, q) => { if (v > 0.7) { q.id = M.B; return i + 0.1; } return i + (Math.abs(fr(u / 2) - 0.5) < 0.05 || Math.abs(v - 0.62) < 0.025 ? -0.4 : v < 0.44 && fr(u * 1.5) < 0.3 ? 0.3 : 0); }) },
  tozbocek: { body: mote, py: 1.5, hip: [[1, -0.5, 0.9], [0, -0.5, 1], [-1, -0.5, 0.9]], rest: [[1.8, 2.1], [0.1, 2.5], [-1.7, 2.1]], straight: true, step: 0.9, lift: 0.7, flip: 180, rear: 8,
    mats: mats(['#5e5828', '#8a8040', '#b0a860', '#c8c080', '#f0e8b0'], ['#141208', '#2a2610', '#48421c', '#6a622c', '#8a8040'], ['#1c1a0c', '#343018', '#544e26', '#7a7238', '#a09850']) },
  skitter: { body: bony, py: 3, hip: [[1.6, -0.3, 1.2], [0.4, -0.2, 1.3], [-1, -0.1, 1.2], [-2.4, 0, 1]], rest: [[5, 3.6], [2.2, 5.6], [-2.2, 5.8], [-5.4, 4]], L: [3.6, 4.6], step: 1.9, lift: 1.6, flip: 180, rear: 14, knee: true, pole: 1,
    mats: mats(['#3a3024', '#5a4a3a', '#8a7a5a', '#b8a888', '#d0c0a0'], ['#14100c', '#2a2218', '#40362a', '#5a4a3a', '#7a6850'], ['#2a2218', '#4a4030', '#7a6a50', '#b8a888', '#f0e8d8'],
      { C: { ramp: ramp('#5a4a3a', '#8a7a5a', '#d0c0a0', '#f0e8d8', '#ffffff') } }) },
};
const group = i => ((i >> 1) + (i & 1)) % 2;

function build(g, P, o, K) {
  const T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), near = Math.cos(o.view) >= 0 ? 1 : -1, dk = P.dead, lt = K.legTone || 1;
  K.body(g, T, P, o, K);
  for (let i = 0; i < P.feet.length; i++) {
    const k = i >> 1, s = i & 1 ? -1 : 1, h = K.hip[k], hip = at(T, h[0], h[1], s * h[2]), c = s * near > 0 ? 1 : 0;
    // ölünce bacaklar gövdeye göre karna toplanır ve titrer
    let ft = P.feet[i];
    if (dk > 0.001) { const d = at(T, h[0] * 1.2, h[1] - (K.straight ? 1.4 : K.L[1]) + Math.sin(o.dying * 46 + i * 1.7) * P.tw, s * h[2] * (0.8 + P.tw * 0.4)); ft = [lerp(ft[0], d[0], dk), lerp(ft[1], d[1], dk), lerp(ft[2], d[2], dk)]; }
    if (K.straight) { line(g, hip, ft, M.LEG, 1 + c); continue; }
    const kn = ik(hip, ft, K.L[0], K.L[1], [0, 1, s * (K.pole || 0.7)]);
    line(g, hip, kn, M.LEG, lt + 1 + c); line(g, kn, ft, M.LEG, lt + c);
    if (K.knee && c) dot(g, kn, M.LEG, 4);
    if (K.claw && k === 0) dot(g, [ft[0] + T.f[0] * 0.8, ft[1] + 0.3, ft[2] + T.f[2] * 0.8], M.C, 4);
  }
  return { head: at(T, 0, K.py + 2.5, 0), mouth: at(T, 4.4, -0.6, 0) };
}

function pose(o, K) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, n = K.hip.length * 2;
  let px = 0, py = K.py + Math.sin(t * 3 + o.wob) * 0.1, pitch = 0, roll = 0, rate = 34, dk = 0, tw = 0;
  const feet = []; for (let i = 0; i < n; i++) feet.push([K.rest[i >> 1][0], 0, K.rest[i >> 1][1] * (i & 1 ? -1 : 1)]);
  if (w > 0.01) {
    // çapraz gruplar sırayla basar
    for (let i = 0; i < n; i++) { const c = fr(o.ph + group(i) * 0.5 + (i >> 1) * 0.05); feet[i][0] += (c < 0.55 ? 1 - 2 * c / 0.55 : 2 * (c - 0.55) / 0.45 - 1) * K.step * w; feet[i][1] += c < 0.55 ? 0 : Math.sin((c - 0.55) / 0.45 * Math.PI) * K.lift * w; }
    roll += Math.sin(o.ph * TAU) * 3 * w; py += Math.abs(Math.sin(o.ph * TAU * 2)) * 0.18 * w;
  }
  // gerilme: geri çekilir, önü kalkar (patlayanlar yere siner ve titrer); hamle: öne atılır
  const rear = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge, hot = dead ? 0 : rear;
  if (rear > 0.001) {
    px -= 0.9 * rear; pitch += K.rear * rear; py += K.rear * 0.03 * rear - (K.crouch || 0) * rear;
    if (K.crouch) px += Math.sin(t * 60) * 0.25 * rear;
    else for (const i of [0, 1]) feet[i][1] += (1.2 + Math.sin(t * 24 + i * 2) * 0.4) * rear * K.lift;
  }
  if (l > 0.001) { px += 2 * l; pitch -= 8 * l; py -= 0.3 * l; for (const i of [0, 1]) feet[i][0] += 1.2 * l; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; py -= 0.5 * h; roll += near * 12 * h; px -= 0.6 * h; }
  if (dead) { const d = o.dying; dk = ss(0, 0.45, d); tw = (1 - ss(0.4, 0.85, d)) * dk; roll = near * K.flip * dk; py = lerp(py, K.flip > 120 ? K.py * 0.85 : K.py * 0.7, dk) + Math.sin(dk * Math.PI) * 2.4; rate = 60; }
  for (const f of feet) f[0] += px;
  const sack = K.fare ? (e.loot2 ? 1 : Math.min(1, (e.sack || 0) / 8) * 0.7 + (e.sack > 0 ? 0.3 : 0)) : 0;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, feet, dead: dk, tw, hot, bite: Math.max(rear, l), sack, zoom: e.scale || 1 };
}

const def = (type, o) => { const K = KIND[type]; return { tilt: 0.38, crease: 1.4, outline: [12, 8, 8], turnRate: 12, wrap: ['roll'], ...o, mats: K.mats, view: o2 => mobView(o2, 0.4), pose: o2 => pose(o2, K), build: (g, P, o2) => build(g, P, o2, K) }; };
export const DEFS = {
  rodent: def('rodent', { w: 32, h: 26, ox: 16, oy: 19, scale: 1, stride: 5.5, foot: 4, top: 6, shadow: 5, body: 6 }),
  fare: def('fare', { w: 40, h: 32, ox: 20, oy: 23, scale: 0.95, stride: 6.5, foot: 4, top: 6, shadow: 5, body: 6 }),
  bug: def('bug', { w: 40, h: 32, ox: 20, oy: 23, scale: 1.1, stride: 6, foot: 6, top: 8, shadow: 7, body: 8 }),
  boomer: def('boomer', { w: 38, h: 34, ox: 19, oy: 25, scale: 0.95, stride: 6, foot: 5, top: 9, shadow: 6, body: 7, outline: [14, 6, 18] }),
  magmite: def('magmite', { w: 38, h: 30, ox: 19, oy: 22, scale: 0.95, stride: 6, foot: 5, top: 7, shadow: 6, body: 7, outline: [14, 6, 4] }),
  kene: def('kene', { w: 44, h: 36, ox: 22, oy: 26, scale: 1, stride: 6, foot: 6, top: 9, shadow: 8, body: 9, outline: [10, 10, 14] }),
  tozbocek: def('tozbocek', { w: 24, h: 20, ox: 12, oy: 14, scale: 1.45, stride: 4, foot: 3, top: 4, shadow: 3, body: 4, crease: 1.2 }),
  skitter: def('skitter', { w: 44, h: 34, ox: 22, oy: 25, scale: 0.85, stride: 7, foot: 5, top: 7, shadow: 7, body: 7, outline: [16, 12, 8] }),
};
