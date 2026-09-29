// Kemer eşyaları: dinamit, tamir kiti, kalkan, sonar, sessizlik çanı, burgu şarjı, dönüş fişeği, adrenalin.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y, GROUND_ROW, BASE_X, COLS } from '../config.js';
import { T, TD, isMineable } from '../data/tiles.js';
import { DYNAMITE, MEDKIT, RECALL, ITEMS, THREAT, ROLES, SONAR, HUSH, SHIELD, AUGER, ADREN } from '../data/balance.js';
import { addNoise } from './threat.js';
import { G } from './state.js';
import { tileAt } from '../world/map.js';
import { placeBuild } from './economy.js';
import { breakTile, damagePlayer, unbury } from './player.js';
import { damageEnemy, hurtBarricade } from './enemies.js';
import { isLocal, hear } from './run.js';
import { igniteGas } from './hazards.js';
import { sparks, ring, shake, hitstop, flashLight, dust, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

// burgu şarjı: ayağının altındaki blok delinebilir mi
function augerOk(p) {
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE) + 1, t = tileAt(c, r), d = TD[t];
  return r >= GROUND_ROW && isMineable(t) && !d.chest && !d.heart && !d.relic && !d.gate;
}

export function itemUsable(k, p = G.player) {
  if (p.dead || !G.items[k]) return false;
  const under = p.y >= GROUND_Y;
  if (ITEMS[k].build) { const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE); return tileAt(c, r) === T.AIR && !G.structures.some(s => s.c === c && s.r === r); }
  switch (k) {
    case 'dynamite': return under && G.bombs.length < 3;
    case 'medkit': return p.hp < p.maxHp;
    case 'recall': return under && !p.carrying && p.recallT <= 0;
    case 'sonar': return under;
    case 'can': return under;
    case 'kalkan': return !(p.barrierT > 0);
    case 'burgu': return augerOk(p);
    case 'adren': return !(p.adrenT > 0);
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
  if (ITEMS[k].build) { if (!placeBuild(k, p)) return false; if (local) emit('itemUsed', k); return true; }
  G.items[k]--;
  if (k === 'dynamite') {
    G.bombs.push({ x: c * TILE + 8, y: r * TILE + 12, t: DYNAMITE.fuse, tick: 0, owner: p.i });
    if (hear(p)) sfx.fuse(); if (local) haptic(10);
  } else if (k === 'medkit') {
    p.hp = Math.min(p.maxHp, p.hp + Math.max(MEDKIT.heal, p.maxHp * MEDKIT.frac));
    if (hear(p)) sfx.heal(); ring(p.x, p.y, '#5fe0b8', 16); sparks(p.x, p.y, '#5fe0b8', 10, 50);
  } else if (k === 'sonar') {
    // çevredeki gömülü cevher/yuva belirir, sandıklar görünür olur
    const R = SONAR.radius;
    for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || cc >= COLS || rr < GROUND_ROW || dc * dc + dr * dr > R * R) continue;
      const i = rr * COLS + cc, d = TD[G.map[i]];
      if (!d) continue;
      if (G.buried[i]) unbury(cc, rr, p);
      if (d.chest || d.ore || d.nest) G.rev[i] = 1;
    }
    G.mapVersion++;
    ring(p.x, p.y, '#9fe8ff', R * TILE); ring(p.x, p.y, '#ffffff', R * TILE * 0.5); flashLight(p.x, p.y, 5, 0.4);
    if (hear(p)) sfx.recall();
  } else if (k === 'can') {
    G.threat.noise = Math.max(0, G.threat.noise - HUSH.drop); G.evt.hushT = Math.max(G.evt.hushT, HUSH.t);
    ring(p.x, p.y, '#d8d8e8', 40); ring(p.x, p.y, '#ffffff', 24); dust(p.x, p.y, 3, 'rgba(220,220,235,0.5)');
    if (hear(p)) sfx.chirp();
  } else if (k === 'kalkan') {
    p.barrier = SHIELD.hp; p.barrierT = SHIELD.t;
    ring(p.x, p.y, '#6fd0ff', 18); sparks(p.x, p.y, '#bff4ff', 12, 70);
    if (hear(p)) sfx.heal();
  } else if (k === 'burgu') {
    for (let rr = r + 1; rr <= r + AUGER.depth; rr++) {
      const t = tileAt(c, rr), d = TD[t];
      if (!isMineable(t) || d.chest || d.heart || d.relic || d.gate) break;
      breakTile(c, rr, p); sparks(c * TILE + 8, rr * TILE + 8, '#ffd48a', 4, 70);
    }
    addNoise(THREAT.noise.boom * 0.5, p.x, p.y);
    sfx.explode(); shake(0.3); hitstop(0.04); flashLight(p.x, p.y + 20, 5, 0.3);
    if (local) haptic(40);
  } else if (k === 'adren') {
    p.adrenT = ADREN.t;
    ring(p.x, p.y, '#ff5a6a', 20); sparks(p.x, p.y, '#ff9aa0', 14, 90); flashLight(p.x, p.y, 4, 0.3);
    if (hear(p)) sfx.overdrive();
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
