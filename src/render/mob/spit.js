// Tüküren ve üreten dört küçük yaratık, ortak bacak/yürüyüş/ölüm iskeletiyle:
// Tükürgen (mor, bodur; gırtlağındaki yeşil kese şişer, tükürürken öne atılır), Spor Böceği (sırtında mantar şapkası; şapka çöküp
// kalkarak spor püskürtür), Örücü (uzun bacaklar üstünde kızıl gövde; iki uzun ön koluyla ağ örer), Yumurtacı (şiş karnında soluk yumurtalar).
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, ss, at, turn, frame, ell, ball, bone, skin, spike, ik, reach } from '../boss/rig.js';
import { mobView, ramp, fr, noise } from './common.js';

const EYE = { ramp: ramp('#7a1010', '#c02a1a', '#ff4a3a', '#ff7a5a', '#ffc0a0'), flat: true, soft: true, glow: 1 };
const nearOf = o => Math.cos(o.view) >= 0 ? 1 : -1, front = o => Math.sin(o.view) > -0.4;
const sub = (T, x, y, z) => frame(at(T, x, y, z), T.f, T.u, T.r);
const body = P => turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll);

// ---------- ortak: bacaklar ----------
// ayaklar çift çift (sağ, sol) dizilir; R = [[x, z], ...] durma yerleri
const rest = R => R.flatMap(([x, z]) => [[x, 0, z], [x, 0, -z]]);
// çapraz adım: döngünün 0.6'sı yerde geriye kayar, kalanı havada öne gelir (stride = step * 2 / 0.6)
function gait(feet, o, w, step, lift) {
  for (let i = 0; i < feet.length; i++) {
    const k = fr(o.ph + ((i >> 1) + (i & 1)) % 2 * 0.5 + (i >> 1) * 0.06);
    feet[i][0] += (k < 0.6 ? 1 - 2 * k / 0.6 : 2 * ss(0.6, 1, k) - 1) * step * w;
    if (k >= 0.6) feet[i][1] += Math.sin((k - 0.6) / 0.4 * Math.PI) * lift * w;
  }
}
// L = { hip: [x...], y, z, l1, l2, pz, m, r? }: r varsa etli (kemik), yoksa ince (çizgi) bacak; uzak yandakiler koyu
function legs(g, T, feet, L, nr) {
  for (let i = 0; i < feet.length; i++) {
    const s = i & 1 ? -1 : 1, hip = at(T, L.hip[i >> 1], L.y, s * L.z), ft = reach(hip, feet[i], L.l1 + L.l2 - 0.2), kn = ik(hip, ft, L.l1, L.l2, [L.px || 0, 1, s * L.pz]), c = s * nr > 0 ? 1 : 0;
    if (L.r) { bone(g, hip, kn, L.r, L.r * 0.8, L.m, 1.1, 5); bone(g, kn, ft, L.r * 0.75, L.r * 0.5, L.m, 1, 5, true); }
    else { line(g, hip, kn, L.m, 2 + c); line(g, kn, ft, L.m, 1 + c); if (c && L.knee) dot(g, kn, L.m, 4); }
  }
}
function base(o, L, py) {
  const dead = o.dying > 0, w = dead ? 0 : o.walk, feet = rest(L.rest);
  if (w > 0.01) gait(feet, o, w, L.step, L.lift);
  return { o, dead, w, nr: nearOf(o), feet, px: 0, py: py + Math.sin(o.t * 3 + o.wob) * 0.1 + Math.abs(Math.sin(o.ph * TAU)) * 0.2 * w, pitch: 0, roll: Math.sin(o.ph * TAU) * L.sway * w, rate: 30,
    wd: dead ? 0 : ss(0, 1, o.wind) * (1 - o.lunge), l: dead ? 0 : o.lunge };
}
// vurulunca yana yatar; ölünce sırtüstü döner, bacaklar çırpınıp karnın üstünde toplanır
function done(S, L, lie, extra) {
  const o = S.o;
  if (o.hurt > 0 && !S.dead) { const h = o.hurt * o.hurt; S.py -= 0.6 * h; S.roll += S.nr * 11 * h; S.pitch -= 4 * h; for (const f of S.feet) { f[0] *= 1 - 0.15 * h; f[2] *= 1 - 0.15 * h; } }
  if (S.dead) {
    const d = o.dying, k = ss(0, 0.4, d), tw = (1 - ss(0.4, 0.85, d)) * k;
    S.roll = S.nr * 180 * k; S.py = lerp(S.py, lie, k) + Math.sin(k * Math.PI) * 2.6; S.pitch *= 1 - k; S.rate = 60;
    S.feet.forEach((f, i) => { const s = i & 1 ? -1 : 1; f[0] = lerp(f[0], L.hip[i >> 1] * 1.4, k); f[1] = lerp(0, S.py + L.up + Math.sin(d * 46 + i * 1.7) * 1.2 * tw, k); f[2] = lerp(f[2], s * (L.z + 0.6 + tw), k); });
  }
  for (const f of S.feet) f[0] += S.px;
  return { rate: S.rate, px: S.px, py: S.py, pitch: S.pitch * D, roll: S.roll * D, feet: S.feet, dead: S.dead ? ss(0.2, 0.6, o.dying) : 0, zoom: o.e.scale || 1, ...extra };
}
const def = (o, L, pose, build) => ({ scale: 1, tilt: 0.36, crease: 1.6, outline: [10, 6, 12], turnRate: 9, wrap: ['roll'], stride: L.step * 2 / 0.6, view: o2 => mobView(o2, 0.4), pose, build, ...o });

// ---------- Tükürgen ----------
const SPIT = { rest: [[2.6, 3.9], [-2.8, 4.1]], hip: [1.8, -2.2], y: -1.2, z: 2.6, l1: 2.3, l2: 2.5, pz: 1.2, m: 3, r: 0.95, up: 5.2, step: 1.5, lift: 1.1, sway: 4 };
const SPIT_M = [, { ramp: ramp('#1c0c2a', '#4a2266', '#7a44a8', '#a068cc', '#c890e8'), px: (u, v, i) => i + (v < 0.34 ? -0.2 : v > 0.62 && noise(Math.floor(u * 1.5), Math.floor(v * 9)) > 0.72 ? 0.2 : 0) },
  { ramp: ramp('#2a6a18', '#5ab030', '#9af060', '#c8ff90', '#f0ffd0'), glow: 1 }, { ramp: ramp('#140820', '#2e1444', '#4a2266', '#663890', '#8a58b4') }, EYE,
  { ramp: ramp('#0a040e', '#12081a', '#1c0c2a', '#2a1240', '#3a1a56'), flat: true, soft: true }];
function spitBuild(g, P, o) {
  const T = body(P), H = sub(T, 2.5 + P.jaw * 0.8, 0.5, 0), sac = Math.max(0, P.sac);
  ell(g, sub(T, -0.8, 0, 0), 4.3, 3.1 + P.br, 3.8, 1, 10, 5);
  ell(g, H, 2.7, 2.3, 3, 1, 8, 4);
  // gırtlak kesesi: tükürmeden önce şişer
  const sc = at(H, 1.3 + sac * 0.9, -1.2 - sac * 0.5, 0);
  ball(g, sc, 1.1 + sac * 2.1, 2, 7);
  if (P.jaw > 0.25 && front(o)) dot(g, at(H, 2.7, -0.2, 0), 5, 1);
  for (const s of [-1, 1]) {
    ball(g, at(H, 0.5, 1.9 - P.dead * 0.6, s * 1.5), 0.95, 1, 5);
    if (front(o) && P.dead < 0.5) dot(g, at(H, 1.2, 2.2, s * 1.9), 4, 3);
  }
  legs(g, T, P.feet, SPIT, nearOf(o));
  return { mouth: at(H, 2.4 + sac * 2.8, -1.2 - sac * 0.5, 0), head: at(T, 0, 4, 0) };
}
function spitPose(o) {
  const S = base(o, SPIT, 3), t = o.t, wd = S.wd, l = S.l;
  let sac = 0.14 + 0.12 * Math.sin(t * 5 + o.wob), jaw = 0;
  // nişan: geri yaslanır, kese şişer; atış: öne atılır, kese boşalır
  if (wd > 0.001) { S.px -= 1.3 * wd; S.pitch += 13 * wd; sac = lerp(sac, 1.05 + Math.sin(t * 30) * 0.05, wd); }
  if (l > 0.001) { S.px += 2.4 * l; S.pitch -= 9 * l; sac = lerp(sac, -0.3, l); jaw = l; S.rate = 45; }
  if (o.hurt > 0 || S.dead) sac = 0;
  return done(S, SPIT, 3, { sac, jaw, br: Math.sin(t * 2.5 + o.wob) * 0.1 });
}

// ---------- Spor Böceği ----------
const SPORE = { rest: [[3.4, 4.4], [0.2, 5], [-3.2, 4.4]], hip: [2, 0, -2], y: -1.2, z: 2.4, l1: 2.6, l2: 3.2, pz: 0.8, m: 3, up: 5, step: 1.5, lift: 1.2, sway: 3 };
const SPORE_M = [, { ramp: ramp('#120a14', '#2e1a34', '#4c2a50', '#6a3e6a', '#8a5a8a') },
  // şapka: altı koyu, üstü açık benekli
  { ramp: ramp('#3a2050', '#6a4488', '#9a6cc0', '#c890e8', '#f0d0ff'), px: (u, v, i) => v < 0.42 ? i - 0.45 : i + (noise(Math.floor(u * 1.2 + 0.5), Math.floor(v * 7)) > 0.7 ? 0.22 : 0) },
  { ramp: ramp('#0a060c', '#120a14', '#2e1a34', '#4c2a50', '#6a3e6a'), flat: true, soft: true }, EYE,
  { ramp: ramp('#2a6a18', '#5ab030', '#a8f070', '#d0ffa0', '#f4ffe0'), flat: true, soft: true, glow: 1 }];
function sporeBuild(g, P, o) {
  const T = body(P), C = turn(sub(T, -0.4, 1.6 + P.lift, 0), 0, P.tip), w = P.capW, h = P.capH;
  ell(g, T, 4.5, 2.5, 3.5, 1, 9, 4);
  bone(g, at(T, -0.4, 1, 0), at(C, 0, 0.6, 0), 1.9, 1.5, 1, 1, 6);
  ell(g, sub(C, 0, 2 * h, 0), 5.6 * w, 2.5 * h, 4.9 * w, 2, 10, 5);
  // şapka kenarındaki spor gözeleri ve püsküren sporlar
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; dot(g, at(C, Math.cos(a) * 5 * w, 0.9 * h, Math.sin(a) * 4.4 * w), 5, P.vent > 0.5 ? 4 : 2); }
  if (P.puff > 0.03) for (let i = 0; i < 7; i++) { const a = i * 2.4 + o.wob, k = 1 - P.puff, r = 3 + k * 5; dot(g, at(C, Math.cos(a) * r, 3 * h + k * (2.5 + i % 3) + (i % 2), Math.sin(a) * r * 0.8), 5, P.puff > 0.5 ? 4 : 2); }
  if (front(o)) for (const s of [-1, 1]) dot(g, at(T, 4, 0.5, s * 1.3), 4, P.dead > 0.5 ? 0 : 3);
  legs(g, T, P.feet, SPORE, nearOf(o));
  return { mouth: at(C, 0, 4 * h, 0), head: at(C, 0, 4.5 * h, 0) };
}
function sporePose(o) {
  const S = base(o, SPORE, 2.8), t = o.t, e = o.e, wd = S.wd, l = S.l, br = Math.sin(t * 2.4 + o.wob);
  // püskürtmeye yakın şapka titreyerek çöker; püskürünce kalkar ve sporlar yükselir
  const pre = S.dead || !e.d.puff || !(e.puffT < 0.7) ? 0 : ss(0.7, 0, e.puffT), sq = Math.max(wd, pre * (1 - l));
  let capW = 1 + br * 0.02 + 0.12 * sq - 0.1 * l, capH = 1 - br * 0.03 - 0.3 * sq + 0.4 * l, lift = Math.sin(o.ph * TAU * 2) * 0.25 * S.w - 0.4 * sq + 1.1 * l, tip = Math.sin(o.ph * TAU + 1) * 4 * S.w;
  S.py -= 0.6 * sq - 0.3 * l; if (sq > 0.01) lift += Math.sin(t * 40) * 0.15 * sq; if (l > 0.001) S.rate = 45;
  if (S.dead) { const k = ss(0, 0.5, o.dying); capW *= 1 - 0.2 * k; capH *= 1 - 0.45 * k; }
  return done(S, SPORE, 4.6, { capW, capH, lift, tip: tip * D, vent: Math.max(sq, l) > 0.3 ? 1 : 0, puff: l });
}

// ---------- Örücü ----------
const ORU = { rest: [[4.6, 5.6], [-0.4, 7.2], [-5, 5.4]], hip: [1.2, 0, -1.2], y: -0.4, z: 1.5, l1: 5, l2: 6.6, pz: 0.5, m: 2, knee: true, up: 6.5, step: 2.1, lift: 1.8, sway: 3 };
const ORU_M = [, { ramp: ramp('#2a0a12', '#5e1a26', '#8a2e3a', '#b04858', '#d06070'), px: (u, v, i) => i + (v > 0.6 && fr(u * 0.75 + 0.1) < 0.22 ? 0.22 : v < 0.3 ? -0.15 : 0) },
  { ramp: ramp('#1c060c', '#3e101a', '#5e1a26', '#8a2e3a', '#c05868'), flat: true, soft: true },
  { ramp: ramp('#8a6a20', '#c8a040', '#ffe79a', '#fff0c0', '#ffffff'), flat: true, soft: true, glow: 1 },
  { ramp: ramp('#8a7880', '#b8a8b0', '#dcd0d6', '#f4ecf0', '#ffffff'), flat: true, soft: true, glow: 0.5 },
  { ramp: ramp('#0c0406', '#1c060c', '#2a0a12', '#3e101a', '#5e1a26'), flat: true, soft: true },
  { ramp: ramp('#5e1a26', '#8a2e3a', '#d06070', '#e88a98', '#ffc0c8') }];
function oruBuild(g, P, o) {
  const T = body(P), nr = nearOf(o), Ab = turn(sub(T, -1.2, 0.3, 0), P.swing, P.abP), H = turn(sub(T, 2.6, 0.5, 0), 0, P.headP);
  ell(g, sub(Ab, -3, 0.4, 0), 3.6, 2.9, 3.1, 1, 9, 5);
  dot(g, at(Ab, -6.6, 0.2, 0), 5, 4);
  ell(g, sub(T, 0.6, 0, 0), 2.5, 1.8, 2.1, 1, 8, 4);
  ball(g, H.p, 1.7, 1, 6);
  if (front(o)) for (const s of [-1, 1]) { dot(g, at(H, 1.3, 0.5, s * 1.1), 3, P.dead > 0.5 ? 0 : 2); }
  legs(g, T, P.feet, ORU, nr);
  // örme kolları: omuz, yukarı dirsek, kancalı uç; örerken uçlar arasında ipek gerilir
  const tips = [];
  for (const s of [-1, 1]) {
    const sh = at(T, 2.2, 0.6, s * 1.3), tp = reach(sh, P.arms[s > 0 ? 0 : 1], 10.6), el = ik(sh, tp, 5, 6, [-0.5, 1, s * 0.3]), c = s * nr > 0 ? 1 : 0;
    bone(g, sh, el, 0.75, 0.55, 6, 1, 4); bone(g, el, tp, 0.55, 0.3, 6, 1, 4, true); line(g, tp, [tp[0] + 0.6, tp[1] - 1.4, tp[2] - s * 0.5], 6, 1 + c);
    tips.push(tp);
  }
  if (P.weave > 0.4) { line(g, tips[0], tips[1], 4, 3); const m = [(tips[0][0] + tips[1][0]) / 2 + 1.5, (tips[0][1] + tips[1][1]) / 2 - 2.5, 0]; line(g, tips[0], m, 4, 2); line(g, tips[1], m, 4, 2); dot(g, m, 4, 4); }
  return { mouth: at(H, 1.8, -0.4, 0), head: at(T, 0, 3.5, 0), silk: tips[0] };
}
function oruPose(o) {
  const S = base(o, ORU, 5.2), t = o.t, e = o.e, wd = S.wd, l = S.l, wv = S.dead ? 0 : e.sealT > 0 ? ss(0.9, 0.7, e.sealT) : 0;
  const arms = [1, -1].map((s, i) => [7 + Math.sin(t * 2.2 + i * 2 + o.wob) * 0.4, 3.4 + Math.sin(t * 3.1 + i * 3 + o.wob) * 0.5 + Math.sin(o.ph * TAU + i * Math.PI) * 0.8 * S.w, s * 2.2]);
  let abP = 10, headP = 0, swing = Math.sin(o.ph * TAU + 1) * 0.12 * S.w;
  // örme: gövde kalkar, kollar yukarıda sırayla inip kalkar
  if (wv > 0.001) { S.pitch += 14 * wv; abP -= 8 * wv; arms.forEach((a, i) => { const s = i ? -1 : 1, q = t * 22 + i * Math.PI; a[0] = lerp(a[0], 6 + Math.cos(q) * 1.2, wv); a[1] = lerp(a[1], 9 + Math.sin(q) * 2, wv); a[2] = lerp(a[2], s * (1.6 + Math.cos(q) * 0.8), wv); }); S.rate = 45; }
  // saldırı: kollar geriye kalkar, sonra öne saplanır
  if (wd > 0.001) { S.pitch += 18 * wd; S.px -= 1 * wd; abP -= 10 * wd; arms.forEach((a, i) => { a[0] = lerp(a[0], 2.5, wd); a[1] = lerp(a[1], 11.5, wd); a[2] = lerp(a[2], (i ? -1 : 1) * 3.4, wd); }); }
  if (l > 0.001) { S.px += 2.2 * l; S.pitch -= 12 * l; headP = -10 * l; arms.forEach((a, i) => { a[0] = lerp(a[0], 10, l); a[1] = lerp(a[1], 0.8, l); a[2] = lerp(a[2], (i ? -1 : 1) * 1.4, l); }); S.rate = 45; }
  if (o.hurt > 0 && !S.dead) { const h = o.hurt * o.hurt; for (const a of arms) { a[0] = lerp(a[0], 4, h); a[1] = lerp(a[1], 4.5, h); } }
  const P = done(S, ORU, 2.7, { abP: abP * D, headP: headP * D, swing, weave: wv });
  if (S.dead) { const k = ss(0, 0.4, o.dying); arms.forEach((a, i) => { a[0] = lerp(a[0], 3.4, k); a[1] = lerp(a[1], P.py + 3.2 + Math.sin(o.dying * 40 + i * 2) * (1 - ss(0.4, 0.85, o.dying)), k); a[2] = lerp(a[2], (i ? -1 : 1) * 1.2, k); }); }
  for (const a of arms) a[0] += S.px;
  P.arms = arms;
  return P;
}

// ---------- Yumurtacı ----------
const YUM = { rest: [[4.2, 4.6], [0.8, 5.6], [-2.8, 5.2]], hip: [3, 1, -1.2], y: -1.6, z: 2.4, l1: 3, l2: 3.6, pz: 0.9, m: 3, up: 5.6, step: 1.5, lift: 1.2, sway: 5 };
const YUM_M = [, { ramp: ramp('#0e1206', '#222c12', '#34401e', '#566e34', '#7e9a50'), px: (u, v, i) => { const n = noise(Math.floor(u * 0.9), Math.floor(v * 14)); return i + (n > 0.8 ? -0.25 : n < 0.08 ? 0.12 : 0) - (v > 0.6 && v < 0.9 ? 0.12 : 0); } },
  { ramp: ramp('#5a7030', '#8aa850', '#c0dc88', '#e4f8b4', '#ffffff'), glow: 0.6 },
  { ramp: ramp('#0c1006', '#1e2810', '#34401e', '#4e6030', '#6e8644'), flat: true, soft: true }, EYE,
  { ramp: ramp('#0a0e04', '#1a220e', '#2a3418', '#40522a', '#5e7640') }];
const EGGS = [[-0.15, 1, 0, 1.7], [-0.75, 0.66, 0.4, 1.6], [-0.75, 0.66, -0.4, 1.6], [0.5, 0.8, 0.45, 1.4], [0.5, 0.8, -0.45, 1.4], [-0.2, 0.45, 0.92, 1.6], [-0.2, 0.45, -0.92, 1.6]];
function yumBuild(g, P, o) {
  const T = body(P), H = turn(sub(T, 3.7, 0.3, 0), 0, P.headP), sw = P.swell, C = sub(T, -2.4, 0.9, 0), R = [4.5 * sw, 4.1 * sw, 4.5 * sw];
  skin(g, [{ p: at(T, -6.9, 0, 0), u: T.u, rx: 0.8, ry: 0.8 }, { p: at(T, -5.3, 0.6, 0), u: T.u, rx: 3.3 * sw, ry: 3 * sw }, { p: C.p, u: T.u, rx: R[2], ry: R[1] }, { p: at(T, 0.8, 0.4, 0), u: T.u, rx: 3.5, ry: 3 },
    { p: at(T, 2.5, 0, 0), u: T.u, rx: 1.9, ry: 1.6 }], 10, 1, { sub: 2 });
  ball(g, at(H, 0.7, 0.2, 0), 2.5, 5, 6);
  // yumurta kümesi: karnın sırtına ve yanlarına gömülü, nabız gibi atar
  EGGS.forEach(([x, y, z, r], i) => ball(g, at(C, x * R[0] * 0.9, y * R[1] * 0.9, z * R[2] * 0.9), r * (1 + P.egg * 0.14 * (i % 2 ? 1 : -1) + P.lay * 0.2), 2, 5));
  spike(g, at(T, -6.7, 0, 0), at(T, -8.2 - P.lay * 1.2, -0.6, 0), 0.6, 2, 4);
  for (const s of [-1, 1]) {
    if (front(o)) dot(g, at(H, 2.2, 1, s * 1.6), 4, P.dead > 0.5 ? 0 : 3);
    line(g, at(H, 2.6, -0.9, s * 0.8), at(H, 4, -1.6 + P.lay * 0.5, s * (1.4 - P.bite)), 3, 3);
  }
  legs(g, T, P.feet, YUM, nearOf(o));
  return { mouth: at(H, 3, -0.6, 0), head: at(C, 0, 5, 0), egg: at(T, -8.2, -0.6, 0) };
}
function yumPose(o) {
  const S = base(o, YUM, 3.2), t = o.t, wd = S.wd, l = S.l, br = Math.sin(t * 2 + o.wob);
  let swell = 1 + br * 0.025, headP = Math.sin(t * 1.3 + o.wob) * 4, lay = 0, bite = 0;
  S.pitch = 3; S.py += Math.sin(o.ph * TAU * 2 + 1) * 0.15 * S.w;
  if (wd > 0.001) { S.px -= 0.9 * wd; S.pitch += 8 * wd; headP += 14 * wd; }
  // hamle / yumurtlama: karın sıkışır, yumurtalar kabarır, kıç yere bastırır
  if (l > 0.001) { S.px += 1.6 * l; S.pitch += 7 * l; headP -= 12 * l; swell -= 0.1 * l; lay = l; bite = l; S.rate = 45; }
  if (S.dead) swell *= 1 - 0.12 * ss(0, 0.6, o.dying);
  return done(S, YUM, 4.6, { swell, headP: headP * D, lay, bite, egg: Math.sin(t * 4 + o.wob) });
}

export const DEFS = {
  spitter: def({ w: 38, h: 32, ox: 19, oy: 23, mats: SPIT_M, foot: 5, top: 8, shadow: 6, body: 7 }, SPIT, spitPose, spitBuild),
  sporeling: def({ w: 42, h: 40, ox: 21, oy: 29, mats: SPORE_M, foot: 6, top: 10, shadow: 7, body: 9 }, SPORE, sporePose, sporeBuild),
  orucu: def({ w: 56, h: 50, ox: 28, oy: 37, mats: ORU_M, foot: 6, top: 11, shadow: 8, body: 10, turnRate: 10 }, ORU, oruPose, oruBuild),
  yumurtaci: def({ w: 50, h: 40, ox: 25, oy: 29, mats: YUM_M, foot: 7, top: 11, shadow: 9, body: 10, turnRate: 7 }, YUM, yumPose, yumBuild),
};
