// Dünya Yılanı: gövde oyundaki iz noktalarından (e.bs.body) geçen 3B boru olarak her karede kurulur; baş çeneli, dişli, boynuzlu, yelpazeli.
// Kamera düz bakar: model düzlemi ekran düzlemidir (x sağ, y yukarı), derinlik hacim ve örtüşme için kullanılır.
// Sırt ekranın yukarısına ve kameraya döner: yatay giderken üç çeyrek yandan, dikey giderken sırttan görünür.
import { createSurface, createGeo, resetGeo, camera, project, render, vert, tri, line } from '../soft3d.js';
import { TAU, sub, mul, mad, dotp, cross, len, norm, mix, lerp, clamp, ss, at, dir, turn, frame, ring, band, cap, loft, leaf, spike, tube, ell, ball } from './rig.js';

const M = { BODY: 1, BELLY: 2, FIN: 3, MOUTH: 4, TOOTH: 5, EYE: 6, HORN: 7, SPOT: 8, FRILL: 9, VENOM: 10, PUPIL: 11 };
const W = 304, H = 320, K = 1.6, SEG = 5, NECK = 24, SIDES = 12, UP = [0, 1, 0.6];
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
let T = 0, OFF = 1e9;
// deri: v 0.25 sırt, 0.75 karın. Karın açık renk levhalı; yanlarda iki sıra ışık beneği (kuyruktan başa akan dalga); sırt koyu eyerli, baklava pullu
function skin(u, v, i, out) {
  const s = v > 0.75 ? v - 1 : v < 0.25 ? v : 0.5 - v;
  if (s < -0.1) { out.id = M.BELLY; return i + (fr(u / 5) < 0.22 ? -0.16 : 0.04); }
  const big = Math.abs(s - 0.07) < 0.024 && fr(u / 11) < 0.27, small = Math.abs(s + 0.035) < 0.014 && fr(u / 11 + 0.5) < 0.15;
  if (big || small) {
    if (u > OFF) return i - 0.25;
    out.id = M.SPOT; return (big ? 0.42 : 0.3) + 0.58 * Math.max(0, Math.sin(T * 4 - u * 0.07));
  }
  if (s > 0.15 + 0.05 * Math.sin(u * 0.3)) i -= 0.2;
  const a = fr(u / 4.6 + s * 26), b = fr(u / 4.6 - s * 26);
  return i + (a < 0.2 || b < 0.2 ? -0.1 : a > 0.55 && b > 0.55 ? 0.07 : 0);
}
// yüzgeç zarı: ışınlar ve kenar açık
const web = (u, v, i) => i + (fr(u / 5) < 0.24 ? 0.22 : 0) + (v > 0.78 ? 0.3 : v < 0.2 ? -0.12 : 0);
function mats(rage) {
  const m = [];
  m[M.BODY] = { ramp: ramp('#020509', '#0a1a26', '#143648', '#22586a', '#4a8f98'), px: skin };
  m[M.BELLY] = { ramp: ramp('#06131a', '#1c4048', '#3a6e70', '#6aa39a', '#a8d4c0') };
  m[M.FIN] = { ramp: ramp('#040c1c', '#0e2444', '#1a4270', '#2c6c9c', '#5ab0d0'), px: web, back: M.FIN };
  m[M.FRILL] = { ramp: rage ? ramp('#1c0612', '#48102c', '#7c1c48', '#b83868', '#f07898') : ramp('#0c0a24', '#1e1c50', '#343684', '#5460b4', '#8c9ce4'), back: M.FRILL };
  m[M.MOUTH] = { ramp: ramp('#2a0610', '#4e0c1c', '#7a1a2c', '#a02c3e', '#c44a58'), flat: true };
  m[M.TOOTH] = { ramp: ramp('#7a8a8c', '#a8b8b8', '#ccdcdc', '#e8f4f4', '#ffffff') };
  m[M.HORN] = { ramp: ramp('#1a2a30', '#3a5258', '#6a8a8c', '#a0bcb8', '#d4e8e0') };
  m[M.EYE] = { ramp: rage ? ramp('#a82a50', '#e85a80', '#ffa0c0', '#ffd8e8', '#ffffff') : ramp('#2a90a8', '#5ad0e8', '#a0f0ff', '#d8ffff', '#ffffff'), flat: true, glow: 1 };
  m[M.SPOT] = { ramp: rage ? ramp('#3a0a20', '#6a1136', '#c02a60', '#ff6a9a', '#ffd8e8') : ramp('#0a3040', '#11556a', '#2aa0c0', '#6ae6ff', '#d8ffff'), flat: true, glow: 1 };
  m[M.VENOM] = { ramp: ramp('#1a7060', '#2ab090', '#5ae0c8', '#a8ffe8', '#ffffff'), flat: true, glow: 1 };
  m[M.PUPIL] = { ramp: ramp('#020509', '#020509', '#020509', '#020509', '#020509'), flat: true };
  return m;
}
const MATS = mats(false), RAGE = mats(true);
export const glows = id => !!(id && MATS[id].glow);
const rad = (fi, n) => (2.2 + 10.6 * Math.pow(Math.max(0, 1 - fi / n), 0.6)) * (0.7 + 0.3 * ss(0, 7, fi));
const bez = (a, b, c, d, k) => { const v = 1 - k; return [0, 1, 2].map(i => v * v * v * a[i] + 3 * v * v * k * b[i] + 3 * v * k * k * c[i] + k * k * k * d[i]); };
// başın sırt yönü: profil (üstü ekranın yukarı yanına) + kameraya eğim
export const upOf = a => { const fx = Math.cos(a), fy = -Math.sin(a), s = fx < 0 ? -1 : 1; return norm([-fy * s, fx * s, 0.45]); };

// gövde: C = [{ p, fi }] baştan kuyruğa; fi baştan uzaklık (boğum). Yüzme dalgası, soluk, sırt yelkeni, kuyruk yüzgeci
function body(g, C, t, n, upH, thrash, capHead) {
  const m = C.length, Q = [];
  for (let i = 0; i < m; i++) {
    const a = C[Math.max(0, i - 1)].p, b = C[Math.min(m - 1, i + 1)].p, tf = norm([a[0] - b[0], a[1] - b[1], 0.0001]), fi = C[i].fi;
    const r = rad(fi, n) * (1 + 0.035 * Math.sin(fi * 0.6 - t * 3)), k = ss(2, 13, fi);
    const w = (Math.sin(fi * 0.42 - t * 5) * (2.2 + 3 * fi / n) + Math.sin(fi * 0.7 - t * 14) * thrash * 8) * k;
    Q.push({ p: [C[i].p[0] - tf[1] * w, C[i].p[1] + tf[0] * w, Math.sin(fi * 0.4 - t * 2.2) * r * 0.3], r, fi });
  }
  let prev = -1, u = 0, fb = -1, fc = -1, vb = -1, vc = -1;
  for (let i = 0; i < m; i++) {
    const q = Q[i], tf = norm(sub(Q[Math.max(0, i - 1)].p, Q[Math.min(m - 1, i + 1)].p)), fi = q.fi;
    if (i) u += len(sub(q.p, Q[i - 1].p));
    let up = norm(mad(UP, tf, -dotp(UP, tf)));
    if (upH && fi < 6) { up = mix(upH, up, ss(0, 6, fi)); up = norm(mad(up, tf, -dotp(up, tf))); }
    const base = ring(g, q.p, tf, up, q.r, q.r, SIDES, u);
    if (prev >= 0) band(g, prev, base, SIDES, M.BODY); else if (capHead) cap(g, base, SIDES, mad(q.p, tf, q.r * 0.5), tf, M.BODY);
    if (i === m - 1) cap(g, base, SIDES, mad(q.p, tf, -q.r), mul(tf, -1), M.BODY);
    prev = base;
    const side = norm(cross(tf, up)), tail = ss(n - 13, n - 5, fi), end = 1 - ss(n - 2.5, n - 0.3, fi), sway = Math.sin(fi * 0.9 - t * 6) * 0.2;
    // sırt yelkeni: başın ardında yele, kuyrukta yüzgeç
    const h = ((3 + q.r * 0.75) * ss(0.5, 4, fi) * (0.82 + 0.18 * Math.sin(fi * 1.7)) + 6 * tail) * end;
    const b0 = mad(q.p, up, q.r * 0.8), b1 = vert(g, b0, side, u, 0), c1 = vert(g, mad(mad(mad(b0, up, h), tf, -h * 0.55), side, sway * h), side, u, 1);
    if (fb >= 0) { tri(g, fb, b1, c1, M.FIN); tri(g, fb, c1, fc, M.FIN); }
    fb = b1; fc = c1;
    // kuyruğun alt yüzgeci
    const hv = 5 * tail * end;
    if (hv > 0.3) {
      const d0 = mad(q.p, up, -q.r * 0.8), d1 = vert(g, d0, side, u, 0), e1 = vert(g, mad(mad(mad(d0, up, -hv), tf, -hv * 0.6), side, -sway * hv), side, u, 1);
      if (vb >= 0) { tri(g, vb, d1, e1, M.FIN); tri(g, vb, e1, vc, M.FIN); }
      vb = d1; vc = e1;
    } else vb = -1;
  }
}

const wU = x => (x < 9 ? 8.6 : x < 15 ? lerp(8.6, 6.6, (x - 9) / 6) : x < 21 ? lerp(6.6, 4.8, (x - 15) / 6) : lerp(4.8, 3, (x - 21) / 4.5)) * 0.86;
const wL = x => (x < 8 ? 7.4 : x < 17 ? lerp(7, 5.2, (x - 8) / 9) : x < 24 ? lerp(5.2, 3.2, (x - 17) / 7) : lerp(3.2, 1.6, (x - 24) / 4)) * 0.84;
// baş: göz Hd konumundadır (vuruş merkezi); kafatası geriye, burun ileriye uzanır
function head(g, Hd, hp, f, upH, t, out) {
  const u = norm(mad(upH, f, -dotp(upH, f))), r = cross(f, u), jaw = clamp(Hd.open, 0, 1), fl = clamp(Hd.flare ?? jaw, 0, 1);
  const F = frame(mad(hp, f, -10 * K), f, u, r), U = turn(F, 0, jaw * 0.28), Lw = turn(frame(at(F, -3 * K, -1.6 * K, 0), f, u, r), 0, -jaw * 0.7);
  loft(g, Lw, [[0, -2, 7.6, 4.4], [8, -2.2, 7, 4.2], [17, -1.7, 5.2, 3.2], [24, -1.1, 3.2, 2.1], [28, -0.5, 1.6, 1.1]], 8, M.BODY, { ceil: 0.3, flat: M.MOUTH, back: true, k: K });
  loft(g, U, [[-8, 1.4, 6.6, 6.4], [-3, 2.3, 9.6, 8.3], [3, 2.6, 10, 8], [9, 2.2, 8.6, 6.4], [15, 1.4, 6.6, 4.6], [21, 0.8, 4.8, 3.2], [25.5, 0.2, 3, 2.3], [27.5, -0.5, 1.6, 1.4]], 10, M.BODY, { floor: -1.6, flat: M.MOUTH, back: true, k: K });
  const P = (Fr, x, y, z) => at(Fr, x * K, y * K, z * K);
  for (const s of [-1, 1]) {
    // dişler: üst sıra dudağın üstüne biner, önde iki çift azı
    for (const x of [7, 10, 13, 16, 19]) line(g, P(U, x, -1.6, s * wU(x)), P(U, x + 0.3, -3.9, s * wU(x) * 0.96), M.TOOTH, 3);
    for (const x of [8, 11.5, 15, 18.5, 22]) line(g, P(Lw, x, 0.3, s * wL(x)), P(Lw, x, 2.4, s * wL(x)), M.TOOTH, 3);
    spike(g, P(U, 23, -1.4, s * 2.6), P(U, 23.6, -7, s * 2.3), 1.2 * K, M.TOOTH, 4);
    spike(g, P(U, 20.4, -1.4, s * 4), P(U, 20.7, -4.8, s * 3.8), 0.9 * K, M.TOOTH, 3);
    spike(g, P(Lw, 25, 0.2, s * 2), P(Lw, 25.4, 4.4, s * 1.9), K, M.TOOTH, 3);
    // boynuzlar geriye savrulur; kaş çıkıntısı, çene dikeni
    tube(g, [P(U, -2, 8, s * 4.6), P(U, -9, 13, s * 7), P(U, -16, 15.4, s * 7.6), P(U, -22, 15, s * 6.8)], [2.6 * K, 2.1 * K, 1.3 * K, 0.3 * K], 5, M.HORN);
    tube(g, [P(U, -5, 2.5, s * 9), P(U, -11, 3.6, s * 12.4), P(U, -17, 3, s * 13.2)], [1.7 * K, 1.1 * K, 0.3 * K], 5, M.HORN);
    spike(g, P(U, 12, 5.4, s * 6.4), P(U, 5.5, 9.6, s * 8.8), 1.4 * K, M.HORN, 4);
    spike(g, P(Lw, 9, -5.4, s * 3.4), P(Lw, 5.5, -10, s * 4), 1.2 * K, M.HORN, 4);
    // yelpaze: yüzerken yatık, kükrerken açılır
    const b = P(U, -5, 1, s * 8.6), th = 0.3 + fl * 0.45 + Math.sin(t * 3.1 + s) * 0.04, gap = 0.22 + fl * 0.33, tips = [];
    for (let k = 0; k < 5; k++) { const el = 0.1 + (k - 2) * gap + Math.sin(t * 5 + k * 1.3) * 0.03; tips.push(mad(b, dir(U, -Math.cos(th) * Math.cos(el), Math.sin(el), s * Math.sin(th) * Math.cos(el)), (11 + 4.5 * Math.sin(k / 4 * Math.PI)) * K)); }
    for (let k = 0; k < 4; k++) leaf(g, b, tips[k], tips[k + 1], M.FRILL, s);
    for (const p of tips) line(g, b, p, M.HORN, 2);
    // bıyıklar akıntıda dalgalanır
    let pb = P(U, 22, -0.5, s * 4.4);
    for (let k = 1; k <= 7; k++) { const q = P(U, 22 - k * 3.4, -0.5 - k * 1.1 + Math.sin(t * 4.2 - k * 0.8 + s) * (0.3 + k * 0.28), s * (4.4 + k * 1.5)); line(g, pb, q, M.FRILL, 3); pb = q; }
    const e = P(U, 10, 3.6, s * 7.6);
    ell(g, frame(e, U.f, U.u, U.r), 2.4 * K, 1.7 * K, 1.3 * K, M.EYE, 6, 4);
    line(g, P(U, 10.2, 4.8, s * 9), P(U, 10.2, 2.4, s * 9), M.PUPIL, 1);
    if (s * r[2] >= 0) out.eye = e;
  }
  // zehir: tükürmeden önce gırtlakta toplanır
  if (Hd.venom > 0.05) ball(g, P(F, 11, -1.5 - 5 * jaw, 0), Hd.venom * 3.4 * K, M.VENOM, 6);
  out.mouth = P(F, 20, -1.5 - 4 * jaw, 0);
}

let S, geo;
// pts: [x, y] dünya pikseli (baş tarafı önce); Hd: { x, y, a, open, flare, venom, up, dead, thrash, rage }; dönen: yüzey ve köken (dünya)
export function rasterSerpent(pts, Hd, t, n, drawHead) {
  S ||= createSurface(W, H); geo ||= createGeo(8192, 16384); resetGeo(geo);
  T = t; OFF = Hd.dead > 0 ? Math.max(0, 1 - Hd.dead * 1.6) * n * SEG : 1e9;
  let x0 = Hd.x, x1 = Hd.x, y0 = Hd.y, y1 = Hd.y;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const ox = Math.round((Math.max(x0, -40) + Math.min(x1, 312)) / 2), oy = Math.round((y0 + y1) / 2), P = q => [q[0] - ox, oy - q[1], 0];
  // baş ilerledikçe gövde kesintisiz kayar: boğum sırası kesirli
  const m = pts.length, frac = m ? clamp(Math.hypot(Hd.x - pts[0][0], Hd.y - pts[0][1]) / SEG, 0, 1) : 0;
  const f = [Math.cos(Hd.a), -Math.sin(Hd.a), 0], hp = P([Hd.x, Hd.y]), upH = Hd.up || upOf(Hd.a), C = [];
  let k0 = 0;
  if (drawHead) {
    // boyun: kafatasının ardından ize yumuşak bağlanır
    const N = mad(hp, f, -NECK); k0 = Math.min(m, 5); C.push({ p: N, fi: 0 });
    if (m > k0) {
      const a = P(pts[k0]), d = m > k0 + 1 ? norm(sub(a, P(pts[k0 + 1]))) : f, L = len(sub(a, N)) * 0.4;
      for (const q of [0.25, 0.5, 0.75]) C.push({ p: bez(N, mad(N, f, -L), mad(a, d, L), a, q), fi: (k0 + frac) * q });
    } else C.push({ p: mad(N, f, -8), fi: 1 });
  }
  for (let k = k0; k < m; k++) C.push({ p: P(k === m - 1 && m >= n && m > 1 ? [lerp(pts[k][0], pts[k - 1][0], frac), lerp(pts[k][1], pts[k - 1][1], frac)] : pts[k]), fi: k + frac });
  if (C.length > 1) body(geo, C, t, n, drawHead ? upH : null, Hd.thrash || 0, !drawHead);
  const pts3 = {};
  if (drawHead) head(geo, Hd, hp, f, upH, t, pts3);
  const cam = camera(0, 0, 1, W / 2, H / 2, 1);
  render(S, geo, cam, Hd.rage ? RAGE : MATS, { outline: [2, 5, 10] });
  const out = { S, ox: ox - W / 2, oy: oy - H / 2, at: {} };
  for (const k in pts3) { const q = project(cam, pts3[k]); out.at[k] = [out.ox + q[0], out.oy + q[1]]; }
  return out;
}

let cv, cx, img, gcv, gx, gimg, tcv, tx, last = null;
const ST = new WeakMap();
// oyun çizimi: saniyede 31 kez kurulur, ana ve ışık katmanı aynı kareyi paylaşır. post(cx, R): ana katman tuvaline son dokunuş (kayanın içindeki gövde)
export function drawSerpent3D(ctx, e, pts, Hd, t, n, drawHead, a = 1, glowLayer = false, post = null) {
  if (!cv) { const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }; cv = mk(); cx = cv.getContext('2d'); img = cx.createImageData(W, H); gcv = mk(); gx = gcv.getContext('2d'); gimg = gx.createImageData(W, H); tcv = mk(); tx = tcv.getContext('2d'); }
  const q = Math.floor(t * 31);
  if (!last || last.e !== e || last.q !== q) {
    // baş yön değiştirirken sırtı yumuşakça döner
    let st = ST.get(e); const tgt = upOf(Hd.a);
    if (!st) ST.set(e, st = { up: tgt, t });
    st.up = t < st.t || t - st.t > 0.5 ? tgt : norm(mix(st.up, tgt, 1 - Math.exp(-(t - st.t) * 9))); st.t = t; Hd.up = st.up;
    const R = rasterSerpent(pts, Hd, t, n, drawHead); last = { e, q, R };
    img.data.set(R.S.rgba); cx.putImageData(img, 0, 0);
    if (post) post(cx, R);
    const g = gimg.data, id = R.S.id, c = R.S.rgba;
    for (let q = 0, o = 0; q < id.length; q++, o += 4) { if (glows(id[q])) { g[o] = c[o]; g[o + 1] = c[o + 1]; g[o + 2] = c[o + 2]; g[o + 3] = 255; } else g[o + 3] = 0; }
    gx.putImageData(gimg, 0, 0);
  }
  const R = last.R;
  ctx.globalAlpha = a; ctx.drawImage(glowLayer ? gcv : cv, R.ox, R.oy);
  if (!glowLayer && e.hitT > 0 && !e.dead) {
    tx.globalCompositeOperation = 'copy'; tx.drawImage(cv, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = '#ffffff'; tx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a * 0.3; ctx.drawImage(tcv, R.ox, R.oy);
  }
  ctx.globalAlpha = 1;
  return R;
}
