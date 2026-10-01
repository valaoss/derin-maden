// Sıvı önizleme (gerçek simülasyon + gerçek çizici): node scripts/liquid-preview.mjs <out.png> [su|lav|oda|lavoda] [ölçek] [kare] [aralık sn]
// su/lav: üretilen şelale; oda/lavoda: elle kurulmuş deneme odası (kaynak, basamak, taşma kenarı, havuz, savak). WAIT=sn ön akış, TIME=1 süre ölçer
import fs from 'node:fs';
import { encode } from './png-strip.mjs';
import { App, G } from '../src/game/state.js';
import { newRun } from '../src/game/run.js';
import { updateLiquids, FALLS_BIOME, LAVA_BIOME } from '../src/game/liquids.js';
import { T, TD } from '../src/data/tiles.js';
import { COLS, TILE, GROUND_ROW, STRATUM_ROWS } from '../src/config.js';
import { rasterLiquids } from '../src/render/liquidfield.js';

App.settings = { sfx: false, music: false, haptics: false, shake: false }; App.meta = { lv: {}, tutorialDone: true };
const out = process.argv[2] || 'liquid.png', scene = process.argv[3] || 'su', K = +(process.argv[4] || 3), frames = +(process.argv[5] || 3), gap = +(process.argv[6] || 0.12);
newRun({ seed: 972 });
const step = () => { G.time += 1 / 60; G.frame++; updateLiquids(1 / 60); };
const run = s => { for (let i = 0; i < s * 60; i++) step(); };
const lava = scene.startsWith('lav'), k = lava ? 1 : 0;
let r0, r1;
if (scene === 'su' || scene === 'lav') { const sp = G.springs.find(q => q.k === k); r0 = sp.r - 1; r1 = sp.r + 22; }
else {
  // deneme odası: # kaya, . boşluk, S kaynak, D gider
  const ROOM = [
    '###############',
    '###S###########',
    '###.###########',
    '###.###########',
    '###.....#######',
    '#######.#######',
    '#######.....###',
    '#####......####',
    '####.......####',
    '####...########',
    '####...#....###',
    '####........###',
    '######D###..###',
    '##########..###',
    '#####.......###',
    '#####.......###',
    '#######D#######',
  ];
  const s = G.order.indexOf(lava ? LAVA_BIOME : FALLS_BIOME), top = GROUND_ROW + s * STRATUM_ROWS + 4;
  for (let r = top - 2; r < top + ROOM.length + 6; r++) for (let c = 0; c < COLS; c++) { const i = r * COLS + c; G.lq[i] = 0; if (c >= 1 && c <= 15) G.map[i] = lava ? T.MAGMA : T.FALLROCK; }
  G.springs.length = 0;
  ROOM.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = x + 1, r = top + y, i = r * COLS + c;
    G.map[i] = ch === '.' ? T.AIR : ch === 'S' ? (lava ? T.LAVAVENT : T.SPRING) : ch === 'D' ? T.SINK : G.map[i];
    if (ch === 'S') G.springs.push({ c, r, k });
  }));
  G.mapVersion++; r0 = top; r1 = top + ROOM.length - 1;
}
run(+(process.env.WAIT || (lava ? 14 : 7)));
const W = COLS * TILE, H = (r1 - r0 + 1) * TILE, shots = [];
const MAT = { falls: [38, 70, 60], magma: [70, 34, 30], host: [90, 96, 120], stone: [72, 70, 78], dirt: [92, 64, 44] };
for (let f = 0; f < frames; f++) {
  const px = new Uint8Array(W * H * 4);
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const d = TD[G.map[r * COLS + c]], col = d.solid ? (d.spring ? [60, 140, 220] : d.sink ? [20, 20, 26] : MAT[d.mat] || [80, 74, 70]) : [22, 17, 15];
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const o = (((r - r0) * TILE + y) * W + c * TILE + x) * 4, e = d.solid && (x === 0 || y === 0) ? 0.8 : 1; px[o] = col[0] * e; px[o + 1] = col[1] * e; px[o + 2] = col[2] * e; px[o + 3] = 255; }
  }
  const t0 = performance.now(), L = rasterLiquids(G, r0, r1, G.time);
  if (f === 0 && process.env.TIME) { for (let q = 0; q < 50; q++) rasterLiquids(G, r0, r1, G.time); console.log(((performance.now() - t0) / 51).toFixed(2) + ' ms', L && L.w + 'x' + L.h); }
  if (L) for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const s = (y * L.w + x) * 4, a = L.rgba[s + 3] / 255, wy = L.y + y - r0 * TILE; if (!a || wy < 0 || wy >= H) continue;
    const o = (wy * W + L.x + x) * 4; for (let q = 0; q < 3; q++) px[o + q] = px[o + q] * (1 - a) + L.rgba[s + q] * a;
  }
  shots.push(px); for (let q = 0; q < gap * 60; q++) { step(); if (q % 2) rasterLiquids(G, r0, r1, G.time); }
}
const OW = W * K * frames, OH = H * K, img = Buffer.alloc(OW * OH * 4);
shots.forEach((px, n) => { for (let y = 0; y < OH; y++) for (let x = 0; x < W * K; x++) { const s = (Math.floor(y / K) * W + Math.floor(x / K)) * 4, o = (y * OW + n * W * K + x) * 4; img[o] = px[s]; img[o + 1] = px[s + 1]; img[o + 2] = px[s + 2]; img[o + 3] = 255; } });
fs.writeFileSync(out, encode(OW, OH, img));
