// Hazine Ejderi: Altın Saray'ın altındaki hazine odasında altın yığınının üstünde uyur.
// Altın ve gürültü yalnız kıpırdatır; ona saldırana (mermi, kazma, dinamit) kadar uyur. Hazine sessizce alınabilir.
// Uyanınca: altın üstünden kayar, başını kaldırır, kanatlarını açıp kükrer. Nefesinden önce göğsü içeriden parlar (zayıf nokta).
import { rnd } from '../core/rng.js';
import { TILE, COLS, GROUND_ROW, STRATUM_ROWS, PLAY_MIN_COL, PLAY_MAX_COL, CENTER_COL } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { HOARD } from '../data/balance.js';
import { G } from './state.js';
import { tileAt } from '../world/map.js';
import { breakTile, damagePlayer, pullPlayer } from './player.js';
import { spawnEnemy, losClear, damageStructure } from './enemies.js';
import { KITS, live, breakable, bullet, mark, hitPlayers, angDiff, spotNear } from './bosses.js';
import { shake, flashLight, debris, dust, ring, sparks, hitstop, particle } from './fx.js';
import { igniteGas } from './hazards.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';
import { isLocal } from './run.js';

export const PALACE_BIOME = 12;

// hazine salonu: sarayın altında kemerli, altın yığınlı büyük oda. Ejder yığının içine gömülü uyur
export function placeHoard(g) {
  const s = g.order.indexOf(PALACE_BIOME); if (s < 0) return null;
  const base = GROUND_ROW + s * STRATUM_ROWS, r0 = base + 27, r1 = base + 40, c0 = PLAY_MIN_COL + 1, c1 = PLAY_MAX_COL - 1, mid = (c0 + c1) / 2;
  const set = (c, r, t) => { if (!TD[g.map[r * COLS + c]].nest) g.map[r * COLS + c] = t; };
  // içerisi boşaltılır; salona düşen yuva biyomun yukarısındaki düz bir kayaya taşınır
  let moved = 0;
  for (let r = r0 - 1; r <= r1 + 1; r++) for (let c = c0 - 1; c <= c1 + 1; c++) {
    const wall = r === r0 - 1 || r === r1 + 1 || c === c0 - 1 || c === c1 + 1;
    if (wall) { set(c, r, T.GILT); continue; }
    if (TD[g.map[r * COLS + c]].nest) moved++;
    g.map[r * COLS + c] = T.AIR; if (g.buried) g.buried[r * COLS + c] = 0;
  }
  for (let k = 0; k < 400 && moved > 0; k++) {
    const c = c0 + 1 + (k * 7) % (c1 - c0 - 1), r = base + 3 + (k * 5) % 20, i = r * COLS + c;
    if (Math.abs(c - CENTER_COL) > 1 && TD[g.map[i]].plain) { g.map[i] = T.NEST; if (g.buried) g.buried[i] = 1; moved--; }
  }
  // kemerli tavan
  for (let c = c0; c <= c1; c++) { const d = Math.abs(c - mid); if (d >= 3) set(c, r0, T.GILT); if (d >= 4) set(c, r0 + 1, T.GILT); if (d >= 5) set(c, r0 + 2, T.GILT); }
  // yığın: ortada üç kat altın tepesi, kenarlara iner; ejder tepenin üstünde yarı gömülü yatar
  for (let c = c0; c <= c1; c++) { const h = Math.max(1, Math.round(3.4 - Math.abs(c - (mid + 0.5)) * 0.5)); for (let k = 0; k < h; k++) set(c, r1 - k, T.GOLD); }
  set(c0, r1 - 1, T.CHEST_GOLD); set(c1, r1 - 1, T.CHEST_GOLD);
  return { v: 2, st: 'sleep', wake: 0, c: Math.round(mid) + 1, r: r1 - 2, c0, c1, r0, r1, gold: -1, t: 0, lv: 0, seen: false };
}
export const inHall = (H, x, y) => { const c = x / TILE, r = y / TILE; return c >= H.c0 - 1 && c <= H.c1 + 2 && r >= H.r0 - 2 && r <= H.r1 + 1; };
function goldLeft(H) { let n = 0; for (let r = H.r0; r <= H.r1; r++) for (let c = H.c0; c <= H.c1; c++) if (TD[tileAt(c, r)].ore === 'gold' || TD[tileAt(c, r)].chest) n++; return n; }
// uyuyan ejderin gövdesi (dünya): saldırı bu kutuya değerse uyanır
export const hoardBox = H => ({ x: H.c * TILE + 8, y: H.r * TILE - 16, w: 64, h: 30 });
const inBox = (B, x, y, m = 0) => Math.abs(x - B.x) < B.w + m && Math.abs(y - B.y) < B.h + m;

function attacked(H, dt) {
  const B = hoardBox(H);
  for (const b of G.bullets) if (b.from === 'p' && inBox(B, b.x, b.y)) return 'shot';
  for (const b of G.bombs) if (b.t <= dt * 2 && inBox(B, b.x, b.y, 30)) return 'boom';
  for (const p of G.players) if (!p.dead && p.dig && p.digDir && inBox(B, p.x + p.digDir[0] * 14, p.y + p.digDir[1] * 14)) return 'pick';
  for (const e of G.enemies) if (!e.dead && e.type !== 'ejder' && inBox(B, e.x, e.y)) return 'bump';
  return null;
}

export function updateHoard(dt) {
  const H = G.hoard; if (!H || G.tutorial) return;
  if (H.st === 'done') return;
  H.t += dt;
  if (H.st === 'sleep') {
    const near = G.players.filter(q => !q.dead && inHall(H, q.x, q.y));
    if (near.length && !H.seen) { H.seen = true; emit('hoard', 'seen'); }
    // horlama: salondaysan duyulur
    if (near.length && (H.snore = (H.snore || 0) - dt) <= 0) { H.snore = 3.2; if (near.some(isLocal)) sfx.snore(); }
    // altın ve gürültü yalnız kıpırdatır (kuyruk seğirir, göz aralanır); uyandıran saldırıdır
    if ((H.cnt = (H.cnt || 0) - dt) <= 0) {
      H.cnt = 0.25; const n = goldLeft(H);
      if (H.gold >= 0 && n < H.gold) { H.wake = Math.min(HOARD.stirMax, H.wake + (H.gold - n) * HOARD.gold); sfx.coins(); }
      H.gold = n;
    }
    if (near.length) H.wake = Math.min(HOARD.stirMax, H.wake + dt * HOARD.noise * (G.threat.noise / 100));
    else H.wake = Math.max(0, H.wake - dt * HOARD.decay);
    const lv = H.wake >= 70 ? 2 : H.wake >= 40 ? 1 : 0;
    if (lv > H.lv) { emit('hoard', lv === 2 ? 'eye' : 'stir'); if (lv === 2) sfx.growl(); shake(0.15); }
    H.lv = lv;
    const why = attacked(H, dt);
    if (why) {
      H.st = 'wake'; H.t = 0; H.why = why; G.threat.bossCd = Math.max(G.threat.bossCd || 0, HOARD.intro + 5);
      emit('hoard', 'wake'); sfx.growl(); shake(0.5); haptic([40, 30, 80]);
    }
    return;
  }
  if (H.st === 'wake') {
    const x = H.c * TILE + 8, y = H.r * TILE + 8;
    // altın patlar: ejder yığının içinden kalkar, üstündeki altın saçılır
    if (H.t > 0.3 && !H.burst) {
      H.burst = true;
      for (let r = H.r - 2; r <= H.r + 1; r++) for (let c = H.c - 3; c <= H.c + 3; c++) if (TD[tileAt(c, r)].ore === 'gold') breakTile(c, r, null);
      for (let i = 0; i < 70; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6, s = 60 + rnd() * 160; particle(x + (rnd() - 0.5) * 60, y - 6, Math.cos(a) * s, Math.sin(a) * s, 1 + rnd() * 0.8, rnd() < 0.5 ? '#ffd24a' : rnd() < 0.5 ? '#ffe79a' : '#c8901a', rnd() < 0.3 ? 2 : 1, 0, 320); }
      dust(x, y, 14, 'rgba(255,220,140,0.45)'); shake(1); hitstop(0.1); flashLight(x, y - 10, 6, 0.4); sfx.coins(); sfx.explode(); haptic([60, 40, 120]);
    }
    if (H.t > 0.3 && rnd() < dt * 40) particle(x + (rnd() - 0.5) * 60, y - 10 - rnd() * 24, (rnd() - 0.5) * 60, -10, 0.9, rnd() < 0.5 ? '#ffd24a' : '#ffe79a', 1, 0, 300);
    if (H.t > 1.45 && !H.roar) { H.roar = true; sfx.roar(); shake(0.9); flashLight(x, y - 20, 8, 0.6); haptic([80, 40, 160]); }
    if (H.t >= HOARD.intro) {
      const e = spawnEnemy('ejder', x, y, 4);
      e.emergeT = 0; e.face = -1;
      G.threat.bossUp = true; G.threat.bossType = 'ejder'; G.threat.bossCd = 0;
      H.st = 'fight'; H.t = 0;
      ring(x, y - 16, '#ff8a2a', 60); sparks(x, y - 16, '#ffd060', 26, 150); shake(0.6);
      emit('bossSpawn', 'ejder');
    }
    return;
  }
  if (H.st === 'fight') {
    const e = G.enemies.find(o => o.type === 'ejder');
    if (e && e.dead && !H.end) H.end = e.dieT > 0.5 ? 'slain' : 'gone';
    if (!e || e.dead) {
      // öldü: hazine senin. İzini kaybettiyse yığına döner ve uyur
      if (H.end === 'slain') { H.st = 'done'; H.t = 0; }
      else Object.assign(H, { st: 'sleep', wake: 30, t: 0, end: null, roar: false, burst: false, lv: 0 });
    }
  }
}

// ---------- saldırılar ----------
const MOUTH = e => [e.x + e.face * 72, e.y - 23]; // Yeni nefes pozunun ağzı: [152,105], köken [80,136].
KITS.ejder = {
  cd: { breath: 1.5, tail: 1, gust: 6, soar: 4 },
  choose(e, p, dp, B) {
    const [mx, my] = MOUTH(e), los = losClear(mx, my, p.x, p.y);
    if (B.cd.tail <= 0 && dp < 40 && (p.x - e.x) * e.face < 6) return 'tail';
    if (B.phase === 2 && B.cd.soar <= 0 && dp < 200) return 'soar';
    if (B.cd.breath <= 0 && dp < 125 && los) return 'breath';
    if (B.cd.gust <= 0 && dp < 110) return 'gust';
    return null;
  },
  start: {
    breath(e, p, B) {
      const A = B.act; B.cd.breath = B.phase === 2 ? 4.5 : 5.5; A.T = 9; A.stage = 'glow'; A.st = 1.1; A.tick = 0;
      e.face = p.x >= e.x ? 1 : -1; const [mx, my] = MOUTH(e); A.a = Math.atan2(p.y - 3 - my, p.x - mx); sfx.arm();
      if (!B.hinted) { B.hinted = true; emit('toast', { text: 'Göğsü parlıyor: şimdi göğsüne vur!', icon: 'flame', bad: true }); }
    },
    tail(e, p, B) { const A = B.act; B.cd.tail = 3.2; A.T = 0.9; A.done = false; sfx.arm(); },
    gust(e, p, B) { const A = B.act; B.cd.gust = B.phase === 2 ? 6 : 8; A.T = 1.3; A.done = false; e.face = p.x >= e.x ? 1 : -1; sfx.rumble(); },
    soar(e, p, B) { const A = B.act; B.cd.soar = 10; A.T = 9; A.stage = 'up'; A.st = 0.9; A.n = 0; A.drop = 0.5; A.tgt = p.i; A.y0 = e.y; sfx.roar(); },
  },
  run: {
    breath(e, dt, p, B) {
      const A = B.act; A.st -= dt; const [mx, my] = MOUTH(e);
      if (A.stage === 'glow') {
        e.wind = 1 - Math.max(0, A.st) / 1.1; e.weakT = A.st;
        if (p) A.a += Math.max(-1.5 * dt, Math.min(1.5 * dt, angDiff(Math.atan2(p.y - 3 - my, p.x - mx), A.a)));
        if (A.st <= 0) { A.stage = 'fire'; A.st = B.phase === 2 ? 2 : 1.6; A.fire = true; e.weakT = 0; sfx.flame(); shake(0.3); }
        return;
      }
      if (A.stage === 'fire') {
        if (B.phase === 2 && p) A.a += Math.max(-0.9 * dt, Math.min(0.9 * dt, angDiff(Math.atan2(p.y - 3 - my, p.x - mx), A.a)));
        for (let i = 0; i < 4; i++) { const a = A.a + (rnd() - 0.5) * 0.5, s = 90 + rnd() * 90; particle(mx, my, Math.cos(a) * s, Math.sin(a) * s, 0.55, ['#fff0b0', '#ffd060', '#ff8a2a', '#e0401a'][Math.floor(rnd() * 4)], rnd() < 0.4 ? 2 : 1, 1, -40); }
        A.tick -= dt;
        if (A.tick <= 0) {
          A.tick = 0.15; sfx.flame();
          for (const q of live()) { const dx = q.x - mx, dy = q.y - my; if (Math.hypot(dx, dy) < 115 && Math.abs(angDiff(Math.atan2(dy, dx), A.a)) < 0.32 && losClear(mx, my, q.x, q.y)) { damagePlayer(q, 8 * e.dmgMul, mx, my); q.burnT = Math.max(q.burnT || 0, 2); } }
          for (const s of G.structures) if (!s.dead && Math.hypot(s.x - mx, s.y - my) < 115 && Math.abs(angDiff(Math.atan2(s.y - my, s.x - mx), A.a)) < 0.32) damageStructure(s, 6);
          igniteGas(mx + Math.cos(A.a) * 60, my + Math.sin(A.a) * 60, 30);
        }
        if (A.st <= 0) { A.fire = false; A.stage = 'rest'; A.st = 0.4; }
        return;
      }
      if (A.st <= 0) A.T = 0;
    },
    tail(e, dt, p, B) {
      const A = B.act; e.wind = 1 - Math.max(0, A.T - 0.4) / 0.5;
      if (A.T <= 0.4 && !A.done) {
        A.done = true; e.lunge = 1;
        const tx = e.x - e.face * 22, ty = e.y;
        for (const q of live()) { const d = Math.hypot(q.x - tx, q.y - ty); if (d < 38) { damagePlayer(q, 22 * e.dmgMul, tx, ty); pullPlayer(q, (q.x - tx) / (d || 1) * 200, -90); } }
        dust(tx, ty + 6, 8, 'rgba(200,160,80,0.5)'); debris(tx, ty, 'stone', 6); shake(0.4); sfx.explode();
        for (let i = 0; i < 8; i++) particle(tx, ty, (rnd() - 0.5) * 160, -60 - rnd() * 80, 1, '#ffd24a', 1, 0, 300);
      }
    },
    gust(e, dt, p, B) {
      const A = B.act; e.wind = Math.min(1, (1.3 - A.T) / 0.6);
      if (A.T <= 0.7 && !A.done) {
        A.done = true; e.lunge = 1; A.fire = true;
        for (const q of live()) { const d = Math.hypot(q.x - e.x, q.y - e.y) || 1; if (d < 130) pullPlayer(q, (q.x - e.x) / d * 240, -40); }
        // kanat çırpışı yığındaki altını savurur
        const a0 = e.face > 0 ? 0 : Math.PI, n = B.phase === 2 ? 9 : 7;
        for (let i = 0; i < n; i++) bullet(e, a0 + (i - (n - 1) / 2) * 0.16 - 0.1, 120 + rnd() * 30, 9, '#ffd24a', { life: 1.4, coin: true });
        dust(e.x, e.y + 6, 12, 'rgba(255,220,140,0.35)'); shake(0.35); sfx.coins(); sfx.rumble();
      }
    },
    soar(e, dt, p, B) {
      const A = B.act; A.st -= dt; const q0 = G.players[A.tgt], q = q0 && !q0.dead ? q0 : p;
      if (A.stage === 'up') {
        if (q) { const tx = q.x, ty = q.y - 64; e.x += (tx - e.x) * Math.min(1, dt * 2.5); e.y += (ty - e.y) * Math.min(1, dt * 3); clear(e); }
        e.px = e.x; e.py = e.y;
        if (A.st <= 0) { A.stage = 'hover'; A.st = 2.4; }
        return;
      }
      if (A.stage === 'hover') {
        if (q) { e.x += (q.x - e.x) * Math.min(1, dt * 1.5); e.face = q.x >= e.x ? 1 : -1; }
        e.px = e.x; e.py = e.y; A.drop -= dt;
        if (A.drop <= 0 && q) {
          A.drop = B.phase === 2 ? 0.55 : 0.75;
          const [x, y] = A.n++ ? spotNear(q.x, q.y, 34) : [q.x, q.y];
          mark(e, x, y, 12, 0.7, 16, 'ember'); bullet(e, Math.atan2(y - e.y, x - e.x), 150, 8, '#ff8a2a', { life: 0.5 });
          sfx.flame();
        }
        if (A.st <= 0) { A.stage = 'dive'; A.st = 0.5; A.dx = q ? q.x : e.x; A.dy = q ? q.y : e.y; }
        return;
      }
      if (A.stage === 'dive') {
        const k = 1 - Math.max(0, A.st) / 0.5;
        e.x += (A.dx - e.x) * Math.min(1, dt * 8); e.y += (A.dy - e.y) * Math.min(1, dt * 8 * k + dt); clear(e); e.px = e.x; e.py = e.y;
        if (A.st <= 0) {
          // yere çarpar: ateş halkası
          let c = Math.floor(e.x / TILE), r = Math.floor(e.y / TILE); while (TD[tileAt(c, r)].solid && r > GROUND_ROW + 2) r--;
          e.y = e.py = r * TILE + 8;
          B.rings.push({ x: e.x, y: e.y + 4, r: 8, R: 90, v: 150, dmg: 18 * e.dmgMul, hit: [], col: '#ff8a2a', los: false });
          hitPlayers(e.x, e.y, 26, 24 * e.dmgMul);
          sparks(e.x, e.y, '#ffd060', 24, 150); dust(e.x, e.y + 6, 10, 'rgba(200,120,60,0.5)'); debris(e.x, e.y, 'stone', 12);
          flashLight(e.x, e.y, 7, 0.4); shake(0.8); hitstop(0.08); sfx.explode(); haptic(90);
          A.T = 0;
        }
      }
    },
  },
  tick(e, dt, B) {
    if (e.weakT > 0 && !(B.act && B.act.k === 'breath')) e.weakT = 0;
    B.carve = (B.carve || 0) - dt;
    if (B.carve <= 0) { B.carve = 0.3; clear(e); }
  },
};
// gövdenin kapladığı kayayı ezer (geniş: 7 sütun, 4 satır; baş öne uzanır)
function clear(e) {
  const c0 = Math.floor(e.x / TILE), r0 = Math.floor(e.y / TILE); let n = 0;
  for (let r = r0 - 3; r <= r0; r++) for (let c = c0 - 3; c <= c0 + 3; c++) { const d = TD[tileAt(c, r)]; if (d.solid && d.plain && breakable(c, r)) { breakTile(c, r, null); n++; } }
  if (n) shake(0.1);
}
