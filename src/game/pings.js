// Partner işaretleri: basılı tut (ya da sağ tık) -> dünyada işaret; partnerin ekranında ok ve ses. Oyuncu başına tek işaret.
import { G } from './state.js';
import { ring, sparks } from './fx.js';
import { emit } from '../core/events.js';

export function addPing(pi, x, y) {
  const p = G.players[pi]; if (!p) return false;
  G.pings = G.pings.filter(q => q.pi !== pi);
  G.pings.push({ pi, x, y, t: 7, born: 0 });
  ring(x, y, '#ffe79a', 12); sparks(x, y, '#ffe79a', 6, 50);
  emit('ping', { pi, x, y });
  return true;
}
export function updatePings(dt) {
  let j = 0;
  for (const q of G.pings) { q.t -= dt; q.born += dt; if (q.t > 0) G.pings[j++] = q; }
  G.pings.length = j;
}
