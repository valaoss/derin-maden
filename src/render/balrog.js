// Balrog: hacimli yön ve saldırı pozları; gölge dumanı, canlı alevler ve alev kamçısı.
// kükreme ışığı ve yükselen korlar.
// Karşılaşma öncesi: karanlık sis toplanır, gölgede iki göz açılır; ölümde alevi söner, gölgeye gömülür.
import { TILE } from '../config.js';
import { BALROG } from '../data/balance.js';
import { G } from '../game/state.js';
import { hash2, clamp, lerp } from '../core/util.js';
import { drawBossArt, drawBossArtGlow, artAttachment } from './bossart.js';
import { flame, origin as flameOrigin } from './beast.js';

let X, OX, OY, F;
const SC = 1.5; // iskelet (kamçı eli, sis içindeki gözler) sprite boyuna oturur
const wx = lx => OX + lx * F * SC;
const wy = ly => OY + ly * SC;
const FIRE = ['#b8281a', '#ff6a1a', '#ffb040', '#fff0b0'];

function path(pts, close) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(wx(a), wy(b)) : X.moveTo(wx(a), wy(b))); if (close) X.closePath(); }
function limb(col, w, pts) { X.strokeStyle = col; X.lineWidth = w * SC; X.lineCap = 'round'; X.lineJoin = 'round'; path(pts); X.stroke(); X.lineWidth = 1; }

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
  let swA = 1.05, swH = [2, -18], whH = [28.7, -42], whip = { mode: 'idle' };
  if (A) {
    if (A.k === 'sword') {
      if (A.stage === 'raise') { const k = clamp(1 - A.st / 0.8, 0, 1), s = k * k * (3 - 2 * k); swA = lerp(1.05, -2.3, s); swH = [lerp(2, -3, s), lerp(-18, -52, s)]; lean = -2 * s; }
      else { const k = clamp(1 - A.st / 0.7, 0, 1); swA = k < 0.55 ? 1.45 : lerp(1.45, 1.05, (k - 0.55) / 0.45); swH = [lerp(16, 2, Math.max(0, k - 0.55) / 0.45), lerp(-13, -18, Math.max(0, k - 0.55) / 0.45)]; lean = 3 * (1 - k); crouch = 4 * (1 - k); }
    } else if (A.k === 'whip') {
      if (A.stage === 'wind') { const k = clamp(e.wind || 0, 0, 1); whip = { mode: 'wind', k }; }
      else if (A.stage === 'lash') { const k = clamp(1 - A.st / 0.36, 0, 1); whip = { mode: 'lash', k, a: A.a, len: A.len || 90 }; }
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
  return { t, x, y, fy: y + 7, F: e.face || 1, rage, intro, dying, walk, ph, sp, fire, roar, crouch, lean, swA, swH, whH, whip, sink, tilt, hit, fade: e.fade || 0, e, alpha };
}
function setOrigin(P) { OX = Math.round(P.x) + P.lean * P.F; OY = Math.round(P.fy + P.sink); F = P.F; }

// iskelet noktaları (crouch/tilt uygulanmış)
function up(P, pt) { const [a, b] = pt; const k = clamp(-b / 50, 0, 1); return [a + P.tilt * k * 2, b + P.crouch * k + Math.sin(P.t * 2.2) * 0.8 * k]; }
const CRACKS = [[[3, -33], [5, -29], [3, -25], [6, -20]], [[-3, -34], [-1, -29], [-4, -24], [-2, -19]], [[8, -31], [10, -27], [8, -23]], [[-7, -29], [-8, -25]], [[4, -12], [5, -8]], [[-2, -12], [-3, -7]]];

// ---------- ana katman ----------
export function drawBalrog(ctx, e, alpha) {
  X = ctx; const P = pose(e, alpha); setOrigin(P);
  if (e.under) { smoke(P, 1.4); return; }
  const a0 = (P.intro < 1 ? 0.2 + 0.8 * clamp(P.intro / 0.5, 0, 1) : 1) * (1 - P.fade) * (P.dying > 0.85 ? 1 - (P.dying - 0.85) / 0.15 : 1);
  smoke(P, 1 + P.fade * 2 + P.dying * 2 + (P.intro < 1 ? 1 - P.intro : 0));
  // Gövde ve ışık aynı eklem pozunu paylaşır; kamçı gerçek saldırı yönünde uzar.
  drawBossArt(ctx, e, alpha, a0);
  X.globalAlpha = a0;
  whipLine(P, up(P, P.whH), false);
  X.globalAlpha = 1;
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

// kamçı noktaları (dünya koordinatı)
function whipPoints(P, hand) {
  const attached = artAttachment(P.e, P.alpha, 'hand');
  const hx = attached ? attached[0] : wx(hand[0]), hy = attached ? attached[1] : wy(hand[1]), N = 32, seg = 2.05 * SC, pts = [[hx, hy]], t = P.t, W = P.whip;
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
  X.strokeStyle = glow ? '#ff6a1a' : '#1a0c08'; X.lineWidth = (glow ? 1.7 : 2.4) * SC;
  X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.stroke();
  if (glow) { X.strokeStyle = '#ffe090'; X.lineWidth = 0.65 * SC; X.stroke(); }
  X.lineWidth = 1;
  return pts;
}

// ---------- ışık katmanı ----------
export function drawBalrogGlow(ctx, e, alpha, glow) {
  X = ctx; const P = pose(e, alpha); setOrigin(P);
  if (e.under) return;
  const fade = 1 - P.fade, t = P.t, fire = P.fire * fade;
  const clipY = OY - P.sink;
  drawBossArtGlow(ctx, e, alpha, glow, fade * Math.min(1, fire + 0.3));
  const eye = artAttachment(e, alpha, 'eyes'), chest = artAttachment(e, alpha, 'chests');
  if (eye && fire > 0.01) {
    flameOrigin(ctx, 0, 0, 1, 1);
    // The burning mane has independent tongues and a bright core, not a static halo.
    for (let i = 0; i < 5; i++) {
      const h = (7 + Math.sin(t * (7 + i * 0.6) + i * 2) * 3 + (P.rage ? 5 : 0)) * fire;
      flame(eye[0] - P.F * (7 + i * 2), eye[1] - 8 + i * 1.2, h, 3, -P.F * 0.2, i, P.rage);
    }
    if (eye[3] !== false) glow(eye[0], eye[1], 'rgba(255,196,82,0.75)', 7, Math.min(1, fire));
    if (chest) glow(chest[0], chest[1], 'rgba(255,83,20,0.32)', 22, Math.min(1, fire) * (0.65 + Math.sin(t * 4) * 0.15));
  }
  if (P.roar > 0.05 && fade > 0) { const m = up(P, [12, -40]); glow(wx(m[0]), wy(m[1]), 'rgba(255,140,40,0.8)', Math.round(6 + P.roar * 10), P.roar); }
  if (fire <= 0.01) return;
  glow(OX, OY - 2, 'rgba(255,90,30,0.4)', 26, Math.min(1, fire) * (0.7 + 0.2 * Math.sin(t * 5)));
  const whH = up(P, P.whH);
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
    if (h) { glow(wx(9), wy(-44), 'rgba(255,150,50,0.6)', 8, k); X.fillStyle = '#fff4a0'; X.fillRect(Math.round(wx(F > 0 ? 9 : 11)), Math.round(wy(-44)), 3, h); X.fillStyle = '#ffb040'; X.fillRect(Math.round(wx(F > 0 ? 6 : 7)), Math.round(wy(-44)), 2, h); }
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
