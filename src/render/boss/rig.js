// 3B boss iskeletlerinin ortak parçaları: vektör, eklem çerçevesi, ilkel şekiller, ters kinematik, duruş eğrileri.
// Birim: tasarım pikseli. +x ileri, +y yukarı, +z yaratığın sağı (kamera yanı).
import { vert, tri, line } from '../soft3d.js';

export const TAU = Math.PI * 2, D = Math.PI / 180;
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const mad = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], dotp = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const hash = n => { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };

// ---------- duruş eğrileri ----------
export const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
export const bump = (a, b, c, d, x) => ss(a, b, x) * (1 - ss(c, d, x));
export function track(x, keys) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x < keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], ss(keys[i - 1][0], keys[i][0], x));
  return keys[keys.length - 1][1];
}
// duruşları ağırlıkla karıştırır: sayılar ve iç içe diziler/nesneler; a değişmez
export function blend(a, b, k) {
  if (typeof a === 'number') return typeof b === 'number' ? a + (b - a) * k : a;
  if (Array.isArray(a)) return a.map((v, i) => b && b[i] !== undefined ? blend(v, b[i], k) : v);
  if (a && typeof a === 'object') { const o = {}; for (const key in a) o[key] = b && b[key] !== undefined ? blend(a[key], b[key], k) : a[key]; return o; }
  return a;
}
// kameranın y ekseni açısı: hedefe göre profil + üç çeyrek eğim; hedef aşağıdaysa kameraya, yukarıdaysa sırtını döner
export function viewOf(yaw, bias = 0.3, turn = 0.5) {
  const dev = bias + Math.asin(clamp(Math.sin(yaw), -1, 1)) * turn;
  return Math.cos(yaw) >= 0 ? dev : Math.PI - dev;
}
// ekran düzlemindeki yön (dx sağ, dy aşağı) -> gövde çerçevesinde [sapma (sağa +), yükselme (yukarı +)]
export function aimLocal(dx, dy, view) {
  const d = Math.hypot(dx, dy) || 1, px = dx / d;
  return [Math.atan2(-px * Math.sin(view), px * Math.cos(view)), Math.asin(clamp(-dy / d, -1, 1))];
}

// ---------- çerçeve (eklem) ----------
export const frame = (p, f = [1, 0, 0], u = [0, 1, 0], r = [0, 0, 1]) => ({ p, f, u, r });
export function turn(F, yaw = 0, pitch = 0, roll = 0) {
  let { f, u, r } = F;
  if (yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); [f, r] = [mad(mul(f, c), r, s), mad(mul(r, c), f, -s)]; }
  if (pitch) { const c = Math.cos(pitch), s = Math.sin(pitch); [f, u] = [mad(mul(f, c), u, s), mad(mul(u, c), f, -s)]; }
  if (roll) { const c = Math.cos(roll), s = Math.sin(roll); [u, r] = [mad(mul(u, c), r, s), mad(mul(r, c), u, -s)]; }
  return frame(F.p, f, u, r);
}
export const at = (F, x, y, z) => [F.p[0] + F.f[0] * x + F.u[0] * y + F.r[0] * z, F.p[1] + F.f[1] * x + F.u[1] * y + F.r[1] * z, F.p[2] + F.f[2] * x + F.u[2] * y + F.r[2] * z];
export const dir = (F, x, y, z) => [F.f[0] * x + F.u[0] * y + F.r[0] * z, F.f[1] * x + F.u[1] * y + F.r[1] * z, F.f[2] * x + F.u[2] * y + F.r[2] * z];
export const move = (F, d) => frame(mad(F.p, F.f, d), F.f, F.u, F.r);
export const shift = (F, x, y, z) => frame(at(F, x, y, z), F.f, F.u, F.r);

// ---------- ilkel şekiller ----------
// eliptik kesit halkası; v: 0.25 sırt, 0.75 karın
export function ring(g, c, t, up, rx, ry, sides, u) {
  const r = norm(cross(t, up)), u2 = cross(r, t), base = g.nv;
  for (let j = 0; j <= sides; j++) {
    const a = j / sides * TAU, x = Math.cos(a), y = Math.sin(a);
    vert(g, [c[0] + r[0] * x * rx + u2[0] * y * ry, c[1] + r[1] * x * rx + u2[1] * y * ry, c[2] + r[2] * x * rx + u2[2] * y * ry],
      norm([r[0] * x * ry + u2[0] * y * rx, r[1] * x * ry + u2[1] * y * rx, r[2] * x * ry + u2[2] * y * rx]), u, j / sides);
  }
  return base;
}
export function band(g, a, b, sides, m) { for (let j = 0; j < sides; j++) { tri(g, a + j, a + j + 1, b + j, m); tri(g, a + j + 1, b + j + 1, b + j, m); } }
export function cap(g, base, sides, c, n, m) { const k = vert(g, c, n, 0, 0.3); for (let j = 0; j < sides; j++) tri(g, base + j, base + j + 1, k, m); }
export const anyUp = t => Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
// düz kemik: iki uç yarıçapı, ortada kas şişkinliği
export function bone(g, a, b, ra, rb, m, bulge = 1, sides = 7, close = false) {
  const d = sub(b, a), t = norm(d), up = anyUp(t), L = len(d);
  const A = ring(g, a, t, up, ra, ra, sides, 0), B = ring(g, mad(a, d, 0.38), t, up, lerp(ra, rb, 0.38) * bulge, lerp(ra, rb, 0.38) * bulge, sides, L * 0.38), C = ring(g, b, t, up, rb, rb, sides, L);
  band(g, A, B, sides, m); band(g, B, C, sides, m);
  if (close) cap(g, C, sides, mad(b, t, rb * 0.5), t, m);
}
export function ball(g, c, r, m, n = 6) {
  let prev = -1;
  for (const [y, k] of [[-1, 0], [-0.7, 0.71], [0, 1], [0.7, 0.71], [1, 0]]) {
    const base = g.nv;
    for (let j = 0; j <= n; j++) { const a = j / n * TAU, d = [Math.cos(a) * k, y, Math.sin(a) * k]; vert(g, mad(c, d, r), d, 0, 0.3); }
    if (prev >= 0) band(g, prev, base, n, m); prev = base;
  }
}
// çerçeveye oturan elipsoit: yarıçaplar ileri, yukarı, yana
export function ell(g, F, rx, ry, rz, m, n = 8, rows = 5) {
  let prev = -1;
  for (let i = 0; i <= rows; i++) {
    const a = -Math.PI / 2 + i / rows * Math.PI, y = Math.sin(a), k = Math.cos(a), base = g.nv;
    for (let j = 0; j <= n; j++) { const b = j / n * TAU, x = Math.cos(b) * k, z = Math.sin(b) * k; vert(g, at(F, x * rx, y * ry, z * rz), norm(dir(F, x / rx, y / ry, z / rz)), j / n * 8, i / rows); }
    if (prev >= 0) band(g, prev, base, n, m); prev = base;
  }
}
// eğri boru (boynuz, kök, dokunaç): noktalar ve yarıçaplar, uç kapalı
export function tube(g, pts, rs, sides, m) {
  let prev = -1, u = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])), r = typeof rs === 'function' ? rs(i) : rs[i];
    if (i) u += len(sub(pts[i], pts[i - 1]));
    const base = ring(g, pts[i], t, anyUp(t), r, r, sides, u);
    if (prev >= 0) band(g, prev, base, sides, m); prev = base;
    if (i === pts.length - 1) cap(g, base, sides, mad(pts[i], t, r), t, m);
  }
}
// düz yüz: normal ref noktasından dışarı bakar
export function face(g, a, b, c, m, ref) {
  let n = norm(cross(sub(b, a), sub(c, a))); if (ref && dotp(n, sub(a, ref)) < 0) n = mul(n, -1);
  tri(g, vert(g, a, n), vert(g, b, n), vert(g, c, n), m);
}
export function quad(g, a, b, c, d, m, ref) { face(g, a, b, c, m, ref); face(g, a, c, d, m, ref); }
// sivri diken: tabanı c'de, ucu tip'te
export function spike(g, c, tip, r, m, sides = 4) {
  const t = norm(sub(tip, c)), up = anyUp(t), rr = norm(cross(t, up)), u2 = cross(rr, t);
  let prev = null, first = null;
  for (let j = 0; j <= sides; j++) {
    const a = j / sides * TAU, p = j === sides ? first : mad(mad(c, rr, Math.cos(a) * r), u2, Math.sin(a) * r);
    if (!first) first = p;
    if (prev) face(g, prev, p, tip, m, c);
    prev = p;
  }
}
// çift yüzlü zar/kumaş üçgeni: s yüzün yönünü seçer (arka yüz malzemenin back alanıyla çizilir)
export function leaf(g, a, b, c, m, s = 1) { const n = mul(norm(cross(sub(b, a), sub(c, a))), s); tri(g, vert(g, a, n), vert(g, b, n), vert(g, c, n), m); }
// uzunlamasına kesitlerden gövde (kafa, çene, zırh): [x, merkez y, yarı genişlik, yarı yükseklik]; taban/tavan düzlenir
export function loft(g, F, secs, sides, m, o = {}) {
  const K = o.k || 1; let prev = -1, pf = null;
  for (let k = 0; k < secs.length; k++) {
    const [x, cy, rx, ry] = secs[k], base = g.nv, fl = [];
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU, ca = Math.cos(a), sa = Math.sin(a);
      let y = cy + sa * ry, flat = 0, n = norm([0, sa * rx, ca * ry]);
      if (o.floor != null && y < o.floor) { y = o.floor; flat = 1; n = [0, -1, 0]; }
      if (o.ceil != null && y > o.ceil) { y = o.ceil; flat = 1; n = [0, 1, 0]; }
      vert(g, at(F, x * K, y * K, ca * rx * K), dir(F, n[0], n[1], n[2]), x * K + 40, j / sides); fl.push(flat);
    }
    if (prev >= 0) for (let j = 0; j < sides; j++) { const mm = fl[j] && fl[j + 1] && pf[j] && pf[j + 1] ? o.flat : m; tri(g, prev + j, prev + j + 1, base + j, mm); tri(g, prev + j + 1, base + j + 1, base + j, mm); }
    else if (o.back) cap(g, base, sides, at(F, (x - rx * 0.5) * K, cy * K, 0), mul(F.f, -1), m);
    prev = base; pf = fl;
    if (k === secs.length - 1) cap(g, base, sides, at(F, (x + rx * 0.5) * K, cy * K, 0), F.f, m);
  }
}
export function catmull(a, b, c, d, k) {
  const k2 = k * k, k3 = k2 * k, o = [0, 0, 0];
  for (let i = 0; i < 3; i++) o[i] = 0.5 * (2 * b[i] + (c[i] - a[i]) * k + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * k2 + (3 * b[i] - a[i] - 3 * c[i] + d[i]) * k3);
  return o;
}
// eklemlerden geçen kesintisiz deri: J = [{ p, u, rx, ry }]; each(q, t, i, u) her halkada çağrılır (diken, süs)
export function skin(g, J, sides, m, o = {}) {
  const n = o.sub || 3, R = [];
  for (let i = 0; i < J.length - 1; i++) {
    const a = J[Math.max(0, i - 1)], b = J[i], c = J[i + 1], d = J[Math.min(J.length - 1, i + 2)];
    for (let s = 0; s < n; s++) { const k = s / n; R.push({ p: catmull(a.p, b.p, c.p, d.p, k), u: mix(b.u, c.u, k), rx: lerp(b.rx, c.rx, k), ry: lerp(b.ry, c.ry, k), k: i + k }); }
  }
  R.push({ ...J[J.length - 1], k: J.length - 1 });
  let u = 0, prev = -1;
  for (let i = 0; i < R.length; i++) {
    const q = R[i], t = norm(sub(R[Math.min(R.length - 1, i + 1)].p, R[Math.max(0, i - 1)].p));
    if (i) u += len(sub(q.p, R[i - 1].p));
    const base = ring(g, q.p, t, q.u, q.rx, q.ry, sides, u);
    if (prev >= 0) band(g, prev, base, sides, m); else if (!o.open) cap(g, base, sides, mad(q.p, t, -Math.min(q.rx, q.ry) * 0.5), mul(t, -1), m);
    prev = base;
    if (o.each) o.each(q, t, i, u);
    if (i === R.length - 1 && !o.open) cap(g, base, sides, mad(q.p, t, Math.min(q.rx, q.ry) * 0.5), t, m);
  }
}
// iki kemikli ters kinematik: dirseğin/dizin konumu
export function ik(H, T, l1, l2, pole) {
  const d = sub(T, H), L = Math.max(0.2, len(d)), n = mul(d, 1 / L), Lc = clamp(L, Math.abs(l1 - l2) + 0.2, l1 + l2 - 0.01);
  const a = (l1 * l1 - l2 * l2 + Lc * Lc) / (2 * Lc), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return mad(mad(H, n, a), norm(mad(pole, n, -dotp(pole, n))), h);
}
// hedef uzanamayacak kadar uzaksa kalçadan uzanabildiği yere çeker
export function reach(H, T, max) { const d = sub(T, H), L = len(d); return L > max ? mad(H, d, max / L) : T; }

// ---------- ortak uzuvlar ----------
// yarasa kanadı. C: gövde çerçevesi, S: omuz, hip: zarın gövdeye bağlandığı arka nokta, s: yan (+1/-1)
// W = { open, fan, flap, lean, sweep, wave, span }; cfg = { fold, open, fly, arm, fingers, r, memb, bone, claw }
// cfg.bands: zarın bilekten uca üç kuşağının malzemeleri (uca doğru seyrelen gölge); cfg.finger: parmak kemiği kalınlığı (yoksa çizgi)
export function batWing(g, C, S, hip, s, W, cfg) {
  const cf = Math.cos(W.flap), sf = Math.sin(W.flap), la = -s * W.lean * W.open + (W.sweep || 0), cl = Math.cos(la), sl = Math.sin(la);
  // lean: açıkken uzak kanat öne, yakın kanat geriye yatar (iki kanat da okunur)
  const sp = W.span || 0, D = (a, b, k, c) => { const v = norm(c && sp ? mix(mix(a, b, k), c, sp) : mix(a, b, k)), x = v[0] * cl - v[1] * sl, y = v[0] * sl + v[1] * cl; return dir(C, x, y * cf + v[2] * sf, (v[2] * cf - y * sf) * s); };
  const { fold, open, fly } = cfg, E = mad(S, D(fold.h, open.h, W.open, fly && fly.h), cfg.arm[0]), Wr = mad(E, D(fold.a, open.a, W.open, fly && fly.a), cfg.arm[1]);
  const tips = fold.f.map((f, i) => mad(Wr, D(f, open.f[i], W.fan, fly && fly.f[i]), cfg.fingers[i]));
  // zar: karın yüzü normali (s ile); arka yüz malzemenin back alanıyla çizilir
  const mf = (a, b, c, m = cfg.memb) => leaf(g, a, b, c, m, s);
  const sag = (0.6 + W.fan * 1.6) * (1 + W.wave), n = tips.length;
  const panel = (O, a, b, scallop, m) => {
    const nrm = mul(norm(cross(sub(a, O), sub(b, O))), -s * sag), K = 3; let pa = O, pm = O, pb = O;
    for (let t = 1; t <= K; t++) {
      const k = t / K, na = mix(O, a, k), nb = mix(O, b, k), mm = cfg.bands ? cfg.bands[t - 1] : t === K && cfg.edge ? cfg.edge : m;
      const nm = mad(mix(mix(na, nb, 0.5), O, t === K ? scallop : 0), nrm, Math.sin(k * 2.2));
      if (t === 1) { mf(O, na, nm, mm); mf(O, nm, nb, mm); } else { mf(pa, na, nm, mm); mf(pa, nm, pm, mm); mf(pm, nm, nb, mm); mf(pm, nb, pb, mm); }
      pa = na; pm = nm; pb = nb;
    }
  };
  for (let i = 0; i < n - 1; i++) panel(Wr, tips[i], tips[i + 1], cfg.scallop || 0.16);
  panel(Wr, tips[n - 1], E, 0.05); mf(E, tips[n - 1], hip); mf(S, E, hip); mf(S, Wr, E);
  const r = cfg.r;
  bone(g, S, E, r[0], r[1], cfg.bone, 1.1, 5); ball(g, E, r[1], cfg.bone, 5); bone(g, E, Wr, r[2], r[3], cfg.bone, 1, 5);
  for (const t of tips) if (cfg.finger) bone(g, Wr, t, cfg.finger, cfg.finger * 0.35, cfg.bone, 1, 4, true); else line(g, Wr, t, cfg.bone, cfg.tone ?? 3);
  line(g, Wr, mad(Wr, D([0.6, 0.8, 0], [0.6, 0.8, 0], 0), 2.6), cfg.claw, 3);
  return { E, Wr, tips };
}
// alev dili: tabanı a, ucu b; orta kesit yana savrulur (bend). u: 0 taban .. 1 uç (malzeme parlaklığı buna bağlanır)
export function flame(g, a, b, r, m, bend = [0, 0, 0], sides = 5) {
  const d = sub(b, a), t = norm(d), up = anyUp(t), mid = mad(mad(a, d, 0.5), bend, 1);
  const A = ring(g, a, t, up, r, r, sides, 0), B = ring(g, mid, t, up, r * 0.72, r * 0.72, sides, 0.5), k = vert(g, b, t, 1, 0);
  band(g, A, B, sides, m); for (let j = 0; j < sides; j++) tri(g, B + j, B + j + 1, k, m);
}
// köşeli parça (cam, kristal, kemik plaka): düz yüzlü kesik piramit. e: derinlik oranı, tw: eksen çevresinde dönme, fwd: yön veren ileri vektör
export function prism(g, a, b, ra, rb, m, sides = 4, tw = 0, e = 1, fwd = null) {
  const t = norm(sub(b, a)), r = norm(cross(t, fwd || anyUp(t))), u2 = cross(r, t), A = [], B = [], mid = mix(a, b, 0.5);
  for (let j = 0; j < sides; j++) { const an = j / sides * TAU + tw, c = Math.cos(an), s = Math.sin(an) * e; A.push(mad(mad(a, r, c * ra), u2, s * ra)); B.push(mad(mad(b, r, c * rb), u2, s * rb)); }
  for (let j = 0; j < sides; j++) { const k = (j + 1) % sides; quad(g, A[j], A[k], B[k], B[j], m, mid); }
  for (let j = 1; j < sides - 1; j++) { face(g, A[0], A[j], A[j + 1], m, b); face(g, B[0], B[j], B[j + 1], m, a); }
  return { A, B };
}
// çift yüzlü örtü (pelerin, etek): rows = aynı uzunlukta nokta sıraları
export function sheet(g, rows, m, s = 1) {
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < rows[i].length - 1; j++) {
    const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j + 1], d = rows[i + 1][j];
    leaf(g, a, b, c, m, s); leaf(g, a, c, d, m, s);
  }
}
// kurulmuş geometriyi c çevresinde küçültür/büyütür (bir noktaya çökme, belirme)
export function scaleGeo(g, c, s) {
  for (let i = 0; i < g.nv * 3; i += 3) { g.p[i] = c[0] + (g.p[i] - c[0]) * s; g.p[i + 1] = c[1] + (g.p[i + 1] - c[1]) * s; g.p[i + 2] = c[2] + (g.p[i + 2] - c[2]) * s; }
  for (let i = 0; i < g.lines.length; i += 8) for (let k = 0; k < 6; k++) g.lines[i + k] = c[k % 3] + (g.lines[i + k] - c[k % 3]) * s;
  for (let i = 0; i < g.dots.length; i += 7) for (let k = 0; k < 3; k++) g.dots[i + k] = c[k] + (g.dots[i + k] - c[k]) * s;
}
