// Balrog karşılaşması: Kor Katmanı'nın ortasına inen madenciyi bir kez karşılar.
// Önce karanlık sis toplanır ve derinden davullar çalar, sonra gölgede iki göz açılır; kaya yarılır ve alevlenerek çıkar.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_ROW, STRATUM_ROWS, PLAY_MIN_COL, PLAY_MAX_COL, CENTER_COL } from '../config.js';
import { TD } from '../data/tiles.js';
import { BALROG } from '../data/balance.js';
import { G } from './state.js';
import { tileAt } from '../world/map.js';
import { breakTile } from './player.js';
import { spawnEnemy } from './enemies.js';
import { bossBusy } from './bosses.js';
import { LAVA_BIOME } from './liquids.js';
import { shake, flashLight, debris, dust, ring, sparks, hitstop } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { bossSfx } from '../audio/samples.js';
import { emit } from '../core/events.js';

const breakable = (c, r) => { if (c < PLAY_MIN_COL || c > PLAY_MAX_COL) return false; const d = TD[tileAt(c, r)]; return d.solid && !(d.unbreakable || d.heart || d.chest || d.nest || d.relic); };

export function updateBalrog(dt) {
  if (G.tutorial || !G.order) return;
  const S = G.balrog || (G.balrog = { st: 'wait', t: 0 });
  if (S.st === 'done') { S.t += dt; return; }
  const s = G.order.indexOf(LAVA_BIOME); if (s < 0) return;
  const r0 = GROUND_ROW + s * STRATUM_ROWS;
  if (S.st === 'wait') {
    if ((S.cd = (S.cd || 0) - dt) > 0 || bossBusy(S)) return;
    const p = G.players.find(q => !q.dead && !q.ride && Math.floor(q.y / TILE) >= r0 + BALROG.depth && Math.floor(q.y / TILE) < r0 + STRATUM_ROWS);
    if (!p) return;
    // karşı tarafta, madencinin hizasında bir gölge köşesi
    const pc = Math.floor(p.x / TILE), side = pc >= CENTER_COL ? -1 : 1;
    const c = Math.max(PLAY_MIN_COL + 1, Math.min(PLAY_MAX_COL - 1, pc + side * (5 + Math.floor(rnd() * 2))));
    Object.assign(S, { st: 'dark', t: 0, beat: BALROG.drum, n: 0, c, r: Math.floor(p.y / TILE), pi: p.i });
    G.threat.bossCd = Math.max(G.threat.bossCd || 0, BALROG.dark + 5);
    emit('balrog', 'dark'); sfx.drum(); shake(0.2);
    return;
  }
  if (S.st === 'dark') {
    S.t += dt;
    // derinlerin davulları: "dum... dum-dum"; giderek sıklaşır ve yükselir, kaya yarılınca kesintisiz gümbürtüye döner
    const k = Math.min(1, S.t / BALROG.dark), gap = BALROG.drum * (1 - 0.45 * k);
    if ((S.beat -= dt) <= 0) {
      const roll = S.crack, i = (S.n | 0) % 3, big = roll || i === 0; S.n = (S.n | 0) + 1;
      S.beat = roll ? 0.19 : i === 0 ? gap * 0.62 : i === 1 ? gap * 0.24 : gap * 0.5;
      sfx.drum((big ? 0.7 : 0.42) + 0.3 * k); shake((big ? 0.12 : 0.05) + 0.25 * k); if (big) haptic(30);
    }
    if (S.t > 3.2 && !S.eyes) { S.eyes = true; emit('balrog', 'eyes'); sfx.growl(); }
    if (S.t > BALROG.dark - 1.4 && !S.crack) {
      S.crack = true; const x = S.c * TILE + 8, y = S.r * TILE + 8;
      for (let r = S.r - 2; r <= S.r; r++) for (let c = S.c - 1; c <= S.c + 1; c++) if (breakable(c, r)) breakTile(c, r, null);
      debris(x, y - 8, 'stone', 18); dust(x, y - 8, 10, 'rgba(20,10,12,0.8)'); shake(0.45); sfx.rockfall();
    }
    if (S.t >= BALROG.dark) {
      const x = S.c * TILE + 8, y = S.r * TILE + 8;
      const e = spawnEnemy('balrog', x, y, 4);
      e.emergeT = 0; e.intro = BALROG.intro; e.face = G.players[S.pi] && G.players[S.pi].x < x ? -1 : 1;
      G.threat.bossUp = true; G.threat.bossType = 'balrog'; G.threat.bossCd = 0;
      Object.assign(S, { st: 'fight', t: 0 });
      ring(x, y - 10, '#ff5a1a', 60); sparks(x, y - 10, '#ffd060', 30, 170); sparks(x, y - 10, '#ff5a1a', 24, 110);
      flashLight(x, y - 10, 10, 0.9); shake(1); hitstop(0.12); bossSfx('balrog', 'spawn', sfx.roar); sfx.explode(); haptic([80, 40, 160]);
      emit('bossSpawn', 'balrog'); emit('balrog', 'rise');
    }
    return;
  }
  if (S.st === 'fight') {
    S.t += dt;
    const e = G.enemies.find(o => o.type === 'balrog');
    // öldüyse bir daha gelmez; izini kaybedip çekildiyse yeniden pusuya yatar
    if (e && e.dead && !S.end) S.end = e.dieT > 0.5 ? 'slain' : 'gone';
    if (!e || e.dead) {
      if (S.end === 'slain') Object.assign(S, { st: 'done', t: 0 });
      else Object.assign(S, { st: 'wait', t: 0, eyes: false, crack: false, end: null, cd: 20 });
    }
  }
}
