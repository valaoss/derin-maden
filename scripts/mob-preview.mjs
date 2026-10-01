// 3B düşman önizleme şeridi: node scripts/mob-preview.mjs <tür> <sahne> <out.png> [ölçek=6] [kare=12] [sütun=6]
// Sahne 60 adım/sn oynatılır, eşit aralıklı kareler tek PNG'ye dizilir. Ortam: PX, PY (madenci konumu), T0, T1 (aralık), ELITE=1
import fs from 'node:fs';
import { encode } from './png-strip.mjs';
import { ENEMIES } from '../src/data/balance.js';
import { rasterBoss } from '../src/render/boss/state.js';
import { MOBS } from '../src/render/mob/defs.js';

const SCENES = {
  idle: { dur: 3, run() {} },
  walk: { dur: 1.2, run(c, e, p, dt) { e.st = 'flow'; e.x += e.d.speed * dt; } },
  left: { dur: 1.2, run(c, e, p, dt) { e.st = 'flow'; e.face = -1; e.x -= e.d.speed * dt; } },
  up: { dur: 1.2, run(c, e, p, dt) { e.st = 'flow'; e.y -= e.d.speed * dt; } },
  down: { dur: 1.2, run(c, e, p, dt) { e.st = 'flow'; e.y += e.d.speed * dt; } },
  // sağa yürür, döner, sola yürür
  turn: { dur: 2.4, run(c, e, p, dt) { e.st = 'flow'; e.face = c < 1.2 ? 1 : -1; e.x += e.face * e.d.speed * dt; } },
  // köşe: sağa, sonra aşağı
  corner: { dur: 2.4, run(c, e, p, dt) { e.st = 'flow'; if (c < 1.2) e.x += e.d.speed * dt; else e.y += e.d.speed * dt; } },
  attack: { dur: 1.2, run(c, e) { e.st = 'chase'; if (c < 0.3) e.wind = c / 0.3; else if (c < 0.3 + 1 / 60) e.lunge = 1; } },
  web: { dur: 1.2, run(c, e) { e.st = 'ranged'; if (c < 0.35) e.wind = c / 0.35; else if (c < 0.35 + 1 / 60) e.lunge = 0.6; } },
  tongue: { dur: 1.3, run(c, e, p) { if (c > 0.2 && c < 0.9) { e.st = 'pull'; e.tongue = 0.9 - c; e.tx = p.x; e.ty = p.y; } } },
  brood: { dur: 1, run(c, e) { if (c > 0.2 && c < 0.2 + 1 / 60) e.lunge = 1; } },
  hurt: { dur: 1.2, run(c, e) { const k = c % 0.6; e.hitT = k < 0.09 ? 0.09 - k : 0; e.hitDx = -1; e.hitDy = 0; } },
  die: { dur: 1.1, run(c, e) { const T = e.d.dieT || 0.42; if (c > 0.15) { e.dead = true; e.dieT = Math.max(0.001, T - (c - 0.15)); } } },
};

const [type, name, out = 'mob-preview.png', K0 = 6, N0 = 12, C0 = 6] = process.argv.slice(2);
const D = MOBS[type], scene = D && SCENES[name];
if (!scene) { console.log('tür:', Object.keys(MOBS).join(' '), '\nsahne:', Object.keys(SCENES).join(' ')); process.exit(1); }
const K = +K0, N = +N0, p = { x: 200 + +(process.env.PX || 60), y: 200 + +(process.env.PY || 0), dead: false };
const e = { type, d: ENEMIES[type], x: 200, y: 200, px: 200, py: 200, face: 1, anim: 0, hitT: 0, hitDx: 0, hitDy: 0, wind: 0, lunge: 0, dieT: 0, dead: false, wob: 0.5, emergeT: 0, sink: 0, tongue: 0, tx: 0, ty: 0, st: 'flow', scale: process.env.ELITE ? 1.25 : 1, trail: [] };
const t0 = +(process.env.T0 || 0), t1 = +(process.env.T1 || scene.dur), dt = 1 / 60, frames = [];
let t = 10, next = 0, ms = 0, n = 0;
for (let c = -1; c <= t1 + 1e-6; c += dt, t += dt) {
  e.px = e.x; e.py = e.y; e.hitT = 0; e.wind = 0; e.lunge = Math.max(0, e.lunge - dt * 5); e.tongue = 0; e.st = 'flow'; e.anim += dt * 7;
  if (c >= 0) scene.run(c, e, p, dt);
  const q = performance.now(), R = rasterBoss(e, t, [p], D); ms += performance.now() - q; n++;
  if (next < N && c >= t0 + (t1 - t0) * next / Math.max(1, N - 1) - 1e-6) { frames.push({ rgba: R.S.rgba.slice(), c }); next++; }
}
// ortak kırpma kutusu
let x0 = D.w, x1 = 0, y0 = D.h, y1 = 0;
for (const f of frames) for (let y = 0; y < D.h; y++) for (let x = 0; x < D.w; x++) if (f.rgba[(y * D.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(D.w - 1, x1 + 2); y1 = Math.min(D.h - 1, Math.max(y1, D.oy) + 2);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1, cols = Math.min(frames.length, +C0), rows = Math.ceil(frames.length / cols), W = cw * K * cols, H = ch * K * rows, px = Buffer.alloc(W * H * 4);
frames.forEach((f, i) => {
  const ox = (i % cols) * cw * K, oy = Math.floor(i / cols) * ch * K;
  for (let y = 0; y < ch * K; y++) for (let x = 0; x < cw * K; x++) {
    const sx = x0 + Math.floor(x / K), sy = y0 + Math.floor(y / K), q = (sy * D.w + sx) * 4, o = ((oy + y) * W + ox + x) * 4;
    const edge = x < 1 || y < 1, ground = D.foot && sy === D.oy;
    px[o] = edge ? 80 : ground ? 78 : 52; px[o + 1] = edge ? 86 : ground ? 66 : 44; px[o + 2] = edge ? 100 : ground ? 50 : 40; px[o + 3] = 255;
    if (f.rgba[q + 3]) { px[o] = f.rgba[q]; px[o + 1] = f.rgba[q + 1]; px[o + 2] = f.rgba[q + 2]; }
  }
});
fs.writeFileSync(out, encode(W, H, px));
console.log(`${type}/${name}: ${frames.length} kare, hücre ${cw}x${ch} (kutu x ${x0 - D.ox}..${x1 - D.ox}, y ${y0 - D.oy}..${y1 - D.oy}), ${(ms / n).toFixed(3)} ms/adım`);
