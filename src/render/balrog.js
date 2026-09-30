// Balrog: gölgeden bir gövde, üstünde alev. Gövde, kanatlar ve boynuzlar ana katmanda (ışıkla kararır);
// alev yelesi, gözler, kor damarları, alev kılıcı ve kamçı ışık yayan katmanda parlar.
// Karşılaşma öncesi: karanlık sis toplanır, gölgede iki göz açılır; ölümde alevi söner, gölgeye gömülür.
import { TILE } from '../config.js';
import { BALROG } from '../data/balance.js';
import { G } from '../game/state.js';
import { hash2, clamp, lerp } from '../core/util.js';

let X, OX, OY, F;
const SC = 1.55; // dev boy: yerel iskelet bu oranla büyür
const wx = lx => OX + lx * F * SC;
const wy = ly => OY + ly * SC;
const C = { body: '#24120e', body2: '#361a12', back: '#120806', rim: '#9a4418', horn: '#3a2a22', hornHi: '#7a5a44', claw: '#6a5a4a', wing: 'rgba(22,9,8,0.9)', wingBone: '#4a2416', hit: '#6a3424' };
const FIRE = ['#b8281a', '#ff6a1a', '#ffb040', '#fff0b0'];

function path(pts, close) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(wx(a), wy(b)) : X.moveTo(wx(a), wy(b))); if (close) X.closePath(); }
function poly(col, pts) { X.fillStyle = col; path(pts, true); X.fill(); }
function limb(col, w, pts) { X.strokeStyle = col; X.lineWidth = w * SC; X.lineCap = 'round'; X.lineJoin = 'round'; path(pts); X.stroke(); X.lineWidth = 1; }
function dot(col, lx, ly, w = 1, h = 1) { w = Math.max(1, Math.round(w * SC)); h = Math.max(1, Math.round(h * SC)); X.fillStyle = col; X.fillRect(Math.round(F > 0 ? wx(lx) : wx(lx) - w + 1), Math.round(wy(ly)), w, h); }
const bez = (a, b, c, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];

// ---------- duruş: ana ve ışık katmanı aynı iskeleti paylaşır ----------
function pose(e, alpha) {
  const t = G.time, x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
  const B = e.bs, A = B && B.act, rage = !!(B && B.phase === 2);
  const intro = e.intro > 0 ? 1 - e.intro / BALROG.intro : 1;
  const dying = e.dead ? clamp(1 - e.dieT / (e.d.dieT || 1), 0, 1) : 0;
  const moving = !e.dead && Math.abs(e.x - e.px) + Math.abs(e.y - e.py) > 0.04;
  const ph = e.anim * 0.9, walk = moving ? 1 : 0;
  let sp = (rage ? 0.62 : 0.42) + Math.sin(t * 1.4) * 0.07, fire = rage ? 1.3 : 1, roar = 0, crouch = (e.wind || 0) * 3, lean = 0;
  // kılıç ve kamçı elleri (yerel: +x ileri, +y aşağı, köken ayaklar)
  let swA = 1.05, swH = [2, -18], whH = [9, -18], whip = { mode: 'idle' };
  if (A) {
    if (A.k === 'sword') {
      if (A.stage === 'raise') { const k = clamp(1 - A.st / 0.8, 0, 1), s = k * k * (3 - 2 * k); swA = lerp(1.05, -2.3, s); swH = [lerp(2, -3, s), lerp(-18, -52, s)]; lean = -2 * s; }
      else { const k = clamp(1 - A.st / 0.7, 0, 1); swA = k < 0.55 ? 1.45 : lerp(1.45, 1.05, (k - 0.55) / 0.45); swH = [lerp(16, 2, Math.max(0, k - 0.55) / 0.45), lerp(-13, -18, Math.max(0, k - 0.55) / 0.45)]; lean = 3 * (1 - k); crouch = 4 * (1 - k); }
    } else if (A.k === 'whip') {
      if (A.stage === 'wind') { const k = clamp(e.wind || 0, 0, 1); whH = [lerp(9, -4, k), lerp(-18, -46, k)]; whip = { mode: 'wind', k }; lean = -2 * k; }
      else if (A.stage === 'lash') { const k = clamp(1 - A.st / 0.36, 0, 1); whH = [lerp(-2, 15, Math.min(1, k * 2)), lerp(-44, -22, Math.min(1, k * 2))]; whip = { mode: 'lash', k, a: A.a, len: A.len || 90 }; lean = 3; }
    } else if (A.k === 'wings') {
      const tt = 2.2 - A.T;
      if (tt < 0.9) { const k = tt / 0.9; sp = lerp(0.42, 0.15, k); crouch = 4 * k; }
      else { const k = Math.min(1, (tt - 0.9) / 1.3); sp = 1.15 - 0.5 * k; roar = Math.max(0, 1 - k * 1.2); fire *= 1.3; lean = -2 * (1 - k); }
    }
  }
  if (intro < 1) {
    fire *= clamp((intro - 0.12) / 0.4, 0, 1);
    sp = intro < 0.45 ? 0.05 : intro < 0.7 ? lerp(0.05, 1.15, (intro - 0.45) / 0.25) : lerp(1.15, sp, (intro - 0.7) / 0.3);
    roar = intro > 0.45 ? Math.sin(clamp((intro - 0.45) / 0.55, 0, 1) * Math.PI) : 0;
    crouch = intro < 0.45 ? 6 * (1 - intro / 0.45) : 0;
  }
  let sink = 0, tilt = 0;
  if (dying) {
    fire *= dying < 0.12 ? 1.8 : Math.pow(1 - (dying - 0.12) / 0.88, 1.6);
    sp *= 1 - dying * 0.9; roar = dying < 0.35 ? Math.sin(dying / 0.35 * Math.PI) : 0;
    sink = dying > 0.3 ? Math.pow((dying - 0.3) / 0.7, 1.4) * 40 : 0; tilt = -dying * 5;
  }
  const hit = e.hitT > 0;
  return { t, x, y, fy: y + 7, F: e.face || 1, rage, intro, dying, walk, ph, sp, fire, roar, crouch, lean, swA, swH, whH, whip, sink, tilt, hit, fade: e.fade || 0 };
}
function setOrigin(P) { OX = Math.round(P.x) + P.lean * P.F; OY = Math.round(P.fy + P.sink); F = P.F; }

// iskelet noktaları (crouch/tilt uygulanmış)
function up(P, pt) { const [a, b] = pt; const k = clamp(-b / 50, 0, 1); return [a + P.tilt * k * 2, b + P.crouch * k + Math.sin(P.t * 2.2) * 0.8 * k]; }
const LEGS = P => {
  const s = Math.sin(P.ph) * 3 * P.walk, l1 = Math.max(0, Math.cos(P.ph)) * 2 * P.walk, l2 = Math.max(0, -Math.cos(P.ph)) * 2 * P.walk;
  return [
    [[-3, -16 + P.crouch * 0.3], [-1 - s, -9], [-5 - s, -3 - l2], [0 - s, -l2]],
    [[3, -16 + P.crouch * 0.3], [5 + s, -9], [1 + s, -3 - l1], [6 + s, -l1]],
  ];
};
const TORSO = [[-6, -15], [-9, -22], [-11, -30], [-8, -36], [-2, -38], [5, -40], [10, -36], [13, -30], [10, -22], [7, -15]];
const HEAD = [[5, -41], [9, -45], [14, -45], [18, -41], [19, -37], [15, -35], [9, -35]];
const SPINE = [[12, -46], [9, -47], [6, -45], [3, -42], [0, -39], [-3, -37], [-6, -35], [-9, -32], [-11, -28], [-11, -24]];
const CRACKS = [[[3, -33], [5, -29], [3, -25], [6, -20]], [[-3, -34], [-1, -29], [-4, -24], [-2, -19]], [[8, -31], [10, -27], [8, -23]], [[-7, -29], [-8, -25]], [[4, -12], [5, -8]], [[-2, -12], [-3, -7]]];

function wingPts(P, s) {
  // s: +1 ön kanat, -1 arka kanat; açıklık sp ile büyür, nefes gibi çırpar
  const sp = P.sp, flap = Math.sin(P.t * 1.6 + (s > 0 ? 0 : 0.6)) * 2, k = s > 0 ? 1 : 0.7;
  // yakın kanat geriye, uzak kanat başın ardından öne açılır: yandan bakışta da iki kanat görünür
  const d = s > 0 ? -1 : 1;
  const sh = up(P, [s > 0 ? -3 : 1, -35]);
  const el = [sh[0] + d * (6 + 12 * sp) * k, sh[1] - (10 + 12 * sp) * k + flap];
  const tip = [sh[0] + d * (10 + 34 * sp) * k, sh[1] - (6 + 20 * sp) * k + flap * 1.5];
  const low = up(P, s > 0 ? [-8, -20] : [5, -26]);
  const edge = [];
  for (let j = 1; j <= 4; j++) {
    const f = j / 5, bx = lerp(tip[0], low[0], f), by = lerp(tip[1], low[1], f);
    const sag = (7 + 6 * sp) * Math.sin(f * Math.PI) + Math.sin(P.t * 5 + j * 1.7 + s) * 1.2;
    const rag = (hash2(j, s > 0 ? 3 : 4, 17) - 0.5) * 4;
    edge.push([bx + d * 2 * f + rag * 0.4, by + sag + rag]);
  }
  return { sh, el, tip, low, edge };
}

// ---------- ana katman ----------
export function drawBalrog(ctx, e, alpha) {
  X = ctx; const P = pose(e, alpha); setOrigin(P);
  if (e.under) { smoke(P, 1.4); return; }
  const a0 = (P.intro < 1 ? 0.2 + 0.8 * clamp(P.intro / 0.5, 0, 1) : 1) * (1 - P.fade) * (P.dying > 0.85 ? 1 - (P.dying - 0.85) / 0.15 : 1);
  smoke(P, 1 + P.fade * 2 + P.dying * 2 + (P.intro < 1 ? 1 - P.intro : 0));
  X.save();
  if (P.sink > 0) { X.beginPath(); X.rect(OX - 140, OY - 170, 280, 170 - P.sink); X.clip(); }
  X.globalAlpha = a0;
  const body = P.hit ? C.hit : C.body;
  // kanatlar (gövdenin ardında)
  for (const s of [-1, 1]) {
    const W = wingPts(P, s);
    poly(C.wing, [W.sh, W.el, W.tip, ...W.edge, W.low]);
    limb(C.wingBone, 2, [W.sh, W.el, W.tip]);
    for (const q of W.edge.slice(0, 3)) limb(C.wingBone, 1, [W.el, q]);
  }
  // bacaklar
  const L = LEGS(P);
  limb(C.back, 5, L[0].slice(0, 2)); limb(C.back, 4, L[0].slice(1));
  // kamçı kolu arkada değil önde; kılıç kolu arkada
  const shB = up(P, [-5, -33]), swH = up(P, P.swH);
  limb(C.back, 4, [shB, [(shB[0] + swH[0]) / 2 - 3, (shB[1] + swH[1]) / 2 + 3], swH]);
  swordBody(P, swH);
  // gövde
  poly(body, TORSO.map(p => up(P, p)));
  limb(C.rim, 1, [up(P, [-11, -30]), up(P, [-8, -36]), up(P, [-2, -38]), up(P, [5, -40])]);
  poly(C.body2, [up(P, [2, -34]), up(P, [9, -32]), up(P, [10, -24]), up(P, [4, -20]), up(P, [0, -27])]);
  limb(body, 5, L[1].slice(0, 2)); limb(body, 4, L[1].slice(1));
  for (const Lg of L) { const f = Lg[3]; dot(C.claw, f[0] + 1, f[1] - 1, 2, 1); dot(C.claw, f[0] + 3, f[1], 1, 1); }
  // baş, çene, boynuzlar
  poly(body, HEAD.map(p => up(P, p)));
  const jaw = P.roar * 4;
  poly(body, [up(P, [9, -36]), up(P, [18, -37]), up(P, [17, -34 + jaw]), up(P, [11, -32 + jaw * 0.6])]);
  horn(P, [8, -45], -1); horn(P, [12, -46], 1);
  // kamçı kolu (önde)
  const shF = up(P, [6, -33]), whH = up(P, P.whH);
  limb(body, 4, [shF, [(shF[0] + whH[0]) / 2 + 2, (shF[1] + whH[1]) / 2 + 3], whH]);
  X.restore();
  // kamçı: dünya koordinatında (nişan açısı gerçek açı)
  whipLine(P, whH, false);
  X.globalAlpha = 1;
}

function horn(P, base, near) {
  const b = up(P, base), c1 = [b[0] - 13, b[1] - 3], tip = [b[0] - 4, b[1] - 16];
  const col = near > 0 ? C.horn : C.back;
  for (let i = 0; i <= 12; i++) {
    const k = i / 12, [hx, hy] = bez(b, c1, tip, k), r = lerp(near > 0 ? 2.6 : 2.2, 0.5, k) * SC;
    X.fillStyle = col; X.beginPath(); X.arc(wx(hx), wy(hy), r, 0, Math.PI * 2); X.fill();
  }
  if (near > 0) for (let i = 2; i <= 10; i += 2) { const [hx, hy] = bez(b, c1, tip, i / 12); dot(C.hornHi, hx, hy - 1); }
  // uç: öne kıvrılır
  const [ex, ey] = bez(b, c1, tip, 1); limb(col, 1, [[ex, ey], [ex + 3, ey - 2]]);
}

function smoke(P, amt) {
  // gövdeden yükselen gölge dumanı
  const n = Math.round(10 * amt);
  for (let i = 0; i < n; i++) {
    const k = (P.t * 0.35 + i * 0.137) % 1, h = hash2(i, 7, 91);
    const sx = OX + (Math.sin(i * 7.1 + P.t * 0.7) * (8 + k * 16) * (i % 2 ? 1 : -1) - F * k * 6) * SC, sy = OY - (12 + h * 20 + k * 40) * SC;
    X.globalAlpha = 0.32 * (1 - k) * Math.min(1, amt);
    X.fillStyle = '#060304'; X.beginPath(); X.arc(sx, sy, (3 + k * 7 + h * 3) * SC, 0, Math.PI * 2); X.fill();
  }
  X.globalAlpha = 1;
}

function swordDir(P) { return [Math.cos(P.swA), Math.sin(P.swA)]; }
function swordBody(P, h) {
  const [dx, dy] = swordDir(P);
  limb('#2a1a14', 3, [h, [h[0] + dx * 24, h[1] + dy * 24]]);
  limb('#3a2418', 2, [[h[0] - dy * 4, h[1] + dx * 4], [h[0] + dy * 4, h[1] - dx * 4]]);
}

// kamçı noktaları (dünya koordinatı)
function whipPoints(P, hand) {
  const hx = wx(hand[0]), hy = wy(hand[1]), N = 18, seg = 3.6 * SC, pts = [[hx, hy]], t = P.t, W = P.whip;
  if (W.mode === 'lash') {
    const ca = Math.cos(W.a), sa = Math.sin(W.a), reach = W.len * Math.min(1, W.k * 1.7);
    for (let i = 1; i <= N; i++) { const f = i / N, wave = Math.sin(i * 0.9 - W.k * 16) * (1 - W.k) * 6 * f; pts.push([hx + ca * reach * f - sa * wave, hy + sa * reach * f + ca * wave]); }
  } else if (W.mode === 'wind') {
    let a = -Math.PI / 2 - F * (0.5 + W.k * 1.1), x = hx, y = hy;
    for (let i = 1; i <= N; i++) { a += F * (0.1 + Math.sin(t * 6 + i * 0.4) * 0.03); x += Math.cos(a) * seg; y += Math.sin(a) * seg; pts.push([x, y]); }
  } else {
    // sarkar, yerde süzülür ve kıvrılır
    const floor = OY - 1 - P.sink, drop = Math.max(0, floor - hy);
    for (let i = 1; i <= N; i++) {
      const d = i * seg;
      if (d < drop) pts.push([hx + Math.sin(t * 1.8 + i * 0.5) * i * 0.2, hy + d]);
      else { const u = d - drop; pts.push([hx + F * u * 0.95 + Math.sin(t * 2.4 - i * 0.7) * 2, floor - Math.abs(Math.sin(t * 2.4 - i * 0.7)) * 1.5]); }
    }
  }
  return pts;
}
function whipLine(P, hand, glow) {
  if (P.sink > 20) return;
  const pts = whipPoints(P, hand);
  X.lineCap = 'round'; X.lineJoin = 'round';
  X.strokeStyle = glow ? '#ff6a1a' : '#1a0c08'; X.lineWidth = (glow ? 1.5 : 2) * SC;
  X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.stroke();
  X.lineWidth = 1;
  return pts;
}

// ---------- ışık katmanı ----------
function flame(x, y, h, w, lean, seed, lvl = 1) {
  h *= SC; w *= SC;
  if (h < 1) return;
  const t = G.time;
  for (let L = 0; L < 3; L++) {
    const hh = h * [1, 0.72, 0.42][L], ww = w * [1, 0.62, 0.3][L];
    X.fillStyle = FIRE[L + (L === 2 && lvl > 1.1 ? 1 : 0)];
    X.globalAlpha = [0.55, 0.8, 0.95][L];
    for (let yy = 0; yy < hh; yy++) {
      const f = yy / hh, cw = Math.max(1, Math.round(ww * Math.pow(1 - f, 0.8)));
      const sx = x + lean * f * hh * 0.6 + Math.sin(t * 11 + seed * 3 + yy * 0.6) * f * 1.6;
      X.fillRect(Math.round(sx - cw / 2), Math.round(y - yy), cw, 1);
    }
  }
  X.globalAlpha = 1;
}
const flick = (i, s = 0) => 0.65 + 0.35 * Math.sin(G.time * (7 + (i % 3) * 2.3) + i * 1.9 + s) * Math.sin(G.time * 3.1 + i);

export function drawBalrogGlow(ctx, e, alpha, glow) {
  X = ctx; const P = pose(e, alpha); setOrigin(P);
  if (e.under) return;
  const fade = 1 - P.fade, t = P.t, fire = P.fire * fade;
  const clipY = OY - P.sink;
  // gözler: en son söner
  const eye = up(P, [15, -41]), eye2 = up(P, [12, -41]);
  const eyeA = fade * (P.dying > 0.7 ? 1 - (P.dying - 0.7) / 0.3 : 1);
  if (eyeA > 0 && wy(eye[1]) < clipY) {
    glow(wx(eye[0]), wy(eye[1]), 'rgba(255,170,60,0.7)', 7, eyeA);
    X.globalAlpha = eyeA; dot('#fff4a0', eye[0] - 1, eye[1], 3, 1); dot('#ffb040', eye2[0], eye2[1], 2, 1); X.globalAlpha = 1;
  }
  if (P.roar > 0.05 && fade > 0) { const m = up(P, [14, -35]); glow(wx(m[0]), wy(m[1]), 'rgba(255,140,40,0.8)', Math.round(6 + P.roar * 10), P.roar); X.globalAlpha = P.roar; dot('#ffd060', 12, m[1], 5, Math.max(1, Math.round(P.roar * 3))); X.globalAlpha = 1; }
  if (fire <= 0.01) return;
  // kor damarları: nabız gibi
  const pulse = 0.55 + 0.45 * Math.sin(t * 3.2);
  X.globalAlpha = Math.min(1, fire) * pulse * (P.hit ? 1 : 0.85);
  for (const cr of CRACKS) limb(P.rage ? '#ffb040' : '#ff6a1a', 1, cr.map(p => up(P, p)));
  // gölgenin kenarı kendi alevinden aydınlanır: kanat, sırt ve boynuz konturları
  if (P.sink < 4) {
    X.globalAlpha = 0.42 * Math.min(1, fire);
    for (const s of [-1, 1]) { const W = wingPts(P, s); const g0 = X.globalAlpha; X.globalAlpha = g0 * 0.35; poly('#6a1a08', [W.sh, W.el, W.tip, ...W.edge, W.low]); X.globalAlpha = g0; limb('#ff5a1a', 0.7, [W.low, ...W.edge.slice().reverse(), W.tip, W.el, W.sh]); limb('#c83a14', 0.5, [W.el, W.edge[1]]); }
    limb('#ff7a2a', 0.7, TORSO.slice(0, 6).map(p => up(P, p)));
    limb('#ff7a2a', 0.7, HEAD.slice(0, 4).map(p => up(P, p)));
    X.globalAlpha = 0.55 * Math.min(1, fire);
    for (const [b0, n] of [[[8, -45], 0], [[12, -46], 1]]) { const b = up(P, b0), c1 = [b[0] - 13, b[1] - 3], tip = [b[0] - 4, b[1] - 16], pts = []; for (let i = 0; i <= 8; i++) { const q = bez(b, c1, tip, i / 8); pts.push([q[0], q[1] - (n ? 2.4 : 2) * (1 - i / 8)]); } limb(n ? '#ffa050' : '#b04a1a', 0.6, pts); }
  }
  X.globalAlpha = 1;
  // zemin kızıllığı
  glow(OX, OY - 2, 'rgba(255,90,30,0.4)', 26, Math.min(1, fire) * (0.7 + 0.2 * Math.sin(t * 5)));
  glow(OX, OY - 28, 'rgba(255,110,40,0.3)', 34, Math.min(1, fire) * 0.8);
  // alev yelesi: omurga boyunca, geriye ve yukarı savrulur
  const lean = -F * (0.5 + P.walk * 0.5);
  SPINE.forEach((p, i) => {
    const q = up(P, p);
    if (P.intro < 1 && -q[1] > 80 * clamp((P.intro - 0.1) / 0.5, 0, 1)) return;
    if (wy(q[1]) > clipY) return;
    const h = (i < 3 ? 11 : 9 - i * 0.4) * fire * flick(i);
    flame(wx(q[0]), wy(q[1]) + 1, h, i < 4 ? 6 : 5, lean, i, P.fire);
  });
  // omuzlarda ve ellerde alev
  const shF = up(P, [6, -33]), whH = up(P, P.whH), swH = up(P, P.swH);
  if (wy(shF[1]) < clipY) flame(wx(shF[0]), wy(shF[1]), 7 * fire * flick(11), 4, lean, 11, P.fire);
  if (wy(whH[1]) < clipY) flame(wx(whH[0]), wy(whH[1]), 4 * fire * flick(12), 3, lean, 12, P.fire);
  // öfke: kanat kenarları ve ayaklar yanar
  if (P.rage || P.dying) for (const s of [-1, 1]) {
    const W = wingPts(P, s);
    [W.tip, ...W.edge].forEach((q, j) => { if (wy(q[1]) < clipY) flame(wx(q[0]), wy(q[1]), 6 * fire * flick(20 + j, s), 3, lean, 20 + j, P.fire); });
  }
  if (P.rage) for (const Lg of LEGS(P)) { const f = Lg[3]; flame(wx(f[0] + 2), wy(f[1]), 5 * fire * flick(30), 4, 0, 30, P.fire); }
  // alev kılıcı
  if (wy(swH[1]) < clipY + 4) {
    const [dx, dy] = swordDir(P), bx = wx(swH[0]), by = wy(swH[1]), ex = bx + dx * 24 * F * SC, ey = by + dy * 24 * SC;
    X.lineCap = 'round';
    X.strokeStyle = '#ff6a1a'; X.lineWidth = 3 * SC; X.globalAlpha = Math.min(1, fire); X.beginPath(); X.moveTo(bx, by); X.lineTo(ex, ey); X.stroke();
    X.strokeStyle = '#fff0b0'; X.lineWidth = 1; X.beginPath(); X.moveTo(bx, by); X.lineTo(ex, ey); X.stroke();
    X.globalAlpha = 1;
    for (let k = 1; k <= 4; k++) flame(bx + (ex - bx) * k / 5, by + (ey - by) * k / 5, 5 * fire * flick(40 + k), 3, lean * 0.6, 40 + k, P.fire);
    glow((bx + ex) / 2, (by + ey) / 2, 'rgba(255,140,50,0.45)', 18, Math.min(1, fire));
  }
  // kamçı: kor gibi yanar, ucunda kıvılcım
  const pts = whipLine(P, whH, true);
  if (pts) {
    X.globalAlpha = 0.9;
    pts.forEach(([a, b], i) => { if (i % 2 === 0 && b < clipY) { X.fillStyle = FIRE[1 + (i + Math.floor(t * 12)) % 3]; X.fillRect(Math.round(a), Math.round(b - 1 - hash2(i, Math.floor(t * 14), 5) * 2), 1, 1); } });
    X.globalAlpha = 1;
    const tip = pts[pts.length - 1];
    if (P.whip.mode === 'lash') glow(tip[0], tip[1], 'rgba(255,200,90,0.8)', 10, 1);
    else glow(tip[0], tip[1], 'rgba(255,120,40,0.4)', 5, Math.min(1, fire));
  }
  // yükselen korlar
  for (let i = 0; i < 10; i++) {
    const k = (t * 0.6 + i * 0.173) % 1, h = hash2(i, 3, 77);
    X.globalAlpha = (1 - k) * Math.min(1, fire);
    X.fillStyle = FIRE[1 + (i % 3)];
    X.fillRect(Math.round(OX + (h - 0.5) * 40 + Math.sin(t * 2 + i) * 4), Math.round(OY - 10 - k * 70), 1, 1);
  }
  X.globalAlpha = 1;
}

// ---------- karşılaşma öncesi: sis ve gözler ----------
let last = null;
function center(alpha) {
  const S = G.balrog; if (!S) return null;
  if (S.st === 'dark') return { x: S.c * TILE + 8, y: S.r * TILE + 8 - 16, D: Math.min(1, S.t / 3), creep: true };
  const e = S.st === 'fight' ? G.enemies.find(o => o.type === 'balrog') : null;
  if (e) { last = { x: lerp(e.px, e.x, alpha), y: lerp(e.py, e.y, alpha) - 30 }; return { ...last, D: e.dead ? 0.55 * clamp(e.dieT / (e.d.dieT || 1), 0, 1) : 0.55, creep: false }; }
  if (S.st === 'done' && last && S.t < 3) return { ...last, D: 0.5 * (1 - S.t / 3), creep: false };
  return null;
}
let blob = null;
function blobSprite() {
  if (blob) return blob;
  blob = document.createElement('canvas'); blob.width = blob.height = 64;
  const b = blob.getContext('2d'), g = b.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(3,1,2,1)'); g.addColorStop(0.55, 'rgba(3,1,2,0.7)'); g.addColorStop(1, 'rgba(3,1,2,0)');
  b.fillStyle = g; b.fillRect(0, 0, 64, 64);
  return blob;
}
// ışık geçişinden sonra, ışık yayanlardan önce: karanlık çöker (ekran koordinatı)
export function drawBalrogDark(ctx, camX, camY, vw, vh, alpha) {
  const c = center(alpha); if (!c || c.D <= 0.01) return;
  const t = G.time, cx = c.x - camX, cy = c.y - camY;
  if (cx < -200 || cx > vw + 200 || cy < -200 || cy > vh + 200) return;
  const p = G.player, px = lerp(p.px, p.x, alpha) - camX, py = lerp(p.py, p.y, alpha) - camY;
  // kenarlardan kararan görüş
  const vg = ctx.createRadialGradient(px, py, 30, px, py, Math.max(vw, vh) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(2,0,1,${(0.7 * c.D).toFixed(3)})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
  // sis: merkezde döner, madenciye doğru uzanır
  const S = blobSprite();
  for (let i = 0; i < 20; i++) {
    const a = i * 2.39 + t * 0.18 * (i % 2 ? 1 : -1), r = (c.creep ? 10 : 46) + (i * 13) % 42 + Math.sin(t * 0.7 + i) * 6, s = 26 + (i * 7) % 20;
    ctx.globalAlpha = 0.6 * c.D;
    ctx.drawImage(S, cx + Math.cos(a) * r * 1.3 - s, cy + Math.sin(a) * r * 0.8 - s, s * 2, s * 2);
  }
  if (c.creep) for (let i = 0; i < 9; i++) {
    const f = ((i / 9) + t * 0.09) % 1, s = 14 + (1 - f) * 12;
    ctx.globalAlpha = 0.5 * c.D * (1 - f);
    ctx.drawImage(S, lerp(cx, px, f) + Math.sin(t * 1.3 + i * 2) * 10 - s, lerp(cy, py, f) + Math.cos(t + i) * 6 - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;
}
// ışık yayan katman: gölgede açılan gözler, silueti ele veren kor çizgileri
export function drawBalrogOmen(ctx, glow) {
  const S = G.balrog; if (!S || S.st !== 'dark') return;
  X = ctx; const t = S.t, x = S.c * TILE + 8, fy = S.r * TILE + 15;
  const p = G.players[S.pi] || G.player; F = p.x < x ? -1 : 1; OX = x; OY = fy;
  if (t > 3.2) {
    const k = clamp((t - 3.2) / 0.8, 0, 1), bl = ((t * 0.7) % 3) < 0.12 ? 0 : 1, h = Math.max(1, Math.round(k * 2)) * bl;
    if (h) { glow(wx(14), wy(-41), 'rgba(255,150,50,0.6)', 8, k); X.fillStyle = '#fff4a0'; X.fillRect(Math.round(wx(F > 0 ? 14 : 16)), Math.round(wy(-41)), 3, h); X.fillStyle = '#ffb040'; X.fillRect(Math.round(wx(F > 0 ? 11 : 12)), Math.round(wy(-41)), 2, h); }
  }
  const late = BALROG.dark - 2.6;
  if (t > late) {
    const k = clamp((t - late) / 2.6, 0, 1);
    X.globalAlpha = k * (0.4 + 0.4 * Math.sin(t * 9));
    const P = { t: G.time, tilt: 0, crouch: 6 };
    for (const cr of CRACKS) limb('#ff5a1a', 1, cr.map(q => up(P, q)));
    X.globalAlpha = 1;
    glow(x, fy - 2, 'rgba(255,80,30,0.4)', 20, k);
  }
}
// ışık kaynağı: alevi çevresini aydınlatır
export function balrogLights(out) {
  for (const e of G.enemies) if (e.type === 'balrog' && !e.under) {
    const intro = e.intro > 0 ? 1 - e.intro / BALROG.intro : 1, dying = e.dead ? clamp(1 - e.dieT / (e.d.dieT || 1), 0, 1) : 0;
    const s = 3.4 * clamp((intro - 0.12) / 0.4, 0, 1) * (1 - dying) * (e.bs && e.bs.phase === 2 ? 1.25 : 1) * (1 - (e.fade || 0));
    if (s > 0.2) out.push({ x: e.x, y: e.y - 18, s });
  }
}
