// Dinamik maden olayları (deterministik, simülasyonun parçası): tehlikeler (sarsıntı, gaz, karartma, sürü) ve ödüller (damar, kese, sandık, sessizlik).
// Uyarı afişinden birkaç saniye sonra vurur; oyuncuya tepki verme şansı bırakır.
import { rnd } from '../core/rng.js';
import { TILE, COLS, GROUND_Y, GROUND_ROW, ROWS, PLAY_MIN_COL, PLAY_MAX_COL, stratumOfRow } from '../config.js';
import { T, isPlain, CHEST_TILE } from '../data/tiles.js';
import { EVENTS, EVENT_KEYS, chestWeights } from '../data/balance.js';
import { G } from './state.js';
import { tileAt, setTile } from '../world/map.js';
import { spawnGas } from './hazards.js';
import { addNoise, swarm } from './threat.js';
import { shake, dust, ring, sparks, flashLight } from './fx.js';
import { sfx, haptic } from '../audio/audio.js';
import { emit } from '../core/events.js';

export function makeEvents() { return { t: EVENTS.first, k: null, warnT: 0, darkT: 0, hushT: 0, n: 0 }; }

const under = () => G.players.filter(p => !p.dead && p.y >= GROUND_Y);

export function updateEvents(dt) {
  const ev = G.evt; if (!ev || G.over) return;
  if (ev.darkT > 0) ev.darkT -= dt;
  if (ev.hushT > 0) ev.hushT -= dt;
  if (G.tutorial && !G.tutorial.done) return;
  const ps = under();
  if (ev.k) {
    ev.warnT -= dt;
    if (ev.warnT <= 0) { hit(ev.k, ps); ev.k = null; ev.t = EVENTS.cd[0] + rnd() * (EVENTS.cd[1] - EVENTS.cd[0]); }
    return;
  }
  if (!ps.length || G.threat.level < EVENTS.minLevel) return;
  ev.t -= dt;
  if (ev.t > 0) return;
  ev.k = pickEvent(); ev.warnT = EVENTS.warn; ev.n++;
  emit('event', { k: ev.k, phase: 'warn' });
  if (!EVENTS[ev.k].good) { sfx.creak(); shake(0.12); }
}

function hit(k, ps) {
  emit('event', { k, phase: 'hit' });
  if (k === 'sarsinti') {
    shake(0.6); haptic([30, 40, 60]); sfx.rumble();
    for (const p of ps) { tremor(p); addNoise(EVENTS.sarsinti.noise, p.x, p.y); }
  } else if (k === 'gaz') {
    for (const p of ps) leak(p);
  } else if (k === 'karanlik') {
    G.evt.darkT = EVENTS.karanlik.t;
  } else if (k === 'sessizlik') {
    G.evt.hushT = EVENTS.sessizlik.t; G.threat.noise = Math.max(0, G.threat.noise - EVENTS.sessizlik.drop);
    for (const p of ps) ring(p.x, p.y, '#d8d8e8', 40);
  } else if (ps.length) {
    const p = ps[Math.floor(rnd() * ps.length)];
    if (k === 'suru') { sfx.rumble(); shake(0.3); swarm(p, 3 + Math.floor(stratumOfRow(Math.floor(p.y / TILE)) / 4)); }
    else if (k === 'damar') vein(p);
    else if (k === 'kese') satchel(p);
    else if (k === 'sandik') chest(p);
  }
}

function pickEvent() {
  let sum = 0;
  for (const k of EVENT_KEYS) sum += EVENTS[k].w;
  let x = rnd() * sum;
  for (const k of EVENT_KEYS) if ((x -= EVENTS[k].w) < 0) return k;
  return EVENT_KEYS[0];
}

// oyuncudan dmin..dmax blok uzakta, koşulu sağlayan hücre
function spotNear(p, dmin, dmax, ok) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  for (let tries = 0; tries < 80; tries++) {
    const a = rnd() * Math.PI * 2, d = dmin + rnd() * (dmax - dmin);
    const c = pc + Math.round(Math.cos(a) * d), r = pr + Math.round(Math.sin(a) * d);
    if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r <= GROUND_ROW + 1 || r >= ROWS - 3) continue;
    if (ok(c, r)) return { c, r };
  }
  return null;
}
// ödül yerini göster: açığa çıkar, işaret koy
function mark(c, r, col) {
  G.rev[r * COLS + c] = 1;
  const x = c * TILE + 8, y = r * TILE + 8;
  G.pings.push({ pi: -1, x, y, t: 14, born: 0, col });
  ring(x, y, col, 18); sparks(x, y, col, 10, 80); flashLight(x, y, 5, 0.6);
}
const rich = r => { const s = stratumOfRow(r); return s >= 6 ? (rnd() < 0.5 ? T.CRYSTAL : T.GOLD) : s >= 3 ? (rnd() < 0.5 ? T.GOLD : T.COBALT) : rnd() < 0.5 ? T.GOLD : T.IRON; };

// parlayan damar: yakındaki sıradan kaya cevhere döner
function vein(p) {
  const at = spotNear(p, 4, 8, (c, r) => isPlain(tileAt(c, r)));
  if (!at) return;
  let n = 0;
  for (let dr = -1; dr <= 1 && n < EVENTS.damar.tiles; dr++) for (let dc = -1; dc <= 1 && n < EVENTS.damar.tiles; dc++) {
    const c = at.c + dc, r = at.r + dr;
    if (r <= GROUND_ROW || !isPlain(tileAt(c, r))) continue;
    setTile(c, r, rich(r)); G.rev[r * COLS + c] = 1; n++;
  }
  mark(at.c, at.r, '#ffd870'); sfx.oreReveal();
}

// kayıp kese: kayaya gömülü, derinliğe göre dolu bir çanta
function satchel(p) {
  const at = spotNear(p, 5, 9, (c, r) => isPlain(tileAt(c, r)));
  if (!at) return;
  const s = Math.max(0, stratumOfRow(at.r));
  setTile(at.c, at.r, T.AIR);
  const bag = { iron: 3 + s, water: 2, cobalt: s >= 2 ? 2 + (s >> 1) : 0, gold: s >= 3 ? 1 + (s >> 2) : 0, crystal: s >= 6 ? 1 + (s >> 2) : 0 };
  G.satchels.push({ x: at.c * TILE + 8, y: at.r * TILE + 8, bag, heart: false, owner: -1, echo: true, lost: true });
  mark(at.c, at.r, '#74efcf'); sfx.chest();
}

// unutulmuş sandık: kalıntı sandığı belirir
function chest(p) {
  const at = spotNear(p, 5, 9, (c, r) => isPlain(tileAt(c, r)));
  if (!at) return;
  // derinliğe göre tür (taklitçi ve lanetli çıkmaz: işaretli sandık güvenilir)
  const w = chestWeights(Math.max(0, stratumOfRow(at.r)), false).filter(([k]) => k !== 'mimic' && k !== 'cursed');
  let x = rnd() * w.reduce((a, q) => a + q[1], 0), tt = T.CHEST;
  for (const [k, v] of w) { x -= v; if (x < 0) { tt = CHEST_TILE[k]; break; } }
  setTile(at.c, at.r, tt);
  mark(at.c, at.r, '#ffd24a'); sfx.chest();
}

// oyuncunun üstündeki desteksiz tavan kayaları gevşer ve düşer
function tremor(p) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  let n = 0;
  for (let tries = 0; tries < 60 && n < EVENTS.sarsinti.rocks; tries++) {
    const c = pc + Math.round((rnd() - 0.5) * 10), r = pr - 1 - Math.floor(rnd() * 5);
    if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r <= GROUND_ROW || r >= ROWS - 2) continue;
    // yalnız sıradan kaya gevşer: cevher, kapı, barikat, özel taş ve yuva yerinde kalır
    if (!isPlain(tileAt(c, r)) || tileAt(c, r + 1) !== T.AIR) continue;
    if (G.falls.some(f => f.c === c && f.r === r)) continue;
    setTile(c, r, T.LOOSE); G.falls.push({ c, r, t: 0.4 + rnd() * 0.8 }); n++;
  }
  // dar şaft: açık tavandan doğrudan taş düşer (en fazla 2; yana kazarak kaçılır)
  if (n < 2) {
    let top = pr - 1;
    while (top > pr - 7 && tileAt(pc, top - 1) === T.AIR) top--;
    if (top <= pr - 3) for (let i = 0; i < 2 - n; i++) G.rocks.push({ x: pc * TILE + 8, y: top * TILE + 8 - i * 12, vy: 10, mat: 'stone' });
  }
  dust(p.x, p.y - 10, 6);
}

// yakın boşluklara gaz bulutu
function leak(p) {
  const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
  let n = 0;
  for (let tries = 0; tries < 60 && n < EVENTS.gaz.clouds; tries++) {
    const c = pc + Math.round((rnd() - 0.5) * 12), r = pr + Math.round((rnd() - 0.5) * 8);
    if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r <= GROUND_ROW || r >= ROWS - 2) continue;
    if (tileAt(c, r) !== T.AIR || Math.hypot(c - pc, r - pr) < 2.5) continue;
    spawnGas(c * TILE + 8, r * TILE + 8); n++;
  }
}
