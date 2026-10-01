// PixelLab boss sprites: 8 static rotations + east-view animation rows (west is mirrored).
// Sheet: public/boss/pl/<type>.png, layout: src/data/plboss.json. Glow layer is derived from the fire pixels.
import { STEP } from '../config.js';
import { BALROG } from '../data/balance.js';
import PL from '../data/plboss.json';
import { G } from '../game/state.js';
import { clamp } from '../core/util.js';

const sheets = {};
function sheet(type) {
  const L = PL[type]; if (!L) return null;
  let s = sheets[type];
  if (!s) {
    s = sheets[type] = { ready: false };
    const img = new Image();
    img.onload = () => { s.img = img; s.glow = glowLayer(img); s.ready = true; };
    img.src = `./boss/pl/${type}.png`;
  }
  return s.ready ? s : null;
}
if (typeof Image !== 'undefined') for (const t in PL) sheet(t);

// parlayan pikseller (alev, kor, lav): karanlıkta görünen katman
function glowLayer(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const hot = r > 180 && g > 60 && b < 140 && r - b > 90;
    if (!hot) p[i + 3] = 0; else p[i + 3] = Math.round(p[i + 3] * clamp((r + g) / 400, 0.4, 1));
  }
  x.putImageData(d, 0, 0);
  return c;
}
function tint(s, key, col) {
  s.tints ||= {}; let c = s.tints[key + col];
  if (!c) {
    c = s.tints[key + col] = document.createElement('canvas'); c.width = s.img.width; c.height = s.img.height;
    const x = c.getContext('2d'); x.drawImage(s.img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

// yaklaşık bağlantı noktaları (doğu karesi, hücre koordinatı)
const POINTS = { balrog: { eyes: [77, 27], mouth: [80, 32], chests: [73, 50], hand: [49, 66] }, karakok: { eyes: [72, 40], mouth: [76, 50], chests: [64, 70] }, kavurgan: { eyes: [92, 40], mouth: [100, 48], chests: [64, 70] }, otegoz: { eyes: [70, 50], mouth: [70, 50], chests: [64, 64] }, sultan: { eyes: [72, 30], mouth: [74, 38], chests: [64, 60], hand: [84, 70] } };

const k01 = k => clamp(k, 0, 1);
// eylem -> [animasyon adı, ilerleme 0..1 | null (döngü)]
const ACT = {
  balrog(e, act, L) {
    if (!act) return null;
    if (act.k === 'sword') return ['sword', act.stage === 'raise' ? k01(1 - act.st / 0.8) * 0.5 : 0.5 + k01(1 - act.st / 0.7) * 0.5];
    if (act.k === 'whip') { const w = k01(e.wind || 0), l = k01(1 - act.st / 0.36); return L.anims.whip2 ? ['whip2', act.stage === 'wind' ? 0.25 + w * 0.55 : act.stage === 'lash' ? 0.8 + l * 0.2 : 1] : ['whip', act.stage === 'wind' ? w * 0.45 : act.stage === 'lash' ? 0.45 + l * 0.55 : 1]; }
    if (act.k === 'wings') return [L.anims.roar ? 'roar' : 'wings', k01((2.2 - act.T) / 2.2)];
    if (act.k === 'shadow') return ['shadow', act.stage === 'fade' ? k01(1 - act.st / 0.7) : act.stage === 'form' ? k01(act.st / 0.55) : 1];
    return null;
  },
  karakok(e, act) {
    if (act.k === 'spikes') return ['spikes', k01(1 - act.T / 0.5)];
    if (act.k === 'burrow') return act.stage === 'sink' ? ['burrow', k01(1 - act.st / 0.5)] : act.stage === 'rise' ? ['rise', k01(1 - act.st / 0.65)] : ['burrow', 1];
    if (act.k === 'summon') return ['summon', k01(1 - act.T / 0.3)];
    return null;
  },
  otegoz(e, act) {
    if (act.k === 'orbs') return ['orbs', k01(1 - act.T / 0.5)];
    if (act.k === 'pull') return ['pull', k01(1 - act.T / 2)];
    if (act.k === 'gaze') return ['gaze', k01(1 - act.T / 2.1)];
    return null;
  },
  sultan(e, act) {
    if (act.k === 'charge') return act.stage === 'aim' ? ['charge', k01(e.wind || 0) * 0.8] : act.stage === 'dash' ? ['charge', 0.88 + k01(1 - act.st / 0.8) * 0.12] : ['daze', k01(1 - act.st / 1.1)];
    if (act.k === 'slam') return ['slam', k01(1 - act.T / 0.6)];
    if (act.k === 'coins') return ['coins', k01(1 - act.T / 0.35)];
    return null;
  },
  kavurgan(e, act) {
    if (act.k === 'breath') return ['breath', k01(1 - act.T / 1.9)];
    if (act.k === 'embers') return ['embers', k01(1 - act.T / 0.45)];
    if (act.k === 'bones') return ['bones', k01(1 - act.T / 0.4)];
    return null;
  },
};

const RS = new WeakMap();
function pose(e, alpha, upd) {
  const L = PL[e.type], t = G.time;
  let s = RS.get(e);
  if (s && t < s.t) { RS.delete(e); s = null; }
  if (!s) { s = { t, ph: 0, walk: 0, yaw: e.face < 0 ? Math.PI : 0, view: null }; RS.set(e, s); }
  if (upd) {
    const dt = clamp(t - s.t, 0, 0.1); s.t = t;
    const sp = e.dead ? 0 : Math.hypot(e.x - e.px, e.y - e.py) / STEP;
    s.walk += ((sp > 3 ? 1 : 0) - s.walk) * Math.min(1, dt * 10);
    s.ph += Math.min(sp, 220) * dt / 34;
    if (e.hitT > 0 && t - (s.hurtAt ?? -9) > 0.5) s.hurtAt = t;   // vuruş animasyonu: kısa hitT yerine 0.45 sn oynar
    if (!e.dead) {
      let target = null, distance = Infinity;
      for (const p of G.players || []) if (!p.dead) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < distance) { distance = d; target = p; } }
      const aim = e.bs?.act?.a;
      const yaw = Number.isFinite(aim) ? aim : target && distance > 4 ? Math.atan2(target.y - e.y, target.x - e.x) : e.face < 0 ? Math.PI : 0;
      const delta = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
      s.yaw += clamp(delta, -dt * 5.5, dt * 5.5);
    }
  }
  const act = e.bs?.act, dying = e.dead ? k01(1 - e.dieT / (e.d.dieT || 0.9)) : 0, fly0 = !!e.d.fly;
  let name = 'idle', fr = 0, F = e.face || 1, rot = false;
  const pick = a => L.anims[a] ? a : null;
  const at = (a, k) => { name = a; fr = Math.min(L.anims[a].n - 1, Math.floor(k01(k) * L.anims[a].n)); };
  const loop = (a, fps) => { name = a; fr = Math.floor(t * fps) % L.anims[a].n; };
  const dir = Math.round(((s.yaw / (Math.PI * 2) * 8) % 8 + 8) % 8) % 8;
  const side = Math.abs(Math.sin(s.yaw)) < 0.26;
  if (e.dead && pick('die')) at('die', dying / 0.7);
  else if (e.blinkT > 0 && pick('blink')) at('blink', e.blinkT / 0.3);   // ışınlanma: belirme = kaybolmanın tersi
  else if (e.intro > 0) { if (pick('intro')) at('intro', 1 - e.intro / BALROG.intro); else at('idle', 0); }
  else if (act && ACT[e.type]) {
    const r = ACT[e.type](e, act, L);
    if (r && pick(r[0])) { if (r[1] == null) loop(r[0], 10); else at(r[0], r[1]); }
    else loop('idle', 8);
  } else if (t - (s.hurtAt ?? -9) < 0.45 && pick('hurt')) at('hurt', (t - s.hurtAt) / 0.45);
  else if (!fly0 && s.walk > 0.5 && pick('walk')) { name = 'walk'; fr = Math.floor(s.ph * L.anims.walk.n) % L.anims.walk.n; }
  else if (!side) { rot = true; fr = dir; F = 1; }
  else loop('idle', 8);
  if (!rot) F = act || e.dead || name === 'hurt' ? (e.face || 1) : Math.cos(s.yaw) < 0 ? -1 : 1;
  if (upd) {
    if (s.last && (s.last.rot !== rot || s.last.name !== name || (rot && s.last.fr !== fr))) { s.changeT = t; s.prev = s.last; }
    s.last = { rot, name, fr, F };
  }
  const row = rot ? L.rot : L.anims[name].row;
  const wind = (e.wind || 0) * (row ? 0.4 : 1), lunge = e.lunge || 0;
  let sx = 1 + wind * 0.05 + lunge * 0.08, sy = 1 - wind * 0.06 - lunge * 0.05, ox = 0, oy = 0;
  if (rot) { const br = Math.sin(t * 2.4 + (e.wob || 0)) * 0.015; sx -= br; sy += br; }
  if (wind > 0.5 && !e.dead) ox += Math.floor(t * 30) % 2 ? 1 : -1;
  ox += lunge * 4 * (e.face || 1);
  if (e.hitT > 0) { ox += (e.hitDx || 0) * 1.5; oy += (e.hitDy || 0) * 1.5; }
  const x = e.px + (e.x - e.px) * alpha + ox, y = e.py + (e.y - e.py) * alpha + oy;
  const trans = clamp((t - (s.changeT ?? -9)) / 0.12, 0, 1);
  const fly = !!e.d.fly;
  return { L, row, fr, F, sx, sy, x, feet: fly ? y + Math.sin(t * 1.8 + (e.wob || 0)) * 2 + (L.feet - 40) * 0.5 * (L.scale || 1) : y + 8, fly, t, dying, rage: e.bs?.phase === 2, prev: trans < 1 ? s.prev : null, trans: trans * trans * (3 - 2 * trans), scale: L.scale || 1 };
}

function paint(ctx, s, P, layer = null, col = null) {
  const { L } = P, cw = L.cell, sx = P.fr * cw, sy = P.row * cw;
  const img = col ? tint(s, 'm', col) : layer || s.img;
  ctx.drawImage(img, sx, sy, cw, cw, -L.cx, -L.feet, cw, cw);
}
function draw(ctx, s, P, a, layer, col) {
  ctx.save();
  ctx.translate(Math.round(P.x), Math.round(P.feet));
  ctx.scale(P.F * P.sx * P.scale, P.sy * P.scale);
  if (P.prev) {
    const Q = { ...P, ...P.prev, row: P.prev.rot ? P.L.rot : P.L.anims[P.prev.name].row };
    ctx.save(); ctx.scale(Q.F / P.F, 1); ctx.globalAlpha = a * (1 - P.trans); paint(ctx, s, Q, layer, col); ctx.restore();
    ctx.globalAlpha = a * P.trans;
  } else ctx.globalAlpha = a;
  paint(ctx, s, P, layer, col);
  ctx.restore();
}

export const hasPL = e => !!PL[e.type];

export function drawPL(ctx, e, alpha, a0 = 1) {
  const P = pose(e, alpha, true), L = P.L, s = sheet(e.type); if (!s) return false;
  let a = a0;
  if (P.dying > 0.7) a *= 1 - (P.dying - 0.7) / 0.3;
  if (a <= 0.01) return true;
  const emerge = e.emergeT > 0 ? Math.min(1, e.emergeT / 0.9) : e.sink > 0 ? e.sink : 0;
  const sink = Math.max(emerge, P.dying > 0.5 ? (P.dying - 0.5) / 0.5 * 0.4 : 0);
  if (!P.fly) { ctx.globalAlpha = 0.3 * a * (1 - sink); ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(Math.round(P.x), Math.round(P.feet) - 1, (L.cell * 0.28 * P.scale) | 0, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.save();
  if (sink > 0) { ctx.beginPath(); ctx.rect(P.x - L.cell, P.feet - L.cell * 2, L.cell * 2, L.cell * 2); ctx.clip(); ctx.translate(0, L.cell * 0.9 * sink); }
  draw(ctx, s, P, a);
  if (P.rage && !e.dead) draw(ctx, s, P, a * (0.08 + 0.05 * Math.sin(P.t * 7)), null, e.d.col);
  if (P.dying > 0) draw(ctx, s, P, a * Math.min(0.85, P.dying * 1.3), null, '#0a0406');
  else if (e.hitT > 0) draw(ctx, s, P, a * 0.65, null, '#ffffff');
  ctx.restore(); ctx.globalAlpha = 1;
  return true;
}

export function drawPLGlow(ctx, e, alpha, glow, a0 = 1) {
  const P = pose(e, alpha, false), L = P.L, s = sheet(e.type); if (!s) return false;
  const a = a0 * (P.dying ? Math.max(0, 1 - P.dying * 1.4) : 1) * (e.emergeT > 0 ? 1 - Math.min(1, e.emergeT / 0.9) : 1);
  if (a <= 0.01) return true;
  const pulse = 0.75 + 0.25 * Math.sin(P.t * (P.rage ? 7 : 3.2));
  draw(ctx, s, P, a * pulse * 0.85, s.glow);
  ctx.globalAlpha = 1;
  const cy = P.feet - L.cell * 0.45 * P.scale;
  glow(P.x, cy, e.d.col, P.rage ? 36 : 28, a * (P.rage ? 0.45 : 0.3));
  if (e.wind > 0 && P.row === L.rot) glow(P.x, cy, '#ffffff', Math.round(10 + e.wind * 18), e.wind * a);
  if (e.flashT > 0) glow(P.x, cy, e.d.col, 30, Math.min(1, e.flashT) * a);
  return true;
}

// bağlantı noktası: [x, y, P, görünür]; arkaya dönük karede göz görünmez
export function plAttachment(e, alpha, kind) {
  const P = pose(e, alpha, false), pt = POINTS[e.type]?.[kind]; if (!pt) return null;
  const L = P.L, [px, py] = pt;
  const back = P.row === L.rot && (P.fr === 5 || P.fr === 6 || P.fr === 7);
  return [P.x + (px - L.cx) * P.F * P.sx * P.scale, P.feet + (py - L.feet) * P.sy * P.scale, P, !back];
}
