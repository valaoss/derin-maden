// Kaya Kabuklusu: sırtında biyomun kayasından kubbe kabuk taşıyan kısa bacaklı yaratık; kabuğun üstünde kaya çıkıntıları.
// Vurulunca başını ve bacaklarını içeri çeker, kabuk yere oturup titrer; açılınca başı yeniden uzanır. Ölünce sırtüstü döner.
// Salyangoz: uzayıp kısalarak sürünen yumuşak gövde, sırtında biyomun renginde sarmal kabuk, uçları ışıyan iki göz sapı.
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, ss, mix, at, turn, shift, frame, ell, ball, bone, skin, prism } from '../boss/rig.js';
import { MAT_RAMP } from '../../data/palette.js';
import { mobView, ramp, fr } from './common.js';

const M = { SHELL: 1, ROCK: 2, SKIN: 3, EYE: 4 };
// kabuk: biyomun kaya rampası, bir ton açılmış (karanlıkta seçilsin)
const hx = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lift = R => [R[1], R[2], R[3], R[4], hx(mix(rgb(R[4]), [255, 255, 255], 0.35))];
const plates = (u, v, i) => i - (fr(u * 0.75) < 0.1 || (v > 0.3 && fr(v * 4.2) < 0.12) ? 0.3 : 0);
const spiral = (u, v, i) => i - (fr(v * 3.2 + u * 0.125) < 0.22 ? 0.28 : 0);

// ---------- Kaya Kabuklusu ----------
const ROCKS = { 1: 'stone', 3: 'hard', 8: 'obsidian', 10: 'quick', 15: 'titan', 20: 'mute', 25: 'magnet' };
function shellMats(mat) {
  const m = [], R = MAT_RAMP[mat];
  m[M.SHELL] = { ramp: ramp(...lift(R)), px: plates };
  m[M.ROCK] = { ramp: ramp(...R) };
  m[M.SKIN] = { ramp: ramp('#1a1210', '#3c2c26', '#62483c', '#8a6a56', '#b49478') };
  m[M.EYE] = { ramp: ramp('#7a1010', '#c02a1a', '#ff4a3a', '#ff7a5a', '#ffc0a0'), flat: true, soft: true, glow: 1 };
  return m;
}
const STEP = 1.8;
function step(ph, lift2) { const c = ph - Math.floor(ph); if (c < 0.6) return [STEP * (1 - 2 * c / 0.6), 0]; const k = (c - 0.6) / 0.4, e = k * k * (3 - 2 * k); return [STEP * (2 * e - 1), Math.sin(k * Math.PI) * lift2]; }

function shellBuild(g, P, o) {
  const A = {}, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), out = P.out;
  ell(g, frame(at(T, -0.4, 0.9, 0), T.f, T.u, T.r), 5.2, 3.7, 4.4, M.SHELL, 10, 5);
  for (const [x, z, h] of [[1.2, 0.8, 2.9], [-1.6, -1.2, 2.5], [-2.7, 1.4, 2]]) prism(g, at(T, x, 3.5, z), at(T, x - 0.3, 3.5 + h, z), 1.3, 0.5, M.ROCK, 4, x);
  if (out > 0.06) {
    const H = shift(T, 3.4 + 2.4 * out, -0.5, 0);
    ball(g, H.p, 1.6, M.SKIN, 6);
    for (const s of [-1, 1]) { const q = at(H, 1.1, 0.5, s * 0.8); dot(g, q, M.EYE, 3); if (s > 0 === Math.cos(o.view) >= 0) A.eye = q; }
    for (let i = 0; i < 4; i++) {
      const s = i & 1 ? -1 : 1, hip = at(T, i < 2 ? 2.6 : -2.6, -0.8, s * 2.8);
      bone(g, hip, mix(hip, P.feet[i], out), 1.15, 0.9, M.SKIN, 1, 5, true);
    }
  }
  A.head = at(T, 0, 5.5, 0); A.mouth = at(T, 5.5, -0.6, 0);
  return A;
}
function shellPose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, sh = e.shellT > 0 && !dead ? 1 : 0;
  let px = 0, py = 3.3 + Math.sin(t * 2.4 + o.wob) * 0.1, pitch = 0, roll = 0, out = 1, rate = 24;
  const feet = [[3.4, 0, 3.6], [3.4, 0, -3.6], [-3, 0, 3.6], [-3, 0, -3.6]];
  if (w > 0.01) {
    for (let i = 0; i < 4; i++) { const [dx, dy] = step(o.ph + (i === 0 || i === 3 ? 0 : 0.5), 1.1); feet[i][0] += dx * w; feet[i][1] += dy * w; }
    roll += Math.sin(o.ph * TAU) * 3 * w; py += Math.abs(Math.sin(o.ph * TAU)) * 0.25 * w;
  }
  // kabuğa çekilme: baş ve bacaklar içeride, kubbe yerde titrer
  if (sh) { out = 0; py = 2.5; roll = Math.sin(t * 46) * 2.2; rate = 40; }
  const wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  if (wd > 0.001 && !sh) { px -= 1 * wd; pitch += 6 * wd; }
  if (l > 0.001 && !sh) { px += 2.2 * l; pitch -= 7 * l; rate = 40; }
  if (o.hurt > 0 && !dead && !sh) { const h = o.hurt * o.hurt; py -= 0.5 * h; roll += near * 6 * h; }
  if (dead) {
    const d = o.dying, k = ss(0, 0.45, d), tw = (1 - ss(0.4, 0.85, d)) * k;
    roll = near * 180 * k; py = lerp(py, 3.4, k) + Math.sin(k * Math.PI) * 3; rate = 60;
    for (let i = 0; i < 4; i++) { const s = i & 1 ? -1 : 1; feet[i] = [lerp(feet[i][0], i < 2 ? 3.6 : -3.6, k), lerp(0, py + 3.2 + Math.sin(d * 40 + i * 2) * 1.2 * tw, k), lerp(feet[i][2], s * 3.2, k)]; }
  }
  for (const f of feet) f[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, out, feet, zoom: e.scale || 1 };
}
const shells = {};
export function shellDef(bio) {
  const k = ROCKS[bio] ? bio : 1;
  return shells[k] || (shells[k] = { w: 44, h: 36, ox: 22, oy: 27, scale: 0.9, tilt: 0.34, mats: shellMats(ROCKS[k]), stride: 6, foot: 6, top: 9, shadow: 8, body: 10, crease: 1.6, outline: [10, 8, 10], turnRate: 6, wrap: ['roll'], view: o => mobView(o, 0.45), pose: shellPose, build: shellBuild });
}

// ---------- Salyangoz ----------
const SNAILS = { 0: 'dirt', 2: 'moss', 13: 'fungus', 21: 'tide', 22: 'flesh', 27: 'rootwood', 30: 'falls' };
function snailMats(mat) {
  const m = [];
  m[M.SHELL] = { ramp: ramp(...lift(MAT_RAMP[mat])), px: spiral };
  m[M.SKIN] = { ramp: ramp('#2a2c14', '#56602a', '#8a9a44', '#b4c468', '#dcec98') };
  m[M.EYE] = { ramp: ramp('#5a6a10', '#9ab020', '#d8f040', '#ecff80', '#ffffc8'), flat: true, soft: true, glow: 1 };
  return m;
}
function snailBuild(g, P, o) {
  const A = {}, T = turn(frame([0, P.py, 0]), 0, 0, P.roll), st = P.st, u = T.u;
  skin(g, [
    { p: at(T, -5.6 - st, 0.5, 0), u, rx: 0.8, ry: 0.5 }, { p: at(T, -3.2 - st * 0.6, 0.9, 0), u, rx: 2, ry: 1 }, { p: at(T, 0, 1.1, 0), u, rx: 2.5, ry: 1.2 },
    { p: at(T, 3 + st * 0.6, 1.3, 0), u, rx: 2, ry: 1.3 }, { p: at(T, 4.9 + st, 1.9, 0), u, rx: 1.4, ry: 1.2 },
  ], 8, M.SKIN, { sub: 2 });
  // kabuk: sarmal ekseni yana bakar, hafif geriye yatık
  const C = turn(shift(T, -0.9, 3.9, 0), 0, P.lean);
  ell(g, frame(C.p, C.f, C.r, C.u), 3.5, 2.3, 3.3, M.SHELL, 10, 5);
  for (const s of [-1, 1]) {
    const a = at(T, 4.9 + st, 2.7, s * 0.6), b = at(T, 5.6 + st + P.stalk * 0.6, 2.7 + P.stalk * 2.2, s * 1.1);
    line(g, a, b, M.SKIN, 3); dot(g, b, M.EYE, 3);
    if (s > 0 === Math.cos(o.view) >= 0) A.eye = b;
  }
  A.head = at(T, 0, 7.5, 0); A.mouth = at(T, 6 + st, 1.4, 0);
  return A;
}
function snailPose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1;
  let st = Math.sin(o.ph * TAU) * 0.7 * w, py = 0.4, roll = 0, lean = -12 + Math.sin(t * 2 + o.wob) * 2, stalk = 0.85 + Math.sin(t * 3.1 + o.wob) * 0.15, rate = 18;
  if (o.lunge > 0.001) st += 1.2 * o.lunge;
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; stalk = 0.1; st -= 0.6 * h; lean -= 8 * h; }
  if (dead) { const d = o.dying, k = ss(0, 0.5, d); stalk = 0; st = -1.2 * k; roll = near * 70 * k; lean = lerp(lean, -40, k); rate = 50; }
  return { rate, st, py, roll: roll * D, lean: lean * D, stalk, zoom: e.scale || 1 };
}
const snails = {};
export function snailDef(bio) {
  const k = SNAILS[bio] ? bio : 0;
  return snails[k] || (snails[k] = { w: 44, h: 36, ox: 22, oy: 27, scale: 0.85, tilt: 0.3, mats: snailMats(SNAILS[k]), stride: 5, foot: 6, top: 9, shadow: 7, body: 9, crease: 1.6, outline: [10, 10, 6], turnRate: 4, view: o => mobView(o, 0.42), pose: snailPose, build: snailBuild });
}
