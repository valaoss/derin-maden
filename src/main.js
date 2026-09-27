import '@fontsource/tiny5/latin-400.css';
import '@fontsource/tiny5/latin-ext-400.css';
import './ui/style.css';

import { STEP, TILE, GROUND_Y, WORLD_H, CENTER_COL, GROUND_ROW } from './config.js';
import { G, App, setG } from './game/state.js';
import { loadMeta, saveMeta, loadSettings, loadRun, saveRun, clearRun } from './core/save.js';
import { newRun, serialize, deserialize, bagCount } from './game/run.js';
import { updatePlayer, updateOrbs, updateDeposit, bindEnemyDamage } from './game/player.js';
import { updateEnemies, damageEnemy } from './game/enemies.js';
import { updatePlayerGun, updateBullets, updateStructures } from './game/combat.js';
import { updateWaves } from './game/waves.js';
import { updateParticles, updateFlashes, particle } from './game/fx.js';
import { updateFlow, forceFlow } from './world/flow.js';
import { buildSprites } from './render/sprites.js';
import { resetTiles, prebuildTiles } from './render/tiles.js';
import { initRenderer, resize, render, updateCamera, view } from './render/renderer.js';
import { initInput, input, cancelStick, keyPressed, setStickVisible } from './input/input.js';
import { initAudio, sfx, setAmbience, stopAmbience, suspendAudio, haptic } from './audio/audio.js';
import { on } from './core/events.js';
import { ozForRun } from './data/balance.js';
import { STRATA } from './data/palette.js';
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
  pause(showMenu, silent) {
    if (!G || App.scene !== 'play') return;
    G.paused = true; cancelStick();
    if (showMenu) UI.showPause();
  },
  resume() { if (G) { G.paused = false; last = performance.now(); } },
  newRun() { startRun(false); },
  continueRun() { startRun(true); },
  endRun(reason) { endRun(reason); },
};
UI.initUI(document.getElementById('ui'), hooks);

function transition(fn) {
  UI.fade(true);
  setTimeout(() => { fn(); setTimeout(() => UI.fade(false), 60); }, 280);
}

function toMenu() {
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

function startRun(cont) {
  initAudio();
  transition(() => {
    UI.hideScreens();
    const saved = cont ? loadRun() : null;
    if (saved) { try { deserialize(saved); } catch (e) { console.warn('Kayıt okunamadı', e); newRun({ tutorial: !App.meta.tutorialDone }); } }
    else { clearRun(); newRun({ tutorial: !App.meta.tutorialDone }); }
    resetTiles(); prebuildTiles(); forceFlow();
    G.cam.snap = true; updateCamera(0, true);
    App.scene = 'play';
    UI.showHUD(true); UI.refreshHUD(true);
    last = performance.now(); acc = 0;
    if (!saved && !G.tutorial) UI.banner('SEFER ' + (App.meta.runs + 1), STRATA[0].name.toUpperCase());
  });
}

function endRun(reason) {
  if (App.scene !== 'play' || G.over) return;
  G.over = true;
  const m = App.meta, s = G.stats;
  const victory = reason === 'victory';
  s.victory = victory;
  const collected = {};
  for (const k in G.collected) collected[k] = G.collected[k] + (victory ? G.bag[k] : 0);
  const oz = ozForRun({ ...s, collected });
  const newDepth = s.maxDepth > m.bestDepth;
  const prevStratum = m.maxStratum | 0;
  m.oz += oz; m.runs++; m.bestDepth = Math.max(m.bestDepth, s.maxDepth); m.bestWave = Math.max(m.bestWave, s.wavesCleared);
  m.maxStratum = Math.max(prevStratum, G.maxStratum);
  if (victory) m.wins++;
  m.tutorialDone = true;
  saveMeta(m); clearRun();
  const ores = Object.values(collected).reduce((a, b) => a + b, 0);
  // bir sonraki hedef: oyuncunun aklında kalsın
  let goal;
  if (victory) goal = 'Kalp Kristali senin. Şimdi daha hızlı yapabilir misin?';
  else if (G.maxStratum < 3) goal = `Sonraki hedef: <b>${STRATA[G.maxStratum + 1].name}</b> (${(G.maxStratum + 1) * 26}m)`;
  else goal = 'Çekirdek çok yakın. Kalp Kristali\'ni yüzeye taşı!';
  if (!victory && m.oz >= 20) goal += '<br><span style="color:var(--good)">Kampta harcayacak Öz\'ün var.</span>';
  if (victory) sfx.victory(); else sfx.defeat();
  stopAmbience();
  App.scene = 'results';
  setTimeout(() => {
    UI.showHUD(false); UI.closeSheet(); UI.coach('');
    UI.showResults({ victory, reason, maxDepth: s.maxDepth, newDepth, wavesCleared: s.wavesCleared, chests: s.chests, kills: s.kills, ores, oz, goal });
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
  G.time += dt; G.stats.time += dt;
  if (G.hitstop > 0) { G.hitstop -= dt; updateParticles(dt * 0.25); return; }
  updateFlow(dt);
  updatePlayer(dt);
  if (G.over) return;
  updatePlayerGun(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateStructures(dt);
  updateWaves(dt);
  updateOrbs(dt);
  updateDeposit(dt);
  updateParticles(dt);
  updateFlashes(dt);
  const p = G.player;
  if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 8);
  if (G.base.hurtT > 0) G.base.hurtT -= dt;
  // fener ışığında süzülen toz zerreleri (yeraltı hissi; düşük yoğunluk)
  if (!p.dead && p.y > GROUND_Y + 16 && Math.random() < dt * 2.2) {
    const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 36;
    particle(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, (Math.random() - 0.5) * 4, -2 - Math.random() * 3, 2.2, 'rgba(255,236,190,0.55)', 1, 2, 0);
  }
  // yukarı çıkarken sırt motoru
  if (p.up && !p.dead && Math.random() < dt * 30) particle(p.x - p.face * 4 + (Math.random() - 0.5) * 2, p.y + 6, (Math.random() - 0.5) * 10, 40, 0.18, Math.random() < 0.5 ? '#ffd48a' : '#ff9a5a', 1, 1, 0);
  // sakin fazda üs yavaşça kendini onarır (oyuncu yüzeydeyse daha hızlı)
  if (G.wave.phase === 'calm' && G.base.hp > 0 && G.base.hp < G.base.maxHp) G.base.hp = Math.min(G.base.maxHp, G.base.hp + (p.y < GROUND_Y ? 2.5 : 1) * dt);
  UI.tutorialTick(dt);
  updateCamera(dt);
}

function menuStep(dt) {
  G.time += dt; menuT += dt;
  // kamera yüzeyden katmanlara yavaşça iner ve döner
  const span = 1500;
  const k = (Math.sin(menuT * 0.06 - Math.PI / 2) + 1) / 2;
  G.cam.px = G.cam.x; G.cam.py = G.cam.y;
  G.cam.y = -150 + k * span;
  G.cam.x = (272 - view.vw) / 2;
  updateParticles(dt);
}

let lastAmb = '';
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  handleTaps();
  if (!G) return;
  if (App.scene === 'menu') {
    acc += dt; let n = 0;
    while (acc >= STEP && n++ < 5) { menuStep(STEP); acc -= STEP; }
    render(1, { hidePlayer: true });
    return;
  }
  if (App.scene === 'play' && !G.paused && !G.over) {
    if (keyPressed('escape') || keyPressed('p')) { hooks.pause(true); }
    acc += dt; let n = 0;
    while (acc >= STEP && n++ < 6) { step(STEP); acc -= STEP; }
    if (n >= 6) acc = 0;
    UI.refreshHUD();
    saveT += dt;
    if (saveT > 8) { saveT = 0; autosave(); }
    const surf = G.player.y < GROUND_Y;
    const st = Math.max(0, Math.floor((G.player.y / TILE - GROUND_ROW) / 26));
    const key = st + '|' + surf + '|' + (G.wave.phase === 'active');
    if (key !== lastAmb) { lastAmb = key; setAmbience(st, surf, G.wave.phase === 'active'); }
  }
  const sv = App.scene === 'play' && !G.paused && !G.over;
  if (sv !== stickShown) { stickShown = sv; setStickVisible(sv); }
  render(App.scene === 'play' ? Math.min(1, acc / STEP) : 1);
}
let stickShown = null;

function autosave() {
  if (App.scene === 'play' && G && !G.over && G.wave.phase === 'calm') {
    try { saveRun(serialize()); } catch (e) { /* kota */ }
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (App.scene === 'play' && G && !G.over) { autosave(); if (!G.paused) hooks.pause(true); }
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
  get G() { return G; }, App, UI, step, render, view, input,
  // arka planda (rAF yokken) simülasyonu elle ilerletmek için
  tick(sec) {
    const n = Math.round(sec / STEP);
    for (let i = 0; i < n; i++) {
      if (App.scene === 'play' && !G.paused && !G.over) step(STEP); else if (App.scene === 'menu') menuStep(STEP);
    }
    if (App.scene === 'play') UI.refreshHUD();
    render(1, { hidePlayer: App.scene !== 'play' });
  },
};
