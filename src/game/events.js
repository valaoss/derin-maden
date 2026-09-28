// Dinamik maden olayları (deterministik, simülasyonun parçası): sarsıntı, gaz sızıntısı, karartma.
// Uyarı afişinden birkaç saniye sonra vurur; oyuncuya tepki verme şansı bırakır.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y, GROUND_ROW, ROWS, PLAY_MIN_COL, PLAY_MAX_COL } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { EVENTS, EVENT_KEYS } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, setTile } from '../world/map.js';
import { spawnGas } from './hazards.js';
import { addNoise } from './threat.js';
import { shake, dust } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

export function makeEvents() { return { t: EVENTS.first, k: null, warnT: 0, darkT: 0, n: 0 }; }

const under = () => G.players.filter(p => !p.dead && p.y >= GROUND_Y);

export function updateEvents(dt) {
  const ev = G.evt; if (!ev || G.over) return;
  if (ev.darkT > 0) ev.darkT -= dt;
  if (G.tutorial && !G.tutorial.done) return;
  const ps = under();
  if (ev.k) {
    ev.warnT -= dt;
    if (ev.warnT <= 0) { hit(ev.k, ps); ev.k = null; ev.t = EVENTS.cd[0] + rnd() * (EVENTS.cd[1] - EVENTS.cd[0]); }
    return;
  }
  if (!ps.length || G.threat.level < EVENTS.minLevel) return;
  ev.t -= dt;
  if (ev.t > 0) return;
  ev.k = EVENT_KEYS[Math.floor(rnd() * EVENT_KEYS.length)]; ev.warnT = EVENTS.warn; ev.n++;
  emit('event', { k: ev.k, phase: 'warn' });
  sfx.creak(); shake(0.12);
}

function hit(k, ps) {
  emit('event', { k, phase: 'hit' });
  if (k === 'sarsinti') {
    shake(0.6); haptic([30, 40, 60]); sfx.rumble();
    for (const p of ps) { tremor(p); addNoise(EVENTS.sarsinti.noise, p.x, p.y); }
  } else if (k === 'gaz') {
    for (const p of ps) leak(p);
  } else if (k === 'karanlik') {
    G.evt.darkT = EVENTS.karanlik.t;
  }
}

// oyuncunun üstündeki desteksiz tavan kayaları gevşer ve düşer
function tremor(p) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  let n = 0;
  for (let tries = 0; tries < 60 && n < EVENTS.sarsinti.rocks; tries++) {
    const c = pc + Math.round((rnd() - 0.5) * 10), r = pr - 1 - Math.floor(rnd() * 5);
    if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r <= GROUND_ROW || r >= ROWS - 2) continue;
    const d = TD[tileAt(c, r)];
    if (!d.solid || d.unbreakable || d.chest || d.heart || d.nest || tileAt(c, r + 1) !== T.AIR) continue;
    if (G.falls.some(f => f.c === c && f.r === r)) continue;
    setTile(c, r, T.LOOSE); G.falls.push({ c, r, t: 0.4 + rnd() * 0.8 }); n++;
  }
  // dar şaft: açık tavandan doğrudan taş düşer (en fazla 2; yana kazarak kaçılır)
  if (n < 2) {
    let top = pr - 1;
    while (top > pr - 7 && tileAt(pc, top - 1) === T.AIR) top--;
    if (top <= pr - 3) for (let i = 0; i < 2 - n; i++) G.rocks.push({ x: pc * TILE + 8, y: top * TILE + 8 - i * 12, vy: 10, mat: 'stone' });
  }
  dust(p.x, p.y - 10, 6);
}

// yakın boşluklara gaz bulutu
function leak(p) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  let n = 0;
  for (let tries = 0; tries < 60 && n < EVENTS.gaz.clouds; tries++) {
    const c = pc + Math.round((rnd() - 0.5) * 12), r = pr + Math.round((rnd() - 0.5) * 8);
    if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r <= GROUND_ROW || r >= ROWS - 2) continue;
    if (tileAt(c, r) !== T.AIR || Math.hypot(c - pc, r - pr) < 2.5) continue;
    spawnGas(c * TILE + 8, r * TILE + 8); n++;
  }
}
