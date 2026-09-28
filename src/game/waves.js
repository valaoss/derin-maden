// Dalgalar: sakin -> alarm (yuvalar belirir) -> saldırı -> temizlendi.
// Düşmanlar oyuncunun açtığı en derin bölgeden çıkar; açık tünel yoksa kayanın içinden kazarak gelir.
import { rnd } from '../core/rng.js';
import { COLS, ROWS, TILE, GROUND_ROW, PLAY_MIN_COL, PLAY_MAX_COL } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { WAVES, ENEMIES, ELITE } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, setTile } from '../world/map.js';
import { FIELD, flowAt, FLOW_INF, forceFlow } from '../world/flow.js';
import { spawnEnemy, aliveEnemies, makeElite } from './enemies.js';
import { anyCarrying } from './player.js';
import { debris, dust, shake, ring } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

function pickNests() {
  forceFlow();
  // referans: en derindeki canlı oyuncu (yoksa ilk oyuncu)
  let p = G.players[0];
  for (const q of G.players) if (!q.dead && (p.dead || q.y > p.y)) p = q;
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  const open = [];
  let deepest = GROUND_ROW;
  for (let r = GROUND_ROW + 2; r < ROWS - 2; r++) for (let c = PLAY_MIN_COL; c <= PLAY_MAX_COL; c++) {
    if (tileAt(c, r) !== T.AIR || flowAt(FIELD.walk, c, r) >= FLOW_INF) continue;
    open.push([c, r]); if (r > deepest) deepest = r;
  }
  const far = open.filter(([c, r]) => r >= deepest - 7 && Math.abs(c - pc) + Math.abs(r - pr) >= 6);
  const nests = [];
  far.sort((a, b) => b[1] - a[1]);
  for (const n of far) {
    if (nests.length >= WAVES.nests) break;
    if (nests.every(m => Math.abs(m[0] - n[0]) + Math.abs(m[1] - n[1]) > 4) && rnd() < 0.6) nests.push(n);
  }
  if (!nests.length && far.length) nests.push(far[0]);
  // kaya yuvası: en derin noktanın biraz altından kazarak gelirler
  if (nests.length < WAVES.nests) {
    const baseR = Math.min(ROWS - 4, Math.max(deepest, pr) + 3 + (rnd() * 3 | 0));
    for (let tries = 0; tries < 30 && nests.length < WAVES.nests; tries++) {
      const c = PLAY_MIN_COL + 1 + Math.floor(rnd() * 11);
      const t = tileAt(c, baseR);
      if (TD[t].solid && !TD[t].unbreakable && !TD[t].chest && !TD[t].heart) nests.push([c, baseR, true]);
    }
  }
  return nests.map(([c, r, rock]) => ({ c, r, rock: !!rock, x: c * TILE + 8, y: r * TILE + 8 }));
}

function buildQueue() {
  const w = G.wave.num, st = G.maxStratum;
  let budget = WAVES.budget(w, st, G.mods.budget || 1) * (anyCarrying() ? 1.35 : 1);
  const q = [];
  const bossWave = w % G.mods.bossEvery === 0;
  if (bossWave) { q.push('boss'); budget *= 0.4; }
  const allowed = WAVES.allowed(w, st);
  let guard = 0;
  while (budget > 0.5 && guard++ < 80) {
    const opts = allowed.filter(t => ENEMIES[t].cost <= budget + 0.5);
    if (!opts.length) break;
    const t = opts[Math.floor(rnd() * opts.length)];
    q.push(t); budget -= ENEMIES[t].cost;
  }
  // ağır olanlar sona; dalga 3'ten sonra en pahalı sıradan düşman elit olur
  q.sort((a, b) => ENEMIES[a].cost - ENEMIES[b].cost);
  const out = q.map((type, i) => ({ type, t: 0.4 + i * WAVES.spawnGap }));
  if (w >= ELITE.fromWave && !bossWave) { const cand = out.filter(s => s.type !== 'boss' && !ENEMIES[s.type].small); if (cand.length) cand[cand.length - 1].elite = true; }
  return out;
}

export function updateWaves(dt) {
  const W = G.wave;
  if (W.phase === 'calm') {
    W.t -= dt;
    if (anyCarrying() && W.t > WAVES.heartCalm) W.t = WAVES.heartCalm;
    if (W.t <= WAVES.warn) {
      W.phase = 'warn'; W.num++;
      W.nests = pickNests();
      W.boss = W.num % G.mods.bossEvery === 0;
      // kuyruk alarm anında kurulur: afiş dalganın içeriğini (adet, elit) gösterebilsin
      W.queue = buildQueue();
      sfx.alarm(); haptic([30, 60, 30]);
      emit('alarm', { num: W.num, boss: W.boss, count: W.queue.length, elite: W.queue.some(q => q.elite) });
    }
  } else if (W.phase === 'warn') {
    W.t -= dt;
    W.rumbleT -= dt;
    for (const n of W.nests) if (rnd() < dt * 5) debris(n.x, n.y + 6, 'dirt', 1, 0.3);
    if (W.rumbleT <= 0) { W.rumbleT = 2.2; sfx.rumble(); for (const n of W.nests) dust(n.x, n.y, 2, 'rgba(160,140,130,0.4)'); }
    if (W.t <= 0) startWave();
  } else if (W.phase === 'active') {
    W.elapsed += dt;
    for (const s of W.queue) {
      if (s.done) continue;
      s.t -= dt;
      if (s.t <= 0) {
        s.done = true;
        const n = W.nests[(W.spawnIdx++) % W.nests.length];
        if (ENEMIES[s.type].fly && n.rock) continue;
        if (n.rock && TD[tileAt(n.c, n.r)].solid) { setTile(n.c, n.r, T.AIR); debris(n.x, n.y, 'stone', 8); }
        const e = spawnEnemy(s.type, n.x + (rnd() - 0.5) * 4, n.y + (rnd() - 0.5) * 4, W.num);
        if (s.elite) makeElite(e);
        dust(n.x, n.y, 3, 'rgba(160,140,130,0.5)');
      }
    }
    const pending = W.queue.some(s => !s.done);
    if (!pending && aliveEnemies() === 0) {
      W.phase = 'calm'; W.t = anyCarrying() ? WAVES.heartCalm : WAVES.calm * G.mods.calm; W.nests = [];
      G.stats.wavesCleared++;
      sfx.waveClear();
      emit('waveClear', W.num);
    }
  }
}

function startWave() {
  const W = G.wave;
  W.phase = 'active'; if (!W.queue || !W.queue.length) W.queue = buildQueue(); W.spawnIdx = 0; W.elapsed = 0; W.total = W.queue.length;
  for (const n of W.nests) { ring(n.x, n.y, '#ff5a4a', 16); debris(n.x, n.y, 'dirt', 6); }
  shake(0.25); sfx.waveStart(); haptic(60);
  emit('waveStart', W.num);
}

export function startTutorialWaveClock() {
  if (G.wave.t === Infinity) G.wave.t = 34;
}
export function enemiesRemaining() {
  const W = G.wave;
  return aliveEnemies() + (W.queue ? W.queue.filter(s => !s.done).length : 0);
}
