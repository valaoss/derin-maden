// Çekici: yere yapışık iri kara kurbağası. Siğilli zeytin sırt, soluk karın, başın üstünde fırlak altın gözler,
// durmadan inip kalkan gırtlak kesesi, Z gibi katlanmış arka bacaklar. Yürümez, kısa sıçrayışlarla ilerler;
// dilini atarken ağzı ardına kadar açılır. Vurulunca gözlerini içeri çeker; ölünce sırtüstü döner, bacakları titrer.
import { dot, line } from '../soft3d.js';
import { D, lerp, clamp, ss, bump, mad, at, turn, shift, frame, ell, ball, bone, skin, ik, reach, aimLocal } from '../boss/rig.js';
import { mobView, ramp, fr, noise } from './common.js';

const M = { SKIN: 1, BELLY: 2, LEG: 3, EYE: 4, DARK: 5, MOUTH: 6 };
const MATS = [];
// sırt: koyu benekler ve açık siğiller; karın tarafı soluk
function skinPx(u, v, i, out) {
  if (v > 0.57 && v < 0.93) { out.id = M.BELLY; return i + 0.05; }
  const n = noise(Math.floor(u * 0.8), Math.floor(v * 16));
  return i + (n > 0.74 ? -0.24 : n < 0.1 ? 0.14 : 0);
}
MATS[M.SKIN] = { ramp: ramp('#10160a', '#263818', '#3e5a28', '#5e7e3a', '#86a458'), px: skinPx };
MATS[M.BELLY] = { ramp: ramp('#4a4a2e', '#7c7c50', '#aaa878', '#d2cea0', '#f0ecc8') };
// bacak: enine koyu bantlar
MATS[M.LEG] = { ramp: ramp('#10160a', '#263818', '#3e5a28', '#5e7e3a', '#86a458'), px: (u, v, i) => i - (fr(u * 0.42) < 0.3 ? 0.22 : 0) };
MATS[M.EYE] = { ramp: ramp('#8a5a10', '#c88a18', '#ffc030', '#ffd860', '#fff0a0'), flat: true, soft: true, glow: 1 };
MATS[M.DARK] = { ramp: ramp('#06080a', '#0a0e08', '#141c0e', '#1c2814', '#263818'), flat: true, soft: true };
MATS[M.MOUTH] = { ramp: ramp('#2a0812', '#56121f', '#8c2438', '#c04460', '#ee7a98'), flat: true };

function build(g, P, o) {
  const A = {}, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), H = turn(shift(T, 3.4, 0.9, 0), P.headY, P.headP), br = 1 + P.br;
  // gövde: kıçtan buruna tek parça; baş geniş ve basık
  skin(g, [
    { p: at(T, -5.8, -0.9, 0), u: T.u, rx: 1.5, ry: 1.3 }, { p: at(T, -4.2, -0.2, 0), u: T.u, rx: 3.8, ry: 2.8 }, { p: at(T, -1.2, 0.4, 0), u: T.u, rx: 4.9 * br, ry: 3.6 * br }, { p: at(T, 1.6, 0.7, 0), u: T.u, rx: 4.6, ry: 3.3 },
    { p: H.p, u: H.u, rx: 4.3, ry: 2.6 }, { p: at(H, 2.3, -0.1, 0), u: H.u, rx: 3.6, ry: 1.8 }, { p: at(H, 4, -0.4, 0), u: H.u, rx: 2.1, ry: 1 },
  ], 10, M.SKIN, { sub: 2 });
  // alt çene ve ağız içi: dil atarken açılır
  const jw = P.jaw, J = turn(shift(H, -0.2, -1, 0), 0, -jw * 0.8);
  if (jw > 0.08) { ell(g, frame(at(H, 2.2, -1 - jw * 1, 0), H.f, H.u, H.r), 2.6, 0.3 + jw * 1.5, 3.1, M.MOUTH, 8, 3); ell(g, frame(at(J, 2.2, -0.5, 0), J.f, J.u, J.r), 2.5, 0.7, 3.2, M.BELLY, 8, 3); }
  // gırtlak kesesi
  ball(g, at(J, 1.2, -0.9, 0), 1.9 + P.throat * 0.8, M.BELLY, 6);
  for (const s of [-1, 1]) {
    // ağız çizgisi, burun deliği
    if (jw <= 0.08) { line(g, at(H, 4.2, -0.5, s * 0.8), at(H, 2.6, -0.7, s * 3.2), M.DARK, 0); line(g, at(H, 2.6, -0.7, s * 3.2), at(H, 0.4, -0.5, s * 4.1), M.DARK, 0); }
    // göz: başın üstünde fırlak; kırpınca içeri çekilir
    const ey = 2.2 - P.blink * 1.3, c = at(H, 0.7, ey, s * 2.5);
    ball(g, c, 1.55, M.SKIN, 6);
    if (P.blink < 0.5 && Math.sin(o.view) > -0.6) { const q = at(H, 1.2, ey + 0.5, s * 3.6); dot(g, q, M.EYE, 3); dot(g, q, M.DARK, 0, 1, 0); if (s > 0 === Math.cos(o.view) >= 0) A.eye = q; }
  }
  // arka bacaklar: uyluk öne, baldır geriye katlı; uzun ayak yerde. Sıçrarken geriye uzanır
  for (const s of [-1, 1]) {
    const i = s > 0 ? 0 : 1, hip = at(T, -3.8, -0.8, s * 3.3), an = reach(hip, P.feet[i], 8.6), kn = ik(hip, an, 4.5, 4.5, [1, 0.45, s * 0.9]), ext = P.ext;
    const toe = mad(an, [lerp(3.4, -3.2, ext), lerp(-0.3, -1.2, ext) * (an[1] > 0.6 ? 1 : 0), s * lerp(1.4, 0.6, ext)], 1);
    bone(g, hip, kn, 1.9, 1.4, M.LEG, 1.2, 6); ball(g, kn, 1.4, M.LEG, 5); bone(g, kn, an, 1.3, 0.8, M.LEG, 1.1, 5); bone(g, an, toe, 0.8, 0.5, M.LEG, 1, 4, true);
    for (const k of [-1, 0, 1]) line(g, toe, mad(toe, [lerp(1.6, -1.6, ext), 0, s * 0.5 + k * 1.1], 1), M.LEG, 3);
  }
  // ön bacaklar: dirsek dışarıda, eller içe dönük
  for (const s of [-1, 1]) {
    const i = s > 0 ? 2 : 3, sh = at(T, 2.3, -1.3, s * 3.3), hd = reach(sh, P.feet[i], 5.2), el = ik(sh, hd, 2.7, 2.8, [-0.7, 0.2, s]);
    bone(g, sh, el, 1.2, 0.95, M.LEG, 1.1, 5); bone(g, el, hd, 0.9, 0.65, M.LEG, 1, 5, true);
    for (const k of [-1, 0, 1]) line(g, hd, mad(hd, [1.5, 0, -s * 0.5 + k * 0.9], 1), M.LEG, 3);
  }
  A.mouth = at(H, 3.6, -0.9 - jw * 0.5, 0); A.head = at(H, 0.6, 3, 0);
  return A;
}

// sıçrayış: döngünün ilk AIR'lik kısmı havada; gövde o sırada yol alır, yerdeyken durur (oyundaki konum sabit hızla kayar)
const AIR = 0.42, HOP = 8.5, LEAD = 0.7;
function pose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 2.2 + o.wob);
  let px = 0, py = 3.5, pitch = 13, roll = 0, headP = 0, headY = 0, jaw = 0, throat = 0.5 + 0.5 * Math.sin(t * 10 + o.wob), blink = (t * 1.1 + o.wob) % 3.7 < 0.16 ? 1 : 0, ext = 0, rate = 26;
  const feet = [[-4.4, 0.5, 5.6], [-4.4, 0.5, -5.6], [4.6, 0, 4.6], [4.6, 0, -4.6]];
  if (w > 0.01) {
    const q = fr(o.ph), j = clamp(q / AIR, 0, 1), air = q < AIR ? Math.sin(j * Math.PI) : 0, land = bump(AIR, AIR + 0.06, AIR + 0.1, AIR + 0.3, q);
    px += HOP * LEAD * ((q < AIR ? j : 1) - q - (0.5 - AIR / 2)) * w;
    py += (air * 2.8 - land * 0.7) * w; pitch += (lerp(12, -14, j) * (q < AIR ? 1 : 0) - land * 5) * w; ext = (q < AIR ? ss(0, 0.25, j) * (1 - ss(0.7, 1, j)) : 0) * w; throat *= 1 - 0.6 * w;
    // havada: arka bacaklar geriye uzanır, ön bacaklar öne açılır
    if (ext > 0.01) for (const i of [0, 1]) { const s = i ? -1 : 1; feet[i] = [lerp(feet[i][0], -9.6, ext), lerp(feet[i][1], py - 2.6 - air, ext), lerp(feet[i][2], s * 3.6, ext)]; }
    if (q < AIR) for (const i of [2, 3]) { const s = i > 2 ? -1 : 1, k = Math.sin(j * Math.PI) * w; feet[i] = [lerp(feet[i][0], 6.4, k), lerp(0, py - 3.4 + j * 1.5, k), lerp(feet[i][2], s * 3.8, k)]; }
  } else py += br * 0.1;
  // dil: baş hedefe döner, ağız açılır, gövde öne yaslanır
  if (e.tongue > 0 && !dead) {
    const [ly, lp] = aimLocal(e.tx - e.x, e.ty - e.y + 4, o.view);
    jaw = 1; headP = clamp(lp, -0.4, 0.75) / D * 0.8 + 16; headY = clamp(ly, -0.6, 0.6); px += 1.2; pitch += 3; throat = 0; blink = 0; rate = 40;
  }
  // ısırık: çöker, sonra ağzı açık öne atılır
  const wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  if (wd > 0.001) { py -= 0.7 * wd; pitch -= 5 * wd; px -= 1 * wd; jaw = Math.max(jaw, 0.35 * wd); }
  if (l > 0.001) { px += 2.6 * l; pitch += 4 * l; jaw = Math.max(jaw, l); ext = Math.max(ext, 0.5 * l); rate = 40; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; blink = 1; py -= 0.6 * h; roll += near * 8 * h; pitch -= 5 * h; throat = 0; }
  if (dead) {
    // sırtüstü döner: soluk karın yukarıda, bacaklar açılıp titrer, sonra gevşer
    const d = o.dying, k = ss(0, 0.4, d), tw = (1 - ss(0.4, 0.85, d)) * k;
    roll = near * 180 * k; py = lerp(py, 3.2, k) + Math.sin(k * Math.PI) * 3.2; pitch = lerp(pitch, -4, k); jaw = 0.5 * k; throat = 0; blink = ss(0.2, 0.5, d); ext = 0.4 * k; rate = 60;
    for (let i = 0; i < 4; i++) { const s = i & 1 ? -1 : 1, hind = i < 2; feet[i] = [lerp(feet[i][0], hind ? -8 : 5.6, k), lerp(feet[i][1], py + (hind ? 4.6 : 4.8) + Math.sin(d * 44 + i * 2.1) * 1.4 * tw, k), lerp(feet[i][2], s * (hind ? 6.2 : 5), k)]; }
  }
  for (const f of feet) f[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, headP: headP * D, headY, jaw, throat, blink, ext, br: 0.03 * br, feet, zoom: e.scale || 1 };
}

export const FROG = { w: 52, h: 40, ox: 26, oy: 30, scale: 1, tilt: 0.3, mats: MATS, stride: HOP, foot: 7, top: 10, shadow: 8, body: 10, crease: 1.6, outline: [8, 12, 6], turnRate: 7, wrap: ['roll'], view: o => mobView(o, 0.4), pose, build };
