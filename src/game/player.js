// Oyuncular: hareket, "bloğa it = kaz", toplama, depolama, hasar/ölüm.
// Her oyuncu kendi girdisini (p.inp) kullanır; tek ve çok oyunculu aynı yoldan geçer.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y, GROUND_ROW, PLAYER_MIN_Y, WORLD_W, BASE_X, BASE_Y, stratumOfRow, depthOfY } from '../config.js';
import { T, TD, isMineable } from '../data/tiles.js';
import { PLAYER, UPGRADES, PERKS, RES_KEYS, PICK_TIERS } from '../data/balance.js';
import { RES_COL } from '../data/palette.js';
import { G, App } from './state.js';
import { tileAt, solidAt, setTile, damageTile, matOf } from '../world/map.js';
import { hasPerk, bagCount, recompute, unlockSchematic, hear, isLocal } from './run.js';
import { perkChoices } from './economy.js';
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

export function playerSpeed(p) {
  return PLAYER.speed * (hasPerk('hafifBot') ? 1.2 : 1) * (p.carrying ? 0.85 : 1) * (p.fearT > 0 ? 0.6 : 1);
}

export function alivePlayers() { return G.players.filter(p => !p.dead); }
// en yakın canlı oyuncu (yoksa null)
export function nearestPlayer(x, y, maxD = Infinity) {
  let best = null, bd = maxD;
  for (const p of G.players) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
export function anyCarrying() { return G.players.some(p => p.carrying); }

export function updatePlayer(dt) {
  for (const p of G.players) updateOne(p, dt);
  // partnerler birbirinden çok uzaksa dalga saati hızlanır (çok oyunculu baskısı)
  if (G.mp && G.players.length > 1 && G.wave.phase === 'calm') {
    const [a, b] = G.players;
    if (!a.dead && !b.dead && Math.abs(a.y - b.y) > 20 * TILE) G.wave.t -= dt * 0.5;
  }
}

function updateOne(p, dt) {
  p.px = p.x; p.py = p.y;
  if (p.iframes > 0) p.iframes -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.gasT > 0) p.gasT -= dt;
  if (p.shockCd > 0) p.shockCd -= dt;
  if (p.blindT > 0) p.blindT -= dt;
  if (p.fearT > 0) p.fearT -= dt;
  if (p.landT > 0) p.landT -= dt;
  if (p.hitTile && (p.hitTile.t -= dt) <= 0) p.hitTile = null;
  if (p.digAnim > 0) p.digAnim = Math.max(0, p.digAnim - dt * 6);
  if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 5);
  if (p.dead) {
    p.respawnT -= dt;
    if (p.respawnT <= 0) respawn(p);
    return;
  }
  const mv = p.inp;
  const sp = playerSpeed(p);
  p.moving = mv.mag > 0.05;
  if (p.moving) {
    p.dx = mv.x; p.dy = mv.y;
    if (Math.abs(mv.x) > 0.25) p.face = mv.x > 0 ? 1 : -1;
    p.walkT += dt * (4 + 6 * mv.mag);
  }
  const wasUp = p.up;
  p.up = p.moving && mv.y < -0.5;
  p.upT = p.up ? p.upT + dt : 0;
  // iniş: yukarı hareket bitti ve altımız dolu -> ezilme + toz
  const grounded = solidAt(Math.floor(p.x / TILE), Math.floor((p.y + HH + 1) / TILE));
  if (wasUp && !p.up && grounded) { p.landT = 0.18; dust(p.x, p.y + 6, 2); if (hear(p)) sfx.land(); }
  if (!grounded && !p.up && p.airT !== undefined) p.airT += dt; else p.airT = 0;

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
        p.clinkT = 0.45; p.digAnim = 1; p.digDir = [dx, dy]; p.swingT = 0;
        if (hear(p)) sfx.dig(TD[tt].blastable ? 'metal' : 'bedrock');
        sparks(p.x + dx * 8, p.y + dy * 8, '#dfe6f0', 4, 60); if (isLocal(p)) kick(dx, dy, 0.6);
        if (TD[tt].blastable && isLocal(p)) emit('toast', { text: 'Kilitli kaya: yalnızca dinamit açar', icon: 'dynamite', bad: true });
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
    p.digInt = UPGRADES.drill.interval[G.lvl.drill];
    if (p.digT <= 0) { digHit(p, target); p.digT = p.digInt; }
  } else {
    p.dig = null;
    p.digT = Math.max(p.digT - dt, 0);
  }

  let vx = mv.x * sp * mv.mag, vy = mv.y * sp * mv.mag;
  // kazarken kazı ekseninde itme yok (köşe yardımı bizi yan tünele kaydırmasın)
  if (target) { if (target.dx) { vx = 0; vy *= 0.3; } else { vy = 0; vx *= 0.3; } }
  // çekim (Çekici böcek): dış kuvvet
  if (p.pullX || p.pullY) { vx += p.pullX; vy += p.pullY; p.pullX *= Math.exp(-8 * dt); p.pullY *= Math.exp(-8 * dt); if (Math.abs(p.pullX) + Math.abs(p.pullY) < 1) p.pullX = p.pullY = 0; }
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
    if (bagCount(p) > 0) startDeposit(p);
    if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + PLAYER.surfaceRegen * dt);
    if (p.carrying) { emit('victory'); return; }
  }
  // ---- kese geri alma (herhangi bir oyuncu alabilir) ----
  for (let i = 0; i < G.satchels.length; i++) {
    const s = G.satchels[i];
    if (Math.hypot(s.x - p.x, s.y - p.y) < 12) {
      for (const k of RES_KEYS) p.bag[k] += s.bag[k];
      if (s.heart) { p.carrying = true; emit('heart'); }
      G.satchels.splice(i, 1); i--;
      if (hear(p)) sfx.chest();
      if (isLocal(p)) emit('toast', { text: 'Çantanı geri aldın', icon: 'bag' });
    }
  }
}

function digHit(p, t) {
  const tile = tileAt(t.c, t.r), mat = matOf(t.c, t.r), d = TD[tile];
  const dmg = UPGRADES.drill.dmg[G.lvl.drill];
  p.digAnim = 1;
  p.squash = 0.6;
  p.hitTile = { c: t.c, r: t.r, t: 0.12 };
  const hx = t.c * TILE + 8 - t.dx * 7, hy = t.r * TILE + 8 - t.dy * 7;
  if (hear(p)) sfx.dig(mat, G.lvl.drill);
  debris(hx, hy, mat, 3, 0.6);
  // kazma ucu kıvılcımı: kademe rengi
  const tier = PICK_TIERS[Math.min(PICK_TIERS.length - 1, G.lvl.drill)];
  sparks(hx, hy, tier.spark, d.hp >= 6 ? 3 : 1, 55);
  if (isLocal(p)) kick(t.dx, t.dy, 1.2);
  if (hasPerk('kazmaDarbesi')) {
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - (p.x + t.dx * 12), e.y - (p.y + t.dy * 12)) < 14 + e.r) damageEnemyExt(e, 18, t.dx, t.dy);
  }
  if (damageTile(t.c, t.r, dmg)) {
    breakTile(t.c, t.r, p, t.dx, t.dy);
    if (hasPerk('zincir') && rnd() < 0.35) {
      const nc = t.c + t.dx, nr = t.r + t.dy, nt = tileAt(nc, nr);
      if (isMineable(nt) && !TD[nt].chest && !TD[nt].heart) breakTile(nc, nr, p, t.dx, t.dy);
    }
  } else if (d.hp >= 6) {
    if (isLocal(p)) haptic(4);
  }
}

let damageEnemyExt = () => {};
export function bindEnemyDamage(fn) { damageEnemyExt = fn; }

// byPlayer: kıran oyuncu (null: düşman/çevre)
export function breakTile(c, r, byPlayer, dx = 0, dy = 0) {
  const t = tileAt(c, r), d = TD[t], mat = matOf(c, r);
  setTile(c, r, T.AIR);
  const x = c * TILE + 8, y = r * TILE + 8;
  if (d.gas) spawnGas(x, y);
  if (!byPlayer) { debris(x, y, mat, 5, 0.7); return; }
  const p = byPlayer, near = hear(p, x, y), local = isLocal(p);
  G.stats.dug++;
  debris(x, y, mat, 9);
  dust(x, y, 3);
  if (near) sfx.breakBlock(mat);
  if (local) haptic(d.hp >= 6 ? 14 : 7);
  // hitstop simülasyonu durdurur: deterministik kalması için iki tarafta da uygulanır
  if (d.hp >= 6 || d.ore) { hitstop(0.035); if (local) shake(0.12); } else if (local) shake(d.hp >= 3 ? 0.07 : 0.04);
  if (d.ore) {
    if (near) sfx.oreReveal();
    const n = d.amt + (hasPerk('damar') ? 1 : 0);
    for (let i = 0; i < n; i++) spawnOrb(x, y, d.ore);
    sparks(x, y, RES_COL[d.ore], 6, 70);
    flashLight(x, y, 3, 0.25);
  }
  if (d.chest) {
    G.stats.chests++;
    sfx.chest(); hitstop(0.08); if (local) shake(0.2);
    sparks(x, y, '#ffd24a', 14, 110); ring(x, y, '#ffd24a', 22); flashLight(x, y, 5, 0.5);
    const sc = unlockSchematic();
    if (sc) emit('schematic', sc);
    const keys = perkChoices();
    if (keys.length) { G.perkOffer = { pi: p.i, keys }; emit('perkOffer', p.i); }
    else if (local) emit('toast', { text: 'Sandık boş çıktı', icon: 'chest' });
  }
  if (d.heart) {
    p.carrying = true;
    hitstop(0.12); if (local) shake(0.45); sfx.chest();
    sparks(x, y, '#ff3a6a', 24, 140); ring(x, y, '#ff8aa8', 30); flashLight(x, y, 8, 0.8);
    emit('heart');
  }
}

// ---------- cevher küreleri ----------
export function spawnOrb(x, y, res, fromEnemy = false) {
  const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2, s = 50 + rnd() * 50;
  G.orbs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, res, delay: 0.28 + rnd() * 0.15, t: 0, bounce: 0, fromEnemy });
}
export function updateOrbs(dt) {
  const pick = hasPerk('miknatis') ? 120 : 44;
  if (G.combo.t > 0) { G.combo.t -= dt; if (G.combo.t <= 0) G.combo.n = 0; }
  if (G.bagFullT > 0) G.bagFullT -= dt;
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
    // en yakın, çantası dolu olmayan canlı oyuncuya çekilir
    let p = null, d = pick, fullNear = null;
    for (const q of G.players) {
      if (q.dead) continue;
      const qd = Math.hypot(q.x - o.x, q.y - 2 - o.y);
      if (qd >= pick) continue;
      if (bagCount(q) >= G.bagCap) { fullNear = q; continue; }
      if (qd < d) { d = qd; p = q; }
    }
    if (p) {
      const dx = p.x - o.x, dy = p.y - 2 - o.y; d = d || 1;
      const sp = Math.min(260, 90 + (pick - d) * 6 + o.t * 60);
      o.x += dx / d * sp * dt; o.y += dy / d * sp * dt;
      if (d < 7) {
        p.bag[o.res]++;
        if (isLocal(p)) {
          G.combo.n++; G.combo.t = 0.9;
          sfx.pickup(G.combo.n - 1);
          emit('bagPop', o.res);
          if (G.tutorial) emit('tut', 'pickup');
        } else if (hear(p)) sfx.pickup(0);
        particle(p.x, p.y - 4, 0, -20, 0.25, RES_COL[o.res], 1, 1, 0);
        continue;
      }
    } else if (fullNear) {
      if (isLocal(fullNear) && G.bagFullT <= 0) { G.bagFullT = 1.6; sfx.bagFull(); emit('bagFull'); }
      o.x += Math.sin(o.t * 3) * 3 * dt;
    } else {
      o.y += Math.sin(o.t * 2.4) * 4 * dt; // hafif süzülme
    }
    G.orbs[j++] = o;
  }
  G.orbs.length = j;
}

// ---------- depolama ----------
function startDeposit(p) {
  let n = 0;
  for (const k of RES_KEYS) {
    for (let i = 0; i < p.bag[k]; i++) G.deposit.push({ x: p.x, y: p.y - 4, res: k, t: -i * 0.035 - n * 0.02, sx: p.x, sy: p.y - 4 });
    n += p.bag[k]; p.bag[k] = 0;
  }
  if (n) { sfx.deposit(n); if (isLocal(p)) { emit('deposit', n); if (G.tutorial) emit('tut', 'deposit'); } }
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
export function damagePlayer(p, amount, sx, sy) {
  if (p.dead || p.iframes > 0) return;
  p.hp -= amount;
  p.iframes = PLAYER.iframes; p.hurtT = 0.2;
  const d = Math.hypot(p.x - sx, p.y - sy) || 1;
  moveAxis(p, (p.x - sx) / d * 5, 0); moveAxis(p, 0, (p.y - sy) / d * 5);
  if (hear(p)) sfx.playerHurt();
  hitstop(0.04);
  if (isLocal(p)) { haptic(30); shake(0.28); emit('hurt', amount); }
  if (hasPerk('sokDalgasi') && p.shockCd <= 0) {
    p.shockCd = 4; ring(p.x, p.y, '#ffe79a', 34); flashLight(p.x, p.y, 4, 0.2);
    for (const e of G.enemies) {
      if (e.dead) continue;
      const ed = Math.hypot(e.x - p.x, e.y - p.y);
      if (ed < 40) damageEnemyExt(e, 20, (e.x - p.x) / (ed || 1), (e.y - p.y) / (ed || 1), 3);
    }
  }
  if (p.hp <= 0) die(p);
}

// gaz: iframe/savrulma yok, küçük düzenli hasar
export function poisonPlayer(p, amount) {
  if (p.dead) return;
  p.hp -= amount; p.gasT = 0.35;
  if (hear(p)) sfx.cough();
  if (isLocal(p) && G.time - (p.poisonT || 0) > 1.2) { p.poisonT = G.time; emit('hurt', amount); }
  if (p.hp <= 0) die(p);
}

// kör edici parlama / korku: yeni derin yaratıkların etkileri
export function blindPlayer(p, t) { if (!p.dead) { p.blindT = Math.max(p.blindT, t); if (isLocal(p)) { G.flashWhite = Math.max(G.flashWhite, t); emit('blind'); } } }
export function scarePlayer(p, t) { if (!p.dead) { p.fearT = Math.max(p.fearT, t); if (isLocal(p)) { shake(0.3); emit('fear'); } } }
export function pullPlayer(p, fx, fy) { if (!p.dead) { p.pullX += fx; p.pullY += fy; } }

function die(p) {
  p.hp = 0; p.dead = true;
  // çok oyunculu: partner hayattaysa daha uzun bekleme; ikisi de düştüyse normal süre
  const otherAlive = G.players.some(q => q !== p && !q.dead);
  p.respawnT = G.mp && otherAlive ? PLAYER.respawn * 2 : PLAYER.respawn;
  const has = bagCount(p) > 0 || p.carrying;
  if (has) {
    G.satchels.push({ x: p.x, y: p.y, bag: Object.assign({}, p.bag), heart: p.carrying, owner: p.i });
    for (const k of RES_KEYS) p.bag[k] = 0;
  }
  p.carrying = false; p.recallT = 0; p.dig = null;
  sparks(p.x, p.y, '#74efcf', 18, 120); ring(p.x, p.y, '#74efcf', 26);
  if (isLocal(p)) { shake(0.5); haptic(80); emit('playerDown', has); } else emit('toast', { text: 'Partnerin bayıldı', icon: 'skull', bad: true });
  sfx.enemyDie(true);
}
function respawn(p) {
  p.dead = false; p.hp = p.maxHp; p.iframes = 1.2;
  p.x = BASE_X + (p.i ? -40 : 40); p.y = GROUND_ROW * TILE - 10; p.px = p.x; p.py = p.y;
  ring(p.x, p.y, '#74efcf', 20); sparks(p.x, p.y, '#74efcf', 10, 60);
  if (isLocal(p)) { G.cam.snap = true; emit('respawn'); }
}

export function playerMinY() { return PLAYER_MIN_Y; }
export { recompute };
