// Biyom bosslarının saldırı kitleri: Uyuyan Dev, Ustabaşı, Sağır Avcı, Pas Golemi. Her biri beş yetenekli döngüyle dövüşür;
// öfkede yetenekler birbirine bağlanır (bir saldırı biterken ikincisi gelir), kaçana uzaktan ulaşan bir hamlesi vardır.
// Uyarılar yerde yanıp söner (mark), halkalar yayılır (B.rings), uçan hurda ve kazma B.shots / B.pick ile işlenir.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_Y, PLAY_MIN_COL, PLAY_MAX_COL } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { G } from './state.js';
import { tileAt, solidAt, setTile } from '../world/map.js';
import { breakTile, damagePlayer, blindPlayer, pullPlayer, scarePlayer, webPlayer } from './player.js';
import { spawnEnemy, losClear } from './enemies.js';
import { KITS, live, mark, bullet, spotNear, openSpot, hitPlayers, breakable, angDiff, TAU } from './bosses.js';
import { sparks, debris, shake, ring, flashLight, dust, hitstop, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

const said = (B, k, text) => { const s = (B.said ||= {}); if (!s[k]) { s[k] = 1; emit('toast', { text, icon: 'skull', bad: true }); } };
const count = type => G.enemies.reduce((n, o) => n + (o.type === type && !o.dead ? 1 : 0), 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lim = x => Math.max(PLAY_MIN_COL * TILE + 8, Math.min(PLAY_MAX_COL * TILE + 8, x));
// kayayı yararak yürür: önündeki kırılabilir taşları kırar, kırılmaz olanda durur
function plow(e, tx, ty, sp, dt, R = 7) {
  const d = Math.hypot(tx - e.x, ty - e.y); if (d < 1) return true;
  const s = Math.min(d, sp * dt), nx = lim(e.x + (tx - e.x) / d * s), ny = Math.max(GROUND_Y + 8, e.y + (ty - e.y) / d * s);
  let ok = true;
  for (let r = Math.floor((ny - R) / TILE); r <= Math.floor((ny + R) / TILE); r++) for (let c = Math.floor((nx - R) / TILE); c <= Math.floor((nx + R) / TILE); c++) {
    if (!solidAt(c, r)) continue;
    if (breakable(c, r)) { breakTile(c, r, null); if (rnd() < 0.4) debris(c * TILE + 8, r * TILE + 8, 'stone', 3); } else ok = false;
  }
  if (ok) { e.x = nx; e.y = ny; }
  if (Math.abs(tx - e.x) > 1) e.face = tx > e.x ? 1 : -1;
  return ok;
}
// koni içindeki madencilere vurur
function cone(e, a, R, arc, dmg, push = 0, fn) {
  for (const q of live()) {
    const dx = q.x - e.x, dy = q.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d > R || Math.abs(angDiff(Math.atan2(dy, dx), a)) > arc) continue;
    damagePlayer(q, dmg * e.dmgMul, e.x, e.y); if (push) pullPlayer(q, dx / d * push, dy / d * push * 0.6 - 30); if (fn) fn(q);
  }
}
// öfke gösterisi: kükrer, çağırdıklarını çıkarır
const rageShow = (T, call) => ({
  rage(e, B) { B.rageT = T; B.roared = false; },
  roar(e, B) {
    shake(0.8); hitstop(0.1); flashLight(e.x, e.y - 10, 9, 0.6); ring(e.x, e.y, e.d.col, 60); sfx.howl(); haptic([60, 40, 120]);
    for (const [t, n] of call) for (let k = 0; k < n; k++) { const [x, y] = spotNear(e.x, e.y, 30); spawnEnemy(t, x, y, G.wave.num).emergeT = 0.4; }
  },
});

// ---------- UYUYAN DEV: nabız halkası (boşluğundan geç), tavan yumruğu, derin nefes, damar patlatma, kalp açığı ----------
KITS.dev = {
  cd: { melee: 0.8 }, gap: 0.9, roarAt: 1.1,
  rot: ['pulse', 'fist', 'inhale', 'veins', 'heart'],
  can: { pulse: (e, p, dp) => dp < 230, fist: (e, p, dp) => dp < 220, inhale: (e, p, dp) => dp < 180, veins: (e, p, dp) => dp < 200, heart: () => true },
  melee: { reach: 26, arc: 1.4, dmg: 1.2, push: 240 },
  ...rageShow(1.8, [['titanling', 2]]),
  tick(e, dt, B) { if (!B.act || B.act.k !== 'heart') e.exposed = 0; },
  start: {
    pulse(e, p, B) { B.act.T = 1.3; B.act.stage = 'wind'; sfx.rumble(); said(B, 'pulse', 'Nabız Halkası: halkadaki boşluktan geç!'); },
    fist(e, p, B) {
      B.act.T = 1.0; B.act.stage = 'wind'; e.face = p.x >= e.x ? 1 : -1; sfx.arm();
      // yumruğun gölgesi: madencinin olduğu yer ve öfkede kaçacağı iki yan
      for (const q of live()) { if (dist(q, e) > 230) continue; mark(e, q.x, q.y, 18, 0.62, 30, 'rock'); if (B.phase === 2) for (const s of [-1, 1]) if (openSpot(q.x + s * 34, q.y)) mark(e, q.x + s * 34, q.y, 14, 0.85, 26, 'rock'); }
    },
    inhale(e, p, B) { B.act.T = 2.2; B.act.stage = 'suck'; B.act.a = Math.atan2(p.y - e.y, p.x - e.x); sfx.howl(); said(B, 'inhale', 'Derin Nefes: seni çekiyor, ardından savuracak!'); },
    veins(e, p, B) {
      B.act.T = 1.0; B.act.stage = 'plunge'; sfx.creak(); shake(0.3);
      // damar yarıkları: madenciye doğru sırayla patlar; öfkede iki yandan da gelir
      for (const q of live()) {
        if (dist(q, e) > 220) continue;
        const a0 = Math.atan2(q.y - e.y, q.x - e.x);
        for (const f of B.phase === 2 ? [-0.5, 0, 0.5] : [0]) for (let i = 1; i <= 10; i++) {
          const x = e.x + Math.cos(a0 + f) * (12 + i * 16), y = e.y + Math.sin(a0 + f) * (12 + i * 16);
          if (!openSpot(x, y)) break;
          mark(e, x, y, 10, 0.45 + i * 0.08, 24, 'spike');
        }
      }
    },
    heart(e, p, B) { B.act.T = 2.8; B.act.stage = 'open'; B.act.n = 0; sfx.rumble(); said(B, 'heart', 'Kalbi açıldı: şimdi vur!'); },
  },
  run: {
    pulse(e, dt, p, B) {
      const A = B.act, t = 1.3 - A.T;
      if (t < 0.8) { e.wind = t / 0.8; if (rnd() < dt * 30) particle(e.x + (rnd() - 0.5) * 30, e.y - 20 + (rnd() - 0.5) * 20, 0, -20, 0.4, '#ff5a6a', 1, 1, 0); return; }
      A.stage = 'fire';
      if (A.done) return; A.done = true; e.wind = 0; e.lunge = 1;
      const gap = rnd() * TAU;
      B.rings.push({ x: e.x, y: e.y - 6, r: 10, R: 210, v: 120, dmg: 26 * e.dmgMul, col: '#ff5a6a', hit: [], gap, gw: 0.55 });
      // öfkede ikinci halka gecikmeli ve boşluğu karşı yanda: ilkinden geçen dönüp ikinciye koşmalı
      if (B.phase === 2) B.rings.push({ x: e.x, y: e.y - 6, r: -70, R: 210, v: 120, dmg: 26 * e.dmgMul, col: '#ffd0d0', hit: [], gap: gap + Math.PI, gw: 0.5 });
      shake(0.6); hitstop(0.05); flashLight(e.x, e.y - 20, 9, 0.6); sfx.explode(); haptic(50);
    },
    fist(e, dt, p, B) {
      const A = B.act, t = 1.0 - A.T;
      if (t < 0.55) { e.wind = t / 0.55; return; }
      A.stage = 'hit';
      if (A.done) return; A.done = true; e.wind = 0; e.lunge = 1;
      B.rings.push({ x: e.x + e.face * 18, y: e.y + 4, r: 6, R: 64, v: 170, dmg: 16 * e.dmgMul, col: '#c8b8a0', hit: [] });
      shake(0.7); hitstop(0.06); debris(e.x + e.face * 18, e.y + 6, 'stone', 14); sfx.rockfall(); haptic(60);
    },
    inhale(e, dt, p, B) {
      const A = B.act, t = 2.2 - A.T;
      if (t < 1.6) {
        A.stage = 'suck';
        for (const q of live()) { const d = dist(q, e) || 1; if (d < 200 && d > 14) { pullPlayer(q, (e.x - q.x) / d * 8.5, (e.y - q.y) / d * 6); if (rnd() < dt * 20) particle(q.x, q.y, (e.x - q.x) / d * 80, (e.y - q.y) / d * 80, 0.3, '#c8b8a0', 1, 1, 0); } }
        return;
      }
      A.stage = 'blow';
      if (A.done) return; A.done = true; e.lunge = 1;
      A.a = p ? Math.atan2(p.y - e.y, p.x - e.x) : A.a;
      cone(e, A.a, 110, 0.7, 24, 340);
      for (let i = 0; i < 24; i++) { const a = A.a + (rnd() - 0.5) * 1.2, s = 120 + rnd() * 120; particle(e.x, e.y - 12, Math.cos(a) * s, Math.sin(a) * s, 0.6, rnd() < 0.5 ? '#c8b8a0' : '#8a7a68', 1, 1, 0); }
      shake(0.5); sfx.explode();
    },
    veins(e, dt, p, B) { const t = 1.0 - B.act.T; e.wind = t < 0.35 ? t / 0.35 : 0; },
    heart(e, dt, p, B) {
      const A = B.act, t = 2.8 - A.T;
      // göğsü açıkken kalbi iki buçuk kat işler; öfkede açıkken de nabız atar
      e.exposed = A.T > 0.15 ? 2.5 : 0;
      if (B.phase === 2 && A.n < 2 && t > 0.9 + A.n * 1.0) { A.n++; B.rings.push({ x: e.x, y: e.y - 6, r: 10, R: 170, v: 110, dmg: 20 * e.dmgMul, col: '#ff5a6a', hit: [], gap: rnd() * TAU, gw: 0.6 }); shake(0.4); sfx.rumble(); }
      if (rnd() < dt * 12) sparks(e.x + e.face * 6, e.y - 22, '#ff5a6a', 1, 40);
      if (A.T <= dt) e.exposed = 0;
    },
  },
};

// ---------- USTABAŞI: bumerang kazma, ölü madenciler, kemik kafes, göçük, fener söndürme ----------
KITS.ustabasi = {
  cd: { melee: 0.6 }, gap: 0.8, roarAt: 1.0,
  rot: ['throw', 'cage', 'collapse', 'lamp', 'raise'],
  can: { throw: (e, p, dp) => dp > 30 && dp < 190, cage: (e, p, dp) => dp < 170, collapse: (e, p, dp) => dp < 190, lamp: (e, p, dp) => dp < 200, raise: () => count('skitter') < 4 },
  // kazma elindeyken savurur; fırlatınca eli boş
  melee: (e, B) => B.pick ? false : { reach: 22, arc: 1.3, dmg: 1.1, push: 200 },
  ...rageShow(1.4, [['skitter', 3]]),
  // öfke ya da kesinti fırlatmayı yarıda bırakırsa kazma ele döner
  tick(e, dt, B) { if (B.pick && (!B.act || B.act.k !== 'throw')) B.pick = null; },
  start: {
    throw(e, p, B) { B.act.T = 4; B.act.stage = 'wind'; B.act.st = B.phase === 2 ? 0.35 : 0.45; B.act.a = Math.atan2(p.y - e.y, p.x - e.x); e.face = p.x >= e.x ? 1 : -1; sfx.arm(); },
    cage(e, p, B) {
      B.act.T = 0.8; B.act.stage = 'wind'; sfx.creak(); said(B, 'cage', 'Kemik Kafes: kafes kapanmadan çık ya da kazarak kır!');
      // kafes: madencinin çevresindeki boş hücreler kemikle örülür (önce yanıp söner)
      B.cage = [];
      for (const q of live()) {
        if (dist(q, e) > 170) continue;
        const qc = Math.floor(q.x / TILE), qr = Math.floor(q.y / TILE);
        for (let r = qr - 1; r <= qr + 1; r++) for (let c = qc - 1; c <= qc + 1; c++) {
          if ((c === qc && r === qr) || c < PLAY_MIN_COL || c > PLAY_MAX_COL || solidAt(c, r)) continue;
          B.cage.push([c, r]); mark(e, c * TILE + 8, r * TILE + 8, 8, 0.75, 0, 'bone');
        }
      }
    },
    collapse(e, p, B) {
      B.act.T = 1.1; B.act.stage = 'wind'; sfx.arm();
      for (const q of live()) { if (dist(q, e) > 200) continue; mark(e, q.x, q.y, 14, 1.15, 26, 'rock'); for (let i = 0; i < (B.phase === 2 ? 4 : 2); i++) { const [x, y] = spotNear(q.x, q.y, 50); mark(e, x, y, 12, 1.25 + i * 0.12, 22, 'rock'); } }
    },
    lamp(e, p, B) { B.act.T = 0.7; B.act.stage = 'dim'; B.act.tgt = p.i; sfx.shade(); said(B, 'lamp', 'Fener söndü: arkanı kolla!'); },
    raise(e, p, B) {
      B.act.T = 1.0; B.act.stage = 'call'; sfx.brood(); flashLight(e.x, e.y - 20, 7, 0.4);
      for (let k = 0; k < (B.phase === 2 ? 3 : 2); k++) { const [x, y] = spotNear(p.x, p.y, 40); const s = spawnEnemy('skitter', x, y, G.wave.num); s.emergeT = 0.8; mark(e, x, y, 9, 0.8, 0, 'venom'); }
    },
  },
  run: {
    throw(e, dt, p, B) {
      const A = B.act;
      if (A.stage === 'wind') {
        A.st -= dt; e.wind = 1 - Math.max(0, A.st) / 0.45;
        if (A.st <= 0) {
          A.stage = 'away'; e.wind = 0; e.lunge = 1; const sp = B.phase === 2 ? 240 : 190;
          B.pick = { x: e.x + e.face * 8, y: e.y - 14, vx: Math.cos(A.a) * sp, vy: Math.sin(A.a) * sp, back: false, t: 0, hit: [], spin: 0 };
          sfx.whip();
          // öfkede fenerden yeşil alev de atar
          if (B.phase === 2) for (const q of live()) if (dist(q, e) < 200) mark(e, q.x, q.y, 12, 0.9, 18, 'venom');
        }
        return;
      }
      const P = B.pick; if (!P) { A.T = 0; return; }
      P.t += dt; P.spin += dt * 22;
      if (!P.back && (P.t > 0.75 || solidAt(Math.floor(P.x / TILE), Math.floor(P.y / TILE)))) { P.back = true; P.hit = []; sparks(P.x, P.y, '#c8c8d0', 6, 70); sfx.ping(); }
      if (P.back) { const d = Math.hypot(e.x - P.x, e.y - 14 - P.y) || 1, sp = B.phase === 2 ? 280 : 220; P.vx = (e.x - P.x) / d * sp; P.vy = (e.y - 14 - P.y) / d * sp; if (d < 10) { B.pick = null; A.T = 0; e.lunge = 1; sfx.click(); return; } }
      P.x += P.vx * dt; P.y += P.vy * dt;
      // dönüşte kayanın içinden geçer, yoldaki taşları kırar
      if (P.back) { const c = Math.floor(P.x / TILE), r = Math.floor(P.y / TILE); if (solidAt(c, r) && breakable(c, r)) breakTile(c, r, null); }
      for (const q of live()) if (!P.hit.includes(q.i) && Math.hypot(q.x - P.x, q.y - 3 - P.y) < 11) { P.hit.push(q.i); damagePlayer(q, 22 * e.dmgMul, P.x, P.y); sparks(q.x, q.y, '#e0e0e8', 8, 90); shake(0.3); }
      if (A.T < 0.2) A.T = 0.2;
    },
    cage(e, dt, p, B) {
      const A = B.act, t = 0.8 - A.T;
      if (t < 0.4) { e.wind = t / 0.4; return; }
      A.stage = 'hit';
      if (A.done || t < 0.75) return; A.done = true; e.wind = 0;
      for (const [c, r] of B.cage || []) if (!solidAt(c, r)) { setTile(c, r, T.BONE); debris(c * TILE + 8, r * TILE + 8, 'bone', 4); }
      B.cage = null; shake(0.4); sfx.creak();
      // öfkede kafesin içine tavan iner
      if (B.phase === 2) for (const q of live()) if (dist(q, e) < 200) mark(e, q.x, q.y, 10, 0.7, 20, 'rock');
    },
    collapse(e, dt, p, B) {
      const A = B.act, t = 1.1 - A.T;
      if (t < 0.7) { e.wind = t / 0.7; return; }
      A.stage = 'hit';
      if (A.done) return; A.done = true; e.wind = 0; e.lunge = 1;
      B.rings.push({ x: e.x, y: e.y + 4, r: 8, R: 80, v: 160, dmg: 18 * e.dmgMul, col: '#e8dcc0', hit: [] });
      shake(0.7); hitstop(0.06); debris(e.x, e.y + 6, 'bone', 12); sfx.rockfall(); haptic(60);
    },
    lamp(e, dt, p, B) {
      const A = B.act;
      if (A.T > dt || A.done) return; A.done = true;
      // karanlıkta madencinin arkasında belirir ve hemen savurur
      G.evt.darkT = Math.max(G.evt.darkT || 0, B.phase === 2 ? 6 : 4);
      const q = G.players[A.tgt] && !G.players[A.tgt].dead ? G.players[A.tgt] : p; if (!q) return;
      const back = -(q.face || 1), spots = [[q.x + back * 24, q.y], [q.x - back * 24, q.y], [q.x, q.y - 20]];
      const s = spots.find(([x, y]) => openSpot(x, y));
      if (s) { sparks(e.x, e.y - 10, '#9af0c0', 12, 90); e.x = e.px = s[0]; e.y = e.py = s[1]; e.blinkT = 0.3; e.face = q.x >= e.x ? 1 : -1; sparks(e.x, e.y - 10, '#9af0c0', 14, 100); }
      B.cd.melee = 0; sfx.blink();
    },
    raise(e, dt, p, B) { e.wind = Math.min(1, (1 - B.act.T) / 0.5); },
  },
};

// ---------- SAĞIR AVCI: görmez, sesi izler. Ses hücumu, yankı çığlığı, kayaya dalış, titreşim avı, üçlü pençe ----------
// av: yakındaki madenci (koklar), yoksa son ses (ateş, kazı), yoksa tuzak taşı; hiçbiri yoksa dinler
function prey(e) {
  const th = G.threat;
  let near = null, nd = 48;
  for (const q of live()) { const d = dist(q, e); if (d < nd || (q.heardT > G.time && d < 260)) { nd = d; near = q; } }
  if (near) return { x: near.x, y: near.y, q: near };
  if (th.lure && th.lure.t > 0) return { x: th.lure.x, y: th.lure.y, lure: true };
  if (th.last && th.quietT < 1.6) return { x: th.last.x, y: th.last.y };
  return null;
}
KITS.sagirAvci = {
  cd: { melee: 0.5 }, gap: 0.7, roarAt: 1.0,
  rot: ['charge', 'claws', 'tremor', 'burrow', 'scream'],
  can: {
    charge: e => !!e.prey && dist(e.prey, e) > 40 && dist(e.prey, e) < 230,
    claws: (e, p, dp) => dp < 60,
    tremor: (e, p, dp) => dp < 220,
    burrow: e => !!e.prey && dist(e.prey, e) > 70,
    scream: (e, p, dp) => dp < 240,
  },
  melee: { reach: 20, arc: 1.2, dmg: 1.1, push: 200 },
  ...rageShow(1.4, [['korAvci', 2]]),
  tick(e, dt, B) {
    e.prey = prey(e); e.listen = e.prey ? 0 : 1;
    // tuzak taşına varınca kulakları çınlar: sersemler, açıkta kalır
    if (e.prey && e.prey.lure && dist(e.prey, e) < 16 && !(e.stunT > 0)) { e.stunT = 2.6; G.threat.lure.t = 0; ring(e.x, e.y, '#c0c0e0', 30); sfx.howl(); emit('toast', { text: 'Tuzak taşı çınladı: Sağır Avcı sersemledi!', icon: 'hush' }); }
    if (e.stunT > 0) { e.stunT -= dt; e.exposed = 1.8; B.cd.gap = Math.max(B.cd.gap, e.stunT); B.cd.melee = Math.max(B.cd.melee, e.stunT); if (e.stunT <= 0) e.exposed = 0; }
  },
  // kendi yürüyüşü: sese doğru kayayı yararak; ses yoksa yerinde dinler
  move(e, dt, p, dp, B) {
    if (e.stunT > 0) return true;
    const P = e.prey; if (!P) return true;
    plow(e, P.x, P.y, e.d.speed * (e.spMul || 1) * (B.phase === 2 ? 1.25 : 1), dt, 8);
    return true;
  },
  start: {
    charge(e, p, B) { B.act.T = 3; B.act.stage = 'listen'; B.act.st = B.phase === 2 ? 0.35 : 0.5; B.act.hit = []; sfx.howl(); },
    claws(e, p, B) { B.act.T = 1.0; B.act.stage = 'slash'; B.act.n = 0; B.act.a = Math.atan2(p.y - e.y, p.x - e.x); e.face = p.x >= e.x ? 1 : -1; },
    tremor(e, p, B) { B.act.T = 1.6; B.act.stage = 'stomp'; B.act.n = 0; said(B, 'tremor', 'Titreşim Avı: yere vururken KIPIRDAMA!'); },
    burrow(e, p, B) { B.act.T = 6; B.act.stage = 'sink'; B.act.st = 0.5; dust(e.x, e.y + 6, 6, 'rgba(160,160,180,0.6)'); sfx.burrow(); },
    scream(e, p, B) { B.act.T = 1.2; B.act.stage = 'wind'; said(B, 'scream', 'Yankı Çığlığı: ölçer doluyor, seni duyuyor!'); },
  },
  run: {
    charge(e, dt, p, B) {
      const A = B.act; A.st -= dt;
      if (A.stage === 'listen') { e.wind = 1 - Math.max(0, A.st) / 0.5; if (A.st <= 0) { const P = e.prey || p; A.tx = P.x; A.ty = P.y; A.stage = 'dash'; A.st = 1.2; e.wind = 0; sfx.rumble(); } return; }
      if (A.stage === 'dash') {
        const ok = plow(e, A.tx, A.ty, B.phase === 2 ? 250 : 210, dt, 8); e.lunge = 1;
        for (const q of live()) if (!A.hit.includes(q.i) && dist(q, e) < e.r + 8) { A.hit.push(q.i); damagePlayer(q, 30 * e.dmgMul, e.x, e.y); pullPlayer(q, (q.x - e.x) * 4, -60); shake(0.4); hitstop(0.05); }
        if (!ok || A.st <= 0 || Math.hypot(A.tx - e.x, A.ty - e.y) < 4) { A.stage = 'skid'; A.st = 0.4; dust(e.x, e.y + 6, 6, 'rgba(160,160,180,0.6)'); if (!ok) { shake(0.5); sfx.explode(); } }
        return;
      }
      if (A.stage === 'skid' && A.st <= 0) A.T = 0;
    },
    claws(e, dt, p, B) {
      const A = B.act, t = 1.0 - A.T;
      if (A.n < 3 && t >= 0.25 * (A.n + 1)) { A.n++; if (p) A.a = Math.atan2(p.y - e.y, p.x - e.x); cone(e, A.a, 56, 0.9, 16, 120); sfx.whip(); e.lunge = 1; sparks(e.x + Math.cos(A.a) * 20, e.y + Math.sin(A.a) * 20, '#e0e0f0', 6, 90); }
    },
    tremor(e, dt, p, B) {
      const A = B.act, t = 1.6 - A.T;
      if (A.n < 3 && t >= 0.3 + A.n * 0.5) {
        A.n++; e.lunge = 1; shake(0.45); sfx.rumble(); dust(e.x, e.y + 6, 8, 'rgba(160,160,180,0.5)'); ring(e.x, e.y + 4, '#c0c0e0', 50);
        // kıpırdayan madenci ele verir kendini: altından diken çıkar, Avcı onu duyar
        for (const q of live()) if (dist(q, e) < 240 && q.moving) { q.heardT = G.time + 3; mark(e, q.x, q.y, 11, 0.45, 24, 'spike'); }
      }
    },
    burrow(e, dt, p, B) {
      const A = B.act; A.st -= dt;
      if (A.stage === 'sink') { e.sink = 1 - Math.max(0, A.st) / 0.5; if (A.st <= 0) { A.stage = 'go'; A.st = 2.2; e.under = true; } return; }
      if (A.stage === 'go') {
        const P = e.prey || p;
        e.sink = 1;
        if (P) { const d = Math.hypot(P.x - e.x, P.y - e.y) || 1, s = Math.min(d, 120 * dt); e.x = lim(e.x + (P.x - e.x) / d * s); e.y = Math.max(GROUND_Y + 10, e.y + (P.y - e.y) / d * s); }
        if (rnd() < dt * 16) debris(e.x + (rnd() - 0.5) * 10, e.y + 4, 'stone', 1, 0.5);
        if (A.st <= 0 || (P && Math.hypot(P.x - e.x, P.y - e.y) < 6)) { A.stage = 'rise'; A.st = 0.6; e.under = false; mark(e, e.x, e.y, 22, 0.6, 0, 'rise'); shake(0.3); sfx.burrow(); }
        return;
      }
      if (A.stage === 'rise' && A.st > 0) e.sink = A.st / 0.6;
      if (A.stage === 'rise' && A.st <= 0 && !A.done) {
        A.done = true;
        const c0 = Math.floor(e.x / TILE), r0 = Math.floor(e.y / TILE);
        for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) if (solidAt(c, r) && breakable(c, r)) breakTile(c, r, null);
        e.x = e.px = c0 * TILE + 8; e.y = e.py = r0 * TILE + 8; e.under = false; e.sink = 0; e.lunge = 1;
        hitPlayers(e.x, e.y, 26, 30 * e.dmgMul, q => scarePlayer(q, 1));
        debris(e.x, e.y, 'stone', 16); ring(e.x, e.y, '#c0c0e0', 34); shake(0.6); hitstop(0.06); sfx.explode(); haptic(60);
        A.T = 0;
      }
    },
    scream(e, dt, p, B) {
      const A = B.act, t = 1.2 - A.T;
      if (t < 0.6) { e.wind = t / 0.6; return; }
      A.stage = 'fire';
      if (A.done) return; A.done = true; e.wind = 0; e.lunge = 1;
      // çığlık madende yankılanır: ölçer dolar, herkesi bir süre duyar
      G.threat.noise = Math.min(100, G.threat.noise + 35); G.threat.quietT = 0;
      B.rings.push({ x: e.x, y: e.y - 8, r: 10, R: 170, v: 150, dmg: 18 * e.dmgMul, col: '#c0c0e0', hit: [], los: true });
      for (const q of live()) if (dist(q, e) < 260) { q.heardT = G.time + (B.phase === 2 ? 5 : 3); scarePlayer(q, 1.2); }
      shake(0.6); flashLight(e.x, e.y, 6, 0.3); sfx.howl(); haptic([30, 30, 60]);
    },
  },
};

// ---------- PAS GOLEMİ: mıknatıs kalkanı (önden vurma), kutup değiştir, hurda yağmuru, cevher yutma, ray hücumu ----------
const IRONISH = d => d.ore === 'iron' || d.ore === 'cobalt';
KITS.pasGolem = {
  cd: { melee: 0.8 }, gap: 0.9, roarAt: 1.1,
  rot: ['magnet', 'polarity', 'scrap', 'absorb', 'rail'],
  can: { magnet: (e, p, dp) => dp < 220, polarity: (e, p, dp) => dp < 190, scrap: (e, p, dp) => dp < 230, absorb: () => true, rail: (e, p, dp) => dp > 40 && dp < 230 },
  melee: { reach: 24, arc: 1.3, dmg: 1.3, push: 260 },
  ...rageShow(1.6, [['kene', 3]]),
  tick(e, dt, B) { const k = B.act && B.act.k; if (k !== 'magnet') e.frontT = 0; if (k !== 'rail') e.exposed = 0; },
  start: {
    magnet(e, p, B) { B.act.T = B.phase === 2 ? 3.6 : 3; B.act.stage = 'hold'; e.frontT = B.act.T; sfx.zap(); said(B, 'magnet', 'Mıknatıs Kalkanı: önden vurma, arkasına geç!'); },
    polarity(e, p, B) { B.pol = B.phase === 2 ? (rnd() < 0.5 ? 1 : -1) : -(B.pol || -1); B.act.T = 2.1; B.act.stage = 'wind'; B.act.pol = B.pol; sfx.arm(); },
    scrap(e, p, B) { B.act.T = 0.8; B.act.stage = 'heave'; sfx.arm(); },
    absorb(e, p, B) { B.act.T = 2.0; B.act.stage = 'pull'; B.act.n = 0; sfx.zap(); said(B, 'absorb', 'Cevher Yutma: demir damarlarını önce sen kaz!'); },
    rail(e, p, B) { B.act.T = 4; B.act.stage = 'aim'; B.act.st = B.phase === 2 ? 0.6 : 0.8; B.act.a = Math.atan2(p.y - e.y, p.x - e.x); B.act.hit = []; B.act.chain = B.phase === 2 ? 1 : 0; e.face = p.x >= e.x ? 1 : -1; sfx.arm(); },
  },
  run: {
    magnet(e, dt, p, B) { e.frontT = B.act.T; if (p) e.face = p.x >= e.x ? 1 : -1; if (rnd() < dt * 20) particle(e.x + e.face * 10, e.y - 18 + (rnd() - 0.5) * 16, e.face * 20, 0, 0.3, '#ff4a3a', 1, 1, 0); },
    polarity(e, dt, p, B) {
      const A = B.act, t = 2.1 - A.T;
      if (t < 0.6) { e.wind = t / 0.6; return; }
      A.stage = 'pulse'; e.wind = 0;
      const col = A.pol > 0 ? '#ff4a3a' : '#4a9aff';
      for (const q of live()) { const d = dist(q, e) || 1; if (d < 190 && d > 12) pullPlayer(q, (e.x - q.x) / d * 8 * A.pol, (e.y - q.y) / d * 5 * A.pol); if (rnd() < dt * 12) particle(q.x, q.y, (e.x - q.x) / d * 60 * A.pol, (e.y - q.y) / d * 60 * A.pol, 0.3, col, 1, 1, 0); }
      if (A.T <= dt && !A.done) {
        A.done = true; e.lunge = 1;
        // çekişin sonu: dibine gelene ezici darbe; itişin sonu: hurda saçılır
        if (A.pol > 0) { B.rings.push({ x: e.x, y: e.y, r: 8, R: 60, v: 170, dmg: 28 * e.dmgMul, col, hit: [] }); shake(0.6); sfx.explode(); }
        else { const n = B.phase === 2 ? 16 : 12, a0 = rnd() * TAU; for (let i = 0; i < n; i++) bullet(e, a0 + i * TAU / n, 120, 12, '#c8a080', { life: 1.6 }); shake(0.4); sfx.spit(); }
      }
    },
    scrap(e, dt, p, B) {
      const A = B.act, t = 0.8 - A.T;
      if (t < 0.4) { e.wind = t / 0.4; return; }
      A.stage = 'throw';
      if (A.done) return; A.done = true; e.wind = 0; e.lunge = 1; sfx.spit();
      // hurda parçaları yay çizerek madencinin olduğu ve kaçacağı yere iner
      for (const q of live()) {
        if (dist(q, e) > 230) continue;
        const n = B.phase === 2 ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const [tx, ty] = i ? spotNear(q.x + (q.x - q.px) * 30, q.y, 56) : [q.x, q.y], tt = 0.8 + i * 0.1, g = 300, x = e.x, y = e.y - 30;
          B.shots.push({ x, y, vx: (tx - x) / tt, vy: (ty - y) / tt - 0.5 * g * tt, g, t: tt + 0.4, dmg: 22 });
          mark(e, tx, ty, 12, tt, 0, 'spike');
        }
      }
    },
    absorb(e, dt, p, B) {
      const A = B.act, t = 2.0 - A.T;
      if (A.n >= 1 || t < 0.6) return; A.n = 1;
      // çevredeki demir ve kobalt damarlarını çeker: her biri zırh olur
      const c0 = Math.floor(e.x / TILE), r0 = Math.floor(e.y / TILE), R = B.phase === 2 ? 8 : 6; let n = 0;
      for (let r = r0 - R; r <= r0 + R; r++) for (let c = c0 - R; c <= c0 + R; c++) {
        const d = TD[tileAt(c, r)]; if (!d || !IRONISH(d) || Math.hypot(c - c0, r - r0) > R) continue;
        setTile(c, r, T.AIR); n++;
        for (let k = 0; k < 4; k++) particle(c * TILE + 8, r * TILE + 8, (e.x - c * TILE - 8) * 2, (e.y - 18 - r * TILE - 8) * 2, 0.5, '#b06a34', 2, 1, 0);
      }
      const add = Math.min(e.maxHp * 0.6 - (e.shield || 0), e.maxHp * 0.07 * n);
      if (add > 0) { e.shield = (e.shield || 0) + add; ring(e.x, e.y - 14, '#e0603a', 30); emit('toast', { text: `Pas Golemi ${n} damar yuttu: zırhlandı`, icon: 'armor', bad: true }); }
      sfx.zap(); flashLight(e.x, e.y - 18, 6, 0.4);
    },
    rail(e, dt, p, B) {
      const A = B.act; A.st -= dt;
      if (A.stage === 'aim') { e.wind = 1 - Math.max(0, A.st) / 0.8; if (A.st <= 0) { A.stage = 'dash'; A.st = 1.4; e.wind = 0; A.fire = true; sfx.rumble(); } return; }
      if (A.stage === 'dash') {
        const ok = plow(e, e.x + Math.cos(A.a) * 400, e.y + Math.sin(A.a) * 400, 230, dt, 9); e.lunge = 1;
        if (rnd() < 0.6) sparks(e.x, e.y + 6, '#ffb070', 1, 50);
        for (const q of live()) if (!A.hit.includes(q.i) && dist(q, e) < e.r + 8) { A.hit.push(q.i); damagePlayer(q, 30 * e.dmgMul, e.x - Math.cos(A.a) * 20, e.y - Math.sin(A.a) * 20); pullPlayer(q, Math.cos(A.a) * 260, -80); shake(0.5); hitstop(0.05); }
        if (!ok || A.st <= 0) {
          if (!ok) { shake(0.6); debris(e.x, e.y, 'stone', 12); sfx.explode(); }
          if (A.chain > 0 && p) { A.chain--; A.stage = 'aim'; A.st = 0.45; A.a = Math.atan2(p.y - e.y, p.x - e.x); A.hit = []; e.face = p.x >= e.x ? 1 : -1; return; }
          A.stage = 'daze'; A.st = 1.2; A.fire = false; e.exposed = 1.5;
        }
        return;
      }
      if (A.stage === 'daze' && A.st <= 0) { e.exposed = 0; A.T = 0; }
    },
  },
};
