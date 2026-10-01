// 3B boss önizleme şeridi: node scripts/boss-preview.mjs <tür> <sahne> <out.png> [ölçek=3] [kare=12] [sütun=6]
// Sahne (boss-scenes.mjs) 60 adım/sn oynatılır, eşit aralıklı kareler tek PNG'ye dizilir. Ortam: PX, PY (madenci konumu), T0, T1 (aralık)
import fs from 'node:fs';
import { encode } from './png-strip.mjs';
import { rasterBoss } from '../src/render/boss/state.js';
import { DEFS } from '../src/render/boss/defs.js';
import { makeBoss, getScene, stepScene, sceneNames } from './boss-scenes.mjs';

const [type, name, out = 'boss-preview.png', K0 = 3, N0 = 12, C0 = 6] = process.argv.slice(2);
const D = DEFS[type], scene = D && getScene(type, name);
if (!scene) { console.log('tür:', Object.keys(DEFS).join(' '), '\nsahne:', D ? sceneNames(type).join(' ') : ''); process.exit(1); }
const K = +K0, N = +N0, e = makeBoss(type, 200, 200), p = { x: 200 + +(process.env.PX || 80), y: 200 + +(process.env.PY || 0), dead: false };
if (scene.setup) scene.setup(e, p);
const dur = scene.len ? scene.len(e) : scene.dur, t0 = +(process.env.T0 || 0), t1 = +(process.env.T1 || dur), dt = 1 / 60, frames = [];
let t = 10, next = 0, ms = 0, n = 0;
for (let c = -1.5; c <= t1 + 1e-6; c += dt, t += dt) {
  stepScene(scene, c, e, p, dt);
  const q = performance.now(), R = rasterBoss(e, t, [p]); ms += performance.now() - q; n++;
  if (next < N && c >= t0 + (t1 - t0) * next / Math.max(1, N - 1) - 1e-6) { frames.push({ rgba: R.S.rgba.slice(), c, dx: Math.round(e.x - e.x0), dy: Math.round(e.y - e.y0) }); next++; }
}
// ortak kırpma kutusu
let x0 = D.w, x1 = 0, y0 = D.h, y1 = 0;
for (const f of frames) for (let y = 0; y < D.h; y++) for (let x = 0; x < D.w; x++) if (f.rgba[(y * D.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
x0 = Math.max(0, x0 - 3); y0 = Math.max(0, y0 - 3); x1 = Math.min(D.w - 1, x1 + 3); y1 = Math.min(D.h - 1, Math.max(y1, D.oy) + 3);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1, cols = Math.min(frames.length, +C0), rows = Math.ceil(frames.length / cols), W = cw * K * cols, H = ch * K * rows, px = Buffer.alloc(W * H * 4);
frames.forEach((f, i) => {
  const ox = (i % cols) * cw * K, oy = Math.floor(i / cols) * ch * K;
  for (let y = 0; y < ch * K; y++) for (let x = 0; x < cw * K; x++) {
    const sx = x0 + Math.floor(x / K), sy = y0 + Math.floor(y / K), q = (sy * D.w + sx) * 4, o = ((oy + y) * W + ox + x) * 4;
    const edge = x < 1 || y < 1, ground = !D.fly && sy === D.oy;
    px[o] = edge ? 50 : ground ? 70 : 28; px[o + 1] = edge ? 56 : ground ? 60 : 32; px[o + 2] = edge ? 70 : ground ? 40 : 44; px[o + 3] = 255;
    if (f.rgba[q + 3]) { px[o] = f.rgba[q]; px[o + 1] = f.rgba[q + 1]; px[o + 2] = f.rgba[q + 2]; }
  }
});
fs.writeFileSync(out, encode(W, H, px));
console.log(`${type}/${name}: ${frames.length} kare (${frames.map(f => f.c.toFixed(2)).join(' ')}), hücre ${cw}x${ch}, ${(ms / n).toFixed(2)} ms/adım`);
