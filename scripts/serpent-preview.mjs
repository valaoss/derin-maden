// Dünya Yılanı önizleme: node scripts/serpent-preview.mjs <out.png> [ölçek]
// kareler: yüzme, kükreme (yelpaze açık, zehir), dalış, sola yüzme, öfke, ölüm
import fs from 'node:fs';
import { encode } from './png-strip.mjs';
import { rasterSerpent } from '../src/render/boss/serpent3d.js';
const out = process.argv[2] || 'serpent.png', K = +(process.argv[3] || 2), frames = [], N = 48;
const trail = (hx, hy, a, t, bend) => { const pts = []; for (let i = 1; i <= N; i++) { const s = i * 5, b = a + Math.PI + bend * i / N; pts.push([hx + Math.cos(a + Math.PI) * s * 0.5 + Math.cos(b) * s * 0.5, hy + Math.sin(a + Math.PI) * s * 0.5 + Math.sin(b) * s * 0.5 + Math.sin(i * 0.16 - t * 2) * 14 * Math.min(1, i / 8)]); } return pts; };
const SHOTS = [
  { hx: 250, hy: 150, a: 0, t: 0.3, bend: 0, open: 0.2, flare: 0 },
  { hx: 215, hy: 110, a: 0.95, t: 1.1, bend: -0.9, open: 1, flare: 1, venom: 0.9, tail: 0 },
  { hx: 150, hy: 250, a: 1.5, t: 0.7, bend: 0.5, open: 0.5, flare: 0.2 },
  { hx: 50, hy: 150, a: Math.PI, t: 2.2, bend: 0, open: 0.7, flare: 0.3 },
  { hx: 240, hy: 120, a: 0.5, t: 3, bend: 0.7, open: 0.9, flare: 0.9, rage: true, tail: 0.2 },
  { hx: 240, hy: 190, a: 0.6, t: 3.5, bend: 0.3, open: 0.5, flare: 0, dead: 0.45, tail: 0 },
];
const pick = process.env.SHOT ? process.env.SHOT.split(',').map(Number) : null;
for (const s of pick ? pick.map(i => SHOTS[i]) : SHOTS) {
  const pts = trail(s.hx, s.hy, s.tail ?? s.a, s.t, s.bend);
  const R = rasterSerpent(pts, { x: s.hx, y: s.hy, a: s.a, open: s.open, flare: s.flare, venom: s.venom || 0, rage: s.rage, dead: s.dead || 0 }, s.t, N, true);
  frames.push(R.S.rgba.slice());
}
const w = 304, h = 320, cols = Math.min(3, frames.length), rows = Math.ceil(frames.length / cols), W = w * K * cols, H = h * K * rows, px = Buffer.alloc(W * H * 4);
frames.forEach((f, n) => { const X = (n % cols) * w * K, Y = Math.floor(n / cols) * h * K; for (let y = 0; y < h * K; y++) for (let x = 0; x < w * K; x++) { const q = (Math.floor(y / K) * w + Math.floor(x / K)) * 4, o = ((Y + y) * W + X + x) * 4; px[o] = 28; px[o + 1] = 32; px[o + 2] = 44; px[o + 3] = 255; if (f[q + 3]) { px[o] = f[q]; px[o + 1] = f[q + 1]; px[o + 2] = f[q + 2]; } } });
fs.writeFileSync(out, encode(W, H, px));
