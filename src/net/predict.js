// Yerel tahmin: planlanmış ama henüz simüle edilmemiş girdilerle yerel madenci ve kamera önden çizilir.
// Lockstep girdi gecikmesini (ping'e göre 3-16 kare) gözden gizler; simülasyona dokunmaz, yalnızca çizim.
import { STEP, TILE, WORLD_W } from '../config.js';
import { PLAYER } from '../data/balance.js';
import { G } from '../game/state.js';
import { net } from './lockstep.js';
import { moveAxis, playerSpeed } from '../game/player.js';
import { clamp } from '../core/util.js';

export const pred = { on: false, x: 0, y: 0, sx: 0, sy: 0 };
const HW = PLAYER.hitW / 2;

export function updatePrediction(dt) {
  const p = G.player;
  if (!(net.on && G.mp && p && !p.dead && !p.ride && !G.over)) { pred.on = false; return; }
  const t = { x: p.x, y: p.y };
  const sp = playerSpeed(p);
  for (let f = net.frame; f <= net.lastSched; f++) {
    const inp = net.local.get(f); if (!inp) break;
    const mag = inp.m / 127; if (mag < 0.05) continue;
    moveAxis(t, inp.x / 127 * sp * mag * STEP, 0);
    moveAxis(t, 0, inp.y / 127 * sp * mag * STEP);
    t.x = clamp(t.x, TILE * 2 + HW, WORLD_W - TILE * 2 - HW);
  }
  if (!pred.on || Math.hypot(pred.sx - t.x, pred.sy - t.y) > 24) { pred.sx = t.x; pred.sy = t.y; }
  pred.on = true; pred.x = t.x; pred.y = t.y;
  const k = 1 - Math.exp(-dt * 24);
  pred.sx += (t.x - pred.sx) * k; pred.sy += (t.y - pred.sy) * k;
}
