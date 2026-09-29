// Kemer eşyaları: meşale, dinamit, tamir kiti, barikat, mayın, dönüş fişeği.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y, GROUND_ROW, BASE_X } from '../config.js';
import { T, TD, isMineable } from '../data/tiles.js';
import { DYNAMITE, MINE, MEDKIT, RECALL, ITEMS, THREAT, ROLES } from '../data/balance.js';
import { addNoise } from './threat.js';
import { G } from './state.js';
import { tileAt } from '../world/map.js';
import { placeBarricade, barricadeTarget, placeBuild } from './economy.js';
import { breakTile, damagePlayer } from './player.js';
import { damageEnemy, hurtBarricade } from './enemies.js';
import { isLocal, hear } from './run.js';
import { igniteGas } from './hazards.js';
import { sparks, ring, shake, hitstop, flashLight, debris, dust, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

function torchSpot(p) {
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
  if (r < GROUND_ROW || tileAt(c, r) !== T.AIR) return null;
  if (G.torches.some(t => t.c === c && t.r === r)) return null;
  return { c, r };
}

export function itemUsable(k, p = G.player) {
  if (p.dead || !G.items[k]) return false;
  const under = p.y >= GROUND_Y;
  if (ITEMS[k].build) { const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE); return tileAt(c, r) === T.AIR && !G.structures.some(s => s.c === c && s.r === r); }
  switch (k) {
    case 'torch': return !!torchSpot(p);
    case 'dynamite': return under && G.bombs.length < 3;
    case 'medkit': return p.hp < p.maxHp;
    case 'barricade': return !!barricadeTarget(p);
    case 'mine': return under && G.mines.length < 8;
    case 'recall': return under && !p.carrying && p.recallT <= 0;
  }
  return false;
}

export function useItem(k, p = G.player) {
  const local = isLocal(p);
  if (!itemUsable(k, p)) {
    if (local) { sfx.deny(); if (k === 'recall' && p.carrying) emit('toast', { text: 'Kalp Kristali ışınlanamaz', icon: 'heart', bad: true }); }
    return false;
  }
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
  if (k === 'barricade') { if (!placeBarricade(p)) return false; if (local) emit('itemUsed', k); return true; }
  if (ITEMS[k].build) { if (!placeBuild(k, p)) return false; if (local) emit('itemUsed', k); return true; }
  G.items[k]--;
  if (k === 'torch') {
    G.torches.push({ c, r }); G.stats.torches++;
    if (hear(p)) sfx.torch(); sparks(c * TILE + 8, r * TILE + 5, '#ffb050', 6, 40); flashLight(c * TILE + 8, r * TILE + 6, 5, 0.25);
  } else if (k === 'dynamite') {
    G.bombs.push({ x: c * TILE + 8, y: r * TILE + 12, t: DYNAMITE.fuse, tick: 0, owner: p.i });
    if (hear(p)) sfx.fuse(); if (local) haptic(10);
  } else if (k === 'medkit') {
    p.hp = Math.min(p.maxHp, p.hp + MEDKIT.heal);
    if (hear(p)) sfx.heal(); ring(p.x, p.y, '#5fe0b8', 16); sparks(p.x, p.y, '#5fe0b8', 10, 50);
  } else if (k === 'mine') {
    G.mines.push({ x: p.x, y: r * TILE + 13, arm: MINE.arm });
    if (hear(p)) sfx.build(); dust(p.x, r * TILE + 14, 2);
  } else if (k === 'recall') {
    p.recallT = RECALL.channel;
    if (hear(p)) sfx.recall(); if (local) haptic(20);
  }
  if (local) emit('itemUsed', k);
  return true;
}

// dinamit patlaması: kaya kırar, düşmanları savurur, sana da dokunur
function detonate(b) {
  const owner = G.players[b.owner | 0] || G.players[0], blast = owner.role === 'yikici' ? ROLES.yikici.blast : 1;
  const c0 = Math.floor(b.x / TILE), r0 = Math.floor((b.y - 4) / TILE), R = DYNAMITE.radius * blast;
  const cx = c0 * TILE + 8, cy = r0 * TILE + 8;
  for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
    if (Math.hypot(dc, dr) > R) continue;
    const c = c0 + dc, r = r0 + dr, t = tileAt(c, r);
    if (r < GROUND_ROW) continue;
    if (t === T.BARRICADE) hurtBarricade(c, r, 40);
    else if ((isMineable(t) || TD[t].blastable) && !TD[t].heart) { breakTile(c, r, owner); G.stats.blasted++; }
  }
  const rad = R * TILE + 4;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - cx, e.y - cy);
    if (d < rad + e.r) damageEnemy(e, DYNAMITE.dmg, (e.x - cx) / (d || 1), (e.y - cy) / (d || 1), 2.5);
  }
  for (const p of G.players) if (!p.dead && p.role !== 'yikici' && Math.hypot(p.x - cx, p.y - cy) < 26 * blast) damagePlayer(p, DYNAMITE.selfDmg, cx, cy);
  sfx.explode(); shake(0.5); hitstop(0.06); haptic(50);
  addNoise(THREAT.noise.boom, cx, cy);
  ring(cx, cy, '#ffb050', rad); sparks(cx, cy, '#ffd48a', 22, 160); sparks(cx, cy, '#ff7a3a', 10, 110);
  dust(cx, cy, 8, 'rgba(160,130,110,0.55)'); flashLight(cx, cy, 8, 0.35);
  igniteGas(cx, cy, rad);
}

function mineBlast(m) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - m.x, e.y - m.y);
    if (d < MINE.radius + e.r) damageEnemy(e, MINE.dmg, (e.x - m.x) / (d || 1), (e.y - m.y) / (d || 1), 2);
  }
  sfx.explode(); shake(0.25); haptic(25);
  addNoise(THREAT.noise.mine, m.x, m.y);
  ring(m.x, m.y, '#ff7a3a', MINE.radius); sparks(m.x, m.y, '#ffd48a', 14, 120); debris(m.x, m.y, 'dirt', 6);
  flashLight(m.x, m.y, 5, 0.25);
  igniteGas(m.x, m.y, MINE.radius);
}

export function updateItems(dt) {
  // dinamitler
  const bs = G.bombs; let j = 0;
  for (const b of bs) {
    b.t -= dt; b.tick -= dt;
    if (rnd() < dt * 30) particle(b.x + 2, b.y - 7, (rnd() - 0.5) * 30, -20 - rnd() * 30, 0.2, rnd() < 0.5 ? '#ffe79a' : '#ff9a4a', 1, 1, 60);
    if (b.tick <= 0) { b.tick = b.t < 0.7 ? 0.12 : 0.3; sfx.fuseTick(); }
    if (b.t <= 0) { detonate(b); continue; }
    bs[j++] = b;
  }
  bs.length = j;
  // mayınlar
  const ms = G.mines; j = 0;
  for (const m of ms) {
    if (m.arm > 0) { m.arm -= dt; if (m.arm <= 0) sfx.arm(); ms[j++] = m; continue; }
    let boom = false;
    for (const e of G.enemies) if (!e.dead && e.emergeT <= 0 && !e.under && Math.hypot(e.x - m.x, e.y - m.y) < MINE.trigger + e.r) { boom = true; break; }
    if (boom) { mineBlast(m); continue; }
    ms[j++] = m;
  }
  ms.length = j;
  // dönüş fişeği
  for (const p of G.players) {
    if (p.recallT <= 0) continue;
    if (p.dead || p.carrying) { p.recallT = 0; continue; }
    p.recallT -= dt;
    const a = rnd() * Math.PI * 2, rr = 14 + rnd() * 8;
    particle(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, -Math.cos(a) * rr * 4, -Math.sin(a) * rr * 4, 0.22, '#9fe8ff', 1, 1, 0);
    if (p.recallT <= 0) {
      ring(p.x, p.y, '#9fe8ff', 20); sparks(p.x, p.y, '#9fe8ff', 12, 80);
      p.x = BASE_X + (p.i ? -40 : 40); p.y = GROUND_ROW * TILE - 10; p.px = p.x; p.py = p.y;
      p.dig = null; if (isLocal(p)) G.cam.snap = true;
      ring(p.x, p.y, '#9fe8ff', 22); sparks(p.x, p.y, '#9fe8ff', 14, 90); flashLight(p.x, p.y, 5, 0.3);
      sfx.warp(); if (isLocal(p)) haptic(30);
    }
  }
}
