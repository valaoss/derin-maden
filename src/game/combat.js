// Otomatik nişan alan omuz silahı (türe göre mermi, alev ya da şimşek), mermiler, aletler.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { UPGRADES, BUILDS, MODS, BURN, THREAT } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, damageTile } from '../world/map.js';
import { damageEnemy, losClear, damageStructure, burnEnemy } from './enemies.js';
import { damagePlayer, webPlayer, chillPlayer, breakTile, nearestPlayer } from './player.js';
import { addNoise } from './threat.js';
import { hasPerk, hear, hasMod, isLocal, roleOf, lastStand, weaponOf } from './run.js';
import { sparks, flashLight, particle, ring, shake, debris, hitstop } from './fx.js';
import { igniteGas } from './hazards.js';
import { sfx } from '../audio/audio.js';
import { emit } from '../core/events.js';

function nearestTarget(x, y, range) {
  let best = null, bd = range * range;
  for (const e of G.enemies) {
    if (e.dead || e.emergeT > 0.2 || e.under) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd && losClear(x, y, e.x, e.y, true)) { bd = d; best = e; }
  }
  return best;
}

export function shoulderPos(p) { return { x: p.x - p.face * 3, y: p.y - 5 }; }

export function updatePlayerGun(dt) {
  // eklenti bekleme süreleri ve aktif etkiler (ortak: iki oyuncu aynı blaster'ı paylaşır)
  const g = G.gear;
  for (const k in g.cd) if (g.cd[k] > 0) g.cd[k] -= dt;
  for (const k in g.active) if (g.active[k] > 0) g.active[k] -= dt;
  for (const p of G.players) updateGun(p, dt);
  // yıldırım çizgileri (kozmetik)
  let j = 0; for (const z of G.zaps) { z.t -= dt; if (z.t > 0) G.zaps[j++] = z; } G.zaps.length = j;
}
// Aktif eklenti kullanımı (komut): Aşırı Yük, Nova
export function useMod(k, p = G.player) {
  const m = MODS[k], g = G.gear;
  if (!m || !m.active || !hasMod(k) || p.dead) { if (isLocal(p)) sfx.deny(); return false; }
  if ((g.cd[k] || 0) > 0) { if (isLocal(p)) sfx.deny(); return false; }
  g.cd[k] = m.cd;
  if (k === 'overdrive') {
    g.active.overdrive = m.dur;
    ring(p.x, p.y, '#ffe79a', 22); sparks(p.x, p.y, '#ffe79a', 12, 90); flashLight(p.x, p.y, 4, 0.3);
    if (hear(p)) sfx.overdrive();
  } else if (k === 'nova') {
    const lv = G.lvl.blaster, dmg = UPGRADES.blaster.dmg[lv] * 0.8;
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const b = fire(p.x + Math.cos(a) * 6, p.y - 4 + Math.sin(a) * 6, a, 230, dmg, 'p', 0, p.i); tagBullet(b); }
    addNoise(THREAT.noise.boom * 0.5, p.x, p.y);
    ring(p.x, p.y - 4, '#bff4ff', 30); sparks(p.x, p.y - 4, '#bff4ff', 16, 120); flashLight(p.x, p.y, 6, 0.3);
    hitstop(0.03); if (isLocal(p)) shake(0.3);
    if (hear(p)) sfx.nova();
  }
  emit('modUsed', k);
  return true;
}
function tagBullet(b) {
  if (hasMod('ricochet')) b.bounce = 1;
  if (hasMod('frost')) b.frost = true;
  if (hasMod('fire') || G.lvl.opalNamlu) b.fire = true;
  if (hasMod('chain')) b.chain = true;
  if (hasMod('boom')) b.boom = true;
  return b;
}
function updateGun(p, dt) {
  if (p.dead) return;
  p.fireCd -= dt;
  if (p.aimT > 0) p.aimT -= dt;
  if (p.flameT > 0) p.flameT -= dt;
  const W = weaponOf(p), lv = G.lvl.blaster, range = (UPGRADES.blaster.range[lv] + (roleOf(p).range || 0)) * W.range;
  const sp = shoulderPos(p);
  const tgt = nearestTarget(sp.x, sp.y, range);
  if (!tgt) return;
  const ang = Math.atan2(tgt.y - sp.y, tgt.x - sp.x);
  p.aim = ang; p.aimT = 0.6;
  if (p.fireCd > 0) return;
  let cd = W.flame ? W.cd : UPGRADES.blaster.cd[lv] * W.cd;
  if (hasMod('rapid')) cd *= 0.7;
  if ((G.gear.active.overdrive || 0) > 0) cd /= 3;
  p.fireCd = cd;
  const dmg = UPGRADES.blaster.dmg[lv] * W.dmg * (roleOf(p).dmg || 1) * lastStand(p) * (G.lvl.yildizCekirdek ? 1.4 : 1);
  if ((G.gear.active.overdrive || 0) > 0) sparks(sp.x, sp.y, '#ffe79a', 1, 30);
  if (W.flame) { flameCone(p, sp, ang, range, dmg); return; }
  if (W.zap) { zapChain(p, sp, tgt, dmg, W.zap); return; }
  const shots = hasPerk('ciftNamlu') ? [-0.09, 0.09] : [0];
  const pierce = (hasPerk('delici') ? 1 : 0) + (W.pierce || 0), n = W.pellets || 1;
  const mx = sp.x + Math.cos(ang) * 6, my = sp.y + Math.sin(ang) * 6;
  for (const o of shots) for (let i = 0; i < n; i++) {
    const a = ang + o + (n > 1 ? (i / (n - 1) - 0.5) * W.spread : 0) + (W.jitter ? (rnd() - 0.5) * W.jitter : 0);
    const b = tagBullet(fire(mx, my, a, W.speed * (n > 1 ? 0.9 + rnd() * 0.2 : 1), dmg, 'p', pierce, p.i));
    if (W.life) b.life = W.life;
    if (W.knock) b.knock = W.knock;
    if (W.blast) { b.blast = W.blast; b.freeze = W.freeze || 0; b.rocket = !W.freeze; }
  }
  if (hasMod('split') && n === 1) for (const o of [-0.3, 0.3]) tagBullet(fire(mx, my, ang + o, W.speed * 0.92, dmg * 0.5, 'p', pierce, p.i));
  addNoise(THREAT.noise.shot * (W.blast ? 2 : 1), sp.x, sp.y);
  p.recoil = 1;
  sparks(sp.x + Math.cos(ang) * 7, sp.y + Math.sin(ang) * 7, W.freeze ? '#bff4ff' : '#ffe79a', n > 1 ? 5 : 2, 40);
  flashLight(sp.x, sp.y, 2.2, 0.06);
  if (hear(p)) { if (W.freeze) sfx.frost(); else if (W.blast) sfx.mortar(); else sfx.shoot(); }
}
// alev püskürtücü: koni içindeki herkese küçük hasar + yanık; gazı tutuşturur
function flameCone(p, sp, ang, range, dmg) {
  p.flameT = 0.15;
  for (const e of G.enemies) {
    if (e.dead || e.emergeT > 0.2 || e.under) continue;
    const d = Math.hypot(e.x - sp.x, e.y - sp.y);
    if (d > range + e.r) continue;
    const ea = Math.atan2(e.y - sp.y, e.x - sp.x);
    if (Math.abs(Math.atan2(Math.sin(ea - ang), Math.cos(ea - ang))) > 0.5 || !losClear(sp.x, sp.y, e.x, e.y, true)) continue;
    damageEnemy(e, dmg, Math.cos(ea), Math.sin(ea), 0.15, true);
    burnEnemy(e, BURN.t);
    if (hasMod('frost')) e.slowT = Math.max(e.slowT, 1.2);
  }
  for (let i = 0; i < 3; i++) {
    const a = ang + (rnd() - 0.5) * 0.6, s = 110 + rnd() * 70;
    particle(sp.x + Math.cos(ang) * 6, sp.y + Math.sin(ang) * 6, Math.cos(a) * s, Math.sin(a) * s, 0.3, rnd() < 0.4 ? '#ffe79a' : rnd() < 0.6 ? '#ff9a4a' : '#e0502a', 2, 1, -40);
  }
  igniteGas(sp.x + Math.cos(ang) * range * 0.7, sp.y + Math.sin(ang) * range * 0.7, 10);
  addNoise(THREAT.noise.shot * 0.4, sp.x, sp.y);
  flashLight(sp.x + Math.cos(ang) * 16, sp.y + Math.sin(ang) * 16, 3, 0.1);
  if (hear(p)) sfx.flame();
}
// şimşek tabancası: hedefe anında çarpar, en yakın düşmanlara sekerek geçer
function zapChain(p, sp, tgt, dmg, n) {
  const hit = [];
  let cur = tgt, x0 = sp.x, y0 = sp.y;
  for (let i = 0; i <= n && cur; i++) {
    damageEnemy(cur, dmg * (i ? 0.75 : 1), (cur.x - x0) / 40, (cur.y - y0) / 40, 0.4, i > 0);
    if (hasMod('frost')) cur.slowT = Math.max(cur.slowT, 1.2);
    if (hasMod('fire') || G.lvl.opalNamlu) burnEnemy(cur, BURN.t);
    G.zaps.push({ x0, y0, x1: cur.x, y1: cur.y - 2, t: 0.14 });
    sparks(cur.x, cur.y, '#bff4ff', 4, 60);
    hit.push(cur); x0 = cur.x; y0 = cur.y - 2;
    let best = null, bd = 56 * 56;
    for (const o of G.enemies) { if (o.dead || o.emergeT > 0.3 || o.under || hit.includes(o)) continue; const d2 = (o.x - x0) ** 2 + (o.y - y0) ** 2; if (d2 < bd) { bd = d2; best = o; } }
    cur = best;
  }
  addNoise(THREAT.noise.shot, sp.x, sp.y);
  p.recoil = 1; flashLight(sp.x, sp.y, 3, 0.08);
  if (hear(p)) sfx.zap();
}
// roket / buz güllesi patlaması
function blastAt(b, x, y, skip) {
  const R = b.blast;
  for (const o of G.enemies) {
    if (o === skip || o.dead || o.emergeT > 0.3 || o.under) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < R + o.r) { damageEnemy(o, b.dmg * 0.7, (o.x - x) / (d || 1), (o.y - y) / (d || 1), 1.2, true); if (b.freeze) o.slowT = Math.max(o.slowT, b.freeze); }
  }
  const col = b.freeze ? '#bff4ff' : '#ffb050';
  ring(x, y, col, R); sparks(x, y, b.freeze ? '#ffffff' : '#ffd48a', 10, 100); flashLight(x, y, b.freeze ? 3 : 5, 0.2);
  if (b.rocket) { igniteGas(x, y, R); addNoise(THREAT.noise.shot * 6, x, y); debris(x, y, 'dirt', 4); if (hear(G.player, x, y)) { sfx.mortarHit(); shake(0.12); } }
  else if (hear(G.player, x, y)) sfx.frost();
}

function fire(x, y, ang, speed, dmg, from, pierce, pi = -1) {
  G.bullets.push({ x, y, px: x, py: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 0.7, dmg, from, pierce, hit: null, pi });
  return G.bullets[G.bullets.length - 1];
}

export function updateBullets(dt) {
  const bs = G.bullets; let j = 0;
  for (const b of bs) {
    b.px = b.x; b.py = b.y; b.life -= dt;
    // iki alt adım: köşe kıyılarından sızmasın / takılmasın (LOS kontrolüyle aynı hassasiyet)
    let wall = false;
    for (let k = 0; k < 2 && !wall; k++) {
      const ox = b.x, oy = b.y;
      b.x += b.vx * dt * 0.5; b.y += b.vy * dt * 0.5;
      const solid = (x, y) => { const t = tileAt(Math.floor(x / TILE), Math.floor(y / TILE)); return TD[t].solid && t !== T.BARRICADE; };
      if (solid(b.x, b.y)) {
        // yuvaya isabet: mermiyle de yıkılır
        const nc = Math.floor(b.x / TILE), nr = Math.floor(b.y / TILE);
        if (tileAt(nc, nr) === T.NEST) {
          sparks(b.x, b.y, '#ff8ab0', 4, 60);
          if (damageTile(nc, nr, b.dmg * 0.6)) breakTile(nc, nr, G.players[b.pi >= 0 ? b.pi : 0]);
          wall = true; break;
        }
        if (b.bounce > 0) {
          // sekme: hangi eksen engellendiyse o hızı ters çevir
          b.bounce--;
          const hx = solid(b.x, oy), hy = solid(ox, b.y);
          if (hx || !hy) b.vx = -b.vx; if (hy || !hx) b.vy = -b.vy;
          b.x = ox; b.y = oy; b.life += 0.25;
          sparks(b.x, b.y, '#ffd48a', 4, 70); if (hear(G.player, b.x, b.y)) sfx.ping();
        } else wall = true;
      }
    }
    if (wall) { sparks(b.x - b.vx * dt * 0.5, b.y - b.vy * dt * 0.5, '#ffd48a', 3, 50); if (b.blast) blastAt(b, b.x - b.vx * dt * 0.5, b.y - b.vy * dt * 0.5, null); continue; }
    let dead = b.life <= 0;
    if (!dead) for (const e of G.enemies) {
      if (e.dead || e.emergeT > 0.3 || e.under || e === b.hit) continue;
      if (Math.abs(e.x - b.x) < e.r + 3 && Math.abs(e.y - b.y) < e.r + 3) {
        const s = Math.hypot(b.vx, b.vy) || 1;
        damageEnemy(e, b.dmg, b.vx / s, b.vy / s, b.knock || (b.from === 'p' ? 1 : 0.6));
        if (b.blast) { if (b.freeze) e.slowT = Math.max(e.slowT, b.freeze); blastAt(b, b.x, b.y, e); }
        sparks(b.x, b.y, '#fff4c2', 3, 60);
        if (b.frost) { e.slowT = Math.max(e.slowT, 1.2); sparks(b.x, b.y, '#bff4ff', 3, 40); }
        if (b.fire) { burnEnemy(e, BURN.t); sparks(b.x, b.y, '#ff9a4a', 3, 40); }
        if (b.chain) {
          let best = null, bd = 44 * 44;
          for (const o of G.enemies) { if (o === e || o.dead || o.emergeT > 0.3 || o.under) continue; const d2 = (o.x - e.x) ** 2 + (o.y - e.y) ** 2; if (d2 < bd) { bd = d2; best = o; } }
          if (best) { damageEnemy(best, b.dmg * 0.5, 0, 0, 0.3, true); G.zaps.push({ x0: e.x, y0: e.y - 2, x1: best.x, y1: best.y - 2, t: 0.12 }); sparks(best.x, best.y, '#bff4ff', 4, 60); if (hear(G.player, e.x, e.y)) sfx.zap(); }
        }
        if (b.boom) {
          ring(b.x, b.y, '#ffb050', 14); sparks(b.x, b.y, '#ffd48a', 6, 80); flashLight(b.x, b.y, 2.5, 0.12);
          for (const o of G.enemies) { if (o === e || o.dead || o.emergeT > 0.3 || o.under) continue; const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < 14 + o.r) damageEnemy(o, b.dmg * 0.6, (o.x - b.x) / (d || 1), (o.y - b.y) / (d || 1), 0.5, true); }
          igniteGas(b.x, b.y, 14);
        }
        if (b.pierce > 0) { b.pierce--; b.hit = e; } else dead = true;
        break;
      }
    }
    if (!dead) bs[j++] = b;
  }
  bs.length = j;

  const eb = G.ebullets; j = 0;
  for (const b of eb) {
    // güdümlü (Ötegöz küreleri): en yakın madenciye yavaşça döner
    if (b.home) { const q = nearestPlayer(b.x, b.y); if (q) { const a = Math.atan2(b.vy, b.vx), s = Math.hypot(b.vx, b.vy); let d = Math.atan2(q.y - 3 - b.y, q.x - b.x) - a; d = Math.atan2(Math.sin(d), Math.cos(d)); const na = a + Math.max(-b.home * dt, Math.min(b.home * dt, d)); b.vx = Math.cos(na) * s; b.vy = Math.sin(na) * s; } }
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    const bc = b.col || (b.web ? '#f0f0ff' : '#9af060');
    if (rnd() < 0.5) particle(b.x, b.y, 0, 0, 0.18, bc, 1, 1, 0);
    if (TD[tileAt(Math.floor(b.x / TILE), Math.floor(b.y / TILE))].solid) { sparks(b.x, b.y, bc, 4, 40); continue; }
    let hitP = false;
    for (const p of G.players) if (!p.dead && Math.abs(b.x - p.x) < 6 && Math.abs(b.y - p.y) < 7) { damagePlayer(p, b.dmg, b.x, b.y); if (b.web) webPlayer(p, 1.6); if (b.slow) chillPlayer(p, b.slow); sparks(b.x, b.y, bc, 6, 50); hitP = true; break; }
    if (hitP) continue;
    let hit = false;
    for (const s of G.structures) if (!s.dead && Math.abs(b.x - s.x) < 7 && Math.abs(b.y - s.y) < 7) { damageStructure(s, b.dmg); hit = true; break; }
    if (hit || b.life <= 0) continue;
    eb[j++] = b;
  }
  eb.length = j;
}

// havan: menzildeki, havana en yakın düşman (min menzil dışı)
function mortarTarget(s, b) {
  let best = null, bd = 1e9;
  for (const e of G.enemies) {
    if (e.dead || e.emergeT > 0.2 || e.under) continue;
    const d = Math.hypot(e.x - s.x, e.y - s.y);
    if (d < b.minRange || d > b.range) continue;
    if (d < bd) { bd = d; best = e; }
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
  for (const s of G.structures) {
    if (s.buildT > 0) s.buildT -= dt;
    if (s.hurtT > 0) s.hurtT -= dt;
    if (s.recoil > 0) s.recoil -= dt * 6;
    const b = BUILDS[s.type];
    const rate = hasPerk('taretAsiri') ? 1.5 : 1;
    s.cd -= dt;
    if (s.type === 'turret') {
      const tgt = nearestTarget(s.x, s.y - 4, b.range);
      if (tgt) {
        const ang = Math.atan2(tgt.y - (s.y - 4), tgt.x - s.x);
        s.aim += Math.atan2(Math.sin(ang - s.aim), Math.cos(ang - s.aim)) * Math.min(1, dt * 14);
        if (s.cd <= 0 && s.buildT <= 0) {
          s.cd = b.cd / rate;
          fire(s.x + Math.cos(s.aim) * 7, s.y - 4 + Math.sin(s.aim) * 7, s.aim, 230, b.dmg, 't', 0);
          s.recoil = 1; flashLight(s.x, s.y, 2, 0.06);
          sfx.turret();
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
        if (rnd() < dt * 40) {
          const a = s.aim + (rnd() - 0.5) * 0.5, sp = 90 + rnd() * 60;
          particle(s.x + Math.cos(s.aim) * 7, s.y - 5 + Math.sin(s.aim) * 7, Math.cos(a) * sp, Math.sin(a) * sp, 0.28, rnd() < 0.4 ? '#ffe79a' : rnd() < 0.6 ? '#ff9a4a' : '#e0502a', 2, 1, -40);
        }
        if (s.cd <= 0) {
          s.cd = 0.1 / rate;
          for (const e of G.enemies) {
            if (e.dead || e.emergeT > 0.2 || e.under) continue;
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
    }
  }
  let j = 0;
  for (const s of G.structures) if (!s.dead) G.structures[j++] = s;
  G.structures.length = j;
}
