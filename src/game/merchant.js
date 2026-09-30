// Gezgin tüccar: arada kampa uğrar, kısa süre kalır, altınla üç şey satar (bir kalıntı, bir eşya dolumu, bir nadir mal).
// Deterministik: varış zamanı ve mallar simülasyon RNG'sinden, satın alma komutla.
import { rnd } from '../core/rng.js';
import { GROUND_Y } from '../config.js';
import { ITEMS, ITEM_KEYS, MODS, MOD_KEYS, MERCHANT } from '../data/balance.js';
import { PERKS, PERK_KEYS, maxLv } from '../data/relics.js';
import { G } from './state.js';
import { isUnlocked, perkLv, isLocal } from './run.js';
import { applyPerk } from './economy.js';
import { itemMax } from './chests.js';
import { sfx } from '../audio/audio.js';
import { emit } from '../core/events.js';

const pick = a => a.length ? a[Math.floor(rnd() * a.length)] : null;

function stock() {
  const out = [];
  const soy = PERK_KEYS.filter(k => { const d = PERKS[k]; return d.soy && !d.duo && !d.leg && !d.curse && !(d.mp && !G.mp) && perkLv(k) < maxLv(k); });
  const r = pick(soy);
  if (r) out.push({ k: 'perk', id: r, cost: MERCHANT.relic + MERCHANT.relicStep * G.perks.length });
  const it = pick(ITEM_KEYS.filter(k => !ITEMS[k].build && isUnlocked(k)));
  if (it) out.push({ k: 'item', id: it, cost: MERCHANT.item });
  const leg = rnd() < MERCHANT.legChance ? pick(PERK_KEYS.filter(k => PERKS[k].leg && !G.perks.includes(k))) : null;
  if (leg) out.push({ k: 'perk', id: leg, cost: MERCHANT.leg });
  else { const m = pick(MOD_KEYS.filter(k => !G.gear.owned.includes(k))); if (m) out.push({ k: 'mod', id: m, cost: MERCHANT.mod }); }
  return out;
}

export function updateMerchant(dt) {
  if (G.tutorial) return;
  const M = G.merchant;
  if (!M) {
    G.merchT = (G.merchT ?? MERCHANT.first) - dt;
    if (G.merchT <= 0) { G.merchant = { t: MERCHANT.stay, goods: stock(), warned: false }; emit('merchant', true); }
    return;
  }
  M.t -= dt;
  if (!M.warned && M.t <= 20) { M.warned = true; emit('merchantSoon'); }
  if (M.t <= 0) { G.merchant = null; G.merchT = MERCHANT.every + Math.floor(rnd() * MERCHANT.jitter); emit('merchant', false); }
}

export function buyMerch(p, i) {
  const M = G.merchant, g = M && M.goods[i];
  if (!g || g.sold || p.dead || p.y >= GROUND_Y || (G.store.gold | 0) < g.cost) { if (isLocal(p)) sfx.deny(); return false; }
  if (g.k === 'perk') { const off = G.perkOffer; if (!applyPerk(g.id, p)) return false; G.perkOffer = off; }
  else if (g.k === 'item') { if ((G.items[g.id] | 0) >= itemMax(g.id)) { if (isLocal(p)) sfx.deny(); return false; } G.items[g.id] = itemMax(g.id); sfx.buy(); }
  else { G.gear.owned.push(g.id); sfx.buy(); }
  G.store.gold -= g.cost; g.sold = true;
  emit('store'); emit('merchBuy', { i, pi: p.i });
  return true;
}

export const goodInfo = g => g.k === 'perk' ? PERKS[g.id] : g.k === 'item' ? ITEMS[g.id] : MODS[g.id];
