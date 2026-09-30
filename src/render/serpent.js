// Dünya Yılanı çizimi: koyu pullu, sırtı yüzgeçli, iki yanında biyolüminesan beneklerle dev bir kuşak.
// Duvarların arasından akar (oyun alanının dışı kırpılır). Karşılaşma öncesi: duvarların ardından geçen dev gölge.
import { TILE, COLS, PLAY_MIN_COL, PLAY_MAX_COL, GROUND_ROW } from '../config.js';
import { TD } from '../data/tiles.js';
import { SERPENT } from '../data/balance.js';
import { G } from '../game/state.js';
import { pathAt } from '../game/serpent.js';
import { hash2, clamp, lerp } from '../core/util.js';
import { blobSprite, vignette } from './beast.js';
import { drawArtFrame } from './bossart.js';
import { bossMotion } from './bossmotion.js';
import { drawBoss3D } from './boss3d.js';

const X0 = PLAY_MIN_COL * TILE, X1 = (PLAY_MAX_COL + 1) * TILE, SC = 1.4;
const C = { out: '#03070c', body: '#10283a', mid: '#1a3c50', belly: '#3a6a70', fin: '#0c2030', finTip: '#2a6a80', spot: '#5ae0ff', spot2: '#b8f8ff', eye: '#d8ffff', gum: '#6a1a2a', tooth: '#e8f0f0' };
let X;
const headViews = new WeakMap();
const rad = (i, n) => (2.5 + 7.5 * Math.pow(1 - i / n, 0.55)) * SC;

function clipPlay() { X.save(); X.beginPath(); X.rect(X0, -1e6, X1 - X0, 2e6); X.clip(); }
// gövde noktaları: ölümde çöker ve düşer
function bodyPts(e) {
  const B = e.bs && e.bs.body; if (!B || !B.length) return [];
  if (!e.dead) return B;
  const k = clamp(1 - e.dieT / (e.d.dieT || 1), 0, 1);
  return B.map(([x, y], i) => [x + Math.sin(i * 0.7) * k * 4, y + Math.pow(Math.max(0, k * 1.4 - i / B.length * 0.4), 2) * 70]);
}
function headPose(e, alpha, pts) {
  const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha), n = pts[3] || pts[1];
  let a = n ? Math.atan2(y - n[1], x - n[0]) : (e.face > 0 ? 0 : Math.PI);
  const S = e.bs && e.bs.sv, rear = S && S.m === 'rear';
  if (rear) { const q = G.player; let d = Math.atan2(q.y - y, q.x - x) - a; d = Math.atan2(Math.sin(d), Math.cos(d)); a += d * 0.7; }
  let open = rear ? clamp(e.wind || 0, 0, 1) : 0.15 + 0.1 * Math.sin(G.time * 3);
  let hx = x, hy = y;
  if (e.dead) { const k = clamp(1 - e.dieT / (e.d.dieT || 1), 0, 1); hy += k * k * 60; a += k * 1.2 * (Math.cos(a) > 0 ? 1 : -1); open = 0.5 * (1 - k); }
  return { x: hx, y: hy, a, open };
}

export function drawSerpent(ctx, e, alpha) {
  X = ctx; const pts = bodyPts(e);
  if (!pts.length && (e.under || !e.bs)) return;
  const H = headPose(e, alpha, pts);
  clipPlay();
  const ready = drawBoss3D(ctx, e, alpha, 1, false, serpentPose(H, pts));
  X.restore();
  if (ready) return;
  const n = SERPENT.n, fade = e.dead ? clamp(e.dieT / 0.8, 0, 1) : 1;
  clipPlay(); X.globalAlpha = fade;
  // kuyruktan başa: kontur, gövde, karın, sırt yüzgeçleri
  for (let pass = 0; pass < 2; pass++) for (let i = pts.length - 1; i >= 1; i--) {
    const [x, y] = pts[i], [px, py] = pts[i - 1], r = rad(i, n), dx = px - x, dy = py - y, d = Math.hypot(dx, dy) || 1;
    let nx = -dy / d, ny = dx / d; if (ny > 0) { nx = -nx; ny = -ny; }
    const inRock = TD[G.map[Math.floor(y / TILE) * COLS + Math.floor(x / TILE)]].solid;
    if (pass === 0) {
      X.globalAlpha = fade * (inRock ? 0.45 : 1);
      if (i % 2 === 0) { X.fillStyle = C.fin; X.beginPath(); X.moveTo(x + nx * r * 0.6 - dx / d * 3, y + ny * r * 0.6 - dy / d * 3); X.lineTo(x + nx * (r + 5 * SC) - dx / d * 4, y + ny * (r + 5 * SC) - dy / d * 4); X.lineTo(x + nx * r * 0.6 + dx / d * 3, y + ny * r * 0.6 + dy / d * 3); X.fill(); X.fillStyle = C.finTip; X.fillRect(Math.round(x + nx * (r + 4 * SC) - dx / d * 4), Math.round(y + ny * (r + 4 * SC) - dy / d * 4), 1, 1); }
      X.fillStyle = C.out; X.beginPath(); X.arc(x, y, r + 1, 0, Math.PI * 2); X.fill();
    } else {
      X.globalAlpha = fade * (inRock ? 0.45 : 1);
      // Curved bands model a cylinder: a cool back, pale underside and narrow rim light.
      const bands = ['#081521', '#102a3a', '#1c4051', '#315e67', '#50828a'];
      for (let layer = 0; layer < bands.length; layer++) {
        const rr = r * (1 - layer * 0.16), shift = (layer - 1) * r * 0.13;
        X.fillStyle = bands[layer]; X.beginPath(); X.arc(x - nx * shift, y - ny * shift, rr, 0, Math.PI * 2); X.fill();
      }
      // Staggered scale rows follow the body's tangent and disappear around its far side.
      for (let row = -1; row <= 1; row++) {
        const s = row * r * 0.53, offset = (i + row) % 2 ? 1.4 : -1.4;
        const sx = x + nx * s + dx / d * offset, sy = y + ny * s + dy / d * offset;
        X.strokeStyle = row < 0 ? '#447480' : '#0b2334'; X.lineWidth = 1;
        X.beginPath(); X.moveTo(sx - dx / d * 2, sy - dy / d * 2);
        X.quadraticCurveTo(sx + nx * 2, sy + ny * 2, sx + dx / d * 2, sy + dy / d * 2); X.stroke();
      }
    }
  }
  X.globalAlpha = fade;
  if (!e.under || e.dead) head(headPose(e, alpha, pts), e);
  X.globalAlpha = 1; X.restore();
}

function serpentPose(H, pts) {
  return { yaw: Math.cos(H.a) < 0 ? Math.PI - 0.22 : 0.22, roll: -Math.atan2(Math.sin(H.a), Math.abs(Math.cos(H.a))) * (Math.cos(H.a) < 0 ? -1 : 1), feet: H.y, body: pts, act: { k: 'breath', fire: H.open > 0.3 }, wind: H.open };
}
function headArt(H, e, glow = false) {
  if (drawBoss3D(X, e, 1, 1, glow, serpentPose(H, bodyPts(e)))) return true;
  const direction = Math.round(H.a / (Math.PI / 4)), view = (direction % 8 + 8) % 8;
  const attack = H.open > 0.32 && Math.abs(Math.sin(H.a)) < 0.38;
  const row = e.dead || attack ? 1 : 0, fr = e.dead ? 3 : attack ? 1 : view;
  const face = row && Math.cos(H.a) < 0 ? -1 : 1;
  const motion = bossMotion('dunyaYilani', G.time, attack ? { k: 'cast' } : null, e.wind || 0, 0, e.dead ? 1 - clamp(e.dieT / (e.d.dieT || 1), 0, 1) : 0);
  let state = headViews.get(e);
  if (!state || G.time < state.time) { state = { view, previous: view, changed: -9, time: G.time }; headViews.set(e, state); }
  if (state.view !== view) { state.previous = state.view; state.view = view; state.changed = G.time; }
  state.time = G.time;
  const k = clamp((G.time - state.changed) / 0.14, 0, 1), blend = k * k * (3 - 2 * k);
  const alpha = X.globalAlpha;
  const paint = (frame, opacity) => {
    X.save(); X.translate(H.x, H.y);
    // Authored front, rear and quarter views supply volume; residual tilt follows the spine.
    X.rotate(row ? Math.atan2(Math.sin(H.a), Math.abs(Math.cos(H.a))) * face : H.a - direction * Math.PI / 4);
    const ready = drawArtFrame(X, 'dunyaYilani', row, frame, 0, 18, face, alpha * opacity, 1, glow, motion);
    X.restore(); return ready;
  };
  if (!row && blend < 1) paint(state.previous, 1 - blend);
  return paint(fr, row ? 1 : blend);
}

function head(H, e) {
  if (headArt(H, e)) return;
  X.restore();
  X.save(); X.translate(H.x, H.y); X.rotate(H.a); if (Math.cos(H.a) < 0) X.scale(1, -1); X.scale(SC, SC);
  const o = H.open * 7;
  // yan yüzgeçler ve boynuzlar (arkaya savrulur)
  X.fillStyle = C.fin;
  for (const [a, b, c, d2] of [[-4, -7, -18, -15], [-6, -4, -20, -6], [-4, 5, -16, 10]]) { X.beginPath(); X.moveTo(a, b); X.lineTo(c, d2); X.lineTo(a + 5, b + 1); X.fill(); }
  X.fillStyle = '#c8d8d0'; X.beginPath(); X.moveTo(2, -8); X.quadraticCurveTo(-8, -16, -16, -14); X.lineTo(-6, -11); X.fill();
  // alt çene (açılır), ağız içi, dişler
  X.fillStyle = C.out; X.beginPath(); X.moveTo(-6, 3); X.lineTo(22, 2 + o); X.lineTo(20, 5 + o); X.lineTo(-4, 8); X.fill();
  X.fillStyle = C.mid; X.beginPath(); X.moveTo(-4, 3); X.lineTo(20, 2.5 + o); X.lineTo(18, 4.5 + o); X.lineTo(-3, 6.5); X.fill();
  if (o > 1) { X.fillStyle = C.gum; X.beginPath(); X.moveTo(2, 1); X.lineTo(22, 0.5); X.lineTo(20, 2 + o); X.lineTo(2, 3); X.fill(); X.fillStyle = C.tooth; for (let k = 6; k < 21; k += 3) { X.fillRect(k, 0.5, 1, 1.5); X.fillRect(k + 1, 1 + o, 1, -1.5); } }
  // kafatası
  X.fillStyle = C.out; X.beginPath(); X.moveTo(-8, -9); X.lineTo(6, -10); X.lineTo(17, -6); X.lineTo(25, -2); X.lineTo(26, 1); X.lineTo(14, 2); X.lineTo(-8, 4); X.fill();
  X.fillStyle = C.body; X.beginPath(); X.moveTo(-6, -8); X.lineTo(6, -9); X.lineTo(16, -5); X.lineTo(24, -1.5); X.lineTo(24, 0.5); X.lineTo(13, 1); X.lineTo(-6, 3); X.fill();
  X.fillStyle = C.mid; X.fillRect(-2, -7, 14, 2); X.fillRect(14, -4, 7, 1);
  X.fillStyle = C.belly; X.fillRect(0, 1, 16, 1);
  X.restore();
}

// ---------- ışık katmanı ----------
export function drawSerpentGlow(ctx, e, alpha, glow) {
  X = ctx; const pts = bodyPts(e), t = G.time, n = SERPENT.n;
  const k = e.dead ? clamp(1 - e.dieT / (e.d.dieT || 1), 0, 1) : 0;
  const rage = e.bs && e.bs.phase === 2;
  clipPlay();
  // benekler: kuyruktan başa akan bir ışık dalgası; ölümde kuyruktan başa doğru söner
  for (let i = 1; i < pts.length; i += 2) {
    const [x, y] = pts[i], [px, py] = pts[i - 1], r = rad(i, n), dx = px - x, dy = py - y, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, wave = 0.35 + 0.65 * Math.max(0, Math.sin(t * 4 - i * 0.35));
    const off = k > 0 && i / pts.length > 1 - k * 1.3 ? 0 : 1;
    if (!off) continue;
    X.globalAlpha = wave * (TD[G.map[Math.floor(y / TILE) * COLS + Math.floor(x / TILE)]].solid ? 0.5 : 1);
    X.fillStyle = rage ? (i % 4 ? '#ff5a8a' : '#ffd0e0') : (i % 4 ? C.spot : C.spot2);
    X.fillRect(Math.round(x + nx * r * 0.55), Math.round(y + ny * r * 0.55), 1, 1);
    X.fillRect(Math.round(x - nx * r * 0.55), Math.round(y - ny * r * 0.55), 1, 1);
    if (i % 6 === 1) glow(x, y, rage ? 'rgba(255,90,140,0.25)' : 'rgba(90,224,255,0.22)', Math.round(r + 4), wave);
  }
  X.globalAlpha = 1;
  if (!e.under || e.dead) {
    const H = headPose(e, alpha, pts), ca = Math.cos(H.a), sa = Math.sin(H.a), fl = ca < 0 ? -1 : 1;
    X.globalAlpha = 1 - k;
    if (headArt(H, e, true)) glow(H.x, H.y - 10, 'rgba(90,224,255,0.24)', 18, 1 - k);
    else {
      const ex = H.x + (10 * ca - (-6 * fl) * sa) * SC, ey = H.y + (10 * sa + (-6 * fl) * ca) * SC;
      glow(ex, ey, 'rgba(160,250,255,0.7)', 7, 1 - k);
      X.fillStyle = C.eye; X.fillRect(Math.round(ex) - 1, Math.round(ey), 3, 1);
    }
    X.globalAlpha = 1;
    if (H.open > 0.3) { const mx = H.x + 16 * ca * SC, my = H.y + 16 * sa * SC; glow(mx, my, 'rgba(90,224,200,0.6)', Math.round(6 + H.open * 10), H.open); }
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

