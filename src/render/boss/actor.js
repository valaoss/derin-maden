// 3B bossların oyuna çizimi: ana katman (gölge, gömülme, vuruş/öfke/ölüm tonu) ve ışık katmanı (parlayan malzemeler).
import { STEP } from '../../config.js';
import { G } from '../../game/state.js';
import { clamp } from '../../core/util.js';
import { DEFS } from './defs.js';
import { rasterBoss } from './state.js';

export const has3D = e => !!DEFS[e.type];

function canvases(D) {
  if (D.cv) return;
  const mk = () => { const c = document.createElement('canvas'); c.width = D.w; c.height = D.h; return c; };
  D.cv = mk(); D.cx = D.cv.getContext('2d'); D.img = D.cx.createImageData(D.w, D.h);
  D.gcv = mk(); D.gx = D.gcv.getContext('2d'); D.gimg = D.gx.createImageData(D.w, D.h);
  D.tcv = mk(); D.tx = D.tcv.getContext('2d');
}
// çizim önbelleği tuvale aktarılır; parlayan malzemeler ayrı katmana
function upload(D, R) {
  canvases(D);
  if (D.stamp === R.stamp && D.shown === R.o.e) return;
  D.stamp = R.stamp; D.shown = R.o.e;
  D.img.data.set(R.S.rgba); D.cx.putImageData(D.img, 0, 0);
  const g = D.gimg.data, id = R.S.id, c = R.S.rgba;
  for (let q = 0, o = 0; q < id.length; q++, o += 4) {
    const m = id[q] && D.mats[id[q]].glow;
    if (m) { g[o] = c[o]; g[o + 1] = c[o + 1]; g[o + 2] = c[o + 2]; g[o + 3] = 255 * m; } else g[o + 3] = 0;
  }
  D.gx.putImageData(D.gimg, 0, 0);
}
function tinted(D, col) {
  const x = D.tx; x.globalCompositeOperation = 'copy'; x.drawImage(D.cv, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, D.w, D.h);
  return D.tcv;
}
// R: çizim sonucu; x, y: kökenin dünya pikseli (yerdekilerde ayak hizası, uçanlarda gövde ortası)
function place(e, alpha) {
  const R = rasterBoss(e, Math.max(0, G.time + (alpha - 1) * STEP), G.players); if (!R) return null;
  let x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
  if (e.hitT > 0 && !e.dead) { x += (e.hitDx || 0) * 1.5; y += (e.hitDy || 0) * 1.5; }
  R.x = Math.round(x); R.y = Math.round(R.D.fly ? y : y + 8);
  R.at = k => { const p = R.pts[k]; return p ? [R.x + Math.floor(p[0]), R.y + Math.floor(p[1])] : null; };
  return R;
}

export function draw3D(ctx, e, alpha, a0 = 1) {
  const R = place(e, alpha); if (!R) return false;
  const { D, P, o, x, y } = R;
  let a = a0 * (P.alpha ?? 1);
  if (o.dying > 0.82 && !D.ownDeath) a *= 1 - (o.dying - 0.82) / 0.18;
  if (a <= 0.01) return true;
  upload(D, R);
  const sink = e.emergeT > 0 ? Math.min(1, e.emergeT / 0.9) : e.sink > 0 ? e.sink : 0;
  if (!D.fly && (P.shadow ?? 1) > 0.02) { ctx.globalAlpha = 0.3 * a * (1 - sink) * (P.shadow ?? 1); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x + (P.shadowX || 0), y, D.shadow || 18, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.save();
  // doğarken yerden çıkar; ölürken (P.sink) yere gömülür
  const down = Math.round((D.body || 40) * (D.fly ? 2 : 1) * sink + (P.sink || 0));
  if (down > 0) { ctx.beginPath(); ctx.rect(x - D.w, y - D.h, D.w * 2, D.h + (D.fly ? D.body || 20 : 0)); ctx.clip(); ctx.translate(0, down); }
  const dx = x - D.ox, dy = y - D.oy;
  ctx.globalAlpha = a; ctx.drawImage(D.cv, dx, dy);
  // öfke: kendi renginde nabız; ölüm: kararır; vuruş: beyaz
  if (o.rage && !e.dead) { ctx.globalAlpha = a * (0.07 + 0.05 * Math.sin(o.t * 7)); ctx.drawImage(tinted(D, e.d.col), dx, dy); }
  if (o.dying > 0 && !D.ownDeath) { ctx.globalAlpha = a * Math.min(0.7, o.dying * 1.1); ctx.drawImage(tinted(D, '#0a0406'), dx, dy); }
  else if (e.hitT > 0) { ctx.globalAlpha = a * 0.5; ctx.drawImage(tinted(D, '#ffffff'), dx, dy); }
  ctx.globalAlpha = a;
  if (D.fx) D.fx(ctx, R, a);
  ctx.restore(); ctx.globalAlpha = 1;
  return true;
}

export function draw3DGlow(ctx, e, alpha, glow, a0 = 1) {
  const R = place(e, alpha); if (!R) return false;
  const { D, P, o, x, y } = R;
  const a = a0 * (P.alpha ?? 1) * (o.dying ? Math.max(0, 1 - o.dying * (D.ownDeath ? 1 : 1.4)) : 1) * (e.emergeT > 0 ? 1 - Math.min(1, e.emergeT / 0.9) : 1);
  if (a <= 0.01) return true;
  upload(D, R);
  const pulse = 0.78 + 0.22 * Math.sin(o.t * (o.rage ? 7 : 3.2));
  ctx.globalAlpha = a * pulse * (P.glow ?? 1); ctx.drawImage(D.gcv, x - D.ox, y - D.oy); ctx.globalAlpha = 1;
  const cy = y - (D.fly ? 0 : (D.body || 40) * 0.5);
  glow(x, cy, e.d.col, o.rage ? 36 : 28, a * (o.rage ? 0.4 : 0.26));
  if (e.flashT > 0) glow(x, cy, e.d.col, 30, Math.min(1, e.flashT) * a);
  if (D.light) D.light(ctx, R, glow, a);
  return true;
}

// bağlantı noktası (göz, ağız, göğüs, el): [x, y, { F, dying }, görünür]
const NAMES = { eyes: 'eye', chests: 'chest' };
export function point3D(e, alpha, kind) {
  const R = place(e, alpha); if (!R) return null;
  const k = NAMES[kind] || kind, p = R.pts[k]; if (!p) return null;
  const S = R.S, sx = Math.floor(p[0]) + R.D.ox, sy = Math.floor(p[1]) + R.D.oy;
  const seen = sx < 0 || sy < 0 || sx >= S.w || sy >= S.h || p[2] >= S.z[sy * S.w + sx] - 3 * (R.D.scale || 1);
  return [R.x + Math.floor(p[0]), R.y + Math.floor(p[1]), { F: e.face || 1, dying: R.o.dying, P: R.P, o: R.o }, seen];
}
export const pose3D = (e, alpha) => place(e, alpha);
