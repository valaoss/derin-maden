// Prosedürel ses: WebAudio ile sentezlenir, dosya yok.
// Her ses kimliği için kısma (throttle) + eşzamanlı ses bütçesi var.
import { App } from '../game/state.js';
import { isNative, nativeHaptic } from '../core/native.js';

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
  metal:   { f: 1800, q: 4, g: 0.16, d: 0.09, ping: 2600 },
};
export const sfx = {
  dig(mat, tier = 0) {
    if (!ok('dig', 0.05)) return;
    const t = ctx.currentTime, m = DIG[mat] || DIG.dirt;
    noise(t, m.d, { type: 'bandpass', f: vary(m.f), q: m.q, gain: m.g });
    tone(t, 0.05, { type: 'triangle', f: vary(170), f2: 70, gain: 0.22 });
    if (m.ping) tone(t, 0.09, { type: 'square', f: vary(m.ping, 0.05), gain: 0.035 });
    // kazma kademesi: odun tok, metal çınlar, kristal tınlar
    if (tier >= 2) tone(t, 0.07 + tier * 0.02, { type: 'sine', f: vary(2200 + tier * 500, 0.04), gain: 0.02 + tier * 0.006 });
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
  craft() {
    if (!ok('craft', 0.08)) return;
    const t = ctx.currentTime;
    noise(t, 0.05, { type: 'bandpass', f: 2600, q: 4, gain: 0.14 });
    tone(t + 0.04, 0.08, { type: 'square', f: 784, gain: 0.05 }); tone(t + 0.1, 0.14, { type: 'square', f: 1175, gain: 0.05 });
  },
  fuse() { if (!ok('fuse', 0.1)) return; noise(ctx.currentTime, 0.3, { type: 'highpass', f: 4000, gain: 0.08, a: 0.03 }); },
  fuseTick() { if (!ok('fuset', 0.08)) return; tone(ctx.currentTime, 0.03, { type: 'square', f: 1400, gain: 0.03 }); },
  heal() {
    if (!ok('heal', 0.2)) return;
    const t = ctx.currentTime;
    [523, 784, 1047].forEach((f, i) => tone(t + i * 0.05, 0.18, { type: 'sine', f, gain: 0.07 }));
  },
  arm() { if (!ok('arm', 0.1)) return; const t = ctx.currentTime; tone(t, 0.04, { type: 'square', f: 1800, gain: 0.03 }); tone(t + 0.07, 0.04, { type: 'square', f: 1800, gain: 0.03 }); },
  recall() {
    if (!ok('recall', 0.5)) return;
    tone(ctx.currentTime, 1.4, { type: 'sine', f: 220, f2: 1320, gain: 0.08, a: 0.1 });
  },
  warp() {
    if (!ok('warp', 0.3)) return;
    const t = ctx.currentTime;
    tone(t, 0.25, { type: 'triangle', f: 1760, f2: 440, gain: 0.1 });
    noise(t, 0.3, { type: 'bandpass', f: 3000, gain: 0.08, f2: 600 });
  },
  creak() {
    if (!ok('creak', 0.4)) return;
    const t = ctx.currentTime;
    noise(t, 0.5, { type: 'bandpass', f: 320, q: 6, gain: 0.22, a: 0.08 });
    tone(t, 0.4, { type: 'sawtooth', f: 70, f2: 55, gain: 0.04, a: 0.05 });
  },
  rockfall() {
    if (!ok('rockfall', 0.15)) return;
    noise(ctx.currentTime, 0.4, { type: 'lowpass', f: 600, f2: 120, gain: 0.3 });
  },
  gas() {
    if (!ok('gas', 0.3)) return;
    noise(ctx.currentTime, 0.9, { type: 'highpass', f: 2500, gain: 0.12, a: 0.05, f2: 5000 });
  },
  cough() { if (!ok('cough', 0.45)) return; noise(ctx.currentTime, 0.09, { type: 'bandpass', f: vary(700), q: 2, gain: 0.16 }); },
  burrow() { if (!ok('burrow', 0.5)) return; noise(ctx.currentTime, 0.45, { type: 'lowpass', f: 220, gain: 0.2, a: 0.05 }); },
  // Parıldak: kör edici parlama - tiz çınlama + hava basıncı
  glare() {
    if (!ok('glare', 0.4)) return;
    const t = ctx.currentTime;
    tone(t, 0.5, { type: 'sine', f: 2400, f2: 3600, gain: 0.12, a: 0.01 });
    tone(t, 0.7, { type: 'triangle', f: 4800, f2: 6200, gain: 0.05, a: 0.02 });
    noise(t, 0.25, { type: 'highpass', f: 3000, gain: 0.12 });
  },
  // Uluyan: korkutucu çığlık - iki detune testere, aşağı kayan + titrek gürültü
  howl() {
    if (!ok('howl', 0.8)) return;
    const t = ctx.currentTime;
    tone(t, 0.9, { type: 'sawtooth', f: 620, f2: 180, gain: 0.11, a: 0.06 });
    tone(t + 0.02, 0.85, { type: 'sawtooth', f: 660, f2: 200, gain: 0.08, a: 0.06 });
    tone(t + 0.1, 0.6, { type: 'square', f: 95, f2: 55, gain: 0.09, a: 0.05 });
    noise(t, 0.9, { type: 'bandpass', f: 900, f2: 300, q: 1.2, gain: 0.12, a: 0.08 });
  },
  // Çekici: yapışkan dil fırlatır
  tongue() {
    if (!ok('tongue', 0.3)) return;
    const t = ctx.currentTime;
    tone(t, 0.18, { type: 'triangle', f: 300, f2: 1200, gain: 0.09 });
    noise(t + 0.12, 0.12, { type: 'bandpass', f: 600, q: 3, gain: 0.12 });
  },
  spit() { if (!ok('spit', 0.15)) return; const t = ctx.currentTime; noise(t, 0.09, { type: 'bandpass', f: vary(1100), q: 1.5, gain: 0.1 }); tone(t, 0.08, { type: 'triangle', f: 500, f2: 900, gain: 0.05 }); },
  // iniş: kısa tok darbe
  land() { if (!ok('land', 0.15)) return; const t = ctx.currentTime; noise(t, 0.06, { type: 'lowpass', f: 500, gain: 0.16 }); tone(t, 0.06, { type: 'sine', f: 140, f2: 70, gain: 0.12 }); },
  // Gölge belirdiğinde: soğuk fısıltı
  shade() { if (!ok('shade', 0.6)) return; noise(ctx.currentTime, 0.4, { type: 'bandpass', f: 2600, f2: 900, q: 4, gain: 0.07, a: 0.08 }); },
  // v4: örümcek ağı fırlatma
  web() { if (!ok('web', 0.2)) return; const t = ctx.currentTime; noise(t, 0.12, { type: 'highpass', f: 2500, gain: 0.09 }); tone(t, 0.1, { type: 'triangle', f: 1800, f2: 600, gain: 0.05 }); },
  // Örümcek Ana yumurtlar
  brood() { if (!ok('brood', 0.5)) return; const t = ctx.currentTime; tone(t, 0.3, { type: 'sawtooth', f: 180, f2: 90, gain: 0.08, a: 0.03 }); noise(t, 0.25, { type: 'bandpass', f: 700, q: 2, gain: 0.1 }); },
  // Boşluk Gözü ışınlanır
  blink() { if (!ok('blink', 0.2)) return; const t = ctx.currentTime; tone(t, 0.16, { type: 'sine', f: 1400, f2: 300, gain: 0.08 }); tone(t + 0.08, 0.16, { type: 'sine', f: 300, f2: 1600, gain: 0.07 }); },
  // sekme: metalik tınlama
  chirp() { if (!ok('chirp', 0.3)) return; const t = ctx.currentTime; tone(t, 0.07, { type: 'sine', f: 3200, f2: 4300, gain: 0.05 }); tone(t + 0.1, 0.08, { type: 'sine', f: 3700, f2: 2900, gain: 0.05 }); },
  ping() { if (!ok('ping', 0.06)) return; tone(ctx.currentTime, 0.06, { type: 'square', f: vary(2600, 0.05), f2: 1800, gain: 0.04 }); },
  // yıldırım sıçraması
  zap() { if (!ok('zap', 0.08)) return; const t = ctx.currentTime; noise(t, 0.06, { type: 'highpass', f: 3500, gain: 0.1 }); tone(t, 0.05, { type: 'square', f: 900, f2: 2400, gain: 0.04 }); },
  // Aşırı Yük: yükselen şarj
  overdrive() { if (!ok('od', 0.5)) return; const t = ctx.currentTime; tone(t, 0.5, { type: 'sawtooth', f: 200, f2: 1400, gain: 0.09, a: 0.02 }); tone(t + 0.3, 0.25, { type: 'square', f: 1400, gain: 0.05 }); },
  // Nova: patlama halkası
  nova() { if (!ok('nova', 0.4)) return; const t = ctx.currentTime; noise(t, 0.3, { type: 'lowpass', f: 1500, f2: 200, gain: 0.25 }); tone(t, 0.25, { type: 'sine', f: 900, f2: 120, gain: 0.14 }); },
  // elit doğuşu
  elite() { if (!ok('elite', 0.6)) return; const t = ctx.currentTime; tone(t, 0.18, { type: 'square', f: 330, gain: 0.06 }); tone(t + 0.18, 0.28, { type: 'square', f: 495, gain: 0.06 }); },
  // eşleşme/bağlantı
  connect() { if (!ok('conn', 0.3)) return; const t = ctx.currentTime; tone(t, 0.1, { type: 'triangle', f: 660, gain: 0.08 }); tone(t + 0.1, 0.16, { type: 'triangle', f: 990, gain: 0.08 }); },
  frost() {
    if (!ok('frost', 0.1)) return;
    tone(ctx.currentTime, 0.08, { type: 'triangle', f: vary(2200, 0.04), f2: 1500, gain: 0.05 });
  },
  drum() { if (!ok('drum', 0.3)) return; const t = ctx.currentTime; tone(t, 0.55, { type: 'sine', f: 78, f2: 38, gain: 0.4, a: 0.005 }); noise(t, 0.35, { type: 'lowpass', f: 160, gain: 0.3 }); tone(t + 0.16, 0.4, { type: 'sine', f: 62, f2: 34, gain: 0.22 }); },
  growl() { if (!ok('growl', 1)) return; const t = ctx.currentTime; tone(t, 1.6, { type: 'sawtooth', f: 58, f2: 44, gain: 0.07, a: 0.4 }); noise(t, 1.5, { type: 'bandpass', f: 220, f2: 140, q: 3, gain: 0.12, a: 0.4 }); },
  roar() { if (!ok('roar', 0.8)) return; const t = ctx.currentTime; tone(t, 1.3, { type: 'sawtooth', f: 120, f2: 48, gain: 0.13, a: 0.06 }); tone(t, 1.2, { type: 'square', f: 82, f2: 40, gain: 0.06, a: 0.08 }); noise(t, 1.3, { type: 'bandpass', f: 520, f2: 160, q: 1.2, gain: 0.3, a: 0.05 }); noise(t, 0.9, { type: 'lowpass', f: 180, gain: 0.35, a: 0.03 }); },
  whip() { if (!ok('whip', 0.12)) return; const t = ctx.currentTime; noise(t, 0.07, { type: 'highpass', f: 3200, gain: 0.22 }); tone(t, 0.06, { type: 'square', f: 2200, f2: 380, gain: 0.05 }); noise(t + 0.02, 0.2, { type: 'bandpass', f: 900, q: 0.7, gain: 0.1 }); },
  flame() { if (!ok('flame', 0.12)) return; noise(ctx.currentTime, 0.14, { type: 'bandpass', f: vary(900), q: 0.7, gain: 0.08 }); },
  mortar() {
    if (!ok('mortar', 0.3)) return;
    const t = ctx.currentTime;
    tone(t, 0.18, { type: 'sine', f: 110, f2: 50, gain: 0.3 }); noise(t, 0.12, { type: 'lowpass', f: 900, gain: 0.2 });
  },
  mortarHit() {
    if (!ok('mortarh', 0.1)) return;
    const t = ctx.currentTime;
    noise(t, 0.3, { type: 'lowpass', f: 1200, f2: 100, gain: 0.3 }); tone(t, 0.2, { type: 'sine', f: 80, f2: 35, gain: 0.25 });
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
// Sakin madende uğultu yok: seyrek damla ve uzak taş sesleri. Uyanış ve öfkede ritim girer; bossta ayrı, hızlı tema.
let mus = null;
const ROOTS = [55, 51.9, 49, 46.2]; // derinlikle koyulaşan kök nota
const SONGS = {
  tense: { bpm: 88, kick: [0, 10], hat: [4, 12], hatG: 0.02, bass: { 0: 0, 3: 0, 8: -2, 11: 3 }, prog: [0, 0, -4, -2], lead: null },
  rage: { bpm: 104, kick: [0, 6, 8, 14], hat: [2, 6, 10, 14], hatG: 0.03, bass: { 0: 0, 2: 0, 4: 12, 6: 0, 8: -2, 10: -2, 12: 10, 14: 3 }, prog: [0, -4, 0, -2], lead: null },
  boss: { bpm: 132, kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], hatG: 0.035, bass: { 0: 0, 2: 12, 4: 0, 6: 12, 8: 0, 10: 12, 12: 0, 14: 12 }, prog: [0, -4, -2, -5], lead: [0, 3, 7, 12, 7, 3, 7, 10] },
};
const semi = (f, s) => f * Math.pow(2, s / 12);
function mtone(t, dur, type, f, gain, f2 = null) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, 0.005, gain, dur);
  o.connect(g); g.connect(musBus); o.start(t); o.stop(t + dur + 0.05);
}
function mnoise(t, dur, type, f, gain, a = 0.002, f2 = null) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, a, gain, dur);
  s.connect(fl); fl.connect(g); g.connect(musBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + a + 0.05);
}
// sakin madenin sesleri: su damlası (yankılı) ya da uzakta kayan taş
function ambient(now) {
  if (now < mus.nextAmb) return;
  mus.nextAmb = now + 3.5 + Math.random() * 6;
  const t = now + 0.05;
  if (Math.random() < 0.65) {
    const f = 1300 + Math.random() * 900;
    mtone(t, 0.09, 'sine', f, 0.05, f * 0.55);
    mtone(t + 0.22, 0.09, 'sine', f, 0.018, f * 0.55);
  } else mnoise(t, 0.7, 'lowpass', 260, 0.05, 0.12, 90);
}
function schedule() {
  if (!ctx || !mus) return;
  const now = ctx.currentTime;
  if (!App.settings.music || ctx.state !== 'running') { mus.next = now + 0.1; return; }
  const S = SONGS[mus.mode];
  if (!S) { if (mus.mode === 'calm') ambient(now); return; }
  if (mus.next < now) mus.next = now + 0.05;
  const step = 60 / S.bpm / 4;
  while (mus.next < now + 0.25) {
    const i = mus.step % 16, t = mus.next;
    const root = semi(mus.root, S.prog[Math.floor(mus.step / 16) % S.prog.length]);
    if (S.kick.includes(i)) mtone(t, 0.16, 'sine', 120, 0.2, 42);
    if (S.hat.includes(i)) mnoise(t, 0.03, 'highpass', 7000, S.hatG);
    if (S.bass[i] !== undefined) mtone(t, step * 1.8, 'triangle', semi(root * 2, S.bass[i]), 0.1);
    if (S.lead && i % 2 === 0) mtone(t, step * 1.4, 'square', semi(root * 8, S.lead[i / 2]), 0.02);
    mus.step++; mus.next += step;
  }
}
export function setAmbience(stratum, surface, level = 0, boss = false) {
  if (!ctx) return;
  if (!mus) {
    mus = { mode: '', root: ROOTS[0], step: 0, next: 0, nextAmb: 0, wind: ctx.createBufferSource(), wf: ctx.createBiquadFilter(), wg: ctx.createGain() };
    mus.wind.buffer = noiseBuf; mus.wind.loop = true; mus.wf.type = 'bandpass'; mus.wf.frequency.value = 500; mus.wf.Q.value = 0.6;
    mus.wg.gain.value = 0; mus.wind.connect(mus.wf); mus.wf.connect(mus.wg); mus.wg.connect(musBus); mus.wind.start();
    setInterval(schedule, 60);
  }
  const t = ctx.currentTime;
  const mode = surface ? 'surface' : boss ? 'boss' : level >= 3 ? 'rage' : level >= 2 ? 'tense' : 'calm';
  mus.root = ROOTS[Math.max(0, Math.min(ROOTS.length - 1, stratum))];
  if (mode !== mus.mode) { mus.mode = mode; mus.step = 0; mus.next = t + 0.05; mus.nextAmb = t + 2; }
  mus.wg.gain.setTargetAtTime(surface ? 0.04 : 0, t, 1.2);
}
export function stopAmbience() {
  if (!mus || !ctx) return;
  mus.mode = 'off';
  mus.wg.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
}

export function haptic(ms) {
  if (!App.settings.haptics) return;
  if (isNative) { nativeHaptic(ms); return; }
  if (!navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch (e) { /* desteklenmiyor */ }
}
