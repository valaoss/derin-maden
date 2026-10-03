// Ustabaşı: Birinci Ekibin ölü ustabaşısı, hâlâ vardiyada. Uzun, kambur, sıska iskelet; çatlak kask ve sönük kafa lambası,
// çürümüş aşı boyalı ceket, alet kemeri; sağ elde dev eski kazma, sol elde yeşil hayalet alevli fener. Hafif topallar.
import { dot, line, vert } from '../soft3d.js';
import { TAU, D, lerp, clamp, ss, bump, mix, mad, mul, sub, norm, cross, dotp, len, at, dir, frame, ell, ball, bone, skin, spike, prism, tube, band, ik, reach, aimLocal, meleeK, hash } from './rig.js';
import { biped, stride } from './biped.js';

const M = { BONE: 1, COAT: 2, PANTS: 3, LEATHER: 4, IRON: 5, WOOD: 6, VOID: 7, EYE: 8, LAMP: 9, LENS: 10, LIT: 11, HOT: 12, GLASS: 13, HELM: 14, RUST: 15, DIRT: 16 };
const S = { hip: 19, spine: 13, neck: 3.2, headX: 1.4, shW: 5.4, shY: -0.6, hipW: 2.7, arm: [9.4, 9.4], leg: [10, 10], ankle: 1.4 }, HL = 16;
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
const MATS = [];
MATS[M.BONE] = { ramp: ramp('#2e281e', '#625844', '#9c8e72', '#cbbf9e', '#efe6cc') };
// ceket: yıpranmış aşı boyası, boyuna lekeli
MATS[M.COAT] = { ramp: ramp('#1e160a', '#3c2e16', '#5e4a24', '#7e6632', '#a08648'), px: (u, v, i) => i + (fr(u * 0.35 + Math.sin(v * 19) * 0.3) < 0.3 ? -0.07 : 0.02) };
MATS[M.PANTS] = { ramp: ramp('#100e0c', '#221e1a', '#36302a', '#4c443a', '#665a4c') };
MATS[M.LEATHER] = { ramp: ramp('#100806', '#22140c', '#3a2214', '#55341e', '#74492a') };
MATS[M.IRON] = { ramp: ramp('#101012', '#24242a', '#3c3c44', '#5c5c66', '#8a8a94') };
MATS[M.WOOD] = { ramp: ramp('#2a1c10', '#4e3620', '#76552f', '#a07c4a', '#caa66e'), px: (u, v, i) => i + (fr(u * 0.7) < 0.15 ? -0.1 : 0) };
MATS[M.VOID] = { ramp: ramp('#040306', '#040306', '#07060a', '#0b0a10', '#121018'), flat: true };
MATS[M.EYE] = { ramp: ramp('#3a8a62', '#5cc496', '#9af0c0', '#ccffe4', '#f4fff8'), flat: true, glow: 1 };
MATS[M.LAMP] = { ramp: ramp('#5cc496', '#9af0c0', '#c4ffe0', '#e8fff2', '#ffffff'), flat: true, glow: 1 };
MATS[M.LENS] = { ramp: ramp('#0c1210', '#16201c', '#22302a', '#34463c', '#4e6658') };
// fener camı: içi yeşil hayalet alevi (yanarken ışır, sönünce kara cam)
MATS[M.LIT] = { ramp: ramp('#2a6a4a', '#46a87a', '#78dcaa', '#a8f4cc', '#d8fff0'), glow: 0.9 };
MATS[M.HOT] = { ramp: ramp('#9af0c0', '#b4f8d4', '#ccffe4', '#e4fff0', '#f4fff8'), flat: true, glow: 1 };
MATS[M.GLASS] = { ramp: ramp('#080c0a', '#101814', '#1a2620', '#28382e', '#3a5042') };
// kask: ezik, soluk haki teneke
MATS[M.HELM] = { ramp: ramp('#1a180e', '#36301a', '#564c2a', '#78693a', '#a29052') };
// kazma başı: paslı demir
MATS[M.RUST] = { ramp: ramp('#160e0a', '#33201a', '#52342a', '#76584a', '#9a8a80'), px: (u, v, i) => i + (fr(u * 1.3 + v * 2.7) < 0.3 ? -0.08 : 0) };
MATS[M.DIRT] = { ramp: ramp('#2a2018', '#4a3a2c', '#6a5644', '#8a745c', '#a8927a') };

const orth = (v, n) => { const d = dotp(v, n), w = [v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d], l = len(w); return l > 1e-4 ? mul(w, 1 / l) : norm(cross(n, [0, 0, 1])); };
const rot = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), d = dotp(k, v) * (1 - c), x = cross(k, v); return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d]; };
// son kurulan parçayı (v0, l0, d0'dan bu yana) dönüştürür: f nokta, fn yön
function warp(g, v0, l0, d0, f, fn) {
  for (let i = v0; i < g.nv; i++) {
    const a = i * 3, p = f([g.p[a], g.p[a + 1], g.p[a + 2]]), n = fn([g.n[a], g.n[a + 1], g.n[a + 2]]);
    g.p[a] = p[0]; g.p[a + 1] = p[1]; g.p[a + 2] = p[2]; g.n[a] = n[0]; g.n[a + 1] = n[1]; g.n[a + 2] = n[2];
  }
  const L = g.lines; for (let i = l0; i < L.length; i += 8) for (const o of [0, 3]) { const p = f([L[i + o], L[i + o + 1], L[i + o + 2]]); L[i + o] = p[0]; L[i + o + 1] = p[1]; L[i + o + 2] = p[2]; }
  const Q = g.dots; for (let i = d0; i < Q.length; i += 7) { const p = f([Q[i], Q[i + 1], Q[i + 2]]); Q[i] = p[0]; Q[i + 1] = p[1]; Q[i + 2] = p[2]; }
}
// ölüm: parça (a eksen kökü, b ucu) devrilip yığına yatar; k 0 yerinde .. 1 yerde, r yerdeki yükseklik, sq büzülme
let PILE = [0, 0];
function settle(g, i, a, b, k, r, fn, sq = 0) {
  const v0 = g.nv, l0 = g.lines.length, d0 = g.dots.length; fn();
  if (k <= 0.001) return;
  const ax = norm(sub(b, a)), hl = Math.hypot(ax[0], ax[2]), ha = hash(i) * TAU, h = hl > 0.25 ? [ax[0] / hl, 0, ax[2] / hl] : [Math.cos(ha), 0, Math.sin(ha)];
  const c = cross(ax, h), cl = len(c), kk = cl > 1e-4 ? mul(c, 1 / cl) : [0, 0, 1], ang = Math.acos(clamp(dotp(ax, h), -1, 1)) * k, sp = (hash(i + 2) - 0.5) * 1.6 * k;
  const tx = lerp(a[0], PILE[0], 0.55) + (hash(i + 3) - 0.5) * 4, tz = lerp(a[2], PILE[1], 0.55) + (hash(i + 4) - 0.5) * 4, f = 1 - sq * k;
  const to = [lerp(a[0], tx, k), lerp(a[1], r + hash(i + 5) * 0.8, k * k), lerp(a[2], tz, k)], R = v => rot(rot(v, kk, ang), [0, 1, 0], sp);
  warp(g, v0, l0, d0, p => { const q = R(sub(p, a)); return [to[0] + q[0] * f, to[1] + q[1] * f, to[2] + q[2] * f]; }, R);
}
// kask kubbesi: üst yarım elipsoit, önü geniş siper
function helmet(g, F, rx, ry, rz, m) {
  const n = 10; let prev = -1;
  for (let i = 0; i <= 3; i++) {
    const a = i / 3 * Math.PI / 2, y = Math.sin(a), k = Math.cos(a), base = g.nv;
    for (let j = 0; j <= n; j++) { const b = j / n * TAU, x = Math.cos(b) * k, z = Math.sin(b) * k; vert(g, at(F, x * rx, y * ry, z * rz), norm(dir(F, x / rx, y / ry, z / rz)), j, i / 3); }
    if (prev >= 0) band(g, prev, base, n, m); prev = base;
  }
  const a0 = g.nv; for (let j = 0; j <= n; j++) { const b = j / n * TAU; vert(g, at(F, Math.cos(b) * rx, 0, Math.sin(b) * rz), F.u, 0, 0); }
  const a1 = g.nv; for (let j = 0; j <= n; j++) { const b = j / n * TAU, c = Math.cos(b); vert(g, at(F, c * (rx + (c > 0 ? 0.8 * c + 0.3 : 0.3)), -0.3 - Math.max(0, c) * 0.3, Math.sin(b) * (rz + 0.35)), F.u, 0, 0); }
  band(g, a0, a1, n, m);
}
// kazma: sap (butt -> baş), demir baş iki yana kıvrık; önde sivri uç, arkada küt keski. Yere gömülürse uç kısalır
function pickaxe(g, butt, hd, bd, dig) {
  const h = mad(butt, hd, HL), fd = norm(mad(bd, hd, -0.26));
  let Lf = 7.6; if (fd[1] < -0.05) Lf = clamp((h[1] - 0.2) / -fd[1], 0.5, 7.6);
  bone(g, butt, mad(h, hd, 0.8), 0.6, 0.75, M.WOOD, 1, 5);
  ball(g, butt, 0.75, M.WOOD, 4);
  prism(g, mad(h, hd, -1.5), mad(h, hd, 1.5), 1.25, 1.25, M.IRON, 4, 0.78, 1, bd);
  const k = Lf / 7.6;
  tube(g, [h, mad(mad(h, bd, 3.4 * k), hd, -0.3 * k), mad(mad(h, bd, 7.6 * k), hd, -2 * k)], [1.4, 1, 0.2], 5, M.RUST);
  tube(g, [h, mad(mad(h, bd, -3), hd, -0.3), mad(mad(h, bd, -5.8), hd, -1.4)], [1.4, 1.15, 0.85], 5, M.RUST);
  const tip = mad(mad(h, bd, 7.6 * k), hd, -2 * k);
  if (dig > 0.3) {
    // gömüldüğü yerde toprak kabarır, taşlar saçılır
    const c = [tip[0], 0, tip[2]];
    ell(g, frame(c), 3.6 * dig, 2 * dig, 3.2 * dig, M.DIRT, 7, 3);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + 0.4, ca = Math.cos(a), sa = Math.sin(a), r = (4 + hash(i) * 3) * dig;
      ball(g, [c[0] + ca * 3.6 * dig, 0.5, c[2] + sa * 3.3 * dig], 0.8, M.DIRT, 4);
      line(g, [c[0] + ca * 3.4, 0.05, c[2] + sa * 3.2], [c[0] + ca * (r + 2) + sa, 0.05, c[2] + sa * (r + 2) - ca], M.VOID, 0);
    }
  }
  return { h, tip };
}
// fener: üstte sap halkası, demir başlık, ışıyan cam, altta taban; v aşağı yönü (salınım)
function lantern(g, top, v, f, t) {
  const s = norm(cross(v, [0, 0, 1])), z = norm(cross(v, s)), c0 = mad(top, v, 1.6), c1 = mad(top, v, 4.4);
  line(g, mad(top, s, -0.9), top, M.IRON, 2); line(g, top, mad(top, s, 0.9), M.IRON, 2);
  line(g, mad(top, s, -0.9), mad(c0, s, -1), M.IRON, 2); line(g, mad(top, s, 0.9), mad(c0, s, 1), M.IRON, 2);
  prism(g, mad(top, v, 0.7), c0, 0.5, 1.5, M.IRON, 4, 0.78, 1, s);
  prism(g, c0, c1, 1.25, 1.25, f > 1.25 ? M.HOT : f > 0.2 ? M.LIT : M.GLASS, 4, 0.78, 1, s);
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) line(g, mad(mad(c0, s, a * 1.3), z, b * 1.3), mad(mad(c1, s, a * 1.3), z, b * 1.3), M.IRON, 1);
  prism(g, c1, mad(c1, v, 0.7), 1.6, 1.6, M.IRON, 4, 0.78, 1, s);
  if (f > 0.2) dot(g, mad(mad(top, v, 3), s, Math.sin(t * 9) * 0.3), M.HOT, 4);
  return mad(top, v, 3);
}

function build(g, P, o) {
  const A = {}, t = o.t, K = biped(P, S), { pel, waist, chest, head } = K, cr = P.crumble, near = P.near;
  const kp = i => cr <= 0 ? 0 : ss(0, 1, cr * 1.6 - hash(i + 20) * 0.6);
  PILE = [pel.p[0] + 2, 0];
  // el hedefleri omuz ortasında, yalnız gövde dönüşüyle dönen yatay çerçevede (kamburluktan bağımsız)
  // sağ el kazmayı tutar: elde (açıyla) ya da yere gömülü (dünya noktası) kip arası karışım
  const W = frame(chest.p, norm([chest.f[0], 0, chest.f[2]]), [0, 1, 0]); W.r = cross(W.f, W.u);
  const [ky, kpi] = P.pk, [uy, upi] = P.pu, pl = P.plant;
  const hdA = norm(dir(W, Math.cos(kpi) * Math.cos(ky), Math.sin(kpi), Math.cos(kpi) * Math.sin(ky))), bdA = orth(norm(dir(W, P.pb[0], P.pb[1], P.pb[2])), hdA);
  const u = [Math.cos(upi) * Math.cos(uy), Math.sin(upi), Math.cos(upi) * Math.sin(uy)], hdB = mul(u, -1), gB = mad(P.gp, u, HL - P.pg), bdB = orth([0, -1, 0], hdB);
  const hd = norm(mix(hdA, hdB, pl));
  const arm = (s, tgt) => { const sh = at(chest, 0, S.shY, s * S.shW), wr = reach(sh, tgt, 18.6); return { sh, wr, el: ik(sh, wr, S.arm[0], S.arm[1], dir(chest, -0.7, -0.4, s * 0.8)) }; };
  const R = arm(1, mix(at(W, P.hR[0], P.hR[1], P.hR[2]), gB, pl)), butt = mad(R.wr, hd, -P.pg), bd = orth(mix(bdA, bdB, pl), hd);
  const L = arm(-1, mix(at(W, P.hL[0], P.hL[1], P.hL[2]), mad(R.wr, hd, 4.2), P.two));
  const fd = norm([pel.f[0], 0, pel.f[2]]);

  // bacaklar: yırtık pantolon, dizden aşağısı çıplak kemik, ağır çizme
  [[K.legR, 1], [K.legL, -1]].forEach(([Lg, s], j) => {
    settle(g, 7 + j * 2, Lg.hip, Lg.knee, kp(7 + j * 2), 1.4, () => { bone(g, Lg.hip, Lg.knee, 1.9, 1.45, M.PANTS, 1.08, 6); ball(g, Lg.knee, 1.4, M.PANTS, 5); });
    settle(g, 8 + j * 2, Lg.foot, Lg.knee, kp(8 + j * 2), 1, () => {
      const mid = mix(Lg.knee, Lg.ank, 0.45);
      bone(g, Lg.knee, mid, 1.35, 1.25, M.PANTS, 1, 6);
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + s, c = mad(mad(mid, fd, Math.cos(a) * 1.2), [0, 0, 1], Math.sin(a) * 1.2); spike(g, mad(c, [0, 1, 0], 0.6), mad(c, [0, 1, 0], -1.4 - k * 0.3), 0.7, M.PANTS, 3); }
      bone(g, mid, Lg.ank, 0.65, 0.55, M.BONE, 1, 5);
      prism(g, [Lg.ank[0], Lg.foot[1] + 0.2, Lg.ank[2]], [Lg.ank[0], Lg.ank[1] + 0.9, Lg.ank[2]], 1.4, 1.2, M.LEATHER, 5, 0.3);
      prism(g, mad([Lg.ank[0], Lg.foot[1] + 1, Lg.ank[2]], fd, -1.2), mad([Lg.foot[0], Lg.foot[1] + 0.8, Lg.foot[2]], fd, 3.4), 1.5, 0.95, M.LEATHER, 4, 0.78, 0.65);
    });
  });
  // gövde: kambur sırt, aşı boyalı ceket, önü açık (kaburgalar), alet kemeri, yırtık etek
  settle(g, 2, pel.p, chest.p, kp(2), 2.2, () => {
    ell(g, frame(at(pel, 0, 0.4, 0), pel.f, pel.u, pel.r), 3.2, 2.8, 3.6, M.PANTS, 7, 4);
    skin(g, [
      { p: at(pel, 0, -0.6, 0), u: pel.f, rx: 3.5, ry: 2.8 }, { p: waist.p, u: waist.f, rx: 3.2, ry: 2.5 }, { p: at(chest, -0.3, -3.4, 0), u: chest.f, rx: 4.4, ry: 3 },
      { p: at(chest, -0.4, -0.2, 0), u: chest.f, rx: 4.6, ry: 2.6 }, { p: at(chest, -0.2, 1.6, 0), u: chest.f, rx: 1.8, ry: 1.5 },
    ], 8, M.COAT, { sub: 2 });
    ell(g, frame(at(chest, -1.9, -1.6, 0), chest.f, chest.u, chest.r), 2.3, 3.4, 3.7, M.COAT, 7, 4);
    ell(g, frame(at(chest, 2.1, -3.3, 0), chest.f, chest.u, chest.r), 1.3, 3.3, 1.9, M.VOID, 6, 4);
    for (let k = 0; k < 3; k++) { const y = -1.6 - k * 1.45; line(g, at(chest, 3.2, y, -1.8), at(chest, 3.6, y - 0.6, 0), M.BONE, 3); line(g, at(chest, 3.6, y - 0.6, 0), at(chest, 3.2, y, 1.8), M.BONE, 3); }
    line(g, at(chest, 3.6, -0.9, 0), at(chest, 3.6, -5.2, 0), M.BONE, 4);
    for (const s of [-1, 1]) spike(g, at(chest, -0.6, 0.8, s * 2.6), at(chest, -1.6, 3.4, s * 3.8), 1.2, M.COAT, 3);
    // kemer: tokası, sağda kese, solda asılı çekiç
    prism(g, at(pel, 0, 1.1, 0), at(pel, 0, 2.5, 0), 3.9, 3.7, M.LEATHER, 8, 0.2, 0.82, pel.f);
    ball(g, at(pel, 3.2, 1.8, 0), 0.7, M.IRON, 4);
    prism(g, at(pel, 0.8, 1.6, 3.7), at(pel, 0.8, -1.4, 3.9), 1.3, 1.1, M.LEATHER, 4, 0.78, 0.7, pel.f);
    const hm = at(pel, -1.2, 1.2, -3.9);
    bone(g, hm, mad(hm, [0, -1, 0], 4.6), 0.35, 0.35, M.WOOD, 1, 4); prism(g, mad(mad(hm, [0, -1, 0], 4.6), fd, -1.3), mad(mad(hm, [0, -1, 0], 4.6), fd, 1.1), 0.6, 0.5, M.IRON, 4, 0.78);
    // etek: kalçadan sarkan yırtık ceket parçaları; önü açık
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + 0.45, c = Math.cos(a), s = Math.sin(a); if (c > 0.75) continue;
      const top = at(pel, c * 3.2, 0.4, s * 3.7), sw = Math.sin(t * 1.9 + i * 1.3) * 0.4 + P.flap;
      prism(g, top, [top[0] + c * 0.9 - pel.f[0] * sw, top[1] - 5.2 - (i % 2) * 1.6, top[2] + s * 1 - pel.f[2] * sw], 1.9, 0.35, M.COAT, 3, a, 0.4);
    }
  }, 0.35);
  // kollar: yırtık kollu ceket omuzları, çıplak kemik ön kol
  [[R, 1], [L, -1]].forEach(([Ar, s], j) => {
    settle(g, 3 + j * 2, Ar.sh, Ar.el, kp(3 + j * 2), 1.4, () => {
      ball(g, Ar.sh, 2.1, M.COAT, 6); bone(g, Ar.sh, Ar.el, 1.7, 1.25, M.COAT, 1, 6);
      for (let k = 0; k < 2; k++) spike(g, mad(mix(Ar.sh, Ar.el, 0.85), chest.r, s * (k - 0.5) * 1.4), mad(mad(Ar.el, norm(sub(Ar.el, Ar.sh)), 1.4 + k * 0.4), chest.r, s * (k - 0.5)), 0.8, M.COAT, 3);
    });
    settle(g, 4 + j * 2, Ar.el, Ar.wr, kp(4 + j * 2), 0.8, () => {
      const fa = norm(sub(Ar.wr, Ar.el)), op = s > 0 ? P.open : 0;
      ball(g, Ar.el, 0.85, M.BONE, 4); bone(g, Ar.el, Ar.wr, 0.65, 0.55, M.BONE, 1, 5);
      if (op > 0.5) {
        // açık el: kazmayı yakalamaya hazır parmaklar
        const sd = norm(cross(fa, [0, 1, 0])), up = cross(sd, fa);
        for (let k = -1; k <= 1; k++) line(g, mad(Ar.wr, fa, 0.5), mad(mad(mad(Ar.wr, fa, 2.6), sd, k * 1.1), up, 0.4 - Math.abs(k) * 0.3), M.BONE, 4);
        line(g, mad(Ar.wr, fa, 0.3), mad(mad(Ar.wr, fa, 1.4), up, 1.3), M.BONE, 4);
        ball(g, mad(Ar.wr, fa, 0.4), 0.8, M.BONE, 4);
      } else ball(g, mad(Ar.wr, fa, 0.5), 1, M.BONE, 4);
    });
  });
  // baş: boyun omuru, kafatası, çene, kara göz çukurlarında yeşil ışık
  settle(g, 1, head.p, at(head, 3, 0, 0), kp(1), 4.6, () => {
    bone(g, at(chest, 0.2, -0.4, 0), head.p, 0.8, 0.7, M.BONE, 1, 4);
    ell(g, frame(at(head, 0.4, 2.3, 0), head.f, head.u, head.r), 3.6, 3.3, 3.1, M.BONE, 8, 5);
    ell(g, frame(at(head, 2.1, 0.9, 0), head.f, head.u, head.r), 2.2, 1.9, 2.4, M.BONE, 7, 4);
    const ja = P.jaw * 0.55, jf = { p: at(head, 0, 0.3, 0), f: norm(mad(mul(head.f, Math.cos(ja)), head.u, -Math.sin(ja))), u: norm(mad(mul(head.u, Math.cos(ja)), head.f, Math.sin(ja))), r: head.r };
    if (P.jaw > 0.12) ell(g, frame(at(head, 2.6, -0.5 - P.jaw * 0.5, 0), head.f, head.u, head.r), 1.4, 0.4 + P.jaw * 0.6, 1.6, M.VOID, 6, 3);
    ell(g, frame(at(jf, 2.3, -1.5, 0), jf.f, jf.u, jf.r), 2, 0.8, 2, M.BONE, 7, 3);
    line(g, at(head, 4.15, -0.35, -1.2), at(head, 4.15, -0.35, 1.2), M.BONE, 4);
    dot(g, at(head, 4.35, 0.45, 0), M.VOID, 0);
    for (const s of [-1, 1]) {
      ell(g, frame(at(head, 3.6, 1.5, s * 1.25), head.f, head.u, head.r), 0.85, 0.9, 0.85, M.VOID, 5, 3);
      const e = at(head, 4.5, 1.45, s * 1.25);
      if (P.eye > 0.25) { dot(g, e, M.EYE, P.eye > 0.7 ? 4 : 2); if (P.eye > 0.7) dot(g, e, M.EYE, 2, 0, 1); if (P.eye > 1.2) dot(g, e, M.EYE, 3, 0, -1); }
      if (s > 0 === near > 0) A.eye = e;
    }
  });
  A.mouth = at(head, 3.6, -0.7, 0); A.chest = at(chest, 3.2, -3.4, 0);
  // kask: düşerken yuvarlanır, lambası söner
  {
    const hf = frame(at(head, 0.3, 3.7, 0), head.f, head.u, head.r), v0 = g.nv, l0 = g.lines.length, d0 = g.dots.length;
    helmet(g, hf, 4.1, 3, 3.8, M.HELM);
    const dp = (la, lo) => at(hf, Math.cos(lo) * Math.cos(la) * 4, Math.sin(la) * 2.8, Math.sin(lo) * Math.cos(la) * 3.7);
    let q = dp(1.15, 0.9); for (const [la, lo] of [[0.85, 1.2], [0.7, 1], [0.4, 1.35], [0.15, 1.2]]) { const n = dp(la, lo); line(g, q, n, M.VOID, 0); q = n; }
    prism(g, at(hf, 3.6, 1.3, 0), at(hf, 4.8, 1.4, 0), 0.9, 1.15, M.IRON, 5, 0.3);
    ell(g, frame(at(hf, 4.8, 1.4, 0), head.f, head.u, head.r), 0.45, 0.9, 0.9, P.lamp > 0.5 ? M.LAMP : M.LENS, 6, 3);
    A.head = at(hf, 5.3, 1.4, 0);
    const k = P.hroll;
    if (k > 0.001) {
      const sv = Math.sin(o.view), cv = Math.cos(o.view), c0 = hf.p, d = norm([sv + cv * 0.8, 0, cv - sv * 0.8]), ax = norm(cross([0, 1, 0], d)), dist = 11 * ss(0.1, 1, k), ang = Math.PI * ss(0.1, 1, k) + Math.sin(k * 14) * 0.2 * (1 - k);
      const y = lerp(c0[1], 2.8, ss(0, 0.35, k)) + Math.max(0, Math.sin((k - 0.35) / 0.3 * Math.PI)) * 0.8 * (k > 0.35 && k < 0.65 ? 1 : 0);
      const to = [c0[0] + d[0] * dist, y, c0[2] + d[2] * dist], Rr = v => rot(v, ax, ang);
      warp(g, v0, l0, d0, p => { const q2 = Rr(sub(p, c0)); return [to[0] + q2[0], to[1] + q2[1], to[2] + q2[2]]; }, Rr);
      A.head = to;
    }
  }
  // kazma: elde ya da düşmüş
  if (P.hold > 0.5) {
    // düşen kazma: sap yatar, baş yere yan yatar
    const k = P.drop, ctr = mad(butt, hd, HL * 0.5), hl = Math.hypot(hd[0], hd[2]), hf = hl > 0.2 ? [hd[0] / hl, 0, hd[2] / hl] : [0, 0, 1];
    const h2 = norm(mix(hd, hf, k)), c2 = [ctr[0] + 2 * k, lerp(ctr[1], 1.4, k * k), ctr[2] + 2 * near * k], b2 = orth(mix(bd, norm(cross(hf, [0, 1, 0])), k), h2);
    const pk = pickaxe(g, mad(c2, h2, -HL * 0.5), h2, b2, P.dig);
    A.hand = pk.h; A.pick = pk.h; A.tip = pk.tip;
  } else A.hand = mad(R.wr, norm(sub(R.wr, R.el)), 1.5);
  A.grip = R.wr;
  // fener: sol elde ya da kemerde asılı; salınır
  {
    const hook = mix(L.wr, at(pel, 0.6, 0.6, -4), P.belt), v = norm([P.lsw[0], -1, P.lsw[1]]);
    settle(g, 12, hook, mad(hook, v, 2), P.drop, 1.4, () => { A.lantern = lantern(g, mad(hook, v, 0.6), v, P.flame, t); });
    if (P.drop > 0.001) A.lantern = [A.lantern[0], Math.max(1, A.lantern[1] * (1 - P.drop)), A.lantern[2]];
  }
  return A;
}

const DIE_T = 1.8, R2 = a => a.map(v => v * D);
const to = (a, b, k) => { for (let i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * k; };
function pose(o) {
  const t = o.t, A = o.A, dead = o.dying > 0, w = dead ? 0 : o.walk, near = Math.cos(o.view) >= 0 ? 1 : -1, br = Math.sin(t * 1.4 + o.wob);
  let x = 0, y = br * 0.25, lean = 9, twist = 0, roll = Math.sin(t * 0.5) * 1.5, rate = 20, lookW = 0.8;
  let pg = 2.5, two = 0, plant = 0, hold = 1, open = 0, belt = 0, flame = 1, lamp = 0, eye = 1, jaw = 0.08 + 0.05 * br, dig = 0, flap = 0.1, glow = 0.7, alpha = 1, shadow = 1, crumble = 0, drop = 0, hroll = 0;
  const bend = [16 + br * 1.2, 0, 0], head = [26 - br, 0, 0], fR = [1.8, 0, 3.1], fL = [-1.4, 0, -3.2];
  const hR = [4.5, -7.5, 6.4], hL = [6, -12.5, -3.2], pk = [2, 122], pb = [-1, -0.6, 0], gp = [12, 3.4, 1.2], pu = [180, 58], lsw = [Math.sin(t * 1.7) * 0.1, Math.sin(t * 1.3 + 1) * 0.08];
  if (w > 0.01) {
    // topal yürüyüş: sağ (sakat) bacak sürünür, üstüne basınca gövde çöker ve yana yatar
    const ph = o.ph, c = ph - Math.floor(ph), a = stride(ph, 5, 0.7), b = stride(ph + 0.5, 5, 2.6), dip = c < 0.62 ? Math.sin(c / 0.62 * Math.PI) : 0, cs = Math.cos(ph * TAU);
    fR[0] += a[0] * w; fR[1] += a[1] * w; fL[0] += b[0] * w; fL[1] += b[1] * w;
    y -= (1.5 * dip + 0.3) * w; roll += 7 * dip * w; head[2] -= 5 * dip * w; twist -= cs * 6 * w; bend[1] += cs * 6 * w; lean += 4 * w;
    hL[0] += cs * 2.4 * w; hR[1] += dip * 0.8 * w; lsw[0] += (-0.25 - cs * 0.15) * w; flap += 0.3 * w;
  }
  if (o.act === 'throw' && A) {
    if (o.stage === 'wind') {
      // kazmayı omzun üstünden geriye çeker, serbest kol hedefi gösterir
      const k = ss(0, 1, o.wind);
      to(hR, [-2.5, 8.5, 4.2], k); to(pk, [0, 196], k); to(pb, [0, 1, 0], k); to(hL, [8.5, -3.5, -3.5], k);
      lean -= 8 * k; bend[0] -= 12 * k; twist += 20 * k; head[0] += 6 * k; y += 0.5 * k; lsw[0] -= 0.3 * k; rate = 30; lookW = 0.6;
    } else {
      // kazma uçuyor: el boş, öne uzanmış açık avuç; dönüşünü bekler
      const s = o.sinceStage, f = ss(0, 0.15, s);
      hold = 0; open = 1; to(hR, [12, -1.5 + Math.sin(t * 7) * 0.4, 2], f); to(pk, [0, 60], 1); to(pb, [1, 0, 0], 1); to(hL, [-1, -11, -6.5], f);
      lean += 14 * f - 4 * ss(0.2, 0.7, s); bend[0] += 4 * f; twist -= 16 * f; head[0] += 4; lsw[0] += 0.3 * f; rate = s < 0.2 ? 44 : 22; lookW = 0.9;
    }
  } else if (o.prev === 'throw' && !o.act && o.since < 0.4) {
    // yakalayış: kazma ele çarpar, kol geri teper
    const c = bump(0, 0.04, 0.1, 0.4, o.since);
    to(hR, [6, -5, 5], c); lean -= 5 * c; x -= c; rate = 34;
  }
  let lift = 0;
  if (o.act === 'raise' || (o.prev === 'raise' && !o.act && o.since < 0.5)) {
    // feneri başının üstüne kaldırır, başı geriye düşer: ölü madencileri çağırır, yeşil alev büyür
    lift = o.act ? ss(0, 0.3, o.since) : 1 - ss(0, 0.5, o.since);
    to(hL, [3, 13, -3.5], lift); to(hR, [5, -5, 7], lift); to(pk, [8, 96], lift); to(pb, [1, 0, 0], lift);
    head[0] += 28 * lift; lean -= 9 * lift; bend[0] -= 14 * lift; jaw = Math.max(jaw, 0.75 * lift); flame += 0.75 * lift; glow += 0.3 * lift; lamp = lift; eye += 0.6 * lift;
    hL[0] += Math.sin(t * 23) * 0.35 * lift; y += 0.6 * lift; flap += 0.4 * lift; rate = 26; lookW *= 1 - lift;
  } else if (o.act === 'cage' && A) {
    if (o.stage === 'wind') {
      // iki eliyle kazmayı dikine kaldırır
      const k = ss(0, 1, o.wind);
      to(hR, [2, 8, 3], k); to(pk, [0, 96], k); to(pb, [1, 0.2, 0], k); two = k; belt = k;
      lean -= 6 * k; bend[0] -= 8 * k; head[0] += 10 * k; y += 0.6 * k; rate = 30; lookW = 0.4;
    } else {
      // kazmayı önündeki toprağa saplar, çömelip sapı tutar
      const s = o.sinceStage, j = 1 - ss(0, 0.3, s);
      plant = 1; two = 1; belt = 1; dig = 1; gp[0] = 14.5; gp[1] = 4; pu[1] = 46;
      y -= 3.5 + 1.5 * j; lean += 16; bend[0] += 10; head[0] -= 2; fR[0] += 1.5; fL[0] -= 2; fR[2] += 0.6; fL[2] -= 0.6; x += Math.sin(t * 50) * 0.3 * j; flap += 0.5 * j; rate = 55; lookW = 0.4;
    }
  } else if (o.act === 'collapse' && A) {
    if (o.stage === 'wind') {
      // iki elle başının üstünden geriye büyük kaldırış; tepede titrer
      const k = ss(0, 1, o.wind), tr = ss(0.7, 1, k);
      to(hR, [-3, 9.5, 2], k); to(pk, [0, 165], k); to(pb, [0, 1, 0], k); two = k; belt = k;
      lean -= 10 * k; bend[0] -= 16 * k; head[0] += 14 * k; y += 1.2 * k; fR[2] += 1 * k; fL[2] -= 1 * k; x += Math.sin(t * 34) * 0.3 * tr; rate = 26; lookW = 0.3;
    } else {
      // yere indirir: ağır darbe, gövde öne çöker
      const s = o.sinceStage, j = 1 - ss(0, 0.35, s);
      plant = 1; two = 1; belt = 1; dig = 1; gp[0] = 16.5; gp[1] = 4.2; pu[1] = 40;
      y -= 5 + 2 * j; lean += 26; bend[0] += 16; head[0] += 6; fR[0] = 3.5; fR[2] = 4; fL[0] = -3; fL[2] = -4; x += 1.5 + Math.sin(t * 50) * 0.5 * j; flap += 0.8 * j; rate = 60; lookW = 0;
    }
  } else if (o.act === 'lamp' || (o.prev === 'lamp' && !o.act && o.since < 0.8)) {
    // feneri yüzüne kaldırıp üfler, kafa lambası söner; çömelir (sonra ışınlanır)
    const c = o.act ? o.since : 0.7 + o.since, up = ss(0, 0.25, c) * (1 - ss(0.42, 0.6, c)), blow = bump(0.25, 0.32, 0.42, 0.5, c), dn = o.act ? ss(0.4, 0.7, c) : 1 - ss(0.1, 0.5, o.since);
    to(hL, [6.5, 6, -1.2], up); to(hL, [5, -9, -4.5], dn);
    head[0] -= 8 * up; jaw = Math.max(jaw, 0.45 * blow); lsw[0] += 0.4 * blow;
    flame = o.act ? 1 - ss(0.3, 0.48, c) : ss(0.3, 0.8, o.since); eye = 1 - 0.7 * (1 - flame); glow = 0.15 + 0.55 * flame;
    y -= 5 * dn; lean += 12 * dn; bend[0] += 8 * dn; head[0] += 4 * dn; to(hR, [4, -7, 4.5], dn); rate = 26; lookW *= 1 - up;
  } else if (o.act === 'melee') {
    // kazmayı yandan yatay savurur
    const [up, dn] = meleeK(o);
    to(hR, [-2, -1.5, 8.5], up); to(pk, [150, 12], up); to(pb, [0.6, 0, -1], up); to(hL, [2, -9, -7], up);
    to(hR, [10, -4, -3.5], dn); to(pk, [-48, -4], dn); to(pb, [-0.4, 0, -1], dn); to(hL, [0, -12, -6], dn);
    twist += 26 * up - 28 * dn; bend[1] += 10 * up - 12 * dn; lean += -4 * up + 12 * dn; x += -1 * up + 2 * dn; head[0] -= 4 * up; jaw = Math.max(jaw, 0.4 * dn); lsw[0] += 0.3 * up - 0.4 * dn; flap += 0.6 * dn;
    rate = 46; lookW = 0.3;
  }
  if (o.rage) {
    // öfke: lamba ve gözler yeşil yanar; ilk anda kollarını açıp çenesini sonuna dek açar
    lamp = 1; eye = Math.max(eye, 1.5); flame = Math.max(flame, 1.3); glow = 1;
    if (o.rageT < 1.2) {
      const r = bump(0, 0.2, 0.8, 1.2, o.rageT);
      to(hL, [2, 7, -8.5], r); to(hR, [0.5, 2, 9.5], r); to(pk, [50, 80], r);
      head[0] += 24 * r; jaw = Math.max(jaw, r); lean -= 8 * r; bend[0] -= 12 * r; x += Math.sin(t * 40) * 0.25 * r; flap += 0.6 * r; lookW *= 1 - r; rate = 30;
    }
  }
  if (o.hurt > 0 && !dead) {
    // kemikler takırdar: geri savrulur, çene açılır
    const h = o.hurt * o.hurt, back = clamp(o.hx * Math.cos(o.view), -1, 1);
    lean -= 9 * h; head[0] += 12 * h; jaw = Math.max(jaw, 0.8 * h); x += back * 1.5 * h + Math.sin(t * 70) * 0.3 * h; bend[1] += near * 8 * h; to(hL, [2, -8, -8], 0.5 * h); eye += 0.4 * h; flap += 0.4 * h;
  }
  if (dead) {
    // ölüm: sarsılır, dizleri çöker, kazma ve fener düşer; kemikler yığılır, kask yuvarlanır, ışık söner
    const d = o.dying * DIE_T, j = bump(0, 0.1, 0.25, 0.4, d), kn = ss(0.25, 0.75, d);
    head[0] += 18 * j - 20 * kn; jaw = 0.9 * j + 0.5 * kn; lean += -8 * j + 22 * kn; bend[0] += 8 * kn; y -= 9 * kn; x += Math.sin(t * 60) * 0.3 * j;
    to(hR, [3, -14, 5], kn); to(hL, [2, -14, -5], kn); belt = 0; two = 0; plant = 0; dig = 0;
    eye = (1 + 0.6 * j) * (1 - ss(0.3, 0.7, d)); lamp = 0; flame = 1 - ss(0.3, 0.8, d); glow = 0.8 * (1 - ss(0.3, 0.8, d));
    drop = ss(0.3, 0.75, d); crumble = ss(0.7, 1.5, d); hroll = ss(0.6, 1.6, d); lookW = 0; rate = 30; alpha = 1 - ss(0.88, 1, o.dying); shadow = 1 - 0.5 * crumble;
  }
  if (o.blink > 0 && !dead) alpha *= Math.sin(t * 55) > 0 ? 1 - 0.85 * o.blink : 1 - 0.35 * o.blink;
  const [ly0, lp0] = aimLocal(o.tx, o.ty + 40, o.view), ly = clamp(ly0, -1.1, 1.1) * lookW, lp = clamp(lp0, -0.5, 0.5) * lookW;
  return {
    rate, x, y, lean: lean * D, twist: twist * D, roll: roll * D, bend: [bend[0] * D, bend[1] * D + ly * 0.3, bend[2] * D], head: [head[0] * D + lp, head[1] * D + ly * 0.7, head[2] * D],
    footR: fR, footL: fL, hR, hL, pk: R2(pk), pb, pg, gp, pu: R2(pu), two, plant, hold, open, belt, flame, lamp, eye, jaw, dig, flap, lsw, glow, alpha, shadow, crumble, drop, hroll, near,
  };
}

// oyundaki ışık: fener ve (yanıyorsa) kafa lambası çevresine yeşil hale
function light(ctx, R, glow, a) {
  const P = R.P, l = R.at('lantern'), h = R.at('head');
  if (l && P.flame > 0.2) glow(l[0], l[1], '#9af0c0', 8 + 7 * P.flame, a * 0.3 * Math.min(1.4, P.flame));
  if (h && P.lamp > 0.3) glow(h[0], h[1], '#9af0c0', 10, a * 0.35 * P.lamp);
}

export const USTABASI3D = { w: 128, h: 108, ox: 64, oy: 86, scale: 1.15, tilt: 0.2, mats: MATS, stride: 15, shadow: 11, body: 44, bias: 0.4, turn: 0.55, outline: [6, 10, 8], ownDeath: true, hold: ['cage', 'collapse'], pose, build, light };
