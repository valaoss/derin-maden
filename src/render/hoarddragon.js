// Hazine salonundaki ejder (uyku ve uyanış): 3B model yığının üstüne oturur, altı kazılırsa çöker;
// burnundan nefesle duman çıkar, göz ve kükreyen ağız karanlıkta parlar.
import { TILE, COLS } from '../config.js';
import { TD } from '../data/tiles.js';
import { G } from '../game/state.js';
import { clamp, hash2 } from '../core/util.js';
import { coinPattern } from './hoard.js';
import { drawDragon3D, rememberHoard, DRAGON } from './dragon3d.js';

const F = -1, SINK = 3, seats = new WeakMap();
const tile = (c, r) => c >= 0 && c < COLS && r >= 0 ? TD[G.map[r * COLS + c]] : null;
// gövdenin altındaki en yüksek katı karo (yoksa salonun zemini)
function support(H) {
  const c0 = Math.floor(H.c) - 2, r0 = Math.floor(H.r);
  let top = Infinity;
  for (let c = c0; c <= c0 + 3; c++) for (let r = r0 - 1; r <= r0 + 3; r++) { const d = tile(c, r); if (d && d.solid) { top = Math.min(top, r * TILE + SINK); break; } }
  return top === Infinity ? H.r * TILE + 16 : top;
}
function pose(H) {
  const x = H.c * TILE + 8, wake = H.st === 'wake' ? H.t : -1, target = support(H);
  let s = seats.get(H);
  if (!s || G.time < s.t) seats.set(H, s = { y: target, t: G.time });
  if (wake < 0) s.y += clamp(target - s.y, -1, Math.max(0, G.time - s.t) * 70);
  s.t = G.time;
  // uyanış: altın saçılınca yığından salon zeminine iner (savaş başlangıç hizası)
  const k = clamp((wake - 0.3) / 0.45, 0, 1), feet = wake < 0 ? s.y : s.y + (H.r * TILE + 16 - s.y) * k * k * (3 - 2 * k);
  // davetsiz misafir: önündeyse başını ona kaldırır, arkasındaysa omzunun üstünden döner
  let look = [0, 0], best = Infinity;
  for (const p of G.players || []) if (!p.dead) {
    const d = Math.hypot(p.x - x, p.y - feet); if (d >= best) continue; best = d;
    const dx = (p.x - x) * F, up = (feet - 30 - p.y) / 90;
    look = [clamp(-dx / 50, 0, 1) * 1.7, clamp(up, -0.3, 0.3) * (dx >= 0 ? 1 : 0.5)];
  }
  // uyku ağır çekim: saniyede 30 poz yeter (çizim maliyeti yarıya iner)
  return { x, feet, o: { t: wake < 0 ? Math.round(G.time * 30) / 30 : G.time, wake, stir: H.lv || 0, look } };
}
const near = H => (H.st === 'sleep' || H.st === 'wake') && Math.abs(G.cam.y + 150 - H.r * TILE) < 420;

export function drawHoard3D(ctx) {
  const H = G.hoard; if (!H) return false;
  if (!near(H)) return true;
  const { x, feet, o } = pose(H);
  const R = drawDragon3D(ctx, x, feet, F, o, P => {
    if (P.squash > 0.95) return;
    ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - P.squash)})`; ctx.beginPath(); ctx.ellipse(x, feet, 30, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  });
  const P = R.P, S = R.S;
  rememberHoard(P, G.time);
  // yığına gömülen alt kenar: gövdenin değdiği sütunlarda paralar gövdenin önüne taşar
  if (P.coins > 0.5) {
    ctx.save(); ctx.fillStyle = coinPattern(ctx);
    for (let sx = 0; sx < S.w; sx++) {
      let hit = false; for (let sy = DRAGON.oy - 2; sy <= DRAGON.oy + 1 && !hit; sy++) hit = S.id[sy * S.w + sx] > 0;
      const wx = x - DRAGON.ox + sx, d = tile(Math.floor(wx / TILE), Math.floor((feet + 2) / TILE));
      if (!hit || !d || d.ore !== 'gold') continue;
      const h = 2 + Math.floor(hash2(wx, 7, 3) * 3);
      ctx.fillRect(wx, feet - h, 1, h + 2);
      if (hash2(wx, 3, 1) < 0.5) { ctx.fillStyle = hash2(wx, 5, 2) < 0.4 ? '#fff0a0' : '#ffd24a'; ctx.fillRect(wx, feet - h, 1, 1); ctx.fillStyle = coinPattern(ctx); }
    }
    ctx.restore();
  }
  // burun dumanı: uykuda her nefes verişte, uyanışta kükremeye kadar
  if (P.roar < 0.2) {
    const [nx, ny] = R.at('nose'), t = G.time;
    for (let i = 0; i < 6; i++) {
      const age = (t / 3.2 + i * 0.13) % 1; if (age > 0.72) continue;
      const k = age / 0.72, w = 1 + Math.round(k * 3);
      ctx.globalAlpha = (1 - k) * 0.24; ctx.fillStyle = '#a99a90';
      ctx.fillRect(Math.round(nx + F * (1 + k * 10) + Math.sin(t * 1.3 + i) * k * 2 - w / 2), Math.round(ny - 1 - k * 20), w, Math.max(1, w - 1));
    }
    ctx.globalAlpha = 1;
  }
  return true;
}

export function drawHoard3DGlow(ctx, glow) {
  const H = G.hoard; if (!H) return false;
  if (!near(H)) return true;
  const { x, feet, o } = pose(H), R = drawDragon3D(null, x, feet, F, o), P = R.P;
  if (P.eye > 0.1) {
    const [ex, ey] = R.at('eye');
    glow(ex, ey, 'rgba(255,220,90,0.7)', Math.round(3 + P.eye * 5), P.eye);
    ctx.globalAlpha = P.eye; ctx.fillStyle = '#ffe060'; ctx.fillRect(ex, ey, 1, 1); ctx.globalAlpha = 1;
  }
  // kükremeden önce göğüs içeriden kızarır, kükrerken ağız parlar
  if (P.coil > 0.05) { const [cx, cy] = R.at('chest'); glow(cx, cy, 'rgba(255,150,50,0.8)', Math.round(8 + P.coil * 12), P.coil * 0.8); }
  if (P.roar > 0.05) { const [mx, my] = R.at('mouth'); glow(mx, my, 'rgba(255,170,60,0.8)', 12, P.roar); }
  return true;
}
