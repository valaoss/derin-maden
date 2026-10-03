// Muhafızlar ve tuhaflar: Altın Muhafız (sorguçlu miğfer, topuz, kalkan), Kalkanlı Muhafız (önünde boy kalkanı, kısa kılıç),
// Dev Parçası (yosunlu kaya yumrusu, göğsünde atan nabız taşı), Diriltici (kehribar kafatası maskeli süzülen şaman; diriltirken kollarını kaldırır),
// Kör Avcı (gözsüz, dev kulaklı, dişlek avcı; kulakları sesi arar), Taklitçi (dişli, dilli demir sandık; zıplayarak gelir).
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mad, mix, norm, at, dir, turn, shift, frame, ell, ball, bone, tube, prism, quad, spike, skin, ik, reach } from '../boss/rig.js';
import { stride } from '../boss/biped.js';
import { mobView, ramp, fr } from './common.js';

const RED = ramp('#5a1008', '#b0281a', '#ff5a3a', '#ff9a6a', '#ffe0c0'), GLOW = r => ({ ramp: r, flat: true, soft: true, glow: 1 });
const TOOTH = { ramp: ramp('#6a6a60', '#a0a090', '#d0d0c0', '#f0f0e0', '#ffffff'), flat: true, soft: true };
const mk = (...rs) => { const m = []; rs.forEach((r, i) => { m[i + 1] = Array.isArray(r) ? { ramp: ramp(...r) } : r; }); return m; };
const base = o => ({ t: o.t, e: o.e, dead: o.dying > 0, w: o.dying > 0 ? 0 : o.walk, near: Math.cos(o.view) >= 0 ? 1 : -1, l: o.lunge, wd: ss(0, 1, o.wind) * (1 - o.lunge) });
const body = (P, x = P.px) => turn(frame([x, P.py, 0]), 0, P.pitch, P.roll);
const tone = k => k > 0.85 ? 4 : k > 0.6 ? 3 : k > 0.3 ? 2 : k > 0.08 ? 1 : 0;
// çerçeveye oturan kutu: üst ve alt yüz ayrı malzeme alabilir (sandığın ağız içi)
function box(g, F, x0, x1, y0, y1, z0, z1, m, mt = m, mb = m) {
  const c = at(F, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), p = (x, y, z) => at(F, x, y, z);
  const a = p(x0, y0, z0), b = p(x1, y0, z0), cc = p(x1, y0, z1), d = p(x0, y0, z1), e = p(x0, y1, z0), f = p(x1, y1, z0), h = p(x1, y1, z1), i = p(x0, y1, z1);
  quad(g, a, b, cc, d, mb, c); quad(g, e, f, h, i, mt, c); quad(g, a, b, f, e, m, c); quad(g, d, cc, h, i, m, c); quad(g, a, d, i, e, m, c); quad(g, b, cc, h, f, m, c);
}
const def = o => ({ scale: 1, tilt: 0.3, crease: 1.7, turnRate: 6, ...o, view: v => mobView(v, o.bias) });

// ---------- Altın Muhafız, Kalkanlı Muhafız ----------
const G = { ARM: 1, DARK: 2, TRIM: 3, PLUME: 4, EYE: 5 }, GSTEP = 2.2;
const guardBuild = K => (g, P, o) => {
  const A = {}, b = K.bulk, T = body(P), gl = tone(P.lit);
  for (const s of [-1, 1]) {
    const i = s > 0 ? 0 : 1, hip = at(T, 0, -0.4, s * 1.7 * b), ft = reach(hip, mad(P.feet[i], [0, 1, 0], 1), 5.4), kn = ik(hip, ft, 2.8, 2.8, [1, 0.2, s * 0.25]);
    bone(g, hip, kn, 1.4 * b, 1.15 * b, G.DARK, 1.1, 5); ball(g, kn, 1.2 * b, G.TRIM, 5); bone(g, kn, ft, 1.25 * b, 1.05 * b, G.ARM, 1.15, 5);
    prism(g, mad(ft, [-1, -0.2, 0], 1), mad(ft, [1.9, -0.4, 0], 1), 1.5 * b, 1.2 * b, G.ARM, 4, 0.78, 0.7, [0, 1, 0]);
  }
  // etek zırhı, göğüs zırhı, kemer
  prism(g, at(T, 0, -1.3, 0), at(T, 0, 1.3, 0), 3 * b, 2.4 * b, G.DARK, 6, 0.5, 0.8, T.f);
  prism(g, at(T, 0, 0.9, 0), at(T, 0.4, 5, 0), 2.5 * b, 3.5 * b, G.ARM, 6, 0.5, 0.82, T.f);
  line(g, at(T, 2.3 * b, 1.2, -1.6), at(T, 2.3 * b, 1.2, 1.6), G.TRIM, 4);
  // miğfer: vizör yarığında iki göz; sorguç ya da sivri tepe
  const H = turn(shift(T, 0.5, 6.8, 0), P.headY, P.headP);
  ball(g, H.p, 2.1 * b, G.ARM, 7);
  box(g, H, 1 * b, 2.15 * b, -0.5, 0.6, -1.5 * b, 1.5 * b, G.DARK);
  for (const s of [-1, 1]) { const q = at(H, 2.3 * b, 0.1, s * 0.75); if (gl) dot(g, q, G.EYE, Math.min(gl, 2)); if (s > 0 === Math.cos(o.view) >= 0) A.eye = q; }
  if (K.plume) tube(g, [at(H, 1.3, 1.9, 0), at(H, 0.1, 3.5, 0), at(H, -1.8, 3.4, 0), at(H, -3.2, 1.8 + P.sway, 0)], [0.5, 1.05, 0.95, 0.3], 5, G.PLUME);
  else spike(g, at(H, 0, 1.6, 0), at(H, -0.4, 4.4, 0), 0.8, G.TRIM);
  // boy kalkanı: gövdenin önünde; sol el arkasından tutar
  const S = K.shield && turn(shift(T, P.sh[0], P.sh[1], P.sh[2]), 0, P.shP);
  if (S) {
    box(g, S, -0.35, 0.3, -3.9, 3.9, -3, 3, G.TRIM); box(g, S, 0.2, 0.6, -3, 3, -2.1, 2.1, G.ARM);
    if (gl) for (const k of [0, 1]) dot(g, at(S, 0.8, 0.8, 0), G.EYE, Math.min(gl, 2), 0, k);
  }
  const wv = dir(T, Math.cos(P.wa), Math.sin(P.wa), 0), wn = dir(T, -Math.sin(P.wa), Math.cos(P.wa), 0);
  for (const s of [-1, 1]) {
    const i = s > 0 ? 0 : 1, sh = at(T, 0.3, 4.7, s * 3.7 * b), hand = reach(sh, S && s < 0 ? at(S, -0.6, 0.4, -0.6) : P.hands[i], 5.3), el = ik(sh, hand, 2.7, 2.7, [-0.8, -0.4, s * 0.8]);
    ball(g, sh, 1.75 * b, K.plume ? G.TRIM : G.ARM, 5); bone(g, sh, el, 1.15 * b, b, G.DARK, 1.1, 5); bone(g, el, hand, 1.05 * b, b, G.ARM, 1.15, 5); ball(g, hand, 1.05 * b, G.DARK, 5);
    if (s < 0) { if (!S) ell(g, frame(mad(hand, T.r, -1.1), T.f, T.u, T.r), 2.5, 2.5, 0.55, G.TRIM, 7, 3); continue; }
    if (K.shield) { prism(g, hand, mad(hand, wv, 5.8), 0.8, 0.2, G.TRIM, 4, 0, 0.3, T.r); line(g, mad(hand, wn, -1), mad(hand, wn, 1), G.DARK, 2); continue; }
    // topuz: sap, dikenli baş
    const tip = mad(hand, wv, 4.8);
    bone(g, mad(hand, wv, -1.2), tip, 0.45, 0.45, G.DARK, 1, 4); ball(g, tip, 1.6, G.TRIM, 5);
    for (const v of [wv, wn, [-wn[0], -wn[1], -wn[2]], T.r, [-T.r[0], -T.r[1], -T.r[2]]]) line(g, tip, mad(tip, v, 2.5), G.TRIM, 4);
  }
  A.head = at(H, 0, 3.6, 0); A.mouth = at(H, 2.2, -0.6, 0);
  return A;
};
const guardPose = K => o => {
  const { t, e, dead, w, near } = base(o), br = Math.sin(t * 2 + o.wob), c = fr(e.anim * 0.3), dig = e.st === 'dig' && !dead;
  let px = 0, py = 5.2 + br * 0.1, pitch = -3, roll = 0, headP = 0, headY = Math.sin(t * 0.9 + o.wob) * 0.18, wa = K.wa, lit = 1, shP = 0, rate = 20;
  const feet = [[0.2, 0, 1.9], [0.2, 0, -1.9]], hands = [[K.shield ? 2.6 : 3.6, (K.shield ? 6.3 : 8) + br * 0.1, 4.7], [1.6, 6 - br * 0.1, -4.7]], sh = [3.5, 2, -0.4];
  if (w > 0.01) {
    for (const i of [0, 1]) { const [dx, dy] = stride(o.ph + i * 0.5, GSTEP, 1.3); feet[i][0] += dx * w; feet[i][1] += dy * w; hands[1 - i][0] += dx * 0.5 * w; }
    const sw = Math.sin(o.ph * TAU), up = Math.abs(Math.cos(o.ph * TAU)); py += (up * 0.4 - 0.2) * w; roll += sw * 3 * w; pitch -= 3 * w; sh[1] += up * 0.3 * w; headY *= 1 - w;
  }
  // vuruş (kazarken aynı hareket sürer): topuz baş üstünden iner / kalkan itilir, kılıç saplanır
  const l = dig ? bump(0.5, 0.6, 0.7, 1, c) : o.lunge, wd = dig ? bump(0, 0.3, 0.5, 0.6, c) : ss(0, 1, o.wind) * (1 - l);
  for (const [k, q] of [[wd, K.wind], [l, K.hit]]) if (k > 0.001) {
    hands[0] = hands[0].map((v, i) => lerp(v, q.hand[i], k)); wa = lerp(wa, q.wa, k); pitch += q.pitch * k; px += q.px * k; sh[0] += q.sh * k; rate = 36;
  }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; pitch += 8 * h; px -= 0.8 * h; headP += 0.2 * h; roll += near * 4 * h; sh[0] -= 0.5 * h; }
  if (dead) {
    // dizlerinin üstüne çöker, yüzüstü devrilir; gözleri söner
    const d = o.dying, k1 = ss(0, 0.3, d), k2 = ss(0.25, 0.7, d);
    py = lerp(py, 3.2, k1) - 1 * k2; pitch = lerp(pitch, -84, k2) + 6 * k1 * (1 - k2); px += 3.4 * k2; headP = 0.25 * k1; lit = 1 - ss(0.1, 0.5, d); roll += near * 6 * k2; wa = lerp(wa, 264, k2); sh[1] -= 0.6 * k1; rate = 50;
    for (const i of [0, 1]) { const s = i ? -1 : 1; hands[i] = [lerp(hands[i][0], 6.5, k2), lerp(hands[i][1], 1, k1), s * lerp(4.7, 5.6, k2)]; feet[i][0] -= 2 * k2; }
  }
  for (const f of feet) f[0] += px; for (const h of hands) h[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, headP, headY, wa: wa * D, lit, sh, shP: shP * D, sway: Math.sin(t * 3 + o.wob) * 0.4 - w * 0.5, feet, hands, zoom: e.scale || 1 };
};
const guard = (K, o) => def({ ...o, bias: 0.6, pose: guardPose(K), build: guardBuild(K) });
const GILDED = guard({ bulk: 1.12, plume: true, wa: 70, wind: { hand: [0.4, 13.5, 3.6], wa: 112, pitch: 9, px: -0.3, sh: 0 }, hit: { hand: [5.8, 5, 2.6], wa: -22, pitch: -17, px: 1.5, sh: 0 } },
  { w: 64, h: 64, ox: 32, oy: 48, scale: 0.92, stride: GSTEP * 2 / 0.62 * 0.92, foot: 9, top: 17, shadow: 9, body: 18, outline: [26, 14, 4],
    mats: mk(['#241404', '#4a3010', '#8a6418', '#b88a2a', '#e0b448'], ['#120a04', '#24160a', '#3e280e', '#5a3c14', '#7a561c'], ['#4a3010', '#8a6418', '#d0a030', '#ffd870', '#fff4b8'], ['#3a0808', '#7a1414', '#c02a2a', '#e85a4a', '#ff9a80'], GLOW(RED)) });
const KALKANLI = guard({ bulk: 1, shield: true, wa: 40, wind: { hand: [-1.6, 8, 4.4], wa: 6, pitch: 4, px: -0.4, sh: -0.7 }, hit: { hand: [5.6, 7.6, 3.2], wa: 0, pitch: -9, px: 1.4, sh: 1.7 } },
  { w: 56, h: 56, ox: 28, oy: 42, scale: 0.86, stride: GSTEP * 2 / 0.62 * 0.86, foot: 8, top: 15, shadow: 8, body: 16, outline: [8, 8, 16],
    mats: mk(['#14151e', '#2e3040', '#50546a', '#8a90aa', '#c0c6dc'], ['#0a0a10', '#1a1b26', '#2e3040', '#444860', '#5e6480'], ['#50546a', '#8a90aa', '#c8d0ff', '#e0e8ff', '#ffffff'], ['#14183a', '#2a3070', '#4a56b0', '#7a88e0', '#b0c0ff'], GLOW(RED)) });

// ---------- Dev Parçası ----------
const R = { ROCK: 1, DARK: 2, MOSS: 3, GLOW: 4 }, TSTEP = 2.6;
function titanBuild(g, P, o) {
  const A = {}, T = body(P), gl = tone(P.glow), sx = y => 3.9 + (y + 2.4) * 0.24;
  // gövde: tek kaya yumrusu, sırtta kambur, tepede yosun
  prism(g, at(T, -0.4, -2.4, 0), at(T, 0.5, 4.4, 0), 4.4, 5.3, R.DARK, 6, 0.5, 0.85, T.f);
  prism(g, at(T, -1.4, 3.2, 0.5), at(T, -1.9, 6.6, 0.2), 4.3, 2.3, R.ROCK, 5, 0.9, 0.9);
  prism(g, at(T, -1.7, 6.1, 0.3), at(T, -2, 7.4, 0.1), 2.5, 1.2, R.MOSS, 5, 0.4, 0.9);
  prism(g, at(T, 2, 4, -2.4), at(T, 2.2, 5.5, -2.6), 1.9, 1, R.MOSS, 4, 0.7);
  // çatlak göz, nabız taşı ve ondan yayılan damarlar
  line(g, at(T, sx(3.5), 3.5, -1.7), at(T, sx(3.7), 3.7, 1.5), R.GLOW, gl);
  const hc = at(T, 3.3, 0.9, 0); ball(g, hc, 1.35 + P.beat * 0.35, R.GLOW, 6);
  for (const [y, z] of [[1.9, 1.7], [1.5, -2], [-2.2, 1.6], [-1.9, -1.8], [0.2, 3.2], [-0.2, -3.3]]) line(g, at(T, sx(0.9 + y * 0.5), 0.9 + y * 0.5, z * 0.5), at(T, sx(0.9 + y) - Math.abs(z) * 0.22, 0.9 + y, z * 1.25), R.GLOW, Math.max(1, gl - 1));
  for (const s of [-1, 1]) {
    const i = s > 0 ? 0 : 1, sh = at(T, 0.4, 3, s * 5.5), fist = reach(sh, P.hands[i], 7.4), el = ik(sh, fist, 3.8, 3.8, [-0.8, 0.25, s * 0.9]);
    ball(g, sh, 2.6, R.ROCK, 5); prism(g, sh, el, 1.8, 1.6, R.DARK, 5, 0.4); prism(g, el, fist, 1.8, 2.4, R.ROCK, 5, 0.9);
    prism(g, mad(fist, [0, 0.8, 0], 1), mad(fist, [0.4, -1.7, 0], 1), 2.7, 2.2, R.ROCK, 5, 0.2 + s);
    const hip = at(T, -0.2, -1.8, s * 2.5), ft = reach(hip, mad(P.feet[i], [0, 1.1, 0], 1), 4.7), kn = ik(hip, ft, 2.4, 2.4, [1, 0.2, s * 0.3]);
    prism(g, hip, kn, 2.2, 1.9, R.DARK, 5, 0.3); prism(g, kn, ft, 1.9, 2.1, R.ROCK, 5, 0.7);
    prism(g, mad(ft, [-1.3, -0.3, 0], 1), mad(ft, [2, -0.5, 0], 1), 2, 1.6, R.ROCK, 4, 0.78, 0.7, [0, 1, 0]);
  }
  A.head = at(T, -1, 8, 0); A.mouth = hc; A.eye = at(T, sx(3.6), 3.6, 0);
  return A;
}
function titanPose(o) {
  const { t, e, dead, w, near, l } = base(o), br = Math.sin(t * 1.8 + o.wob), hb = fr(t * 0.9 + o.wob), beat = bump(0, 0.06, 0.1, 0.3, hb) + 0.7 * bump(0.26, 0.32, 0.36, 0.6, hb);
  let px = 0, py = 5.6 + br * 0.12, pitch = -6, roll = 0, glow = 0.4 + 0.6 * beat, rate = 18;
  const feet = [[0.3, 0, 2.8], [0.3, 0, -2.8]], hands = [[3.6, 2.4 + br * 0.15, 6.6], [3.6, 2.4 - br * 0.15, -6.6]], both = (x, y, z, k) => { for (const i of [0, 1]) hands[i] = [lerp(hands[i][0], x, k), lerp(hands[i][1], y, k), (i ? -1 : 1) * lerp(6.6, z, k)]; };
  if (w > 0.01) {
    for (const i of [0, 1]) { const [dx, dy] = stride(o.ph + i * 0.5, TSTEP, 1.5); feet[i][0] += dx * w; feet[i][1] += dy * w; hands[1 - i][0] += dx * 0.8 * w; }
    py += (Math.abs(Math.cos(o.ph * TAU)) * 0.5 - 0.25) * w; roll += Math.sin(o.ph * TAU) * 5 * w; pitch -= 3 * w;
  }
  if (e.st === 'dig' && !dead) { const c = Math.sin(e.anim * 2), k = Math.abs(c), i = c > 0 ? 0 : 1; hands[i] = [lerp(hands[i][0], 8, k), lerp(hands[i][1], 5.6, k), (i ? -1 : 1) * lerp(6.6, 3.4, k)]; pitch -= 5 * k; px += 0.7 * k; rate = 30; }
  else {
    // sarsıntı ve darbe: iki yumruk havaya kalkar, yere iner
    const wd = Math.max(ss(0, 1, o.wind), e.quakeT > 0 ? ss(0, 0.45, 0.6 - e.quakeT) : 0) * (1 - l);
    if (wd > 0.001) { pitch += 15 * wd; py += 0.4 * wd; glow = Math.max(glow, wd); both(1.2, 15.5, 4, wd); rate = 30; }
    if (l > 0.001) { pitch -= 20 * l; px += 1.5 * l; py -= 0.8 * l; glow = 1; both(8.6, 1.2, 3, l); rate = 44; }
  }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; pitch += 7 * h; px -= 0.8 * h; roll += near * 4 * h; glow = 1; }
  if (dead) {
    // nabız durur, yumru öne yıkılır
    const d = o.dying, k1 = ss(0, 0.3, d), k2 = ss(0.25, 0.7, d);
    py = lerp(py, 3.6, k1) - 0.4 * k2; pitch = lerp(pitch, -80, k2) + 6 * k1 * (1 - k2); px += 3 * k2; glow = 1 - ss(0.05, 0.45, d); roll += near * 6 * k2; rate = 50; both(8.8, 1.2, 8, k2);
    for (const f of feet) f[0] -= 2 * k2;
  }
  for (const f of feet) f[0] += px; for (const h of hands) h[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, glow, beat: dead ? 0 : beat, feet, hands, zoom: e.scale || 1 };
}
const TITANLING = def({ w: 68, h: 62, ox: 34, oy: 46, scale: 0.92, bias: 0.62, turnRate: 5, crease: 1.8, stride: TSTEP * 2 / 0.62 * 0.92, foot: 9, top: 15, shadow: 10, body: 17, outline: [8, 12, 8], pose: titanPose, build: titanBuild,
  mats: mk(['#0e1410', '#1e2a22', '#4a6250', '#7a9a78', '#a8c4a0'], ['#0a0e0c', '#16201a', '#2e4034', '#4a6250', '#64806a'], ['#2a3a10', '#4e6a1e', '#7e9e34', '#a8c850', '#d0e880'], GLOW(ramp('#4a0a0a', '#a01a1a', '#ff3a3a', '#ff7a6a', '#ffd0c0'))) });

// ---------- Diriltici ----------
const S = { ROBE: 1, MASK: 2, DARK: 3, EYE: 4, ORB: 5 };
function dirBuild(g, P, o) {
  const A = {}, T = body(P, 0), H = turn(shift(T, 0.5, 3.6, 0), P.headY, P.headP), f = P.fold, sw = P.sway, lat = Math.sin(o.t * 2.2 + o.wob) * 0.5;
  // cüppe: omuzdan aşağı daralır, ucu geride dalgalanır
  skin(g, [{ p: at(T, 0, 2.5, 0), u: T.f, rx: 1.2, ry: 1.2 }, { p: at(T, 0, 1.1, 0), u: T.f, rx: 2.7 * f, ry: 2 * f }, { p: at(T, -0.3, -1.4, 0), u: T.f, rx: 2.3 * f, ry: 1.9 * f },
    { p: at(T, -0.9 - sw, -3.9 * f, lat), u: T.f, rx: 1.4 * f, ry: 1.2 * f }, { p: at(T, -2 - sw * 2.2, -6.2 * f, -lat), u: T.f, rx: 0.3, ry: 0.3 }], 7, S.ROBE, { sub: 2 });
  // kukuleta ve kehribar kafatası maske: göz çukurlarında ışık
  ball(g, at(H, -0.7, 0.4, 0), 2.7, S.ROBE, 6);
  ell(g, shift(H, 0.7, -0.1, 0), 2, 2.4, 2.1, S.MASK, 7, 4);
  dot(g, at(H, 2.7, -0.5, 0), S.DARK, 0); line(g, at(H, 2.4, -1.6, -0.9), at(H, 2.4, -1.6, 0.9), S.DARK, 0);
  for (const s of [-1, 1]) {
    const q = at(H, 2.45, 0.6, s * 1);
    dot(g, q, S.DARK, 0); dot(g, q, S.DARK, 0, 0, 1); dot(g, q, S.DARK, 0, -1, 0); if (P.lit > 0.2) dot(g, q, S.EYE, P.lit > 0.75 ? 4 : 3);
    if (s > 0 === Math.cos(o.view) >= 0) A.eye = q;
    // kollar: geniş yen, avuçta kehribar ışığı
    const i = s > 0 ? 0 : 1, sh = at(T, 0, 1.4, s * 2.2 * f), h = P.hands[i], hd = reach(sh, at(T, h[0], h[1], h[2]), 6.3), el = ik(sh, hd, 3.2, 3.2, [-0.6, -0.5, s]);
    bone(g, sh, el, 1, 0.85, S.ROBE, 1, 5); bone(g, el, hd, 0.85, 1.2, S.ROBE, 1, 5);
    if (P.lit > 0.2) ball(g, mad(hd, norm([hd[0] - el[0], hd[1] - el[1], hd[2] - el[2]]), 0.9), 0.85 + P.cast * 0.7, S.ORB, 5);
  }
  // diriltirken çevresinde kehribar kıvılcımları döner
  if (P.cast > 0.3) for (let k = 0; k < 4; k++) { const a = o.t * 7 + k * TAU / 4; dot(g, at(T, Math.cos(a) * 4.6, 3.5 + Math.sin(a * 1.3 + k) * 2, Math.sin(a) * 4.6), S.ORB, 4); }
  A.head = at(H, 0, 3, 0); A.mouth = at(H, 2.2, -1.3, 0);
  return A;
}
function dirPose(o) {
  const { t, e, dead, w, near, l, wd } = base(o), br = Math.sin(t * 2.4 + o.wob), cast = dead ? 0 : Math.max(wd, clamp(o.flash / 0.3, 0, 1));
  let py = br * 0.7, pitch = -4 - 10 * w, roll = Math.sin(t * 1.3 + o.wob) * 3, headP = 0, headY = Math.sin(t * 0.7 + o.wob) * 0.25, sway = Math.sin(t * 3 + o.wob) * 0.4 + w * 1.3, lit = 0.6, fold = 1, rate = 18;
  const hands = [[2, -1 + br * 0.3, 3.6], [2, -1 - br * 0.3, -3.6]], both = (x, y, z, k) => { for (const i of [0, 1]) hands[i] = [lerp(hands[i][0], x, k), lerp(hands[i][1], y, k), (i ? -1 : 1) * lerp(3.2, z, k)]; };
  // ayin: kollar göğe, baş arkaya, ışık parlar
  if (cast > 0.001) { both(0.3, 7.4, 4.4, cast); headP += 0.4 * cast; pitch += 8 * cast; py += 0.6 * cast; lit = 0.6 + 0.4 * cast; rate = 30; }
  if (l > 0.001) { both(4.2, 1.6, 1.5, l); pitch -= 12 * l; lit = 1; rate = 40; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; pitch += 14 * h; headP += 0.3 * h; roll += near * 8 * h; sway -= h; }
  // ölüm: ışık söner, cüppe boşalıp düşer
  if (dead) { const d = o.dying, k = ss(0, 0.5, d); py = -5 * d * d; fold = 1 - 0.55 * k; pitch = lerp(pitch, -55, k); roll = near * 35 * k; headP = -0.5 * k; lit = 0; both(0.6, -2.6, 2.4, k); rate = 60; }
  return { rate, py, pitch: pitch * D, roll: roll * D, headP, headY, sway, lit, fold, cast, hands, zoom: e.scale || 1 };
}
const DIRILTICI = def({ w: 48, h: 52, ox: 24, oy: 26, scale: 0.95, tilt: 0.24, center: true, bias: 0.5, turnRate: 8, crease: 1.5, stride: 20, foot: 6, top: 8, shadow: 0, body: 9, outline: [16, 8, 2], pose: dirPose, build: dirBuild,
  mats: mk(['#0e0802', '#22120a', '#3e2008', '#5a3210', '#7a481c'], ['#4a2408', '#8a4a10', '#d08020', '#ffb040', '#ffd070'], { ramp: ramp('#1a0e04', '#2a1606', '#3e2008', '#3e2008', '#3e2008'), flat: true, soft: true },
    GLOW(ramp('#b06a1a', '#ffb040', '#ffd890', '#fff0c0', '#ffffff')), GLOW(ramp('#8a4a10', '#d08020', '#ffb040', '#ffd890', '#fff0c0'))) });

// ---------- Kör Avcı ----------
const K = { SKIN: 1, EAR: 2, MOUTH: 3, TOOTH: 4 }, KSTEP = 2.5;
function korBuild(g, P, o) {
  const A = {}, T = body(P), H = turn(shift(T, 3.3, 2.2, 0), P.headY, P.headP - P.pitch * 0.7), jw = P.jaw, J = turn(shift(H, -0.2, -0.5, 0), 0, -jw * 0.7);
  skin(g, [{ p: at(T, -2.9, -0.3, 0), u: T.u, rx: 0.9, ry: 1 }, { p: at(T, -1.5, 0, 0), u: T.u, rx: 1.5, ry: 1.6 }, { p: at(T, 0.8, 0.5, 0), u: T.u, rx: 2, ry: 2.1 }, { p: at(T, 2.3, 1.1, 0), u: T.u, rx: 1.2, ry: 1.2 }, { p: H.p, u: H.u, rx: 1, ry: 1 }], 7, K.SKIN, { sub: 2 });
  // baş: gözsüz düz kafa; geniş ağızda iki sıra diş, arası kızıl
  ell(g, shift(H, 0.9, 0.4, 0), 2.5, 1.6, 2.1, K.SKIN, 7, 4);
  ell(g, shift(J, 1.3, -0.7, 0), 2, 0.7, 1.8, K.SKIN, 6, 3);
  if (jw > 0.2) ell(g, shift(H, 1.6, -0.7 - jw * 0.5, 0), 1.6, 0.25 + jw * 0.7, 1.5, K.MOUTH, 6, 3);
  for (const z of [-1.8, -0.6, 0.6, 1.8]) { const x = 3.3 - z * z * 0.42; dot(g, at(H, x, -0.6, z), K.TOOTH, 4); if (jw > 0.3) dot(g, at(J, x - 0.2, -0.15, z * 0.92), K.TOOTH, 3); line(g, at(H, x - 0.1, -0.95, z - 0.4), at(H, x - 0.1, -0.95, z + 0.4), K.MOUTH, 2); }
  for (const s of [-1, 1]) {
    // dev kulaklar: ayrı ayrı döner, saldırırken geriye yatar
    const i = s > 0 ? 0 : 1, a = P.ears[i], fl = P.flat, b = at(H, -0.4, 1.2, s * 1.1), tip = mad(b, norm(dir(H, -0.25 - fl * 1.2 + a * 0.4, 1 - fl * 0.8, s * (0.5 + a * 0.3))), 5.8), ef = dir(H, 0.75, 0, s * 0.65);
    prism(g, b, tip, 1.8, 0.25, K.SKIN, 4, 0, 0.35, ef); prism(g, mad(mix(b, tip, 0.14), ef, 0.45), mad(mix(b, tip, 0.74), ef, 0.4), 1, 0.2, K.EAR, 4, 0, 0.2, ef);
    // uzun ince kollar, pençe; geriye bükük bacaklar
    const sh = at(T, 1.2, 0, s * 2), hd = reach(sh, P.hands[i], 6.2), el = ik(sh, hd, 3.2, 3.2, [-0.8, 0.4, s * 0.6]);
    bone(g, sh, el, 0.8, 0.6, K.SKIN, 1.1, 5); bone(g, el, hd, 0.6, 0.5, K.SKIN, 1, 4, true);
    line(g, hd, mad(hd, [1.1, -0.3, 0], 1), K.SKIN, 4);
    const hip = at(T, -2.3, -0.2, s * 1.4), f = P.feet[i], an = reach(hip, [f[0] - 0.9, f[1] + 1.3, f[2]], 5.6), kn = ik(hip, an, 2.9, 2.9, [1, 0.4, s * 0.5]);
    bone(g, hip, kn, 1.15, 0.8, K.SKIN, 1.15, 5); bone(g, kn, an, 0.75, 0.5, K.SKIN, 1, 4); bone(g, an, [an[0] + 2, an[1] - 1, an[2]], 0.55, 0.45, K.SKIN, 1, 4, true);
  }
  A.head = at(H, 0, 4, 0); A.mouth = at(H, 2.8, -0.8, 0); A.eye = at(H, 2.6, 0.5, 0);
  return A;
}
function korPose(o) {
  const { t, e, dead, w, near, l, wd } = base(o), br = Math.sin(t * 3 + o.wob), tw = fr(t * 0.6 + o.wob) < 0.14 ? Math.sin(t * 46) * 0.7 : 0;
  let px = 0, py = 4.4 + br * 0.12, pitch = 12, roll = 0, headP = -0.05, headY = Math.sin(t * 0.8 + o.wob) * 0.5 * (1 - w), jaw = 0.1, flat = 0.3 * w, rate = 24;
  const ears = [Math.sin(t * 1.9 + o.wob) + tw, Math.sin(t * 2.3 + o.wob + 2) - tw], feet = [[-1.4, 0, 1.8], [-1.4, 0, -1.8]], hands = [[2.6, 0.3, 2.6], [2.6, 0.3, -2.6]];
  if (w > 0.01) {
    for (const i of [0, 1]) { const [dx, dy] = stride(o.ph + i * 0.5, KSTEP, 1.7, 0.5); feet[i][0] += dx * w; feet[i][1] += dy * w; hands[1 - i][0] += dx * 0.9 * w; hands[1 - i][1] += dy * 0.8 * w; }
    py += (Math.abs(Math.cos(o.ph * TAU)) * 0.6 - 0.5) * w; pitch -= 16 * w; roll += Math.sin(o.ph * TAU) * 4 * w; headP += 0.14 * w;
  }
  // pusu: çöker, kulaklar yatar; sonra çenesi açık atılır
  if (wd > 0.001) { py -= 1.1 * wd; px -= 1 * wd; pitch += 6 * wd; flat = Math.max(flat, 0.9 * wd); jaw = 0.35 * wd; headY *= 1 - wd; rate = 34; }
  if (l > 0.001) { px += 3 * l; pitch -= 12 * l; headP += 0.2 * l; jaw = Math.max(jaw, l); flat = Math.max(flat, l); for (const i of [0, 1]) hands[i] = [lerp(hands[i][0], 6, l), lerp(hands[i][1], 2.6, l), (i ? -1 : 1) * lerp(2.6, 1.6, l)]; rate = 46; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; flat = 1; headP += 0.4 * h; px -= 1 * h; pitch += 8 * h; roll += near * 6 * h; jaw = 0.6; }
  if (dead) {
    // yana devrilir, kulakları düşer
    const d = o.dying, k = ss(0, 0.45, d);
    roll = near * 82 * k; py = lerp(py, 1.5, k) + Math.sin(k * Math.PI) * 1; pitch = lerp(pitch, 0, k); jaw = 0.6; flat = 0.7 * k; ears[0] = ears[1] = -1.5 * k; headP = -0.3 * k; headY = 0; rate = 60;
    for (const i of [0, 1]) { const s = i ? -1 : 1; feet[i] = [-3.6, lerp(0, 1.6 + s * near * 1.2, k), s * 1.8 - near * 3 * k]; hands[i] = [3.6, lerp(0.3, 1.6 + s * near * 1.2, k), s * 2.6 - near * 3.4 * k]; }
  }
  for (const f of feet) f[0] += px; for (const h of hands) h[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, headP, headY, jaw, flat, ears, feet, hands, zoom: e.scale || 1 };
}
const KORAVCI = def({ w: 52, h: 48, ox: 26, oy: 36, scale: 0.86, bias: 0.45, turnRate: 9, crease: 1.5, stride: KSTEP * 2 / 0.5 * 0.86, foot: 6, top: 12, shadow: 7, body: 11, outline: [8, 8, 12], pose: korPose, build: korBuild,
  mats: mk(['#14151a', '#22242c', '#545a6a', '#8a90a0', '#b8bcc8'], ['#3a2028', '#6a3a44', '#9a5a64', '#c08088', '#e0b0b0'], GLOW(ramp('#3a0808', '#8a1414', '#d02a2a', '#ff5a4a', '#ff9a80')), TOOTH) });

// ---------- Taklitçi ----------
const C = { IRON: 1, BAND: 2, LOCK: 3, MOUTH: 4, TONGUE: 5, TOOTH: 6, EYE: 7 }, HOP = 7, AIR = 0.45, CS = 0.92;
function mimBuild(g, P, o) {
  const A = {}, T = body(P), jw = P.jaw, L = turn(shift(T, -3.2, 3.4, 0), 0, jw), dr = P.droop, wag = P.wag;
  // gövde ve menteşeli kapak: demir kuşaklar, önde kilit; ağız içi kızıl
  box(g, T, -3.2, 3.2, 0, 3.4, -4.4, 4.4, C.IRON, C.MOUTH); box(g, L, 0, 6.4, 0, 1.6, -4.4, 4.4, C.IRON, C.IRON, C.MOUTH); box(g, L, 0.8, 5.6, 1.6, 2.5, -4.4, 4.4, C.IRON);
  for (const z of [-2.9, 2.9]) { box(g, T, -3.35, 3.35, -0.05, 3.3, z - 0.55, z + 0.55, C.BAND); box(g, L, -0.15, 6.55, 0.1, 1.7, z - 0.55, z + 0.55, C.BAND); box(g, L, 0.65, 5.75, 1.6, 2.6, z - 0.55, z + 0.55, C.BAND); }
  box(g, L, 6.4, 6.8, -0.5, 0.9, -0.7, 0.7, C.LOCK);
  for (const s of [-1, 1]) { const q = at(L, 6.5, 1, s * 1.9); if (P.lit > 0.5) { dot(g, q, C.EYE, 2); dot(g, q, C.EYE, 3, 0, -1); } if (s > 0 === Math.cos(o.view) >= 0) A.eye = q; }
  if (jw > 0.1) {
    // dişler: alt ve üst kenarda; dil dışarı sarkar, sallanır
    const n = Math.min(0.8, jw * 1.6);
    ell(g, shift(T, -0.7, 3.4, 0), 2.6, 0.4 + 2.6 * Math.min(1, jw), 3.9, C.MOUTH, 6, 4);
    for (const z of [-3.6, -1.2, 1.2, 3.6]) line(g, at(T, 3.25, 3.4, z), at(T, 3.25, 3.4 + n, z), C.TOOTH, 4);
    for (const z of [-2.4, 0, 2.4]) line(g, at(L, 6.45, 0, z), at(L, 6.45, -n, z), C.TOOTH, 4);
    if (jw > 0.22) tube(g, [at(T, -0.8, 3.7, 0), at(T, 2.2, 4.1 - dr * 0.5, wag * 0.3), at(T, 4.6, 3.7 - dr * 1.6, wag * 0.9), at(T, 6.3, 2.4 + P.lick * 2.4 - dr * 1.6, wag * 1.7)], [1.1, 1, 0.8, 0.5], 5, C.TONGUE);
  }
  A.head = at(L, 3.2, 3.4, 0); A.mouth = at(T, 3.4, 3.8, 0);
  return A;
}
function mimPose(o) {
  const { t, e, dead, w, near, l, wd } = base(o), hid = e.emergeT > 0, ch = fr(t * 0.55 + o.wob);
  // dururken ağzı aralık, ara ara şaklatır; sandık kılığından çıkarken (emergeT) kapalıdır
  let px = 0, py = 0, pitch = 0, roll = 0, jaw = hid ? 0 : 0.46 + 0.12 * Math.sin(t * 5 + o.wob) - 0.42 * bump(0.8, 0.86, 0.9, 0.98, ch), wag = Math.sin(t * 6 + o.wob), lick = 0.5 + 0.5 * Math.sin(t * 2.3 + o.wob), lit = hid ? 0 : 1, droop = 0, rate = 30;
  if (w > 0.01) {
    // zıplar: havada kapak açılır, konunca şak diye kapanır
    const q = fr(o.ph), j = clamp(q / AIR, 0, 1), air = q < AIR ? Math.sin(j * Math.PI) : 0, land = bump(AIR, AIR + 0.06, AIR + 0.12, AIR + 0.3, q);
    px += HOP * 0.7 / CS * ((q < AIR ? j : 1) - q - (0.5 - AIR / 2)) * w; py += air * 3.2 * w; pitch += ((q < AIR ? lerp(14, -12, j) : 0) + land * 5) * w; jaw = lerp(jaw, q < AIR ? 0.2 + 0.7 * air : 0.08 + 0.2 * (1 - land), w);
  }
  // ısırık: kapak ardına kadar açılır, atılıp kapanır
  if (wd > 0.001) { jaw = lerp(jaw, 1.15, wd); pitch += 12 * wd; px -= 0.8 * wd; lick = 1; rate = 40; }
  if (l > 0.001) { px += 3 * l; pitch -= 14 * l; py += 1.2 * Math.sin(l * Math.PI); jaw = lerp(jaw, 0.04, ss(0, 0.6, l)); rate = 60; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; jaw = Math.max(jaw, 0.7 * h); pitch += 10 * h; px -= 0.8 * h; roll += near * 6 * h; }
  // ölüm: kapak arkaya düşer, dil sarkar, gözler söner
  if (dead) { const d = o.dying, k = ss(0, 0.4, d); jaw = lerp(jaw, 1.5, k); pitch = 12 * Math.sin(k * Math.PI); py = Math.sin(k * Math.PI) * 1.5; droop = k; wag *= 1 - k; lit = 0; lick = 0; rate = 60; }
  return { rate, px, py, pitch: pitch * D, roll: roll * D, jaw, wag, lick, lit, droop, zoom: e.scale || 1 };
}
const MIMIC = def({ w: 48, h: 44, ox: 24, oy: 32, scale: CS, bias: 0.5, turnRate: 8, crease: 1.6, stride: HOP, foot: 6, top: 9, shadow: 7, body: 9, outline: [8, 8, 14], pose: mimPose, build: mimBuild,
  mats: mk(['#22263a', '#3a3e50', '#5a6278', '#8a92aa', '#b8c0d4'], ['#12141e', '#22263a', '#3a3e50', '#50566c', '#6a7088'], ['#50566c', '#7a8298', '#a7b0c4', '#c8d0e0', '#dfe6f0'],
    { ramp: ramp('#2a0610', '#5a101c', '#8c2030', '#c04050', '#ee7a88'), flat: true }, { ramp: ramp('#5a101c', '#a02a3a', '#e05a5a', '#ff8a80', '#ffc0b8') }, TOOTH, GLOW(RED)) });

export const DEFS = { gilded: GILDED, kalkanli: KALKANLI, titanling: TITANLING, diriltici: DIRILTICI, korAvci: KORAVCI, mimic: MIMIC };
