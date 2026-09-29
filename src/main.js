import '@fontsource/tiny5/latin-400.css';
import '@fontsource/tiny5/latin-ext-400.css';
import './ui/style.css';

import { STEP, TILE, GROUND_Y, WORLD_H, CENTER_COL, GROUND_ROW, STRATUM_ROWS, STRATA_COUNT, stratumOfRow, depthOfY } from './config.js';
import { G, App, setG, biomeOf } from './game/state.js';
import { loadMeta, saveMeta, loadSettings, saveSettings, loadRun, saveRun, clearRun } from './core/save.js';
import { isNative, nativeShareImage } from './core/native.js';
import { newRun, serialize, deserialize, bagCount, contractProgress, metaSnapshot, stratumGroup } from './game/run.js';
import { updatePlayer, updateOrbs, updateDeposit, bindEnemyDamage } from './game/player.js';
import { updateEnemies, damageEnemy, spawnEnemy } from './game/enemies.js';
import { updatePlayerGun, updateBullets, updateStructures, updateShells } from './game/combat.js';
import { updateItems } from './game/items.js';
import { updateHazards } from './game/hazards.js';
import { updateThreat, LEVEL_NAMES } from './game/threat.js';
import { updatePings } from './game/pings.js';
import { updateEvents } from './game/events.js';
import { updateCanary } from './game/canary.js';
import { updatePrediction, pred } from './net/predict.js';
import { updateParticles, updateFlashes, particle } from './game/fx.js';
import { updateFlow, forceFlow } from './world/flow.js';
import { buildSprites } from './render/sprites.js';
import { resetTiles, prebuildTiles } from './render/tiles.js';
import { initRenderer, resize, render, updateCamera, view, viewToWorld } from './render/renderer.js';
import { initInput, input, cancelStick, keyPressed, setStickVisible, setStickMode, readMove } from './input/input.js';
import { initAudio, sfx, setAmbience, stopAmbience, suspendAudio, haptic } from './audio/audio.js';
import { on, emit } from './core/events.js';
import { ozForRun, CONTRACTS, ITEM_KEYS, MODS, PERKS, ROLES } from './data/balance.js';
import { STRATA } from './data/palette.js';
import { todayKey } from './core/util.js';
import { dispatch, CMD } from './game/commands.js';
import { net, startLockstep, stopLockstep, sampleLocal, canStep, applyInputs, afterStep, netTick, markLost, resync } from './net/lockstep.js';
import { link, hostRoom, joinRoom, quickMatch, send, closeLink, codeFromURL, shareInvite, reconnectId, reconnectHost, reconnectJoin } from './net/peer.js';
import * as UI from './ui/ui.js';

App.meta = loadMeta();
App.settings = loadSettings();
if (!App.settings.name) { App.settings.name = 'Madenci ' + (10 + Math.floor(Math.random() * 90)); saveSettings(App.settings); }

const app = document.getElementById('app');
const canvas = document.getElementById('cv');
buildSprites();
initRenderer(canvas);
initInput(document.getElementById('touch'), document.getElementById('stick'), document.querySelector('#stick .knob'));
setStickMode(App.settings.stickFixed, App.settings.stickPos, App.settings.stickH, App.settings.lefty);

// ---------- çözünürlük: tam sayı ölçekli pixel-art ----------
function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = app.clientWidth, h = app.clientHeight;
  const dw = Math.round(w * dpr), dh = Math.round(h * dpr);
  const s = Math.max(1, Math.floor(dw / 224));
  const vw = Math.ceil(dw / s), vh = Math.ceil(dh / s);
  resize(vw, vh);
  canvas.style.width = (vw * s / dpr) + 'px';
  canvas.style.height = (vh * s / dpr) + 'px';
  view.scale = s;
}
window.addEventListener('resize', fit);
fit();

// ---------- sahneler ----------
let acc = 0, last = performance.now(), menuT = 0, saveT = 0;
const hooks = {
  // çok oyunculuda simülasyon durmaz; menü yine açılır
  pause(showMenu, silent) {
    if (!G || App.scene !== 'play') return;
    if (!G.mp) { G.paused = true; cancelStick(); }
    if (showMenu) UI.showPause();
  },
  resume() { if (G) { G.paused = false; last = performance.now(); } },
  newRun(opts) { startRun(false, Object.assign({ startStratum: elevatorStratum(App.meta) }, opts)); },
  continueRun() { startRun(true); },
  endRun(reason) { endRun(reason); },
  // ---------- çok oyunculu lobi ----------
  async hostRoom() {
    lobbyReset({ host: true, quick: false, status: 'connecting' });
    UI.showRoom(lobby);
    try { lobby.code = await hostRoom(); } catch (e) { lobby.status = 'error'; lobby.error = 'Oda kurulamadı'; UI.showRoom(lobby); return; }
    lobby.status = 'waiting'; UI.showRoom(lobby);
    bindLobbyLink();
  },
  async joinRoom(code) {
    lobbyReset({ host: false, quick: false, status: 'connecting', code });
    UI.showRoom(lobby);
    try { await joinRoom(code); } catch (e) { lobby.status = 'error'; lobby.error = 'Oda bulunamadı. Kod doğru mu?'; UI.showRoom(lobby); return; }
    bindLobbyLink();
    onLobbyOpen();
  },
  async quickMatch() {
    lobbyReset({ host: false, quick: true, status: 'search' });
    UI.showRoom(lobby);
    try {
      await quickMatch(st => { if (st === 'host') { lobby.host = true; lobby.status = 'waiting'; lobby.code = link.code; UI.showRoom(lobby); } });
    } catch (e) { lobby.status = 'error'; lobby.error = 'Eşleşme başarısız. Tekrar dene.'; UI.showRoom(lobby); return; }
    bindLobbyLink();
    if (link.open) onLobbyOpen();
  },
  ready(v) {
    lobby.me.ready = !!v; send({ t: 'ready', v: lobby.me.ready }); UI.showRoom(lobby); maybeStart();
  },
  async share() { const r = await shareInvite(lobby.code); if (r === 'copied') UI.toast('Davet linki kopyalandı', 'check'); else if (r === 'fail') UI.toast('Paylaşılamadı', 'skull', true); },
  leaveRoom() { closeLink(); toMenu(); },
  menu() { closeLink(); transition(toMenu); },
};
// lobi durumu (arayüz bunu çizer)
const lobby = { host: false, quick: false, status: 'idle', code: '', error: '', me: null, mate: null, starting: false };
function lobbyReset(o) {
  Object.assign(lobby, { host: false, quick: false, status: 'idle', code: '', error: '', mate: null, starting: false }, o);
  lobby.me = { name: App.settings.name, helm: App.settings.helm | 0, role: ROLES[App.settings.role] ? App.settings.role : '', ready: false };
}
function bindLobbyLink() {
  link.onOpen = onLobbyOpen;
  link.onClose = onPeerGone;
  link.onError = e => UI.toast('Bağlantı hatası: ' + e, 'skull', true);
}
function onLobbyOpen() {
  sfx.connect();
  lobby.status = 'open'; lobby.code = link.code; lobby.host = link.host;
  send({ t: 'hello', name: lobby.me.name, helm: lobby.me.helm, role: lobby.me.role });
  UI.showRoom(lobby);
}
function maybeStart() {
  if (!lobby.host || !lobby.mate || !lobby.me.ready || !lobby.mate.ready || lobby.starting) return;
  const seed = (Math.random() * 1e9) | 0;
  const meta = metaSnapshot();
  const names = [lobby.me.name, lobby.mate.name], helms = [lobby.me.helm, lobby.mate.helm], roles = [lobby.me.role, lobby.mate.role];
  const startStratum = elevatorStratum(App.meta);
  send({ t: 'start', seed, meta, names, helms, roles, startStratum });
  beginCoop({ seed, meta, names, helms, roles, localIdx: 0, startStratum });
}
function beginCoop(o) {
  lobby.starting = true; UI.showRoom(lobby);
  setTimeout(() => startRun(false, { mp: true, seed: o.seed, meta: o.meta, localIdx: o.localIdx, names: o.names, helms: o.helms, roles: o.roles, startStratum: o.startStratum | 0 }), 900);
}
// her sefer yüzeyden başlar (kaldığın biyomdan devam şimdilik kapalı; fenerler yalnız ilerleme sayacı)
function elevatorStratum() { return 0; }
UI.initUI(document.getElementById('ui'), hooks);
// bağlantı mesajları (lockstep başlamadan önce de): oda başlangıcı vb.
const defaultOnMessage = d => { if (d && d.t) emit('netMsg', d); };
link.onMessage = defaultOnMessage;

on('netMsg', d => {
  if (App.scene === 'room') {
    if (d.t === 'hello') { lobby.mate = { name: String(d.name || 'Madenci').slice(0, 14), helm: d.helm | 0, role: ROLES[d.role] ? d.role : '', ready: false }; UI.showRoom(lobby); }
    else if (d.t === 'ready' && lobby.mate) { lobby.mate.ready = !!d.v; UI.showRoom(lobby); maybeStart(); }
    else if (d.t === 'start' && !link.host) beginCoop({ seed: d.seed, meta: d.meta, names: d.names, helms: d.helms, roles: Array.isArray(d.roles) ? d.roles : null, localIdx: 1, startStratum: d.startStratum | 0 });
  }
});
function onPeerGone() {
  if (App.scene === 'play' && G && G.mp && !G.over) { if (net.bye) endRun('abandon'); else startReconnect(); }
  else if (App.scene === 'room') {
    if (lobby.host && !lobby.starting) { lobby.mate = null; lobby.me.ready = false; lobby.status = 'waiting'; UI.toast('Partner ayrıldı', 'skull', true); UI.showRoom(lobby); }
    else { UI.toast('Bağlantı koptu', 'skull', true); toMenu(); }
  }
}
on('desync', () => UI.toast('Senkron kaydı — sonuçlar farklı olabilir', 'skull', true));
on('peerLeft', () => { if (App.scene === 'play' && G && G.mp && !G.over) { UI.toast('Partner ayrıldı', 'skull', true); endRun('abandon'); } });

// ---------- sefer içi yeniden bağlanma ----------
// Bağlantı kopunca sefer bitmez: 45 sn boyunca aynı tohumdan türeyen kimlikle yeniden buluşulur,
// iki taraf son girdilerini değiş tokuş eder ve deterministik simülasyon kaldığı kareden sürer.
const RECONNECT_T = 45;
let recon = null;
function startReconnect() {
  if (recon) return;
  recon = { t: RECONNECT_T };
  markLost();
  UI.toast('Bağlantı koptu — yeniden bağlanılıyor', 'skull', true);
  link.onOpen = onReconnected;
  link.onClose = onPeerGone;
  reconnectLoop();
}
async function reconnectLoop() {
  const id = reconnectId(G.seed), host = link.host;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  while (recon && !link.open && App.scene === 'play' && G && G.mp && !G.over) {
    try { if (host) { await reconnectHost(id); return; } await reconnectJoin(id); return; }
    catch (e) { await wait(2500); }
  }
}
function onReconnected() {
  if (!recon) return;
  recon = null;
  UI.setNetStall('');
  resync();
  sfx.connect(); UI.toast('Bağlantı yeniden kuruldu', 'check');
  if (!document.hidden) send({ t: 'away', v: false });
}
function reconnectTick(dt) {
  if (!recon) return;
  recon.t -= dt;
  UI.setNetStall('BAĞLANTI KOPTU · ' + Math.ceil(Math.max(0, recon.t)) + ' SN');
  if (recon.t <= 0) { recon = null; UI.toast('Partner geri dönmedi', 'skull', true); endRun('abandon'); }
}

function transition(fn) {
  UI.fade(true);
  setTimeout(() => { fn(); setTimeout(() => UI.fade(false), 60); }, 280);
}

function toMenu() {
  if (net.on) stopLockstep();
  App.scene = 'menu';
  // menü arka planı: gerçek bir dünya, yavaşça kayan kamera
  newRun({ seed: 1337 });
  resetTiles(); prebuildTiles();
  for (let i = 0; i < G.rev.length; i++) G.rev[i] = 1;
  G.player.dead = true; G.player.gone = true; G.player.downT = 1e9;
  G.cam.y = G.cam.py = -150; menuT = 0;
  UI.showHUD(false);
  UI.hideScreens();
  UI.showMenu(!!loadRun());
  stopAmbience();
}

// günün madeni: tarihten türeyen sabit tohum
function seedOf(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function startRun(cont, opts = {}) {
  initAudio();
  transition(() => {
    UI.hideScreens();
    const saved = cont ? loadRun() : null;
    if (saved) { try { deserialize(saved); } catch (e) { console.warn('Kayıt okunamadı', e); newRun({ tutorial: !App.meta.tutorialDone }); } }
    else {
      clearRun();
      const daily = opts.daily ? todayKey() : null;
      newRun({ tutorial: !App.meta.tutorialDone && !daily && !opts.mp, kademe: opts.kademe | 0, daily, seed: daily ? seedOf('derin' + daily) : opts.seed,
        mp: !!opts.mp, meta: opts.meta || null, localIdx: opts.localIdx | 0, names: opts.names || null, helms: opts.helms || null, roles: opts.roles || null, startStratum: daily ? 0 : opts.startStratum | 0 });
      // ölüm yankısı tek kullanımlık
      if (App.meta.echo && !G.mp && !daily) { delete App.meta.echo; saveMeta(App.meta); }
    }
    if (G.mp) { startLockstep(G.localIdx); mateAway = false; if (document.hidden) startBgTick(); } else if (net.on) stopLockstep();
    resetTiles(); prebuildTiles(); forceFlow();
    G.cam.snap = true; updateCamera(0, true);
    App.scene = 'play';
    UI.showHUD(true); UI.refreshHUD(true);
    last = performance.now(); acc = 0;
    if (!saved && !G.tutorial) {
      UI.banner(G.mp ? 'BİRLİKTE KAZ' : G.daily ? 'GÜNÜN MADENİ' : G.kademe ? 'KADEME ' + G.kademe : 'SEFER ' + (App.meta.runs + 1), G.mp ? G.players.map(p => p.name || 'MADENCİ').join(' & ').toUpperCase() : STRATA[0].name.toUpperCase());
      setTimeout(() => UI.showContractsToast(), 2600);
    }
  });
}

function endRun(reason) {
  if (App.scene !== 'play' || G.over) return;
  G.over = true;
  recon = null; UI.setNetStall('');
  if (G.mp) { send(['bye']); stopLockstep(); }
  const m = App.meta, s = G.stats;
  const victory = reason === 'victory';
  s.victory = victory;
  const collected = {};
  for (const k in G.collected) collected[k] = G.collected[k] + (victory ? G.player.bag[k] : 0);
  const contractOz = G.contracts.filter(c => c.done).reduce((a, c) => a + CONTRACTS[c.k].oz, 0);
  const oz = Math.round((ozForRun({ ...s, collected }) + contractOz) * G.mods.oz * (G.perks.includes('ozHasadi') ? 1.25 : 1));
  const newDepth = s.maxDepth > m.bestDepth;
  const prevStratum = m.maxStratum | 0;
  m.oz += oz; m.runs++; m.bestDepth = Math.max(m.bestDepth, s.maxDepth); m.bestNests = Math.max(m.bestNests | 0, s.nests);
  m.maxStratum = Math.max(prevStratum, G.maxStratum);
  // fenerler kalıcı: temizlenen biyomlara sonraki seferde asansörle inilir
  m.beacons = Array.from(new Set([...(m.beacons || []), ...G.beacons])).sort((a, b) => a - b);
  if (victory && !G.mp) { m.wins++; m.maxKademe = Math.max(m.maxKademe | 0, Math.min(5, G.kademe + 1)); }
  if (victory && G.mp) { m.wins++; m.coopWins = (m.coopWins | 0) + 1; }
  let dailyBest = false;
  if (G.daily) {
    const d = m.daily && m.daily.day === G.daily ? m.daily : { day: G.daily, depth: 0, waves: 0, win: false, tries: 0 };
    d.tries++; dailyBest = s.maxDepth > d.depth || (victory && !d.win);
    d.depth = Math.max(d.depth, s.maxDepth); d.nests = Math.max(d.nests | 0, s.nests); d.win = d.win || victory;
    m.daily = d;
  }
  m.tutorialDone = true;
  // ölüm yankısı: bayılınca düşen çanta sonraki seferde aynı derinlikte bekler
  let echo = null;
  if (!victory && !G.mp && !G.daily) {
    const lost = G.satchels.filter(x => x.owner === 0 && !x.heart);
    if (lost.length) {
      const bag = {}; let n = 0;
      for (const x of lost) for (const k in x.bag) { bag[k] = (bag[k] | 0) + (x.bag[k] | 0); n += x.bag[k] | 0; }
      if (n > 0) echo = m.echo = { c: Math.floor(lost[0].x / TILE), r: Math.floor(lost[0].y / TILE), bag, n };
    }
  }
  saveMeta(m); clearRun();
  const ores = Object.values(collected).reduce((a, b) => a + b, 0);
  let goal;
  const nextBeacon = [...Array(STRATA_COUNT).keys()].find(i => !m.beacons.includes(i));
  if (victory) goal = 'Kalp Kristali senin. Şimdi daha hızlı yapabilir misin?';
  else if (nextBeacon !== undefined && nextBeacon <= G.maxStratum) goal = `Sonraki hedef: <b>${STRATA[biomeOf(nextBeacon)].name}</b> yuvalarını yık, Fener dik.`;
  else if (G.maxStratum < STRATA_COUNT - 1) goal = `Sonraki hedef: <b>${STRATA[biomeOf(G.maxStratum + 1)].name}</b> (${(G.maxStratum + 1) * STRATUM_ROWS}m)`;
  else goal = 'Çekirdek çok yakın. Kalp Kristali\'ni yüzeye taşı!';
  if (echo) goal += `<br><span style="color:var(--helm)">Ölüm yankısı: ${echo.n} cevherlik çantan ${depthOfY(echo.r * TILE)}m derinde seni bekliyor.</span>`;
  if (!victory && m.oz >= 20) goal += '<br><span style="color:var(--good)">Kampta harcayacak Öz\'ün var.</span>';
  if (victory) sfx.victory(); else sfx.defeat();
  stopAmbience();
  App.scene = 'results';
  const mp = G.mp;
  setTimeout(() => {
    UI.showHUD(false); UI.closeSheet(); UI.coach('');
    UI.showResults({ victory, reason, maxDepth: s.maxDepth, newDepth, nests: s.nests, beacons: s.beacons, chests: s.chests, kills: s.kills, ores, oz, goal, names: G.players.map(p => p.name),
      contracts: G.contracts, kademe: G.kademe, daily: G.daily, dailyBest, mp,
      unlockedKademe: victory && !mp && G.kademe + 1 <= 5 && m.maxKademe === G.kademe + 1 ? G.kademe + 1 : 0 });
    if (mp) closeLink();
  }, victory ? 400 : 900);
}

on('allDown', () => endRun('down'));
on('victory', () => endRun('victory'));
bindEnemyDamage(damageEnemy);

// dokunuş: inşa yuvaları
function handleTaps() {
  while (input.taps.length) {
    const t = input.taps.shift();
    if (App.scene !== 'play' || !G || G.paused) continue;
    if (t.long) { if (G.mp) { const w = viewToWorld(t.x, t.y); dispatch({ t: CMD.PING, x: w.x, y: w.y }); } continue; }
    UI.handleTap(t.x, t.y);
  }
}

// ---------- simülasyon adımı ----------
function step(dt) {
  G.time += dt; G.stats.time += dt; G.frame++;
  if (G.hitstop > 0) { G.hitstop -= dt; updateParticles(dt * 0.25); return; }
  updateFlow(dt);
  updatePlayer(dt);
  if (G.over) return;
  updatePlayerGun(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateStructures(dt);
  updateShells(dt);
  updateItems(dt);
  updateHazards(dt);
  updateThreat(dt);
  updateEvents(dt);
  updatePings(dt);
  updateOrbs(dt);
  updateDeposit(dt);
  updateParticles(dt);
  updateFlashes(dt);
  for (const p of G.players) {
    if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 8);
    // yukarı çıkarken sırt motoru (kozmetik)
    if (p.up && !p.dead && Math.random() < dt * 30) particle(p.x - p.face * 4 + (Math.random() - 0.5) * 2, p.y + 6, (Math.random() - 0.5) * 10, 40, 0.18, Math.random() < 0.5 ? '#ffd48a' : '#ff9a5a', 1, 1, 0);
  }
  if (G.base.hurtT > 0) G.base.hurtT -= dt;
  if (G.flashWhite > 0) G.flashWhite -= dt;
  // fener ışığında süzülen toz zerreleri (yeraltı hissi; düşük yoğunluk) — yalnız yerel oyuncu, kozmetik
  const lp = G.player;
  if (!lp.dead && lp.y > GROUND_Y + 16 && Math.random() < dt * 2.2) {
    const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 36;
    particle(lp.x + Math.cos(a) * r, lp.y + Math.sin(a) * r, (Math.random() - 0.5) * 4, -2 - Math.random() * 3, 2.2, 'rgba(255,236,190,0.55)', 1, 2, 0);
  }
  // tavandan damlayan su (kozmetik): derin ve ıslak katmanlarda
  if (!lp.dead && lp.y > GROUND_Y + 48 && Math.random() < dt * 0.9) {
    const c = Math.floor(lp.x / TILE) + Math.floor((Math.random() - 0.5) * 9), r = Math.floor(lp.y / TILE) - 1 - Math.floor(Math.random() * 6);
    if (r > GROUND_ROW && G.map[r * 17 + c] === 0 && G.map[(r - 1) * 17 + c] !== 0) particle(c * TILE + 4 + Math.floor(Math.random() * 8), r * TILE + 1, 0, 30, 0.9, 'rgba(140,200,255,0.75)', 1, 0, 260);
  }
  // biyom atmosferi (kozmetik): spor, kar, kor, kül, yıldız tozu
  if (!lp.dead && lp.y > GROUND_Y + 16) {
    const fx = STRATA[biomeOf(stratumOfRow(Math.floor(lp.y / TILE)))].fx;
    if (fx && Math.random() < dt * (fx === 'snow' ? 6 : 3.5)) {
      const x = lp.x + (Math.random() - 0.5) * 120, y = lp.y + (Math.random() - 0.5) * 160;
      const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
      if (r > GROUND_ROW && c >= 0 && c < 17 && G.map[r * 17 + c] === 0) {
        if (fx === 'spore') particle(x, y, (Math.random() - 0.5) * 6, -3 - Math.random() * 4, 2.5, 'rgba(150,230,120,0.6)', 1, 1, 0);
        else if (fx === 'snow') particle(x, y - 40, (Math.random() - 0.5) * 8, 12 + Math.random() * 10, 2.4, 'rgba(230,245,255,0.8)', 1, 2, 0);
        else if (fx === 'ember') particle(x, y + 30, (Math.random() - 0.5) * 8, -14 - Math.random() * 14, 1.8, Math.random() < 0.5 ? '#ff9a4a' : '#ffd24a', 1, 1, -6);
        else if (fx === 'ash') particle(x, y - 30, (Math.random() - 0.5) * 5, 5 + Math.random() * 5, 3, 'rgba(180,170,160,0.5)', 1, 2, 0);
        else if (fx === 'star') particle(x, y, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 3.5, Math.random() < 0.3 ? '#ffffff' : 'rgba(150,140,255,0.8)', 1, 1, 0);
        else if (fx === 'mist') particle(x, y + 20, (Math.random() - 0.5) * 4, -4 - Math.random() * 4, 2.6, 'rgba(200,215,230,0.35)', 2, 2, 0);
        else if (fx === 'spark') particle(x, y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0.25, Math.random() < 0.5 ? '#9ad8ff' : '#ffffff', 1, 1, 0);
        else if (fx === 'gleam') particle(x, y, 0, -2, 1.2, Math.random() < 0.5 ? '#ffd870' : '#fff4c0', 1, 1, 0);
        else if (fx === 'glint') particle(x, y, (Math.random() - 0.5) * 2, 0, 0.6, '#ffffff', 1, 1, 0);
        else if (fx === 'sand') particle(x, y - 30, (Math.random() - 0.5) * 2, 3 + Math.random() * 3, 4, 'rgba(220,180,100,0.6)', 1, 2, 0);
        else if (fx === 'blood') particle(x, y - 30, 0, 26, 1, 'rgba(200,30,50,0.8)', 1, 0, 200);
        else if (fx === 'echo') particle(x, y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 3, 'rgba(120,110,150,0.45)', 2, 2, 0);
        else if (fx === 'halo') particle(x, y, (Math.random() - 0.5) * 3, -1 - Math.random() * 2, 3.5, Math.random() < 0.4 ? '#ffffff' : 'rgba(255,230,180,0.8)', 1, 1, 0);
      }
    }
  }
  // kamp bacası dumanı (kozmetik)
  if (Math.random() < dt * 4) particle(G.base.x + 22, GROUND_Y - 44, (Math.random() - 0.5) * 6 + 3, -10 - Math.random() * 8, 1.6 + Math.random(), 'rgba(120,110,130,0.45)', 2 + (Math.random() * 2 | 0), 2, -6);
  UI.tutorialTick(dt);
  checkContracts();
  updateCamera(dt);
}

function checkContracts() {
  for (const c of G.contracts) {
    if (c.done || contractProgress(c) < c.n) continue;
    c.done = true;
    sfx.chest(); UI.toast('Kontrat tamam: +' + Math.round(CONTRACTS[c.k].oz * G.mods.oz) + ' Öz', 'contract');
  }
}

function menuStep(dt) {
  G.time += dt; menuT += dt;
  const span = 1500;
  const k = (Math.sin(menuT * 0.06 - Math.PI / 2) + 1) / 2;
  G.cam.px = G.cam.x; G.cam.py = G.cam.y;
  G.cam.y = -150 + k * span;
  G.cam.x = (272 - view.vw) / 2;
  updateParticles(dt);
}

// tek oyunculu: girdi doğrudan yerel oyuncuya
function feedLocalInput() {
  const mv = readMove(); const p = G.player;
  p.inp.x = mv.x; p.inp.y = mv.y; p.inp.mag = mv.mag;
}

let lastAmb = '';
function frame(now) {
  requestAnimationFrame(frame);
  tick(now, false);
}
// bg: sekme arka plandayken Worker zamanlayıcısından gelir; simülasyon ilerler, çizim atlanır (partner donmaz)
function tick(now, bg) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  handleTaps();
  if (!G) return;
  if (App.scene === 'menu' || App.scene === 'room') {
    acc += dt; let n = 0;
    while (acc >= STEP && n++ < 5) { menuStep(STEP); acc -= STEP; }
    if (!bg) render(1, { hidePlayer: true });
    return;
  }
  if (App.scene === 'play' && !G.paused && !G.over) {
    if (keyPressed('escape') || keyPressed('p')) { hooks.pause(true); }
    for (let i = 0; i < ITEM_KEYS.length; i++) if (keyPressed(String(i + 1))) { dispatch({ t: CMD.USE, k: ITEM_KEYS[i] }); UI.refreshHUD(true); }
    if (G.mp && keyPressed('x')) dispatch({ t: CMD.PING, x: G.player.x, y: G.player.y - 10 });
    if (keyPressed('q') || keyPressed('e')) { const act = G.gear.eq.filter(k => MODS[k].active); const k = act[keyPressed('e') ? 1 : 0] || act[0]; if (k) { dispatch({ t: CMD.MODUSE, k }); UI.refreshHUD(true); } }
    acc += dt; let n = 0;
    if (G.mp) {
      // lockstep: girdi her çizim karesinde örneklenir (adım atılmasa da karşıya gider)
      sampleLocal();
      let blocked = false;
      while (acc >= STEP && n < 3) {
        sampleLocal();
        if (!canStep()) { blocked = true; break; }
        applyInputs(); step(STEP); afterStep(); acc -= STEP; n++;
      }
      acc += netTick(dt, blocked);
      if (acc > STEP * 2) acc = STEP * 2;   // beklemeden çıkınca sıçrama yok: en fazla iki adım birikir
      if (recon) reconnectTick(dt);
      else UI.setNetStall(net.stallT > 0.4 ? (mateAway ? 'PARTNER UZAKLAŞTI' : 'PARTNER BEKLENİYOR · ' + Math.round(net.rtt) + 'ms') : '');
    } else {
      while (acc >= STEP && n++ < 6) { feedLocalInput(); step(STEP); acc -= STEP; }
      if (n >= 6) acc = 0;
    }
    updatePrediction(dt);
    updateCanary(dt);
    UI.refreshHUD();
    saveT += dt;
    if (saveT > 8) { saveT = 0; autosave(); }
    const surf = G.player.y < GROUND_Y;
    const st = stratumGroup(stratumOfRow(Math.floor(G.player.y / TILE)));
    const key = st + '|' + surf + '|' + (G.threat.level >= 2);
    if (key !== lastAmb) { lastAmb = key; setAmbience(st, surf, G.threat.level >= 2); }
  } else if (App.scene === 'play' && G.paused && G.mp) {
    G.paused = false; // çok oyunculuda duraklatma yok
  }
  const sv = App.scene === 'play' && !G.paused && !G.over;
  if (sv !== stickShown) { stickShown = sv; setStickVisible(sv); }
  if (bg) return;
  render(App.scene === 'play' ? Math.min(1, acc / STEP) : 1);
}
// arka plan sekmesi: rAF durur; Worker zamanlayıcısı simülasyonu sürdürür ki partner beklemesin
let bgWorker = null, mateAway = false;
function startBgTick() {
  if (bgWorker) return;
  try {
    const src = 'setInterval(function(){postMessage(0)},' + Math.round(STEP * 1000) + ')';
    bgWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    bgWorker.onmessage = () => { if (document.hidden && App.scene === 'play' && G && G.mp && !G.over) tick(performance.now(), true); };
  } catch (e) { bgWorker = null; }
}
function stopBgTick() { if (bgWorker) { bgWorker.terminate(); bgWorker = null; } }
on('netMsg', d => { if (d.t === 'away') mateAway = !!d.v; });
on('netMsg', d => { if (d.t === 'chat' && App.scene === 'play' && G && G.mp) { const m = G.players[1 - G.localIdx]; UI.chatBubble(1 - G.localIdx, d.k); UI.toast((m && m.name || 'Partner') + ': ' + (UI.CHAT[d.k] || '…'), 'hand'); sfx.ping(); } });
// fotoğraf modu: kare (HUD'suz) + filigran; paylaşım menüsü yoksa indirir
hooks.photo = () => {
  if (!G) return;
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(canvas, 0, 0);
  const txt = 'DERİN MADEN · ' + G.stats.maxDepth + 'M' + (G.mp ? ' · ' + G.players.map(p => (p.name || 'MADENCİ').toUpperCase()).join(' & ') : '');
  x.font = '8px Tiny5, monospace'; x.textBaseline = 'bottom';
  x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillText(txt, 5, c.height - 4); x.fillStyle = '#ffe79a'; x.fillText(txt, 4, c.height - 5);
  c.toBlob(async b => {
    if (!b) return;
    if (isNative) { try { await nativeShareImage(b, 'derin-maden.png'); } catch (e) { /* iptal */ } return; }
    const f = new File([b], 'derin-maden.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Derin Maden' }); return; } catch (e) { /* iptal */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    UI.toast('Fotoğraf kaydedildi', 'check');
  });
};
hooks.chat = k => { if (!G || !G.mp) return; send({ t: 'chat', k }); UI.chatBubble(G.localIdx, k); };
let stickShown = null;

function autosave() {
  if (App.scene === 'play' && G && !G.over && !G.mp && G.wave.phase === 'calm') {
    try { saveRun(serialize()); } catch (e) { /* kota */ }
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (App.scene === 'play' && G && !G.over) { autosave(); if (!G.paused && !G.mp) hooks.pause(true); if (G.mp) { startBgTick(); send({ t: 'away', v: true }); } }
    suspendAudio(true);
  } else { suspendAudio(false); last = performance.now(); stopBgTick(); if (link.open) send({ t: 'away', v: false }); }
});
window.addEventListener('pagehide', autosave);
document.addEventListener('pointerdown', () => initAudio(), { once: true });
document.addEventListener('keydown', () => initAudio(), { once: true });

// ---------- başlat ----------
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(() => {
  toMenu();
  const invite = codeFromURL();
  if (invite) setTimeout(() => hooks.joinRoom(invite), 300);
  requestAnimationFrame(t => { last = t; frame(t); });
  const boot = document.getElementById('boot');
  boot.classList.add('done'); setTimeout(() => boot.remove(), 400);
});

if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative) {
  const reg = () => navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg);
}

// geliştirme/test erişimi
if (import.meta.env.DEV) window.__dm = {
  get G() { return G; }, App, UI, hooks, step, render, view, input, net, link, pred,
  spawn(type, c, r) { const e = spawnEnemy(type, c * TILE + 8, r * TILE + 8, 1 + G.maxStratum); e.emergeT = 0; return e; },
  noise(v) { G.threat.noise = v; },
  dropLink() { try { link.conn && link.conn.close(); } catch (e) { /* yok */ } },
  get recon() { return recon; },
  put(c, r, t) { const i = r * 17 + c; G.map[i] = t; G.dmg[i] = 0; G.dirty.push(c, r); G.mapVersion++; },
  tick(sec) {
    const n = Math.round(sec / STEP);
    for (let i = 0; i < n; i++) {
      if (App.scene === 'play' && !G.paused && !G.over) { feedLocalInput(); step(STEP); } else if (App.scene === 'menu') menuStep(STEP);
    }
    if (App.scene === 'play') UI.refreshHUD();
    render(1, { hidePlayer: App.scene !== 'play' });
  },
};
