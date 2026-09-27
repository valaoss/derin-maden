import '@fontsource/tiny5/latin-400.css';
import '@fontsource/tiny5/latin-ext-400.css';
import './ui/style.css';

import { STEP, TILE, GROUND_Y, WORLD_H, CENTER_COL, GROUND_ROW } from './config.js';
import { G, App, setG } from './game/state.js';
import { loadMeta, saveMeta, loadSettings, loadRun, saveRun, clearRun } from './core/save.js';
import { newRun, serialize, deserialize, bagCount, contractProgress, metaSnapshot, MP_MODS } from './game/run.js';
import { updatePlayer, updateOrbs, updateDeposit, bindEnemyDamage } from './game/player.js';
import { updateEnemies, damageEnemy, spawnEnemy } from './game/enemies.js';
import { updatePlayerGun, updateBullets, updateStructures, updateShells } from './game/combat.js';
import { updateItems } from './game/items.js';
import { updateHazards } from './game/hazards.js';
import { updateWaves } from './game/waves.js';
import { updateParticles, updateFlashes, particle } from './game/fx.js';
import { updateFlow, forceFlow } from './world/flow.js';
import { buildSprites } from './render/sprites.js';
import { resetTiles, prebuildTiles } from './render/tiles.js';
import { initRenderer, resize, render, updateCamera, view } from './render/renderer.js';
import { initInput, input, cancelStick, keyPressed, setStickVisible, readMove } from './input/input.js';
import { initAudio, sfx, setAmbience, stopAmbience, suspendAudio, haptic } from './audio/audio.js';
import { on, emit } from './core/events.js';
import { ozForRun, CONTRACTS, ITEM_KEYS } from './data/balance.js';
import { STRATA } from './data/palette.js';
import { todayKey } from './core/util.js';
import { dispatch, CMD } from './game/commands.js';
import { net, startLockstep, stopLockstep, sampleLocal, canStep, applyInputs, afterStep } from './net/lockstep.js';
import { link, hostRoom, joinRoom, send, closeLink } from './net/peer.js';
import * as UI from './ui/ui.js';

App.meta = loadMeta();
App.settings = loadSettings();

const app = document.getElementById('app');
const canvas = document.getElementById('cv');
buildSprites();
initRenderer(canvas);
initInput(document.getElementById('touch'), document.getElementById('stick'), document.querySelector('#stick .knob'));

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
  newRun(opts) { startRun(false, opts); },
  continueRun() { startRun(true); },
  endRun(reason) { endRun(reason); },
  // çok oyunculu oda akışı
  async hostRoom() {
    const code = await hostRoom();
    UI.showRoom({ host: true, code });
    link.onOpen = () => {
      sfx.connect();
      const seed = (Math.random() * 1e9) | 0;
      const meta = metaSnapshot();
      send({ t: 'start', seed, meta });
      startRun(false, { mp: true, seed, meta, localIdx: 0 });
    };
    link.onClose = onPeerGone; link.onError = e => UI.toast('Bağlantı hatası: ' + e, 'skull', true);
  },
  async joinRoom(code) {
    UI.showRoom({ host: false, code, connecting: true });
    try { await joinRoom(code); } catch (e) { UI.showRoom({ host: false, code, error: 'Oda bulunamadı' }); return; }
    sfx.connect();
    UI.showRoom({ host: false, code, waiting: true });
    link.onClose = onPeerGone; link.onError = e => UI.toast('Bağlantı hatası: ' + e, 'skull', true);
  },
  leaveRoom() { closeLink(); toMenu(); },
};
UI.initUI(document.getElementById('ui'), hooks);
// bağlantı mesajları (lockstep başlamadan önce de): oda başlangıcı vb.
const defaultOnMessage = d => { if (d && d.t) emit('netMsg', d); };
link.onMessage = defaultOnMessage;

on('netMsg', d => {
  if (d.t === 'start' && !link.host) startRun(false, { mp: true, seed: d.seed, meta: d.meta, localIdx: 1 });
});
function onPeerGone() {
  if (App.scene === 'play' && G && G.mp && !G.over) { UI.toast('Partner ayrıldı', 'skull', true); endRun('abandon'); }
  else if (App.scene === 'room') { UI.toast('Bağlantı koptu', 'skull', true); toMenu(); }
}
on('desync', () => UI.toast('Senkron kaydı — sonuçlar farklı olabilir', 'skull', true));

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
  G.player.dead = true; G.player.respawnT = 1e9;
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
        mp: !!opts.mp, meta: opts.meta || null, localIdx: opts.localIdx | 0 });
    }
    if (G.mp) startLockstep(G.localIdx); else if (net.on) stopLockstep();
    resetTiles(); prebuildTiles(); forceFlow();
    G.cam.snap = true; updateCamera(0, true);
    App.scene = 'play';
    UI.showHUD(true); UI.refreshHUD(true);
    last = performance.now(); acc = 0;
    if (!saved && !G.tutorial) {
      UI.banner(G.mp ? 'BİRLİKTE KAZ' : G.daily ? 'GÜNÜN MADENİ' : G.kademe ? 'KADEME ' + G.kademe : 'SEFER ' + (App.meta.runs + 1), G.mp ? 'ODA ' + link.code : STRATA[0].name.toUpperCase());
      setTimeout(() => UI.showContractsToast(), 2600);
    }
  });
}

function endRun(reason) {
  if (App.scene !== 'play' || G.over) return;
  G.over = true;
  if (G.mp) { send(['bye']); stopLockstep(); }
  const m = App.meta, s = G.stats;
  const victory = reason === 'victory';
  s.victory = victory;
  const collected = {};
  for (const k in G.collected) collected[k] = G.collected[k] + (victory ? G.player.bag[k] : 0);
  const contractOz = G.contracts.filter(c => c.done).reduce((a, c) => a + CONTRACTS[c.k].oz, 0);
  const oz = Math.round((ozForRun({ ...s, collected }) + contractOz) * G.mods.oz);
  const newDepth = s.maxDepth > m.bestDepth;
  const prevStratum = m.maxStratum | 0;
  m.oz += oz; m.runs++; m.bestDepth = Math.max(m.bestDepth, s.maxDepth); m.bestWave = Math.max(m.bestWave, s.wavesCleared);
  m.maxStratum = Math.max(prevStratum, G.maxStratum);
  if (victory && !G.mp) { m.wins++; m.maxKademe = Math.max(m.maxKademe | 0, Math.min(5, G.kademe + 1)); }
  if (victory && G.mp) { m.wins++; m.coopWins = (m.coopWins | 0) + 1; }
  let dailyBest = false;
  if (G.daily) {
    const d = m.daily && m.daily.day === G.daily ? m.daily : { day: G.daily, depth: 0, waves: 0, win: false, tries: 0 };
    d.tries++; dailyBest = s.maxDepth > d.depth || (victory && !d.win);
    d.depth = Math.max(d.depth, s.maxDepth); d.waves = Math.max(d.waves, s.wavesCleared); d.win = d.win || victory;
    m.daily = d;
  }
  m.tutorialDone = true;
  saveMeta(m); clearRun();
  const ores = Object.values(collected).reduce((a, b) => a + b, 0);
  let goal;
  if (victory) goal = 'Kalp Kristali senin. Şimdi daha hızlı yapabilir misin?';
  else if (G.maxStratum < 3) goal = `Sonraki hedef: <b>${STRATA[G.maxStratum + 1].name}</b> (${(G.maxStratum + 1) * 26}m)`;
  else goal = 'Çekirdek çok yakın. Kalp Kristali\'ni yüzeye taşı!';
  if (!victory && m.oz >= 20) goal += '<br><span style="color:var(--good)">Kampta harcayacak Öz\'ün var.</span>';
  if (victory) sfx.victory(); else sfx.defeat();
  stopAmbience();
  App.scene = 'results';
  const mp = G.mp;
  setTimeout(() => {
    UI.showHUD(false); UI.closeSheet(); UI.coach('');
    UI.showResults({ victory, reason, maxDepth: s.maxDepth, newDepth, wavesCleared: s.wavesCleared, chests: s.chests, kills: s.kills, ores, oz, goal,
      contracts: G.contracts, kademe: G.kademe, daily: G.daily, dailyBest, mp,
      unlockedKademe: victory && !mp && G.kademe + 1 <= 5 && m.maxKademe === G.kademe + 1 ? G.kademe + 1 : 0 });
    if (mp) closeLink();
  }, victory ? 400 : 900);
}

on('baseDown', () => { if (G) { G.base.hp = 0; endRun('base'); } });
on('victory', () => endRun('victory'));
bindEnemyDamage(damageEnemy);

// dokunuş: inşa yuvaları
function handleTaps() {
  while (input.taps.length) {
    const t = input.taps.shift();
    if (App.scene === 'play' && G && !G.paused) UI.handleTap(t.x, t.y);
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
  updateWaves(dt);
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
  // üs bacası dumanı (kozmetik)
  if (Math.random() < dt * 4) particle(G.base.x + 22, GROUND_Y - 44, (Math.random() - 0.5) * 6 + 3, -10 - Math.random() * 8, 1.6 + Math.random(), 'rgba(120,110,130,0.45)', 2 + (Math.random() * 2 | 0), 2, -6);
  // sakin fazda üs yavaşça kendini onarır (oyuncu yüzeydeyse daha hızlı; çok oyunculuda yarı hız)
  if (G.wave.phase === 'calm' && !G.mods.noRegen && G.base.hp > 0 && G.base.hp < G.base.maxHp) {
    const anySurf = G.players.some(p => !p.dead && p.y < GROUND_Y);
    G.base.hp = Math.min(G.base.maxHp, G.base.hp + (anySurf ? 2 : 0.6) * dt * (G.mp ? MP_MODS.regen : 1));
  }
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
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  handleTaps();
  if (!G) return;
  if (App.scene === 'menu' || App.scene === 'room') {
    acc += dt; let n = 0;
    while (acc >= STEP && n++ < 5) { menuStep(STEP); acc -= STEP; }
    render(1, { hidePlayer: true });
    return;
  }
  if (App.scene === 'play' && !G.paused && !G.over) {
    if (keyPressed('escape') || keyPressed('p')) { hooks.pause(true); }
    for (let i = 0; i < ITEM_KEYS.length; i++) if (keyPressed(String(i + 1))) { dispatch({ t: CMD.USE, k: ITEM_KEYS[i] }); UI.refreshHUD(true); }
    acc += dt; let n = 0;
    if (G.mp) {
      // lockstep: karşı girdi yoksa bekle; geri kaldıysak hızlan
      const maxSteps = net.remoteAhead > 3 ? 4 : 2;
      while (acc >= STEP && n < maxSteps) {
        sampleLocal();
        if (!canStep()) { net.stallT += dt; break; }
        net.stallT = 0;
        applyInputs(); step(STEP); afterStep(); acc -= STEP; n++;
      }
      if (acc > STEP * 3) acc = STEP * 3;
      UI.setNetStall(net.stallT > 0.5);
    } else {
      while (acc >= STEP && n++ < 6) { feedLocalInput(); step(STEP); acc -= STEP; }
      if (n >= 6) acc = 0;
    }
    UI.refreshHUD();
    saveT += dt;
    if (saveT > 8) { saveT = 0; autosave(); }
    const surf = G.player.y < GROUND_Y;
    const st = Math.max(0, Math.floor((G.player.y / TILE - GROUND_ROW) / 26));
    const key = st + '|' + surf + '|' + (G.wave.phase === 'active');
    if (key !== lastAmb) { lastAmb = key; setAmbience(st, surf, G.wave.phase === 'active'); }
  } else if (App.scene === 'play' && G.paused && G.mp) {
    G.paused = false; // çok oyunculuda duraklatma yok
  }
  const sv = App.scene === 'play' && !G.paused && !G.over;
  if (sv !== stickShown) { stickShown = sv; setStickVisible(sv); }
  render(App.scene === 'play' ? Math.min(1, acc / STEP) : 1);
}
let stickShown = null;

function autosave() {
  if (App.scene === 'play' && G && !G.over && !G.mp && G.wave.phase === 'calm') {
    try { saveRun(serialize()); } catch (e) { /* kota */ }
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (App.scene === 'play' && G && !G.over) { autosave(); if (!G.paused && !G.mp) hooks.pause(true); }
    suspendAudio(true);
  } else { suspendAudio(false); last = performance.now(); }
});
window.addEventListener('pagehide', autosave);
document.addEventListener('pointerdown', () => initAudio(), { once: true });
document.addEventListener('keydown', () => initAudio(), { once: true });

// ---------- başlat ----------
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(() => {
  toMenu();
  requestAnimationFrame(t => { last = t; frame(t); });
  const boot = document.getElementById('boot');
  boot.classList.add('done'); setTimeout(() => boot.remove(), 400);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// geliştirme/test erişimi
if (import.meta.env.DEV) window.__dm = {
  get G() { return G; }, App, UI, step, render, view, input, net, link,
  spawn(type, c, r) { const e = spawnEnemy(type, c * TILE + 8, r * TILE + 8, Math.max(1, G.wave.num)); e.emergeT = 0; return e; },
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
