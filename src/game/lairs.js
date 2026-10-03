// Biyom bossları: her biri kendi biyomunun derinliğinde bekler ve oraya inen madenciyi gürültüden bağımsız karşılar.
// Uyuyan Dev (Uyuyan Dev), Ustabaşı (Kemik Çukuru), Sağır Avcı (Sağır Mağaralar: ses de uyandırır), Pas Golemi (Mıknatıs Çekirdeği).
// Yenilen bir daha gelmez; izini kaybedip çekilen (herkes yüzeyde kaldı) yerine döner ve bekler.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_ROW, GROUND_Y, STRATUM_ROWS, PLAY_MIN_COL, PLAY_MAX_COL, CENTER_COL } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { STRATA } from '../data/palette.js';
import { G } from './state.js';
import { tileAt, setTile, solidAt } from '../world/map.js';
import { spawnEnemy } from './enemies.js';
import { bossBusy, breakable } from './bosses.js';
import './lairkits.js';
import { debris, ring, shake, flashLight, hitstop, particle, dust } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { bossSfx } from '../audio/samples.js';
import { emit } from '../core/events.js';

const biome = short => STRATA.findIndex(b => b.short === short);
// depth: biyomun kaçıncı satırından sonra; noise: bu gürültünün üstünde biyomun herhangi bir yerinde uyanır
export const LAIRS = {
  dev:       { biome: biome('DEV'),      depth: 24, omen: 3.0, text: 'Yer nabız gibi atıyor… Dev uyanıyor.', col: '#ff5a6a' },
  ustabasi:  { biome: biome('KEMİK'),    depth: 22, omen: 2.6, text: 'Karanlıkta kazma sesleri… biri hâlâ vardiyada.', col: '#9af0c0' },
  sagirAvci: { biome: biome('SAĞIR'),    depth: 22, omen: 2.6, noise: 70, text: 'Dev kulaklar kıpırdıyor. Sessiz ol.', col: '#c0c0e0' },
  pasGolem:  { biome: biome('MIKNATIS'), depth: 22, omen: 2.6, text: 'Demir kendiliğinden kıpırdıyor… raylar birleşiyor.', col: '#e0603a' },
};
export const LAIR_KEYS = Object.keys(LAIRS);

export function makeLairs() { const o = {}; for (const k of LAIR_KEYS) o[k] = { st: 'wait', t: 0 }; return o; }
export const lairBusy = () => !!G.lairs && LAIR_KEYS.some(k => G.lairs[k].st === 'omen');

function spot(p) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  for (let tries = 0; tries < 40; tries++) {
    const c = Math.max(PLAY_MIN_COL + 2, Math.min(PLAY_MAX_COL - 2, pc + (rnd() < 0.5 ? -1 : 1) * (4 + Math.floor(rnd() * 3)))), r = pr + Math.floor(rnd() * 3) - 1;
    const d = TD[tileAt(c, r)];
    if (d.unbreakable || d.chest || d.heart || d.nest || d.relic || d.seal) continue;
    return [c, r];
  }
  return [CENTER_COL, pr];
}
// doğduğu yerde dövüşecek kadar oda açılır
function carve(c0, r0) {
  for (let r = r0 - 3; r <= r0 + 1; r++) for (let c = c0 - 3; c <= c0 + 3; c++) {
    const dx = (c - c0) / 3.6, dy = (r - r0 + 1) / 2.6;
    if (dx * dx + dy * dy > 1 || !solidAt(c, r) || !breakable(c, r)) continue;
    setTile(c, r, T.AIR); if (rnd() < 0.4) debris(c * TILE + 8, r * TILE + 8, 'stone', 3);
  }
}

export function updateLairs(dt) {
  if (!G.lairs || G.tutorial || !G.order) return;
  for (const k of LAIR_KEYS) {
    const S = G.lairs[k], L = LAIRS[k];
    if (S.st === 'done') continue;
    const s = G.order.indexOf(L.biome); if (s < 0) continue;
    const r0 = GROUND_ROW + s * STRATUM_ROWS;
    if (S.st === 'wait') {
      if ((S.cd = (S.cd || 0) - dt) > 0 || bossBusy(S)) continue;
      const inB = q => { const r = Math.floor(q.y / TILE); return r >= r0 && r < r0 + STRATUM_ROWS; };
      const p = G.players.find(q => !q.dead && !q.ride && q.y >= GROUND_Y && inB(q) && (Math.floor(q.y / TILE) >= r0 + L.depth || (L.noise && G.threat.noise >= L.noise)));
      if (!p) continue;
      Object.assign(S, { st: 'omen', t: 0, pi: p.i, beat: 0 });
      G.threat.bossCd = Math.max(G.threat.bossCd || 0, L.omen + 5);
      emit('lairOmen', { type: k, text: L.text }); sfx.alarm(); shake(0.25); haptic([30, 60, 30]);
      continue;
    }
    if (S.st === 'omen') {
      S.t += dt; const kk = S.t / L.omen, p = G.players[S.pi] && !G.players[S.pi].dead ? G.players[S.pi] : G.players.find(q => !q.dead);
      if (p && rnd() < dt * (10 + 30 * kk)) particle(p.x + (rnd() - 0.5) * 120, p.y - 40 + (rnd() - 0.5) * 60, 0, 20, 0.6, L.col, 1, 1, 0);
      if ((S.beat -= dt) <= 0) { S.beat = 0.55 - 0.3 * kk; shake(0.05 + 0.25 * kk); sfx.rumble(); }
      if (S.t < L.omen || !p) continue;
      const [c, r] = spot(p); carve(c, r);
      const x = c * TILE + 8, y = r * TILE + 8, e = spawnEnemy(k, x, y, 4);
      e.emergeT = 1.4; e.lair = k; e.face = p.x < x ? -1 : 1;
      G.threat.bossUp = true; G.threat.bossType = k; G.threat.bossCd = 0;
      debris(x, y, 'stone', 18); ring(x, y, L.col, 40); flashLight(x, y, 7, 0.6); shake(0.7); hitstop(0.06); dust(x, y, 8, 'rgba(160,140,130,0.5)');
      emit('bossSpawn', k); sfx.alarm(); bossSfx(k, 'spawn', sfx.roar); haptic([40, 60, 40, 60, 80]);
      Object.assign(S, { st: 'fight', t: 0, e });
      continue;
    }
    if (S.st === 'fight') {
      const e = S.e;
      if (!e || e.dead) {
        if (e && e.dieT > 0.5) Object.assign(S, { st: 'done', e: null });
        else Object.assign(S, { st: 'wait', cd: 20, e: null });
      }
    }
  }
}
// kayıt: yenilenler
export const lairsDone = () => G.lairs ? LAIR_KEYS.filter(k => G.lairs[k].st === 'done') : [];
export function loadLairs(g, done) { g.lairs = makeLairs(); for (const k of done || []) if (g.lairs[k]) g.lairs[k].st = 'done'; }
