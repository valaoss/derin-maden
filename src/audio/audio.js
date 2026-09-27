// Prosedürel ses: WebAudio ile sentezlenir, dosya yok.
// Her ses kimliği için kısma (throttle) + eşzamanlı ses bütçesi var.
import { App } from '../game/state.js';

let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
const last = {};
let active = 0;
const MAX_VOICES = 14;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musBus = ctx.createGain(); musBus.gain.value = 0.5; musBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyAudioSettings();
}
export function applyAudioSettings() {
  if (!ctx) return;
  sfxBus.gain.value = App.settings.sfx ? 1 : 0;
  musBus.gain.value = App.settings.music ? 0.5 : 0;
}
export function suspendAudio(s) { if (!ctx) return; if (s) ctx.suspend(); else ctx.resume(); }

function ok(id, gap) {
  if (!ctx || !App.settings.sfx) return false;
  const t = ctx.currentTime;
  if (last[id] && t - last[id] < gap) return false;
  if (active >= MAX_VOICES) return false;
  last[id] = t; return true;
}
function track(node, dur) { active++; setTimeout(() => active--, dur * 1000 + 30); return node; }

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function noise(t, dur, { type = 'lowpass', f = 1000, q = 1, gain = 0.3, f2 = null, a = 0.002 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, a, gain, dur);
  s.connect(fl); fl.connect(g); g.connect(sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + a + 0.05);
  track(s, dur);
}
function tone(t, dur, { type = 'sine', f = 440, f2 = null, gain = 0.2, a = 0.004, bus = sfxBus } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, a, gain, dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + dur + 0.05);
  track(o, dur);
}
const vary = (v, p = 0.08) => v * (1 + (Math.random() * 2 - 1) * p);

// Kazı vuruşu: malzemeye göre karakter
const DIG = {
  dirt:    { f: 520, q: 0.8, g: 0.32, d: 0.07, ping: 0 },
  stone:   { f: 1400, q: 1.6, g: 0.26, d: 0.06, ping: 1250 },
  hard:    { f: 2100, q: 2.4, g: 0.22, d: 0.05, ping: 1850 },
  dense:   { f: 900, q: 3, g: 0.24, d: 0.08, ping: 640 },
  bedrock: { f: 700, q: 2, g: 0.2, d: 0.05, ping: 300 },
};
export const sfx = {
  dig(mat) {
    if (!ok('dig', 0.05)) return;
    const t = ctx.currentTime, m = DIG[mat] || DIG.dirt;
    noise(t, m.d, { type: 'bandpass', f: vary(m.f), q: m.q, gain: m.g });
    tone(t, 0.05, { type: 'triangle', f: vary(170), f2: 70, gain: 0.22 });
    if (m.ping) tone(t, 0.09, { type: 'square', f: vary(m.ping, 0.05), gain: 0.035 });
  },
  breakBlock(mat) {
    if (!ok('break', 0.04)) return;
    const t = ctx.currentTime, m = DIG[mat] || DIG.dirt;
    noise(t, 0.16, { type: 'lowpass', f: vary(m.f * 1.4), f2: 180, gain: 0.34 });
    tone(t, 0.12, { type: 'sine', f: vary(120), f2: 45, gain: 0.3 });
  },
  oreReveal() {
    if (!ok('ore', 0.08)) return;
    const t = ctx.currentTime;
    tone(t, 0.12, { type: 'triangle', f: 1320, gain: 0.08 });
    tone(t + 0.05, 0.16, { type: 'triangle', f: 1760, gain: 0.07 });
  },
  pickup(step) {
    if (!ok('pick', 0.03)) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const f = 660 * Math.pow(2, scale[Math.min(step, scale.length - 1)] / 12);
    tone(ctx.currentTime, 0.08, { type: 'sine', f, gain: 0.12 });
  },
  bagFull() {
    if (!ok('full', 0.6)) return;
    const t = ctx.currentTime;
    tone(t, 0.1, { type: 'square', f: 330, gain: 0.06 }); tone(t + 0.1, 0.14, { type: 'square', f: 247, gain: 0.06 });
  },
  deposit(n) {
    if (!ok('deposit', 0.3)) return;
    const t = ctx.currentTime, notes = [523, 659, 784, 1047];
    for (let i = 0; i < Math.min(4, 1 + (n >> 2)); i++) tone(t + i * 0.06, 0.16, { type: 'triangle', f: notes[i], gain: 0.1 });
    noise(t, 0.2, { type: 'highpass', f: 5000, gain: 0.05 });
  },
  tick() { if (!ok('tick', 0.035)) return; tone(ctx.currentTime, 0.03, { type: 'square', f: vary(1800, 0.03), gain: 0.025 }); },
  shoot() {
    if (!ok('shoot', 0.05)) return;
    const t = ctx.currentTime;
    tone(t, 0.07, { type: 'square', f: vary(900), f2: 260, gain: 0.05 });
    noise(t, 0.04, { type: 'highpass', f: 2500, gain: 0.05 });
  },
  turret() {
    if (!ok('turret', 0.07)) return;
    tone(ctx.currentTime, 0.06, { type: 'square', f: vary(1300), f2: 500, gain: 0.03 });
  },
  hit() { if (!ok('hit', 0.04)) return; noise(ctx.currentTime, 0.05, { type: 'bandpass', f: vary(2400), q: 2, gain: 0.14 }); },
  enemyDie(big) {
    if (!ok('edie', 0.05)) return;
    const t = ctx.currentTime;
    noise(t, big ? 0.35 : 0.18, { type: 'lowpass', f: 2200, f2: 150, gain: big ? 0.35 : 0.22 });
    tone(t, 0.14, { type: 'sawtooth', f: vary(big ? 160 : 320), f2: 60, gain: 0.07 });
  },
  playerHurt() {
    if (!ok('phurt', 0.12)) return;
    const t = ctx.currentTime;
    tone(t, 0.18, { type: 'sawtooth', f: 220, f2: 90, gain: 0.12 });
    noise(t, 0.12, { type: 'lowpass', f: 900, gain: 0.2 });
  },
  baseHurt() {
    if (!ok('bhurt', 0.35)) return;
    const t = ctx.currentTime;
    tone(t, 0.25, { type: 'square', f: 180, f2: 150, gain: 0.06 });
    noise(t, 0.1, { type: 'bandpass', f: 3000, q: 3, gain: 0.1 });
  },
  explode() {
    if (!ok('boom', 0.08)) return;
    const t = ctx.currentTime;
    noise(t, 0.5, { type: 'lowpass', f: 1600, f2: 80, gain: 0.45 });
    tone(t, 0.35, { type: 'sine', f: 90, f2: 30, gain: 0.35 });
  },
  alarm() {
    if (!ok('alarm', 1.5)) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      tone(t + i * 0.5, 0.22, { type: 'square', f: 620, gain: 0.05 });
      tone(t + i * 0.5 + 0.25, 0.22, { type: 'square', f: 465, gain: 0.05 });
    }
  },
  rumble() {
    if (!ok('rumble', 0.8)) return;
    noise(ctx.currentTime, 0.9, { type: 'lowpass', f: 140, gain: 0.35, a: 0.2 });
  },
  waveStart() {
    if (!ok('wstart', 1)) return;
    const t = ctx.currentTime;
    tone(t, 0.6, { type: 'sawtooth', f: 110, gain: 0.08, a: 0.05 });
    tone(t, 0.6, { type: 'sawtooth', f: 165, gain: 0.05, a: 0.05 });
    noise(t, 0.6, { type: 'lowpass', f: 300, gain: 0.2, a: 0.1 });
  },
  waveClear() {
    if (!ok('wclear', 1)) return;
    const t = ctx.currentTime, n = [392, 523, 659, 784];
    n.forEach((f, i) => tone(t + i * 0.09, 0.3, { type: 'triangle', f, gain: 0.09 }));
  },
  stratum() {
    if (!ok('strat', 1)) return;
    const t = ctx.currentTime;
    [131, 196, 262].forEach(f => tone(t, 1.6, { type: 'sine', f, gain: 0.08, a: 0.05 }));
    tone(t + 0.1, 1.2, { type: 'triangle', f: 523, gain: 0.04, a: 0.05 });
  },
  chest() {
    if (!ok('chest', 0.5)) return;
    const t = ctx.currentTime, n = [523, 659, 784, 1047, 1319];
    n.forEach((f, i) => tone(t + i * 0.07, 0.35, { type: 'triangle', f, gain: 0.08 }));
  },
  click() { if (!ok('click', 0.03)) return; tone(ctx.currentTime, 0.035, { type: 'square', f: 1200, f2: 800, gain: 0.04 }); },
  buy() {
    if (!ok('buy', 0.08)) return;
    const t = ctx.currentTime;
    tone(t, 0.08, { type: 'square', f: 988, gain: 0.05 }); tone(t + 0.07, 0.18, { type: 'square', f: 1319, gain: 0.05 });
  },
  deny() { if (!ok('deny', 0.15)) return; tone(ctx.currentTime, 0.14, { type: 'square', f: 150, gain: 0.06 }); },
  build() {
    if (!ok('build', 0.1)) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) noise(t + i * 0.07, 0.05, { type: 'bandpass', f: 1800 + i * 300, q: 3, gain: 0.15 });
  },
  victory() {
    if (!ctx) return;
    const t = ctx.currentTime, n = [523, 659, 784, 1047, 784, 1047, 1319];
    n.forEach((f, i) => tone(t + i * 0.12, 0.4, { type: 'triangle', f, gain: 0.1 }));
  },
  defeat() {
    if (!ctx) return;
    const t = ctx.currentTime, n = [392, 330, 262, 196];
    n.forEach((f, i) => tone(t + i * 0.22, 0.5, { type: 'triangle', f, gain: 0.1 }));
  },
};

// ---------------- Ambiyans / müzik ----------------
// Katman başına alçak drone; dalga sırasında nabız gibi bas.
let amb = null;
const AMB_NOTES = [[55, 82.4], [49, 73.4], [43.6, 65.4], [41.2, 61.7]];
export function setAmbience(stratum, surface, inWave) {
  if (!ctx) return;
  if (!amb) {
    amb = { o1: ctx.createOscillator(), o2: ctx.createOscillator(), f: ctx.createBiquadFilter(), g: ctx.createGain(),
      wind: ctx.createBufferSource(), wf: ctx.createBiquadFilter(), wg: ctx.createGain(),
      pulse: ctx.createOscillator(), pg: ctx.createGain(), lfo: ctx.createOscillator(), lg: ctx.createGain() };
    amb.o1.type = 'sawtooth'; amb.o2.type = 'sawtooth';
    amb.f.type = 'lowpass'; amb.f.frequency.value = 220; amb.g.gain.value = 0;
    amb.o1.connect(amb.f); amb.o2.connect(amb.f); amb.f.connect(amb.g); amb.g.connect(musBus);
    amb.wind.buffer = noiseBuf; amb.wind.loop = true; amb.wf.type = 'bandpass'; amb.wf.frequency.value = 500; amb.wf.Q.value = 0.6;
    amb.wg.gain.value = 0; amb.wind.connect(amb.wf); amb.wf.connect(amb.wg); amb.wg.connect(musBus);
    // dalga nabzı: 55Hz, 2Hz LFO ile genlik
    amb.pulse.type = 'sine'; amb.pulse.frequency.value = 55; amb.pg.gain.value = 0;
    amb.lfo.frequency.value = 2; amb.lg.gain.value = 0; amb.lfo.connect(amb.lg); amb.lg.connect(amb.pg.gain);
    amb.pulse.connect(amb.pg); amb.pg.connect(musBus);
    amb.o1.start(); amb.o2.start(); amb.wind.start(); amb.pulse.start(); amb.lfo.start();
  }
  const t = ctx.currentTime, n = AMB_NOTES[Math.max(0, stratum)];
  amb.o1.frequency.setTargetAtTime(n[0], t, 1.5);
  amb.o2.frequency.setTargetAtTime(n[1] * 1.003, t, 1.5);
  amb.g.gain.setTargetAtTime(surface ? 0.0 : 0.05, t, 1.2);
  amb.wg.gain.setTargetAtTime(surface ? 0.05 : 0.0, t, 1.2);
  amb.lg.gain.setTargetAtTime(inWave ? 0.09 : 0, t, 0.8);
}
export function stopAmbience() {
  if (!amb || !ctx) return;
  const t = ctx.currentTime;
  amb.g.gain.setTargetAtTime(0, t, 0.3); amb.wg.gain.setTargetAtTime(0, t, 0.3); amb.lg.gain.setTargetAtTime(0, t, 0.3);
}

export function haptic(ms) {
  if (!App.settings.haptics || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch (e) { /* desteklenmiyor */ }
}
