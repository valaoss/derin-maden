// Dosya tabanlı boss sesleri: public/sfx/boss/<boss>-<an>.mp3 (scripts/boss-sfx.mjs üretir).
// an: spawn (uyanış), rage (öfke), down (ölüm), cast (yetenek başlangıcı).
// Dosya yoksa ya da çözülemezse verilen yedek (sentez) ses çalar.
import { App } from '../game/state.js';
import { audioBus } from './audio.js';

const EVS = { spawn: { gain: 1, gap: 2 }, rage: { gain: 1, gap: 2 }, down: { gain: 1, gap: 2 }, cast: { gain: 0.7, gap: 2.2 } };
const cache = new Map(), last = {};
let cur = null;

function load(ctx, key) {
  let p = cache.get(key);
  if (!p) {
    p = fetch(`./sfx/boss/${key}.mp3`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(b => ctx.decodeAudioData(b)).catch(() => null);
    cache.set(key, p);
  }
  return p;
}
export function preloadBossSfx(type) {
  const { ctx } = audioBus();
  if (ctx && type) for (const ev in EVS) load(ctx, type + '-' + ev);
}
export function bossSfx(type, ev, fallback) {
  const { ctx, sfxBus } = audioBus(), E = EVS[ev];
  if (!ctx || !E || !App.settings.sfx) return;
  const key = type + '-' + ev, now = ctx.currentTime;
  if (last[key] && now - last[key] < E.gap) return;
  // yetenek sesi, süren bir kükremenin üstüne binmez
  if (ev === 'cast' && cur && cur.ev !== 'cast' && now < cur.end) return;
  last[key] = now;
  load(ctx, key).then(buf => {
    if (!buf) { if (fallback) fallback(); return; }
    const t = ctx.currentTime;
    if (cur && t < cur.end) { cur.g.gain.setTargetAtTime(0, t, 0.04); cur.src.stop(t + 0.25); }
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = ev === 'cast' ? 0.92 + Math.random() * 0.16 : 1;
    const g = ctx.createGain(); g.gain.value = E.gain;
    src.connect(g); g.connect(sfxBus); src.start(t);
    cur = { src, g, ev, end: t + buf.duration / src.playbackRate.value };
  });
  if (ev === 'spawn') preloadBossSfx(type);
}
