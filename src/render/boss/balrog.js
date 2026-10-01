// Balrog: obsidyen gövde, çatlaklarından lav sızar; alev yelesi, gölge kanatları, sağ elde alev kılıcı, sol elde kamçı.
// Kamçının kendisi, duman ve korlar balrog.js'te (2B) çizilir; burada gövde ve duruşlar var.
import { line, dot, vert, tri } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mad, norm, at, turn, frame, bone, ball, tube, skin, loft, flame, spike, batWing, aimLocal } from './rig.js';
import { biped, stride } from './biped.js';

const M = { SKIN: 1, LAVA: 2, HORN: 3, WING: 4, WING_OUT: 5, EDGE: 6, FLAME: 7, BLADE: 8, EYE: 9, MOUTH: 10, IRON: 11, FORE: 12 };
const S = { hip: 25, spine: 14, neck: 4.8, headX: 1.2, shW: 10, shY: -1, hipW: 4.8, arm: [11, 11], leg: [12.5, 12], ankle: 2.2 }, HK = 1.3;
const WING = {
  // kapalı: bilek başın üstünde, parmaklar sırttan aşağı pelerin gibi sarkar; açık: yelken gibi yukarı ve geriye
  fold: { h: [-0.75, 0.6, 0.3], a: [-0.5, 0.82, 0.2], f: [[0.12, -1, 0.05], [-0.3, -0.95, 0.1], [-0.6, -0.8, 0.15], [-0.86, -0.5, 0.2]] },
  open: { h: [-0.6, 0.7, 0.4], a: [-0.35, 0.9, 0.3], f: [[0.2, 0.97, 0.15], [-0.4, 0.9, 0.2], [-0.85, 0.5, 0.25], [-1, -0.1, 0.25]] },
  fly: { h: [-0.25, 0.45, 0.86], a: [-0.1, 0.55, 0.83], f: [[0.1, 0.8, 0.6], [-0.12, 0.4, 0.9], [-0.28, -0.12, 0.95], [-0.42, -0.6, 0.68]] },
  arm: [12, 14], fingers: [22, 26, 24, 19], r: [1.8, 1.3, 1.2, 0.9], memb: M.WING, bone: M.SKIN, claw: M.HORN, tone: 2, scallop: 0.22,
};
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb);
const fr = x => x - Math.floor(x);
let fire = 1;
// obsidyen: dalgalı çatlak ağı; ateş yanıyorsa çatlaklar lav gibi parlar, sönünce kararır
function cracks(u, v, i, out) {
  const a = Math.abs(fr(u * 0.13 + Math.sin(v * TAU * 2) * 0.25) - 0.5), b = Math.abs(fr(v * 2 + 0.2 + Math.sin(u * 0.7) * 0.16) - 0.5);
  if (a < 0.03 || b < 0.03) { if (fire > 0.08) { out.id = M.LAVA; return 0.1 + Math.min(1.5, fire) * 0.4 + (a < 0.014 ? 0.2 : 0); } return i - 0.3; }
  return i;
}
const hot = u => 0.96 - u * 0.8;
const MATS = [];
MATS[M.SKIN] = { ramp: ramp('#070304', '#170a0a', '#2a1311', '#44201a', '#6e3424'), px: cracks };
// ön kollar ve yumruklar bir ton açık: gövdenin önünden geçerken okunur
MATS[M.FORE] = { ramp: ramp('#170a0a', '#2c1412', '#48221a', '#743826', '#a85832'), px: cracks };
MATS[M.LAVA] = { ramp: ramp('#5a0c06', '#a8200a', '#ee5a14', '#ffa030', '#ffe890'), flat: true, glow: 1 };
MATS[M.HORN] = { ramp: ramp('#1a1210', '#3a2a22', '#5e4a3a', '#8a7460', '#b8a488') };
MATS[M.WING] = { ramp: ramp('#050304', '#0e0809', '#1a0e10', '#28161a', '#3a2226'), back: M.WING_OUT };
MATS[M.WING_OUT] = { ramp: ramp('#030202', '#080506', '#10090a', '#1a0f11', '#261719') };
MATS[M.EDGE] = { ramp: MATS[M.WING_OUT].ramp, dither: 2 };
MATS[M.FLAME] = { ramp: ramp('#8a1408', '#d8380c', '#ff7a1a', '#ffc040', '#fff4b8'), flat: true, glow: 1, soft: true, px: hot };
MATS[M.BLADE] = { ramp: ramp('#2a1410', '#c8300c', '#ff7a1a', '#ffc850', '#fff6c8'), flat: true, glow: 1, px: u => fire > 0.08 ? 0.42 + Math.min(1.3, fire) * 0.3 - u * 0.012 : 0.1 };
MATS[M.EYE] = { ramp: ramp('#c84a08', '#ff8a10', '#ffc030', '#ffe870', '#fffbd0'), flat: true, glow: 1 };
MATS[M.MOUTH] = { ramp: ramp('#3a0806', '#8a1808', '#e04a10', '#ff9a30', '#ffe070'), flat: true, glow: 0.7, px: () => 0.15 + Math.min(1, fire) * 0.6 };
MATS[M.IRON] = { ramp: ramp('#0a0808', '#1c1616', '#34282a', '#544444', '#7a6a68') };

function skull(g, F, P, A) {
  const jaw = P.jaw, K = HK, h = (x, y, z) => at(F, x * K, y * K, z * K), Lw = turn(frame(h(-0.5, -1.2, 0), F.f, F.u, F.r), 0, -jaw * 0.8), l = (x, y, z) => at(Lw, x * K, y * K, z * K);
  loft(g, Lw, [[-0.5, -0.5, 2.7, 1.2], [2.6, -0.6, 2.3, 1], [5, -0.4, 1.3, 0.7]], 6, M.SKIN, { ceil: 0.25, flat: M.MOUTH, back: true, k: K });
  loft(g, F, [[-3.6, 1.2, 2.5, 2.6], [-1.2, 1.6, 3.6, 3.3], [1.4, 1.5, 3.4, 3], [3.6, 0.9, 2.5, 2], [5.3, 0.5, 1.7, 1.4]], 8, M.SKIN, { floor: -0.9, flat: M.MOUTH, back: true, k: K });
  if (jaw > 0.12) {
    const n = F.r, a = h(-0.4, -1, 0), b = h(4.6, -0.9, 0), c = l(4.6, 0.2, 0);
    tri(g, vert(g, a, n), vert(g, b, n), vert(g, c, n), M.MOUTH);
    for (const s of [-1, 1]) { dot(g, h(4.2, -1.2, s * 1.5), M.HORN, 4); dot(g, l(4, 0.5, s * 1.2), M.HORN, 4); dot(g, h(2.4, -1.2, s * 2.1), M.HORN, 3); }
  } else for (const s of [-1, 1]) dot(g, h(4, -1.3, s * 1.6), M.HORN, 4);
  for (const s of [-1, 1]) {
    tube(g, [[-0.6, 3, 2.6], [-2, 5.4, 5], [-0.6, 8.6, 6.6], [2.6, 11, 6.2]].map(([x, y, z]) => h(x, y, z * s)), [2, 1.7, 1.1, 0.35], 6, M.HORN);
    const e = h(3, 1.9, s * 2.5);
    dot(g, e, M.EYE, P.eye > 0.5 ? 4 : 1); dot(g, e, M.EYE, P.eye > 0.5 ? 4 : 0, 1, 0); dot(g, e, M.EYE, P.eye > 0.5 ? 2 : 0, -1, 0); dot(g, e, M.SKIN, 0, 0, -1); dot(g, e, M.SKIN, 0, 1, -1);
    if (s > 0 === !(P.near < 0)) A.eye = e;
  }
  A.mouth = h(5, -1.6 - jaw * 1.4, 0);
}

function build(g, P, o) {
  fire = P.fire;
  const K = biped(P, S), A = {}, { pel, waist, chest, head } = K, t = o.t, br = 1 + P.br;
  const W = P.wing;
  for (const s of [-1, 1]) batWing(g, chest, at(chest, -3.6, -1, s * 3.6), at(pel, -3, 3, s * 3), s, W, WING);
  // gövde: dar bel, geniş göğüs ve omuz
  skin(g, [
    { p: at(pel, 0, -3.6, 0), u: pel.f, rx: 4.4, ry: 4 }, { p: pel.p, u: pel.f, rx: 6.4, ry: 5.2 }, { p: waist.p, u: waist.f, rx: 5.6, ry: 4.6 },
    { p: at(chest, 0.8, -4.6, 0), u: chest.f, rx: 9.2 * br, ry: 6.6 * br }, { p: at(chest, 0.3, 0, 0), u: chest.f, rx: 10, ry: 5.6 * br }, { p: at(chest, 0.6, S.neck - 1.2, 0), u: chest.f, rx: 3.6, ry: 3.4 },
  ], 10, M.SKIN, { sub: 2 });
  const limb = (a, b, c, r0, r1, r2, m = M.SKIN) => { bone(g, a, b, r0, r1, M.SKIN, 1.18); ball(g, b, r1, m); bone(g, b, c, r1 * 0.96, r2, m, 1.12); };
  for (const [s, Ar] of [[1, K.R], [-1, K.L]]) {
    ball(g, Ar.sh, 3.8, M.SKIN, 7); limb(Ar.sh, Ar.el, Ar.wr, 3.4, 2.8, 2.4, M.FORE); ball(g, at(Ar.hand, 1.2, 0, 0), 2.7, M.FORE);
    // omuz ve dirsek dikenleri
    for (const [dx, h] of [[-1.2, 6], [1.6, 4.4]]) spike(g, mad(Ar.sh, chest.u, 2.6), mad(mad(mad(Ar.sh, chest.u, 2.6 + h), chest.r, s * h * 0.55), chest.f, dx), 1.5, M.HORN);
    spike(g, Ar.el, mad(Ar.el, norm([Ar.el[0] - Ar.wr[0] - chest.f[0] * 6, Ar.el[1] - Ar.wr[1], Ar.el[2] - Ar.wr[2] - chest.f[2] * 6]), 4.5), 1.3, M.HORN);
  }
  const fw = norm([pel.f[0], 0, pel.f[2]]);
  for (const L of [K.legR, K.legL]) {
    limb(L.hip, L.knee, L.ank, 4.4, 3.3, 2.6); ball(g, L.ank, 2.6, M.SKIN);
    const heel = [L.ank[0], L.foot[1] + 1.7, L.ank[2]], toe = mad([L.foot[0], L.foot[1] + 1.3, L.foot[2]], fw, 5);
    bone(g, heel, toe, 2.4, 1.6, M.SKIN, 1, 6, true);
    for (let k = -1; k <= 1; k++) line(g, mad(toe, [fw[2], 0, -fw[0]], k * 1.3), mad(mad(toe, fw, 2.4), [fw[2], 0, -fw[0]], k * 1.8), M.HORN, 3);
  }
  skull(g, head, P, A);
  // alev yelesi: tepeden sırta inen, kendi hızında dalgalanan diller
  if (fire > 0.05) for (let i = 0; i < 6; i++) {
    const base = i < 3 ? at(head, (-1.6 - i * 1.5) * HK, (3.6 - i * 1.1) * HK, (i % 2 ? 1 : -1) * 0.8) : at(chest, -5, 3.4 - (i - 3) * 4.2, (i % 2 ? 1 : -1) * 1.2);
    const h = (6.5 + Math.sin(t * (7 + i * 0.6) + i * 2) * 2.6 + (o.rage ? 2.5 : 0)) * Math.min(1.4, fire) * (i < 3 ? 1 : 0.8), sway = Math.sin(t * 5 + i * 1.7) * 1.6;
    flame(g, base, mad(mad(base, [0, 1, 0], h), head.f, -h * 0.45), 1.8, M.FLAME, [sway * head.r[0], 0.4, sway * head.r[2]]);
  }
  // kılıç: bilekten; kabza, balçak ve kor gibi yanan namlu
  const H = K.R.hand, sa = P.sword, bd = norm([H.f[0] * Math.cos(sa) + H.u[0] * Math.sin(sa), H.f[1] * Math.cos(sa) + H.u[1] * Math.sin(sa), H.f[2] * Math.cos(sa) + H.u[2] * Math.sin(sa)]), grip = at(H, 1.2, 0, 0);
  bone(g, mad(grip, bd, -3), mad(grip, bd, 2.2), 0.9, 0.9, M.IRON, 1, 5, true);
  bone(g, mad(mad(grip, bd, 2.4), H.r, -3), mad(mad(grip, bd, 2.4), H.r, 3), 0.9, 0.9, M.IRON, 1, 5, true);
  tube(g, [3, 9, 18, 25].map(d => mad(grip, bd, d)), [1.3, 1.7, 1.3, 0.3], 5, M.BLADE);
  if (fire > 0.15) for (let i = 0; i < 4; i++) {
    const b = mad(grip, bd, 5 + i * 5), h = (3.5 + Math.sin(t * (9 + i) + i * 3) * 1.5) * Math.min(1.3, fire);
    flame(g, b, mad(mad(b, [0, 1, 0], h), bd, -1.5), 1.2, M.FLAME, [0, 0, Math.sin(t * 6 + i) * 0.8]);
  }
  A.tip = mad(grip, bd, 25); A.chest = at(chest, 5, -5, 0); A.hand = at(K.L.hand, 2, 0, 0); A.head = head.p;
  return A;
}

// ---------- duruşlar ----------
const DIE_T = 2.6;
function pose(o) {
  const t = o.t, A = o.A, rage = o.rage ? 1 : 0, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1;
  const br = Math.sin(t * 2.2 + o.wob);
  let x = 0, y = br * 0.3, lean = 6, twist = 0, roll = 0, jaw = 0.05, fr0 = rage ? 1.3 : 1, sword = 58, sink = 0, rate = 20, lookW = 0.8, eye = 1, c = 0, r = 0, shadow = 1, spin = 0;
  const bend = [8, 0, 0], head = [-4, 0, 0], R = { sw: 4, ab: 22, tw: 0, el: 30 }, L = { sw: -8, ab: 24, tw: 0, el: 26 }, fR = [2.5, 0, 6.2], fL = [-3, 0, -6.2];
  const wing = { open: 0.14 + rage * 0.2, fan: 0.2 + rage * 0.2, flap: Math.sin(t * 1.4) * 0.05, lean: 0.12 * near, sweep: 0, wave: Math.sin(t * 3) * 0.2, span: 0.3 };

  if (w > 0.01) {
    // ağır adım: kalça ve omuz ters döner, kılıç kolu az, kamçı kolu çok sallanır
    const ph = o.ph, a = stride(ph, 5, 3.4), b = stride(ph + 0.5, 5, 3.4), c1 = Math.cos(ph * TAU), s1 = Math.sin(ph * TAU);
    fR[0] += a[0] * w; fR[1] += a[1] * w; fL[0] += b[0] * w; fL[1] += b[1] * w;
    y -= (0.5 + 0.8 * Math.cos(ph * 2 * TAU)) * w; roll += s1 * 2.5 * w; twist -= c1 * 7 * w; bend[1] += c1 * 12 * w; lean += 4 * w;
    L.sw += c1 * 14 * w; R.sw -= c1 * 7 * w; wing.flap += Math.sin(ph * 2 * TAU) * 0.04 * w;
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
  } else if (o.act === 'shadow' && A) {
    // gölgeye karışır: büzülür, kanatlarına sarınır; belirirken patlayarak açılır
    c = o.stage === 'form' ? clamp(A.st / 0.55, 0, 1) : 1 - 0.2 * (1 - o.fade);
    r = o.stage === 'form' ? clamp(1 - A.st / 0.22, 0, 1) : 0;
  } else if (o.prev === 'shadow' && !o.act && o.since < 0.6) r = 1 - ss(0, 0.6, o.since);
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
    armR: rad(R), armL: rad(L), footR: fR, footL: fL, wing, jaw, eye, near, fire: fr0, sword: sword * D, sink, shadow, br: 0.03 * br,
  };
}

export const BALROG3D = { w: 176, h: 136, ox: 88, oy: 120, scale: 1.15, tilt: 0.2, mats: MATS, stride: 16, shadow: 16, body: 54, bias: 0.38, turn: 0.55, outline: [10, 3, 4], pose, build };
