// Harcama: yükseltmeler, kazma/silah türleri, aletler, üretim, perk'ler.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_ROW } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { applyOffer, itemMax } from './chests.js';
import { UPGRADES, BUILDS, PERKS, ITEMS, MODS, DEPLOY_MAX, WEAPONS, PICK_TYPES, RES_KEYS, MAT_KEYS, FORGE, SCHEMATICS, TOOL_UP, ITEM_SCALE, beaconReq, ITEM_KEYS } from '../data/balance.js';
import { G, App } from './state.js';
import { tileAt } from '../world/map.js';
import { makeStructure, recompute, hasPerk, isUnlocked, isLocal, toolLvl, perkLv, resonance, forgeLv } from './run.js';
import { maxLv } from '../data/relics.js';
import { sparks, ring, dust, flashLight } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

export function canAfford(cost) { for (const k in cost) if ((G.store[k] || 0) < cost[k]) return false; return true; }
function pay(cost) { for (const k in cost) G.store[k] -= cost[k]; emit('store'); }

export function upgradeCost(key) {
  const u = UPGRADES[key], l = G.lvl[key];
  return l < u.costs.length ? u.costs[l] : null;
}
// Fener kilidi: bu seviye için gereken ve eksik Fener sayısı (0: açık)
export function beaconLack(key) { return G.testUnlock ? 0 : Math.max(0, beaconReq(key, G.lvl[key]) - G.beacons.length); }
export function buyUpgrade(key, p = G.player) {
  const c = upgradeCost(key);
  if (!c || !canAfford(c) || beaconLack(key) > 0) { if (isLocal(p)) sfx.deny(); return false; }
  pay(c); G.lvl[key]++; recompute();
  sfx.buy(); if (isLocal(p)) haptic(15);
  ring(p.x, p.y, '#f2c14e', 18); sparks(p.x, p.y, '#ffe79a', 10, 70);
  if (key === 'drill') emit('pickTier', G.lvl.drill);
  emit('upgraded', key);
  return true;
}

// Silah eklentileri: bir kez alınır, alındığı andan itibaren çalışır
export function buyMod(k, p = G.player) {
  const m = MODS[k];
  if (!m || G.gear.owned.includes(k) || !canAfford(m.cost)) { if (isLocal(p)) sfx.deny(); return false; }
  pay(m.cost); G.gear.owned.push(k);
  sfx.buy(); if (isLocal(p)) haptic(15);
  ring(p.x, p.y, '#9fe8ff', 18); sparks(p.x, p.y, '#bff4ff', 10, 70);
  emit('modChanged', k);
  return true;
}

// Kazma/silah türü: sahip değilse satın al (ekip), sonra komutu veren madenciye tak
// alet seviyesi: ekip ortak, her alet kendi seviyesini alır
export function toolUpCost(k) { const l = toolLvl(k); return BUILDS[k] && isUnlocked(k) && l < TOOL_UP.max ? TOOL_UP.costs[l] : null; }
export function levelUp(k, p = G.player) {
  const c = toolUpCost(k);
  if (!c || !canAfford(c)) { if (isLocal(p)) sfx.deny(); return false; }
  pay(c); G.gear.tLvl[k] = (G.gear.tLvl[k] | 0) + 1;
  for (const s of G.structures) if (s.type === k) { const m = makeStructure(k, s.c, s.r).maxHp; s.hp += m - s.maxHp; s.maxHp = m; }
  sfx.buy(); if (isLocal(p)) haptic(15);
  ring(p.x, p.y, '#ffd24a', 20); sparks(p.x, p.y, '#ffe79a', 12, 80);
  emit('gearChanged', { kind: 'tl', k, pi: p.i });
  return true;
}

// Tezgâh: silah (w), kazma (p) ya da zırhı (a) bir kademe döv
export function forgeCost(k) { return FORGE[k] && FORGE[k].steps && forgeLv(k) < FORGE.costs.length ? FORGE.costs[forgeLv(k)] : null; }
export function forgeUp(k, p = G.player) {
  const c = forgeCost(k);
  if (!c || !canAfford(c)) { if (isLocal(p)) sfx.deny(); return false; }
  pay(c); G.gear.forge[k] = forgeLv(k) + 1; recompute();
  sfx.craft(); sfx.buy(); if (isLocal(p)) haptic([20, 40, 30]);
  ring(p.x, p.y, '#ffd24a', 30); ring(p.x, p.y, '#ffffff', 18); sparks(p.x, p.y - 4, '#ffe79a', 22, 120); flashLight(p.x, p.y, 6, 0.5);
  emit('forged', { k, lv: G.gear.forge[k], pi: p.i });
  return true;
}

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

// test: sınırsız cevher + tüm şemalar (yalnız bu sefer)
export const TEST_FUNDS = 99999;
export function testFunds(p = G.player) {
  for (const k of RES_KEYS.concat(MAT_KEYS)) G.store[k] = TEST_FUNDS;
  G.testUnlock = true;
  G.meta.schem = SCHEMATICS.map(s => s.key);
  sfx.buy(); ring(p.x, p.y, '#f2c14e', 22);
  emit('store'); emit('gearChanged', { kind: 'test', pi: p.i });
  return true;
}

export function deployLimit() { return DEPLOY_MAX + (hasPerk('aletUstasi') ? 1 : 0); }
// aleti durduğun hücreye kur; sınır doluysa en eski alet kemere geri döner. Tek kullanımlık alet (Sondaj Matkabı) sınıra sayılmaz, aynı anda bir tane çalışır
export function placeBuild(type, p = G.player) {
  const b = BUILDS[type];
  if (!b || p.dead || (G.items[type] | 0) <= 0) return false;
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
  if (tileAt(c, r) !== T.AIR) { if (isLocal(p)) sfx.deny(); return false; }
  if (G.structures.some(s => s.c === c && s.r === r)) { if (isLocal(p)) sfx.deny(); return false; }
  if (b.once && G.structures.some(s => s.type === type)) { if (isLocal(p)) sfx.deny(); return false; }
  G.items[type]--;
  for (const kept = G.structures.filter(s => !BUILDS[s.type].once); !b.once && kept.length >= deployLimit();) {
    const old = kept.shift(); G.structures.splice(G.structures.indexOf(old), 1);
    G.items[old.type] = Math.min(itemMax(old.type), (G.items[old.type] | 0) + 1);
    dust(old.x, old.y, 3); emit('toast', { text: old.type === type ? 'Eski alet kemere döndü' : BUILDS[old.type].name + ' kemere döndü', icon: BUILDS[old.type].icon });
  }
  const s = makeStructure(type, c, r, p.i);
  G.structures.push(s);
  sfx.build(); if (isLocal(p)) haptic(20);
  dust(s.x, s.y, 5); sparks(s.x, s.y, '#ffe79a', 8, 60);
  emit('deployed', type);
  return true;
}
// aleti geri al (dokunarak): kemere döner
export function pickupBuild(i, p = G.player) {
  const s = G.structures[i];
  if (!s || BUILDS[s.type].once || p.dead || Math.hypot(s.x - p.x, s.y - p.y) > 40) return false;
  if ((G.items[s.type] | 0) >= itemMax(s.type)) { if (isLocal(p)) { sfx.deny(); emit('toast', { text: 'Kemer dolu: alet yerinde kaldı', icon: BUILDS[s.type].icon, bad: true }); } return false; }
  G.structures.splice(i, 1);
  if ((G.items[s.type] | 0) < itemMax(s.type)) G.items[s.type]++;
  sfx.click(); if (isLocal(p)) haptic(10);
  dust(s.x, s.y, 3); sparks(s.x, s.y, '#ffe79a', 5, 40);
  emit('deployed', s.type);
  return true;
}

// Üretim: kaynak -> kemerdeki eşya
// üretim fiyatı ulaşılan en derin biyomla artar
export function itemCost(key) {
  const c = ITEMS[key].cost, m = 1 + (ITEMS[key].scale ?? ITEM_SCALE) * (G.maxStratum | 0), out = {};
  for (const k in c) out[k] = Math.ceil(c[k] * m);
  return out;
}
export function craftState(key) {
  const d = ITEMS[key];
  if (!d || !isUnlocked(key)) return 'locked';
  if (G.items[key] >= itemMax(key)) return 'full';
  return canAfford(itemCost(key)) ? 'ok' : 'poor';
}
export function craftItem(key, p = G.player) {
  if (craftState(key) !== 'ok') { if (isLocal(p)) sfx.deny(); return false; }
  pay(itemCost(key)); G.items[key]++; G.stats.crafted++;
  sfx.craft(); if (isLocal(p)) haptic(12);
  emit('crafted', key);
  return true;
}
export function applyPerk(k, p = G.player) {
  if (k.includes(':')) { if (!applyOffer(k, p)) return false; G.perkOffer = null; sfx.buy(); ring(p.x, p.y, '#ffd24a', 24); sparks(p.x, p.y, '#ffd24a', 14, 90); emit('perkTaken', { k, pi: p.i }); return true; }
  if (!PERKS[k]) return false;
  // sahip olduğun kalıntı yeniden seçilirse seviyesi artar
  if (G.perks.includes(k)) {
    const l = perkLv(k); if (l >= maxLv(k)) return false;
    G.perkLv[k] = l + 1;
  } else {
    const soy = PERKS[k].soy, had = soy ? resonance(soy) : true;
    G.perks.push(k); G.perkLv[k] = 1;
    if (!had && resonance(soy)) emit('resonance', { soy, pi: p.i });
  }
  if (k === 'ikinciNefes') G.selfRevive++;
  if (k === 'bolKemer') for (const q of ITEM_KEYS) if (isUnlocked(q)) G.items[q] = Math.min(itemMax(q), (G.items[q] | 0) + 1);
  recompute();
  ring(p.x, p.y, '#ffd24a', 24); sparks(p.x, p.y, '#ffd24a', 14, 90);
  sfx.buy();
  G.perkOffer = null;
  emit('perkTaken', { k, pi: p.i });
  return true;
}
