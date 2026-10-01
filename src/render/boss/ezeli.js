// Ezelî: yüzü olmayan, soluk altın ışıktan örtülü varlık. Krem cübbe aşağıda bir ışık kuyruğuna incelir (bacak yok);
// çevresinde gözlerle kaplı, ters yönlere dönen iki altın hale; sırtında ışıktan dört kanat. Havada süzülür.
import { dot, line } from '../soft3d.js';
import { TAU, D, clamp, ss, bump, mad, norm, cross, at, ell, ball, bone, tube, skin, leaf, frame, aimLocal, meleeK, hash, scaleGeo } from './rig.js';
import { biped } from './biped.js';

const M = { ROBE: 1, LIGHT: 2, GOLD: 3, EYEW: 4, PUPIL: 5, WING: 6, WING2: 7, DARK: 8 };
const S = { hip: -4, spine: 12, neck: 3.4, headX: 0.4, shW: 5.6, shY: -0.6, hipW: 2, arm: [8, 8], leg: [6, 6], ankle: 1 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
let dim = 0;
const MATS = [];
MATS[M.ROBE] = { ramp: ramp('#5e5040', '#9c8c70', '#d0c4a2', '#f0e8ce', '#fffcf0'), px: (u, v, i) => i - dim * 0.3 + (fr(v * 7 + Math.sin(u * 0.3) * 0.4) < 0.5 ? 0.04 : -0.05), glow: 0.25 };
MATS[M.LIGHT] = { ramp: ramp('#b08a30', '#e8c868', '#ffe8a0', '#fff8d4', '#ffffff'), flat: true, glow: 1, px: () => 0.9 - dim * 0.6 };
MATS[M.GOLD] = { ramp: ramp('#604008', '#a07018', '#d4a428', '#ffd24a', '#fff0a0'), glow: 0.4 };
MATS[M.EYEW] = { ramp: ramp('#8090b0', '#b8c4dc', '#e0e8f8', '#f8fbff', '#ffffff'), flat: true, glow: 1 };
MATS[M.PUPIL] = { ramp: ramp('#10182c', '#10182c', '#182848', '#203860', '#284878'), flat: true };
MATS[M.WING] = { ramp: ramp('#d8b048', '#f0cc68', '#ffe498', '#fff4cc', '#ffffff'), flat: true, glow: 1, soft: true, px: u => 0.9 - u * 0.5 - dim * 0.5 };
MATS[M.WING2] = { ramp: MATS[M.WING].ramp, flat: true, glow: 0.8, dither: 2, px: () => 0.5 - dim * 0.4 };
MATS[M.DARK] = { ramp: ramp('#201810', '#3a2c1c', '#58442c', '#786040', '#9a8058') };

// hale: c çevresinde n normalli halka; gözler halkayla döner, sırayla kırpar. brk > 0: parçalanıp savrulur
function halo(g, c, n, Rr, rot, t, flash, brk, seed) {
  const a = norm(cross(n, Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), b = cross(n, a), N = 18, pt = th => mad(mad(c, a, Math.cos(th) * Rr), b, Math.sin(th) * Rr);
  if (brk > 0.01) {
    // altı yay: her biri dışarı savrulur ve düşer
    for (let k = 0; k < 6; k++) {
      const th0 = rot + k * TAU / 6, out = norm(mad(mad([0, 0, 0], a, Math.cos(th0 + 0.5)), b, Math.sin(th0 + 0.5))), off = mad(mad([0, 0, 0], out, brk * (10 + hash(seed + k) * 12)), [0, 1, 0], -brk * brk * (12 + hash(seed + k + 3) * 10));
      if (brk < 0.95) tube(g, [0, 0.25, 0.5, 0.75].map(q => mad(pt(th0 + q * 0.9), off, 1)), [0.85, 0.85, 0.85, 0.5], 4, M.GOLD);
    }
    return;
  }
  const pts = []; for (let k = 0; k <= N; k++) pts.push(pt(rot + k / N * TAU));
  tube(g, pts, () => 0.85, 5, M.GOLD);
  for (let k = 0; k < 8; k++) {
    const p = mad(pt(rot + k * TAU / 8 + 0.2), n, 0), open = flash > 0.5 || (t * 0.9 + hash(seed + k) * 7) % 3.2 > 0.22;
    if (open) { dot(g, p, M.EYEW, 4, -1, 0); dot(g, p, M.PUPIL, 1); dot(g, p, M.EYEW, 4, 1, 0); if (flash > 0.5) { dot(g, p, M.EYEW, 4, 0, -1); dot(g, p, M.EYEW, 4, 0, 1); } }
    else { dot(g, p, M.DARK, 0, -1, 0); dot(g, p, M.DARK, 0); dot(g, p, M.DARK, 0, 1, 0); }
  }
}

function build(g, P, o) {
  dim = P.dim;
  const K = biped({ ...P, footR: [0, -30, 2], footL: [0, -30, -2] }, S), A = {}, { pel, waist, chest, head } = K, t = o.t, c = at(chest, 0, -3, 0);
  // kanatlar: ışıktan tüyler; üst çift yukarı, alt çift aşağı açılır. open: açıklık, flap: çırpış, len: boy (ölümde yanıp biter)
  const W = P.wing;
  if (W.len > 0.05) for (const s of [-1, 1]) for (const v of [1, -1]) {
    const root = at(chest, -2.6, 1.5 * v - 1, s * 2.4), nF = v > 0 ? 6 : 4;
    for (let i = 0; i < nF; i++) {
      const q = i / (nF - 1), al = (v > 0 ? 0.45 + q * 1.0 : -0.2 - q * 0.9) * (0.25 + 0.75 * W.open) + W.flap * v + Math.sin(t * 2.2 + i * 0.8 + (s > 0 ? 0 : 1)) * 0.03;
      const L = (v > 0 ? 30 - Math.abs(i - 2.6) * 2.8 : 20 - i * 1.8) * W.len * (0.55 + 0.45 * W.open), fwd = -0.45 - q * 0.2 + (1 - W.open) * 1.1;
      const d = norm(mad(mad(mad([0, 0, 0], chest.f, fwd), chest.u, Math.sin(al)), chest.r, s * Math.cos(al))), side = norm(cross(d, chest.f)), w = 2.5;
      const mid = mad(root, d, L * 0.6), tip = mad(root, d, L), l = mad(mid, side, w), r = mad(mid, side, -w), v0 = g.nv;
      leaf(g, root, l, r, M.WING); g.uv[v0 * 2] = 0; g.uv[v0 * 2 + 2] = g.uv[v0 * 2 + 4] = 1; leaf(g, l, tip, r, M.WING2);
    }
  }
  // cübbe: aşağıda incelip ışık kuyruğuna döner; kuyruk hareketin gerisinde savrulur
  const tl = P.tail, base = at(pel, 0, 0, 0);
  skin(g, [
    { p: [base[0] + tl[0] * 1.6, base[1] - 21, base[2] + tl[1] * 1.6], u: pel.f, rx: 0.5, ry: 0.5 }, { p: [base[0] + tl[0], base[1] - 15, base[2] + tl[1]], u: pel.f, rx: 2.4, ry: 2.2 }, { p: [base[0] + tl[0] * 0.4, base[1] - 8, base[2] + tl[1] * 0.4], u: pel.f, rx: 4.4, ry: 3.8 },
    { p: pel.p, u: pel.f, rx: 4.8, ry: 3.8 }, { p: waist.p, u: waist.f, rx: 4.4, ry: 3.4 }, { p: at(chest, 0.3, -3.5, 0), u: chest.f, rx: 5.2, ry: 3.6 }, { p: at(chest, 0, 0, 0), u: chest.f, rx: 5.8, ry: 3 }, { p: at(chest, 0.3, S.neck - 0.8, 0), u: chest.f, rx: 2, ry: 2 },
  ], 9, M.ROBE, { sub: 2 });
  for (const Ar of [K.R, K.L]) { ball(g, Ar.sh, 2.2, M.ROBE, 6); bone(g, Ar.sh, Ar.el, 2, 2.2, M.ROBE, 1, 6); bone(g, Ar.el, mad(Ar.wr, Ar.hand.f, -0.8), 2.3, 3.1, M.ROBE, 1, 6, true); ball(g, at(Ar.hand, 0.9, 0, 0), 1.4, M.LIGHT, 5); }
  // baş: kukuleta, içinde yüz yerine ışık
  ell(g, frame(at(head, -0.3, 1, 0), head.f, head.u, head.r), 3.5, 4.1, 3.3, M.ROBE, 8, 5);
  ell(g, frame(at(head, 1.3, 0.7, 0), head.f, head.u, head.r), 2.4, 2.9, 2.2, M.LIGHT, 7, 4);
  if (P.core > 0.05) ball(g, at(chest, 3.2, -3.5, 0), 1.2 + P.core * 3.4, M.LIGHT, 7);
  // haleler: ters yönlere dönen, birbirine eğik iki halka
  const tw = P.ring, n1 = norm([Math.sin(tw[0]) * 0.5, 1, Math.cos(tw[0]) * 0.5 + 0.25]), n2 = norm([Math.sin(-tw[0] * 0.8 + 2) * 0.75, 0.75, Math.cos(-tw[0] * 0.8 + 2) * 0.75 + 0.3]);
  halo(g, c, n1, 13.5 * tw[1], tw[0] * 1.4, t, P.flash, P.brk[0], 1); halo(g, c, n2, 18.5 * tw[1], -tw[0], t, P.flash, P.brk[1], 20);
  // yıldız tozu: kuyruktan dökülen ışık zerreleri
  if (P.s > 0.5) for (let i = 0; i < 7; i++) { const k = (t * 0.5 + hash(i)) % 1; dot(g, [base[0] + tl[0] + (hash(i + 4) - 0.5) * 9, base[1] - 12 - k * 16, (hash(i + 8) - 0.5) * 8], M.LIGHT, k < 0.5 ? 4 : 2); }
  A.eye = at(head, 3.4, 0.8, 0); A.mouth = A.eye; A.chest = at(chest, 3.2, -3.5, 0); A.head = head.p; A.hand = K.R.wr;
  if (P.s < 0.995) scaleGeo(g, at(chest, 2, -3.5, 0), P.s);
  return A;
}

const DIE_T = 1.8;
function pose(o) {
  const t = o.t, dead = o.dying > 0, rage = o.rage ? 1 : 0, mv = dead ? 0 : o.walk, br = Math.sin(t * 1.5 + o.wob), dirX = clamp(o.vx * Math.cos(o.view) * 0.05, -1, 1);
  let x = 0, y = br * 1.5, lean = 2 + 12 * mv * dirX, roll = 0, rate = 18, lookW = 0.7, core = 0, flash = 0, dimK = 0, s = 1, alpha = 1, rspin = t * (0.5 + rage * 0.4), rsc = 1;
  const bend = [-2, 0, 0], head = [-6, 0, 0], R = { sw: 10, ab: 22, tw: 0, el: 22 }, L = { sw: 10, ab: 22, tw: 0, el: 22 }, brk = [0, 0];
  const wing = { open: 1 - 0.12 * mv, flap: Math.sin(t * 1.6) * 0.12, len: 1 };
  const tail = [-clamp(o.vx * Math.cos(o.view) * 0.12, -5, 5) + Math.sin(t * 1.2) * 1.2, Math.sin(t * 0.9 + 1) * 1];
  const CALL = ['pillars', 'seeds'];
  if (CALL.includes(o.act) || (CALL.includes(o.prev) && !o.act && o.since < 0.5)) {
    // iki kolunu kaldırır, halelerdeki bütün gözler açılıp parlar: yargı sütunları iner
    const c = o.act ? o.since : 0.4 + o.since, k = bump(0, 0.16, 0.5, 0.9, c);
    for (const a of [R, L]) { a.sw += 150 * k; a.ab += 4 * k; a.el -= 10 * k; } head[0] += 22 * k; lean -= 6 * k; y += 2 * k; wing.flap += 0.3 * k; flash = k; lookW *= 1 - k; rate = 30;
  } else if (o.act === 'horizon' || (o.prev === 'horizon' && !o.act && o.since < 0.7)) {
    // kollarını iki yana gerer: ufuk boyunca bir ışık çizgisi çeker
    const c = o.act ? o.since : 0.5 + o.since, k = bump(0, 0.2, 0.7, 1.2, c);
    for (const a of [R, L]) { a.sw += 10 * k; a.ab += 68 * k; a.el -= 18 * k; } wing.open = 1 + 0.2 * k; lean -= 4 * k; head[0] += 10 * k; flash = k; lookW *= 1 - k; rate = 30;
  } else if (o.act === 'wheel') {
    // kollar ve kanatlar açık, haleler hızlanır: gövdesinden ışık kolları çıkar ve döner
    const k = ss(0, 0.9, o.since);
    for (const a of [R, L]) { a.sw += 6 * k; a.ab += 60 * k; a.el -= 14 * k; } wing.open = 1 + 0.15 * k; core = 0.7 * k; rspin += k * o.since * 3; rsc = 1 + 0.25 * k; head[0] += 8 * k; y += 1.5 * k; lookW = 0; rate = 30;
  } else if (o.act === 'doom') {
    // kanatlarını içe kapatır, ışığı göğsünde toplar; haleler daralıp hızlanır
    const k = ss(0, 1, o.wind);
    for (const a of [R, L]) { a.sw += 44 * k; a.ab -= 46 * k; a.el += 84 * k; } lean += 10 * k; bend[0] += 12 * k; head[0] -= 14 * k; wing.open = 1 - 0.85 * k; core = k; rspin += k * k * 7; rsc = 1 - 0.28 * k; y -= 1.5 * k; lookW = 0;
  } else if (o.act === 'melee') {
    // bir kolunu ışıkla kaldırır, hüküm gibi indirir
    const [up, dn] = meleeK(o);
    R.sw += 140 * up + 55 * dn; R.el -= 12 * up + 14 * dn; R.ab += 10 * up - 10 * dn; lean += -6 * up + 14 * dn; bend[0] += -6 * up + 8 * dn; head[0] += 8 * up - 6 * dn; y += 1.5 * up - 2 * dn;
    wing.flap += 0.3 * up - 0.25 * dn; core = 0.5 * up; flash = dn; rate = 44; lookW = 0.4;
  } else if (o.prev === 'doom' && !o.act && o.since < 0.8) {
    // kıyamet halkası: her şey dışarı patlar
    const k = 1 - ss(0, 0.8, o.since);
    for (const a of [R, L]) { a.sw -= 20 * k; a.ab += 64 * k; } lean -= 12 * k; bend[0] -= 14 * k; head[0] += 26 * k; wing.open = 1 + 0.25 * k; wing.flap += 0.35 * k; core = k * k; rsc = 1 + 0.35 * k; flash = k; y += 2.5 * k; rate = 50;
  }
  if (rage && o.rageT < 1.1) {
    // öfke: kanatlar ve kollar açılır, ışık bekçileri çağrılır
    const k = bump(0, 0.2, 0.75, 1.1, o.rageT);
    for (const a of [R, L]) { a.sw += 30 * k; a.ab += 62 * k; } head[0] += 20 * k; wing.open = 1 + 0.2 * k; wing.flap += 0.3 * k; flash = Math.max(flash, k); core = Math.max(core, 0.5 * k); y += 2 * k; lookW *= 1 - k;
  }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; dimK = h; lean -= 8 * h; x += clamp(o.hx * Math.cos(o.view), -1, 1) * 2 * h; wing.len = 1 - 0.2 * h; wing.flap -= 0.2 * h; rsc *= 1 + 0.08 * Math.sin(t * 40) * h; roll += 6 * h; }
  if (dead) {
    // haleler birer birer kırılır, kanatlar yanıp kıvılcıma döner; varlık içine katlanır, tek bir ışık noktasına çöküp söner
    const d = o.dying * DIE_T, f = ss(0.5, 1.2, d);
    brk[0] = ss(0.2, 0.9, d); brk[1] = ss(0.45, 1.15, d); wing.len = 1 - ss(0.3, 1, d); wing.flap -= 0.5 * ss(0.2, 0.8, d); dimK = 0.5 * bump(0, 0.2, 0.4, 0.7, d);
    for (const a of [R, L]) { a.sw += 40 * f; a.ab -= 40 * f; a.el += 80 * f; } lean += 24 * f; bend[0] += 20 * f; head[0] -= 30 * f; core = ss(0.8, 1.4, d); s = 1 - ss(1.1, 1.6, d) * 0.96; alpha = 1 - ss(1.6, 1.8, d); lookW = 0; rate = 40;
  }
  const [ly0, lp0] = aimLocal(o.tx, o.ty + 14, o.view), ly = clamp(ly0, -1.1, 1.1) * lookW, lp = clamp(lp0, -0.5, 0.5) * lookW;
  const rad = a => ({ sw: a.sw * D, ab: a.ab * D, tw: a.tw * D, el: Math.max(0, a.el) * D });
  return {
    rate, x, y, lean: lean * D, twist: 0, roll: roll * D, bend: [bend[0] * D, bend[1] * D + ly * 0.3, bend[2] * D], head: [head[0] * D + lp, head[1] * D + ly * 0.7, 0], armR: rad(R), armL: rad(L),
    wing, tail, core, flash, dim: dimK, s, alpha, brk, ring: [rspin, rsc], glow: 0.7 + 0.3 * core,
  };
}

export const EZELI = { w: 150, h: 150, ox: 75, oy: 76, scale: 1.15, tilt: 0.14, mats: MATS, fly: true, body: 26, bias: 0.6, turn: 0.5, outline: [70, 50, 20], ownDeath: true, pose, build };
