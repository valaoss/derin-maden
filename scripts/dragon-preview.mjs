// 3B ejder önizleme şeridi: node scripts/dragon-preview.mjs <out.png> [ölçek] [zamanlar: s0,s1 (uyku) w0.5,w1.6 (uyanış)]
import fs from 'node:fs';
import { encode } from './png-strip.mjs';
import { rasterDragon, DRAGON } from '../src/render/dragon3d.js';

const out = process.argv[2] || 'dragon-preview.png', K = +(process.argv[3] || 4);
const times = (process.argv[4] || 's0,s0.8,s1.6,s2.4,w0.3,w0.6,w0.9,w1.2,w1.45,w1.7,w2.4,w3.3').split(',');
const cols = Math.min(times.length, 4), rows = Math.ceil(times.length / cols), W = DRAGON.w * K * cols, H = DRAGON.h * K * rows, px = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { px[i * 4] = 28; px[i * 4 + 1] = 32; px[i * 4 + 2] = 44; px[i * 4 + 3] = 255; }
const t0 = performance.now();
times.forEach((s, n) => {
  const v = +s.slice(1), wake = s[0] === 'w', F = process.env.F ? +process.env.F : -1;
  const { S } = rasterDragon({ t: wake ? 10 + v : v, wake: wake ? v : -1, stir: s[0] === 'r' ? 2 : 0, look: process.env.LOOK ? process.env.LOOK.split(',').map(Number) : [0, 0], view: process.env.VIEW ? process.env.VIEW * Math.PI / 180 : undefined, tilt: process.env.TILT ? process.env.TILT * Math.PI / 180 : undefined }, F);
  const ox = (n % cols) * DRAGON.w * K, oy = Math.floor(n / cols) * DRAGON.h * K;
  for (let y = 0; y < DRAGON.h * K; y++) for (let x = 0; x < DRAGON.w * K; x++) {
    const q = (Math.floor(y / K) * DRAGON.w + Math.floor(x / K)) * 4, o = ((oy + y) * W + ox + x) * 4;
    if (Math.floor(y / K) === DRAGON.oy) { px[o] = 70; px[o + 1] = 60; px[o + 2] = 40; }
    if (S.rgba[q + 3]) { px[o] = S.rgba[q]; px[o + 1] = S.rgba[q + 1]; px[o + 2] = S.rgba[q + 2]; }
  }
});
console.log(`${times.length} kare, ${((performance.now() - t0) / times.length).toFixed(2)} ms/kare`);
fs.writeFileSync(out, encode(W, H, px));
