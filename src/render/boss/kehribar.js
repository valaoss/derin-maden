// Kehribar Ana: kovanların kraliçesi. Kehribar kaplı göğüs, içinde yumurtaların göründüğü şiş, ışıyan karın kesesi;
// altı kitin bacak (üçer üçer adımlar), dört yırtık zar kanat, taçlı baş, iri petek gözler, açılıp kapanan çeneler.
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mix, mad, norm, cross, at, turn, shift, frame, ell, ball, bone, tube, spike, leaf, ik, reach, aimLocal, meleeK, hash } from './rig.js';

const M = { AMBER: 1, SAC: 2, EGG: 3, CHITIN: 4, EYE: 5, WING: 6, HORN: 7, DARK: 8 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
let lit = 0.5;
const MATS = [];
MATS[M.AMBER] = { ramp: ramp('#522008', '#8c3c0c', '#c46616', '#ee962c', '#ffd070'), glow: 0.3 };
// kese: boğum boğum, yarı saydam (içindeki yumurtalar seçilir); ışığı nabızla artar
function sacPx(u, v, i, out) {
  // zarın altından seçilen yumurtalar: boğum aralarında soluk benekler
  const cu = fr(u * 0.75 + Math.floor(v * 6.5) * 0.37) - 0.5, cv = fr(v * 6.5) - 0.55;
  if (v > 0.12 && v < 0.9 && cu * cu * 1.6 + cv * cv < 0.05) { out.id = M.EGG; return 0.45 + lit * 0.45; }
  return i + lit * 0.2 - (fr(v * 6.5) < 0.16 ? 0.26 : 0);
}
MATS[M.SAC] = { ramp: ramp('#5e2606', '#9c440e', '#d87218', '#fca030', '#ffdc88'), glow: 0.6, px: sacPx };
MATS[M.EGG] = { ramp: ramp('#b89850', '#e0c880', '#f8ecb8', '#fffbe0', '#ffffff'), flat: true, glow: 0.9 };
MATS[M.CHITIN] = { ramp: ramp('#0c0705', '#20120a', '#382212', '#56361c', '#7c5430') };
MATS[M.EYE] = { ramp: ramp('#020204', '#06060c', '#0e0e1a', '#2c2c48', '#9a9ac8') };
MATS[M.WING] = { ramp: ramp('#7a5020', '#b88838', '#e0b860', '#f8dc98', '#fff4d0'), dither: 2, back: M.WING, flat: true, px: () => 0.5 + lit * 0.4, glow: 0.4 };
MATS[M.HORN] = { ramp: ramp('#4a2408', '#844410', '#c07420', '#f0a840', '#ffe090') };
MATS[M.DARK] = { ramp: ramp('#1a0c04', '#2c1406', '#40200a', '#58300e', '#704014'), flat: true };

// bacak kökleri (göğüs çerçevesinde) ve durma yerleri: ön, orta, arka
const HIP = [[3.2, -2, 3.6], [0.2, -2.4, 4], [-2.8, -2, 3.6]], REST = [[10, 0, 11], [1.5, 0, 13.5], [-7.5, 0, 11.5]];

function build(g, P, o) {
  lit = P.lit;
  const A = {}, t = o.t, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll);
  // kanatlar: sırttan geriye yatık; açılınca yukarı ve yana kalkar, vızıldarken titrer
  const W = P.wing;
  for (const s of [-1, 1]) for (const v of [0, 1]) {
    const root = at(T, -1 - v * 2, 4, s * 2.4), bz = Math.sin(t * 70 + v * 2 + (s > 0 ? 0 : 1.3)) * W.buzz * 0.28;
    const d = norm(mix([-1, 0.22 - v * 0.2, s * (0.22 + v * 0.16)], [-0.32 - v * 0.3, 0.8 - v * 0.5, s * 0.86], W.spread)), dd = norm([d[0] * T.f[0] + d[1] * T.u[0] + d[2] * T.r[0], d[0] * T.f[1] + d[1] * T.u[1] + d[2] * T.r[1] + bz, d[0] * T.f[2] + d[1] * T.u[2] + d[2] * T.r[2]]);
    const L = (v ? 14 : 19) * W.len, side = norm(cross(dd, [0, 1, 0.01])), mid = mad(root, dd, L * 0.55), tip = mad(root, dd, L), a = mad(mad(mid, side, 3.2), [0, 1, 0], 0.8), b = mad(mad(mid, side, -3), [0, 1, 0], -0.6);
    leaf(g, root, a, tip, M.WING); leaf(g, root, tip, b, M.WING); line(g, root, tip, M.CHITIN, 3); line(g, root, a, M.CHITIN, 2);
  }
  // karın kesesi: içinde soluk yumurtalar; boğumlu yarı saydam zar
  const Ab = turn(shift(T, -4.5, -0.8, 0), P.sway, P.sacP), sc = P.sac, ctr = at(Ab, -9.5 * sc, -1, 0), SF = frame(ctr, Ab.u, [-Ab.f[0], -Ab.f[1], -Ab.f[2]], Ab.r);
  ell(g, SF, 7.6 * sc, 11 * sc * P.sacL, 7.8 * sc, M.SAC, 12, 8);
  spike(g, at(SF, 0, 10 * sc * P.sacL, 0), at(SF, -1, 14 * sc * P.sacL, 0), 1.4, M.CHITIN, 4);
  // göğüs: kehribar zırh, içinde hapsolmuş böcek lekeleri
  ell(g, T, 6.4, 5.2, 5.4, M.AMBER, 10, 6);
  for (let i = 0; i < 5; i++) { const a = hash(i + 20) * TAU; dot(g, at(T, Math.cos(a) * 3.5, 2 + hash(i + 23) * 2.6, Math.sin(a) * 4.6), M.DARK, 1); }
  ell(g, frame(at(T, 3.4, 2.6, 0), T.f, T.u, T.r), 3.4, 2.6, 4.4, M.CHITIN, 8, 4);
  // bacaklar: diz yukarıda, ayak yerde; ön çift kalkabilir
  for (let i = 0; i < 6; i++) {
    const k = i >> 1, s = i & 1 ? -1 : 1, hip = at(T, HIP[k][0], HIP[k][1], HIP[k][2] * s), ft = reach(hip, P.feet[i], 15.5), knee = ik(hip, ft, 7.5, 9, [0.15 * (1 - k), 1, s * 0.75]);
    bone(g, hip, knee, 1.5, 1.1, M.CHITIN, 1.1, 5); ball(g, knee, 1.3, M.CHITIN, 5); bone(g, knee, ft, 1.1, 0.5, M.CHITIN, 1, 5, true);
    spike(g, knee, mad(knee, [0, 1, 0], 2.2), 0.7, M.HORN, 3);
  }
  // baş: taç dikenleri, petek gözler, damlayan çeneler
  const H = turn(shift(T, 6 + P.headX, 1.4, 0), P.headY, P.headP), md = P.mand;
  ell(g, frame(at(H, 2.2, 0, 0), H.f, H.u, H.r), 3.6, 3.2, 3.4, M.CHITIN, 8, 5);
  for (const s of [-1, 1]) {
    ball(g, at(H, 3, 1, s * 2.7), 1.9, M.EYE, 6); if (s > 0 === !(P.near < 0)) A.eye = at(H, 3.6, 1.2, s * 3.6);
    tube(g, [at(H, 4.6, -1.6, s * 1.6), at(H, 7.2, -2.4 - md * 1.2, s * (2.6 + md * 2.6)), at(H, 9.4, -3 - md * 0.8, s * (1 + md * 3.2))], [1.1, 0.9, 0.3], 4, M.HORN);
    line(g, at(H, 3, 3, s * 1.4), at(H, 7 + Math.sin(t * 3 + s) * 0.6, 7.5, s * 4.4), M.CHITIN, 3);
  }
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.5; spike(g, at(H, 1.4, 2.8, Math.sin(a) * 2.6), at(H, 0.6 - Math.abs(i - 2) * 0.5, 6.8 - Math.abs(i - 2) * 1.1, Math.sin(a) * 4), 0.9, M.HORN, 3); }
  if (md > 0.3) dot(g, at(H, 7.5, -3.6, 0), M.AMBER, 4);
  // çeneden damlayan reçine
  const drip = (t * 0.8 + o.wob) % 1; dot(g, at(H, 7.6, -3.4 - drip * 5, 0.8), M.AMBER, drip < 0.6 ? 4 : 2);
  A.mouth = at(H, 8, -2.6, 0); A.chest = at(T, 3, 0, 0); A.head = H.p; A.sac = ctr;
  return A;
}

const DIE_T = 1.8;
function pose(o) {
  const t = o.t, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 2 + o.wob), rage = o.rage ? 1 : 0;
  let px = 2, py = 11 + br * 0.3, pitch = 4, roll = 0, headP = -4, headY = 0, headX = 0, mand = 0.12 + 0.1 * Math.max(0, Math.sin(t * 2.6)), sac = 1 + 0.05 * br, sacL = 1, sacP = -16, sway = Math.sin(t * 0.9) * 0.06, lit = 0.5 + 0.3 * br + rage * 0.2, rate = 22, lookW = 0.8, shadow = 1;
  const wing = { spread: 0.05 + rage * 0.15, buzz: (t * 0.37 + o.wob) % 2.4 < 0.3 ? 0.6 : 0, len: 1 };
  const feet = []; for (let i = 0; i < 6; i++) { const k = i >> 1, s = i & 1 ? -1 : 1; feet.push([REST[k][0] + px, 0, REST[k][2] * s]); }
  if (w > 0.01) {
    // altı ayaklı ağır sürünüş: üçer üçer adım, karın geride sallanır, kanatlar ara ara vızıldar
    for (let i = 0; i < 6; i++) { const grp = ((i >> 1) + (i & 1)) % 2, c = o.ph + grp * 0.5, q = c - Math.floor(c), dx = q < 0.62 ? 3.5 * (1 - 2 * q / 0.62) : 3.5 * (2 * ss(0.62, 1, q) - 1), dy = q < 0.62 ? 0 : Math.sin((q - 0.62) / 0.38 * Math.PI) * 2.4; feet[i][0] += dx * w; feet[i][1] += dy * w; }
    py += Math.sin(o.ph * 2 * TAU) * 0.4 * w; roll += Math.sin(o.ph * TAU) * 2 * w; sway += Math.sin(o.ph * TAU + 1) * 0.16 * w; sacP -= 4 * w; wing.buzz = Math.max(wing.buzz, 0.5 * w);
  }
  let rear = 0;
  const LAY = ['eggs', 'swarm', 'comb'];
  if (LAY.includes(o.act) || (LAY.includes(o.prev) && !o.act && o.since < 0.5)) {
    // şaha kalkar, kese sıkışır ve yumurtaları (sürüyü, petekleri) havaya fırlatır
    const c = o.act ? o.since : 0.4 + o.since, k = bump(0, 0.14, 0.45, 0.85, c), sq = bump(0.08, 0.2, 0.26, 0.5, c);
    rear = k; sac -= 0.2 * sq; sacL -= 0.12 * sq; sacP += 26 * sq; lit = 1; wing.spread += 0.5 * k; wing.buzz = k; mand = 0.5 * k; rate = 36;
  } else if (o.act === 'resin' || (o.prev === 'resin' && !o.act && o.since < 0.4)) {
    // baş öne atılır, çeneler ardına kadar açılır: reçine püskürür
    const c = o.act === 'resin' ? o.since : 0.4 + o.since, back = bump(0, 0.06, 0.08, 0.14, c), k = bump(0.08, 0.16, 0.4, 0.7, c);
    headX = -2 * back + 4.5 * k; px += -1.5 * back + 2.5 * k; mand = 1 * k + 0.3 * back; pitch -= 5 * k; headP += 6 * k; sacP += 8 * k; lit = 0.6 + 0.4 * k; rate = 40; lookW = 1;
  } else if (o.act === 'melee') {
    // ön bacaklarını kaldırır, başını öne atıp çeneleriyle kapar
    const [up, dn] = meleeK(o);
    rear = 0.45 * up; headX = -2 * up + 5 * dn; px += -1.5 * up + 3 * dn; mand = Math.max(0.9 * up, 0.1 * dn); pitch -= 6 * dn; headP += -6 * up + 8 * dn; wing.buzz = Math.max(wing.buzz, up); lit = 0.6 + 0.4 * dn; rate = 46; lookW = 1;
  } else if (o.act === 'amber' || (o.prev === 'amber' && !o.act && o.since < 0.7)) {
    // ön ayaklarını kaldırıp çığlık atar; kanatlar açılıp ışır
    const c = o.act === 'amber' ? o.since : 0.3 + o.since, k = bump(0, 0.14, 0.6, 1, c);
    rear = 0.7 * k; wing.spread = Math.max(wing.spread, k); wing.buzz = k; mand = 0.9 * k; headP += 22 * k; lit = 1; rate = 36; lookW *= 1 - k;
  }
  if (rage && o.rageT < 1.1) { const k = bump(0, 0.18, 0.75, 1.1, o.rageT); rear = Math.max(rear, 0.8 * k); wing.spread = Math.max(wing.spread, k); wing.buzz = Math.max(wing.buzz, k); mand = Math.max(mand, k); headP += 18 * k; lit = 1; sac += 0.1 * k; lookW *= 1 - k; }
  if (rear > 0.001) {
    pitch += 30 * rear; py += 3.5 * rear; px -= 2 * rear;
    for (const i of [0, 1]) { const s = i ? -1 : 1; feet[i] = [mix1(feet[i][0], px + 13, rear), 13 * rear + Math.sin(t * 16 + i * 2) * 1.5 * rear, mix1(feet[i][2], s * 7, rear)]; }
  }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; px += clamp(o.hx * Math.cos(o.view), -1, 1) * 1.6 * h; py -= 1 * h; headP += 12 * h; mand = Math.max(mand, 0.6 * h); wing.buzz = Math.max(wing.buzz, h); sac -= 0.06 * h; lit = 1; roll += near * 4 * h; }
  if (dead) {
    // kese patlar, kehribar çatlar; yan devrilir, bacaklar içe kıvrılır
    const d = o.dying * DIE_T, k = ss(0.3, 1, d), pop = ss(0.15, 0.35, d);
    sac = lerp(1.12, 0.42, pop) * (1 + 0.1 * bump(0, 0.1, 0.15, 0.25, d)); sacL = 1 - 0.3 * pop; lit = 1 - ss(0.2, 0.9, d); roll += near * 62 * k; py = lerp(py, 6.5, k); pitch = lerp(pitch, 0, k); headP -= 20 * k; mand = 0.5;
    for (let i = 0; i < 6; i++) { const s = i & 1 ? -1 : 1, kk = i >> 1; feet[i] = [mix1(feet[i][0], px + HIP[kk][0] + 1, k), mix1(0, py + 4 + (s * near > 0 ? 6 : -1), k) + Math.sin(d * 14 + i) * 1.5 * (1 - k) * pop, mix1(feet[i][2], s * 5 * (s * near > 0 ? 0.6 : 1.4), k)]; }
    wing.spread = 0.3 * (1 - k); wing.buzz = 1 - ss(0, 0.7, d); wing.len = 1 - 0.3 * k; lookW = 0; shadow = 1 - 0.3 * k; rate = 30;
  }
  const [ly0, lp0] = aimLocal(o.tx - Math.cos(o.view) * 12, o.ty + 6, o.view), ly = clamp(ly0, -0.9, 0.9) * lookW, lp = clamp(lp0, -0.4, 0.5) * lookW;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, headP: headP * D + lp, headY: headY + ly, headX, mand, sac, sacL, sacP: sacP * D, sway, lit, wing, feet, near, shadow };
}
const mix1 = (a, b, k) => a + (b - a) * k;

export const KEHRIBAR = { w: 170, h: 116, ox: 85, oy: 96, scale: 1.4, tilt: 0.24, mats: MATS, stride: 11, shadow: 22, body: 26, bias: 0.34, turn: 0.5, outline: [20, 8, 4], pose, build };
