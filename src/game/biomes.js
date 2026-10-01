// v6 biyom kuralları: gelgit, yeniden büyüyen kaya, yumurtalar, açlık, sessiz deniz, tuzak taşı, kehribar.
// Hepsi deterministik (G.time ve seeded rnd); updateHazards içinden çağrılır.
import { rnd } from '../core/rng.js';
import { TILE, GROUND_ROW, GROUND_Y, STRATUM_ROWS, CENTER_COL, PLAY_MIN_COL, PLAY_MAX_COL, stratumOfRow } from '../config.js';
import { T, TD, HOST_TILE } from '../data/tiles.js';
import { STRATA } from '../data/palette.js';
import { WAVES, ENEMIES } from '../data/balance.js';
import { G, biomeOf } from './state.js';
import { tileAt, setTile } from '../world/map.js';
import { hasRelic, isLocal } from './run.js';
import { spawnOrb } from './player.js';
import { spawnEnemy, makeElite, wetAt } from './enemies.js';
import { addNoise } from './threat.js';
import { sparks, ring, dust, debris, flashLight } from './fx.js';
import { sfx } from '../audio/audio.js';
import { emit } from '../core/events.js';

const BIO = k => STRATA.findIndex(b => b[k]);
const TIDE_B = BIO('tide');
export const biomeAtRow = r => STRATA[biomeOf(Math.max(0, stratumOfRow(r)))];
export const isDeafAt = y => y >= GROUND_Y && !!biomeAtRow(Math.floor(y / TILE)).deaf;

// gelgit: 60 sn döngü — 40 sn alçak, 5 sn yükselir, 10 sn yüksek, 5 sn çekilir
export function tideLevel() {
  const s = G.order ? G.order.indexOf(TIDE_B) : -1;
  if (s < 0) return null;
  const t = G.time % 60, f = t < 40 ? 0 : t < 45 ? (t - 40) / 5 : t < 55 ? 1 : (60 - t) / 5;
  const bot = (GROUND_ROW + (s + 1) * STRATUM_ROWS) * TILE, top = bot - STRATUM_ROWS * TILE;
  return { s, f, top, bot, y: bot - f * STRATUM_ROWS * TILE * 0.85 };
}
export function inWater(x, y) { const L = tideLevel(); return !!L && L.f > 0 && y > L.y && y < L.bot; }

function hostAt(r) { return HOST_TILE[biomeOf(Math.max(0, stratumOfRow(r)))]; }
const occupied = (c, r) => G.players.some(q => !q.dead && Math.abs(q.x - (c * TILE + 8)) < 13 && Math.abs(q.y - (r * TILE + 8)) < 13) ||
  G.enemies.some(e => !e.dead && Math.abs(e.x - (c * TILE + 8)) < 12 && Math.abs(e.y - (r * TILE + 8)) < 12);

// kırılan her blok (oyuncu ya da düşman): Yaşayan Kaya'da yeniden büyümek üzere sıraya girer
export function onBreak(c, r, t) {
  if (!biomeAtRow(r).regrow || c === CENTER_COL || !TD[t].plain) return;
  G.regrow.push({ c, r, t: G.time + 20 });
}

// biyoma özgü taş kırıldı (oyuncu)
export function onSpecial(d, c, r, p, x, y) {
  const local = isLocal(p);
  if (d.lure) {
    // tuzak taşı: sağır düşmanlar 8 sn buraya koşar
    G.threat.lure = { x, y, t: 8 }; addNoise(3, x, y);
    ring(x, y, '#c0c0e0', 40); ring(x, y, '#ffffff', 24); sfx.howl();
    if (local) emit('toast', { text: 'Tuzak taşı çınladı: sağırlar buraya koşar', icon: 'hush' });
  }
  if (d.node) {
    G.nodeT = G.time + 40; ring(x, y, '#ff8aa0', 36); sparks(x, y, '#ff8aa0', 14, 90);
    if (local) emit('toast', { text: 'Sinir düğümü koptu: kaya 40 sn büyümüyor', icon: 'heart' });
  }
  if (d.egg) { spawnOrb(x, y, 'gold'); sparks(x, y, '#d8f0a0', 10, 80); }
  if (d.lumen) {
    for (const q of G.players) if (!q.dead && Math.hypot(q.x - x, q.y - y) < 48) q.hp = Math.min(q.maxHp, q.hp + q.maxHp * 0.15);
    flashLight(x, y, 9, 0.9); ring(x, y, '#8af0ff', 30);
  }
  if (d.amber) {
    // kehribar: yarı yarıya ganimet ya da uyanan elit yaratık
    ring(x, y, '#ffb040', 26); sparks(x, y, '#ffd890', 14, 100);
    if (rnd() < 0.5) {
      for (let i = 0; i < 5; i++) spawnOrb(x, y, 'gold');
      for (let i = 0; i < 3; i++) spawnOrb(x, y, 'crystal');
      spawnOrb(x, y, 'kehribar');
      if (local) emit('toast', { text: 'Kehribarın içi hazine doluydu', icon: 'kehribar' });
    } else {
      const st = Math.max(0, stratumOfRow(r)), pool = WAVES.allowed(8, st).filter(k => !ENEMIES[k].boss && !ENEMIES[k].small);
      const e = spawnEnemy(pool[Math.floor(rnd() * pool.length)] || 'bug', x, y, 3); e.emergeT = 0.6; makeElite(e);
      if (local) emit('toast', { text: 'Kehribardaki yaratık uyandı', icon: 'skull', bad: true });
    }
  }
}

export function updateBiomes(dt) {
  if (!G.regrow) return;
  // Yaşayan Kaya: tüneller 20 sn sonra kapanır (içinde kimse yoksa; sinir düğümü durdurur)
  if (G.regrow.length && G.time >= (G.nodeT || 0)) {
    let j = 0;
    for (const g of G.regrow) {
      if (G.time < g.t) { G.regrow[j++] = g; continue; }
      if (tileAt(g.c, g.r) !== T.AIR) continue;
      if (occupied(g.c, g.r)) { g.t = G.time + 2; G.regrow[j++] = g; continue; }
      setTile(g.c, g.r, hostAt(g.r)); dust(g.c * TILE + 8, g.r * TILE + 8, 2, 'rgba(200,80,100,0.5)');
    }
    G.regrow.length = j;
  }
  // yumurtalar: 8 sn içinde kırılmazsa çatlar
  if (G.eggs.length) {
    let j = 0;
    for (const g of G.eggs) {
      if (G.time < g.t) { G.eggs[j++] = g; continue; }
      if (tileAt(g.c, g.r) !== T.EGG) continue;
      setTile(g.c, g.r, T.AIR);
      const x = g.c * TILE + 8, y = g.r * TILE + 8;
      for (let k = 0; k < 3; k++) spawnEnemy('tozbocek', x + (k - 1) * 3, y, 2).emergeT = 0.2 + k * 0.1;
      sparks(x, y, '#d8f0a0', 12, 90); debris(x, y, 'moss', 6); sfx.brood();
    }
    G.eggs.length = j;
  }
  // Pirana: suya giren madencinin çevresindeki sudan üçlü sürü çıkar (yakında en çok dört pirana)
  if ((G.fishT -= dt) <= 0) {
    G.fishT = 4;
    for (const p of G.players) {
      if (p.dead || p.y < GROUND_Y || !wetAt(p.x, p.y)) continue;
      const have = G.enemies.filter(e => !e.dead && e.d.fish && Math.hypot(e.x - p.x, e.y - p.y) < 220).length;
      if (have >= 4) continue;
      const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
      for (let tries = 0; tries < 16; tries++) {
        const c = pc + Math.round((rnd() - 0.5) * 12), r = pr + Math.round((rnd() - 0.5) * 8), x = c * TILE + 8, y = r * TILE + 8;
        if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r <= GROUND_ROW || TD[tileAt(c, r)].solid || !wetAt(x, y) || Math.hypot(x - p.x, y - p.y) < 40) continue;
        for (let k = 0; k < Math.min(3, 4 - have); k++) spawnEnemy('pirana', x + (k - 1) * 4, y, G.wave.num).emergeT = 0.25 + k * 0.1;
        sparks(x, y, '#bff4ff', 8, 60);
        if (isLocal(p) && !G.fishWarn) { G.fishWarn = true; emit('toast', { text: 'Piranalar: sudan çık, karada çırpınırlar', icon: 'skull', bad: true }); }
        break;
      }
    }
  }
  // tuzak taşı çağrısı söner
  const th = G.threat;
  if (th.lure && (th.lure.t -= dt) <= 0) th.lure = null;
  // Açlık Yatağı: 15 sn'de bir oyuncuların yakınındaki damarlar kararır
  G.hungerT -= dt;
  if (G.hungerT <= 0) {
    G.hungerT = 15;
    for (const p of G.players) {
      if (p.dead || p.y < GROUND_Y || !biomeAtRow(Math.floor(p.y / TILE)).hunger) continue;
      const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE); let n = 0;
      for (let tries = 0; tries < 40 && n < 3; tries++) {
        const c = pc + Math.round((rnd() - 0.5) * 16), r = pr + Math.round((rnd() - 0.5) * 16);
        if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r <= GROUND_ROW) continue;
        const d = TD[tileAt(c, r)];
        if (!d.ore || d.plain || !biomeAtRow(r).hunger) continue;
        setTile(c, r, hostAt(r)); dust(c * TILE + 8, r * TILE + 8, 3, 'rgba(120,120,60,0.6)'); n++;
      }
      if (n && isLocal(p) && !G.hungerWarn) { G.hungerWarn = true; emit('toast', { text: 'Damarlar kararıyor: acele et', icon: 'skull', bad: true }); }
    }
  }
  // Sessiz Deniz: en derindeki madenci buradaysa ölçerin tabanı yükselir
  let deep = null; for (const p of G.players) if (!p.dead && p.y >= GROUND_Y && (!deep || p.y > deep.y)) deep = p;
  const sea = deep && biomeAtRow(Math.floor(deep.y / TILE)).sea;
  G.seaT = sea ? G.seaT + dt : Math.max(0, G.seaT - dt * 2);
  // Dünya Tohumu: yeni biyoma girişte ekip tam iyileşir
  if (G.maxStratum > (G.seenStratum | 0)) {
    G.seenStratum = G.maxStratum;
    if (hasRelic('tohum')) for (const q of G.players) if (!q.dead) { q.hp = q.maxHp; ring(q.x, q.y, '#a8f070', 20); }
  }
}
// Sessiz Deniz tabanı (threat.js)
export function seaFloor() { return G.seaT > 0 ? Math.min(95, 30 + G.seaT * 0.5) : 0; }
