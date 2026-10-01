// Bosses share articulated sprites, eight authored body directions and eased turns.
// Painted action silhouettes, emissive layers and attached effects follow the same pose.
import { STEP } from '../config.js';
import { BALROG, ENEMIES } from '../data/balance.js';
import { BOSS_ART } from '../data/bossart.js';
import { G } from '../game/state.js';
import { clamp } from '../core/util.js';
import { bossMotion, motionFrame, drawMotion, motionPoint } from './bossmotion.js';
import { drawBoss3D, boss3DPoint } from './boss3d.js';
import { hasPL, drawPL, drawPLGlow, plAttachment } from './bosssprite.js';
import { has3D, draw3D, draw3DGlow, point3D as actorPoint } from './boss/actor.js';

const sheets = {};
function sheet(type) {
  const base = type.replace(/-turn$/, ''), A = BOSS_ART[base]; if (!A) return null;
  let s = sheets[type];
  if (!s) {
    s = sheets[type] = { ready: false };
    const img = new Image();
    img.onload = () => { s.img = img; s.ready = true; };
    img.src = `./boss/${type}.png`;
  }
  return s.ready ? s : null;
}
// beyaz ya da renkli siluet (vuruş, öfke, kararma); kare başına önbellekli
function tint(s, A, sx, sy, col) {
  const key = sx + ',' + sy + col; s.tints = s.tints || {};
  let c = s.tints[key];
  if (!c) {
    c = s.tints[key] = document.createElement('canvas'); c.width = A.w; c.height = A.h;
    const x = c.getContext('2d');
    x.drawImage(s.img, sx, sy, A.w, A.h, 0, 0, A.w, A.h);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, A.w, A.h);
  }
  return c;
}

// oyun açılırken yüklenir: boss ortaya çıktığında hazır olsun
if (typeof Image !== 'undefined') for (const t in BOSS_ART) if (!has3D({ type: t }) && t !== 'dunyaYilani' && ENEMIES[t]) { sheet(t); if (BOSS_ART[t].turns) sheet(t + '-turn'); }

// eylemin ilerleyişi -> [satır, kare]; null: yürüme/durma
const k01 = k => clamp(k, 0, 1), fi = (k, n) => Math.min(n - 1, Math.floor(k01(k) * n));
const PICK = {
  balrog(e, act) {
    if (BOSS_ART.balrog.articulated) {
      if (e.intro > 0) return [3, 0];
      if (!act) return null;
      return [{ sword: act.stage === 'raise' ? 1 : 2, whip: 4, wings: 3, shadow: 0 }[act.k] || 0, 0];
    }
    if (e.intro > 0) return [3, fi(1 - e.intro / BALROG.intro, 8)];
    if (!act) return null;
    if (act.k === 'sword') return [1, fi(act.stage === 'raise' ? k01(1 - act.st / 0.8) * 0.55 : 0.55 + k01(1 - act.st / 0.7) * 0.45, 8)];
    if (act.k === 'whip') return act.stage === 'wind' ? [2, fi(e.wind || 0, 4)] : act.stage === 'lash' ? [2, 4 + fi(1 - act.st / 0.36, 4)] : null;
    if (act.k === 'wings') return [3, fi((2.2 - act.T) / 2.2, 8)];
    return null;
  },
  ejder(e, act, t) {
    if (BOSS_ART.ejder.articulated) return act ? [{ breath: 1, tail: 2, gust: 3, soar: 3 }[act.k] || 0, 0] : null;
    if (!act) return null;
    if (act.k === 'breath') return act.stage === 'glow' ? [1, fi(e.wind || 0, 5)] : act.stage === 'fire' ? [1, 5 + Math.floor(t * 9) % 3] : [1, 4];
    if (act.k === 'tail') return act.done ? [2, 6 + Math.floor(t * 12) % 2] : [2, fi(e.wind || 0, 6)];
    if (act.k === 'gust') return act.done ? [3, 4 + fi((0.7 - act.T) / 0.7, 4)] : [3, fi(e.wind || 0, 4)];
    if (act.k === 'soar') return [3, Math.floor(t * (act.stage === 'dive' ? 6 : 14)) % 8];
    return null;
  },
};

const RS = new WeakMap();
// kare seçimi ve dönüşüm: ana ve ışık katmanı aynı pozu kullanır
function pose(e, alpha, upd) {
  let A = BOSS_ART[e.type]; const t = G.time;
  let s = RS.get(e);
  if (s && t < s.t) { RS.delete(e); s = null; }
  if (!s) {
    let target = null, distance = Infinity;
    for (const p of G.players || []) if (!p.dead) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < distance) { distance = d; target = p; } }
    const yaw = target && distance > 4 ? Math.atan2(target.y - e.y, target.x - e.x) : e.face < 0 ? Math.PI : 0;
    s = { ph: 0, t, face: e.face || 1, flipT: -9, walk: 0, yaw }; RS.set(e, s);
  }
  if (upd) {
    const dt = clamp(t - s.t, 0, 0.1); s.t = t;
    const sp = e.dead ? 0 : Math.hypot(e.x - e.px, e.y - e.py) / STEP;
    s.walk += ((sp > 3 ? 1 : 0) - s.walk) * Math.min(1, dt * 10);
    s.ph += Math.min(sp, 220) * dt / 34;   // bir adım döngüsü ~34 px
    if ((e.face || 1) !== s.face) { s.face = e.face || 1; s.flipT = t; }
    if (!e.dead && (A.directions || A.turns)) {
      let target = null, distance = Infinity;
      for (const p of G.players || []) if (!p.dead) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < distance) { distance = d; target = p; } }
      const aim = e.bs && e.bs.act && e.bs.act.a;
      const yaw = Number.isFinite(aim) ? aim : target && distance > 4 ? Math.atan2(target.y - e.y, target.x - e.x) : e.face < 0 ? Math.PI : 0;
      const delta = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
      s.yaw += clamp(delta, -dt * 5.5, dt * 5.5);
    }
  }
  const B = e.bs, act = B && B.act;
  let row = 0, fr = 0;
  if (A.fly && A.walk) fr = 1 + Math.floor(t * 9) % A.walk;
  else if (A.walk && s.walk > 0.5) fr = 1 + Math.floor(s.ph * A.walk) % A.walk;
  // saldırı kareleri eylemin ilerleyişine bağlanır
  const pk = !e.dead && PICK[e.type] && PICK[e.type](e, act, t);
  if (pk) [row, fr] = pk;
  let sheetKey = e.type, blend = 0, blendFr = 0, turn = false;
  const direction = ((s.yaw / (Math.PI * 2) * 8) % 8 + 8) % 8;
  const desired = Math.round(direction) % 8;
  if (s.view == null) { s.view = s.oldView = desired; s.turnT = -9; }
  if (upd && desired !== s.view) { s.oldView = s.view; s.view = desired; s.turnT = t; }
  const turnProgress = clamp((t - s.turnT) / 0.14, 0, 1);
  const facingFrame = turnProgress < 1 ? s.oldView : s.view;
  const facingBlend = turnProgress < 1 ? turnProgress : 0;
  if (!e.dead && A.directions) {
    row = 0; fr = facingFrame; blend = facingBlend; blendFr = s.view; turn = true;
    // Full action silhouettes are used when the attack faces along the tunnel.
    if (act && Math.abs(Math.sin(s.yaw)) < 0.26) { row = 1; fr = act.fire || act.done || e.lunge > 0.1 || act.n > 0 ? 1 : (e.wind || 0) > 0.2 ? 0 : 2; blend = 0; turn = false; }
  } else if (!e.dead && A.turns && !act && !(e.intro > 0) && sheet(e.type + '-turn')) {
    A = { ...A, rows: 1 }; sheetKey += '-turn'; row = 0; fr = facingFrame; blend = facingBlend; blendFr = s.view; turn = true;
  }
  const dying = e.dead ? clamp(1 - e.dieT / (e.d.dieT || 0.9), 0, 1) : 0;
  // ölüm satırı olan boss önce yığılır, sonra kararır
  if (e.dead && A.die != null) { row = A.die; fr = A.dieFrame ?? fi(dying / 0.6, A.frames || 8); }
  const wind = (e.wind || 0) * (row ? 0.4 : 1), lunge = e.lunge || 0, fk = A.directions || A.turns ? 1 : clamp((t - s.flipT) / 0.28, 0, 1);
  let sx = 1 + wind * 0.07 + lunge * 0.08, sy = 1 - wind * 0.09 - lunge * 0.05;
  if (fr === 0 && row === 0 && !A.fly) { const br = Math.sin(t * 2.4 + (e.wob || 0)) * 0.018; sx -= br; sy += br; }
  if (fk < 1) { const q = Math.sin(fk * Math.PI); sx -= q * 0.06; sy += q * 0.06; }
  let ox = 0, oy = 0;
  if (wind > 0.5 && !e.dead) ox += Math.floor(t * 30) % 2 ? 1 : -1;
  ox += lunge * 4 * (e.face || 1);
  if (e.hitT > 0) { ox += (e.hitDx || 0) * 1.5; oy += (e.hitDy || 0) * 1.5; }
  if (fk < 1) oy -= Math.sin(fk * Math.PI) * 4;
  if (A.fly) oy += Math.sin(t * 1.8 + (e.wob || 0)) * 2;
  const x = e.px + (e.x - e.px) * alpha + ox, y = e.py + (e.y - e.py) * alpha + oy;
  // ayak çizgisi: yerdekiler hücrenin tabanına basar, uçan gövde ortasından asılır
  const feet = A.fly ? y + (A.feet - A.top) / 2 : y + 8;
  const motionWind = act ? Math.max(e.wind || 0, e.lunge || 0) : 0;
  const motion = A.articulated ? bossMotion(e.type, t + (e.wob || 0) * 0.137, act, motionWind, s.walk, dying, e.intro > 0 ? 1 - e.intro / BALROG.intro : 0) : null;
  const P = { A, row, fr, sx, sy, x, feet, motion, sheetKey, blend, blendFr, turn, F: turn ? 1 : (e.face || 1) * A.face, dying: A.die != null ? clamp((dying - 0.6) / 0.4, 0, 1) : dying, rage: !!(B && B.phase === 2), t };
  if (upd) {
    if (s.lastPose && (s.lastPose.sheetKey !== sheetKey || s.lastPose.row !== row || !turn && s.lastPose.fr !== fr)) { s.previous = s.lastPose; s.changeT = t; }
    s.lastPose = { ...P };
  }
  P.previous = s.previous;
  const transition = clamp((t - (s.changeT ?? -9)) / 0.14, 0, 1);
  P.transition = transition * transition * (3 - 2 * transition);
  return P;
}

function place(ctx, P) {
  ctx.save();
  ctx.translate(Math.round(P.x), Math.round(P.feet));
  ctx.scale(P.F * P.sx, P.sy);
}
const src = (P, glow) => [P.fr * P.A.w, (P.row + (glow ? P.A.rows : 0)) * P.A.h];

function paint(ctx, s, P, glow = false, color = null) {
  const A = P.A, opacity = ctx.globalAlpha;
  if (P.previous && P.transition < 1) {
    const previousSheet = sheet(P.previous.sheetKey);
    if (previousSheet) {
      ctx.save(); ctx.scale(P.previous.F / P.F, 1); ctx.globalAlpha = opacity * (1 - P.transition);
      paint(ctx, previousSheet, P.previous, glow, color); ctx.restore();
    }
    ctx.globalAlpha = opacity * P.transition;
  }
  const activeOpacity = ctx.globalAlpha;
  const frame = fr => {
    const animated = motionFrame(s, A, P.sheetKey, P.row, fr, P.motion);
    if (animated) {
      if (!color) { drawMotion(ctx, animated, A, glow); return; }
      animated.tints ||= new Map();
      let cv = animated.tints.get(color);
      if (!cv) { cv = document.createElement('canvas'); cv.width = animated.w; cv.height = animated.h; const c = cv.getContext('2d'); c.drawImage(animated.cv, 0, 0, animated.w, animated.h, 0, 0, animated.w, animated.h); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height); animated.tints.set(color, cv); }
      ctx.drawImage(cv, -A.cx - animated.pad, -A.feet - animated.pad); return;
    }
    const sx = fr * A.w, sy = (P.row + (glow ? A.rows : 0)) * A.h;
    if (color) ctx.drawImage(tint(s, A, sx, sy, color), -A.cx, -A.feet);
    else ctx.drawImage(s.img, sx, sy, A.w, A.h, -A.cx, -A.feet, A.w, A.h);
  };
  ctx.globalAlpha = activeOpacity * (1 - P.blend); frame(P.fr);
  if (P.blend > 0.001) { ctx.globalAlpha = activeOpacity * P.blend; frame(P.blendFr); }
  ctx.globalAlpha = opacity;
}

export const hasBossArt = e => has3D(e) || !!BOSS_ART[e.type];

// ana katman: false dönerse sayfa henüz yüklenmedi (eski çizim kullanılır)
export function drawBossArt(ctx, e, alpha, a0 = 1) {
  if (has3D(e)) return draw3D(ctx, e, alpha, a0);
  if (hasPL(e)) return drawPL(ctx, e, alpha, a0);
  if (drawBoss3D(ctx, e, alpha, a0)) return true;
  const P = pose(e, alpha, true), A = P.A;
  const s = sheet(P.sheetKey); if (!s) return false;
  let a = a0;
  if (P.dying > 0.55) a *= 1 - (P.dying - 0.55) / 0.45;
  if (a <= 0.01) return true;
  const emerge = e.emergeT > 0 ? Math.min(1, e.emergeT / 0.9) : e.sink > 0 ? e.sink : 0;
  const sink = Math.max(emerge, P.dying > 0.2 ? (P.dying - 0.2) / 0.8 * 0.5 : 0);
  // gölge
  if (!A.fly && sink < 0.9) { ctx.globalAlpha = 0.3 * a * (1 - sink); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(Math.round(P.x), Math.round(P.feet) - 1, (A.w * 0.3) | 0, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.save();
  if (sink > 0 && !A.fly) { ctx.beginPath(); ctx.rect(P.x - A.w, P.feet - A.h * 2, A.w * 2, A.h * 2); ctx.clip(); }
  place(ctx, P);
  if (sink > 0) ctx.translate(0, (A.feet - A.top) * sink);
  ctx.globalAlpha = a;
  paint(ctx, s, P);
  // öfke: kendi renginde nabız; ölüm: önce beyaz parlar, sonra kararır; vuruş: beyaz
  if (P.rage && !e.dead) { ctx.globalAlpha = a * (0.08 + 0.05 * Math.sin(P.t * 7)); paint(ctx, s, P, false, e.d.col); }
  if (P.dying > 0) { ctx.globalAlpha = a * Math.min(0.8, P.dying * 1.4); paint(ctx, s, P, false, '#0a0406'); }
  else if (e.hitT > 0) { ctx.globalAlpha = a * 0.65; paint(ctx, s, P, false, '#ffffff'); }
  ctx.restore(); ctx.restore();
  ctx.globalAlpha = 1;
  return true;
}

// ışık katmanı: parlayan pikseller toplanarak çizilir, parıltı noktalarında hale
export function drawBossArtGlow(ctx, e, alpha, glow, a0 = 1) {
  if (has3D(e)) return draw3DGlow(ctx, e, alpha, glow, a0);
  if (hasPL(e)) return drawPLGlow(ctx, e, alpha, glow, a0);
  if (drawBoss3D(ctx, e, alpha, a0, true)) {
    const chest = boss3DPoint(e, alpha, 'chests');
    if (chest) glow(chest[0], chest[1], e.d.col, 22, a0 * (1 - chest[2].dying) * 0.22);
    return true;
  }
  const P = pose(e, alpha, false), A = P.A;
  const s = sheet(P.sheetKey); if (!s) return false;
  const a = a0 * (P.dying ? Math.max(0, 1 - P.dying * 1.6) : 1) * (e.emergeT > 0 ? 1 - Math.min(1, e.emergeT / 0.9) : 1);
  if (a <= 0.01) return true;
  const pulse = 0.75 + 0.25 * Math.sin(P.t * (P.rage ? 7 : 3.2));
  place(ctx, P);
  ctx.globalAlpha = a * pulse * 0.8;
  paint(ctx, s, P, true);
  ctx.restore(); ctx.globalAlpha = 1;
  const col = e.d.col;
  for (const [gx, gy] of A.glow) glow(P.x + (gx - A.cx) * P.F * P.sx, P.feet + (gy - A.feet) * P.sy, col, 9, a * pulse * 0.7);
  const cy = P.feet - (A.feet - A.top) * 0.5;
  glow(P.x, cy, col, P.rage ? 34 : 26, a * (P.rage ? 0.45 : 0.3));
  if (e.wind > 0 && !P.row) glow(P.x, cy, '#ffffff', Math.round(10 + e.wind * 18), e.wind * a);
  if (e.flashT > 0) glow(P.x, cy, col, 30, Math.min(1, e.flashT) * a);
  return true;
}

// varlık dışı çizim (uyuyan ejder): verilen kare, verilen yerde
export function drawArtFrame(ctx, type, row, fr, x, feet, F, a = 1, sy = 1, glow = false, motion = null) {
  const s = sheet(type); if (!s) return false;
  const A = BOSS_ART[type], P = { A, row, fr, x, feet, F: F * A.face, sx: 1, sy };
  const [qx, qy] = src(P, glow);
  place(ctx, P); ctx.globalAlpha = a;
  const animated = motionFrame(s, A, type, row, fr, motion);
  if (animated) drawMotion(ctx, animated, A, glow);
  else ctx.drawImage(s.img, qx, qy, A.w, A.h, -A.cx, -A.feet, A.w, A.h);
  ctx.restore(); ctx.globalAlpha = 1;
  return true;
}
// karedeki bir noktanın dünya konumu (ağız, göz)
export function artPoint(e, alpha, px, py) {
  const P = pose(e, alpha, false), A = P.A;
  [px, py] = motionPoint(P.sheetKey, px, py, P.motion, A, P.row);
  return [P.x + (px - A.cx) * P.F * P.sx, P.feet + (py - A.feet) * P.sy, P];
}

export const artPoseRow = (e, alpha = 1) => pose(e, alpha, false).row;

// Attach eye/throat effects to the actually visible view, including front and back.
export function artAttachment(e, alpha, kind) {
  if (has3D(e)) return actorPoint(e, alpha, kind);
  if (hasPL(e)) return plAttachment(e, alpha, kind);
  const point3D = boss3DPoint(e, alpha, kind); if (point3D) return point3D;
  const P = pose(e, alpha, false), A = P.A;
  const attachment = Q => {
    const fr = Q.blend > 0.5 ? Q.blendFr : Q.fr, metric = Q.A;
    const point = Q.turn && metric.turnPoints ? metric.turnPoints[kind]?.[fr] : metric[kind]?.[Q.row];
    if (!point) return null;
    const [x, y] = motionPoint(Q.sheetKey, ...point, Q.motion, metric, Q.row);
    return [P.x + (x - metric.cx) * Q.F * P.sx, P.feet + (y - metric.feet) * P.sy, !(Q.turn && fr === 6)];
  };
  const current = attachment(P); if (!current) return null;
  const previous = P.previous && P.transition < 1 ? attachment(P.previous) : null;
  if (previous) {
    current[0] = previous[0] + (current[0] - previous[0]) * P.transition;
    current[1] = previous[1] + (current[1] - previous[1]) * P.transition;
    if (P.transition < 0.5) current[2] = previous[2];
  }
  return [current[0], current[1], P, current[2]];
}
