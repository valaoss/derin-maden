// Düşmanlar yuvalardan çıkar ve akış alanıyla tünelleri izleyerek OYUNCUYU avlar (üs hedef değildir; yüzeye çıkamazlar).
// Kazıcılar kayayı oyar; yolu tamamen kapalı olan herkes yavaşça kazmaya başlar (asla takılmaz).
// Yeraltında oyuncu kalmazsa izini kaybederler ve kısa sürede geri çekilirler.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y, GROUND_ROW, stratumOfRow } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { ENEMIES, BARRICADE, BUILDS, ELITE, BURN, AFFIX, AFFIX_KEYS, enemyHpMul, enemyDmgMul } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, solidAt, damageTile, idx, matOf } from '../world/map.js';
import { FIELD, flowAt, nextStep, FLOW_INF } from '../world/flow.js';
import { breakTile, damagePlayer, spawnOrb, nearestPlayer, blindPlayer, scarePlayer, pullPlayer, chillPlayer, webPlayer } from './player.js';
import { hasPerk, hasRelic, hear } from './run.js';
import { sparks, debris, shake, ring, flashLight, dust, hitstop, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';
import { setTile } from '../world/map.js';
import { igniteGas } from './hazards.js';
import { addNoise } from './threat.js';
import { updateBoss } from './bosses.js';
import { markJourney } from './journey.js';

const ENEMY_COL = { rodent: '#b07a4a', bug: '#5a9a5a', spitter: '#9a5ac0', flyer: '#7a64a0', boomer: '#e070ff', brute: '#8a7c78', worm: '#c07890',
  karakok: '#78b43c', kavurgan: '#ff6a1a', otegoz: '#b080ff', sultan: '#ffd870', ezeli: '#fff4c0',
  glarer: '#ffe79a', lurker: '#6a8a5a', howler: '#8a5a7a', shade: '#4a3a6a',
  spider: '#6a4a8a', spiderling: '#8a6aaa', broodmother: '#5a2a6a', frostbat: '#9ad8ff', skitter: '#d0c0a0', magmite: '#ff7a3a', voidling: '#7a6aff', ogolem: '#4a3e68',
  quickling: '#c8d8e4', droplet: '#c8d8e4', voltbat: '#3a8aff', gilded: '#ffd870', sporeling: '#a8f070', mirrorling: '#d8f8ff', titanling: '#7a9a78', chronoling: '#ffd890', leech: '#c02a30', echoer: '#8a86b0', seraph: '#fff4e8' };
export { ENEMY_COL };

// lv: uyanış seviyesi (0..4); can ve hasar doğduğu biyomun derinliğiyle ölçeklenir
export function spawnEnemy(type, x, y, lv = 0) {
  const d = ENEMIES[type], st = Math.max(0, stratumOfRow(Math.floor(y / TILE)));
  const hp = d.hp * enemyHpMul(st, lv, d.boss) * (G.mods ? G.mods.hp : 1);
  const e = {
    type, d, x, y, px: x, py: y, hp, maxHp: hp, r: d.r, face: 1, anim: rnd() * 4,
    hitT: 0, kx: 0, ky: 0, atkCd: 0.6, fireCd: 1 + rnd(), emergeT: 0.9, wob: rnd() * 6,
    stuckT: 0, lastC: -1, lastR: -1, slowT: 0, trail: d.burrow ? [] : null,
    wind: 0, lunge: 0, dieT: 0, lastF: 0, vx: 0, vy: 0,
    blindCd: 2 + rnd() * 2, flashT: 0, tongue: 0, tongueCd: 1.5, tx: 0, ty: 0, howlCd: 2 + rnd() * 2, howlT: 0,
    burnT: 0, burnTick: 0, blinkCd: 1.5 + rnd() * 2, blinkT: 0, broodT: d.brood || 0, elite: false, scale: 1, dmgMul: ((G.mods && G.mods.dmg) || 1) * enemyDmgMul(st), breathe: rnd() * 6, lostT: 0,
    zapCd: 1.5, puffT: d.puff || 0, mirrorCd: 0, quakeCd: 2.5, rewindCd: 3, judgeCd: 2.5, beamT: 0, beamP: -1, sack: 0, baseMax: hp, aff: null, shield: 0, shieldMax: 0, sinceHit: 9, spMul: 1,
  };
  G.enemies.push(e);
  return e;
}
// Elit: daha dayanıklı, daha büyük, altın düşürür; çizimde altın aura
export function makeElite(e) {
  e.elite = true; e.hp *= ELITE.hp; e.maxHp = e.hp; e.scale = ELITE.scale; e.r = e.r * 1.2; e.dmgMul *= ELITE.dmg;
  // derin elitler özellik kazanır (biyom 6+: 1, 14+: 2, 22+: 3)
  const st = Math.max(0, stratumOfRow(Math.floor(e.y / TILE))), n = ELITE.affixAt.filter(s => st >= s).length;
  if (n) {
    const pool = AFFIX_KEYS.slice(); e.aff = [];
    while (e.aff.length < n && pool.length) e.aff.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    if (e.aff.includes('kalkan')) e.shield = e.shieldMax = e.maxHp * AFFIX.kalkan.shield;
    if (e.aff.includes('hizli')) e.spMul = AFFIX.hizli.speed;
  }
  return e;
}
export function eliteName(e) { return (e.aff || []).map(k => AFFIX[k].name).concat(e.d.name).join(' '); }

function hs(e) { return Math.min(e.r, 6); }
function blocked(e, x, y) {
  const h = hs(e);
  const x0 = Math.floor((x - h) / TILE), x1 = Math.floor((x + h - 0.01) / TILE);
  const y0 = Math.floor((y - h) / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) if (solidAt(c, r)) return true;
  return y - h < GROUND_Y - 2; // kamp güvenli bölge
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

export function damageEnemy(e, dmg, dx = 0, dy = 0, knock = 1, silent = false) {
  if (e.hp <= 0 || e.dead || e.emergeT > 0.3 || e.under) return;
  let real = dmg * (1 - (e.d.armor || 0));
  e.sinceHit = 0;
  if (e.shield > 0) { const a = Math.min(e.shield, real); e.shield -= a; real -= a; if (rnd() < 0.5) sparks(e.x, e.y, AFFIX.kalkan.col, 2, 50); }
  e.hp -= real; e.hitT = 0.09; e.hitDx = dx; e.hitDy = dy;
  const kr = 1 - (e.d.knockResist || 0);
  e.kx += dx * 55 * knock * kr; e.ky += dy * 55 * knock * kr;
  if (!silent && nearLocal(e)) sfx.hit();
  if (e.hp <= 0) { killEnemy(e); return; }
  // Cıva Damlası: yarı canda ikiye bölünür
  if (e.d.split && !e.splitDone && e.hp < e.maxHp * 0.5) {
    e.splitDone = true;
    for (let k = 0; k < 2; k++) { const c = spawnEnemy(e.d.split, e.x + (k ? 7 : -7), e.y, G.wave.num); c.emergeT = 0; c.kx = k ? 60 : -60; c.ky = -30; }
    sparks(e.x, e.y, ENEMY_COL[e.type], 12, 90); dust(e.x, e.y, 2, 'rgba(200,215,230,0.5)'); if (nearLocal(e)) sfx.web();
  }
  // Cam Gölgesi: vurulunca iki cam kopya çıkarır ve aralarına karışır
  if (e.d.mirror && !e.illusion && e.mirrorCd <= 0) {
    e.mirrorCd = e.d.mirror;
    const spots = [[e.x, e.y]];
    for (let tries = 0; tries < 12 && spots.length < 3; tries++) {
      const a = rnd() * Math.PI * 2, rr = 14 + rnd() * 12, nx = e.x + Math.cos(a) * rr, ny = e.y + Math.sin(a) * rr;
      if (!blocked(e, nx, ny) && ny > GROUND_Y + 4) spots.push([nx, ny]);
    }
    const mine = Math.floor(rnd() * spots.length);
    spots.forEach(([sx, sy], i) => {
      if (i === mine) { e.px = e.x = sx; e.py = e.y = sy; return; }
      const il = spawnEnemy('mirrorling', sx, sy, G.wave.num);
      il.illusion = true; il.hp = il.maxHp = 1; il.dmgMul = 0; il.emergeT = 0; il.anim = e.anim; il.face = e.face;
    });
    for (const [sx, sy] of spots) { sparks(sx, sy, '#d8f8ff', 6, 70); ring(sx, sy, '#d8f8ff', 12); }
    if (nearLocal(e)) sfx.shade();
  }
}
export function burnEnemy(e, t) { if (!e.dead) e.burnT = Math.max(e.burnT, t); }
function nearLocal(e) { const l = G.player; return Math.hypot(l.x - e.x, l.y - e.y) < 200; }

export function killEnemy(e) {
  if (e.dead) return;
  if (e.illusion) { e.hp = 0; e.dead = true; e.dieT = 0.2; sparks(e.x, e.y, '#d8f8ff', 8, 80); return; } // cam kopya: ganimet yok, sayılmaz
  e.hp = 0; e.dead = true; e.dieT = e.d.boss ? 0.9 : 0.42;
  if (e.d.boss) markJourney('boss', e.x, e.y);
  e.dieDx = e.hitDx || 0; e.dieDy = e.hitDy || 0;
  const col = ENEMY_COL[e.type];
  sparks(e.x, e.y, col, e.d.boss ? 30 : 8, e.d.boss ? 150 : 80);
  sparks(e.x, e.y, '#ff5a4a', 3, 50);
  dust(e.x, e.y, e.d.boss ? 6 : 2, 'rgba(120,90,110,0.5)');
  if (nearLocal(e) || e.d.boss) sfx.enemyDie(e.d.boss || e.type === 'brute');
  G.stats.kills++;
  if (e.elite) {
    G.stats.elites++;
    const n = ELITE.gold * (hasPerk('altinDamar') ? 2 : 1);
    for (let i = 0; i < n; i++) spawnOrb(e.x, e.y, 'gold', true);
    ring(e.x, e.y, '#ffd24a', 30); sparks(e.x, e.y, '#ffd24a', 14, 120); flashLight(e.x, e.y, 5, 0.4); shake(0.2);
    emit('toast', { text: 'Elit ' + eliteName(e) + ' düştü', icon: 'elite' });
    if (e.aff && e.aff.includes('patlar')) explode(e.x, e.y, AFFIX.patlar.boom, 20 * e.dmgMul);
    if (e.aff && e.aff.includes('bolun') && !e.d.boss) for (let k = 0; k < AFFIX.bolun.split; k++) {
      const c = spawnEnemy(e.type, e.x + (k ? 6 : -6), e.y, 0); c.hp = c.maxHp = e.maxHp / ELITE.hp * AFFIX.bolun.hp; c.scale = 0.8; c.emergeT = 0; c.kx = k ? 50 : -50; c.dmgMul = e.dmgMul / ELITE.dmg;
    }
  }
  if (e.d.spawnOnDeath && rnd() < e.d.spawnOnDeath[2]) {
    for (let i = 0; i < e.d.spawnOnDeath[1]; i++) spawnEnemy(e.d.spawnOnDeath[0], e.x + (i ? 4 : -4), e.y, G.wave.num).emergeT = 0.25;
  }
  if (e.d.boom) explode(e.x, e.y, e.d.boom, e.d.dmg * e.dmgMul);
  if (e.d.boss) { for (const [res, n] of e.d.loot) for (let i = 0; i < n; i++) spawnOrb(e.x, e.y, res, true);
    shake(0.7); hitstop(0.2); ring(e.x, e.y, e.d.col, 50); ring(e.x, e.y, '#ffffff', 30); sparks(e.x, e.y, e.d.col, 30, 170); flashLight(e.x, e.y, 9, 0.8); haptic([40, 60, 120]); }
  else if (e.d.loot) { for (const [res, n] of e.d.loot) for (let i = 0; i < n; i++) spawnOrb(e.x, e.y, res, true); shake(0.25); }
  if (e.sack > 0) { for (let i = 0; i < e.sack; i++) spawnOrb(e.x, e.y, 'gold', true); ring(e.x, e.y, '#ffd870', 24); emit('toast', { text: 'Çalınan ' + e.sack + ' altın geri düştü', icon: 'gold' }); }
  else if (e.type === 'brute' || e.type === 'worm' || e.type === 'lurker') { spawnOrb(e.x, e.y, 'iron', true); spawnOrb(e.x, e.y, 'iron', true); spawnOrb(e.x, e.y, 'cobalt', true); shake(0.25); }
  else if (e.type === 'glarer' && rnd() < 0.6) spawnOrb(e.x, e.y, 'crystal', true);
  else if (rnd() < 0.35) spawnOrb(e.x, e.y, rnd() < 0.75 ? 'iron' : 'water', true);
  if (hasPerk('yasamOzu')) for (const p of G.players) if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + 3);
  if (hasPerk('lesKazisi') && rnd() < 0.25) { const st = stratumOfRow(Math.floor(e.y / TILE)); spawnOrb(e.x, e.y, st >= 8 ? 'crystal' : st >= 4 ? 'gold' : st >= 2 ? 'cobalt' : 'iron', true); }
}

export function explode(x, y, rad, dmg) {
  sfx.explode(); shake(0.35); haptic(40);
  ring(x, y, '#e070ff', rad); sparks(x, y, '#e070ff', 16, 140); sparks(x, y, '#ffd8ff', 6, 90); flashLight(x, y, 5, 0.3);
  for (const p of G.players) if (!p.dead && Math.hypot(p.x - x, p.y - y) < rad + 4) damagePlayer(p, dmg, x, y);
  for (const s of G.structures) if (Math.hypot(s.x - x, s.y - y) < rad + 6) damageStructure(s, dmg);
  for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < rad) damageEnemy(e, 18, 0, 0, 0);
  igniteGas(x, y, rad);
  // barikatları da sarsar
  const c0 = Math.floor(x / TILE), r0 = Math.floor(y / TILE);
  for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) if (tileAt(c, r) === T.BARRICADE) hurtBarricade(c, r, dmg);
}

export function damageStructure(s, d) {
  s.hp -= d; s.hurtT = 0.15;
  sparks(s.x, s.y, '#ffd48a', 3, 60);
  if (s.hp <= 0) {
    s.dead = true; debris(s.x, s.y, 'stone', 12); sparks(s.x, s.y, '#ffd48a', 10, 100); shake(0.2); sfx.explode();
    emit('toast', { text: BUILDS[s.type].name + ' yıkıldı', icon: BUILDS[s.type].icon, bad: true });
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

export function aliveEnemies() { let n = 0; for (const e of G.enemies) if (!e.dead) n++; return n; }

// ---------- güncelleme ----------
export function updateEnemies(dt) {
  const arken = hasRelic('arken');
  for (const e of G.enemies) {
    if (e.dead) { e.dieT -= dt; continue; }
    // Arkentaş: taşıyanın ışığına giren düşman yarı hıza düşer
    if (arken && !e.d.boss && G.players.some(q => !q.dead && Math.hypot(q.x - e.x, q.y - e.y) < 64)) e.slowT = Math.max(e.slowT, 0.12);
    e.px = e.x; e.py = e.y;
    e.anim += dt * (e.d.fly ? 12 : 7);
    if (e.hitT > 0) e.hitT -= dt;
    if (e.flashT > 0) e.flashT -= dt;
    e.sinceHit += dt;
    if (e.aff) {
      if (e.shieldMax && e.sinceHit > AFFIX.kalkan.refill && e.shield < e.shieldMax) e.shield = Math.min(e.shieldMax, e.shield + e.shieldMax * 0.25 * dt);
      if (e.aff.includes('yenilen') && e.sinceHit > AFFIX.yenilen.after) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * AFFIX.yenilen.regen * dt);
    }
    if (e.blinkT > 0) e.blinkT -= dt;
    // yanma: periyodik hasar + alev parçacığı
    if (e.burnT > 0) {
      e.burnT -= dt; e.burnTick -= dt;
      if (rnd() < dt * 14) particle(e.x + (rnd() - 0.5) * e.r * 2, e.y - rnd() * e.r, (rnd() - 0.5) * 10, -25 - rnd() * 20, 0.25, rnd() < 0.5 ? '#ffe79a' : '#ff9a4a', 1, 1, 0);
      if (e.burnTick <= 0) { e.burnTick = 0.25; damageEnemy(e, BURN.dps * 0.25, 0, 0, 0, true); if (e.dead) continue; }
    }
    // Kor Böceği arkasında kor izi bırakır (kozmetik)
    if (e.d.burnTrail && rnd() < dt * 8) particle(e.x + (rnd() - 0.5) * 6, e.y + e.r - 1, (rnd() - 0.5) * 6, -6 - rnd() * 8, 0.6, '#ff7a3a', 1, 1, -10);
    if (e.howlT > 0) e.howlT -= dt;
    if (e.mirrorCd > 0) e.mirrorCd -= dt;
    if (e.emergeT > 0) {
      e.emergeT -= dt;
      if (rnd() < 0.4) debris(e.x, e.y + 4, 'dirt', 1, 0.4);
      continue;
    }
    // sıkışma kurtarma: kutusu kayaya taşmışsa hücre merkezine kay (doğuş/savrulma kenar durumları)
    if (!e.d.fly && !e.under && blocked(e, e.x, e.y)) {
      const cx = Math.floor(e.x / TILE) * TILE + 8, cy = Math.floor(e.y / TILE) * TILE + 8;
      e.x += Math.sign(cx - e.x) * Math.min(Math.abs(cx - e.x), 40 * dt);
      e.y += Math.sign(cy - e.y) * Math.min(Math.abs(cy - e.y), 40 * dt);
    }
    // savrulma
    if ((e.kx || e.ky) && !e.under) {
      moveE(e, e.kx * dt, e.ky * dt);
      e.kx *= Math.exp(-10 * dt); e.ky *= Math.exp(-10 * dt);
      if (Math.abs(e.kx) + Math.abs(e.ky) < 2) e.kx = e.ky = 0;
    }
    e.atkCd -= dt;
    e.wind = 0;
    if (e.slowT > 0) e.slowT -= dt; else if (e.slowT < 0) e.slowT = Math.min(0, e.slowT + dt);
    const sp = e.d.speed * e.spMul * (e.slowT > 0 ? 0.5 : e.slowT < 0 ? 1.35 : 1);
    const p = nearestPlayer(e.x, e.y);
    const dp = p ? Math.hypot(p.x - e.x, p.y - e.y) : 1e9;
    // yeraltında oyuncu yok ya da çok uzak: izi kaybeder, geri çekilir
    const anyUnder = G.players.some(q => !q.dead && q.y >= GROUND_Y);
    if (!anyUnder || (dp > 420 && !e.d.boss)) { e.lostT += dt; if (e.lostT > (e.d.boss ? 12 : 5)) { retreat(e); continue; } } else e.lostT = 0;
    if (e.d.boss && updateBoss(e, dt, p, dp)) continue;

    // Kaya Devi adımları: kare değişiminde toz ve yer sarsıntısı
    if (e.type === 'brute' || (e.d.boss && !e.d.fly) || e.d.stomp) {
      const f = Math.floor(e.anim) % 2;
      if (f !== e.lastF && (Math.abs(e.x - e.px) > 0.05 || Math.abs(e.y - e.py) > 0.05)) { dust(e.x, e.y + e.r, 1, 'rgba(160,140,130,0.45)'); if (nearLocal(e)) shake(e.d.boss ? 0.08 : 0.04); }
      e.lastF = f;
    }

    // --- yol üstündeki alet ---
    let hitStruct = false;
    for (const s of G.structures) if (!s.dead && Math.hypot(s.x - e.x, s.y - e.y) < 9 + e.r) {
      e.wind = windup(e); if (e.atkCd <= 0) { attack(e, s); } hitStruct = true; break;
    }
    if (hitStruct) { e.st = 'struct'; continue; }
    if (e.d.burrow) { trackTrail(e); if (updateWorm(e, dt, sp, p, dp)) continue; }

    // --- özel yetenekler ---
    if (e.d.brood) {
      e.broodT -= dt;
      // yavru sınırı: çevrede 4 yavru varken yenisini bırakmaz (sonsuz sürü olmasın)
      if (e.broodT <= 0 && G.enemies.filter(o => !o.dead && o.type === 'spiderling' && Math.hypot(o.x - e.x, o.y - e.y) < 120).length >= 4) e.broodT = 1;
      else if (e.broodT <= 0) {
        e.broodT = e.d.brood;
        for (let k = 0; k < 2; k++) spawnEnemy('spiderling', e.x + (k ? 5 : -5), e.y + 2, G.wave.num).emergeT = 0.3;
        ring(e.x, e.y, '#8a6aaa', 20); if (nearLocal(e)) sfx.brood();
        e.lunge = 1;
      }
    }
    if (updateSignature(e, dt, p, dp)) continue;
    if (e.d.blink && p) {
      e.blinkCd -= dt;
      if (e.blinkCd <= 0 && dp > 34 && dp < 170) {
        // oyuncunun yanına ışınlan: boş bir hücre bul
        let tx = null, ty = null;
        for (let tries = 0; tries < 10; tries++) {
          const a = rnd() * Math.PI * 2, rr = 22 + rnd() * 14;
          const nx = p.x + Math.cos(a) * rr, ny = p.y + Math.sin(a) * rr;
          if (!blocked(e, nx, ny) && ny > GROUND_Y - 20) { tx = nx; ty = ny; break; }
        }
        if (tx !== null) {
          sparks(e.x, e.y, '#7a6aff', 8, 80); ring(e.x, e.y, '#7a6aff', 14);
          e.px = e.x = tx; e.py = e.y = ty; e.blinkCd = e.d.blinkCd; e.blinkT = 0.3; e.atkCd = Math.max(e.atkCd, 0.5);
          sparks(e.x, e.y, '#c0b8ff', 10, 90); ring(e.x, e.y, '#c0b8ff', 20); flashLight(e.x, e.y, 4, 0.2);
          if (nearLocal(e)) sfx.blink();
        }
      }
    }
    if (e.d.blind && p) {
      e.blindCd -= dt;
      if (e.blindCd <= 0 && dp < e.d.blindRange && losClear(e.x, e.y, p.x, p.y)) {
        e.blindCd = e.d.blindCd; e.flashT = 0.35;
        for (const q of G.players) if (!q.dead && Math.hypot(q.x - e.x, q.y - e.y) < e.d.blindRange + 10 && losClear(e.x, e.y, q.x, q.y)) blindPlayer(q, 1.5);
        flashLight(e.x, e.y, 9, 0.35); ring(e.x, e.y, '#ffe79a', 30); sparks(e.x, e.y, '#fff8d0', 10, 90);
        if (nearLocal(e)) sfx.glare();
      }
    }
    if (e.d.howl && p) {
      e.howlCd -= dt;
      if (e.howlCd <= 0 && dp < e.d.howlRange && losClear(e.x, e.y, p.x, p.y)) {
        e.howlCd = e.d.howlCd; e.howlT = 0.9;
        for (const q of G.players) if (!q.dead && Math.hypot(q.x - e.x, q.y - e.y) < e.d.howlRange + 10) scarePlayer(q, 2.4);
        ring(e.x, e.y, '#8a5a7a', 40); ring(e.x, e.y, '#c08ab0', 24);
        // çığlık yakındaki düşmanları cesaretlendirir: kısa hız artışı
        const hr = e.d.echoNoise ? 150 : 70;
        for (const o of G.enemies) if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < hr) o.slowT = e.d.echoNoise ? -2.5 : -1.5;
        // Yankıcı: uluması madende yankılanır, ölçer yükselir
        if (e.d.echoNoise) { addNoise(e.d.echoNoise, e.x, e.y); ring(e.x, e.y, '#8a86b0', 64); }
        if (nearLocal(e) || dp < 140) sfx.howl();
      }
      if (e.howlT > 0) { e.st = 'howl'; continue; }
    }
    if (e.d.pull && p) {
      if (e.tongue > 0) {
        // dil dışarıda: oyuncuyu kendine çek
        e.tongue -= dt;
        const d = dp || 1;
        if (dp < e.d.pullRange + 12 && losClear(e.x, e.y, p.x, p.y)) { pullPlayer(p, (e.x - p.x) / d * 5.5, (e.y - p.y) / d * 5.5); e.tx = p.x; e.ty = p.y; }
        else e.tongue = 0;
        e.face = p.x > e.x ? 1 : -1;
        e.st = 'pull';
        if (dp > e.r + 7) continue;
      } else {
        e.tongueCd -= dt;
        if (e.tongueCd <= 0 && dp < e.d.pullRange && dp > 20 && losClear(e.x, e.y, p.x, p.y)) {
          e.tongueCd = 3.2; e.tongue = 0.7; e.tx = p.x; e.ty = p.y;
          if (nearLocal(e)) sfx.tongue();
        }
      }
    }

    // --- menzilli ---
    if (e.d.ranged) {
      e.fireCd -= dt;
      let tx = null, ty = 0;
      // görüş, oyuncunun omuz silahıyla aynı noktadan: o bizi göremiyorsa biz de ona ateş etmeyiz (tek yönlü kilitlenme olmasın)
      if (p && dp < e.d.range && losClear(e.x, e.y, p.x - p.face * 3, p.y - 5, true)) { tx = p.x; ty = p.y; }
      if (tx !== null) {
        e.face = tx > e.x ? 1 : -1;
        e.wind = e.fireCd < 0.35 ? 1 - e.fireCd / 0.35 : 0;
        if (e.fireCd <= 0) {
          e.fireCd = e.d.fireCd; e.lunge = 0.6;
          const d = Math.hypot(tx - e.x, ty - e.y) || 1;
          if (e.d.web) {
            G.ebullets.push({ x: e.x + e.face * 4, y: e.y - 2, vx: (tx - e.x) / d * 120, vy: (ty - e.y) / d * 120, life: 1.2, dmg: e.d.dmg * 0.4 * e.dmgMul, web: true });
            sparks(e.x + e.face * 5, e.y - 2, '#f0f0ff', 3, 40);
            if (nearLocal(e)) sfx.web();
          } else {
            G.ebullets.push({ x: e.x + e.face * 4, y: e.y - 2, vx: (tx - e.x) / d * 105, vy: (ty - e.y) / d * 105, life: 1.4, dmg: e.d.dmg * e.dmgMul });
            sparks(e.x + e.face * 5, e.y - 2, '#9af060', 3, 40);
            if (nearLocal(e)) sfx.spit();
          }
        }
        e.st = 'ranged';
        // yalnızca hedefe gerçekten yakınken durur; aksi halde ateş ederken yürür (tüneli tıkamasın)
        if (dp < 40) continue;
      }
    }

    // --- oyuncuya saldırı (yakında ve görüşte) ---
    if (p && dp < 60 && losClear(e.x, e.y, p.x, p.y)) {
      e.st = 'chase';
      if (dp < e.r + 7) { e.wind = windup(e); e.face = p.x >= e.x ? 1 : -1; if (e.atkCd <= 0) attack(e, p); continue; }
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
      // alan çözümsüz: doğrudan oyuncuya yönel (kayayı kazarak), oyuncu yoksa bekle
      e.st = 'hunt';
      if (!p) continue;
      const d = dp || 1;
      moveE(e, (p.x - e.x) / d * sp * dt, (p.y - e.y) / d * sp * dt);
      e.face = p.x > e.x ? 1 : -1;
      continue;
    }
    const nt = tileAt(nx.c, nx.r);
    if (TD[nt].relic) { e.st = 'wait'; continue; }
    if (TD[nt].solid) {
      e.st = 'dig';
      e.face = nx.c > c ? 1 : nx.c < c ? -1 : e.face;
      if (nt === T.BARRICADE) { e.wind = windup(e); if (e.atkCd <= 0) { e.atkCd = 1; e.lunge = 1; hurtBarricade(nx.c, nx.r, e.d.dmg); } }
      else {
        if (damageTile(nx.c, nx.r, digRate * dt)) breakTile(nx.c, nx.r, null);
        if (rnd() < dt * 6) debris(nx.c * TILE + 8 - (nx.c - c) * 6, nx.r * TILE + 8 - (nx.r - r) * 6, 'dirt', 1, 0.3);
        e.lunge = 0.3 + Math.abs(Math.sin(e.anim * 2)) * 0.5;
      }
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
      const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * (a.d.small || b.d.small ? 0.6 : 0.8), d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2), push = (min - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        if (!a.d.boss) moveE(a, -ux * push, -uy * push);
        if (!b.d.boss) moveE(b, ux * push, uy * push);
      }
    }
  }
  for (const e of es) {
    if (e.lunge) e.lunge = Math.max(0, e.lunge - dt * 5);
    // hız (çizimde ezilme/uzama için)
    e.vx = (e.x - e.px) / dt; e.vy = (e.y - e.py) / dt;
  }
  // ölüleri temizle (ölüm animasyonu bittikten sonra)
  let j = 0;
  for (const e of es) if (!e.dead || e.dieT > 0) es[j++] = e;
  es.length = j;
}

// saldırıdan hemen önce geri çekilme miktarı (0..1)
function windup(e) { return e.atkCd > 0 && e.atkCd < 0.3 ? 1 - e.atkCd / 0.3 : 0; }
// izini kaybetti: kayaya gömülür (listeden düşer)
function retreat(e) {
  e.dead = true; e.hp = 0; e.dieT = 0.01;
  dust(e.x, e.y, 3, 'rgba(120,90,110,0.5)'); debris(e.x, e.y, 'dirt', 4, 0.5);
  if (nearLocal(e)) sfx.burrow();
}

// ---------- Maden Solucanı: oyuncuyu kayanın içinden avlar, arkasında tünel bırakır ----------
function trackTrail(e) {
  const tr = e.trail, last = tr[0];
  if (!last || Math.hypot(last.x - e.x, last.y - e.y) >= 5) { tr.unshift({ x: e.x, y: e.y }); if (tr.length > 4) tr.pop(); }
}
function wormCellOk(t) { const d = TD[t]; return !(d.unbreakable || d.heart || d.chest || d.relic); }
function updateWorm(e, dt, sp, p, dp) {
  // oyuncu derindeyse ve yakınsa onu avlar; değilse normal (her şeyi kazan) akışla üsse gider
  if (!p || p.y < GROUND_Y + 8 || dp > 220) { e.wc = undefined; return false; }
  e.st = 'hunt';
  if (dp < e.r + 8) { e.wind = windup(e); if (e.atkCd <= 0) attack(e, p); return true; }
  const c = Math.floor(e.x / TILE), r = Math.floor(e.y / TILE);
  const atCenter = e.wc !== undefined && Math.abs(e.x - (e.wc * TILE + 8)) < 1.5 && Math.abs(e.y - (e.wr * TILE + 8)) < 1.5;
  if (e.wc === undefined || atCenter || !wormCellOk(tileAt(e.wc, e.wr))) {
    const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
    let best = 1e9, bc = c, br = r;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, t = tileAt(nc, nr);
      if (nr < GROUND_ROW || !wormCellOk(t)) continue;
      const sc = Math.hypot(nc - pc, nr - pr) + (nc === e.lc && nr === e.lr ? 2.5 : 0) + (TD[t].solid ? 0.2 : 0);
      if (sc < best) { best = sc; bc = nc; br = nr; }
    }
    if (bc === c && br === r) return false;
    e.lc = c; e.lr = r; e.wc = bc; e.wr = br;
  }
  const nt = tileAt(e.wc, e.wr);
  if (TD[nt].solid) {
    if (nt === T.BARRICADE) { if (e.atkCd <= 0) { e.atkCd = 1; e.lunge = 1; hurtBarricade(e.wc, e.wr, e.d.dmg); } }
    else {
      if (damageTile(e.wc, e.wr, e.d.digRate * dt)) breakTile(e.wc, e.wr, null);
      if (rnd() < dt * 10) debris(e.wc * TILE + 8 - (e.wc - c) * 6, e.wr * TILE + 8 - (e.wr - r) * 6, 'dirt', 1, 0.4);
      if (dp < 110 && nearLocal(e)) sfx.burrow();
    }
    e.face = e.wc > c ? 1 : e.wc < c ? -1 : e.face;
    return true;
  }
  const tx = e.wc * TILE + 8, ty = e.wr * TILE + 8, d = Math.hypot(tx - e.x, ty - e.y) || 1;
  const step = Math.min(d, sp * dt);
  e.x += (tx - e.x) / d * step; e.y += (ty - e.y) / d * step;
  if (Math.abs(tx - e.x) > 0.5) e.face = tx > e.x ? 1 : -1;
  return true;
}

// target: oyuncu nesnesi | alet
function attack(e, target) {
  e.atkCd = e.d.small ? 0.7 : 1; e.lunge = 1; e.wind = 0;
  const dmg = e.d.dmg * e.dmgMul;
  if (e.illusion) { killEnemy(e); return; } // cam kopya dokununca dağılır
  if (e.d.boom) { e.hp = 0; killEnemy(e); return; }
  if (target.bag) {
    const hp0 = target.hp;
    damagePlayer(target, dmg, e.x, e.y);
    if (e.d.chill) { chillPlayer(target, 1.8); sparks(target.x, target.y, '#bff4ff', 6, 50); }
    if (target.hp < hp0) {
      // Altın Muhafız: vuruşta çantadan altın çalar (ölünce geri düşer)
      if (e.d.thief) {
        const n = Math.min(e.d.thief, target.bag.gold | 0);
        if (n > 0) { target.bag.gold -= n; e.sack += n; sparks(target.x, target.y - 4, '#ffd870', 10, 90); if (target === G.player) emit('toast', { text: 'Altın Muhafız ' + n + ' altın çaldı', icon: 'gold', bad: true }); }
      }
      // Kan Sülüğü: kan emer, iyileşir ve büyür; sen kanarsın
      if (e.d.drain) {
        const real = hp0 - target.hp;
        e.maxHp = Math.min(e.baseMax * 2, e.maxHp + real); e.hp = Math.min(e.maxHp, e.hp + real * 1.5);
        e.scale = Math.min(1.6, e.scale + 0.12); e.r = e.d.r * e.scale;
        target.bleedT = 4; sparks(target.x, target.y, '#e02a3a', 10, 70); sparks(e.x, e.y, '#ff9aa0', 4, 40);
        if (target === G.player) emit('toast', { text: 'Kanıyorsun — Sülük büyüyor', icon: 'skull', bad: true });
      }
    }
  }
  else damageStructure(target, dmg);
}

// ---------- derin biyom imza davranışları ----------
// true dönerse bu karede başka bir şey yapmaz
function updateSignature(e, dt, p, dp) {
  const d = e.d;
  // Yıldırım Yarasası: görüşteyse yıldırım çarpar; kısa süre ağdaymış gibi yavaşlatır
  if (d.zap && p) {
    e.zapCd -= dt;
    if (e.zapCd <= 0 && dp < d.zapRange && losClear(e.x, e.y, p.x, p.y)) {
      e.zapCd = d.zapCd; e.flashT = 0.25; e.lunge = 1;
      G.zaps.push({ x0: e.x, y0: e.y, x1: p.x, y1: p.y - 4, t: 0.12 });
      damagePlayer(p, d.dmg * e.dmgMul * 0.8, e.x, e.y); webPlayer(p, 0.7);
      for (const s of G.structures) if (!s.dead && Math.hypot(s.x - e.x, s.y - e.y) < d.zapRange) { damageStructure(s, 8); G.zaps.push({ x0: e.x, y0: e.y, x1: s.x, y1: s.y - 4, t: 0.12 }); }
      sparks(p.x, p.y, '#9ad8ff', 8, 80); flashLight(e.x, e.y, 5, 0.2); if (nearLocal(e)) sfx.zap();
    }
  }
  // Spor Böceği: spor bulutu; dostları iyileştirir, oyuncuyu yavaşlatır
  if (d.puff && p && dp < 120) {
    e.puffT -= dt;
    if (e.puffT <= 0) {
      e.puffT = d.puff; e.lunge = 1;
      ring(e.x, e.y, '#a8f070', 44); dust(e.x, e.y, 5, 'rgba(150,230,120,0.5)');
      for (const o of G.enemies) if (!o.dead && o !== e && !o.illusion && Math.hypot(o.x - e.x, o.y - e.y) < 60) { o.hp = Math.min(o.maxHp, o.hp + 15); sparks(o.x, o.y, '#a8f070', 3, 40); }
      for (const q of G.players) if (!q.dead && Math.hypot(q.x - e.x, q.y - e.y) < 46) { q.slowT = Math.max(q.slowT, 1.6); if (q === G.player) emit('toast', { text: 'Spor bulutu: yavaşladın', icon: 'wave', bad: true }); }
      if (nearLocal(e)) sfx.gas();
    }
  }
  // Dev Parçası: yere vurur; sarsıntı hasar verir, tavandan kaya düşer
  if (d.quake && p && !p.dead) {
    e.quakeCd -= dt;
    if (e.quakeCd <= 0 && dp < d.quakeRange && p.y > GROUND_Y + 8) {
      e.quakeCd = d.quake; e.lunge = 1; e.atkCd = Math.max(e.atkCd, 0.6);
      ring(e.x, e.y + e.r, '#7a9a78', 60); dust(e.x, e.y + e.r, 8, 'rgba(160,140,130,0.55)'); shake(0.5); hitstop(0.05); sfx.rumble();
      for (const q of G.players) if (!q.dead && Math.hypot(q.x - e.x, q.y - e.y) < d.quakeRange) {
        damagePlayer(q, 10 * e.dmgMul, e.x, e.y + 20); q.slowT = Math.max(q.slowT, 0.8);
        // üstündeki kayalar sarsılır: bir iki taş düşer
        const pc = Math.floor(q.x / TILE), pr = Math.floor(q.y / TILE);
        let n = 0;
        for (let r = pr - 1; r >= pr - 6 && n < 2; r--) for (let c = pc - 2; c <= pc + 2 && n < 2; c++) {
          const t = tileAt(c, r);
          if (TD[t].plain && tileAt(c, r + 1) === T.AIR && rnd() < 0.5) { const mat = matOf(c, r); setTile(c, r, T.AIR); G.rocks.push({ x: c * TILE + 8, y: r * TILE + 8, vy: 20, mat }); n++; }
        }
        if (n) sfx.rockfall();
      }
      for (const s of G.structures) if (!s.dead && Math.hypot(s.x - e.x, s.y - e.y) < d.quakeRange) damageStructure(s, 12);
    }
  }
  // Zaman Gözü: seni 3 sn önceki yerine geri sarar
  if (d.rewind && p && !p.dead) {
    e.rewindCd -= dt;
    if (e.rewindCd <= 0 && dp < d.rewindRange && losClear(e.x, e.y, p.x, p.y) && p.hist && p.hist.length >= 60) {
      e.rewindCd = d.rewind; e.blinkT = 0.3; e.lunge = 1;
      const hx = p.hist[0], hy = p.hist[1];
      if (!solidAt(Math.floor(hx / TILE), Math.floor(hy / TILE)) && Math.hypot(hx - p.x, hy - p.y) > 12) {
        ring(p.x, p.y, '#ffd890', 26); sparks(p.x, p.y, '#ffd890', 10, 80);
        p.x = p.px = hx; p.y = p.py = hy; p.iframes = Math.max(p.iframes, 0.5); p.dig = null;
        ring(p.x, p.y, '#ffffff', 20); flashLight(p.x, p.y, 4, 0.3); if (nearLocal(e)) sfx.blink();
        if (p === G.player) { shake(0.25); emit('toast', { text: 'Zaman Gözü seni geri sardı', icon: 'depth', bad: true }); }
      }
    }
  }
  // Işık Bekçisi: yargı ışını — nişan alır (0.9 sn), görüşten çıkmazsan çarpar ve kör eder
  if (d.judge && p) {
    if (e.beamT > 0) {
      e.beamT -= dt; e.st = 'judge';
      const q = G.players[e.beamP];
      if (!q || q.dead) { e.beamT = 0; return false; }
      e.face = q.x >= e.x ? 1 : -1;
      if (e.beamT <= 0) {
        const dq = Math.hypot(q.x - e.x, q.y - e.y);
        if (dq < d.judgeRange + 30 && losClear(e.x, e.y, q.x, q.y)) {
          G.zaps.push({ x0: e.x, y0: e.y - 2, x1: q.x, y1: q.y - 4, t: 0.12, col: '#fff4c0' });
          damagePlayer(q, 22 * e.dmgMul, e.x, e.y); blindPlayer(q, 0.8);
          sparks(q.x, q.y, '#fff4c0', 14, 110); flashLight(q.x, q.y, 8, 0.3); ring(q.x, q.y, '#fff4c0', 18);
          if (nearLocal(e)) sfx.glare();
        } else sparks(e.x, e.y, '#fff4c0', 4, 40);
      }
      return true;
    }
    e.judgeCd -= dt;
    if (e.judgeCd <= 0 && dp < d.judgeRange && dp > 24 && losClear(e.x, e.y, p.x, p.y)) {
      e.judgeCd = d.judge; e.beamT = 0.9; e.beamP = p.i; e.flashT = 0.9;
      if (nearLocal(e)) sfx.arm();
    }
  }
  return false;
}
