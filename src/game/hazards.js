// Maden tehlikeleri: altı boşalan gevşek kaya düşer (önce sallanır), gaz cepleri zehirli bulut salar.
// Gaz bulutu patlamayla tutuşur: dinamit/mayın/bombacı böcekle kasıtlı kullanılabilir.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_ROW } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { HAZARD } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, setTile, matOf } from '../world/map.js';
import { damagePlayer, poisonPlayer } from './player.js';
import { damageEnemy, hurtBarricade, killEnemy } from './enemies.js';
import { debris, dust, shake, particle, ring, sparks, flashLight } from './fx.js';
import { sfx } from '../audio/audio.js';
import { updateBiomes } from './biomes.js';

// ses ve sarsıntı yalnız yerel madencinin yakınında (partnerin uzaktaki göçüğü ekranı sallamasın)
const nearLocal = (x, y, d = 170) => G.player && Math.hypot(G.player.x - x, G.player.y - y) < d;

function queueFall(c, r) {
  if (G.falls.some(f => f.c === c && f.r === r)) return;
  G.falls.push({ c, r, t: HAZARD.fallDelay });
  if (nearLocal(c * TILE + 8, r * TILE + 8)) sfx.creak();
}
function checkAbove(c, r) {
  if (tileAt(c, r) === T.AIR && tileAt(c, r - 1) === T.LOOSE) queueFall(c, r - 1);
}

export function spawnGas(x, y) {
  G.gas.push({ x, y, t: HAZARD.gasTime, T: HAZARD.gasTime, rad: 8, tick: 0 });
  if (nearLocal(x, y)) sfx.gas();
  for (let i = 0; i < 6; i++) particle(x + (rnd() - 0.5) * 10, y + (rnd() - 0.5) * 10, (rnd() - 0.5) * 30, -10 - rnd() * 20, 0.8, 'rgba(150,210,80,0.45)', 3, 2, -8);
}

// patlama gaz bulutuna değerse bulut alev alır (zincirlenebilir)
// bulutlar diziden çıkarılmaz, ölü işaretlenir: güncelleme döngüsünün ortasında da güvenle çağrılabilir
export function igniteGas(x, y, rad) {
  const lit = [];
  for (const g of G.gas) if (!g.dead && Math.hypot(g.x - x, g.y - y) <= rad + g.rad) { g.dead = true; lit.push(g); }
  for (const g of lit) {
    const R = g.rad + 10;
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - g.x, e.y - g.y) < R + e.r) damageEnemy(e, HAZARD.gasBoom, 0, -1, 1);
    for (const p of G.players) if (!p.dead && Math.hypot(p.x - g.x, p.y - g.y) < R) damagePlayer(p, HAZARD.gasBoom * 0.5, g.x, g.y);
    if (nearLocal(g.x, g.y)) { sfx.explode(); shake(0.35); }
    ring(g.x, g.y, '#ffb050', R); sparks(g.x, g.y, '#ffd48a', 18, 140); sparks(g.x, g.y, '#9af060', 8, 90);
    flashLight(g.x, g.y, 7, 0.4);
    igniteGas(g.x, g.y, R);
  }
}

function shatter(k) {
  debris(k.x, k.y, k.mat, 10); dust(k.x, k.y, 3);
  if (nearLocal(k.x, k.y)) { sfx.breakBlock('stone'); shake(0.15); }
}

export function updateHazards(dt) {
  updateBiomes(dt);
  // açılan hücreler: üstünde gevşek kaya var mı
  const cl = G.cleared;
  for (let i = 0; i < cl.length; i += 2) checkAbove(cl[i], cl[i + 1]);
  cl.length = 0;
  // oyuncu yakınındaki desteksiz gevşek kayalar da çöker (mağara tavanı)
  G.hazT -= dt;
  if (G.hazT <= 0) {
    G.hazT = 0.25;
    for (const p of G.players) {
      if (p.dead || p.y <= GROUND_ROW * TILE) continue;
      const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
      for (let r = pr - 4; r <= pr + 2; r++) for (let c = pc - 3; c <= pc + 3; c++) checkAbove(c, r + 1);
    }
  }

  // sallanan kayalar
  const fs = G.falls; let j = 0;
  for (const f of fs) {
    if (tileAt(f.c, f.r) !== T.LOOSE) continue;
    f.t -= dt;
    const x = f.c * TILE + 8, y = f.r * TILE + 15;
    if (rnd() < dt * 14) particle(x + (rnd() - 0.5) * 12, y, 0, 20, 0.5, 'rgba(190,160,130,0.6)', 1, 0, 200);
    if (f.t <= 0) {
      const mat = matOf(f.c, f.r);
      setTile(f.c, f.r, T.AIR);
      G.rocks.push({ x: f.c * TILE + 8, y: f.r * TILE + 8, vy: 20, mat });
      if (nearLocal(x, y)) sfx.rockfall();
      continue;
    }
    fs[j++] = f;
  }
  fs.length = j;

  // düşen kayalar
  const rs = G.rocks; j = 0;
  for (const k of rs) {
    k.vy = Math.min(320, k.vy + 620 * dt);
    const ny = k.y + k.vy * dt;
    const c = Math.floor(k.x / TILE), rb = Math.floor((ny + 7) / TILE);
    const tb = tileAt(c, rb);
    let hit = false;
    for (const p of G.players) if (!p.dead && Math.abs(p.x - k.x) < 9 && Math.abs(p.y - ny) < 11) { damagePlayer(p, HAZARD.fallDmg * (k.mul || 1), k.x, k.y - 8); hit = true; break; }
    for (const e of G.enemies) if (!e.dead && e.emergeT <= 0 && Math.abs(e.x - k.x) < e.r + 6 && Math.abs(e.y - ny) < e.r + 6) {
      damageEnemy(e, HAZARD.fallEnemyDmg, 0, 1, 0.5); hit = true; break;
    }
    if (!hit && TD[tb].solid) {
      if (tb === T.BARRICADE) hurtBarricade(c, rb, 30);
      k.y = rb * TILE - 6; hit = true;
    }
    if (hit) { shatter(k); continue; }
    k.y = ny;
    rs[j++] = k;
  }
  rs.length = j;

  // gaz bulutları
  const gs = G.gas; j = 0;
  for (const g of gs) {
    g.t -= dt;
    if (g.t <= 0 || g.dead) continue;
    const age = g.T - g.t;
    g.rad = HAZARD.gasRadius * Math.min(1, 0.4 + age * 0.8) * (g.t < 1 ? 0.6 + g.t * 0.4 : 1);
    // gaz yükselir, kayadan geçmez
    if (!TD[tileAt(Math.floor(g.x / TILE), Math.floor((g.y - 10) / TILE))].solid) g.y -= 4 * dt;
    if (rnd() < dt * 10) {
      const a = rnd() * Math.PI * 2, rr = rnd() * g.rad;
      particle(g.x + Math.cos(a) * rr, g.y + Math.sin(a) * rr * 0.7, (rnd() - 0.5) * 6, -3 - rnd() * 4, 1.1, 'rgba(150,210,80,0.32)', 3 + (rnd() * 2 | 0), 2, -4);
    }
    g.tick -= dt;
    if (g.tick <= 0) {
      g.tick = 0.5;
      for (const p of G.players) if (!p.dead && Math.hypot(p.x - g.x, p.y - g.y) < g.rad) poisonPlayer(p, HAZARD.gasDps * 0.5, true);
    }
    for (const e of G.enemies) {
      if (e.dead || e.emergeT > 0 || e.under || e.intro > 0 || Math.hypot(e.x - g.x, e.y - g.y) > g.rad) continue;
      e.hp -= HAZARD.gasDps * 1.5 * dt; e.gasT = 0.2;
      if (e.hp <= 0) killEnemy(e);
    }
    if (!g.dead) gs[j++] = g;
  }
  gs.length = j;
}
