// Mühürler ve bekçiler: her dört biyomluk bölümün dibi kırılmaz bir mühür katmanıdır; bölümün bekçisi yenilmeden aşağı inilmez.
// Bekçi gürültüye bakmaz: mühre yaklaşan madenciyi kesin karşılar. Gürültülü gelen onu öfkeli bulur, sessiz gelenin ilk vuruşu pusudur.
// Bölüm sonu Kor Katmanı ya da Şelale Mağarası ise bekçi oranın kadim bossudur (Kor İblisi / Poseidon).
// Su tapınağının iki yan sütunu ve Kalp Kristali'nin kafesi de mühürlüdür: Poseidon ve Madenin Kalbi yenilince açılır.
// Ölçerle uyanan boss kendi bölümünün bekçisiyse ve o bölümde yenilirse mühür yine kırılır.
// Boss uyanıkken asansör ve Dönüş Fişeği çalışmaz.
import { rnd } from '../core/rng.js';
import { TILE, COLS, GROUND_Y, PLAY_MIN_COL, PLAY_MAX_COL, CENTER_COL, sealRowOf, stratumOfRow } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { SEAL, BOSS_BANDS } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, setTile, solidAt } from '../world/map.js';
import { spawnEnemy } from './enemies.js';
import { bossBusy, breakable } from './bosses.js';
import { FALLS_BIOME, LAVA_BIOME } from './liquids.js';
import { debris, dust, ring, sparks, shake, flashLight, hitstop, particle } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { bossSfx } from '../audio/samples.js';
import { emit } from '../core/events.js';
import { markJourney } from './journey.js';

const band = s => Math.min(BOSS_BANDS.length - 1, Math.floor(s / 4));
// bölüm sonundaki biyomun bekçisi: kadim boss varsa o, yoksa bölümün bossu
function keeperOf(g, s) {
  const b = g.order[s];
  if (b === LAVA_BIOME) return 'balrog';
  if (b === FALLS_BIOME) return 'poseidon';
  return BOSS_BANDS[band(s)];
}

// sefer başı: mühür listesi. Kırılmış mühür (eski kayıt ya da derinden başlama) haritada yoktur
export function makeSeals(g) {
  if (g.tutorial) return [];
  const out = [], at = (c, r) => g.map[r * COLS + c];
  for (const s of SEAL.strata) {
    const r = sealRowOf(s), cells = [];
    for (let c = PLAY_MIN_COL; c <= PLAY_MAX_COL; c++) cells.push([c, r]);
    out.push({ s, by: keeperOf(g, s), cells, top: r - SEAL.zone, bot: r, st: 'wait' });
  }
  const hr = g.heartRow, cage = [];
  for (let r = hr - 1; r <= hr + 1; r++) for (let c = CENTER_COL - 1; c <= CENTER_COL + 1; c++) if (r !== hr || c !== CENTER_COL) cage.push([c, r]);
  out.push({ s: stratumOfRow(hr), by: 'madenKalbi', cells: cage, top: hr - SEAL.heartZone, bot: hr + 2, st: 'wait', heart: true });
  // su tapınağı: zemin kırılmaz, yandaki iki sütun mühürlenir (aşağıya Poseidon'u geçmeden inilmez)
  if (g.temple) {
    const fr = g.temple.r1 + 1, side = [[PLAY_MIN_COL, fr], [PLAY_MAX_COL, fr]];
    for (const [c, r] of side) g.map[r * COLS + c] = T.SEAL;
    out.push({ s: stratumOfRow(fr), by: 'poseidon', cells: side, top: -1, bot: -1, st: 'wait', temple: true });
  }
  for (const S of out) {
    if (S.temple) continue;
    for (const [c, r] of S.cells) { const i = r * COLS + c; g.map[i] = T.SEAL; if (g.lq) g.lq[i] = 0; if (g.buried) g.buried[i] = 0; }
  }
  // mührü aşan portallar kaldırılır
  if (g.portals) g.portals = g.portals.filter(P => !out.some(S => !S.heart && !S.temple && (P.a[1] < S.bot) !== (P.b[1] < S.bot)));
  // derinden başlama: başlangıcın üstündeki mühürler kırılmış sayılır
  for (const S of out) if (g.startStratum > 0 && S.s < g.startStratum) open(g, S);
  return out;
}
function open(g, S) { S.st = 'done'; for (const [c, r] of S.cells) if (g.map[r * COLS + c] === T.SEAL) g.map[r * COLS + c] = T.AIR; }
// kayıttan: haritada mühür taşı kalmadıysa kırılmış sayılır
export function syncSeals(g) { for (const S of g.seals || []) S.st = S.cells.some(([c, r]) => g.map[r * COLS + c] === T.SEAL) ? 'wait' : 'done'; }

// boss uyanıkken (ya da bir karşılaşma başlıyorken) kaçış yok
export function bossLock() {
  if (!G) return false;
  if (G.enemies.some(e => e.d.boss && !e.dead)) return true;
  if ((G.seals || []).some(S => S.st === 'omen')) return true;
  for (const S of [G.balrog, G.serpent, G.temple, G.hoard, ...Object.values(G.lairs || {})]) if (S && (S.st === 'dark' || S.st === 'omen' || S.st === 'wake')) return true;
  return false;
}
export const sealOmen = () => (G.seals || []).some(S => S.st === 'omen');

// mühür kırılır: taşlar çatlayıp söner
function breakSeal(S) {
  S.st = 'done';
  let x = CENTER_COL * TILE + 8, y = S.cells[0][1] * TILE + 8;
  for (const [c, r] of S.cells) {
    if (tileAt(c, r) !== T.SEAL) continue;
    setTile(c, r, T.AIR);
    const cx = c * TILE + 8, cy = r * TILE + 8;
    sparks(cx, cy, '#ff6ab0', 6, 90); debris(cx, cy, 'stone', 4);
  }
  if (S.heart) { x = CENTER_COL * TILE + 8; y = G.heartRow * TILE + 8; }
  ring(x, y, '#ff6ab0', 70); ring(x, y, '#ffffff', 40); flashLight(x, y, 10, 0.7); shake(0.7); hitstop(0.08);
  sfx.explode(); sfx.waveClear(); haptic([40, 60, 120]);
  G.stats.seals = (G.stats.seals | 0) + 1;
  markJourney('boss', x, y, -1);
  emit('sealBroken', { by: S.by, heart: !!S.heart, temple: !!S.temple, s: S.s });
}

// bekçinin doğacağı yer: madencinin çevresinde, mühürle aynı bölümde, biraz açık alan oyulur
function keeperSpot(p, S) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  for (let tries = 0; tries < 40; tries++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const c = Math.max(PLAY_MIN_COL + 2, Math.min(PLAY_MAX_COL - 2, pc + side * (3 + Math.floor(rnd() * 4))));
    const r = Math.min(S.bot - 2, Math.max(S.top, pr + Math.floor(rnd() * 5) - 1));
    const d = TD[tileAt(c, r)];
    if (d.unbreakable || d.chest || d.heart || d.nest || d.relic) continue;
    return [c, r];
  }
  return [CENTER_COL, Math.min(S.bot - 2, pr)];
}
function carveArena(c0, r0) {
  for (let r = r0 - 2; r <= r0 + 1; r++) for (let c = c0 - 3; c <= c0 + 3; c++) {
    const dx = (c - c0) / 3.4, dy = (r - r0 + 0.5) / 2.2;
    if (dx * dx + dy * dy > 1 || !solidAt(c, r) || !breakable(c, r)) continue;
    setTile(c, r, T.AIR); if (rnd() < 0.4) debris(c * TILE + 8, r * TILE + 8, 'stone', 3);
  }
}

function wake(S, p) {
  Object.assign(S, { st: 'omen', t: 0, pi: p.i, beat: 0, loud: G.threat.noise >= SEAL.rageNoise });
  G.threat.bossCd = Math.max(G.threat.bossCd || 0, SEAL.omen + 5);
  emit('keeperWarn', { type: S.by, heart: !!S.heart, loud: S.loud });
  sfx.alarm(); shake(0.3); haptic([30, 60, 30]);
}
function rise(S) {
  const p = G.players[S.pi] && !G.players[S.pi].dead ? G.players[S.pi] : G.players.find(q => !q.dead) || G.player;
  const [c, r] = keeperSpot(p, S);
  carveArena(c, r);
  const x = c * TILE + 8, y = r * TILE + 8, e = spawnEnemy(S.by, x, y, 4);
  e.emergeT = 1.4; e.keeper = true; e.face = p.x < x ? -1 : 1;
  // gürültüyle gelen öfkeli bulur; sessiz gelen ilk vuruşta pusu kurar
  if (S.loud) { e.dmgMul *= SEAL.rage.dmg; e.spMul *= SEAL.rage.sp; } else e.ambush = SEAL.ambush;
  S.e = e; S.st = 'up';
  G.threat.bossUp = true; G.threat.bossType = S.by; G.threat.bossCd = 0;
  debris(x, y, 'stone', 18); ring(x, y, e.d.col, 36); ring(x, y, '#ff6ab0', 24); shake(0.6); flashLight(x, y, 7, 0.6); hitstop(0.06);
  emit('bossSpawn', S.by);
  sfx.alarm(); bossSfx(S.by, 'spawn'); haptic([40, 60, 40, 60, 80]);
}

const inZone = (S, q) => { const r = Math.floor(q.y / TILE); return r >= S.top && r <= S.bot; };

export function updateSeals(dt) {
  const L = G.seals; if (!L || !L.length || G.tutorial) return;
  // ölçerle uyanıp yenilen boss: kendi bölümünün bekçisiyse o bölümün mührü kırılır
  for (const e of G.enemies) {
    if (!e.d.boss || !e.dead || e.sealSeen || e.dieT <= 0.5) continue;
    e.sealSeen = true;
    if (e.keeper) continue;
    const st = Math.max(0, stratumOfRow(Math.floor(e.y / TILE)));
    const S = L.find(o => o.st === 'wait' && !o.temple && o.by === e.type && band(o.s) === band(st));
    if (S) breakSeal(S);
  }
  for (const S of L) {
    if (S.st === 'done') continue;
    // kadim bekçiler kendi karşılaşmalarıyla gelir; yenilince mühür kırılır
    if (S.by === 'poseidon') { if (G.temple && G.temple.st === 'done') breakSeal(S); continue; }
    if (S.by === 'balrog') { if (G.balrog && G.balrog.st === 'done') breakSeal(S); continue; }
    if (S.st === 'wait') {
      if ((S.cd = (S.cd || 0) - dt) > 0 || bossBusy()) continue;
      const p = G.players.find(q => !q.dead && !q.ride && q.y >= GROUND_Y && inZone(S, q));
      if (p) wake(S, p);
      continue;
    }
    if (S.st === 'omen') {
      S.t += dt;
      const k = S.t / SEAL.omen, [c0, r0] = S.cells[Math.floor(rnd() * S.cells.length)];
      if (rnd() < dt * (14 + 40 * k)) particle(c0 * TILE + 8 + (rnd() - 0.5) * 12, r0 * TILE, (rnd() - 0.5) * 20, -30 - rnd() * 60 * (0.5 + k), 0.7, rnd() < 0.5 ? '#ff6ab0' : '#ffe0f0', 1, 1, 0);
      if ((S.beat -= dt) <= 0) { S.beat = 0.5 - 0.25 * k; shake(0.05 + 0.2 * k); sfx.rumble(); }
      if (S.t >= SEAL.omen) rise(S);
      continue;
    }
    if (S.st === 'up') {
      const e = S.e;
      if (!e || e.dead) {
        // yenildi: mühür kırılır. İzini kaybedip çekildiyse (herkes yüzeyde kaldı) yerine döner ve bekler
        if (e && e.dieT > 0.5) breakSeal(S);
        else Object.assign(S, { st: 'wait', cd: 8, e: null });
      }
    }
  }
}
