// DOM arayüzü: HUD, atölye, perk seçimi, menüler, bildirimler, öğretici.
import { CRITTERS, CRITTER_KEYS } from '../data/critters.js';
import { critterURL } from '../render/critters.js';
import { nearWell, wellCost } from '../game/well.js';
import { lakeAt } from '../game/wonders.js';
import { TILE, GROUND_Y, stratumOfRow, STRATUM_ROWS } from '../config.js';
import { UPGRADES, UPGRADE_KEYS, PICK_KEYS, MODS, MOD_KEYS, BUILDS, BUILD_KEYS, PERKS, META, META_KEYS, RES_KEYS, ENEMIES, ITEMS, ITEM_KEYS, CONTRACTS, RES, BASE_RES, MASTER_KEYS, KADEME, DEPLOY_MAX, ROLES, ROLE_KEYS, EVENTS, RELICS, RELIC_KEYS, WEAPONS, WEAPON_KEYS, PICK_TYPES, PICK_TYPE_KEYS } from '../data/balance.js';
import { STRATA } from '../data/palette.js';
import { G, App, biomeOf } from '../game/state.js';
import { iconURL, HELMETS } from '../render/sprites.js';
import { on, emit } from '../core/events.js';
import { bagCount, hasPerk, isUnlocked, contractProgress, pickDmg, pickInterval, modSlots, soyCount } from '../game/run.js';
import { canAfford, upgradeCost, craftState, beaconLack, weaponUpCost, toolUpCost, itemCost } from '../game/economy.js';
import { WEAPON_UP, TOOL_UP, beaconReq } from '../data/balance.js';
import { weaponLvl, toolLvl } from '../game/run.js';
import { offerInfo, rerollCost, ROMAN } from '../game/chests.js';
import { SOY, SOY_KEYS, RESONANCE } from '../data/relics.js';
import { CHESTS } from '../data/balance.js';
import { itemUsable } from '../game/items.js';
import { dispatch, CMD } from '../game/commands.js';
import { PICK_TIERS } from '../data/balance.js';
import { net } from '../net/lockstep.js';
import { todayKey } from '../core/util.js';
import { LEVEL_NAMES, nestsInStratum, nestTotalInStratum } from '../game/threat.js';
import { atShaft, destinations } from '../game/elevator.js';
import { STRATA_COUNT } from '../config.js';
import { worldToView, viewToWorld } from '../render/renderer.js';
import { sfx, initAudio, applyAudioSettings } from '../audio/audio.js';
import { saveMeta, saveSettings } from '../core/save.js';
import { mountJourney, glyphURL, MARK_NAMES } from './journey.js';
import { cancelStick, setStickMode } from '../input/input.js';
import { isNative, WEB_URL } from '../core/native.js';
import { SHOP_TABS, renderShop, statsHTML, tabCounts } from './shop.js';

const $ = (s, r = document) => r.querySelector(s);
const ic = (name, cls = '') => `<i class="icon ${cls}" style="background-image:url(${iconURL(name)})"></i>`;
let ui, hooks = {};

export function initUI(root, h) {
  hooks = h; ui = root;
  root.innerHTML = `
  <div id="hud" class="hidden">
    <div class="hud-row">
      <div class="plate meter">${ic('heart')}<div class="bar hp"><b></b><i></i></div></div>
      <div class="plate depth"><div class="m" id="dM">0m</div><div class="s" id="dS">YÜZEY</div></div>
      <div class="plate meter noise" id="noiseM">${ic('wave')}<div class="bar base"><b></b><i></i></div></div>
      <button class="plate pausebtn" id="pauseBtn" aria-label="Duraklat">${ic('pause')}</button>
    </div>
    <div class="hud-row">
      <div class="plate meter bagm" id="bagM">${ic('bag')}<div class="bar bag"><i></i></div><span class="num" id="bagN">0/12</span></div>
      <div class="plate res" id="resBox">${BASE_RES.map(k => `<span class="chip" id="r_${k}">${ic(k, 's')}<span>0</span></span>`).join('')}</div>
    </div>
    <div class="plate" id="wave">${ic('wave', 's')}<span class="l">SESSİZ</span><span class="t"></span></div>
    <div class="plate" id="goal">${ic('base', 's')}<span class="g"></span></div>
    <div class="plate" id="boss">${ic('skull', 's')}<span class="bn"></span><div class="bar"><i></i></div></div>
    <div class="plate" id="partner">${ic('heart', 's')}<span class="pn">PARTNER</span><div class="bar"><i></i></div><span class="d"></span><span class="ping"></span></div>
  </div>
  <div class="plate" id="netstall">BAĞLANTI BEKLENİYOR…</div>
  <div id="indicator">${ic('heart', 's')} PARTNER BAYGIN</div>
  <div id="toasts"></div>
  <div id="coach"><div class="hand" style="background-image:url(${iconURL('hand')})"></div><div class="plate msg"></div></div>
  <div id="banner"><div class="k"></div><div class="n"></div><div class="rule"></div></div>
  <button class="btn hide" id="workshopBtn">${ic('drill', 'l')}<span>ATÖLYE</span><span class="badge"></span></button>
  <button class="btn hide" id="fishBtn">${ic('fish', 'l')}<span>OLTA · <b id="fishC"></b></span></button>
  <button class="btn hide" id="wellBtn">${ic('gold', 'l')}<span>KUYU · <b id="wellC"></b></span></button>
  <button class="btn hide" id="elevBtn">${ic('base', 'l')}<span>ASANSÖR</span></button>
  <div id="belt"></div>
  <button class="btn dark" id="chatBtn" aria-label="Hızlı mesaj">${ic('hand', 'l')}</button>
  <div id="chat"></div>
  <div id="mods"></div>
  <div class="plate" id="pop"></div>
  <div id="sheetBack"></div>
  <div class="plate rivets" id="sheet">
    <div class="head"><h2>ATÖLYE</h2><button class="btn test ${TEST_MODE ? '' : 'hide'}" id="testBtn">TEST ∞</button><button class="close" id="sheetClose" aria-label="Kapat">✕</button></div>
    <div class="stats" id="sheetStats"></div>
    <div class="tabs">${SHOP_TABS.map(([k, l], i) => `<button class="tab ${i ? '' : 'on'}" data-tab="${k}">${l}<span class="cnt"></span></button>`).join('')}</div>
    <div class="storebar" id="sheetStore"></div>
    <div class="body" id="sheetBody"></div>
  </div>
  <div class="screen" id="menu"></div>
  <div class="screen dim" id="pause"></div>
  <div class="screen dim" id="perk"></div>
  <div class="screen dim" id="results"></div>
  <div class="screen dim" id="camp"></div>
  <div class="screen dim" id="settings"></div>
  <div class="screen dim" id="room"></div>
  <div id="fade"></div>`;

  tap($('#pauseBtn'), () => hooks.pause(true));
  tap($('#chatBtn'), toggleChat);
  tap($('#workshopBtn'), openSheet);
  tap($('#elevBtn'), showElevPop);
  tap($('#wellBtn'), () => { if (!dispatch({ t: CMD.WISH })) sfx.deny(); });
  tap($('#fishBtn'), () => { if (!dispatch({ t: CMD.FISH })) sfx.deny(); });
  on('critter', d => {
    const C = CRITTERS[d.k];
    if (d.pi !== G.localIdx) { toast('Partnerin bir yoldaş buldu: ' + C.name, 'heart'); return; }
    const m = App.meta, fresh = !(m.pets || []).includes(d.k);
    if (fresh) { m.pets = (m.pets || []).concat(d.k); m.pet = d.k; saveMeta(m); }
    banner(fresh ? 'YENİ YOLDAŞ' : 'YOLDAŞ', C.name, 'gold'); sfx.buy();
    setTimeout(() => toast(C.lore, 'heart'), 2400);
  });
  on('wishThrow', d => { if (d.pi === G.localIdx) sfx.click(); });
  on('wishDone', d => {
    if (d.pi !== G.localIdx) return;
    const g = d.got; sfx.buy();
    if (g.k === 'res' || g.k === 'gold') toast(`Kuyu: +${g.n} ${RES[g.k === 'gold' ? 'gold' : g.id].label}`, g.k === 'gold' ? 'gold' : g.id);
    else if (g.k === 'item') toast('Kuyu: ' + ITEMS[g.id].name, ITEMS[g.id].icon);
    else if (g.k === 'heal') toast('Kuyu: can doldu, hızlandın!', 'heart');
    else toast('Kuyu: bir sandık çıkardı!', 'chest');
  });
  const SHROOM_TXT = { mini: ['Küçüldün!', 'Hızlısın, zor vurulursun'], dev: ['Devleştin!', 'Kazman çok daha güçlü'], hiz: ['Hızlandın!', 'Rüzgâr gibisin'], zehir: ['Zehirli mantar!', 'Birkaç saniye can kaybı'] };
  on('shroomEat', d => { if (d.pi === G.localIdx) sfx.click(); });
  on('shroom', d => { if (d.pi !== G.localIdx) return; const [a, b] = SHROOM_TXT[d.k]; toast(`Mantar: ${a} ${b}`, d.k === 'zehir' ? 'skull' : 'spark', d.k === 'zehir'); if (d.k === 'zehir') sfx.cough(); else sfx.heal(); });
  on('shroomEnd', d => { if (d.pi === G.localIdx && d.k !== 'zehir') toast('Mantarın etkisi geçti', 'spark'); });
  on('fishCast', d => { if (d.pi === G.localIdx) sfx.click(); });
  on('fishDone', d => {
    if (d.pi !== G.localIdx) return;
    const g = d.got; sfx.buy();
    if (g.k === 'res' || g.k === 'gold') toast(`Olta: +${g.n} ${RES[g.k === 'gold' ? 'gold' : g.id].label}`, g.k === 'gold' ? 'gold' : g.id);
    else if (g.k === 'item') toast('Olta: ' + ITEMS[g.id].name, ITEMS[g.id].icon);
    else if (g.k === 'heal') toast('Olta: şifalı balık, can doldu', 'heart');
    else toast('Olta: batık bir sandık çıktı!', 'chest');
  });
  on('merchant', on => { if (on) { banner('GEZGİN TÜCCAR', 'Kampa geldi', 'gold'); toast('Tüccar kampta: Atölye’de TÜCCAR sekmesi', 'gold'); } else { toast('Tüccar kamptan ayrıldı', 'gold'); if (sheetOpen()) refreshSheet(); } });
  on('merchantSoon', () => toast('Tüccar 20 sn içinde gidiyor', 'gold'));
  on('station', s => toast('Asansör istasyonu açıldı: ' + STRATA[biomeOf(s)].name, 'base'));
  on('elevator', d => { if (d.pi === G.localIdx) hidePop(); else toast('Partner asansöre bindi', 'base'); });
  tap($('#sheetClose'), closeSheet);
  tap($('#testBtn'), () => { if (dispatch({ t: CMD.TEST })) { refreshSheet(); refreshHUD(true); } });
  tap($('#sheetBack'), closeSheet);
  document.querySelectorAll('#sheet .tab').forEach(t => tap(t, () => { sheetTab = t.dataset.tab; refreshSheet(); $('#sheetBody').scrollTop = 0; }));

  on('toast', d => toast(d.text, d.icon, d.bad));
  on('bagPop', k => { const n = $('#bagN'); n.parentElement.classList.remove('shake'); if (RES[k] && RES[k].master && once('o' + k)) toast(RES[k].label + ' · Atölye’de ' + UPGRADES[RES[k].master].name + ' açar', k); });
  on('bagFull', () => { const m = $('#bagM'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake'); toast('Çanta dolu — yüzeye dön', 'bag', true); if (G.tutorial && G.tutorial.step < 2) tutStep(2); });
  on('storePop', k => { const c = $('#r_' + k); if (!c) return; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); });
  on('deposit', () => { refreshSheet(); });
  on('hurt', () => { const v = $('#vignette'); v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit'); });
  on('stratum', s => {
    const b = STRATA[biomeOf(s)];
    banner((b.legend ? 'EFSANEVİ BİYOM' : 'BİYOM ' + (s + 1)) + ' · ' + s * STRATUM_ROWS + 'M', b.name.toUpperCase(), b.legend ? 'gold' : false);
    if (b.desc && once('b' + biomeOf(s))) setTimeout(() => toast(b.desc, 'depth'), 2600);
  });
  on('modChanged', () => { if (sheetOpen()) refreshSheet(); refreshHUD(true); });
  on('gearChanged', () => { if (sheetOpen()) refreshSheet(); refreshHUD(true); });
  on('modUsed', () => refreshHUD(true));
  on('chill', () => { const v = $('#vignette'); v.classList.add('cold'); setTimeout(() => v.classList.remove('cold'), 1800); });
  on('threat', d => {
    const lv = d.level;
    if (!d.up) return;
    if (lv === 1) { if (G.tutorial && !G.tutorial.noiseSeen) { G.tutorial.noiseSeen = true; coach('Kazma gürültü yapar. Gürültü yuvaları uyandırır: sessiz kal ya da yuvayı yık.', '', 7); } }
    else if (lv === 2) toast('Yuvalar uyandı', 'wave', true);
    else if (lv === 3) toast('Elitler geliyor', 'skull', true);
    else if (lv === 4) { const B = ENEMIES[G.threat.bossType]; banner(B ? up(B.name) : 'AV', B ? up(B.title) : 'SENİ AVLIYOR', true); }
  });
  on('nestDown', d => {
    toast(d.left ? `Yuva yıkıldı · bu biyomda ${d.left} kaldı` : 'Yuva yıkıldı', 'wave');
    if (G.tutorial && !G.tutorial.done) { G.tutorial.done = true; App.meta.tutorialDone = true; saveMeta(App.meta); coach('Harika. Derine in: yeni katmanlar, daha değerli cevherler.', '', 5); }
  });
  on('beacon', () => toast('Biyom temiz · fener dikildi', 'lamp'));
  on('bossDown', k => banner((ENEMIES[k] ? up(ENEMIES[k].name) : 'BOSS') + ' DÜŞTÜ', 'MADEN SUSUYOR'));
  on('horde', () => banner('DALGA GELİYOR', 'OK YÖNÜNE HAZIRLAN', true));
  on('hordeDone', () => toast('Dalga bitti · kısa bir nefes arası', 'wave'));
  on('bossWarn', k => banner((ENEMIES[k] ? up(ENEMIES[k].name) : 'BİR ŞEY') + ' UYANIYOR', 'HEMEN SUS YA DA KAÇ', true));
  on('bossSpawn', k => { const B = ENEMIES[k]; if (B && once(k)) setTimeout(() => toast(B.lore, 'skull', true), 2600); });
  on('balrog', k => { if (k === 'dark') toast('Derinden davul sesleri geliyor… ışık sönüyor', 'skull', true); else if (k === 'eyes') toast('Gölgede bir şey sana bakıyor', 'skull', true); });
  on('bossPhase', k => { const B = ENEMIES[k]; if (B) banner(up(B.name), 'ÖFKELENDİ', true); });
  on('event', d => { const e = EVENTS[d.k]; if (!e) return; if (d.phase === 'warn') banner(e.name, e.sub, e.good ? 'gold' : true); else if (d.k === 'karanlik') toast('Fenerin kısıldı · ' + e.t + ' sn', 'lamp', true); });
  on('ping', d => { if (!G.mp) return; const p = G.players[d.pi]; if (d.pi !== G.localIdx) { toast((p && p.name || 'Partner') + ' işaret bıraktı', 'hand'); sfx.ping(); } else sfx.click(); });
  on('deployed', () => refreshHUD(true));
  on('relic', d => {
    const R = RELICS[d.k];
    if (!R) return;
    if (d.again) { toast('Eser zaten sende: altın yağmuru', 'gold'); return; }
    saveMeta(App.meta);
    banner('EFSANEVİ ESER', R.name.toUpperCase(), 'gold');
    const who = d.pi === G.localIdx ? '' : (G.players[d.pi] && G.players[d.pi].name || 'Partner') + ' buldu · ';
    setTimeout(() => toast(who + R.desc, R.icon), 2600);
    refreshHUD(true);
  });
  on('perkOffer', pi => { if (pi === G.localIdx) showPerks(); else toast('Partnerin bir kalıntı buldu', 'chest'); });
  on('resonance', d => { const S = SOY[d.soy]; banner('REZONANS', S.name, 'gold'); setTimeout(() => toast(S.res, S.icon), 2400); });
  on('perkTaken', d => { if (d.pi !== G.localIdx) { const o = offerInfo(d.k); toast('Partner seçti: ' + o.name, o.icon); } });
  on('blind', () => { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); });
  on('fear', () => { const v = $('#vignette'); v.classList.add('fear'); setTimeout(() => v.classList.remove('fear'), 2400); });
  on('cmdDone', d => { if (!d.ok && (d.cmd.t === CMD.BUILD)) toast('Yetersiz kaynak', 'bag', true); });
  on('heart', () => banner('KALP KRİSTALİ', 'YÜZEYE TAŞI!', true));
  on('playerDown', d => toast(d.autoUp ? 'Bayıldın — ikinci nefes!' : G.mp ? 'Bayıldın — partnerin seni kaldırabilir' : 'Bayıldın', 'skull', true));
  on('respawn', () => {});
  on('upgraded', () => { refreshSheet(); });
  on('store', () => { if (sheetOpen()) refreshSheet(); });
  on('crafted', () => {
    if (sheetOpen()) refreshSheet();
    if (App.meta.seenBelt) return;
    App.meta.seenBelt = true; saveMeta(App.meta);
    coach(App.settings.lefty ? 'Eşyalar sağ alttaki kemerde. Dokunarak kullan.' : 'Eşyalar sol alttaki kemerde. Dokunarak kullan.', '', 4);
  });
  on('schematic', sc => {
    saveMeta(App.meta);
    const d = sc.kind === 'item' ? ITEMS[sc.key] : BUILDS[sc.key];
    setTimeout(() => toast('Şema bulundu: ' + d.name, 'schematic'), 150);
  });
  on('tut', ev => tutEvent(ev));
  $('#coach').addEventListener('click', () => {});
}

function tap(el, fn) {
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.addEventListener('click', e => { e.stopPropagation(); initAudio(); sfx.click(); fn(e); });
}

// ---------------- HUD ----------------
let cache = {};
function set(id, key, val, fn) { if (cache[key] === val) return; cache[key] = val; fn(val); }
export function showHUD(v) { coach(''); $('#hud').classList.toggle('hidden', !v); $('#chatBtn').classList.toggle('on', v && !!(G && G.mp)); $('#chat').classList.remove('on'); if (!v) { $('#workshopBtn').classList.add('hide'); $('#belt').innerHTML = ''; $('#mods').innerHTML = ''; } cache = {}; }
// hızlı mesaj çipleri (co-op): simülasyon dışı, anında iletilir
export const CHAT = { here: 'Buraya gel!', help: 'Yardım!', camp: 'Kampa dönelim', gj: 'İyi iş!', nest: 'Yuva buldum', quiet: 'Sessiz ol' };
function toggleChat() {
  const c = $('#chat');
  if (c.classList.contains('on')) { c.classList.remove('on'); return; }
  c.innerHTML = Object.keys(CHAT).map(k => `<button class="plate chip" data-k="${k}">${CHAT[k]}</button>`).join('');
  c.classList.add('on');
  c.querySelectorAll('.chip').forEach(b => tap(b, () => { hooks.chat(b.dataset.k); c.classList.remove('on'); }));
}
const bubbles = {};
export function chatBubble(pi, k) { bubbles[pi] = { text: CHAT[k] || '…', t: performance.now() }; }
export function bubbleFor(pi) { const b = bubbles[pi]; return b && performance.now() - b.t < 2600 ? b.text : ''; }
// sağ kenar: takılı blaster eklentileri (aktifler dokunulabilir, bekleme süresi dolgu olarak)
function renderMods() {
  const box = $('#mods'), p = G.player, g = G.gear;
  if (p.dead || !g.eq.length) { box.innerHTML = ''; return; }
  box.innerHTML = g.eq.map(k => {
    const m = MODS[k];
    if (!m.active) return `<div class="btn dark mod passive" aria-label="${m.name}">${ic(m.icon, 'l')}</div>`;
    const cd = Math.max(0, g.cd[k] || 0), on = (g.active[k] || 0) > 0;
    return `<button class="btn dark mod ${cd <= 0 && !on ? 'ready' : ''} ${on ? 'on' : ''}" data-k="${k}" aria-label="${m.name}">${ic(m.icon, 'l')}<div class="cd" style="height:${Math.round(cd / m.cd * 100)}%"></div></button>`;
  }).join('');
  box.querySelectorAll('.mod[data-k]').forEach(el => tap(el, () => { dispatch({ t: CMD.MODUSE, k: el.dataset.k }); refreshHUD(true); }));
}
function renderBelt() {
  const b = $('#belt'), p = G.player;
  if (p.dead) { b.innerHTML = ''; return; }
  b.innerHTML = ITEM_KEYS.filter(k => G.items[k] > 0).map(k =>
    `<button class="btn dark slot ${itemUsable(k) ? '' : 'off'} ${k === 'recall' && p.recallT > 0 ? 'busy' : ''}" data-k="${k}" aria-label="${ITEMS[k].name}">${ic(ITEMS[k].icon, 'l')}<span class="n">${G.items[k]}</span></button>`).join('');
  b.querySelectorAll('.slot').forEach(el => tap(el, () => { dispatch({ t: CMD.USE, k: el.dataset.k }); refreshHUD(true); }));
}

export function refreshHUD(force = false) {
  if (force) cache = {};
  const p = G.player, b = G.base;
  set(0, 'hp', Math.ceil(p.hp) + '/' + p.maxHp, () => {
    const f = Math.max(0, p.hp / p.maxHp) * 100;
    const bar = $('.bar.hp'); bar.children[1].style.width = `calc(${f}% - ${f / 25}px)`; bar.children[0].style.width = `calc(${f}% - ${f / 25}px)`;
    $('#vignette').classList.toggle('low', f < 30 && !p.dead);
  });
  const th = G.threat;
  set(0, 'noise', Math.round(th.noise) + '|' + th.level, () => {
    const f = Math.max(0, Math.min(100, th.noise));
    const bar = $('.bar.base'); bar.children[1].style.width = `calc(${f}% - ${f / 25}px)`; bar.children[0].style.width = `calc(${f}% - ${f / 25}px)`;
    $('#noiseM').className = 'plate meter noise lv' + th.level;
  });
  const bc = bagCount();
  set(0, 'bag', bc + '/' + G.bagCap, () => {
    const f = Math.min(1, bc / G.bagCap) * 100;
    $('.bar.bag > i').style.width = `calc(${f}% - ${f / 25}px)`;
    $('.bar.bag').classList.toggle('full', bc >= G.bagCap);
    const n = $('#bagN'); n.textContent = bc + '/' + G.bagCap; n.classList.toggle('full', bc >= G.bagCap);
  });
  for (const k of BASE_RES) set(0, 'r' + k, G.store[k], v => { $('#r_' + k + ' span').textContent = v; });
  const row = Math.floor(p.y / TILE), depth = Math.max(0, row - 6);
  set(0, 'depth', depth, v => { $('#dM').textContent = v + 'm'; });
  const st = stratumOfRow(row);
  set(0, 'strat', st, v => { const b = v < 0 ? null : STRATA[biomeOf(v)]; $('#dS').textContent = b ? b.short : 'YÜZEY'; $('#dS').classList.toggle('legend', !!(b && b.legend)); });

  const lv = th.level, alive = G.enemies.filter(e => !e.dead).length;
  const wc = lv >= 4 ? 'active boss' : lv >= 2 ? 'active' : lv === 1 ? 'warn' : (th.noise < 2 && !(G.tutorial && G.tutorial.step >= 3) ? 'hide' : '');
  set(0, 'wc', wc, v => { $('#wave').className = 'plate ' + v; });
  set(0, 'wl', LEVEL_NAMES[lv], v => { $('#wave .l').textContent = v; });
  set(0, 'wt', lv >= 1 && alive ? alive + ' düşman' : '', v => { $('#wave .t').textContent = v; });
  // hedef: bulunduğun biyomun yuvaları
  const gs = Math.max(0, st), left = nestsInStratum(gs), tot = nestTotalInStratum(gs);
  const gtxt = st < 0 ? (G.beacons.length ? `FENER ${G.beacons.length}/${STRATA_COUNT}` : 'DERİNE İN') : G.beacons.includes(gs) ? 'BİYOM TEMİZ' : tot ? `YUVA ${tot - left}/${tot}` : 'YUVA ARA';
  set(0, 'goal', gtxt + '|' + (st >= 0 && !G.beacons.includes(gs) && left === 0 && tot === 0 ? 'x' : ''), () => { $('#goal .g').textContent = gtxt; $('#goal').classList.toggle('done', st >= 0 && G.beacons.includes(gs)); });
  const boss = G.enemies.find(e => e.d.boss && !e.dead);
  set(0, 'boss', boss ? boss.type + Math.ceil(boss.hp) : -1, v => {
    $('#boss').classList.toggle('on', v !== -1);
    if (boss) $('#boss .bn').textContent = up(boss.d.name);
    if (boss) $('#boss .bar > i').style.width = `calc(${boss.hp / boss.maxHp * 100}% - 4px)`;
  });

  // partner + bağlantı
  const mate = G.mp ? G.players[1 - G.localIdx] : null;
  set(0, 'mate', mate ? (mate.dead ? 'x' : Math.ceil(mate.hp) + '|' + Math.max(0, Math.floor(mate.y / TILE) - 6)) : '', v => {
    $('#partner').classList.toggle('on', !!mate);
    if (!mate) return;
    $('#partner .pn').textContent = (mate.name || 'PARTNER').toUpperCase().slice(0, 10);
    $('#partner .bar > i').style.width = `calc(${Math.max(0, mate.hp / mate.maxHp) * 100}% - 4px)`;
    $('#partner .d').textContent = mate.dead ? 'BAYGIN' : Math.max(0, Math.floor(mate.y / TILE) - 6) + 'm';
  });
  set(0, 'ping', G.mp ? (net.rtt ? Math.round(net.rtt / 10) * 10 : 0) + '|' + net.quality : '', v => {
    if (!G.mp) return;
    const el = $('#partner .ping'); el.textContent = net.rtt ? Math.round(net.rtt / 10) * 10 + 'ms' : '…';
    el.className = 'ping q-' + net.quality;
  });
  // partner baygın
  set(0, 'ind', !!(mate && mate.dead && !mate.gone), v => $('#indicator').classList.toggle('on', v));

  // atölye butonu
  const surf = p.y < GROUND_Y && !p.dead && !(G.tutorial && G.tutorial.step < 3);
  const any = anyAffordable() || !!(G.merchant && G.merchant.goods.some(g => !g.sold && (G.store.gold | 0) >= g.cost));
  set(0, 'ws', surf, v => $('#workshopBtn').classList.toggle('hide', !v));
  const elev = !p.dead && !p.ride && atShaft(p) && destinations(p).length > 0;
  const wl = nearWell(p) && !(G.tutorial) ? wellCost() + (G.wish ? 'w' : '') + ((G.store.gold | 0) >= wellCost() ? '' : 'x') : '';
  set(0, 'well', wl, v => { const b = $('#wellBtn'); b.classList.toggle('hide', !v); if (v) { $('#wellC').textContent = wellCost(); b.disabled = !!G.wish || (G.store.gold | 0) < wellCost(); } });
  const li = G.tutorial ? -1 : lakeAt(p), fish = li >= 0 ? G.lakes[li].fish + (p.fish ? 'f' : '') : '';
  set(0, 'fish', fish, v => { const b = $('#fishBtn'); b.classList.toggle('hide', !v); if (v) { $('#fishC').textContent = G.lakes[li].fish; b.disabled = !!p.fish; } });
  set(0, 'elev', elev, v => { $('#elevBtn').classList.toggle('hide', !v); if (!v) hidePop(); });
  set(0, 'wsb', any, v => $('#workshopBtn').classList.toggle('has', v));
  // eşya kemeri: sadece elindeki eşyalar; kullanılamayan soluk
  let bk = '';
  if (!p.dead) for (const k of ITEM_KEYS) if (G.items[k] > 0) bk += k + G.items[k] + (itemUsable(k) ? '+' : '-') + (k === 'recall' && p.recallT > 0 ? 'r' : '');
  set(0, 'belt', bk, () => renderBelt());
  const g = G.gear;
  let mk = p.dead ? '' : g.eq.map(k => k + (MODS[k].active ? Math.ceil(Math.max(0, g.cd[k] || 0)) + ((g.active[k] || 0) > 0 ? 'a' : '') : '')).join(',');
  set(0, 'mods', mk, () => renderMods());
  set(0, 'lefty', App.settings.lefty, v => ui.parentElement.classList.toggle('lefty', v));
}
function fmt(t) { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function anyAffordable() {
  for (const k of UPGRADE_KEYS.concat(PICK_KEYS, MASTER_KEYS)) { const c = upgradeCost(k); if (c && canAfford(c) && !beaconLack(k)) return true; }
  for (const k of G.gear.wOwn) { const c = weaponUpCost(k); if (c && canAfford(c)) return true; }
  for (const k of MOD_KEYS) if (!G.gear.owned.includes(k) && canAfford(MODS[k].cost)) return true;
  for (const k of WEAPON_KEYS) if (!G.gear.wOwn.includes(k) && canAfford(WEAPONS[k].cost)) return true;
  for (const k of PICK_TYPE_KEYS) if (!G.gear.pOwn.includes(k) && canAfford(PICK_TYPES[k].cost)) return true;
  return false;
}

// ---------------- bildirimler ----------------
const seen = new Set();
const once = k => !seen.has(k) && !!seen.add(k);
const lastShown = new Map();
function recent(k, ms) {
  const now = performance.now(), t = lastShown.get(k);
  if (t && now - t < ms) return true;
  lastShown.set(k, now); return false;
}
export function toast(text, icon, bad) {
  if (recent(text, 10000)) return;
  const box = $('#toasts');
  while (box.children.length > 1) box.firstChild.remove();
  const t = document.createElement('div');
  t.className = 'plate toast' + (bad ? ' bad' : '');
  t.innerHTML = (icon ? ic(icon) : '') + '<span></span>';
  t.lastChild.textContent = text;
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1900);
  setTimeout(() => t.remove(), 2200);
}
let bannerTO = 0;
export function banner(k, n, red) {
  if (recent(k + n, 20000)) return;
  const b = $('#banner');
  b.querySelector('.k').textContent = k; b.querySelector('.n').textContent = n;
  b.className = red === 'gold' ? 'gold' : red ? 'red' : '';
  void b.offsetWidth; b.classList.add('on');
  clearTimeout(bannerTO); bannerTO = setTimeout(() => b.classList.remove('on'), 2700);
}
let coachTO = 0;
export function coach(text, mode = '', secs = 0) {
  const c = $('#coach');
  clearTimeout(coachTO);
  if (!text) { c.className = ''; return; }
  c.querySelector('.msg').textContent = text;
  c.className = 'on ' + mode;
  if (secs) coachTO = setTimeout(() => { c.className = ''; }, secs * 1000);
}

// ---------------- öğretici (oynatarak) ----------------
function tutStep(n) {
  const T = G.tutorial; if (!T || T.step >= n) return;
  T.step = n;
  if (n === 1) coach('Parlayan cevherlere kaz — kendiliğinden toplanır.', '', 0);
  if (n === 2) coach('Çantanı boşaltmak için yüzeye dön.', '', 0);
  if (n === 3) { coach('Cevherler depoda. Atölye\'den ilk yükseltmeni al!', '', 0); $('#workshopBtn').classList.add('pulse'); }
  if (n === 4) { coach('', ''); $('#workshopBtn').classList.remove('pulse'); }
}
function tutEvent(ev) {
  const T = G.tutorial; if (!T) return;
  if (ev === 'pickup' && T.step < 1) tutStep(1);
  if (ev === 'pickup' && T.step === 1 && bagCount() >= 5) tutStep(2);
  if (ev === 'deposit' && T.step < 3) tutStep(3);
  if (ev === 'bought' && T.step === 3) tutStep(4);
}
export function tutorialTick(dt) {
  const T = G.tutorial; if (!T || T.done) return;
  T.t += dt;
  if (T.step === 0) {
    if (!T.shown && T.t > 0.6) { T.shown = true; coach('Ekranın alt yarısına bas, aşağı sürükle: kaz!', '', 0); document.getElementById('stick').classList.add('hint'); }
    if (G.stats.dug >= 1 && T.t > 1) { coach('Harika! Kazmaya devam et.', '', 2.5); document.getElementById('stick').classList.remove('hint'); T.step = 0.5; }
  }
  if (T.step === 0.5 && G.stats.dug >= 4) { T.step = 0; tutStep(1); }
  if (T.step === 1 && T.t > 50 && bagCount() > 0) tutStep(2);
  if (T.step === 3 && !$('#sheet').classList.contains('on') && G.player.y > GROUND_Y + 64) tutStep(4);
}

// ---------------- atölye ----------------
let merchSeen = null;
function openSheet() {
  if (G.player.y >= GROUND_Y) return;
  if (G.merchant && merchSeen !== G.merchant) { merchSeen = G.merchant; sheetTab = 'merch'; }
  hooks.pause(false, true);
  cancelStick();
  refreshSheet();
  $('#sheet').classList.add('on'); $('#sheetBack').classList.add('on');
  if (G.tutorial && G.tutorial.step === 3) coach('');
}
export function closeSheet() {
  if (!$('#sheet').classList.contains('on')) return;
  $('#sheet').classList.remove('on'); $('#sheetBack').classList.remove('on');
  hooks.resume();
  refreshHUD(true);
}
export function sheetOpen() { return $('#sheet').classList.contains('on'); }

function pips(l, max) { let s = '<span class="pips">'; for (let i = 0; i < max; i++) s += `<i class="${i < l ? 'on' : ''}"></i>`; return s + '</span>'; }

// test düğmesi: geliştirmede ya da adreste ?test varken görünür
const TEST_MODE = import.meta.env.DEV || /[?&]test/.test(location.search);
let sheetTab = 'pick';
function refreshSheet(justKey) {
  if (!G) return;
  $('#sheetStore').innerHTML = RES_KEYS.filter(k => BASE_RES.includes(k) || G.store[k] > 0).map(k => `<span class="chip">${ic(k, 's')}<span>${G.store[k]}</span></span>`).join('');
  $('#sheetStats').innerHTML = statsHTML(ic);
  const n = tabCounts();
  if (sheetTab === 'merch' && !G.merchant) sheetTab = 'pick';
  $('#sheet .tab[data-tab="merch"]').classList.toggle('hide', !G.merchant);
  document.querySelectorAll('#sheet .tab').forEach(t => { t.classList.toggle('on', t.dataset.tab === sheetTab); t.querySelector('.cnt').textContent = n[t.dataset.tab] || ''; });
  renderShop($('#sheetBody'), sheetTab, justKey, {
    ic, tap, pickIconURL, contractsHTML,
    after(k, bought) { refreshSheet(k); if (k) refreshHUD(true); if (bought) tutEvent('bought'); },
  });
}

// kademe renkli küçük kazma ikonu (atölye kartı için)
const pickIconCache = {};
function pickIconURL(l) {
  if (pickIconCache[l]) return pickIconCache[l];
  const t = PICK_TIERS[Math.min(PICK_TIERS.length - 1, l)];
  const c = document.createElement('canvas'); c.width = 12; c.height = 12; const x = c.getContext('2d');
  const px = (col, a, b, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  // sap: sol alttan sağ üste
  for (let i = 0; i < 8; i++) { px('#140c1c', 1 + i, 10 - i, 3, 1); }
  for (let i = 0; i < 8; i++) { px(t.handle, 2 + i, 10 - i, 1, 1); }
  // baş: üst sağda yatay kavis
  px('#140c1c', 4, 0, 8, 4); px(t.head, 5, 1, 6, 2); px(t.headL, 5, 1, 6, 1); px('#ffffff', 10, 1, 1, 1);
  if (t.glow) { px('rgba(255,255,255,0.5)', 6, 2, 1, 1); }
  return (pickIconCache[l] = c.toDataURL());
}

function contractsHTML() {
  return G.contracts.map(c => {
    const d = CONTRACTS[c.k], v = contractProgress(c);
    return `<div class="plate row contract ${c.done ? 'done' : ''}">${ic(c.done ? 'check' : d.icon, 'l')}<div class="main"><div class="name">${d.text(c.n)}</div>
      <div class="eff">${c.done ? 'Tamamlandı' : v + ' / ' + c.n} · <span class="ozline">${ic('oz', 's')}+${Math.round(d.oz * G.mods.oz)}</span></div></div></div>`;
  }).join('');
}
export function showContractsToast() {
  if (!G || !G.contracts.length) return;
  toast('Kontrat: ' + CONTRACTS[G.contracts[0].k].text(G.contracts[0].n), 'contract');
}

// ---------------- alet geri alma (dokun) ----------------
export function handleTap(fx, fy) {
  hidePop();
  if (!G || G.paused || G.player.dead) return false;
  const w = viewToWorld(fx, fy);
  for (let i = 0; i < G.structures.length; i++) {
    const s = G.structures[i];
    if (Math.abs(w.x - s.x) < 14 && Math.abs(w.y - (s.y - 8)) < 16 && Math.hypot(s.x - G.player.x, s.y - G.player.y) <= 40) { showPop(i); return true; }
  }
  return false;
}
function showPop(i) {
  const s = G.structures[i], b = BUILDS[s.type], pop = $('#pop');
  pop.classList.remove('elev');
  pop.innerHTML = `<div class="plate row">${ic(b.icon, 'l')}<div class="main"><div class="name">${b.name}</div><div class="eff">${Math.ceil(s.hp)}/${s.maxHp} · ${b.desc}</div></div></div><button class="btn" data-pick="1">GERİ AL</button>`;
  const v = worldToView(s.x, s.y - 12);
  const R = ui.getBoundingClientRect();
  pop.style.left = '0px'; pop.style.top = '0px'; pop.classList.add('on');
  const ph = pop.offsetHeight;
  let left = v.x * R.width - 110, top = v.y * R.height - ph - 20;
  left = Math.max(8, Math.min(R.width - 228, left)); top = Math.max(110, top);
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  tap(pop.querySelector('[data-pick]'), () => { dispatch({ t: CMD.PICKUP, i }); hidePop(); refreshHUD(true); });
}
export function hidePop() { $('#pop').classList.remove('on', 'elev'); }
// asansör hedefleri
// asansör paneli: düğmenin hemen üstünde kat listesi; tekrar basınca kapanır
function showElevPop() {
  const p = G.player, pop = $('#pop');
  if (pop.classList.contains('elev')) { hidePop(); return; }
  const ds = destinations(p);
  if (!ds.length) return;
  const floors = [-1, ...G.stations];
  pop.innerHTML = floors.map(s => {
    const here = !ds.includes(s);
    return `<button class="efl${here ? ' here' : ''}${s === -1 ? ' camp' : ''}" data-to="${s}"${here ? ' disabled' : ''}>${ic(s === -1 ? 'base' : 'depth', 's')}<span>${s === -1 ? 'KAMP' : STRATA[biomeOf(s)].short}</span><b>${here ? 'BURADASIN' : s === -1 ? 'YÜZEY' : s * STRATUM_ROWS + 'M'}</b></button>`;
  }).join('');
  const R = ui.getBoundingClientRect(), B = $('#elevBtn').getBoundingClientRect();
  pop.style.left = '0px'; pop.style.top = '0px'; pop.classList.add('on', 'elev');
  const w = pop.offsetWidth, lefty = B.left - R.left < R.width / 2;
  pop.style.left = Math.max(8, Math.min(R.width - w - 8, lefty ? B.left - R.left : B.right - R.left - w)) + 'px';
  pop.style.top = Math.max(110, B.top - R.top - pop.offsetHeight - 10) + 'px';
  pop.querySelectorAll('[data-to]:not([disabled])').forEach(b => tap(b, () => { dispatch({ t: CMD.ELEV, to: +b.dataset.to }); hidePop(); }));
}

// ---------------- perk seçimi ----------------
// soy şeridi: her soyun kalıntı sayısı (3'te rezonans)
function soyBar() {
  return `<div class="soybar">${SOY_KEYS.map(s => { const n = soyCount(s), S = SOY[s]; return `<span class="soyc ${n ? 'on' : ''} ${n >= RESONANCE ? 'res' : ''}" style="--c:${S.col}">${ic(S.icon, 's')}<i>${Array.from({ length: RESONANCE }, (_, k) => `<b class="${k < n ? 'f' : ''}"></b>`).join('')}</i></span>`; }).join('')}</div>`;
}
function showPerks() {
  const off = G.perkOffer;
  if (!off || !off.keys.length) return;
  const ch = off.keys, arms = (CHESTS[off.chest] || {}).arms, cost = rerollCost();
  hooks.pause(false, true); cancelStick();
  const s = $('#perk');
  const cn = ((CHESTS[off.chest] || CHESTS.wood).name).toLocaleUpperCase('tr');
  s.innerHTML = `<div class="perkhead"><div class="k">${cn}</div><div class="n">Birini seç</div>${G.mp ? '<div class="k" style="margin-top:6px">OYUN DEVAM EDİYOR</div>' : ''}</div>
    ${arms ? '' : soyBar()}
    <div class="cards">${ch.map((k, i) => { const o = offerInfo(k);
      const lv = o.max > 1 ? `<span class="lvp">${Array.from({ length: o.max }, (_, q) => `<b class="${q < o.lv ? 'f' : ''}"></b>`).join('')}</span>` : '';
      const res = o.kind === 'soy' && !o.up ? (() => { const n = soyCount(o.soy) + 1; return n >= RESONANCE ? `<div class="resl">${n === RESONANCE ? 'REZONANS AÇILIR: ' : 'Rezonans: '}${SOY[o.soy].res}</div>` : `<div class="resl dim">${SOY[o.soy].name} ${n}/${RESONANCE} · rezonansa ${RESONANCE - n}</div>`; })() : '';
      return `<button class="plate card k-${o.kind || 'arm'} ${o.up ? 'up' : ''}" data-k="${k}" style="--c:${o.col || '#9fe8ff'};animation-delay:${0.08 + i * 0.07}s"><span class="ci">${ic(o.icon, 'xl')}</span>
      <div class="cm"><div class="tag">${o.tag}</div><div class="name">${o.name}${lv}</div><div class="desc">${o.desc}</div>${res}</div></button>`; }).join('')}</div>
    <button class="btn dark reroll" id="reroll" ${(G.store.gold | 0) >= cost ? '' : 'disabled'}>YENİDEN ÇEK ${cost ? `· ${ic('gold', 's')}${cost}` : '· BEDAVA'}</button>`;
  s.classList.add('on');
  s.querySelectorAll('.card').forEach(c => tap(c, () => {
    dispatch({ t: CMD.PERK, k: c.dataset.k }); s.classList.remove('on'); hooks.resume(); refreshHUD(true);
    const o = offerInfo(c.dataset.k); toast(o.up ? `${o.name} ${ROMAN[o.lv]}` : o.name, o.icon);
  }));
  tap($('#reroll'), () => { if (dispatch({ t: CMD.REROLL })) sfx.click(); else sfx.deny(); });
}
export function setNetStall(v) { const el = $('#netstall'); el.classList.toggle('on', !!v); if (v && el.textContent !== v) el.textContent = v; }

// ---------------- çok oyunculu lobi ----------------
const esc = t => String(t || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const helmDot = (h, big) => `<span class="helm ${big ? 'big' : ''}" style="background:${HELMETS[(h | 0) % HELMETS.length].c}"><i></i></span>`;

export function showCoop(back) {
  const s = $('#room'), S = App.settings;
  s.innerHTML = `<div class="lobby">
    <div class="lhead"><div class="k">BİRLİKTE KAZ</div><div class="n">İki madenci · aynı maden · Öz ×1.5</div></div>
    <button class="plate lcard me" id="rMe">${helmDot(S.helm, true)}<div class="main"><div class="name">${esc(S.name)}</div><div class="eff">${ROLES[S.role] ? ROLES[S.role].name + ' · ' : ''}Ad, kask ve rolünü değiştir</div></div><span class="chev">›</span></button>
    <button class="plate lcard primary" id="rQuick">${ic('hand', 'xl')}<div class="main"><div class="name">HIZLI EŞLEŞ</div><div class="eff">Bekleyen bir madenci bul. Yoksa sen bekle, biri gelir.</div></div></button>
    <button class="plate lcard" id="rHost">${ic('base', 'xl')}<div class="main"><div class="name">ODA KUR</div><div class="eff">Arkadaşına davet linki gönder. Tıklayan doğrudan odaya düşer.</div></div></button>
    <details class="lmore"><summary>Kodla katıl</summary>
      <div class="lrow"><input class="codein small" id="rCode" maxlength="4" placeholder="KOD" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn" id="rJoin">KATIL</button></div>
    </details>
    <button class="btn dark" id="rBack">GERİ</button></div>`;
  hideScreens(); s.classList.add('on');
  tap($('#rMe'), () => showProfile(() => showCoop(back)));
  tap($('#rQuick'), () => hooks.quickMatch());
  tap($('#rHost'), () => hooks.hostRoom());
  const inp = $('#rCode');
  inp.addEventListener('pointerdown', e => e.stopPropagation());
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4); });
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && inp.value.length === 4) hooks.joinRoom(inp.value); });
  tap($('#rJoin'), () => { if (inp.value.length === 4) hooks.joinRoom(inp.value); else toast('4 haneli oda kodu gir', 'skull', true); });
  tap($('#rBack'), () => { s.classList.remove('on'); back(); });
}

// ad + kask rengi
export function showProfile(back) {
  const s = $('#room'), S = App.settings;
  s.innerHTML = `<div class="lobby">
    <div class="lhead"><div class="k">MADENCİ KARTI</div><div class="n">Partnerin seni böyle görür</div></div>
    <div class="plate lcard me">${helmDot(S.helm, true)}<div class="main"><input class="namein" id="pName" maxlength="14" value="${esc(S.name)}" placeholder="Adın" autocomplete="off" spellcheck="false"><div class="eff">En fazla 14 karakter</div></div></div>
    <div class="sec">KASK RENGİ</div>
    <div class="helms" id="pHelms">${HELMETS.map((h, i) => `<button class="hb ${i === (S.helm | 0) ? 'on' : ''}" data-i="${i}" aria-label="${h.name}"><span class="helm big" style="background:${h.c}"><i></i></span><small>${h.name}</small></button>`).join('')}</div>
    <div class="sec">ROL</div>
    <div class="helms" id="pRoles">${ROLE_KEYS.map(k => `<button class="hb ${k === S.role ? 'on' : ''}" data-r="${k}">${ic(ROLES[k].icon, 'l')}<small>${ROLES[k].name}</small></button>`).join('')}</div>
    <div class="eff" id="pRoleDesc">${ROLES[S.role] ? ROLES[S.role].desc : 'Bir rol seç.'}</div>
    <button class="btn big" id="pOk">TAMAM</button></div>`;
  hideScreens(); s.classList.add('on');
  const inp = $('#pName');
  inp.addEventListener('pointerdown', e => e.stopPropagation());
  inp.addEventListener('keydown', e => e.stopPropagation());
  const commit = () => { const v = inp.value.trim().slice(0, 14); if (v) S.name = v; saveSettings(S); };
  inp.addEventListener('change', commit);
  s.querySelectorAll('.hb[data-i]').forEach(b => tap(b, () => { S.helm = +b.dataset.i; saveSettings(S); s.querySelectorAll('.hb[data-i]').forEach(x => x.classList.toggle('on', x === b)); $('.lcard.me .helm').style.background = HELMETS[S.helm].c; }));
  s.querySelectorAll('[data-r]').forEach(b => tap(b, () => { S.role = b.dataset.r; saveSettings(S); s.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); $('#pRoleDesc').textContent = ROLES[S.role].desc; sfx.click(); }));
  tap($('#pOk'), () => { commit(); s.classList.remove('on'); back(); });
}

const seat = (p, label) => p
  ? `<div class="plate seat ${p.ready ? 'ready' : ''}">${helmDot(p.helm, true)}<div class="sname">${esc(p.name)}</div>${ROLES[p.role] ? `<div class="srole">${ic(ROLES[p.role].icon, 's')}${ROLES[p.role].name}</div>` : ''}<div class="sstate">${p.ready ? 'HAZIR' : label}</div></div>`
  : `<div class="plate seat empty"><span class="helm big ghost"><i></i></span><div class="sname">—</div><div class="sstate waitdots">${label}</div></div>`;

export function showRoom(L) {
  App.scene = 'room';
  const s = $('#room');
  const st = L.status;
  let head, hint = '', actions = '';
  if (st === 'error') { head = ['SORUN', L.error]; actions = `${L.quick ? '<button class="btn big" id="rRetry">TEKRAR DENE</button>' : ''}<button class="btn dark" id="rLeave">GERİ</button>`; }
  else if (st === 'search') { head = ['MADENCİ ARANIYOR', 'Bekleyen biri varsa saniyeler içinde eşleşirsin']; actions = '<button class="btn dark" id="rLeave">İPTAL</button>'; }
  else if (st === 'connecting') { head = [L.host ? 'ODA KURULUYOR' : 'ODAYA GİRİLİYOR', L.code ? 'Kod ' + L.code : 'Sinyal sunucusuna bağlanılıyor']; actions = '<button class="btn dark" id="rLeave">İPTAL</button>'; }
  else if (L.starting) { head = ['SEFER BAŞLIYOR', 'Kazmalar hazır']; }
  else if (st === 'waiting') {
    head = L.quick ? ['SIRA SENDE', 'Odayı sen açtın, ilk gelen madenci yanına oturur'] : ['ODA HAZIR', 'Partnerini davet et'];
    hint = L.quick ? '' : `<div class="codeline">KOD <b>${L.code}</b></div>`;
    actions = `${L.quick ? '' : '<button class="btn big" id="rShare">' + ic('hand') + ' DAVET LİNKİ PAYLAŞ</button>'}<button class="btn dark" id="rLeave">İPTAL</button>`;
  } else {
    const both = L.me.ready && L.mate && L.mate.ready;
    head = ['EKİP TAMAM', both ? 'Başlıyor…' : L.me.ready ? 'Partnerin hazır olunca başlar' : 'Hazır olduğunda dokun'];
    actions = `<button class="btn big ${L.me.ready ? 'dark' : ''}" id="rReady">${L.me.ready ? 'HAZIR ✓ (GERİ AL)' : 'HAZIRIM'}</button><button class="btn dark" id="rLeave">AYRIL</button>`;
  }
  const searching = st === 'search' || st === 'connecting';
  s.innerHTML = `<div class="lobby">
    <div class="lhead"><div class="k">${head[0]}</div><div class="n">${head[1]}</div></div>
    <div class="seats ${searching ? 'radar' : ''}">
      ${seat(L.me, 'SEN')}
      <div class="amp">&amp;</div>
      ${L.mate ? seat(L.mate, 'PARTNER') : seat(null, st === 'search' ? 'Aranıyor' : st === 'connecting' ? 'Bağlanıyor' : 'Bekleniyor')}
    </div>
    ${hint}
    <div class="lactions">${actions}</div></div>`;
  hideScreens(); s.classList.add('on');
  if ($('#rShare')) tap($('#rShare'), () => hooks.share());
  if ($('#rReady')) tap($('#rReady'), () => hooks.ready(!L.me.ready));
  if ($('#rRetry')) tap($('#rRetry'), () => hooks.quickMatch());
  if ($('#rLeave')) tap($('#rLeave'), () => { s.classList.remove('on'); hooks.leaveRoom(); });
}

// ---------------- menü ----------------
const up = s => s.toLocaleUpperCase('tr-TR');

export function showMenu(hasSave) {
  const m = App.meta, S = App.settings;
  const s = $('#menu');
  let k = Math.min(m.maxKademe | 0, m.lastKademe | 0);
  const role = ROLES[S.role];
  s.innerHTML = `<div class="top"><img class="logo" src="./logo.webp" alt="FALL"><div class="subtitle">KAZ · SESSİZ KAL · DERİNE İN</div></div>
    <div class="stack">
      <div class="mrow">
        <button class="plate mchip" id="mMe">${helmDot(S.helm)}<span class="nm">${esc(S.name)}</span>${role ? ic(role.icon, 's') : ''}<span class="chev">›</span></button>
        <button class="plate mchip sq" id="mSet" aria-label="Ayarlar">${ic('gear')}</button>
      </div>
      ${hasSave ? `<button class="btn big" id="mCont">DEVAM ET</button><button class="btn dark" id="mNew">YENİ SEFER</button>` : `<button class="btn big" id="mNew">KAZMAYA BAŞLA</button>`}
      ${m.maxKademe ? `<button class="plate mline" id="mK"><span>${ic('kademe', 's')}<b id="kName"></b><small id="kDesc"></small></span><span class="chev">›</span></button>` : ''}
      ${m.tutorialDone ? `<div class="mrow three">
        <button class="plate mtile" id="mCoop">${ic('hand', 'l')}<span>BİRLİKTE</span>${m.coopWins ? `<small class="dline">${m.coopWins} ZAFER</small>` : ''}</button>
        <button class="plate mtile" id="mDaily">${ic('daily', 'l')}<span>GÜNÜN MADENİ</span>${dailyLine()}</button>
        <button class="plate mtile" id="mCamp">${ic('oz', 'l')}<span>KAMP</span></button>
      </div>` : ''}
      <div class="foot">${m.tutorialDone ? relicShelf() : ''}${m.runs ? `Rekor <b>${m.bestDepth}m</b> · ${m.runs} sefer${m.wins ? ' · ' + m.wins + ' zafer' : ''} · <span class="ozline">${ic('oz', 's')}${m.oz}</span>` : 'Yuvaları yık, fenerleri dik, çekirdeğe in.'}</div>
    </div>`;
  s.classList.add('on');
  const showK = () => { if (!$('#kName')) return; $('#kName').textContent = KADEME[k].name.toUpperCase(); $('#kDesc').textContent = k ? KADEME[k].desc.replace(/^\+ /, '') : 'Standart sefer'; };
  if (m.maxKademe) { showK(); tap($('#mK'), () => { k = (k + 1) % (m.maxKademe + 1); showK(); }); }
  tap($('#mMe'), () => { s.classList.remove('on'); showProfile(() => showMenu(hasSave)); });
  if (hasSave) tap($('#mCont'), () => hooks.continueRun());
  tap($('#mNew'), () => { m.lastKademe = k; saveMeta(m); hooks.newRun({ kademe: k }); });
  if ($('#mDaily')) tap($('#mDaily'), () => hooks.newRun({ daily: true }));
  if ($('#mCoop')) tap($('#mCoop'), () => showCoop(() => showMenu(hasSave)));
  if ($('#mCamp')) tap($('#mCamp'), () => showCamp(() => showMenu(hasSave)));
  tap($('#mSet'), () => showSettings(() => showMenu(hasSave)));
}
// efsanevi eser rafı: sahip olunanlar parlar, diğerleri gölge
function relicShelf() {
  const own = App.meta.relics || [];
  return `<div class="relics">${RELIC_KEYS.map(k => `<span class="relic ${own.includes(k) ? 'on' : ''}" title="${own.includes(k) ? RELICS[k].name : '???'}">${ic(own.includes(k) ? RELICS[k].icon : 'schematic', 's')}</span>`).join('')}</div>`;
}
function dailyLine() {
  const d = App.meta.daily;
  if (!d || d.day !== todayKey()) return '';
  return `<small class="dline">${d.win ? 'ZAFER' : d.depth + 'm'}</small>`;
}
export function hideScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); hidePop(); }

export function showPause() {
  const s = $('#pause');
  s.innerHTML = `<div class="plate rivets panel"><h2>DURAKLATILDI</h2>
    <div class="sub">Derinlik ${G.stats.maxDepth}m · Yuva ${G.stats.nests} · Fener ${G.beacons.length}${G.kademe ? ' · Kademe ' + G.kademe : ''}${G.daily ? ' · Günün Madeni' : ''}${G.mp ? ' · Birlikte (oyun duraklamaz)' : ''}</div>
    ${G.contracts.length ? '<div class="clist">' + contractsHTML() + '</div>' : ''}
    <button class="btn big" id="pRes">DEVAM</button>
    <button class="btn dark" id="pSet">AYARLAR</button>
    <button class="btn dark" id="pPhoto">${ic('daily')} FOTOĞRAF ÇEK</button>
    <button class="btn dark" id="pEnd">SEFERİ BİTİR</button></div>`;
  s.classList.add('on');
  tap($('#pRes'), () => { s.classList.remove('on'); hooks.resume(); });
  tap($('#pSet'), () => { s.classList.remove('on'); showSettings(() => showPause()); });
  tap($('#pPhoto'), () => hooks.photo());
  let armed = false;
  tap($('#pEnd'), e => {
    if (!armed) { armed = true; e.currentTarget.textContent = 'EMİN MİSİN? TEKRAR DOKUN'; e.currentTarget.classList.replace('dark', 'danger'); return; }
    s.classList.remove('on'); hooks.endRun('abandon');
  });
}
export function pauseShown() { return $('#pause').classList.contains('on') || $('#settings').classList.contains('on'); }

// döngülü ayarlar (sabit joystick yeri ve yüksekliği)
const CYC = {
  stickPos: { name: 'Sabit joystick yeri', opts: [['auto', 'Otomatik'], ['sag', 'Sağ alt'], ['sol', 'Sol alt'], ['orta', 'Orta alt']] },
  stickH: { name: 'Joystick yüksekliği', opts: [['alcak', 'Alçak'], ['orta', 'Orta'], ['yuksek', 'Yüksek']] },
};
const cycLabel = (S, k) => (CYC[k].opts.find(o => o[0] === S[k]) || CYC[k].opts[0])[1];
export function showSettings(back) {
  const S = App.settings;
  const s = $('#settings');
  const items = [['sfx', 'Ses efektleri'], ['music', 'Ambiyans'], ['haptics', 'Titreşim'], ['shake', 'Ekran sarsıntısı'], ['lefty', 'Solak mod'], ['stickFixed', 'Sabit joystick']];
  s.innerHTML = `<div class="plate rivets panel"><h2>AYARLAR</h2>
    ${items.map(([k, n]) => `<button class="plate toggle ${S[k] ? 'on' : ''}" data-k="${k}"><span>${n}</span><span class="sw"></span></button>`).join('')}
    ${Object.keys(CYC).map(k => `<button class="plate toggle cyc" data-c="${k}"><span>${CYC[k].name}</span><span class="cv">${cycLabel(S, k)} ›</span></button>`).join('')}
    <button class="plate toggle" id="sProfile"><span>Madenci kartı</span><span style="display:flex;align-items:center;gap:6px;color:var(--dim)">${esc(S.name)} ${helmDot(S.helm)}</span></button>
    <button class="plate toggle" id="sPriv"><span>Gizlilik ve destek</span><span class="cv">›</span></button>
    <button class="btn" id="sBack">TAMAM</button></div>`;
  hideScreens(); s.classList.add('on');
  tap($('#sPriv'), () => window.open((isNative ? WEB_URL : './') + 'gizlilik.html', '_blank'));
  tap($('#sProfile'), () => { s.classList.remove('on'); showProfile(() => showSettings(back)); });
  const applyStick = () => setStickMode(S.stickFixed, S.stickPos, S.stickH, S.lefty);
  s.querySelectorAll('.toggle[data-k]').forEach(t => tap(t, () => {
    S[t.dataset.k] = !S[t.dataset.k]; t.classList.toggle('on', S[t.dataset.k]); saveSettings(S); applyAudioSettings(); applyStick();
  }));
  s.querySelectorAll('.cyc').forEach(t => tap(t, () => {
    const k = t.dataset.c, o = CYC[k].opts, i = o.findIndex(x => x[0] === S[k]);
    S[k] = o[(i + 1) % o.length][0]; t.querySelector('.cv').textContent = cycLabel(S, k) + ' ›'; saveSettings(S); applyStick();
  }));
  tap($('#sBack'), () => { s.classList.remove('on'); back(); });
}

export function showCamp(back) {
  const m = App.meta;
  const s = $('#camp');
  const render = () => {
    s.innerHTML = `<div class="plate rivets panel" style="max-height:100%;">
      <h2>KAMP</h2><div class="sub">Öz kalıcıdır. Her seferi güçlendirir.</div>
      <div class="ozgain" style="font-size:24px">${ic('oz', 'l')}${m.oz}</div>
      <div style="overflow-y:auto;display:flex;flex-direction:column;gap:8px;max-height:52dvh">
      ${META_KEYS.map(k => { const d = META[k], l = m.lv[k] | 0, max = l >= d.max, c = d.costs[l];
        return `<div class="plate row ${max ? 'max' : ''}" data-k="${k}">${ic(d.icon, 'l')}<div class="main"><div class="name">${d.name} ${pips(l, d.max)}</div><div class="eff">${d.desc}</div></div>
          <button class="btn buy" ${!max && m.oz >= c ? '' : 'disabled'}>${ic('oz', 's')}${max ? '' : c}</button></div>`; }).join('')}
      <div class="sec">YOLDAŞLAR · ${(m.pets || []).length}/${CRITTER_KEYS.length} · SEÇ, SEFERDE YANINDA GEZSİN</div>
      <div class="pets">${CRITTER_KEYS.map(k => { const own = (m.pets || []).includes(k), C = CRITTERS[k];
        return `<button class="pet ${own ? 'own' : ''} ${m.pet === k ? 'on' : ''}" data-pet="${k}" ${own ? '' : 'disabled'}><img src="${critterURL(k, !own)}" alt=""><span>${own ? C.name : '~' + (C.min * STRATUM_ROWS) + 'm'}</span></button>`; }).join('')}</div>
      <div class="sec">EFSANEVİ ESERLER · ${(m.relics || []).length}/${RELIC_KEYS.length}</div>
      ${RELIC_KEYS.map(k => { const d = RELICS[k], own = (m.relics || []).includes(k);
        return `<div class="plate row ${own ? 'relicrow' : 'locked'}">${ic(own ? d.icon : 'schematic', 'l')}<div class="main"><div class="name">${own ? d.name : '???'}</div><div class="eff">${own ? d.desc : d.lore}</div></div></div>`; }).join('')}
      </div>
      <button class="btn dark" id="cBack">GERİ</button></div>`;
    s.querySelectorAll('[data-k] .buy').forEach(b => tap(b, () => {
      const k = b.closest('[data-k]').dataset.k, d = META[k], l = m.lv[k] | 0;
      if (l >= d.max || m.oz < d.costs[l]) { sfx.deny(); return; }
      m.oz -= d.costs[l]; m.lv[k] = l + 1; saveMeta(m); sfx.buy(); render();
      s.querySelector(`[data-k="${k}"]`).classList.add('just');
    }));
    s.querySelectorAll('.pet.own').forEach(b => tap(b, () => { const k = b.dataset.pet; m.pet = m.pet === k ? null : k; saveMeta(m); sfx.click(); render(); }));
    tap($('#cBack'), () => { s.classList.remove('on'); back(); });
  };
  hideScreens(); render(); s.classList.add('on');
}

// PEAK usulü sefer haritası: sonuçlardan önce gösterilir, sonra HARİTA düğmesiyle yeniden açılır
function showJourney(r) {
  const s = $('#results'), J = r.journey;
  const keys = Object.keys(MARK_NAMES).filter(k => J.marks.some(m => m[0] === k));
  s.innerHTML = `<div class="plate rivets panel jpanel">
    <h2>SEFER HARİTASI</h2>
    <canvas class="jmap"></canvas>
    <div class="jleg">${J.players.map(q => `<div class="jp"><i style="background:${q.col}"></i><b style="color:${q.col}">${esc(q.name)}</b><span>${q.depth}m derin · ${q.dist}m yol${q.downs ? ' · ' + q.downs + ' bayılma' : ''}</span></div>`).join('')}</div>
    ${keys.length ? `<div class="jkeys">${keys.map(k => `<span><img src="${glyphURL(k)}" alt="">${MARK_NAMES[k]}</span>`).join('')}</div>` : ''}
    <div style="display:flex;gap:10px"><button class="btn dark" id="jRe" style="flex:1">BAŞTAN</button><button class="btn" id="jGo" style="flex:1.4">DEVAM</button></div>
    </div>`;
  s.classList.add('on');
  const v = mountJourney(s.querySelector('.jmap'), J);
  tap($('#jRe'), () => v.replay());
  tap($('#jGo'), () => { r.mapSeen = true; showResults(r); });
}

export function showResults(r) {
  if (r.journey && !r.mapSeen) return showJourney(r);
  const s = $('#results');
  const win = r.victory;
  const title = win ? 'ZAFER' : r.reason === 'abandon' ? 'SEFER BİTTİ' : r.mp ? 'EKİP DÜŞTÜ' : 'BAYILDIN';
  const rows = [
    ['En derin nokta', r.maxDepth + 'm', r.newDepth],
    ['Yıkılan yuva', r.nests],
    ['Dikilen fener', r.beacons],
    ['Açılan sandık', r.chests],
    ['Yok edilen düşman', r.kills],
    ['Toplanan cevher', r.ores],
  ];
  s.innerHTML = `<div class="plate rivets panel">
    <h2 style="font-size:30px;color:${win ? 'var(--helm)' : 'var(--bad)'}">${title}</h2>
    <div class="sub">${win ? 'Kalp Kristali yüzeye ulaştı.' : r.mp && r.names ? esc(r.names.join(' & ')) + ' · madenin derinlikleri sizi bekliyor.' : 'Madenin derinlikleri seni bekliyor.'}</div>
    <div class="stats">${rows.map(([n, v, nw]) => `<div class="stat"><span>${n}</span><b data-v="${parseInt(v) || 0}" data-s="${String(v).replace(/[\d]/g, '')}">0</b>${nw ? '<span class="new">YENİ REKOR</span>' : ''}</div>`).join('')}</div>
    ${r.contracts && r.contracts.length ? '<div class="clist">' + r.contracts.map(c => `<div class="cline ${c.done ? 'done' : ''}">${ic(c.done ? 'check' : 'contract', 's')}<span>${CONTRACTS[c.k].text(c.n)}</span>${c.done ? `<b>+${Math.round(CONTRACTS[c.k].oz * (1 + 0.25 * r.kademe))}</b>` : ''}</div>`).join('') + '</div>' : ''}
    <div class="ozgain">${ic('oz', 'l')}<span id="ozN">+0</span>${r.kademe ? `<small>×${(1 + 0.25 * r.kademe).toFixed(2)}</small>` : ''}</div>
    ${r.unlockedKademe ? `<div class="goal" style="color:var(--bad)">${ic('kademe', 's')} KADEME ${r.unlockedKademe} AÇILDI</div>` : ''}
    ${r.mp ? `<div class="goal">${ic('hand', 's')} Birlikte Kaz · Öz ×1.5</div>` : ''}
    ${r.daily ? `<div class="goal">${ic('daily', 's')} Günün Madeni · ${r.dailyBest ? 'yeni günlük rekor!' : 'günün rekoru ' + (App.meta.daily ? App.meta.daily.depth : 0) + 'm'}</div>` : ''}
    <div class="goal">${r.goal}</div>
    <div style="display:flex;gap:10px"><button class="btn dark" id="rCamp" style="flex:1">${ic('oz')} KAMP</button><button class="btn" id="rAgain" style="flex:1.4">TEKRAR KAZ</button></div>
    <div style="display:flex;gap:10px;margin-top:8px">${r.journey ? '<button class="btn dark" id="rMap" style="flex:1">HARİTA</button>' : ''}<button class="btn dark" id="rMenu" style="flex:1.4">ANA MENÜ</button></div>
    </div>`;
  s.classList.add('on');
  // sayılar sayarak gelsin
  const els = [...s.querySelectorAll('.stat b')];
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 900);
    const e = 1 - Math.pow(1 - k, 3);
    els.forEach(el => { el.textContent = Math.round(+el.dataset.v * e) + el.dataset.s; });
    $('#ozN').textContent = '+' + Math.round(r.oz * e);
    if (k < 1) requestAnimationFrame(step); else sfx.buy();
  };
  setTimeout(() => requestAnimationFrame(step), 250);
  tap($('#rAgain'), () => { if (r.mp) { hideScreens(); showCoop(() => showMenu(false)); } else hooks.newRun({ kademe: r.kademe, daily: !!r.daily }); });
  tap($('#rCamp'), () => showCamp(() => showResults(r)));
  if (r.journey) tap($('#rMap'), () => { r.mapSeen = false; showResults(r); });
  tap($('#rMenu'), () => { s.classList.remove('on'); hooks.menu(); });
}

export function fade(on_) { $('#fade').classList.toggle('on', on_); }
