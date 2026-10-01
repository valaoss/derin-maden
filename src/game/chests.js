// Sandıklar: türüne göre kalıntı seçimi, silah teklifi, cevher yağmuru, erzak, lanet ya da taklitçi.
// Teklif anahtarları: kalıntı adı ya da 'w:<silah>' (silah türü), 'xl:1' (+1 silah seviyesi), 'm:<eklenti>', 'tl:<alet>' (+2 seviye),
// 'x:<kart>' (silah kartı), 'e:<silah>:<0|1>' (silah evrimi)
import { rnd } from '../core/rng.js';
import { TILE, stratumOfRow } from '../config.js';
import { CHESTS, WEAPONS, WEAPON_KEYS, CARDS, MODS, MOD_KEYS, TOOL_UP, BUILD_KEYS, BUILDS, ITEMS, DEEP_ORES } from '../data/balance.js';
import { PERKS, PERK_KEYS, SOY, RESONANCE, OFFER_W, REROLL, maxLv, perkDesc, perkKind } from '../data/relics.js';
import { G } from './state.js';
import { hasPerk, isUnlocked, isLocal, perkLv, cardLv } from './run.js';
import { WOFFER, weaponMaxed, levelUpWeapon } from './weaponlevel.js';
export const ROMAN = ['', 'I', 'II', 'III'];
import { spawnOrb } from './player.js';
import { spawnEnemy, makeElite } from './enemies.js';
import { addNoise } from './threat.js';
import { sparks, ring, flashLight, shake, dust } from './fx.js';
import { sfx } from '../audio/audio.js';
import { emit } from '../core/events.js';

export function itemMax(k) { return ITEMS[k].max + (hasPerk('bolKemer') ? 2 : 0); }

// kalıntı seçenekleri: yeni soy kalıntıları (sahip olduğun soylara çekilir), sahip olduklarının bir üst seviyesi,
// iki soyun varsa İKİLİ, iyi sandıkta EFSANEVİ; Lanetli Sandık bir LANETLİ kalıntı ekler. Kartlar mümkünse farklı soylardan gelir.
export function perkChoices(type = 'wood') {
  const C = CHESTS[type] || CHESTS.wood, q = C.q | 0;
  const n = (C.n || 3) + (G.meta.lv.kalintiBil ? 1 : 0) + (hasPerk('kumar') ? 2 : 0);
  const has = k => G.perks.includes(k), soyN = s => G.perks.filter(k => PERKS[k].soy === s).length;
  const cand = [], out = [];
  for (const k of PERK_KEYS) {
    const d = PERKS[k];
    if (d.mp && !G.mp) continue;
    let w = 0;
    if (d.curse) w = 0;
    else if (has(k)) w = perkLv(k) < maxLv(k) ? OFFER_W.up : 0;
    else if (d.duo) w = d.duo.every(s => soyN(s) > 0) ? OFFER_W.duo[q] : 0;
    else if (d.leg) w = OFFER_W.leg[q];
    else w = 1 + (soyN(d.soy) > 0 && soyN(d.soy) < RESONANCE ? OFFER_W.pull : 0);
    if (w > 0) cand.push({ k, w, soys: d.duo || (d.soy ? [d.soy] : []) });
  }
  // Lanetli Sandık: ilk kart her zaman lanetli
  if (C.curse) { const cs = PERK_KEYS.filter(k => PERKS[k].curse && !has(k)); if (cs.length) out.push(cs[Math.floor(rnd() * cs.length)]); }
  const used = new Set();
  while (out.length < n && cand.length) {
    let tot = 0; for (const c of cand) tot += c.w * (c.soys.some(x => used.has(x)) ? 0.12 : 1);
    let r = rnd() * tot, i = 0;
    for (; i < cand.length - 1; i++) { r -= cand[i].w * (cand[i].soys.some(x => used.has(x)) ? 0.12 : 1); if (r <= 0) break; }
    const c = cand.splice(i, 1)[0];
    out.push(c.k); for (const x of c.soys) used.add(x);
  }
  return out;
}
// yeniden çek: altınla (Kumarbaz'da bedava) aynı sandığın teklifini yeniler
export function rerollCost() { return hasPerk('kumar') ? 0 : REROLL.base + REROLL.step * (G.rerolls | 0); }
export function rerollOffer(p) {
  const off = G.perkOffer, c = rerollCost();
  if (!off || off.pi !== p.i || WOFFER[off.chest] || (G.store.gold | 0) < c) return false;
  G.store.gold -= c; G.rerolls = (G.rerolls | 0) + 1;
  const C = CHESTS[off.chest] || CHESTS.wood;
  off.keys = C.arms ? armsChoices(C.n) : perkChoices(off.chest);
  emit('store'); emit('perkOffer', p.i);
  return true;
}

// Silah Sandığı: sahip olmadığın silah, silah seviyesi, eklenti ya da alet seviyesi
function armsChoices(n) {
  const g = G.gear, opts = [];
  for (const k of WEAPON_KEYS) if (!g.wOwn.includes(k)) opts.push('w:' + k);
  if (!weaponMaxed()) opts.push('xl:1');
  for (const k of MOD_KEYS) if (!g.owned.includes(k)) opts.push('m:' + k);
  for (const k of BUILD_KEYS) if (isUnlocked(k) && (g.tLvl[k] | 0) < TOOL_UP.max) opts.push('tl:' + k);
  const out = [];
  while (out.length < n && opts.length) out.push(opts.splice(Math.floor(rnd() * opts.length), 1)[0]);
  return out;
}

// teklifin görünümü (UI)
export function offerInfo(k) {
  if (PERKS[k]) {
    const d = PERKS[k], kind = perkKind(k), l = perkLv(k), up = l > 0;
    const soy = d.soy ? SOY[d.soy] : null, col = d.curse ? '#c040ff' : d.leg ? '#ffb050' : d.duo ? '#ffd24a' : soy.col;
    const tag = up ? `YÜKSELT · ${ROMAN[l]} → ${ROMAN[l + 1]}` : kind === 'duo' ? 'İKİLİ · ' + d.duo.map(x => SOY[x].name).join(' + ') : kind === 'leg' ? 'EFSANEVİ' : kind === 'curse' ? 'LANETLİ' : soy.name;
    return { name: d.name, desc: up ? perkDesc(k, l, l + 1) : perkDesc(k, 1), icon: d.icon, kind, col, tag, soy: d.soy, up, lv: up ? l + 1 : 1, max: maxLv(k), t: kind === 'soy' ? 1 : 3 };
  }
  const [a, b] = k.split(':');
  if (a === 'w') return { name: WEAPONS[b].name, desc: 'Bedava silah: ' + WEAPONS[b].desc, icon: WEAPONS[b].icon, t: 2, tag: 'SİLAH', col: '#9fe8ff' };
  if (a === 'xl') return { name: 'Silah Seviyesi +1', desc: 'Silahın hemen seviye atlar: bir kart seçersin.', icon: 'blaster', t: 2, tag: 'SİLAH SEVİYESİ', col: '#ffd24a' };
  if (a === 'x' && CARDS[b]) { const l = cardLv(b); return { name: CARDS[b].name, desc: CARDS[b].desc, icon: CARDS[b].icon, t: 1, tag: 'KART', col: '#ffd24a', lv: l + 1, max: CARDS[b].max }; }
  if (a === 'e' && WEAPONS[b]) { const E = WEAPONS[b].evo[+k.split(':')[2]]; return { name: E.name, desc: E.desc, icon: WEAPONS[b].icon, t: 3, tag: 'EVRİM · ' + WEAPONS[b].name.toLocaleUpperCase('tr'), col: '#ff9a3a', kind: 'leg' }; }
  if (a === 'm') return { name: MODS[b].name, desc: MODS[b].desc, icon: MODS[b].icon, t: 1, tag: 'BEDAVA EKLENTİ', col: '#9fe8ff' };
  if (a === 'tl') return { name: BUILDS[b].name + ' +2', desc: `Alet iki seviye artar (hasar +%${TOOL_UP.dmg * 200}, dayanıklılık +%${TOOL_UP.hp * 200}).`, icon: BUILDS[b].icon, t: 2, tag: 'ALET', col: '#9fe8ff' };
  return { name: k, desc: '', icon: 'chest', t: 1, tag: '' };
}

// silah teklifini uygula (sandık, kart, evrim, başlangıç eklentisi)
export function applyOffer(k, p) {
  const g = G.gear, [a, b, c] = k.split(':');
  if (a === 'w' && WEAPONS[b] && !g.wOwn.includes(b)) { g.wOwn.push(b); p.wpn = b; }
  else if (a === 'xl') levelUpWeapon();
  else if (a === 'x' && CARDS[b] && cardLv(b) < CARDS[b].max) g.cards[b] = cardLv(b) + 1;
  else if (a === 'e' && WEAPONS[b] && (c === '0' || c === '1') && g.evo[b] == null) g.evo[b] = +c;
  else if (a === 'm' && MODS[b] && !g.owned.includes(b)) { g.owned.push(b); emit('modChanged', b); }
  else if (a === 'tl' && BUILDS[b]) g.tLvl[b] = Math.min(TOOL_UP.max, (g.tLvl[b] | 0) + 2);
  else return false;
  emit('gearChanged', { kind: 'chest', k, pi: p.i });
  return true;
}

export function offer(p, type, keys) {
  // yarıda kalan silah teklifi kaybolmaz: sıraya geri döner
  const cur = G.perkOffer;
  if (keys.length && cur && WOFFER[cur.chest]) G.gear.pend.unshift({ kind: cur.chest === 'start' ? 'start' : 'lvl', pi: cur.pi });
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
  if (C.q !== undefined) offer(p, type, perkChoices(type));
  else if (local) emit('toast', { text: CHESTS[type].name + ' açıldı', icon: 'chest' });
}

// Taklitçi öldü: gerçek sandık teklifi en yakın madenciye
export function mimicDown(e) {
  let best = null, bd = 1e9;
  for (const q of G.players) if (!q.dead) { const d = Math.hypot(q.x - e.x, q.y - e.y); if (d < bd) { bd = d; best = q; } }
  for (let i = 0; i < 6; i++) spawnOrb(e.x, e.y, 'gold', true);
  if (best) offer(best, e.chest || 'iron', perkChoices(e.chest || 'iron'));
}
