// Sağır Avcı: Sağır Mağaraların kör avcısı. Gözü yok; damarları seçilen dev, oynak yarasa kulakları içinde soluk mavi sonar ışır.
// Kıllı olmayan solgun eflatun deri, buruşuk burun yaprağı, iğne dişli geniş çene; uzun ön kollarıyla parmak boğumlarına basarak yürür.
import { vert, tri, line, dot } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mix, mad, mul, sub, norm, cross, dotp, at, turn, move, shift, frame, ell, ball, bone, tube, skin, spike, loft, sheet, ik, reach, aimLocal, meleeK, hash } from './rig.js';

const M = { SKIN: 1, EAR: 2, EAR_B: 3, VEIN: 4, SONAR: 5, WING: 6, CLAW: 7, MOUTH: 8, TOOTH: 9, NOSE: 10, BONE: 11 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
let son = 0.3;
const MATS = [];
// deri: kaburga ve buruşukluk çizgileri (boyuna)
MATS[M.SKIN] = { ramp: ramp('#141320', '#2a2a3a', '#46445e', '#6e6a8e', '#a09cc4'), px: (u, v, i) => i - (fr(u * 0.62) < 0.2 && v > 0.42 && v < 0.98 ? 0.11 : 0) };
// kulak zarı: içi soluk, damarlı; dibinde sonar ışığı (son ile büyür)
function earIn(u, v, i, out) {
  if (v < 0.16 + 0.46 * son && Math.abs(u) < 0.62 - v * 0.6) { out.id = M.SONAR; return 0.5 + son * 0.4 + (1 - v) * 0.1; }
  if (v > 0.06 && v < 0.9 && Math.abs(fr((u * 0.5 + 0.5) * 3.2 + Math.sin(v * 7) * 0.12) - 0.5) < 0.12) { out.id = M.VEIN; return i * 0.7; }
  return i * 0.75 + 0.22;
}
function earOut(u, v, i, out) {
  if (v > 0.06 && v < 0.9 && Math.abs(fr((u * 0.5 + 0.5) * 3.2 + Math.sin(v * 7) * 0.12) - 0.5) < 0.12) { out.id = M.SKIN; return i * 0.5; }
  return i;
}
MATS[M.EAR_B] = { ramp: ramp('#2a2840', '#4a4766', '#77739a', '#a4a0c6', '#cccaea'), px: earOut };
MATS[M.EAR] = { ramp: ramp('#5a5e8a', '#8a90bc', '#b4bce0', '#d8e0f6', '#f2f6ff'), back: M.EAR_B, glow: 0.18, px: earIn };
MATS[M.VEIN] = { ramp: ramp('#3a2a52', '#5a4274', '#7a5c96', '#9a7ab4', '#bca0d0'), flat: true };
MATS[M.SONAR] = { ramp: ramp('#3a7ac0', '#62a8e8', '#96d4ff', '#c8ecff', '#f4fcff'), flat: true, glow: 1 };
MATS[M.WING] = { ramp: ramp('#160f22', '#2a1e40', '#45345f', '#644e84', '#8670a8'), back: M.WING };
MATS[M.CLAW] = { ramp: ramp('#3a3630', '#6e6858', '#a8a08a', '#dcd4ba', '#fbf6e6') };
MATS[M.MOUTH] = { ramp: ramp('#12060c', '#260a16', '#401222', '#5c1c2e', '#7a2a3c'), flat: true };
MATS[M.TOOTH] = { ramp: ramp('#8a8478', '#bab2a0', '#e2dcc8', '#f6f2e4', '#ffffff'), flat: true };
MATS[M.NOSE] = { ramp: ramp('#2e1a2c', '#523248', '#7c5070', '#a87896', '#d0a4bc') };
MATS[M.BONE] = { ramp: ramp('#1e1c2a', '#3a3850', '#6a6684', '#a29ebe', '#d8d6ee') };

// yarasa kulağı: Fe tabanda (f: ağız açıklığı, u: eksen, r: dışarı). L boy, W yarı genişlik, curl: uç geriye kıvrılır
function ear(g, Fe, L, W, curl, fold) {
  const N = 6, C = 6, G = [];
  for (let i = 0; i <= N; i++) {
    const v = i / N, row = [], hw = W * Math.sin(Math.PI * (0.14 + 0.78 * v)) * (1 - 0.15 * v) * (1 - fold * 0.55), c = W * 0.3 * Math.sin(Math.PI * v) * (1 - fold * 0.5);
    for (let j = 0; j <= C; j++) {
      const w = -1 + 2 * j / C, nt = w > 0 ? 1 + 0.09 * Math.sin(v * Math.PI * 5) * w : 1;
      const x = c + hw * w * nt, d = W * 0.55 * (w * w - 1) * (1 - 0.6 * v) * (1 + fold) - curl * v * v * L * 0.4;
      row.push(at(Fe, d, L * v * (1 - fold * 0.3), x));
    }
    G.push(row);
  }
  const base = g.nv;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= C; j++) {
    const a = G[i][Math.max(0, j - 1)], b = G[i][Math.min(C, j + 1)], c = G[Math.max(0, i - 1)][j], d = G[Math.min(N, i + 1)][j];
    let n = norm(cross(sub(b, a), sub(d, c))); if (dotp(n, Fe.f) < 0) n = mul(n, -1);
    vert(g, G[i][j], n, -1 + 2 * j / C, i / N);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < C; j++) { const q = base + i * (C + 1) + j; tri(g, q, q + 1, q + C + 1, M.EAR); tri(g, q + 1, q + C + 2, q + C + 1, M.EAR); }
  // kenar kıkırdağı: dış hat koyu çizgi
  for (let i = 0; i < N; i++) { line(g, G[i][0], G[i + 1][0], M.SKIN, 1); line(g, G[i][C], G[i + 1][C], M.SKIN, 1); }
  return G[3][3];
}

function build(g, P, o) {
  const A = {}, t = o.t;
  son = P.sonar;
  const root = turn(frame([P.px, P.py, 0]), P.twist * 0.5, P.pitch, P.roll), mid = move(turn(root, P.twist * 0.25, P.arch + 0.14, 0), 8.5), chest = move(turn(mid, P.twist * 0.25, P.arch - 0.3, 0), 8.5);
  const neck = turn(shift(chest, 4.5, 2.2, 0), P.headY, P.headP, P.headR), H = move(neck, 4.5 + P.nk), br = 1 + P.br;
  A.head = H.p; A.chest = at(chest, 3, -3, 0);
  if (P.alpha < 0.05) { A.mouth = at(H, 8, -1.5, 0); A.ear = at(H, 0, 9, 3); A.hand = at(chest, 10, -16, 0); return A; }
  // gövde: ince kuyruktan kambur omuza, oradan kısa boyna
  const spines = [];
  skin(g, [
    { p: at(root, -6, 0.6, 0), u: root.u, rx: 2.4, ry: 2.4 }, { p: at(root, -2.5, 0, 0), u: root.u, rx: 5.2, ry: 5 }, { p: at(mid, -3, 0.2, 0), u: mid.u, rx: 5.6, ry: 5.4 },
    { p: at(mid, 1, 0.4, 0), u: mid.u, rx: 5.2 * br, ry: 5.8 * br }, { p: at(chest, -2, 0.6, 0), u: chest.u, rx: 7.2 * br, ry: 7.4 * br }, { p: at(chest, 2.5, 1.2, 0), u: chest.u, rx: 7 * br, ry: 6.6 * br },
    { p: neck.p, u: neck.u, rx: 3.6, ry: 3.4 }, { p: at(H, -1.5, 0.4, 0), u: H.u, rx: 3.2, ry: 3 },
  ], 10, M.SKIN, { sub: 2, each(q, tg, i) { if (i > 1 && i < 13 && i % 2 === 0) { const r = norm(cross(tg, q.u)), u2 = cross(r, tg); spines.push([mad(q.p, u2, q.ry * 0.97), u2, tg, i]); } } });
  // sırt sırtı: omurga dikenleri (öfkede kabarır)
  for (const [p, u2, tg, i] of spines) { const h = (1.7 + 0.6 * Math.sin(i * 1.3)) * (1 + P.bristle * (1.2 + 0.3 * Math.sin(t * 30 + i))); spike(g, mad(p, u2, -0.3), mad(mad(p, u2, h), tg, -h * 0.7), 0.95, M.BONE, 3); }
  // kuyruk: ince, kıvrık
  const tl = [];
  for (let k = 0; k <= 5; k++) { const q = k / 5; tl.push(at(root, -6 - q * 10, -0.5 - q * q * 5 + P.tail * q * 3, Math.sin(t * 1.6 - q * 2) * q * 2.4 * P.wag)); }
  tube(g, tl, k => 1.6 * (1 - k / 6) + 0.15, 5, M.SKIN);
  // baş: basık kafatası, buruşuk burun, gözsüz yüz
  ell(g, shift(H, -0.6, 1.1, 0), 4.6, 3.7, 4.1, M.SKIN, 8, 4);
  const jw = P.jaw;
  loft(g, shift(H, 0, 0, 0), [[0.5, 0.6, 3.8, 2.9], [3.2, 0.2, 3.3, 2.3], [5.8, -0.2, 2.6, 1.8], [7.8, -0.4, 1.8, 1.4]], 8, M.SKIN, { floor: -1.1, flat: M.MOUTH });
  const J = turn(shift(H, 0.6, -1.2, 0), 0, -jw * 0.95);
  loft(g, J, [[0, -0.6, 3.3, 1.6], [3, -0.7, 3, 1.3], [5.6, -0.6, 2.4, 1.1], [7.2, -0.5, 1.6, 0.9]], 7, M.SKIN, { ceil: 0.05, flat: M.MOUTH });
  if (jw > 0.2) ell(g, shift(J, 3.4, 0.6, 0), 3.2, 0.5 + jw * 1.6, 2.2, M.MOUTH, 6, 3);
  // iğne dişler: üst ve alt çene kenarında
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
    const x = 1.6 + k * 1.15, wu = lerp(3.2, 1.6, (x - 0.5) / 7.3) - 0.35, wl = lerp(2.9, 1.5, x / 7.2) - 0.35, ln = k === 1 ? 1.9 : 1.15;
    line(g, at(H, x, -1.1, s * wu), at(H, x + 0.2, -1.1 - ln, s * wu), M.TOOTH, 4);
    line(g, at(J, x - 0.6, 0.05, s * wl), at(J, x - 0.4, 0.05 + (k === 2 ? 1.6 : 1), s * wl), M.TOOTH, 2);
  }
  // burun yaprağı: burun ucunda dik, kıpır kıpır zar; buruşuk köprü
  const sn = Math.sin(t * 11) * 0.3 * P.sniff, nb = at(H, 7.6, 0.9, 0);
  ball(g, at(H, 8.1, -0.2, 0), 1.5, M.NOSE, 6);
  for (const s of [-1, 1]) { dot(g, at(H, 9.3, -0.4, s * 0.7), M.MOUTH, 0); sheet(g, [[nb, nb], [at(H, 7.2 - sn, 3.2 + sn, s * 1.7), at(H, 6.7 - sn, 5.4 + sn, 0)]], M.NOSE, s); }
  for (let k = 0; k < 4; k++) { const x = 2.4 + k * 1.2; line(g, at(H, x, 2.7 - k * 0.25, -2.2 + k * 0.2), at(H, x + 0.3, 3 - k * 0.25, 2.2 - k * 0.2), M.SKIN, 0); }
  // kulaklar
  // baş kalkınca kulaklar sırta yatmasın: eğimin çoğu geri alınır
  const hp = Math.max(0, Math.asin(clamp(H.f[1], -1, 1)) + 0.26) * 0.85;
  for (const s of [-1, 1]) {
    const e = P.ears[s > 0 ? 0 : 1], b = at(H, -1.8, 2.6, s * 2.4);
    const Fe = turn(frame(b, H.f, H.u, mul(H.r, s)), e.sw, e.bk - hp, e.sp);
    ball(g, mad(b, Fe.u, 0.6), 1.7, M.SKIN, 5);
    const c = ear(g, Fe, 15.5 * P.earL, 6.8, e.cu, e.fd);
    if (s > 0 === !(P.near < 0)) A.ear = c;
  }
  // arka bacaklar: ince, geriye kırık diz
  const curl = P.curl;
  for (const s of [-1, 1]) {
    const i = s > 0 ? 0 : 1, hip = at(root, -1, -1.6, s * 4.4), ft = reach(hip, curl > 0.01 ? mix(P.feet[i], at(root, 2, -7, s * 6), curl) : P.feet[i], 13.6), ank = mad(ft, [0, 1, 0], 1.6), kn = ik(hip, ank, 7.2, 6.8, [0.8, 0.2, s * 0.5]);
    ball(g, hip, 3.4, M.SKIN, 6); bone(g, hip, kn, 3.2, 2, M.SKIN, 1.15, 6); bone(g, kn, ank, 1.9, 1.3, M.SKIN, 1, 5);
    const fd = norm([root.f[0], 0, root.f[2]]);
    bone(g, ank, mad(ft, fd, 2.4), 1.3, 0.9, M.SKIN, 1, 5);
    for (let k = -1; k <= 1; k++) line(g, mad(mad(ft, fd, 2.4), [0, 0, 1], k * 0.8), mad(mad(mad(ft, fd, 4.2), [0, 0, 1], k * 1.3), [0, 1, 0], -0.4), M.CLAW, 3);
  }
  // ön kollar: uzun, boğumlara basar; kol ile böğür arasında katlı deri zar
  const fl = norm([root.f[0], 0, root.f[2]]);
  for (const s of [-1, 1]) {
    const i = s > 0 ? 2 : 3, op = P.open[i - 2], sh = at(chest, 0.5, -1.2, s * 6.4);
    const tg = curl > 0.01 ? mix(P.feet[i], at(chest, 6, -6, s * 4), curl) : P.feet[i], kn = reach(sh, tg, 22), wr = mad(kn, [0, 1, 0], 2.2 * (1 - op)), hy = clamp((wr[1] - sh[1]) / 10, 0, 1), el = ik(sh, wr, 11.2, 11, norm([-0.7 * (1 - hy), 0.1 + op * 0.5 * (1 - hy) - 0.5 * hy, s * (0.8 + 0.5 * hy)]));
    // zar: kol hattından böğre, aşağı sarkar
    const m = P.memb[i - 2], fk = 0.55 + m * 0.4, fa = [sh, mix(sh, el, 0.6), el, mix(el, wr, fk * 0.6), mix(el, wr, fk)], bd = [sh, at(mid, 2, -2.5, s * 5.2), at(mid, -3, -3, s * 5.4), at(root, 0, -2.6, s * 5), at(root, -1.5, -1.8, s * 4.6)];
    const rows = [0, 1, 2].map(k => fa.map((a, j) => { const q = k / 2, p = mix(a, bd[j], q); return mad(mad(p, [0, -1, 0], Math.sin(q * Math.PI) * (1.2 + m * 0.6) * (j > 1 ? 1 : 0.4)), [0, 0, s], Math.sin(q * Math.PI) * (0.6 + m * 2.4)); }));
    sheet(g, rows, M.WING, s);
    ball(g, sh, 4, M.SKIN, 7); bone(g, sh, el, 3.6, 2.6, M.SKIN, 1.2, 7); ball(g, el, 2.6, M.SKIN, 6); bone(g, el, wr, 2.8, 2, M.SKIN, 1.15, 7);
    // yumruk ve kanca pençeler: basarken öne yatık, saldırıda ön kol yönünde açılır
    const fa2 = norm(sub(wr, el)), d = norm(mix(fl, fa2, op)), up0 = norm(mix([0, 1, 0], cross(mul(chest.r, s), fa2), op * 0.6)), sd = norm(cross(d, up0)), up = cross(sd, d);
    const fist = mad(mad(wr, d, 1.2), up, -1.1 * (1 - op));
    ball(g, fist, 2.1, M.SKIN, 6);
    for (let k = 0; k < 3; k++) {
      const q = (k - 1) * (1.2 + op * 0.9), b = mad(mad(fist, sd, q), d, 1.3), L = 5.2 + op * 2.4 + (k === 1 ? 0.8 : 0), dd = norm(mad(d, sd, q * 0.12 * op));
      const m1 = mad(mad(b, dd, L * 0.6), up, 0.5), tip = mad(mad(m1, dd, L * 0.4), up, -1.8 - (1 - op) * 0.4);
      tube(g, [b, m1, tip], [0.75, 0.48, 0.12], 4, M.CLAW);
      if (k === 1 && s > 0 === !(P.near < 0)) A.hand = m1;
    }
  }
  A.mouth = at(H, 8.4, -1.6 - jw * 1.5, 0);
  return A;
}

const STEP = 4.6, PH = [0, 0.5, 0.25, 0.75], DIE_T = 1.8;
function step(ph, lift) { const c = ph - Math.floor(ph); if (c < 0.62) return [STEP * (1 - 2 * c / 0.62), 0]; const k = (c - 0.62) / 0.38, e = k * k * (3 - 2 * k); return [STEP * (2 * e - 1), Math.sin(k * Math.PI) * lift]; }
const mix1 = (a, b, k) => a + (b - a) * k;
function pose(o) {
  const t = o.t, A = o.A, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 2.1 + o.wob), listen = !o.act && !dead && o.e && o.e.listen ? 1 : 0;
  let px = -8, py = 12.6 + br * 0.25, pitch = 22, roll = 0, arch = 0, twist = 0, headP = -28, headY = 0, headR = 0, nk = 0, jaw = 0.06, sniff = 0.4, sonar = o.rage ? 0.55 : 0.3, bristle = o.rage ? 0.8 : 0, tail = 0, wag = 1, alpha = 1, shadow = 1, rate = 20, lookW = 0.6, curl = 0, earL = 1;
  const ears = [{ sw: 0.5, bk: 0.2, sp: 0.68, cu: 0.25, fd: 0 }, { sw: 0.5, bk: 0.2, sp: 0.68, cu: 0.25, fd: 0 }], open = [0, 0], memb = [0, 0];
  const feet = [[-15, 0, 5.6], [-15, 0, -5.6], [10, 0, 8.2], [10, 0, -8.2]];
  const E = (f, ...v) => ears.forEach((e, i) => f(e, i ? -1 : 1, ...v));
  // kulak seğirmesi: ara ara tek kulak hızla döner
  E((e, s) => { const ph = t * 0.8 + (s > 0 ? 0 : 0.43), n = Math.floor(ph), k = bump(0, 0.06, 0.16, 0.34, ph - n), h = hash(n * 3.1 + s); if (h > 0.45) { e.sw += (h - 0.72) * 2.4 * k; e.bk -= 0.25 * k; } });
  if (w > 0.01) {
    // boğum yürüyüşü: omuzlar yalpalar, baş sallanır, kulaklar geriye yatar
    const c = o.ph; feet.forEach((f, i) => { const [dx, dy] = step(c + PH[i], i > 1 ? 3.2 : 2.2); f[0] += dx * w; f[1] += dy * w; if (i > 1) open[i - 2] = Math.min(1, dy / 3.2) * 0.25 * w; });
    py += Math.sin(c * 2 * TAU) * 0.5 * w; roll += Math.sin(c * TAU) * 4 * w; twist += Math.sin(c * TAU + 0.8) * 0.12 * w; headY += Math.sin(c * TAU + 1.6) * 0.1 * w; headP -= Math.sin(c * 2 * TAU - 0.6) * 4 * w;
    E((e, s) => { e.bk += 0.3 * w + Math.sin(c * 2 * TAU - 1.2) * 0.12 * w; e.sw += 0.1 * w; });
  }
  if (listen) {
    // dinler: baş ağır ağır iki yana döner, kulaklar ayrı ayrı yön arar, burun koklar
    const k = 1, c = t * 0.9;
    headY += Math.sin(c) * 0.5 * k; headR += Math.sin(c + 0.9) * 16 * k; headP += 6 * k; py -= 0.8 * k; pitch -= 2 * k; sniff = 1.6; lookW = 0; sonar = 0.45 + 0.25 * Math.max(0, Math.sin(t * 2.6));
    E((e, s) => { e.sw += Math.sin(t * 1.3 + s * 1.7) * 0.55 - 0.15; e.bk = -0.2 + Math.sin(t * 1.1 + s) * 0.2; e.sp = 0.3 + Math.sin(t * 0.7 + s * 2) * 0.15; e.cu = 0.1; });
  }
  if (o.act === 'charge' && A) {
    if (o.stage === 'listen') {
      // donar: başı yana yatık, kulaklar sese döner ve dikilir
      const k = ss(0, 0.25, o.sinceStage), tw = Math.sin(t * 34) * (1 - ss(0, 0.2, o.sinceStage));
      py -= 1.6 * k; pitch -= 3 * k; headR += 18 * k; headP += 6 * k; lookW = 1; sniff = 0.2 + tw; sonar = 0.4 + 0.5 * k; jaw = 0.02; wag = 0.2;
      E((e, s) => { e.sw = lerp(e.sw, 0.1 + tw * 0.2 * s, k); e.bk = lerp(e.bk, -0.35, k); e.sp = lerp(e.sp, 0.2, k); e.cu = lerp(e.cu, 0.05, k); });
      feet[2][0] += 1.5 * k; feet[3][0] += 1.5 * k; open[0] = open[1] = 0.15 * k;
    } else if (o.stage === 'dash') {
      // alçak dörtnal: iki kol birlikte öne uzanır, kulaklar sırta yatar
      const c = o.sinceStage * 2.6, g = Math.sin(c * TAU), g2 = Math.sin(c * TAU - 1.6);
      px += 2; py = 9.5 + g * 1.2; pitch = 8 + g * 6; arch = -g * 0.12; headP = -10 + g * 4; nk = 1.5; jaw = 0.45; sniff = 0; lookW = 0.4; sonar = 0.5; tail = 1.5; wag = 0.3; rate = 42;
      feet[2] = [14 + 7 * g, Math.max(0, g2) * 4, 7.5]; feet[3] = [14.6 + 7 * g, Math.max(0, g2) * 4, -7.5]; open[0] = open[1] = 0.6 + 0.4 * Math.max(0, g);
      feet[0] = [-14 - 6 * g, Math.max(0, -g2) * 3, 5.6]; feet[1] = [-13.4 - 6 * g, Math.max(0, -g2) * 3, -5.6]; memb[0] = memb[1] = 0.3;
      E(e => { e.sw = 0.25; e.bk = 1.25 + g * 0.08; e.sp = 0.12; e.cu = 0.5; });
    } else {
      // kayarak durur: pençeleri yere geçirir, gövde geri yaslanır, kulaklar savrulur
      const k = bump(0, 0.08, 0.3, 0.45, o.sinceStage), f = ss(0, 0.3, o.sinceStage);
      px -= 2 * k; py -= 1.5 * k; pitch += 14 * k; headP += 10 * k; jaw = 0.3 * k; rate = 34;
      feet[2] = [17, 0, 8.6]; feet[3] = [17.4, 0, -8.6]; open[0] = open[1] = 0.5 * k; feet[0][0] += 6 * k; feet[1][0] += 6 * k;
      E(e => { e.bk = lerp(-0.4, 0.4, f); e.sw = -0.1; e.cu = 0.4 * (1 - f); });
    }
  } else if (o.act === 'scream' && A) {
    if (o.stage === 'wind') {
      // geri çekilir, soluk alır: göğüs şişer, kulaklar yelpaze gibi açılır
      const k = ss(0, 1, o.wind || o.sinceStage / 0.6);
      px -= 3 * k; py += 3 * k; pitch += 24 * k; headP += 16 * k; jaw = 0.25 * k; sonar = 0.4 + 0.5 * k; memb[0] = memb[1] = 0.4 * k; sniff = 0; lookW = 0.3; bristle = Math.max(bristle, 0.5 * k);
      E(e => { e.sw = lerp(e.sw, 0.95, k); e.bk = lerp(e.bk, -0.1, k); e.sp = lerp(e.sp, 1.05, k); e.cu = 0.05; });
      feet[2][0] -= 1 * k; feet[3][0] -= 1 * k;
    } else {
      // çığlık: çene ardına kadar açık, baş öne fırlar, kulaklar düzleşip geriye yatar, sonar parlar
      const k = ss(0, 0.08, o.sinceStage) * (1 - ss(0.45, 0.6, o.sinceStage) * 0.6), sh = Math.sin(t * 70) * 0.35 * k;
      px += 2.5 * k + sh; py += 0.5 * k; pitch += 2 * k; headP = lerp(headP, 6, k); nk = 3 * k; headR = sh * 8; jaw = 1 * k; sonar = 1; memb[0] = memb[1] = 0.85 * k; bristle = Math.max(bristle, k); lookW = 0.8; rate = 40; tail = 1.2 * k;
      E(e => { e.sw = lerp(e.sw, 0.7, k); e.bk = lerp(e.bk, 1.1, k); e.sp = lerp(e.sp, 0.75, k); e.cu = lerp(e.cu, 0.45, k); });
    }
  } else if (o.act === 'burrow' && A) {
    if (o.stage === 'sink') {
      // pençelerle eşeler, başını öne gömerek dalar
      const c = o.sinceStage, k = ss(0, 0.5, c), dg = Math.sin(c * 40);
      pitch -= 50 * k; py -= 3 * k; px += 3 * k; headP -= 16 * k; jaw = 0.3; sonar = 0.4; lookW = 0; rate = 40; tail = 2 * k;
      feet[2] = [13 + 4 * dg, Math.max(0, dg) * 3, 7]; feet[3] = [13 - 4 * dg, Math.max(0, -dg) * 3, -7]; open[0] = open[1] = 0.8;
      feet[0][0] += 4 * k; feet[1][0] += 4 * k; E(e => { e.bk = 1.4; e.sw = 0.2; e.sp = 0.05; e.cu = 0.6; e.fd = 0.5 * k; });
    } else {
      // yerin altından fırlar: dikilir, kollar havada, kulaklar açılır
      const c = o.stage === 'go' ? 0 : o.sinceStage, up = 1 - ss(0.3, 0.6, c), un = ss(0.05, 0.4, c);
      if (o.stage === 'go') { alpha = 0; shadow = 0; rate = 60; }
      pitch += 38 * up; px -= 3 * up; py += 3 * up; headP += 8 * up; jaw = 0.75 * up; sonar = 0.4 + 0.6 * un * up; memb[0] = memb[1] = up; open[0] = open[1] = up; bristle = Math.max(bristle, up); lookW = 0; rate = Math.max(rate, 36);
      feet[2] = [mix1(10, -1, up), 52 * up, mix1(8.2, 13, up)]; feet[3] = [mix1(10, -1, up), 52 * up, mix1(-8.2, -13, up)];
      E(e => { e.bk = lerp(1.4, -0.1, un); e.sp = lerp(0.05, 0.9, un); e.sw = -0.2; e.cu = lerp(0.6, 0.1, un); e.fd = 0.5 * (1 - un); });
    }
  } else if (o.act === 'tremor') {
    // arka ayaklarına kalkar, iki kolunu üç kez yere çarpar
    const c = o.since, rr = ss(0, 0.2, c) * (1 - ss(1.42, 1.6, c)), q = clamp(c - 0.05, 0, 1.5), cc = q - Math.floor(q / 0.5) * 0.5;
    const up = rr * ss(0, 0.17, cc) * (1 - ss(0.17, 0.25, cc)), dn = rr * ss(0.17, 0.25, cc) * (1 - ss(0.32, 0.5, cc)), hi = up + 0.35 * rr * (1 - dn);
    pitch += 46 * hi - 10 * dn; px += -4 * hi + 3 * dn; py += 4 * hi - 2.5 * dn; headP += 20 * up - 10 * dn; jaw = 0.3 * up + 0.7 * dn; sonar = 0.4 + 0.6 * dn; bristle = Math.max(bristle, rr * 0.6); rate = 44; lookW = 0.2;
    for (const i of [2, 3]) { const s = i === 2 ? 1 : -1; feet[i] = [mix1(feet[i][0], 2, hi) + 8 * dn, 44 * hi * (1 - dn), s * (8.2 + 6 * hi)]; open[i - 2] = 0.6 * hi + 0.3 * dn; memb[i - 2] = 0.6 * hi; }
    feet[0][0] += 3 * rr; feet[1][0] += 3 * rr;
    E(e => { e.bk += -0.3 * up + 0.9 * dn; e.sp += 0.3 * up; e.cu += 0.3 * dn; });
    if (dn > 0.3) { px += Math.sin(t * 60) * 0.3; }
  } else if (o.act === 'claws') {
    // üç ardışık pençe: sol, sağ, sol
    const c = o.since, rr = ss(0, 0.12, c) * (1 - ss(0.88, 1, c));
    pitch += 14 * rr; px -= 1 * rr; py += 1.5 * rr; headP += 6 * rr; jaw = 0.35 * rr; lookW = 0.6; rate = 46; sonar = 0.45;
    [[0.25, -1], [0.5, 1], [0.75, -1]].forEach(([h, s]) => {
      const i = s > 0 ? 2 : 3, up = bump(h - 0.2, h - 0.08, h - 0.06, h, c), sw = bump(h - 0.04, h + 0.02, h + 0.06, h + 0.2, c), cut = ss(h - 0.05, h + 0.05, c);
      if (up + sw < 0.01) return;
      const kk = Math.max(up, sw), a = [6, 26, s * 13], b = [24, 4, -s * 3];
      feet[i] = [mix1(mix1(feet[i][0], a[0], kk), b[0], cut * kk), mix1(mix1(0, a[1], kk), b[1], cut * kk), mix1(mix1(feet[i][2], a[2], kk), b[2], cut * kk)];
      open[i - 2] = kk; memb[i - 2] = 0.5 * kk; twist += s * (0.25 * up - 0.4 * sw); roll += s * (-6 * up + 8 * sw); headY -= s * 0.2 * sw;
    });
    E(e => { e.bk = 0.6; e.sp = 0.35; });
  } else if (o.act === 'melee') {
    // yakın yandaki pençeyi kaldırıp indirir, ardından ısırır
    const [up, dn] = meleeK(o), i = near > 0 ? 2 : 3, s = i === 2 ? 1 : -1;
    feet[i] = [feet[i][0] - 4 * up + 12 * dn, 22 * up + 6 * dn, feet[i][2] + s * 4 * up - s * 4 * dn]; open[i - 2] = Math.max(up, dn); memb[i - 2] = up * 0.6;
    pitch += 16 * up - 6 * dn; px += -1.5 * up + 3 * dn; roll += near * (-6 * up + 8 * dn); twist += s * (0.2 * up - 0.3 * dn); headP += 8 * up + 2 * dn; nk = 2.5 * dn; jaw = 0.3 * up + 0.9 * dn; rate = 46; lookW = 0.4;
    E(e => { e.bk += 0.9 * dn; e.sw += 0.1; });
  }
  if (o.rage && o.rageT < 1.2 && !dead) {
    // öfke: şaha kalkıp kükrer; kollar ve zarlar açık, sonar taşar
    const k = bump(0, 0.2, 0.85, 1.2, o.rageT), sh = Math.sin(t * 64) * 0.4 * k;
    pitch += 34 * k; px -= 4 * k + sh; py += 3 * k; headP += 12 * k; jaw = Math.max(jaw, k); sonar = Math.max(sonar, k); bristle = Math.max(bristle, k); lookW *= 1 - k; rate = 36;
    for (const i of [2, 3]) { const s = i === 2 ? 1 : -1; feet[i] = [mix1(feet[i][0], 0, k), 44 * k, mix1(feet[i][2], s * 21, k)]; open[i - 2] = k; memb[i - 2] = k; }
    E(e => { e.sp = lerp(e.sp, 1.0, k); e.bk = lerp(e.bk, 0.1, k); e.sw = lerp(e.sw, -0.4, k); });
  }
  if (o.hurt > 0 && !dead) {
    // irkilir: baş geri, kulaklar yatar, kısa tiz çığlık
    const h = o.hurt * o.hurt;
    px += clamp(o.hx * Math.cos(o.view), -1, 1) * 1.6 * h; headP += 16 * h; headR += near * 10 * h; jaw = Math.max(jaw, 0.6 * h); pitch += 5 * h; sonar = Math.max(sonar, 0.8 * h); sniff = 0;
    E(e => { e.bk = lerp(e.bk, 1.3, h); e.sp = lerp(e.sp, 0.2, h); e.cu += 0.4 * h; });
  }
  if (dead) {
    // tiz bir çığlık, sonra yan yatar; kulaklar katlanır, sonar söner
    const d = o.dying * DIE_T, sc = bump(0, 0.15, 0.45, 0.7, d), k = ss(0.45, 1.15, d), tw = bump(0.9, 1.1, 1.3, 1.6, d);
    pitch += 24 * sc; py += 2 * sc; headP += 30 * sc; jaw = 1 * sc + 0.35 * k; sonar = Math.max(0, (0.3 + 0.7 * sc) * (1 - ss(0.6, 1.4, d)));
    roll = lerp(roll, -near * 82, k); pitch = lerp(pitch, 4, k); py = lerp(py, 6.5, k); px = lerp(px, -9, k); headP = lerp(headP, -6, k) + Math.sin(d * 20) * 4 * tw; headR += -near * 20 * k; arch = -0.1 * k;
    curl = k * 0.85; tail = -1 * k; wag = 1 - k; bristle = 0; sniff = 0; lookW = 0; rate = 26;
    for (let i = 2; i < 4; i++) { open[i - 2] = 0.3 * k; memb[i - 2] = 0.2 * k; }
    E(e => { e.bk = lerp(e.bk, 1.3, k); e.sp = lerp(e.sp, 0.1, k); e.fd = 0.7 * k; e.cu = lerp(e.cu, 0.8, k); });
  }
  const [ly0, lp0] = aimLocal(o.tx - Math.cos(o.view) * 16, o.ty + 6, o.view), ly = clamp(ly0, -0.8, 0.8) * lookW, lp = clamp(lp0, -0.4, 0.6) * lookW;
  return {
    rate, px, py, pitch: pitch * D, roll: roll * D, arch, twist, headP: headP * D + lp, headY: headY + ly, headR: headR * D, nk, jaw, sniff, sonar, bristle, tail, wag, alpha, shadow, curl, earL,
    glow: 0.35 + 0.65 * sonar, ears, open, memb, feet, near, br: 0.04 * br,
  };
}

export const SAGIR3D = { w: 150, h: 124, ox: 75, oy: 104, scale: 1.2, tilt: 0.22, mats: MATS, stride: 13, shadow: 20, body: 40, bias: 0.34, turn: 0.5, outline: [10, 8, 18], wrap: ['roll'], hold: ['burrow'], pose, build };
