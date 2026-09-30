// Oyuncular: hareket, "bloğa it = kaz", toplama, depolama, hasar/ölüm.
// Her oyuncu kendi girdisini (p.inp) kullanır; tek ve çok oyunculu aynı yoldan geçer.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y, GROUND_ROW, PLAYER_MIN_Y, WORLD_W, BASE_X, BASE_Y, stratumOfRow, depthOfY } from '../config.js';
import { T, TD, isMineable, isPlain } from '../data/tiles.js';
import { PLAYER, UPGRADES, PERKS, RES_KEYS, PICK_TIERS, RELIC_OF_BIOME, DEEP_ORES, DIG_DEPTH, ADREN, KEHRIBAR, SHROOM, LIQUID } from '../data/balance.js';
import { RES_COL } from '../data/palette.js';
import { G, App, biomeOf } from './state.js';
import { tileAt, solidAt, setTile, damageTile, matOf } from '../world/map.js';
import { hasPerk, hasRelic, bagCount, recompute, unlockSchematic, hear, isLocal, pickDmg, pickInterval, roleOf, lastStand, pickType, pv, resonance, perkNoise } from './run.js';
import { gunDmg } from './power.js';
import { burnEnemy } from './enemies.js';
import { HAZARD } from '../data/balance.js';
import { openChest, itemMax } from './chests.js';
import { onBreak, onSpecial, inWater } from './biomes.js';
import { spawnGas } from './hazards.js';
import { addNoise, nestDestroyed } from './threat.js';
import { openStation, updateRide } from './elevator.js';
import { THREAT } from '../data/balance.js';
import { debris, dust, sparks, shake, kick, hitstop, flashLight, ring, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';
import { clamp } from '../core/util.js';
import { trackJourney, markJourney } from './journey.js';

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

// eksen bazlı hareket + köşe kaydırma: bloke olunca en yakın açık şeride (komşu şerit dahil) hızla kay, aynı karede ileri devam et
const SLIDE_REACH = TILE / 2 + HW;
export function moveAxis(p, mx, my) {
  if (!mx && !my) return true;
  const nx = p.x + mx, ny = p.y + my;
  if (!blockedAt(nx, ny)) { p.x = nx; p.y = ny; return true; }
  const lim = Math.max(0.5, Math.abs(mx || my) * 2.2);
  const horiz = !!mx, cur = horiz ? p.y : p.x, mid = Math.floor(cur / TILE) * TILE + TILE / 2;
  let best = null;
  for (const cc of [mid, mid - TILE, mid + TILE]) {
    const off = cc - cur;
    if (Math.abs(off) > SLIDE_REACH || (best !== null && Math.abs(off) >= Math.abs(best))) continue;
    if (!(horiz ? blockedAt(nx, cc) : blockedAt(cc, ny))) best = off;
  }
  if (best === null) return false;
  const d = clamp(best, -lim, lim);
  if (horiz) { if (!blockedAt(p.x, p.y + d)) p.y += d; if (!blockedAt(nx, p.y)) p.x = nx; }
  else { if (!blockedAt(p.x + d, p.y)) p.x += d; if (!blockedAt(p.x, ny)) p.y = ny; }
  return false;
}

// gövde komşu açık şeride taşmışsa: kazma, oraya kay (şaft ağzında takılmasın)
function laneOpen(p, dx, dy) {
  const cur = dx ? p.y : p.x, mid = Math.floor(cur / TILE) * TILE + TILE / 2;
  for (const cc of [mid - TILE, mid + TILE]) if (Math.abs(cc - cur) < SLIDE_REACH && !(dx ? blockedAt(p.x + dx * 2, cc) : blockedAt(cc, p.y + dy * 2))) return true;
  return false;
}

export function playerSpeed(p) {
  return PLAYER.speed * (1 + pv('simsekAdim')) * (hasPerk('adrenPompa') && p.hp < p.maxHp * 0.5 ? 1.25 : 1) * (p.adrenT > 0 ? ADREN.speed : 1) * (p.carrying ? 0.85 : 1) * (p.fearT > 0 ? 0.6 : 1) * (p.slowT > 0 ? 0.55 : 1) * (p.webT > 0 ? 0.35 : 1) * (p.hasteT > 0 ? 1.45 : 1) * (inWater(p.x, p.y) ? 0.6 : p.wet ? LIQUID.wetSpd : 1) * (p.shroom ? p.shroom.k === 'mini' ? SHROOM.miniSpd : p.shroom.k === 'dev' ? SHROOM.bigSpd : 1 : 1);
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
  trackJourney();
  // herkes baygın: sefer biter
  if (G.players.every(p => p.dead && !p.autoUp)) { G.allDownT = (G.allDownT || 0) + dt; if (G.allDownT > 1.4 && !G.over) { G.allDownT = -1e9; emit('allDown'); } }
  else G.allDownT = 0;
}

function updateOne(p, dt) {
  p.px = p.x; p.py = p.y;
  if (!p.dead && G.buried) { const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE), R = pickType(p).sense || 2; for (let k = -R; k <= R; k++) for (let j = -R; j <= R; j++) if (k * k + j * j <= R * R) unbury(pc + k, pr + j, p); }
  if (p.iframes > 0) p.iframes -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.gasT > 0) p.gasT -= dt;
  if (p.shockCd > 0) p.shockCd -= dt;
  if (p.blindT > 0) p.blindT -= dt;
  if (p.fearT > 0) p.fearT -= dt;
  if (p.landT > 0) p.landT -= dt;
  if (p.slowT > 0) p.slowT -= dt;
  if (p.hasteT > 0) p.hasteT -= dt;
  if (p.shieldT > 0) p.shieldT -= dt;
  if (p.barrierT > 0 && (p.barrierT -= dt) <= 0) p.barrier = 0;
  if (p.adrenT > 0) p.adrenT -= dt;
  // Kehribar Kalp: 20 sn'de bir kalkan dolar
  if (G.lvl.kehribarKalp && !p.dead && (p.amberT = (p.amberT || 0) - dt) <= 0) {
    p.amberT = KEHRIBAR.cd;
    if (p.barrier < KEHRIBAR.hp) { p.barrier = KEHRIBAR.hp; p.barrierT = KEHRIBAR.cd; ring(p.x, p.y, '#ffb040', 16); sparks(p.x, p.y, '#ffd890', 8, 60); }
  }
  if (p.webT > 0) p.webT -= dt;
  // Yılanbalığı yapışması: sudan çıkana kadar can yer
  if (p.latchT > 0) { p.latchT -= dt; if (!inWater(p.x, p.y)) p.latchT = 0; else if ((p.latchTick = (p.latchTick || 0) - dt) <= 0) { p.latchTick = 0.4; poisonPlayer(p, p.latchDmg || 4); particle(p.x, p.y, 0, -20, 0.4, '#6fd0ff', 1, 1, 0); } }
  // Derin Nefes ve Kan Bağı: yeraltında can yenilenir
  if (!p.dead && p.y >= GROUND_Y && p.hp < p.maxHp) {
    let rg = 0;
    if (hasPerk('kanBagi') && G.players.some(q => q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 96)) rg += 0.02;
    if (rg) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * rg * dt);
  }
  // Kan Paktı: yeraltında can erir
  if (!p.dead && hasPerk('kanPakti') && p.y >= GROUND_Y) { p.hp -= p.maxHp * 0.015 * dt; if (p.hp <= 0) die(p); }
  if (p.burnT > 0) { p.burnT -= dt; p.burnTick = (p.burnTick || 0) - dt; if (p.burnTick <= 0) { p.burnTick = 0.5; poisonPlayer(p, 2); } }
  // kanama (Kan Sülüğü ısırığı): yavaş can kaybı, kırmızı damlalar
  if (p.bleedT > 0) { p.bleedT -= dt; p.bleedTick = (p.bleedTick || 0) - dt; if (p.bleedTick <= 0) { p.bleedTick = 0.5; poisonPlayer(p, 1.5); particle(p.x + (rnd() - 0.5) * 6, p.y + 2, 0, 20, 0.5, '#e02a3a', 1, 0, 200); } }
  if (p.hitTile && (p.hitTile.t -= dt) <= 0) p.hitTile = null;
  if (p.digAnim > 0) p.digAnim = Math.max(0, p.digAnim - dt * 6);
  if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 5);
  if (p.dead) {
    p.downT -= dt;
    // partner yanında durursa kaldırır
    const mate = G.players.find(q => q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 16);
    const medic = mate && mate.role === 'sihhiyeci';
    if (mate) { p.reviveP += dt / PLAYER.reviveTime * (medic ? 2 : 1); if (p.reviveP >= 1) { revive(p, medic ? 1 : 0.5); return; } }
    else p.reviveP = Math.max(0, p.reviveP - dt * 0.6);
    if (p.autoUp && p.downT <= 0) { revive(p, 0.6); return; }
    // süre doldu: partner kampa dönerse orada uyanır
    if (p.downT <= 0 && !p.gone) p.gone = true;
    if (p.gone && G.players.some(q => q !== p && !q.dead && q.y < GROUND_Y)) respawn(p);
    return;
  }
  if (p.ride) { updateRide(p, dt); return; }
  // son 3 sn'lik konum izi (Zaman Gözü seni buraya geri sarar)
  if (G.frame % 6 === 0) { const h = p.hist || (p.hist = []); h.push(p.x, p.y); if (h.length > 60) h.splice(0, 2); }
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
    if (isMineable(tt) && blockedAt(p.x + dx * 2, p.y + dy * 2) && !laneOpen(p, dx, dy)) {
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
    p.digInt = pickInterval(p) * (roleOf(p).dig || 1);
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
  if (st > G.maxStratum) { G.maxStratum = st; emit('stratum', st); sfx.stratum(); openStation(st); }

  // ---- yüzey (kamp): depola, iyileş ----
  const onSurface = p.y < GROUND_Y;
  if (onSurface) {
    if (bagCount(p) > 0) startDeposit(p);
    if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + PLAYER.surfaceRegen * (G.mods.slowRegen ? 0.5 : 1) * dt);
    if (p.carrying) { emit('victory'); return; }
  } else if (!p.dead && roleOf(p).regen && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + roleOf(p).regen * dt);
  // ---- kese geri alma (herhangi bir oyuncu alabilir) ----
  for (let i = 0; i < G.satchels.length; i++) {
    const s = G.satchels[i];
    if (Math.hypot(s.x - p.x, s.y - p.y) < 12) {
      for (const k of RES_KEYS) p.bag[k] += s.bag[k] | 0;
      if (s.heart) { p.carrying = true; emit('heart'); }
      G.satchels.splice(i, 1); i--;
      if (hear(p)) sfx.chest();
      if (isLocal(p)) emit('toast', { text: s.lost ? 'Kayıp kese: içindekiler çantanda' : s.echo ? 'Ölüm yankısı: kaybettiğin çanta geri geldi' : 'Çantanı geri aldın', icon: 'bag' });
    }
  }
}

function digHit(p, t) {
  const tile = tileAt(t.c, t.r), mat = matOf(t.c, t.r), d = TD[tile], pt = pickType(p);
  const dmg = pickDmg(p) * lastStand(p) * (d.nest && hasPerk('yuvaAvcisi') ? pv('yuvaAvcisi') : 1) / (1 + Math.max(0, stratumOfRow(t.r)) * DIG_DEPTH);
  p.digAnim = 1;
  p.swingN = (p.swingN | 0) + 1;
  p.squash = 0.6;
  p.hitTile = { c: t.c, r: t.r, t: 0.12 };
  const hx = t.c * TILE + 8 - t.dx * 7, hy = t.r * TILE + 8 - t.dy * 7;
  if (hear(p)) sfx.dig(mat, G.lvl.drill);
  addNoise(THREAT.noise.dig * (d.hp >= 6 ? 1.4 : 1) * (roleOf(p).digNoise || 1) * (pt.noise || 1) * perkNoise(), hx, hy);
  debris(hx, hy, mat, 3, 0.6);
  // kazma ucu kıvılcımı: kademe rengi
  const tier = PICK_TIERS[Math.min(PICK_TIERS.length - 1, G.lvl.drill)];
  sparks(hx, hy, tier.spark, d.hp >= 6 ? 3 : 1, 55);
  if (isLocal(p)) kick(t.dx, t.dy, 1.2);
  if (hasPerk('kazmaDarbesi')) {
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - (p.x + t.dx * 12), e.y - (p.y + t.dy * 12)) < 14 + e.r) damageEnemyExt(e, gunDmg(p) * pv('kazmaDarbesi'), t.dx, t.dy);
  }
  // Balyoz: önündeki düşmanı savurur
  if (pt.bash) for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - (p.x + t.dx * 12), e.y - (p.y + t.dy * 12)) < 16 + e.r) { damageEnemyExt(e, pt.bash * lastStand(p), t.dx, t.dy, 2.5); sparks(e.x, e.y, tier.spark, 5, 70); }
  if (damageTile(t.c, t.r, dmg)) {
    breakTile(t.c, t.r, p, t.dx, t.dy);
    if (hasPerk('zincir') && rnd() < pv('zincir')) {
      const nc = t.c + t.dx, nr = t.r + t.dy, nt = tileAt(nc, nr);
      if (isMineable(nt) && !TD[nt].chest && !TD[nt].heart && !TD[nt].relic) breakTile(nc, nr, p, t.dx, t.dy);
    }
  } else if (d.hp >= 6) {
    if (isLocal(p)) haptic(4);
  }
  // Geniş Kazma: yandaki iki blok; Burgu: arkadaki blok
  if (pt.wide) for (const s of [-1, 1]) digExtra(p, t.c + (t.dy ? s : 0), t.r + (t.dx ? s : 0), dmg, t);
  if (pt.deep) digExtra(p, t.c + t.dx, t.r + t.dy, dmg * pt.deep, t);
}
function digExtra(p, c, r, dmg, t) {
  const tt = tileAt(c, r), d = TD[tt];
  if (r < GROUND_ROW || !isMineable(tt) || d.chest || d.heart || d.relic || d.gate) return;
  if (damageTile(c, r, dmg)) breakTile(c, r, p, t.dx, t.dy);
  else debris(c * TILE + 8, r * TILE + 8, matOf(c, r), 1, 0.5);
}

let damageEnemyExt = () => {};
export function bindEnemyDamage(fn) { damageEnemyExt = fn; }

// byPlayer: kıran oyuncu (null: düşman/çevre)
// gömülü cevheri açığa çıkar (kıvılcımla)
export function unbury(c, r, p = null) {
  const i = r * 17 + c;
  if (c < 0 || c > 16 || !G.buried || !G.buried[i]) return;
  G.buried[i] = 0; G.dirty.push(c, r); G.mapVersion++;
  const x = c * TILE + 8, y = r * TILE + 8, d = TD[G.map[i]];
  sparks(x, y, d.nest ? '#ff5a8a' : RES_COL[d.ore] || '#fff0a0', d.nest ? 18 : 10, 70); flashLight(x, y, 3, 0.4);
  if (d.nest && p && isLocal(p)) emit('toast', { text: 'Yuva buldun', icon: 'wave' });
  if (p && hear(p, x, y)) sfx.oreReveal();
}
export function breakTile(c, r, byPlayer, dx = 0, dy = 0) {
  const t = tileAt(c, r), d = TD[t], mat = matOf(c, r);
  setTile(c, r, T.AIR);
  onBreak(c, r, t);
  if (G.buried) { G.buried[r * 17 + c] = 0; for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) if (k || j) unbury(c + k, r + j, byPlayer); }
  const x = c * TILE + 8, y = r * TILE + 8;
  if (d.gas) spawnGas(x, y);
  if (d.ember) { sparks(x, y, '#ff9a4a', 10, 90); flashLight(x, y, 4, 0.3); if (byPlayer && Math.hypot(byPlayer.x - x, byPlayer.y - y) < 22) { byPlayer.burnT = 2; damagePlayer(byPlayer, HAZARD.emberBurn, x, y); } }
  if (!byPlayer) { debris(x, y, mat, 5, 0.7); return; }
  const p = byPlayer, near = hear(p, x, y), local = isLocal(p);
  G.stats.dug++;
  if (pickType(p).leech && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + pickType(p).leech);
  addNoise((THREAT.noise.brk + (d.ore ? THREAT.noise.ore : 0)) * (roleOf(p).digNoise || 1) * perkNoise(), x, y);
  // Barut Ustası: her N blokta bir dinamit
  if (hasPerk('barut') && (p.mineN = (p.mineN | 0) + 1) >= pv('barut')) { p.mineN = 0; if ((G.items.dynamite | 0) < itemMax('dynamite')) { G.items.dynamite = (G.items.dynamite | 0) + 1; if (local) emit('toast', { text: 'Barut Ustası: +1 dinamit', icon: 'dynamite' }); } }
  // Kristal Kabuk: her 15 blokta kalkan
  if (hasPerk('kristalKabuk') && (p.shellN = (p.shellN | 0) + 1) >= 15) { p.shellN = 0; p.barrier = Math.max(p.barrier || 0, p.maxHp * 0.3); p.barrierT = 12; ring(p.x, p.y, '#e070ff', 14); sparks(p.x, p.y, '#f0c0ff', 6, 50); }
  // Magma Kazma: kırılan blok yakındaki düşmanları tutuşturur
  if (hasPerk('magmaKazma')) for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < 40) { burnEnemy(e, 3, gunDmg(p) * 0.3); sparks(e.x, e.y, '#ff9a4a', 3, 40); }
  if (d.nest) { nestDestroyed(c, r, p); if (hasPerk('yuvaAvcisi')) G.threat.noise = Math.max(0, G.threat.noise - 25); }
  if (hasPerk('deprem') && !p.quake && (p.quakeN = (p.quakeN | 0) + 1) >= pv('deprem')) { p.quakeN = 0; quake(c, r, p); }
  debris(x, y, mat, 9);
  dust(x, y, 3);
  if (near) sfx.breakBlock(mat);
  if (local) haptic(d.hp >= 6 ? 14 : 7);
  // hitstop simülasyonu durdurur: deterministik kalması için iki tarafta da uygulanır
  if (d.hp >= 6 || d.ore) { hitstop(0.035); if (local) shake(0.12); } else if (local) shake(d.hp >= 3 ? 0.07 : 0.04);
  // derin biyom taşları
  if (d.toxic && Math.hypot(p.x - x, p.y - y) < 26) { poisonPlayer(p, 12, true); dust(x, y, 3, 'rgba(200,210,220,0.6)'); }
  if (d.shock) {
    // yıldırım damarı: çevredeki düşmanı çarpar, çok yakındaysan seni de
    sparks(x, y, '#9ad8ff', 18, 140); ring(x, y, '#9ad8ff', 30); flashLight(x, y, 7, 0.5); if (local) shake(0.3); sfx.explode();
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < 48) damageEnemyExt(e, 40, 0, 0, 0.5);
    if (Math.hypot(p.x - x, p.y - y) < 16) damagePlayer(p, 8, x, y);
  }
  if (d.spore) {
    dust(x, y, 4, 'rgba(150,230,120,0.5)'); ring(x, y, '#a8f070', 24);
    for (const q of G.players) if (!q.dead && Math.hypot(q.x - x, q.y - y) < 40) q.hp = Math.min(q.maxHp, q.hp + 12);
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < 56) e.slowT = Math.max(e.slowT, 3.5);
  }
  if (d.brittle) {
    // cam zincirleme kırılır: komşu camlar da dökülür (ganimet yok, gürültü var)
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nr < GROUND_ROW || tileAt(nc, nr) !== t) continue;
      setTile(nc, nr, T.AIR); debris(nc * TILE + 8, nr * TILE + 8, mat, 5, 0.7); addNoise(THREAT.noise.brk * 0.6, x, y); G.stats.dug++;
    }
    sparks(x, y, '#d8f8ff', 8, 90);
  }
  if (d.pulse) {
    // nabız taşı: can verir ama Dev uyanır
    G.threat.noise = Math.min(100, G.threat.noise + 40); G.threat.quietT = 0;
    for (const q of G.players) if (!q.dead && Math.hypot(q.x - x, q.y - y) < 60) q.hp = Math.min(q.maxHp, q.hp + 30);
    ring(x, y, '#ff5a6a', 40); flashLight(x, y, 8, 0.7); if (local) shake(0.5); sfx.rumble();
  }
  if (d.chrono) {
    // zaman taşı: düşman donar, sen hızlanırsın
    p.hasteT = 5;
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < 80) { e.slowT = Math.max(e.slowT, 5); e.atkCd = Math.max(e.atkCd, 5); }
    ring(x, y, '#ffd890', 44); flashLight(x, y, 6, 0.5); hitstop(0.1);
  }
  if (d.vamp) { p.hp = Math.min(p.maxHp, p.hp + 20); G.threat.noise = Math.min(100, G.threat.noise + 25); G.threat.quietT = 0; sparks(x, y, '#e02a3a', 10, 80); ring(x, y, '#e02a3a', 22); }
  if (d.hush) { G.threat.noise = Math.max(0, G.threat.noise - 30); ring(x, y, '#d8d8e8', 36); dust(x, y, 3, 'rgba(220,220,235,0.5)'); }
  if (d.seed) {
    // yaratılış tohumu: çevredeki sıradan kaya cevhere döner
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nc = c + dc, nr = r + dr;
      if ((!dc && !dr) || nr < GROUND_ROW || !isPlain(tileAt(nc, nr))) continue;
      setTile(nc, nr, rnd() < 0.5 ? T.CRYSTAL : T.GOLD);
    }
    sparks(x, y, '#fff0a0', 24, 140); ring(x, y, '#ffd24a', 40); flashLight(x, y, 9, 0.8); hitstop(0.1); if (local) shake(0.3); sfx.chest();
  }
  if (d.gate && local) emit('toast', { text: 'Saray kapısı açıldı', icon: 'chest' });
  if (d.lure || d.node || d.egg || d.lumen || d.amber) onSpecial(d, c, r, p, x, y);
  // Dünya Tohumu: sıradan kaya bazen kristal verir
  if (d.plain && hasRelic('tohum') && rnd() < 0.04) { spawnOrb(x, y, 'crystal'); sparks(x, y, '#e070ff', 6, 70); }
  if (d.relic) markJourney('relic', x, y, p.i);
  if (d.relic) takeRelic(p, x, y, typeof d.relic === 'string' ? d.relic : RELIC_OF_BIOME[biomeOf(stratumOfRow(r))]);
  // Altın Taç: sıradan kaya bazen altın verir
  if (d.plain && hasRelic('tac') && rnd() < 0.1) { spawnOrb(x, y, 'gold'); sparks(x, y, '#ffd870', 8, 80); flashLight(x, y, 3, 0.3); if (near) sfx.oreReveal(); }
  // Yaratılış Kıvılcımı: her kırılan blok yakındaki düşmanı yakar
  if (hasRelic('kivilcim')) { sparks(x, y, '#fff0a0', 4, 70); for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < 40) damageEnemyExt(e, 12, 0, 0, 0.2); }
  if (d.ore) {
    if (near) sfx.oreReveal();
    if (DEEP_ORES.includes(d.ore)) markJourney('gem', x, y, p.i, d.ore);
    const rare = d.ore === 'cobalt' || d.ore === 'crystal' || d.ore === 'gold';
    const dv = (d.iceDrop ? 0 : pv('damar')) + (resonance('toprak') ? 0.3 : 0);
    const n = d.amt + Math.floor(dv) + (rnd() < dv % 1 ? 1 : 0) + (rare && roleOf(p).rare ? 1 : 0) + (pickType(p).ore && !d.plain ? pickType(p).ore : 0);
    const res = !rare || d.ore === 'cobalt' ? (hasPerk('simya') && rnd() < pv('simya') ? 'gold' : d.ore) : d.ore;
    for (let i = 0; i < n; i++) spawnOrb(x, y, res);
    sparks(x, y, RES_COL[d.ore], 6, 70);
    flashLight(x, y, 3, 0.25);
  }
  if (d.chest) {
    markJourney('chest', x, y, p.i);
    sfx.chest(); hitstop(0.08); if (local) shake(0.2);
    sparks(x, y, '#ffd24a', 14, 110);
    const sc = d.chest !== 'mimic' && unlockSchematic();
    if (sc) emit('schematic', sc);
    addNoise(THREAT.noise.chest, x, y);
    openChest(p, d.chest, x, y, c, r);
  }
  if (d.heart) {
    p.carrying = true; markJourney('heart', x, y, p.i);
    hitstop(0.12); if (local) shake(0.45); sfx.chest();
    sparks(x, y, '#ff3a6a', 24, 140); ring(x, y, '#ff8aa8', 30); flashLight(x, y, 8, 0.8);
    emit('heart');
  }
}

// Deprem Vuruşu: çevredeki sıradan kayalar da yıkılır
function quake(c, r, p) {
  p.quake = true;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const nc = c + dc, nr = r + dr, t = tileAt(nc, nr), d = TD[t];
    if ((!dc && !dr) || nr <= GROUND_ROW || !isMineable(t) || d.chest || d.heart || d.relic || d.nest) continue;
    breakTile(nc, nr, p);
  }
  p.quake = false;
  const x = c * TILE + 8, y = r * TILE + 8;
  ring(x, y, '#ffb050', 26); dust(x, y, 6, 'rgba(160,130,110,0.55)'); hitstop(0.05); if (isLocal(p)) shake(0.35);
}

// efsanevi eser: kalıcı (App.meta), sefer içinde hemen etkin; ikinci kez bulunursa altın yağmuru
function takeRelic(p, x, y, k) {
  hitstop(0.25); if (isLocal(p)) { shake(0.6); haptic([40, 60, 120]); }
  G.flashWhite = Math.max(G.flashWhite, 0.45);
  ring(x, y, '#ffd870', 64); ring(x, y, '#ffffff', 40); sparks(x, y, '#ffd870', 40, 190); sparks(x, y, '#ffffff', 16, 130); flashLight(x, y, 12, 1.4);
  if (k && !hasRelic(k)) {
    G.meta.relics = (G.meta.relics || []).concat(k);
    const lm = App.meta; lm.relics = lm.relics || []; if (!lm.relics.includes(k)) lm.relics.push(k);
    recompute();
    if (k === 'tac') G.store.gold += 12;
    sfx.victory();
    emit('relic', { k, pi: p.i });
  } else {
    for (let i = 0; i < 6; i++) spawnOrb(x, y, 'gold'); for (let i = 0; i < 3; i++) spawnOrb(x, y, 'crystal');
    sfx.chest(); emit('relic', { k, pi: p.i, again: true });
  }
}

// ---------- cevher küreleri ----------
export function spawnOrb(x, y, res, fromEnemy = false) {
  const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2, s = 50 + rnd() * 50;
  G.orbs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, res, delay: 0.28 + rnd() * 0.15, t: 0, bounce: 0, fromEnemy });
}
export function updateOrbs(dt) {
  const pick = hasPerk('derinCep') ? 120 : 44;
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
// büyük çanta: uçan küre sayısı ~48 ile sınırlı, her küre birden çok cevher taşır
function startDeposit(p) {
  const per = Math.max(1, Math.ceil(bagCount(p) / 48));
  let n = 0, q = 0;
  for (const k of RES_KEYS) {
    for (let left = p.bag[k]; left > 0; left -= per) G.deposit.push({ x: p.x, y: p.y - 4, res: k, n: Math.min(per, left), t: -q++ * 0.035, sx: p.x, sy: p.y - 4 });
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
      G.store[o.res] += o.n || 1; G.collected[o.res] += o.n || 1;
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
  // Akik Kalkan: darbeyi emer, sonra dolar
  if (G.lvl.akikKalkan && !(p.shieldT > 0)) {
    p.shieldT = 15; p.iframes = 0.5;
    ring(p.x, p.y, '#ff5ab0', 16); sparks(p.x, p.y, '#ffd0f0', 10, 80);
    if (hear(p)) sfx.chirp();
    return;
  }
  if (G.lvl.elmasDeri) amount *= 0.75;
  if (p.shroom && p.shroom.k === 'mini') amount *= SHROOM.miniDmg;
  // Aynalı Taç: hasarın yarısı en yakın saldırana yansır
  if (hasRelic('aynaTac')) { let best = null, bd = 40; for (const e of G.enemies) { if (e.dead || e.d.boss) continue; const d = Math.hypot(e.x - sx, e.y - sy); if (d < bd) { bd = d; best = e; } } if (best) { damageEnemyExt(best, amount * 0.5, 0, 0, 0.3); sparks(best.x, best.y, '#c8d0ff', 5, 60); } }
  amount *= 1 - pv('buzZirh');
  // Kalkan Hücresi: darbeyi önce kalkan emer
  if (p.barrier > 0) {
    const a = Math.min(p.barrier, amount); p.barrier -= a; amount -= a;
    ring(p.x, p.y, '#6fd0ff', 14); sparks(p.x, p.y, '#bff4ff', 6, 60);
    if (p.barrier <= 0) { p.barrierT = 0; if (isLocal(p)) emit('toast', { text: 'Kalkan kırıldı', icon: 'shield', bad: true }); }
    if (amount <= 0) { p.iframes = 0.25; if (hear(p)) sfx.ping(); return; }
  }
  // Kan rezonansı: bayıltacak darbe 1 canda durur (90 sn'de bir)
  if (p.hp - amount <= 0 && resonance('kan') && G.time >= (p.kanT || 0)) {
    p.kanT = G.time + 90; p.hp = 1; p.iframes = 3; ring(p.x, p.y, '#ec4a4a', 40); sparks(p.x, p.y, '#ff8a8a', 16, 110); flashLight(p.x, p.y, 6, 0.4); hitstop(0.1);
    if (isLocal(p)) emit('toast', { text: 'Kan rezonansı: ayakta kaldın', icon: 'heart' });
    return;
  }
  p.hp -= amount;
  p.iframes = hasPerk('hayaletDeri') ? pv('hayaletDeri') : PLAYER.iframes; p.hurtT = 0.2;
  const d = Math.hypot(p.x - sx, p.y - sy) || 1;
  moveAxis(p, (p.x - sx) / d * 5, 0); moveAxis(p, 0, (p.y - sy) / d * 5);
  if (hear(p)) sfx.playerHurt();
  hitstop(0.04);
  if (isLocal(p)) { haptic(30); shake(0.28); emit('hurt', amount); }
  if (hasPerk('simsekAdim')) p.hasteT = Math.max(p.hasteT || 0, 2);
  if (hasPerk('dikenZirh')) for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 16) { damageEnemyExt(e, p.maxHp * pv('dikenZirh'), (e.x - p.x) / 16, (e.y - p.y) / 16, 1); sparks(e.x, e.y, '#dfe6f0', 4, 60); }
  if (hasPerk('buzPatlama') && p.shockCd <= 0) {
    p.shockCd = 4; ring(p.x, p.y, '#bff4ff', 34); sparks(p.x, p.y, '#dff6ff', 10, 90); flashLight(p.x, p.y, 4, 0.2);
    for (const e of G.enemies) {
      if (e.dead) continue;
      const ed = Math.hypot(e.x - p.x, e.y - p.y);
      if (ed < 40) { damageEnemyExt(e, gunDmg(p) * pv('buzPatlama'), (e.x - p.x) / (ed || 1), (e.y - p.y) / (ed || 1), 3); e.slowT = Math.max(e.slowT, 2); }
    }
  }
  // Donmuş Kalp: can %30 altına düşünce çevredeki düşmanlar donar ve vuramaz
  if (hasPerk('donmusKalp') && p.hp > 0 && p.hp < p.maxHp * 0.3 && G.time >= (p.tsT || 0)) {
    p.tsT = G.time + pv('donmusKalp'); p.iframes = Math.max(p.iframes, 1);
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 220) { e.slowT = Math.max(e.slowT, 5); e.atkCd = Math.max(e.atkCd, 5); e.fireCd = Math.max(e.fireCd || 0, 5); }
    ring(p.x, p.y, '#bff4ff', 60); ring(p.x, p.y, '#ffffff', 36); flashLight(p.x, p.y, 8, 0.6); hitstop(0.12);
    if (isLocal(p)) emit('toast', { text: 'Donmuş Kalp: her şey dondu', icon: 'frost' });
  }
  if (p.hp <= 0) die(p);
}

// gaz: iframe/savrulma yok, küçük düzenli hasar
export function poisonPlayer(p, amount, gas = false) {
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
// ağ (örümcek) ve soğuk (Kırağı): yavaşlatma
export function webPlayer(p, t) { if (!p.dead) { p.webT = Math.max(p.webT, t); if (isLocal(p)) emit('web'); } }
export function chillPlayer(p, t) { if (!p.dead) { p.slowT = Math.max(p.slowT, t); if (isLocal(p)) emit('chill'); } }

function die(p) {
  // Devin Kalbi: sefer başına bir kez, bayılmak yerine nabız dalgası
  if (hasRelic('kalp') && !p.kalpUsed) {
    p.kalpUsed = true; p.hp = Math.round(p.maxHp * 0.5); p.iframes = 2;
    ring(p.x, p.y, '#ff5a6a', 72); ring(p.x, p.y, '#ffd0d0', 44); sparks(p.x, p.y, '#ff5a6a', 30, 170); flashLight(p.x, p.y, 10, 0.8); hitstop(0.15);
    for (const e of G.enemies) { if (e.dead) continue; const ed = Math.hypot(e.x - p.x, e.y - p.y); if (ed < 90) damageEnemyExt(e, 30, (e.x - p.x) / (ed || 1), (e.y - p.y) / (ed || 1), 4); }
    sfx.rumble(); if (isLocal(p)) { shake(0.6); haptic(60); }
    emit('toast', { text: (isLocal(p) ? 'Devin Kalbi attı — ayaktasın' : 'Partnerinde Devin Kalbi attı'), icon: 'heart' });
    return;
  }
  p.hp = 0; p.dead = true; p.gone = false; p.reviveP = 0; p.autoUp = false; p.ride = null;
  markJourney('down', p.x, p.y, p.i);
  p.downT = PLAYER.downTime;
  // kendi kendine kalkma hakkı: İkinci Nefes perk'i ya da Sağlık Sigortası (sefer başına bir kez)
  if (G.selfRevive > 0) { G.selfRevive--; p.autoUp = true; p.downT = 2.6; }
  const has = bagCount(p) > 0 || p.carrying;
  if (has) {
    G.satchels.push({ x: p.x, y: p.y, bag: Object.assign({}, p.bag), heart: p.carrying, owner: p.i });
    for (const k of RES_KEYS) p.bag[k] = 0;
  }
  p.carrying = false; p.recallT = 0; p.dig = null;
  sparks(p.x, p.y, '#74efcf', 18, 120); ring(p.x, p.y, '#74efcf', 26);
  if (isLocal(p)) { shake(0.5); haptic(80); emit('playerDown', { has, autoUp: p.autoUp }); } else emit('toast', { text: 'Partnerin bayıldı — yanına git ve kaldır', icon: 'skull', bad: true });
  sfx.enemyDie(true);
}
// kaldırma (partner ya da kendi kendine)
function revive(p, frac) {
  p.dead = false; p.gone = false; p.hp = Math.max(1, Math.round(p.maxHp * frac)); p.iframes = 1.5; p.reviveP = 0; p.autoUp = false;
  ring(p.x, p.y, '#74efcf', 22); sparks(p.x, p.y, '#74efcf', 12, 70); flashLight(p.x, p.y, 4, 0.3);
  if (hear(p)) sfx.heal();
  if (isLocal(p)) { haptic(25); emit('revived'); } else emit('toast', { text: 'Partnerin ayağa kalktı', icon: 'heart' });
}
// kampta uyanma (süre dolduysa ve partner kampa döndüyse)
function respawn(p) {
  p.dead = false; p.gone = false; p.hp = p.maxHp; p.iframes = 1.2; p.reviveP = 0;
  p.x = BASE_X + (p.i ? -40 : 40); p.y = GROUND_ROW * TILE - 10; p.px = p.x; p.py = p.y;
  ring(p.x, p.y, '#74efcf', 20); sparks(p.x, p.y, '#74efcf', 10, 60);
  if (isLocal(p)) { G.cam.snap = true; emit('respawn'); }
}

export function playerMinY() { return PLAYER_MIN_Y; }
export { recompute };
