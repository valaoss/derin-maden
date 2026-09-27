// Düşmanlar derinden gelir, açık tünelleri akış alanıyla izleyerek üsse yürür.
// Kazıcılar kayayı oyar; yolu tamamen kapalı olan herkes yavaşça kazmaya başlar (asla takılmaz).
import { TILE, GROUND_Y, GROUND_ROW, BASE_X, BASE_Y } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { ENEMIES, WAVES, BASE, BARRICADE } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, solidAt, damageTile, idx } from '../world/map.js';
import { FIELD, flowAt, nextStep, FLOW_INF } from '../world/flow.js';
import { breakTile, damagePlayer, spawnOrb } from './player.js';
import { hasPerk } from './run.js';
import { sparks, debris, shake, ring, flashLight, dust, hitstop } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';
import { setTile } from '../world/map.js';

const ENEMY_COL = { rodent: '#b07a4a', bug: '#5a9a5a', spitter: '#9a5ac0', flyer: '#7a64a0', boomer: '#e070ff', brute: '#8a7c78', boss: '#c24a64' };
export { ENEMY_COL };

export function spawnEnemy(type, x, y, wave) {
  const d = ENEMIES[type];
  const hp = d.hp * WAVES.hpScale(wave);
  const e = {
    type, d, x, y, px: x, py: y, hp, maxHp: hp, r: d.r, face: 1, anim: Math.random() * 4,
    hitT: 0, kx: 0, ky: 0, atkCd: 0.6, fireCd: 1 + Math.random(), emergeT: 0.9, wob: Math.random() * 6,
    summonT: 5, stuckT: 0, lastC: -1, lastR: -1,
  };
  G.enemies.push(e);
  return e;
}

function hs(e) { return Math.min(e.r, 6); }
function blocked(e, x, y) {
  const h = hs(e);
  const x0 = Math.floor((x - h) / TILE), x1 = Math.floor((x + h - 0.01) / TILE);
  const y0 = Math.floor((y - h) / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) if (solidAt(c, r)) return true;
  return y < 3 * TILE;
}
function moveE(e, mx, my) {
  if (mx && !blocked(e, e.x + mx, e.y)) e.x += mx;
  if (my && !blocked(e, e.x, e.y + my)) e.y += my;
}

export function losClear(x0, y0, x1, y1, ignoreBarricade = false) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 2);
  for (let i = 1; i < n; i++) {
    const x = x0 + dx * i / n, y = y0 + dy * i / n;
    const t = tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
    if (TD[t].solid && !(ignoreBarricade && t === T.BARRICADE)) return false;
  }
  return true;
}

export function damageEnemy(e, dmg, dx = 0, dy = 0, knock = 1) {
  if (e.hp <= 0 || e.emergeT > 0.3) return;
  const real = dmg * (1 - (e.d.armor || 0));
  e.hp -= real; e.hitT = 0.09;
  const kr = 1 - (e.d.knockResist || 0);
  e.kx += dx * 55 * knock * kr; e.ky += dy * 55 * knock * kr;
  sfx.hit();
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.hp = 0; e.dead = true;
  const col = ENEMY_COL[e.type];
  sparks(e.x, e.y, col, e.d.boss ? 30 : 10, e.d.boss ? 150 : 90);
  sparks(e.x, e.y, '#ff5a4a', 3, 50);
  dust(e.x, e.y, e.d.boss ? 6 : 2, 'rgba(120,90,110,0.5)');
  sfx.enemyDie(e.d.boss || e.type === 'brute');
  G.stats.kills++;
  if (e.d.boom) explode(e.x, e.y, e.d.boom, e.d.dmg);
  if (e.d.boss) { for (let i = 0; i < 5; i++) spawnOrb(e.x, e.y, 'cobalt', true); for (let i = 0; i < 3; i++) spawnOrb(e.x, e.y, 'crystal', true);
    shake(0.6); hitstop(0.15); ring(e.x, e.y, '#ff8aa8', 40); flashLight(e.x, e.y, 7, 0.6); }
  else if (e.type === 'brute') { spawnOrb(e.x, e.y, 'iron', true); spawnOrb(e.x, e.y, 'iron', true); spawnOrb(e.x, e.y, 'cobalt', true); shake(0.25); }
  else if (Math.random() < 0.35) spawnOrb(e.x, e.y, Math.random() < 0.75 ? 'iron' : 'water', true);
  if (hasPerk('yasamOzu') && !G.player.dead) G.player.hp = Math.min(G.player.maxHp, G.player.hp + 3);
}

export function explode(x, y, rad, dmg) {
  sfx.explode(); shake(0.35); haptic(40);
  ring(x, y, '#e070ff', rad); sparks(x, y, '#e070ff', 16, 140); sparks(x, y, '#ffd8ff', 6, 90); flashLight(x, y, 5, 0.3);
  const p = G.player;
  if (!p.dead && Math.hypot(p.x - x, p.y - y) < rad + 4) damagePlayer(dmg, x, y);
  if (Math.hypot(BASE_X - x, BASE_Y - y) < rad + BASE.radius) damageBase(dmg);
  for (const s of G.structures) if (Math.hypot(s.x - x, s.y - y) < rad + 6) damageStructure(s, dmg);
  for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < rad) damageEnemy(e, 18, 0, 0, 0);
  // barikatları da sarsar
  const c0 = Math.floor(x / TILE), r0 = Math.floor(y / TILE);
  for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) if (tileAt(c, r) === T.BARRICADE) hurtBarricade(c, r, dmg);
}

export function damageBase(d) {
  const b = G.base;
  if (b.hp <= 0) return;
  b.hp -= d * (1 - BASE.armor); b.hurtT = 0.25;
  sfx.baseHurt(); emit('baseHurt');
  sparks(b.x + (Math.random() - 0.5) * 30, b.y - Math.random() * 20, '#ffb080', 4, 70);
  if (b.hp <= 0) { b.hp = 0; emit('baseDown'); }
}
export function damageStructure(s, d) {
  s.hp -= d; s.hurtT = 0.15;
  sparks(s.x, s.y, '#ffd48a', 3, 60);
  if (s.hp <= 0) {
    s.dead = true; debris(s.x, s.y, 'stone', 12); sparks(s.x, s.y, '#ffd48a', 10, 100); shake(0.2); sfx.explode();
    emit('toast', { text: s.type === 'turret' ? 'Taret yıkıldı' : 'Onarım istasyonu yıkıldı', icon: s.type, bad: true });
  }
}
export function hurtBarricade(c, r, d) {
  const i = idx(c, r);
  if (G.bhp[i] === undefined) G.bhp[i] = BARRICADE.hp;
  G.bhp[i] -= d;
  sparks(c * TILE + 8, r * TILE + 8, '#b07a42', 3, 60);
  sfx.hit();
  if (G.bhp[i] <= 0) { delete G.bhp[i]; setTile(c, r, T.AIR); debris(c * TILE + 8, r * TILE + 8, 'dirt', 10); sfx.breakBlock('stone'); }
}

// ---------- güncelleme ----------
export function updateEnemies(dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.px = e.x; e.py = e.y;
    e.anim += dt * (e.d.fly ? 12 : 7);
    if (e.hitT > 0) e.hitT -= dt;
    if (e.emergeT > 0) {
      e.emergeT -= dt;
      if (Math.random() < 0.4) debris(e.x, e.y + 4, 'dirt', 1, 0.4);
      continue;
    }
    // sıkışma kurtarma: kutusu kayaya taşmışsa hücre merkezine kay (doğuş/savrulma kenar durumları)
    if (!e.d.fly && blocked(e, e.x, e.y)) {
      const cx = Math.floor(e.x / TILE) * TILE + 8, cy = Math.floor(e.y / TILE) * TILE + 8;
      e.x += Math.sign(cx - e.x) * Math.min(Math.abs(cx - e.x), 40 * dt);
      e.y += Math.sign(cy - e.y) * Math.min(Math.abs(cy - e.y), 40 * dt);
    }
    // savrulma
    if (e.kx || e.ky) {
      moveE(e, e.kx * dt, e.ky * dt);
      e.kx *= Math.exp(-10 * dt); e.ky *= Math.exp(-10 * dt);
      if (Math.abs(e.kx) + Math.abs(e.ky) < 2) e.kx = e.ky = 0;
    }
    e.atkCd -= dt;
    const sp = e.d.speed;
    const dp = p.dead ? 1e9 : Math.hypot(p.x - e.x, p.y - e.y);
    const db = Math.hypot(BASE_X - e.x, BASE_Y - e.y);

    // --- üsse vardı mı ---
    if (db < BASE.radius + e.r && e.y < GROUND_Y + 4) {
      e.st = 'base'; if (e.atkCd <= 0) attack(e, 'base');
      continue;
    }
    // --- yol üstündeki yapı ---
    let hitStruct = false;
    for (const s of G.structures) if (!s.dead && Math.hypot(s.x - e.x, s.y - e.y) < 9 + e.r) {
      if (e.atkCd <= 0) { attack(e, s); } hitStruct = true; break;
    }
    if (hitStruct) { e.st = 'struct'; continue; }

    // --- menzilli ---
    if (e.d.ranged) {
      e.fireCd -= dt;
      let tx = null, ty = 0;
      if (dp < e.d.range && losClear(e.x, e.y, p.x, p.y)) { tx = p.x; ty = p.y; }
      else if (db < e.d.range && losClear(e.x, e.y, BASE_X, BASE_Y - 6)) { tx = BASE_X; ty = BASE_Y - 6; }
      if (tx !== null) {
        e.face = tx > e.x ? 1 : -1;
        if (e.fireCd <= 0) {
          e.fireCd = e.d.fireCd;
          const d = Math.hypot(tx - e.x, ty - e.y) || 1;
          G.ebullets.push({ x: e.x + e.face * 4, y: e.y - 2, vx: (tx - e.x) / d * 105, vy: (ty - e.y) / d * 105, life: 1.4, dmg: e.d.dmg });
          sparks(e.x + e.face * 5, e.y - 2, '#9af060', 3, 40);
        }
        e.st = 'ranged';
        // yalnızca hedefe gerçekten yakınken durur; aksi halde ateş ederken yürür (tüneli tıkamasın)
        if (Math.min(dp, db) < 40) continue;
      }
    }

    // --- oyuncuya saldırı (yakında ve görüşte) ---
    if (dp < 60 && losClear(e.x, e.y, p.x, p.y)) {
      e.st = 'chase';
      if (dp < e.r + 7) { if (e.atkCd <= 0) attack(e, 'player'); continue; }
      const d = dp || 1;
      let vx = (p.x - e.x) / d * sp, vy = (p.y - e.y) / d * sp;
      if (e.d.fly) { vx += Math.cos(e.anim * 0.7) * 18; vy += Math.sin(e.anim * 0.9) * 18; }
      e.face = vx >= 0 ? 1 : -1;
      moveE(e, vx * dt, vy * dt);
      continue;
    }

    // --- akış alanını izle ---
    const c = Math.floor(e.x / TILE), r = Math.floor(e.y / TILE);
    let mode = e.d.dig >= 99 ? FIELD.digAll : e.d.dig >= 1 ? FIELD.dig1 : FIELD.walk;
    let digRate = e.d.digRate || 0;
    if (flowAt(mode, c, r) >= FLOW_INF) { mode = FIELD.digAll; digRate = Math.max(digRate, 3); }
    const nx = nextStep(mode, c, r);
    e.st = 'flow';
    if (!nx) {
      e.st = 'tobase';
      // üs hizasında: doğrudan üsse yürü
      const d = db || 1;
      moveE(e, (BASE_X - e.x) / d * sp * dt, (BASE_Y - e.y) / d * sp * dt);
      e.face = BASE_X > e.x ? 1 : -1;
      continue;
    }
    const nt = tileAt(nx.c, nx.r);
    if (TD[nt].solid) {
      e.st = 'dig';
      // önündeki bloğu kaz / barikatı döv
      e.face = nx.c > c ? 1 : nx.c < c ? -1 : e.face;
      if (nt === T.BARRICADE) { if (e.atkCd <= 0) { e.atkCd = 1; e.lunge = 1; hurtBarricade(nx.c, nx.r, e.d.dmg); } }
      else {
        if (damageTile(nx.c, nx.r, digRate * dt)) breakTile(nx.c, nx.r, false);
        if (Math.random() < dt * 6) debris(nx.c * TILE + 8 - (nx.c - c) * 6, nx.r * TILE + 8 - (nx.r - r) * 6, 'dirt', 1, 0.3);
      }
      // hücre merkezine yaslan
      const cx = c * TILE + 8, cy = r * TILE + 8;
      moveE(e, Math.sign(cx - e.x) * Math.min(Math.abs(cx - e.x), sp * dt), Math.sign(cy - e.y) * Math.min(Math.abs(cy - e.y), sp * dt));
      continue;
    }
    const tx = nx.c * TILE + 8, ty = nx.r * TILE + 8;
    const d = Math.hypot(tx - e.x, ty - e.y) || 1;
    let vx = (tx - e.x) / d * sp, vy = (ty - e.y) / d * sp;
    if (e.d.fly) { vx += Math.cos(e.anim * 0.7) * 10; vy += Math.sin(e.anim * 0.9) * 10; }
    if (Math.abs(vx) > 1) e.face = vx > 0 ? 1 : -1;
    moveE(e, vx * dt, vy * dt);
  }

  // ayrışma: yüzeyde üst üste binmesinler. Yeraltında uygulanmaz: dar tünelde kilitlenme yaratır.
  const es = G.enemies;
  const sepY = GROUND_Y + 8;
  for (let i = 0; i < es.length; i++) {
    const a = es[i]; if (a.dead || a.emergeT > 0 || a.y > sepY) continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j]; if (b.dead || b.emergeT > 0 || b.y > sepY) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * 0.8, d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2), push = (min - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        if (!a.d.boss) moveE(a, -ux * push, -uy * push);
        if (!b.d.boss) moveE(b, ux * push, uy * push);
      }
    }
  }
  // boss çağırması
  for (const e of es) if (e.d.boss && !e.dead && e.emergeT <= 0) {
    e.summonT -= dt;
    if (e.summonT <= 0) {
      e.summonT = 6;
      for (let k = 0; k < 2; k++) spawnEnemy('rodent', Math.floor(e.x / TILE) * TILE + 8 + (k ? 2 : -2), Math.floor(e.y / TILE) * TILE + 8, G.wave.num).emergeT = 0.4;
      ring(e.x, e.y, '#c24a64', 24); sfx.rumble();
    }
  }
  for (const e of es) if (e.lunge) e.lunge = Math.max(0, e.lunge - dt * 5);
  // ölüleri temizle
  let j = 0;
  for (const e of es) if (!e.dead) es[j++] = e;
  es.length = j;
}

function attack(e, target) {
  e.atkCd = 1; e.lunge = 1;
  if (e.d.boom) { e.hp = 0; killEnemy(e); return; }
  if (target === 'player') damagePlayer(e.d.dmg, e.x, e.y);
  else if (target === 'base') damageBase(e.d.dmg);
  else damageStructure(target, e.d.dmg);
}
