// Otomatik nişan alan omuz blaster'ı, mermiler, taretler, onarım istasyonları.
import { TILE, BASE_X, BASE_Y, GROUND_Y } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { UPGRADES, BUILDS, BASE } from '../data/balance.js';
import { G } from './state.js';
import { tileAt } from '../world/map.js';
import { damageEnemy, losClear, damageStructure, damageBase } from './enemies.js';
import { damagePlayer } from './player.js';
import { hasPerk } from './run.js';
import { sparks, flashLight, particle, ring, shake, debris } from './fx.js';
import { igniteGas } from './hazards.js';
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
  return G.bullets[G.bullets.length - 1];
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
        damageEnemy(e, b.dmg, b.vx / s, b.vy / s, b.from === 'p' ? 1 : 0.6);
        if (b.from === 'f') { e.slowT = BUILDS.frost.slowT; sparks(b.x, b.y, '#bff4ff', 5, 50); }
        else sparks(b.x, b.y, '#fff4c2', 3, 60);
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

// havan: menzildeki, yüzeye yakın en tehlikeli (üsse en yakın) düşman
function mortarTarget(s, b) {
  let best = null, bd = 1e9;
  for (const e of G.enemies) {
    if (e.dead || e.emergeT > 0.2 || e.y > GROUND_Y + 80) continue;
    const d = Math.hypot(e.x - s.x, e.y - s.y);
    if (d < b.minRange || d > b.range) continue;
    const db = Math.hypot(e.x - BASE_X, e.y - BASE_Y);
    if (db < bd) { bd = db; best = e; }
  }
  return best;
}

export function updateShells(dt) {
  const ss = G.shells; let j = 0;
  for (const sh of ss) {
    sh.t += dt;
    if (sh.t < sh.T) { ss[j++] = sh; continue; }
    const b = BUILDS.mortar;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - sh.tx, e.y - sh.ty);
      if (d < b.splash + e.r) damageEnemy(e, b.dmg * (d < 10 ? 1 : 0.7), (e.x - sh.tx) / (d || 1), (e.y - sh.ty) / (d || 1), 1.5);
    }
    sfx.mortarHit(); shake(0.12);
    ring(sh.tx, sh.ty, '#ffb050', b.splash); sparks(sh.tx, sh.ty, '#ffd48a', 12, 110); debris(sh.tx, sh.ty, 'dirt', 5);
    flashLight(sh.tx, sh.ty, 4, 0.25);
    igniteGas(sh.tx, sh.ty, b.splash);
  }
  ss.length = j;
}

export function updateStructures(dt) {
  const p = G.player;
  if (G.base.hp > 0) updateBaseGun(dt);
  for (const s of G.structures) {
    if (s.buildT > 0) s.buildT -= dt;
    if (s.hurtT > 0) s.hurtT -= dt;
    if (s.recoil > 0) s.recoil -= dt * 6;
    const b = BUILDS[s.type];
    const rate = hasPerk('taretAsiri') ? 1.5 : 1;
    s.cd -= dt;
    if (s.type === 'turret' || s.type === 'frost') {
      const tgt = nearestTarget(s.x, s.y - 4, b.range);
      if (tgt) {
        const ang = Math.atan2(tgt.y - (s.y - 4), tgt.x - s.x);
        s.aim += Math.atan2(Math.sin(ang - s.aim), Math.cos(ang - s.aim)) * Math.min(1, dt * 14);
        if (s.cd <= 0 && s.buildT <= 0) {
          s.cd = b.cd / rate;
          fire(s.x + Math.cos(s.aim) * 7, s.y - 4 + Math.sin(s.aim) * 7, s.aim, s.type === 'frost' ? 200 : 230, b.dmg, s.type === 'frost' ? 'f' : 't', 0);
          s.recoil = 1; flashLight(s.x, s.y, 2, 0.06);
          if (s.type === 'frost') sfx.frost(); else sfx.turret();
        }
      }
    } else if (s.type === 'flame') {
      const tgt = nearestTarget(s.x, s.y - 4, b.range);
      s.firing = !!tgt && s.buildT <= 0;
      if (tgt) {
        const ang = Math.atan2(tgt.y - (s.y - 4), tgt.x - s.x);
        s.aim += Math.atan2(Math.sin(ang - s.aim), Math.cos(ang - s.aim)) * Math.min(1, dt * 10);
      }
      if (s.firing) {
        if (Math.random() < dt * 40) {
          const a = s.aim + (Math.random() - 0.5) * 0.5, sp = 90 + Math.random() * 60;
          particle(s.x + Math.cos(s.aim) * 7, s.y - 5 + Math.sin(s.aim) * 7, Math.cos(a) * sp, Math.sin(a) * sp, 0.28, Math.random() < 0.4 ? '#ffe79a' : Math.random() < 0.6 ? '#ff9a4a' : '#e0502a', 2, 1, -40);
        }
        if (s.cd <= 0) {
          s.cd = 0.1 / rate;
          for (const e of G.enemies) {
            if (e.dead || e.emergeT > 0.2) continue;
            const d = Math.hypot(e.x - s.x, e.y - (s.y - 4));
            if (d > b.range + e.r) continue;
            const ea = Math.atan2(e.y - (s.y - 4), e.x - s.x);
            if (Math.abs(Math.atan2(Math.sin(ea - s.aim), Math.cos(ea - s.aim))) > 0.55 || !losClear(s.x, s.y - 4, e.x, e.y, true)) continue;
            damageEnemy(e, b.dps * 0.1, Math.cos(ea), Math.sin(ea), 0.1, true);
          }
          sfx.flame(); flashLight(s.x + Math.cos(s.aim) * 14, s.y - 4 + Math.sin(s.aim) * 14, 3, 0.1);
        }
      }
    } else if (s.type === 'mortar') {
      const tgt = mortarTarget(s, b);
      if (tgt) {
        const ang = Math.atan2(tgt.y - s.y, tgt.x - s.x);
        s.aim = ang;
        if (s.cd <= 0 && s.buildT <= 0) {
          s.cd = b.cd / rate; s.recoil = 1;
          const d = Math.hypot(tgt.x - s.x, tgt.y - s.y);
          // hedefin yürüdüğü yöne kabaca öncül
          const lead = 0.55 + d / 400;
          const tx = tgt.x + (tgt.x - tgt.px) * 60 * lead, ty = tgt.y + (tgt.y - tgt.py) * 60 * lead;
          G.shells.push({ sx: s.x, sy: s.y - 8, tx, ty, t: 0, T: lead });
          sfx.mortar(); sparks(s.x, s.y - 10, '#ffd48a', 5, 60); flashLight(s.x, s.y - 8, 3, 0.1);
        }
      }
    } else if (s.type === 'heal') {
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
