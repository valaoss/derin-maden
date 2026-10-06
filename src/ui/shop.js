// Atölye (market): dört sekme. GÜÇ: beş ana yükseltme + bulunan Usta İşleri. TEÇHİZAT: silah seviyesi, silahlar, kazma türleri.
// TEZGÂH: düşman malzemesiyle dövme. KEMER: eşyalar ve aletler. Tüccar kamptayken beşinci sekme açılır.
import { UPGRADES, BAG_CAPS, PICK_TIERS, PICK_TYPES, PICK_TYPE_KEYS, WEAPONS, WEAPON_KEYS, MODS, MOD_KEYS, ITEMS, ITEM_KEYS, MASTER_KEYS, RES, RES_KEYS, CARDS, CARD_KEYS, WXP, beaconReq, FORGE, FORGE_KEYS, MATS, MAT_KEYS } from '../data/balance.js';
import { G } from '../game/state.js';
import { canAfford, upgradeCost, beaconLack, itemCost, craftState, deployLimit, forgeCost } from '../game/economy.js';
import { pickDmg, toolLvl, cardLv, forgeLv, pickPow } from '../game/run.js';
import { xpNeed, weaponMaxed } from '../game/weaponlevel.js';
import { offerInfo } from '../game/chests.js';
import { gunDps } from '../game/power.js';
import { dispatch, CMD } from '../game/commands.js';
import { goodInfo } from '../game/merchant.js';

export const SHOP_TABS = [['up', 'GÜÇ'], ['gear', 'TEÇHİZAT'], ['forge', 'TEZGÂH'], ['craft', 'KEMER'], ['merch', 'TÜCCAR']];
const MAIN = ['drill', 'blaster', 'armor', 'bag', 'lamp'];
const sel = {};
let lastStats = null;

// ana yükseltmelerin gösterilen değeri
const VAL = {
  drill: l => pickPow(l), blaster: l => UPGRADES.blaster.dmg[l], armor: l => UPGRADES.armor.hp[l], bag: l => BAG_CAPS[l], lamp: l => UPGRADES.lamp.radius[l],
};
const LABEL = { drill: 'Kazı gücü ×', blaster: 'Silah hasarı ', armor: 'Azami can ', bag: 'Kapasite ', lamp: 'Görüş ' };
const fmt = v => String(+v.toFixed(2));

const upOk = k => { const c = upgradeCost(k); return !!c && canAfford(c) && !beaconLack(k); };
const masterOre = k => RES_KEYS.find(o => RES[o].master === k);
const masterSeen = k => G.lvl[k] || G.store[masterOre(k)] > 0 || G.player.bag[masterOre(k)] > 0;
const beltKeys = () => ITEM_KEYS.filter(k => craftState(k) !== 'locked');

// sekme başına alınabilir iş sayısı (rozet)
export function tabCounts() {
  const n = { up: 0, gear: 0, forge: 0, craft: 0, merch: 0 };
  for (const k of MAIN) n.up += upOk(k);
  for (const k of MASTER_KEYS) n.up += !!masterSeen(k) && upOk(k);
  for (const k of WEAPON_KEYS) n.gear += !G.gear.wOwn.includes(k) && canAfford(WEAPONS[k].cost);
  for (const k of PICK_TYPE_KEYS) n.gear += !G.gear.pOwn.includes(k) && !!PICK_TYPES[k].cost && canAfford(PICK_TYPES[k].cost);
  for (const k of FORGE_KEYS) { const c = forgeCost(k); n.forge += !!c && canAfford(c); }
  for (const k of beltKeys()) n.craft += (G.items[k] | 0) === 0 && craftState(k) === 'ok';
  if (G.merchant) for (const g of G.merchant.goods) n.merch += !g.sold && (G.store.gold | 0) >= g.cost;
  return n;
}

// üst şerit: gücün tek bakışta; değişen değer zıplar
export function statsHTML(ic) {
  const s = [['drill', 'KAZI', fmt(pickDmg())], ['blaster', 'HASAR/SN', Math.round(gunDps(G.player))], ['heart', 'CAN', G.player.maxHp], ['bag', 'ÇANTA', G.bagCap]];
  const h = s.map(([i, l, v], j) => `<div class="stat ${lastStats && lastStats[j] !== v ? 'pop' : ''}">${ic(i, 's')}<b>${v}</b><small>${l}</small></div>`).join('');
  lastStats = s.map(x => x[2]);
  return h;
}

export function renderShop(body, tab, justKey, x) {
  const { ic, pickIconURL } = x;
  const cost = c => '<span class="cost">' + Object.keys(c).map(k => `<span class="${(G.store[k] || 0) >= c[k] ? '' : 'no'}">${ic(k, 's')}${c[k]}</span>`).join('') + '</span>';
  const bar = (l, max) => `<span class="seg">${Array.from({ length: max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</span>`;

  // büyük yükseltme kartı: seviye çubuğu, şimdi → sonra (+%), tek AL düğmesi
  const track = (k, iconHTML) => {
    const u = UPGRADES[k], l = G.lvl[k], max = u.costs.length, c = upgradeCost(k), lack = c ? beaconLack(k) : 0, ok = upOk(k);
    const v0 = VAL[k](l), v1 = c ? VAL[k](l + 1) : 0, pct = c ? Math.round((v1 / v0 - 1) * 100) : 0;
    const title = k === 'drill' ? PICK_TIERS[l].name : u.name;
    const eff = c ? `${LABEL[k]}${fmt(v0)} → <b>${fmt(v1)}</b> <em>+%${pct}</em>${k === 'drill' ? ` · <span class="nx">${PICK_TIERS[l + 1].name}</span>` : ''}` : `${LABEL[k]}${fmt(v0)}`;
    const btn = !c ? '<span class="maxb">MAKS</span>' : lack ? `<button class="btn buy lock" disabled>${ic('lamp', 's')}${beaconReq(k, l)}</button>` : `<button class="btn buy" ${ok ? '' : 'disabled'}>AL</button>`;
    return `<div class="plate trk ${ok ? 'ok' : ''} ${c ? '' : 'max'} ${justKey === k ? 'just' : ''}" data-up="${k}">
      <div class="ti">${iconHTML || ic(u.icon, 'xl')}</div>
      <div class="main"><div class="name">${title}<span class="lv">${l}/${max}</span></div>${bar(l, max)}<div class="eff">${eff}</div>
      ${c ? cost(c) : ''}${lack ? `<div class="eff lockn">${lack} Fener daha yak: biyomun tüm yuvalarını yık</div>` : ''}</div>${btn}</div>`;
  };
  // ızgara karosu; seçilince altında detay açılır
  const tile = (sec, id, iconHTML, name, cls, corner = '') =>
    `<button class="tile ${cls} ${sel[sec] === id ? 'sel' : ''} ${justKey === id ? 'just' : ''}" data-sel="${sec}:${id}">${iconHTML}<span class="tn">${name}</span>${corner ? `<span class="tc">${corner}</span>` : ''}</button>`;
  const grid = (sec, tiles, detail) => {
    if (!tiles.some(t => t.id === sel[sec])) sel[sec] = tiles[0] && tiles[0].id;
    return `<div class="grid">${tiles.map(t => tile(sec, t.id, t.icon, t.name, t.cls, t.corner)).join('')}</div>` + (sel[sec] ? `<div class="det">${detail(sel[sec])}</div>` : '');
  };
  const detRow = (attr, iconHTML, name, desc, c, btn, tag = '') =>
    `<div class="plate row" ${attr}>${iconHTML}<div class="main"><div class="name">${name}${tag}</div><div class="eff">${desc}</div>${c ? cost(c) : ''}</div>${btn}</div>`;

  // silah seviyesi: öldürdükçe dolan çubuk; kartlar ve eklentiler buradan gelir
  const levelCard = () => {
    const g = G.gear, max = weaponMaxed(), f = max ? 100 : Math.round(g.xp / xpNeed(g.lv) * 100);
    const got = CARD_KEYS.filter(k => cardLv(k)).map(k => `${CARDS[k].name} ${cardLv(k)}/${CARDS[k].max}`).concat(MOD_KEYS.filter(k => g.owned.includes(k)).map(k => MODS[k].name)).join(' · ');
    return `<div class="plate trk"><div class="ti">${ic('blaster', 'xl')}</div><div class="main"><div class="name">Silah Seviyesi<span class="lv">SEVİYE ${g.lv}${max ? ' · MAKS' : ''}</span></div><span class="xpb"><i style="width:${f}%"></i></span>
      <div class="eff">Düşman öldürdükçe dolar. Her seviyede üç seçenekten birini alırsın: güç kartı ya da eklenti. ${WXP.evoAt}. seviyede silahın evrilir.</div>${got ? `<div class="eff"><b>${got}</b></div>` : ''}</div></div>`;
  };
  // silah / kazma türü karosu ve detayı
  const gearTiles = (g, keys, D) => keys.map(k => {
    const own = (g === 'w' ? G.gear.wOwn : G.gear.pOwn).includes(k), on = (g === 'w' ? G.player.wpn : G.player.pk) === k;
    const corner = on ? 'ELİNDE' : g === 'w' && G.gear.evo[k] != null ? 'EVRİM' : '';
    return { id: k, icon: ic(D[k].icon, 'xl'), name: D[k].name, cls: on ? 'eq' : own ? 'own' : canAfford(D[k].cost || {}) ? 'ok' : '', corner };
  });
  const gearDet = (g, D) => k => {
    const d = D[k], own = (g === 'w' ? G.gear.wOwn : G.gear.pOwn).includes(k), on = (g === 'w' ? G.player.wpn : G.player.pk) === k;
    const btn = on ? '' : own ? '<button class="btn buy">TAK</button>' : `<button class="btn buy" ${canAfford(d.cost) ? '' : 'disabled'}>AL</button>`;
    const evo = g === 'w' && G.gear.evo[k] != null ? `<br><b>Evrim · ${d.evo[G.gear.evo[k]].name}</b>: ${d.evo[G.gear.evo[k]].desc}` : '';
    return detRow(`data-gear="${g}:${k}"`, ic(d.icon, 'l'), d.name, d.desc + evo, own ? null : d.cost, btn, on ? ' <span class="have">ELİNDE</span>' : '');
  };
  // Tezgâh kartı: üç kademe, sıradaki vurgulu
  const forgeCard = k => {
    const F = FORGE[k], l = forgeLv(k), c = forgeCost(k), ok = !!c && canAfford(c);
    const steps = F.steps.map(([n, d], i) => `<div class="eff fs ${i < l ? 'got' : i === l ? 'nx' : ''}"><b>${i < l ? '★' : '☆'} ${n}</b> ${d}</div>`).join('');
    return `<div class="plate trk forge ${ok ? 'ok' : ''} ${c ? '' : 'max'} ${justKey === 'f' + k ? 'just' : ''}" data-forge="${k}"><div class="ti">${ic(F.icon, 'xl')}</div>
      <div class="main"><div class="name">${F.name}<span class="lv">${l}/${F.steps.length}</span></div>${bar(l, F.steps.length)}${steps}${c ? cost(c) : ''}</div>${c ? `<button class="btn buy" ${ok ? '' : 'disabled'}>DÖV</button>` : '<span class="maxb">MAKS</span>'}</div>`;
  };

  let h = '';
  if (tab === 'up') {
    h += MAIN.map(k => track(k, k === 'drill' ? `<img class="sw" src="${pickIconURL(G.lvl.drill)}" alt="">` : '')).join('');
    const seen = MASTER_KEYS.filter(masterSeen);
    if (seen.length) {
      h += '<div class="sec">USTA İŞİ · DERİN CEVHERLE BİR KEZ ALINIR</div>';
      h += seen.map(k => {
        const u = UPGRADES[k], c = upgradeCost(k);
        return detRow(`data-up="${k}"`, ic(u.icon, 'l'), u.name, u.desc(), c, c ? `<button class="btn buy" ${canAfford(c) ? '' : 'disabled'}>AL</button>` : '', c ? '' : ' <span class="have">SENDE</span>');
      }).join('');
    }
  } else if (tab === 'gear') {
    h += levelCard();
    h += '<div class="sec">SİLAHLAR · HER MADENCİ KENDİNİ SEÇER</div>';
    h += grid('wp', gearTiles('w', WEAPON_KEYS, WEAPONS), gearDet('w', WEAPONS));
    h += '<div class="sec">KAZMA TÜRLERİ</div>';
    h += grid('pt', gearTiles('p', PICK_TYPE_KEYS, PICK_TYPES), gearDet('p', PICK_TYPES));
  } else if (tab === 'forge') {
    h += `<div class="sec">MALZEME · ${MAT_KEYS.map(k => `${ic(k, 's')}${MATS[k].label} ${G.store[k] | 0}`).join(' · ')}</div>`;
    h += FORGE_KEYS.map(forgeCard).join('');
    h += '<div class="note">Kabuk sıradan düşmandan, Çekirdek elit ve bosslardan düşer. Dövülen her şey bütün ekibe işler.</div>';
  } else if (tab === 'merch') {
    const M = G.merchant;
    if (!M) h += '<div class="note">Tüccar gitti. Arada yine uğrar.</div>';
    else {
      h += `<div class="sec">GEZGİN TÜCCAR · ${Math.ceil(M.t)} SN SONRA GİDER</div>`;
      M.goods.forEach((g, i) => {
        const d = goodInfo(g), info = g.k === 'perk' ? offerInfo(g.id) : null;
        const tag = g.k === 'perk' ? info.tag : g.k === 'item' ? 'EŞYA' : 'EKLENTİ';
        const btn = g.sold ? '<span class="maxb">SATILDI</span>' : `<button class="btn buy" ${(G.store.gold | 0) >= g.cost ? '' : 'disabled'}>${ic('gold', 's')}${g.cost}</button>`;
        h += `<div class="plate row merch ${g.sold ? 'max' : ''} ${justKey === 'm' + i ? 'just' : ''}" data-merch="${i}"${info ? ` style="--c:${info.col}"` : ''}>${ic(d.icon, 'l')}<div class="main"><div class="name">${d.name} <span class="have"${info ? ` style="color:${info.col}"` : ''}>${tag}</span></div><div class="eff">${info ? info.desc : d.desc}</div></div>${btn}</div>`;
      });
    }
  } else {
    h += `<div class="sec">KEMER · ALETLERDEN EN ÇOK ${deployLimit()} TANESİ KURULU KALIR</div>`;
    h += grid('it', beltKeys().map(k => {
      const d = ITEMS[k], st = craftState(k), l = d.build ? toolLvl(k) : 0;
      return { id: k, icon: ic(d.icon, 'xl'), name: d.name + (l ? ' ' + l : ''), cls: st === 'ok' ? 'ok' : st === 'full' ? 'own' : '', corner: `${G.items[k] | 0}/${d.max}` };
    }), k => {
      const d = ITEMS[k], st = craftState(k), l = d.build ? toolLvl(k) : 0;
      const desc = d.desc + (d.build ? ` <b>Seviye ${l}</b>: her kırılan mühürde güçlenir.` : '');
      return detRow(`data-craft="${k}"`, ic(d.icon, 'l'), d.name, desc, itemCost(k), `<button class="btn buy" ${st === 'ok' ? '' : 'disabled'}>${st === 'full' ? 'DOLU' : 'ÜRET'}</button>`, ` <span class="have">${G.items[k] | 0}/${d.max}</span>`);
    });
  }

  const scroll = body.scrollTop;
  body.innerHTML = h;
  body.scrollTop = scroll;
  bind(body, x);
}

function bind(body, x) {
  const { tap, after } = x, q = (s, fn) => body.querySelectorAll(s).forEach(b => tap(b, () => fn(b)));
  q('[data-sel]', b => { const [s, id] = b.dataset.sel.split(':'); sel[s] = id; after(null); });
  q('[data-up] .buy', b => { const k = b.closest('[data-up]').dataset.up; if (dispatch({ t: CMD.BUY, k })) after(k, true); });
  q('[data-gear] .buy', b => { const [g, k] = b.closest('[data-gear]').dataset.gear.split(':'); if (dispatch({ t: CMD.GEAR, g, k })) after(k); });
  q('[data-merch] .buy', b => { const i = +b.closest('[data-merch]').dataset.merch; if (dispatch({ t: CMD.MERCH, i })) after('m' + i, true); });
  q('[data-forge] .buy', b => { const k = b.closest('[data-forge]').dataset.forge; if (dispatch({ t: CMD.FORGE, k })) after('f' + k, true); });
  q('[data-craft] .buy', b => { const k = b.closest('[data-craft]').dataset.craft; if (dispatch({ t: CMD.CRAFT, k })) after(k); });
}
