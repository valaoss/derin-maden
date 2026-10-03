// Uçan küçük düşmanlar: üç yarasa (tek gövde planı), üç göz (tek plan), Işık Yiyen (güve), Işık Bekçisi (altı kanatlı).
// Işıyan parçaların parlaklığı köşe u değerinden okunur (lit): göz kısılır, fener parlar, hale açılır.
import { dot, line } from '../soft3d.js';
import { D, TAU, lerp, ss, mix, hash, at, turn, frame, shift, ell, ball, spike, leaf, tube } from '../boss/rig.js';
import { mobView, ramp } from './common.js';

const lit = (g, n0, k) => { for (let i = n0; i < g.nv; i++) g.uv[i * 2] = k; };
const glowMat = c => ({ ramp: ramp(...c), flat: true, soft: true, glow: 1, px: u => u });
const darker = c => [c[0], c[0], c[1], c[2], c[3]];
const loop = (g, f, n, m, tone) => { let a = f(0); for (let i = 1; i <= n; i++) { const b = f(i / n * TAU); line(g, a, b, m, tone); a = b; } };
// kökten açılan yelpaze kanat: iç bölge mi, dış kuşak mo
const fan = (g, O, pts, s, mi, mo, k = 0.62) => { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], ia = mix(O, a, k), ib = mix(O, b, k); leaf(g, O, ia, ib, mi, s); leaf(g, ia, a, b, mo, s); leaf(g, ia, b, ib, mo, s); } };
const def = (w, top, mats, pose, build, bias = 0.45, x = {}) => ({ w, h: w, ox: w / 2, oy: w / 2, scale: 1, tilt: 0.22, center: true, mats, stride: 20, foot: 6, top, shadow: 0, body: 8, crease: 1.4, outline: [8, 5, 12], turnRate: 9, view: o => mobView(o, bias), pose, build, ...x });
const side = o => Math.cos(o.view) >= 0 ? 1 : -1;
// ortak savrulma ve ölüm: yana yatar, döne döne düşer
function knock(o, q) {
  if (o.hurt > 0 && !(o.dying > 0)) { const h = o.hurt * o.hurt; q.roll += side(o) * 30 * h; q.py -= 0.8 * h; }
  if (o.dying > 0) { const d = o.dying; q.roll = side(o) * 200 * ss(0, 0.5, d); q.py = -5 * d * d; q.rate = 60; }
  return q;
}

// ---------- yarasalar ----------
const B = { FUR: 1, EAR: 2, MEMB: 3, MEMB2: 4, BONE: 5, EYE: 6, FX: 7 };
function batMats(fur, memb, eye, fx) {
  const m = [];
  m[B.FUR] = { ramp: ramp(...fur) }; m[B.EAR] = { ramp: ramp(...memb), flat: true };
  m[B.MEMB] = { ramp: ramp(...memb), back: B.MEMB2 }; m[B.MEMB2] = { ramp: ramp(...darker(memb)) };
  m[B.BONE] = { ramp: ramp(...fur), flat: true, soft: true }; m[B.EYE] = { ramp: ramp(...eye), flat: true, soft: true, glow: 1 };
  m[B.FX] = fx; return m;
}
const OPEN = (a, k) => [[0.8, Math.sin(a + 0.25) * 4.2 * k, Math.cos(a + 0.25) * 4.2 * k], [1.8, Math.sin(a * 1.25) * 8.6 * k, Math.cos(a * 1.25) * 8.6 * k], [-1.6, Math.sin(a) * 7.6 * k, Math.cos(a) * 7.6 * k], [-3.4, Math.sin(a - 0.15) * 5 * k, Math.cos(a - 0.15) * 5 * k]];
const FOLD = [[0.6, 0.5, 1.2], [4.8, -0.9, 0.9], [4.4, -1.6, 0.2], [3.2, -2, -0.4]];
// c: { span, ear: [boy, açıklık], beat, fx(g, T, P, o, kanat uçları) }
const batBuild = c => (g, P, o) => {
  const T = turn(frame([0, P.py, 0]), 0, P.pitch, P.roll), op = OPEN(P.flap, c.span), k = P.fold, W = {};
  ell(g, shift(T, -0.5, 0, 0), 2.7, 2, 2, B.FUR, 8, 4);
  ball(g, at(T, 2.5, 0.5, 0), 1.7, B.FUR, 6);
  dot(g, at(T, 4.2, 0.1, 0), B.EAR, 3);
  for (const s of [-1, 1]) {
    spike(g, at(T, 2.2, 1.5, s * 0.9), at(T, 1.8, 1.5 + c.ear[0], s * c.ear[1]), 0.85, B.EAR, 3);
    if (P.eye > 0.5) dot(g, at(T, 3.8, 0.4, s * 0.9), B.EYE, 3);
    const w = W[s] = op.map((q, i) => at(T, 0.6 + lerp(q[0], FOLD[i][0], k), 0.9 + lerp(q[1], FOLD[i][1], k), s * (1.3 + lerp(q[2], FOLD[i][2], k))));
    const sh = at(T, 0.6, 0.9, s * 1.3), hip = at(T, -2.6, -0.3, s * 0.7);
    leaf(g, w[0], w[1], w[2], B.MEMB, s); leaf(g, w[0], w[2], w[3], B.MEMB, s); leaf(g, w[0], w[3], hip, B.MEMB, s); leaf(g, sh, w[0], hip, B.MEMB, s);
    line(g, sh, w[0], B.BONE, 3); for (let i = 1; i < 4; i++) line(g, w[0], w[i], B.BONE, i === 1 ? 3 : 2);
    line(g, at(T, -2.8, -0.6, s * 0.6), at(T, -4.3, -0.8, s * 0.8), B.BONE, 2);
  }
  if (c.fx) { const n0 = g.nv; c.fx(g, T, P, o, W); lit(g, n0, 0.9); }
  return { head: at(T, 2.5, 2.5, 0), mouth: at(T, 4, -0.3, 0) };
};
const batPose = c => o => {
  const t = o.t, dead = o.dying > 0;
  const q = { rate: 45, flap: lerp(0.15 + Math.sin(t * c.beat + o.wob) * 0.75, 0.95, o.wind * 0.6), fold: 0.35 * o.lunge, pitch: 6 + 10 * o.walk + 24 * o.wind - 34 * o.lunge, roll: 0, py: Math.sin(t * c.beat * 0.5 + o.wob) * 0.6 + o.wind, eye: 1, zap: dead ? 0 : Math.max(o.lunge, Math.min(1, o.flash * 4)), zoom: o.e.scale || 1 };
  knock(o, q);
  if (dead) { q.pitch = lerp(q.pitch, -40, ss(0, 0.5, o.dying)); q.flap = 0.9; q.fold = 0.3; q.eye = 0; }
  q.pitch *= D; q.roll *= D; return q;
};
const bat = (mats, c) => def(40, 7, mats, batPose(c), batBuild(c));
// kırağı: sırtta ve kuyrukta buz dikenleri, kanat uçlarında kırağı, altından kar tanesi dökülür
function frostFx(g, T, P, o, W) {
  for (let i = 0; i < 3; i++) spike(g, at(T, 0.9 - i * 1.3, 1.5, 0), at(T, 0.2 - i * 1.6, 4.1 - i * 0.6, 0), 0.75, B.FX, 3);
  spike(g, at(T, -2.8, 0, 0), at(T, -6, -0.9, 0), 0.8, B.FX, 3);
  for (const s of [-1, 1]) for (let i = 1; i < 4; i++) dot(g, W[s][i], B.FX, 4);
  for (let i = 0; i < 3; i++) { const f = (o.t * 0.9 + i / 3 + hash(i)) % 1; if (P.eye > 0.5) dot(g, at(T, -2 + i * 2 - f, -2 - f * 5, (hash(i + 5) - 0.5) * 6), B.FX, f < 0.5 ? 4 : 2); }
}
// yıldırım: kulaklar arasında ve kanat boyunca çatırdayan kıvılcım; çarparken çoğalır
function voltFx(g, T, P, o, W) {
  const q = Math.floor(o.t * 18), h = n => hash(q * 3.1 + n) - 0.5;
  const zig = (a, b, n) => { const m = mix(a, b, 0.5); m[0] += h(n) * 3; m[1] += h(n + 1) * 3; m[2] += h(n + 2) * 3; line(g, a, m, B.FX, 4); line(g, m, b, B.FX, 3); };
  for (let i = 0; i < 3; i++) dot(g, at(T, 0.8 - i * 1.3, 2, 0), B.FX, 4);
  spike(g, at(T, -2.8, 0, 0), at(T, -5.4, 1.4, 0), 0.6, B.FX, 3);
  if (P.eye < 0.5) return;
  zig(at(T, 1.8, 5.4, -2.4), at(T, 1.8, 5.4, 2.4), 1);
  const s = h(9) > 0 ? 1 : -1; zig(W[s][0], W[s][1 + (q % 3)], 4);
  if (P.zap > 0.25) for (const z of [-1, 1]) { zig(W[z][1], W[z][2], 11 + z); zig(W[z][2], W[z][3], 15 + z); zig(at(T, 4, 0, 0), at(T, 7 + P.zap * 2, h(20) * 4, z * 2.5), 21 + z); }
}
const SPARK = ['#8a6a10', '#e0b020', '#ffe24a', '#fff49a', '#ffffff'];

// ---------- gözler ----------
const E = { SHELL: 1, IRIS: 2, PUPIL: 3, TRIM: 4, FX: 5, DEAD: 6 }, R = 3.7;
// c: { extra(g, T, P, o), more(o) -> duruşa eklenenler (iris, glow, zk ...) }
const eyeBuild = c => (g, P, o) => {
  const T = turn(frame([P.ax, P.py, 0]), 0, P.pitch, P.roll), open = 1 - P.lid * 0.9, dead = P.off > 0.5;
  ell(g, T, R, R, R, E.SHELL, 9, 5);
  let n0 = g.nv;
  ell(g, shift(T, R * 0.5, 0, 0), R * 0.62, R * 0.76 * open, R * 0.76, dead ? E.DEAD : E.IRIS, 8, 4); lit(g, n0, P.iris); n0 = g.nv;
  ell(g, shift(T, R * 0.9, 0, 0), R * 0.3, R * 0.42 * open * P.pup, R * 0.42 * P.pup, dead ? E.DEAD : E.PUPIL, 6, 3); lit(g, n0, P.glow); n0 = g.nv;
  c.extra(g, T, P, o); lit(g, n0, P.glow);
  return { head: at(T, 0, R + 1, 0), mouth: at(T, R, 0, 0), eye: at(T, R * 1.2, 0, 0) };
};
const eyePose = c => o => {
  const t = o.t, dead = o.dying > 0, x = c.more ? c.more(o) : {}, h = dead ? 0 : o.hurt * o.hurt;
  const q = { rate: 30, ax: -1.6 * o.wind + 2.6 * o.lunge - 1.2 * h, py: Math.sin(t * 3.2 + o.wob) * 0.9, pitch: Math.sin(t * 1.7 + o.wob) * 5 + 8 * o.wind - 10 * o.lunge, roll: Math.sin(t * 2.3 + o.wob) * 4,
    lid: Math.max(h, (t * 0.5 + o.wob) % 3.4 < 0.14 ? 1 : 0), pup: 1 + 0.3 * o.wind - 0.3 * h, iris: 0.7, glow: 0.7, off: 0, ray: 0, ...x };
  knock(o, q);
  if (dead) { q.lid = 1; q.off = 1; q.ray = 0; q.roll *= 0.8; }
  q.zoom = (o.e.scale || 1) * (x.zk ?? 1) * (1 - 0.3 * o.dying); q.pitch *= D; q.roll *= D; return q;
};
function eyeMats(shell, iris, pupil, trim, fx) {
  const m = [];
  m[E.SHELL] = { ramp: ramp(...shell) }; m[E.IRIS] = glowMat(iris); m[E.PUPIL] = pupil; m[E.TRIM] = trim; m[E.FX] = glowMat(fx);
  m[E.DEAD] = { ramp: ramp(...darker(darker(shell))), flat: true }; return m;
}
const eye = (mats, c, w = 36) => def(w, 6, mats, eyePose(c), eyeBuild(c), 0.62);
const yz = (T, x, r, a) => at(T, x, Math.sin(a) * r, Math.cos(a) * r);
// Parıldak: pirinç fener gövde, tepe halkası, sarkan püskül; saldırırken merceğin çevresinden ışın fışkırır
const GLARER = {
  more: o => { const k = Math.max(o.wind, Math.min(1, o.flash * 3)); return { iris: 0.5 + 0.5 * k, glow: 0.5 + 0.5 * k, ray: k }; },
  extra(g, T, P, o) {
    loop(g, a => yz(T, R * 0.62, R * 0.84, a), 10, E.TRIM, 4); loop(g, a => yz(T, -R * 0.2, R * 1.02, a), 10, E.TRIM, 2);
    spike(g, at(T, 0, R * 0.7, 0), at(T, 0, R + 2.4, 0), 1.5, E.SHELL, 5);
    loop(g, a => at(T, Math.cos(a) * 1.3, R + 3.2 + Math.sin(a) * 1.3, 0), 6, E.TRIM, 3);
    const sw = Math.sin(o.t * 3 + o.wob) * 0.8, tip = at(T, -0.6 - sw, -R - 2.6, 0);
    line(g, at(T, 0, -R, 0), tip, E.TRIM, 3); if (P.off < 0.5) { dot(g, tip, E.FX, 4); dot(g, tip, E.FX, 3, 0, 1); }
    if (P.ray > 0.08) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + o.t * 2, L = P.ray * (i & 1 ? 3 : 4.6); spike(g, yz(T, R * 0.7, R * 0.95, a), yz(T, R * 0.7 + L * 0.35, R * 0.95 + L, a), 0.55, E.FX, 3); }
  },
};
// Boşluk Gözü: koyu mor küre, ak göz bebeği, altında dalgalanan dört dokunaç, çevresinde dönen zerreler; ışınlanınca bir noktadan belirir
const VOIDLING = {
  more: o => ({ zk: 1 - 0.75 * o.blink, glow: 0.95, iris: 0.5 + 0.4 * o.wind }),
  extra(g, T, P, o) {
    const t = o.t, limp = P.off > 0.5 ? 0.2 : 1;
    for (let j = 0; j < 4; j++) {
      const a = j / 4 * TAU + 0.8, bx = -0.8 + Math.cos(a) * 1.5, bz = Math.sin(a) * 1.8, pts = [];
      for (let i = 0; i < 4; i++) pts.push(at(T, bx - i * 0.7 - P.ax * i * 0.3 + Math.sin(t * 3.4 + j * 1.7 + i * 0.9) * 0.5 * i * limp, -R * 0.75 - i * 1.7, bz * (1 + i * 0.12) + Math.cos(t * 2.9 + j * 2.1 + i) * 0.4 * i * limp));
      tube(g, pts, [0.95, 0.75, 0.5, 0.22], 4, E.TRIM);
    }
    if (P.off < 0.5) for (let i = 0; i < 3; i++) { const a = t * 2.2 + i * TAU / 3; dot(g, at(T, Math.cos(a) * (R + 2.2), Math.sin(a * 1.3 + i) * 2.4, Math.sin(a) * (R + 2.2)), E.FX, i ? 3 : 4); }
  },
};
// Zaman Gözü: kehribar göz, çevresinde saat çemberi, önünde akrep ve yelkovan; geri sarmaya yakın ibreler tersine fırıl döner, göz atar
const soon = e => e.rewindCd < 1.5 && !e.dead;
const CHRONO = {
  more: o => { const s = soon(o.e), p = s ? 0.5 + 0.5 * Math.sin(o.t * 20) : 0; return { iris: s ? 0.4 + 0.6 * p : 0.62, glow: s ? 0.5 + 0.5 * p : 0.9, pup: 1 + 0.3 * o.wind + (s ? 0.35 * p : 0), ring: s ? 0.5 * p : 0 }; },
  extra(g, T, P, o) {
    const rr = R + 2.3 + P.ring, s = soon(o.e), a = s ? -o.t * 11 : o.t * 1.3, b = s ? -o.t * 5 : o.t * 0.22 + 1;
    for (const x of [0, 0.7]) loop(g, k => yz(T, x, rr, k), 14, E.TRIM, x ? 4 : 2);
    for (let i = 0; i < 12; i++) dot(g, yz(T, 0.8, rr + (i % 3 ? 0 : 1), i / 12 * TAU), i % 3 ? E.TRIM : E.FX, i % 3 ? 3 : 4);
    if (P.off > 0.5) return;
    line(g, at(T, R * 1.28, 0, 0), yz(T, R * 1.05, rr - 0.6, a), E.FX, 3); line(g, at(T, R * 1.28, 0, 0), yz(T, R * 1.2, R * 0.62, b), E.FX, 2);
  },
};

// ---------- Işık Yiyen: kara güve ----------
const MO = { BODY: 1, WING: 2, WING2: 3, EDGE: 4, EYE: 5, OFF: 6 };
const MOTH = [];
MOTH[MO.BODY] = { ramp: ramp('#03060c', '#081226', '#0c1a3a', '#16305a', '#24487a') };
MOTH[MO.WING] = { ramp: ramp('#04070f', '#0a1228', '#0c1a3a', '#12264a', '#16305a'), flat: true, back: MO.WING2 };
MOTH[MO.WING2] = { ramp: ramp('#03050a', '#070d1c', '#0a1428', '#0c1a3a', '#10223e'), flat: true };
MOTH[MO.EDGE] = { ramp: ramp('#0a1630', '#12264a', '#1c3a6a', '#2a5088', '#3a6aa8'), flat: true, back: MO.EDGE };
MOTH[MO.EYE] = glowMat(['#124a5a', '#2a90a8', '#5ad0e8', '#8af0ff', '#e0fcff']);
MOTH[MO.OFF] = { ramp: ramp('#04080f', '#0a1630', '#12264a', '#16305a', '#24487a'), flat: true, soft: true };
function mothBuild(g, P, o) {
  const T = turn(frame([0, P.py, 0]), 0, P.pitch, P.roll), EY = P.off > 0.5 ? MO.OFF : MO.EYE, tone = P.glow > 0.75 ? 4 : 3;
  ell(g, shift(T, -2.4, -0.3, 0), 2.6, 1.25, 1.25, MO.BODY, 7, 4);
  ball(g, at(T, 0.2, 0, 0), 1.9, MO.BODY, 7);
  ball(g, at(T, 2.2, 0.2, 0), 1.2, MO.BODY, 5);
  for (let i = 0; i < 3; i++) dot(g, at(T, -1.4 - i * 1.3, 0.9 - i * 0.15, 0), EY, tone - 1);
  for (const s of [-1, 1]) {
    dot(g, at(T, 3.1, 0.5, s * 0.8), EY, 4);
    const an = i => at(T, 2.6 + i * 0.75, 1 + i * 0.95 - i * i * 0.1, s * (0.5 + i * 0.55));
    for (let i = 0; i < 3; i++) { line(g, an(i), an(i + 1), MO.EDGE, 3); line(g, an(i + 1), at(T, 2.2 + i * 0.75, 1.3 + i * 0.95, s * (1.3 + i * 0.6)), MO.EDGE, 2); }
    const W = (x, r, a) => at(T, x, 0.6 + Math.sin(a) * r, s * (0.8 + Math.cos(a) * r)), a = P.flap, b = P.flap * 0.8 - 0.12;
    fan(g, at(T, 0.9, 0.6, s * 0.8), [W(4.6, 4.4, a), W(3.8, 8.6, a), W(0.6, 9, a), W(-1.4, 5.6, a), W(-1, 1.5, a)], s, MO.WING, MO.EDGE, 0.8);
    fan(g, at(T, -0.6, 0.4, s * 0.8), [W(-1, 5.6, b), W(-3.6, 6.6, b), W(-5.8, 4.4, b), W(-4.4, 1.2, b)], s, MO.WING, MO.EDGE, 0.8);
    for (const [x, r, an2] of [[1.4, 5.2, a], [-2.6, 3.6, b]]) { const p = W(x, r, an2); dot(g, p, EY, tone); dot(g, p, EY, tone - 1, 1, 0); }
  }
  return { head: at(T, 0, 3, 0), mouth: at(T, 3.4, 0, 0) };
}
function mothPose(o) {
  const t = o.t, dead = o.dying > 0, sv = Math.sin(o.view), eat = o.e.d.eatLight && Math.hypot(o.tx, o.ty) < o.e.d.eatLight ? 1 : 0;
  const q = { rate: 40, flap: lerp(0.65 - 0.45 * Math.abs(sv) + Math.sin(t * 12 + o.wob) * 0.75, 1.15, o.wind * 0.7) - 0.9 * o.lunge, pitch: 12 - 30 * ss(0.4, 1, sv) + 30 * ss(0.4, 1, -sv) + 14 * o.wind - 30 * o.lunge, roll: Math.sin(t * 2.6 + o.wob) * 6, py: Math.sin(t * 12 + o.wob - 1.3) * 0.8 + Math.sin(t * 2.1) * 0.7, glow: Math.max(eat, o.wind), off: 0, zoom: o.e.scale || 1 };
  knock(o, q);
  if (dead) { q.flap = 1.2; q.off = 1; q.pitch = 10; }
  q.pitch *= D; q.roll *= D; return q;
}

// ---------- Işık Bekçisi: altı kanatlı, haleli göz ----------
const S = { BODY: 1, WING: 2, WING2: 3, TIP: 4, HALO: 5, EYE: 6, PUP: 7, OFF: 8 };
const SER = [];
SER[S.BODY] = { ramp: ramp('#4a3e52', '#8a7a94', '#c8b8c8', '#f0e4e0', '#ffffff') };
SER[S.WING] = { ramp: ramp('#6a5c74', '#a898b0', '#d8ccd8', '#fff4e8', '#ffffff'), flat: true, back: S.WING2 };
SER[S.WING2] = { ramp: ramp('#4a3e52', '#7a6c84', '#a898b0', '#c8bcc8', '#e8dcdc'), flat: true };
SER[S.TIP] = { ramp: ramp('#7a5a1a', '#b88a30', '#e8b850', '#ffd870', '#ffe79a'), flat: true, back: S.TIP };
SER[S.HALO] = glowMat(['#a87a20', '#e8b040', '#ffd870', '#ffe79a', '#fffbe8']);
SER[S.EYE] = glowMat(['#b89a50', '#ffd870', '#ffe79a', '#fff8d0', '#ffffff']);
SER[S.PUP] = { ramp: ramp('#1a121a', '#3a2e3a', '#3a2e3a', '#5a4a5a', '#5a4a5a'), flat: true, soft: true };
SER[S.OFF] = { ramp: ramp('#3a3040', '#5a4e62', '#7a6c84', '#9a8ca0', '#b8acb8'), flat: true, soft: true };
const WINGS = [[1.9, 0.85, 8.6, 0.5, 0], [0.6, 0.12, 7.6, 0.6, 1.1], [-0.7, -0.62, 5.6, 0.45, 2.2]];   // kök y, açı, boy, çırpma payı, evre
function seraphBuild(g, P, o) {
  const T = turn(frame([0, P.py, 0]), 0, P.pitch, P.roll), off = P.off > 0.5, hot = P.beam > 0.4 && !off;
  ball(g, at(T, 0, 1.3, 0), 2.5, S.BODY, 7);
  spike(g, at(T, -0.2, 0.4, 0), at(T, -1.6 - P.sway, -6.4, 0), 2.1, S.BODY, 6);
  let n0 = g.nv;
  ell(g, shift(T, 1.5, 1.4, 0), 1.3, 1.5 * (1 - P.lid * 0.85), 1.5, off ? S.OFF : S.EYE, 7, 4); lit(g, n0, P.glow); n0 = g.nv;
  if (P.lid < 0.5) { const p = at(T, 2.9, 1.4, 0); dot(g, p, S.PUP, 2); if (!hot) dot(g, p, S.PUP, 2, 0, 1); }
  const hy = 5.2 + P.beam * 0.8, hr = 2.7 + P.beam * 0.9;
  loop(g, a => at(T, Math.cos(a) * hr - 0.3, hy, Math.sin(a) * hr), 12, off ? S.OFF : S.HALO, off ? 2 : hot ? 4 : 3);
  for (const s of [-1, 1]) WINGS.forEach(([y0, a0, L, amp, ph], j) => {
    const a = a0 + P.spread * (0.5 - j * 0.12) + Math.sin(P.beat - ph) * amp * P.amp, x0 = -0.6 - j * 0.3;
    const W = (x, r, da = 0) => at(T, x0 + x, y0 + Math.sin(a + da) * r, s * (1.1 + Math.cos(a + da) * r));
    fan(g, at(T, x0, y0, s * 1.1), [W(1.6, L * 0.55, 0.3), W(1.2, L * 0.92, 0.12), W(0, L), W(-1.4, L * 0.86, -0.14), W(-2.2, L * 0.58, -0.3), W(-1.6, L * 0.2, -0.4)], s, S.WING, hot ? S.HALO : S.TIP, 0.7);
  });
  lit(g, n0, 0.6); n0 = g.nv;
  if (hot) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - o.t * 3, L = 1.5 + P.beam * (i & 1 ? 1.6 : 3); spike(g, at(T, 2.2, 1.4 + Math.sin(a) * 1.5, Math.cos(a) * 1.5), at(T, 2.6 + L * 0.5, 1.4 + Math.sin(a) * (1.5 + L), Math.cos(a) * (1.5 + L)), 0.5, S.HALO, 3); }
  lit(g, n0, 1);
  return { head: at(T, 0, 6, 0), mouth: at(T, 2.9, 1.4, 0), eye: at(T, 2.9, 1.4, 0) };
}
function seraphPose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, beam = dead ? 0 : Math.max(e.beamT > 0 ? 1 : 0, o.wind, Math.min(1, o.flash * 3));
  const q = { rate: 26, beat: t * 6.5 + o.wob, amp: 1 - 0.75 * beam, spread: beam - 0.5 * o.lunge, beam, pitch: 4 * o.walk + 8 * beam - 14 * o.lunge, roll: Math.sin(t * 1.9 + o.wob) * 3, py: Math.sin(t * 2.6 + o.wob) * 0.9 + beam * 0.8, sway: Math.sin(t * 2.2 + o.wob) * 0.6 + o.walk,
    lid: Math.max(dead ? 1 : o.hurt * o.hurt, (t * 0.4 + o.wob) % 3.8 < 0.13 ? 1 : 0), glow: 0.62 + 0.38 * beam, off: dead ? 1 : 0, zoom: e.scale || 1 };
  knock(o, q);
  if (dead) { q.spread = -0.9 * ss(0, 0.6, o.dying); q.amp = 0.2; q.roll *= 0.45; }
  q.pitch *= D; q.roll *= D; return q;
}

export const DEFS = {
  flyer: bat(batMats(['#140c08', '#2c1c14', '#483022', '#684834', '#8c684c'], ['#1a0e0a', '#38211a', '#58362a', '#784e3e', '#986c58'], ['#7a2a08', '#c0501a', '#ff8a2a', '#ffb050', '#ffe0a0']), { span: 0.9, ear: [1.7, 1.5], beat: 17 }),
  frostbat: bat(batMats(['#12283a', '#2a5878', '#4a8ab0', '#7abce0', '#b8e8ff'], ['#16344a', '#30688a', '#5a9cc4', '#9ad8ff', '#d8f2ff'], ['#6aa8c8', '#a8dcf4', '#e8f8ff', '#ffffff', '#ffffff'],
    { ramp: ramp('#3a7aa0', '#7ac0e8', '#b8e8ff', '#e8f8ff', '#ffffff'), glow: 1 }), { span: 1, ear: [2.9, 1.2], beat: 15, fx: frostFx }),
  voltbat: bat(batMats(['#060c18', '#10203a', '#16304e', '#244a78', '#3a6aa8'], ['#0a1a3a', '#143a7a', '#2260c0', '#3a8aff', '#7ab4ff'], SPARK, glowMat(SPARK)), { span: 1.12, ear: [3.4, 2.4], beat: 21, fx: voltFx }),
  glarer: eye(eyeMats(['#1c1206', '#3e2c10', '#63491c', '#8a6a2a', '#c09a4c'], ['#c89438', '#e8c060', '#ffe79a', '#fff8d0', '#ffffff'], { ramp: ramp('#1a1206', '#3a2a10', '#3a2a10', '#3a2a10', '#5a4418'), flat: true, soft: true },
    { ramp: ramp('#2a1c08', '#5a4418', '#8a6a2a', '#d8b060', '#f4dc98'), flat: true, soft: true }, ['#e8c060', '#ffe79a', '#fff8d0', '#ffffff', '#ffffff']), GLARER, 40),
  voidling: eye(eyeMats(['#0a0820', '#1c1840', '#2a2460', '#3a3080', '#5a4eb0'], ['#2a2460', '#4a3eb0', '#7a6aff', '#a89cff', '#c0b8ff'], glowMat(['#7a6aff', '#c0b8ff', '#e8e4ff', '#ffffff', '#ffffff']),
    { ramp: ramp('#0a0820', '#1c1840', '#2a2460', '#3a3080', '#5a4eb0') }, ['#4a3eb0', '#7a6aff', '#a89cff', '#c0b8ff', '#ffffff']), VOIDLING),
  chronoling: eye(eyeMats(['#2a2010', '#4e3c1c', '#7a6030', '#a88848', '#c8a860'], ['#7a5a20', '#c89040', '#ffc060', '#ffd890', '#fff0c8'], glowMat(['#c8a860', '#ffd890', '#fff0c8', '#ffffff', '#ffffff']),
    { ramp: ramp('#2a2010', '#4e3c1c', '#7a6030', '#c8a860', '#f0d898'), flat: true, soft: true }, ['#c89040', '#ffc060', '#ffd890', '#fff0c8', '#ffffff']), CHRONO, 40),
  isikYiyen: def(44, 8, MOTH, mothPose, mothBuild, 0.45, { tilt: 0.5 }),
  seraph: def(48, 9, SER, seraphPose, seraphBuild, 0.55),
};
