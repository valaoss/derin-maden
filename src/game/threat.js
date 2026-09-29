// Uyanış: dalga yok, zamanlayıcı yok. Kazma, ateş ve patlama gürültü üretir; gürültü yuvaları uyandırır.
// Seviyeler: 0 sessiz · 1 kıpırtı · 2 uyanış · 3 öfke · 4 boss (derinliğe göre biri uyanır, seni avlar).
// Yuvalar haritaya gömülü kovanlardır (T.NEST). Uyanık yuva yakınındaki oyuncuya düşman çıkarır; yıkılınca ganimet ve sessizlik.
// Bir biyomdaki tüm yuvalar yıkılınca Fener dikilir (kalıcı ilerleme).
import { rnd } from '../core/rng.js';
import { TILE, COLS, ROWS, GROUND_ROW, GROUND_Y, STRATUM_ROWS, STRATA_COUNT, PLAY_MIN_COL, PLAY_MAX_COL, stratumOfRow } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { THREAT, ENEMIES, WAVES, BUILDS, ELITE } from '../data/balance.js';
import { G, biomeOf } from './state.js';
import { STRATA } from '../data/palette.js';
import { tileAt, setTile } from '../world/map.js';
import { spawnEnemy, aliveEnemies, makeElite } from './enemies.js';
import { bossForY } from './bosses.js';
import { spawnOrb } from './player.js';
import { debris, dust, ring, sparks, shake, flashLight } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';
import { markJourney } from './journey.js';

export const LEVEL_NAMES = ['SESSİZ', 'KIPIRTI', 'UYANIŞ', 'ÖFKE', 'AV'];

export function makeThreat() { return { noise: 0, level: 0, quietT: 0, seepT: 0, bossUp: false, bossCd: 0, peak: 0, fullT: 0, warned: false, bossType: '' }; }

// haritadaki yuvaları listele (sefer başı ve yükleme)
export function scanNests() {
  const out = [];
  for (let r = GROUND_ROW; r < ROWS; r++) for (let c = PLAY_MIN_COL; c <= PLAY_MAX_COL; c++) if (G.map[r * COLS + c] === T.NEST) out.push({ c, r, x: c * TILE + 8, y: r * TILE + 8, cd: 3 + rnd() * 3, awake: false, pulse: rnd() * 6 });
  return out;
}
export function nestsInStratum(s) { return G.nests.filter(n => stratumOfRow(n.r) === s).length; }
export function nestTotalInStratum(s) { return (G.nestTotal && G.nestTotal[s]) | 0; }

function levelOf(noise) { return noise >= 99.5 ? 4 : noise >= 75 ? 3 : noise >= 50 ? 2 : noise >= 25 ? 1 : 0; }

// gürültü ekle: derinlik çarpar, Fener Direği yakınında yarıya iner
export function addNoise(a, x, y) {
  const th = G.threat; if (!th || G.over) return;
  if (G.tutorial && G.tutorial.step < 3) return;
  const st = Math.max(0, stratumOfRow(Math.floor(y / TILE)));
  let m = (1 + st * THREAT.depthMul) * (G.mods.noise || 1) * (STRATA[biomeOf(st)].noiseMul || 1);
  for (const s of G.structures) if (s.type === 'lamp' && Math.hypot(s.x - x, s.y - y) < BUILDS.lamp.range) { m *= 0.5; break; }
  if (G.evt && G.evt.hushT > 0) m *= 0.5;
  th.noise = Math.min(100, th.noise + a * m);
  th.quietT = 0;
  if (th.noise > th.peak) th.peak = th.noise;
}

function nearestUnder(x, y, maxTiles) {
  let best = null, bd = maxTiles * TILE;
  for (const p of G.players) {
    if (p.dead || p.y < GROUND_Y) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function deepestUnder() {
  let best = null;
  for (const p of G.players) if (!p.dead && p.y >= GROUND_Y && (!best || p.y > best.y)) best = p;
  return best;
}

// biyomun imza düşmanı sık çıkar; derin biyomların (10+) imzaları yalnız kendi biyomunda görülür
function pickType(st, lv) {
  const b = biomeOf(st), sig = STRATA[b].sig;
  const allowed = WAVES.allowed(2 + lv * 2, st).filter(t => !ENEMIES[t].boss && !ENEMIES[t].small);
  if (sig && rnd() < (b >= 10 ? 0.55 : 0.4) && (b >= 10 || allowed.includes(sig))) return sig;
  return allowed[Math.floor(rnd() * allowed.length)] || 'rodent';
}
function hpTier(st, lv) { return 1 + st * 1.5 + lv; }

// yuvadan çıkış hücresi: komşu boşluk; yoksa oyuncuya doğru bir hücre patlatılır
function exitCell(n, p) {
  const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
  dirs.sort((a, b) => Math.hypot(n.c + a[0] - p.x / TILE, n.r + a[1] - p.y / TILE) - Math.hypot(n.c + b[0] - p.x / TILE, n.r + b[1] - p.y / TILE));
  for (const [dc, dr] of dirs) if (tileAt(n.c + dc, n.r + dr) === T.AIR) return { c: n.c + dc, r: n.r + dr };
  for (const [dc, dr] of dirs) {
    const t = tileAt(n.c + dc, n.r + dr), d = TD[t];
    if (n.r + dr < GROUND_ROW || !d.solid || d.unbreakable || d.chest || d.heart || d.nest) continue;
    setTile(n.c + dc, n.r + dr, T.AIR); debris((n.c + dc) * TILE + 8, (n.r + dr) * TILE + 8, 'stone', 8);
    return { c: n.c + dc, r: n.r + dr };
  }
  return null;
}

function spawnFrom(n, p, st, lv, count) {
  const cell = exitCell(n, p);
  if (!cell) return;
  for (let i = 0; i < count; i++) {
    const type = pickType(st, lv);
    const e = spawnEnemy(type, cell.c * TILE + 8 + (rnd() - 0.5) * 4, cell.r * TILE + 8 + (rnd() - 0.5) * 4, hpTier(st, lv));
    e.emergeT = 0.7 + i * 0.35;
    if (lv >= 3 && rnd() < THREAT.eliteChance) makeElite(e);
  }
  n.burst = 0.5;
  dust(n.x, n.y, 3, 'rgba(200,80,120,0.5)'); ring(n.x, n.y, '#ff5a8a', 14);
  if (Math.hypot(G.player.x - n.x, G.player.y - n.y) < 220) sfx.rumble();
}

// kayanın içinden sızma: yakın yuva yoksa (ya da hepsi yıkıldıysa) derin oyuncunun çevresinden
function seep(p, st, lv) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  for (let tries = 0; tries < 20; tries++) {
    const c = pc + Math.round((rnd() - 0.5) * 12), r = pr + 2 + Math.floor(rnd() * 6);
    if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r < GROUND_ROW + 2 || r >= ROWS - 2) continue;
    const d = TD[tileAt(c, r)];
    if (!d.solid || d.unbreakable || d.chest || d.heart || d.nest) continue;
    setTile(c, r, T.AIR); debris(c * TILE + 8, r * TILE + 8, 'stone', 8);
    const e = spawnEnemy(pickType(st, lv), c * TILE + 8, r * TILE + 8, hpTier(st, lv));
    e.emergeT = 0.9;
    if (lv >= 3 && rnd() < THREAT.eliteChance) makeElite(e);
    return;
  }
}

// Sürü olayı: oyuncunun altındaki kayadan birkaç yaratık sızar
export function swarm(p, n) {
  const st = Math.max(0, stratumOfRow(Math.floor(p.y / TILE)));
  for (let i = 0; i < n; i++) seep(p, st, 1);
}

function spawnBoss(p) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  for (let tries = 0; tries < 40; tries++) {
    const c = pc + Math.round((rnd() - 0.5) * 10), r = pr + 4 + Math.floor(rnd() * 5);
    if (c < PLAY_MIN_COL + 1 || c > PLAY_MAX_COL - 1 || r < GROUND_ROW + 3 || r >= ROWS - 3) continue;
    const d = TD[tileAt(c, r)];
    if (d.unbreakable || d.chest || d.heart || d.nest) continue;
    if (d.solid) setTile(c, r, T.AIR);
    const type = G.threat.bossType || bossForY(p.y);
    const e = spawnEnemy(type, c * TILE + 8, r * TILE + 8, hpTier(G.maxStratum, 4));
    e.emergeT = 1.4; G.threat.bossType = type;
    debris(e.x, e.y, 'stone', 16); ring(e.x, e.y, e.d.col, 30); shake(0.5); flashLight(e.x, e.y, 6, 0.6);
    emit('bossSpawn', type);
    sfx.alarm(); haptic([40, 60, 40, 60, 80]);
    return true;
  }
  return false;
}

export function updateThreat(dt) {
  const th = G.threat;
  th.quietT += dt;
  const anyUnder = G.players.some(p => !p.dead && p.y >= GROUND_Y);
  const bossAlive = G.enemies.some(e => e.d.boss && !e.dead);
  const lvBefore = levelOf(th.noise);
  // sönüm: yüzeyde hızlı; gürültü sürerken az; herkes hareketsizse fazla
  let decay = anyUnder ? THREAT.decay + th.level * THREAT.decayPerLevel : THREAT.surfaceDecay;
  if (th.quietT < THREAT.quietAfter) decay *= 0.35;
  if (anyUnder && G.players.every(p => p.dead || !p.moving)) decay *= 1.6;
  const dp = deepestUnder(), dst = dp ? Math.max(0, stratumOfRow(Math.floor(dp.y / TILE))) : 0;
  const floor = Math.min(THREAT.floorMax, dst * THREAT.floorPerStratum);
  if (!bossAlive) th.noise = Math.max(Math.min(th.noise, floor), th.noise - decay * dt);
  // boss öldü: ölçer sakinleşir
  if (th.bossUp && !bossAlive) { th.bossUp = false; th.noise = Math.min(th.noise, THREAT.afterBoss); th.bossCd = 20; G.stats.bosses++; emit('bossDown', th.bossType); th.bossType = ''; }
  if (th.bossCd > 0) th.bossCd -= dt;
  // tepe: boss hemen değil, birkaç saniye sonra uyanır (sessizleşme şansı); hangisi olduğu uyarıda belli olur
  if (lvBefore === 4 || levelOf(th.noise) === 4) {
    th.fullT += dt;
    if (!th.warned) { th.warned = true; const p = deepestUnder(); if (!bossAlive && p) th.bossType = bossForY(p.y); emit('bossWarn', th.bossType); }
  }
  else { th.fullT = 0; if (th.noise < 90) { th.warned = false; if (!bossAlive && !th.bossUp) th.bossType = ''; } }
  let lv = Math.min(3, Math.max(levelOf(th.noise), lvBefore));
  if (th.fullT >= THREAT.bossDelay && !th.bossUp && th.bossCd <= 0) lv = 4;
  if (bossAlive) lv = 4;
  if (lv !== th.level) {
    const up = lv > th.level; th.level = lv;
    emit('threat', { level: lv, up });
    if (up && lv >= 2) { sfx.alarm(); haptic([30, 60, 30]); }
  }
  // eski sistemlerle uyum (gök rengi, ambiyans)
  G.wave.phase = lv >= 2 ? 'active' : lv === 1 ? 'warn' : 'calm';
  G.wave.num = lv; G.wave.boss = lv === 4;

  const cap = Math.round(THREAT.cap[lv] * (G.mp ? 1.5 : 1));
  // boss
  if (lv === 4 && !bossAlive && th.bossCd <= 0) {
    const p = deepestUnder();
    if (p && spawnBoss(p)) th.bossUp = true; else th.bossCd = 3;
  }
  // yuvalar
  for (const n of G.nests) {
    if (n.burst > 0) n.burst -= dt;
    n.pulse += dt;
    const p = nearestUnder(n.x, n.y, THREAT.range[lv]);
    n.awake = !!p;
    if (!p) continue;
    n.cd -= dt;
    const st = Math.max(0, stratumOfRow(n.r));
    // ilk biyom: yeni oyuncu için daha seyrek ve daha az kalabalık
    if (n.cd > 0 || aliveEnemies() >= (st === 0 ? Math.ceil(cap * 0.6) : cap)) continue;
    n.cd = THREAT.cd[lv] * (0.8 + rnd() * 0.4) * (st === 0 ? 1.4 : 1);
    const count = Math.min(st === 0 ? 2 : 3, lv >= 3 ? 2 + (rnd() < 0.5 ? 1 : 0) : lv === 2 ? 1 + (rnd() < 0.5 ? 1 : 0) : 1);
    spawnFrom(n, p, st, lv, count);
  }
  // sızma
  if (anyUnder) {
    th.seepT -= dt;
    if (th.seepT <= 0) {
      th.seepT = THREAT.seepCd[lv] * (0.8 + rnd() * 0.4) / (1 + dst * THREAT.seepDepth);
      const nearNest = G.nests.some(n => n.awake);
      if (dp && !nearNest && aliveEnemies() < cap) {
        seep(dp, dst, lv);
        if (dst >= 3 && rnd() < Math.min(0.5, dst * 0.05)) seep(dp, dst, lv);
      }
    }
  } else th.seepT = Math.min(th.seepT, 2);
}

// yuva yıkıldı (breakTile'dan): ganimet, sessizlik, fener
export function nestDestroyed(c, r, byPlayer) {
  const i = G.nests.findIndex(n => n.c === c && n.r === r);
  if (i >= 0) G.nests.splice(i, 1);
  const x = c * TILE + 8, y = r * TILE + 8, st = Math.max(0, stratumOfRow(r));
  G.stats.nests++; markJourney('nest', x, y, byPlayer ? byPlayer.i : -1);
  const th = G.threat; th.noise = Math.max(0, th.noise - THREAT.nestRelief);
  // ganimet: demir + biyom cevheri + altın şansı
  const ores = st >= 6 ? ['crystal', 'cobalt', 'gold'] : st >= 2 ? ['cobalt', 'gold', 'water'] : ['iron', 'water', 'iron'];
  for (let k = 0; k < 2; k++) spawnOrb(x, y, 'iron', true);
  for (let k = 0; k < 2 + (st >> 1); k++) spawnOrb(x, y, ores[Math.floor(rnd() * ores.length)], true);
  if (rnd() < 0.5) spawnOrb(x, y, 'gold', true);
  ring(x, y, '#ff5a8a', 26); sparks(x, y, '#ff8ab0', 18, 120); sparks(x, y, '#5a2a4a', 10, 80); flashLight(x, y, 6, 0.5);
  shake(0.35); sfx.explode(); haptic(30);
  const left = nestsInStratum(st);
  emit('nestDown', { c, r, st, left, pi: byPlayer ? byPlayer.i : -1 });
  if (left === 0 && !G.beacons.includes(st)) {
    G.beacons.push(st); G.stats.beacons++; markJourney('beacon', x, y, byPlayer ? byPlayer.i : -1);
    emit('beacon', st);
  }
}
