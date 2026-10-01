// Ötegöz: havada süzülen dev göz. Mor iris, yarık göz bebeği; arkasını saran boşluk eti göz kapağı gibi kapanır,
// altından uçlarında küçük gözler olan gölge dokunaçlar sarkar. Kamera sabittir: bakış yönü ekran düzleminde hedefe döner.
import { dot } from '../soft3d.js';
import { TAU, clamp, ss, bump, mad, norm, cross, ell, ball, tube, frame, hash, meleeK } from './rig.js';

const M = { EYE: 1, IRIS: 2, PUPIL: 3, FLESH: 4, TENT: 5, TIP: 6, VEIN: 7 };
const R = 9.5, NT = 6, SEG = 7;
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
let E = { pupil: 0.5, lid: 1, swirl: 0, hot: 0, dead: 0 };
// göz küresi: kutup (v = 1) bakış yönü. İris kuşağı, ortasında dikey yarık; kenarlara doğru damarlı ak
function eyeball(u, v, i, out) {
  const a = (v - 0.5) * Math.PI, k = Math.cos(a), b = u / 8 * TAU, x = Math.cos(b) * k, z = Math.sin(b) * k, rad = Math.hypot(x, z);
  if (rad < 0.62 && v > 0.5) {
    const w = 0.07 + E.pupil * 0.3, h = 0.3 + E.pupil * 0.26;
    if (Math.abs(x) < w * Math.sqrt(Math.max(0, 1 - (z / h) * (z / h)))) { out.id = M.PUPIL; return 0.1; }
    out.id = M.IRIS; if (E.dead > 0.5) return 0.1;
    return 0.42 + (rad < 0.3 + E.pupil * 0.15 ? 0.34 : 0) + (fr(u * 2 + E.swirl + rad * 3) < 0.5 ? 0.1 : 0) + E.hot * 0.3 - (rad > 0.54 ? 0.3 : 0);
  }
  if (rad < 0.9 && v > 0.5 && fr(u * 1.5 + Math.sin(rad * 9) * 0.3) < 0.07) { out.id = M.VEIN; return i; }
  return i + 0.08;
}
// boşluk eti: gözün arkasını sarar; öndeki badem biçimli aralık (lid) kapanıp açılır
function flesh(u, v, i, out) {
  const a = (v - 0.5) * Math.PI, y = Math.sin(a), k = Math.cos(a), b = u / 8 * TAU, x = Math.cos(b) * k, z = Math.sin(b) * k;
  if (y > 0.05 && Math.abs(z) < E.lid * 0.92 * Math.sqrt(Math.max(0, 1 - x * x * 1.05))) { out.id = 0; return i; }
  return i + (fr(u * 1.3 + v * 5) < 0.5 ? 0.04 : -0.05);
}
const MATS = [];
MATS[M.EYE] = { ramp: ramp('#5a4a78', '#9a88b8', '#cfc2e4', '#eee6f8', '#ffffff'), px: eyeball };
MATS[M.IRIS] = { ramp: ramp('#2a0c58', '#5a20a8', '#8a48e0', '#b888ff', '#ecd8ff'), flat: true, glow: 1 };
MATS[M.PUPIL] = { ramp: ramp('#020104', '#040208', '#08040e', '#0c0616', '#120a20'), flat: true };
MATS[M.VEIN] = { ramp: ramp('#5a2060', '#8a3878', '#b05890', '#c878a8', '#e0a0c8') };
MATS[M.FLESH] = { ramp: ramp('#0c0618', '#1c0e30', '#30184c', '#482868', '#684088'), px: flesh };
MATS[M.TENT] = { ramp: ramp('#0a0514', '#180c2a', '#2a1444', '#402060', '#5c3480') };
MATS[M.TIP] = { ramp: ramp('#5a20a8', '#8a48e0', '#b888ff', '#dcc0ff', '#f8f0ff'), flat: true, glow: 1 };

function build(g, P, o) {
  const A = {}, t = o.t, s = P.size, c = [P.x, P.y, 0], gz = norm(P.gaze);
  E = { pupil: P.pupil, lid: clamp(P.lid, 0, 1), swirl: P.swirl, hot: P.hot, dead: P.dead };
  // göz çerçevesi: u = bakış; r = gözün "yukarısı" (kapaklar bu eksende kapanır, yarık bu eksende uzanır)
  const up = norm(cross(cross(gz, [0, 1, 0.001]), gz)), side = cross(up, gz), F = frame(c, side, gz, up);
  if (s > 0.05) {
    ell(g, F, R * s, R * s * P.sq, R * s, M.EYE, 14, 10);
    ell(g, F, (R + 1.1) * s, (R + 1.1) * s * P.sq, (R + 1.1) * s, M.FLESH, 14, 10);
    // arkada et yumruları
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.4, q = mad(mad(mad(c, gz, -R * 0.75 * s), up, Math.cos(a) * R * 0.6 * s), side, Math.sin(a) * R * 0.6 * s); ball(g, q, (2.4 + hash(i) * 1.6) * s, M.TENT, 6); }
  }
  // dokunaçlar: gözün altından sarkar; hareketle geride kalır, eyleme göre uzanır ya da büzülür
  for (let i = 0; i < NT; i++) {
    const a = i / NT * TAU + 0.5, root = [c[0] + Math.cos(a) * R * 0.55 * s - gz[0] * 3, c[1] - R * 0.72 * s, c[2] + Math.sin(a) * R * 0.55 * s - 2], pts = [root], L = (2.9 + hash(i + 3) * 1.3) * P.tlen;
    let p = root;
    for (let k = 1; k <= SEG; k++) {
      const q = k / SEG, ph = t * 2.4 - k * 0.7 + i * 1.9, wv = Math.sin(ph) * (0.7 + q * 2.2) * P.tsway;
      const dx = Math.cos(a) * (0.5 + P.splay * 1.4) * (1 - q * 0.5) + P.reach[0] * q * 1.3 - P.drag[0] * q + wv * Math.cos(a + 1.5);
      const dy = -1 + q * 0.5 + P.reach[1] * q * 1.3 - P.drag[1] * q + P.curl * q * 1.4 + Math.cos(ph * 0.8) * 0.3 * P.tsway;
      const dz = Math.sin(a) * (0.5 + P.splay * 1.4) * (1 - q * 0.5) + wv * Math.sin(a + 1.5) * 0.6;
      const n = norm([dx, dy, dz]); p = mad(p, n, L); pts.push(p);
    }
    tube(g, pts, k => (1.8 - k * 0.2) * (0.6 + 0.4 * s), 5, M.TENT);
    const e = pts[SEG]; ball(g, e, 1.2, M.TIP, 5);
    if (!i) A.tip = e;
  }
  A.eye = mad(c, gz, R * s); A.mouth = A.eye; A.chest = c; A.head = c;
  // patlamış gözden sızan parıltı noktaları
  if (P.dead > 0.3) for (let i = 0; i < 6; i++) dot(g, mad(c, [hash(i) - 0.5, -P.dead * (2 + hash(i + 2) * 6), 0.5], 6), M.IRIS, 2);
  return A;
}

const DIE_T = 1.8;
function pose(o) {
  const t = o.t, A = o.A, dead = o.dying > 0, rage = o.rage ? 1 : 0;
  // bakış: ekran düzleminde hedefe, biraz da kameraya (iris hep görünür); ara sıra kaçamak bakışlar
  let gx = o.tx, gy = -o.ty, zc = 0.75, lid = 1, pupil = 0.45 + rage * 0.2, swirl = t * 0.15, hot = rage * 0.3, size = 1, sq = 1, splay = 0.1, curl = 0, tsway = 1, tlen = 1, x = 0, y = Math.sin(t * 1.8 + o.wob) * 1.6, rate = 16;
  const d0 = Math.hypot(gx, gy) || 1; gx /= d0; gy /= d0;
  const sac = Math.floor(t * 0.7 + o.wob), drift = [(hash(sac) - 0.5) * 0.5, (hash(sac + 9) - 0.5) * 0.4];
  if (!o.act) { gx += drift[0]; gy += drift[1]; }
  if ((t + o.wob * 3) % 3.6 < 0.14) lid = 0.1;
  let reach = [0, 0], drag = [clamp(o.vx * 0.02, -1, 1), clamp(-o.vy * 0.02, -1, 1)];
  if (o.aim != null && (o.act === 'gaze' || o.act === 'orbs')) { gx = Math.cos(o.aim); gy = -Math.sin(o.aim); }
  if (o.act === 'orbs') {
    // bebek daralıp parlar, her küre fırlarken göz geri teper
    const k = bump(0, 0.1, 0.3, 0.5, o.since); pupil = 0.45 - 0.4 * k; hot = k; x -= gx * 1.8 * k; y -= gy * 1.8 * k; splay = 0.2 + 0.6 * k; zc = 0.7; rate = 30;
  } else if (o.act === 'pull') {
    // iris genişler ve döner, dokunaçlar hedefe uzanır
    const k = ss(0, 0.6, 2 - A.T), f = A.fire ? 1 : 0;
    pupil = 0.45 + 0.5 * k; swirl = t * (1 + 5 * k); hot = 0.4 * k + 0.4 * f; reach = [gx * (0.6 + 0.6 * k), gy * (0.6 + 0.6 * k) + 0.4]; x += gx * 2 * k; y += gy * 2 * k; splay = 0.5; tlen = 1 + 0.25 * k; tsway = 1.6; zc = 0.65;
  } else if (o.act === 'gaze') {
    // kısılır, sonra ışın: göz nişan yönüne kilitlenir ve tarar
    const k = ss(0, 0.8, 2.1 - A.T), f = A.fire ? 1 : 0;
    lid = 1 - 0.55 * k * (1 - f) - 0.15 * f; pupil = 0.45 - 0.35 * k; hot = 0.5 * k + 0.5 * f; reach = [-gx * 0.8 * f, -gy * 0.8 * f]; x -= gx * 1.2 * f; y -= gy * 1.2 * f; splay = 0.3 + 0.5 * f; zc = 0.62; rate = 34;
  }
  if (o.act === 'spiral') {
    // iris hızla döner, dokunaçlar açılır: küre kolları saçılır
    const k = ss(0, 0.45, o.since), f = A && A.fire ? 1 : 0;
    pupil = 0.45 + 0.4 * k; swirl = t * (1 + 7 * k); hot = 0.5 * k + 0.4 * f; splay = 0.2 + 0.7 * k; tsway = 2.2; zc = 0.6; rate = 30;
  } else if (o.act === 'stare') {
    // dosdoğru bakar: önce kısılır, sonra ardına kadar açılıp kızarır
    const k = ss(0, 1, o.since), f = A && A.fire ? 1 : 0;
    gx *= 1 - 0.7 * k; gy *= 1 - 0.7 * k; zc = 0.75 + 0.2 * k; lid = 1 - 0.5 * k * (1 - f); pupil = 0.45 - 0.35 * k * (1 - f) + 0.5 * f; hot = 0.3 * k + 0.7 * f; size = 1 + 0.12 * f; splay = 0.2 + 0.6 * f; tsway = 1 - 0.8 * k; rate = 34;
  }
  if (o.act === 'melee') {
    // dokunaçlarını geriye toplar, sonra hepsini birden madenciye kamçılar
    const [up, dn] = meleeK(o), k = -0.7 * up + 1.5 * dn;
    reach = [gx * k, gy * k + 0.5 * up]; curl = 0.5 * up; tlen = 1 - 0.15 * up + 0.5 * dn; splay = 0.3 * up + 0.15 * dn; tsway = 1 - 0.7 * Math.max(up, dn);
    x += gx * (-1.5 * up + 3 * dn); y += gy * (-1.5 * up + 3 * dn); pupil = 0.45 - 0.3 * up; hot = Math.max(hot, 0.5 * dn); lid = Math.min(lid, 1 - 0.3 * up); rate = 44;
  }
  if (o.blink > 0) { size = 1 - o.blink; lid = Math.min(lid, 1 - o.blink); hot = 1; curl = o.blink; tlen = 1 - 0.6 * o.blink; rate = 60; }
  if (rage && o.rageT < 1) { const k = bump(0, 0.15, 0.7, 1, o.rageT); pupil = 0.95; hot = 1; tsway = 3; splay = 0.2 + k; size = 1 + 0.12 * k; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; lid = Math.min(lid, 1 - 0.7 * h); x += clamp(o.hx, -1, 1) * 2 * h; y -= clamp(o.hy, -1, 1) * 2 * h; curl = 0.7 * h; tsway = 1 + 2 * h; pupil -= 0.2 * h; }
  let deadK = 0, alpha = 1;
  if (dead) {
    // iris kararır, göz söner ve büzülür; dokunaçlar gevşeyip sarkar
    const d = o.dying * DIE_T; deadK = ss(0.15, 0.5, d); lid = 1 - 0.6 * ss(0.3, 1, d); pupil = 0.9; sq = 1 - 0.35 * ss(0.4, 1.1, d); size = 1 - 0.3 * ss(0.8, 1.6, d); y -= 14 * ss(0.5, 1.6, d) * ss(0.5, 1.6, d);
    tsway = 1 - ss(0, 0.6, d); splay = -0.3; drag = [0, 0]; hot = bump(0, 0.1, 0.2, 0.5, d); gx += Math.sin(d * 14) * 0.3 * (1 - deadK); gy -= deadK * 0.8; alpha = 1 - ss(1.4, 1.8, d);
  }
  return { rate, x, y, gaze: [gx, gy, zc], lid, pupil: clamp(pupil, 0, 1), swirl, hot, size, sq, splay, curl, tsway, tlen, reach, drag, dead: deadK, alpha };
}

export const OTEGOZ = { w: 124, h: 146, ox: 62, oy: 52, scale: 1.3, tilt: 0.12, mats: MATS, fly: true, body: 22, view: () => 0, outline: [10, 4, 22], ownDeath: true, pose, build };
