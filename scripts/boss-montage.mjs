// Bütün 3B bossların toplu görüntüsü: node scripts/boss-montage.mjs <out.png> [ölçek=2]
import fs from 'node:fs';
import { encode } from './png-strip.mjs';
import { rasterBoss } from '../src/render/boss/state.js';
import { DEFS } from '../src/render/boss/defs.js';
import { makeBoss, getScene, stepScene } from './boss-scenes.mjs';
import { rasterSerpent } from '../src/render/boss/serpent3d.js';

const LIST = [
  ['karakok', [['idle', 1], ['spikes', 0.17], ['rage', 1]]], ['kavurgan', [['idle', 1], ['breath', 1.3], ['embers', 0.4]]],
  ['otegoz', [['idle', 1], ['gaze', 1.4], ['pull', 1.2]]], ['kordesen', [['idle', 1], ['slam', 0.5], ['charge', 1.05]]],
  ['ezeli', [['idle', 1], ['pillars', 0.3], ['doom', 1.45]]], ['aynasiz', [['idle', 1], ['mirror', 0.9], ['step', 0.14]]],
  ['kehribarAna', [['idle', 1], ['amber', 0.5], ['resin', 0.25]]], ['madenKalbi', [['idle', 1], ['spikes', 0.33], ['beat', 1.2]]],
  ['balrog', [['idle', 1], ['sword', 0.78], ['wings', 1.3]]], ['ejder', [['idle', 1], ['breath', 1.7], ['soar', 2.1]]],
];
const out = process.argv[2] || 'bosses.png', K = +(process.argv[3] || 2), CW = 124, CH = 112, COLS = 6, cells = [];
for (const [type, shots] of LIST) for (const [name, at] of shots) {
  const D = DEFS[type], sc = getScene(type, name), e = makeBoss(type, 200, 200), p = { x: 280, y: 200, dead: false };
  if (sc.setup) sc.setup(e, p);
  let t = 10, R = null;
  for (let c = -1.5; c <= at + 1e-6; c += 1 / 60, t += 1 / 60) { stepScene(sc, c, e, p, 1 / 60); R = rasterBoss(e, t, [p]); }
  cells.push({ rgba: R.S.rgba.slice(), w: D.w, h: D.h, ox: D.ox, oy: D.oy, fly: D.fly });
}
{ const pts = []; for (let i = 0; i < 20; i++) pts.push([170 - i * 5, 150 + Math.sin(i * 0.3) * 14]); const R = rasterSerpent(pts, { x: 176, y: 150, a: -0.15, open: 0.9 }, 1, 48, true); cells.push({ rgba: R.S.rgba.slice(), w: 304, h: 320, ox: 152 + 28, oy: 160 + 42, fly: false }); }
const rows = Math.ceil(cells.length / COLS), W = CW * K * COLS, H = CH * K * rows, px = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { px[i * 4] = 24; px[i * 4 + 1] = 28; px[i * 4 + 2] = 40; px[i * 4 + 3] = 255; }
cells.forEach((c, n) => {
  const gx = (n % COLS) * CW * K, gy = Math.floor(n / COLS) * CH * K, cx = CW / 2, cy = c.fly ? 56 : 96;
  for (let y = 0; y < CH * K; y++) for (let x = 0; x < CW * K; x++) {
    const sx = Math.floor(x / K) - cx + c.ox, sy = Math.floor(y / K) - cy + c.oy, o = ((gy + y) * W + gx + x) * 4;
    if ((n % 3 === 0 && x < 2) || y < 1) { px[o] = 52; px[o + 1] = 58; px[o + 2] = 76; }
    if (sx < 0 || sy < 0 || sx >= c.w || sy >= c.h) continue;
    const q = (sy * c.w + sx) * 4; if (c.rgba[q + 3]) { px[o] = c.rgba[q]; px[o + 1] = c.rgba[q + 1]; px[o + 2] = c.rgba[q + 2]; }
  }
});
fs.writeFileSync(out, encode(W, H, px));
