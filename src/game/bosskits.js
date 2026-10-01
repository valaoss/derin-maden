// Bossların yetenek döngüsü: her bossun beş yeteneği var, sabit bir sırayla döner (rot); can: o an yapılabilir mi.
// Buradaki yetenekler bosses.js'teki kitlere eklenir. Kalıcı etkiler boss durumunda durur:
// B.zones (yerde kalan / kovalayan alanlar), B.lines (gecikmeli ışık çizgileri), B.shots (yay çizen kaya), B.images (ayna yansımaları).
// Yalnız bosses.js içe aktarır (döngüsel bağımlılık: buradaki işlevler bosses.js'i çağrı anında kullanır).
import { rnd } from '../core/rng.js';
import { TILE, GROUND_ROW, CENTER_COL, PLAY_MIN_COL, PLAY_MAX_COL, stratumOfRow } from '../config.js';
import { T, TD, HOST_TILE } from '../data/tiles.js';
import { G, biomeOf } from './state.js';
import { tileAt, solidAt, setTile } from '../world/map.js';
import { breakTile, damagePlayer, blindPlayer, webPlayer } from './player.js';
import { losClear, damageStructure } from './enemies.js';
import { live, mark, bullet, spotNear, openSpot, hitPlayers, beamLen, onBeam, breakable, inMark, TAU } from './bosses.js';
import { sparks, debris, shake, ring, flashLight, dust, hitstop } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

// yeteneğin ilk kullanımında bir kez uyarır
const said = (B, k, text, icon = 'skull') => { const s = (B.said ||= {}); if (!s[k]) { s[k] = 1; emit('toast', { text, icon, bad: true }); } };
const near = (e, q, R) => Math.hypot(q.x - e.x, q.y - e.y) < R;
const count = type => G.enemies.reduce((n, o) => n + (o.type === type && !o.dead ? 1 : 0), 0);
function nearest(x, y) { let best = null, bd = Infinity; for (const q of live()) { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = q; } } return best; }
const los = (e, p) => losClear(e.x, e.y, p.x, p.y);

export const EXTRA = {
  // KARAKÖK: kök mızrakları -> diken çalısı -> toprağa dalış -> kök kafesi -> kökçük çağırma
  karakok: {
    rot: ['spikes', 'bramble', 'burrow', 'cage', 'summon'], gap: 1.5,
    can: { spikes: (e, p, dp) => dp < 150, bramble: (e, p, dp) => dp < 170, burrow: (e, p, dp) => dp < 200, cage: (e, p, dp) => dp < 150, summon: () => count('rodent') < 4 },
    start: {
      // tohum keseleri: düştükleri yerde bir süre yavaşlatıp yaralayan çalı biter
      bramble(e, p, B) {
        B.act.T = 0.5; e.lunge = 1; sfx.spit();
        for (let i = 0; i < (B.phase === 2 ? 4 : 3); i++) { const [x, y] = i ? spotNear(p.x, p.y, 46) : [p.x, p.y]; mark(e, x, y, 12, 0.8 + i * 0.14, 8, 'seed'); }
      },
      // madencinin çevresinde kök halkası çıkar (içeride bekle), ardından ortası (dışarı kaç)
      cage(e, p, B) {
        B.act.T = 0.5; e.lunge = 1; sfx.rumble(); said(B, 'cage', 'Kök Kafesi: halka çıkana dek ortada dur, sonra kaç!');
        for (const q of live()) {
          if (!near(e, q, 170)) continue;
          for (let i = 0; i < 8; i++) { const a = i * TAU / 8, x = q.x + Math.cos(a) * 27, y = q.y + Math.sin(a) * 22; if (openSpot(x, y)) mark(e, x, y, 10, 0.85, 16, 'root'); }
          mark(e, q.x, q.y, 15, B.phase === 2 ? 1.45 : 1.7, 22, 'root');
        }
      },
    },
    run: {},
  },

  // KAVURGAN: kül yağmuru -> kor nefesi -> omurga yarığı -> kemik halkası -> kül bulutu
  kavurgan: {
    rot: ['embers', 'breath', 'spine', 'bones', 'ash'], gap: 1.5,
    can: { embers: (e, p, dp) => dp < 170, breath: (e, p, dp) => dp < 80 && los(e, p), spine: (e, p, dp) => dp > 24 && dp < 150, bones: (e, p, dp) => dp < 160, ash: (e, p, dp) => dp < 140 },
    start: {
      // yerden madenciye doğru sırayla çıkan kemik dikenleri; öfkede üç kol
      spine(e, p, B) {
        const a0 = Math.atan2(p.y - e.y, p.x - e.x);
        B.act.T = 0.7; e.lunge = 1; e.face = p.x >= e.x ? 1 : -1; sfx.creak(); shake(0.2);
        for (const f of B.phase === 2 ? [-0.38, 0, 0.38] : [0]) for (let i = 1; i <= 8; i++) {
          const x = e.x + Math.cos(a0 + f) * (10 + i * 15), y = e.y + Math.sin(a0 + f) * (10 + i * 15);
          if (!openSpot(x, y)) break;
          mark(e, x, y, 9, 0.5 + i * 0.09, 16, 'bone');
        }
      },
      ash(e, p, B) { B.act.T = 1.3; sfx.growl(); said(B, 'ash', 'Kül Bulutu: içinde fenerin söner!', 'flame'); },
    },
    run: {
      // şaha kalkıp kül kusar: bulutun içinde fener söner, kül boğar
      ash(e, dt, p, B) {
        const A = B.act, t = 1.3 - A.T;
        if (t < 0.6) { e.wind = t / 0.6; return; }
        if (A.done) return;
        A.done = true; e.wind = 0; e.lunge = 1; sfx.flame(); shake(0.3);
        const q = p || e, n = B.phase === 2 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const [x, y] = i ? spotNear(q.x, q.y, 54) : [(e.x + q.x) / 2, (e.y + q.y) / 2];
          B.zones.push({ kind: 'ash', x, y, r: 26, t: 6, T: 6, tick: 0.3 }); dust(x, y, 6, 'rgba(90,80,76,0.7)');
        }
      },
    },
  },

  // ÖTEGÖZ: güdümlü küreler -> çekim -> boşluk sarmalı -> göz ışını -> taşlaştıran bakış
  otegoz: {
    rot: ['orbs', 'pull', 'spiral', 'gaze', 'stare'], gap: 1.4,
    can: { orbs: (e, p, dp) => dp < 170, pull: (e, p, dp) => dp < 115 && los(e, p), spiral: (e, p, dp) => dp < 150, gaze: (e, p, dp) => dp < 130 && los(e, p), stare: (e, p, dp) => dp < 150 && los(e, p) },
    start: {
      spiral(e, p, B) { const A = B.act; A.T = 2.5; A.a = rnd() * TAU; A.dir = rnd() < 0.5 ? 1 : -1; A.tick = 0; e.flashT = 0.4; sfx.arm(); },
      stare(e, p, B) { B.act.T = 2; B.act.hit = []; sfx.glare(); said(B, 'stare', 'Ötegöz bakıyor: göz kızarınca kıpırdama!'); },
    },
    run: {
      // dönerek saçılan küre kolları: aralarından geç
      spiral(e, dt, p, B) {
        const A = B.act, t = 2.5 - A.T;
        if (t < 0.45) { e.wind = t / 0.45; return; }
        A.fire = true; A.tick -= dt;
        if (A.tick > 0) return;
        A.tick = 0.13; A.a += A.dir * 0.42; sfx.blink();
        const n = B.phase === 2 ? 3 : 2;
        for (let i = 0; i < n; i++) bullet(e, A.a + i * TAU / n, 68, 8, '#b080ff', { life: 2.3 });
      },
      // göz açılır: baktığı sürece kıpırdayan taş kesilir
      stare(e, dt, p, B) {
        const A = B.act, t = 2 - A.T;
        if (t < 1) { e.wind = t; return; }
        A.fire = t < 1.7;
        if (!A.fire) return;
        for (const q of live()) {
          if (A.hit.includes(q.i) || !near(e, q, 170) || Math.hypot(q.x - q.px, q.y - q.py) / dt < 14 || !los(e, q)) continue;
          A.hit.push(q.i); damagePlayer(q, 16 * e.dmgMul, e.x, e.y); webPlayer(q, 2.4);
          G.zaps.push({ x0: e.x, y0: e.y, x1: q.x, y1: q.y - 4, t: 0.15 }); sparks(q.x, q.y, '#c0b8ff', 10, 80); sfx.zap();
        }
      },
    },
  },

  // KÖRDEŞEN: cevher yelpazesi -> matkap hücumu -> pençe darbesi -> kaya fırlatma -> matkap girdabı
  kordesen: {
    rot: ['coins', 'charge', 'slam', 'boulder', 'drill'], gap: 1.4,
    can: { coins: (e, p, dp) => dp < 150 && los(e, p), charge: (e, p, dp) => dp > 36 && dp < 160, slam: (e, p, dp) => dp < 60, boulder: (e, p, dp) => dp < 190, drill: (e, p, dp) => dp < 70 },
    start: {
      boulder(e, p, B) { const A = B.act; A.T = 9; A.stage = 'lift'; A.st = 0.7; A.n = B.phase === 2 ? 2 : 1; A.tgt = p.i; e.face = p.x >= e.x ? 1 : -1; sfx.creak(); debris(e.x + e.face * 10, e.y + 6, 'stone', 6); },
      drill(e, p, B) { const A = B.act; A.T = 9; A.stage = 'wind'; A.st = 0.6; A.a = rnd() * TAU; A.tick = 0; sfx.arm(); },
    },
    run: {
      // yerden kaya söker, madencinin durduğu yere yay çizerek atar; düştüğü yerde parçalanır
      boulder(e, dt, p, B) {
        const A = B.act; A.st -= dt;
        if (A.stage === 'lift') {
          e.wind = 1 - Math.max(0, A.st) / 0.7;
          if (A.st > 0) return;
          const q0 = G.players[A.tgt], q = q0 && !q0.dead ? q0 : p;
          if (q) {
            e.face = q.x >= e.x ? 1 : -1;
            const x = e.x + e.face * 8, y = e.y - 12, d = Math.hypot(q.x - x, q.y - y), tt = Math.max(0.6, Math.min(1.1, d / 150)), g = 300;
            B.shots.push({ x, y, vx: (q.x - x) / tt, vy: (q.y - y) / tt - 0.5 * g * tt, g, t: tt, dmg: 24 });
            mark(e, q.x, q.y, 16, tt, 0, 'boulder'); sfx.whip();
          }
          e.wind = 0; e.lunge = 1;
          if (--A.n > 0) A.st = 0.45; else { A.stage = 'rest'; A.st = 0.4; }
          return;
        }
        if (A.st <= 0) A.T = 0;
      },
      // olduğu yerde döner: çevresindeki kayayı oyar, kıymık saçar; bitince sersemler
      drill(e, dt, p, B) {
        const A = B.act; A.st -= dt;
        if (A.stage === 'wind') {
          e.wind = 1 - Math.max(0, A.st) / 0.6;
          if (A.st <= 0) { A.stage = 'spin'; A.st = A.dur = B.phase === 2 ? 2.1 : 1.6; A.fire = true; e.wind = 0; sfx.rumble(); }
          return;
        }
        if (A.stage === 'spin') {
          A.tick -= dt;
          if (A.tick <= 0) {
            A.tick = 0.18; A.a += 0.55;
            const R = 1.2 + (1 - A.st / A.dur) * 1.4, c0 = Math.floor(e.x / TILE), r0 = Math.floor(e.y / TILE); let n = 0;
            for (let r = r0 - 2; r <= r0 + 2 && n < 2; r++) for (let c = c0 - 2; c <= c0 + 2 && n < 2; c++) if (Math.hypot(c - c0, r - r0) <= R && TD[tileAt(c, r)].solid && breakable(c, r)) { breakTile(c, r, null); debris(c * TILE + 8, r * TILE + 8, 'stone', 3); n++; }
            for (let i = 0; i < 3; i++) bullet(e, A.a + i * TAU / 3, 105, 8, '#c8b8a0', { life: 0.9 });
            hitPlayers(e.x, e.y, e.r + 9, 10 * e.dmgMul);
            for (const s of G.structures) if (!s.dead && near(e, s, 30)) damageStructure(s, 5);
            shake(0.15); sfx.burrow();
          }
          if (A.st <= 0) { A.stage = 'daze'; A.st = 0.8; A.fire = false; }
          return;
        }
        if (A.st <= 0) A.T = 0;
      },
    },
  },

  // EZELÎ: yargı sütunları -> ufuk çizgisi -> ışık tohumları -> ışık çarkı -> kıyamet halkası
  ezeli: {
    rot: ['pillars', 'horizon', 'seeds', 'wheel', 'doom'], gap: 1.5,
    can: { pillars: (e, p, dp) => dp < 170, horizon: (e, p, dp) => dp < 200, seeds: (e, p, dp) => dp < 170, wheel: (e, p, dp) => dp < 110, doom: (e, p, dp) => dp < 140 },
    start: {
      // madencinin hizasından geçen ışık çizgisi (kayadan geçer): kaçacak yer neredeyse ona göre yatay ya da dikey; öfkede ikincisi izler
      horizon(e, p, B) {
        B.act.T = 0.5; e.flashT = 0.5; sfx.glare(); said(B, 'horizon', 'Ufuk Çizgisi: çizginin dışına çık!');
        for (const q of live()) {
          if (!near(e, q, 220)) continue;
          const c = Math.floor(q.x / TILE), r = Math.floor(q.y / TILE), flat = !solidAt(c, r - 1) || !solidAt(c, r + 1);
          for (let i = 0; i < (B.phase === 2 ? 2 : 1); i++) {
            const t = 1.1 + i * 0.8, L = flat ? { x: PLAY_MIN_COL * TILE, y: q.y - 3, a: 0, len: (PLAY_MAX_COL + 1 - PLAY_MIN_COL) * TILE } : { x: q.x, y: q.y - 160, a: Math.PI / 2, len: 320 };
            B.lines.push(Object.assign(L, { w: 7, t, T: t, dmg: 20, post: 0, tgt: i ? q.i : null, lock: 0.75 }));
          }
        }
      },
      // çevrede ışık tohumları belirir; her biri nişan alıp sırayla ışın atar
      seeds(e, p, B) {
        B.act.T = 0.5; e.flashT = 0.5; sfx.blink();
        for (let i = 0; i < (B.phase === 2 ? 4 : 3); i++) {
          const a = rnd() * TAU, [x, y] = spotNear(p.x + Math.cos(a) * 55, p.y + Math.sin(a) * 40, 14), t = 1.2 + i * 0.3;
          B.lines.push({ node: 1, x, y, a: Math.atan2(p.y - 3 - y, p.x - x), len: 0, max: 150, los: 1, w: 5, t, T: t, dmg: 14, post: 0, tgt: p.i, lock: 0.4 });
          ring(x, y, '#fff4c0', 12);
        }
      },
      wheel(e, p, B) { const A = B.act; A.T = 3.4; A.a = rnd() * TAU; A.dir = rnd() < 0.5 ? 1 : -1; A.tick = 0; A.lens = []; sfx.arm(); said(B, 'wheel', 'Işık Çarkı: kolların arasında kal, onlarla dön!'); },
    },
    run: {
      // gövdesinden çıkan ışık kolları ağır ağır döner (kaya keser)
      wheel(e, dt, p, B) {
        const A = B.act, t = 3.4 - A.T, n = A.n = B.phase === 2 ? 5 : 4;
        for (let i = 0; i < n; i++) A.lens[i] = beamLen(e.x, e.y, A.a + i * TAU / n, 120);
        if (t < 0.9) { e.wind = t / 0.9; return; }
        A.fire = true; e.wind = 0; A.a += A.dir * (B.phase === 2 ? 0.75 : 0.6) * dt;
        A.tick -= dt;
        if (A.tick > 0) return;
        A.tick = 0.15;
        for (const q of live()) for (let i = 0; i < n; i++) if (onBeam(q, e.x, e.y, A.a + i * TAU / n, A.lens[i], 5)) { damagePlayer(q, 8 * e.dmgMul, e.x, e.y); sparks(q.x, q.y, '#fff4c0', 5, 60); break; }
      },
    },
  },

  // AYNASIZ HÜKÜMDAR: silah yansıması -> ayna adımı -> yansımalar -> ayna kırıkları -> ayna kalkanı
  aynasiz: {
    rot: ['mirror', 'step', 'images', 'shards', 'reflect'], gap: 1.2,
    can: { mirror: (e, p, dp) => dp < 150 && los(e, p), step: (e, p, dp) => dp > 30 && dp < 210, images: (e, p, dp) => dp < 170, shards: (e, p, dp) => dp < 170, reflect: (e, p, dp) => dp < 170 && los(e, p) },
    start: {
      // madencinin çevresinde yansımaları belirir; her biri sırayla kırık saçıp dağılır
      images(e, p, B) {
        B.act.T = 0.6; e.flashT = 0.6; sfx.shade();
        const n = B.phase === 2 ? 3 : 2, a0 = rnd() * TAU;
        for (let i = 0; i < n; i++) {
          const a = a0 + i * TAU / n, [x, y] = spotNear(p.x + Math.cos(a) * 52, p.y + Math.sin(a) * 34, 12), t = 1.1 + i * 0.3;
          B.images.push({ x, y, t, T: t, tgt: p.i, face: p.x >= x ? 1 : -1 }); ring(x, y, '#c8d0ff', 16);
        }
      },
      reflect(e, p, B) { B.act.T = 2.9; B.refCd = 0; sfx.arm(); said(B, 'reflect', 'Ayna kalktı: ateşin sana döner, siper al!'); },
    },
    run: {
      // aynasını kaldırır: o sırada yediği her vuruş kırık olup geri döner (bosses.js: mirrored)
      reflect(e, dt, p, B) {
        const A = B.act, t = 2.9 - A.T;
        if (p) e.face = p.x >= e.x ? 1 : -1;
        if (t < 0.5) { e.wind = t / 0.5; return; }
        e.wind = 0; A.fire = t < 2.6; B.refCd -= dt;
      },
    },
  },

  // KEHRİBAR ANA: yumurta yağmuru -> reçine yelpazesi -> arı sürüsü -> kehribar hapsi -> petek tuzakları
  kehribarAna: {
    rot: ['eggs', 'resin', 'swarm', 'amber', 'comb'], gap: 1.5,
    can: { eggs: (e, p, dp) => dp < 180 && count('tozbocek') < 8, resin: (e, p, dp) => dp < 140 && los(e, p), swarm: (e, p, dp, B) => dp < 170 && !B.zones.some(z => z.kind === 'swarm'), amber: (e, p, dp) => dp < 150, comb: (e, p, dp) => dp < 170 },
    start: {
      // kesesinden bir sürü salar: en yakın madenciyi kovalar, dağılana kadar sokar
      swarm(e, p, B) {
        const t = B.phase === 2 ? 8 : 6;
        B.act.T = 0.6; e.lunge = 1; sfx.chirp(); said(B, 'swarm', 'Arı sürüsü peşinde: dağılana kadar kaç!');
        B.zones.push({ kind: 'swarm', x: e.x, y: e.y - 6, r: 11, t, T: t, v: B.phase === 2 ? 46 : 38, tick: 0.5 });
      },
      // çevreye petek tuzakları bırakır: basan kehribara yapışır
      comb(e, p, B) {
        B.act.T = 0.5; e.lunge = 1; sfx.brood();
        for (const q of live()) {
          if (!near(e, q, 190)) continue;
          for (let i = 0; i < (B.phase === 2 ? 5 : 4); i++) { const [x, y] = spotNear(q.x, q.y, 46); if (Math.hypot(x - q.x, y - q.y) > 14) B.zones.push({ kind: 'comb', x, y, r: 8, t: 9, T: 9, arm: 0.8, tick: 0 }); }
        }
      },
    },
    run: {},
  },

  // MADENİN KALBİ: duvar dikenleri -> pıhtılar -> tavan çöküşü -> kapanan duvarlar -> nabız halkası
  madenKalbi: {
    rot: ['spikes', 'clot', 'fall', 'grow', 'beat'], gap: 1.3,
    can: { spikes: (e, p, dp) => dp < 210, clot: (e, p, dp) => dp < 200, fall: (e, p, dp) => dp < 210, grow: (e, p, dp) => dp < 210, beat: (e, p, dp) => dp < 150 },
    start: {
      // pıhtılar: düştükleri yerde patlar, her biri küçük bir halka yayar
      clot(e, p, B) {
        B.act.T = 0.4; e.lunge = 1; sfx.spit();
        for (const q of live()) { if (!near(e, q, 220)) continue; for (let i = 0; i < (B.phase === 2 ? 4 : 3); i++) { const [x, y] = i ? spotNear(q.x, q.y, 42) : [q.x, q.y]; mark(e, x, y, 9, 1.2 + i * 0.22, 12, 'clot'); } }
      },
      // maden kapanır: madencinin çevresindeki boşluklar kayayla dolar; içinde kalan ezilir
      grow(e, p, B) {
        B.act.T = 0.5; e.flashT = 0.5; sfx.creak(); shake(0.3); said(B, 'grow', 'Maden kapanıyor: yanıp sönen boşluklardan çık!');
        for (const q of live()) {
          if (!near(e, q, 220)) continue;
          const pc = Math.floor(q.x / TILE), pr = Math.floor(q.y / TILE); let n = 0;
          for (let tries = 0; tries < 40 && n < (B.phase === 2 ? 6 : 4); tries++) {
            const c = pc + Math.round((rnd() - 0.5) * 5), r = pr + Math.round((rnd() - 0.5) * 5);
            if (c === CENTER_COL || r <= GROUND_ROW + 1 || c < PLAY_MIN_COL || c > PLAY_MAX_COL || tileAt(c, r) !== T.AIR) continue;
            if (!(solidAt(c + 1, r) || solidAt(c - 1, r) || solidAt(c, r + 1) || solidAt(c, r - 1)) || B.marks.some(m => m.kind === 'grow' && m.c === c && m.row === r)) continue;
            const t = 1.1 + n * 0.12;
            B.marks.push({ x: c * TILE + 8, y: r * TILE + 4, r: 9, t, T: t, dmg: 0, kind: 'grow', post: 0, c, row: r }); n++;
          }
        }
      },
    },
    run: {},
  },
};

// işaret patlayınca (bosses.js tickMarks): türe özel sonuç
export const POP = {
  seed(e, m, B) { const t = B.phase === 2 ? 8 : 6; B.zones.push({ kind: 'bramble', x: m.x, y: m.y, r: 15, t, T: t, tick: 0.2 }); sparks(m.x, m.y, '#78b43c', 8, 70); debris(m.x, m.y, 'dirt', 4); sfx.creak(); },
  bone(e, m) { sparks(m.x, m.y, '#e8dcc0', 8, 90); debris(m.x, m.y, 'stone', 3); sfx.creak(); },
  boulder() {},
  clot(e, m, B) {
    B.rings.push({ x: m.x, y: m.y + 4, r: 6, R: 44, v: 95, dmg: 9 * e.dmgMul, hit: [], col: '#ff3a6a', los: false });
    sparks(m.x, m.y, '#ff3a6a', 12, 100); shake(0.2); sfx.splash();
  },
  grow(e, m) {
    const cx = m.c * TILE + 8, cy = m.row * TILE + 8; let hit = false;
    if (tileAt(m.c, m.row) !== T.AIR) return;
    for (const q of live()) if (Math.abs(q.x - cx) < 13 && Math.abs(q.y - cy) < 13) { damagePlayer(q, 18 * e.dmgMul, cx, cy); hit = true; }
    // içinde biri (madenci, yaratık, alet) varsa örülmez: kimse kayaya gömülmesin
    if (hit || G.enemies.some(o => !o.dead && Math.abs(o.x - cx) < 8 + o.r && Math.abs(o.y - cy) < 8 + o.r) || G.structures.some(s => !s.dead && Math.abs(s.x - cx) < 12 && Math.abs(s.y - cy) < 14)) return;
    setTile(m.c, m.row, HOST_TILE[biomeOf(Math.max(0, stratumOfRow(m.row)))]); debris(cx, cy, 'stone', 8); sfx.creak();
  },
};

// alanın içindeki madenciye her vuruşta ne olur
const ZONE = {
  bramble(e, z, q) { damagePlayer(q, 3 * e.dmgMul, z.x, z.y); q.slowT = Math.max(q.slowT, 0.7); },
  ash(e, z, q) { damagePlayer(q, 2 * e.dmgMul, z.x, z.y); q.darkT = G.time + 0.8; },
  swarm(e, z, q) { damagePlayer(q, 4 * e.dmgMul, z.x, z.y); },
  comb(e, z, q) { damagePlayer(q, 12 * e.dmgMul, z.x, z.y); webPlayer(q, 2.2); z.t = 0; sparks(z.x, z.y, '#ffb040', 12, 90); ring(z.x, z.y, '#ffb040', 14); sfx.web(); },
};
const TICK = { bramble: 0.4, ash: 0.5, swarm: 0.3, comb: 0 };

function boom(e, s, c, r) {
  if (TD[tileAt(c, r)].solid && breakable(c, r)) breakTile(c, r, null);
  hitPlayers(s.x, s.y, 20, s.dmg * e.dmgMul);
  for (const st of G.structures) if (!st.dead && Math.hypot(st.x - s.x, st.y - s.y) < 26) damageStructure(st, 12);
  const a0 = rnd() * TAU;
  for (let i = 0; i < 6; i++) { const a = a0 + i * TAU / 6; G.ebullets.push({ x: s.x - s.vx * 0.02, y: s.y - s.vy * 0.02, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, life: 0.5, dmg: 7 * e.dmgMul, col: '#c8b8a0' }); }
  debris(s.x, s.y, 'stone', 12); dust(s.x, s.y, 5, 'rgba(200,184,160,0.5)'); shake(0.45); hitstop(0.04); sfx.explode(); haptic(40);
}

// her kare (boss yaşadıkça): alanlar, ışık çizgileri, uçan kayalar, yansımalar
export function tickExtras(e, dt, B) {
  let j = 0;
  for (const z of B.zones) {
    z.t -= dt;
    if (z.arm > 0) z.arm -= dt;
    else {
      if (z.v) { const q = nearest(z.x, z.y); if (q) { const d = Math.hypot(q.x - z.x, q.y - 3 - z.y) || 1, s = Math.min(d, z.v * dt); z.x += (q.x - z.x) / d * s; z.y += (q.y - 3 - z.y) / d * s; } }
      z.tick -= dt;
      if (z.tick <= 0) { z.tick = TICK[z.kind]; for (const q of live()) if (z.t > 0 && inMark(q, z)) ZONE[z.kind](e, z, q); }
    }
    if (z.t > 0) B.zones[j++] = z;
  }
  B.zones.length = j; j = 0;
  for (const L of B.lines) {
    if (L.t > 0) {
      L.t -= dt;
      const q0 = L.tgt != null ? G.players[L.tgt] : null, q = q0 && !q0.dead ? q0 : null;
      if (q && L.t > L.lock) { if (L.node) L.a = Math.atan2(q.y - 3 - L.y, q.x - L.x); else if (L.a) L.x = q.x; else L.y = q.y - 3; }
      if (L.los) L.len = beamLen(L.x, L.y, L.a, L.max);
      if (L.t <= 0) {
        L.post = 0.25; sfx.zap(); flashLight(L.x + Math.cos(L.a) * L.len / 2, L.y + Math.sin(L.a) * L.len / 2, 5, 0.2);
        for (const o of live()) if (onBeam(o, L.x, L.y, L.a, L.len, L.w)) { damagePlayer(o, L.dmg * e.dmgMul, L.x, L.y); blindPlayer(o, 0.3); sparks(o.x, o.y, '#fff4c0', 8, 90); }
      }
    } else L.post -= dt;
    if (L.t > 0 || L.post > 0) B.lines[j++] = L;
  }
  B.lines.length = j; j = 0;
  for (const s of B.shots) {
    s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
    const c = Math.floor(s.x / TILE), r = Math.floor(s.y / TILE);
    if (TD[tileAt(c, r)].solid || s.t <= 0) boom(e, s, c, r); else B.shots[j++] = s;
  }
  B.shots.length = j; j = 0;
  for (const im of B.images) {
    im.t -= dt;
    const q0 = G.players[im.tgt], q = q0 && !q0.dead ? q0 : nearest(im.x, im.y);
    if (q) im.face = q.x >= im.x ? 1 : -1;
    if (im.t > 0) { B.images[j++] = im; continue; }
    if (q) { const a = Math.atan2(q.y - 3 - im.y, q.x - im.x); for (let k = -1; k <= 1; k++) G.ebullets.push({ x: im.x, y: im.y - 2, vx: Math.cos(a + k * 0.2) * 150, vy: Math.sin(a + k * 0.2) * 150, life: 1.2, dmg: 10 * e.dmgMul, col: '#e0e8ff' }); }
    sparks(im.x, im.y, '#ffffff', 14, 110); ring(im.x, im.y, '#c8d0ff', 20); sfx.shade();
  }
  B.images.length = j;
}
