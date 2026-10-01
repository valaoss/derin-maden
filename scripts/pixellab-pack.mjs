// Pack PixelLab output into a game sheet: node scripts/pixellab-pack.mjs <boss>
// Row 0: 8 rotations in game order (E, SE, S, SW, W, NW, N, NE). Then one row per animation (east view).
import fs from 'node:fs';
import path from 'node:path';
import { decode, encode } from './png-strip.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const boss = process.argv[2]; if (!boss) throw new Error('boss?');
const SRC = path.join(ROOT, 'tmp', 'pixellab', boss), OUT = path.join(ROOT, 'public', 'boss', 'pl'), DATA = path.join(ROOT, 'src', 'data', 'plboss.json');
const ROT = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const ORDER = ['idle', 'walk', 'fly', 'hurt', 'die'];
const animDir = path.join(ROOT, 'tmp', 'pixellab', boss, 'anim');
const ANIMS = fs.existsSync(animDir) ? fs.readdirSync(animDir).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b)) : [];
const CELL = 128, COLS = 16;
const LIMIT = { balrog: { intro: 13 }, ezeli: { doom: 14 } };

const load = f => fs.existsSync(f) ? decode(fs.readFileSync(f)) : null;
const rows = [ROT.map(d => load(path.join(SRC, 'rot', `${d}.png`)))];
const layout = { cell: CELL, cols: COLS, rot: 0, anims: {} };
for (const a of ANIMS) {
  const dir = path.join(SRC, 'anim', a, 'east'); if (!fs.existsSync(dir)) continue;
  let frames = fs.readdirSync(dir).filter(f => /^\d+\.png$/.test(f)).sort((x, y) => +x.split('.')[0] - +y.split('.')[0]).map(f => load(path.join(dir, f)));
  if (frames.length > COLS) frames = frames.slice(frames.length - COLS); // drop duplicated reference frame
  const lim = LIMIT[boss]?.[a]; if (lim) frames = frames.slice(0, lim);
  layout.anims[a] = { row: rows.length, n: frames.length };
  rows.push(frames);
}
// feet: lowest opaque pixel across rotations; cx: cell centre
let feet = 0;
for (const im of rows[0]) if (im) for (let y = im.h - 1; y >= 0 && y > feet; y--) for (let x = 0; x < im.w; x++) if (im.px[(y * im.w + x) * 4 + 3] > 40) { feet = Math.max(feet, y + 1); break; }
layout.feet = feet; layout.cx = CELL / 2; layout.rows = rows.length;

const W = CELL * COLS, H = CELL * rows.length, out = Buffer.alloc(W * H * 4);
rows.forEach((frames, r) => frames.forEach((im, c) => {
  if (!im) return;
  const ox = c * CELL + ((CELL - im.w) >> 1), oy = r * CELL + (CELL - im.h);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const si = (y * im.w + x) * 4; if (im.px[si + 3]) im.px.copy(out, ((oy + y) * W + ox + x) * 4, si, si + 4); }
}));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, `${boss}.png`), encode(W, H, out));
const all = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : {};
all[boss] = { ...(all[boss] || {}), ...layout };
fs.writeFileSync(DATA, JSON.stringify(all, null, 1));
console.log(boss, `${W}x${H}`, layout);
