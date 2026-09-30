// Şans kuyusu: kampta, sikke atılır; sikke suya düşünce kuyu bir ödül verir (deterministik: rnd + komut).
import { rnd } from '../core/rng.js';
import { GROUND_Y, BASE_X } from '../config.js';
import { WELL, ITEMS, ITEM_KEYS } from '../data/balance.js';
import { G } from './state.js';
import { isUnlocked, isLocal } from './run.js';
import { itemMax, offer, perkChoices } from './chests.js';
import { sfx } from '../audio/audio.js';
import { emit } from '../core/events.js';

export const WELL_X = BASE_X + 46;
export const wellCost = () => WELL.cost + WELL.step * (G.wishes | 0);
export const nearWell = p => !p.dead && !p.ride && p.y < GROUND_Y && Math.abs(p.x - WELL_X) <= WELL.near;

// ödül tablosu: [ağırlık, üretici]
function roll() {
  const deep = G.maxStratum | 0, r = rnd() * 100;
  if (r < 30) { const id = ['iron', 'water', 'cobalt'][Math.floor(rnd() * 3)]; return { k: 'res', id, n: 8 + Math.floor(rnd() * 8) + deep * 2 }; }
  if (r < 52) return { k: 'gold', n: wellCost() * 2 };
  if (r < 67) { const ks = ITEM_KEYS.filter(k => !ITEMS[k].build && isUnlocked(k) && (G.items[k] | 0) < itemMax(k)); if (ks.length) return { k: 'item', id: ks[Math.floor(rnd() * ks.length)] }; return { k: 'gold', n: wellCost() }; }
  if (r < 80) return { k: 'res', id: 'crystal', n: 3 + Math.floor(rnd() * 4) + deep };
  if (r < 93) return { k: 'heal' };
  return { k: 'chest' };
}

export function wish(p) {
  const c = wellCost();
  if (!nearWell(p) || G.wish || (G.store.gold | 0) < c) { if (isLocal(p)) sfx.deny(); return false; }
  G.store.gold -= c; G.wishes = (G.wishes | 0) + 1;
  G.wish = { t: WELL.delay, pi: p.i, got: roll(), x: p.x };
  emit('store'); emit('wishThrow', { pi: p.i });
  return true;
}

export function updateWell(dt) {
  const W = G.wish; if (!W) return;
  W.t -= dt; if (W.t > 0) return;
  G.wish = null;
  const p = G.players[W.pi] || G.player, g = W.got;
  if (g.k === 'res' || g.k === 'gold') { const id = g.k === 'gold' ? 'gold' : g.id; G.store[id] += g.n; G.collected[id] += g.n; emit('storePop', id); }
  else if (g.k === 'item') G.items[g.id] = Math.min(itemMax(g.id), (G.items[g.id] | 0) + 1);
  else if (g.k === 'heal') { p.hp = p.maxHp; p.hasteT = Math.max(p.hasteT | 0, 6); }
  else if (g.k === 'chest') offer(p, 'wood', perkChoices('wood'));
  emit('store'); emit('wishDone', { pi: W.pi, got: g });
}
