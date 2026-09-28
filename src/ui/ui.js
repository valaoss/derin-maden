// DOM arayüzü: HUD, atölye, perk seçimi, menüler, bildirimler, öğretici.
import { TILE, GROUND_Y, PAD_COLS, PAD_Y, stratumOfRow, STRATUM_ROWS } from '../config.js';
import { UPGRADES, UPGRADE_KEYS, PICK_KEYS, MODS, MOD_KEYS, BUILDS, BUILD_KEYS, REPAIR, PERKS, META, META_KEYS, RES_KEYS, ENEMIES, ITEMS, ITEM_KEYS, CONTRACTS, KADEME } from '../data/balance.js';
import { STRATA } from '../data/palette.js';
import { G, App } from '../game/state.js';
import { iconURL } from '../render/sprites.js';
import { on, emit } from '../core/events.js';
import { bagCount, hasPerk, isUnlocked, contractProgress, pickDmg, pickInterval, modSlots } from '../game/run.js';
import { canAfford, upgradeCost, craftState } from '../game/economy.js';
import { itemUsable } from '../game/items.js';
import { dispatch, CMD } from '../game/commands.js';
import { PICK_TIERS } from '../data/balance.js';
import { net } from '../net/lockstep.js';
import { todayKey } from '../core/util.js';
import { enemiesRemaining, startTutorialWaveClock } from '../game/waves.js';
import { worldToView, viewToWorld } from '../render/renderer.js';
import { sfx, initAudio, applyAudioSettings } from '../audio/audio.js';
import { saveMeta, saveSettings } from '../core/save.js';
import { cancelStick } from '../input/input.js';

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
      <div class="plate meter">${ic('base')}<div class="bar base"><b></b><i></i></div></div>
      <button class="plate pausebtn" id="pauseBtn" aria-label="Duraklat">${ic('pause')}</button>
    </div>
    <div class="hud-row">
      <div class="plate meter bagm" id="bagM">${ic('bag')}<div class="bar bag"><i></i></div><span class="num" id="bagN">0/12</span></div>
      <div class="plate res" id="resBox">${RES_KEYS.map(k => `<span class="chip" id="r_${k}">${ic(k, 's')}<span>0</span></span>`).join('')}</div>
    </div>
    <div class="plate" id="wave">${ic('wave', 's')}<span class="l">DALGA 1</span><span class="t"></span></div>
    <div class="plate" id="boss">${ic('skull', 's')}<span>DERİN ANA</span><div class="bar"><i></i></div></div>
    <div class="plate" id="partner">${ic('heart', 's')}<span>PARTNER</span><div class="bar"><i></i></div><span class="d"></span></div>
  </div>
  <div class="plate" id="netstall">BAĞLANTI BEKLENİYOR…</div>
  <div id="indicator">${ic('base', 's')} ÜS SALDIRI ALTINDA ▲</div>
  <div id="toasts"></div>
  <div id="coach"><div class="hand" style="background-image:url(${iconURL('hand')})"></div><div class="plate msg"></div></div>
  <div id="banner"><div class="k"></div><div class="n"></div><div class="rule"></div></div>
  <button class="btn hide" id="workshopBtn">${ic('drill', 'l')}<span>ATÖLYE</span><span class="badge"></span></button>
  <div id="belt"></div>
  <div id="mods"></div>
  <div class="plate" id="pop"></div>
  <div id="sheetBack"></div>
  <div class="plate rivets" id="sheet">
    <div class="head"><h2>ATÖLYE</h2><button class="close" id="sheetClose" aria-label="Kapat">✕</button></div>
    <div class="tabs"><button class="tab on" data-tab="up">GELİŞTİR</button><button class="tab" data-tab="pick">KAZMA</button><button class="tab" data-tab="mods">BLASTER</button><button class="tab" data-tab="craft">ÜRET<span class="dot"></span></button></div>
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
  tap($('#workshopBtn'), openSheet);
  tap($('#sheetClose'), closeSheet);
  tap($('#sheetBack'), closeSheet);
  document.querySelectorAll('#sheet .tab').forEach(t => tap(t, () => { sheetTab = t.dataset.tab; if (sheetTab === 'craft' && !App.meta.seenCraft) { App.meta.seenCraft = true; saveMeta(App.meta); } refreshSheet(); $('#sheetBody').scrollTop = 0; }));

  on('toast', d => toast(d.text, d.icon, d.bad));
  on('bagPop', () => { const n = $('#bagN'); n.parentElement.classList.remove('shake'); });
  on('bagFull', () => { const m = $('#bagM'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake'); toast('Çanta dolu — yüzeye dön', 'bag', true); if (G.tutorial && G.tutorial.step < 2) tutStep(2); });
  on('storePop', k => { const c = $('#r_' + k); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); });
  on('deposit', () => { refreshSheet(); });
  on('hurt', () => { const v = $('#vignette'); v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit'); });
  on('stratum', s => banner('BİYOM ' + (s + 1) + ' · ' + s * STRATUM_ROWS + 'M', STRATA[s].name.toUpperCase()));
  on('modChanged', () => { if (sheetOpen()) refreshSheet(); refreshHUD(true); });
  on('modUsed', () => refreshHUD(true));
  on('web', () => toast('Ağa yakalandın', 'skull', true));
  on('chill', () => { const v = $('#vignette'); v.classList.add('cold'); setTimeout(() => v.classList.remove('cold'), 1800); });
  on('alarm', d => {
    const info = d.count ? ' · ' + d.count + ' DÜŞMAN' + (d.elite ? ' · ELİT' : '') : '';
    banner(d.boss ? 'DERİNLİKTEN BİR ŞEY GELİYOR' + info : 'ALARM' + info, d.boss ? 'DERİN ANA UYANDI' : 'DALGA ' + d.num + ' YAKLAŞIYOR', true);
    if (G.tutorial && G.tutorial.step === 4 && !G.tutorial.alarmSeen) { G.tutorial.alarmSeen = true; coach('Düşmanlar kazdığın tünellerden gelir. Üssü koru!', '', 6); }
  });
  on('waveStart', () => {});
  on('waveClear', n => {
    toast('Dalga ' + n + ' temizlendi', 'wave');
    if (G.tutorial && !G.tutorial.done) { G.tutorial.done = true; App.meta.tutorialDone = true; saveMeta(App.meta); coach('Harika. Derine in: yeni katmanlar, daha değerli cevherler.', '', 5); }
  });
  on('baseHurt', () => { lastBaseHurt = performance.now(); });
  on('perkOffer', pi => { if (pi === G.localIdx) showPerks(); else toast('Partnerin bir kalıntı buldu', 'chest'); });
  on('perkTaken', d => { if (d.pi !== G.localIdx) toast('Partner seçti: ' + PERKS[d.k].name, PERKS[d.k].icon); });
  on('blind', () => { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); });
  on('fear', () => { const v = $('#vignette'); v.classList.add('fear'); setTimeout(() => v.classList.remove('fear'), 2400); });
  on('pickTier', l => { const t = PICK_TIERS[Math.min(PICK_TIERS.length - 1, l)]; toast(t.name + ' hazır', 'drill'); });
  on('cmdDone', d => { if (!d.ok && (d.cmd.t === CMD.BUILD)) toast('Yetersiz kaynak', 'bag', true); });
  on('heart', () => { banner('KALP KRİSTALİ', 'YÜZEYE TAŞI!', true); toast('Dalgalar sıklaşıyor — acele et', 'heart', true); });
  on('playerDown', has => toast(has ? 'Bayıldın — çantan düştüğün yerde' : 'Bayıldın — üste uyanıyorsun', 'skull', true));
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
let cache = {}, lastBaseHurt = 0;
function set(id, key, val, fn) { if (cache[key] === val) return; cache[key] = val; fn(val); }
export function showHUD(v) { coach(''); $('#hud').classList.toggle('hidden', !v); if (!v) { $('#workshopBtn').classList.add('hide'); $('#belt').innerHTML = ''; $('#mods').innerHTML = ''; } cache = {}; }
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
  set(0, 'base', Math.ceil(b.hp) + '/' + b.maxHp, () => {
    const f = Math.max(0, b.hp / b.maxHp) * 100;
    const bar = $('.bar.base'); bar.children[1].style.width = `calc(${f}% - ${f / 25}px)`; bar.children[0].style.width = `calc(${f}% - ${f / 25}px)`;
  });
  const bc = bagCount();
  set(0, 'bag', bc + '/' + G.bagCap, () => {
    const f = Math.min(1, bc / G.bagCap) * 100;
    $('.bar.bag > i').style.width = `calc(${f}% - ${f / 25}px)`;
    $('.bar.bag').classList.toggle('full', bc >= G.bagCap);
    const n = $('#bagN'); n.textContent = bc + '/' + G.bagCap; n.classList.toggle('full', bc >= G.bagCap);
  });
  for (const k of RES_KEYS) set(0, 'r' + k, G.store[k], v => { $('#r_' + k + ' span').textContent = v; });
  const row = Math.floor(p.y / TILE), depth = Math.max(0, row - 6);
  set(0, 'depth', depth, v => { $('#dM').textContent = v + 'm'; });
  const st = stratumOfRow(row);
  set(0, 'strat', st, v => { $('#dS').textContent = v < 0 ? 'YÜZEY' : STRATA[v].short; });

  const W = G.wave;
  let wl, wt, wc;
  if (W.phase === 'calm') {
    wc = ''; wl = 'DALGA ' + (W.num + 1);
    wt = W.t === Infinity ? '—' : fmt(W.t);
  } else if (W.phase === 'warn') { wc = 'warn'; wl = W.boss ? 'BOSS' : 'DALGA ' + W.num; wt = fmt(W.t); }
  else { wc = 'active'; wl = 'DALGA ' + W.num; wt = enemiesRemaining() + ' düşman'; }
  if (W.t === Infinity && W.phase === 'calm') wc = 'hide';
  set(0, 'wc', wc, v => { $('#wave').className = 'plate ' + v; });
  set(0, 'wl', wl, v => { $('#wave .l').textContent = v; });
  set(0, 'wt', wt, v => { $('#wave .t').textContent = v; });
  const boss = G.enemies.find(e => e.d.boss && !e.dead);
  set(0, 'boss', boss ? Math.ceil(boss.hp) : -1, v => {
    $('#boss').classList.toggle('on', v >= 0);
    if (boss) $('#boss .bar > i').style.width = `calc(${boss.hp / boss.maxHp * 100}% - 4px)`;
  });

  // partner
  const mate = G.mp ? G.players[1 - G.localIdx] : null;
  set(0, 'mate', mate ? (mate.dead ? 'x' : Math.ceil(mate.hp) + '|' + Math.max(0, Math.floor(mate.y / TILE) - 6)) : '', v => {
    $('#partner').classList.toggle('on', !!mate);
    if (mate) { $('#partner .bar > i').style.width = `calc(${Math.max(0, mate.hp / mate.maxHp) * 100}% - 4px)`; $('#partner .d').textContent = mate.dead ? 'BAYGIN' : Math.max(0, Math.floor(mate.y / TILE) - 6) + 'm'; }
  });
  // üs saldırı altında ve ekran dışında
  const baseOff = G.cam.y > GROUND_Y - 10;
  set(0, 'ind', performance.now() - lastBaseHurt < 1500 && baseOff, v => $('#indicator').classList.toggle('on', v));

  // atölye butonu
  const surf = p.y < GROUND_Y && !p.dead && !(G.tutorial && G.tutorial.step < 3);
  const any = anyAffordable();
  set(0, 'ws', surf, v => $('#workshopBtn').classList.toggle('hide', !v));
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
  for (const k of UPGRADE_KEYS.concat(PICK_KEYS)) { const c = upgradeCost(k); if (c && canAfford(c)) return true; }
  for (const k of MOD_KEYS) if (!G.gear.owned.includes(k) && canAfford(MODS[k].cost)) return true;
  return false;
}

// ---------------- bildirimler ----------------
export function toast(text, icon, bad) {
  const box = $('#toasts');
  while (box.children.length > 2) box.firstChild.remove();
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
  const b = $('#banner');
  b.querySelector('.k').textContent = k; b.querySelector('.n').textContent = n;
  b.className = red ? 'red' : '';
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
  if (n === 3) { coach('Cevherler depoda. Atölye\'den ilk yükseltmeni al!', '', 0); $('#workshopBtn').classList.add('pulse'); startTutorialWaveClock(); }
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
function openSheet() {
  if (G.player.y >= GROUND_Y) return;
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

function costHTML(c) {
  return '<span class="cost">' + Object.keys(c).map(k => `<span class="${(G.store[k] || 0) >= c[k] ? '' : 'no'}">${ic(k, 's')}${c[k]}</span>`).join('') + '</span>';
}
function pips(l, max) { let s = '<span class="pips">'; for (let i = 0; i < max; i++) s += `<i class="${i < l ? 'on' : ''}"></i>`; return s + '</span>'; }

let sheetTab = 'up';
function refreshSheet(justKey) {
  if (!G) return;
  $('#sheetStore').innerHTML = RES_KEYS.map(k => `<span class="chip">${ic(k, 's')}<span>${G.store[k]}</span></span>`).join('');
  document.querySelectorAll('#sheet .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === sheetTab));
  $('#sheet .tab[data-tab="craft"]').classList.toggle('new', !App.meta.seenCraft);
  const body = $('#sheetBody');
  let h = '';
  const upRow = k => {
    const u = UPGRADES[k], l = G.lvl[k], max = u.costs.length, c = upgradeCost(k);
    const eff = c ? `${u.desc(l)} → <b>${u.desc(l + 1).replace(/^[^\d×]*/, '')}</b>` : u.desc(l);
    return `<div class="plate row ${c ? '' : 'max'} ${justKey === k ? 'just' : ''}" data-up="${k}">
      ${ic(u.icon, 'l')}
      <div class="main"><div class="name">${u.name} ${pips(l, max)}</div><div class="eff">${eff}</div>${c ? costHTML(c) : ''}</div>
      <button class="btn buy" ${c && canAfford(c) ? '' : 'disabled'}>AL</button></div>`;
  };
  if (sheetTab === 'pick') {
    const t = PICK_TIERS[G.lvl.drill], next = PICK_TIERS[G.lvl.drill + 1], c = upgradeCost('drill');
    h += '<div class="sec">KAZMAN</div>';
    h += `<div class="plate pickcard"><img class="sw" src="${pickIconURL(G.lvl.drill)}" alt=""><div class="main"><div class="name">${t.name}</div><div class="eff">Kazı gücü <b>${pickDmg().toFixed(1)}</b> · vuruş aralığı <b>${pickInterval().toFixed(2)} sn</b></div></div></div>`;
    h += '<div class="sec">SATIN AL</div>';
    if (next) h += `<div class="plate row ${justKey === 'drill' ? 'just' : ''}" data-up="drill"><img class="sw" style="width:28px;height:28px;image-rendering:pixelated" src="${pickIconURL(G.lvl.drill + 1)}" alt="">
      <div class="main"><div class="name">${next.name}</div><div class="eff">Güç ×${next.dmg} · aralık ${next.interval} sn${next.glow ? ' · parlar' : ''}</div>${costHTML(c)}</div>
      <button class="btn buy" ${canAfford(c) ? '' : 'disabled'}>AL</button></div>`;
    else h += '<div class="note">En güçlü kazma sende. Boşluk bile sana dayanamaz.</div>';
    h += '<div class="sec">GELİŞTİR</div>';
    h += upRow('sharp') + upRow('swing');
    h += `<div class="note">Derin kayalar sert: Kor 18, Obsidyen 40, Boşluk 60 dayanıklılık. Kademe atla.</div>`;
  } else if (sheetTab === 'mods') {
    h += '<div class="sec">BLASTER</div>' + upRow('blaster');
    const slots = modSlots();
    h += `<div class="sec">EKLENTİLER · ${G.gear.eq.length}/${slots} YUVA</div>`;
    for (const k of MOD_KEYS) {
      const m = MODS[k], owned = G.gear.owned.includes(k), eq = G.gear.eq.includes(k);
      if (owned) h += `<div class="plate row owned ${eq ? 'eq' : ''}" data-mod="${k}">${ic(m.icon, 'l')}<div class="main"><div class="name">${m.name}${m.active ? ' <span class="have">' + m.cd + ' sn</span>' : ''}</div><div class="eff">${m.desc}</div></div>
        <button class="btn buy">${eq ? 'ÇIKAR' : 'TAK'}</button></div>`;
      else h += `<div class="plate row ${justKey === k ? 'just' : ''}" data-modbuy="${k}">${ic(m.icon, 'l')}<div class="main"><div class="name">${m.name}</div><div class="eff">${m.desc}</div>${costHTML(m.cost)}</div>
        <button class="btn buy" ${canAfford(m.cost) ? '' : 'disabled'}>AL</button></div>`;
    }
    h += '<div class="note">Aktif eklentiler ekranın sağındaki düğmelerden (klavyede Q / E) kullanılır.</div>';
  } else if (sheetTab === 'up') {
    h += '<div class="sec">YÜKSELTMELER</div>';
    for (const k of UPGRADE_KEYS) {
      const u = UPGRADES[k], l = G.lvl[k], max = u.costs.length, c = upgradeCost(k);
      const eff = c ? `${u.desc(l)} → <b>${u.desc(l + 1).replace(/^[^\d×]*/, '')}</b>` : u.desc(l);
      h += `<div class="plate row ${c ? '' : 'max'} ${justKey === k ? 'just' : ''}" data-up="${k}">
        ${ic(u.icon, 'l')}
        <div class="main"><div class="name">${u.name} ${pips(l, max)}</div><div class="eff">${eff}</div>${c ? costHTML(c) : ''}</div>
        <button class="btn buy" ${c && canAfford(c) ? '' : 'disabled'}>AL</button></div>`;
    }
    h += '<div class="sec">ÜS</div>';
    const dmg = G.base.hp < G.base.maxHp;
    h += `<div class="plate row" data-act="rep">${ic('base', 'l')}<div class="main"><div class="name">Üssü Onar</div>
      <div class="eff">${Math.ceil(G.base.hp)}/${G.base.maxHp} → <b>+${REPAIR.amount}</b></div>${costHTML(REPAIR.cost)}</div>
      <button class="btn buy" ${dmg && canAfford(REPAIR.cost) ? '' : 'disabled'}>ONAR</button></div>`;
    h += `<div class="note">Taret kurmak için yüzeydeki <b style="color:var(--helm)">+</b> işaretlerine dokun.</div>`;
    if (G.contracts.length) {
      h += '<div class="sec">KONTRATLAR</div>' + contractsHTML();
    }
    if (G.perks.length) {
      h += '<div class="sec">KALINTILAR</div>';
      for (const k of G.perks) h += `<div class="plate row">${ic(PERKS[k].icon, 'l')}<div class="main"><div class="name">${PERKS[k].name}</div><div class="eff">${PERKS[k].desc}</div></div></div>`;
    }
  } else {
    h += '<div class="sec">EŞYALAR · KEMERDEN KULLANILIR</div>';
    for (const k of ITEM_KEYS) {
      const d = ITEMS[k], st = craftState(k);
      if (st === 'locked') {
        h += `<div class="plate row locked">${ic('schematic', 'l')}<div class="main"><div class="name">${d.name}</div><div class="eff">Şema gerekli — Kalıntı sandıklarında bulunur.</div></div></div>`;
        continue;
      }
      h += `<div class="plate row ${justKey === k ? 'just' : ''}" data-craft="${k}">${ic(d.icon, 'l')}
        <div class="main"><div class="name">${d.name} <span class="have">${G.items[k]}/${d.max}</span></div><div class="eff">${d.desc}</div>${costHTML(d.cost)}</div>
        <button class="btn buy" ${st === 'ok' ? '' : 'disabled'}>${st === 'full' ? 'DOLU' : 'ÜRET'}</button></div>`;
    }
  }
  const scroll = body.scrollTop;
  body.innerHTML = h;
  body.scrollTop = scroll;
  body.querySelectorAll('[data-up] .buy').forEach(b => tap(b, () => {
    const k = b.closest('[data-up]').dataset.up;
    if (dispatch({ t: CMD.BUY, k })) { refreshSheet(k); refreshHUD(true); tutEvent('bought'); }
  }));
  body.querySelectorAll('[data-act] .buy').forEach(b => tap(b, () => { if (dispatch({ t: CMD.REPAIR })) { refreshSheet(); refreshHUD(true); } }));
  body.querySelectorAll('[data-modbuy] .buy').forEach(b => tap(b, () => { const k = b.closest('[data-modbuy]').dataset.modbuy; if (dispatch({ t: CMD.MODBUY, k })) { refreshSheet(k); refreshHUD(true); } }));
  body.querySelectorAll('[data-mod] .buy').forEach(b => tap(b, () => { const k = b.closest('[data-mod]').dataset.mod; if (dispatch({ t: CMD.MODEQ, k })) { refreshSheet(); refreshHUD(true); } }));
  body.querySelectorAll('[data-craft] .buy').forEach(b => tap(b, () => {
    const k = b.closest('[data-craft]').dataset.craft;
    if (dispatch({ t: CMD.CRAFT, k })) { refreshSheet(k); refreshHUD(true); }
  }));
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
  setTimeout(() => { if (G && G.contracts[1]) toast('Kontrat: ' + CONTRACTS[G.contracts[1].k].text(G.contracts[1].n), 'contract'); }, 700);
}

// ---------------- yuva inşa popover'ı ----------------
export function handleTap(fx, fy) {
  hidePop();
  if (!G || G.paused) return false;
  const w = viewToWorld(fx, fy);
  if (G.player.y >= GROUND_Y + 30) return false;
  for (let i = 0; i < PAD_COLS.length; i++) {
    const x = PAD_COLS[i] * TILE + 8;
    if (Math.abs(w.x - x) < 14 && Math.abs(w.y - (PAD_Y - 6)) < 16) {
      if (G.structures.some(s => s.pad === i)) return true;
      showPop(i); return true;
    }
  }
  return false;
}
function showPop(pad) {
  const pop = $('#pop');
  let h = '';
  let locked = 0;
  for (const k of BUILD_KEYS) {
    const b = BUILDS[k];
    if (!isUnlocked(k)) { locked++; continue; }
    h += `<button class="plate row" data-b="${k}" ${canAfford(b.cost) ? '' : 'style="opacity:.6"'}>${ic(b.icon, 'l')}<div class="main"><div class="name">${b.name}</div><div class="eff">${b.desc}</div>${costHTML(b.cost)}</div></button>`;
  }
  if (locked) h += `<div class="note">${ic('schematic', 's')} ${locked} taret şeması sandıklarda seni bekliyor.</div>`;
  pop.innerHTML = h;
  const v = worldToView(PAD_COLS[pad] * TILE + 8, PAD_Y - 12);
  const R = ui.getBoundingClientRect();
  pop.style.left = '0px'; pop.style.top = '0px'; pop.classList.add('on');
  const ph = pop.offsetHeight;
  let left = v.x * R.width - 110, top = v.y * R.height - ph - 20;
  left = Math.max(8, Math.min(R.width - 228, left)); top = Math.max(110, top);
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  pop.classList.add('on');
  pop.querySelectorAll('[data-b]').forEach(b => tap(b, () => {
    const ok = dispatch({ t: CMD.BUILD, k: b.dataset.b, pad });
    if (ok) { hidePop(); refreshHUD(true); } else if (!G.mp) toast('Yetersiz kaynak', 'bag', true);
  }));
}
export function hidePop() { $('#pop').classList.remove('on'); }

// ---------------- perk seçimi ----------------
function showPerks() {
  const off = G.perkOffer;
  if (!off || !off.keys.length) return;
  const ch = off.keys;
  hooks.pause(false, true); cancelStick();
  const s = $('#perk');
  s.innerHTML = `<div class="perkhead"><div class="k">KALINTI SANDIĞI</div><div class="n">Birini seç</div>${G.mp ? '<div class="k" style="margin-top:6px">OYUN DEVAM EDİYOR</div>' : ''}</div>
    <div class="cards">${ch.map((k, i) => `<button class="plate card" data-k="${k}" style="animation-delay:${0.08 + i * 0.07}s">${ic(PERKS[k].icon, 'xl')}
      <div><div class="name">${PERKS[k].name}</div><div class="desc">${PERKS[k].desc}</div></div></button>`).join('')}</div>`;
  s.classList.add('on');
  s.querySelectorAll('.card').forEach(c => tap(c, () => {
    dispatch({ t: CMD.PERK, k: c.dataset.k }); s.classList.remove('on'); hooks.resume(); refreshHUD(true);
    toast(PERKS[c.dataset.k].name, PERKS[c.dataset.k].icon);
  }));
}
export function setNetStall(v) { $('#netstall').classList.toggle('on', !!v); }

// ---------------- çok oyunculu oda ----------------
export function showCoop(back) {
  const s = $('#room');
  s.innerHTML = `<div class="plate rivets panel"><h2>BİRLİKTE KAZ</h2>
    <div class="sub">İki kişi, aynı maden, aynı üs. Düşmanlar daha kalabalık ve dayanıklı; Öz ×1.5.</div>
    <button class="btn big" id="rHost">ODA KUR</button>
    <div class="sec" style="text-align:center">VEYA ODAYA KATIL</div>
    <input class="codein" id="rCode" maxlength="4" placeholder="KOD" autocomplete="off" autocapitalize="characters" spellcheck="false">
    <button class="btn" id="rJoin">KATIL</button>
    <button class="btn dark" id="rBack">GERİ</button></div>`;
  hideScreens(); s.classList.add('on');
  tap($('#rHost'), () => { hooks.hostRoom().catch(e => toast('Oda kurulamadı: ' + (e && e.type || e), 'skull', true)); });
  const inp = $('#rCode');
  inp.addEventListener('pointerdown', e => e.stopPropagation());
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4); });
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && inp.value.length === 4) hooks.joinRoom(inp.value); });
  tap($('#rJoin'), () => { if (inp.value.length === 4) hooks.joinRoom(inp.value); else toast('4 haneli oda kodu gir', 'skull', true); });
  tap($('#rBack'), () => { s.classList.remove('on'); back(); });
}
export function showRoom({ host, code, connecting, waiting, error }) {
  App.scene = 'room';
  const s = $('#room');
  let body;
  if (error) body = `<div class="sub" style="color:var(--bad)">${error}</div>`;
  else if (host) body = `<div class="sub">Bu kodu partnerine gönder</div><div class="code">${code}</div><div class="sub waitdots">Partner bekleniyor</div>`;
  else if (connecting) body = `<div class="code">${code}</div><div class="sub waitdots">Bağlanıyor</div>`;
  else if (waiting) body = `<div class="code">${code}</div><div class="sub waitdots">Bağlandı · sefer başlıyor</div>`;
  s.innerHTML = `<div class="plate rivets panel"><h2>${host ? 'ODA KURULDU' : 'ODAYA KATIL'}</h2>${body}
    ${host && !error ? `<button class="btn dark" id="rCopy">KODU KOPYALA</button>` : ''}
    <button class="btn dark" id="rLeave">${error ? 'GERİ' : 'İPTAL'}</button></div>`;
  hideScreens(); s.classList.add('on');
  if ($('#rCopy')) tap($('#rCopy'), () => { try { navigator.clipboard.writeText(code); toast('Kod kopyalandı', 'check'); } catch (e) { /* yok */ } });
  tap($('#rLeave'), () => { s.classList.remove('on'); hooks.leaveRoom(); });
}

// ---------------- menü ----------------
export function showMenu(hasSave) {
  const m = App.meta;
  const s = $('#menu');
  s.innerHTML = `<div class="top"><div class="title">DERİN<small>MADEN</small></div><div class="subtitle">KAZ · SAVUN · DERİNE İN</div></div>
    <div class="stack">
      ${hasSave ? `<button class="btn big" id="mCont">DEVAM ET</button><button class="btn dark" id="mNew">YENİ SEFER</button>` : `<button class="btn big" id="mNew">KAZMAYA BAŞLA</button>`}
      ${m.maxKademe ? `<div class="plate kstep"><button class="kb" id="kDn" aria-label="Kademe azalt">◀</button><div class="kv">${ic('kademe', 's')}<span id="kName"></span><small id="kDesc"></small></div><button class="kb" id="kUp" aria-label="Kademe artır">▶</button></div>` : ''}
      ${m.tutorialDone ? `<button class="btn dark" id="mDaily">${ic('daily')} GÜNÜN MADENİ${dailyLine()}</button>` : ''}
      ${m.tutorialDone ? `<button class="btn dark" id="mCoop">${ic('hand')} BİRLİKTE KAZ${m.coopWins ? `<small class="dline">${m.coopWins} ZAFER</small>` : ''}</button>` : ''}
      <div style="display:flex;gap:10px"><button class="btn dark" id="mCamp" style="flex:1">${ic('oz')} KAMP</button><button class="btn dark" id="mSet" style="flex:1">AYARLAR</button></div>
      ${matchMedia('(pointer: fine)').matches ? '<div class="foot">WASD / Oklar: hareket ve kazı · P: duraklat</div>' : ''}
      <div class="foot">${m.runs ? `Rekor <b>${m.bestDepth}m</b> · ${m.runs} sefer${m.wins ? ' · ' + m.wins + ' zafer' : ''} · <span class="ozline">${ic('oz', 's')}${m.oz}</span>` : 'Çekirdekteki Kalp Kristali seni bekliyor.'}</div>
    </div>`;
  s.classList.add('on');
  let k = Math.min(m.maxKademe | 0, m.lastKademe | 0);
  const showK = () => { if (!$('#kName')) return; $('#kName').textContent = KADEME[k].name.toUpperCase(); $('#kDesc').textContent = k ? KADEME[k].desc.replace(/^\+ /, '') : 'Standart sefer'; };
  if (m.maxKademe) {
    showK();
    tap($('#kDn'), () => { k = Math.max(0, k - 1); showK(); });
    tap($('#kUp'), () => { k = Math.min(m.maxKademe, k + 1); showK(); });
  }
  if (hasSave) tap($('#mCont'), () => hooks.continueRun());
  tap($('#mNew'), () => { m.lastKademe = k; saveMeta(m); hooks.newRun({ kademe: k }); });
  if ($('#mDaily')) tap($('#mDaily'), () => hooks.newRun({ daily: true }));
  if ($('#mCoop')) tap($('#mCoop'), () => showCoop(() => showMenu(hasSave)));
  tap($('#mCamp'), () => showCamp(() => showMenu(hasSave)));
  tap($('#mSet'), () => showSettings(() => showMenu(hasSave)));
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
    <div class="sub">Derinlik ${G.stats.maxDepth}m · Dalga ${G.wave.num}${G.kademe ? ' · Kademe ' + G.kademe : ''}${G.daily ? ' · Günün Madeni' : ''}${G.mp ? ' · Birlikte (oyun duraklamaz)' : ''}</div>
    ${G.contracts.length ? '<div class="clist">' + contractsHTML() + '</div>' : ''}
    <button class="btn big" id="pRes">DEVAM</button>
    <button class="btn dark" id="pSet">AYARLAR</button>
    <button class="btn dark" id="pEnd">SEFERİ BİTİR</button></div>`;
  s.classList.add('on');
  tap($('#pRes'), () => { s.classList.remove('on'); hooks.resume(); });
  tap($('#pSet'), () => { s.classList.remove('on'); showSettings(() => showPause()); });
  let armed = false;
  tap($('#pEnd'), e => {
    if (!armed) { armed = true; e.currentTarget.textContent = 'EMİN MİSİN? TEKRAR DOKUN'; e.currentTarget.classList.replace('dark', 'danger'); return; }
    s.classList.remove('on'); hooks.endRun('abandon');
  });
}
export function pauseShown() { return $('#pause').classList.contains('on') || $('#settings').classList.contains('on'); }

export function showSettings(back) {
  const S = App.settings;
  const s = $('#settings');
  const items = [['sfx', 'Ses efektleri'], ['music', 'Ambiyans'], ['haptics', 'Titreşim'], ['shake', 'Ekran sarsıntısı'], ['lefty', 'Solak mod']];
  s.innerHTML = `<div class="plate rivets panel"><h2>AYARLAR</h2>
    ${items.map(([k, n]) => `<button class="plate toggle ${S[k] ? 'on' : ''}" data-k="${k}"><span>${n}</span><span class="sw"></span></button>`).join('')}
    <button class="btn" id="sBack">TAMAM</button></div>`;
  hideScreens(); s.classList.add('on');
  s.querySelectorAll('.toggle').forEach(t => tap(t, () => {
    S[t.dataset.k] = !S[t.dataset.k]; t.classList.toggle('on', S[t.dataset.k]); saveSettings(S); applyAudioSettings();
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
      </div>
      <button class="btn dark" id="cBack">GERİ</button></div>`;
    s.querySelectorAll('[data-k] .buy').forEach(b => tap(b, () => {
      const k = b.closest('[data-k]').dataset.k, d = META[k], l = m.lv[k] | 0;
      if (l >= d.max || m.oz < d.costs[l]) { sfx.deny(); return; }
      m.oz -= d.costs[l]; m.lv[k] = l + 1; saveMeta(m); sfx.buy(); render();
      s.querySelector(`[data-k="${k}"]`).classList.add('just');
    }));
    tap($('#cBack'), () => { s.classList.remove('on'); back(); });
  };
  hideScreens(); render(); s.classList.add('on');
}

export function showResults(r) {
  const s = $('#results');
  const win = r.victory;
  const title = win ? 'ZAFER' : r.reason === 'abandon' ? 'SEFER BİTTİ' : 'ÜS DÜŞTÜ';
  const rows = [
    ['En derin nokta', r.maxDepth + 'm', r.newDepth],
    ['Temizlenen dalga', r.wavesCleared],
    ['Açılan sandık', r.chests],
    ['Yok edilen düşman', r.kills],
    ['Toplanan cevher', r.ores],
  ];
  s.innerHTML = `<div class="plate rivets panel">
    <h2 style="font-size:30px;color:${win ? 'var(--helm)' : 'var(--bad)'}">${title}</h2>
    <div class="sub">${win ? 'Kalp Kristali yüzeye ulaştı.' : 'Madenin derinlikleri seni bekliyor.'}</div>
    <div class="stats">${rows.map(([n, v, nw]) => `<div class="stat"><span>${n}</span><b data-v="${parseInt(v) || 0}" data-s="${String(v).replace(/[\d]/g, '')}">0</b>${nw ? '<span class="new">YENİ REKOR</span>' : ''}</div>`).join('')}</div>
    ${r.contracts && r.contracts.length ? '<div class="clist">' + r.contracts.map(c => `<div class="cline ${c.done ? 'done' : ''}">${ic(c.done ? 'check' : 'contract', 's')}<span>${CONTRACTS[c.k].text(c.n)}</span>${c.done ? `<b>+${Math.round(CONTRACTS[c.k].oz * (1 + 0.25 * r.kademe))}</b>` : ''}</div>`).join('') + '</div>' : ''}
    <div class="ozgain">${ic('oz', 'l')}<span id="ozN">+0</span>${r.kademe ? `<small>×${(1 + 0.25 * r.kademe).toFixed(2)}</small>` : ''}</div>
    ${r.unlockedKademe ? `<div class="goal" style="color:var(--bad)">${ic('kademe', 's')} KADEME ${r.unlockedKademe} AÇILDI</div>` : ''}
    ${r.mp ? `<div class="goal">${ic('hand', 's')} Birlikte Kaz · Öz ×1.5</div>` : ''}
    ${r.daily ? `<div class="goal">${ic('daily', 's')} Günün Madeni · ${r.dailyBest ? 'yeni günlük rekor!' : 'günün rekoru ' + (App.meta.daily ? App.meta.daily.depth : 0) + 'm'}</div>` : ''}
    <div class="goal">${r.goal}</div>
    <div style="display:flex;gap:10px"><button class="btn dark" id="rCamp" style="flex:1">${ic('oz')} KAMP</button><button class="btn" id="rAgain" style="flex:1.4">TEKRAR KAZ</button></div>
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
}

export function fade(on_) { $('#fade').classList.toggle('on', on_); }
