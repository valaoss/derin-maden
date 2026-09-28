// Maden kanaryası (kozmetik + bildirim; simülasyonu etkilemez): yerel oyuncuyu izler,
// yakındaki gizli yuvayı sezer, gürültü bir eşiğe yaklaşınca öter.
import { TILE, GROUND_Y } from '../config.js';
import { G } from './state.js';
import { sfx } from '../audio/audio.js';
import { emit } from '../core/events.js';

export const canary = { on: false, x: 0, y: 0, flap: 0, target: null, warn: 0, seen: null };
const SENSE = 11 * TILE, WARNS = [20, 45, 70];

export function updateCanary(dt) {
  const p = G.player;
  const on = !!(p && G.meta && G.meta.lv && G.meta.lv.kanarya);
  if (on && !canary.on) { canary.x = p.x; canary.y = p.y - 14; canary.warn = 0; canary.seen = null; }
  canary.on = on;
  if (!on) return;
  const tx = p.x - p.face * 9 + Math.sin(G.time * 1.7) * 3, ty = p.y - 15 + Math.sin(G.time * 2.3) * 1.5;
  const k = 1 - Math.exp(-6 * dt);
  canary.x += (tx - canary.x) * k; canary.y += (ty - canary.y) * k;
  canary.flap += dt * 14;
  // yuva sezme (haritada açığa çıkmamış olsa da)
  let best = null, bd = SENSE;
  for (const n of G.nests) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < bd) { bd = d; best = n; } }
  canary.target = best;
  if (best && best !== canary.seen) { canary.seen = best; sfx.chirp(); emit('toast', { text: 'Kanarya huzursuz: yakında bir yuva var', icon: 'wave' }); }
  if (!best) canary.seen = null;
  // gürültü eşiği uyarısı
  const nz = G.threat.noise;
  while (canary.warn > 0 && nz < WARNS[canary.warn - 1] - 8) canary.warn--;
  if (canary.warn < WARNS.length && nz >= WARNS[canary.warn]) {
    canary.warn++;
    if (p.y >= GROUND_Y) { sfx.chirp(); emit('toast', { text: 'Kanarya ötüyor: gürültü eşiğe yaklaştı', icon: 'wave', bad: true }); }
  }
}
