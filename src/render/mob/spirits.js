// Ruhlar ve akışkanlar: Gölge, Cam Gölgesi, Cıva Damlası/Damlacığı, Kan Sülüğü, Batak Yılanbalığı, Uluyan, Yankıcı.
// Hepsi aynı malzeme dizisini paylaşır; her türün kendi duruş (pose) ve kurulum (build) işlevi vardır.
import { dot, line, vert, tri } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mad, mix, norm, cross, anyUp, at, dir, turn, shift, frame, ell, ball, bone, skin, spike, prism, leaf, ik, reach } from '../boss/rig.js';
import { mobView, ramp, fr, noise } from './common.js';

const M = { SHADE: 1, VOID: 2, PALE: 3, GLASS: 4, SHARD: 5, RED: 6, MERC: 7, LEECH: 8, TOOTH: 9, MAW: 10, EEL: 11, EFIN: 12, YEL: 13, FUR: 14, PAW: 15, MANE: 16, ECHO: 17, DISH: 18, DISHB: 19, CORE: 20, DARK: 21 };
const MATS = [];
// gölge: eteğe doğru koyulaşan, dikine yırtık çizgili kumaş
MATS[M.SHADE] = { ramp: ramp('#120c1c', '#2a1e3a', '#3a2c54', '#4a3a6a', '#6a5a90'), px: (u, v, i) => i - (u > 7 ? 0.14 : 0) - (u > 9 && fr(v * 5) < 0.3 ? 0.2 : 0) };
MATS[M.VOID] = { ramp: ramp('#06040a', '#0a0612', '#100a1a', '#160e22', '#1e142c'), flat: true };
MATS[M.PALE] = { ramp: ramp('#8a90b0', '#b0b8d8', '#d0d8f0', '#e8f0ff', '#ffffff'), flat: true, soft: true, glow: 1 };
MATS[M.GLASS] = { ramp: ramp('#122a32', '#2e5a68', '#5a98a8', '#9cd4e0', '#d8f8ff') };
MATS[M.SHARD] = { ramp: ramp('#2e5a68', '#5a98a8', '#8ccad8', '#d8f8ff', '#ffffff') };
MATS[M.RED] = { ramp: ramp('#7a1010', '#c02a1a', '#ff4a3a', '#ff7a5a', '#ffc0a0'), flat: true, soft: true, glow: 1 };
// cıva: tepe parlak, ufuk çizgisi koyu, alt yarı yerden yansıma alır
MATS[M.MERC] = { ramp: ramp('#1c2026', '#3a4048', '#8a96a0', '#d8e4ec', '#ffffff'), px: (u, v, i) => v > 0.36 && v < 0.5 ? i - 0.34 : v <= 0.36 ? i + 0.2 : i + 0.06 };
// sülük: boğum olukları (u: ağızdan beri uzunluk)
MATS[M.LEECH] = { ramp: ramp('#2a060a', '#4e0c12', '#8a1a20', '#c02a30', '#ff6a70'), px: (u, v, i) => fr(u / 2.1) < 0.3 ? i - 0.42 : i + 0.04 };
MATS[M.TOOTH] = { ramp: ramp('#8a8a80', '#b8b8ac', '#e0e0d4', '#f5ecd8', '#ffffff'), flat: true, soft: true };
MATS[M.MAW] = { ramp: ramp('#14040a', '#2a0812', '#4a0e1c', '#6a1626', '#8a2434'), flat: true };
// yılanbalığı: koyu sırt benekleri, açık karın, yan çizgide ışıltı
MATS[M.EEL] = { ramp: ramp('#0a2a32', '#16444e', '#20687e', '#2a8ab0', '#8af0ff'), px: (u, v, i) => v > 0.6 && v < 0.9 ? i + 0.26 : (v > 0.44 && v < 0.56) && fr(u / 3) < 0.3 ? i + 0.4 : i - (noise(Math.floor(u * 0.7), Math.floor(v * 8)) > 0.72 ? 0.2 : 0) };
MATS[M.EFIN] = { ramp: ramp('#082028', '#12384a', '#1c5a70', '#2a7e9c', '#58b8d0'), back: M.EFIN };
MATS[M.YEL] = { ramp: ramp('#8a6a20', '#c8a040', '#ffe79a', '#fff2c0', '#ffffe0'), flat: true, soft: true, glow: 1 };
MATS[M.FUR] = { ramp: ramp('#20101e', '#4a2a44', '#633a5a', '#7a4a70', '#a878a0'), px: (u, v, i) => v > 0.6 && v < 0.9 ? i - 0.12 : i };
MATS[M.PAW] = { ramp: ramp('#160a14', '#2e1a2a', '#4a2a44', '#5e3856', '#7a4a70') };
MATS[M.MANE] = { ramp: ramp('#4a2a44', '#7a4a70', '#a878a0', '#c498bc', '#e0c0d8') };
MATS[M.ECHO] = { ramp: ramp('#14121e', '#262234', '#3a3450', '#5e5880', '#8a86b0'), px: (u, v, i) => v < 0.3 ? i - 0.15 : i };
// çanak: eş merkezli halkalar (u: 0 merkez .. 1 kenar); arka yüz düz koyu
MATS[M.DISH] = { ramp: ramp('#262234', '#3a3450', '#5e5880', '#8a86b0', '#c0bce0'), back: M.DISHB, px: (u, v, i) => u < 0.3 || (u > 0.58 && u < 0.8) ? i - 0.3 : i + 0.22 };
MATS[M.DISHB] = { ramp: ramp('#14121e', '#201c2e', '#2e2a42', '#3a3450', '#4e486c') };
MATS[M.CORE] = { ramp: ramp('#8a86b0', '#c0bce0', '#e8e0f0', '#f5ecd8', '#ffffff'), flat: true, soft: true, glow: 1 };
MATS[M.DARK] = { ramp: ramp('#040608', '#080a10', '#10121c', '#181a28', '#222436'), flat: true, soft: true };

const nearOf = o => Math.cos(o.view) >= 0 ? 1 : -1;
const base = { scale: 1, mats: MATS, wrap: ['roll', 'ang'] };
// ekran düzleminde serbest dolaşanlar (sülük, yılanbalığı): gittiği ya da saldırdığı yönün açısı (+y yukarı)
const heads = new WeakMap(), UP = [0, 0, 1];
function heading(o) {
  const e = o.e; let a = heads.get(e); if (a === undefined) a = o.face >= 0 ? 0 : Math.PI;
  if (!e.dead) {
    if (o.wind > 0 || o.lunge > 0.3) a = Math.atan2(-o.ty, o.tx);
    else if (o.speed > 3 && !e.kx && !e.ky) a = Math.atan2(-o.vy, o.vx);
    else if (Math.abs(Math.cos(a)) > 0.5 && (Math.cos(a) >= 0 ? 1 : -1) !== o.face) a = o.face >= 0 ? 0 : Math.PI;
  }
  heads.set(e, a); return a;
}

// ---------- Gölge: kukuletalı, eteği dumanlaşan hayalet ----------
function shadeBuild(g, P, o) {
  const A = {}, T = turn(frame([0, P.py, 0]), 0, P.pitch, P.roll), ph = o.t * 5 + o.wob, k = P.fat, L = P.len;
  const S = [[0, 5.6, 0.6, 0.6], [0.4, 3.7, 2.7, 2.8], [0.1, 1.7, 2.3, 2.3], [0, 0, 3.7, 3], [-0.4, -2.2, 3.4, 2.8], [-1.2, -4.3, 2.4, 2], [-2.4, -6, 1.2, 1], [-3.4, -7.4, 0.3, 0.3]];
  skin(g, S.map(([x, y, rx, ry], i) => { const f = Math.max(0, i - 3) / 4; return { p: at(T, x - P.trail * f * 2.6, y * L, Math.sin(ph - i * 0.9) * P.wave * f * 1.8), u: T.f, rx: rx * k, ry: ry * k }; }), 8, M.SHADE, { sub: 2 });
  // kukuletanın içi karanlık; iki soluk göz
  ell(g, frame(at(T, 1.7 * k, 3.5 * L, 0), T.f, T.u, T.r), 1.4 * k, 1.7 * k, 2 * k, M.VOID, 6, 3);
  for (const s of [-1, 1]) {
    if (P.eye > 0.5) { const q = at(T, 2.9 * k, 3.8 * L, s * 1.1 * k); dot(g, q, M.PALE, 4); dot(g, q, M.PALE, 2, 0, 1); if (s > 0 === Math.cos(o.view) >= 0) A.eye = q; }
    // kollar: omuzdan uzanan sivri duman
    spike(g, at(T, -0.9, -3.6 * L, s * 2 * k), at(T, -1.8 - P.trail * 2.4, -7.6 * L, s * 2.9 + Math.sin(ph + s) * P.wave), 1 * k, M.SHADE, 3);
    spike(g, at(T, 0.6, 0.3 * L, s * 3 * k), at(T, 3.6 + P.reach * 2.6, -2.2 + P.raise * 5, s * (4.2 + P.raise)), 1.3 * k, M.SHADE, 4);
  }
  A.head = at(T, 0, 5.5 * L, 0); A.mouth = at(T, 3, 1, 0);
  return A;
}
function shadePose(o) {
  const t = o.t, dead = o.dying > 0, w = dead ? 0 : o.walk, near = nearOf(o), wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  let py = Math.sin(t * 2.6 + o.wob) * 0.8, pitch = -10 * w, roll = 0, fat = 1 + Math.sin(t * 3.1 + o.wob) * 0.04, len = 1, trail = w, wave = 0.7 + 0.5 * w, raise = 0.1 + 0.08 * Math.sin(t * 2 + o.wob), rch = 0, eye = 1, rate = 20;
  if (wd > 0.001) { py += 1.2 * wd; pitch += 12 * wd; raise = lerp(raise, 1, wd); fat += 0.1 * wd; }
  if (l > 0.001) { pitch -= 30 * l; rch = l; raise = lerp(raise, 0.45, l); trail = Math.max(trail, l); rate = 40; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; fat -= 0.2 * h; len += 0.2 * h; roll += near * 18 * h; wave += 1.2 * h; }
  // ölüm: yukarı doğru incelip duman gibi dağılır
  if (dead) { const d = o.dying; fat = lerp(1, 0.12, ss(0, 0.8, d)); len = 1 + d * 0.7; py += d * 4; wave = 1.6; raise = 0.8; eye = 1 - ss(0.2, 0.4, d); rate = 60; }
  return { rate, py, pitch: pitch * D, roll: roll * D, fat, len, trail, wave, raise, reach: rch, eye, zoom: o.e.scale || 1 };
}

// ---------- Cam Gölgesi: keskin yüzlü cam kırıklarından hayalet; vurulunca parçaları oynar, ölünce dağılır ----------
function glassBuild(g, P, o) {
  const A = {}, T = turn(frame([0, P.py, 0]), 0, P.pitch, P.roll), b = P.burst, sc = 1 - b * 0.55;
  // kırık: a -> c (gövde çerçevesinde); dağılırken merkezden dışa savrulur, döner ve düşer
  const sh = (a, c, ra, rb, m, n = 4, tw = 0, fw = T.f) => {
    const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2 + 0.5, mz = (a[2] + c[2]) / 2, k = b * 1.5, dy = -b * b * 5;
    prism(g, at(T, a[0] + mx * k, a[1] + my * k + dy, a[2] + mz * k), at(T, c[0] + mx * k, c[1] + my * k + dy, c[2] + mz * k), ra * sc, rb * sc, m, n, tw + b * (mx * 2 + my), 0.9, fw);
  };
  const tx = -1.2 - P.trail * 1.6;
  sh([0.3, 2.7, 0], [0.3, 4.4, 0], 1.2, 2.5, M.GLASS); sh([0.3, 4.4, 0], [-0.5, 7.6, 0], 2.5, 0.15, M.SHARD);
  sh([0, 2.7, 0], [0, 0.4, 0], 1.6, 3.7, M.GLASS); sh([0, 0.4, 0], [tx, -7, 0], 3.7, 0.2, M.GLASS);
  for (const s of [-1, 1]) {
    sh([-0.2, 1.2, s * 2.8], [-1.4, 5.2, s * 5.2], 1.2, 0.1, M.SHARD, 3, s);
    sh([0.5, 0.3, s * 3.3], [4.2 + P.reach * 2.6, -1.6 + P.raise * 5, s * (3.4 + P.raise)], 1.1, 0.1, M.SHARD, 3, 0, T.u);
    if (P.eye > 0.5) { const q = at(T, 1.5, 4.1, s * 1.1); dot(g, q, M.RED, 3); if (s > 0 === Math.cos(o.view) >= 0) A.eye = q; }
  }
  // eteğin çevresinde dönen küçük kırıklar
  for (let i = 0; i < 3; i++) { const a = o.t * 1.8 + i * TAU / 3 + o.wob, c = [Math.cos(a) * 4.2 - 0.8, -3.2 - i * 1.3 + Math.sin(o.t * 3 + i * 2), Math.sin(a) * 4.2]; sh(c, [c[0] - 0.3, c[1] - 2.4, c[2]], 0.9, 0.1, M.SHARD, 3, a); }
  A.head = at(T, 0, 7, 0); A.mouth = at(T, 3, 1, 0);
  return A;
}
function glassPose(o) {
  const t = o.t, dead = o.dying > 0, w = dead ? 0 : o.walk, near = nearOf(o), wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  let py = Math.sin(t * 2.2 + o.wob) * 0.7, pitch = -9 * w, roll = Math.sin(t * 1.3 + o.wob) * 3, raise = 0.1, rch = 0, burst = 0, eye = 1, rate = 20;
  if (wd > 0.001) { py += 1 * wd; pitch += 10 * wd; raise = lerp(raise, 1, wd); }
  if (l > 0.001) { pitch -= 28 * l; rch = l; raise = lerp(raise, 0.4, l); rate = 40; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; burst = 0.3 * h; roll += near * 14 * h; rate = 50; }
  if (dead) { burst = ss(0, 0.75, o.dying); eye = 0; rate = 60; }
  return { rate, py, pitch: pitch * D, roll: roll * D, trail: w, raise, reach: rch, burst, eye, zoom: o.e.scale || 1 };
}

// ---------- Cıva Damlası / Damlacığı: parlak metal damla; hızlanınca uzar, durunca yayılır ----------
const blobBuild = (S, big) => (g, P, o) => {
  const A = {}, sx = P.sx, sy = P.sy, rx = 5 * S * sx, ry = 4.4 * S * sy, rz = 4.8 * S / Math.sqrt(clamp(sx * sy, 0.4, 2.5));
  const T = turn(frame([P.px, P.py + ry * 0.94, 0]), 0, P.pitch);
  ell(g, T, rx, ry, rz, M.MERC, big ? 9 : 6, big ? 5 : 4);
  if (big) {
    // tepe: geriye yatan damla ucu; arkada kopan boncuklar
    ell(g, frame(at(T, -rx * 0.12 - P.lean * 1.6, ry * 0.72, 0), T.f, T.u, T.r), rx * 0.5, ry * 0.62 * P.peak, rz * 0.5, M.MERC, 7, 4);
    if (P.lean > 0.2) { ball(g, [P.px - rx - 1.2, 1, 0.8], 1.3 * P.lean, M.MERC, 5); ball(g, [P.px - rx - 3.6, 0.7, -0.6], 0.9 * P.lean, M.MERC, 5); }
  }
  if (P.eye > 0.5) for (const s of [-1, 1]) { const q = at(T, rx * 0.86, ry * 0.12, s * rz * 0.42); dot(g, q, M.RED, 3); if (s > 0 === Math.cos(o.view) >= 0) A.eye = q; }
  A.head = at(T, 0, ry * (big ? 1.7 : 1), 0); A.mouth = at(T, rx, 0, 0);
  return A;
};
function blobPose(o) {
  const t = o.t, dead = o.dying > 0, w = dead ? 0 : o.walk, sp = clamp(o.speed / 55, 0, 1.4) * w, wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  const idle = Math.sin(t * 2.4 + o.wob) * (1 - w), hop = Math.abs(Math.sin(o.ph * Math.PI));
  let sx = 1 + 0.38 * sp - idle * 0.08, sy = 1 - 0.2 * sp + idle * 0.12 + hop * 0.12 * w, px = 0, py = hop * 1.3 * w, pitch = 0, peak = 1 + idle * 0.25, lean = sp, eye = 1, rate = 24;
  if (wd > 0.001) { sy *= 1 - 0.38 * wd; sx *= 1 + 0.14 * wd; px -= 1 * wd; peak *= 1 - 0.5 * wd; }
  if (l > 0.001) { sx *= 1 + 0.6 * l; sy *= 1 - 0.2 * l; px += 2.6 * l; py += 1.4 * l; pitch += 10 * l; lean = Math.max(lean, l); rate = 45; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt, j = Math.sin(t * 38) * h; sy *= 1 + 0.3 * j; sx *= 1 - 0.2 * j; rate = 60; }
  // ölüm: yere yayılıp gölcük olur
  if (dead) { const k = ss(0, 0.6, o.dying); sx = lerp(1, 1.75, k); sy = lerp(1, 0.16, k); peak = 1 - k; lean = 0; py = 0; eye = 1 - ss(0.2, 0.4, o.dying); rate = 60; }
  return { rate, sx, sy, px, py, pitch: pitch * D, peak, lean, eye, zoom: o.e.scale || 1 };
}

// ---------- Kan Sülüğü: boğumlu, şişkin gövde; önde dişli emici ağız. Kaya içinde her yöne gider (ekran düzleminde döner) ----------
function leechBuild(g, P, o) {
  const A = {}, h = [Math.cos(P.ang), Math.sin(P.ang), 0], s = [-h[1], h[0], 0], ph = o.t * P.wigF + o.wob, J = [];
  const X = [5.2, 4.3, 2.4, -0.4, -3.2, -5.4, -7], R = [2.2 + P.mouth * 0.8, 2.9, 3.4, 3.7, 3, 1.9, 0.9];
  for (let i = 0; i < 7; i++) {
    const sw = i > 0 && i < 6 ? P.fat * (1 + P.swell * (i > 1 && i < 5 ? 1 : 0.4)) : 1, r = R[i] * sw * (1 + Math.sin(o.t * 7 - i * 1.1 + o.wob) * P.squeeze);
    J.push({ p: mad(mad([0, 0, 0], h, X[i] * P.len + (i < 2 ? P.reach * (1 - i * 0.3) : 0)), s, Math.sin(ph - i * 0.9) * P.wig * i / 6), u: UP, rx: r, ry: r * 0.85 });
  }
  skin(g, J, 8, M.LEECH, { sub: 2 });
  // ağız: koyu emici, çevresinde diş çemberi; ısırırken dişler öne uzar
  const tip = mad(J[0].p, h, 0.9), rim = R[0];
  ball(g, tip, rim * 0.92, M.MAW, 6);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.5, d = mad(mad([0, 0, 0], s, Math.cos(a)), UP, Math.sin(a)), q = mad(tip, d, rim * 0.95); spike(g, q, mad(mad(q, h, 1.2 + P.mouth * 1.3), d, -rim * 0.4), 0.6, M.TOOTH, 3); }
  if (P.eye > 0.5) for (const k of [-1, 1]) dot(g, mad(mad(J[1].p, s, k * 1.3), UP, 3), M.RED, 3);
  A.mouth = mad(tip, h, 1); A.head = J[1].p;
  return A;
}
function leechPose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  // sürünme: uzayıp kısalır, kısalırken şişer
  const inch = Math.sin(o.ph * TAU) * 0.13 * w;
  let len = 1 + inch, fat = 1 - inch * 0.8, wig = 0.5 + 0.5 * w, wigF = 3 + 3 * w, squeeze = 0.04 + 0.04 * w, mouth = 0.1 + 0.1 * Math.sin(t * 4 + o.wob), rch = 0, eye = 1, rate = 20;
  if (wd > 0.001) { rch = -1.3 * wd; mouth = Math.max(mouth, wd); len -= 0.08 * wd; fat += 0.08 * wd; }
  if (l > 0.001) { rch = 2.6 * l; mouth = Math.max(mouth, l); len += 0.1 * l; rate = 40; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; wig += 1.6 * h; wigF += 9 * h; len -= 0.12 * h; fat += 0.1 * h; }
  if (dead) { const d = o.dying, k = ss(0.35, 1, d); wig = lerp(2.4, 0.3, k); wigF = lerp(16, 3, k); fat = lerp(1.05, 0.55, k); len = lerp(1, 0.8, k); mouth = 0.7 * (1 - k); squeeze = 0.1 * (1 - k); eye = 1 - ss(0.3, 0.6, d); rate = 60; }
  const sc = e.scale || 1;
  return { rate, ang: heading(o), len, fat, wig, wigF, squeeze, mouth, reach: rch, eye, swell: clamp(sc - 1, 0, 0.6) * 0.6, tilt: 0, zoom: sc };
}

// ---------- Batak Yılanbalığı: uzun, kıvrıla kıvrıla yüzen gövde; kuyruğa doğru şerit yüzgeç. Her yöne yüzer (ekran düzleminde döner) ----------
const EEL = [[-8.6, 0.15, 0.45], [-6.6, 0.45, 1.05], [-4, 0.8, 1.45], [-1, 1.1, 1.75], [2, 1.25, 1.9], [4.4, 1.3, 1.8], [6, 1.1, 1.4], [7.2, 0.6, 0.75]];
const FIN = [[1, 1.8, 0], [-1, 1.7, 0.9], [-3, 1.5, 1.1], [-5, 1.2, 1.2], [-7, 0.8, 1.3], [-9.8, 0, 0.3]];
function eelBuild(g, P, o) {
  const A = {}, c = Math.cos(P.ang), sn = Math.sin(P.ang), T = turn(frame([0, P.py, 0], [c, sn, 0], [-sn, c, 0], UP), 0, 0, P.roll), ph = o.t * P.beat + o.wob, kx = x => clamp((6 - x) / 9, 0, 1.4);
  // dalga kuyruğa doğru büyür; ekran düzleminde kalır ki her yönde okunsun
  const wv = x => Math.sin(ph + x * 0.55) * P.amp * kx(x), pt = (x, y = 0, z = 0) => { const q = at(T, x, y, z); return [q[0] - sn * wv(x), q[1] + c * wv(x), q[2]]; };
  skin(g, EEL.map(([x, rx, ry]) => ({ p: pt(x), u: T.u, rx, ry })), 8, M.EEL, { sub: 2 });
  for (const s of [1, -1]) for (let i = (s > 0 ? 0 : 1); i < FIN.length - 1; i++) {
    const [x0, h0, f0] = FIN[i], [x1, h1, f1] = FIN[i + 1], k = s > 0 ? 1 : 0.7, a = pt(x0, s * h0 * 0.8), b = pt(x1, s * h1 * 0.8), c = pt(x1 - 0.5, s * (h1 + f1 * k)), d = pt(x0 - 0.5, s * (h0 + f0 * k));
    leaf(g, a, b, c, M.EFIN); leaf(g, a, c, d, M.EFIN);
  }
  // alt çene, göz, göğüs yüzgeci
  const jw = P.jaw;
  ell(g, frame(pt(6, -0.8 - jw * 0.9), T.f, T.u, T.r), 1.5, 0.5, 0.9, M.EEL, 6, 3);
  if (jw > 0.3) { dot(g, pt(7, -0.6), M.DARK, 0); for (const s of [-1, 1]) dot(g, pt(7.3, -0.3, s * 0.4), M.TOOTH, 4); }
  for (const s of [-1, 1]) {
    const q = pt(5.6, 0.6, s * 1.2); dot(g, q, M.YEL, 2); if (Math.cos(P.roll) * s > 0) A.eye = q;
    leaf(g, pt(3.6, -0.4, s * 1.2), pt(2.4, -0.2, s * 1.3), pt(2.2, -1.6, s * 2.4), M.EFIN, s);
  }
  A.head = pt(4, 0); A.mouth = pt(7.4, -0.5);
  return A;
}
function eelPose(o) {
  const t = o.t, dead = o.dying > 0, w = dead ? 0 : o.walk, a = heading(o), wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge;
  // sola dönünce kendi ekseninde yuvarlanır: sırtı hep yukarıda kalır
  let py = Math.sin(t * 2.2 + o.wob) * 0.5, roll = Math.cos(a) < 0 ? 180 : 0, amp = 1.2 + 0.5 * w, beat = 4.5 + 6 * w, jaw = 0.1 + 0.1 * Math.abs(Math.sin(t * 3 + o.wob)), rate = 26;
  if (wd > 0.001) { amp += 0.9 * wd; jaw = Math.max(jaw, wd); }
  if (l > 0.001) { amp *= 1 - 0.7 * l; jaw = Math.max(jaw, 1 - l * 0.5); rate = 40; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; roll += 50 * h; amp += 1.2 * h; beat += 8 * h; }
  if (dead) { const k = ss(0, 0.5, o.dying); roll += 180 * k; amp = lerp(1.8, 0.25, k); beat = 3; jaw = 0.6; rate = 50; }
  return { rate, ang: a, py, roll: roll * D, amp, beat, jaw, tilt: 0, zoom: o.e.scale || 1 };
}

// uluma: oyundaki howlT (0.9 sn) boyunca; [ağırlık, titreşim]
const howlOf = (o, f) => { const T = o.e.howlT > 0 && !o.e.dead ? bump(0, 0.18, 0.8, 1, 1 - o.e.howlT / 0.9) : 0; return [T, T * Math.sin(o.t * f)]; };

// ---------- Uluyan: dört ayaklı, kambur omuzlu, yeleli hayvan; ulurken çöker, başını geriye atar ----------
function howlBuild(g, P) {
  const A = {}, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), H = turn(shift(T, 4.2, 1.7, 0), 0, P.headP), jw = P.jaw;
  skin(g, [
    { p: at(T, -5.2, 0.3, 0), u: T.u, rx: 0.9, ry: 1 }, { p: at(T, -3.6, 0.2, 0), u: T.u, rx: 2.1, ry: 2.2 }, { p: at(T, -0.6, 0.2, 0), u: T.u, rx: 2.2, ry: 2.3 },
    { p: at(T, 2.2, 0.9, 0), u: T.u, rx: 2.7, ry: 3.2 }, { p: at(T, 3.5, 1.4, 0), u: T.u, rx: 2.1, ry: 2.4 }, { p: at(H, 0.4, 0.1, 0), u: H.u, rx: 1.8, ry: 1.9 }, { p: at(H, 2, 0, 0), u: H.u, rx: 1.45, ry: 1.4 },
  ], 8, M.FUR, { sub: 2 });
  // burun, alt çene, dişler
  bone(g, at(H, 1.8, 0.1, 0), at(H, 4.4, -0.1, 0), 1.25, 0.8, M.FUR, 1, 6, true); dot(g, at(H, 5, 0.1, 0), M.DARK, 1);
  const J = turn(shift(H, 1.4, -0.8, 0), 0, -jw * 0.9);
  if (jw > 0.15) ell(g, frame(at(H, 2.7, -0.8 - jw * 0.5, 0), H.f, H.u, H.r), 1.5, 0.3 + jw * 0.8, 0.8, M.MAW, 6, 3);
  bone(g, J.p, at(J, 2.8, 0, 0), 0.9, 0.5, M.PAW, 1, 5, true);
  for (const s of [-1, 1]) {
    dot(g, at(H, 4.2, -0.9, s * 0.6), M.TOOTH, 4); if (jw > 0.3) dot(g, at(J, 2.6, 0.6, s * 0.4), M.TOOTH, 3);
    dot(g, at(H, 1.9, 0.8, s * 1.3), M.RED, 3);
    spike(g, at(H, 0.5, 1.3, s * 1.1), at(H, -0.8 - P.bristle * 0.6, 3.5, s * 1.8), 0.8, M.FUR, 3);
  }
  // yele: ulurken kabarır
  for (let i = 0; i < 4; i++) { const x = 3 - i * 1.5, y = 3.6 - i * 0.55; spike(g, at(T, x, y - 0.8, 0), at(T, x - 1 - P.bristle * 0.3, y + 0.9 + P.bristle * 1.1, 0), 0.9, M.MANE, 3); }
  bone(g, at(T, -5, 0.6, 0), at(T, -7.4, 0.2 + P.tail * 2.6, 0), 0.8, 0.3, M.PAW, 1, 4, true);
  for (let i = 0; i < 4; i++) {
    const hind = i < 2, s = i & 1 ? -1 : 1, hip = at(T, hind ? -3.3 : 2.5, -1, s * 1.7);
    const ft = reach(hip, mix(P.feet[i], at(T, hind ? -4.6 : 3.8, -4.4, s * 2.2), P.limp), 5), kn = ik(hip, ft, 2.7, 2.5, [hind ? 1 : -0.7, 0.25, s * 0.3]);
    bone(g, hip, kn, 1.25, 0.8, M.FUR, 1.1, 5); bone(g, kn, ft, 0.75, 0.55, M.PAW, 1, 5, true); line(g, ft, mad(ft, T.f, 1.2), M.PAW, 2);
  }
  A.head = at(H, 0.5, 3, 0); A.mouth = at(H, 4.6, -0.6, 0);
  return A;
}
function howlPose(o) {
  const t = o.t, dead = o.dying > 0, w = dead ? 0 : o.walk, near = nearOf(o), wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge, [hw, vib] = howlOf(o, 46);
  let px = 0, py = 5 + Math.sin(t * 2.4 + o.wob) * 0.12 + Math.abs(Math.sin(o.ph * TAU)) * 0.5 * w, pitch = 0, roll = 0, headP = -8 + Math.sin(o.ph * TAU * 2) * 4 * w, jaw = 0.06, bristle = 0, tail = Math.sin(t * 3 + o.wob) * 0.12 + 0.3 * w, limp = 0, rate = 24;
  const feet = [];
  for (let i = 0; i < 4; i++) { const hind = i < 2, s = i & 1 ? -1 : 1, a = (o.ph + (i === 0 || i === 3 ? 0 : 0.5)) * TAU; feet.push([(hind ? -3.6 : 2.9) + Math.sin(a) * 2.3 * w, Math.max(0, Math.cos(a)) * 1.6 * w, s * 1.9]); }
  if (hw > 0.001) { pitch += 20 * hw; py -= 0.5 * hw; px -= 0.8 * hw; headP = lerp(headP, 58, hw) + vib * 3; jaw = Math.max(jaw, 0.85 * hw + vib * 0.15); bristle = hw; tail = lerp(tail, 1, hw); rate = 30; }
  if (wd > 0.001) { py -= 0.9 * wd; px -= 1 * wd; pitch -= 6 * wd; headP -= 10 * wd; jaw = Math.max(jaw, 0.4 * wd); bristle = Math.max(bristle, 0.6 * wd); }
  if (l > 0.001) { px += 2.6 * l; headP += 10 * l; jaw = Math.max(jaw, l); rate = 40; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; py -= 0.6 * h; px -= 0.8 * h; headP -= 18 * h; roll += near * 8 * h; tail = -0.4; }
  // ölüm: yan devrilir, bacakları uzanır
  if (dead) { const k = ss(0, 0.45, o.dying); roll = near * 86 * k; py = lerp(py, 2.3, k); headP = lerp(headP, -14, k); jaw = 0.5 * k; limp = k; tail = -0.3; rate = 60; }
  for (const f of feet) f[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, headP: headP * D, jaw, bristle, tail, limp, feet, zoom: o.e.scale || 1 };
}

// ---------- Yankıcı: tombul gövde, iki yanında halkalı dev kulak çanakları, göğsünde titreşen zar; ulurken halkalar yayar ----------
function dish(g, c, ax, r, m) {
  const t = norm(ax), r1 = norm(cross(t, anyUp(t))), r2 = cross(r1, t), k = vert(g, mad(c, t, -r * 0.35), t, 0, 0), b = g.nv;
  for (let j = 0; j <= 9; j++) { const a = j / 9 * TAU; vert(g, mad(mad(c, r1, Math.cos(a) * r), r2, Math.sin(a) * r), t, 1, 0); }
  for (let j = 0; j < 9; j++) tri(g, k, b + j, b + j + 1, m);
}
function echoBuild(g, P, o) {
  const A = {}, T = turn(frame([P.px, P.py, 0]), 0, P.pitch, P.roll), hw = P.howl, dr = P.droop;
  ell(g, T, 3.9, 4.1, 4.1, M.ECHO, 8, 5);
  ball(g, at(T, 3, -0.6, 0), 1.3 + hw * 0.5 + P.vib * 0.3, M.CORE, 6);
  for (const s of [-1, 1]) {
    dot(g, at(T, 3.2, 2.2, s * 1.5), M.RED, 3);
    const root = at(T, 0, 3, s * 2.8), c = at(T, 0.4 + hw * 0.8, 5.6 - dr * 3.6, s * (5.6 + dr * 0.6));
    bone(g, root, c, 1, 0.7, M.ECHO, 1, 5);
    dish(g, c, dir(T, lerp(0.6, 1, hw), lerp(0.25, -0.7, dr), s * lerp(0.8, 0.35, hw)), 3.9 * (1 + 0.2 * hw) + P.vib * 0.35, M.DISH);
    // bacak ve ayak
    const i = s > 0 ? 0 : 1, hip = at(T, 0, -3.2, s * 1.9), ft = reach(hip, mix(P.feet[i], at(T, 1, -5.8, s * 2.2), P.limp), 3.6);
    bone(g, hip, ft, 1.1, 0.85, M.ECHO, 1, 5); ell(g, frame(mad(ft, [0.7, 0.4, 0], 1), T.f, T.u, T.r), 1.5, 0.7, 1.05, M.DISHB, 6, 3);
  }
  // yayılan ses halkaları: göğüsten ileri doğru büyür
  if (hw > 0.05) for (let k = 0; k < 2; k++) {
    const f = fr(o.t * 2.4 + k * 0.5), x = 4.6 + f * 5, r = 1.8 + f * 3.8; let prev = null;
    for (let j = 0; j <= 10; j++) { const a = j / 10 * TAU, q = at(T, x, Math.cos(a) * r - 0.4, Math.sin(a) * r); if (prev && (j + k) % 2) line(g, prev, q, M.CORE, f > 0.6 ? 0 : 2); prev = q; }
  }
  A.head = at(T, 0, 7, 0); A.mouth = at(T, 3.6, -0.5, 0);
  return A;
}
function echoPose(o) {
  const t = o.t, dead = o.dying > 0, w = dead ? 0 : o.walk, near = nearOf(o), wd = ss(0, 1, o.wind) * (1 - o.lunge), l = o.lunge, [hw, vib] = howlOf(o, 60);
  const sw = Math.sin(o.ph * TAU);
  let px = 0, py = 6.4 + Math.sin(t * 2 + o.wob) * 0.15 + Math.abs(sw) * 0.4 * w, pitch = 0, roll = sw * 7 * w, droop = 0.08 + 0.05 * Math.sin(t * 1.7 + o.wob), limp = 0, rate = 22;
  const feet = [0, 1].map(i => { const a = o.ph * TAU + i * Math.PI; return [0.3 + Math.sin(a) * 1.7 * w, Math.max(0, Math.cos(a)) * 1.3 * w, (i ? -1 : 1) * 2]; });
  if (hw > 0.001) { pitch += 12 * hw; py += 0.4 * hw; droop = 0; rate = 34; }
  if (wd > 0.001) { pitch += 12 * wd; px -= 0.8 * wd; droop = lerp(droop, 0.5, wd); }
  if (l > 0.001) { pitch -= 22 * l; px += 2.4 * l; droop = 0; rate = 40; }
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; droop = Math.max(droop, 0.7 * h); roll += near * 10 * h; py -= 0.5 * h; pitch += 8 * h; }
  // ölüm: sırtüstü devrilir, çanaklar sarkar
  if (dead) { const k = ss(0, 0.5, o.dying); pitch = 86 * k; py = lerp(py, 4, k); px = -1.5 * k; droop = k; limp = k; roll = 0; rate = 60; }
  for (const f of feet) f[0] += px;
  return { rate, px, py, pitch: pitch * D, roll: roll * D, howl: hw, vib, droop, limp, feet, zoom: o.e.scale || 1 };
}

const blob = (S, big, x) => ({ ...base, tilt: 0.3, stride: 12, shadow: 5 * S, body: 8 * S, crease: 1.6, outline: [14, 16, 22], turnRate: 10, view: o => mobView(o, 0.35), pose: blobPose, build: blobBuild(S, big), ...x });
export const DEFS = {
  shade: { ...base, w: 44, h: 52, ox: 22, oy: 24, scale: 1.05, tilt: 0.2, center: true, stride: 20, foot: 5, top: 7, shadow: 0, body: 8, crease: 1.6, outline: [10, 6, 18], turnRate: 8, view: o => mobView(o, 0.4), pose: shadePose, build: shadeBuild },
  mirrorling: { ...base, w: 48, h: 56, ox: 24, oy: 28, scale: 1, tilt: 0.2, center: true, stride: 20, foot: 5, top: 8, shadow: 0, body: 8, crease: 1.4, outline: [8, 22, 28], turnRate: 8, view: o => mobView(o, 0.5), pose: glassPose, build: glassBuild },
  quickling: blob(1, true, { w: 48, h: 32, ox: 24, oy: 24, foot: 5, top: 9 }),
  droplet: blob(0.56, false, { w: 24, h: 18, ox: 12, oy: 13, foot: 3, top: 4 }),
  leech: { ...base, w: 52, h: 52, ox: 26, oy: 26, tilt: 0, center: true, stride: 9, foot: 6, top: 7, shadow: 0, body: 10, crease: 2, outline: [20, 4, 8], view: () => 0, pose: leechPose, build: leechBuild },
  yilan: { ...base, w: 52, h: 52, ox: 26, oy: 26, scale: 1.05, tilt: 0, center: true, stride: 14, foot: 5, top: 5, shadow: 0, body: 7, crease: 1.4, outline: [4, 14, 20], view: () => 0, pose: eelPose, build: eelBuild },
  howler: { ...base, w: 48, h: 40, ox: 24, oy: 30, scale: 0.92, tilt: 0.26, stride: 10, foot: 6, top: 11, shadow: 7, body: 10, crease: 1.6, outline: [16, 8, 16], turnRate: 8, view: o => mobView(o, 0.42), pose: howlPose, build: howlBuild },
  echoer: { ...base, w: 60, h: 48, ox: 30, oy: 34, scale: 0.9, tilt: 0.26, stride: 7, foot: 6, top: 12, shadow: 6, body: 11, crease: 1.6, outline: [12, 10, 20], turnRate: 8, view: o => mobView(o, 0.5), pose: echoPose, build: echoBuild },
};
