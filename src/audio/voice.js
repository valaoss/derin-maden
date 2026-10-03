// Boss seslendirmeleri (şimdilik oyuna bağlı değil; dosyalar assets/voice'ta, açmak için public/voice'a taşı ve main.js'te bağla).
// Her bossun sesi kendi hızında (kalınlık) ve mağara yankısıyla çalınır; ses efektleri kapalıysa susar.
import { App } from '../game/state.js';
import { VOICE } from '../data/voicelines.js';
import { audioBus } from './audio.js';

const cache = new Map();
let cur = null;
function load(ctx, key) {
  let p = cache.get(key);
  if (!p) {
    p = fetch(`./voice/${key}.mp3`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(b => ctx.decodeAudioData(b)).catch(() => null);
    cache.set(key, p);
  }
  return p;
}
export function preloadVoice(type) {
  const { ctx } = audioBus();
  if (ctx && VOICE[type]) for (const ev in VOICE[type].lines) load(ctx, type + '-' + ev);
}
export async function playVoice(type, ev, delay = 0) {
  const V = VOICE[type], { ctx, sfxBus } = audioBus();
  if (!V || !V.lines[ev] || !ctx || !App.settings.sfx) return;
  const buf = await load(ctx, type + '-' + ev);
  if (!buf) return;
  if (cur) { try { cur.stop(); } catch (e) { /* bitmiş */ } }
  const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = V.rate;
  const dry = ctx.createGain(); dry.gain.value = 1.5;
  // mağara yankısı: geri beslemeli gecikme, her turda boğuklaşır
  const dl = ctx.createDelay(0.5); dl.delayTime.value = V.echo;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  src.connect(dry); dry.connect(sfxBus);
  dry.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(sfxBus);
  src.onended = () => { if (cur === src) cur = null; setTimeout(() => { lp.disconnect(); fb.disconnect(); }, 2500); };
  src.start(ctx.currentTime + delay); cur = src;
}
