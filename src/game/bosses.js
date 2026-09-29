// Bosslar: ölçer tepede kalınca en derindeki madencinin bandına göre biri uyanır.
// Her birinin kendi saldırı döngüsü, yerde yanıp sönen uyarıları ve %50 canda öfke evresi var.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y, PLAY_MIN_COL, PLAY_MAX_COL, stratumOfRow } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { BOSS_BANDS } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, solidAt, setTile, matOf } from '../world/map.js';
import { breakTile, damagePlayer, blindPlayer, pullPlayer, webPlayer } from './player.js';
import { spawnEnemy, losClear, damageStructure } from './enemies.js';
import { sparks, debris, shake, ring, flashLight, dust, hitstop, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';
import { igniteGas } from './hazards.js';

export function bossForY(y) {
  const st = Math.max(0, stratumOfRow(Math.floor(y / TILE)));
  return BOSS_BANDS[Math.min(BOSS_BANDS.length - 1, Math.floor(st / 4))];
}

const live = () => G.players.filter(q => !q.dead);
const TAU = Math.PI * 2;
// kazılabilir mi (boss dalışı / hücumu için): özel taşlar kırılmaz
function breakable(c, r) {
  if (c < PLAY_MIN_COL || c > PLAY_MAX_COL) return false;
  const d = TD[tileAt(c, r)];
  return !(d.unbreakable || d.heart || d.chest || d.nest || d.relic);
}
function hitPlayers(x, y, R, dmg, fn) {
  for (const q of live()) if (Math.hypot(q.x - x, q.y - y) < R) { damagePlayer(q, dmg, x, y); if (fn) fn(q); }
}
// yerde gecikmeli vuruş: önce yanıp söner, sonra patlar
function mark(e, x, y, R, T, dmg, kind) { e.bs.marks.push({ x, y, r: R, t: T, T, dmg, kind, post: 0 }); }
function openSpot(x, y) { return !solidAt(Math.floor(x / TILE), Math.floor(y / TILE)) && y > GROUND_Y + 6; }
function spotNear(x, y, R) {
  for (let i = 0; i < 8; i++) { const a = rnd() * TAU, d = rnd() * R, nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d; if (openSpot(nx, ny)) return [nx, ny]; }
  return [x, y];
}
function bullet(e, a, sp, dmg, col, extra) {
  G.ebullets.push(Object.assign({ x: e.x + Math.cos(a) * 8, y: e.y - 2 + Math.sin(a) * 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2, dmg: dmg * e.dmgMul, col }, extra));
}
// ışın: kayaya çarpınca durur
function beamLen(x, y, a, max) {
  for (let d = 4; d < max; d += 3) if (solidAt(Math.floor((x + Math.cos(a) * d) / TILE), Math.floor((y + Math.sin(a) * d) / TILE))) return d;
  return max;
}
function onBeam(q, x, y, a, len, w) {
  const dx = q.x - x, dy = q.y - 3 - y, t = dx * Math.cos(a) + dy * Math.sin(a);
  if (t < 0 || t > len) return false;
  return Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) < w;
}
function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

// ---------- saldırı kitleri ----------
const KITS = {
  // KARAKÖK: kök mızrakları, toprağa dalıp altından çıkma; öfkede kökçük çağırır
  karakok: {
    cd: { spikes: 2, burrow: 7, summon: 4 },
    choose(e, p, dp, B) {
      if (B.cd.burrow <= 0 && dp < 200) return 'burrow';
      if (B.cd.spikes <= 0 && dp < 150) return 'spikes';
      if (B.phase === 2 && B.cd.summon <= 0) return 'summon';
      return null;
    },
    start: {
      spikes(e, p, B, dt) {
        B.cd.spikes = 4.2; B.act.T = 0.5; e.lunge = 1; sfx.rumble();
        for (const q of live()) {
          if (Math.hypot(q.x - e.x, q.y - e.y) > 170) continue;
          mark(e, q.x, q.y, 10, 0.85, 18, 'root');
          if (B.phase === 2) {
            const vx = (q.x - q.px) / dt, vy = (q.y - q.py) / dt;
            const [ax, ay] = openSpot(q.x + vx * 0.6, q.y + vy * 0.6) ? [q.x + vx * 0.6, q.y + vy * 0.6] : spotNear(q.x, q.y, 30);
            mark(e, ax, ay, 10, 1.0, 18, 'root');
            const [bx, by] = spotNear(q.x, q.y, 34); mark(e, bx, by, 10, 1.15, 18, 'root');
          }
        }
      },
      burrow(e, p, B) {
        B.cd.burrow = 9; B.act.T = 4; B.act.stage = 'sink'; B.act.st = 0.5; B.act.tgt = p.i;
        dust(e.x, e.y + 6, 6, 'rgba(120,90,60,0.6)'); debris(e.x, e.y, 'dirt', 10); sfx.burrow(); shake(0.2);
      },
      summon(e, p, B) {
        B.cd.summon = 7; B.act.T = 0.3;
        for (let k = 0; k < 2; k++) spawnEnemy('rodent', Math.floor(e.x / TILE) * TILE + 8 + (k ? 3 : -3), Math.floor(e.y / TILE) * TILE + 8, G.wave.num).emergeT = 0.4;
        ring(e.x, e.y, '#78b43c', 26); sfx.brood();
      },
    },
    run: {
      burrow(e, dt, p, B) {
        const A = B.act; A.st -= dt;
        if (A.stage === 'sink') { e.sink = 1 - A.st / 0.5; if (A.st <= 0) { A.stage = 'go'; A.st = 2.4; e.under = true; } return; }
        if (A.stage === 'go') {
          const q = G.players[A.tgt]; const tq = q && !q.dead ? q : p;
          if (tq) { const d = Math.hypot(tq.x - e.x, tq.y - e.y) || 1, s = Math.min(d, 85 * dt); e.x += (tq.x - e.x) / d * s; e.y += Math.max(GROUND_Y + 10 - e.y, (tq.y - e.y) / d * s); e.x = Math.max(PLAY_MIN_COL * TILE + 8, Math.min(PLAY_MAX_COL * TILE + 8, e.x)); }
          if (rnd() < dt * 18) debris(e.x + (rnd() - 0.5) * 10, e.y + 4, 'dirt', 1, 0.5);
          if (rnd() < dt * 3) sfx.burrow();
          if (A.st <= 0 || (tq && Math.hypot(tq.x - e.x, tq.y - e.y) < 5)) { A.stage = 'rise'; A.st = 0.65; mark(e, e.x, e.y, 20, 0.65, 0, 'rise'); shake(0.25); }
          return;
        }
        if (A.stage === 'rise' && A.st <= 0) {
          const c0 = Math.floor(e.x / TILE), r0 = Math.floor(e.y / TILE);
          for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) if (TD[tileAt(c, r)].solid && breakable(c, r) && (r === r0 || c === c0 || rnd() < 0.5)) breakTile(c, r, null);
          e.x = c0 * TILE + 8; e.y = r0 * TILE + 8; e.px = e.x; e.py = e.y;
          e.under = false; e.sink = 0; e.lunge = 1;
          hitPlayers(e.x, e.y, 22, 22 * e.dmgMul, q => { q.slowT = Math.max(q.slowT, 0.6); });
          debris(e.x, e.y, 'dirt', 18); dust(e.x, e.y, 8, 'rgba(120,90,60,0.6)'); ring(e.x, e.y, '#78b43c', 30);
          shake(0.55); hitstop(0.06); flashLight(e.x, e.y, 5, 0.3); sfx.explode(); haptic(60);
          A.T = 0;
        }
      },
    },
  },

  // KAVURGAN: kor nefesi (koni), kül yağmuru; öfkede kemik halkası
  kavurgan: {
    cd: { breath: 2.5, embers: 4, bones: 3 },
    choose(e, p, dp, B) {
      if (B.cd.breath <= 0 && dp < 80 && losClear(e.x, e.y, p.x, p.y)) return 'breath';
      if (B.cd.embers <= 0 && dp < 170) return 'embers';
      if (B.phase === 2 && B.cd.bones <= 0 && dp < 160) return 'bones';
      return null;
    },
    start: {
      breath(e, p, B) { B.cd.breath = 5.5; B.act.T = 1.9; B.act.a = Math.atan2(p.y - e.y, p.x - e.x); B.act.tick = 0; e.face = p.x >= e.x ? 1 : -1; sfx.arm(); },
      embers(e, p, B) {
        B.cd.embers = 6.5; B.act.T = 0.45; e.lunge = 1; sfx.flame();
        const n = B.phase === 2 ? 6 : 4;
        for (let i = 0; i < n; i++) { const [x, y] = i === 0 ? [p.x, p.y] : spotNear(p.x, p.y, 40); mark(e, x, y, 11, 0.95 + i * 0.12, 14, 'ember'); }
      },
      bones(e, p, B) {
        B.cd.bones = 5; B.act.T = 0.4; e.lunge = 1; ring(e.x, e.y, '#e8dcc0', 20); sfx.spit();
        const a0 = rnd() * TAU;
        for (let i = 0; i < 10; i++) bullet(e, a0 + i * TAU / 10, 78, 10, '#e8dcc0', { life: 2.2 });
      },
    },
    run: {
      breath(e, dt, p, B) {
        const A = B.act, t = 1.9 - A.T;
        if (t < 0.7) { e.wind = t / 0.7; return; }
        if (B.phase === 2 && p) A.a += Math.max(-1.2 * dt, Math.min(1.2 * dt, angDiff(Math.atan2(p.y - e.y, p.x - e.x), A.a)));
        A.fire = true;
        const mx = e.x + Math.cos(A.a) * 8, my = e.y + Math.sin(A.a) * 8;
        for (let i = 0; i < 3; i++) { const a = A.a + (rnd() - 0.5) * 0.8, s = 60 + rnd() * 70; particle(mx, my, Math.cos(a) * s, Math.sin(a) * s, 0.5, rnd() < 0.5 ? '#ffd060' : '#ff6a1a', rnd() < 0.3 ? 2 : 1, 1, -30); }
        A.tick -= dt;
        if (A.tick <= 0) {
          A.tick = 0.2;
          for (const q of live()) {
            const dx = q.x - e.x, dy = q.y - e.y;
            if (Math.hypot(dx, dy) < 78 && Math.abs(angDiff(Math.atan2(dy, dx), A.a)) < 0.42 && losClear(e.x, e.y, q.x, q.y)) damagePlayer(q, 7 * e.dmgMul, e.x, e.y);
          }
          for (const s of G.structures) if (!s.dead && Math.hypot(s.x - e.x, s.y - e.y) < 78 && Math.abs(angDiff(Math.atan2(s.y - e.y, s.x - e.x), A.a)) < 0.42) damageStructure(s, 6);
          igniteGas(e.x + Math.cos(A.a) * 40, e.y + Math.sin(A.a) * 40, 30);
          sfx.flame();
        }
      },
    },
  },

  // ÖTEGÖZ: güdümlü boşluk küreleri, çekim; öfkede tarayan göz ışını. Işınlanır.
  otegoz: {
    cd: { orbs: 1.5, pull: 5, gaze: 2 },
    choose(e, p, dp, B) {
      const los = losClear(e.x, e.y, p.x, p.y);
      if (B.phase === 2 && B.cd.gaze <= 0 && dp < 130 && los) return 'gaze';
      if (B.cd.pull <= 0 && dp < 115 && los) return 'pull';
      if (B.cd.orbs <= 0 && dp < 170) return 'orbs';
      return null;
    },
    start: {
      orbs(e, p, B) {
        B.cd.orbs = 4; B.act.T = 0.5; e.flashT = 0.5; sfx.blink();
        const n = B.phase === 2 ? 5 : 3, a0 = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = 0; i < n; i++) bullet(e, a0 + (i - (n - 1) / 2) * 0.55, 55, 12, '#b080ff', { life: 3.4, home: 2.4, slow: 1.2, orb: true });
      },
      pull(e, p, B) { B.cd.pull = 7.5; B.act.T = 2; sfx.tongue(); },
      gaze(e, p, B) {
        B.cd.gaze = 7; B.act.T = 2.1; B.act.tick = 0;
        const a = Math.atan2(p.y - e.y, p.x - e.x); B.act.dir = rnd() < 0.5 ? 1 : -1; B.act.a = a - 0.75 * B.act.dir; sfx.arm();
      },
    },
    run: {
      pull(e, dt, p, B) {
        const A = B.act, t = 2 - A.T;
        if (t < 0.6) { e.wind = t / 0.6; return; }
        A.fire = true;
        for (const q of live()) {
          const d = Math.hypot(q.x - e.x, q.y - e.y) || 1;
          if (d < 125 && losClear(e.x, e.y, q.x, q.y)) { pullPlayer(q, (e.x - q.x) / d * 4.2, (e.y - q.y) / d * 4.2); if (rnd() < dt * 20) particle(q.x, q.y, (e.x - q.x) / d * 60, (e.y - q.y) / d * 60, 0.3, '#b080ff', 1, 1, 0); }
        }
        if (A.T <= dt && !A.done) { A.done = true; hitPlayers(e.x, e.y, 24, 16 * e.dmgMul); ring(e.x, e.y, '#c0b8ff', 22); sfx.shade(); }
      },
      gaze(e, dt, p, B) {
        const A = B.act, t = 2.1 - A.T;
        A.len = beamLen(e.x, e.y, A.a, 140);
        if (t < 0.8) { e.wind = t / 0.8; return; }
        A.fire = true; A.a += A.dir * 1.25 * dt;
        A.tick -= dt;
        if (A.tick <= 0) { A.tick = 0.15; for (const q of live()) if (onBeam(q, e.x, e.y, A.a, A.len, 5)) { damagePlayer(q, 9 * e.dmgMul, e.x, e.y); sparks(q.x, q.y, '#c0b8ff', 5, 60); } }
        if (rnd() < dt * 30) sparks(e.x + Math.cos(A.a) * A.len, e.y + Math.sin(A.a) * A.len, '#c0b8ff', 1, 50);
      },
    },
  },

  // TAÇSIZ SULTAN: kayayı yararak hücum, asa darbesi (şok halkası), altın yelpazesi
  sultan: {
    cd: { charge: 3, slam: 2, coins: 2 },
    choose(e, p, dp, B) {
      if (B.cd.slam <= 0 && dp < 50) return 'slam';
      if (B.cd.charge <= 0 && dp > 36 && dp < 160) return 'charge';
      if (B.cd.coins <= 0 && dp < 150 && losClear(e.x, e.y, p.x, p.y)) return 'coins';
      return null;
    },
    start: {
      charge(e, p, B) {
        B.cd.charge = 6; B.act.T = 3; B.act.stage = 'aim'; B.act.st = B.phase === 2 ? 0.6 : 0.8;
        B.act.a = Math.atan2(p.y - e.y, p.x - e.x); B.act.hit = []; B.act.chain = B.phase === 2 ? 1 : 0; e.face = p.x >= e.x ? 1 : -1; sfx.arm();
      },
      slam(e, p, B) { B.cd.slam = 4.5; B.act.T = 0.6; sfx.arm(); },
      coins(e, p, B) {
        B.cd.coins = 3.5; B.act.T = 0.35; e.lunge = 1; sfx.buy();
        const n = B.phase === 2 ? 7 : 5, a0 = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = 0; i < n; i++) bullet(e, a0 + (i - (n - 1) / 2) * 0.16, 118, 9, '#ffd870', { life: 1.6, coin: true });
      },
    },
    run: {
      charge(e, dt, p, B) {
        const A = B.act; A.st -= dt;
        if (A.stage === 'aim') {
          e.wind = 1 - Math.max(0, A.st) / 0.8;
          if (A.st <= 0) { A.stage = 'dash'; A.st = 0.8; A.fire = true; sfx.rumble(); }
          return;
        }
        if (A.stage === 'dash') {
          const step = 200 * dt, nx = e.x + Math.cos(A.a) * step, ny = e.y + Math.sin(A.a) * step;
          let stop = ny < GROUND_Y + 8;
          const h = 7;
          for (let r = Math.floor((ny - h) / TILE); r <= Math.floor((ny + h) / TILE) && !stop; r++) for (let c = Math.floor((nx - h) / TILE); c <= Math.floor((nx + h) / TILE); c++) {
            if (!TD[tileAt(c, r)].solid) continue;
            if (breakable(c, r)) { breakTile(c, r, null); debris(c * TILE + 8, r * TILE + 8, 'stone', 4); } else { stop = true; break; }
          }
          if (!stop) { e.x = nx; e.y = ny; e.lunge = 1; }
          if (rnd() < 0.6) sparks(e.x, e.y + 6, '#ffd870', 1, 40);
          for (const q of live()) if (!A.hit.includes(q.i) && Math.hypot(q.x - e.x, q.y - e.y) < e.r + 7) { A.hit.push(q.i); damagePlayer(q, 26 * e.dmgMul, e.x - Math.cos(A.a) * 20, e.y - Math.sin(A.a) * 20); shake(0.4); hitstop(0.05); }
          if (stop || A.st <= 0) {
            if (stop) { shake(0.5); debris(e.x, e.y, 'stone', 10); sfx.explode(); }
            if (A.chain > 0 && p) { A.chain--; A.stage = 'aim'; A.st = 0.45; A.a = Math.atan2(p.y - e.y, p.x - e.x); A.hit = []; A.fire = false; e.face = p.x >= e.x ? 1 : -1; return; }
            A.stage = 'daze'; A.st = 1.1; A.fire = false;
          }
          return;
        }
        if (A.stage === 'daze' && A.st <= 0) A.T = 0;
      },
      slam(e, dt, p, B) {
        const A = B.act;
        e.wind = 1 - Math.max(0, A.T) / 0.6;
        if (A.T <= dt && !A.done) { A.done = true;
          B.rings.push({ x: e.x, y: e.y + 4, r: 8, R: 76, v: 150, dmg: 16 * e.dmgMul, hit: [], col: '#ffd870', los: false });
          dust(e.x, e.y + 8, 8, 'rgba(255,216,112,0.4)'); shake(0.45); hitstop(0.04); sfx.rumble(); e.lunge = 1;
          for (const s of G.structures) if (!s.dead && Math.hypot(s.x - e.x, s.y - e.y) < 70) damageStructure(s, 10);
        }
      },
    },
  },

  // EZELÎ: yargı sütunları, kıyamet halkası (kayanın arkasına saklan); öfkede Işık Bekçileri çağırır
  ezeli: {
    cd: { pillars: 1.5, doom: 5 },
    choose(e, p, dp, B) {
      if (B.cd.doom <= 0 && dp < 140) return 'doom';
      if (B.cd.pillars <= 0 && dp < 170) return 'pillars';
      return null;
    },
    start: {
      pillars(e, p, B, dt) {
        B.cd.pillars = B.phase === 2 ? 3.4 : 4.5; B.act.T = 0.4; e.flashT = 0.4; sfx.glare();
        for (const q of live()) {
          if (Math.hypot(q.x - e.x, q.y - e.y) > 190) continue;
          mark(e, q.x, q.y, 9, 1.0, 20, 'light');
          const vx = (q.x - q.px) / dt, vy = (q.y - q.py) / dt;
          if (openSpot(q.x + vx * 0.9, q.y + vy * 0.9)) mark(e, q.x + vx * 0.9, q.y + vy * 0.9, 9, 1.15, 20, 'light');
          if (B.phase === 2) for (let i = 0; i < 2; i++) { const [x, y] = spotNear(q.x, q.y, 44); mark(e, x, y, 9, 1.2 + i * 0.15, 20, 'light'); }
        }
      },
      doom(e, p, B) {
        B.cd.doom = B.phase === 2 ? 7 : 9.5; B.act.T = 1.2; sfx.arm();
        if (!B.hinted) { B.hinted = true; emit('toast', { text: 'Kıyamet Halkası: kayanın arkasına saklan!', icon: 'skull', bad: true }); }
      },
    },
    run: {
      doom(e, dt, p, B) {
        const A = B.act;
        e.wind = 1 - Math.max(0, A.T) / 1.2;
        if (rnd() < dt * 40) { const a = rnd() * TAU, d = 30 + rnd() * 20; particle(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, -Math.cos(a) * 60, -Math.sin(a) * 60, 0.4, '#fff4c0', 1, 1, 0); }
        if (A.T <= dt && !A.done) { A.done = true;
          B.rings.push({ x: e.x, y: e.y, r: 10, R: 160, v: 115, dmg: 24 * e.dmgMul, hit: [], col: '#fff4c0', los: true });
          flashLight(e.x, e.y, 9, 0.5); shake(0.4); sfx.nova(); haptic(50);
        }
      },
    },
  },
};

Object.assign(KITS, {
  // AYNASIZ HÜKÜMDAR: hedefinin taktığı silahı kopyalar; ışınlanır; öfkede ayna kırıkları
  aynasiz: {
    cd: { mirror: 1.5, step: 5, shards: 3 },
    choose(e, p, dp, B) {
      if (B.cd.step <= 0 && dp < 210) return 'step';
      if (B.cd.mirror <= 0 && dp < 150 && losClear(e.x, e.y, p.x, p.y)) return 'mirror';
      if (B.phase === 2 && B.cd.shards <= 0 && dp < 170) return 'shards';
      return null;
    },
    start: {
      mirror(e, p, B) { B.cd.mirror = B.phase === 2 ? 2.4 : 3.2; B.act.T = 1.4; B.act.w = p.wpn || 'blaster'; B.act.tgt = p.i; B.act.n = 0; B.act.tick = 0; e.flashT = 0.6; sfx.arm(); },
      step(e, p, B) {
        B.cd.step = 6.5; B.act.T = 0.5;
        const [x, y] = spotNear(p.x - p.face * 40, p.y, 30);
        ring(e.x, e.y, '#c8d0ff', 24); sparks(e.x, e.y, '#ffffff', 12, 90);
        if (openSpot(x, y)) { e.x = e.px = x; e.y = e.py = y; }
        ring(e.x, e.y, '#c8d0ff', 30); flashLight(e.x, e.y, 5, 0.3); sfx.blink(); e.face = p.x >= e.x ? 1 : -1;
      },
      shards(e, p, B) {
        B.cd.shards = 5.5; B.act.T = 0.4; e.lunge = 1; ring(e.x, e.y, '#e0e8ff', 26); sfx.shade();
        const a0 = rnd() * TAU; for (let i = 0; i < 14; i++) bullet(e, a0 + i * TAU / 14, 90, 12, '#e0e8ff', { life: 2.4 });
      },
    },
    run: {
      mirror(e, dt, p, B) {
        const A = B.act, t = 1.4 - A.T, q0 = G.players[A.tgt], q = q0 && !q0.dead ? q0 : p;
        if (!q) return;
        e.face = q.x >= e.x ? 1 : -1;
        if (t < 0.55) { e.wind = t / 0.55; return; }
        const a = Math.atan2(q.y - 3 - e.y, q.x - e.x);
        A.tick -= dt; if (A.tick > 0) return;
        const w = A.w;
        if (w === 'sacma') { if (!A.n++) for (let i = 0; i < 5; i++) bullet(e, a + (i - 2) * 0.16, 140, 9, '#d8b080', { life: 0.9 }); }
        else if (w === 'makineli') { A.tick = 0.08; bullet(e, a + (rnd() - 0.5) * 0.25, 170, 6, '#a7b0c4', { life: 1.2 }); }
        else if (w === 'alev') { A.tick = 0.18; for (const o of live()) { const dx = o.x - e.x, dy = o.y - e.y; if (Math.hypot(dx, dy) < 70 && Math.abs(angDiff(Math.atan2(dy, dx), a)) < 0.45 && losClear(e.x, e.y, o.x, o.y)) { damagePlayer(o, 6 * e.dmgMul, e.x, e.y); o.burnT = 1.5; } } for (let i = 0; i < 4; i++) { const b = a + (rnd() - 0.5) * 0.7, s = 70 + rnd() * 60; particle(e.x, e.y, Math.cos(b) * s, Math.sin(b) * s, 0.4, rnd() < 0.5 ? '#ffd060' : '#e0502a', 2, 1, -30); } }
        else if (w === 'tufek') { if (!A.n++) bullet(e, a, 320, 26, '#ffffff', { life: 1 }); }
        else if (w === 'simsek') { if (!A.n++ && losClear(e.x, e.y, q.x, q.y)) { damagePlayer(q, 18 * e.dmgMul, e.x, e.y); G.zaps.push({ x0: e.x, y0: e.y, x1: q.x, y1: q.y - 4, t: 0.15 }); sfx.zap(); } }
        else if (w === 'roket') { if (!A.n++) { mark(e, q.x, q.y, 16, 0.9, 22, 'ember'); bullet(e, a, 80, 6, '#ffb050', { life: 1 }); } }
        else if (w === 'kirag') { if (A.n++ < 3) { A.tick = 0.2; bullet(e, a + (A.n - 2) * 0.12, 120, 9, '#bff4ff', { life: 1.6, slow: 1.5 }); } }
        else { if (A.n++ < 3) { A.tick = 0.15; bullet(e, a, 150, 11, '#c8d0ff', { life: 1.4 }); } }
      },
    },
  },
  // KEHRİBAR ANA: yumurta yağmuru (çatlayınca tozböcek), reçine yelpazesi; öfkede kehribara hapseder
  kehribarAna: {
    cd: { eggs: 2, resin: 3, amber: 5 },
    choose(e, p, dp, B) {
      if (B.phase === 2 && B.cd.amber <= 0 && dp < 130) return 'amber';
      if (B.cd.eggs <= 0 && dp < 180) return 'eggs';
      if (B.cd.resin <= 0 && dp < 140 && losClear(e.x, e.y, p.x, p.y)) return 'resin';
      return null;
    },
    start: {
      eggs(e, p, B) {
        B.cd.eggs = 5.5; B.act.T = 0.4; e.lunge = 1; sfx.brood();
        for (const q of live()) { if (Math.hypot(q.x - e.x, q.y - e.y) > 190) continue; for (let i = 0; i < (B.phase === 2 ? 4 : 3); i++) { const [x, y] = i ? spotNear(q.x, q.y, 40) : [q.x, q.y]; mark(e, x, y, 9, 1.1 + i * 0.15, 10, 'egg'); } }
      },
      resin(e, p, B) {
        B.cd.resin = 4; B.act.T = 0.4; e.lunge = 1; sfx.spit();
        const a0 = Math.atan2(p.y - e.y, p.x - e.x); for (let i = 0; i < 5; i++) bullet(e, a0 + (i - 2) * 0.22, 110, 8, '#ffb040', { life: 1.6, web: true });
      },
      amber(e, p, B) { B.cd.amber = 7.5; B.act.T = 0.3; sfx.arm(); for (const q of live()) if (Math.hypot(q.x - e.x, q.y - e.y) < 190) mark(e, q.x, q.y, 12, 1.1, 14, 'amber'); },
    },
    run: {},
  },
  // MADENİN KALBİ: duvarlardan dikenler, tavan çöküşü, nabız halkası (kayanın ardına saklan)
  madenKalbi: {
    cd: { spikes: 1.5, fall: 4, beat: 5 },
    choose(e, p, dp, B) {
      if (B.cd.beat <= 0 && dp < 150) return 'beat';
      if (B.cd.spikes <= 0 && dp < 210) return 'spikes';
      if (B.cd.fall <= 0 && dp < 210) return 'fall';
      return null;
    },
    start: {
      spikes(e, p, B) {
        B.cd.spikes = B.phase === 2 ? 2.4 : 3.2; B.act.T = 0.4; e.flashT = 0.4; sfx.creak();
        for (const q of live()) {
          if (Math.hypot(q.x - e.x, q.y - e.y) > 220) continue;
          const pc = Math.floor(q.x / TILE), pr = Math.floor(q.y / TILE); let n = 0;
          for (let tries = 0; tries < 30 && n < (B.phase === 2 ? 6 : 4); tries++) {
            const c = pc + Math.round((rnd() - 0.5) * 6), r = pr + Math.round((rnd() - 0.5) * 6);
            if (solidAt(c, r) || !(solidAt(c + 1, r) || solidAt(c - 1, r) || solidAt(c, r + 1) || solidAt(c, r - 1))) continue;
            mark(e, c * TILE + 8, r * TILE + 8, 9, 0.9 + n * 0.1, 20, 'spike'); n++;
          }
          if (!n) mark(e, q.x, q.y, 9, 0.9, 20, 'spike');
        }
      },
      fall(e, p, B) { B.cd.fall = 6; B.act.T = 0.3; sfx.rumble(); shake(0.3); for (const q of live()) if (Math.hypot(q.x - e.x, q.y - e.y) < 220) mark(e, q.x, q.y, 14, 1.0, 0, 'rock'); },
      beat(e, p, B) { B.cd.beat = B.phase === 2 ? 5 : 7; B.act.T = 1; B.act.n = 0; sfx.arm(); },
    },
    run: {
      beat(e, dt, p, B) {
        const A = B.act; e.wind = 1 - Math.max(0, A.T) / 1;
        const fire = () => { B.rings.push({ x: e.x, y: e.y, r: 10, R: 150, v: 120, dmg: 20 * e.dmgMul, hit: [], col: '#ff3a6a', los: true }); flashLight(e.x, e.y, 7, 0.4); shake(0.35); sfx.rumble(); haptic(40); };
        if (A.T <= 0.5 && A.n === 0 && B.phase === 2) { A.n = 1; fire(); }
        if (A.T <= dt && !A.done) { A.done = true; fire(); }
      },
    },
  },
});

function initBoss(e) {
  const K = KITS[e.type];
  e.bs = { phase: 1, act: null, cd: Object.assign({}, K.cd), marks: [], rings: [], hinted: false };
}

function enrage(e) {
  const B = e.bs; B.phase = 2; B.act = null; e.under = false; e.sink = 0; e.wind = 0;
  e.flashT = 0.6; ring(e.x, e.y, e.d.col, 44); ring(e.x, e.y, '#ffffff', 26); sparks(e.x, e.y, e.d.col, 24, 140);
  shake(0.6); hitstop(0.12); flashLight(e.x, e.y, 8, 0.5); sfx.howl(); haptic([40, 60, 120]);
  if (e.type === 'ezeli') for (let k = 0; k < 2; k++) { const s = spawnEnemy('seraph', e.x + (k ? 18 : -18), e.y - 6, G.wave.num); s.emergeT = 0.3; }
  const call = { aynasiz: ['kalkanli', 'kalkanli'], kehribarAna: ['yumurtaci', 'diriltici'], madenKalbi: ['korAvci', 'kalkanli', 'isikYiyen'] }[e.type];
  if (call) call.forEach((t, k) => { const s = spawnEnemy(t, e.x + (k - (call.length - 1) / 2) * 20, e.y - 4, G.wave.num); s.emergeT = 0.4; });
  emit('bossPhase', e.type);
}

function tickMarks(e, dt) {
  const B = e.bs;
  let j = 0;
  for (const m of B.marks) {
    if (m.t > 0) {
      m.t -= dt;
      if (m.t <= 0) {
        m.post = 0.4;
        if (m.dmg) hitPlayers(m.x, m.y, m.r + 3, m.dmg * e.dmgMul, m.kind === 'light' ? q => blindPlayer(q, 0.6) : m.kind === 'root' ? q => { q.slowT = Math.max(q.slowT, 0.7); } : null);
        if (m.kind === 'root') { debris(m.x, m.y, 'dirt', 6); sparks(m.x, m.y, '#78b43c', 6, 70); sfx.creak(); }
        else if (m.kind === 'ember') { sparks(m.x, m.y, '#ff6a1a', 12, 100); sparks(m.x, m.y, '#ffd060', 6, 60); flashLight(m.x, m.y, 3, 0.2); igniteGas(m.x, m.y, 16); sfx.mortarHit(); }
        else if (m.kind === 'light') { sparks(m.x, m.y, '#fff4c0', 12, 110); flashLight(m.x, m.y, 5, 0.25); sfx.zap(); }
        else if (m.kind === 'egg') { for (let k = 0; k < 2; k++) spawnEnemy('tozbocek', m.x + (k ? 3 : -3), m.y, G.wave.num).emergeT = 0.15; sparks(m.x, m.y, '#ffd890', 10, 80); sfx.brood(); }
        else if (m.kind === 'amber') { for (const q of live()) if (Math.hypot(q.x - m.x, q.y - m.y) < m.r + 3) webPlayer(q, 2.2); sparks(m.x, m.y, '#ffb040', 14, 90); ring(m.x, m.y, '#ffb040', 18); sfx.web(); }
        else if (m.kind === 'spike') { sparks(m.x, m.y, '#ff3a6a', 10, 110); debris(m.x, m.y, 'stone', 4); sfx.creak(); }
        else if (m.kind === 'rock') {
          // tavan çöker: işaretin üstündeki desteksiz kayalar düşer
          const c0 = Math.floor(m.x / TILE), r0 = Math.floor(m.y / TILE); let n = 0;
          for (let r = r0 - 1; r >= r0 - 6 && n < 3; r--) for (let c = c0 - 1; c <= c0 + 1 && n < 3; c++) {
            const d = TD[tileAt(c, r)];
            if (d.plain && !solidAt(c, r + 1)) { const mat = matOf(c, r); setTile(c, r, T.AIR); G.rocks.push({ x: c * TILE + 8, y: r * TILE + 8, vy: 30, mat }); n++; }
          }
          shake(0.3); sfx.rockfall();
        }
      }
    } else m.post -= dt;
    if (m.t > 0 || m.post > 0) B.marks[j++] = m;
  }
  B.marks.length = j;
  j = 0;
  for (const R of B.rings) {
    R.r += R.v * dt;
    for (const q of live()) {
      if (R.hit.includes(q.i)) continue;
      const d = Math.hypot(q.x - R.x, q.y - R.y);
      if (Math.abs(d - R.r) < 6 && (!R.los || losClear(R.x, R.y, q.x, q.y))) { R.hit.push(q.i); damagePlayer(q, R.dmg, R.x, R.y); sparks(q.x, q.y, R.col, 8, 80); if (R.los) blindPlayer(q, 0.5); }
    }
    if (R.r < R.R) B.rings[j++] = R;
  }
  B.rings.length = j;
}

// true dönerse bu karede yürümez/saldırmaz
export function updateBoss(e, dt, p, dp) {
  if (!e.bs) initBoss(e);
  const B = e.bs, K = KITS[e.type];
  tickMarks(e, dt);
  if (B.phase === 1 && e.hp < e.maxHp * 0.5) enrage(e);
  if (B.phase === 2) { e.slowT = Math.min(e.slowT, -0.1); if (rnd() < dt * 10) particle(e.x + (rnd() - 0.5) * 20, e.y + (rnd() - 0.5) * 14, 0, -20, 0.5, e.d.col, 1, 1, 0); }
  if (B.act) {
    B.act.T -= dt;
    const run = K.run[B.act.k];
    if (run) run(e, dt, p, B);
    if (B.act.T <= 0) { B.act = null; e.wind = 0; }
    return true;
  }
  const rate = B.phase === 2 ? 1.35 : 1;
  for (const k in B.cd) B.cd[k] -= dt * rate;
  if (!p || p.dead) return false;
  const k = K.choose(e, p, dp, B);
  if (!k) return false;
  B.act = { k, T: 1 };
  K.start[k](e, p, B, dt);
  return true;
}
