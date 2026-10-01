// Madenin Kalbi: koyu kızıl kristalden, havada asılı dev bir yürek. Çift vuruşla atar, içinden kızıl ışık sızar;
// üstünde kara taş damarlar, bakır cevheri, kristal dikenler, gömülü ray ve kopuk zincirler; çevresinde kıymıklar döner.
import { dot, line } from '../soft3d.js';
import { TAU, clamp, ss, bump, mad, norm, tube, spike, prism, hash, meleeK } from './rig.js';

const M = { CRYSTAL: 1, STONE: 2, COPPER: 3, GLOW: 4, IRON: 5, SHARD: 6, DEAD: 7 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb);
let boost = 0;
const MATS = [];
// atışta yüzeyler bir ton parlar
MATS[M.CRYSTAL] = { ramp: ramp('#1a020a', '#420616', '#780e26', '#b41a3a', '#f04c6a'), px: (u, v, i) => i + boost * 0.26, glow: 0.35 };
MATS[M.STONE] = { ramp: ramp('#080607', '#181415', '#2a2425', '#423839', '#5e5253') };
MATS[M.COPPER] = { ramp: ramp('#5a2a10', '#8a4a1c', '#c0742c', '#e8a04c', '#ffd088') };
MATS[M.GLOW] = { ramp: ramp('#8a0c28', '#d82444', '#ff5a70', '#ff98a8', '#ffe4e8'), flat: true, glow: 1 };
MATS[M.IRON] = { ramp: ramp('#0e0e12', '#202028', '#363642', '#525262', '#767688') };
MATS[M.SHARD] = { ramp: ramp('#7a0c24', '#c82040', '#ff4a64', '#ff8a9c', '#ffd8e0'), glow: 0.8 };
MATS[M.DEAD] = { ramp: ramp('#0a0809', '#1c1819', '#302a2b', '#4a4042', '#685c5e') };

// kesitler: [y, yarıçap, merkez x] sivri uçtan omuzlara
const PROFILE = [[-13.5, 0.5, -2.4], [-9.5, 4.6, -1.6], [-4.5, 8.3, -0.6], [1, 9.6, 0], [5.5, 8.2, 0.3], [8.5, 5, 0.4]];
const SPIKES = []; for (let i = 0; i < 10; i++) { const a = hash(i + 2) * TAU, y = -8 + hash(i + 5) * 14; SPIKES.push([Math.cos(a), (y + 2) / 16, Math.sin(a), y, 2.4 + hash(i + 8) * 2.2]); }

function build(g, P, o) {
  const A = {}, t = o.t, s = P.s, sy = P.sy, c = [P.x, P.y, 0], body = P.stone > 0.5 ? M.DEAD : M.CRYSTAL, live = P.stone < 0.5;
  boost = P.beat;
  const pt = (x, y, z) => [c[0] + x * s, c[1] + y * s * sy, c[2] + z * s];
  // gövde: yedi yüzlü kristal halkalar; kenarlardan biri damar (taş), biri çatlak (ışık)
  let prev = null;
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [y0, r0, x0] = PROFILE[i], [y1, r1, x1] = PROFILE[i + 1], q = prism(g, pt(x0, y0, 0), pt(x1, y1, 0), r0 * s, r1 * s, body, 7, i * 0.4 + 0.2);
    for (let j = 0; j < 7; j++) {
      if ((j + i) % 3 === 0) line(g, q.A[j], q.B[j], M.STONE, 1);
      else if (live && (j * 2 + i) % 5 === 0) line(g, q.A[j], q.B[j], M.GLOW, P.beat > 0.4 ? 4 : 2);
      if (hash(i * 7 + j) < 0.3) dot(g, [(q.A[j][0] + q.B[(j + 1) % 7][0]) / 2, (q.A[j][1] + q.B[(j + 1) % 7][1]) / 2, (q.A[j][2] + q.B[(j + 1) % 7][2]) / 2], M.COPPER, 3 + (j % 2));
    }
    prev = q;
  }
  // kulakçıklar ve kesik damarlar
  prism(g, pt(-4.2, 5, 1.5), pt(-5, 11.5, 2), 4.4 * s, 2.6 * s, body, 5, 0.3); prism(g, pt(4.6, 4.5, -1), pt(5.4, 10.5, -1.4), 3.8 * s, 2.2 * s, body, 5, 0.9);
  tube(g, [pt(0.5, 8, 0), pt(1.6, 13, 0), pt(-1, 16.2, 0.8), pt(-5, 16.6, 1.8)], [2.3 * s, 2.1 * s, 1.9 * s, 1.7 * s], 6, M.STONE);
  tube(g, [pt(-2.4, 8, 2.4), pt(-4.4, 12.6, 3.4)], [1.7 * s, 1.5 * s], 5, M.STONE); tube(g, [pt(4, 8, -1.4), pt(5.2, 13.4, -1.6)], [1.6 * s, 1.4 * s], 5, M.STONE);
  // kristal dikenler: saldırıda uzar
  for (const [dx, dy, dz, y, len] of SPIKES) {
    const k = (y + 13.5) / 22, r = 9.4 * Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.78) + 0.6, d = norm([dx, dy, dz]), b = pt(dx * r * 0.82, y, dz * r * 0.82), L = len * (0.5 + P.spike * 3.4) * (live ? 1 : 0.5);
    spike(g, b, mad(b, d, L * s), (1.5 + P.spike * 0.6) * s, P.spike > 0.3 && live ? M.SHARD : body, 4);
  }
  // gövdeye saplanmış ray parçası ve iki kopuk zincir
  prism(g, pt(6, -3, 3), pt(13.5, 1.5, 6), 0.9, 0.9, M.IRON, 4); prism(g, pt(-6.5, 2, -3), pt(-13, 6.4, -5), 0.9, 0.9, M.IRON, 4);
  for (const [ax, ay, az, n, ph] of [[13.5, 1.5, 6, 6, 0], [-13, 6.4, -5, 4, 1.7]]) {
    let p = pt(ax, ay, az);
    for (let k = 0; k < n; k++) {
      const an = Math.sin(t * 1.7 + ph - k * 0.35) * 0.28 * P.swing - P.lag * (k / 7), q = [p[0] + Math.sin(an) * 2.2, p[1] - Math.cos(an) * 2.2, p[2]];
      line(g, p, q, M.IRON, k % 2 ? 4 : 2); p = q;
    }
  }
  // çevrede dönen kıymıklar: eğik bir halkada, kalbin önünden ve arkasından geçer
  for (let i = 0; i < 6; i++) {
    const a = P.orb + i * TAU / 6, Rr = 15.5 * P.spread, fall = P.fall * (0.6 + hash(i) * 0.8), p = [c[0] + Math.cos(a) * Rr, c[1] + Math.sin(a) * Rr * 0.34 + Math.sin(t * 2 + i) * 0.8 - fall * 26, c[2] + Math.sin(a) * Rr];
    const d = [Math.sin(a * 2 + i) * 0.4, 1, Math.cos(a * 3 + i) * 0.4];
    spike(g, p, mad(p, d, 3), 1.1, live ? M.SHARD : M.DEAD, 3); spike(g, p, mad(p, d, -2.2), 1.1, live ? M.SHARD : M.DEAD, 3);
  }
  A.eye = A.chest = A.mouth = A.head = c;
  return A;
}

const DIE_T = 1.8;
// çift vuruş: "lub-dub"
const lub = ph => { const c = ph - Math.floor(ph); return bump(0, 0.06, 0.1, 0.24, c) + 0.7 * bump(0.22, 0.28, 0.32, 0.5, c); };
function pose(o) {
  const t = o.t, A = o.A, dead = o.dying > 0, rage = o.rage ? 1 : 0;
  let beat = lub(t / (rage ? 0.8 : 1.15) + o.wob), s = 1 + beat * 0.07, sy = 1, x = clamp(o.vx * 0.04, -2, 2), y = Math.sin(t * 1.3 + o.wob) * 1.8, spike = 0, spread = 1, orb = t * (1.1 + rage * 0.6), swing = 1, lag = clamp(o.vx * 0.02, -0.6, 0.6), stone = 0, fall = 0, rate = 24, alpha = 1;
  const BURST = ['spikes', 'clot'], QUAKE = ['fall', 'grow'];
  if (BURST.includes(o.act) || (BURST.includes(o.prev) && !o.act && o.since < 0.6)) {
    // sıkışır, sonra dikenleri dört yana fırlar; yavaşça geri çekilir
    const c = o.act ? o.since : 0.4 + o.since, cl = bump(0, 0.1, 0.14, 0.2, c), out = ss(0.14, 0.2, c) * (1 - ss(0.5, 1, c));
    s = 1 - 0.14 * cl + 0.06 * out; spike = out; beat = Math.max(beat, out); spread = 1 + 0.5 * out; rate = 50;
  } else if (QUAKE.includes(o.act) || (QUAKE.includes(o.prev) && !o.act && o.since < 0.5)) {
    // şişer ve sarsılır: tavan çöker
    const c = o.act ? o.since : 0.3 + o.since, k = bump(0, 0.12, 0.4, 0.8, c);
    s = 1 + 0.16 * k; x += Math.sin(t * 60) * 1.4 * k; y += Math.cos(t * 47) * k; beat = Math.max(beat, k * 0.8); swing = 1 + 3 * k; rate = 50;
  } else if (o.act === 'melee') {
    // büzülür, sonra dikenlerini madenciye doğru fırlatıp geri çeker
    const [up, dn] = meleeK(o), dx = clamp(o.tx / 20, -1, 1), dy = clamp(-o.ty / 20, -1, 1), k = -1 * up + 3 * dn;
    s = 1 - 0.12 * up + 0.07 * dn; spike = 0.8 * dn; spread = 1 - 0.3 * up + 0.35 * dn; beat = Math.max(beat, dn); x += dx * k; y += dy * k; orb += up * 2; rate = 50;
  } else if (o.act === 'beat' && A) {
    // küçülüp kararır, sonra bütün ışığıyla patlar
    const k = ss(0, 0.9, o.wind);
    s = 1 - 0.2 * k; sy = 1 - 0.06 * k; beat = (1 - k) * beat * 0.4; spread = 1 - 0.45 * k; orb = t * 1.1 + k * k * 9; rate = 30;
  } else if (o.prev === 'beat' && !o.act && o.since < 0.6) {
    const k = 1 - ss(0, 0.6, o.since); s = 1 + 0.3 * k; beat = 1; spread = 1 + 0.9 * k; spike = 0.35 * k; rate = 60;
  }
  if (rage && o.rageT < 1) { const k = bump(0, 0.15, 0.6, 1, o.rageT); s += 0.2 * k; beat = Math.max(beat, k); spike = Math.max(spike, 0.5 * k); spread += 0.5 * k; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; s -= 0.08 * h; x += clamp(o.hx, -1, 1) * 2 * h; y -= clamp(o.hy, -1, 1) * 2 * h; spread += 0.35 * h; beat = Math.max(beat, h); }
  if (dead) {
    // atışlar seyrekleşip teklenir; ışık söner, kristal taşa döner ve aşağı çöker, kıymıklar düşer
    const d = o.dying * DIE_T, k = ss(0, 0.9, d);
    beat = lub(d * (1.6 - k * 1.2)) * (1 - k) + bump(0.8, 0.9, 0.95, 1.2, d); s = 1 + beat * 0.08 - 0.12 * ss(1, 1.6, d); stone = ss(0.95, 1.1, d); fall = ss(0.9, 1.7, d); y -= 16 * ss(1, 1.7, d) * ss(1, 1.7, d); sy = 1 - 0.18 * ss(1.2, 1.7, d);
    spread = 1 + 0.3 * k; swing = 1 - k; orb = t * 1.1 * (1 - k); alpha = 1 - ss(1.5, 1.8, d); rate = 40;
  }
  return { rate, x, y, s, sy, beat, spike, spread, orb, swing, lag, stone, fall, alpha, glow: 0.5 + beat * 0.9 };
}

export const MADENKALBI = { w: 120, h: 124, ox: 60, oy: 58, scale: 1.3, tilt: 0.16, mats: MATS, fly: true, body: 24, view: o => Math.sin(o.t * 0.5 + o.wob) * 0.45 + clamp(o.tx / 80, -1, 1) * 0.3, turnRate: 3, outline: [16, 3, 8], ownDeath: true, pose, build };
