// Küçük düşmanların 3B çizimi: model ve duruş boss çizicisiyle (soft3d) aynı yoldan gelir.
// Aynı türden çok varlık olabildiği için her birinin kendi küçük tuvali vardır; model saniyede ~30 kez yeniden çizilir, konum her karede akar.
import { STEP } from '../../config.js';
import { G } from '../../game/state.js';
import { rasterBoss } from '../boss/state.js';
import { MOBS, mobOf } from './defs.js';

export const hasMob = e => !!MOBS[e.type];
// varlık -> son çizim: tuval, yer, bağlantı noktaları, parlayan pikseller (ışık katmanı bunları kullanır)
const seen = new WeakMap(), FPS = 1 / 31;

// ana katman. Dönen: { x, y (köken), feet, top, pts } (taç, can çubuğu, dil buna göre yerleşir)
export function drawMob(ctx, e, alpha) {
  const D = mobOf(e), t = Math.max(0, G.time + (alpha - 1) * STEP), sc = e.scale || 1, a0 = ctx.globalAlpha;
  let s = seen.get(e);
  if (!s) { s = { glow: [], rt: -9, white: false, cv: document.createElement('canvas') }; s.cv.width = D.w; s.cv.height = D.h; s.cx = s.cv.getContext('2d'); seen.set(e, s); }
  const white = (e.hitT > 0 && !e.dead) || (e.dead && e.dieT > (e.d.dieT || 0.42) * 0.86);
  if (t - s.rt >= FPS || t < s.rt || white !== s.white) raster(D, s, e, t, white);
  const dying = s.dying;
  let x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
  if (e.hitT > 0 && !e.dead) { x += (e.hitDx || 0) * 1.5; y += (e.hitDy || 0) * 1.5; }
  const X = Math.round(x), feet = Math.round(y + D.foot * sc), Y = D.center ? Math.round(y) : feet;
  const sink = e.sink > 0 ? e.sink : e.emergeT > 0 ? Math.min(1, e.emergeT / 0.9) : 0, down = Math.round(D.body * sc * sink);
  const a = a0 * (dying > 0.72 ? 1 - (dying - 0.72) / 0.28 : 1);
  if (D.shadow && sink < 0.9) { ctx.globalAlpha = 0.28 * a * (1 - sink); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(X, feet, D.shadow * sc, Math.max(1.5, D.shadow * sc * 0.24), 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = a;
  if (down > 0) { ctx.save(); ctx.beginPath(); ctx.rect(X - D.w, feet - D.h * 2, D.w * 2, D.h * 2); ctx.clip(); ctx.drawImage(s.cv, X - D.ox, Y - D.oy + down); ctx.restore(); }
  else ctx.drawImage(s.cv, X - D.ox, Y - D.oy);
  ctx.globalAlpha = a0;
  s.t = G.time; s.x = X; s.y = Y;
  return { x: X, y: Y, feet, top: Y - Math.round(D.top * sc), pts: s.pts };
}
// modeli varlığın tuvaline çizer: vuruşta (ve ölümün ilk anında) beyaza çalar; parlayan pikseller ayrıca saklanır
function raster(D, s, e, t, white) {
  const R = rasterBoss(e, t, G.players, D), src = R.S.rgba, id = R.S.id, gl = s.glow; gl.length = 0;
  D.img ||= s.cx.createImageData(D.w, D.h);
  const dst = D.img.data; dst.set(src);
  for (let q = 0, o = 0; q < id.length; q++, o += 4) {
    const m = id[q]; if (!m) continue;
    if (white) { dst[o] = (src[o] + 510) / 3; dst[o + 1] = (src[o + 1] + 510) / 3; dst[o + 2] = (src[o + 2] + 510) / 3; }
    if (D.mats[m].glow) gl.push(q % D.w - D.ox, (q / D.w | 0) - D.oy, rgbStr(src[o], src[o + 1], src[o + 2]));
  }
  s.cx.putImageData(D.img, 0, 0);
  s.rt = t; s.white = white; s.pts = R.pts; s.dying = R.o.dying;
}

// ışık katmanı: gözler ve çatlaklar karanlıkta da görünür
// renk dizgeleri önbellekte: her kare her ışıyan piksel için yeni dizge üretilmesin
const RGB = new Map();
function rgbStr(r, g, b) { const k = (r << 16) | (g << 8) | b; let v = RGB.get(k); if (!v) { v = `rgb(${r},${g},${b})`; RGB.set(k, v); } return v; }
export function drawMobGlow(ctx, e) {
  const s = seen.get(e); if (!s || s.t !== G.time) return;
  const g = s.glow; let cur = '';
  for (let i = 0; i < g.length; i += 3) { if (g[i + 2] !== cur) ctx.fillStyle = cur = g[i + 2]; ctx.fillRect(s.x + g[i], s.y + g[i + 1], 1, 1); }
}

// bağlantı noktası (ağız, göz, baş): bu karede çizildiyse dünya pikseli
export function mobPoint(e, k) {
  const s = seen.get(e), p = s && s.t === G.time && s.pts[k];
  return p ? [s.x + Math.floor(p[0]), s.y + Math.floor(p[1])] : null;
}
