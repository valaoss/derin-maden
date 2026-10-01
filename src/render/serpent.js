// Dünya Yılanı çizimi: koyu pullu, sırtı yelkenli, iki yanında biyolüminesan beneklerle dev bir kuşak (3B: boss/serpent3d.js).
// Duvarların arasından akar (oyun alanının dışı kırpılır). Karşılaşma öncesi: duvarların ardından geçen dev gölge.
import { TILE, COLS, PLAY_MIN_COL, PLAY_MAX_COL, GROUND_ROW } from '../config.js';
import { TD } from '../data/tiles.js';
import { SERPENT } from '../data/balance.js';
import { G } from '../game/state.js';
import { pathAt } from '../game/serpent.js';
import { nearestPlayer } from '../game/player.js';
import { hash2, clamp, lerp } from '../core/util.js';
import { blobSprite, vignette } from './beast.js';
import { drawSerpent3D } from './boss/serpent3d.js';

const X0 = PLAY_MIN_COL * TILE, X1 = (PLAY_MAX_COL + 1) * TILE;
let X;
const rad = (i, n) => 2.2 + 10.6 * Math.pow(1 - i / n, 0.6);
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const dying = e => e.dead ? clamp(1 - e.dieT / (e.d.dieT || 1), 0, 1) : 0;
// ölüm: can çekişir, sonra yaralı hâlde yandaki duvara kaçar; gövde eski izinden başın ardından akar
const flees = new WeakMap(), fled = k => 480 * Math.pow(clamp((k - 0.16) / 0.84, 0, 1), 1.6);
function flee(e) {
  let F = flees.get(e); if (F) return F;
  const B = (e.bs && e.bs.body) || [], n = B[3] || B[1], a = n ? Math.atan2(e.y - n[1], e.x - n[0]) : (e.face > 0 ? 0 : Math.PI);
  const side = e.x <= X0 ? -1 : e.x >= X1 ? 1 : Math.cos(a) >= 0 ? 1 : -1, E = [side > 0 ? X1 + 50 : X0 - 50, e.y - 26];
  const P = [[e.x, e.y], [e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50], [E[0] - side * 70, E[1]], E], T = [];
  for (let i = B.length - 1; i >= 0; i--) T.push(B[i]);
  for (let i = 0; i <= 40; i++) { const u = i / 40, v = 1 - u; T.push([0, 1].map(c => v * v * v * P[0][c] + 3 * v * v * u * P[1][c] + 3 * v * u * u * P[2][c] + u * u * u * P[3][c])); }
  T.push([E[0] + side * 700, E[1]]);
  const L = [0]; for (let i = 1; i < T.length; i++) L.push(L[i - 1] + Math.hypot(T[i][0] - T[i - 1][0], T[i][1] - T[i - 1][1]));
  flees.set(e, F = { T, L, L0: L[B.length], a });
  return F;
}
function along(F, d) {
  const { T, L } = F; if (d <= 0) return T[0];
  let i = 1; while (i < L.length - 1 && L[i] < d) i++;
  const k = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
  return [lerp(T[i - 1][0], T[i][0], k), lerp(T[i - 1][1], T[i][1], k)];
}
const roars = new WeakMap();

// duvar gedikleri: yılan yan duvardan girip çıkarken ana kayada kısa süreli bir oyuk açılır; gövde geçince kapanır
const HOLE = { R: 17, D: 24, open: 0.14, hold: 0.3, close: 1 }, holes = new WeakMap();
const holeScale = h => Math.min(ss(0, HOLE.open, G.time - h.t0), 1 - ss(HOLE.hold, HOLE.hold + HOLE.close, G.time - h.last));
function holeRows(h, fn) {
  const k = holeScale(h), R = HOLE.R * k, dir = h.x === X0 ? -1 : 1, y0 = Math.round(h.y);
  for (let dy = -Math.floor(R); dy <= R; dy++) {
    const w = Math.round(HOLE.D * Math.sqrt(k * Math.max(0, 1 - (dy / R) ** 2)) * (0.7 + 0.3 * hash2(dy + 40, y0, 5)));
    if (w > 0) fn(dir > 0 ? h.x : h.x - w, y0 + dy, w, dir);
  }
}
function holesOf(e, H, pts, head) {
  let L = holes.get(e); if (!L) holes.set(e, L = []);
  const t = G.time, line = head ? [[H.x + Math.cos(H.a) * 30, H.y + Math.sin(H.a) * 30], [H.x, H.y], ...pts] : pts;
  for (let i = 1; i < line.length; i++) for (const bx of [X0, X1]) {
    const a = line[i - 1], b = line[i]; if ((a[0] - bx) * (b[0] - bx) >= 0) continue;
    const y = a[1] + (b[1] - a[1]) * (bx - a[0]) / (b[0] - a[0]);
    let h = L.find(q => q.x === bx && Math.abs(q.y - y) < 26);
    if (!h) L.push(h = { x: bx, y, t0: t });
    h.last = t;
  }
  for (let i = L.length - 1; i >= 0; i--) if (t < L[i].t0 || t - L[i].last > HOLE.hold + HOLE.close) L.splice(i, 1);
  return L;
}
function clipPlay(L) { X.save(); X.beginPath(); X.rect(X0, -1e6, X1 - X0, 2e6); if (L) for (const h of L) holeRows(h, (x, y, w) => X.rect(x, y, w, 1)); X.clip(); }
function bodyPts(e) {
  const B = e.bs && e.bs.body; if (!B || !B.length) return [];
  if (!e.dead) return B;
  const F = flee(e), d = F.L0 + fled(dying(e));
  return B.map((_, i) => along(F, d - (i + 1) * SERPENT.seg));
}
// baş duruşu: yüzerken madenciye yaklaştıkça ağzı açılır; dikildiğinde madenciye döner, yelpazesini açar, zehri gırtlağında toplar; ilk çıkışta kükrer
function headPose(e, alpha) {
  const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha), B = (e.bs && e.bs.body) || [], n = B[3] || B[1], t = G.time, k = dying(e);
  let a = n ? Math.atan2(y - n[1], x - n[0]) : (e.face > 0 ? 0 : Math.PI);
  const S = e.bs && e.bs.sv, rear = S && S.m === 'rear' && !e.dead, q = nearestPlayer(x, y);
  let open = 0.16 + 0.08 * Math.sin(t * 3), flare = 0, venom = 0, push = (e.lunge || 0) * 7, thrash = 0;
  if (e.dead) {
    const F = flee(e), d = F.L0 + fled(k), h = along(F, d), b = along(F, d - 10), w = 1 - ss(0.1, 0.3, k);
    a = (Math.hypot(h[0] - b[0], h[1] - b[1]) > 1 ? Math.atan2(h[1] - b[1], h[0] - b[0]) : F.a) + Math.sin(t * 14) * 0.35 * w;
    return { x: h[0], y: h[1], a, open: lerp(1, 0.2, ss(0.12, 0.35, k)), flare: w, venom: 0, thrash: Math.max(w, 0.3), rage: !!(e.bs && e.bs.phase === 2) };
  }
  if (rear) {
    if (q) { let d = Math.atan2(q.y - y, q.x - x) - a; d = Math.atan2(Math.sin(d), Math.cos(d)); a += d * 0.7; }
    const w = clamp(e.wind || 0, 0, 1);
    if (S.first) roars.set(e, true);
    if (roars.get(e)) { open = Math.max(0.3, ss(SERPENT.rear, SERPENT.rear - 0.4, S.hold) * (1 - ss(0.7, 0.3, S.hold))); flare = open; }
    else { open = 0.3 + 0.7 * w; flare = 0.35 + 0.65 * w; venom = S.spat ? 0 : w; push -= w * 5; }
  } else {
    roars.delete(e);
    if (q && !e.under) open += 0.6 * clamp(1 - Math.hypot(q.x - x, q.y - y) / 80, 0, 1);
  }
  return { x: x + Math.cos(a) * push, y: y + Math.sin(a) * push, a, open, flare, venom, thrash, rage: !!(e.bs && e.bs.phase === 2) };
}
// kayanın içinden geçen gövde soluklaşır: kaya üstünden görünür
function inRock(cx, R) {
  if (!G.map) return;
  const w = cx.canvas.width, h = cx.canvas.height;
  cx.globalCompositeOperation = 'destination-out'; cx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let r = Math.max(0, Math.floor(R.oy / TILE)); r * TILE < R.oy + h; r++) for (let c = Math.max(0, Math.floor(R.ox / TILE)); c < COLS && c * TILE < R.ox + w; c++) {
    const d = TD[G.map[r * COLS + c]]; if (d && d.solid) cx.fillRect(c * TILE - R.ox, r * TILE - R.oy, TILE, TILE);
  }
  cx.globalCompositeOperation = 'source-over';
}
const shown = e => { const S = e.bs && e.bs.sv; return e.dead || !e.under || (S && (S.m === 'go' || S.m === 'rear') && e.x > X0 - 46 && e.x < X1 + 46); };

export function drawSerpent(ctx, e, alpha) {
  X = ctx; const pts = bodyPts(e), head = !!e.bs && shown(e);
  const H = headPose(e, alpha), L = holesOf(e, H, pts, head), t = G.time;
  if (!pts.length && !head && !L.length) return;
  X.fillStyle = '#04070c'; for (const h of L) holeRows(h, (x, y, w) => X.fillRect(x, y, w, 1));
  if (pts.length || head) {
    clipPlay(L);
    drawSerpent3D(ctx, e, pts, H, t, SERPENT.n, head, e.dead ? clamp(e.dieT / 0.3, 0, 1) : 1, false, inRock);
    X.restore();
  }
  for (const h of L) {
    // oyuğun dibi karanlık, ağzı kırık kaya; açılırken moloz saçılır
    holeRows(h, (x, y, w, dir) => {
      const d = Math.round(w * 0.45);
      X.fillStyle = 'rgba(3,6,10,0.5)'; X.fillRect(dir > 0 ? x + d : x, y, w - d, 1);
      X.fillStyle = 'rgba(3,6,10,0.85)'; X.fillRect(dir > 0 ? x + w - Math.round(w * 0.3) : x, y, Math.round(w * 0.3), 1);
      X.fillStyle = 'rgba(150,160,205,0.4)'; X.fillRect(dir > 0 ? x + w : x - 1, y, 1, 1);
    });
    const age = t - h.t0, dir = h.x === X0 ? 1 : -1;
    if (age < 0.7) for (let n = 0; n < 9; n++) {
      const a = hash2(n, Math.round(h.y), 7), b = hash2(n, Math.round(h.y), 8), sz = a > 0.6 ? 2 : 1;
      X.fillStyle = n % 3 ? '#2c3046' : '#4a5070';
      X.fillRect(Math.round(h.x + dir * age * (24 + a * 70)), Math.round(h.y + (b - 0.5) * 26 - age * (30 + b * 40) + age * age * 190), sz, sz);
    }
  }
}

// ---------- ışık katmanı ----------
export function drawSerpentGlow(ctx, e, alpha, glow) {
  X = ctx; const pts = bodyPts(e), t = G.time, n = SERPENT.n, rage = e.bs && e.bs.phase === 2;
  clipPlay(holes.get(e));
  const head = !!e.bs && shown(e);
  if (pts.length || head) {
    // gözler, benekler, zehir: 3B katmandan; çevrelerine yumuşak ışık
    const H = headPose(e, alpha), R = drawSerpent3D(ctx, e, pts, H, t, n, head, e.dead ? clamp(e.dieT / 0.3, 0, 1) * (0.75 + 0.25 * Math.sin(t * 23)) : 1, true, inRock);
    for (let i = 1; i < pts.length; i += 6) {
      const [x, y] = pts[i]; glow(x, y, rage ? 'rgba(255,90,140,0.25)' : 'rgba(90,224,255,0.22)', Math.round(rad(i, n) + 4), 0.35 + 0.65 * Math.max(0, Math.sin(t * 4 - i * 0.35)));
    }
    if (R.at.eye) glow(R.at.eye[0], R.at.eye[1], rage ? 'rgba(255,120,170,0.6)' : 'rgba(160,250,255,0.6)', 9, 1);
    if (R.at.mouth && H.open > 0.3 && !e.dead) glow(R.at.mouth[0], R.at.mouth[1], 'rgba(90,224,200,0.6)', Math.round(6 + H.open * 10), H.open * (0.4 + 0.6 * H.venom));
  }
  // sonraki çıkış: duvar çatlar ve yol parlar
  const S = e.bs && e.bs.sv;
  if (S && S.P && !e.dead && (S.m === 'tell' || (S.m === 'under' && S.t < 0.6))) {
    const on = Math.floor(t * 12) % 2, [sx, sy] = S.P[0], wxp = sx < X0 ? X0 : X1;
    glow(wxp, sy, 'rgba(90,224,255,0.7)', 26, 0.6 + 0.4 * on);
    X.strokeStyle = '#8af0ff'; X.lineWidth = 1; X.beginPath();
    for (let j = 0; j < 6; j++) { const yy = sy - 16 + j * 6, xx = wxp + (sx < X0 ? 1 : -1) * (2 + hash2(j, Math.floor(t * 8), 3) * 8); j ? X.lineTo(xx, yy) : X.moveTo(xx, yy); }
    X.stroke();
    X.fillStyle = S.m === 'tell' && on ? '#8af0ff' : '#2a8ab0';
    for (let u = 0; u <= 1; u += 0.025) { const [x, y] = pathAt(S.P, u); if (Math.floor(u * 40 + t * 10) % 2) X.fillRect(Math.round(x), Math.round(y), 1, 1); }
  }
  X.restore();
}

// ---------- karşılaşma öncesi ----------
// ana katman: dev gölge yalnız açık mağara hücrelerinde, duvarların ardından geçer
export function drawSerpentOmen(ctx, r0, r1) {
  const S = G.serpent; if (!S || S.st !== 'omen' || S.t < 1.6 || S.t > 7.2) return;
  X = ctx; const t = G.time, k = (S.t - 1.6) / 5.4, dir = S.dir || 1;
  const head = dir > 0 ? lerp(-260, COLS * TILE + 260, k) : lerp(COLS * TILE + 260, -260, k);
  X.save(); X.beginPath();
  const ra = Math.max(r0, Math.floor((S.y - 90) / TILE)), rb = Math.min(r1, Math.floor((S.y + 70) / TILE));
  for (let r = Math.max(GROUND_ROW, ra); r <= rb; r++) for (let c = 0; c < COLS; c++) if (!TD[G.map[r * COLS + c]].solid) X.rect(c * TILE, r * TILE, TILE, TILE);
  X.clip();
  X.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    X.strokeStyle = pass ? 'rgba(10,24,36,0.9)' : 'rgba(0,2,6,0.92)'; X.lineWidth = pass ? 20 : 26;
    X.beginPath();
    for (let s = 0; s <= 420; s += 10) { const x = head - dir * s, y = S.y - 14 + Math.sin(x * 0.018 + t * 1.2) * 18; s ? X.lineTo(x, y) : X.moveTo(x, y); }
    X.stroke();
  }
  // soluk benekler: sisin içinde yanıp söner
  for (let s = 10; s <= 420; s += 14) { const x = head - dir * s, y = S.y - 14 + Math.sin(x * 0.018 + t * 1.2) * 18; X.globalAlpha = 0.9 * Math.max(0, Math.sin(t * 3 - s * 0.05)); X.fillStyle = '#8af0ff'; X.fillRect(Math.round(x), Math.round(y - 6), 1, 1); X.fillRect(Math.round(x), Math.round(y + 6), 1, 1); }
  X.globalAlpha = 1;
  X.restore();
}
// ışık katmanı: çatlayan duvar
export function drawSerpentOmenGlow(ctx, glow) {
  const S = G.serpent; if (!S || S.st !== 'omen' || S.t < SERPENT.omen - 1.8) return;
  X = ctx; const t = G.time, k = clamp((S.t - (SERPENT.omen - 1.8)) / 1.8, 0, 1), wxp = S.dir > 0 ? X0 : X1, s = S.dir > 0 ? 1 : -1;
  glow(wxp, S.y, 'rgba(90,224,255,0.6)', Math.round(14 + k * 26), k);
  X.strokeStyle = '#8af0ff'; X.globalAlpha = k;
  for (let j = 0; j < 3; j++) { X.beginPath(); for (let q = 0; q < 7; q++) { const yy = S.y - 24 + q * 8, xx = wxp + s * (1 + hash2(q, j, Math.floor(t * 6)) * 10 * k); q ? X.lineTo(xx, yy) : X.moveTo(xx, yy); } X.stroke(); }
  X.globalAlpha = 1;
}
// deniz susar: kenarlardan derin mavi karanlık
export function drawSerpentDark(ctx, camX, camY, vw, vh, alpha) {
  const S = G.serpent; if (!S) return;
  let D = 0;
  if (S.st === 'omen') D = Math.min(0.65, S.t / 4);
  else if (S.st === 'fight') { const e = G.enemies.find(o => o.type === 'dunyaYilani'); D = e ? 0.4 * (e.dead ? clamp(e.dieT / (e.d.dieT || 1), 0, 1) : 1) : 0; }
  else if (S.st === 'done' && S.t < 3) D = 0.3 * (1 - S.t / 3);
  if (D < 0.01) return;
  const p = G.player, px = lerp(p.px, p.x, alpha) - camX, py = lerp(p.py, p.y, alpha) - camY;
  if (Math.abs(p.y - (S.y || p.y)) > 400 && S.st === 'omen') return;
  vignette(ctx, px, py, vw, vh, D, '0,3,10');
  if (S.st === 'omen') {
    const B = blobSprite();
    for (let i = 0; i < 10; i++) { const a = i * 2.39 + t0() * 0.2, r = 60 + (i * 17) % 50, s = 30; ctx.globalAlpha = 0.35 * D; ctx.drawImage(B, px + Math.cos(a) * r * 1.4 - s, py + Math.sin(a) * r * 0.7 - s, s * 2, s * 2); }
    ctx.globalAlpha = 1;
  }
}
const t0 = () => G.time;

