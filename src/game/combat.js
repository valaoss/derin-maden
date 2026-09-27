// Otomatik nişan alan omuz blaster'ı, mermiler, taretler, onarım istasyonları.
import { TILE, BASE_X, BASE_Y } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { UPGRADES, BUILDS, BASE } from '../data/balance.js';
import { G } from './state.js';
import { tileAt } from '../world/map.js';
import { damageEnemy, losClear, damageStructure, damageBase } from './enemies.js';
import { damagePlayer } from './player.js';
import { hasPerk } from './run.js';
import { sparks, flashLight, particle } from './fx.js';
import { sfx } from '../audio/audio.js';

function nearestTarget(x, y, range) {
  let best = null, bd = range * range;
  for (const e of G.enemies) {
    if (e.dead || e.emergeT > 0.2) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd && losClear(x, y, e.x, e.y, true)) { bd = d; best = e; }
  }
  return best;
}

export function shoulderPos(p) { return { x: p.x - p.face * 3, y: p.y - 5 }; }

export function updatePlayerGun(dt) {
  const p = G.player;
  if (p.dead) return;
  p.fireCd -= dt;
  if (p.aimT > 0) p.aimT -= dt;
  const lv = G.lvl.blaster, range = UPGRADES.blaster.range[lv];
  const sp = shoulderPos(p);
  const tgt = nearestTarget(sp.x, sp.y, range);
  if (!tgt) return;
  const ang = Math.atan2(tgt.y - sp.y, tgt.x - sp.x);
  p.aim = ang; p.aimT = 0.6;
  if (p.fireCd > 0) return;
  p.fireCd = UPGRADES.blaster.cd[lv];
  const dmg = UPGRADES.blaster.dmg[lv];
  const shots = hasPerk('ciftNamlu') ? [-0.09, 0.09] : [0];
  for (const o of shots) fire(sp.x + Math.cos(ang) * 6, sp.y + Math.sin(ang) * 6, ang + o, 250, dmg, 'p', hasPerk('delici') ? 1 : 0);
  p.recoil = 1;
  sparks(sp.x + Math.cos(ang) * 7, sp.y + Math.sin(ang) * 7, '#ffe79a', 2, 40);
  flashLight(sp.x, sp.y, 2.2, 0.06);
  sfx.shoot();
}

function fire(x, y, ang, speed, dmg, from, pierce) {
  G.bullets.push({ x, y, px: x, py: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 0.7, dmg, from, pierce, hit: null });
}

export function updateBullets(dt) {
  const bs = G.bullets; let j = 0;
  for (const b of bs) {
    b.px = b.x; b.py = b.y; b.life -= dt;
    // iki alt adım: köşe kıyılarından sızmasın / takılmasın (LOS kontrolüyle aynı hassasiyet)
    let wall = false;
    for (let k = 0; k < 2 && !wall; k++) {
      b.x += b.vx * dt * 0.5; b.y += b.vy * dt * 0.5;
      const t = tileAt(Math.floor(b.x / TILE), Math.floor(b.y / TILE));
      if (TD[t].solid && t !== T.BARRICADE) wall = true;
    }
    if (wall) { sparks(b.x - b.vx * dt * 0.5, b.y - b.vy * dt * 0.5, '#ffd48a', 3, 50); continue; }
    let dead = b.life <= 0;
    if (!dead) for (const e of G.enemies) {
      if (e.dead || e.emergeT > 0.3 || e === b.hit) continue;
      if (Math.abs(e.x - b.x) < e.r + 3 && Math.abs(e.y - b.y) < e.r + 3) {
        const s = Math.hypot(b.vx, b.vy) || 1;
        damageEnemy(e, b.dmg, b.vx / s, b.vy / s, b.from === 't' ? 0.6 : 1);
        sparks(b.x, b.y, '#fff4c2', 3, 60);
        if (b.pierce > 0) { b.pierce--; b.hit = e; } else dead = true;
        break;
      }
    }
    if (!dead) bs[j++] = b;
  }
  bs.length = j;

  const eb = G.ebullets; j = 0;
  const p = G.player;
  for (const b of eb) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (Math.random() < 0.5) particle(b.x, b.y, 0, 0, 0.18, '#9af060', 1, 1, 0);
    if (TD[tileAt(Math.floor(b.x / TILE), Math.floor(b.y / TILE))].solid) { sparks(b.x, b.y, '#9af060', 4, 40); continue; }
    if (!p.dead && Math.abs(b.x - p.x) < 6 && Math.abs(b.y - p.y) < 7) { damagePlayer(b.dmg, b.x, b.y); sparks(b.x, b.y, '#9af060', 5, 50); continue; }
    if (Math.abs(b.x - BASE_X) < 22 && Math.abs(b.y - (BASE_Y - 8)) < 16) {
      damageBase(b.dmg * 0.6); sparks(b.x, b.y, '#9af060', 5, 50); continue;
    }
    let hit = false;
    for (const s of G.structures) if (!s.dead && Math.abs(b.x - s.x) < 7 && Math.abs(b.y - s.y) < 7) { damageStructure(s, b.dmg); hit = true; break; }
    if (hit || b.life <= 0) continue;
    eb[j++] = b;
  }
  eb.length = j;
}

// Üssün kendi hafif topu: ilk dalgaları tek başına karşılar, sonrası için taret/oyuncu gerekir
export const BASE_GUN = { x: BASE_X - 12, y: BASE_Y - 22 };
function updateBaseGun(dt) {
  const b = G.base, g = BASE.gun;
  b.cd = (b.cd || 0) - dt;
  if (b.recoil > 0) b.recoil -= dt * 6;
  const tgt = nearestTarget(BASE_GUN.x, BASE_GUN.y, g.range);
  if (!tgt) return;
  const ang = Math.atan2(tgt.y - BASE_GUN.y, tgt.x - BASE_GUN.x);
  b.aim = (b.aim ?? ang) + Math.atan2(Math.sin(ang - (b.aim ?? ang)), Math.cos(ang - (b.aim ?? ang))) * Math.min(1, dt * 12);
  if (b.cd <= 0) {
    b.cd = g.cd; b.recoil = 1;
    fire(BASE_GUN.x + Math.cos(b.aim) * 6, BASE_GUN.y + Math.sin(b.aim) * 6, b.aim, 220, g.dmg, 't', 0);
    sfx.turret(); flashLight(BASE_GUN.x, BASE_GUN.y, 2, 0.06);
  }
}

export function updateStructures(dt) {
  const p = G.player;
  if (G.base.hp > 0) updateBaseGun(dt);
  for (const s of G.structures) {
    if (s.buildT > 0) s.buildT -= dt;
    if (s.hurtT > 0) s.hurtT -= dt;
    if (s.recoil > 0) s.recoil -= dt * 6;
    if (s.type === 'turret') {
      s.cd -= dt;
      const b = BUILDS.turret;
      const tgt = nearestTarget(s.x, s.y - 4, b.range);
      if (tgt) {
        const ang = Math.atan2(tgt.y - (s.y - 4), tgt.x - s.x);
        s.aim += Math.atan2(Math.sin(ang - s.aim), Math.cos(ang - s.aim)) * Math.min(1, dt * 14);
        if (s.cd <= 0 && s.buildT <= 0) {
          s.cd = b.cd / (hasPerk('taretAsiri') ? 1.5 : 1);
          fire(s.x + Math.cos(s.aim) * 7, s.y - 4 + Math.sin(s.aim) * 7, s.aim, 230, b.dmg, 't', 0);
          s.recoil = 1; sfx.turret(); flashLight(s.x, s.y, 2, 0.06);
        }
      }
    } else if (s.type === 'heal') {
      const b = BUILDS.heal;
      s.pulse = (s.pulse || 0) + dt;
      if (Math.hypot(BASE_X - s.x, BASE_Y - s.y) < b.range + 20 && G.base.hp > 0) G.base.hp = Math.min(G.base.maxHp, G.base.hp + b.rate * dt);
      if (!p.dead && Math.hypot(p.x - s.x, p.y - s.y) < b.range) p.hp = Math.min(p.maxHp, p.hp + b.rate * 1.6 * dt);
      for (const o of G.structures) if (o !== s && Math.hypot(o.x - s.x, o.y - s.y) < b.range) o.hp = Math.min(o.maxHp, o.hp + b.rate * dt);
    }
  }
  let j = 0;
  for (const s of G.structures) if (!s.dead) G.structures[j++] = s;
  G.structures.length = j;
}
