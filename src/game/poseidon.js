// Poseidon: Şelale Mağarası'nın dibindeki su tapınağında, salona giren madenciyi bir kez karşılar.
// Önce üç dişli mızrağıyla dövüşen bir tanrı (mızrak fırlatır, su dalgası savurur, mızrağı saplar, hortum çıkarır);
// öfkelenince suyun içinde yengeç gövdeli bir deve dönüşür: yere basar, kıskaçla vurur, yeri döver, su mızrakları yağdırır.
// Salonun zemini kırılmaz; aralarındaki giderler suyu aşağı süzer, salon taşmaz. Aşağıya iki yandaki kayadan inilir.
import { rnd } from '../core/rng.js';
import { TILE, COLS, GROUND_ROW, STRATUM_ROWS, PLAY_MIN_COL, PLAY_MAX_COL, CENTER_COL } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { POSEIDON } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, solidAt } from '../world/map.js';
import { breakTile, damagePlayer, pullPlayer } from './player.js';
import { spawnEnemy, losClear, damageStructure } from './enemies.js';
import { KITS, live, breakable, hitPlayers, angDiff, beamLen, bossBusy } from './bosses.js';
import { FALLS_BIOME } from './liquids.js';
import { shake, flashLight, debris, dust, ring, sparks, hitstop, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { bossSfx } from '../audio/samples.js';
import { emit } from '../core/events.js';

const WATER = ['#e8fbff', '#8ad8ff', '#3a9ad8', '#6fd8ff'];
const spray = (x, y, n, sp = 90, up = 60) => { for (let i = 0; i < n; i++) particle(x + (rnd() - 0.5) * 6, y, (rnd() - 0.5) * sp, -up * (0.4 + rnd()), 0.5 + rnd() * 0.3, WATER[Math.floor(rnd() * 4)], rnd() < 0.3 ? 2 : 1, 1, 220); };

// ---------- tapınak ----------
// kemerli salon: iki uçta tavandan dökülen su perdeleri, kırılmaz zemin, zeminde bir atlayıp bir gider
export function placeTemple(g) {
  const s = g.order.indexOf(FALLS_BIOME); if (s < 0) return null;
  const base = GROUND_ROW + s * STRATUM_ROWS, r0 = base + POSEIDON.top, r1 = r0 + POSEIDON.rows - 1, c0 = PLAY_MIN_COL + 1, c1 = PLAY_MAX_COL - 1, fr = r1 + 1;
  const I = (c, r) => r * COLS + c, moved = [];
  for (let r = r0; r <= fr; r++) for (let c = c0; c <= c1; c++) {
    const t = g.map[I(c, r)], d = TD[t];
    if (d.nest || d.chest) moved.push(t);
    g.map[I(c, r)] = T.AIR; if (g.buried) g.buried[I(c, r)] = 0; if (g.lq) g.lq[I(c, r)] = 0;
  }
  for (let c = c0; c <= c1; c++) {
    const d = Math.abs(c - CENTER_COL);
    if (d >= 4) g.map[I(c, r0)] = T.FALLROCK; if (d >= 5) g.map[I(c, r0 + 1)] = T.FALLROCK;
    g.map[I(c, fr)] = (c - c0) % 2 ? T.SINK : T.LAKEBED;
  }
  // iki yandaki sütun kazılabilir kalır: aşağıya buradan inilir
  for (const c of [PLAY_MIN_COL, PLAY_MAX_COL]) for (let r = r0; r <= fr + 1; r++) if (TD[g.map[I(c, r)]].unbreakable) g.map[I(c, r)] = T.FALLROCK;
  const sp = [[c0 + 1, r0], [c1 - 1, r0]];
  for (const [c, r] of sp) { g.map[I(c, r)] = T.SPRING; if (g.springs) g.springs.push({ c, r, k: 0, drain: true }); }
  // salona denk gelen yuva ve sandıklar biyomun yukarısındaki düz kayaya taşınır
  for (let k = 0; k < 600 && moved.length; k++) {
    const c = c0 + 1 + (k * 7) % (c1 - c0 - 1), r = base + 4 + (k * 5) % 26, i = I(c, r);
    if (Math.abs(c - CENTER_COL) > 1 && TD[g.map[i]].plain) { const t = moved.pop(); g.map[i] = t; if (g.buried) g.buried[i] = TD[t].nest ? 1 : 0; }
  }
  return { v: 1, st: 'wait', t: 0, c0, c1, r0, r1, sp };
}
export const inTemple = (S, x, y) => { const c = Math.floor(x / TILE), r = Math.floor(y / TILE); return c >= S.c0 && c <= S.c1 && r >= S.r0 && r <= S.r1; };
// eski kayıt: haritada tapınak yok; yerleşimin eklediği kaynaklar geri alınır
export function dropTemple(g) {
  if (g.temple && g.springs) g.springs = g.springs.filter(s => !g.temple.sp.some(q => q[0] === s.c && q[1] === s.r));
  g.temple = null;
}

// ---------- saldırılar ----------
// 3B modelle hizalı noktalar: mızrağın elden çıktığı yer (tanrının omuz üstü, devin boş eli) ve dalganın koptuğu gövde ortası
export const handOf = e => e.bs && e.bs.phase === 2 ? [e.x, e.y - 58] : [e.x + e.face * 2, e.y - 38];
export const heartOf = e => [e.x, e.y - 22];
const P1 = handOf, P2 = handOf, HEART = heartOf;
// altındaki zemin (y: zeminin üstü); yoksa bulunduğu yerin biraz altı
function floorUnder(x, y) {
  const c = Math.floor(x / TILE); let r = Math.floor(y / TILE);
  for (let n = 0; n < 10; n++, r++) if (solidAt(c, r + 1)) return (r + 1) * TILE;
  return y + 40;
}
function ceilOver(x, fy, max) {
  const c = Math.floor(x / TILE); let h = 0;
  while (h < max && !solidAt(c, Math.floor((fy - h - 8) / TILE))) h += 8;
  return Math.max(24, h);
}

KITS.poseidon = {
  cd: { spear: 2, wave: 3.5, spout: 6 },
  roarAt: POSEIDON.morph - POSEIDON.morphAt,
  init(e, B) { Object.assign(B, { armed: true, reform: 0, spears: [], waves: [], spouts: [] }); },
  // düz vuruş: tanrı mızrağı saplar (dar, uzun); dev kıskacını savurur (geniş). Mızrak elinde değilken vuramaz
  melee(e, B) { return B.phase === 2 ? POSEIDON.claw : B.armed ? POSEIDON.thrust : false; },
  choose(e, p, dp, B) {
    const two = B.phase === 2, [hx, hy] = (two ? P2 : P1)(e), los = losClear(hx, hy, p.x, p.y);
    if (B.cd.spout <= 0 && dp < 200) return 'spout';
    if (B.cd.spear <= 0 && dp > 40 && dp < POSEIDON.spear.len && los && (two || B.armed)) return 'spear';
    if (two) { if (B.cd.wave <= 0 && dp < 190 && p.y > e.y - 60) return 'slam'; }
    else if (B.cd.wave <= 0 && dp > 26 && dp < POSEIDON.wave.len + 20 && los && B.armed) return 'wave';
    return null;
  },
  start: {
    spear(e, p, B) {
      const A = B.act, two = B.phase === 2, [hx, hy] = (two ? P2 : P1)(e);
      B.cd.spear = two ? 4 : 5; A.T = 9; A.stage = 'aim'; A.st = POSEIDON.spear.aim; e.face = p.x >= e.x ? 1 : -1;
      A.a = Math.atan2(p.y - 3 - hy, p.x - hx); A.n = two ? 3 : 1; A.len = POSEIDON.spear.len; sfx.arm();
    },
    wave(e, p, B) {
      const A = B.act, [ox, oy] = HEART(e); B.cd.wave = 6.5; A.T = 9; A.stage = 'wind'; A.st = POSEIDON.wave.wind; e.face = p.x >= e.x ? 1 : -1;
      A.a = Math.atan2(p.y - 3 - oy, p.x - ox); A.len = POSEIDON.wave.len; A.hw = POSEIDON.wave.hw; sfx.arm();
    },
    slam(e, p, B) { const A = B.act; B.cd.wave = 5.5; A.T = 9; A.stage = 'raise'; A.st = POSEIDON.slam.wind; A.hw = POSEIDON.slam.hw; A.len = POSEIDON.slam.len; e.face = p.x >= e.x ? 1 : -1; sfx.growl(); },
    spout(e, p, B) {
      const A = B.act, C = POSEIDON.spout, two = B.phase === 2; B.cd.spout = two ? 7.5 : 9.5; A.T = C.raise + 0.45; sfx.rumble();
      if (!B.hinted) { B.hinted = true; emit('toast', { text: 'Hortum geliyor: yerdeki girdaptan uzaklaş!', icon: 'skull', bad: true }); }
      for (const q of live()) {
        if (Math.hypot(q.x - e.x, q.y - e.y) > 220) continue;
        for (const dx of two ? [0, -46, 46] : [0]) {
          const x = Math.max(PLAY_MIN_COL * TILE + 8, Math.min(PLAY_MAX_COL * TILE + 8, q.x + dx)), fy = floorUnder(x, q.y);
          B.spouts.push({ x, fy, h: ceilOver(x, fy, C.h), t: -C.warn, life: two ? C.life + 0.8 : C.life, tick: 0, pi: q.i });
        }
      }
    },
  },
  run: {
    spear(e, dt, p, B) {
      const A = B.act, C = POSEIDON.spear, two = B.phase === 2, [hx, hy] = (two ? P2 : P1)(e); A.st -= dt;
      if (A.stage === 'aim') {
        e.wind = 1 - Math.max(0, A.st) / C.aim;
        // nişan madenciyi izler, son üçte birde kilitlenir (çizgi kızarır)
        if (p && A.st > C.aim * 0.33) A.a += Math.max(-2.6 * dt, Math.min(2.6 * dt, angDiff(Math.atan2(p.y - 3 - hy, p.x - hx), A.a)));
        e.face = Math.cos(A.a) >= 0 ? 1 : -1; A.len = beamLen(hx, hy, A.a, C.len);
        if (A.st <= 0) {
          for (let i = 0; i < A.n; i++) { const a = A.a + (i - (A.n - 1) / 2) * 0.3; B.spears.push({ x: hx, y: hy, a, left: C.len, hit: [], water: two, st: 0 }); }
          if (!two) B.armed = false;
          A.stage = 'rest'; A.st = 0.5; A.fire = true; e.wind = 0; e.lunge = 1; sfx.whip(); shake(0.2); spray(hx, hy, 6, 80, 30);
        }
        return;
      }
      if (A.st <= 0) A.T = 0;
    },
    wave(e, dt, p, B) {
      const A = B.act, C = POSEIDON.wave, [ox, oy] = HEART(e); A.st -= dt;
      if (A.stage === 'wind') {
        e.wind = 1 - Math.max(0, A.st) / C.wind;
        if (p && A.st > C.wind * 0.55) A.a += Math.max(-1.8 * dt, Math.min(1.8 * dt, angDiff(Math.atan2(p.y - 3 - oy, p.x - ox), A.a)));
        e.face = Math.cos(A.a) >= 0 ? 1 : -1; A.len = beamLen(ox, oy, A.a, C.len);
        if (A.st <= 0) {
          B.waves.push({ x: ox + Math.cos(A.a) * 8, y: oy + Math.sin(A.a) * 8, a: A.a, v: C.v, left: A.len, hw: C.hw, dmg: C.dmg, push: C.push, hit: [] });
          A.stage = 'rest'; A.st = 0.5; A.fire = true; e.wind = 0; e.lunge = 1; sfx.splash(); shake(0.3);
        }
        return;
      }
      if (A.st <= 0) A.T = 0;
    },
    // dev mızrağını ve kıskaçlarını kaldırıp yeri döver: zemin boyunca iki yana dalga yürür (üstünden uç)
    slam(e, dt, p, B) {
      const A = B.act, C = POSEIDON.slam; A.st -= dt;
      if (A.stage === 'raise') {
        e.wind = 1 - Math.max(0, A.st) / C.wind;
        if (A.st <= 0) {
          const y = e.y - 4;
          for (const s of [-1, 1]) B.waves.push({ x: e.x + s * 16, y, a: s > 0 ? 0 : Math.PI, v: C.v, left: C.len, hw: C.hw, dmg: C.dmg, push: 200, hit: [], ground: true });
          hitPlayers(e.x + e.face * 18, e.y, 28, C.hit * e.dmgMul, q => { const d = Math.hypot(q.x - e.x, q.y - e.y) || 1; pullPlayer(q, (q.x - e.x) / d * 180, -70); });
          for (const s of G.structures) if (!s.dead && Math.hypot(s.x - e.x, s.y - e.y) < 70) damageStructure(s, 14);
          debris(e.x + e.face * 18, e.y + 6, 'stone', 14); spray(e.x + e.face * 18, e.y + 4, 26, 200, 150); dust(e.x, e.y + 6, 10, 'rgba(140,200,230,0.5)');
          ring(e.x, e.y, '#8ad8ff', 44); flashLight(e.x, e.y - 8, 7, 0.4); shake(0.9); hitstop(0.09); sfx.explode(); sfx.splash(); haptic([60, 30, 120]);
          A.stage = 'rest'; A.st = 0.7; A.fire = true; e.wind = 0; e.lunge = 1;
        }
        return;
      }
      if (A.st <= 0) A.T = 0;
    },
    spout(e, dt, p, B) { const A = B.act, C = POSEIDON.spout; e.wind = Math.min(1, (C.raise + 0.45 - A.T) / C.raise); if (p) e.face = p.x >= e.x ? 1 : -1; },
  },
  // dönüşüm: su kozası kapanır, içinden dev çıkar; kabuk patlarken çevresini savurur
  rage(e, B) { B.rageT = POSEIDON.morph; B.roared = false; B.spears.length = 0; B.armed = true; B.reform = 0; sfx.whale(); },
  roar(e, B) {
    e.r = POSEIDON.r2;
    B.rings.push({ x: e.x, y: e.y - 14, r: 10, R: 96, v: 150, dmg: 14 * e.dmgMul, hit: [], col: '#8ad8ff', los: false });
    for (const q of live()) { const d = Math.hypot(q.x - e.x, q.y - e.y) || 1; if (d < 70) pullPlayer(q, (q.x - e.x) / d * 200, (q.y - e.y) / d * 120 - 40); }
    spray(e.x, e.y - 20, 50, 260, 200); ring(e.x, e.y - 20, '#e8fbff', 70); ring(e.x, e.y - 20, '#3a9ad8', 50); flashLight(e.x, e.y - 20, 10, 0.7);
    shake(1); hitstop(0.12); bossSfx('poseidon', 'rage', sfx.roar); sfx.explode(); sfx.splash(); haptic([80, 40, 160]);
  },
  // dev yere basar: altındaki zemine iner, yalnız yana yürür; önündeki kayayı ezer
  move(e, dt, p, dp, B) {
    if (B.phase !== 2) return false;
    // madenci uzun süre çok yukarıda/aşağıdaysa dev yalnız yürüyüp düşerek yetişemez: ortak kazıcı yürüyüş devralır
    // (salonda ya da bir çıkıntıda mahsur kalıp seferi Av seviyesinde kilitlemesin)
    const gy = floorUnder(e.x, e.y) - 8, falling = gy - e.y > 2;
    B.highT = p.y < e.y - 3 * TILE || (p.y > e.y + 3 * TILE && !falling) ? (B.highT || 0) + dt : 0;
    if (B.highT > 2.5) return false;
    e.y += Math.max(-50 * dt, Math.min(110 * dt, gy - e.y));
    const dx = p.x - e.x; e.face = dx >= 0 ? 1 : -1;
    if (Math.abs(dx) > e.r + 6) {
      const nx = Math.max(PLAY_MIN_COL * TILE + 12, Math.min((PLAY_MAX_COL + 1) * TILE - 12, e.x + Math.sign(dx) * e.d.speed * POSEIDON.crawl * dt));
      const c = Math.floor((nx + Math.sign(dx) * 14) / TILE), r1 = Math.floor(e.y / TILE); let stop = false;
      for (let r = r1 - 3; r <= r1; r++) if (solidAt(c, r)) { if (breakable(c, r)) breakTile(c, r, null); else stop = true; }
      if (!stop) e.x = nx;
    }
    return true;
  },
  tick(e, dt, B) {
    const two = B.phase === 2, mul = e.dmgMul, C = POSEIDON;
    if (B.reform > 0 && (B.reform -= dt) <= 0) { B.armed = true; const [hx, hy] = P1(e); spray(hx, hy, 8, 60, 50); }
    if (!B.armed && !B.spears.some(s => !s.water) && !(B.reform > 0)) B.reform = C.spear.reform;
    // mızraklar: düz uçar; kayaya saplanır ya da menzil sonunda suya dağılır
    let j = 0;
    for (const s of B.spears) {
      if (s.st > 0) { s.st -= dt; if (s.st > 0) B.spears[j++] = s; continue; }
      const ca = Math.cos(s.a), sa = Math.sin(s.a); let d = C.spear.v * dt, stuck = false;
      while (d > 0 && !stuck) {
        const k = Math.min(5, d); d -= k; s.x += ca * k; s.y += sa * k; s.left -= k;
        if (solidAt(Math.floor((s.x + ca * 8) / TILE), Math.floor((s.y + sa * 8) / TILE))) { stuck = true; s.wall = true; }
        else if (s.left <= 0) stuck = true;
        for (const q of live()) if (!s.hit.includes(q.i) && Math.hypot(q.x - s.x - ca * 6, q.y - 3 - s.y - sa * 6) < 9) {
          s.hit.push(q.i); damagePlayer(q, (s.water ? C.spear.dmg2 : C.spear.dmg) * mul, s.x - ca * 12, s.y - sa * 12); pullPlayer(q, ca * 160, sa * 160); sparks(q.x, q.y, '#8ad8ff', 10, 110); shake(0.3); hitstop(0.04);
        }
        for (const t of G.structures) if (!t.dead && !s.hs && Math.hypot(t.x - s.x, t.y - s.y) < 9) { s.hs = true; damageStructure(t, 16); }
      }
      if (rnd() < dt * 40) particle(s.x - ca * 8, s.y - sa * 8, (rnd() - 0.5) * 20, (rnd() - 0.5) * 20, 0.35, WATER[Math.floor(rnd() * 4)], 1, 1, 60);
      if (stuck) {
        s.st = s.water || !s.wall ? 0.16 : C.spear.stick;
        if (s.wall) { debris(s.x + ca * 8, s.y + sa * 8, 'stone', 5); sparks(s.x + ca * 8, s.y + sa * 8, '#e8fbff', 8, 90); shake(0.18); sfx.land(); }
        if (s.water || !s.wall) spray(s.x, s.y, 10, 110, 60);
      }
      B.spears[j++] = s;
    }
    B.spears.length = j;
    // dalgalar: yönü boyunca yürüyen su duvarı; içine giren madenciyi sürükler
    j = 0;
    for (const w of B.waves) {
      const ca = Math.cos(w.a), sa = Math.sin(w.a), k = w.v * dt; w.x += ca * k; w.y += sa * k; w.left -= k;
      for (const q of live()) {
        if (w.hit.includes(q.i)) continue;
        const dx = q.x - w.x, dy = q.y - 2 - w.y, al = dx * ca + dy * sa, pr = -dx * sa + dy * ca;
        if (Math.abs(al) < 7 && Math.abs(pr) < w.hw) { w.hit.push(q.i); damagePlayer(q, w.dmg * mul, w.x - ca * 14, w.y - sa * 14); pullPlayer(q, ca * w.push, sa * w.push - (w.ground ? 50 : 0)); q.slowT = Math.max(q.slowT, 1); spray(q.x, q.y, 10, 100, 80); }
      }
      for (const t of G.structures) if (!t.dead && !(w.hs || (w.hs = [])).includes(t) && Math.abs((t.x - w.x) * ca + (t.y - w.y) * sa) < 7 && Math.abs(-(t.x - w.x) * sa + (t.y - w.y) * ca) < w.hw) { w.hs.push(t); damageStructure(t, 10); }
      if (rnd() < dt * 50) { const o = (rnd() - 0.5) * 2 * w.hw; particle(w.x - sa * o, w.y + ca * o, -ca * 30 + (rnd() - 0.5) * 20, -sa * 30 - 20, 0.4, WATER[Math.floor(rnd() * 4)], 1, 1, 160); }
      const wall = solidAt(Math.floor((w.x + ca * 6) / TILE), Math.floor(w.y / TILE));
      if (w.left > 0 && !wall) B.waves[j++] = w; else { spray(w.x, w.y, 16, 140, 110); if (wall) sfx.splash(); }
    }
    B.waves.length = j;
    // hortumlar: önce yerde girdap döner, sonra su sütunu yükselir; en yakın madenciye doğru ağır ağır kayar, çeker ve savurur
    j = 0;
    for (const s of B.spouts) {
      const was = s.t; s.t += dt;
      if (was < 0 && s.t >= 0) { sfx.splash(); shake(0.3); spray(s.x, s.fy - 4, 18, 120, 190); }
      if (s.t < 0) { if (rnd() < dt * 22) particle(s.x + (rnd() - 0.5) * 22, s.fy - 2, 0, -30 - rnd() * 30, 0.4, WATER[Math.floor(rnd() * 4)], 1, 1, 0); B.spouts[j++] = s; continue; }
      if (s.t > s.life) { spray(s.x, s.fy - 6, 12, 120, 120); continue; }
      let near = null, nd = 1e9; for (const q of live()) { const d = Math.abs(q.x - s.x); if (d < nd) { nd = d; near = q; } }
      if (near) { const v = C.spout.drift * (two ? 1.5 : 1) * dt; s.x += Math.max(-v, Math.min(v, near.x - s.x)); }
      s.tick -= dt; const bite = s.tick <= 0; if (bite) s.tick = C.spout.tick;
      for (const q of live()) {
        if (q.y < s.fy - s.h - 6 || q.y > s.fy + 6) continue;
        const dx = q.x - s.x, ad = Math.abs(dx);
        if (ad < C.spout.r) { if (bite) { damagePlayer(q, C.spout.dmg * mul, s.x, q.y + 10); spray(q.x, q.y, 5, 80, 90); } pullPlayer(q, 0, -C.spout.lift); }
        else if (ad < C.spout.reach) pullPlayer(q, -Math.sign(dx) * C.spout.pull, 0);
      }
      if (rnd() < dt * 60) { const y = s.fy - rnd() * s.h; particle(s.x + (rnd() - 0.5) * 14, y, (rnd() - 0.5) * 70, -40 - rnd() * 60, 0.45, WATER[Math.floor(rnd() * 4)], rnd() < 0.2 ? 2 : 1, 1, 120); }
      if (bite && rnd() < 0.4) sfx.splash();
      B.spouts[j++] = s;
    }
    B.spouts.length = j;
    // ayaklarının dibinde su kabarır
    if (!e.dead && rnd() < dt * (two ? 14 : 8)) particle(e.x + (rnd() - 0.5) * (two ? 50 : 14), e.y + 7, (rnd() - 0.5) * 20, -20 - rnd() * 30, 0.45, WATER[Math.floor(rnd() * 4)], 1, 1, 140);
  },
};

// ---------- karşılaşma ----------
export function updatePoseidon(dt) {
  const S = G.temple; if (!S || G.tutorial || S.st === 'done') return;
  const x = CENTER_COL * TILE + 8, y = S.r1 * TILE + 8;
  if (S.st === 'wait') {
    if ((S.cd = (S.cd || 0) - dt) > 0 || bossBusy(S)) return;
    const p = G.players.find(q => !q.dead && !q.ride && inTemple(S, q.x, q.y)); if (!p) return;
    Object.assign(S, { st: 'omen', t: 0, pi: p.i, beat: 0 });
    G.threat.bossCd = Math.max(G.threat.bossCd || 0, POSEIDON.omen + 5);
    emit('poseidon', 'omen'); sfx.whale(); shake(0.2);
    return;
  }
  if (S.st === 'omen') {
    // salonun ortasında su toplanıp kabarır
    S.t += dt; const k = S.t / POSEIDON.omen;
    if (rnd() < dt * (20 + 60 * k)) particle(x + (rnd() - 0.5) * (50 - 30 * k), y + 7, (rnd() - 0.5) * 30, -30 - rnd() * (40 + 120 * k), 0.6, WATER[Math.floor(rnd() * 4)], rnd() < 0.3 ? 2 : 1, 1, 160);
    if ((S.beat -= dt) <= 0) { S.beat = 0.45; shake(0.06 + 0.2 * k); }
    if (S.t >= POSEIDON.omen) {
      const c0 = Math.floor(x / TILE);
      for (let r = S.r1 - 2; r <= S.r1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) if (solidAt(c, r) && breakable(c, r)) breakTile(c, r, null);
      const e = spawnEnemy('poseidon', x, y, 4), p = G.players[S.pi];
      e.emergeT = 0; e.intro = e.introT = POSEIDON.intro; e.face = p && p.x < x ? -1 : 1;
      G.threat.bossUp = true; G.threat.bossType = 'poseidon'; G.threat.bossCd = 0;
      Object.assign(S, { st: 'fight', t: 0 });
      spray(x, y + 6, 40, 200, 220); ring(x, y - 6, '#8ad8ff', 56); flashLight(x, y - 10, 9, 0.7); shake(0.8); hitstop(0.08); sfx.splash(); sfx.explode(); bossSfx('poseidon', 'spawn'); haptic([60, 40, 120]);
      emit('bossSpawn', 'poseidon');
    }
    return;
  }
  if (S.st === 'fight') {
    S.t += dt;
    const e = G.enemies.find(o => o.type === 'poseidon');
    // öldüyse bir daha gelmez; izini kaybedip çekildiyse suya döner ve yeniden bekler
    if (e && e.dead && !S.end) S.end = e.dieT > 0.5 ? 'slain' : 'gone';
    if (!e || e.dead) {
      if (S.end === 'slain') Object.assign(S, { st: 'done', t: 0 });
      else Object.assign(S, { st: 'wait', t: 0, end: null, cd: 20 });
    }
  }
}
