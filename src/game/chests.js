// Sandıklar: türüne göre kalıntı seçimi, silah teklifi, cevher yağmuru, erzak, lanet ya da taklitçi.
// Teklif anahtarları: kalıntı adı ya da 'w:<silah>' (silah türü), 'wl:<silah>' (+2 ustalık), 'm:<eklenti>', 'tl:<alet>' (+2 seviye)
import { rnd } from '../core/rng.js';
import { TILE, stratumOfRow } from '../config.js';
import { PERKS, CHESTS, WEAPONS, WEAPON_KEYS, WEAPON_UP, MODS, MOD_KEYS, TOOL_UP, BUILD_KEYS, BUILDS, ITEMS, DEEP_ORES, PERK_TIER } from '../data/balance.js';
import { G } from './state.js';
import { hasPerk, isUnlocked, modSlots, isLocal } from './run.js';
import { spawnOrb } from './player.js';
import { spawnEnemy, makeElite } from './enemies.js';
import { addNoise } from './threat.js';
import { sparks, ring, flashLight, shake, dust } from './fx.js';
import { sfx } from '../audio/audio.js';
import { emit } from '../core/events.js';

export function itemMax(k) { return ITEMS[k].max + (hasPerk('bolKemer') ? 2 : 0); }

// kalıntı seçenekleri: sandığın kademe ağırlıklarıyla, alınmamışlardan
export function perkChoices(type = 'wood') {
  const C = CHESTS[type] || CHESTS.wood;
  const kis = hasPerk('kismet');
  let n = (C.n || 3) + (G.meta.lv.kalintiBil ? 1 : 0) + (kis ? 1 : 0);
  const w = C.tiers.slice(); if (kis) { w[0] *= 0.5; w[2] += 0.15; }
  const pool = Object.keys(PERKS).filter(k => !G.perks.includes(k) && (!PERKS[k].mp || G.mp));
  const out = [];
  while (out.length < n && pool.length) {
    // önce kademe, o kademede kalıntı yoksa bir alttaki/üstteki
    let r = rnd() * (w[0] + w[1] + w[2]), t = r < w[0] ? 1 : r < w[0] + w[1] ? 2 : 3;
    let cand = pool.filter(k => PERKS[k].t === t);
    for (let d = 1; !cand.length && d < 3; d++) cand = pool.filter(k => Math.abs(PERKS[k].t - t) === d);
    const k = cand[Math.floor(rnd() * cand.length)];
    out.push(k); pool.splice(pool.indexOf(k), 1);
  }
  return out;
}

// Silah Sandığı: sahip olmadığın silah, sahip olduğun silaha ustalık, eklenti ya da alet seviyesi
function armsChoices(n) {
  const g = G.gear, opts = [];
  for (const k of WEAPON_KEYS) if (!g.wOwn.includes(k)) opts.push('w:' + k);
  for (const k of g.wOwn) if ((g.wLvl[k] | 0) < WEAPON_UP.max) opts.push('wl:' + k);
  for (const k of MOD_KEYS) if (!g.owned.includes(k)) opts.push('m:' + k);
  for (const k of BUILD_KEYS) if (isUnlocked(k) && (g.tLvl[k] | 0) < TOOL_UP.max) opts.push('tl:' + k);
  const out = [];
  while (out.length < n && opts.length) out.push(opts.splice(Math.floor(rnd() * opts.length), 1)[0]);
  return out;
}

// teklifin görünümü (UI)
export function offerInfo(k) {
  if (PERKS[k]) return { name: PERKS[k].name, desc: PERKS[k].desc, icon: PERKS[k].icon, t: PERKS[k].t, tag: PERK_TIER[PERKS[k].t] };
  const [a, b] = k.split(':');
  if (a === 'w') return { name: WEAPONS[b].name, desc: 'Bedava silah: ' + WEAPONS[b].desc, icon: WEAPONS[b].icon, t: 2, tag: 'SİLAH' };
  if (a === 'wl') return { name: WEAPONS[b].name + ' +2', desc: `Ustalık iki seviye artar (hasar +%${WEAPON_UP.dmg * 200}, atış hızı +%${WEAPON_UP.cd * 200}).`, icon: WEAPONS[b].icon, t: 2, tag: 'USTALIK' };
  if (a === 'm') return { name: MODS[b].name, desc: 'Bedava eklenti: ' + MODS[b].desc, icon: MODS[b].icon, t: 1, tag: 'EKLENTİ' };
  if (a === 'tl') return { name: BUILDS[b].name + ' +2', desc: `Alet iki seviye artar (hasar +%${TOOL_UP.dmg * 200}, dayanıklılık +%${TOOL_UP.hp * 200}).`, icon: BUILDS[b].icon, t: 2, tag: 'ALET' };
  return { name: k, desc: '', icon: 'chest', t: 1, tag: '' };
}

// silah sandığı teklifini uygula
export function applyOffer(k, p) {
  const g = G.gear, [a, b] = k.split(':');
  if (a === 'w' && WEAPONS[b] && !g.wOwn.includes(b)) { g.wOwn.push(b); p.wpn = b; }
  else if (a === 'wl' && g.wOwn.includes(b)) g.wLvl[b] = Math.min(WEAPON_UP.max, (g.wLvl[b] | 0) + 2);
  else if (a === 'm' && MODS[b] && !g.owned.includes(b)) { g.owned.push(b); if (g.eq.length < modSlots()) g.eq.push(b); emit('modChanged', b); }
  else if (a === 'tl' && BUILDS[b]) g.tLvl[b] = Math.min(TOOL_UP.max, (g.tLvl[b] | 0) + 2);
  else return false;
  emit('gearChanged', { kind: 'chest', k, pi: p.i });
  return true;
}

function offer(p, type, keys) {
  if (keys.length) { G.perkOffer = { pi: p.i, keys, chest: type }; emit('perkOffer', p.i); }
  else if (isLocal(p)) emit('toast', { text: CHESTS[type].name + ' boş çıktı', icon: 'chest' });
}
// derinliğe göre değerli cevher karışımı
function oreRain(x, y, n, st) {
  const mix = st >= 8 ? ['crystal', 'gold', 'gold', 'cobalt'] : st >= 4 ? ['gold', 'cobalt', 'crystal', 'iron'] : ['iron', 'cobalt', 'water', 'gold'];
  for (let i = 0; i < n; i++) spawnOrb(x, y, mix[Math.floor(rnd() * mix.length)]);
}

export function openChest(p, type, x, y, c, r) {
  const C = CHESTS[type] || CHESTS.wood, st = Math.max(0, stratumOfRow(r)), local = isLocal(p);
  if (C.mimic) {
    // Taklitçi: sandık değil! Uyanır ve saldırır; ölünce gerçek bir sandık teklifi bırakır
    const e = spawnEnemy('mimic', x, y, 2); e.emergeT = 0.15; e.chest = C.mimic;
    ring(x, y, '#ff5a4a', 22); sparks(x, y, '#ff5a4a', 12, 100); shake(0.3); sfx.alarm();
    if (local) emit('toast', { text: 'Taklitçi! Sandık diye ısırdı', icon: 'skull', bad: true });
    return;
  }
  G.stats.chests++;
  ring(x, y, '#ffd24a', 22); flashLight(x, y, 5, 0.5);
  const deep = DEEP_ORES[Math.min(DEEP_ORES.length - 1, Math.floor(st / 4))];
  if (C.ore) { oreRain(x, y, C.ore + st * (C.n ? 1 : 2), st); for (let i = 0; i < (C.n ? 1 : 3); i++) spawnOrb(x, y, deep); }
  if (C.gold) for (let i = 0; i < C.gold + (st >> 1); i++) spawnOrb(x, y, 'gold');
  if (C.supply) {
    // Erzak: kemeri doldurur, ekibi iyileştirir
    for (const k of ['medkit', 'dynamite', 'kalkan', 'sonar']) if (isUnlocked(k)) G.items[k] = Math.max(G.items[k] | 0, Math.min(itemMax(k), (G.items[k] | 0) + 2));
    for (const q of G.players) if (!q.dead) q.hp = Math.min(q.maxHp, q.hp + q.maxHp * 0.5);
    ring(x, y, '#5fe0b8', 30); sparks(x, y, '#a8f5dc', 14, 90);
    if (local) emit('toast', { text: 'Erzak: kemer doldu, can yenilendi', icon: 'medkit' });
    return;
  }
  if (C.curse) {
    // Lanet: güçlü kalıntılar, ama bekçiler uyanır
    for (let i = 0; i < C.curse; i++) {
      const a = i / C.curse * Math.PI * 2, e = spawnEnemy(['brute', 'bug', 'spitter'][i % 3], x + Math.cos(a) * 18, y + Math.sin(a) * 10, 3);
      e.emergeT = 1 + i * 0.3; makeElite(e);
    }
    addNoise(30, x, y); dust(x, y, 6, 'rgba(120,40,120,0.6)'); ring(x, y, '#b040ff', 40); shake(0.4); sfx.alarm();
    if (local) emit('toast', { text: 'Lanet: bekçiler uyandı', icon: 'skull', bad: true });
  }
  if (C.arms) { offer(p, type, armsChoices(C.n)); return; }
  if (C.tiers) offer(p, type, perkChoices(type));
  else if (local) emit('toast', { text: CHESTS[type].name + ' açıldı', icon: 'chest' });
}

// Taklitçi öldü: gerçek sandık teklifi en yakın madenciye
export function mimicDown(e) {
  let best = null, bd = 1e9;
  for (const q of G.players) if (!q.dead) { const d = Math.hypot(q.x - e.x, q.y - e.y); if (d < bd) { bd = d; best = q; } }
  for (let i = 0; i < 6; i++) spawnOrb(e.x, e.y, 'gold', true);
  if (best) offer(best, e.chest || 'iron', perkChoices(e.chest || 'iron'));
}
