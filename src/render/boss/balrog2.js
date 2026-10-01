// Balrog (v2): filmdeki Durin'in Felaketi. Kendi ateşiyle aydınlanan kapkara bir dev: yukarıdan vuran kor ışığı, göğsünde yanan ocak,
// yüzü iki yandan saran kalın koç boynuzları, başından sırtına yükselen alev yelesi, yere uzanan alev kılıcı; kanatların kemik iskeleti
// katı, zarı gölgedendir (uçlara doğru seyrelir).
// Kamçının kendisi, duman ve korlar balrog.js'te (2B) çizilir; burada gövde ve duruşlar var. Eski model: balrog.js (?balrog=1).
import { line, dot, vert, tri } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mad, mix, norm, at, turn, frame, bone, ball, ell, tube, skin, loft, flame, spike, batWing, aimLocal, meleeK, viewOf } from './rig.js';
import { biped, stride } from './biped.js';

const M = { SKIN: 1, LAVA: 2, HORN: 3, WING: 4, WING_OUT: 5, EDGE: 6, FLAME: 7, BLADE: 8, EYE: 9, MOUTH: 10, IRON: 11, FORE: 12, CORE: 13, ROCK: 14, BLAZE: 15, FANG: 16, FACE: 17, SHADE: 18, SHADE2: 19, SHADE3: 20, WBONE: 21 };
const S = { hip: 29.6, spine: 15, neck: 9.4, headX: 5, shW: 14.2, shY: -0.6, hipW: 6.6, arm: [12.5, 12], leg: [13, 11], ankle: 7.2 }, HK = 1.85;
const WING = {
  // kapalı: bilek başın üstünde, parmaklar sırttan aşağı pelerin gibi sarkar; açık: yelken gibi yukarı ve geriye
  fold: { h: [-0.7, 0.68, 0.3], a: [-0.42, 0.88, 0.22], f: [[0.1, -1, 0.05], [-0.3, -0.95, 0.1], [-0.6, -0.8, 0.15], [-0.86, -0.5, 0.2]] },
  open: { h: [-0.6, 0.7, 0.4], a: [-0.35, 0.9, 0.3], f: [[0.2, 0.97, 0.15], [-0.4, 0.9, 0.2], [-0.85, 0.5, 0.25], [-1, -0.1, 0.25]] },
  fly: { h: [-0.25, 0.45, 0.86], a: [-0.1, 0.55, 0.83], f: [[0.1, 0.8, 0.6], [-0.12, 0.4, 0.9], [-0.28, -0.12, 0.95], [-0.42, -0.6, 0.68]] },
  arm: [14, 17], fingers: [26, 32, 29, 22], r: [2.3, 1.7, 1.6, 1.1], memb: M.SHADE, bands: [M.SHADE, M.SHADE2, M.SHADE3], finger: 0.95, bone: M.WBONE, claw: M.HORN, tone: 2, scallop: 0.32,
};
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb);
const fr = x => x - Math.floor(x), cell = (a, b) => fr(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
let fire = 1, now = 0, plate = 0;
// kabuk plakaları (hücre deseni): dönen değer en yakın çatlağa uzaklık, plate o plakanın tonu
function plates(u, v, sx, sy) {
  const x = u * sx, y = v * sy, ix = Math.floor(x), iy = Math.floor(y); let d1 = 9, d2 = 9, ax = 0, ay = 0, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wy = ((cy % sy) + sy) % sy, h = cell(cx, wy), px = cx + 0.15 + 0.7 * h, py = cy + 0.15 + 0.7 * cell(wy + 31, cx + 17), d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < d1) { d2 = d1; bx = ax; by = ay; d1 = d; ax = px; ay = py; plate = h; } else if (d < d2) { d2 = d; bx = px; by = py; }
  }
  return (d2 - d1) / (2 * Math.hypot(bx - ax, by - ay) + 1e-6);
}
// kor çatlağı: ateş yanıyorsa parlar (ısı nabız gibi dolaşır), sönünce kararır
const ember = (d, w, heat, u, i, out) => {
  if (fire > 0.08) { out.id = M.LAVA; return 0.08 + Math.min(1.5, fire) * heat * (0.78 + 0.22 * Math.sin(now * 3.2 - u * 0.4)) + (d < w * 0.45 ? 0.22 : 0); }
  return i - 0.3;
};
// uzuvlar: seyrek, ince çatlaklı kara kabuk
const crust = (w, heat, sx, sy) => (u, v, i, out) => {
  const d = plates(u, v, sx, sy);
  return d < w ? ember(d, w, heat, u, i, out) : i + (plate - 0.5) * 0.16;
};
// gövde: çatlaklar göğüs ve karında (v = 0.25 ön) genişler ve ısınır; sırt kapkara kalır
const core = (u, v, i, out) => {
  const f = Math.max(0, Math.sin(v * TAU)), d = plates(u, v, 0.105, 5), w = (0.02 + 0.075 * f * f) * Math.min(1, Math.max(0, (33 - u) / 8));
  return d < w ? ember(d, w, 0.24 + 0.5 * f, u, i, out) : i + (plate - 0.5) * 0.16 - (f > 0.3 && d < w * 2.2 ? 0.14 : 0);
};
const hot = u => 0.96 - u * 0.8;
// kabuk rengi: gölgede kapkara, yukarıdan vuran ateş ışığında kızıl kahve
const HIDE = ramp('#020101', '#050202', '#0d0605', '#1c0c08', '#42200f');
const MATS = [];
MATS[M.SKIN] = { ramp: HIDE, px: crust(0.03, 0.2, 0.055, 2) };
MATS[M.ROCK] = { ramp: HIDE };
MATS[M.CORE] = { ramp: HIDE, px: core };
// ön kollar ve kafa bir ton açık: gövdenin önünden geçerken okunur
MATS[M.FORE] = { ramp: ramp('#040202', '#0c0504', '#1a0b08', '#34170d', '#6c3416'), px: crust(0.03, 0.2, 0.07, 2) };
MATS[M.FACE] = { ramp: ramp('#020101', '#070303', '#110706', '#200e09', '#422010') };
MATS[M.LAVA] = { ramp: ramp('#5a0c06', '#a8200a', '#ee5a14', '#ffa030', '#ffe890'), flat: true, glow: 1 };
// boynuz: enine boğumlu, ateş ışığında kemik rengi
MATS[M.HORN] = { ramp: ramp('#070504', '#190f09', '#342112', '#604022', '#a6763c'), px: (u, v, i) => i - (fr(u * 0.3) < 0.36 ? 0.36 : 0) + u * 0.004 };
MATS[M.FANG] = { ramp: ramp('#020101', '#050202', '#0a0403', '#120706', '#1c0c08'), flat: true };
MATS[M.WING] = { ramp: ramp('#030202', '#090506', '#12090b', '#1e1013', '#2e181a'), back: M.WING_OUT };
MATS[M.WING_OUT] = { ramp: ramp('#020101', '#060304', '#0c0607', '#150b0d', '#1e1214') };
MATS[M.EDGE] = { ramp: MATS[M.WING_OUT].ramp, dither: 2, back: M.EDGE };
// gölge zar: kemiklerin arasında duman gibi, bilekten uca doğru seyrelir
const DUSK = ramp('#020102', '#060406', '#0c080b', '#150e12', '#20151b');
MATS[M.SHADE] = { ramp: DUSK, dither: 3, back: M.SHADE };
MATS[M.SHADE2] = { ramp: DUSK, dither: 2, back: M.SHADE2 };
MATS[M.SHADE3] = { ramp: DUSK, dither: 1, back: M.SHADE3 };
MATS[M.WBONE] = { ramp: ramp('#050303', '#120908', '#28130c', '#4c2410', '#8a481e') };
// alev: dışta kızıl diller, içinde sarı çekirdek
MATS[M.BLAZE] = { ramp: ramp('#5a0a04', '#a81c08', '#e2440c', '#ff7c1a', '#ffb23c'), flat: true, glow: 1, soft: true, px: u => 0.9 - u * 0.78 };
MATS[M.FLAME] = { ramp: ramp('#c8300c', '#f2600e', '#ff9a22', '#ffd04a', '#fff6c0'), flat: true, glow: 1, soft: true, px: hot };
MATS[M.BLADE] = { ramp: ramp('#2a1410', '#c8300c', '#ff7a1a', '#ffc850', '#fff6c8'), flat: true, glow: 1, px: (u, v) => fire > 0.08 ? 0.5 + Math.min(1.3, fire) * 0.3 - Math.abs(Math.sin(v * TAU)) * 0.22 - u * 0.006 : 0.1 };
MATS[M.EYE] = { ramp: ramp('#c84a08', '#ff8a10', '#ffc030', '#ffe870', '#fffbd0'), flat: true, glow: 1 };
MATS[M.MOUTH] = { ramp: ramp('#3a0806', '#8a1808', '#e04a10', '#ffa030', '#ffe478'), flat: true, glow: 1, px: () => 0.2 + Math.min(1, fire) * 0.7 };
MATS[M.IRON] = { ramp: ramp('#0a0808', '#1c1616', '#34282a', '#544444', '#7a6a68') };

// alev dili: dışta kızıl, içinde kameraya yakın duran sarı çekirdek
function blaze(g, base, h, r, back, sway, cam) {
  flame(g, base, mad(mad(base, [0, 1, 0], h), back, h), r, M.BLAZE, sway);
  const b = mad(base, cam, r * 0.8), k = 0.56;
  flame(g, b, mad(mad(b, [0, 1, 0], h * k), back, h * k), r * 0.56, M.FLAME, [sway[0] * 0.6, sway[1], sway[2] * 0.6]);
}

// kafa: iki dev koç boynuzunun arasında dar, kapkara bir yüz ve içi ateş dolu koca bir ağız. Boynuzlar tepeden çıkar, yanlara açılıp
// yüzün iki yanından aşağı iner, uçları çenenin altında içe ve öne kıvrılır; boğum boğumdur. Çatık kaşın altında küçük kor gözler.
function skull(g, F, P, A) {
  const jaw = P.jaw, K = HK, h = (x, y, z) => at(F, x * K, y * K, z * K), Lw = turn(frame(h(-0.8, -1, 0), F.f, F.u, F.r), 0, -jaw * 0.85 - 0.05), l = (x, y, z) => at(Lw, x * K, y * K, z * K);
  const quad = (a, b, c, d, n) => { const va = vert(g, a, n), vb = vert(g, b, n), vc = vert(g, c, n), vd = vert(g, d, n); tri(g, va, vb, vc, M.MOUTH); tri(g, va, vc, vd, M.MOUTH); };
  // boynuzların arasını dolduran ense ve yanaklar
  ell(g, frame(h(-1.8, 0.8, 0), F.f, F.u, F.r), 3 * K, 3.9 * K, 4.6 * K, M.ROCK, 8, 5);
  loft(g, Lw, [[-0.4, -0.5, 2.8, 1.3], [1.6, -0.9, 2.6, 1.3], [3.2, -0.9, 2.3, 1.2], [4.1, -0.7, 1.9, 1]], 8, M.FACE, { ceil: 0.2, flat: M.MOUTH, back: true, k: K });
  loft(g, F, [[-4, 1.4, 2.2, 2.2], [-2.4, 1.8, 3, 2.9], [-0.6, 2, 3.3, 3.1], [1, 1.9, 3.3, 2.9], [2.4, 1.3, 3, 2.4], [3.6, 0.8, 2.6, 2], [4.4, 0.6, 2.2, 1.7]], 8, M.FACE, { floor: -0.85, flat: M.MOUTH, back: true, k: K });
  // çatık kaş: ortada alçak, uçlarda yüksek
  tube(g, [h(1.2, 3, -3), h(2.5, 2.7, -1.5), h(3, 2.1, 0), h(2.5, 2.7, 1.5), h(1.2, 3, 3)], [0.9, 1.2, 1.05, 1.2, 0.9], 5, M.ROCK);
  // ağzın içi: gırtlak duvarı, çene açıldıkça ateş görünür
  quad(h(0.6, -0.9, -2.3), h(0.6, -0.9, 2.3), l(1, 0.1, 2.3), l(1, 0.1, -2.3), F.f);
  for (const s of [-1, 1]) {
    if (jaw > 0.1) { const n = [F.r[0] * s, F.r[1] * s, F.r[2] * s], a = vert(g, h(-0.2, -0.9, s * 2.3), n), b = vert(g, h(4, -0.9, s * 1.8), n), c = vert(g, l(3.7, 0.15, s * 1.8), n); tri(g, a, b, c, M.MOUTH); }
    // dişler: ateşin önünde kara siluet; önde uzun köpek dişleri
    for (let i = 0; i < 3; i++) {
      const x = 4 - i * 1.2, z = s * (1.4 + i * 0.4), long = i ? 1.2 - i * 0.15 : 2.2;
      spike(g, h(x, -0.75, z), h(x + 0.1, -0.75 - long, z * 1.04), i ? 0.5 : 0.7, M.FANG, 3);
      spike(g, l(x - 0.5, 0.15, z * 0.94), l(x - 0.4, 0.15 + long * 0.8, z * 0.98), i ? 0.5 : 0.65, M.FANG, 3);
    }
    tube(g, [[0.2, 3, 1.5], [-0.6, 4.5, 3], [-1.2, 4.7, 4.6], [-1.3, 3.4, 5.9], [-0.8, 1.2, 6.4], [0.3, -1.1, 6], [1.7, -2.8, 4.9], [3.1, -3.6, 3.6], [4.2, -3.5, 2.6]].map(([x, y, z]) => h(x, y, z * s)),
      [2.5, 2.6, 2.6, 2.5, 2.3, 2, 1.6, 1, 0.25], 8, M.HORN);
    const e = h(3.15, 1.5, s * 1.9), lit = P.eye > 0.5;
    dot(g, e, M.EYE, lit ? 4 : 1); dot(g, e, M.EYE, lit ? 4 : 0, 1, 0); dot(g, e, M.EYE, lit ? 3 : 0, -1, 0); dot(g, e, M.EYE, lit ? 2 : 0, 0, 1); dot(g, e, M.EYE, lit ? 1 : 0, 1, 1);
    if (fire > 0.3) dot(g, h(4.5, 0.9, s * 0.8), M.LAVA, 3);
    if (s > 0 === !(P.near < 0)) A.eye = e;
  }
  A.mouth = h(4.4, -1.4 - jaw * 1.5, 0);
}

function build(g, P, o) {
  fire = P.fire; now = o.t;
  const K = biped(P, S), A = {}, { pel, waist, chest, head } = K, t = o.t, br = 1 + P.br, heat = Math.min(1.4, fire);
  const va = o.view + (P.spin || 0), cam = [Math.sin(va), 0, Math.cos(va)], fw = norm([pel.f[0], 0, pel.f[2]]), sd = [fw[2], 0, -fw[0]];
  for (const s of [-1, 1]) {
    const w = batWing(g, chest, at(chest, -6, 1.4, s * 5), at(pel, -3.6, 3, s * 3.4), s, P.wing, WING);
    // tutuşan kanat: kol ve parmak kemikleri boyunca, rüzgârla geriye yatan alev dilleri
    if (P.burn > 0.05 && fire > 0.05) [w.E, w.Wr, ...w.tips, ...w.tips.map(q => mix(w.Wr, q, 0.5))].forEach((b, i) => {
      const h = (5.5 + Math.sin(t * (9 + i * 0.7) + i * 2.1 + s) * 2.4) * P.burn;
      flame(g, b, mad(mad(b, [0, 1, 0], h), pel.f, -h * (0.3 + P.drag)), 1.6, M.FLAME, [0, 0, Math.sin(t * 6 + i) * 0.8]);
    });
  }
  // gövde: dar bel, fıçı göğüs, dev omuzlar, ensede kambur; baş omuzların arasına gömülü
  skin(g, [
    { p: at(pel, -0.4, -4.5, 0), u: pel.f, rx: 4.6, ry: 4.2 }, { p: at(pel, -0.2, 0, 0), u: pel.f, rx: 7.2, ry: 5.6 }, { p: waist.p, u: waist.f, rx: 5.4, ry: 4.6 },
    { p: at(chest, 1.2, -6.4, 0), u: chest.f, rx: 10.4 * br, ry: 9.6 * br }, { p: at(chest, 1.2, -1.4, 0), u: chest.f, rx: 14.6, ry: 11 * br },
    { p: at(chest, -1, 2.6, 0), u: chest.f, rx: 9, ry: 8 }, { p: at(chest, 1.6, 6.4, 0), u: chest.f, rx: 5, ry: 4.8 }, { p: at(chest, 3.6, 9.4, 0), u: chest.f, rx: 3.8, ry: 3.8 },
  ], 10, M.CORE, { sub: 2 });
  // sırt dikenleri (alev yelesinin kökleri)
  const sp = [];
  for (let i = 0; i < 4; i++) { const b = at(chest, -8, 3 - i * 4.2, 0), tip = at(chest, -12.2 + i * 0.5, 5.4 - i * 4, 0); spike(g, b, tip, 1.6, M.HORN, 4); sp.push(tip); }
  const limb = (a, b, c, r0, r1, r2, m) => { bone(g, a, b, r0, r1, M.SKIN, 1.24); ball(g, b, r1, M.ROCK); bone(g, b, c, r1 * 0.96, r2, m, 1.16); };
  for (const [s, Ar] of [[1, K.R], [-1, K.L]]) {
    ball(g, Ar.sh, 5.3, M.ROCK, 7); limb(Ar.sh, Ar.el, Ar.wr, 4.5, 3.5, 3.1, M.FORE); ball(g, at(Ar.hand, 1.6, 0, 0), 3.4, M.ROCK);
    for (let k = -1; k <= 1; k++) line(g, at(Ar.hand, 4.8, 0.4, k * 1.9), at(Ar.hand, 7.4, -0.8, k * 2.4), M.HORN, 2);
    // omuz ve dirsek dikenleri
    spike(g, mad(Ar.sh, chest.u, 3.4), mad(mad(mad(Ar.sh, chest.u, 8.4), chest.r, s * 3.4), chest.f, -1.8), 1.7, M.HORN);
    spike(g, mad(mad(Ar.sh, chest.u, 2.6), chest.r, s * 3), mad(mad(Ar.sh, chest.u, 5.4), chest.r, s * 7.4), 1.3, M.HORN);
    spike(g, Ar.el, mad(Ar.el, norm([Ar.el[0] - Ar.wr[0] - chest.f[0] * 6, Ar.el[1] - Ar.wr[1], Ar.el[2] - Ar.wr[2] - chest.f[2] * 6]), 4.6), 1.3, M.HORN);
  }
  // bacaklar: kalın uyluk, geriye bükülen baldır; topuk havada, pençe yerde
  for (const L of [K.legR, K.legL]) {
    const hock = mad(L.ank, fw, -2.6), paw = mad([L.foot[0], L.foot[1] + 1.6, L.foot[2]], fw, 1.6), toe = mad(paw, fw, 5.4);
    bone(g, L.hip, L.knee, 5.8, 3.9, M.SKIN, 1.24); ball(g, L.knee, 3.9, M.ROCK); bone(g, L.knee, hock, 3.7, 2.5, M.SKIN, 1.2); ball(g, hock, 2.5, M.ROCK, 5);
    bone(g, hock, paw, 2.4, 2.2, M.FORE, 1, 6); bone(g, paw, toe, 2.5, 1.6, M.FORE, 1, 6, true);
    for (let k = -1; k <= 1; k++) line(g, mad(mad(toe, sd, k * 1.7), fw, 1.4), mad(mad(mad(toe, fw, 3.6), sd, k * 2.3), [0, 1, 0], -0.9), M.HORN, 2);
  }
  skull(g, head, P, A);
  // alev yelesi: tepeden enseye, omuzlara ve sırt dikenlerine yayılan, her biri kendi hızında dalgalanan diller
  if (fire > 0.05) {
    const bz = P.blaze || 0, hh = (x, y, z) => at(head, x * HK, y * HK, z * HK), back = [-fw[0] * (0.22 + P.drag * 0.6), 0, -fw[2] * (0.22 + P.drag * 0.6)];
    const bases = [
      [hh(-2, 3.6, 0), 14, 2.6], [hh(-3, 3.4, 2.6), 12, 2.3], [hh(-3, 3.4, -2.6), 12, 2.3], [hh(-3.4, 2, 4.6), 9, 2], [hh(-3.4, 2, -4.6), 9, 2], [at(chest, -2.4, 9.6, 0), 15, 2.7], [at(chest, -6, 6.4, 3), 18, 3], [at(chest, -5.4, 5, -2.6), 15, 2.8],
      [mad(K.R.sh, chest.u, 5), 11, 2.4], [mad(K.L.sh, chest.u, 5), 11, 2.4], [mad(at(chest, -8.4, 1, 0), cam, 9), 13, 2.8], ...sp.slice(1).map((q, i) => [mad(q, cam, 10), 10 - i * 1.6, 2.2 - i * 0.2]),
    ];
    bases.forEach(([base, h0, r], i) => {
      const h = h0 * (0.84 + 0.2 * Math.sin(t * (6.4 + i * 0.7) + i * 2.3) + 0.1 * Math.sin(t * 13.7 + i * 5.1) + 0.9 * bz) * heat, sw = Math.sin(t * 4.6 + i * 1.7) * 1.8;
      blaze(g, base, h, r, back, [sw * sd[0] - fw[0], 0.4, sw * sd[2] - fw[2]], cam);
    });
    // öfke alevi: dirseklerden, bileklerden, dizlerden ve belden yükselen diller
    if (bz > 0.05) [K.R.el, K.L.el, K.R.wr, K.L.wr, K.legR.knee, K.legL.knee, at(pel, -4, 2, 0)].forEach((q, i) => {
      const h = (3 + 8 * bz) * (0.8 + 0.3 * Math.sin(t * (8 + i) + i * 2)), sw = Math.sin(t * 6 + i) * 1.2;
      blaze(g, mad(q, cam, 2.6), h, 1.7, back, [sw * sd[0], 0.3, sw * sd[2]], cam);
    });
  }
  // kılıç: bilekten; kabza, balçak ve baştan uca yanan geniş namlu. Yönü gövdeye göre: sword = yükselme açısı (0 ileri, 90 yukarı, 180 geri), swOut = yana açılma
  const H = K.R.hand, sa = P.sword, ca = Math.cos(sa), bd = norm([fw[0] * ca - sd[0] * P.swOut, Math.sin(sa), fw[2] * ca - sd[2] * P.swOut]), grip = at(H, 1.6, 0, 0);
  bone(g, mad(grip, bd, -3.2), mad(grip, bd, 2.4), 0.9, 0.9, M.IRON, 1, 5, true);
  bone(g, mad(mad(grip, bd, 2.6), H.r, -3.4), mad(mad(grip, bd, 2.6), H.r, 3.4), 1, 1, M.IRON, 1, 5, true);
  tube(g, [3, 8, 15, 22, 27].map(d => mad(grip, bd, d)), [1.5, 2.2, 2, 1.4, 0.3], 5, M.BLADE);
  if (fire > 0.15) for (let i = 0; i < 5; i++) {
    const b = mad(grip, bd, 5 + i * 4.8), h = (5 + Math.sin(t * (9 + i) + i * 3) * 2) * Math.min(1.3, fire);
    blaze(g, b, h, 1.5, [-bd[0] * 0.3, 0, -bd[2] * 0.3], [0, 0, Math.sin(t * 6 + i) * 0.8], cam);
  }
  A.tip = mad(grip, bd, 27); A.chest = at(chest, 6, -5, 0); A.hand = at(K.L.hand, 2, 0, 0); A.head = head.p;
  return A;
}

// ---------- duruşlar ----------
const DIE_T = 2.6;
// dururken ve yürürken göğsünü kameraya açar; saldırırken hedefe döner (darbe yandan okunur)
const SIDE = { sword: 1, whip: 1, breath: 1, melee: 1 };
const view = o => viewOf(o.yaw, !o.dying && (SIDE[o.act] || (o.act === 'swoop' && o.stage !== 'flap')) ? 0.42 : 0.95 - 0.4 * (o.dying ? 0 : o.walk), 0.4);
function pose(o) {
  const t = o.t, A = o.A, rage = o.rage ? 1 : 0, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1;
  const br = Math.sin(t * 2.2 + o.wob), sway = Math.sin(t * 0.9 + o.wob);
  let x = sway * 0.5, y = br * 0.35, lean = 1, twist = 0, roll = sway * 0.8, jaw = 0.62 + 0.08 * br, fr0 = rage ? 1.3 : 1, sword = 205, swOut = 0.45, sink = 0, rate = 20, lookW = 0.8, eye = 1, c = 0, r = 0, shadow = 1, spin = 0, burn = 0, drag = 0, swell = 0;
  const bend = [2, 0, 0], head = [4, 0, 0], R = { sw: -6 + br * 1.5, ab: 36, tw: 0, el: 22 }, L = { sw: 6 - br * 1.5, ab: 24, tw: 0, el: 34 }, fR = [-1, 0, 8.5], fL = [1.5, 0, -8.5];
  const wing = { open: 0.3 + rage * 0.2, fan: 0.36 + rage * 0.2, flap: Math.sin(t * 1.4) * 0.05, lean: 0.12 * near, sweep: 0, wave: Math.sin(t * 3) * 0.2, span: 0.3 };

  if (w > 0.01) {
    // ağır adım: kalça ve omuz ters döner, kılıç kolu az, kamçı kolu çok sallanır
    // uzun, ağır adımlar: gövde dik, göğüs önde; kalça ve omuz ters döner, baş sabit kalır, her basışta ağırlık çöker
    const ph = o.ph, a = stride(ph, 8.4, 6, 0.6), b = stride(ph + 0.5, 8.4, 6, 0.6), c1 = Math.cos(ph * TAU), s1 = Math.sin(ph * TAU), dip = Math.cos(ph * 2 * TAU);
    fR[0] += a[0] * w; fR[1] += a[1] * w; fL[0] += b[0] * w; fL[1] += b[1] * w;
    y -= (1 + 1.1 * dip) * w; roll += s1 * 3 * w; twist -= c1 * 9 * w; bend[1] += c1 * 16 * w; head[1] -= c1 * 7 * w; lean += 3 * w; bend[0] -= 3 * w;
    L.sw += c1 * 16 * w; L.el -= 12 * w; R.sw -= c1 * 9 * w; wing.open += 0.12 * w; wing.fan += 0.1 * w; wing.flap += Math.sin(ph * 2 * TAU) * 0.07 * w; drag = 0.3 * w;
  }
  if (o.act === 'sword' && A) {
    lookW = 0.4;
    // iki elle başının üstüne kaldırır, geriye gerilir; sonra bütün gövdesiyle yere indirir
    const k = o.stage === 'raise' ? ss(0, 1, 1 - A.st / 0.8) : 1, kk = o.stage === 'raise' ? 0 : clamp(1 - A.st / 0.7, 0, 1), hit = ss(0, 0.16, kk), rec = ss(0.6, 1, kk), up = k * (1 - hit), dn = hit * (1 - rec);
    R.sw += 172 * up + 66 * dn; R.ab += -18 * up - 22 * dn; R.el += 2 * up + 14 * dn;
    L.sw += 176 * up + 62 * dn; L.ab += -40 * up - 40 * dn; L.el += 30 * up - 30 * dn;
    sword += -100 * up - 228 * dn; swOut *= 1 - Math.max(up, dn); lean += -12 * up + 14 * dn; bend[0] += -24 * up + 12 * dn; y += 1.5 * up - 5.5 * dn; x += -1 * up + 2 * dn;
    head[0] += 10 * up - 8 * dn; fR[0] += 4 * dn; fL[0] -= 2 * dn; wing.open += 0.35 * up + 0.4 * dn; wing.fan += 0.3 * up + 0.3 * dn; wing.flap += 0.2 * up - 0.18 * dn;
    jaw = Math.max(jaw, 0.6 * dn); fr0 *= 1 + 0.25 * up; if (dn > 0.3) x += Math.sin(t * 50) * 0.3 * (1 - rec); rate = 34;
  } else if (o.act === 'whip' && A) {
    const ap = clamp(aimLocal(Math.cos(o.aim || 0), Math.sin(o.aim || 0), o.view)[1], -0.7, 0.9) / D;
    if (o.stage === 'wind') {
      // kamçı kolu arkaya, omuzlar geriye döner
      const k = ss(0, 1, o.wind);
      L.sw += -64 * k; L.ab += 34 * k; L.el += 60 * k; bend[1] -= 32 * k; x -= 1.5 * k; lean -= 6 * k; R.sw += 12 * k; wing.open += 0.15 * k;
    } else if (o.stage === 'lash') {
      // kol nişan yönünde savrulur, gövde arkasından gelir, sonra aşağı doğru takip eder
      const k = clamp(1 - A.st / 0.36, 0, 1), f = ss(0, 0.4, k), fol = ss(0.5, 1, k);
      L.sw += lerp(-64, 104 + ap, f) - 36 * fol; L.ab += lerp(34, -12, f); L.el += lerp(60, -20, f); bend[1] += lerp(-32, 12, f); lean += lerp(-6, 9, f) - 3 * fol; x += lerp(-1.5, 2.5, f);
      fL[0] += 3 * f; jaw = Math.max(jaw, 0.5 * f); wing.open += 0.2; rate = 40;
    }
    lookW = 0.5;
  } else if (o.act === 'melee') {
    // pençe: boş elini geriye açar, omzunu çevirip madencinin üstüne savurur
    const [up, dn] = meleeK(o);
    L.sw += -52 * up + 96 * dn; L.ab += 36 * up - 14 * dn; L.el += 52 * up - 26 * dn; bend[1] += -28 * up + 20 * dn; lean += -6 * up + 13 * dn; bend[0] += -4 * up + 8 * dn; x += -1.5 * up + 2.8 * dn; y -= 2 * dn;
    R.sw += 10 * up; fL[0] += 3.5 * dn; head[0] -= 4 * dn; jaw = Math.max(jaw, 0.7 * dn); wing.open += 0.18 * up + 0.22 * dn; wing.fan += 0.15 * dn; wing.flap += 0.12 * up - 0.12 * dn; fr0 *= 1 + 0.2 * dn; rate = 44; lookW = 0.5;
  } else if (o.act === 'wings' && A) {
    const tt = 2.2 - A.T;
    c = ss(0, 0.85, tt) * (1 - ss(0.88, 0.97, tt)); r = ss(0.88, 0.98, tt) * (1 - 0.85 * ss(0.5, 1.3, tt - 0.9)); rate = 30;
  } else if (o.act === 'breath' && A) {
    const ap = clamp(aimLocal(Math.cos(o.aim || 0), Math.sin(o.aim || 0), o.view)[1], -0.7, 0.8) / D;
    lookW = 0;
    if (o.stage === 'inhale') {
      // soluk alır: geriye yaslanır, göğsü şişer ve korlaşır, kollar ve kanatlar geriye açılır
      const k = ss(0, 1, o.wind);
      lean -= 12 * k; bend[0] -= 18 * k; head[0] += 14 * k; y += 1.6 * k; x -= 1.6 * k; swell = k; jaw = 0.14 * k; fr0 *= 1 + 0.45 * k;
      R.sw -= 22 * k; R.ab += 14 * k; L.sw -= 28 * k; L.ab += 18 * k; wing.open += 0.45 * k; wing.fan += 0.35 * k; wing.flap += 0.16 * k; rate = 26;
    } else if (o.stage === 'fire') {
      // öne atılır, çene ardına kadar açılır; gövde püskürmenin gücüyle titrer, kanatlar geride gerilir
      const k = ss(0, 0.16, o.sinceStage), sh = Math.sin(t * 40) * 0.35;
      lean += 14 * k; bend[0] += 10 * k; head[0] += (4 + ap * 0.7) * k; jaw = k; x += 2.2 * k + sh; y -= 1.2 * k; fL[0] += 3.5 * k; swell = 0.6 * k; fr0 *= 1.45;
      R.sw -= 34 * k; R.ab += 22 * k; R.el += 14 * k; L.sw -= 38 * k; L.ab += 26 * k; L.el += 10 * k;
      wing.open += 0.6 * k; wing.fan += 0.55 * k; wing.flap += -0.1 * k + Math.sin(t * 15) * 0.05; wing.wave += 0.6; rate = 38;
    }
  } else if (o.act === 'swoop' && A) {
    lookW = 0.3;
    if (o.stage === 'flap') {
      // çömelir; kanatlar ardına kadar açılıp hızlanan vuruşlarla çırpar ve tutuşur, her vuruş gövdeyi kaldırır
      const k = ss(0, 0.45, o.wind), up = ss(0.7, 1, o.wind), fl = Math.sin(t * (9 + 5 * o.wind));
      y += -5 * k + (Math.max(0, -fl) * 2 + 3 * up) * k; lean += 11 * k - 6 * up; bend[0] += 9 * k; head[0] += 10 * k; jaw = 0.45 * k; fr0 *= 1 + 0.3 * k;
      wing.open = lerp(wing.open, 1, k); wing.fan = lerp(wing.fan, 1, k); wing.span = lerp(0.3, 0.75, k); wing.flap += fl * 0.5 * k; wing.wave += k;
      burn = ss(0.2, 0.75, o.wind); R.ab += 14 * k; L.ab += 16 * k; R.el += 34 * k; L.el += 30 * k; rate = 34;
    } else if (o.stage === 'fly') {
      // uçuş: gövde öne yatar, bacaklar geride toplanır, kılıç ileride; konmadan önce doğrulup ayaklarını uzatır
      const k = clamp(o.sinceStage / (A.dur || 1), 0, 1), fl = Math.sin(t * 12), gear = ss(0.68, 1, k), go = ss(0, 0.2, k);
      lean += (50 - 44 * gear) * go; bend[0] -= 14 * go; head[0] += (28 - 20 * gear) * go; y += 4 * go; jaw = 0.7; fr0 *= 1.35; burn = 1; drag = 0.9 * (1 - gear); shadow = 0;
      fR[0] = lerp(fR[0], lerp(-9, 5, gear), go); fR[1] = lerp(0, lerp(11, 3, gear), go); fL[0] = lerp(fL[0], lerp(-13, 1, gear), go); fL[1] = lerp(0, lerp(8, 2, gear), go);
      wing.open = 1; wing.fan = 1; wing.span = lerp(0.9, 0.6, gear); wing.flap += fl * 0.55 - 0.25 * gear; wing.wave += 1; wing.sweep = -0.25 * go * (1 - gear);
      R.sw += (62 - 30 * gear) * go; R.el += 16 * go; sword -= 195 * go; swOut *= 1 - go; L.sw -= 30 * go; L.ab += 20 * go; L.el += 20 * go; rate = 40;
    } else {
      // konuş: dizler çöker, kılıç yere saplanır, kanatlar yanlara çarpar; sonra ağır ağır doğrulur
      const imp = 1 - ss(0.05, 0.6, o.sinceStage), hit = 1 - ss(0, 0.2, o.sinceStage);
      y -= 9 * imp; lean += 20 * imp; bend[0] += 14 * imp; head[0] -= 6 * imp; jaw = Math.max(jaw, 0.6 * imp); x += Math.sin(t * 50) * 0.4 * hit; burn = imp; fr0 *= 1 + 0.3 * imp;
      wing.open = lerp(wing.open, 1, imp); wing.fan = lerp(wing.fan, 0.9, imp); wing.span = lerp(0.3, 0.7, imp); wing.flap -= 0.4 * imp;
      R.sw += 34 * imp; R.el += 30 * imp; sword -= 250 * imp; swOut *= 1 - imp; L.ab += 34 * imp; L.el += 24 * imp; fR[0] += 2 * imp; fL[0] -= 2 * imp; rate = 44;
    }
  }
  let blaze = rage * 0.35;
  if (rage && o.rageT < 2.3) {
    // öfke: önce büzülüp gerilir (kollar göğüste, gövde titrer, çatlaklar kızarır); sonra kükremeyle birlikte alevleri patlar
    const q = o.rageT, ten = bump(0, 0.3, 0.62, 0.78, q), roar = bump(0.66, 0.82, 1.7, 2.3, q);
    c = Math.max(c, ten); r = Math.max(r, roar); x += Math.sin(t * 60) * 0.5 * ten; y += Math.sin(t * 47) * 0.3 * ten;
    fr0 *= 1 + 0.35 * ten + 0.6 * roar; blaze = Math.max(blaze, roar); burn = Math.max(burn, roar); rate = 34;
  }
  if (rage && !dead) burn = Math.max(burn, 0.3);
  if (o.intro >= 0) {
    // çömelmiş gölgeden doğrulur, alevi tutuşur, kanatlarını açıp kükrer
    const i = o.intro; c = 1 - ss(0.3, 0.5, i); r = bump(0.45, 0.58, 0.8, 1, i); y -= 5 * c; fr0 *= clamp((i - 0.12) / 0.4, 0, 1); lookW = 0;
  }
  if (o.hurt > 0 && !dead) {
    const h = o.hurt * o.hurt, back = clamp(o.hx * Math.cos(o.view), -1, 1);
    lean -= 9 * h; bend[1] += 10 * h * near; head[0] += 12 * h; x += back * 1.6 * h; wing.open += 0.15 * h; jaw = Math.max(jaw, 0.5 * h); R.ab += 8 * h; L.ab += 8 * h;
  }
  if (dead) {
    // son bir kükreme, alev söner; dizlerinin üstüne çöker, yüzüstü yıkılır ve gölgeye gömülür
    const d = o.dying * DIE_T, kn = ss(0.35, 0.9, d), fall = ss(1, 1.7, d);
    r = bump(0, 0.1, 0.3, 0.5, d); fr0 *= o.dying < 0.12 ? 1.8 : Math.pow(1 - (o.dying - 0.12) / 0.88, 1.6);
    y += -10 * kn - 8 * fall; fR[0] -= 5 * kn; fL[0] -= 3 * kn; lean += 12 * kn + 54 * fall; bend[0] += 14 * kn + 6 * fall; head[0] += -34 * kn + 20 * fall; x += 5 * fall;
    R.sw = lerp(R.sw, 28, kn) + 50 * fall; R.el = lerp(R.el, 8, kn); L.sw = lerp(L.sw, 20, kn) + 62 * fall; L.el = lerp(L.el, 12, kn); sword = lerp(sword, 186, kn);
    wing.open = lerp(wing.open, 0.16, kn); wing.fan = lerp(wing.fan, 0.2, kn); wing.flap -= 0.3 * kn; wing.span = lerp(0.3, 0.2, kn);
    sink = Math.pow(clamp((o.dying - 0.62) / 0.38, 0, 1), 1.4) * 22; eye = 1 - ss(1.2, 1.8, d); lookW = 0; shadow = 1 - fall;
  }
  if (c > 0.001 || r > 0.001) {
    // c: büzülme (kollar göğüste, kanatlar kapalı); r: patlama (kollar ve kanatlar açık, baş geride, kükrer)
    // patlarken kameraya döner; cepheden kanatlar yana, yandan yelken gibi yukarı açılır
    spin = near * 0.3 * r; const sk = ss(0.35, 0.85, Math.abs(Math.sin(o.view + spin)));
    y += -4.5 * c + 1.5 * r; lean += 14 * c - 12 * r; bend[0] += 16 * c - 24 * r; head[0] += -18 * c + 30 * r; jaw = Math.max(jaw, r);
    for (const a of [R, L]) { a.sw += 38 * c - lerp(42, 22, sk) * r; a.ab += -22 * c + lerp(22, 52, sk) * r; a.el += 74 * c + lerp(20, -8, sk) * r; }
    sword -= 85 * r; swOut += 0.4 * r; wing.open = lerp(lerp(wing.open, 0.06, c), 1, r); wing.fan = lerp(lerp(wing.fan, 0.06, c), 1, r); wing.span = lerp(lerp(0.3, 0.1, c), sk, r);
    wing.flap += -0.22 * c + 0.28 * r + Math.sin(t * 9) * 0.05 * r; x += Math.sin(t * 45) * 0.3 * r; fr0 *= 1 + 0.3 * r; lookW *= 1 - Math.max(c, r);
  }
  // bakış: baş ve omuzlar hedefe döner
  const [ly0, lp0] = aimLocal(o.tx, o.ty + 44, o.view), ly = clamp(ly0, -1.2, 1.2) * lookW, lp = clamp(lp0, -0.6, 0.5) * lookW;
  const rad = a => ({ sw: a.sw * D, ab: a.ab * D, tw: a.tw * D, el: Math.max(0, a.el) * D });
  return {
    rate, spin, x, y, lean: lean * D, twist: twist * D, roll: roll * D, bend: [bend[0] * D, bend[1] * D + ly * 0.3, bend[2] * D], head: [head[0] * D + lp * 0.2, (head[1] + near * (16 + 14 * w) * lookW / 0.8) * D + ly * 0.15, head[2] * D],
    armR: rad(R), armL: rad(L), footR: fR, footL: fL, wing, jaw, eye, near, fire: fr0, sword: sword * D, swOut, sink, shadow, br: 0.03 * br + 0.13 * swell, burn, drag, blaze: dead ? 0 : blaze,
  };
}

export const BALROG2 = { w: 208, h: 152, ox: 104, oy: 134, scale: 1.15, tilt: 0.2, mats: MATS, stride: 32, shadow: 17, body: 54, bias: 0.95, turn: 0.4, turnRate: 3.2, outline: [8, 2, 3], view, pose, build };
