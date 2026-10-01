// Sıvı çizici denetimi: gerçek simülasyonda kazı ve kamera hareketi sırasında "sıvısız yerde su" pikselleri ve ani sıçramalar sayılır.
// Kullanım: node scripts/liquid-check.mjs  (çıktı: kare başına en kötü değerler; hepsi küçük olmalı)
import { App, G } from '../src/game/state.js';
import { newRun } from '../src/game/run.js';
import { updateLiquids } from '../src/game/liquids.js';
import { setTile } from '../src/world/map.js';
import { T, TD } from '../src/data/tiles.js';
import { COLS, ROWS, TILE } from '../src/config.js';
import { rasterLiquids } from '../src/render/liquidfield.js';

App.settings = { sfx: false, music: false, haptics: false, shake: false }; App.meta = { lv: {}, tutorialDone: true };
newRun({ seed: 972 });
const step = () => { G.time += 1 / 60; G.frame++; updateLiquids(1 / 60); };
const sp = G.springs.filter(q => q.k === 0)[1];
let top = -1, left = 99; for (let r = sp.r + 8; r < sp.r + 26 && top < 0; r++) { let n = 0, l = 99; for (let c = 2; c <= 14; c++) if (G.lq[r * COLS + c] >= 6 && Math.abs(c - sp.c) < 6) { n++; l = Math.min(l, c); } if (n >= 3) { top = r; left = l; } }
const digs = [[2, () => { for (let q = 1; q <= 3; q++) setTile(left - q, top + 1, T.AIR); }], [4, () => { for (let q = 1; q <= 4; q++) setTile(left - 3, top + 1 + q, T.AIR); }], [6, () => { for (let q = 0; q < 4; q++) setTile(left - 4 - q, top + 5, T.AIR); }], [9, () => { setTile(left + 1, top + 3, T.AIR); setTile(left + 1, top + 4, T.AIR); setTile(left + 1, top + 5, T.AIR); }], [12, () => { for (let q = 0; q < 5; q++) setTile(left + 1 + q, top + 6, T.AIR); }],
  // kamera uzaktayken havuzun dibi açılır: dönüşte eski su görünmemeli
  [14.2, () => { for (let q = 3; q <= 12; q++) for (let c = left; c <= left + 4; c++) if (c >= 2 && c <= 14) setTile(c, top + q, T.AIR); }]];
// kamera: ilk 14 sn şelalede, sonra 1.5 sn uzakta, sonra geri (bayat durum sınaması)
const view = t => t > 14 && t < 15.5 ? [sp.r + 60, sp.r + 90] : [sp.r - 2, sp.r + 30];
let worstGhost = 0, worstJump = 0, prev = null, ghostAt = 0, jumpAt = 0, frames = 0, lastV = -1;
const t0 = G.time;
for (let f = 0; f < 60 * 20; f++) {
  step(); const t = G.time - t0;
  while (digs.length && t >= digs[0][0]) digs.shift()[1]();
  if (f % 2) continue;
  const [r0, r1] = view(t), L = rasterLiquids(G, r0, r1, G.time); frames++;
  if (r0 !== lastV) { prev = null; lastV = r0; }
  // hücre başına sıvı pikseli
  const cnt = new Uint16Array(COLS * ROWS);
  if (L) for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.rgba[(y * L.w + x) * 4 + 3] > 120) cnt[Math.floor((L.y + y) / TILE) * COLS + Math.floor((L.x + x) / TILE)]++;
  // hayalet: çevresindeki 5x5 hücrede hiç gerçek sıvı olmayan hücrede çizilen piksel
  let ghost = 0;
  for (let i = COLS * 3; i < cnt.length - COLS * 3; i++) {
    if (cnt[i] < 12) continue; let real = false;
    for (let dy = -2; dy <= 2 && !real; dy++) for (let dx = -2; dx <= 2; dx++) if (G.lq[i + dy * COLS + dx]) { real = true; break; }
    if (!real) { ghost += cnt[i]; if (process.env.V) console.log(`hayalet t=${t.toFixed(2)} hücre ${i % COLS},${Math.floor(i / COLS) - sp.r} piksel ${cnt[i]}`); }
  }
  // sıçrama: bir karede bir hücrenin dolu piksel sayısı 0'dan çok büyük değere çıkıyorsa (komşularında da önceki karede sıvı yokken)
  let jump = 0;
  if (prev) for (let i = COLS * 2; i < cnt.length - COLS * 2; i++) {
    if (cnt[i] < 100 || prev[i] > 0) continue;
    if (!prev[i - 1] && !prev[i + 1] && !prev[i - COLS] && !prev[i + COLS]) { jump += cnt[i]; if (process.env.V) console.log(`sıçrama t=${t.toFixed(2)} hücre ${i % COLS},${Math.floor(i / COLS) - sp.r} piksel ${cnt[i]} lq=${G.lq[i]} üst=${G.lq[i - COLS]} alt=${G.lq[i + COLS]}`); }
  }
  if (ghost > worstGhost) { worstGhost = ghost; ghostAt = t; }
  if (jump > worstJump) { worstJump = jump; jumpAt = t; }
  prev = cnt;
}
console.log(`kare ${frames} · en kötü hayalet piksel ${worstGhost} (t=${ghostAt.toFixed(2)}) · en kötü sıçrama ${worstJump} (t=${jumpAt.toFixed(2)})`);
