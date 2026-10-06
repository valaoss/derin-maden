// Silah seviyesi: öldürdükçe dolan çubuk, her seviyede bir kart; evoAt'ta elindeki silah evrilir.
// Teklifler (başlangıç eklentisi, kart, evrim) sırayla G.perkOffer'a düşer; sandık teklifiyle aynı ekranda seçilir.
import { rnd } from '../core/rng.js';
import { WXP, CARDS, CARD_KEYS, WEAPONS, START_MODS, MOD_KEYS } from '../data/balance.js';
import { G } from './state.js';
import { hasPerk, cardLv, weaponOf } from './run.js';
import { ring, sparks } from './fx.js';
import { emit } from '../core/events.js';

// teklif türleri (G.perkOffer.chest): sandık değil, silah teklifi
export const WOFFER = { start: 1, lvl: 1, evo: 1 };
export const xpNeed = lv => WXP.base + WXP.step * lv;
export const weaponMaxed = () => CARD_KEYS.every(k => cardLv(k) >= CARDS[k].max) && MOD_KEYS.every(k => G.gear.owned.includes(k));

function cardPool(p) {
  const W = weaponOf(p);
  return CARD_KEYS.filter(k => cardLv(k) < CARDS[k].max && !(CARDS[k].shot && (W.flame || W.zap)) && !(CARDS[k].noFlame && W.flame)).map(k => 'x:' + k);
}
const evoDue = p => G.gear.lv >= WXP.evoAt && !!WEAPONS[p.wpn] && G.gear.evo[p.wpn] == null;

export function gainXp(e) {
  const g = G.gear;
  if (weaponMaxed()) return;
  g.xp += (e.d.boss ? WXP.boss : (e.d.cost || 0) * (e.elite ? WXP.elite : 1)) * (hasPerk('dorduncuYuva') ? 2 : 1);
  while (g.xp >= xpNeed(g.lv)) { g.xp -= xpNeed(g.lv); levelUpWeapon(); }
}
export function levelUpWeapon() { const g = G.gear; g.lv++; g.pend.push({ kind: 'lvl' }); emit('weaponLevel', g.lv); }

// her adımda: bekleyen teklif yoksa sıradakini sun
export function updateWeaponOffers() {
  const g = G.gear, cur = G.perkOffer;
  if (cur && WOFFER[cur.chest] && G.players[cur.pi] && G.players[cur.pi].gone) G.perkOffer = null;
  if (G.perkOffer || !g.pend.length) return;
  const o = g.pend.shift(), live = G.players.filter(p => !p.gone);
  if (!live.length) return;
  let p, keys, kind = o.kind;
  // ertelenmiş sandık teklifi: sahibi ayrıldıysa ayaktaki madenciye geçer
  if (kind === 'offer') {
    p = G.players[o.pi] && !G.players[o.pi].gone ? G.players[o.pi] : live[0];
    G.perkOffer = { pi: p.i, keys: o.keys, chest: o.chest }; emit('perkOffer', p.i);
    return;
  }
  if (kind === 'start') {
    p = G.players[o.pi]; if (!p || p.gone) return;
    keys = START_MODS.filter(k => !g.owned.includes(k)).map(k => 'm:' + k);
  } else {
    // sıra madenciler arasında döner; yarıda kalan teklif sahibine geri gelir
    p = o.pi !== undefined && G.players[o.pi] && !G.players[o.pi].gone ? G.players[o.pi] : live[(g.turn = (g.turn | 0) + 1) % live.length];
    if (evoDue(p)) { kind = 'evo'; keys = [0, 1].map(i => 'e:' + p.wpn + ':' + i); }
    else {
      // eklentiler mağazada satılmaz, seviye atladıkça gelir: her teklifte iki kart ve bir eklenti (biri bitince öteki doldurur)
      const cards = cardPool(p), mods = MOD_KEYS.filter(k => !g.owned.includes(k)).map(k => 'm:' + k), take = a => a.splice(Math.floor(rnd() * a.length), 1)[0];
      const mod = mods.length ? [take(mods)] : []; keys = []; kind = 'lvl';
      while (keys.length < 3 - mod.length && cards.length) keys.push(take(cards));
      while (keys.length < 3 - mod.length && mods.length) keys.push(take(mods));
      keys = keys.concat(mod);
    }
  }
  if (!keys.length) return;
  G.perkOffer = { pi: p.i, keys, chest: kind };
  if (kind !== 'start') { ring(p.x, p.y, '#ffd24a', 26); sparks(p.x, p.y, '#ffe79a', 14, 90); }
  emit('perkOffer', p.i);
}
