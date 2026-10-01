// Karakök: kara, budaklı köklerden örülmüş kambur dev. Gövdesini saran kökler kıpırdar, damarlarında yeşil özsu parlar;
// oyuk gözler, kıymık dişli ağız, pençeye dönen kök kollar, yere yayılan kök ayaklar.
import { dot } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mix, mad, sub, norm, at, ell, ball, bone, tube, skin, spike, frame, turn, aimLocal } from './rig.js';
import { biped, stride } from './biped.js';

const M = { BARK: 1, SAP: 2, MOSS: 3, HORN: 4, EYE: 5, MOUTH: 6, ROOT: 7 };
const S = { hip: 15, spine: 13, neck: 0.5, headX: 6.5, shW: 9.5, shY: -1, hipW: 5, arm: [12, 12], leg: [8, 7.5], ankle: 2 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
let sap = 1;
// kabuk: lif boyunca çizgiler, sırtta yosun; özsu damarları kök boyunca kıvrılır
function bark(u, v, i, out) {
  if (sap > 0.05 && Math.abs(fr(v * 2 + Math.sin(u * 0.45) * 0.22) - 0.5) < 0.03 && fr(u * 0.11) < 0.7) { out.id = M.SAP; return 0.25 + sap * 0.5; }
  if (i > 0.8 && fr(Math.sin(u * 1.7 + v * 23) * 43.7) < 0.3) { out.id = M.MOSS; return i - 0.2; }
  return i;
}
const MATS = [];
MATS[M.BARK] = { ramp: ramp('#060504', '#120e0a', '#221a12', '#362a1c', '#50402a'), px: bark };
MATS[M.ROOT] = { ramp: ramp('#0e0a08', '#221a10', '#3c2c1a', '#5c462a', '#84683e') };
MATS[M.SAP] = { ramp: ramp('#1c5a10', '#3c9a20', '#78d040', '#b8f070', '#eaffb0'), flat: true, glow: 1 };
MATS[M.MOSS] = { ramp: ramp('#14220c', '#263c14', '#3e5c22', '#5e8034', '#8aa850') };
MATS[M.HORN] = { ramp: ramp('#2a2014', '#4e3c26', '#7a6240', '#a88e64', '#d0bc94') };
MATS[M.EYE] = { ramp: ramp('#2a8a10', '#5cc828', '#a0f050', '#d8ff90', '#f8ffe0'), flat: true, glow: 1 };
MATS[M.MOUTH] = { ramp: ramp('#040302', '#0a0604', '#140c06', '#20140a', '#2c1c10'), flat: true };

// a'dan b'ye kalın kökün çevresine sarılan ince kök
function wrap(g, a, b, R, r, turns, ph, m) {
  const d = sub(b, a), t = norm(d), up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], x = norm([t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]]), y = [t[1] * x[2] - t[2] * x[1], t[2] * x[0] - t[0] * x[2], t[0] * x[1] - t[1] * x[0]], pts = [];
  for (let k = 0; k <= 6; k++) { const q = k / 6, an = ph + q * turns * TAU, c = Math.cos(an) * R, s = Math.sin(an) * R; pts.push([a[0] + d[0] * q + x[0] * c + y[0] * s, a[1] + d[1] * q + x[1] * c + y[1] * s, a[2] + d[2] * q + x[2] * c + y[2] * s]); }
  tube(g, pts, k => r * (1 - k * 0.06), 5, m);
}

function build(g, P, o) {
  sap = P.sap;
  const K = biped(P, S), A = {}, { pel, waist, chest, head } = K, t = o.t, wr = P.writhe, cage = P.cage, br = 1 + P.br;
  // gövde: kambur kütük; çevresinde ters yönlerde dönen dört kök halkası (düğüm)
  const J = [{ p: at(pel, 0, -3, 0), rx: 6, ry: 5.4 }, { p: pel.p, rx: 8.6, ry: 7.2 }, { p: waist.p, rx: 9.2 * br, ry: 7.8 * br }, { p: at(chest, 0.5, -3, 0), rx: 10.4 * br, ry: 8 * br }, { p: at(chest, 1.5, 1.5, 0), rx: 8, ry: 6.4 }, { p: at(chest, 3, 4, 0), rx: 3, ry: 3 }];
  const U = [pel.f, pel.f, waist.f, chest.f, chest.f, chest.f];
  skin(g, J.map((j, i) => ({ ...j, u: U[i] })), 10, M.BARK, { sub: 2 });
  for (let c = 0; c < 4; c++) {
    const pts = [], dirn = c % 2 ? 1 : -1;
    for (let k = 0; k <= 9; k++) {
      const q = 0.08 + k / 9 * 0.8, f = q * 4, i = Math.min(3, Math.floor(f)), w = f - i, ctr = mix(J[i].p, J[i + 1].p, w), F = i < 2 ? pel : chest;
      const an = c * TAU / 4 + dirn * (k * 0.75 + t * 0.35 * wr) + Math.sin(t * 1.3 + c) * 0.2 * wr, R = 1 + cage * 0.3 * (Math.sin(an) > 0 ? 1 : 0.3);
      pts.push(mad(mad(ctr, F.r, Math.cos(an) * (lerp(J[i].rx, J[i + 1].rx, w) + 0.6) * R), F.f, Math.sin(an) * (lerp(J[i].ry, J[i + 1].ry, w) + 0.6) * R));
    }
    tube(g, pts, k => 2 - Math.abs(k - 4.5) * 0.16, 5, M.ROOT);
  }
  // göğüs kafesi açılınca içerideki özsu çekirdeği görünür
  if (cage > 0.05) ball(g, at(chest, 6.5, -5, 0), 2 + cage * 3.2, M.SAP, 7);
  // kollar: kalın kök ve ona sarılan ince kök; uçta üç pençe-filiz
  for (const [s, Ar] of [[1, K.R], [-1, K.L]]) {
    ball(g, Ar.sh, 4.6, M.BARK, 7); bone(g, Ar.sh, Ar.el, 4, 3.3, M.BARK, 1.15); ball(g, Ar.el, 3.4, M.BARK); bone(g, Ar.el, Ar.wr, 3.3, 2.8, M.BARK, 1.2); ball(g, Ar.wr, 3, M.ROOT);
    wrap(g, Ar.sh, Ar.el, 4.1, 1.3, 1.1, t * 0.5 * wr + s, M.ROOT); wrap(g, Ar.el, Ar.wr, 3.4, 1.2, 1.2, -t * 0.6 * wr + s * 2, M.ROOT);
    for (let k = -1; k <= 1; k++) {
      const H = Ar.hand, cl = P.claw + Math.sin(t * 2.2 + k + s) * 0.12 * wr, b = at(H, 1, 0, k * 1.8);
      tube(g, [b, at(H, 4, 0.6 + cl * 1.5, k * 2.8), at(H, 6.5, 1.6 + cl * 3.2, k * 3.2), at(H, 8, 3 + cl * 5, k * 3)], [1.3, 1.1, 0.8, 0.25], 4, M.ROOT);
    }
    spike(g, mad(Ar.sh, chest.u, 3), mad(mad(Ar.sh, chest.u, 8), chest.r, s * 3), 1.4, M.HORN, 4);
  }
  // bacaklar: kısa kütükler, yerde yayılan kök parmaklar
  const fd = norm([pel.f[0], 0, pel.f[2]]), sd = [fd[2], 0, -fd[0]];
  for (const [s, L] of [[1, K.legR], [-1, K.legL]]) {
    bone(g, L.hip, L.knee, 4.6, 3.8, M.BARK, 1.15); ball(g, L.knee, 3.8, M.BARK); bone(g, L.knee, L.ank, 3.8, 3.2, M.BARK, 1.1); ball(g, L.ank, 3.3, M.ROOT);
    for (let k = 0; k < 4; k++) {
      const an = (k - 1.2) * 0.75 * s, dx = Math.cos(an), dz = Math.sin(an), b = [L.ank[0], L.foot[1] + 1.6, L.ank[2]], e = mad(mad([L.foot[0], L.foot[1] + 0.6, L.foot[2]], fd, dx * 6.5), sd, -dz * 6.5);
      tube(g, [b, mix(b, e, 0.5), e], [1.7, 1.3, 0.4], 4, M.ROOT);
    }
  }
  // baş: gövdenin önüne gömülü kütük; oyuk gözlerde yeşil ışık, kıymık dişler, kırık dal boynuzlar
  const H = head, jaw = P.jaw, Lw = turn(frame(at(H, 0, -1.6, 0), H.f, H.u, H.r), 0, -jaw * 0.8);
  ell(g, frame(at(H, 0.5, 0.6, 0), H.f, H.u, H.r), 4.6, 3.7, 4.2, M.BARK, 8, 5);
  ell(g, frame(at(Lw, 1.6, -1.1, 0), Lw.f, Lw.u, Lw.r), 3.4, 1.5, 3.2, M.ROOT, 7, 4);
  if (jaw > 0.1) { ell(g, frame(at(H, 3.4, -2 - jaw * 1.2, 0), H.f, H.u, H.r), 1.6, 0.8 + jaw * 1.6, 2.6, M.MOUTH, 6, 3); for (const s of [-1, 0, 1]) { dot(g, at(H, 4.7, -1.6, s * 1.5), M.HORN, 4); dot(g, at(Lw, 4.6, 0.2, s * 1.2 + 0.5), M.HORN, 3); } }
  else for (const s of [-1, 1]) dot(g, at(H, 4.9, -1.9, s * 1.4), M.HORN, 4);
  for (const s of [-1, 1]) {
    const e = at(H, 4.3, 1, s * 2.1);
    const em = P.eye > 0.4 ? M.EYE : M.MOUTH, et = P.eye > 0.4 ? 4 : 0;
    dot(g, e, M.MOUTH, 0, 0, -1); dot(g, e, M.MOUTH, 0, 1, -1); dot(g, e, M.MOUTH, 0, -1, 0); dot(g, e, em, et); dot(g, e, em, et, 1, 0); dot(g, e, em, Math.max(0, et - 2), 0, 1); dot(g, e, em, Math.max(0, et - 2), 1, 1);
    if (s > 0 === !(P.near < 0)) A.eye = e;
    const b0 = at(H, -0.5, 3, s * 2.4), b1 = at(H, -2.5, 8 + Math.sin(t * 1.4 + s) * 0.3 * wr, s * 4.8), b2 = at(H, -1, 13, s * 7);
    tube(g, [b0, b1, b2], [1.6, 1.2, 0.3], 5, M.ROOT); tube(g, [b1, at(H, -5.5, 11, s * 3.4)], [0.9, 0.25], 4, M.ROOT);
  }
  ball(g, at(chest, -3.5, 2.6, -1), 2.8, M.MOSS, 6); ball(g, at(chest, -5.5, -1.5, 2.6), 2, M.MOSS, 6);
  A.mouth = at(H, 5, -2, 0); A.chest = at(chest, 7, -5, 0); A.hand = K.R.wr; A.head = H.p;
  return A;
}

const DIE_T = 1.8;
function pose(o) {
  const t = o.t, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 1.6 + o.wob);
  let x = 0, y = br * 0.3, lean = 14, twist = 0, roll = Math.sin(t * 0.8) * 1.2, jaw = 0.08, rate = 18, lookW = 0.7, eye = 1, sink = 0, spin = 0, cage = 0, claw = 0.2, sapK = o.rage ? 1 : 0.7, writhe = 1, shadow = 1;
  const bend = [14, 0, 0], head = [10, 0, 0], R = { sw: 20, ab: 18, tw: 0, el: 38 }, L = { sw: 14, ab: 20, tw: 0, el: 42 }, fR = [2, 0, 6.2], fL = [-2.5, 0, -6.2];
  if (w > 0.01) {
    // hantal yürüyüş: gövde adımla yalpalar, kollar yere sürünür
    const ph = o.ph, a = stride(ph, 4.2, 2.6), b = stride(ph + 0.5, 4.2, 2.6), c1 = Math.cos(ph * TAU), s1 = Math.sin(ph * TAU);
    fR[0] += a[0] * w; fR[1] += a[1] * w; fL[0] += b[0] * w; fL[1] += b[1] * w;
    y -= (0.6 + 0.9 * Math.cos(ph * 2 * TAU)) * w; roll += s1 * 5 * w; twist -= c1 * 8 * w; bend[1] += c1 * 10 * w; lean += 5 * w; R.sw -= c1 * 16 * w; L.sw += c1 * 16 * w; x += Math.sin(ph * 2 * TAU) * 0.8 * w;
  }
  if (o.act === 'spikes' || (o.prev === 'spikes' && !o.act && o.since < 0.4)) {
    // iki kolunu kaldırıp yere indirir: kökler madencinin altından fışkırır
    const c = o.act === 'spikes' ? o.since : 0.5 + o.since, up = bump(0, 0.14, 0.18, 0.26, c), dn = ss(0.18, 0.28, c) * (1 - ss(0.6, 0.9, c));
    for (const a of [R, L]) { a.sw += 150 * up + 46 * dn; a.el += 10 * up - 14 * dn; a.ab -= 8 * up; }
    lean += -22 * up + 16 * dn; bend[0] += -18 * up + 14 * dn; y += 1.5 * up - 4.5 * dn; head[0] += 14 * up - 6 * dn; jaw = 0.5 * up + 0.3 * dn; claw = 0.8; if (dn > 0.5) x += Math.sin(t * 50) * 0.3; rate = 40; lookW = 0.3;
  } else if (o.act === 'burrow') {
    // burgu gibi dönerek toprağa girer
    const k = clamp(o.since / 0.5, 0, 1);
    spin = o.since * o.since * 26; for (const a of [R, L]) { a.sw += 165 * k; a.ab -= 14 * k; a.el -= 10 * k; } lean -= 18 * k; bend[0] -= 14 * k; claw = 0.9; lookW = 0; rate = 40; shadow = 1 - k;
  } else if (o.prev === 'burrow' && !o.act && o.since < 0.7) {
    // topraktan fırlar: kollar iki yana açık, gövde gerilmiş
    const k = 1 - ss(0.1, 0.7, o.since);
    sink = 30 * (1 - ss(0, 0.16, o.since)); for (const a of [R, L]) { a.sw += 30 * k; a.ab += 70 * k; } lean -= 26 * k; bend[0] -= 20 * k; y += 2.5 * k; head[0] += 18 * k; jaw = 0.8 * k; claw = 0.9; rate = 40;
  } else if (o.act === 'summon' || (o.rage && o.rageT < 1.1)) {
    // göğüs kafesi açılır, içinden yeşil ışık taşar
    const k = o.act === 'summon' ? bump(0, 0.12, 0.25, 0.3, o.since) : bump(0, 0.2, 0.8, 1.1, o.rageT);
    cage = k; for (const a of [R, L]) { a.sw += 20 * k; a.ab += 46 * k; a.el += 30 * k; } lean -= 16 * k; bend[0] -= 12 * k; head[0] += 20 * k; jaw = 0.85 * k; sapK = 1; lookW *= 1 - k;
  }
  if (o.hurt > 0 && !dead) {
    const h = o.hurt * o.hurt, back = clamp(o.hx * Math.cos(o.view), -1, 1);
    lean -= 8 * h; head[0] += 10 * h; x += back * 1.5 * h; bend[1] += near * 8 * h; R.ab += 12 * h; L.ab += 12 * h; jaw = Math.max(jaw, 0.5 * h); sapK = 1;
  }
  if (dead) {
    // özsu söner, kökler gevşer; gövde öne yığılıp kuru odun kümesine döner
    const d = o.dying * DIE_T, k = ss(0.2, 1, d), f = ss(0.7, 1.4, d);
    sapK *= 1 - ss(0, 0.7, d); writhe = 1 - ss(0, 0.6, d); eye = 1 - ss(0.2, 0.7, d); jaw = 0.5 * bump(0, 0.15, 0.4, 0.8, d) + 0.2 * f;
    lean += 18 * k + 30 * f; bend[0] += 14 * k + 12 * f; y += -5 * k - 5 * f; head[0] -= 26 * k; for (const a of [R, L]) { a.sw = lerp(a.sw, 4, k) + 40 * f; a.el = lerp(a.el, 6, k); a.ab += 10 * k; } fR[2] += 1.5 * k; fL[2] -= 1.5 * k; claw = 0; lookW = 0; sink = f * 5;
  }
  const [ly0, lp0] = aimLocal(o.tx, o.ty + 22, o.view), ly = clamp(ly0, -1, 1) * lookW, lp = clamp(lp0, -0.4, 0.5) * lookW;
  const rad = a => ({ sw: a.sw * D, ab: a.ab * D, tw: a.tw * D, el: Math.max(0, a.el) * D });
  return {
    rate, spin, x, y, lean: lean * D, twist: twist * D, roll: roll * D, bend: [bend[0] * D, bend[1] * D + ly * 0.3, bend[2] * D], head: [head[0] * D + lp, head[1] * D + ly * 0.7, head[2] * D],
    armR: rad(R), armL: rad(L), footR: fR, footL: fL, eye, near, jaw, sink, cage, claw, sap: sapK * (0.85 + 0.15 * Math.sin(t * 3)), writhe, shadow, br: 0.03 * br,
  };
}

export const KARAKOK = { w: 124, h: 100, ox: 62, oy: 84, scale: 1.1, tilt: 0.2, mats: MATS, stride: 14, shadow: 15, body: 40, bias: 0.4, turn: 0.55, outline: [8, 6, 4], hold: ['burrow'], pose, build };
