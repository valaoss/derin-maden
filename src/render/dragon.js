// Hazine Ejderi çizimi: kızıl-bronz pullu, altın karınlı, fildişi boynuzlu dört ayaklı ejder.
// Uykuda: altın yığınında kıvrılmış, burnundan duman; uyku ölçeri yükseldikçe kuyruğu seğirir, bir gözü aralanır.
// Uyanış: göz açılır, baş kalkar, altın üstünden kayar, kanatlar açılır ve kükrer. Nefesten önce göğsü içeriden parlar.
import { TILE } from '../config.js';
import { HOARD } from '../data/balance.js';
import { T, TD } from '../data/tiles.js';
import { G } from '../game/state.js';
import { clamp, lerp, hash2 } from '../core/util.js';
import { V, origin, wx, wy, poly, limb, circ, chain, bez, path, dot } from './beast.js';
import { coinPattern } from './hoard.js';

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
      P.eye = clamp(k / 0.06, 0, 1); P.buried = clamp(1 - (k - 0.08) / 0.1, 0, 1);
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
  const hx = drawBody(ctx, P, a0); smoke(ctx, P, hx);
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
export function drawHoardDragon(ctx) {
  const H = G.hoard; if (!H || (H.st !== 'sleep' && H.st !== 'wake')) return;
  const P = pose({ hoard: H, F: -1 }, 1);
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
  if (P.fire !== null) {
    const [mx, my] = hx(16, 1.5), la = P.fire, ca = Math.cos(la) * V.F, sa = Math.sin(la);
    for (let d = 4; d < 118; d += 5) {
      const w = Math.sin(t * 22 + d * 0.3) * d * 0.06, x = mx + ca * d - sa * w, y = my + sa * d + ca * w, r = 2 + d * 0.13;
      // kayaya çarpınca yayılır ve durur
      if (TD[G.map[Math.floor(y / TILE) * 17 + Math.floor(x / TILE)]].solid) { glow(x - ca * 4, y - sa * 4, 'rgba(255,160,60,0.7)', Math.round(r * 2.6), 1); for (let q = 0; q < 5; q++) { X.fillStyle = q % 2 ? '#ffd060' : '#ff6a1a'; X.fillRect(Math.round(x - ca * 3 + Math.sin(t * 17 + q * 2) * r), Math.round(y - sa * 3 + Math.cos(t * 13 + q * 3) * r), 1, 1); } break; }
      const k = d / 118;
      glow(x, y, k < 0.3 ? 'rgba(255,240,180,0.7)' : k < 0.65 ? 'rgba(255,170,60,0.6)' : 'rgba(230,70,30,0.5)', Math.round(r * 1.8), 1 - k * 0.5);
      X.globalAlpha = 1 - k * 0.7; X.fillStyle = k < 0.25 ? '#fff4c0' : k < 0.6 ? '#ffb040' : '#ff5a1a';
      X.beginPath(); X.arc(x, y, r * (0.6 + 0.3 * Math.sin(t * 30 + d)), 0, Math.PI * 2); X.fill();
    }
    X.globalAlpha = 1;
  }
  // öfke: burun deliklerinden kor
  if (P.rage && !P.dying) { const [nx, ny] = hx(16.5, -0.5); for (let i = 0; i < 3; i++) { const k = (t * 1.3 + i / 3) % 1; X.globalAlpha = 1 - k; X.fillStyle = i % 2 ? '#ffb040' : '#ff5a1a'; X.fillRect(Math.round(nx + V.F * k * 8), Math.round(ny - k * 14 + Math.sin(t * 5 + i) * 2), 1, 1); } X.globalAlpha = 1; }
}
export function drawDragonGlow(ctx, e, alpha, glow) {
  const P = pose({ e }, alpha); setO(ctx, P); glowPass(ctx, P, headXf(P), glow);
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
  const P = pose({ hoard: H, F: -1 }, 1); setO(ctx, P); glowPass(ctx, P, headXf(P), glow);
}
export function dragonLights(out) {
  for (const e of G.enemies) if (e.type === 'ejder' && !e.dead && e.bs && e.bs.act && e.bs.act.k === 'breath') out.push({ x: e.x + e.face * 30, y: e.y - 20, s: e.bs.act.fire ? 3.6 : 1.8 });
}
