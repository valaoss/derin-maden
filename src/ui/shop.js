// Atölye (market): üstte güç göstergeleri; her sekmede ana yükseltmeler büyük kart, türler/eklentiler/eşyalar ızgara + seçili detay.
import { UPGRADES, BAG_CAPS, PICK_TIERS, PICK_TYPES, PICK_TYPE_KEYS, WEAPONS, WEAPON_KEYS, MODS, MOD_KEYS, ITEMS, ITEM_KEYS, BUILD_KEYS, MASTER_KEYS, RES, RES_KEYS, WEAPON_UP, TOOL_UP, beaconReq } from '../data/balance.js';
import { G } from '../game/state.js';
import { canAfford, upgradeCost, beaconLack, weaponUpCost, toolUpCost, itemCost, craftState, deployLimit } from '../game/economy.js';
import { pickDmg, modSlots, weaponLvl, toolLvl, perkLv, soyCount } from '../game/run.js';
import { PERKS, SOY, SOY_KEYS, RESONANCE, perkDesc, maxLv } from '../data/relics.js';
import { offerInfo, ROMAN } from '../game/chests.js';
import { gunDps } from '../game/power.js';
import { dispatch, CMD } from '../game/commands.js';

export const SHOP_TABS = [['pick', 'KAZMA'], ['mods', 'SİLAH'], ['up', 'DONANIM'], ['craft', 'KEMER']];
const sel = {};
let lastStats = null;

// ana yükseltmelerin gösterilen değeri (swing: hız olarak)
const VAL = {
  drill: l => PICK_TIERS[l].dmg, sharp: l => UPGRADES.sharp.mult[l], swing: l => 1 / UPGRADES.swing.mult[l],
  blaster: l => UPGRADES.blaster.dmg[l], armor: l => UPGRADES.armor.hp[l], bag: l => BAG_CAPS[l], lamp: l => UPGRADES.lamp.radius[l],
};
const LABEL = { drill: 'Kazı gücü ×', sharp: 'Kazı gücü ×', swing: 'Vuruş hızı ×', blaster: 'Hasar ', armor: 'Maks can ', bag: 'Kapasite ', lamp: 'Görüş ' };
const fmt = v => String(+v.toFixed(2));

const upOk = k => { const c = upgradeCost(k); return !!c && canAfford(c) && !beaconLack(k); };
const masterOre = k => RES_KEYS.find(o => RES[o].master === k);
const masterSeen = k => G.lvl[k] || G.store[masterOre(k)] > 0 || G.player.bag[masterOre(k)] > 0;

// sekme başına alınabilir iş sayısı (rozet)
export function tabCounts() {
  const n = { pick: 0, mods: 0, up: 0, craft: 0 };
  for (const k of ['drill', 'sharp', 'swing']) n.pick += upOk(k);
  for (const k of PICK_TYPE_KEYS) n.pick += !G.gear.pOwn.includes(k) && !!PICK_TYPES[k].cost && canAfford(PICK_TYPES[k].cost);
  n.mods += upOk('blaster');
  for (const k of WEAPON_KEYS) { const own = G.gear.wOwn.includes(k), c = own ? weaponUpCost(k) : WEAPONS[k].cost; n.mods += !!c && canAfford(c); }
  for (const k of MOD_KEYS) n.mods += !G.gear.owned.includes(k) && canAfford(MODS[k].cost);
  for (const k of ['armor', 'bag', 'lamp']) n.up += upOk(k);
  for (const k of MASTER_KEYS) n.up += !!masterSeen(k) && upOk(k);
  for (const k of ITEM_KEYS) n.craft += (G.items[k] | 0) === 0 && craftState(k) === 'ok';
  for (const k of BUILD_KEYS) { const c = toolUpCost(k); n.craft += !!c && canAfford(c); }
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
  const tile = (sec, id, iconHTML, name, cls, corner = '', col = '') =>
    `<button class="tile ${cls} ${sel[sec] === id ? 'sel' : ''} ${justKey === id ? 'just' : ''}" data-sel="${sec}:${id}"${col ? ` style="--c:${col}"` : ''}>${iconHTML}<span class="tn">${name}</span>${corner ? `<span class="tc">${corner}</span>` : ''}</button>`;
  const grid = (sec, tiles, detail) => {
    if (!tiles.some(t => t.id === sel[sec])) sel[sec] = tiles[0] && tiles[0].id;
    return `<div class="grid">${tiles.map(t => tile(sec, t.id, t.icon, t.name, t.cls + (t.col ? ' soyt' : ''), t.corner, t.col)).join('')}</div>` + (sel[sec] ? `<div class="det">${detail(sel[sec])}</div>` : '');
  };
  const detRow = (attr, iconHTML, name, desc, c, btn, tag = '') =>
    `<div class="plate row" ${attr}>${iconHTML}<div class="main"><div class="name">${name}${tag}</div><div class="eff">${desc}</div>${c ? cost(c) : ''}</div>${btn}</div>`;
  const lvLine = (g, k) => {
    const w = g === 'w', l = w ? weaponLvl(k) : toolLvl(k), max = w ? WEAPON_UP.max : TOOL_UP.max, c = w ? weaponUpCost(k) : toolUpCost(k);
    const a = w ? WEAPON_UP : TOOL_UP, eff = w ? `Hasar +%${Math.round(a.dmg * 100 * l)} · atış hızı +%${Math.round(a.cd * 100 * l)}` : `Hasar +%${Math.round(a.dmg * 100 * l)} · dayanıklılık +%${Math.round(a.hp * 100 * l)}`;
    const nx = c ? ` → <b>+%${Math.round(a.dmg * 100 * (l + 1))}</b>` : '';
    return `<div class="plate row sub ${c ? '' : 'max'} ${justKey === g + k ? 'just' : ''}" data-lvup="${g}:${k}"><div class="main"><div class="name">${w ? 'Ustalık' : 'Seviye'} ${bar(l, max)}</div><div class="eff">${eff}${nx}</div>${c ? cost(c) : ''}</div>${c ? `<button class="btn buy" ${canAfford(c) ? '' : 'disabled'}>GELİŞTİR</button>` : ''}</div>`;
  };
  // kazma türü / silah karosu ve detayı
  const gearTiles = (g, keys, D) => keys.map(k => {
    const own = (g === 'w' ? G.gear.wOwn : G.gear.pOwn).includes(k), on = (g === 'w' ? G.player.wpn : G.player.pk) === k;
    return { id: k, icon: ic(D[k].icon, 'xl'), name: D[k].name, cls: on ? 'eq' : own ? 'own' : canAfford(D[k].cost) ? 'ok' : '', corner: on ? 'ELİNDE' : '' };
  });
  const gearDet = (g, D) => k => {
    const d = D[k], own = (g === 'w' ? G.gear.wOwn : G.gear.pOwn).includes(k), on = (g === 'w' ? G.player.wpn : G.player.pk) === k;
    const btn = on ? '' : own ? '<button class="btn buy">TAK</button>' : `<button class="btn buy" ${canAfford(d.cost) ? '' : 'disabled'}>AL</button>`;
    return detRow(`data-gear="${g}:${k}"`, ic(d.icon, 'l'), d.name, d.desc, own ? null : d.cost, btn, on ? ' <span class="have">ELİNDE</span>' : '') + (g === 'w' && own ? lvLine('w', k) : '');
  };

  let h = '';
  if (tab === 'pick') {
    h += track('drill', `<img class="sw" src="${pickIconURL(G.lvl.drill)}" alt="">`) + track('sharp') + track('swing');
    h += '<div class="sec">KAZMA TÜRÜ · HER MADENCİ KENDİNİ SEÇER</div>';
    h += grid('pt', gearTiles('p', PICK_TYPE_KEYS, PICK_TYPES), gearDet('p', PICK_TYPES));
  } else if (tab === 'mods') {
    h += track('blaster');
    h += '<div class="sec">SİLAHLAR · HER MADENCİ KENDİNİ SEÇER</div>';
    h += grid('wp', gearTiles('w', WEAPON_KEYS, WEAPONS).map(t => { const l = weaponLvl(t.id); if (l && !t.corner) t.corner = 'Sv' + l; return t; }), gearDet('w', WEAPONS));
    const slots = modSlots();
    h += `<div class="sec">EKLENTİLER · ${G.gear.eq.length}/${slots} YUVA</div>`;
    h += `<div class="slots">${Array.from({ length: slots }, (_, i) => { const k = G.gear.eq[i]; return `<span class="slot2 ${k ? 'on' : ''}">${k ? ic(MODS[k].icon, 'l') : ''}</span>`; }).join('')}</div>`;
    h += grid('md', MOD_KEYS.map(k => {
      const m = MODS[k], own = G.gear.owned.includes(k), eq = G.gear.eq.includes(k);
      return { id: k, icon: ic(m.icon, 'xl'), name: m.name, cls: eq ? 'eq' : own ? 'own' : canAfford(m.cost) ? 'ok' : '', corner: eq ? 'TAKILI' : m.active ? 'AKTİF' : '' };
    }), k => {
      const m = MODS[k], own = G.gear.owned.includes(k), eq = G.gear.eq.includes(k);
      return own ? detRow(`data-mod="${k}"`, ic(m.icon, 'l'), m.name, m.desc, null, `<button class="btn buy">${eq ? 'ÇIKAR' : 'TAK'}</button>`)
        : detRow(`data-modbuy="${k}"`, ic(m.icon, 'l'), m.name, m.desc, m.cost, `<button class="btn buy" ${canAfford(m.cost) ? '' : 'disabled'}>AL</button>`);
    });
    h += '<div class="note">Aktif eklentiler ekranın sağındaki düğmelerden (klavyede Q / E) kullanılır.</div>';
  } else if (tab === 'up') {
    h += track('armor') + track('bag') + track('lamp');
    h += '<div class="sec">USTA İŞİ · DERİN CEVHER BUL, AÇILSIN</div>';
    h += grid('ms', MASTER_KEYS.map(k => {
      const seen = masterSeen(k), got = G.lvl[k] > 0;
      return { id: k, icon: ic(seen ? UPGRADES[k].icon : masterOre(k), 'xl'), name: seen ? UPGRADES[k].name : '???', cls: got ? 'own' : !seen ? 'lock' : upOk(k) ? 'ok' : '', corner: got ? 'SENDE' : '' };
    }), k => {
      const u = UPGRADES[k], c = upgradeCost(k);
      if (!masterSeen(k)) return detRow('', ic(masterOre(k), 'l'), '???', `${RES[masterOre(k)].label} bulunca açılır.`, null, '');
      return detRow(`data-up="${k}"`, ic(u.icon, 'l'), u.name, u.desc(), c, c ? `<button class="btn buy" ${canAfford(c) ? '' : 'disabled'}>AL</button>` : '', c ? '' : ' <span class="have">SENDE</span>');
    });
    if (G.perks.length) {
      h += '<div class="sec">SOYLAR · AYNI SOYDAN 3 KALINTI = REZONANS</div>';
      h += grid('sy', SOY_KEYS.map(s => { const n = soyCount(s); return { id: s, icon: ic(SOY[s].icon, 'xl'), name: `${SOY[s].name} ${Math.min(n, RESONANCE)}/${RESONANCE}`, cls: n >= RESONANCE ? 'eq' : n ? 'own' : 'lock', corner: n >= RESONANCE ? 'AKTİF' : '' }; }),
        s => detRow('', ic(SOY[s].icon, 'l'), `${SOY[s].name} REZONANSI`, SOY[s].res, null, '', ` <span class="have">${soyCount(s) >= RESONANCE ? 'AKTİF' : soyCount(s) + '/' + RESONANCE}</span>`));
      h += '<div class="sec">KALINTILAR · BU SEFER</div>';
      h += grid('pk', G.perks.map(k => { const o = offerInfo(k), l = perkLv(k); return { id: k, icon: ic(PERKS[k].icon, 'xl'), name: PERKS[k].name, cls: 'own', corner: maxLv(k) > 1 ? ROMAN[l] : '', col: o.col }; }),
        k => { const o = offerInfo(k), l = perkLv(k); return detRow('', ic(PERKS[k].icon, 'l'), PERKS[k].name + (maxLv(k) > 1 ? ' ' + ROMAN[l] : ''), perkDesc(k, l), null, '', ` <span class="have" style="color:${o.col}">${o.up ? o.tag.replace(/^YÜKSELT.*/, PERKS[k].soy ? SOY[PERKS[k].soy].name : '') : o.tag}</span>`); });
    }
    if (G.contracts.length) h += '<div class="sec">KONTRATLAR</div>' + x.contractsHTML();
  } else {
    const itemTile = k => {
      const d = ITEMS[k], st = craftState(k);
      return st === 'locked' ? { id: k, icon: ic('schematic', 'xl'), name: d.name, cls: 'lock', corner: 'ŞEMA' }
        : { id: k, icon: ic(d.icon, 'xl'), name: d.name, cls: st === 'ok' ? 'ok' : st === 'full' ? 'own' : '', corner: `${G.items[k] | 0}/${d.max}` };
    };
    const itemDet = k => {
      const d = ITEMS[k], st = craftState(k);
      if (st === 'locked') return detRow('', ic('schematic', 'l'), d.name, 'Şema gerekli: sandıklarda bulunur.', null, '');
      return detRow(`data-craft="${k}"`, ic(d.icon, 'l'), d.name, d.desc, itemCost(k), `<button class="btn buy" ${st === 'ok' ? '' : 'disabled'}>${st === 'full' ? 'DOLU' : 'ÜRET'}</button>`, ` <span class="have">${G.items[k] | 0}/${d.max}</span>`)
        + (d.build && st !== 'locked' ? lvLine('t', k) : '');
    };
    h += '<div class="sec">EŞYALAR · KEMERDEN KULLANILIR</div>';
    h += grid('it', ITEM_KEYS.filter(k => !ITEMS[k].build).map(itemTile), itemDet);
    h += `<div class="sec">ALETLER · DURDUĞUN YERE KUR (EN FAZLA ${deployLimit()})</div>`;
    h += grid('tl', BUILD_KEYS.map(k => { const t = itemTile(k), l = toolLvl(k); if (l && t.cls !== 'lock') t.name += ' ' + l; return t; }), itemDet);
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
  q('[data-modbuy] .buy', b => { const k = b.closest('[data-modbuy]').dataset.modbuy; if (dispatch({ t: CMD.MODBUY, k })) after(k); });
  q('[data-mod] .buy', b => { const k = b.closest('[data-mod]').dataset.mod; if (dispatch({ t: CMD.MODEQ, k })) after(k); });
  q('[data-gear] .buy', b => { const [g, k] = b.closest('[data-gear]').dataset.gear.split(':'); if (dispatch({ t: CMD.GEAR, g, k })) after(k); });
  q('[data-lvup] .buy', b => { const [g, k] = b.closest('[data-lvup]').dataset.lvup.split(':'); if (dispatch({ t: CMD.LVUP, g, k })) after(g + k); });
  q('[data-craft] .buy', b => { const k = b.closest('[data-craft]').dataset.craft; if (dispatch({ t: CMD.CRAFT, k })) after(k); });
}
