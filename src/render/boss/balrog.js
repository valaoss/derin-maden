// Balrog (v2): kambur, dev omuzlu bir alev iblisi. Soğumuş lav kabuğu gibi kapkara plakalar, aralarından sızan kor;
// boğa kafası, şakaklardan çıkıp öne kıvrılan koç boynuzları, ateş dolu ağız; tepeden kuyruğa inen alev yelesi,
// sırt dikenleri, geriye bükülen (parmak ucunda yürüyen) bacaklar, uzun kuyruk, yırtık gölge kanatları.
// Sağ elde alev kılıcı, sol elde kamçı. Kamçının kendisi, duman ve korlar balrog.js'te (2B) çizilir; burada gövde ve duruşlar var.
import { line, dot, vert, tri } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mad, mix, norm, at, turn, frame, bone, ball, tube, skin, loft, flame, spike, batWing, aimLocal } from './rig.js';
import { biped, stride } from './biped.js';

const M = { SKIN: 1, LAVA: 2, HORN: 3, WING: 4, WING_OUT: 5, EDGE: 6, FLAME: 7, BLADE: 8, EYE: 9, MOUTH: 10, IRON: 11, FORE: 12, CORE: 13, ROCK: 14 };
const S = { hip: 24, spine: 15, neck: 4, headX: 3.6, shW: 12.4, shY: -0.4, hipW: 5.4, arm: [13, 12.5], leg: [11.5, 9.5], ankle: 7.2 }, HK = 1.5;
const WING = {
  // kapalı: bilek başın üstünde, parmaklar sırttan aşağı pelerin gibi sarkar; açık: yelken gibi yukarı ve geriye
  fold: { h: [-0.75, 0.6, 0.3], a: [-0.5, 0.82, 0.2], f: [[0.12, -1, 0.05], [-0.3, -0.95, 0.1], [-0.6, -0.8, 0.15], [-0.86, -0.5, 0.2]] },
  open: { h: [-0.6, 0.7, 0.4], a: [-0.35, 0.9, 0.3], f: [[0.2, 0.97, 0.15], [-0.4, 0.9, 0.2], [-0.85, 0.5, 0.25], [-1, -0.1, 0.25]] },
  fly: { h: [-0.25, 0.45, 0.86], a: [-0.1, 0.55, 0.83], f: [[0.1, 0.8, 0.6], [-0.12, 0.4, 0.9], [-0.28, -0.12, 0.95], [-0.42, -0.6, 0.68]] },
  arm: [13, 16], fingers: [25, 30, 27, 21], r: [2, 1.4, 1.3, 0.9], memb: M.WING, edge: M.EDGE, bone: M.SKIN, claw: M.HORN, tone: 2, scallop: 0.3,
};
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb);
const fr = x => x - Math.floor(x), cell = (a, b) => fr(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
let fire = 1, now = 0, plate = 0;
// lav kabuğu: düzensiz plakalar (hücre deseni); dönen değer en yakın çatlağa uzaklık, plate o plakanın tonu
function plates(u, v, sx, sy) {
  const x = u * sx, y = v * sy, ix = Math.floor(x), iy = Math.floor(y); let d1 = 9, d2 = 9, ax = 0, ay = 0, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wy = ((cy % sy) + sy) % sy, h = cell(cx, wy), px = cx + 0.15 + 0.7 * h, py = cy + 0.15 + 0.7 * cell(wy + 31, cx + 17), d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < d1) { d2 = d1; bx = ax; by = ay; d1 = d; ax = px; ay = py; plate = h; } else if (d < d2) { d2 = d; bx = px; by = py; }
  }
  // iki plakanın sınırına gerçek uzaklık: çatlak her yerde aynı kalınlıkta kalır
  return (d2 - d1) / (2 * Math.hypot(bx - ax, by - ay) + 1e-6);
}
// çatlaklar: ateş yanıyorsa kor gibi parlar (ısı gövde boyunca nabız gibi dolaşır), sönünce kararır
const crust = (w, heat, sx, sy) => (u, v, i, out) => {
  const d = plates(u, v, sx, sy);
  if (d < w) {
    if (fire > 0.08) { out.id = M.LAVA; return 0.1 + Math.min(1.5, fire) * heat * (0.78 + 0.22 * Math.sin(now * 3.2 - u * 0.4)) + (d < w * 0.45 ? 0.24 : 0); }
    return i - 0.3;
  }
  return i + (plate - 0.5) * 0.2 - (d < w * 2.4 ? 0.12 : 0);
};
const hot = u => 0.96 - u * 0.8;
const MATS = [];
MATS[M.SKIN] = { ramp: ramp('#030203', '#0d0808', '#1c1110', '#30201a', '#503024'), px: crust(0.045, 0.2, 0.11, 3) };
// eklem yumruları: düz kabuk (çatlak deseni yok)
MATS[M.ROCK] = { ramp: ramp('#030203', '#0d0808', '#1c1110', '#30201a', '#503024') };
// gövde: çatlaklar daha geniş ve sıcak (içindeki ateş göğüsten sızar)
MATS[M.CORE] = { ramp: ramp('#030203', '#0d0808', '#1c1110', '#30201a', '#503024'), px: crust(0.06, 0.44, 0.1, 4) };
// ön kollar ve yumruklar bir ton açık: gövdenin önünden geçerken okunur
MATS[M.FORE] = { ramp: ramp('#0a0606', '#181010', '#2c1c18', '#483026', '#6e4634'), px: crust(0.045, 0.2, 0.11, 3) };
MATS[M.LAVA] = { ramp: ramp('#5a0c06', '#a8200a', '#ee5a14', '#ffa030', '#ffe890'), flat: true, glow: 1 };
// boynuz: enine boğumlu, ucu açık
MATS[M.HORN] = { ramp: ramp('#070505', '#15100e', '#2a201b', '#46372e', '#74604f'), px: (u, v, i) => i - (fr(u * 0.42) < 0.28 ? 0.2 : 0) + u * 0.012 };
MATS[M.WING] = { ramp: ramp('#040203', '#0b0607', '#150b0d', '#221215', '#321c20'), back: M.WING_OUT };
MATS[M.WING_OUT] = { ramp: ramp('#020101', '#070405', '#0d0708', '#160c0e', '#201416') };
MATS[M.EDGE] = { ramp: MATS[M.WING_OUT].ramp, dither: 2, back: M.EDGE };
MATS[M.FLAME] = { ramp: ramp('#8a1408', '#d8380c', '#ff7a1a', '#ffc040', '#fff4b8'), flat: true, glow: 1, soft: true, px: hot };
MATS[M.BLADE] = { ramp: ramp('#2a1410', '#c8300c', '#ff7a1a', '#ffc850', '#fff6c8'), flat: true, glow: 1, px: u => fire > 0.08 ? 0.42 + Math.min(1.3, fire) * 0.3 - u * 0.012 : 0.1 };
MATS[M.EYE] = { ramp: ramp('#c84a08', '#ff8a10', '#ffc030', '#ffe870', '#fffbd0'), flat: true, glow: 1 };
MATS[M.MOUTH] = { ramp: ramp('#3a0806', '#8a1808', '#e04a10', '#ff9a30', '#ffe070'), flat: true, glow: 0.8, px: () => 0.2 + Math.min(1, fire) * 0.62 };
MATS[M.IRON] = { ramp: ramp('#0a0808', '#1c1616', '#34282a', '#544444', '#7a6a68') };

// boğa kafası: geniş alın, kalın kaş, aşağı eğimli burun, sivri dişli çene; şakaklardan çıkıp geriye savrulan, sonra öne kıvrılan boynuzlar
function skull(g, F, P, A) {
  const jaw = P.jaw, K = HK, h = (x, y, z) => at(F, x * K, y * K, z * K), Lw = turn(frame(h(-0.8, -1.1, 0), F.f, F.u, F.r), 0, -jaw * 0.8 - 0.06), l = (x, y, z) => at(Lw, x * K, y * K, z * K);
  loft(g, Lw, [[-0.6, -0.5, 2.7, 1.2], [2.4, -0.7, 2.3, 1], [4.6, -0.6, 1.6, 0.8], [5.6, -0.4, 1, 0.6]], 6, M.FORE, { ceil: 0.25, flat: M.MOUTH, back: true, k: K });
  loft(g, F, [[-3.6, 1.4, 2.8, 2.8], [-1.2, 2, 4, 3.4], [1.2, 1.9, 3.9, 3], [2.9, 1.1, 3, 2.2], [4.7, 0.2, 2.2, 1.6], [6, -0.3, 1.4, 1.1]], 8, M.FORE, { floor: -0.9, flat: M.MOUTH, back: true, k: K });
  tube(g, [h(1.5, 2.7, -2.9), h(2.5, 3.2, -1.2), h(2.5, 3.2, 1.2), h(1.5, 2.7, 2.9)], [0.9, 1.3, 1.3, 0.9], 5, M.ROCK);
  if (jaw > 0.12) {
    const n = F.r, a = h(-0.6, -1, 0), b = h(5.2, -1, 0), c = l(5, 0.2, 0);
    tri(g, vert(g, a, n), vert(g, b, n), vert(g, c, n), M.MOUTH);
  }
  for (const s of [-1, 1]) {
    // üst köpek dişleri ve alt çeneden yukarı çıkan dişler
    spike(g, h(4.7, -0.8, s * 1.5), h(4.9, -2.5, s * 1.6), 0.55, M.HORN, 3); spike(g, h(3, -0.9, s * 2.3), h(3, -2, s * 2.4), 0.45, M.HORN, 3);
    spike(g, l(4.5, 0.2, s * 1.2), l(4.7, 1.7, s * 1.3), 0.5, M.HORN, 3); spike(g, l(2.8, 0.2, s * 1.9), l(2.8, 1.2, s * 2), 0.4, M.HORN, 3);
    tube(g, [[-0.6, 2.8, 2.7], [-2.6, 4.9, 4.2], [-5.4, 6.3, 5.2], [-8, 6.2, 5.6], [-9.8, 4.6, 5.4], [-10.2, 2.4, 5], [-9.2, 0.8, 4.6]].map(([x, y, z]) => h(x, y, z * s)), [2.3, 2.2, 1.9, 1.6, 1.2, 0.8, 0.25], 6, M.HORN);
    const e = h(3.2, 1.7, s * 2.4);
    dot(g, e, M.EYE, P.eye > 0.5 ? 4 : 1); dot(g, e, M.EYE, P.eye > 0.5 ? 4 : 0, 1, 0); dot(g, e, M.EYE, P.eye > 0.5 ? 2 : 0, -1, 0); dot(g, e, M.SKIN, 0, 0, -1); dot(g, e, M.SKIN, 0, 1, -1);
    if (s > 0 === !(P.near < 0)) A.eye = e;
  }
  A.mouth = h(5.6, -1.5 - jaw * 1.5, 0);
}

function build(g, P, o) {
  fire = P.fire; now = o.t;
  const K = biped(P, S), A = {}, { pel, waist, chest, head } = K, t = o.t, br = 1 + P.br;
  const W = P.wing;
  for (const s of [-1, 1]) {
    const w = batWing(g, chest, at(chest, -5.4, 0.6, s * 4.2), at(pel, -3.4, 3, s * 3.2), s, W, WING);
    // kanat kemiklerinde kor
    if (fire > 0.3) for (const q of w.tips) dot(g, mix(w.Wr, q, 0.35), M.LAVA, 2);
    // tutuşan kanat: kol ve parmak kemikleri boyunca, rüzgârla geriye yatan alev dilleri
    if (P.burn > 0.05 && fire > 0.05) [w.E, w.Wr, ...w.tips, ...w.tips.map(q => mix(w.Wr, q, 0.5))].forEach((b, i) => {
      const h = (5.5 + Math.sin(t * (9 + i * 0.7) + i * 2.1 + s) * 2.4) * P.burn;
      flame(g, b, mad(mad(b, [0, 1, 0], h), pel.f, -h * (0.3 + P.drag)), 1.6, M.FLAME, [0, 0, Math.sin(t * 6 + i) * 0.8]);
    });
  }
  // kuyruk: kalçadan geriye, yere doğru sarkıp ucu kalkar; ağır ağır savrulur
  const tl = [];
  for (let i = 0; i <= 7; i++) { const k = i / 7, q = at(pel, -4.5 - k * 22, -3 - 13 * Math.sin(Math.min(1, k * 1.3) * Math.PI / 2) + 8 * k * k, (Math.sin(t * 1.7 - k * 3.2) * 3.4 + P.tail * 9) * k); q[1] = Math.max(1.4, q[1]); tl.push(q); }
  tube(g, tl, i => lerp(3.4, 0.5, i / 7), 6, M.SKIN);
  // gövde: dar bel, fıçı göğüs, dev omuzlar, ensede kambur
  skin(g, [
    { p: at(pel, -0.6, -4, 0), u: pel.f, rx: 4.8, ry: 4.4 }, { p: at(pel, -0.4, 0, 0), u: pel.f, rx: 6.9, ry: 5.8 }, { p: waist.p, u: waist.f, rx: 6.3, ry: 5.3 },
    { p: at(chest, 1.4, -5.6, 0), u: chest.f, rx: 10.8 * br, ry: 9.8 * br }, { p: at(chest, 0, -0.8, 0), u: chest.f, rx: 12.6, ry: 9 * br },
    { p: at(chest, -1.6, 2.6, 0), u: chest.f, rx: 8.6, ry: 7.6 }, { p: at(chest, 1.6, S.neck + 0.4, 0), u: chest.f, rx: 4.8, ry: 4.6 },
  ], 10, M.CORE, { sub: 2 });
  // sırt dikenleri
  const sp = [];
  for (let i = 0; i < 5; i++) { const F = i < 3 ? chest : waist, y0 = i < 3 ? 2.4 - i * 3.6 : 1.5 - (i - 3) * 4, b = at(F, i < 3 ? -8 : -5, y0, 0), tip = at(F, (i < 3 ? -12.8 : -8.6) + (i % 2), y0 + 2.6, 0); spike(g, b, tip, 1.5, M.HORN, 4); sp.push(tip); }
  const limb = (a, b, c, r0, r1, r2, m = M.SKIN) => { bone(g, a, b, r0, r1, M.SKIN, 1.2); ball(g, b, r1, M.ROCK); bone(g, b, c, r1 * 0.96, r2, m, 1.14); };
  for (const [s, Ar] of [[1, K.R], [-1, K.L]]) {
    ball(g, Ar.sh, 4.9, M.ROCK, 7); limb(Ar.sh, Ar.el, Ar.wr, 4.2, 3.3, 2.8, M.FORE); ball(g, at(Ar.hand, 1.4, 0, 0), 3.1, M.ROCK);
    for (let k = -1; k <= 1; k++) line(g, at(Ar.hand, 2.6, 0.8, k * 1.4), at(Ar.hand, 5.4, -0.4, k * 2), M.HORN, 3);
    // omuz ve dirsek dikenleri
    spike(g, mad(Ar.sh, chest.u, 3), mad(mad(mad(Ar.sh, chest.u, 7.6), chest.r, s * 3), chest.f, -1.6), 1.6, M.HORN);
    spike(g, Ar.el, mad(Ar.el, norm([Ar.el[0] - Ar.wr[0] - chest.f[0] * 6, Ar.el[1] - Ar.wr[1], Ar.el[2] - Ar.wr[2] - chest.f[2] * 6]), 4.5), 1.3, M.HORN);
  }
  // bacaklar: uyluk öne, baldır geriye; topuk havada, pençe yerde
  const fw = norm([pel.f[0], 0, pel.f[2]]), sd = [fw[2], 0, -fw[0]];
  for (const L of [K.legR, K.legL]) {
    const hock = mad(L.ank, fw, -2.8), paw = mad([L.foot[0], L.foot[1] + 1.5, L.foot[2]], fw, 1.6), toe = mad(paw, fw, 5.2);
    bone(g, L.hip, L.knee, 5.2, 3.7, M.SKIN, 1.22); ball(g, L.knee, 3.7, M.ROCK); bone(g, L.knee, hock, 3.5, 2.3, M.SKIN, 1.16); ball(g, hock, 2.3, M.ROCK, 5);
    bone(g, hock, paw, 2.2, 2, M.FORE, 1, 6); bone(g, paw, toe, 2.3, 1.5, M.FORE, 1, 6, true);
    for (let k = -1; k <= 1; k++) line(g, mad(toe, sd, k * 1.4), mad(mad(mad(toe, fw, 2.8), sd, k * 2), [0, 1, 0], -0.9), M.HORN, 3);
    spike(g, hock, mad(mad(hock, fw, -3), [0, 1, 0], 1.6), 1, M.HORN, 3);
  }
  skull(g, head, P, A);
  // alev yelesi: tepeden sırt dikenlerine ve kuyruk ucuna inen, kendi hızında dalgalanan diller
  if (fire > 0.05) {
    const bases = [at(head, -1.8 * HK, 3.8 * HK, 0.9), at(head, -3.4 * HK, 3 * HK, -0.9), at(chest, -3.4, S.neck + 1.5, 0.8), ...sp, tl[7]];
    bases.forEach((base, i) => {
      const big = i < 6 ? 1 : 0.6, h = (7.5 + Math.sin(t * (7 + i * 0.6) + i * 2) * 2.8 + (o.rage ? 2.6 : 0)) * Math.min(1.4, fire) * big, sway = Math.sin(t * 5 + i * 1.7) * 1.7;
      flame(g, base, mad(mad(base, [0, 1, 0], h), head.f, -h * (0.4 + P.drag * 0.5)), 2 * big, M.FLAME, [sway * head.r[0], 0.4, sway * head.r[2]]);
      if (i < 5) flame(g, mad(base, head.r, i % 2 ? 1.6 : -1.6), mad(mad(base, [0, 1, 0], h * 0.62), head.f, -h * 0.5), 1.3, M.FLAME, [-sway * head.r[0], 0.2, -sway * head.r[2]]);
    });
  }
  // kılıç: bilekten; kabza, balçak ve kor gibi yanan namlu
  const H = K.R.hand, sa = P.sword, bd = norm([H.f[0] * Math.cos(sa) + H.u[0] * Math.sin(sa), H.f[1] * Math.cos(sa) + H.u[1] * Math.sin(sa), H.f[2] * Math.cos(sa) + H.u[2] * Math.sin(sa)]), grip = at(H, 1.4, 0, 0);
  bone(g, mad(grip, bd, -3), mad(grip, bd, 2.2), 0.9, 0.9, M.IRON, 1, 5, true);
  bone(g, mad(mad(grip, bd, 2.4), H.r, -3.2), mad(mad(grip, bd, 2.4), H.r, 3.2), 0.9, 0.9, M.IRON, 1, 5, true);
  tube(g, [3, 9, 19, 27].map(d => mad(grip, bd, d)), [1.4, 1.9, 1.4, 0.3], 5, M.BLADE);
  if (fire > 0.15) for (let i = 0; i < 4; i++) {
    const b = mad(grip, bd, 5 + i * 5.5), h = (3.8 + Math.sin(t * (9 + i) + i * 3) * 1.6) * Math.min(1.3, fire);
    flame(g, b, mad(mad(b, [0, 1, 0], h), bd, -1.5), 1.3, M.FLAME, [0, 0, Math.sin(t * 6 + i) * 0.8]);
  }
  A.tip = mad(grip, bd, 27); A.chest = at(chest, 6, -5, 0); A.hand = at(K.L.hand, 2, 0, 0); A.head = head.p;
  return A;
}

// ---------- duruşlar ----------
const DIE_T = 2.6;
function pose(o) {
  const t = o.t, A = o.A, rage = o.rage ? 1 : 0, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1;
  const br = Math.sin(t * 2.2 + o.wob);
  let x = 0, y = br * 0.3, lean = 13, twist = 0, tail = 0, roll = 0, jaw = 0.24 + 0.06 * br, fr0 = rage ? 1.3 : 1, sword = 58, sink = 0, rate = 20, lookW = 0.8, eye = 1, c = 0, r = 0, shadow = 1, spin = 0, burn = 0, drag = 0, swell = 0;
  const bend = [17, 0, 0], head = [15, 0, 0], R = { sw: 26, ab: 18, tw: 0, el: 30 }, L = { sw: 14, ab: 20, tw: 0, el: 26 }, fR = [1.5, 0, 6.8], fL = [-3.5, 0, -6.8];
  const wing = { open: 0.14 + rage * 0.2, fan: 0.2 + rage * 0.2, flap: Math.sin(t * 1.4) * 0.05, lean: 0.12 * near, sweep: 0, wave: Math.sin(t * 3) * 0.2, span: 0.3 };

  if (w > 0.01) {
    // ağır adım: kalça ve omuz ters döner, kılıç kolu az, kamçı kolu çok sallanır
    const ph = o.ph, a = stride(ph, 5, 3.4), b = stride(ph + 0.5, 5, 3.4), c1 = Math.cos(ph * TAU), s1 = Math.sin(ph * TAU);
    fR[0] += a[0] * w; fR[1] += a[1] * w; fL[0] += b[0] * w; fL[1] += b[1] * w;
    y -= (0.5 + 0.8 * Math.cos(ph * 2 * TAU)) * w; roll += s1 * 2.5 * w; twist -= c1 * 7 * w; bend[1] += c1 * 12 * w; lean += 4 * w;
    L.sw += c1 * 14 * w; R.sw -= c1 * 7 * w; wing.flap += Math.sin(ph * 2 * TAU) * 0.04 * w; tail = -c1 * 0.5 * w;
  }
  if (o.act === 'sword' && A) {
    lookW = 0.4;
    // iki elle başının üstüne kaldırır, geriye gerilir; sonra bütün gövdesiyle yere indirir
    const k = o.stage === 'raise' ? ss(0, 1, 1 - A.st / 0.8) : 1, kk = o.stage === 'raise' ? 0 : clamp(1 - A.st / 0.7, 0, 1), hit = ss(0, 0.16, kk), rec = ss(0.6, 1, kk), up = k * (1 - hit), dn = hit * (1 - rec);
    R.sw += 168 * up + 22 * dn; R.ab += -10 * up - 8 * dn; R.el += 6 * up + 52 * dn;
    L.sw += 166 * up + 30 * dn; L.ab += -32 * up - 30 * dn; L.el += 34 * up + 50 * dn;
    sword += -46 * up - 96 * dn; lean += -12 * up + 12 * dn; bend[0] += -22 * up + 12 * dn; y += 1.5 * up - 5.5 * dn; x += -1 * up + 2 * dn;
    head[0] += 10 * up - 8 * dn; fR[0] += 4 * dn; fL[0] -= 2 * dn; wing.open += 0.35 * up + 0.4 * dn; wing.fan += 0.3 * up + 0.3 * dn; wing.flap += 0.2 * up - 0.18 * dn;
    jaw = 0.5 * dn; fr0 *= 1 + 0.25 * up; if (dn > 0.3) x += Math.sin(t * 50) * 0.3 * (1 - rec); rate = 34;
  } else if (o.act === 'whip' && A) {
    const ap = clamp(aimLocal(Math.cos(o.aim || 0), Math.sin(o.aim || 0), o.view)[1], -0.7, 0.9) / D;
    if (o.stage === 'wind') {
      // kamçı kolu arkaya, omuzlar geriye döner
      const k = ss(0, 1, o.wind);
      L.sw += -70 * k; L.ab += 40 * k; L.el += 62 * k; bend[1] -= 32 * k; x -= 1.5 * k; lean -= 6 * k; R.sw += 12 * k; wing.open += 0.15 * k;
    } else if (o.stage === 'lash') {
      // kol nişan yönünde savrulur, gövde arkasından gelir, sonra aşağı doğru takip eder
      const k = clamp(1 - A.st / 0.36, 0, 1), f = ss(0, 0.4, k), fol = ss(0.5, 1, k);
      L.sw += lerp(-70, 96 + ap, f) - 36 * fol; L.ab += lerp(40, -6, f); L.el += lerp(62, -16, f); bend[1] += lerp(-32, 12, f); lean += lerp(-6, 9, f) - 3 * fol; x += lerp(-1.5, 2.5, f);
      fL[0] += 3 * f; jaw = 0.4 * f; wing.open += 0.2; rate = 40;
    }
    lookW = 0.5;
  } else if (o.act === 'wings' && A) {
    const tt = 2.2 - A.T;
    c = ss(0, 0.85, tt) * (1 - ss(0.88, 0.97, tt)); r = ss(0.88, 0.98, tt) * (1 - 0.85 * ss(0.5, 1.3, tt - 0.9)); rate = 30;
  } else if (o.act === 'breath' && A) {
    const ap = clamp(aimLocal(Math.cos(o.aim || 0), Math.sin(o.aim || 0), o.view)[1], -0.7, 0.8) / D;
    lookW = 0;
    if (o.stage === 'inhale') {
      // soluk alır: geriye yaslanır, göğsü şişer ve korlaşır, kollar ve kanatlar geriye açılır
      const k = ss(0, 1, o.wind);
      lean -= 13 * k; bend[0] -= 16 * k; head[0] += 16 * k; y += 1.6 * k; x -= 1.6 * k; swell = k; jaw = 0.12 * k; fr0 *= 1 + 0.45 * k;
      R.sw -= 22 * k; R.ab += 14 * k; L.sw -= 28 * k; L.ab += 18 * k; wing.open += 0.45 * k; wing.fan += 0.35 * k; wing.flap += 0.16 * k; rate = 26;
    } else if (o.stage === 'fire') {
      // öne atılır, çene ardına kadar açılır; gövde püskürmenin gücüyle titrer, kanatlar geride gerilir
      const k = ss(0, 0.16, o.sinceStage), sh = Math.sin(t * 40) * 0.35;
      lean += 15 * k; bend[0] += 12 * k; head[0] += (10 + ap * 0.7) * k; jaw = k; x += 2.2 * k + sh; y -= 1.2 * k; fL[0] += 3.5 * k; swell = 0.6 * k; fr0 *= 1.45;
      R.sw -= 34 * k; R.ab += 22 * k; R.el += 14 * k; L.sw -= 38 * k; L.ab += 26 * k; L.el += 10 * k; sword += 24 * k;
      wing.open += 0.6 * k; wing.fan += 0.55 * k; wing.flap += -0.1 * k + Math.sin(t * 15) * 0.05; wing.wave += 0.6; rate = 38;
    }
  } else if (o.act === 'swoop' && A) {
    lookW = 0.3;
    if (o.stage === 'flap') {
      // çömelir; kanatlar ardına kadar açılıp hızlanan vuruşlarla çırpar ve tutuşur, her vuruş gövdeyi kaldırır
      const k = ss(0, 0.45, o.wind), up = ss(0.7, 1, o.wind), fl = Math.sin(t * (9 + 5 * o.wind));
      y += -5 * k + (Math.max(0, -fl) * 2 + 3 * up) * k; lean += 11 * k - 6 * up; bend[0] += 9 * k; head[0] += 10 * k; jaw = 0.35 * k; fr0 *= 1 + 0.3 * k;
      wing.open = lerp(wing.open, 1, k); wing.fan = lerp(wing.fan, 1, k); wing.span = lerp(0.3, 0.75, k); wing.flap += fl * 0.5 * k; wing.wave += k;
      burn = ss(0.2, 0.75, o.wind); R.ab += 14 * k; L.ab += 16 * k; R.el += 34 * k; L.el += 30 * k; rate = 34;
    } else if (o.stage === 'fly') {
      // uçuş: gövde öne yatar, bacaklar geride toplanır, kılıç ileride; konmadan önce doğrulup ayaklarını uzatır
      const k = clamp(o.sinceStage / (A.dur || 1), 0, 1), fl = Math.sin(t * 12), gear = ss(0.68, 1, k), go = ss(0, 0.2, k);
      lean += (50 - 44 * gear) * go; bend[0] -= 12 * go; head[0] += (28 - 20 * gear) * go; y += 4 * go; jaw = 0.6; fr0 *= 1.35; burn = 1; drag = 0.9 * (1 - gear); shadow = 0;
      fR[0] = lerp(fR[0], lerp(-9, 5, gear), go); fR[1] = lerp(0, lerp(11, 3, gear), go); fL[0] = lerp(fL[0], lerp(-13, 1, gear), go); fL[1] = lerp(0, lerp(8, 2, gear), go);
      wing.open = 1; wing.fan = 1; wing.span = lerp(0.9, 0.6, gear); wing.flap += fl * 0.55 - 0.25 * gear; wing.wave += 1; wing.sweep = -0.25 * go * (1 - gear);
      R.sw += (62 - 30 * gear) * go; R.el += 16 * go; sword += -34 * go; L.sw -= 30 * go; L.ab += 20 * go; L.el += 20 * go; rate = 40;
    } else {
      // konuş: dizler çöker, kılıç yere saplanır, kanatlar yanlara çarpar; sonra ağır ağır doğrulur
      const imp = 1 - ss(0.05, 0.6, o.sinceStage), hit = 1 - ss(0, 0.2, o.sinceStage);
      y -= 9 * imp; lean += 20 * imp; bend[0] += 14 * imp; head[0] -= 6 * imp; jaw = 0.5 * imp; x += Math.sin(t * 50) * 0.4 * hit; burn = imp; fr0 *= 1 + 0.3 * imp;
      wing.open = lerp(wing.open, 1, imp); wing.fan = lerp(wing.fan, 0.9, imp); wing.span = lerp(0.3, 0.7, imp); wing.flap -= 0.4 * imp;
      R.sw += 34 * imp; R.el += 30 * imp; sword -= 74 * imp; L.ab += 34 * imp; L.el += 24 * imp; fR[0] += 2 * imp; fL[0] -= 2 * imp; rate = 44;
    }
  }
  if (rage && o.rageT < 1.3) { c = Math.max(c, bump(0, 0.15, 0.25, 0.35, o.rageT)); r = Math.max(r, bump(0.25, 0.4, 0.9, 1.3, o.rageT)); }
  if (o.intro >= 0) {
    // çömelmiş gölgeden doğrulur, alevi tutuşur, kanatlarını açıp kükrer
    const i = o.intro; c = 1 - ss(0.3, 0.5, i); r = bump(0.45, 0.58, 0.8, 1, i); y -= 5 * c; fr0 *= clamp((i - 0.12) / 0.4, 0, 1); lookW = 0;
  }
  if (o.hurt > 0 && !dead) {
    const h = o.hurt * o.hurt, back = clamp(o.hx * Math.cos(o.view), -1, 1);
    lean -= 9 * h; bend[1] += 10 * h * near; head[0] += 12 * h; x += back * 1.6 * h; wing.open += 0.15 * h; jaw = Math.max(jaw, 0.4 * h); R.ab += 8 * h; L.ab += 8 * h;
  }
  if (dead) {
    // son bir kükreme, alev söner; dizlerinin üstüne çöker, yüzüstü yıkılır ve gölgeye gömülür
    const d = o.dying * DIE_T, kn = ss(0.35, 0.9, d), fall = ss(1, 1.7, d);
    r = bump(0, 0.1, 0.3, 0.5, d); fr0 *= o.dying < 0.12 ? 1.8 : Math.pow(1 - (o.dying - 0.12) / 0.88, 1.6);
    y += -10 * kn - 7.5 * fall; fR[0] -= 5 * kn; fL[0] -= 3 * kn; lean += 12 * kn + 52 * fall; bend[0] += 16 * kn + 8 * fall; head[0] += -34 * kn + 20 * fall; x += 5 * fall;
    R.sw = lerp(R.sw, 28, kn) + 50 * fall; R.el = lerp(R.el, 8, kn); L.sw = lerp(L.sw, 20, kn) + 62 * fall; L.el = lerp(L.el, 12, kn); sword = lerp(sword, 86, kn);
    wing.open = lerp(wing.open, 0.16, kn); wing.fan = lerp(wing.fan, 0.2, kn); wing.flap -= 0.3 * kn; wing.span = lerp(0.3, 0.2, kn);
    sink = Math.pow(clamp((o.dying - 0.62) / 0.38, 0, 1), 1.4) * 22; eye = 1 - ss(1.2, 1.8, d); lookW = 0; shadow = 1 - fall;
  }
  if (c > 0.001 || r > 0.001) {
    // c: büzülme (kollar göğüste, kanatlar kapalı); r: patlama (kollar ve kanatlar açık, baş geride, kükrer)
    // patlarken kameraya döner; cepheden kanatlar yana, yandan yelken gibi yukarı açılır
    spin = near * 0.45 * r; const sk = ss(0.35, 0.85, Math.abs(Math.sin(o.view + spin)));
    y += -4.5 * c + 1.5 * r; lean += 14 * c - 14 * r; bend[0] += 18 * c - 22 * r; head[0] += -18 * c + 32 * r; jaw = Math.max(jaw, r);
    for (const a of [R, L]) { a.sw += 38 * c - lerp(42, 22, sk) * r; a.ab += -30 * c + lerp(26, 60, sk) * r; a.el += 78 * c + lerp(20, -8, sk) * r; }
    sword += -30 * r; wing.open = lerp(lerp(wing.open, 0.06, c), 1, r); wing.fan = lerp(lerp(wing.fan, 0.06, c), 1, r); wing.span = lerp(lerp(0.3, 0.1, c), sk, r);
    wing.flap += -0.22 * c + 0.28 * r + Math.sin(t * 9) * 0.05 * r; x += Math.sin(t * 45) * 0.3 * r; fr0 *= 1 + 0.3 * r; lookW *= 1 - Math.max(c, r);
  }
  // bakış: baş ve omuzlar hedefe döner
  const [ly0, lp0] = aimLocal(o.tx, o.ty + 44, o.view), ly = clamp(ly0, -1.2, 1.2) * lookW, lp = clamp(lp0, -0.6, 0.5) * lookW;
  const rad = a => ({ sw: a.sw * D, ab: a.ab * D, tw: a.tw * D, el: Math.max(0, a.el) * D });
  return {
    rate, spin, x, y, lean: lean * D, twist: twist * D, roll: roll * D, bend: [bend[0] * D, bend[1] * D + ly * 0.3, bend[2] * D], head: [head[0] * D + lp, head[1] * D + ly * 0.7, head[2] * D],
    armR: rad(R), armL: rad(L), footR: fR, footL: fL, wing, tail, jaw, eye, near, fire: fr0, sword: sword * D, sink, shadow, br: 0.03 * br + 0.13 * swell, burn, drag,
  };
}

export const BALROG3D = { w: 208, h: 152, ox: 104, oy: 134, scale: 1.15, tilt: 0.2, mats: MATS, stride: 16, shadow: 16, body: 54, bias: 0.38, turn: 0.55, outline: [10, 3, 4], pose, build };
