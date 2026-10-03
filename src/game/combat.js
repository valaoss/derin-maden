// Otomatik nişan alan omuz silahı (türe göre mermi, alev ya da şimşek), mermiler, aletler.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y, ROWS } from '../config.js';
import { T, TD, isMineable } from '../data/tiles.js';
import { UPGRADES, BUILDS, MODS, BURN, THREAT, CRIT, VAMP_CAP, FIRE } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, damageTile } from '../world/map.js';
import { damageEnemy, losClear, damageStructure, burnEnemy } from './enemies.js';
import { damagePlayer, webPlayer, chillPlayer, breakTile, nearestPlayer } from './player.js';
import { addNoise } from './threat.js';
import { hasPerk, hear, hasMod, lastStand, weaponOf, cardLv, toolPow, pv, resonance } from './run.js';
import { gunDmg, gunCd, critChance } from './power.js';
import { updateWeaponOffers } from './weaponlevel.js';
import { inWater } from './biomes.js';
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
  // eklenti bekleme süreleri ve süren etkiler (ekip ortak)
  const g = G.gear;
  updateWeaponOffers();
  for (const k in g.cd) if (g.cd[k] > 0) g.cd[k] -= dt;
  for (const k in g.active) if (g.active[k] > 0) g.active[k] -= dt;
  if (G.rageT > 0) G.rageT -= dt;
  for (const p of G.players) updateGun(p, dt);
  // Şimşek rezonansı: 12 sn'de bir yakındaki 5 düşmana yıldırım
  if (resonance('simsek') && (G.boltT = (G.boltT || 12) - dt) <= 0) {
    G.boltT = 12;
    for (const p of G.players) {
      if (p.dead) continue;
      const near = G.enemies.filter(e => !e.dead && e.emergeT <= 0.2 && !e.under && Math.hypot(e.x - p.x, e.y - p.y) < 130).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 5);
      for (const e of near) { damageEnemy(e, gunDmg(p) * 3, 0, 0, 0.5, true); G.zaps.push({ x0: e.x, y0: e.y - 60, x1: e.x, y1: e.y, t: 0.2 }); sparks(e.x, e.y, '#bff4ff', 8, 90); flashLight(e.x, e.y, 4, 0.2); }
      if (near.length && hear(p)) sfx.zap();
    }
  }
  // yıldırım çizgileri ve hasar sayıları (kozmetik)
  let j = 0; for (const z of G.zaps) { z.t -= dt; if (z.t > 0) G.zaps[j++] = z; } G.zaps.length = j;
  j = 0; for (const n of G.nums) { n.t += dt; if (n.t < 0.75) G.nums[j++] = n; } G.nums.length = j;
}
// Termal Şok: yanan ve yavaşlamış düşman patlar
function thermal(e, dmg) {
  ring(e.x, e.y, '#ffd0a0', 26); sparks(e.x, e.y, '#bff4ff', 8, 100); sparks(e.x, e.y, '#ff9a4a', 8, 100); flashLight(e.x, e.y, 4, 0.2);
  e.slowT = 0;
  for (const o of G.enemies) { if (o.dead || o.emergeT > 0.3 || o.under) continue; const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < 28 + o.r) damageEnemy(o, dmg, (o.x - e.x) / (d || 1), (o.y - e.y) / (d || 1), 1.2, true); }
  if (hear(G.player, e.x, e.y)) sfx.explode();
}
// mermiye eklenti ve kalıntı etkilerini işle
function tagBullet(b, W) {
  if (hasMod('ricochet')) b.bounce = 2;
  if (hasPerk('kor')) b.kor = pv('kor');
  if (G.lvl.opalNamlu) b.kor = Math.max(b.kor || 0, 0.25);
  if (hasPerk('buzMermi')) b.frostT = pv('buzMermi');
  if (hasPerk('zincirSimsek') && rnd() < pv('zincirSimsek')) b.chain = true;
  if (hasMod('frost')) b.frost = true;
  if (hasMod('fire') || (W && W.burn)) b.fire = true;
  if (hasMod('chain')) b.chain = true;
  if (hasMod('boom')) b.boom = true;
  if (hasMod('homing')) b.seek = true;
  if (hasMod('stun')) b.stun = MODS.stun.v;
  return b;
}
// Buz Ucu: aynı düşman ancak aralıkla donar; boss etkilenmez, elit yarı süre
export function frostEnemy(e) {
  if (e.d.boss || e.frostAt > G.time) return false;
  e.frostAt = G.time + MODS.frost.cd; e.slowT = Math.max(e.slowT, MODS.frost.t * (e.elite ? 0.5 : 1));
  return true;
}
// sersemletme: aynı düşman ancak aralıkla sersemler (sürekli kilit olmasın); boss etkilenmez, elit yarı süre
export function stunEnemy(e, t) {
  if (e.d.boss || e.stunAt > G.time) return;
  e.stunAt = G.time + MODS.stun.cd; e.atkCd = Math.max(e.atkCd, t * (e.elite ? 0.5 : 1));
}
// silahla öldürme: Can Çalan ve Saçılma eklentileri
function gunKill(e, p) {
  if (!e.dead || e.fragged) return;
  e.fragged = true;
  // Can Çalan: madenci başına bekleme süresi var (sürü öldürürken ölümsüzlük olmasın)
  if (p && !p.dead && hasMod('leech') && !(G.gear.cd['leech' + p.i] > 0)) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * MODS.leech.v); G.gear.cd['leech' + p.i] = MODS.leech.cd; }
  if (p && hasMod('nova')) {
    const M = MODS.nova, a0 = rnd() * Math.PI * 2, dmg = gunDmg(p) * M.v;
    for (let i = 0; i < M.n; i++) { const b = tagBullet(fire(e.x, e.y, a0 + i / M.n * Math.PI * 2, 210, dmg, 'p', 0, p.i)); b.life = 0.32; b.hit = e; }
    ring(e.x, e.y, '#bff4ff', 12);
  }
}
// yön değiştir: hedefe doğru saniyede en çok 'rate' radyan
function steer(b, tx, ty, rate, dt) {
  const a = Math.atan2(b.vy, b.vx), s = Math.hypot(b.vx, b.vy), t = Math.atan2(ty - b.y, tx - b.x), d = Math.atan2(Math.sin(t - a), Math.cos(t - a));
  const na = a + Math.max(-rate * dt, Math.min(rate * dt, d)); b.vx = Math.cos(na) * s; b.vy = Math.sin(na) * s;
}
function updateGun(p, dt) {
  if (p.dead) return;
  p.fireCd -= dt;
  if (p.aimT > 0) p.aimT -= dt;
  if (p.flameT > 0) p.flameT -= dt;
  const W = weaponOf(p), lv = G.lvl.blaster, range = UPGRADES.blaster.range[lv] * W.range * (hasPerk('deliciIsin') ? 1.3 : 1);
  // Nova Kalbi: düşman yakındayken 8 sn'de bir otomatik halka
  if (hasPerk('statik') && (p.novaT = (p.novaT || 0) - dt) <= 0 && nearestTarget(p.x, p.y - 4, 70)) {
    p.novaT = pv('statik'); const nd = UPGRADES.blaster.dmg[lv] * 0.8;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; tagBullet(fire(p.x + Math.cos(a) * 6, p.y - 4 + Math.sin(a) * 6, a, 230, nd, 'p', 0, p.i), W); }
    ring(p.x, p.y - 4, '#bff4ff', 26); flashLight(p.x, p.y, 5, 0.25); if (hear(p)) sfx.nova();
  }
  const sp = shoulderPos(p);
  const tgt = nearestTarget(sp.x, sp.y, range);
  if (!tgt) return;
  const ang = Math.atan2(tgt.y - sp.y, tgt.x - sp.x);
  p.aim = ang; p.aimT = 0.6;
  if (p.fireCd > 0) return;
  // su altında silah ateş etmez
  if (inWater(sp.x, sp.y)) { if (rnd() < 0.2) particle(sp.x, sp.y, (rnd() - 0.5) * 10, -20, 0.5, '#bff4ff', 1, 1, 0); return; }
  const g = G.gear, OD = MODS.overdrive;
  if (hasMod('overdrive') && (g.cd.overdrive || 0) <= 0) {
    g.cd.overdrive = OD.cd; g.active.overdrive = OD.dur;
    ring(p.x, p.y, '#ffe79a', 22); sparks(p.x, p.y, '#ffe79a', 12, 90); flashLight(p.x, p.y, 4, 0.3);
    if (hear(p)) sfx.overdrive();
    emit('modUsed', 'overdrive');
  }
  let cd = gunCd(p);
  if (hasPerk('adrenPompa') && p.hp < p.maxHp * 0.5) cd /= 1.5;
  if (G.rageT > 0) cd /= 1 + pv('ofke') * (G.rage | 0);
  if ((g.active.overdrive || 0) > 0) cd /= 3;
  // sınırın altına inen atış aralığı hasara çevrilir (kare başına bir atıştan hızlısı zaten boşa giderdi)
  let over = 1; if (cd < FIRE.minCd) { over = FIRE.minCd / cd; cd = FIRE.minCd; }
  p.fireCd = cd;
  const dmg = gunDmg(p) * lastStand(p) * over, cc = critChance(p), cok = cardLv('cok');
  if ((g.active.overdrive || 0) > 0) sparks(sp.x, sp.y, '#ffe79a', 1, 30);
  if (W.flame) { flameCone(p, sp, ang, range, dmg, W, rnd() < cc); return; }
  if (W.zap) { zapChain(p, sp, tgt, dmg, W.zap + cok, W, rnd() < cc); return; }
  const shots = hasPerk('ciftNamlu') ? [-0.09, 0.09] : [0];
  const pierce = (hasPerk('deliciIsin') ? 3 : 0) + (W.pierce || 0) + cardLv('del'), n = W.pellets ? W.pellets + cok : 1;
  const mx = sp.x + Math.cos(ang) * 6, my = sp.y + Math.sin(ang) * 6;
  // tek mermi: kritik zarı, silah özellikleri, eklentiler
  const shoot = (a, speed, d) => {
    const crit = rnd() < cc, b = tagBullet(fire(mx, my, a, speed, d * (crit ? CRIT.mul : 1), 'p', pierce, p.i), W);
    b.crit = crit;
    if (W.life) b.life = W.life;
    if (W.knock) b.knock = W.knock;
    if (W.blast) { b.blast = W.blast; b.freeze = W.freeze || 0; b.rocket = !W.freeze && !W.quiet; }
  };
  for (const o of shots) {
    for (let i = 0; i < n; i++) shoot(ang + o + (n > 1 ? (i / (n - 1) - 0.5) * W.spread : 0) + (W.jitter ? (rnd() - 0.5) * W.jitter : 0), W.speed * (n > 1 ? 0.9 + rnd() * 0.2 : 1), dmg);
    // Ek Namlu: tek mermili silahta yarım hasarlı ek mermiler
    if (!W.pellets) for (let i = 0; i < cok; i++) shoot(ang + o + (i ? -0.11 : 0.11), W.speed * 0.96, dmg * 0.5);
  }
  if (hasMod('split')) for (const o of [-0.3, 0.3]) shoot(ang + o, W.speed * 0.92, dmg * 0.5);
  addNoise(THREAT.noise.shot * (W.blast && !W.quiet ? 2 : 1), sp.x, sp.y);
  p.recoil = 1;
  sparks(sp.x + Math.cos(ang) * 7, sp.y + Math.sin(ang) * 7, W.freeze ? '#bff4ff' : '#ffe79a', n > 1 ? 5 : 2, 40);
  flashLight(sp.x, sp.y, 2.2, 0.06);
  if (hear(p)) { if (W.freeze) sfx.frost(); else if (W.blast) sfx.mortar(); else sfx.shoot(); }
}
// alev püskürtücü: koni içindeki herkese küçük hasar + yanık; gazı tutuşturur
function flameCone(p, sp, ang, range, dmg, W, crit) {
  p.flameT = 0.15;
  const cone = W.cone || 0.5;
  if (crit) dmg *= CRIT.mul;
  for (const e of G.enemies) {
    if (e.dead || e.emergeT > 0.2 || e.under) continue;
    const d = Math.hypot(e.x - sp.x, e.y - sp.y);
    if (d > range + e.r) continue;
    const ea = Math.atan2(e.y - sp.y, e.x - sp.x);
    if (Math.abs(Math.atan2(Math.sin(ea - ang), Math.cos(ea - ang))) > cone || !losClear(sp.x, sp.y, e.x, e.y, true)) continue;
    const h0 = e.hp; damageEnemy(e, dmg, Math.cos(ea), Math.sin(ea), 0.15, true, crit); vamp(p, h0 - Math.max(0, e.hp));
    burnEnemy(e, BURN.t, W.burnMul ? dmg * W.burnMul : 0);
    if (hasMod('frost')) frostEnemy(e);
    if (hasMod('stun')) stunEnemy(e, MODS.stun.v);
    gunKill(e, p);
  }
  for (let i = 0; i < 3; i++) {
    const a = ang + (rnd() - 0.5) * cone * 1.2, s = 110 + rnd() * 70;
    particle(sp.x + Math.cos(ang) * 6, sp.y + Math.sin(ang) * 6, Math.cos(a) * s, Math.sin(a) * s, 0.3, rnd() < 0.4 ? '#ffe79a' : rnd() < 0.6 ? '#ff9a4a' : '#e0502a', 2, 1, -40);
  }
  igniteGas(sp.x + Math.cos(ang) * range * 0.7, sp.y + Math.sin(ang) * range * 0.7, 10);
  addNoise(THREAT.noise.shot * 0.4, sp.x, sp.y);
  flashLight(sp.x + Math.cos(ang) * 16, sp.y + Math.sin(ang) * 16, 3, 0.1);
  if (hear(p)) sfx.flame();
}
// şimşek tabancası: hedefe anında çarpar, en yakın düşmanlara sekerek geçer
function zapChain(p, sp, tgt, dmg, n, W, crit) {
  if (crit) dmg *= CRIT.mul;
  const stun = Math.max(W.stun || 0, hasMod('stun') ? MODS.stun.v : 0);
  const hit = [];
  let cur = tgt, x0 = sp.x, y0 = sp.y;
  for (let i = 0; i <= n && cur; i++) {
    const h0 = cur.hp; damageEnemy(cur, dmg * (i ? 0.75 : 1), (cur.x - x0) / 40, (cur.y - y0) / 40, 0.4, i > 0, crit); vamp(p, h0 - Math.max(0, cur.hp));
    if (hasMod('frost')) frostEnemy(cur);
    if (hasMod('fire') || G.lvl.opalNamlu) burnEnemy(cur, BURN.t, G.lvl.opalNamlu ? dmg * 0.25 : 0);
    if (stun) stunEnemy(cur, stun);
    gunKill(cur, p);
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
  if (b.rocket) { igniteGas(x, y, R); addNoise(THREAT.noise.shot * 6, x, y); debris(x, y, 'dirt', 4); if (hear(G.player, x, y)) { sfx.mortarHit(); shake(0.07); } }
  else if (b.freeze && hear(G.player, x, y)) sfx.frost();
}

// Vampir Mermi: verilen hasarın bir kısmı can olarak döner
function vamp(p, real) {
  if (!p || p.dead || !(real > 0) || !hasPerk('vampir')) return;
  if (!(G.time - p.vampAt < 1)) { p.vampAt = G.time; p.vampN = 0; }
  const h = Math.min(real * pv('vampir'), p.maxHp * VAMP_CAP - p.vampN);
  if (h > 0) { p.vampN += h; p.hp = Math.min(p.maxHp, p.hp + h); }
}
function fire(x, y, ang, speed, dmg, from, pierce, pi = -1) {
  G.bullets.push({ x, y, px: x, py: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 0.7, dmg, from, pierce, hit: null, pi });
  return G.bullets[G.bullets.length - 1];
}

export function updateBullets(dt) {
  const bs = G.bullets; let j = 0;
  for (const b of bs) {
    b.px = b.x; b.py = b.y; b.life -= dt;
    // Demir Kene: yakındaki oyuncu mermilerini kendine çeker
    let pulled = false;
    if (b.from === 'p') for (const e of G.enemies) if (!e.dead && e.d.magnet && Math.hypot(e.x - b.x, e.y - b.y) < e.d.magnet) { steer(b, e.x, e.y, 7, dt); pulled = true; break; }
    // Güdümlü: önündeki en yakın düşmana kıvrılır
    if (b.seek && !pulled) {
      const a = Math.atan2(b.vy, b.vx); let best = null, bd = 72 * 72;
      for (const e of G.enemies) {
        if (e.dead || e.emergeT > 0.3 || e.under || e === b.hit) continue;
        const dx = e.x - b.x, dy = e.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < bd && Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - a), Math.cos(Math.atan2(dy, dx) - a))) < 1.2) { bd = d2; best = e; }
      }
      if (best) steer(b, best.x, best.y, 6, dt);
    }
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
          b.x = ox; b.y = oy; b.life += 0.2;
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
        const bd = b.dmg * (b.far && Math.hypot(e.x - b.ox, e.y - b.oy) > b.far ? 1.5 : 1) * (e.d.bulletArmor ? 1 - e.d.bulletArmor : 1), hp0 = e.hp;
        damageEnemy(e, bd, b.vx / s, b.vy / s, b.knock || (b.from === 'p' ? 1 : 0.6), false, b.crit);
        if (b.crit) sparks(b.x, b.y, '#ffd24a', 5, 90);
        if (b.stun) stunEnemy(e, b.stun);
        if (b.from === 'p' && b.pi >= 0) vamp(G.players[b.pi], hp0 - Math.max(0, e.hp));
        if (b.blast) { if (b.freeze) e.slowT = Math.max(e.slowT, b.freeze); blastAt(b, b.x, b.y, e); }
        sparks(b.x, b.y, '#fff4c2', 3, 60);
        if (b.frostT) { e.slowT = Math.max(e.slowT, b.frostT); sparks(b.x, b.y, '#bff4ff', 3, 40); }
        if (b.frost && frostEnemy(e)) sparks(b.x, b.y, '#bff4ff', 3, 40);
        if (b.fire) { burnEnemy(e, BURN.t); sparks(b.x, b.y, '#ff9a4a', 3, 40); }
        if (b.kor) { burnEnemy(e, BURN.t, b.dmg * b.kor); sparks(b.x, b.y, '#ff9a4a', 3, 40); }
        if (hasPerk('termalSok') && e.burnT > 0 && e.slowT > 0 && rnd() < 0.2) thermal(e, b.dmg * 4);
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
        if (b.from === 'p' && b.pi >= 0) gunKill(e, G.players[b.pi]);
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

// Şifa Direği: menzildeki madencileri yavaşça iyileştirir (iki direk üst üste binmez).
// Sondaj Matkabı: altındaki bloğu deler, açtığı kuyuya iner; hakkı bitince ya da delinmez kayaya gelince tükenir.
export function updateStructures(dt) {
  for (const s of G.structures) {
    if (s.hurtT > 0) s.hurtT -= dt;
    if (s.buildT > 0) { s.buildT -= dt; continue; }
    const b = BUILDS[s.type];
    s.on = 0;
    if (s.type === 'direk') {
      for (const p of G.players) {
        if (p.dead || p.hp >= p.maxHp || p.healF === G.frame || Math.hypot(p.x - s.x, p.y - (s.y - 6)) > b.range) continue;
        // tavanlı: geliştirilse de saniyede en çok azami canın %3'ü; boss uyanıkken yarısı
        const rate = Math.min(b.healMax, b.heal * toolPow('direk')) * (G.enemies.some(o => o.d.boss && !o.dead) ? b.bossMul : 1);
        p.healF = G.frame; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * rate * dt); s.on = 1;
        if (rnd() < dt * 5) particle(p.x + (rnd() - 0.5) * 8, p.y + 4, 0, -18 - rnd() * 10, 0.5, '#5fe0b8', 1, 1, 0);
      }
    } else if (s.type === 'sondaj') drillStep(s, b, dt);
  }
  let j = 0;
  for (const s of G.structures) if (!s.dead) G.structures[j++] = s;
  G.structures.length = j;
}
function drillDone(s) {
  s.dead = true; sparks(s.x, s.y - 6, '#ffd48a', 10, 90); debris(s.x, s.y, 'stone', 6);
  if (hear(G.player, s.x, s.y)) sfx.creak();
  emit('toast', { text: BUILDS.sondaj.name + ' durdu', icon: BUILDS.sondaj.icon });
}
function drillStep(s, b, dt) {
  const ty = s.r * TILE + 14;
  if (s.y < ty) { s.y = Math.min(ty, s.y + 70 * dt); return; }
  if (s.left <= 0) return drillDone(s);
  const c = s.c, r = s.r + 1, t = tileAt(c, r), d = TD[t];
  if (!d.solid) { if (r >= ROWS - 1) return drillDone(s); s.r = r; return; }
  if (!isMineable(t) || d.chest || d.heart || d.relic || d.gate) return drillDone(s);
  s.on = 1; s.prog += b.rate * dt;
  if (rnd() < dt * 18) { debris(s.x + (rnd() - 0.5) * 8, s.y + 2, 'stone', 1, 0.5); sparks(s.x, s.y + 2, '#ffe79a', 1, 50); }
  if (s.prog < 1) return;
  s.prog = 0; s.left--;
  breakTile(c, r, G.players[s.owner] || G.players[0], 0, 0, true);
  addNoise(b.noise, s.x, s.y); sparks(s.x, s.y + 6, '#ffd48a', 4, 70);
}
