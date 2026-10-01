// Sefer içi asansör: merkez şaft. Ulaşılan her biyomda istasyon açılır (şaft oraya kadar kazılır),
// şaftta durup hedef seçince kabin oyuncuyu taşır. Kabin içinde hasar alınmaz. Deterministik: komutla çalışır.
import { TILE, GROUND_ROW, GROUND_Y, CENTER_COL, STRATUM_ROWS } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { ELEVATOR } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, setTile } from '../world/map.js';
import { addNoise } from './threat.js';
import { isLocal, hear } from './run.js';
import { dust, sparks } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

export const SHAFT_X = CENTER_COL * TILE + 8;
export const stationRow = s => GROUND_ROW + s * STRATUM_ROWS + 1;
export const stationY = s => s < 0 ? GROUND_ROW * TILE - 10 : stationRow(s) * TILE + 8;

// biyoma ilk ulaşma: istasyon + şaft
export function openStation(s) {
  if (s < 1 || G.stations.includes(s)) return false;
  G.stations.push(s); G.stations.sort((a, b) => a - b);
  const r1 = stationRow(s);
  for (let r = GROUND_ROW; r <= r1; r++) {
    const t = tileAt(CENTER_COL, r), d = TD[t];
    // su tapınağının kırılmaz zemini ve giderleri delinmez (boss salonu açılmasın; kabin içinden geçer)
    if (t === T.AIR || t === T.FOUNDATION || t === T.BEDROCK || d.chest || d.heart || d.nest || d.relic || d.sink || (G.temple && r === G.temple.r1 + 1)) continue;
    setTile(CENTER_COL, r, T.AIR);
  }
  emit('station', s);
  return true;
}

// binilebilir mi: yalnız kampta ya da bir istasyon platformunda, şaft hizasında (halatın ortasında olmaz)
export function atShaft(p) {
  if (Math.abs(p.x - SHAFT_X) > ELEVATOR.snap || !G.stations.length) return false;
  if (p.y < GROUND_Y) return true;
  return G.stations.some(s => Math.abs(stationY(s) - p.y) <= ELEVATOR.stop);
}
// hedefler: -1 kamp, sonra istasyonlar; bulunduğun kat hariç
export function destinations(p) {
  const out = [];
  if (Math.abs(stationY(-1) - p.y) > 6) out.push(-1);
  for (const s of G.stations) if (Math.abs(stationY(s) - p.y) > 6) out.push(s);
  return out;
}

export function callElevator(p, to) {
  if (p.dead || p.ride || !atShaft(p)) return false;
  if (to !== -1 && !G.stations.includes(to)) return false;
  const y = stationY(to);
  if (Math.abs(y - p.y) <= 6) return false;
  // binme: kabine yürü, kolu indir (kısa), sonra yola çık
  p.ride = { y, to, t: 0, d0: Math.abs(y - p.y), board: ELEVATOR.walk + ELEVATOR.lever, x0: p.x }; p.dig = null;
  addNoise(ELEVATOR.noise, p.x, p.y);
  emit('elevator', { pi: p.i, to });
  return true;
}

export function updateRide(p, dt) {
  const rd = p.ride;
  p.iframes = Math.max(p.iframes, 0.2); p.dig = null;
  if (rd.board > 0) {
    const was = rd.board; rd.board -= dt;
    const walk = rd.board > ELEVATOR.lever;
    if (walk) { p.moving = true; p.walkT += dt * 10; if (SHAFT_X !== rd.x0) p.face = Math.sign(SHAFT_X - rd.x0); }
    else p.moving = false;
    p.x = walk ? SHAFT_X + (rd.x0 - SHAFT_X) * (rd.board - ELEVATOR.lever) / ELEVATOR.walk : SHAFT_X;
    if (was > ELEVATOR.lever && rd.board <= ELEVATOR.lever && hear(p)) sfx.click();
    if (rd.board <= 0) { if (hear(p)) sfx.build(); if (isLocal(p)) haptic(15); sparks(p.x, p.y - 10, '#ffe79a', 4, 40); }
    return;
  }
  rd.t += dt;
  // uzun yolculukta kabin hızlanır: yol uzadıkça artar, 4 biyom ve üstünde 4 kat
  const sp = ELEVATOR.speed * (1 + Math.min(ELEVATOR.far, (rd.d0 || 0) / (STRATUM_ROWS * TILE * ELEVATOR.farRows))) * (p.carrying ? 0.6 : 1);
  const dy = rd.y - p.y;
  p.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * dt);
  p.x += (SHAFT_X - p.x) * Math.min(1, dt * 12);
  p.iframes = Math.max(p.iframes, 0.2);
  p.moving = false; p.dig = null; p.up = dy < 0;
  if (rd.t > 0.2 && Math.abs(rd.y - p.y) < 0.5) {
    p.y = rd.y; p.x = SHAFT_X; p.ride = null; p.up = false; p.iframes = 0.4;
    dust(p.x, p.y + 6, 3); if (hear(p)) sfx.land();
    emit('elevatorDone', { pi: p.i, to: rd.to });
  }
}
