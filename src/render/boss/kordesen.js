// Kördeşen: madeni madencilerden önce kazan dev kör köstebek. Kadife gibi koyu kürk, pembe burun, kürek gibi ön pençeler;
// sırtında kürküne saplanmış altın cevheri, kristaller ve eski bir kazma. Hücumda matkap gibi dönerek kayayı yarar.
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mix, mad, norm, at, turn, move, shift, frame, ell, ball, bone, tube, skin, spike, prism, ik, reach, aimLocal, meleeK, hash } from './rig.js';

const M = { FUR: 1, PINK: 2, CLAW: 3, GOLD: 4, CRYSTAL: 5, EYE: 6, IRON: 7, WOOD: 8, MOUTH: 9 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
const MATS = [];
// kürk: boyuna tutamlar ışık bandının kenarını tarar
MATS[M.FUR] = { ramp: ramp('#0c0a10', '#1c1822', '#322c3a', '#4c4454', '#6c6276'), px: (u, v, i) => i + (fr(v * 13 + Math.sin(u * 0.9) * 0.5) < 0.5 ? 0.045 : -0.05) };
MATS[M.PINK] = { ramp: ramp('#5a2a34', '#8a4450', '#c06a74', '#e89aa0', '#ffc8c8') };
MATS[M.CLAW] = { ramp: ramp('#4a4438', '#847a66', '#beb294', '#e8dcc0', '#fffaf0') };
MATS[M.GOLD] = { ramp: ramp('#6a4a10', '#a8781a', '#d8a82a', '#ffd24a', '#fff0a0') };
MATS[M.CRYSTAL] = { ramp: ramp('#1a4a6a', '#2a7aa8', '#4ab0e0', '#8adcff', '#e0f8ff'), glow: 0.5 };
MATS[M.EYE] = { ramp: ramp('#806a50', '#c0a878', '#e8d8a8', '#fff4d0', '#ffffff'), flat: true, glow: 0.8 };
MATS[M.IRON] = { ramp: ramp('#0e0e12', '#22222a', '#3a3a46', '#585868', '#80808e') };
MATS[M.WOOD] = { ramp: ramp('#1c1208', '#3a2612', '#5a3c1e', '#7e582e', '#a67c48') };
MATS[M.MOUTH] = { ramp: ramp('#200810', '#3c0e18', '#641a24', '#8a2a32', '#b04444'), flat: true };

function build(g, P, o) {
  const A = {}, t = o.t, root = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), chest = move(turn(root, 0, P.arch), 14), neck = turn(shift(chest, 5, 0.5, 0), P.headY, P.headP, P.headR), head = move(neck, 5);
  const br = 1 + P.br;
  // gövde: kısa kuyruktan sivri buruna tek parça, tombul ve basık
  const tw = Math.sin(t * 6) * 1.2 * P.wag;
  skin(g, [
    { p: at(root, -11, 1.5, tw), u: root.u, rx: 0.8, ry: 0.8 }, { p: at(root, -7, 0.5, tw * 0.4), u: root.u, rx: 2.4, ry: 2.4 }, { p: at(root, -3.5, 0, 0), u: root.u, rx: 8.2, ry: 7.4 }, { p: at(root, 3, 0.6, 0), u: root.u, rx: 10.4 * br, ry: 9.2 * br },
    { p: at(chest, -3, 0.4, 0), u: chest.u, rx: 10.2 * br, ry: 9 * br }, { p: at(chest, 3, 0, 0), u: chest.u, rx: 8.4, ry: 7.6 }, { p: neck.p, u: neck.u, rx: 6.4, ry: 6 }, { p: head.p, u: neck.u, rx: 4.6, ry: 4.4 }, { p: at(head, 5, -0.6, 0), u: neck.u, rx: 2.4, ry: 2.2 },
  ], 10, M.FUR, { sub: 2 });
  // burun: pembe, kıpır kıpır; altında ağız ve iki kesici diş
  const nose = at(head, 7.6, -0.4 + Math.sin(t * 9) * 0.25 * P.sniff, Math.cos(t * 7) * 0.3 * P.sniff);
  ball(g, at(head, 6.2, -0.5, 0), 2.1, M.PINK, 6); ball(g, nose, 1.3, M.PINK, 5);
  if (P.jaw > 0.15) { ell(g, frame(at(head, 4.6, -2.4 - P.jaw, 0), neck.f, neck.u, neck.r), 2.2, 0.6 + P.jaw * 1.4, 1.8, M.MOUTH, 6, 3); }
  for (const s of [-1, 1]) {
    dot(g, at(head, 5.4, -2.1, s * 0.7), M.CLAW, 4);
    const e = at(head, 1.6, 2.2, s * 3.5); dot(g, e, M.EYE, P.eye > 0.4 ? 3 : 0); dot(g, e, M.FUR, 0, 0, -1);
    if (s > 0 === !(P.near < 0)) A.eye = e;
    for (let k = 0; k < 3; k++) line(g, at(head, 5.6, -0.6, s * 1.6), at(head, 6.6 + k * 0.6, 0.6 - k * 1.1 + Math.sin(t * 8 + k) * 0.3 * P.sniff, s * 5.2), M.CLAW, 2);
    ball(g, at(head, -1.2, 3.4, s * 3.2), 1.3, M.PINK, 5);
  }
  // sırt: kürke saplanmış cevher, kristal, paslı zırh plakası ve eski bir kazma
  const back = (x, z) => at(root, x, 8.2 * br, z);
  if (P.props > 0.5) for (let i = 0; i < 6; i++) { const p = back(1 + hash(i) * 12, (hash(i + 4) - 0.5) * 9); if (i % 2) spike(g, mad(p, root.u, -1.5), mad(mad(p, root.u, 4.5 + hash(i + 2) * 2.5), root.f, hash(i + 7) * 2 - 1), 1.8, M.CRYSTAL, 4); else ball(g, mad(p, root.u, 0.2), 2.1 + hash(i + 9) * 0.8, M.GOLD, 6); }
  prism(g, back(-3, -2), mad(back(-1, 3.5), root.u, 0.6), 3.4, 3, M.IRON, 4, 0.6, 0.35, root.u);
  if (P.props > 0.5) {
    const pk = back(8, -1), ph = mad(mad(pk, root.u, 8), root.f, -2.5);
    bone(g, mad(pk, root.u, -1), ph, 0.7, 0.7, M.WOOD, 1, 4); tube(g, [mad(mad(ph, root.f, -3.4), root.u, -1.2), ph, mad(mad(ph, root.f, 3.4), root.u, -1.4)], [0.3, 1, 0.3], 4, M.IRON);
  }
  // bacaklar: arkalar kısa; önler güçlü omuz ve kürek pençe
  const air = P.air;
  for (const s of [-1, 1]) {
    const i = s > 0 ? 0 : 1, hip = at(root, -1, -3, s * 6), ft = reach(hip, air > 0.01 ? mix(P.feet[i], at(root, -6, -4.5, s * 4.5), air) : P.feet[i], 9.6), kn = ik(hip, mad(ft, [0, 1, 0], 1.4), 5, 5, [1, 0.3, s * 0.4]);
    bone(g, hip, kn, 3.6, 2.8, M.FUR, 1.1, 6); bone(g, kn, mad(ft, [0, 1, 0], 1.4), 2.6, 2, M.FUR, 1, 6); ball(g, mad(ft, [0, 1, 0], 1.3), 2.2, M.PINK, 5);
    for (let k = -1; k <= 1; k++) line(g, [ft[0] + 1.4, ft[1] + 0.8, ft[2] + k], [ft[0] + 3.6, ft[1] + 0.2, ft[2] + k * 1.5], M.CLAW, 3);
  }
  for (const s of [-1, 1]) {
    const i = s > 0 ? 2 : 3, sh = at(chest, 1, -2.5, s * 7.6), tgt = air > 0.01 ? mix(P.feet[i], at(head, 8.5, -1.5 + Math.sin(t * 40 + s) * 1.2, s * 2.2), air) : P.feet[i], pw = reach(sh, tgt, 13.4), el = ik(sh, pw, 7, 7, [-0.6, 0.5, s * 0.9]);
    ball(g, sh, 4.4, M.FUR, 7); bone(g, sh, el, 4, 3.2, M.FUR, 1.15, 6); ball(g, el, 3.2, M.FUR, 6); bone(g, el, pw, 3.1, 2.6, M.FUR, 1.05, 6);
    // pençe: bilekten öne yassı el, dört uzun tırnak. lift: 0 yere basar, 1 havada öne/yukarı açılır
    const lift = P.paw[s > 0 ? 0 : 1], d = norm(mix([root.f[0], 0, root.f[2]], mad(chest.f, chest.u, 0.9), lift)), up = norm(mix([0, 1, 0], mad(chest.u, chest.f, -0.9), lift)), side = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]];
    const palm = mad(pw, d, 3.2);
    prism(g, pw, palm, 3, 4.8, M.PINK, 4, 0.78, 0.42, up);
    for (let k = 0; k < 4; k++) { const q = (k - 1.5) * (2 + P.spread * 0.8), b = mad(mad(palm, side, q), d, 0.4); spike(g, b, mad(mad(mad(b, d, 8), side, q * 0.35), up, -1.6 * (1 - lift)), 1.25, M.CLAW, 3); }
    if (s > 0 === !(P.near < 0)) A.hand = palm;
  }
  A.mouth = at(head, 6, -1.6, 0); A.chest = at(chest, 4, -3, 0); A.head = head.p; A.nose = nose;
  return A;
}

const STEP = 4.2, PH = [0, 0.5, 0.25, 0.75], DIE_T = 1.8;
function step(ph, lift) { const c = ph - Math.floor(ph); if (c < 0.64) return [STEP * (1 - 2 * c / 0.64), 0]; const k = (c - 0.64) / 0.36, e = k * k * (3 - 2 * k); return [STEP * (2 * e - 1), Math.sin(k * Math.PI) * lift]; }
function pose(o) {
  const t = o.t, A = o.A, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, side = clamp(Math.cos(o.view) * 4, -1, 1), br = Math.sin(t * 2.4 + o.wob);
  let px = -7, py = 9.2 + br * 0.2, pitch = 3, roll = 0, arch = 2, headP = -4, headY = 0, headR = 0, jaw = 0, eye = 1, sniff = 1, wag = 0.3, air = 0, spread = 0, props = 1, rate = 22, lookW = 0.7, shadow = 1, rear = 0;
  const paw = [0, 0], feet = [[-9 - side, 0, 7.4], [-9 + side, 0, -7.4], [9 - 1.2 * side, 0, 9.4], [9 + 1.2 * side, 0, -9.4]];
  if (w > 0.01) {
    // paytak sürünüş: ön pençeler kürek çeker gibi, gövde iki yana yalpalar
    const c = o.ph; feet.forEach((f, i) => { const [dx, dy] = step(c + PH[i], i > 1 ? 3 : 1.8); f[0] += dx * w; f[1] += dy * w; if (i > 1) paw[i - 2] = Math.min(1, dy / 3) * 0.6 * w; });
    py += Math.sin(c * 2 * TAU) * 0.4 * w; roll += Math.sin(c * TAU) * 5 * w; headY = Math.sin(c * TAU + 0.5) * 0.12 * w; headP -= 4 * w; wag = 1;
  }
  if (o.act === 'charge' && A) {
    const el = o.aim == null ? 0 : clamp(aimLocal(Math.cos(o.aim), Math.sin(o.aim), o.view)[1], -1.4, 1.4) / D;
    if (o.stage === 'aim') {
      // geri çöker, burnuyla hedefi koklar, pençeleri yeri eşeler
      const k = ss(0, 1, o.wind), sc = Math.sin(t * 22);
      px -= 4 * k; py -= 1.6 * k; pitch += (4 + el * 0.3) * k; arch += 6 * k; headP += (8 + el * 0.4) * k; sniff = 1 + 2 * k; lookW = 0.2;
      feet[2][0] += (sc > 0 ? 3 : -1) * k; feet[3][0] += (sc > 0 ? -1 : 3) * k; feet[2][1] += Math.max(0, sc) * 2.5 * k; feet[3][1] += Math.max(0, -sc) * 2.5 * k; paw[0] = Math.max(0, sc) * 0.6 * k; paw[1] = Math.max(0, -sc) * 0.6 * k; spread = k;
    } else if (o.stage === 'dash') {
      // matkap: gövde nişan yönünde uzanır, kendi ekseninde döner; pençeler önde birleşip kayayı deler
      air = 1; pitch = el; roll = o.sinceStage * 1100; py += 2; px += 3; arch = 0; headP = 0; paw[0] = paw[1] = 1; spread = -0.6; eye = 0; lookW = 0; shadow = 0.3; rate = 40; wag = 3;
    } else {
      // sersem: kıçının üstüne oturur, başı daireler çizer, pençeler sarkar
      const k = bump(0, 0.15, 0.85, 1.1, o.sinceStage), c = t * 5.4;
      pitch += 26 * k; py -= 1 * k; px -= 3 * k; headP += (-16 + Math.sin(c) * 14) * k; headY = Math.cos(c) * 0.5 * k; headR = Math.sin(c - 0.5) * 22 * k; roll += Math.cos(c) * 5 * k;
      feet[2] = [px + 15, 5 + Math.sin(c) * 1.2, 7]; feet[3] = [px + 15, 5 + Math.cos(c) * 1.2, -7]; paw[0] = paw[1] = 0.3 * k; jaw = 0.4 * k; eye = 0; sniff = 0.2; lookW = 0;
    }
  } else if (o.act === 'slam' || (o.prev === 'slam' && !o.act && o.since < 0.5)) {
    // arka ayakları üstünde doğrulur, iki pençeyi başının üstünden yere indirir
    const hit = o.act === 'slam' ? 0 : 1, k = hit ? 1 : ss(0, 0.85, o.wind), down = o.act === 'slam' ? ss(0.86, 1, o.wind) : 1, up = k * (1 - down), dn = down * (hit ? 1 - ss(0.2, 0.5, o.since) : 1);
    rear = up; pitch += 8 * dn; py -= 1.8 * dn; px += 2 * dn; headP += 14 * up - 10 * dn; jaw = 0.6 * up; spread = k;
    feet[2] = [mix1(feet[2][0], px + 20, up) + 5 * dn, 30 * up, mix1(feet[2][2], 6.5, up)]; feet[3] = [mix1(feet[3][0], px + 20, up) + 5 * dn, 30 * up, mix1(feet[3][2], -6.5, up)]; paw[0] = paw[1] = up;
    rate = 40; lookW = 0.2;
  } else if (o.act === 'melee') {
    // yakın yandaki ön pençesini geriye kaldırır, madenciyi tırmıklar
    const [up, dn] = meleeK(o), i = near > 0 ? 2 : 3;
    feet[i] = [feet[i][0] - 5 * up + 11 * dn, 13 * up + 5 * dn, feet[i][2] * (1 - 0.35 * dn)]; paw[i - 2] = Math.max(up, dn); spread = 1; roll += near * (-7 * up + 9 * dn); px += -1.5 * up + 3 * dn; pitch += 4 * up - 3 * dn;
    headP += -4 * up + 8 * dn; jaw = 0.5 * dn; rate = 46; lookW = 0.3;
  } else if (o.act === 'coins' || (o.prev === 'coins' && !o.act && o.since < 0.4)) {
    // yakın yandaki pençe yerden cevher kepçeler, yelpaze gibi savurur
    const c = o.act === 'coins' ? o.since : 0.35 + o.since, back = bump(0, 0.06, 0.1, 0.16, c), sw = bump(0.1, 0.2, 0.4, 0.7, c), i = near > 0 ? 2 : 3;
    feet[i] = [feet[i][0] - 6 * back + 9 * sw, 1 * back + 13 * sw, feet[i][2] * (1 - 0.4 * sw)]; paw[i - 2] = sw; spread = 1; roll += near * (-5 * back + 7 * sw); px += 2 * sw; headP += 6 * sw; jaw = 0.3 * sw; rate = 40;
  }
  if (o.rage && o.rageT < 1.1) { const k = bump(0, 0.18, 0.75, 1.1, o.rageT); rear = Math.max(rear, k); feet[2] = [px + 19, 22 * k + Math.sin(t * 30) * 1.5, 12]; feet[3] = [px + 19, 22 * k + Math.cos(t * 30) * 1.5, -12]; paw[0] = paw[1] = k; spread = 1; jaw = 0.9 * k; headP += 16 * k; lookW *= 1 - k; }
  if (rear > 0.001) { pitch += 50 * rear; py += 5 * rear; px -= 5 * rear; arch -= 8 * rear; feet[0][0] += 3 * rear; feet[1][0] += 3 * rear; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; px += clamp(o.hx * Math.cos(o.view), -1, 1) * 1.8 * h; py -= 0.8 * h; headP += 14 * h; headR += near * 12 * h; jaw = Math.max(jaw, 0.5 * h); eye = 1 - h; roll += near * 5 * h; sniff = 0; }
  if (dead) {
    // sırtüstü devrilir, pençeleri havada birkaç kez çırpınır, sonra göğsüne kıvrılır
    const d = o.dying * DIE_T, k = ss(0.15, 0.8, d), tw = (1 - ss(0.7, 1.5, d)) * k;
    roll += near * 150 * k; props = 1 - ss(0.3, 0.5, d); py = lerp(py, 8, k); pitch = lerp(pitch, 0, k); headP += -14 * k; headR += near * 20 * k; jaw = 0.5 * k; eye = 1 - ss(0.2, 0.6, d); sniff = 1 - k; wag = tw * 3;
    for (let i = 0; i < 4; i++) { const s = i & 1 ? -1 : 1; feet[i] = [mix1(feet[i][0], px + (i > 1 ? 13 : -2), k), mix1(0, py + 9 + Math.sin(d * 18 + i * 1.7) * 2.5 * tw, k), mix1(feet[i][2], s * 4, k)]; }
    paw[0] = paw[1] = 0.4 * k; lookW = 0; shadow = 1; rate = 30;
  }
  const [ly0, lp0] = aimLocal(o.tx - Math.cos(o.view) * 14, o.ty + 4, o.view), ly = clamp(ly0, -0.9, 0.9) * lookW, lp = clamp(lp0, -0.4, 0.6) * lookW;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, arch: arch * D, headP: headP * D + lp, headY: headY + ly, headR: headR * D, jaw, eye, sniff, wag, air, spread, props, paw, feet, near, shadow, br: 0.035 * br };
}
const mix1 = (a, b, k) => a + (b - a) * k;

export const KORDESEN = { w: 136, h: 104, ox: 68, oy: 84, scale: 1.2, tilt: 0.22, mats: MATS, stride: 13, shadow: 20, body: 26, bias: 0.34, turn: 0.5, outline: [8, 6, 12], wrap: ['roll'], pose, build };
