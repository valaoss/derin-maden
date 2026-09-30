// Hazine Ejderi çizimi: kızıl-bronz pullu, altın karınlı, fildişi boynuzlu dört ayaklı ejder.
// Uykuda: altın yığınında kıvrılmış, burnundan duman; uyku ölçeri yükseldikçe kuyruğu seğirir, bir gözü aralanır.
// Uyanış: göz açılır, baş kalkar, altın üstünden kayar, kanatlar açılır ve kükrer. Nefesten önce göğsü içeriden parlar.
import { TILE, COLS } from '../config.js';
import { HOARD } from '../data/balance.js';
import { T, TD } from '../data/tiles.js';
import { G } from '../game/state.js';
import { clamp, lerp, hash2 } from '../core/util.js';
import { V, origin, wx, wy, poly, limb, circ, chain, bez, path, dot } from './beast.js';
import { coinPattern } from './hoard.js';
import { BOSS_ART } from '../data/bossart.js';
import { drawBossArt, drawBossArtGlow, drawArtFrame, artPoint, artPoseRow, artAttachment } from './bossart.js';
import { bossMotion, motionPoint } from './bossmotion.js';
import { drawBoss3D, boss3DPoint } from './boss3d.js';

const SC = 1.45;
const C = { scale: '#6a1a12', dark: '#3a0a08', back: '#2a0806', hi: '#a8442a', belly: '#c8902a', bellyD: '#8a5a18', wing: 'rgba(74,16,10,0.95)', wingFar: 'rgba(44,8,6,0.95)', bone: '#2a0806', horn: '#e0d0a8', hornD: '#8a7a60', claw: '#e8dcc0', eye: '#ffe060' };
const SLEEP = { crouch: 1, head: [27, -7], hang: 0.25, jaw: 0, eye: 0, sp: 0, tail: 'curl' };

// ---------- duruş ----------
function pose(src, alpha) {
  const t = G.time, P = { t, crouch: 0, head: [24, -38], hang: 0.35, jaw: 0.08, eye: 1, sp: 0.12, tail: 'rest', sweep: 0, chest: 0, walk: 0, ph: 0, lift: 0, fire: null, dying: 0, breath: 0, rage: false, stir: 0 };
  if (src.hoard) {
    const H = src.hoard; Object.assign(P, SLEEP);
    P.x = H.c * TILE + 8; P.y = H.r * TILE + 8; P.F = src.F || -1;
    P.breath = Math.sin(t * Math.PI * 2 / 3.2);
    if (H.st === 'sleep') {
      P.stir = H.lv; P.buried = 1; P.eye = H.lv >= 2 && ((t % 4) < 1.4) ? 0.35 : 0;
      if (H.lv >= 1) P.twitch = Math.sin(t * 9) * (H.lv >= 2 ? 3 : 1.5);
    } else {
      const k = clamp(H.t / HOARD.intro, 0, 1), ease = s => s * s * (3 - 2 * s);
      P.eye = clamp(k / 0.06, 0, 1); P.buried = 1 - ease(clamp((k - 0.22) / 0.33, 0, 1));
      const lift = ease(clamp((k - 0.18) / 0.35, 0, 1));
      P.crouch = 1 - lift; P.head = [lerp(27, 24, lift), lerp(-7, -40, lift)]; P.hang = lerp(0.25, -0.35, lift);
      P.tail = lift > 0.5 ? 'rest' : 'curl';
      P.jaw = k > 0.3 && k < 0.62 ? Math.sin((k - 0.3) / 0.32 * Math.PI) : 0.05;
      P.chest = P.jaw * 0.8;
      P.sp = k < 0.45 ? 0 : k < 0.72 ? lerp(0, 1.2, (k - 0.45) / 0.27) : lerp(1.2, 0.15, (k - 0.72) / 0.28);
      P.shake = k > 0.3 && k < 0.6;
    }
    return P;
  }
  const e = src.e, B = e.bs, A = B && B.act;
  P.x = lerp(e.px, e.x, alpha); P.y = lerp(e.py, e.y, alpha); P.F = e.face || 1; P.rage = !!(B && B.phase === 2);
  P.walk = Math.abs(e.x - e.px) > 0.04 && !(A && A.k === 'soar') ? 1 : 0; P.ph = e.anim * 0.8;
  if (P.rage) P.sp = 0.3 + Math.sin(t * 2) * 0.05;
  if (A) {
    if (A.k === 'breath') {
      if (A.stage === 'glow') { const k = clamp(e.wind || 0, 0, 1); P.chest = k; P.head = [lerp(24, 15, k), lerp(-38, -44, k)]; P.hang = lerp(0.35, -0.5, k); P.jaw = 0.15 + k * 0.2; P.crouch = k * 0.25; }
      else if (A.stage === 'fire') {
        const la = P.F > 0 ? A.a : Math.PI - A.a, ca = Math.cos(la), sa = Math.sin(la);
        P.head = [14 + ca * 24, -26 + sa * 18]; P.hang = la; P.jaw = 1; P.chest = 0.55; P.fire = la;
      }
    } else if (A.k === 'tail') { const k = clamp(e.wind || 0, 0, 1); P.tail = 'sweep'; P.sweep = A.done ? 1 - clamp((0.4 - A.T) / 0.4, 0, 1) * 0.3 : k; P.head = [26, -34]; }
    else if (A.k === 'gust') { const k = clamp(e.wind || 0, 0, 1); P.sp = A.done ? 1.25 - (0.7 - A.T) * 1.2 : 0.2 + k * 0.9; P.crouch = A.done ? 0 : k * 0.3; P.jaw = A.done ? 0.5 : 0.1; }
    else if (A.k === 'soar') { P.sp = 0.75 + Math.sin(t * 9) * 0.45; P.lift = 1; P.hang = A.stage === 'dive' ? 0.9 : 0.2; P.head = A.stage === 'dive' ? [26, -22] : [24, -36]; P.jaw = A.stage === 'hover' ? 0.4 : 0.1; }
  }
  if (e.dead) {
    const k = clamp(1 - e.dieT / (e.d.dieT || 1), 0, 1);
    P.dying = k; P.crouch = Math.min(1.3, k * 2); P.head = [lerp(24, 30, k), lerp(-38, -3, Math.min(1, k * 1.6))]; P.hang = lerp(0.35, 0.6, k);
    P.sp = lerp(0.3, 0.05, k); P.eye = 1 - clamp((k - 0.5) / 0.4, 0, 1); P.jaw = k < 0.3 ? Math.sin(k / 0.3 * Math.PI) : 0.2; P.chest = k < 0.25 ? 1 : Math.max(0, 1 - (k - 0.25) * 2);
    P.walk = 0; P.lift = 0;
  }
  P.hit = e.hitT > 0;
  return P;
}
function setO(ctx, P) { origin(ctx, Math.round(P.x) + (P.shake ? (Math.floor(P.t * 30) % 2 ? 1 : -1) : 0), Math.round(P.y + 7 - P.lift * 3), P.F, SC); }
const cy = (P, y) => y + P.crouch * (y < -4 ? 5 : 1) * clamp(-y / 24, 0, 1) - P.breath * 0.6 * clamp(-y / 24, 0, 1);
const up = (P, [x, y]) => [x, cy(P, y)];

function wing(P, s) {
  // s: +1 yakın kanat (geriye), -1 uzak kanat (boynun ardından öne)
  const sp = P.sp, d = s > 0 ? -1 : 1, sh = up(P, s > 0 ? [0, -24] : [8, -25]), k = s > 0 ? 1 : 0.8;
  const el = [sh[0] + d * lerp(8, 4, sp) * k, sh[1] - lerp(5, 22, sp) * k];
  const tip = [sh[0] + d * lerp(18, 34, sp) * k, sh[1] - lerp(2, 34, sp) * k];
  const edge = [[sh[0] + d * lerp(16, 36, sp) * k, sh[1] - lerp(0, 14, sp) * k], [sh[0] + d * lerp(12, 30, sp) * k, sh[1] + lerp(3, -2, sp) * k], [sh[0] + d * lerp(7, 18, sp) * k, sh[1] + lerp(5, 5, sp)]];
  const low = up(P, s > 0 ? [-8, -18] : [4, -19]);
  return { sh, el, tip, edge, low };
}
function legs(P) {
  const s = Math.sin(P.ph) * 3 * P.walk, l1 = Math.max(0, Math.cos(P.ph)) * 2 * P.walk, l2 = Math.max(0, -Math.cos(P.ph)) * 2 * P.walk;
  const c = P.crouch, dang = P.lift * 4;
  const leg = (hx, hy, kx, fx, lift) => [up(P, [hx, hy]), [kx, lerp(-6, -2, c) + dang * 0.5], [fx, -lift + dang]];
  return {
    hindFar: leg(-10, -12, -6 - s, -9 - s, l2), foreFar: leg(11, -13, 14 + s, 15 + s, l1),
    hind: leg(-13, -11, -9 + s, -12 + s, l1), fore: leg(8, -12, 11 - s, 12 - s, l2),
  };
}
function tailPts(P) {
  const b = up(P, [-19, -11]);
  if (P.tail === 'curl') return [b, [-38, -1], [-47, -9 + (P.twitch || 0)]];
  if (P.tail === 'sweep') { const k = P.sweep; return [b, [lerp(-34, -26, k), lerp(-4, -34, k)], [lerp(-50, -20, k), lerp(-3, -44, k)]]; }
  const sw = Math.sin(P.t * 1.6) * 4;
  return [b, [-34, -3 + sw * 0.5], [-50, -6 + sw]];
}
// baş dönüşümü: yerel baş koordinatı -> dünya
function headXf(P) { const H = up(P, P.head), a = P.hang, c = Math.cos(a), s = Math.sin(a); return (hx, hy) => [wx(H[0]) + V.F * V.SC * (hx * c - hy * s), wy(H[1]) + V.SC * (hx * s + hy * c)]; }

// ---------- ana katman ----------
function drawBody(ctx, P, a0) {
  setO(ctx, P); const X = ctx;
  X.globalAlpha = a0;
  const body = P.hit ? '#a8442a' : C.scale;
  // uzak kanat ve uzak bacaklar
  { const W = wing(P, -1); poly(C.wingFar, [W.sh, W.el, W.tip, ...W.edge, W.low]); limb(C.bone, 1.6, [W.sh, W.el, W.tip]); for (const q of W.edge) limb(C.bone, 0.8, [W.el, q]); }
  const L = legs(P);
  limb(C.dark, 4.5, L.hindFar); limb(C.dark, 4, L.foreFar);
  // kuyruk
  const [ta, tb, tc] = tailPts(P);
  chain(C.back, ta, tb, tc, 4.6, 1.2); chain(body, ta, tb, tc, 4, 0.8);
  for (let i = 1; i < 10; i += 2) { const [x, y] = bez(ta, tb, tc, i / 10); poly(C.back, [[x - 1.5, y - 3.2 + i * 0.2], [x, y - 6 + i * 0.3], [x + 1.5, y - 3.2 + i * 0.2]]); }
  { const [x, y] = tc; poly(C.dark, [[x, y - 3], [x - 5, y], [x, y + 3], [x + 2, y]]); }
  // gövde
  const T = [[-20, -12], [-16, -19], [-6, -23], [6, -25], [12, -22], [16, -15], [12, -8], [0, -6], [-12, -6]].map(p => up(P, p));
  poly(C.back, T.map(([x, y]) => [x + (x > 0 ? 0.6 : -0.6), y + (y < -15 ? -0.6 : 0.6)]));
  poly(body, T);
  poly(C.hi, [up(P, [-14, -19]), up(P, [-6, -22]), up(P, [6, -24]), up(P, [4, -22]), up(P, [-6, -20])]);
  // karın plakaları
  for (let i = 0; i < 6; i++) { const x = -12 + i * 4.5; poly(i % 2 ? C.belly : C.bellyD, [up(P, [x, -6.5]), up(P, [x + 4.5, -6.8 - i * 0.3]), up(P, [x + 4.5, -9.5 - i * 0.5]), up(P, [x, -9 - i * 0.4])]); }
  // sırt dikenleri
  for (let i = 0; i < 6; i++) { const x = -16 + i * 5, y = -19 - Math.sin((i + 1) / 7 * Math.PI) * 5; poly(C.back, [up(P, [x - 1.6, y + 0.5]), up(P, [x - 0.5, y - 4]), up(P, [x + 1.6, y + 0.5])]); }
  // yakın bacaklar ve pençeler
  limb(C.back, 5, L.hind); limb(body, 4, L.hind); limb(C.back, 4.5, L.fore); limb(body, 3.6, L.fore);
  for (const Lg of [L.hind, L.fore]) { const f = Lg[2]; for (let k = 0; k < 3; k++) circ(C.claw, f[0] + 1 + k * 1.4, f[1] + 0.3, 0.55); }
  // boyun
  const nb = up(P, [11, -19]), H = up(P, P.head), nc = [lerp(nb[0], H[0], 0.5) + 6, lerp(nb[1], H[1], 0.5) + 4];
  chain(C.back, nb, nc, H, 6.2, 4.2, 12); chain(body, nb, nc, H, 5.4, 3.6, 12);
  for (let i = 1; i < 6; i++) { const [x, y] = bez(nb, nc, H, i / 6); poly(C.belly, [[x + 1, y + 2], [x + 3.4, y + 1], [x + 2.4, y + 4], [x, y + 4.4]]); poly(C.back, [[x - 2, y - 4], [x - 3.4, y - 8], [x, y - 4.6]]); }
  // yakın kanat
  { const W = wing(P, 1); poly(C.wing, [W.sh, W.el, W.tip, ...W.edge, W.low]); limb(C.bone, 2, [W.sh, W.el, W.tip]); for (const q of W.edge) limb(C.bone, 1, [W.el, q]); circ(C.claw, W.el[0], W.el[1] - 1, 0.8); }
  // baş (yerel baş çerçevesinde)
  X.save(); X.translate(wx(H[0]), wy(H[1])); X.scale(V.F * SC, SC); X.rotate(P.hang);
  const o = P.jaw * 6, F = (col, pts) => { X.fillStyle = col; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); X.fill(); };
  F(C.hornD, [[-2, -5], [-10, -11], [-15, -9], [-6, -3]]); F(C.horn, [[0, -5], [-8, -12], [-13, -11], [-3, -3]]);
  F(C.back, [[-1, 2], [14, 1.5 + o], [13, 4 + o], [0, 5]]); F(body, [[0, 2], [13, 2 + o], [12, 3.5 + o], [1, 4.2]]);
  if (o > 0.8) { F('#3a0806', [[2, 0.8], [15, 0.5], [13, 2 + o], [2, 2.5]]); X.fillStyle = C.claw; for (let k = 4; k < 14; k += 2.5) { X.fillRect(k, 0.6, 0.8, 1.2); X.fillRect(k + 1, 1.8 + o - 1, 0.8, 1); } }
  F(C.back, [[-5, -5], [4, -6.6], [12, -4.6], [17, -1.4], [17, 1.2], [8, 2], [-5, 3]]);
  F(body, [[-4, -4.4], [4, -5.8], [11.6, -4], [16, -1], [16, 0.6], [8, 1.2], [-4, 2.4]]);
  F(C.hi, [[-2, -4.2], [8, -5], [12, -3.4], [4, -3.6]]);
  F(C.back, [[4, -6], [3, -9], [7, -5.6]]); F(C.back, [[9, -4.6], [9, -7], [12, -4]]);
  // göz: kapalıyken çizgi
  X.fillStyle = C.back; X.fillRect(5, -3.6, 3.4, 0.9);
  X.restore();
  X.globalAlpha = 1;
  return headXf(P);
}
function smoke(ctx, P, hx) {
  // burundan duman: uykuda nefesle, öfkede kor karışık
  const X = ctx, [nx, ny] = hx(16.5, -0.5), t = P.t;
  for (let i = 0; i < 4; i++) {
    const k = ((t / 3.2) + i * 0.25) % 1; if (P.breath < -0.2 && k < 0.2) continue;
    X.globalAlpha = 0.35 * (1 - k) * (P.dying ? 1 - P.dying : 1);
    X.fillStyle = '#6a6060'; X.beginPath(); X.arc(nx + V.F * k * 10 + Math.sin(t + i) * 2, ny - k * 22, 1.5 + k * 5, 0, Math.PI * 2); X.fill();
  }
  X.globalAlpha = 1;
}

export function drawDragon(ctx, e, alpha) {
  const P = pose({ e }, alpha), a0 = P.dying > 0.8 ? 1 - (P.dying - 0.8) / 0.2 : 1;
  if (drawBossArt(ctx, e, alpha)) { artSmoke(ctx, e, alpha, P); return; }
  const hx = drawBody(ctx, P, a0); smoke(ctx, P, hx);
}
// ---------- PixelLab sprite: ağız, göz ve göğüs karedeki noktalardan ----------
const ART = BOSS_ART.ejder;
function artMouth(e, alpha) {
  if (ART.articulated) {
    const m = artAttachment(e, alpha, 'mouth'), eye = artAttachment(e, alpha, 'eyes');
    if (m && eye) return { m, eye };
    const row = artPoseRow(e, alpha), [mx, my] = ART.mouth[row], [ex, ey] = ART.eyes[row];
    return { m: artPoint(e, alpha, mx, my), eye: artPoint(e, alpha, ex, ey) };
  }
  const B = e.bs, A = B && B.act, fr = A && A.k === 'breath' ? (A.stage === 'glow' ? Math.min(4, Math.floor((e.wind || 0) * 5)) : A.stage === 'fire' ? 5 + Math.floor(G.time * 9) % 3 : 4) : 0;
  const [mx, my] = ART.mouth[fr], [ex, ey] = ART.eye, [m0x, m0y] = ART.mouth[0];
  return { m: artPoint(e, alpha, mx, my), eye: artPoint(e, alpha, ex + (mx - m0x) * 0.8, ey + (my - m0y) * 0.8) };
}
function artSmoke(ctx, e, alpha, P) {
  if (P.fire !== null) return;
  const mouth = artMouth(e, alpha).m, [nx, ny, Q] = mouth;
  if (mouth[3] !== false) smokePlume(ctx, nx - Q.F * 3, ny - 2, Q.F, P.t, 1 - P.dying);
}
function smokePlume(ctx, x, y, F, t, opacity = 1) {
  for (let i = 0; i < 6; i++) {
    const age = (t / 3.2 + i * 0.13) % 1; if (age > 0.72) continue;
    const k = age / 0.72, size = 1 + k * 4;
    const xx = x + F * k * 12 + Math.sin(t * 1.3 + i) * k * 2, yy = y - k * 23;
    ctx.globalAlpha = (1 - k) * 0.22 * opacity; ctx.fillStyle = '#a99a90';
    for (let row = -2; row <= 2; row++) {
      const w = Math.max(1, Math.round(size * (1 - Math.abs(row) * 0.24)));
      ctx.fillRect(Math.round(xx - w / 2 + Math.sin(row + t * 2) * k), Math.round(yy + row), w, 1);
    }
  }
  ctx.globalAlpha = 1;
}
function artGlow(ctx, e, alpha, P, glow) {
  const X = ctx, t = P.t, { m, eye } = artMouth(e, alpha), [mx, my, Q] = m, F = Q.F;
  // göz: ölümde söner
  if (P.eye > 0.02 && Q.dying < 1 && eye[3] !== false) {
    const a = P.eye * (1 - Q.dying);
    glow(eye[0], eye[1], 'rgba(255,220,90,0.7)', 7, a);
    X.globalAlpha = a; X.fillStyle = C.eye; X.fillRect(Math.round(eye[0]) - 1, Math.round(eye[1]), 3, 1); X.globalAlpha = 1;
  }
  // göğüs: pulların arasından içerideki ateş, boğazdan ağıza yükselir
  if (P.chest > 0.02) {
    const chest = ART.chests ? ART.chests[artPoseRow(e, alpha)] : ART.chest;
    const [cx, cy] = artAttachment(e, alpha, 'chests') || artPoint(e, alpha, chest[0], chest[1]), a = P.chest;
    glow(cx, cy, 'rgba(255,150,50,0.8)', Math.round(12 + a * 18), a);
    X.globalAlpha = a; X.strokeStyle = a > 0.7 ? '#fff0b0' : '#ffb040'; X.lineWidth = 1;
    for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(cx - F * (6 - i * 3), cy + 8 - i); X.quadraticCurveTo(cx - F * (2 - i * 3), cy - i * 2, cx - F * (4 - i * 3.5), cy - 8 - i); X.stroke(); }
    X.globalAlpha = 1;
    for (let i = 1; i < 5; i++) { const k = i / 5; glow(cx + (mx - cx) * k, cy + (my - cy) * k, 'rgba(255,140,40,0.45)', 7, a * (1 - k * 0.5) * (0.6 + 0.4 * Math.sin(t * 12 - i))); }
  }
  if (P.jaw > 0.3 && (P.chest > 0.2 || P.fire !== null)) glow(mx, my, 'rgba(255,170,60,0.8)', 12, P.jaw);
  if (P.fire !== null) fireStream(X, mx + F * 2, my + 1, P.fire, F, t, glow);
  if (P.rage && !P.dying) for (let i = 0; i < 3; i++) { const k = (t * 1.3 + i / 3) % 1; X.globalAlpha = 1 - k; X.fillStyle = i % 2 ? '#ffb040' : '#ff5a1a'; X.fillRect(Math.round(mx - F * 3 + F * k * 8), Math.round(my - 2 - k * 14 + Math.sin(t * 5 + i) * 2), 1, 1); }
  X.globalAlpha = 1;
}
// ejderin üstüne yığılmış paralar: sırt dikenleri, kanat ucu, baş ve kuyruk ucu dışarıda kalır; nefesle kabarır
function dune(ctx, P) {
  const b = P.buried, br = P.breath * 0.7;
  const top = x => {
    let y = x < -24 ? lerp(0, -8, (x + 31) / 7) : x < 12 ? -12 + Math.sin(x * 0.45) * 1.2 + br : x < 21 ? lerp(-12 + br, -6, (x - 12) / 9) : lerp(-6, 1, (x - 21) / 4);
    return Math.min(1, y) * b;
  };
  const pts = [[-31, 2]]; for (let x = -31; x <= 25; x += 2) pts.push([x, top(x)]); pts.push([25, 2]);
  ctx.save(); ctx.fillStyle = coinPattern(ctx); path(pts, true); ctx.fill(); ctx.restore();
  // üst kenar: ışığı yakalayan paralar, nefeste kayan birkaç para
  for (let x = -29; x <= 23; x += 2) { const y = top(x); dot(hash2(x, 3, 1) < 0.5 ? '#ffd24a' : '#fff0a0', x, y - 0.4, 1.4, 0.7); if (hash2(x, 7, 2) < 0.3) dot('#8a5a10', x + 0.6, y + 0.4, 1.4, 0.6); }
  if (b > 0.5) for (let i = 0; i < 9; i++) { const x = -15 + i * 3.2, y = cy(P, -18 - Math.sin((i + 1) / 10 * Math.PI) * 3) + 1 + hash2(i, 4, 2) * 2; dot(i % 3 ? '#ffd24a' : '#fff0a0', x, y, 1.4, 0.8); }
  if (P.breath > 0.6) for (let i = 0; i < 3; i++) { const x = -18 + i * 13 + Math.sin(P.t * 3 + i) * 2, k = (P.breath - 0.6) / 0.4; dot('#ffe79a', x + k * 3 * (i % 2 ? 1 : -1), top(x) - 1 + k * 3, 1, 1); }
}
// uyku: yere uzanmış kare; uyanış: uzanma animasyonu tersine oynar, ejder ayağa kalkar
function hoardFrame(P) {
  if (!ART) return null;
  if (ART.articulated) {
    const H = G.hoard, k = H.st === 'wake' ? clamp(H.t / HOARD.intro, 0, 1) : 0;
    const row = k < 0.3 ? 4 : k < 0.83 ? 3 : 0;
    const animate = r => bossMotion('ejder', P.t, r === 4 ? { k: 'sleep' } : { k: 'wake', done: k > 0.65, T: (1 - k) * 1.3 }, Math.sin(k * Math.PI), 0, 0, 0, P.stir);
    const motion = animate(row);
    const x = Math.round(P.x), feet = Math.round(P.y + 8), F = P.F;
    const threshold = row === 3 ? 0.3 : row === 0 ? 0.83 : -1;
    const q = threshold < 0 ? 1 : clamp((k - threshold) / 0.055, 0, 1), blend = q * q * (3 - 2 * q);
    const previous = blend < 1 ? { row: row === 3 ? 4 : 3, motion: animate(row === 3 ? 4 : 3) } : null;
    return { row, fr: 0, x, feet, F, motion, previous, blend, pt: (px, py) => { const [a, b] = motionPoint('ejder', px, py, motion, ART, row); return [x + (a - ART.cx) * F, feet + b - ART.feet]; } };
  }
  const fr = Math.max(0, Math.min(7, Math.round(P.crouch * 7))), x = Math.round(P.x), feet = Math.round(P.y + 8);
  const F = P.F * ART.face;
  return { fr, x, feet, F, pt: (px, py) => [x + (px - ART.cx) * F, feet + (py - ART.feet)] };
}
const sleepingActors = new WeakMap();
function sleepingActor(H) {
  let e = sleepingActors.get(H);
  if (!e) { e = { type: 'ejder', d: { col: '#ff8a2a' }, face: -1, bs: {} }; sleepingActors.set(H, e); }
  e.x = e.px = H.c * TILE + 8; e.y = e.py = H.r * TILE + 8;
  const wake = H.st === 'wake' ? clamp(H.t / HOARD.intro, 0, 1) : 0;
  return { e, options: { t: G.time, yaw: Math.PI - 0.16, sleep: 1 - (k => k * k * (3 - 2 * k))(clamp((wake - 0.18) / 0.43, 0, 1)), wake, act: { k: H.st === 'wake' ? 'wake' : 'sleep' } } };
}
export function drawHoardDragon(ctx) {
  const H = G.hoard; if (!H || (H.st !== 'sleep' && H.st !== 'wake')) return;
  const P = pose({ hoard: H, F: -1 }, 1);
  const actor = sleepingActor(H);
  if (drawBoss3D(ctx, actor.e, 1, 1, false, actor.options)) {
    if (P.buried > 0) { origin(ctx, P.x, P.y + 7, P.F, 2.05); dune(ctx, P); }
    const mouth = boss3DPoint(actor.e, 1, 'mouth', actor.options);
    if (mouth) smokePlume(ctx, mouth[0], mouth[1], P.F, P.t, 0.5 + Math.max(0, P.breath) * 0.3);
    // Coins slide from the rising shoulders along accelerating arcs.
    if (H.st === 'wake') for (let i = 0; i < 18; i++) {
      const age = H.t - 0.65 - i * 0.035; if (age < 0 || age > 1.25) continue;
      const side = i % 2 ? 1 : -1, x = P.x + side * (6 + i * 1.4 + age * 18), y = P.y - 18 - Math.sin(i * 2.7) * 7 - age * 15 + age * age * 44;
      ctx.fillStyle = i % 3 ? '#efbb4d' : '#fff1ae'; ctx.fillRect(Math.round(x), Math.round(y), 2, Math.max(1, Math.abs(Math.sin(age * 12 + i)) * 2));
    }
    return;
  }
  const L = hoardFrame(P);
  if (L?.previous) drawArtFrame(ctx, 'ejder', L.previous.row, 0, L.x, L.feet, P.F, 1 - L.blend, 1, false, L.previous.motion);
  if (L && drawArtFrame(ctx, 'ejder', L.row ?? 4, L.fr, L.x, L.feet, P.F, L.blend ?? 1, 1, false, L.motion)) {
    if (P.buried > 0) { origin(ctx, L.x, L.feet - 1, P.F, 1.9); dune(ctx, P); }
    const mouth = ART.articulated ? ART.mouth[L.row] : L.fr >= 6 ? [122, 98] : [119, 58];
    const [nx, ny] = L.pt(...mouth), t = P.t;
    smokePlume(ctx, nx, ny, L.F, t, 0.6 + Math.max(0, P.breath) * 0.4);
    return;
  }
  const hx = drawBody(ctx, P, 1);
  if (P.buried > 0) dune(ctx, P);
  smoke(ctx, P, hx);
}

// ---------- ışık katmanı ----------
function glowPass(ctx, P, hx, glow) {
  const X = ctx, t = P.t;
  setO(ctx, P);
  // göz
  if (P.eye > 0.02) {
    const [ex, ey] = hx(6.6, -3.2);
    glow(ex, ey, 'rgba(255,220,90,0.7)', Math.round(4 + P.eye * 6), P.eye);
    X.globalAlpha = P.eye; X.fillStyle = C.eye; X.fillRect(Math.round(ex) - 2, Math.round(ey), 4, Math.max(1, Math.round(P.eye * 2))); X.fillStyle = '#2a0806'; X.fillRect(Math.round(ex), Math.round(ey), 1, Math.max(1, Math.round(P.eye * 2))); X.globalAlpha = 1;
  }
  // göğüs: pulların arasından içerideki ateş görünür
  if (P.chest > 0.02) {
    const c = [wx(13), wy(cy(P, -15))], a = P.chest;
    glow(c[0], c[1], 'rgba(255,150,50,0.8)', Math.round(10 + a * 16), a);
    X.globalAlpha = a; X.strokeStyle = a > 0.7 ? '#fff0b0' : '#ffb040'; X.lineWidth = 1;
    for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(wx(8 + i * 2), wy(cy(P, -8 - i))); X.quadraticCurveTo(wx(12 + i * 2), wy(cy(P, -14 - i * 1.5)), wx(10 + i * 2.5), wy(cy(P, -20 - i))); X.stroke(); }
    X.globalAlpha = 1;
    // boğaz boyunca yükselen ışık
    const nb = up(P, [11, -19]), H = up(P, P.head);
    for (let i = 1; i < 5; i++) { const k = i / 5; glow(wx(lerp(nb[0], H[0], k)), wy(lerp(nb[1], H[1], k)), 'rgba(255,140,40,0.45)', 6, a * (1 - k * 0.5) * (0.6 + 0.4 * Math.sin(t * 12 - i))); }
  }
  // ağız: kükreme/nefes ışığı
  if (P.jaw > 0.3 && (P.chest > 0.2 || P.fire !== null)) { const [mx, my] = hx(14, 2); glow(mx, my, 'rgba(255,170,60,0.8)', 10, P.jaw); }
  // alev nefesi: ağızdan genişleyen, dalgalanan akış
  if (P.fire !== null) { const [mx, my] = hx(16, 1.5); fireStream(X, mx, my, P.fire, V.F, t, glow); }
  // öfke: burun deliklerinden kor
  if (P.rage && !P.dying) { const [nx, ny] = hx(16.5, -0.5); for (let i = 0; i < 3; i++) { const k = (t * 1.3 + i / 3) % 1; X.globalAlpha = 1 - k; X.fillStyle = i % 2 ? '#ffb040' : '#ff5a1a'; X.fillRect(Math.round(nx + V.F * k * 8), Math.round(ny - k * 14 + Math.sin(t * 5 + i) * 2), 1, 1); } X.globalAlpha = 1; }
}
// alev nefesi: ağızdan genişleyen, dalgalanan akış; kayaya çarpınca yayılır
function fireStream(X, mx, my, la, F, t, glow) {
  const ca = Math.cos(la) * F, sa = Math.sin(la), nx = -sa, ny = ca;
  let length = 115, blocked = false;
  for (let d = 3; d <= length; d += 3) {
    const x = mx + ca * d, y = my + sa * d, c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    const tile = c >= 0 && c < COLS && r >= 0 ? TD[G.map[r * COLS + c]] : null;
    if (!tile || tile.solid) { length = Math.max(3, d - 3); blocked = true; break; }
  }
  const sample = (d, side, layer) => {
    const f = d / 115, turbulence = Math.sin(d * 0.17 - t * 18 + layer * 1.2) * (1 + f * 3);
    const spread = (2 + d * 0.2) * [1, 0.72, 0.4, 0.17][layer];
    const ragged = 0.76 + Math.sin(d * 0.39 - t * 23 + side * 2.7) * 0.18;
    const width = spread * ragged * (d > length - 12 && !blocked ? (length - d + 3) / 15 : 1);
    return [mx + ca * d + nx * (turbulence + side * width), my + sa * d + ny * (turbulence + side * width)];
  };
  // A dark, rolling mantle surrounds the orange flame and the narrow white-hot jet.
  for (let layer = 0; layer < 4; layer++) {
    const reach = length * [1, 0.96, 0.81, 0.52][layer];
    X.globalAlpha = [0.55, 0.82, 0.9, 0.94][layer]; X.fillStyle = ['#b52f15', '#fa641b', '#ffc54b', '#fff3be'][layer];
    X.beginPath(); X.moveTo(mx, my);
    for (let d = 3; d <= reach; d += 3) { const [x, y] = sample(d, -1, layer); X.lineTo(Math.round(x), Math.round(y)); }
    for (let d = reach; d >= 3; d -= 3) { const [x, y] = sample(d, 1, layer); X.lineTo(Math.round(x), Math.round(y)); }
    X.closePath(); X.fill();
  }
  for (let i = 0; i < 24; i++) {
    const age = (t * 1.8 + hash2(i, 7, 4)) % 1, d = age * length;
    const spread = (hash2(i, 8, 2) - 0.5) * (3 + d * 0.36);
    const x = mx + ca * d + nx * spread, y = my + sa * d + ny * spread;
    X.globalAlpha = (1 - age) * 0.9; X.fillStyle = i % 3 ? '#ffd671' : '#fff5c6';
    X.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, 1);
  }
  X.globalAlpha = 1;
  for (let d = 8; d < length; d += 24) glow(mx + ca * d, my + sa * d, 'rgba(255,143,35,0.4)', Math.round(12 + d * 0.12), 0.8);
  if (blocked) {
    const x = mx + ca * length, y = my + sa * length;
    glow(x, y, 'rgba(255,175,60,0.65)', 23, 1);
    for (let i = 0; i < 7; i++) {
      const a = (t * 2.2 + i / 7) % 1, side = i % 2 ? 1 : -1;
      X.globalAlpha = 1 - a; X.fillStyle = i % 3 ? '#ffaf3f' : '#ffe6a0';
      X.fillRect(Math.round(x + nx * side * a * 15 - ca * a * 5), Math.round(y + ny * side * a * 15 - sa * a * 5), 1, 2);
    }
    X.globalAlpha = 1;
  }
}
export function drawDragonGlow(ctx, e, alpha, glow) {
  const P = pose({ e }, alpha);
  if (drawBossArtGlow(ctx, e, alpha, glow, 0.8)) { artGlow(ctx, e, alpha, P, glow); return; }
  setO(ctx, P); glowPass(ctx, P, headXf(P), glow);
}
// hazine: altın parıltıları ve uyuyan ejder
export function drawHoardGlow(ctx, glow) {
  const H = G.hoard; if (!H) return;
  const t = G.time;
  if (Math.abs(G.player.y - H.r * TILE) < 260) for (let r = H.r0; r <= H.r1; r++) for (let c = H.c0; c <= H.c1; c++) {
    if (G.map[r * 17 + c] !== T.GOLD) continue;
    const h = hash2(c, r, 5), k = (t * 0.5 + h * 7) % 3;
    if (k < 0.25) { const x = c * TILE + 3 + Math.floor(h * 10), y = r * TILE + 2 + Math.floor(hash2(r, c, 9) * 8), s = Math.sin(k / 0.25 * Math.PI); ctx.globalAlpha = s; ctx.fillStyle = '#fff8d0'; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.globalAlpha = 1; glow(x, y, 'rgba(255,220,120,0.4)', 5, s); }
  }
  if (H.st !== 'sleep' && H.st !== 'wake') return;
  const P = pose({ hoard: H, F: -1 }, 1);
  const actor = sleepingActor(H);
  if (drawBoss3D(ctx, actor.e, 1, P.eye * 0.7, true, actor.options)) {
    const eye = boss3DPoint(actor.e, 1, 'eyes', actor.options), mouth = boss3DPoint(actor.e, 1, 'mouth', actor.options);
    if (eye && P.eye > 0.02) glow(eye[0], eye[1], 'rgba(255,220,90,0.7)', 7, P.eye);
    if (mouth && P.jaw > 0.3) glow(mouth[0], mouth[1], 'rgba(255,170,60,0.8)', 12, P.jaw);
    return;
  }
  const L = hoardFrame(P);
  if (L) {
    // uykuda aralanan göz, uyanışta açılıp parlayan göz ve kükreyen ağız
    if (P.eye > 0.02) {
      const eye = ART.articulated ? ART.eyes[L.row] : L.fr >= 6 ? [116, 93] : [110, 60];
      const [ex, ey] = L.pt(...eye);
      glow(ex, ey, 'rgba(255,220,90,0.7)', Math.round(4 + P.eye * 6), P.eye);
      ctx.globalAlpha = P.eye; ctx.fillStyle = C.eye; ctx.fillRect(Math.round(ex) - 1, Math.round(ey), 3, Math.max(1, Math.round(P.eye * 2))); ctx.globalAlpha = 1;
    }
    if (P.jaw > 0.3) { const mouth = ART.articulated ? ART.mouth[L.row] : L.fr >= 6 ? [121, 100] : [118, 62]; const [mx, my] = L.pt(...mouth); glow(mx, my, 'rgba(255,170,60,0.8)', 12, P.jaw); }
    return;
  }
  setO(ctx, P); glowPass(ctx, P, headXf(P), glow);
}
export function dragonLights(out) {
  for (const e of G.enemies) if (e.type === 'ejder' && !e.dead && e.bs && e.bs.act && e.bs.act.k === 'breath') out.push({ x: e.x + e.face * 30, y: e.y - 20, s: e.bs.act.fire ? 3.6 : 1.8 });
}
