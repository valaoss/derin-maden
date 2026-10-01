// Kavurgan: kömürleşmiş kemikten ejder iskeleti. Açık göğüs kafesinin içinde kor yanar (kaburgaların arasından görünür),
// eklemleri kızgın, göz çukurları alevli; yırtık kanat kemikleri, dikenli omurga kuyruğu.
import { dot, line } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mix, mad, norm, cross, at, dir, turn, move, frame, ball, bone, tube, spike, prism, loft, ik, reach, batWing, aimLocal, meleeK, hash } from './rig.js';

const M = { BONE: 1, JOINT: 2, EMBER: 3, EYE: 4, MOUTH: 5, MEMB: 6, HORN: 7 };
const NECK = 4, TAIL = 7, NL = 4, TL = 4.2, TORSO = 8, HK = 1.3;
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb);
let core = 1;
const MATS = [];
MATS[M.BONE] = { ramp: ramp('#0c0a0a', '#28201c', '#4a3e36', '#7c6e62', '#c0b2a0') };
MATS[M.HORN] = { ramp: ramp('#141010', '#2e2622', '#52463c', '#84766a', '#c0b2a0') };
MATS[M.JOINT] = { ramp: ramp('#3a0c06', '#8a1c08', '#d84a10', '#ff8a28', '#ffd070'), flat: true, glow: 1, px: () => 0.2 + core * 0.5 };
MATS[M.EMBER] = { ramp: ramp('#6a1006', '#c02c08', '#ff6a14', '#ffb038', '#fff0a8'), flat: true, glow: 1, px: (u, v, i) => 0.25 + core * 0.45 + (i - 0.5) * 0.5 };
MATS[M.EYE] = { ramp: ramp('#c03808', '#ff7a10', '#ffb830', '#ffe470', '#fffad0'), flat: true, glow: 1 };
MATS[M.MOUTH] = { ramp: ramp('#1a0604', '#5a1006', '#c03a0c', '#ff8a28', '#ffe080'), flat: true, glow: 0.8, px: () => 0.1 + core * 0.3 + mouthHot * 0.5 };
MATS[M.MEMB] = { ramp: ramp('#060404', '#120c0a', '#221614', '#34221e', '#4a322a'), dither: 2, back: M.MEMB };
let mouthHot = 0;
const WING = {
  fold: { h: [-0.8, 0.5, 0.3], a: [0.2, 0.9, 0.2], f: [[-0.9, -0.3, 0.1], [-0.95, -0.1, 0.15], [-0.9, 0.2, 0.2]] },
  open: { h: [-0.5, 0.7, 0.5], a: [0.1, 0.92, 0.4], f: [[0.25, 0.95, 0.2], [-0.5, 0.82, 0.3], [-0.92, 0.3, 0.3]] },
  arm: [8, 9], fingers: [13, 15, 12], r: [1, 0.8, 0.8, 0.6], memb: M.MEMB, bone: M.BONE, claw: M.HORN, tone: 3, scallop: 0.5,
};

function skull(g, F, P, A) {
  const K = HK, jaw = P.jaw, h = (x, y, z) => at(F, x * K, y * K, z * K), Lw = turn(frame(h(0.5, -1.2, 0), F.f, F.u, F.r), 0, -jaw * 0.75), l = (x, y, z) => at(Lw, x * K, y * K, z * K);
  loft(g, Lw, [[-0.5, -0.4, 2.6, 0.9], [4, -0.4, 2, 0.8], [8.4, -0.2, 1.1, 0.6]], 6, M.BONE, { ceil: 0.2, flat: M.MOUTH, back: true, k: K });
  loft(g, F, [[-2.6, 1, 2.6, 2.4], [0, 1.4, 3.3, 2.8], [3, 1, 2.6, 2.1], [6.5, 0.5, 1.9, 1.5], [9.4, 0.3, 1.3, 1.1]], 8, M.BONE, { floor: -0.8, flat: M.MOUTH, back: true, k: K });
  for (const s of [-1, 1]) {
    for (const [x, w] of [[4.5, 1.7], [6.4, 1.5], [8.2, 1.1]]) { dot(g, h(x, -1.2, s * w), M.HORN, 4); if (jaw > 0.15) dot(g, l(x - 0.6, 0.5, s * w * 0.8), M.HORN, 3); }
    tube(g, [h(-1.2, 2.6, 2), h(-4.5, 4.4, 3.4), h(-8, 5.4, 3.6)], [1.3, 1, 0.3], 5, M.HORN);
    const e = h(2.2, 1.7, s * 2.5);
    dot(g, e, M.EYE, P.eye > 0.4 ? 4 : 0); dot(g, e, M.EYE, P.eye > 0.4 ? 2 : 0, -1, 0); dot(g, e, M.BONE, 0, 0, -1); dot(g, e, M.BONE, 0, -1, -1); dot(g, e, M.BONE, 0, 1, 0);
    if (s > 0 === !(P.near < 0)) A.eye = e;
  }
  dot(g, h(8.6, 1, 0.6), M.BONE, 0);
  A.mouth = h(7.5, -1 - jaw * 2, 0);
}

function build(g, P, o) {
  core = P.core; mouthHot = P.hot;
  const A = {}, t = o.t, root = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), mid = move(root, TORSO), chest = move(turn(mid, 0, P.arch), TORSO);
  // omurga: kuyruktan boyna omurlar, sırtta dikenler
  const V = [];
  let F = frame(root.p, [-root.f[0], -root.f[1], -root.f[2]], root.u, [-root.r[0], -root.r[1], -root.r[2]]);
  const tail = [];
  for (let i = 0; i < TAIL; i++) { F = move(turn(F, -P.tailY[i], P.tailP[i]), TL); if (F.p[1] < 1) F.p[1] = 1; tail.push(F); }
  for (let i = TAIL - 1; i >= 0; i--) V.push({ p: tail[i].p, u: tail[i].u, r: 2.1 - i * 0.2, sp: 2.8 - i * 0.24 });
  V.push({ p: root.p, u: root.u, r: 2.6, sp: 3 }, { p: mid.p, u: mid.u, r: 2.5, sp: 3.8 }, { p: chest.p, u: chest.u, r: 2.6, sp: 4 });
  F = chest;
  for (let i = 0; i < NECK; i++) { F = move(turn(F, P.neckY[i], P.neckP[i]), NL); if (F.p[1] < 2.4) F.p[1] = 2.4; V.push({ p: F.p, u: F.u, r: 2.2, sp: 2.6 - i * 0.3 }); }
  const headF = turn(F, P.head[1], P.head[0], P.head[2]);
  for (let i = 0; i < V.length - 1; i++) {
    const a = V[i], b = V[i + 1], m = mix(a.p, b.p, 0.5);
    prism(g, mix(a.p, b.p, 0.12), mix(a.p, b.p, 0.88), a.r, b.r, M.BONE, 5, i * 0.5);
    spike(g, mad(m, a.u, a.r * 0.6), mad(mad(m, a.u, a.r * 0.6 + a.sp), sub3(a.p, b.p), 0.25), 0.9, M.BONE, 3);
    if (i % 2 === 0) dot(g, a.p, M.JOINT, 3);
  }
  // kuyruk ucu: kemik diken demeti
  const tip = tail[TAIL - 1];
  for (const [u, r] of [[1, 0], [-0.3, 1], [-0.3, -1]]) spike(g, tip.p, mad(mad(mad(tip.p, tip.f, 4), tip.u, u * 2.4), tip.r, r * 2.4), 0.9, M.HORN, 3);
  // göğüs kafesi: altı çift kaburga; içinde nabız gibi atan kor
  const flare = 1 + P.flare * 0.3;
  for (let k = 0; k < 6; k++) {
    const q = 0.14 + k / 5 * 0.82, c = q < 0.5 ? mix(root.p, mid.p, q * 2) : mix(mid.p, chest.p, q * 2 - 1), Fk = q < 0.5 ? root : chest, w = (6.2 + Math.sin(q * Math.PI) * 2.8) * flare, hgt = 9 + Math.sin(q * Math.PI) * 2;
    for (const s of [-1, 1]) {
      const pts = [];
      for (let j = 0; j <= 5; j++) { const an = j / 5 * 2.7; pts.push(mad(mad(mad(c, Fk.r, s * Math.sin(an) * w), Fk.u, (Math.cos(an) - 1) * hgt * 0.5 + 0.6), Fk.f, -j * 0.35)); }
      tube(g, pts, j => 1.1 - j * 0.09, 4, M.BONE);
    }
  }
  const cc = mad(mix(root.p, chest.p, 0.56), mid.u, -5.2), pulse = 1 + Math.sin(t * 5) * 0.08;
  if (core > 0.04) { ball(g, cc, (3.8 + core * 1) * pulse, M.EMBER, 7); ball(g, mad(cc, mid.f, -4.5), 2.8 * pulse, M.EMBER, 6); }
  // kalça ve kürek kemikleri
  prism(g, mad(root.p, root.f, -1.5), mad(mad(root.p, root.f, 3.5), root.u, -2), 3.4, 2.6, M.BONE, 5, 0.3, 0.7, root.r);
  for (const s of [-1, 1]) prism(g, at(chest, -1, 1.5, s * 2.4), at(chest, -5, -1.5, s * 4.6), 0.8, 2.2, M.BONE, 4, 0.4, 0.5, chest.u);
  // bacaklar: ince kemik, kızgın eklem, pençe
  const hips = [[root, 1, -1.5, 4.6], [root, 1, -1.5, -4.6], [chest, -2, -2.5, 4.8], [chest, -2, -2.5, -4.8]];
  hips.forEach(([Fb, x, y, z], i) => {
    const hip = at(Fb, x, y, z), tk = P.tuck * (i > 1 ? 1 : 0), ft0 = P.feet[i], ft = tk > 0.01 ? mix(ft0, at(Fb, x + 4, y - 6, z), tk) : ft0;
    const ank = reach(hip, [ft[0] - 1.6, ft[1] + 2.6, ft[2]], 17.6), knee = ik(hip, ank, 9, 9, i > 1 ? [-1, 0.2, z > 0 ? 0.3 : -0.3] : [1, 0.1, z > 0 ? 0.25 : -0.25]), foot = [ank[0] + 1.6, ank[1] - 2.6, ank[2]];
    bone(g, hip, knee, 2, 1.5, M.BONE, 1, 5); ball(g, knee, 1.8, M.JOINT, 5); bone(g, knee, ank, 1.5, 1.2, M.BONE, 1, 5); ball(g, ank, 1.6, M.JOINT, 5);
    bone(g, ank, [foot[0] + 0.5, foot[1] + 0.8, foot[2]], 1.2, 1.1, M.BONE, 1, 4);
    for (let k = -1; k <= 1; k++) line(g, [foot[0] + 0.5, foot[1] + 0.8, foot[2] + k * 0.8], [foot[0] + 3.6, foot[1] + 0.1, foot[2] + k * 1.7], M.HORN, 4);
    ball(g, hip, 2.2, M.JOINT, 5);
  });
  for (const s of [-1, 1]) batWing(g, chest, at(chest, -2.5, 2, s * 2.6), at(chest, -9, 0.5, s * 2.4), s, P.wing, WING);
  skull(g, headF, P, A);
  // kordan kopan kıvılcımlar
  if (core > 0.2) for (let i = 0; i < 5; i++) { const k = (t * 0.9 + hash(i)) % 1; dot(g, [cc[0] + (hash(i + 3) - 0.5) * 9, cc[1] + 4 + k * 16, cc[2] + (hash(i + 6) - 0.5) * 7], M.EMBER, k < 0.5 ? 4 : 2); }
  A.chest = cc; A.head = headF.p;
  return A;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// ---------- duruşlar ----------
const STAND = { py: 17, neckP: [34, 14, -10, -22], head: -12, tailP: [-14, -4, 6, 10, 10, 6, 2] }, FIRE_NECK = [16, 2, -8, -8], COIL = [-14, -6, 12, 12], PH = [0, 0.5, 0.25, 0.75], DIE_T = 1.8, LOOK = [0.2, 0.26, 0.24, 0.16];
function step(ph, A, lift) { const c = ph - Math.floor(ph); if (c < 0.68) return [A * (1 - 2 * c / 0.68), 0]; const k = (c - 0.68) / 0.32, e = k * k * (3 - 2 * k); return [A * (2 * e - 1), Math.sin(k * Math.PI) * lift]; }
function pose(o) {
  const t = o.t, A = o.A, dead = o.dying > 0, w = dead ? 0 : o.walk, rage = o.rage ? 1 : 0, near = Math.cos(o.view) >= 0 ? 1 : -1, side = clamp(Math.cos(o.view) * 4, -1, 1), br = Math.sin(t * 2.6 + o.wob);
  const nP = STAND.neckP.map((v, i) => v + br * (i < 2 ? 1 : -0.6)), nY = [0, 0, 0, 0], hd = [STAND.head, 0, 0], tP = STAND.tailP.slice(), tY = tP.map((_, i) => Math.sin(t * 1.9 - i * 0.6) * 5 * (i / 6));
  let px = -8, py = STAND.py + br * 0.2, pitch = 2, roll = 0, arch = 3, jaw = (t * 1.3 + o.wob) % 5 < 0.25 ? 0.3 : 0.04, eye = 1, coreK = 0.55 + 0.12 * Math.sin(t * 5) + rage * 0.3, hot = 0, flare = 0, tuck = 0, rate = 22, lookW = 0.8, aimW = 0, aimY = 0, aimP = 0, shadow = 1, sink = 0;
  const wing = { open: 0.1 + rage * 0.2, fan: 0.15 + rage * 0.2, flap: 0, lean: 0.2 * side, sweep: 0, wave: Math.sin(t * 4) * 0.2 };
  const feet = [[-8 - 1 * side, 0, 5.4], [-8 + 1 * side, 0, -5.4], [7.5 - 1 * side, 0, 5.4], [7.5 + 1 * side, 0, -5.4]];
  if (w > 0.01) {
    // sinsi yürüyüş: baş alçakta, kuyruk adımla savrulur
    const c = o.ph; feet.forEach((f, i) => { const [dx, dy] = step(c + PH[i], 5, 2.6); f[0] += dx * w; f[1] += dy * w; });
    py += (Math.sin(c * 2 * TAU) * 0.5 - 1) * w; roll += Math.sin(c * TAU) * 3 * w; pitch -= 2 * w; [-12, -8, 4, 10].forEach((v, i) => { nP[i] += v * w; });
    for (let i = 0; i < TAIL; i++) tY[i] += Math.sin(c * TAU - i * 0.6) * 9 * (i / 6) * w;
  }
  if (o.act === 'breath' && A) {
    const [ay, ap] = aimLocal(Math.cos(o.aim || 0), Math.sin(o.aim || 0), o.view); aimY = clamp(ay, -1.3, 1.3); aimP = clamp(ap, -0.8, 1); lookW = 0;
    const tt = 1.9 - A.T, k = ss(0, 0.7, tt), f = ss(0.7, 0.84, tt);
    // başını geri çeker, kor parlar; sonra boynunu nişan yönünde uzatıp kor püskürtür
    for (let i = 0; i < NECK; i++) nP[i] = lerp(nP[i] + COIL[i] * k, FIRE_NECK[i], f);
    hd[0] = lerp(STAND.head - 12 * k, -4, f); hd[2] = Math.sin(t * 42) * 2.5 * f; px += lerp(-2 * k, 2.5, f) + Math.sin(t * 42) * 0.2 * f; py -= 1.2 * k; pitch += lerp(4 * k, -3, f);
    jaw = lerp(0.1 + 0.15 * k, 0.95, f); coreK = 0.6 + 0.4 * k; hot = f; wing.open += 0.35 * k + 0.2 * f; wing.fan += 0.4 * k; wing.flap += 0.15 * k; aimW = lerp(0.4 * k, 1, f); flare = 0.4 * k;
    [6, 6, 4, 2].forEach((v, i) => { tP[i] += v * k; }); rate = 30;
  } else if (o.act === 'melee') {
    // ısırık: boynunu geri toplar, başını öne fırlatıp çenesini kapatır
    const [up, dn] = meleeK(o), [ay, ap] = aimLocal(Math.cos(o.aim || 0), Math.sin(o.aim || 0), o.view); aimY = clamp(ay, -1.3, 1.3); aimP = clamp(ap, -0.8, 1); lookW = 0; aimW = Math.max(0.5 * up, dn);
    for (let i = 0; i < NECK; i++) nP[i] = lerp(nP[i] + COIL[i] * up, FIRE_NECK[i], dn);
    hd[0] = lerp(STAND.head - 10 * up, -2, dn); px += -2.5 * up + 4 * dn; py -= 1 * up; pitch += 3 * up - 4 * dn; jaw = Math.max(0.75 * up, 0.12 * dn); coreK = 0.6 + 0.3 * up; flare = 0.4 * dn; wing.open += 0.25 * up; rate = 46;
  } else if (o.act === 'embers' || o.act === 'ash' || ((o.prev === 'embers' || o.prev === 'ash') && !o.act && o.since < 0.6)) {
    // arka ayakları üstünde şaha kalkar, göğe kükrer: sırtından kor sütunu yükselir (kül bulutunda daha uzun kalır, kül kusar)
    const ash = (o.act || o.prev) === 'ash', c = o.act ? o.since : (ash ? 1.3 : 0.45) + o.since, k = ash ? ss(0, 0.5, c) * (1 - ss(0.8, 1.5, c)) : ss(0, 0.2, c) * (1 - ss(0.6, 1.05, c));
    pitch += 40 * k; py += 3.5 * k; px -= 2 * k; tuck = k; nP[0] += 6 * k; nP[2] += 14 * k; nP[3] += 20 * k; hd[0] += 26 * k; jaw = 0.9 * k; coreK = 1; hot = k; flare = k;
    wing.open = Math.max(wing.open, k); wing.fan = Math.max(wing.fan, k); wing.flap += 0.3 * k; [-18, -10, -4, 0].forEach((v, i) => { tP[i] += v * k; }); lookW = 0; rate = 34;
  } else if (o.act === 'bones' || o.act === 'spine' || ((o.prev === 'bones' || o.prev === 'spine') && !o.act && o.since < 0.35)) {
    // bütün gövdesiyle silkelenir: kemik kıymıkları dört yana saçılır (omurga yarığında yerden çıkar)
    const c = o.act ? o.since : 0.4 + o.since, k = bump(0, 0.06, 0.4, 0.75, c), sh = Math.sin(t * 38);
    roll += sh * 13 * k; px += sh * 0.8 * k; py -= 1.5 * k; flare = k; nY.forEach((_, i) => { nY[i] += sh * 9 * k; }); hd[2] += -sh * 16 * k; jaw = 0.5 * k;
    for (let i = 0; i < TAIL; i++) tY[i] += Math.sin(t * 38 - i) * 16 * k * (i / 6); wing.open += 0.5 * k; wing.flap += sh * 0.12 * k; coreK = 1; lookW = 0.3; rate = 60;
  }
  if (rage && o.rageT < 1.1) { const k = bump(0, 0.18, 0.75, 1.1, o.rageT); nP[2] += 12 * k; nP[3] += 16 * k; hd[0] += 20 * k; jaw = Math.max(jaw, 0.85 * k); wing.open = Math.max(wing.open, k); wing.fan = Math.max(wing.fan, k); wing.flap += 0.25 * k; coreK = 1; hot = Math.max(hot, k); flare = Math.max(flare, 0.6 * k); pitch += 8 * k; lookW *= 1 - k; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; px += clamp(o.hx * Math.cos(o.view), -1, 1) * 1.6 * h; nP[1] += 10 * h; nP[2] += 8 * h; hd[0] += 8 * h; hd[2] += Math.sin(t * 50) * 6 * h; jaw = Math.max(jaw, 0.4 * h); roll += near * 4 * h; flare = Math.max(flare, 0.5 * h); coreK = 1; }
  if (dead) {
    // içindeki ateş söner; bacaklar açılır, iskelet yere yığılır, baş en son düşer
    const d = o.dying * DIE_T, k = ss(0.25, 0.9, d), kn = ss(0.6, 1.2, d);
    coreK *= 1 - ss(0, 0.7, d); eye = 1 - ss(0.2, 0.8, d); jaw = 0.6 * bump(0, 0.15, 0.35, 0.7, d) + 0.25 * kn; py = lerp(py, 7, k); pitch = lerp(pitch, -2, k); roll += near * 8 * k + Math.sin(d * 16) * 3 * (1 - k);
    feet.forEach((f, i) => { f[0] += (i > 1 ? 5 : -4) * k; f[2] *= 1 + 0.5 * k; }); [-20, -12, 2, 8].forEach((v, i) => { nP[i] = lerp(nP[i], v, kn); }); hd[0] = lerp(hd[0], 8, kn); hd[2] += near * 20 * kn;
    for (let i = 0; i < TAIL; i++) { tP[i] = lerp(tP[i], 0, k); tY[i] = tY[i] * (1 - k) + near * 8 * k; } wing.open = 0.3 * k; wing.flap = -0.35 * k; lookW = 0; flare = -0.3 * k; shadow = 1 - 0.5 * k;
  }
  const [ly0, lp0] = aimLocal(o.tx - Math.cos(o.view) * 20, o.ty + 18, o.view), ly = clamp(ly0, -1.5, 1.5) * lookW, lp = clamp(lp0, -0.5, 0.6) * lookW;
  return {
    rate, px, py, pitch: pitch * D, roll: roll * D, arch: arch * D, jaw, eye, near, core: clamp(coreK, 0, 1), hot, flare, tuck, wing, feet, shadow, sink,
    neckP: nP.map((v, i) => v * D + lp * LOOK[i] + aimP * 0.21 * aimW), neckY: nY.map((v, i) => v * D + ly * LOOK[i] + aimY * 0.21 * aimW),
    head: [hd[0] * D + lp * 0.14 + aimP * 0.16 * aimW, hd[1] * D + ly * 0.14 + aimY * 0.16 * aimW, hd[2] * D], tailP: tP.map(v => v * D), tailY: tY.map(v => v * D),
  };
}

export const KAVURGAN = { w: 170, h: 124, ox: 85, oy: 102, scale: 1.05, tilt: 0.2, mats: MATS, stride: 14, shadow: 22, body: 30, bias: 0.3, turn: 0.5, outline: [14, 6, 4], hold: ['bones', 'embers', 'ash', 'spine'], pose, build };
