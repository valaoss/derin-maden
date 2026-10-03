// Uyanış: dalga yok, zamanlayıcı yok. Kazma, ateş ve patlama gürültü üretir; gürültü yuvaları uyandırır.
// Seviyeler: 0 sessiz · 1 kıpırtı · 2 uyanış · 3 öfke · 4 boss (derinliğe göre biri uyanır, seni avlar).
// Yuvalar haritaya gömülü kovanlardır (T.NEST). Uyanık yuva yakınındaki oyuncuya düşman çıkarır; yıkılınca ganimet ve sessizlik.
// Yönetmen: düşmanlar tek bir bütçeden karışık gruplar halinde gelir; uyanışta ara ara duyurulan dalga, ardından nefes arası.
// Bir biyomdaki tüm yuvalar yıkılınca Fener dikilir (kalıcı ilerleme).
import { rnd } from '../core/rng.js';
import { TILE, COLS, ROWS, GROUND_ROW, GROUND_Y, PLAY_MIN_COL, PLAY_MAX_COL, stratumOfRow } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { THREAT, ENEMIES, WAVES, DIRECTOR } from '../data/balance.js';
import { G, biomeOf } from './state.js';
import { STRATA } from '../data/palette.js';
import { tileAt, setTile } from '../world/map.js';
import { spawnEnemy, aliveEnemies, makeElite } from './enemies.js';
import { bossForY } from './bosses.js';
import { spawnOrb } from './player.js';
import { debris, dust, ring, sparks, shake, flashLight } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { bossSfx } from '../audio/samples.js';
import { emit } from '../core/events.js';
import { markJourney } from './journey.js';
import { seaFloor } from './biomes.js';

export const LEVEL_NAMES = ['SESSİZ', 'KIPIRTI', 'UYANIŞ', 'ÖFKE', 'AV'];

function makeDirector() { return { phase: 'build', t: 0, bank: 0, gapT: 6, waveT: DIRECTOR.waveEvery[0], left: 0, sid: 0, cap: THREAT.cap[0], capT: 0, src: null, at: null }; }
export function makeThreat() { return { noise: 0, level: 0, quietT: 0, bossUp: false, bossCd: 0, peak: 0, fullT: 0, warned: false, woke: 0, bossType: '', dir: makeDirector() }; }
// uyanış sayacının süresi: ölçerle uyanan her boss bir sonrakini geciktirir
export const wakeDelay = th => THREAT.bossDelay[Math.min(th.woke || 0, THREAT.bossDelay.length - 1)];
// uyanış yarıda kaldı (sessizlik ya da yıkılan yuva): boss yeniden uyur
function calmBoss(th) { th.fullT = 0; if (!th.warned) return; th.warned = false; if (!th.bossUp) { emit('bossCalm', th.bossType); th.bossType = ''; } }

// haritadaki yuvaları listele (sefer başı ve yükleme)
export function scanNests() {
  const out = [];
  for (let r = GROUND_ROW; r < ROWS; r++) for (let c = PLAY_MIN_COL; c <= PLAY_MAX_COL; c++) if (G.map[r * COLS + c] === T.NEST) out.push({ c, r, x: c * TILE + 8, y: r * TILE + 8, awake: false, pulse: rnd() * 6 });
  return out;
}
export function nestsInStratum(s) { return G.nests.filter(n => stratumOfRow(n.r) === s).length; }
export function nestTotalInStratum(s) { return (G.nestTotal && G.nestTotal[s]) | 0; }

function levelOf(noise) { return noise >= 99.5 ? 4 : noise >= 75 ? 3 : noise >= 50 ? 2 : noise >= 25 ? 1 : 0; }

// gürültü ekle: derinlik çarpar, sessizlikte yarıya iner
export function addNoise(a, x, y) {
  const th = G.threat; if (!th || G.over) return;
  if (G.tutorial && G.tutorial.step < 3) return;
  const st = Math.max(0, stratumOfRow(Math.floor(y / TILE)));
  let m = (1 + st * THREAT.depthMul) * (G.mods.noise || 1) * (STRATA[biomeOf(st)].noiseMul || 1);
  if (G.evt && G.evt.hushT > 0) m *= 0.5;
  th.noise = Math.min(100, th.noise + a * m);
  th.quietT = 0; th.last = { x, y };
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

// biyomun imza düşmanı sık çıkar; derin biyomların (10+) imzaları yalnız kendi biyomunda görülür. Her biyomun basit canlıları (mobs) da araya karışır
const MOB_SHARE = 0.3;
function pickType(st, lv) {
  const b = biomeOf(st), S = STRATA[b], sig = Array.isArray(S.sig) ? S.sig[Math.floor(rnd() * S.sig.length)] : S.sig;
  const allowed = WAVES.allowed(2 + lv * 2, st).filter(t => !ENEMIES[t].boss && !ENEMIES[t].small);
  if (S.mobs && rnd() < MOB_SHARE) return S.mobs[Math.floor(rnd() * S.mobs.length)];
  if (S.sig2 && rnd() < 0.25) return S.sig2;
  if (sig && rnd() < (b >= 10 ? 0.55 : 0.4) && (b >= 10 || allowed.includes(sig))) return sig;
  return allowed[Math.floor(rnd() * allowed.length)] || 'rodent';
}

// grup: seviye büyüdükçe kalabalık; 4+ kişide bir ağır, 3+ kişide bir menzilli, gerisi imza ağırlıklı
const tank = t => ENEMIES[t].cost >= 5, far = t => !!(ENEMIES[t].ranged || ENEMIES[t].zap || ENEMIES[t].judge);
function squadTypes(st, lv, n) {
  const pool = WAVES.allowed(2 + lv * 2, st).filter(t => !ENEMIES[t].boss && !ENEMIES[t].small);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const out = [], tanks = pool.filter(tank), rng = pool.filter(far);
  if (n >= 4 && tanks.length) out.push(pick(tanks));
  if (n >= 3 && rng.length) out.push(pick(rng));
  while (out.length < n) { let t = pickType(st, lv); if (out.length && tank(t)) t = pickType(st, lv); out.push(t); }
  return out;
}
// sürü türünde her gövde bütçeden ve sahadaki sınırdan düşer
const squadCost = ts => ts.reduce((a, t) => a + (ENEMIES[t].cost || 1) * (ENEMIES[t].pack || 1), 0);
const bodies = ts => ts.reduce((a, t) => a + (ENEMIES[t].pack || 1), 0);

// yuvadan çıkış hücresi: komşu boşluk; yoksa oyuncuya doğru bir hücre patlatılır
function exitCell(n, p) {
  const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
  dirs.sort((a, b) => Math.hypot(n.c + a[0] - p.x / TILE, n.r + a[1] - p.y / TILE) - Math.hypot(n.c + b[0] - p.x / TILE, n.r + b[1] - p.y / TILE));
  for (const [dc, dr] of dirs) if (tileAt(n.c + dc, n.r + dr) === T.AIR) return { c: n.c + dc, r: n.r + dr };
  for (const [dc, dr] of dirs) {
    const t = tileAt(n.c + dc, n.r + dr), d = TD[t];
    if (n.r + dr < GROUND_ROW || !d.solid || d.unbreakable || d.chest || d.heart || d.nest || d.relic) continue;
    setTile(n.c + dc, n.r + dr, T.AIR); debris((n.c + dc) * TILE + 8, (n.r + dr) * TILE + 8, 'stone', 8);
    return { c: n.c + dc, r: n.r + dr };
  }
  return null;
}

function emerge(type, x, y, lv, i, sid) {
  const e = spawnEnemy(type, x, y, lv);
  e.emergeT = 0.8 + i * 0.35; e.sq = sid;
  if (lv >= 3 && rnd() < THREAT.eliteChance && !e.d.small && !e.d.timid) makeElite(e);
  // sürü türü: yanında birkaç kardeşiyle çıkar (hücrenin içinde, dörderli sıralar)
  for (let k = 1; k < (e.d.pack || 0); k++) { const o = spawnEnemy(type, x + ((k % 4) - 1.5) * 3, y + ((k >> 2) - 0.5) * 3, lv); o.emergeT = e.emergeT + k * 0.12; o.sq = sid; }
  return e;
}
function spawnFrom(n, p, lv, types, sid) {
  const cell = exitCell(n, p);
  if (!cell) return false;
  types.forEach((type, i) => emerge(type, cell.c * TILE + 8 + (rnd() - 0.5) * 4, cell.r * TILE + 8 + (rnd() - 0.5) * 4, lv, i, sid));
  n.burst = 0.5;
  dust(n.x, n.y, 3, 'rgba(200,80,120,0.5)'); ring(n.x, n.y, '#ff5a8a', 14);
  if (Math.hypot(G.player.x - n.x, G.player.y - n.y) < 220) sfx.rumble();
  return true;
}

// kayanın içinden sızma: yakın yuva yoksa derindeki oyuncunun çevresinden
function seepCell(p) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  for (let tries = 0; tries < 20; tries++) {
    const c = pc + Math.round((rnd() - 0.5) * 12), r = pr + 2 + Math.floor(rnd() * 6);
    if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r < GROUND_ROW + 2 || r >= ROWS - 2) continue;
    const d = TD[tileAt(c, r)];
    if (d.unbreakable || d.chest || d.heart || d.nest || d.relic) continue;
    return { c, r };
  }
  return null;
}
function seep(p, st, lv, types = [pickType(st, lv)], sid = 0, cell = seepCell(p)) {
  if (!cell) return false;
  const { c, r } = cell, d = TD[tileAt(c, r)];
  if (d.unbreakable || d.chest || d.heart || d.nest || d.relic) return false;
  if (d.solid) { setTile(c, r, T.AIR); debris(c * TILE + 8, r * TILE + 8, 'stone', 8); }
  types.forEach((type, i) => emerge(type, c * TILE + 8, r * TILE + 8, lv, i, sid));
  return true;
}

// Sürü olayı: oyuncunun altındaki kayadan birkaç yaratık sızar
export function swarm(p, n) {
  const st = Math.max(0, stratumOfRow(Math.floor(p.y / TILE)));
  for (let i = 0; i < n; i++) seep(p, st, 1);
}

// oyuncuya en yakın uyanık yuva
function closestNest() {
  let best = null, bd = 1e9;
  for (const n of G.nests) if (n.awake && n.p) { const d = Math.hypot(n.p.x - n.x, n.p.y - n.y); if (d < bd) { bd = d; best = n; } }
  return best;
}
// grup çıkar: dalga kaynağından, yoksa en yakın uyanık yuvadan, o da yoksa derindeki oyuncunun çevresindeki kayadan
function launchSquad(lv, types, at) {
  // grup kimliği yalnız grup gerçekten çıkınca ilerler (boş grup "önceki grup öldü" kapısını atlatmasın)
  const D = G.threat.dir, sid = D.sid + 1;
  const n = at && at.nest && G.nests.includes(at.nest) ? at.nest : at && at.cell ? null : closestNest();
  if (n && spawnFrom(n, n.p || deepestUnder() || G.player, lv, types, sid)) { D.sid = sid; return true; }
  const p = deepestUnder(); if (!p) return false;
  const st = Math.max(0, stratumOfRow(Math.floor(p.y / TILE)));
  const ok = seep(p, st, lv, types, sid, at && at.cell ? at.cell : seepCell(p));
  if (ok) D.sid = sid;
  return ok;
}
function squadAlive(sid) { let n = 0; for (const e of G.enemies) if (!e.dead && e.sq === sid) n++; return n; }
// dalga kaynağı: uyarıda bellidir (ok ve ses), dalga oradan gelir
function waveSource() {
  const n = closestNest();
  if (n) return { nest: n, x: n.x, y: n.y };
  const p = deepestUnder(), cell = p && seepCell(p);
  return cell ? { cell, x: cell.c * TILE + 8, y: cell.r * TILE + 8 } : null;
}

function spawnBoss(p) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  for (let tries = 0; tries < 40; tries++) {
    const c = pc + Math.round((rnd() - 0.5) * 10), r = pr + 4 + Math.floor(rnd() * 5);
    if (c < PLAY_MIN_COL + 1 || c > PLAY_MAX_COL - 1 || r < GROUND_ROW + 3 || r >= ROWS - 3) continue;
    const d = TD[tileAt(c, r)];
    if (d.unbreakable || d.chest || d.heart || d.nest || d.relic) continue;
    if (d.solid) setTile(c, r, T.AIR);
    const type = G.threat.bossType || bossForY(p.y);
    const e = spawnEnemy(type, c * TILE + 8, r * TILE + 8, 4);
    e.emergeT = 1.4; G.threat.bossType = type;
    debris(e.x, e.y, 'stone', 16); ring(e.x, e.y, e.d.col, 30); shake(0.5); flashLight(e.x, e.y, 6, 0.6);
    emit('bossSpawn', type);
    sfx.alarm(); bossSfx(type, 'spawn'); haptic([40, 60, 40, 60, 80]);
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
  // Sessiz Deniz: ölçer sönmez, zamanla dolar
  th.noise = Math.max(th.noise, seaFloor());
  // boss öldü: ölçer sakinleşir
  // kaçtıysa (herkes kampta kaldı): sayılmaz, afiş "yeniden uyudu" der, dinlenme kısa
  if (th.bossUp && !bossAlive) {
    th.bossUp = false;
    if (th.bossFled) { th.bossCd = THREAT.bossRest / 4; emit('bossCalm', th.bossType); }
    else { th.noise = Math.min(th.noise, THREAT.afterBoss); th.bossCd = THREAT.bossRest; G.stats.bosses++; emit('bossDown', th.bossType); }
    th.bossType = '';
  }
  th.bossFled = false;
  if (th.bossCd > 0) th.bossCd -= dt;
  // tepe: boss hemen uyanmaz, sayaç başlar; ölçer tepeden inerse sayaç geri sarar ve boss yeniden uyur. Hangisi olduğu uyarıda belli olur
  const full = lvBefore === 4 || levelOf(th.noise) === 4;
  if (bossAlive || th.bossUp || th.bossCd > 0) { if (th.bossUp) { th.fullT = 0; th.warned = false; } }
  else if (full) {
    th.fullT += dt;
    if (!th.warned) { th.warned = true; const p = deepestUnder(); if (p) th.bossType = bossForY(p.y); emit('bossWarn', th.bossType); }
  }
  else if (th.fullT > 0) { th.fullT -= dt * THREAT.calmRate; if (th.fullT <= 0) calmBoss(th); }
  let lv = Math.min(3, Math.max(levelOf(th.noise), lvBefore));
  if (th.fullT >= wakeDelay(th) && !th.bossUp && th.bossCd <= 0) lv = 4;
  if (bossAlive) lv = 4;
  if (lv !== th.level) {
    const up = lv > th.level; th.level = lv;
    emit('threat', { level: lv, up });
    if (up && lv >= 2) { sfx.alarm(); haptic([30, 60, 30]); }
  }
  // eski sistemlerle uyum (gök rengi, ambiyans)
  G.wave.phase = lv >= 2 ? 'active' : lv === 1 ? 'warn' : 'calm';
  G.wave.num = lv; G.wave.boss = lv === 4;

  // sahadaki sınır yavaşça yükselir (bir anda ordu gelmez), düşünce hemen iner
  const D = th.dir;
  const capT = Math.round(THREAT.cap[lv] * (G.mp ? 1.5 : 1));
  D.capT += dt;
  if (D.cap > capT) D.cap = capT; else if (D.cap < capT && D.capT >= DIRECTOR.capRamp) { D.cap++; D.capT = 0; }
  // boss
  if (lv === 4 && !bossAlive && th.bossCd <= 0) {
    const p = deepestUnder();
    if (p && spawnBoss(p)) { th.bossUp = true; th.woke = (th.woke || 0) + 1; } else th.bossCd = 3;
  }
  // yuvalar: uyanıklık (menzildeki oyuncu) ve nabız; üretimi yönetmen yapar
  for (const n of G.nests) {
    if (n.burst > 0) n.burst -= dt;
    n.pulse += dt;
    n.p = nearestUnder(n.x, n.y, THREAT.range[lv]);
    n.awake = !!n.p;
  }
  if (!anyUnder || !dp) { D.bank = Math.max(0, D.bank - dt * 2); if (D.phase === 'warn' || D.phase === 'wave') { D.phase = 'build'; D.src = null; D.at = null; } return; }
  const L = Math.min(3, lv), alive = aliveEnemies(), cap = D.cap;
  const rateMul = (1 + dst * DIRECTOR.depthRate) * (G.mp ? DIRECTOR.mpRate : 1) * (G.mods.nestRate || 1) * (dst === 0 ? 0.7 : 1);
  if (D.phase === 'build') {
    D.bank = Math.min(DIRECTOR.bankMax, D.bank + DIRECTOR.rate[L] * rateMul * dt);
    D.gapT -= dt;
    // grup: önceki grup büyük ölçüde öldü (ya da çok beklendi), bütçe ve sınır izin veriyor
    if (D.gapT <= 0 && (squadAlive(D.sid) <= 1 || D.gapT < -DIRECTOR.maxWait) && alive < cap) {
      const [a, b] = DIRECTOR.squad[L];
      const n = Math.min(a + Math.floor(rnd() * (b - a + 1)), Math.max(1, cap - alive));
      const types = squadTypes(dst, lv, n);
      while (types.length > 1 && (squadCost(types) > D.bank || bodies(types) > Math.max(1, cap - alive))) types.pop();
      if (squadCost(types) <= D.bank && launchSquad(lv, types)) { D.bank -= squadCost(types); D.gapT = DIRECTOR.gap[L] * (0.85 + rnd() * 0.3); }
    }
    // dalga: uyanış ve üstünde ara ara, önceden duyurulur
    if (lv >= DIRECTOR.waveMin && !bossAlive) {
      D.waveT -= dt;
      if (D.waveT <= 0) {
        const src = waveSource();
        if (src) { D.phase = 'warn'; D.t = DIRECTOR.waveWarn; D.at = src; D.src = { x: src.x, y: src.y }; emit('horde', D.src); sfx.alarm(); shake(0.25); haptic([30, 40, 30]); }
        else D.waveT = 5;
      }
    }
  } else if (D.phase === 'warn') {
    D.t -= dt;
    if (D.t <= 0) { D.phase = 'wave'; D.left = DIRECTOR.waveSquads; D.t = 0; }
  } else if (D.phase === 'wave') {
    D.t -= dt;
    if (D.left > 0 && D.t <= 0) {
      D.left--; D.t = DIRECTOR.waveLen / DIRECTOR.waveSquads;
      const [a, b] = DIRECTOR.squad[3], wl = Math.max(lv, 2);
      const n = Math.min(a + Math.floor(rnd() * (b - a + 1)), Math.max(1, Math.ceil(cap * 1.3) - aliveEnemies()));
      launchSquad(wl, squadTypes(dst, wl, n), D.at);
    }
    if (D.left === 0 && D.t <= 0) { D.phase = 'rest'; D.t = DIRECTOR.rest; D.bank = 0; D.src = null; D.at = null; emit('hordeDone'); }
  } else if (D.phase === 'rest') {
    D.t -= dt;
    if (D.t <= 0) { D.phase = 'build'; D.gapT = 3; D.waveT = DIRECTOR.waveEvery[0] + rnd() * (DIRECTOR.waveEvery[1] - DIRECTOR.waveEvery[0]); }
  }
}

// yuva yıkıldı (breakTile'dan): ganimet, sessizlik, fener
export function nestDestroyed(c, r, byPlayer) {
  const i = G.nests.findIndex(n => n.c === c && n.r === r);
  if (i >= 0) G.nests.splice(i, 1);
  const x = c * TILE + 8, y = r * TILE + 8, st = Math.max(0, stratumOfRow(r));
  G.stats.nests++; markJourney('nest', x, y, byPlayer ? byPlayer.i : -1);
  const th = G.threat; th.noise = Math.max(0, th.noise - THREAT.nestRelief); calmBoss(th);
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
