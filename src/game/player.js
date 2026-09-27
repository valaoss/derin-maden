// Oyuncu: hareket, "bloğa it = kaz", toplama, depolama, hasar/ölüm.
import { TILE, GROUND_Y, GROUND_ROW, PLAYER_MIN_Y, WORLD_W, BASE_X, BASE_Y, stratumOfRow, depthOfY } from '../config.js';
import { T, TD, isMineable } from '../data/tiles.js';
import { PLAYER, UPGRADES, PERKS, RES_KEYS } from '../data/balance.js';
import { RES_COL } from '../data/palette.js';
import { G, App } from './state.js';
import { tileAt, solidAt, setTile, damageTile, matOf } from '../world/map.js';
import { readMove } from '../input/input.js';
import { hasPerk, bagCount, recompute, unlockSchematic } from './run.js';
import { spawnGas } from './hazards.js';
import { debris, dust, sparks, shake, kick, hitstop, flashLight, ring, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';
import { clamp } from '../core/util.js';

const HW = PLAYER.hitW / 2, HH = PLAYER.hitH / 2;

function blockedAt(x, y) {
  const x0 = Math.floor((x - HW) / TILE), x1 = Math.floor((x + HW - 0.01) / TILE);
  const y0 = Math.floor((y - HH) / TILE), y1 = Math.floor((y + HH - 0.01) / TILE);
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
    const t = tileAt(c, r);
    // barikatlar düşmanı durdurur, oyuncu içinden geçer
    if (TD[t].solid && t !== T.BARRICADE) return true;
  }
  return y - HH < PLAYER_MIN_Y - HH;
}

// eksen bazlı hareket + köşe yumuşatma (tünel ağzına hafif hizalama)
function moveAxis(p, mx, my) {
  if (!mx && !my) return true;
  const nx = p.x + mx, ny = p.y + my;
  if (!blockedAt(nx, ny)) { p.x = nx; p.y = ny; return true; }
  // köşe yardımı: dik eksende en yakın serbest merkeze kay
  if (mx) {
    const rowC = Math.floor(p.y / TILE) * TILE + TILE / 2;
    for (const cy of [rowC, rowC - TILE, rowC + TILE]) {
      const off = cy - p.y;
      if (Math.abs(off) < 7 && !blockedAt(nx, cy)) { p.y += clamp(off, -Math.abs(mx), Math.abs(mx)); return false; }
    }
  } else {
    const colC = Math.floor(p.x / TILE) * TILE + TILE / 2;
    for (const cx of [colC, colC - TILE, colC + TILE]) {
      const off = cx - p.x;
      if (Math.abs(off) < 7 && !blockedAt(cx, ny)) { p.x += clamp(off, -Math.abs(my), Math.abs(my)); return false; }
    }
  }
  return false;
}

export function playerSpeed() {
  return PLAYER.speed * (hasPerk('hafifBot') ? 1.2 : 1) * (G.player.carrying ? 0.85 : 1);
}

export function updatePlayer(dt) {
  const p = G.player;
  p.px = p.x; p.py = p.y;
  if (p.iframes > 0) p.iframes -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.gasT > 0) p.gasT -= dt;
  if (p.shockCd > 0) p.shockCd -= dt;
  if (p.digAnim > 0) p.digAnim = Math.max(0, p.digAnim - dt * 6);
  if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 5);
  if (p.dead) {
    p.respawnT -= dt;
    if (p.respawnT <= 0) respawn();
    return;
  }
  const mv = readMove();
  const sp = playerSpeed();
  p.moving = mv.mag > 0.05;
  if (p.moving) {
    p.dx = mv.x; p.dy = mv.y;
    if (Math.abs(mv.x) > 0.25) p.face = mv.x > 0 ? 1 : -1;
    p.walkT += dt * (4 + 6 * mv.mag);
  }
  p.up = p.moving && mv.y < -0.5;

  // ---- kazı hedefi ----
  let target = null;
  if (mv.mag > 0.3) {
    const vert = Math.abs(mv.y) >= Math.abs(mv.x) * 0.85;
    const dx = vert ? 0 : Math.sign(mv.x), dy = vert ? Math.sign(mv.y) : 0;
    const probeX = p.x + dx * (HW + 2), probeY = p.y + dy * (HH + 2);
    const c = Math.floor(probeX / TILE), r = Math.floor(probeY / TILE);
    const tt = tileAt(c, r);
    if (isMineable(tt) && blockedAt(p.x + dx * 2, p.y + dy * 2)) {
      target = { c, r, dx, dy };
    } else if (TD[tt].unbreakable && blockedAt(p.x + dx * 2, p.y + dy * 2) && r >= GROUND_ROW) {
      // kırılmaz: kısa "tınn" + kıvılcım, kazmanın işlemediği hissedilsin
      p.clinkT = (p.clinkT || 0) - dt;
      if (p.clinkT <= 0) {
        p.clinkT = 0.45; p.digAnim = 1; p.digDir = [dx, dy];
        sfx.dig('bedrock'); sparks(p.x + dx * 8, p.y + dy * 8, '#dfe6f0', 4, 60); kick(dx, dy, 0.6);
      }
    }
  }
  if (target) {
    // hedef bloğun eksenine hizalan: tüneller temiz açılır
    if (target.dx === 0) p.x += clamp(target.c * TILE + 8 - p.x, -70 * dt, 70 * dt);
    else p.y += clamp(target.r * TILE + 8 - p.y, -70 * dt, 70 * dt);
    const same = p.dig && p.dig.c === target.c && p.dig.r === target.r;
    if (!same) { p.dig = target; p.digT = Math.min(p.digT, 0.07); }
    p.digDir = [target.dx, target.dy];
    if (target.dx) p.face = target.dx;
    p.digT -= dt;
    if (p.digT <= 0) { digHit(target); p.digT = UPGRADES.drill.interval[G.lvl.drill]; }
  } else {
    p.dig = null;
    p.digT = Math.max(p.digT - dt, 0);
  }

  let vx = mv.x * sp * mv.mag, vy = mv.y * sp * mv.mag;
  // kazarken kazı ekseninde itme yok (köşe yardımı bizi yan tünele kaydırmasın)
  if (target) { if (target.dx) { vx = 0; vy *= 0.3; } else { vy = 0; vx *= 0.3; } }
  moveAxis(p, vx * dt, 0);
  moveAxis(p, 0, vy * dt);
  p.x = clamp(p.x, TILE * 2 + HW, WORLD_W - TILE * 2 - HW);

  // ---- derinlik / katman ----
  const row = Math.floor(p.y / TILE);
  const depth = depthOfY(p.y);
  if (depth > G.stats.maxDepth) G.stats.maxDepth = depth;
  const st = stratumOfRow(row);
  if (st > G.maxStratum) { G.maxStratum = st; emit('stratum', st); sfx.stratum(); }

  // ---- yüzey: depola, iyileş ----
  const onSurface = p.y < GROUND_Y;
  if (onSurface) {
    if (bagCount() > 0) startDeposit();
    if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + PLAYER.surfaceRegen * dt);
    if (p.carrying) { emit('victory'); return; }
  }
  // ---- satchel geri alma ----
  const s = G.satchel;
  if (s && Math.hypot(s.x - p.x, s.y - p.y) < 12) {
    for (const k of RES_KEYS) G.bag[k] += s.bag[k];
    if (s.heart) { p.carrying = true; emit('heart'); }
    G.satchel = null; sfx.chest(); emit('toast', { text: 'Çantanı geri aldın', icon: 'bag' });
  }
}

function digHit(t) {
  const p = G.player;
  const tile = tileAt(t.c, t.r), mat = matOf(t.c, t.r), d = TD[tile];
  const dmg = UPGRADES.drill.dmg[G.lvl.drill];
  p.digAnim = 1;
  p.squash = 0.6;
  const hx = t.c * TILE + 8 - t.dx * 7, hy = t.r * TILE + 8 - t.dy * 7;
  sfx.dig(mat);
  debris(hx, hy, mat, 3, 0.6);
  kick(t.dx, t.dy, 1.2);
  if (hasPerk('kazmaDarbesi')) {
    for (const e of G.enemies) if (Math.hypot(e.x - (p.x + t.dx * 12), e.y - (p.y + t.dy * 12)) < 14 + e.r) damageEnemyExt(e, 18, t.dx, t.dy);
  }
  if (damageTile(t.c, t.r, dmg)) {
    breakTile(t.c, t.r, true, t.dx, t.dy);
    if (hasPerk('zincir') && Math.random() < 0.35) {
      const nc = t.c + t.dx, nr = t.r + t.dy, nt = tileAt(nc, nr);
      if (isMineable(nt) && !TD[nt].chest && !TD[nt].heart) breakTile(nc, nr, true, t.dx, t.dy);
    }
  } else if (d.hp >= 6) {
    haptic(4);
  }
}

let damageEnemyExt = () => {};
export function bindEnemyDamage(fn) { damageEnemyExt = fn; }

export function breakTile(c, r, byPlayer, dx = 0, dy = 0) {
  const t = tileAt(c, r), d = TD[t], mat = matOf(c, r);
  setTile(c, r, T.AIR);
  const x = c * TILE + 8, y = r * TILE + 8;
  if (d.gas) spawnGas(x, y);
  if (!byPlayer) { debris(x, y, mat, 5, 0.7); return; }
  G.stats.dug++;
  debris(x, y, mat, 9);
  dust(x, y, 3);
  sfx.breakBlock(mat);
  haptic(d.hp >= 6 ? 14 : 7);
  if (d.hp >= 6 || d.ore) { hitstop(0.035); shake(0.12); } else shake(d.hp >= 3 ? 0.07 : 0.04);
  if (d.ore) {
    sfx.oreReveal();
    const n = d.amt + (hasPerk('damar') ? 1 : 0);
    for (let i = 0; i < n; i++) spawnOrb(x, y, d.ore);
    sparks(x, y, RES_COL[d.ore], 6, 70);
    flashLight(x, y, 3, 0.25);
  }
  if (d.chest) {
    G.stats.chests++;
    sfx.chest(); hitstop(0.08); shake(0.2);
    sparks(x, y, '#ffd24a', 14, 110); ring(x, y, '#ffd24a', 22); flashLight(x, y, 5, 0.5);
    const sc = unlockSchematic();
    if (sc) emit('schematic', sc);
    emit('perkOffer');
  }
  if (d.heart) {
    G.player.carrying = true;
    hitstop(0.12); shake(0.45); sfx.chest();
    sparks(x, y, '#ff3a6a', 24, 140); ring(x, y, '#ff8aa8', 30); flashLight(x, y, 8, 0.8);
    emit('heart');
  }
}

// ---------- cevher küreleri ----------
export function spawnOrb(x, y, res, fromEnemy = false) {
  const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, s = 50 + Math.random() * 50;
  G.orbs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, res, delay: 0.28 + Math.random() * 0.15, t: 0, bounce: 0, fromEnemy });
}
export function updateOrbs(dt) {
  const p = G.player;
  const pick = hasPerk('miknatis') ? 120 : 44;
  if (G.combo.t > 0) { G.combo.t -= dt; if (G.combo.t <= 0) G.combo.n = 0; }
  if (G.bagFullT > 0) G.bagFullT -= dt;
  const full = bagCount() >= G.bagCap;
  let j = 0;
  for (const o of G.orbs) {
    o.t += dt;
    if (o.delay > 0) {
      o.delay -= dt; o.vy += 260 * dt; o.vx *= 0.97;
      const nx = o.x + o.vx * dt, ny = o.y + o.vy * dt;
      if (solidAt(Math.floor(nx / TILE), Math.floor(o.y / TILE))) o.vx *= -0.4; else o.x = nx;
      if (solidAt(Math.floor(o.x / TILE), Math.floor(ny / TILE))) o.vy *= -0.4; else o.y = ny;
      G.orbs[j++] = o; continue;
    }
    const dx = p.x - o.x, dy = p.y - 2 - o.y, d = Math.hypot(dx, dy) || 1;
    if (!p.dead && d < pick && !full) {
      const sp = Math.min(260, 90 + (pick - d) * 6 + o.t * 60);
      o.x += dx / d * sp * dt; o.y += dy / d * sp * dt;
      if (d < 7) {
        G.bag[o.res]++;
        G.combo.n++; G.combo.t = 0.9;
        sfx.pickup(G.combo.n - 1);
        emit('bagPop', o.res);
        particle(p.x, p.y - 4, 0, -20, 0.25, RES_COL[o.res], 1, 1, 0);
        if (G.tutorial) emit('tut', 'pickup');
        continue;
      }
    } else if (!p.dead && d < pick && full) {
      if (G.bagFullT <= 0) { G.bagFullT = 1.6; sfx.bagFull(); emit('bagFull'); }
      o.x += Math.sin(o.t * 3) * 3 * dt;
    } else {
      o.y += Math.sin(o.t * 2.4) * 4 * dt; // hafif süzülme
    }
    G.orbs[j++] = o;
  }
  G.orbs.length = j;
}

// ---------- depolama ----------
function startDeposit() {
  const p = G.player;
  let n = 0;
  for (const k of RES_KEYS) {
    for (let i = 0; i < G.bag[k]; i++) G.deposit.push({ x: p.x, y: p.y - 4, res: k, t: -i * 0.035 - n * 0.02, sx: p.x, sy: p.y - 4 });
    n += G.bag[k]; G.bag[k] = 0;
  }
  if (n) { sfx.deposit(n); emit('deposit', n); if (G.tutorial) emit('tut', 'deposit'); }
}
export function updateDeposit(dt) {
  const q = G.deposit; let j = 0;
  for (const o of q) {
    o.t += dt;
    if (o.t < 0) { q[j++] = o; continue; }
    const k = Math.min(1, o.t / 0.45);
    const e = k * k;
    o.x = o.sx + (BASE_X - o.sx) * e;
    o.y = o.sy + (BASE_Y - 8 - o.sy) * e - Math.sin(k * Math.PI) * 18;
    if (k >= 1) {
      G.store[o.res]++; G.collected[o.res]++;
      sfx.tick(); emit('storePop', o.res);
      continue;
    }
    q[j++] = o;
  }
  q.length = j;
}

// ---------- hasar / ölüm ----------
export function damagePlayer(amount, sx, sy) {
  const p = G.player;
  if (p.dead || p.iframes > 0) return;
  p.hp -= amount;
  p.iframes = PLAYER.iframes; p.hurtT = 0.2;
  const d = Math.hypot(p.x - sx, p.y - sy) || 1;
  moveAxis(p, (p.x - sx) / d * 5, 0); moveAxis(p, 0, (p.y - sy) / d * 5);
  sfx.playerHurt(); haptic(30); shake(0.28); hitstop(0.04);
  emit('hurt', amount);
  if (hasPerk('sokDalgasi') && p.shockCd <= 0) {
    p.shockCd = 4; ring(p.x, p.y, '#ffe79a', 34); flashLight(p.x, p.y, 4, 0.2);
    for (const e of G.enemies) {
      const ed = Math.hypot(e.x - p.x, e.y - p.y);
      if (ed < 40) damageEnemyExt(e, 20, (e.x - p.x) / (ed || 1), (e.y - p.y) / (ed || 1), 3);
    }
  }
  if (p.hp <= 0) die();
}

// gaz: iframe/savrulma yok, küçük düzenli hasar
let poisonHurtT = 0;
export function poisonPlayer(amount) {
  const p = G.player;
  if (p.dead) return;
  p.hp -= amount; p.gasT = 0.35;
  sfx.cough();
  if (G.time - poisonHurtT > 1.2) { poisonHurtT = G.time; emit('hurt', amount); }
  if (p.hp <= 0) die();
}

function die() {
  const p = G.player;
  p.hp = 0; p.dead = true; p.respawnT = PLAYER.respawn;
  const has = bagCount() > 0 || p.carrying;
  if (has) {
    G.satchel = { x: p.x, y: p.y, bag: Object.assign({}, G.bag), heart: p.carrying };
    for (const k of RES_KEYS) G.bag[k] = 0;
  }
  p.carrying = false; p.recallT = 0;
  sparks(p.x, p.y, '#74efcf', 18, 120); ring(p.x, p.y, '#74efcf', 26);
  shake(0.5); sfx.enemyDie(true); haptic(80);
  emit('playerDown', has);
}
function respawn() {
  const p = G.player;
  p.dead = false; p.hp = p.maxHp; p.iframes = 1.2;
  p.x = BASE_X + 40; p.y = GROUND_ROW * TILE - 10; p.px = p.x; p.py = p.y;
  ring(p.x, p.y, '#74efcf', 20); sparks(p.x, p.y, '#74efcf', 10, 60);
  G.cam.snap = true;
  emit('respawn');
}

export function playerMinY() { return PLAYER_MIN_Y; }
export { recompute };
