// Garip yaratıklar: her biyomda şansa bağlı bir gizli oyukta bir yaratık uyur. Kazıp yanına varan onu bulur,
// yaratık o oyuncunun yoldaşı olur (yanında gezer) ve kalıcı koleksiyona girer. Yerleşim tohumdan, bulma simülasyonda.
import { COLS, TILE, GROUND_ROW, STRATUM_ROWS, STRATA_COUNT, PLAY_MIN_COL, PLAY_MAX_COL } from '../config.js';
import { T, isPlain } from '../data/tiles.js';
import { CRITTERS, CRITTER_KEYS, CRITTER } from '../data/critters.js';
import { mulberry32 } from '../core/util.js';
import { G } from './state.js';
import { emit } from '../core/events.js';

export function placeCritters(g, seed) {
  const rnd = mulberry32((seed | 0) ^ 0x7a11c0de), out = [];
  const plain = (c, r) => c >= PLAY_MIN_COL && c <= PLAY_MAX_COL && isPlain(g.map[r * COLS + c]);
  for (let s = 0; s < STRATA_COUNT; s++) {
    if (rnd() >= CRITTER.chance) continue;
    const pool = CRITTER_KEYS.filter(k => CRITTERS[k].min <= s);
    let w = 0; for (const k of pool) w += CRITTERS[k].w;
    let x = rnd() * w, k = pool[0];
    for (const q of pool) { x -= CRITTERS[q].w; if (x < 0) { k = q; break; } }
    const r0 = GROUND_ROW + s * STRATUM_ROWS + 3;
    for (let tries = 0; tries < 40; tries++) {
      const c = PLAY_MIN_COL + 1 + Math.floor(rnd() * (PLAY_MAX_COL - PLAY_MIN_COL - 1)), r = r0 + Math.floor(rnd() * (STRATUM_ROWS - 6));
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!plain(c + dx, r + dy)) { ok = false; break; }
      if (!ok || Math.abs(c - 8) < 1) continue;
      g.map[r * COLS + c] = T.AIR;
      out.push({ k, c, r, found: false });
      break;
    }
  }
  return out;
}

export function updateCritters() {
  for (const cr of G.critters || []) {
    if (cr.found) continue;
    const x = cr.c * TILE + 8, y = cr.r * TILE + 8;
    for (const p of G.players) {
      if (p.dead || Math.abs(p.x - x) > CRITTER.reach || Math.abs(p.y - y) > CRITTER.reach) continue;
      cr.found = true; p.pet = cr.k;
      emit('critter', { k: cr.k, pi: p.i, x, y });
      break;
    }
  }
}
