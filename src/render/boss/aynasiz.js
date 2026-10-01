// Aynasız Hükümdar: kırık ayna ve koyu cam parçalarından yüzsüz kral. Köşeli zırh, cam diken taç, boşluk yüz,
// ayna kırıklarından pelerin; sağ elde ayna başlı asa. Işınlanırken parçalara ayrılıp yeniden birleşir.
import { dot, line } from '../soft3d.js';
import { TAU, D, clamp, ss, bump, mad, norm, at, ell, ball, leaf, spike, prism, frame, aimLocal, meleeK, hash } from './rig.js';
import { biped, stride } from './biped.js';

const M = { GLASS: 1, MIRROR: 2, GLOW: 3, VOID: 4, EYE: 5, SHARD: 6, SHARD_B: 7, DARK: 8, PANE: 9 };
const S = { hip: 24, spine: 14, neck: 4, headX: 0.4, shW: 7.6, shY: -0.8, hipW: 3.4, arm: [10.5, 10.5], leg: [12, 12], ankle: 1.6 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb);
const MATS = [];
MATS[M.GLASS] = { ramp: ramp('#06081a', '#0e1630', '#1c2a54', '#3a5088', '#a4bcf0') };
MATS[M.MIRROR] = { ramp: ramp('#222a48', '#50629a', '#92a8d8', '#d4e2ff', '#ffffff') };
MATS[M.GLOW] = { ramp: ramp('#2c4898', '#4c7cd8', '#7cb0ff', '#b8d8ff', '#f0f8ff'), flat: true, glow: 1 };
MATS[M.VOID] = { ramp: ramp('#020206', '#020206', '#04040c', '#080814', '#10101e'), flat: true };
MATS[M.EYE] = { ramp: ramp('#8090c0', '#b0c0e8', '#d8e4ff', '#f4f8ff', '#ffffff'), flat: true, glow: 1 };
MATS[M.SHARD] = { ramp: MATS[M.MIRROR].ramp, back: M.SHARD_B };
MATS[M.SHARD_B] = { ramp: ramp('#0a0e22', '#18244a', '#30447a', '#5a74b0', '#a0b8e8') };
MATS[M.DARK] = { ramp: ramp('#06060c', '#0e1020', '#1a1e36', '#2a3050', '#40486c') };
MATS[M.PANE] = { ramp: ramp('#5878c0', '#88acf0', '#b8d4ff', '#e0eeff', '#ffffff'), flat: true, glow: 1, px: u => u };

const N = 46, HOME = [], DIR = [];
for (let i = 0; i < N; i++) { const h = 3 + hash(i) * 44, a = hash(i + 7) * TAU, r = (1.5 + 3.5 * hash(i + 3)) * (h > 26 && h < 40 ? 1.5 : 0.9); HOME.push([Math.cos(a) * r * 0.7, h, Math.sin(a) * r]); DIR.push(norm([Math.cos(a), (hash(i + 11) - 0.35) * 1.3, Math.sin(a)])); }

// cam kırıkları: s (0..1) dağılma (ışınlanma), fall (0..1) yere dökülme (ölüm)
function shards(g, s, fall, t) {
  for (let i = 0; i < N; i++) {
    const h = HOME[i], d = DIR[i], R = (16 + 22 * hash(i + 5)) * s, cs = Math.cos(s * 2), sn = Math.sin(s * 2);
    let c = [h[0] + (d[0] * cs - d[2] * sn) * R, h[1] + d[1] * R, h[2] + (d[2] * cs + d[0] * sn) * R];
    if (fall > 0) { const k = clamp(fall * 1.5 - hash(i + 2) * 0.5, 0, 1); c = [h[0] + d[0] * (3 + 9 * hash(i + 9)) * k, Math.max(0.6 + hash(i + 4) * 2.4, h[1] * (1 - k * k) + 2 * Math.sin(k * 3.14) * (1 - k)), h[2] + d[2] * (3 + 7 * hash(i + 1)) * k]; }
    const z = 1.6 + 2.2 * hash(i + 13), a = s * 6 + i + t * (2 + hash(i) * 3) * (fall > 0.9 ? 0 : 1), ca = Math.cos(a), sa = Math.sin(a);
    leaf(g, [c[0] + ca * z, c[1] + sa * z, c[2]], [c[0] - sa * z * 0.5, c[1] + ca * z * 0.7, c[2] + z * 0.6], [c[0] - ca * z * 0.6, c[1] - sa * z, c[2] - z * 0.5], M.SHARD);
  }
}

function build(g, P, o) {
  const A = {}, t = o.t, sh = Math.max(P.shatter, 0), fall = P.crumble;
  const K = biped(P, S), { pel, waist, chest, head } = K;
  A.eye = at(head, 3.2, 0.8, 0); A.chest = at(chest, 3, -4, 0); A.hand = at(K.L.hand, 2, 0, 0); A.head = head.p;
  if (sh > 0.02 || fall > 0.02) shards(g, sh, fall, t);
  if (sh > 0.4 || fall > 0.3) return A;
  const fw = chest.f, seam = (a, b) => line(g, a, b, M.GLOW, 3);
  // gövde: köşeli plakalar; ek yerlerinden soluk mavi ışık sızar
  prism(g, at(pel, 0, -3, 0), waist.p, 3.6, 4.2, M.GLASS, 6, 0.5, 0.75, pel.f);
  const hi = prism(g, waist.p, at(chest, 0.4, 0.6, 0), 4.2, 7.4, M.GLASS, 6, 0.5, 0.6, fw);
  for (let j = 0; j < 6; j += 2) seam(hi.A[j], hi.B[j]);
  seam(at(chest, 4.2, -1, -2.5), at(chest, 3.4, -6, 0.5)); seam(at(chest, 3.4, -6, 0.5), at(chest, 3, -9, -1));
  prism(g, at(chest, 0.2, 0.4, 0), at(chest, 0.4, S.neck - 1, 0), 2, 1.7, M.DARK, 5);
  // bel plakaları: kalçadan sarkan cam etek
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + 0.45, c = Math.cos(a), s = Math.sin(a), top = at(pel, c * 3.2, -1.5, s * 4.4), sw = Math.sin(t * 1.8 + i * 1.3) * 0.5 + P.cape * 1.5;
    prism(g, top, [top[0] + c * 1.6 - pel.f[0] * sw, top[1] - 7.5 - (i % 2) * 2, top[2] + s * 2 - pel.f[2] * sw], 2.1, 0.4, i % 2 ? M.GLASS : M.MIRROR, 3, a, 0.4);
  }
  // kollar ve bacaklar: kırık cam çubukları; omuzda sivri plakalar
  for (const [s, Ar] of [[1, K.R], [-1, K.L]]) {
    prism(g, Ar.sh, Ar.el, 2.4, 1.9, M.GLASS, 4, 0.6); prism(g, Ar.el, Ar.wr, 2, 1.5, M.GLASS, 4, 0.2); ball(g, at(Ar.hand, 1, 0, 0), 1.5, M.DARK, 5);
    spike(g, mad(Ar.sh, chest.u, 1), mad(mad(Ar.sh, chest.u, 6.5), chest.r, s * 4.5), 2.6, M.MIRROR, 4); spike(g, mad(Ar.sh, chest.r, s * 1.5), mad(mad(Ar.sh, chest.u, 2), chest.r, s * 7), 2, M.GLASS, 4);
    seam(Ar.sh, Ar.el);
  }
  const fd = norm([pel.f[0], 0, pel.f[2]]);
  for (const L of [K.legR, K.legL]) {
    prism(g, L.hip, L.knee, 2.7, 2, M.GLASS, 4, 0.4); prism(g, L.knee, L.ank, 2.1, 1.5, M.GLASS, 4, 0.9); spike(g, L.knee, mad(mad(L.knee, fd, 2.4), [0, 1, 0], 2.6), 1.4, M.MIRROR, 4);
    prism(g, [L.ank[0], L.foot[1] + 1.1, L.ank[2]], mad([L.foot[0], L.foot[1] + 0.8, L.foot[2]], fd, 4.4), 1.7, 0.7, M.GLASS, 4, 0.8, 0.7);
  }
  // baş: pürüzsüz kara boşluk, iki soluk nokta; çevresinde cam dikenlerden taç
  ell(g, frame(at(head, 0.6, 0.8, 0), head.f, head.u, head.r), 3.3, 3.9, 3, M.VOID, 8, 5);
  for (const s of [-1, 1]) { const e = at(head, 3.5, 1.1, s * 1.3); dot(g, e, M.EYE, P.eye > 0.5 ? 4 : 1); if (s > 0 === !(P.near < 0)) A.eye = e; }
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + 0.3, c = Math.cos(a), s = Math.sin(a), hgt = (i % 2 ? 5.5 : 3.8) + P.glow * 1.2;
    spike(g, at(head, 0.4 + c * 2.7, 3.2, s * 2.6), at(head, 0.4 + c * 4, 3.2 + hgt, s * 3.8), 1.3, i % 2 ? M.MIRROR : M.GLASS, 3);
  }
  prism(g, at(head, -3, -1.5, 0), at(head, -3.6, 3.4, 0), 2.8, 1.6, M.GLASS, 4, 0.3, 0.5, head.f);
  // pelerin: omuzlardan sarkan ayna kırıkları; her biri kendi salınır, döndükçe ışığı yakalar
  for (let r = 0; r < 5; r++) for (let c = 0; c < (r % 2 ? 4 : 5); c++) {
    const k = (c - (r % 2 ? 1.5 : 2)) * 3.4, top = at(chest, -3.6 - r * 0.6, 1 - r * 7.4, k), ph = t * 2.1 + r * 0.9 + c * 1.7, sw = Math.sin(ph) * (0.6 + r * 0.5) + P.cape * (2 + r * 2.4);
    const mid = [top[0] - fw[0] * sw, top[1] - 4, top[2] - fw[2] * sw + Math.cos(ph * 0.7) * 0.6], bot = [top[0] - fw[0] * sw * 1.9, top[1] - 8.4, top[2] - fw[2] * sw * 1.9];
    if (bot[1] < 1) continue;
    const w = 2.2, rx = chest.r[0] * w * Math.cos(ph * 0.5), rz = chest.r[2] * w * Math.cos(ph * 0.5), fx = fw[0] * w * Math.sin(ph * 0.5), fz = fw[2] * w * Math.sin(ph * 0.5);
    const l = [mid[0] - rx - fx, mid[1], mid[2] - rz - fz], rr = [mid[0] + rx + fx, mid[1], mid[2] + rz + fz];
    leaf(g, top, l, rr, M.SHARD); leaf(g, l, bot, rr, M.SHARD);
  }
  // asa: koyu sap yere dayanır, ucunda dönen ayna kristali
  const g0 = at(K.R.hand, 0.8, 0, 0), sd = norm([fd[0] * Math.sin(P.staff), Math.cos(P.staff), fd[2] * Math.sin(P.staff)]), tip = mad(g0, sd, 17);
  prism(g, mad(g0, sd, -Math.min(20, (g0[1] - 0.3) / Math.max(0.3, sd[1]))), tip, 0.7, 0.7, M.DARK, 4);
  prism(g, tip, mad(tip, sd, 3.2), 0.5, 2.3, M.MIRROR, 4, t * 1.5); prism(g, mad(tip, sd, 3.2), mad(tip, sd, 8), 2.3, 0.2, M.MIRROR, 4, t * 1.5);
  if (P.glow > 0.05) dot(g, mad(tip, sd, 3.2), M.GLOW, 4);
  A.staff = mad(tip, sd, 3.2);
  // ayna: serbest elin önünde beliren altıgen cam; ateşlerken parlar
  if (P.pane > 0.03) {
    const Hl = K.L.hand, c = at(Hl, 4, 0, 0), n = Hl.f, u = norm([-n[1] * n[0], 1 - n[1] * n[1], -n[1] * n[2]]), r = norm([n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]), R = 7.5 * P.pane, pts = [];
    for (let j = 0; j < 6; j++) { const a = j / 6 * TAU + 0.5; pts.push(mad(mad(c, u, Math.cos(a) * R * 1.25), r, Math.sin(a) * R)); }
    for (let j = 0; j < 6; j++) {
      const q = (j + 1) % 6, v0 = g.nv; leaf(g, c, pts[j], pts[q], M.PANE);
      g.uv[v0 * 2] = 0.5 + P.flash * 0.5; g.uv[v0 * 2 + 2] = g.uv[v0 * 2 + 4] = 0.35 + P.flash * 0.6; line(g, pts[j], pts[q], M.GLOW, 4);
    }
    A.pane = c;
  }
  return A;
}

const DIE_T = 1.8;
function pose(o) {
  const t = o.t, A = o.A, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 1.5 + o.wob);
  let x = 0, y = br * 0.2, lean = -3, twist = 0, staff = 0.06, rate = 20, lookW = 0.8, eye = 1, shatter = 0, crumble = 0, pane = 0, flash = 0, cape = 0.1 + br * 0.03, glow = o.rage ? 0.6 : 0.2, shadow = 1;
  const bend = [-3, 0, 0], head = [2, 0, 0], R = { sw: 12, ab: 14, tw: 0, el: 64 }, L = { sw: -4, ab: 14, tw: 0, el: 16 }, fR = [1, 0, 3.8], fL = [-1.6, 0, -3.8];
  if (w > 0.01) {
    // süzülür gibi ağır yürüyüş: pelerin geride kalır, asa adımla öne çıkar
    const ph = o.ph, a = stride(ph, 4.4, 2.4), b = stride(ph + 0.5, 4.4, 2.4), c1 = Math.cos(ph * TAU);
    fR[0] += a[0] * w; fR[1] += a[1] * w; fL[0] += b[0] * w; fL[1] += b[1] * w;
    y -= (0.3 + 0.4 * Math.cos(ph * 2 * TAU)) * w; twist -= c1 * 5 * w; bend[1] += c1 * 8 * w; lean += 5 * w; L.sw += c1 * 12 * w; R.sw -= c1 * 5 * w; staff += (0.12 - c1 * 0.1) * w; cape += 0.35 * w;
  }
  if (o.act === 'mirror' && A) {
    // serbest elini kaldırır: önünde ayna belirir, hedefin silahını yansıtıp ateşler
    const tt = 1.4 - A.T, k = ss(0, 0.5, tt), ap = clamp(aimLocal(o.tx, o.ty, o.view)[1], -1, 1) / D, shot = tt > 0.55 ? Math.max(0, Math.sin(tt * 20)) : 0;
    L.sw += (92 + ap) * k; L.el -= 6 * k; L.ab -= 6 * k; bend[1] += 14 * k; lean -= 5 * k + 3 * shot; pane = ss(0.1, 0.5, tt) * (1 - ss(1.25, 1.4, tt)); flash = shot; glow = 0.5 + 0.5 * shot; x -= shot * 0.8; cape += 0.2 * shot; lookW = 0.5;
  } else if (o.act === 'step') {
    // ışınlanma: kırıklar yeni yerde toplanıp kralı yeniden kurar
    shatter = 1 - ss(0, 0.42, o.since); glow = 1; rate = 60;
  } else if (o.act === 'melee') {
    // asasını başının üstüne kaldırır, madencinin üstüne indirir
    const [up, dn] = meleeK(o);
    R.sw += 118 * up + 48 * dn; R.el -= 34 * up + 44 * dn; R.ab -= 6 * dn; bend[1] += near * (-12 * up + 14 * dn); lean += -6 * up + 13 * dn; bend[0] += -6 * up + 8 * dn; head[0] += 6 * up - 4 * dn; y += 1 * up - 2.5 * dn; x += 1.5 * dn;
    cape += 0.3 * up + 0.7 * dn; glow = 0.4 + 0.6 * dn; rate = 46; lookW = 0.4;
  } else if (o.act === 'shards' || (o.prev === 'shards' && !o.act && o.since < 0.4)) {
    // kollarını göğsünde kavuşturur, sonra iki yana açar: cam kıymıkları halka olup saçılır
    const c = o.act === 'shards' ? o.since : 0.4 + o.since, cr = bump(0, 0.1, 0.14, 0.22, c), out = bump(0.14, 0.24, 0.5, 0.8, c);
    for (const a of [R, L]) { a.sw += 40 * cr - 10 * out; a.ab += -34 * cr + 70 * out; a.el += 60 * cr - 20 * out; }
    y += -2.5 * cr + 1.5 * out; lean += 10 * cr - 10 * out; bend[0] += 12 * cr - 16 * out; head[0] += -10 * cr + 16 * out; cape += 0.9 * out; glow = 0.4 + 0.6 * out; staff += 0.5 * out; shatter = 0.1 * out; rate = 40; lookW = 0.3;
  }
  if (o.rage && o.rageT < 1.2) { const r = bump(0, 0.2, 0.8, 1.2, o.rageT); R.sw += 110 * r; R.el -= 30 * r; head[0] += 14 * r; lean -= 6 * r; cape += 0.8 * r; glow = 1; y += r; shatter = Math.max(shatter, 0.08 * r); lookW *= 1 - r; }
  if (o.hurt > 0 && !dead) {
    const h = o.hurt * o.hurt, back = clamp(o.hx * Math.cos(o.view), -1, 1);
    lean -= 9 * h; head[0] += 8 * h; x += back * 1.5 * h; bend[1] += near * 9 * h; L.ab += 14 * h; cape += 0.5 * h; shatter = Math.max(shatter, 0.14 * h); eye = 1 - h;
  }
  if (dead) {
    // zırh baştan aşağı çatlar, parçalar tek tek dökülür; geriye cam yığını kalır
    const d = o.dying * DIE_T, st = ss(0, 0.45, d);
    lean -= 8 * st; head[0] += 20 * st; R.ab += 20 * st; L.ab += 30 * st; L.sw -= 10 * st; y -= 3 * ss(0.3, 0.6, d); glow = 1 - ss(0.5, 1, d); shatter = 0.1 * bump(0.1, 0.3, 0.45, 0.6, d);
    crumble = ss(0.45, 1.5, d); eye = 1 - ss(0.2, 0.5, d); lookW = 0; shadow = 1 - crumble * 0.6; rate = 30;
  }
  const [ly0, lp0] = aimLocal(o.tx, o.ty + 40, o.view), ly = clamp(ly0, -1.2, 1.2) * lookW, lp = clamp(lp0, -0.5, 0.5) * lookW;
  const rad = a => ({ sw: a.sw * D, ab: a.ab * D, tw: a.tw * D, el: Math.max(0, a.el) * D });
  return {
    rate, x, y, lean: lean * D, twist: twist * D, roll: 0, bend: [bend[0] * D, bend[1] * D + ly * 0.3, bend[2] * D], head: [head[0] * D + lp, head[1] * D + ly * 0.7, head[2] * D],
    armR: rad(R), armL: rad(L), footR: fR, footL: fL, eye, near, staff, shatter, crumble, pane, flash, cape, glow, shadow, alpha: dead ? 1 - ss(0.85, 1, o.dying) : 1,
  };
}

export const AYNASIZ = { w: 140, h: 112, ox: 70, oy: 92, scale: 1.05, tilt: 0.2, mats: MATS, stride: 14, shadow: 11, body: 50, bias: 0.4, turn: 0.55, outline: [6, 8, 22], ownDeath: true, pose, build };
