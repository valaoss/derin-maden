// Dünya Yılanı: Sessiz Deniz'in ortasına inen madenciyi bir kez karşılar.
// Önce deniz susar ve dev bir gölge duvarların ardından geçer; sonra duvar yarılır ve kuşak madenin içinden akar.
// Duvardan duvara kavis çizerek geçer (yolu önce duvarda parlar), gövdesi kayayı yarar; yalnız başı vurulur.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_ROW, STRATUM_ROWS, PLAY_MIN_COL, PLAY_MAX_COL } from '../config.js';
import { TD } from '../data/tiles.js';
import { SERPENT } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, solidAt } from '../world/map.js';
import { breakTile, damagePlayer, pullPlayer } from './player.js';
import { spawnEnemy } from './enemies.js';
import { KITS, live, breakable, bullet, mark, bossBusy } from './bosses.js';
import { shake, flashLight, debris, dust, ring, hitstop } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

export const SEA_BIOME = 28;
const X0 = PLAY_MIN_COL * TILE, X1 = (PLAY_MAX_COL + 1) * TILE;
const inPlay = x => x > X0 && x < X1;
const bez = (P, u) => { const v = 1 - u; return [v * v * P[0][0] + 2 * v * u * P[1][0] + u * u * P[2][0], v * v * P[0][1] + 2 * v * u * P[1][1] + u * u * P[2][1]]; };
// yol: 0..1 kavis, 1'den sonra çıkış yönünde düz (gövde duvara akarken)
export function pathAt(P, u) {
  if (u <= 1) return bez(P, Math.max(0, u));
  const [ex, ey] = P[2], dx = P[2][0] - P[1][0], dy = P[2][1] - P[1][1], d = Math.hypot(dx, dy) || 1, k = (u - 1) * P.L;
  return [ex + dx / d * k, ey + dy / d * k];
}
function makePath(e, q, kind) {
  // from < 0: soldaki duvardan girer. İlk çıkış karşılaşmada çatlayan duvardan
  const from = e.nextFrom || (rnd() < 0.5 ? -1 : 1); e.nextFrom = 0;
  const ex = from < 0 ? X0 - 40 : X1 + 40, xx = from < 0 ? X1 + 40 : X0 - 40;
  const ey = q.y + (rnd() - 0.5) * 80, xy = q.y + (rnd() - 0.5) * 90;
  const tx = q.x, ty = kind === 'rear' ? q.y - 40 : q.y - 3;
  const cx = 2 * tx - (ex + xx) / 2, cy = 2 * ty - (ey + xy) / 2;
  const P = [[ex, ey], [cx, cy], [xx, xy]];
  let L = 0, pv = P[0]; for (let i = 1; i <= 16; i++) { const p = bez(P, i / 16); L += Math.hypot(p[0] - pv[0], p[1] - pv[1]); pv = p; }
  P.L = L; P.kind = kind;
  return P;
}

KITS.dunyaYilani = {
  melee: false, // gövdesiyle vurur: duvardan çıkışı önceden parlar
  cd: {},
  choose() { return 'swim'; },
  start: { swim(e, p, B) { B.act.T = 1e9; if (!B.sv) B.sv = { m: 'under', t: 0.4, n: 0, first: !!e.firstRear }; } },
  run: {
    swim(e, dt, p, B) {
      const S = B.sv, sp = SERPENT.speed * (B.phase === 2 ? 1.3 : 1);
      if (!B.body) B.body = [];
      if (S.m === 'under') {
        e.under = true; S.t -= dt;
        if (!S.P && p) { S.kind = S.first ? 'rear' : (B.phase === 2 ? (S.n % 3 === 2 ? 'rear' : 'sweep') : (S.n % 2 ? 'rear' : 'sweep')); S.P = makePath(e, p, S.kind); S.u = 0; S.tell = SERPENT.tell; sfx.rumble(); }
        if (S.t <= 0 && S.P) { S.m = 'tell'; }
        return;
      }
      if (S.m === 'tell') {
        // duvar parlar ve titrer: nereden çıkacağı belli
        S.tell -= dt; if (rnd() < dt * 20) { const [x, y] = S.P[0]; debris(Math.max(X0 + 2, Math.min(X1 - 2, x)), y, 'stone', 1, 0.6); }
        if (S.tell <= 0) { S.m = 'go'; S.u = 0; S.hold = 0; S.done = false; B.body.length = 0; sfx.roar(); shake(0.35); }
        return;
      }
      if (S.m === 'rear') {
        // kafa madencinin üstünde durur: zehir tükürür (ilk çıkışta kükrer), sonra yoluna devam eder
        S.hold -= dt; e.under = false; e.wind = Math.max(0, 1 - Math.abs(S.hold - SERPENT.rear * 0.55) * 3);
        const [hx, hy] = pathAt(S.P, 0.5); e.x = hx + Math.sin(G.time * 3) * 3; e.y = hy + Math.sin(G.time * 2.1) * 2;
        if (p) e.face = p.x >= e.x ? 1 : -1;
        if (!S.spat && S.hold < SERPENT.rear * 0.55) {
          S.spat = true;
          if (S.first) { S.first = false; ring(e.x, e.y, '#5ae0ff', 60); flashLight(e.x, e.y, 9, 0.6); shake(1); hitstop(0.12); sfx.roar(); haptic([80, 40, 160]); emit('serpent', 'roar'); }
          else if (p) {
            const a0 = Math.atan2(p.y - e.y, p.x - e.x), n = B.phase === 2 ? 7 : 5;
            for (let i = 0; i < n; i++) bullet(e, a0 + (i - (n - 1) / 2) * 0.2, 115, 11, '#5ae0c8', { life: 1.8, slow: 1.4 });
            for (const q of live()) if (Math.hypot(q.x - e.x, q.y - e.y) < 170) mark(e, q.x, q.y, 11, 0.9, 12, 'venom');
            sfx.spit(); e.lunge = 1;
            if (B.phase === 2) B.rings.push({ x: e.x, y: e.y, r: 8, R: 120, v: 120, dmg: 14 * e.dmgMul, hit: [], col: '#5ae0ff', los: true });
          }
        }
        if (S.hold <= 0) { S.m = 'go'; S.u = 0.5001; }
        contact(e, B, dt);
        return;
      }
      // go: kavis boyunca akar; gövde izi takip eder
      S.u += sp * dt / S.P.L;
      if (S.P.kind === 'rear' && S.u >= 0.5 && S.hold === 0 && !S.done) { S.done = true; S.m = 'rear'; S.hold = SERPENT.rear; S.spat = false; return; }
      const [nx, ny] = pathAt(S.P, S.u);
      if (Math.abs(nx - e.x) > 0.01) e.face = nx >= e.x ? 1 : -1;
      e.x = e.px = nx; e.y = e.py = ny;
      e.under = !inPlay(e.x);
      const last = B.body[0];
      if (!last || Math.hypot(last[0] - e.x, last[1] - e.y) >= SERPENT.seg) { B.body.unshift([e.x, e.y]); if (B.body.length > SERPENT.n) B.body.length = SERPENT.n; }
      if (!e.under) carve(e);
      contact(e, B, dt);
      if (S.u > 1 + SERPENT.n * SERPENT.seg / S.P.L) {
        // bütün gövde duvara girdi
        S.m = 'under'; S.t = SERPENT.under * (B.phase === 2 ? 0.55 : 1); S.P = null; S.n++; B.body.length = 0; e.under = true;
      }
    },
  },
};

function carve(e) {
  const c0 = Math.floor(e.x / TILE), r0 = Math.floor(e.y / TILE);
  if (c0 === e.lastC && r0 === e.lastR) return;
  e.lastC = c0; e.lastR = r0; let n = 0;
  for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
    const d = TD[tileAt(c, r)];
    if (d.solid && d.plain && breakable(c, r) && (r === r0 || c === c0 || rnd() < 0.4)) { breakTile(c, r, null); n++; }
  }
  if (n) { debris(e.x, e.y, 'stone', 2 + n); if (rnd() < 0.5) shake(0.1); }
}
function contact(e, B, dt) {
  for (const q of live()) {
    if (Math.hypot(q.x - e.x, q.y - e.y) < 14) {
      damagePlayer(q, SERPENT.headDmg * e.dmgMul, e.x, e.y);
      const d = Math.hypot(q.x - e.x, q.y - e.y) || 1; pullPlayer(q, (q.x - e.x) / d * 160, (q.y - e.y) / d * 100);
      continue;
    }
    for (let i = 2; i < B.body.length; i += 2) {
      const [x, y] = B.body[i]; if (!inPlay(x) || solidAt(Math.floor(x / TILE), Math.floor(y / TILE))) continue;
      if (Math.abs(q.x - x) < 8 && Math.abs(q.y - y) < 8) { damagePlayer(q, SERPENT.bodyDmg * e.dmgMul, x, y); break; }
    }
  }
}

// ---------- karşılaşma ----------
export function updateSerpent(dt) {
  if (G.tutorial || !G.order) return;
  const S = G.serpent || (G.serpent = { st: 'wait', t: 0 });
  if (S.st === 'done') { S.t += dt; return; }
  const s = G.order.indexOf(SEA_BIOME); if (s < 0) return;
  const r0 = GROUND_ROW + s * STRATUM_ROWS;
  if (S.st === 'wait') {
    if ((S.cd = (S.cd || 0) - dt) > 0 || bossBusy(S)) return;
    const p = G.players.find(q => !q.dead && !q.ride && Math.floor(q.y / TILE) >= r0 + SERPENT.depth && Math.floor(q.y / TILE) < r0 + STRATUM_ROWS);
    if (!p) return;
    Object.assign(S, { st: 'omen', t: 0, y: p.y, dir: rnd() < 0.5 ? 1 : -1, pi: p.i, beat: 0, groan: 0 });
    G.threat.bossCd = Math.max(G.threat.bossCd || 0, SERPENT.omen + 5);
    emit('serpent', 'omen'); sfx.whale();
    return;
  }
  if (S.st === 'omen') {
    S.t += dt;
    const p = G.players[S.pi]; if (p && !p.dead) S.y += (p.y - S.y) * Math.min(1, dt * 0.8);
    // dev gölge geçerken yer titrer
    if (S.t > 2 && S.t < 6.5 && (S.beat -= dt) <= 0) { S.beat = 0.5; shake(0.1 + 0.15 * Math.sin((S.t - 2) / 4.5 * Math.PI)); }
    if (S.t > 4.2 && !S.groan) { S.groan = 1; sfx.whale(); }
    if (S.t > SERPENT.omen - 1.6 && !S.crack) { S.crack = true; emit('serpent', 'crack'); sfx.rockfall(); shake(0.4); }
    if (S.t >= SERPENT.omen) {
      const side = S.dir > 0 ? X0 - 40 : X1 + 40;
      const e = spawnEnemy('dunyaYilani', side, S.y, 4);
      e.emergeT = 0; e.firstRear = true; e.nextFrom = S.dir > 0 ? -1 : 1;
      G.threat.bossUp = true; G.threat.bossType = 'dunyaYilani'; G.threat.bossCd = 0;
      Object.assign(S, { st: 'fight', t: 0 });
      debris(S.dir > 0 ? X0 + 4 : X1 - 4, S.y, 'stone', 24); dust(S.dir > 0 ? X0 + 8 : X1 - 8, S.y, 10, 'rgba(40,60,90,0.7)');
      shake(0.8); sfx.explode(); haptic([60, 40, 120]);
      emit('bossSpawn', 'dunyaYilani');
    }
    return;
  }
  if (S.st === 'fight') {
    S.t += dt;
    const e = G.enemies.find(o => o.type === 'dunyaYilani');
    if (e && e.dead && !S.end) S.end = e.dieT > 0.5 ? 'slain' : 'gone';
    if (!e || e.dead) {
      if (S.end === 'slain') Object.assign(S, { st: 'done', t: 0 });
      else Object.assign(S, { st: 'wait', t: 0, crack: false, groan: 0, end: null, cd: 20 });
    }
  }
}
