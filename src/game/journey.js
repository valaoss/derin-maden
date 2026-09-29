// Sefer haritası kaydı: oyuncu izleri ve önemli anlar (yalnız sonuç ekranı için okunur, simülasyonu etkilemez).
// Koordinatlar yarım-tile, zaman desisaniye.
import { G } from './state.js';
import { TILE } from '../config.js';

const MAX_PTS = 5000;
export function makeJourney(n) { return { p: Array.from({ length: n }, () => []), m: [] }; }
const now = () => Math.round(G.stats.time * 10);
const half = v => Math.round(v / TILE * 2);

export function trackJourney() {
  const J = G.journey;
  if (!J) return;
  for (const p of G.players) {
    const a = J.p[p.i];
    if (!a || p.dead) continue;
    const x = half(p.x), y = half(p.y), l = a[a.length - 1];
    if (l && Math.abs(l[1] - x) + Math.abs(l[2] - y) < 3) continue;
    a.push([now(), x, y]);
    if (a.length > MAX_PTS) J.p[p.i] = a.filter((q, i) => i % 2 === 0 || i === a.length - 1);
  }
}
export function markJourney(k, x, y, pi = -1, extra = '') {
  if (G.journey) G.journey.m.push([k, now(), half(x), half(y), pi, extra]);
}
