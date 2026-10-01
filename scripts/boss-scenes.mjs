// Boss animasyon sahneleri: oyun mantığındaki (bosses.js) zamanlamaları taklit eden sahte varlık durumu.
// Hem önizleme betiği (boss-preview.mjs) hem tarayıcı vitrini (boss-viewer.html) kullanır.
import { ENEMIES, BALROG, BOSS_MELEE, POSEIDON } from '../src/data/balance.js';

export function makeBoss(type, x = 0, y = 0) {
  return { type, x, y, px: x, py: y, face: 1, d: ENEMIES[type], anim: 0, hitT: 0, hitDx: 0, hitDy: 0, wind: 0, lunge: 0, dieT: 0, dead: false, wob: 0.5, intro: 0, blinkT: 0, emergeT: 0, sink: 0, fade: 0, flashT: 0, under: false, x0: x, y0: y, bs: { phase: 1, act: null, marks: [], rings: [] } };
}
const cl = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const act = (e, k, o) => { e.bs.act = { k, T: 1, ...o }; };
const aim = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
// aşamalı eylem: [[ad, süre], ...] -> { stage, st (kalan), k (0..1), i }
function staged(c, list) {
  let t0 = 0;
  for (let i = 0; i < list.length; i++) { const [stage, T] = list[i]; if (c < t0 + T || i === list.length - 1) return { stage, st: Math.max(0, t0 + T - c), k: cl((c - t0) / T), i, T }; t0 += T; }
}
const total = list => list.reduce((s, q) => s + q[1], 0);
// basit eylem: T süresince; bitince boşta
const timed = (k, T, extra) => ({ dur: T + 0.7, run(c, e, p) { if (c < T) { act(e, k, { T: T - c, a: aim(e, p), ...(extra ? extra(c, e, p) : {}) }); } } });

// ---------- her bossta ortak ----------
const COMMON = {
  idle: { dur: 4, run() {} },
  walk: { dur: 3, run(c, e, p, dt) { e.x += e.d.speed * dt; p.x = e.x + 80; } },
  // madenci çevresinde döner: gövde gerçekten döner, baş izler
  turn: { dur: 6, run(c, e, p) { const a = c / 6 * Math.PI * 2; p.x = e.x + Math.cos(a) * 90; p.y = e.y + Math.sin(a) * 70; e.face = p.x >= e.x ? 1 : -1; } },
  hurt: { dur: 1.6, run(c, e) { const k = c % 0.8; e.hitT = k < 0.09 ? 0.09 - k : 0; e.hitDx = -1; e.hitDy = 0; } },
  rage: { dur: 3, run(c, e) { e.bs.phase = c > 0.4 ? 2 : 1; } },
  die: { dur: 0, run(c, e) { const T = e.d.dieT || 0.9; if (c > 0.3) { e.dead = true; e.dieT = Math.max(0.001, T - (c - 0.3)); } } },
  melee: { dur: 1.7, setup(e, p) { p.x = e.x + e.d.r + 10; }, run(c, e, p) { const W = BOSS_MELEE.wind, T = W + BOSS_MELEE.rest; if (c < T) { act(e, 'melee', { T: T - c, a: aim(e, p), R: e.d.r + BOSS_MELEE.reach, arc: BOSS_MELEE.arc, done: c >= W }); e.wind = c < W ? c / W : 0; } } },
  spawn: { dur: 2.4, run(c, e) { e.emergeT = Math.max(0, 1.4 - c); } },
};
COMMON.die.len = e => (e.d.dieT || 0.9) + 0.5;

// ---------- türe özel saldırılar ----------
const SCENES = {
  kehribarAna: {
    eggs: { dur: 1.4, run(c, e) { if (c < 0.4) { act(e, 'eggs', { T: 0.4 - c }); if (c < 0.02) e.lunge = 1; } } },
    resin: { dur: 1.3, run(c, e) { if (c < 0.4) { act(e, 'resin', { T: 0.4 - c }); if (c < 0.02) e.lunge = 1; } } },
    amber: { dur: 1.5, run(c, e) { if (c < 0.3) act(e, 'amber', { T: 0.3 - c }); } },
  },
  kavurgan: {
    breath: { dur: 2.6, run(c, e, p) { if (c < 1.9) { act(e, 'breath', { T: 1.9 - c, a: aim(e, p), fire: c > 0.7 }); e.wind = c < 0.7 ? c / 0.7 : 0; } } },
    breathUp: { dur: 2.6, setup(e, p) { p.x = e.x + 40; p.y = e.y - 50; }, run(c, e, p) { SCENES.kavurgan.breath.run(c, e, p); } },
    embers: { dur: 1.5, run(c, e) { if (c < 0.45) { act(e, 'embers', { T: 0.45 - c }); if (c < 0.02) e.lunge = 1; } } },
    bones: { dur: 1.2, run(c, e) { if (c < 0.4) { act(e, 'bones', { T: 0.4 - c }); if (c < 0.02) e.lunge = 1; } } },
  },
  ezeli: {
    pillars: { dur: 1.4, run(c, e) { if (c < 0.4) { act(e, 'pillars', { T: 0.4 - c }); if (c < 0.02) e.flashT = 0.4; } } },
    doom: { dur: 2.4, run(c, e) { if (c < 1.2) { act(e, 'doom', { T: 1.2 - c }); e.wind = c / 1.2; } } },
  },
  madenKalbi: {
    spikes: { dur: 1.5, run(c, e) { if (c < 0.4) { act(e, 'spikes', { T: 0.4 - c }); if (c < 0.02) e.flashT = 0.4; } } },
    fall: { dur: 1.3, run(c, e) { if (c < 0.3) act(e, 'fall', { T: 0.3 - c }); } },
    beat: { dur: 2.1, run(c, e) { if (c < 1) { act(e, 'beat', { T: 1 - c, n: 0 }); e.wind = c; } } },
  },
  otegoz: {
    orbs: { dur: 1.3, run(c, e, p) { if (c < 0.5) { act(e, 'orbs', { T: 0.5 - c, a: aim(e, p) }); if (c < 0.02) e.flashT = 0.5; } } },
    pull: { dur: 2.8, run(c, e) { if (c < 2) { act(e, 'pull', { T: 2 - c, fire: c > 0.6 }); e.wind = c < 0.6 ? c / 0.6 : 0; } } },
    gaze: { dur: 2.9, run(c, e, p) { if (c < 2.1) { act(e, 'gaze', { T: 2.1 - c, fire: c > 0.8, a: aim(e, p) - 0.75 + Math.max(0, c - 0.8) * 1.25, len: 100 }); e.wind = c < 0.8 ? c / 0.8 : 0; } } },
    blink: { dur: 1.2, run(c, e) { e.blinkT = c < 0.3 ? 0 : Math.max(0, 0.6 - c); } },
  },
  karakok: {
    spikes: { dur: 1.5, run(c, e) { if (c < 0.5) { act(e, 'spikes', { T: 0.5 - c }); if (c < 0.02) e.lunge = 1; } } },
    burrow: { dur: 2.6, run(c, e) { const L = [['sink', 0.5], ['go', 0.6], ['rise', 0.65]]; if (c >= total(L)) return; const s = staged(c, L); act(e, 'burrow', { stage: s.stage, st: s.st, T: 4 }); e.sink = s.stage === 'sink' ? s.k : 0; e.under = s.stage !== 'sink'; } },
    summon: { dur: 1.2, run(c, e) { if (c < 0.3) act(e, 'summon', { T: 0.3 - c }); } },
  },
  aynasiz: {
    mirror: { dur: 2.1, run(c, e, p) { if (c < 1.4) { act(e, 'mirror', { T: 1.4 - c, n: 0, tgt: 0 }); e.wind = Math.min(1, c / 0.55); if (c < 0.02) e.flashT = 0.6; } } },
    step: { dur: 1.3, run(c, e) { if (c < 0.5) act(e, 'step', { T: 0.5 - c }); } },
    shards: { dur: 1.3, run(c, e) { if (c < 0.4) { act(e, 'shards', { T: 0.4 - c }); if (c < 0.02) e.lunge = 1; } } },
  },
  kordesen: {
    charge: { dur: 3.3, run(c, e, p, dt) {
      const L = [['aim', 0.8], ['dash', 0.5], ['daze', 1.1]]; if (c >= total(L)) return; const s = staged(c, L);
      act(e, 'charge', { stage: s.stage, st: s.st, T: 3, a: e.aimA ?? (e.aimA = aim(e, p)), fire: s.stage === 'dash' }); e.wind = s.stage === 'aim' ? s.k : 0;
      if (s.stage === 'dash') { e.x += Math.cos(e.aimA) * 200 * dt; e.y += Math.sin(e.aimA) * 200 * dt; e.lunge = 1; }
    } },
    chargeUp: { dur: 3.3, setup(e, p) { p.x = e.x + 50; p.y = e.y - 60; }, run(c, e, p, dt) { SCENES.kordesen.charge.run(c, e, p, dt); } },
    slam: { dur: 1.6, setup(e, p) { p.x = e.x + 34; }, run(c, e) { if (c < 0.6) { act(e, 'slam', { T: 0.6 - c }); e.wind = c / 0.6; } } },
    coins: { dur: 1.3, run(c, e, p) { if (c < 0.35) { act(e, 'coins', { T: 0.35 - c }); if (c < 0.02) e.lunge = 1; } } },
  },
  balrog: {
    intro: { dur: 3.4, run(c, e) { e.intro = Math.max(0, BALROG.intro - c); } },
    sword: { dur: 2.2, setup(e, p) { p.x = e.x + 30; }, run(c, e) { const L = [['raise', 0.8], ['fall', 0.7]]; if (c >= total(L)) return; const s = staged(c, L); act(e, 'sword', { stage: s.stage, st: s.st, T: 9, fire: s.stage === 'fall' }); e.wind = s.stage === 'raise' ? s.k : 0; } },
    whip: { dur: 2, run(c, e, p) { const L = [['wind', 0.6], ['lash', 0.36], ['rest', 0.35]]; if (c >= total(L)) return; const s = staged(c, L); act(e, 'whip', { stage: s.stage, st: s.st, T: 9, a: aim({ x: e.x + e.face * 30, y: e.y - 16 }, { x: p.x, y: p.y - 3 }), len: 90, fire: s.stage === 'lash' }); e.wind = s.stage === 'wind' ? s.k : 0; } },
    wings: { dur: 2.8, run(c, e) { if (c < 2.2) { act(e, 'wings', { T: 2.2 - c, done: c > 0.9, fire: c > 0.9 }); e.wind = c < 0.9 ? c / 0.9 : 0; } } },
    breath: { dur: 3.3, run(c, e, p) { const L = [['inhale', 0.8], ['fire', 1.5], ['rest', 0.45]]; if (c >= total(L)) return; const s = staged(c, L); act(e, 'breath', { stage: s.stage, st: s.st, T: 9, a: aim({ x: e.x + e.face * 20, y: e.y - 34 }, { x: p.x, y: p.y - 3 }), fire: s.stage === 'fire' }); e.wind = s.stage === 'inhale' ? s.k : 0; } },
    swoop: { dur: 3.4, run(c, e, p, dt) {
      const L = [['flap', 1], ['fly', 1], ['land', 0.7]]; if (c >= total(L)) return; const s = staged(c, L);
      act(e, 'swoop', { stage: s.stage, st: s.st, T: 9, dur: 1, a: s.stage === 'flap' ? undefined : 0, fire: s.stage === 'fly' }); e.wind = s.stage === 'flap' ? s.k : 0;
      if (s.stage === 'fly') { const k = s.k * s.k * (3 - 2 * s.k); e.x = e.x0 + 90 * k; e.y = e.y0 - Math.sin(s.k * Math.PI) * 40; e.lunge = 1; } else if (s.stage === 'land') { e.x = e.x0 + 90; e.y = e.y0; }
    } },
  },
  poseidon: {
    intro: { dur: 3.9, run(c, e) { e.introT = POSEIDON.intro; e.intro = Math.max(0, POSEIDON.intro - c); } },
    spear: { dur: 2.6, run(c, e, p) {
      const W = POSEIDON.spear.aim; e.bs.armed = c < W || c > W + 1.2; e.bs.reform = c > W + 0.75 && c <= W + 1.2 ? W + 1.2 - c : 0;
      if (c < W + 0.5) { act(e, 'spear', { stage: c < W ? 'aim' : 'rest', st: c < W ? W - c : W + 0.5 - c, T: 9, a: aim({ x: e.x + 2, y: e.y - 38 }, p) }); e.wind = c < W ? c / W : 0; }
    } },
    spearUp: { dur: 2.6, setup(e, p) { p.x = e.x + 60; p.y = e.y - 70; }, run(c, e, p) { SCENES.poseidon.spear.run(c, e, p); } },
    wave: { dur: 2, run(c, e, p) { const W = POSEIDON.wave.wind; if (c < W + 0.5) { act(e, 'wave', { stage: c < W ? 'wind' : 'rest', st: c < W ? W - c : W + 0.5 - c, T: 9, a: aim({ x: e.x, y: e.y - 22 }, p) }); e.wind = c < W ? c / W : 0; } } },
    spout: { dur: 2.2, run(c, e) { const W = POSEIDON.spout.raise + 0.45; if (c < W) { act(e, 'spout', { T: W - c }); e.wind = Math.min(1, c / POSEIDON.spout.raise); } } },
    morph: { dur: 4.4, run(c, e) { e.bs.phase = c > 0.3 ? 2 : 1; } },
    tIdle: { dur: 4, setup(e) { e.bs.phase = 2; }, run() {} },
    tWalk: { dur: 3, setup(e) { e.bs.phase = 2; }, run(c, e, p, dt) { e.x += e.d.speed * POSEIDON.crawl * dt; p.x = e.x + 80; } },
    tTurn: { dur: 6, setup(e) { e.bs.phase = 2; }, run(c, e, p) { const a = c / 6 * Math.PI * 2; p.x = e.x + Math.cos(a) * 90; p.y = e.y + Math.sin(a) * 50 - 20; e.face = p.x >= e.x ? 1 : -1; } },
    tMelee: { dur: 1.7, setup(e, p) { e.bs.phase = 2; p.x = e.x + 40; }, run(c, e, p) { const W = BOSS_MELEE.wind, T = W + BOSS_MELEE.rest; if (c < T) { act(e, 'melee', { T: T - c, a: aim(e, p), R: 60, arc: 1.15, done: c >= W }); e.wind = c < W ? c / W : 0; } } },
    tSlam: { dur: 2.6, setup(e) { e.bs.phase = 2; }, run(c, e) { const W = POSEIDON.slam.wind; if (c < W + 0.7) { act(e, 'slam', { stage: c < W ? 'raise' : 'rest', st: c < W ? W - c : W + 0.7 - c, T: 9 }); e.wind = c < W ? c / W : 0; } } },
    tSpear: { dur: 2.2, setup(e) { e.bs.phase = 2; }, run(c, e, p) { const W = POSEIDON.spear.aim; if (c < W + 0.5) { act(e, 'spear', { stage: c < W ? 'aim' : 'rest', st: c < W ? W - c : W + 0.5 - c, T: 9, a: aim({ x: e.x, y: e.y - 58 }, p) }); e.wind = c < W ? c / W : 0; } } },
    tSpout: { dur: 2.2, setup(e) { e.bs.phase = 2; }, run(c, e) { SCENES.poseidon.spout.run(c, e); } },
    tHurt: { dur: 1.6, setup(e) { e.bs.phase = 2; }, run(c, e) { COMMON.hurt.run(c, e); } },
    tDie: { dur: 0, len: e => (e.d.dieT || 0.9) + 0.5, setup(e) { e.bs.phase = 2; }, run(c, e) { COMMON.die.run(c, e); } },
  },
  ejder: {
    breath: { dur: 3.9, run(c, e, p) {
      const L = [['glow', 1.1], ['fire', 1.6], ['rest', 0.4]]; if (c >= total(L)) return;
      const s = staged(c, L); act(e, 'breath', { stage: s.stage, st: s.st, T: 9, a: aim({ x: e.x + e.face * 38, y: e.y - 12 }, { x: p.x, y: p.y - 3 }), fire: s.stage === 'fire' });
      e.wind = s.stage === 'glow' ? s.k : 0; e.weakT = s.stage === 'glow' ? s.st : 0;
    } },
    breathUp: { dur: 3.9, setup(e, p) { p.x = e.x + 50; p.y = e.y - 70; }, run(c, e, p) { SCENES.ejder.breath.run(c, e, p); } },
    breathDown: { dur: 3.9, setup(e, p) { p.x = e.x + 60; p.y = e.y + 60; }, run(c, e, p) { SCENES.ejder.breath.run(c, e, p); } },
    tail: { dur: 1.7, setup(e, p) { p.x = e.x - 24; }, run(c, e) { if (c < 0.9) { const T = 0.9 - c; act(e, 'tail', { T, done: T <= 0.4 }); e.wind = 1 - Math.max(0, T - 0.4) / 0.5; } } },
    gust: { dur: 2.1, run(c, e) { if (c < 1.3) { const T = 1.3 - c; act(e, 'gust', { T, done: T <= 0.7, fire: T <= 0.7 }); e.wind = Math.min(1, c / 0.6); } } },
    soar: { dur: 4.6, run(c, e, p, dt) {
      const L = [['up', 0.9], ['hover', 2.4], ['dive', 0.5]]; if (c >= total(L)) { e.y = e.y0; return; }
      const s = staged(c, L), drop = 0.75 - ((c - 0.9) % 0.75);
      act(e, 'soar', { stage: s.stage, st: s.st, T: 9, drop: s.stage === 'hover' ? drop : 0.5 });
      if (s.stage === 'up') { e.x += (p.x - e.x) * Math.min(1, dt * 2.5); e.y += (p.y - 64 - e.y) * Math.min(1, dt * 3); }
      else if (s.stage === 'hover') e.x += (p.x - e.x) * Math.min(1, dt * 1.5);
      else { e.x += (p.x - e.x) * Math.min(1, dt * 8); e.y += (e.y0 - e.y) * Math.min(1, dt * 8 * s.k + dt); }
      e.px = e.x; e.py = e.y;
    } },
  },
};

export function sceneNames(type) { return [...Object.keys(COMMON), ...Object.keys(SCENES[type] || {})]; }
export function getScene(type, name) {
  const s = (SCENES[type] && SCENES[type][name]) || COMMON[name]; if (!s) return null;
  return { ...s, dur: s.len ? null : s.dur, len: s.len };
}
// bir adım: varlığı sahneye göre günceller (c: sahne başından beri saniye)
export function stepScene(scene, c, e, p, dt) {
  e.px = e.x; e.py = e.y; e.hitT = 0; e.wind = 0; e.lunge = Math.max(0, (e.lunge || 0) - dt * 4); e.bs.act = null; e.anim += dt * 7; e.fade = 0; e.under = false; e.intro = 0; e.sink = 0; e.blinkT = 0; e.flashT = Math.max(0, (e.flashT || 0) - dt);
  if (c >= 0) scene.run(c, e, p, dt);
}
export const BALROG_INTRO = BALROG.intro;
