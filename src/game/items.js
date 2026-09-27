// Kemer eşyaları: meşale, dinamit, tamir kiti, barikat, mayın, dönüş fişeği.
import { TILE, GROUND_Y, GROUND_ROW, BASE_X } from '../config.js';
import { T, TD, isMineable } from '../data/tiles.js';
import { DYNAMITE, MINE, MEDKIT, RECALL } from '../data/balance.js';
import { G } from './state.js';
import { tileAt } from '../world/map.js';
import { placeBarricade, barricadeTarget } from './economy.js';
import { breakTile, damagePlayer } from './player.js';
import { damageEnemy, hurtBarricade } from './enemies.js';
import { igniteGas } from './hazards.js';
import { sparks, ring, shake, hitstop, flashLight, debris, dust, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

function torchSpot() {
  const p = G.player;
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
  if (r < GROUND_ROW || tileAt(c, r) !== T.AIR) return null;
  if (G.torches.some(t => t.c === c && t.r === r)) return null;
  return { c, r };
}

export function itemUsable(k) {
  const p = G.player;
  if (p.dead || !G.items[k]) return false;
  const under = p.y >= GROUND_Y;
  switch (k) {
    case 'torch': return !!torchSpot();
    case 'dynamite': return under && G.bombs.length < 3;
    case 'medkit': return p.hp < p.maxHp;
    case 'barricade': return !!barricadeTarget();
    case 'mine': return under && G.mines.length < 8;
    case 'recall': return under && !p.carrying && p.recallT <= 0;
  }
  return false;
}

export function useItem(k) {
  const p = G.player;
  if (!itemUsable(k)) {
    sfx.deny();
    if (k === 'recall' && p.carrying) emit('toast', { text: 'Kalp Kristali ışınlanamaz', icon: 'heart', bad: true });
    return false;
  }
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
  if (k === 'barricade') { if (!placeBarricade()) return false; emit('itemUsed', k); return true; }
  G.items[k]--;
  if (k === 'torch') {
    G.torches.push({ c, r }); G.stats.torches++;
    sfx.torch(); sparks(c * TILE + 8, r * TILE + 5, '#ffb050', 6, 40); flashLight(c * TILE + 8, r * TILE + 6, 5, 0.25);
  } else if (k === 'dynamite') {
    G.bombs.push({ x: c * TILE + 8, y: r * TILE + 12, t: DYNAMITE.fuse, tick: 0 });
    sfx.fuse(); haptic(10);
  } else if (k === 'medkit') {
    p.hp = Math.min(p.maxHp, p.hp + MEDKIT.heal);
    sfx.heal(); ring(p.x, p.y, '#5fe0b8', 16); sparks(p.x, p.y, '#5fe0b8', 10, 50);
  } else if (k === 'mine') {
    G.mines.push({ x: p.x, y: r * TILE + 13, arm: MINE.arm });
    sfx.build(); dust(p.x, r * TILE + 14, 2);
  } else if (k === 'recall') {
    p.recallT = RECALL.channel;
    sfx.recall(); haptic(20);
  }
  emit('itemUsed', k);
  return true;
}

// dinamit patlaması: kaya kırar, düşmanları savurur, sana da dokunur
function detonate(b) {
  const c0 = Math.floor(b.x / TILE), r0 = Math.floor((b.y - 4) / TILE), R = DYNAMITE.radius;
  const cx = c0 * TILE + 8, cy = r0 * TILE + 8;
  for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
    if (Math.hypot(dc, dr) > R) continue;
    const c = c0 + dc, r = r0 + dr, t = tileAt(c, r);
    if (r < GROUND_ROW) continue;
    if (t === T.BARRICADE) hurtBarricade(c, r, 40);
    else if (isMineable(t) && !TD[t].heart) { breakTile(c, r, true); G.stats.blasted++; }
  }
  const rad = R * TILE + 4;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - cx, e.y - cy);
    if (d < rad + e.r) damageEnemy(e, DYNAMITE.dmg, (e.x - cx) / (d || 1), (e.y - cy) / (d || 1), 2.5);
  }
  const p = G.player;
  if (!p.dead && Math.hypot(p.x - cx, p.y - cy) < 26) damagePlayer(DYNAMITE.selfDmg, cx, cy);
  sfx.explode(); shake(0.5); hitstop(0.06); haptic(50);
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
  ring(m.x, m.y, '#ff7a3a', MINE.radius); sparks(m.x, m.y, '#ffd48a', 14, 120); debris(m.x, m.y, 'dirt', 6);
  flashLight(m.x, m.y, 5, 0.25);
  igniteGas(m.x, m.y, MINE.radius);
}

export function updateItems(dt) {
  // dinamitler
  const bs = G.bombs; let j = 0;
  for (const b of bs) {
    b.t -= dt; b.tick -= dt;
    if (Math.random() < dt * 30) particle(b.x + 2, b.y - 7, (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 0.2, Math.random() < 0.5 ? '#ffe79a' : '#ff9a4a', 1, 1, 60);
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
    for (const e of G.enemies) if (!e.dead && e.emergeT <= 0 && Math.hypot(e.x - m.x, e.y - m.y) < MINE.trigger + e.r) { boom = true; break; }
    if (boom) { mineBlast(m); continue; }
    ms[j++] = m;
  }
  ms.length = j;
  // dönüş fişeği
  const p = G.player;
  if (p.recallT > 0) {
    if (p.dead || p.carrying) { p.recallT = 0; return; }
    p.recallT -= dt;
    const a = Math.random() * Math.PI * 2, rr = 14 + Math.random() * 8;
    particle(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, -Math.cos(a) * rr * 4, -Math.sin(a) * rr * 4, 0.22, '#9fe8ff', 1, 1, 0);
    if (p.recallT <= 0) {
      ring(p.x, p.y, '#9fe8ff', 20); sparks(p.x, p.y, '#9fe8ff', 12, 80);
      p.x = BASE_X + 40; p.y = GROUND_ROW * TILE - 10; p.px = p.x; p.py = p.y;
      p.dig = null; G.cam.snap = true;
      ring(p.x, p.y, '#9fe8ff', 22); sparks(p.x, p.y, '#9fe8ff', 14, 90); flashLight(p.x, p.y, 5, 0.3);
      sfx.warp(); haptic(30);
    }
  }
}
