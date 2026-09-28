// Harcama: yükseltmeler, yapılar, barikatlar, onarım, perk'ler.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_ROW } from '../config.js';
import { T } from '../data/tiles.js';
import { UPGRADES, BUILDS, BARRICADE, PERKS, ITEMS, MODS, DEPLOY_MAX } from '../data/balance.js';
import { G, App } from './state.js';
import { tileAt, setTile, idx } from '../world/map.js';
import { makeStructure, recompute, hasPerk, isUnlocked, isLocal, modSlots } from './run.js';
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

export function deployLimit() { return DEPLOY_MAX + (hasPerk('ucuncuAlet') ? 1 : 0); }
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
  if (!isUnlocked(key)) return 'locked';
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
// Barikatı oyuncunun baktığı boş hücreye, yoksa arkasına koy
export function barricadeTarget(p = G.player) {
  if (p.dead || G.items.barricade <= 0 || p.y < GROUND_ROW * TILE) return null;
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
  const vert = Math.abs(p.dy) >= Math.abs(p.dx);
  const fx = vert ? 0 : Math.sign(p.dx) || p.face, fy = vert ? Math.sign(p.dy) || 1 : 0;
  for (const [dc, dr] of [[fx, fy], [-fx, -fy]]) {
    const tc = c + dc, tr = r + dr;
    if (tr < GROUND_ROW) continue;
    if (tileAt(tc, tr) !== T.AIR) continue;
    if (G.enemies.some(e => Math.floor(e.x / TILE) === tc && Math.floor(e.y / TILE) === tr)) continue;
    return { c: tc, r: tr };
  }
  return null;
}
export function placeBarricade(p = G.player) {
  const t = barricadeTarget(p);
  if (!t) { if (isLocal(p)) sfx.deny(); return false; }
  setTile(t.c, t.r, T.BARRICADE); G.bhp[idx(t.c, t.r)] = BARRICADE.hp;
  G.items.barricade--;
  sfx.build(); if (isLocal(p)) haptic(20); dust(t.c * TILE + 8, t.r * TILE + 8, 4);
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
  recompute();
  ring(p.x, p.y, '#ffd24a', 24); sparks(p.x, p.y, '#ffd24a', 14, 90);
  sfx.buy();
  G.perkOffer = null;
  emit('perkTaken', { k, pi: p.i });
  return true;
}
