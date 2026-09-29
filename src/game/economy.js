// Harcama: yükseltmeler, kazma/silah türleri, aletler, üretim, perk'ler.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_ROW } from '../config.js';
import { T } from '../data/tiles.js';
import { UPGRADES, BUILDS, PERKS, ITEMS, MODS, DEPLOY_MAX, WEAPONS, PICK_TYPES } from '../data/balance.js';
import { G, App } from './state.js';
import { tileAt } from '../world/map.js';
import { makeStructure, recompute, hasPerk, isUnlocked, isLocal, modSlots, teamHas } from './run.js';
import { sparks, ring, dust } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

export function canAfford(cost) { for (const k in cost) if ((G.store[k] || 0) < cost[k]) return false; return true; }
function pay(cost) { for (const k in cost) G.store[k] -= cost[k]; emit('store'); }

export function upgradeCost(key) {
  const u = UPGRADES[key], l = G.lvl[key];
  return l < u.costs.length ? u.costs[l] : null;
}
export function buyUpgrade(key, p = G.player) {
  const c = upgradeCost(key);
  if (!c || !canAfford(c)) { if (isLocal(p)) sfx.deny(); return false; }
  pay(c); G.lvl[key]++; recompute();
  sfx.buy(); if (isLocal(p)) haptic(15);
  ring(p.x, p.y, '#f2c14e', 18); sparks(p.x, p.y, '#ffe79a', 10, 70);
  if (key === 'drill') emit('pickTier', G.lvl.drill);
  emit('upgraded', key);
  return true;
}

// Blaster eklentileri: satın al (bir kez), tak/çıkar (yuva sınırı)
export function buyMod(k, p = G.player) {
  const m = MODS[k];
  if (!m || G.gear.owned.includes(k) || !canAfford(m.cost)) { if (isLocal(p)) sfx.deny(); return false; }
  pay(m.cost); G.gear.owned.push(k);
  if (G.gear.eq.length < modSlots()) G.gear.eq.push(k);
  sfx.buy(); if (isLocal(p)) haptic(15);
  ring(p.x, p.y, '#9fe8ff', 18); sparks(p.x, p.y, '#bff4ff', 10, 70);
  emit('modChanged', k);
  return true;
}
export function toggleMod(k, p = G.player) {
  if (!G.gear.owned.includes(k)) return false;
  const i = G.gear.eq.indexOf(k);
  if (i >= 0) G.gear.eq.splice(i, 1);
  else { if (G.gear.eq.length >= modSlots()) { if (isLocal(p)) sfx.deny(); return false; } G.gear.eq.push(k); }
  sfx.click(); emit('modChanged', k);
  return true;
}

// Kazma/silah türü: sahip değilse satın al (ekip), sonra komutu veren madenciye tak
export function gearPick(kind, k, p = G.player) {
  const w = kind === 'w', D = w ? WEAPONS : PICK_TYPES, own = w ? G.gear.wOwn : G.gear.pOwn, d = D[k];
  if (!d) return false;
  if (!own.includes(k)) {
    if (!d.cost || !canAfford(d.cost)) { if (isLocal(p)) sfx.deny(); return false; }
    pay(d.cost); own.push(k);
    sfx.buy(); if (isLocal(p)) haptic(15);
    ring(p.x, p.y, w ? '#9fe8ff' : '#f2c14e', 18); sparks(p.x, p.y, w ? '#bff4ff' : '#ffe79a', 10, 70);
  } else sfx.click();
  if (w) { p.wpn = k; p.fireCd = Math.max(p.fireCd, 0.2); } else { p.pk = k; p.dig = null; }
  emit('gearChanged', { kind, k, pi: p.i });
  return true;
}

export function deployLimit() { return DEPLOY_MAX + (hasPerk('ucuncuAlet') ? 1 : 0) + (teamHas('muhendis') ? 1 : 0); }
// aleti durduğun hücreye kur; sınır doluysa en eski alet kemere geri döner
export function placeBuild(type, p = G.player) {
  if (!BUILDS[type] || p.dead || (G.items[type] | 0) <= 0) return false;
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
  if (tileAt(c, r) !== T.AIR) { if (isLocal(p)) sfx.deny(); return false; }
  if (G.structures.some(s => s.c === c && s.r === r)) { if (isLocal(p)) sfx.deny(); return false; }
  while (G.structures.length >= deployLimit()) {
    const old = G.structures.shift();
    if ((G.items[old.type] | 0) < ITEMS[old.type].max) G.items[old.type]++;
    dust(old.x, old.y, 3); emit('toast', { text: old.type === type ? 'Eski alet kemere döndü' : BUILDS[old.type].name + ' kemere döndü', icon: BUILDS[old.type].icon });
  }
  G.items[type]--;
  const s = makeStructure(type, c, r);
  G.structures.push(s);
  sfx.build(); if (isLocal(p)) haptic(20);
  dust(s.x, s.y, 5); sparks(s.x, s.y, '#ffe79a', 8, 60);
  emit('deployed', type);
  return true;
}
// aleti geri al (dokunarak): kemere döner
export function pickupBuild(i, p = G.player) {
  const s = G.structures[i];
  if (!s || p.dead || Math.hypot(s.x - p.x, s.y - p.y) > 40) return false;
  G.structures.splice(i, 1);
  if ((G.items[s.type] | 0) < ITEMS[s.type].max) G.items[s.type]++;
  sfx.click(); if (isLocal(p)) haptic(10);
  dust(s.x, s.y, 3); sparks(s.x, s.y, '#ffe79a', 5, 40);
  emit('deployed', s.type);
  return true;
}

// Üretim: kaynak -> kemerdeki eşya
export function craftState(key) {
  const d = ITEMS[key];
  if (!d || !isUnlocked(key)) return 'locked';
  if (G.items[key] >= d.max) return 'full';
  return canAfford(d.cost) ? 'ok' : 'poor';
}
export function craftItem(key, p = G.player) {
  if (craftState(key) !== 'ok') { if (isLocal(p)) sfx.deny(); return false; }
  pay(ITEMS[key].cost); G.items[key]++; G.stats.crafted++;
  sfx.craft(); if (isLocal(p)) haptic(12);
  emit('crafted', key);
  return true;
}
export function perkChoices() {
  const n = (G.meta.lv.kalintiBil ? 4 : 3);
  const pool = Object.keys(PERKS).filter(k => !G.perks.includes(k));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
export function applyPerk(k, p = G.player) {
  if (G.perks.includes(k) || !PERKS[k]) return false;
  G.perks.push(k);
  if (k === 'ikinciNefes') G.selfRevive++;
  if (k === 'hazineKokusu') for (let i = 0; i < G.map.length; i++) if (G.map[i] === T.CHEST) G.rev[i] = 1;
  recompute();
  ring(p.x, p.y, '#ffd24a', 24); sparks(p.x, p.y, '#ffd24a', 14, 90);
  sfx.buy();
  G.perkOffer = null;
  emit('perkTaken', { k, pi: p.i });
  return true;
}
