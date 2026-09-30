// Sıvılar: hücre tabanlı su ve lav. Her hücre 0-8 birim tutar; önce aşağı düşer, sonra yanlara yayılır.
// Şelale Mağarası'nda kaynaktan havuza dökülen şelaleler, Kor Katmanı'nda lav şelalesi ve kapalı lav cepleri.
// Kazdığın tüneller sıvıya yol açar; su lava değince obsidyen olur. Tamsayı işlemler: kilit adımda deterministik.
import { COLS, ROWS, TILE, GROUND_ROW, STRATUM_ROWS, STRATA_COUNT, PLAY_MIN_COL, PLAY_MAX_COL, CENTER_COL } from '../config.js';
import { T, TD, HOST_TILE } from '../data/tiles.js';
import { LIQUID } from '../data/balance.js';
import { mulberry32 } from '../core/util.js';
import { G } from './state.js';
import { isLocal } from './run.js';
import { poisonPlayer } from './player.js';
import { emit } from '../core/events.js';
import { setTile } from '../world/map.js';

export const FALLS_BIOME = 30, LAVA_BIOME = 6;
const N = COLS * ROWS, WATER = 0, LAVA = 1;
const solid = i => TD[G.map[i]].solid;

// yerleşim: harita üretiminden sonra, tohumdan
export function placeLiquids(g, seed) {
  const R = mulberry32((seed | 0) ^ 0x1f2e3d4c), lq = new Uint8Array(N), lk = new Uint8Array(N), springs = [];
  const set = (c, r, t) => { if (c >= PLAY_MIN_COL && c <= PLAY_MAX_COL && !TD[g.map[r * COLS + c]].nest) g.map[r * COLS + c] = t; };
  const wall = (c, r, t) => { if (c >= PLAY_MIN_COL && c <= PLAY_MAX_COL && !TD[g.map[r * COLS + c]].solid) g.map[r * COLS + c] = t; };
  const fill = (c, r, k, a = 8) => { const i = r * COLS + c; if (!TD[g.map[i]].solid) { lq[i] = a; lk[i] = k; } };
  // şelale: tavanda kaynak, dar oluk, basamakta sıçrama, altta havuz ve gider
  const fall = (s, off, left, k, host) => {
    const r0 = GROUND_ROW + s * STRATUM_ROWS + off, x0 = left ? PLAY_MIN_COL : CENTER_COL + 2, w = 5;
    const sc = x0 + 1 + Math.floor(R() * 2), top = r0 + 4 + Math.floor(R() * 6), rb = top + 12 + Math.floor(R() * 5);
    const ledge = top + 5 + Math.floor(R() * 3), lc = sc + (left ? 1 : -1);
    for (let r = top - 1; r <= rb + 1; r++) for (let c = x0 - 1; c <= x0 + w; c++) wall(c, r, host);
    set(sc, top - 1, k === LAVA ? T.LAVAVENT : T.SPRING);
    for (let r = top; r < ledge; r++) set(sc, r, T.AIR);
    for (let r = ledge; r <= rb - 3; r++) set(lc, r, T.AIR);
    set(sc, ledge, T.AIR);
    for (let r = rb - 6; r <= rb; r++) for (let c = x0; c < x0 + w; c++) if (r >= rb - 2 || Math.abs(c - lc) <= (r - (rb - 7))) set(c, r, T.AIR);
    for (let r = rb - 2; r <= rb; r++) for (let c = x0; c < x0 + w; c++) fill(c, r, k);
    set(x0 + 2, rb + 1, T.SINK); if (k === WATER) set(x0 + 4, rb + 1, T.SINK);
    springs.push({ c: sc, r: top - 1, k });
  };
  // kapalı lav cebi: kazınca taşar
  const pocket = s => {
    for (let t = 0; t < 30; t++) {
      const c = PLAY_MIN_COL + Math.floor(R() * 11), r = GROUND_ROW + s * STRATUM_ROWS + 6 + Math.floor(R() * (STRATUM_ROWS - 12));
      if (Math.abs(c + 1 - CENTER_COL) <= 2) continue;
      let ok = true; for (let y = r - 1; y <= r + 2 && ok; y++) for (let x = c - 1; x <= c + 3; x++) if (!TD[g.map[y * COLS + x]].plain) { ok = false; break; }
      if (!ok) continue;
      for (let y = r; y <= r + 1; y++) for (let x = c; x <= c + 2; x++) { set(x, y, T.AIR); fill(x, y, LAVA); }
      return;
    }
  };
  for (let s = 0; s < STRATA_COUNT; s++) {
    const b = g.order[s];
    if (b === FALLS_BIOME) { const L = R() < 0.5; fall(s, 0, L, WATER, T.FALLROCK); fall(s, 8, !L, WATER, T.FALLROCK); }
    else if (b === LAVA_BIOME) { fall(s, 4, R() < 0.5, LAVA, HOST_TILE[b]); pocket(s); pocket(s); pocket(s); }
  }
  return { lq, lk, springs, lqT: 0 };
}

const react = (i, j) => {
  // su + lav: lav olan hücre obsidyene döner, su buhar olur
  const lava = G.lk[i] === LAVA ? i : j, water = lava === i ? j : i;
  G.lq[lava] = 0; G.lq[water] = Math.max(0, G.lq[water] - 2);
  setTile(lava % COLS, Math.floor(lava / COLS), T.OBSIDIAN);
  emit('steam', { x: (lava % COLS) * TILE + 8, y: Math.floor(lava / COLS) * TILE + 8 });
};

function flowStep(lavaTurn) {
  const lq = G.lq, lk = G.lk, dir = (G.lqT & 1) ? 1 : -1, tot = [0, 0];
  for (let r = ROWS - 2; r >= GROUND_ROW; r--) {
    for (let n = 0; n < COLS; n++) {
      const c = dir > 0 ? n : COLS - 1 - n, i = r * COLS + c;
      let a = lq[i]; if (!a) continue;
      if (solid(i)) { lq[i] = 0; continue; }
      const k = lk[i];
      tot[k] += a;
      if (k === LAVA && !lavaTurn) continue;
      // gider: havuzun dibindeki hücreyi yavaşça boşaltır
      const b = i + COLS;
      if (G.map[b] === T.SINK) { a = lq[i] = Math.max(0, a - LIQUID.drain[k]); if (!a) continue; }
      // aşağı
      if (!solid(b)) {
        if (lq[b] && lk[b] !== k) { react(i, b); continue; }
        const m = Math.min(8 - lq[b], a);
        if (m > 0) { lq[b] += m; lk[b] = k; a = lq[i] = a - m; if (!a) continue; }
      }
      // yanlara: iki komşuyla eşitlen
      let moved = false;
      for (const d of [dir, -dir]) {
        const j = i + d, cj = c + d;
        if (cj < 0 || cj >= COLS || solid(j)) continue;
        if (lq[j] && lk[j] !== k) { react(i, j); moved = true; break; }
        if (lq[j] < a - 1) { const m = (a - lq[j]) >> 1; lq[j] += m; lk[j] = k; a = lq[i] = a - m; moved = true; }
      }
      // tek birimlik sızıntı buharlaşır / soğur
      if (a === 1 && !moved && (G.lqT + i) % LIQUID.dry === 0) lq[i] = 0;
    }
  }
  return tot;
}

export function updateLiquids(dt) {
  if (!G.lq) return;
  if (G.frame % LIQUID.every === 0) {
    G.lqT = (G.lqT | 0) + 1;
    const lavaTurn = G.lqT % LIQUID.lavaSlow === 0, tot = flowStep(lavaTurn);
    // kaynaklar: toplam sınırın altındaysa aktar (sınır: sel olmasın)
    const cnt = [0, 0]; for (const s of G.springs) cnt[s.k]++;
    for (const s of G.springs) {
      if (s.k === LAVA && !lavaTurn) continue;
      const i = (s.r + 1) * COLS + s.c; if (solid(i)) continue;
      const room = LIQUID.cap[s.k] * cnt[s.k] - tot[s.k]; if (room <= 0) continue;
      if (G.lq[i] && G.lk[i] !== s.k) continue;
      const add = Math.min(LIQUID.emit[s.k], 8 - G.lq[i], room);
      if (add > 0) { G.lq[i] += add; G.lk[i] = s.k; }
    }
  }
  // oyuncu: suda yavaşlar ve söner; lavda yanar
  for (const p of G.players) {
    if (p.dead || p.ride) continue;
    const i = Math.floor(p.y / TILE) * COLS + Math.floor(p.x / TILE), a = G.lq[i];
    p.wet = a > 2 && G.lk[i] === WATER;
    if (p.wet) p.burnT = 0;
    if (a && G.lk[i] === LAVA) {
      if ((p.lavaT = (p.lavaT || 0) - dt) <= 0) { p.lavaT = 0.4; poisonPlayer(p, LIQUID.lavaDmg); p.burnT = Math.max(p.burnT || 0, 2); if (isLocal(p) && !p.lavaWarn) { p.lavaWarn = true; emit('toast', { text: 'Lav! Hemen çık', icon: 'flame', bad: true }); } }
    } else p.lavaT = 0;
  }
}

export const liquidAt = (c, r) => G.lq ? G.lq[r * COLS + c] : 0;
