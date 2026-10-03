// Kare çizimi: gökyüzü -> kaya -> nesneler -> ışık -> ışık yayanlar.
// v3: prosedürel ezilme/gerilme, saldırı öncesi hazırlık, ölüm animasyonu, kazma kademeleri, ortam süsleri, partner.
import { COLS, ROWS, TILE, GROUND_Y, GROUND_ROW, WORLD_W, WORLD_H, BASE_X, CENTER_COL, STRATUM_ROWS, stratumOfRow } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { P, RES_COL, ORE_RAMP, STRATA, MAT_RAMP, TIDE_COL } from '../data/palette.js';
import { tideLevel } from '../game/biomes.js';
import { PICK_TIERS, AFFIX, ELEVATOR, DEEP_ORES, MERCHANT, BUILDS } from '../data/balance.js';
import { PERKS, SOY } from '../data/relics.js';
import { WELL } from '../data/balance.js';
import { WELL_X } from '../game/well.js';
import { drawCritter } from './critters.js';
import { drawWonders, drawWondersGlow, drawWondersFx } from './wonders.js';
import { drawLiquids, drawLiquidGlow, liquidLights } from './liquids.js';
import { drawAmbient } from './ambient.js';
import { drawBalrog, drawBalrogGlow, drawBalrogDark, drawBalrogOmen, balrogLights } from './balrog.js';
import { drawSerpent, drawSerpentGlow, drawSerpentOmen, drawSerpentOmenGlow, drawSerpentDark } from './serpent.js';
import { hasBossArt, drawBossArt, drawBossArtGlow } from './bossart.js';
import { drawPoseidonFx } from './poseidonfx.js';
import { drawKitFx, drawKitMark } from './bossfx.js';
import { hasMob, drawMob, drawMobGlow } from './mob/actor.js';
import { drawDragon, drawDragonGlow, drawHoardDragon, drawHoardGlow, dragonLights } from './dragon.js';
import { drawHall, drawHallGlow, hallLights, hallCenter } from './hoard.js';
import { inHall } from '../game/dragon.js';
import { SHROOM, BOSS_MELEE } from '../data/balance.js';
import { CRITTERS } from '../data/critters.js';
import { on as onEvt } from '../core/events.js';
import { G, biomeOf } from '../game/state.js';
import { SPR, sprCanvas, sprEm, glowSprite, playerSprites, HELMETS } from './sprites.js';
import { drawTiles, flushDirty } from './tiles.js';
import { computeLight, lightWin, lightSourcesFor, glowTileSources } from '../world/light.js';
import { lampTiles, hasMod, hasRelic, resonance } from '../game/run.js';
import { bubbleFor } from '../ui/ui.js';
import { canary } from '../game/canary.js';
import { pred } from '../net/predict.js';
import { shoulderPos } from '../game/combat.js';
import { tileDamage01 } from '../world/map.js';
import { hexToRgb, hash2, damp, clamp, lerp } from '../core/util.js';

export const view = { vw: 240, vh: 480, scale: 3, cssW: 0, cssH: 0 };
let cv, ctx, lightCv, lightCtx, lightImg, skyCv = null, skyW = 0;
const SKY_TOP = -176;
let wheelA = 0, lastT = 0;

export function initRenderer(canvas) {
  cv = canvas; ctx = cv.getContext('2d', { alpha: false });
  lightCv = document.createElement('canvas');
  lightCtx = lightCv.getContext('2d');
}
export function resize(vw, vh) {
  view.vw = vw; view.vh = vh; cv.width = vw; cv.height = vh;
  ctx.imageSmoothingEnabled = false;
  skyCv = null;
}

// ---------- kamera ----------
export function updateCamera(dt, instant = false) {
  const p = G.player, cam = G.cam;
  cam.px = cam.x; cam.py = cam.y;
  const minY = -100, maxY = WORLD_H - view.vh;
  const px = pred.on ? pred.sx : p.x, py = pred.on ? pred.sy : p.y;
  let ty = py - view.vh * 0.42;
  if (p.dig && p.digDir[1] > 0) ty += 18;
  else if (p.moving && p.dy > 0.5) ty += 10;
  // Büyük boss gövdeleri ve kanatları oyuncunun üstünde kadraja sığsın.
  const bal = G.enemies.find(e => e.d.boss && (!e.dead || e.dieT > 0) && Math.abs(e.y - py) < 100);
  if (bal && Math.abs(bal.y - py) < 100) ty = Math.min(ty, Math.min(py, bal.y) - view.vh * 0.62);
  // hazine salonu: içerideyken salon kadraja oturur
  const HH = G.hoard;
  if (HH && (HH.st === 'sleep' || HH.st === 'wake') && inHall(HH, px, py)) ty = hallCenter(HH) - view.vh * 0.5;
  ty = clamp(ty, minY, maxY);
  const tx = clamp(px - view.vw / 2, 0, Math.max(0, WORLD_W - view.vw));
  const cx = WORLD_W <= view.vw ? (WORLD_W - view.vw) / 2 : tx;
  if (instant || cam.snap) { cam.x = cx; cam.y = ty; cam.px = cx; cam.py = ty; cam.snap = false; }
  else { cam.y = damp(cam.y, ty, 7, dt); cam.x = damp(cam.x, cx, 5, dt); }
  cam.trauma = Math.max(0, cam.trauma - dt * 1.8);
  cam.kx *= Math.exp(-dt * 22); cam.ky *= Math.exp(-dt * 22);
}

// ---------- gökyüzü ----------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function buildSky(w) {
  const h = GROUND_Y - SKY_TOP + 8;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const img = x.createImageData(w, h), d = img.data;
  const bands = [P.sky0, P.sky1, P.sky2, P.sky3, P.sky4, P.sky5].map(hexToRgb);
  const horizon = h - 18;
  for (let py = 0; py < h; py++) {
    const t = Math.pow(Math.min(1, py / horizon), 1.6) * (bands.length - 1);
    const b0 = Math.floor(t), f = t - b0;
    for (let px = 0; px < w; px++) {
      const th = BAYER[(py & 3) * 4 + (px & 3)] / 16;
      const col = bands[Math.min(bands.length - 1, b0 + (f > th ? 1 : 0))];
      const o = (py * w + px) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 26; i++) {
    const sx = Math.floor(hash2(i, 1, 9) * w), sy = Math.floor(hash2(i, 2, 9) * h * 0.4);
    x.fillStyle = hash2(i, 3, 9) < 0.3 ? '#fff4d8' : 'rgba(220,210,255,0.6)'; x.fillRect(sx, sy, 1, 1);
  }
  const sx = Math.floor(w * 0.72), sy = horizon + 2;
  x.fillStyle = '#f7b074'; x.beginPath(); x.arc(sx, sy, 17, 0, 7); x.fill();
  x.fillStyle = P.sun; x.beginPath(); x.arc(sx, sy, 13, 0, 7); x.fill();
  x.fillStyle = '#fff0c4'; x.beginPath(); x.arc(sx, sy, 9, 0, 7); x.fill();
  const hill = (col, base, amp, freq, seed) => {
    x.fillStyle = col;
    for (let px = 0; px < w; px++) {
      const n = Math.sin(px * freq + seed) * 0.5 + Math.sin(px * freq * 2.3 + seed * 2) * 0.3 + hash2(px >> 2, seed, 4) * 0.15;
      const top = Math.round(base - n * amp);
      x.fillRect(px, top, 1, h - top);
    }
  };
  hill(P.hill0, horizon - 4, 12, 0.035, 1.3);
  hill(P.hill1, horizon + 6, 8, 0.06, 4.1);
  x.fillStyle = P.hill1;
  for (let i = 0; i < 9; i++) {
    const tx = Math.floor(hash2(i, 7, 3) * w), th = 6 + Math.floor(hash2(i, 8, 3) * 6), by = horizon + 6 - 2;
    for (let k = 0; k < th; k++) { const hw = Math.floor((th - k) / 3); x.fillRect(tx - hw, by - k, hw * 2 + 1, 1); }
  }
  return c;
}
const CLOUDS = [[0.1, 10, 22], [0.5, 22, 30], [0.85, 4, 18]];
function drawSky(camX, camY) {
  if (camY > GROUND_Y) return;
  if (!skyCv || skyW !== view.vw) { skyCv = buildSky(view.vw); skyW = view.vw; }
  ctx.drawImage(skyCv, 0, SKY_TOP - camY);
  const t = G.time;
  ctx.fillStyle = 'rgba(200,120,140,0.35)';
  for (const [fx, y, w] of CLOUDS) {
    const x = Math.round(((fx * view.vw + t * 2.2) % (view.vw + w * 2)) - w);
    const yy = Math.round(SKY_TOP + y - camY);
    ctx.fillRect(x, yy, w, 2); ctx.fillRect(x + 3, yy - 2, w - 8, 2); ctx.fillRect(x + 7, yy - 3, 6, 1);
  }
  // tehdit tonu: alarmda gök kızarır, boss'ta morarır
  const W = G.wave;
  if (W.phase !== 'calm') {
    const boss = W.boss || G.enemies.some(e => e.d.boss && !e.dead);
    const pulse = W.phase === 'warn' ? 0.08 + Math.sin(t * 5) * 0.05 : 0.14;
    ctx.fillStyle = boss ? `rgba(90,20,120,${0.22 + pulse})` : `rgba(200,40,40,${pulse})`;
    ctx.fillRect(0, 0, view.vw, GROUND_Y - camY);
  }
}

// ---------- yardımcı pixel çizimleri ----------
function pline(x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = col;
  for (let i = 0; i < 64; i++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// kalın çizgi: ana çizgi + iki komşu ofset (kontur için)
function pline3(x0, y0, x1, y1, col) {
  pline(x0, y0, x1, y1, col); pline(x0 + 1, y0, x1 + 1, y1, col); pline(x0, y0 + 1, x1, y1 + 1, col); pline(x0 - 1, y0, x1 - 1, y1, col); pline(x0, y0 - 1, x1, y1 - 1, col);
}
function spr(s, x, y, flip = false, white = false) {
  ctx.drawImage(sprCanvas(s, flip, white), Math.round(x - s.w / 2), Math.round(y - s.h / 2));
}
// ayak noktasına sabit ölçekli sprite (ezilme/gerilme)
function sprScaled(s, cx, feetY, sx, sy, flip = false, white = false) {
  const w = Math.max(1, Math.round(s.w * sx)), h = Math.max(1, Math.round(s.h * sy));
  ctx.drawImage(sprCanvas(s, flip, white), Math.round(cx - w / 2), Math.round(feetY - h), w, h);
}
function sprE(s, x, y, flip = false) {
  const e = sprEm(s, flip); if (e) ctx.drawImage(e, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
}
function sprEScaled(s, cx, feetY, sx, sy, flip = false) {
  const e = sprEm(s, flip); if (!e) return;
  const w = Math.max(1, Math.round(s.w * sx)), h = Math.max(1, Math.round(s.h * sy));
  ctx.drawImage(e, Math.round(cx - w / 2), Math.round(feetY - h), w, h);
}
const gemGlowCache = new Map();
function gemGlow(gem) { let s = gemGlowCache.get(gem); if (!s) { s = 'rgba(' + hexToRgb(gem[2]).join(',') + ',0.24)'; gemGlowCache.set(gem, s); } return s; }
function glow(x, y, col, r, a = 1) {
  const g = glowSprite(col, r);
  ctx.globalAlpha = a;
  ctx.drawImage(g, Math.round(x - r), Math.round(y - r));
  ctx.globalAlpha = 1;
}
function shadow(x, y, w, a = 0.35) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 1); }

// ---------- ana çizim ----------
export function render(alpha, opts = {}) {
  flushDirty();
  const cam = G.cam;
  const dtR = Math.max(0, Math.min(0.1, G.time - lastT)); lastT = G.time; frameDt = dtR;
  const sh = cam.trauma * cam.trauma * 5;
  const camX = Math.round(lerp(cam.px, cam.x, alpha) + (Math.random() - 0.5) * sh + cam.kx);
  const camY = Math.round(lerp(cam.py, cam.y, alpha) + (Math.random() - 0.5) * sh + cam.ky);
  const vw = view.vw, vh = view.vh;
  const st = Math.max(0, stratumOfRow(Math.floor((camY + vh / 2) / TILE)));
  const SB = STRATA[biomeOf(st)], dk = SB.dark;
  ctx.fillStyle = `rgb(${dk[0]},${dk[1]},${dk[2]})`;
  ctx.fillRect(0, 0, vw, vh);

  drawSky(camX, camY);
  drawTiles(ctx, camX, camY, vw, vh);
  ctx.save();
  ctx.translate(-camX, -camY);

  const r0 = Math.max(0, Math.floor(camY / TILE) - 1), r1 = Math.min(ROWS - 1, Math.floor((camY + vh) / TILE) + 1);
  drawDecor(r0, r1);
  drawAmbient(ctx, r0, r1);
  drawSerpentOmen(ctx, r0, r1);
  drawHall(ctx);
  drawTileOverlays(r0, r1);
  drawTide(camY, vh);
  drawBeacons(r0, r1);
  drawStations(r0, r1);
  // maden kulesi makarası: biri derindeyken döner
  if (G.players.some(p => !p.dead && p.y > GROUND_Y + 32)) wheelA += dtR * 4;
  drawBase();
  drawShelf();
  drawWell();
  if (G.merchant) drawMerchant(G.merchant);
  for (const s of G.structures) drawStructure(s);
  for (const s of G.satchels) {
    if (s.echo) { ctx.globalAlpha = 0.55 + 0.35 * Math.sin(G.time * 4); ctx.strokeStyle = '#74efcf'; ctx.beginPath(); ctx.arc(s.x, s.y, 9 + Math.sin(G.time * 4) * 2, 0, Math.PI * 2); ctx.stroke(); }
    spr(SPR.satchel, s.x, s.y + Math.sin(G.time * 3) * 1.5);
    ctx.globalAlpha = 1;
  }
  for (const b of G.bombs) spr(SPR.dynamite, b.x + (b.t < 0.6 ? Math.round((Math.random() - 0.5) * 2) : 0), b.y - 4);
  // salyangoz salyası
  for (const s of G.slimes) {
    const x = Math.round(s.x), y = Math.round(s.y);
    ctx.globalAlpha = Math.min(1, s.t) * 0.6; ctx.fillStyle = '#5a8a30'; ctx.fillRect(x - 5, y, 11, 2); ctx.fillRect(x - 3, y - 1, 7, 1);
    ctx.fillStyle = '#c8f070'; ctx.fillRect(x - 2, y, 2, 1); ctx.fillRect(x + 2, y - 1, 1, 1);
  }
  ctx.globalAlpha = 1;
  for (const b of G.bells) drawBell(b);
  for (const k of G.rocks) drawRock(k);
  // enkaz ve toz (ışıktan etkilenir)
  for (const p of G.particles) {
    if (p.dead || p.type === 1 || p.type === 3) continue;
    if (p.type === 2) { ctx.globalAlpha = Math.max(0, p.life / p.t0) * 0.7; }
    ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    ctx.globalAlpha = 1;
  }
  drawLiquids(ctx, r0, r1);
  drawWonders(ctx, r0, r1);
  drawCritters(r0, r1);
  drawHoardDragon(ctx);
  for (const e of G.enemies) drawEnemy(e, alpha, camY, vh);
  if (!opts.hidePlayer) for (const p of G.players) drawPet(p, alpha);
  if (!opts.hidePlayer) for (const p of G.players) {
    if (pred.on && p === G.player) {
      // yerel madenci tahmin edilen konumda (lockstep gecikmesi gizlenir)
      const ox = p.px, oy = p.py, x0 = p.x, y0 = p.y;
      p.px = p.x = pred.sx; p.py = p.y = pred.sy;
      drawPlayer(p, alpha);
      p.px = ox; p.py = oy; p.x = x0; p.y = y0;
    } else drawPlayer(p, alpha);
  }
  drawWondersFx(ctx);
  if (!opts.hidePlayer && canary.on) drawCanary();
  ctx.restore();

  // ---- ışık ----
  const lr0 = Math.max(0, Math.floor(camY / TILE) - 2), lr1 = Math.min(ROWS - 1, Math.floor((camY + vh) / TILE) + 2);
  const src = lightSourcesFor(G, opts.hidePlayer ? 0 : lampTiles());
  glowTileSources(G, lr0, lr1, src);
  decorLights(lr0, lr1, src);
  liquidLights(lr0, lr1, src);
  balrogLights(src);
  dragonLights(src);
  hallLights(src);
  computeLight(lr0, lr1, src, opts.hidePlayer ? 0.42 : 0.26);
  drawLight(camX, camY, dk);
  // biyom renk tonu (hafif)
  const tint = SB.tint;
  if (tint && camY > GROUND_Y - 60) {
    // efsanevi 'nabız' biyomunda ton kalp gibi atar
    ctx.globalAlpha = SB.pulse ? 0.45 + 0.55 * Math.abs(Math.sin(G.time * 1.3)) : 1;
    ctx.fillStyle = tint; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
  }
  drawBalrogDark(ctx, camX, camY, vw, vh, alpha);
  drawSerpentDark(ctx, camX, camY, vw, vh, alpha);

  // ---- ışık yayanlar ----
  ctx.save();
  ctx.translate(-camX, -camY);
  drawEmissive(r0, r1, alpha, opts);
  ctx.restore();
  if (!opts.hidePlayer) { drawNestArrows(camX, camY); drawStationArrow(camX, camY); }
  if (!opts.hidePlayer) { drawNums(camX, camY); drawPartnerArrow(camX, camY, alpha); drawPings(camX, camY); drawBubbles(camX, camY, alpha); }
  // kör edici parlama sonrası: görüş bulanık (beyaz perde)
  const lp = G.player;
  if (!opts.hidePlayer && lp.blindT > 0) { ctx.fillStyle = `rgba(255,248,224,${Math.min(0.85, lp.blindT * 0.6)})`; ctx.fillRect(0, 0, vw, vh); }
}

// asansör şaftı: raylar + halat, biyom istasyonlarında platform ve fener
const SHAFT_X = CENTER_COL * TILE + 8;
const stationRowOf = s => GROUND_ROW + s * STRATUM_ROWS + 1;
// gelgit: biyomun altından yükselen su, dalgalı yüzey
function drawTide(camY, vh) {
  const L = tideLevel(); if (!L || L.f <= 0) return;
  const y0 = Math.max(L.y, camY), y1 = Math.min(L.bot, camY + vh);
  if (y1 <= y0) return;
  ctx.fillStyle = TIDE_COL; ctx.fillRect(0, Math.round(y0), COLS * TILE, Math.round(y1 - y0));
  if (L.y > camY - 4 && L.y < camY + vh) {
    ctx.fillStyle = 'rgba(180,230,255,0.7)';
    for (let x = 0; x < COLS * TILE; x += 2) ctx.fillRect(x, Math.round(L.y + Math.sin(G.time * 3 + x * 0.2) * 1.5), 2, 1);
  }
}
function drawStations(r0, r1) {
  const S = G.stations; if (!S.length) return;
  const x = SHAFT_X, last = stationRowOf(S[S.length - 1]);
  const top = Math.max(r0, GROUND_ROW) * TILE, bot = Math.min(r1 + 1, last + 1) * TILE;
  if (bot > top) {
    ctx.fillStyle = 'rgba(20,12,28,0.6)'; ctx.fillRect(x - 8, top, 1, bot - top); ctx.fillRect(x + 7, top, 1, bot - top);
    ctx.fillStyle = '#3a3230'; ctx.fillRect(x, top, 1, bot - top);
  }
  const blink = Math.floor(G.time * 2) % 2 === 0;
  for (const s of S) {
    const r = stationRowOf(s); if (r < r0 || r > r1) continue;
    const y = r * TILE + 8;
    glow(x, y, '#ffd24a', 14, 0.35);
    ctx.fillStyle = P.ink; ctx.fillRect(x - 8, y - 8, 2, 16); ctx.fillRect(x + 6, y - 8, 2, 16); ctx.fillRect(x - 8, y + 6, 16, 3);
    ctx.fillStyle = '#c9a54a'; ctx.fillRect(x - 6, y + 6, 12, 1);
    ctx.fillStyle = '#8a6a2a'; ctx.fillRect(x - 6, y + 7, 12, 1);
    ctx.fillStyle = '#5a6278'; ctx.fillRect(x - 7, y - 7, 1, 14); ctx.fillRect(x + 6, y - 7, 1, 14);
    ctx.fillStyle = P.ink; ctx.fillRect(x + 3, y - 6, 5, 5);
    ctx.fillStyle = blink ? '#ffe79a' : '#f2c14e'; ctx.fillRect(x + 4, y - 5, 3, 3);
  }
}
// en yakın istasyon ekran dışındaysa şaft hizasında altın kenar oku (kampa dönüş yolu)
function drawStationArrow(camX, camY) {
  const p = G.player; if (!G.stations.length || p.dead || p.ride || p.y < GROUND_Y) return;
  if (Math.abs(p.x - SHAFT_X) <= 8 && Math.floor(p.y / TILE) <= stationRowOf(G.stations[G.stations.length - 1]) + 1) return;
  let ty = GROUND_Y - 10;
  for (const s of G.stations) { const y = stationRowOf(s) * TILE + 8; if (Math.abs(y - p.y) < Math.abs(ty - p.y)) ty = y; }
  const vh = view.vh, sx = Math.round(SHAFT_X - camX);
  let sy = null, dir = 0;
  if (ty - camY > vh - 6) { sy = vh - 14; dir = 1; }
  else if (ty - camY < 44) { sy = 66; dir = -1; }
  if (sy === null) return;
  const bob = Math.floor(G.time * 4) % 2 === 0 ? 1 : 0;
  ctx.fillStyle = P.ink;
  for (let i = 0; i < 8; i++) ctx.fillRect(sx - 8 + i, sy + dir * (i - 4) + bob * dir, 17 - i * 2, 2);
  ctx.fillStyle = '#ffd24a';
  for (let i = 0; i < 6; i++) ctx.fillRect(sx - 5 + i, sy + dir * (i - 3) + bob * dir, 11 - i * 2, 1);
  // kabin simgesi
  const cy = sy - dir * 12;
  ctx.fillStyle = P.ink; ctx.fillRect(sx - 5, cy - 5, 10, 10);
  ctx.fillStyle = '#c9a54a'; ctx.fillRect(sx - 4, cy - 4, 8, 1); ctx.fillRect(sx - 4, cy + 3, 8, 1);
  ctx.fillStyle = 'rgba(255,231,154,0.35)'; ctx.fillRect(sx - 3, cy - 3, 6, 6);
}
// ekran dışındaki uyanık yuvalar için kenar okları
function drawNestArrows(camX, camY) {
  const vw = view.vw, vh = view.vh, t = G.time;
  const pulse = Math.floor(t * 4) % 2 === 0;
  // dalga kaynağı: uyarıda ve dalga boyunca turuncu-beyaz yanıp sönen büyük ok ya da halka
  const D = G.threat.dir;
  if (D && D.src && (D.phase === 'warn' || D.phase === 'wave')) {
    const sx = Math.round(clamp(D.src.x - camX, 10, vw - 10)), py = D.src.y - camY;
    const col = Math.floor(t * 8) % 2 ? '#ffffff' : '#ff8a3a';
    if (py > vh - 6 || py < 44) {
      const dir = py > vh - 6 ? 1 : -1, sy = dir > 0 ? vh - 16 : 58, bob = pulse ? 2 : 0;
      ctx.fillStyle = P.ink; for (let i = 0; i < 11; i++) ctx.fillRect(sx - 11 + i, sy + dir * (i - 5) + bob * dir, 23 - i * 2, 2);
      ctx.fillStyle = col; for (let i = 0; i < 9; i++) ctx.fillRect(sx - 8 + i, sy + dir * (i - 4) + bob * dir, 17 - i * 2, 1);
    } else { ctx.globalAlpha = 0.8; ringPx(sx, Math.round(py), 10 + (t * 20) % 14, col, 1); ctx.globalAlpha = 1; }
  }
  for (const n of G.nests) {
    if (!n.awake || G.buried[n.r * COLS + n.c]) continue;
    const sx = Math.round(clamp(n.x - camX, 8, vw - 8));
    let sy = null, dir = 0;
    if (n.y - camY > vh - 6) { sy = vh - 14; dir = 1; }
    else if (n.y - camY < 44) { sy = 52; dir = -1; }
    if (sy === null) continue;
    const bob = pulse ? 1 : 0;
    ctx.fillStyle = P.ink;
    for (let i = 0; i < 8; i++) ctx.fillRect(sx - 8 + i, sy + dir * (i - 4) + bob * dir, 17 - i * 2, 2);
    ctx.fillStyle = '#ff5a4a';
    for (let i = 0; i < 6; i++) ctx.fillRect(sx - 5 + i, sy + dir * (i - 3) + bob * dir, 11 - i * 2, 1);
  }
}
// hasar sayıları: 3×5 piksel rakamlar, yukarı süzülür; kritik iki kat büyük ve sarı
const DIGIT = { 0: 31599, 1: 11415, 2: 29671, 3: 29647, 4: 23497, 5: 31183, 6: 31215, 7: 29257, 8: 31727, 9: 31695, k: 23469 };
function drawNums(camX, camY) {
  for (const n of G.nums) {
    const v = Math.round(n.v), txt = v >= 1000 ? Math.round(v / 1000) + 'k' : String(Math.max(1, v)), s = n.crit ? 2 : 1;
    const k = n.t / 0.75, w = txt.length * 4 * s - s;
    const x0 = Math.round(n.x - camX - w / 2), y0 = Math.round(n.y - camY - 5 * s - (1 - (1 - k) * (1 - k)) * 14 - (n.crit && n.t < 0.08 ? 2 : 0));
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? (n.crit ? '#ffd24a' : '#fff4dc') : P.ink;
      for (let i = 0; i < txt.length; i++) {
        const g = DIGIT[txt[i]];
        for (let b = 0; b < 15; b++) if (g >> (14 - b) & 1) {
          const px = x0 + (i * 4 + b % 3) * s, py = y0 + Math.floor(b / 3) * s;
          if (pass) ctx.fillRect(px, py, s, s); else ctx.fillRect(px - 1, py - 1, s + 2, s + 2);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}
// partner işaretleri: elmas + kask rengi; ekran dışındaysa kenar oku
function drawPings(camX, camY) {
  const vw = view.vw, vh = view.vh, t = G.time;
  for (const q of G.pings) {
    const col = q.col || HELMETS[(G.players[q.pi] ? G.players[q.pi].helm : 0) % HELMETS.length].c;
    const sx = q.x - camX, sy = q.y - camY;
    const off = sx < 6 || sx > vw - 6 || sy < 44 || sy > vh - 12;
    if (!off) {
      const bob = Math.round(Math.sin(t * 5) * 2), s = q.born < 0.25 ? 1 + (0.25 - q.born) * 6 : 1;
      const x = Math.round(sx), y = Math.round(sy) - 10 + bob;
      ctx.fillStyle = P.ink;
      for (let i = -4; i <= 4; i++) ctx.fillRect(x - (4 - Math.abs(i)) - 1, y + i, (4 - Math.abs(i)) * 2 + 3, 1);
      ctx.fillStyle = col;
      for (let i = -3; i <= 3; i++) ctx.fillRect(x - (3 - Math.abs(i)), y + i, (3 - Math.abs(i)) * 2 + 1, 1);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 1, 1);
      ctx.fillStyle = P.ink; ctx.fillRect(x, y + 5, 1, 4);
      if (s > 1) { ctx.strokeStyle = col; ctx.globalAlpha = 0.6; ctx.strokeRect(x - 6 * s, y - 6 * s, 12 * s, 12 * s); ctx.globalAlpha = 1; }
      if (q.t < 1.5 && Math.floor(t * 8) % 2) continue;
    } else {
      const ax = Math.round(clamp(sx, 10, vw - 10)), dir = sy < 44 ? -1 : sy > vh - 12 ? 1 : 0;
      const ay = dir < 0 ? 58 : dir > 0 ? vh - 16 : Math.round(clamp(sy, 60, vh - 20));
      const bob = Math.floor(t * 3) % 2;
      ctx.fillStyle = P.ink;
      if (dir) for (let i = 0; i < 6; i++) ctx.fillRect(ax - 6 + i, ay + dir * (i - 3) + bob * dir, 13 - i * 2, 2);
      ctx.fillStyle = col;
      if (dir) for (let i = 0; i < 4; i++) ctx.fillRect(ax - 3 + i, ay + dir * (i - 2) + bob * dir, 7 - i * 2, 1);
      ctx.fillStyle = P.ink; ctx.fillRect(ax - 4, ay - dir * 9 - 4, 9, 9); ctx.fillStyle = col; ctx.fillRect(ax - 3, ay - dir * 9 - 3, 7, 7);
    }
  }
}
// hızlı mesaj baloncuğu (kozmetik, yerel zamanla)
function drawBubbles(camX, camY, alpha) {
  if (!G.mp) return;
  for (const p of G.players) {
    const text = bubbleFor(p.i); if (!text) continue;
    const x = Math.round(lerp(p.px, p.x, alpha) - camX), y = Math.round(lerp(p.py, p.y, alpha) - camY) - 22;
    ctx.font = '8px Tiny5, monospace'; const w = Math.ceil(ctx.measureText(text).width) + 6;
    const bx = Math.round(clamp(x - w / 2, 2, view.vw - w - 2));
    ctx.fillStyle = P.ink; ctx.fillRect(bx - 1, y - 9, w + 2, 12); ctx.fillRect(x - 1, y + 3, 3, 2);
    ctx.fillStyle = '#f5ecd8'; ctx.fillRect(bx, y - 8, w, 10);
    ctx.fillStyle = P.ink; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, bx + 3, y);
  }
}
// partner ekran dışındaysa kenarda turuncu ok + kask
function drawPartnerArrow(camX, camY, alpha) {
  if (!G.mp) return;
  const m = G.players[1 - G.localIdx];
  if (!m || m.dead) return;
  const vw = view.vw, vh = view.vh;
  const mx = lerp(m.px, m.x, alpha) - camX, my = lerp(m.py, m.y, alpha) - camY;
  if (my > 40 && my < vh - 20 && mx > 0 && mx < vw) return;
  const sx = Math.round(clamp(mx, 10, vw - 10));
  const dir = my < 40 ? -1 : 1;
  const sy = dir < 0 ? 58 : vh - 16;
  const bob = Math.floor(G.time * 3) % 2;
  ctx.fillStyle = P.ink;
  for (let i = 0; i < 6; i++) ctx.fillRect(sx - 6 + i, sy + dir * (i - 3) + bob * dir, 13 - i * 2, 2);
  ctx.fillStyle = '#e07a4a';
  for (let i = 0; i < 4; i++) ctx.fillRect(sx - 3 + i, sy + dir * (i - 2) + bob * dir, 7 - i * 2, 1);
  // küçük kask
  const hy = sy - dir * 9;
  ctx.fillStyle = P.ink; ctx.fillRect(sx - 3, hy - 3, 7, 6);
  ctx.fillStyle = '#5fe0b8'; ctx.fillRect(sx - 2, hy - 2, 5, 3);
  ctx.fillStyle = '#fff4c2'; ctx.fillRect(sx + 1, hy, 1, 1);
}

function drawLight(camX, camY, dk) {
  const rows = lightWin.rows;
  if (lightCv.width !== COLS || lightCv.height !== rows) {
    lightCv.width = COLS; lightCv.height = rows; lightImg = lightCtx.createImageData(COLS, rows);
  }
  const d = lightImg.data, L = lightWin.data;
  for (let i = 0; i < COLS * rows; i++) {
    const b = L[i];
    const a = b >= 0.999 ? 0 : Math.pow(1 - b, 1.15) * 250;
    const o = i * 4; d[o] = dk[0]; d[o + 1] = dk[1]; d[o + 2] = dk[2]; d[o + 3] = a;
  }
  lightCtx.putImageData(lightImg, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCv, 0, 0, COLS, rows, -camX, lightWin.r0 * TILE - camY, COLS * TILE, rows * TILE);
  ctx.imageSmoothingEnabled = false;
}

function lightAtTile(c, r) {
  const rr = r - lightWin.r0;
  if (rr < 0 || rr >= lightWin.rows || c < 0 || c >= COLS) return 0;
  return lightWin.data[rr * COLS + c];
}

// ---------- ortam süsleri: mağara tabanında mantar/kristal öbekleri (deterministik, kozmetik) ----------
// süs türü: biyoma göre; tabana oturanlar (mush, crys, bone, ember, shard) ve tavandan sarkanlar (root, icicle), boşlukta yüzenler (star)
const HANGING = { root: 1, icicle: 1, drip: 1 };
function decorAt(c, r) {
  if (r <= GROUND_ROW + 2 || c < 2 || c > COLS - 3) return 0;
  const i = r * COLS + c;
  if (G.map[i] !== T.AIR || !G.rev[i]) return 0;
  const kind = STRATA[biomeOf(stratumOfRow(r))].decor;
  const h = hash2(c, r, 77);
  if (kind === 'star' || kind === 'halo') return h < 0.05 ? kind : 0;
  if (HANGING[kind]) { if (r - 1 < 0 || !TD[G.map[(r - 1) * COLS + c]].solid) return 0; return h < 0.09 ? kind : 0; }
  if (r + 1 >= ROWS || !TD[G.map[(r + 1) * COLS + c]].solid) return 0;
  return h < 0.075 ? kind : 0;
}
function drawDecor(r0, r1) {
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const k = decorAt(c, r); if (!k) continue;
    const x = c * TILE + 3 + Math.floor(hash2(c, r, 78) * 9), y = r * TILE + 16;
    if (k === 'root') {
      // tavandan sarkan kök: kıvrımlı ip, ucunda tomurcuk
      const len = 5 + Math.floor(hash2(c, r, 79) * 6), ty = r * TILE;
      for (let i = 0; i < len; i++) { const ox = Math.round(Math.sin(i * 0.9 + c) * 1); ctx.fillStyle = P.ink; ctx.fillRect(x + ox - 1, ty + i, 3, 1); ctx.fillStyle = '#4a7a3c'; ctx.fillRect(x + ox, ty + i, 1, 1); }
      ctx.fillStyle = P.ink; ctx.fillRect(x - 1, ty + len, 3, 2); ctx.fillStyle = '#9ad860'; ctx.fillRect(x, ty + len, 1, 1);
    } else if (k === 'icicle') {
      const len = 4 + Math.floor(hash2(c, r, 79) * 5), ty = r * TILE;
      ctx.fillStyle = P.ink; ctx.fillRect(x - 2, ty, 5, 2); for (let i = 0; i < len; i++) ctx.fillRect(x - 1 + (i > len / 2 ? 0 : -0), ty + i, i > len * 0.6 ? 1 : 3, 1);
      ctx.fillStyle = '#5ab0cc'; ctx.fillRect(x - 1, ty, 3, 1); for (let i = 1; i < len - 1; i++) ctx.fillRect(x, ty + i, 1, 1);
      ctx.fillStyle = '#bff4ff'; ctx.fillRect(x - 1, ty + 1, 1, Math.max(1, len - 3));
    } else if (k === 'fern') {
      // eğrelti: ıslak yosunlu yapraklar, uçta damla
      const sw = Math.round(Math.sin(G.time * 1.2 + c * 3) * 0.7);
      ctx.fillStyle = '#2a6a3a'; ctx.fillRect(x, y - 6, 1, 6);
      ctx.fillStyle = '#4ab060'; ctx.fillRect(x - 3 + sw, y - 5, 3, 1); ctx.fillRect(x + 1 + sw, y - 4, 3, 1); ctx.fillRect(x - 3, y - 3, 3, 1); ctx.fillRect(x + 1, y - 2, 3, 1);
      ctx.fillStyle = '#8ae08a'; ctx.fillRect(x - 3 + sw, y - 5, 1, 1); ctx.fillRect(x + 3, y - 2, 1, 1);
      if (Math.floor(G.time * 1.5 + c) % 4 === 0) { ctx.fillStyle = '#bfeaff'; ctx.fillRect(x + 3 + sw, y - 3, 1, 1); }
    } else if (k === 'bone') {
      // kaburga/kafatası: küçük kemik yığını
      ctx.fillStyle = P.ink; ctx.fillRect(x - 3, y - 4, 7, 4); ctx.fillRect(x + 4, y - 2, 3, 2);
      ctx.fillStyle = '#e0d0b0'; ctx.fillRect(x - 2, y - 3, 5, 2); ctx.fillRect(x + 5, y - 2, 1, 1);
      ctx.fillStyle = P.ink; ctx.fillRect(x - 1, y - 3, 1, 1); ctx.fillRect(x + 1, y - 3, 1, 1);
    } else if (k === 'ember') {
      // kor yığını: koyu taş üstünde turuncu közler
      ctx.fillStyle = P.ink; ctx.fillRect(x - 3, y - 3, 7, 3);
      ctx.fillStyle = '#3a1410'; ctx.fillRect(x - 2, y - 2, 5, 2);
      ctx.fillStyle = '#ff9a4a'; ctx.fillRect(x - 1, y - 2, 1, 1); ctx.fillRect(x + 1, y - 2, 1, 1);
    } else if (k === 'shard') {
      // obsidyen kıymıkları: keskin siyah üçgenler, mor kenar
      ctx.fillStyle = P.ink; ctx.fillRect(x - 2, y - 5, 2, 5); ctx.fillRect(x + 1, y - 7, 2, 7);
      ctx.fillStyle = '#2c2440'; ctx.fillRect(x - 2, y - 4, 1, 4); ctx.fillRect(x + 1, y - 6, 1, 6);
      ctx.fillStyle = '#8a7ab8'; ctx.fillRect(x + 1, y - 6, 1, 1); ctx.fillRect(x - 2, y - 4, 1, 1);
    } else if (k === 'star') {
      // boşlukta yüzen ışık zerresi (emissive katmanda parlar)
      const oy = Math.round(Math.sin(G.time * 1.5 + c * 2 + r) * 2);
      ctx.fillStyle = '#3a3080'; ctx.fillRect(x, y - 8 + oy, 1, 1);
    } else if (k === 'drip') {
      // cıva damlası: tavandan sarkan gümüş boncuk
      const ty = r * TILE, len = 2 + Math.floor(hash2(c, r, 79) * 3);
      ctx.fillStyle = P.ink; ctx.fillRect(x - 1, ty, 3, len + 3); ctx.fillStyle = '#7a8898'; ctx.fillRect(x, ty, 1, len);
      ctx.fillStyle = '#c8d8e4'; ctx.fillRect(x - 1, ty + len, 3, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, ty + len, 1, 1);
    } else if (k === 'arc') {
      // statik kıvılcım: yerden çatallanan mavi ark (titrer)
      ctx.fillStyle = P.ink; ctx.fillRect(x - 2, y - 1, 5, 1);
      if (Math.floor(G.time * 9 + c) % 3 === 0) { ctx.fillStyle = '#9ad8ff'; ctx.fillRect(x, y - 4, 1, 3); ctx.fillRect(x + 1, y - 6, 1, 2); ctx.fillRect(x - 1, y - 5, 1, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y - 7, 1, 1); }
    } else if (k === 'coin') {
      // altın yığını
      ctx.fillStyle = P.ink; ctx.fillRect(x - 3, y - 3, 7, 3); ctx.fillRect(x - 1, y - 4, 3, 1);
      ctx.fillStyle = '#b88a2a'; ctx.fillRect(x - 2, y - 2, 5, 1); ctx.fillStyle = '#ffd870'; ctx.fillRect(x - 1, y - 3, 3, 1); ctx.fillRect(x - 2, y - 2, 1, 1);
      ctx.fillStyle = '#fff4c0'; ctx.fillRect(x, y - 3, 1, 1);
    } else if (k === 'shroom') {
      // dev mantar: uzun sap, geniş parlayan kapak
      ctx.fillStyle = P.ink; ctx.fillRect(x - 1, y - 6, 3, 6); ctx.fillRect(x - 4, y - 9, 9, 4);
      ctx.fillStyle = '#c8b8a0'; ctx.fillRect(x, y - 6, 1, 5);
      ctx.fillStyle = '#6a3e6a'; ctx.fillRect(x - 3, y - 8, 7, 2); ctx.fillStyle = '#a8f070'; ctx.fillRect(x - 3, y - 8, 7, 1); ctx.fillRect(x - 1, y - 7, 1, 1); ctx.fillRect(x + 2, y - 7, 1, 1);
    } else if (k === 'pane') {
      // cam dikenleri: saydam mavi levhalar, beyaz kenar
      ctx.fillStyle = P.ink; ctx.fillRect(x - 2, y - 5, 2, 5); ctx.fillRect(x + 1, y - 8, 2, 8);
      ctx.fillStyle = '#5a98a8'; ctx.fillRect(x - 2, y - 4, 1, 4); ctx.fillRect(x + 1, y - 7, 1, 7);
      ctx.fillStyle = '#d8f8ff'; ctx.fillRect(x + 1, y - 7, 1, 2); ctx.fillRect(x - 2, y - 4, 1, 1);
    } else if (k === 'vein') {
      // nabız damarı: yerde atan kırmızı damar
      const on = Math.sin(G.time * 2.4 + c) > 0.3;
      ctx.fillStyle = P.ink; ctx.fillRect(x - 4, y - 2, 9, 2);
      ctx.fillStyle = on ? '#ff5a6a' : '#8a1a2a'; ctx.fillRect(x - 3, y - 2, 2, 1); ctx.fillRect(x, y - 1, 2, 1); ctx.fillRect(x + 3, y - 2, 1, 1);
    } else if (k === 'gear') {
      // kırık dişli: bronz çark
      ctx.fillStyle = P.ink; ctx.fillRect(x - 3, y - 6, 7, 6); ctx.fillRect(x - 4, y - 4, 9, 2); ctx.fillRect(x - 1, y - 7, 3, 1);
      ctx.fillStyle = '#7a6030'; ctx.fillRect(x - 2, y - 5, 5, 4); ctx.fillStyle = '#c8a860'; ctx.fillRect(x - 2, y - 5, 5, 1); ctx.fillRect(x - 3, y - 4, 1, 1); ctx.fillRect(x + 3, y - 4, 1, 1); ctx.fillRect(x, y - 6, 1, 1);
      ctx.fillStyle = P.ink; ctx.fillRect(x, y - 3, 1, 1);
    } else if (k === 'pool') {
      // kan birikintisi: yerde koyu kırmızı leke, ara sıra parlayan yansıma
      ctx.fillStyle = P.ink; ctx.fillRect(x - 4, y - 1, 9, 1);
      ctx.fillStyle = '#7a141c'; ctx.fillRect(x - 3, y - 1, 7, 1); ctx.fillStyle = '#c02a30'; ctx.fillRect(x - 1, y - 1, 2, 1);
      if (Math.floor(G.time * 2 + c) % 4 === 0) { ctx.fillStyle = '#ff9aa0'; ctx.fillRect(x + 1, y - 1, 1, 1); }
    } else if (k === 'ring') {
      // yankı halkası: yerden genişleyip solan daire
      const k2 = (G.time * 0.6 + hash2(c, r, 80)) % 1;
      ctx.globalAlpha = 0.5 * (1 - k2); ctx.strokeStyle = '#8a86b0'; ctx.beginPath(); ctx.arc(x, y - 4, 2 + k2 * 8, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (k === 'halo') {
      // yaratılış zerresi: yavaşça süzülen altın-beyaz nokta
      const oy = Math.round(Math.sin(G.time * 1.2 + c * 2 + r) * 3);
      ctx.fillStyle = '#fff4e8'; ctx.fillRect(x, y - 8 + oy, 1, 1); ctx.fillStyle = '#ffd870'; ctx.fillRect(x + 1, y - 8 + oy, 1, 1);
    } else if (k === 'amber') {
      // kehribar damlası: içinde donmuş böcek
      ctx.fillStyle = P.ink; ctx.fillRect(x - 3, y - 6, 7, 6); ctx.fillRect(x - 2, y - 7, 5, 1);
      ctx.fillStyle = '#b0601a'; ctx.fillRect(x - 2, y - 5, 5, 4); ctx.fillStyle = '#ffb040'; ctx.fillRect(x - 2, y - 5, 2, 2);
      ctx.fillStyle = P.ink; ctx.fillRect(x + 1, y - 3, 1, 1);
    } else if (k === 'lumen') {
      // ışık mantarı: ince sap, parlayan mavi kapak
      ctx.fillStyle = P.ink; ctx.fillRect(x - 1, y - 5, 3, 5); ctx.fillRect(x - 3, y - 8, 7, 3);
      ctx.fillStyle = '#5a8a9a'; ctx.fillRect(x, y - 5, 1, 4);
      ctx.fillStyle = Math.floor(G.time * 2 + c) % 3 ? '#2a8ab0' : '#8af0ff'; ctx.fillRect(x - 2, y - 7, 5, 1);
    } else if (k === 'mush') {
      // mantar: sap + kapak, ikinci küçük mantar
      ctx.fillStyle = P.ink; ctx.fillRect(x - 2, y - 5, 5, 4); ctx.fillRect(x, y - 2, 1, 2);
      ctx.fillStyle = '#4a8ad0'; ctx.fillRect(x - 1, y - 4, 3, 2);
      ctx.fillStyle = '#9ad8ff'; ctx.fillRect(x - 1, y - 4, 2, 1);
      ctx.fillStyle = '#c8b8a0'; ctx.fillRect(x, y - 2, 1, 2);
      ctx.fillStyle = P.ink; ctx.fillRect(x + 3, y - 3, 3, 2); ctx.fillRect(x + 4, y - 1, 1, 1);
      ctx.fillStyle = '#6ab0e8'; ctx.fillRect(x + 4, y - 3, 1, 1);
    } else if (k === 'crys') {
      // kristal küme: 3 sivri parça
      ctx.fillStyle = P.ink; ctx.fillRect(x - 2, y - 4, 2, 4); ctx.fillRect(x, y - 6, 2, 6); ctx.fillRect(x + 2, y - 3, 2, 3);
      ctx.fillStyle = '#9030c8'; ctx.fillRect(x - 2, y - 3, 1, 3); ctx.fillRect(x, y - 5, 1, 5); ctx.fillRect(x + 2, y - 2, 1, 2);
      ctx.fillStyle = '#e070ff'; ctx.fillRect(x, y - 5, 1, 2); ctx.fillRect(x - 2, y - 3, 1, 1);
    }
  }
}
const DECOR_LIGHT = { mush: 1.7, crys: 2.2, root: 1.2, icicle: 1.3, ember: 2.6, shard: 0.9, star: 1.8, bone: 0,
  drip: 1, arc: 1.6, coin: 1.8, shroom: 2.4, pane: 1.4, vein: 1.5, gear: 0.6, pool: 0.8, ring: 0.5, halo: 2.2, amber: 1.6, lumen: 3 };
function decorLights(r0, r1, out) {
  for (let r = Math.max(GROUND_ROW, r0); r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const k = decorAt(c, r); if (!k || !DECOR_LIGHT[k]) continue;
    out.push({ x: c * TILE + 8, y: r * TILE + (HANGING[k] ? 4 : 12), s: DECOR_LIGHT[k] });
  }
}

function drawTileOverlays(r0, r1) {
  // Toprak rezonansı: gömülü cevher ara ara pırıldar
  if (resonance('toprak') && G.buried) for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (!G.buried[i] || !TD[G.map[i]].ore || Math.floor(G.time * 2 + hash2(c, r, 5) * 9) % 5) continue;
    ctx.fillStyle = RES_COL[TD[G.map[i]].ore] || '#fff0a0';
    const x = c * TILE + 4 + Math.floor(hash2(c, r, 2) * 8), y = r * TILE + 4 + Math.floor(hash2(r, c, 3) * 8);
    ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 0.5; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.globalAlpha = 1;
  }
  // kazılan blok titremesi
  let hc = -1, hr = -1, hj = 0;
  for (const p of G.players) if (p.hitTile && p.hitTile.t > 0) { hc = p.hitTile.c; hr = p.hitTile.r; hj = (Math.floor(G.time * 40) % 2) ? 1 : -1; }
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const t = G.map[r * COLS + c];
    const x = c * TILE, y = r * TILE;
    if (t === T.BARRICADE) drawBarricade(x, y, c, r);
    else if (t === T.LOOSE) {
      const f = G.falls.find(q => q.c === c && q.r === r);
      const j = f ? ((Math.floor(G.time * 30) % 2) ? 1 : -1) : 0;
      if (f) { ctx.fillStyle = 'rgba(10,6,14,0.5)'; ctx.fillRect(x, y + 15, 16, 1); }
      ctx.drawImage(SPR.loose, x + j, y);
    } else if (t === T.GAS) {
      ctx.fillStyle = '#5a7a30';
      for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + Math.floor(hash2(c, r, 40 + i) * 12), y + 2 + Math.floor(hash2(c, r, 60 + i) * 12), 1, 1);
    }
    else if (TD[t].chest) {
      // Taklitçi ara ara kıpırdar (dikkatli bakan fark eder)
      const k = TD[t].chest, twitch = k === 'mimic' && Math.floor(G.time * 2 + c * 3) % 9 === 0 ? 1 : 0;
      spr(SPR.chests[k], x + 8 + twitch, y + 9);
    }
    else if (t === T.NEST && !G.buried[r * COLS + c]) { const n = G.nests.find(q => q.c === c && q.r === r); const aw = n && n.awake; const fr = aw ? Math.floor(G.time * 6) % 2 : Math.floor(G.time * 1.5) % 2; const j = n && n.burst > 0 ? ((Math.floor(G.time * 30) % 2) ? 1 : -1) : 0; ctx.drawImage(SPR.nest[fr].cv, x + j, y); }
    else if (t === T.HEART) spr(SPR.heart, x + 8, y + 8 + Math.round(Math.sin(G.time * 2) * 1));
    else if (t === T.RELIC) spr(SPR.relic, x + 8, y + 8 + Math.round(Math.sin(G.time * 1.6) * 1));
    else if (t === T.ARKEN) spr(SPR.arken[Math.floor(G.time * 3) % 2], x + 8, y + 8);
    if (TD[t].solid && G.dmg[r * COLS + c] > 0) {
      const f = tileDamage01(c, r);
      const j = (c === hc && r === hr) ? hj : 0;
      if (f > 0) ctx.drawImage(SPR.cracks[Math.min(4, Math.floor(f * 5))], x + j, y);
    }
  }
}

function drawBarricade(x, y, c, r) {
  const hp = G.bhp[r * COLS + c] ?? 70, f = hp / 70;
  ctx.fillStyle = P.ink; ctx.fillRect(x + 1, y, 3, 16); ctx.fillRect(x + 12, y, 3, 16);
  ctx.fillStyle = P.metalD; ctx.fillRect(x + 2, y, 1, 16); ctx.fillRect(x + 13, y, 1, 16);
  for (let i = 0; i < 3; i++) {
    const py = y + 1 + i * 5;
    ctx.fillStyle = P.ink; ctx.fillRect(x, py, 16, 4);
    ctx.fillStyle = f < 0.4 && i === 1 ? '#5a3a20' : P.wood; ctx.fillRect(x + 1, py + 1, 14, 2);
    ctx.fillStyle = P.woodL; ctx.fillRect(x + 1, py + 1, 14, 1);
    ctx.fillStyle = P.metal; ctx.fillRect(x + 2, py + 1, 1, 1); ctx.fillRect(x + 13, py + 1, 1, 1);
  }
  if (f < 0.6) { ctx.fillStyle = P.ink; ctx.fillRect(x + 6, y + 6, 1, 3); ctx.fillRect(x + 9, y + 11, 1, 2); }
}

// fener: temizlenen biyomun üst sınırında, merkez şaftın yanında direk + ışık
function drawBeacons(r0, r1) {
  for (const s of G.beacons) {
    const r = GROUND_ROW + s * STRATUM_ROWS;
    if (r < r0 - 2 || r > r1 + 2) continue;
    const x = BASE_X + 14, y = r * TILE + 8;
    ctx.fillStyle = P.ink; ctx.fillRect(x - 2, y - 10, 5, 14);
    ctx.fillStyle = '#5a6278'; ctx.fillRect(x - 1, y - 9, 3, 12);
    ctx.fillStyle = P.ink; ctx.fillRect(x - 3, y - 13, 7, 4);
    ctx.fillStyle = Math.floor(G.time * 3) % 2 ? '#ffe79a' : '#f2c14e'; ctx.fillRect(x - 2, y - 12, 5, 2);
  }
}

function drawBase() {
  const b = G.base, s = SPR.base;
  const shake = b.hurtT > 0 ? Math.round((Math.random() - 0.5) * 2) : 0;
  const bx = Math.round(b.x - s.w / 2) + shake, by = GROUND_Y - s.h;
  ctx.drawImage(s.cv, bx, by);
  // makara telleri (döner)
  const wx = bx + 28, wy = by + 8;
  for (let k = 0; k < 2; k++) {
    const a = wheelA + k * Math.PI / 2;
    pline(wx - Math.cos(a) * 4, wy - Math.sin(a) * 4, wx + Math.cos(a) * 4, wy + Math.sin(a) * 4, '#5a6278');
  }
  ctx.fillStyle = P.ink; ctx.fillRect(wx - 1, wy - 1, 3, 3); ctx.fillStyle = '#dfe6f0'; ctx.fillRect(wx, wy, 1, 1);
  // dalgalanan bayrak
  const fx = bx + 9, fy = by + 10;
  for (let i = 0; i < 8; i++) {
    const off = Math.round(Math.sin(G.time * 7 + i * 0.9) * (i / 7) * 1.2);
    ctx.fillStyle = P.ink; ctx.fillRect(fx + i, fy - 1 + off, 1, 7);
    ctx.fillStyle = i > 5 ? '#e0b040' : '#f2c14e'; ctx.fillRect(fx + i, fy + off, 1, 5);
    ctx.fillStyle = '#a8701e'; ctx.fillRect(fx + i, fy + 4 + off, 1, 1);
    ctx.fillStyle = '#ffe79a'; ctx.fillRect(fx + i, fy + off, 1, 1);
  }
}

// kamp rafı: bu seferde bulunan derin cevherler (üst raf) ve kalıntılar (alt raf, soy renginde)
const SHELF_X = BASE_X + 84;
function drawShelf() {
  const x = SHELF_X - 13, y = GROUND_Y - 22;
  ctx.fillStyle = P.ink; ctx.fillRect(x - 1, y - 1, 28, 23);
  ctx.fillStyle = '#4a2e1c'; ctx.fillRect(x, y, 26, 22);
  ctx.fillStyle = P.wood;
  for (const py of [y + 9, y + 19]) { ctx.fillStyle = P.ink; ctx.fillRect(x - 1, py, 28, 3); ctx.fillStyle = P.woodL; ctx.fillRect(x, py, 26, 1); }
  let i = 0;
  for (const k of DEEP_ORES) {
    if (!(G.collected[k] > 0)) continue;
    const cx = x + 2 + i * 3.4, c = RES_COL[k];
    ctx.fillStyle = P.ink; ctx.fillRect(Math.round(cx) - 1, y + 3, 4, 6);
    ctx.fillStyle = c; ctx.fillRect(Math.round(cx), y + 4, 2, 5);
    ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(cx), y + 4, 1, 1);
    i++;
  }
  G.perks.slice(-8).forEach((k, j) => {
    const d = PERKS[k], c = d.curse ? '#c040ff' : d.leg ? '#ffb050' : d.duo ? '#ffd24a' : d.soy ? SOY[d.soy].col : '#fff';
    const cx = x + 2 + j * 3, cy = y + 14 + (j % 2);
    ctx.fillStyle = P.ink; ctx.fillRect(cx - 1, cy - 1, 4, 5);
    ctx.fillStyle = c; ctx.fillRect(cx, cy, 2, 3);
  });
  if (G.perks.length || i) glow(SHELF_X, y + 10, 'rgba(255,220,140,0.35)', 16, 0.25 + 0.1 * Math.sin(G.time * 2));
}
// garip yaratıklar: açığa çıkmış oyukta uyur (nefes alır, z harfleri); bulununca kalpler saçar
const petFx = [];
onEvt('critter', d => petFx.push({ x: d.x, y: d.y, t0: G.time }));
function drawCritters(r0, r1) {
  const t = G.time;
  for (const cr of G.critters || []) {
    if (cr.found || cr.r < r0 - 1 || cr.r > r1 + 1 || !G.rev[cr.r * COLS + cr.c]) continue;
    const x = cr.c * TILE + 8, feet = cr.r * TILE + 16;
    shadow(x, feet - 1, 9, 0.25);
    drawCritter(ctx, cr.k, x, feet, { closed: true, t, seed: cr.c + cr.r, turn: (cr.c + cr.r) % 2 ? 1 : -1 });
    const z = (t * 0.6 + cr.r * 0.37) % 1;
    ctx.globalAlpha = 1 - z; ctx.fillStyle = '#dff6ff';
    const zx = Math.round(x + 5 + z * 4), zy = Math.round(feet - 16 - z * 8);
    ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1);
    ctx.globalAlpha = 1;
  }
  for (let i = petFx.length - 1; i >= 0; i--) {
    const f = petFx[i], a = t - f.t0;
    if (a > 1.4 || a < 0) { petFx.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, (1.4 - a) * 2);
    for (let k = 0; k < 6; k++) {
      const ang = k * 1.047 + a, rr = 6 + a * 18, hx = Math.round(f.x + Math.cos(ang) * rr), hy = Math.round(f.y - 4 + Math.sin(ang) * rr * 0.6 - a * 10);
      ctx.fillStyle = k % 2 ? '#f08aa0' : '#ffd0dc';
      ctx.fillRect(hx, hy, 1, 1); ctx.fillRect(hx + 2, hy, 1, 1); ctx.fillRect(hx, hy + 1, 3, 1); ctx.fillRect(hx + 1, hy + 2, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
// yoldaş: sahibinin arkasından yaylı bir takiple yürür (adımlar gidilen yola bağlı), durunca oturup nefes alır,
// arada zıplar; yön değişimi kısa bir kararlılıktan sonra olur: küçük bir zıplamayla öbür yana döner
const petPos = new Map();
function drawPet(p, alpha) {
  if (!p.pet || !CRITTERS[p.pet]) return;
  const px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);
  let q = petPos.get(p.i);
  const tx = p.ride ? px + 5 : px - p.face * 12, ty = py + 1;
  if (!q || q.k !== p.pet || Math.hypot(q.x - tx, q.y - ty) > 90) { q = { k: p.pet, x: tx, y: ty, vx: 0, vy: 0, face: p.face, ph: 0, t: G.time, hold: 0 }; petPos.set(p.i, q); }
  const dt = clamp(G.time - q.t, 0, 0.05); q.t = G.time;
  // asansörde kabinin içinde sahibinin yanında oturur (yaylı takip kabinin hızına yetişemez)
  if (p.ride && !(p.ride.board > 0)) { q.x = tx; q.y = ty; q.vx = q.vy = 0; }
  // yay: hedefe hızlanır, yaklaşınca yavaşlar
  q.vx += ((tx - q.x) * 24 - q.vx * 8.5) * dt; q.vy += ((ty - q.y) * 40 - q.vy * 12) * dt;
  const v = Math.hypot(q.vx, q.vy); if (v > 150) { q.vx *= 150 / v; q.vy *= 150 / v; }
  q.x += q.vx * dt; q.y += q.vy * dt;
  const sp = Math.abs(q.vx) + Math.abs(q.vy) * 0.4;
  // yön: yürürken gittiği yana, dururken sahibinin baktığı yana; kısa bir bekleme sonra döner
  const want = Math.abs(q.vx) > 14 ? Math.sign(q.vx) : Math.abs(q.vx) < 4 ? p.face : q.face;
  if (want !== q.face) { q.hold += dt; if (q.hold > (sp > 14 ? 0.1 : 0.35)) { q.face = want; q.hold = 0; q.flipT = G.time; } } else q.hold = 0;
  q.ph += Math.min(sp, 120) * dt * 0.32;
  const walk = clamp(sp / 26, 0, 1);
  // dururken ara sıra küçük bir zıplama
  const it = (G.time + p.i * 1.3) % 5, fk = clamp((G.time - (q.flipT ?? -9)) / 0.26, 0, 1), hop = (walk < 0.2 && it < 0.32 ? Math.sin(it / 0.32 * Math.PI) * 3 : 0) + Math.sin(fk * Math.PI) * 4;
  shadow(q.x, q.y + 6, Math.round(9 - hop), 0.28);
  drawCritter(ctx, p.pet, q.x, q.y + 7 - hop, { turn: q.face, ph: q.ph, walk, t: G.time, seed: p.i * 3.1, squash: fk < 1 ? Math.cos(fk * Math.PI) * 0.12 : 0 });
}

// şans kuyusu: taş bilezik, kiremit çatı, sallanan kova, kenarda kurbağa.
// Sikke atılınca dönerek uçar, suya düşer (halka + damlalar), kurbağa zıplar; ödül baloncukla kuyudan yükselir.
let wishFx = null, frogHop = -9;
onEvt('wishDone', d => { wishFx = { t0: G.time, got: d.got }; frogHop = G.time; });
onEvt('wishThrow', () => { frogHop = -9; });
const coinPx = (x, y, w) => { ctx.fillStyle = P.ink; ctx.fillRect(x - w - 1, y - 3, w * 2 + 2, 6); ctx.fillStyle = '#e0a020'; ctx.fillRect(x - w, y - 2, w * 2, 4); ctx.fillStyle = '#ffe79a'; ctx.fillRect(x - w, y - 2, Math.max(1, w), 1); };
function rewardPx(g, x, y) {
  const R = (c, px, py, w, h) => { ctx.fillStyle = c; ctx.fillRect(px, py, w, h); };
  if (g.k === 'gold') { coinPx(x, y, 3); return; }
  if (g.k === 'res') { const c = RES_COL[g.id] || '#fff'; R(P.ink, x - 3, y - 4, 7, 9); R(c, x - 2, y - 3, 5, 7); R('#fff', x - 1, y - 2, 1, 2); return; }
  if (g.k === 'heal') { R(P.ink, x - 4, y - 3, 9, 6); R(P.ink, x - 3, y + 3, 7, 1); R(P.ink, x - 1, y + 4, 3, 1); R('#ec4a4a', x - 3, y - 2, 3, 4); R('#ec4a4a', x + 1, y - 2, 3, 4); R('#ec4a4a', x - 2, y + 2, 5, 1); R('#ffb0b0', x - 2, y - 1, 1, 1); return; }
  if (g.k === 'chest') { R(P.ink, x - 5, y - 4, 11, 9); R('#a8701e', x - 4, y - 3, 9, 7); R('#ffd24a', x - 4, y - 1, 9, 1); R('#ffd24a', x, y - 1, 1, 3); return; }
  R(P.ink, x - 4, y - 4, 9, 9); R('#8a9ab8', x - 3, y - 3, 7, 7); R('#dfe6f0', x - 3, y - 3, 7, 1); R('#5ae08a', x - 1, y - 1, 3, 3);
}
function drawWell() {
  const R = (c, px, py, w, h) => { ctx.fillStyle = c; ctx.fillRect(px, py, w, h); };
  const x = WELL_X, y = GROUND_Y, t = G.time, W = G.wish;
  shadow(x, y, 20, 0.35);
  // su ağzı + parıltı
  R(P.ink, x - 9, y - 12, 18, 3); R('#1a3a6a', x - 8, y - 11, 16, 2);
  const sh = Math.floor(t * 2) % 8; R('#6ab0f0', x - 6 + sh, y - 11, 2, 1);
  // taş bilezik
  R(P.ink, x - 9, y - 10, 18, 10);
  const stones = [[-8, -9, 5], [-3, -9, 6], [3, -9, 5], [-8, -5, 3], [-5, -5, 6], [1, -5, 4], [5, -5, 3], [-8, -2, 5], [-3, -2, 5], [2, -2, 6]];
  for (const [sx, sy, w] of stones) { R('#8a8a9a', x + sx, y + sy, w - 1, 3); R('#aaaabb', x + sx, y + sy, w - 1, 1); R('#5a5a6a', x + sx, y + sy + 2, w - 1, 1); }
  R('#4a8a4a', x - 9, y - 1, 3, 1); R('#5aaa5a', x + 6, y - 2, 2, 2);
  // direkler + çatı
  R(P.ink, x - 9, y - 27, 3, 17); R(P.ink, x + 6, y - 27, 3, 17);
  R('#7a4e2a', x - 8, y - 26, 1, 15); R('#7a4e2a', x + 7, y - 26, 1, 15);
  for (let i = 0; i < 5; i++) { const w = 24 - i * 4; R(P.ink, x - w / 2 - 1, y - 27 - i * 2, w + 2, 3); R(i % 2 ? '#d05a4a' : '#b04038', x - w / 2, y - 27 - i * 2, w, 2); R('#e8806a', x - w / 2, y - 27 - i * 2, w, 1); }
  // çıkrık + ip + kova (hafif sallanır)
  R(P.ink, x - 7, y - 22, 14, 2); R('#9a6636', x - 6, y - 22, 12, 1);
  R(P.ink, x + 7, y - 23, 3, 3); R('#c9a54a', x + 8, y - 22, 1, 1);
  const bob = Math.round(Math.sin(t * 1.6) * 1), by = y - 17 + bob;
  R('#c8b898', x, y - 21, 1, by - (y - 21));
  R(P.ink, x - 3, by, 7, 5); R('#8a5e34', x - 2, by + 1, 5, 3); R('#b0b8c8', x - 2, by + 2, 5, 1);
  // kurbağa: kenarda oturur, göz kırpar; sikke düşünce ve ödülde zıplar
  const k = W ? 1 - W.t / WELL.delay : 1;
  const hopA = W && k > 0.55 ? (k - 0.55) / 0.45 : Math.max(0, 1 - (t - frogHop) / 0.5);
  const hop = Math.round(Math.sin(Math.min(1, hopA) * Math.PI) * 6 * (hopA > 0 && hopA < 1 ? 1 : 0));
  const fx = x + 12, fy = y - 12 - hop, blink = (t % 3.2) < 0.12;
  R(P.ink, fx - 3, fy - 1, 7, 5);
  R('#5ab04a', fx - 2, fy, 5, 3); R('#8ad06a', fx - 2, fy, 5, 1); R('#e8e08a', fx - 1, fy + 2, 3, 1);
  R(P.ink, fx - 3, fy - 3, 3, 3); R(P.ink, fx + 1, fy - 3, 3, 3);
  R(blink ? '#5ab04a' : '#fff', fx - 2, fy - 2, 1, 1); R(blink ? '#5ab04a' : '#fff', fx + 2, fy - 2, 1, 1);
  R('#f08aa0', fx - 3, fy + 1, 1, 1); R('#f08aa0', fx + 3, fy + 1, 1, 1);
  if (hop > 0) { const ny = fy - 9 - (6 - hop); R(P.ink, fx + 3, ny, 2, 5); R(P.ink, fx + 1, ny + 3, 3, 3); R('#9fe8ff', fx + 2, ny + 4, 1, 1); R('#9fe8ff', fx + 4, ny + 1, 1, 3); }
  // uçan sikke: oyuncudan kuyuya kavis, dönerek
  if (W) {
    if (k < 0.55) {
      const q = k / 0.55, sx = lerp(W.x, x, q), sy = lerp(y - 14, y - 11, q) - Math.sin(q * Math.PI) * 26;
      const w = [3, 2, 1, 2][Math.floor(t * 20) % 4];
      coinPx(Math.round(sx), Math.round(sy), w);
    } else {
      const q = (k - 0.55) / 0.45;
      ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x - 2 - q * 6) + 0.5, y - 11.5, Math.round(4 + q * 12), 1); ctx.globalAlpha = 1;
      for (let i = 0; i < 4; i++) { const dx = (i - 1.5) * 3 * (1 + q * 2), dy = -Math.sin(q * Math.PI) * (7 + i % 2 * 3); R('#9fe8ff', Math.round(x + dx), Math.round(y - 12 + dy), 1, 2); }
    }
  }
  // ödül: kuyudan yükselen baloncuk, etrafında pırıltı ve kalpler
  if (wishFx) {
    const a = t - wishFx.t0;
    if (a > 1.8) wishFx = null;
    else {
      const rise = Math.min(1, a / 0.5), py = Math.round(y - 14 - rise * 22 - Math.max(0, a - 0.5) * 4), s = a < 0.5 ? 1 + (1 - rise) * 0 : 1;
      ctx.globalAlpha = a > 1.4 ? (1.8 - a) / 0.4 : 1;
      ctx.fillStyle = 'rgba(159,232,255,0.25)'; ctx.beginPath(); ctx.arc(x, py, 8 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, py, 8, 0, 7); ctx.stroke();
      R('#fff', x - 5, py - 5, 2, 1); R('#fff', x - 6, py - 4, 1, 2);
      rewardPx(wishFx.got, x, py + (Math.floor(t * 4) % 2));
      for (let i = 0; i < 5; i++) { const ang = t * 3 + i * 1.26, rr = 12 + Math.sin(t * 5 + i) * 2; R(i % 2 ? '#ffe79a' : '#fff', Math.round(x + Math.cos(ang) * rr), Math.round(py + Math.sin(ang) * rr), 1, 1); }
      for (let i = 0; i < 2; i++) { const hx = x + (i ? 10 : -12), hy = Math.round(py + 6 - a * 14 - i * 3); R('#f08aa0', hx, hy, 1, 1); R('#f08aa0', hx + 2, hy, 1, 1); R('#f08aa0', hx, hy + 1, 3, 1); R('#f08aa0', hx + 1, hy + 2, 1, 1); }
      ctx.globalAlpha = 1;
    }
  }
}
// gezgin tüccar: arabası + pelerinli satıcı; gelirken ve giderken yürür
const MERCH_X = BASE_X - 76;
function drawMerchant(M) {
  const a = MERCHANT.stay - M.t, walkIn = Math.max(0, 1.2 - a), walkOut = Math.max(0, 1.2 - M.t);
  const x = Math.round(MERCH_X - walkIn * 70 - walkOut * 70), y = GROUND_Y;
  const moving = walkIn > 0 || walkOut > 0, step = moving ? Math.floor(G.time * 10) % 2 : 0;
  const R = (c, px, py, w, h) => { ctx.fillStyle = c; ctx.fillRect(px, py, w, h); };
  shadow(x + 8, y, 16, 0.35);
  // --- araba ---
  // tekerlekler (tahta, parmaklı)
  for (const wx of [x - 1, x + 15]) {
    R(P.ink, wx - 1, y - 8, 9, 8); R(P.ink, wx, y - 9, 7, 10);
    R('#6a4526', wx, y - 8, 7, 8); R('#8a5e34', wx + 1, y - 8, 5, 1);
    R('#3e2616', wx + 1, y - 7, 5, 6); R('#8a5e34', wx + 3, y - 7, 1, 6); R('#8a5e34', wx + 1, y - 4, 5, 1);
    R('#c9a54a', wx + 3, y - 4, 1, 1);
  }
  // kasa: tahta kalas, damar, köşe demirleri
  R(P.ink, x - 4, y - 18, 28, 11);
  R('#7a4e2a', x - 3, y - 17, 26, 9);
  R('#9a6636', x - 3, y - 17, 26, 1); R('#5a361c', x - 3, y - 13, 26, 1); R('#5a361c', x - 3, y - 9, 26, 1);
  R('#8a5a30', x + 2, y - 16, 5, 1); R('#8a5a30', x + 12, y - 12, 6, 1);
  R('#8a9ab8', x - 3, y - 17, 2, 9); R('#8a9ab8', x + 21, y - 17, 2, 9);
  // tabela: altın sikke
  R(P.ink, x + 6, y - 16, 9, 7); R('#e8d8b0', x + 7, y - 15, 7, 5);
  R('#e0a020', x + 9, y - 14, 3, 3); R('#ffe79a', x + 9, y - 14, 1, 1);
  // mallar: çuval, testi, kristal, halı rulosu
  R(P.ink, x - 2, y - 24, 7, 7); R('#c8a66a', x - 1, y - 23, 5, 6); R('#e0c890', x - 1, y - 23, 5, 1); R('#8a6a3a', x + 1, y - 24, 1, 2);
  R(P.ink, x + 5, y - 25, 6, 8); R('#3a7a9a', x + 6, y - 24, 4, 7); R('#6ab0d0', x + 6, y - 24, 1, 5); R('#2a4a6a', x + 7, y - 26, 2, 2);
  R(P.ink, x + 11, y - 23, 5, 6); R('#c070ff', x + 12, y - 22, 3, 4); R('#f0c8ff', x + 12, y - 22, 1, 1);
  R(P.ink, x + 16, y - 22, 7, 5); R('#b03040', x + 17, y - 21, 5, 3); R('#e8c060', x + 17, y - 20, 5, 1);
  if (Math.floor(G.time * 2) % 3 === 0) R('#fff', x + 13, y - 25, 1, 1);
  // tente: direkler + çizgili, alt kenarı dalgalı ve gölgeli
  R(P.ink, x - 3, y - 36, 2, 20); R(P.ink, x + 21, y - 36, 2, 20);
  R('#6a4526', x - 3, y - 35, 1, 18); R('#6a4526', x + 21, y - 35, 1, 18);
  R(P.ink, x - 6, y - 38, 32, 7);
  for (let i = 0; i < 6; i++) {
    const cx = x - 5 + i * 5, red = i % 2 === 0;
    R(red ? '#c0404a' : '#f2e6c8', cx, y - 37, 5, 4);
    R(red ? '#e0606a' : '#fffaf0', cx, y - 37, 5, 1);
    R(red ? '#8a2a34' : '#c8b898', cx, y - 33, 5, 1);
    R(P.ink, cx + 1, y - 32, 3, 2); R(red ? '#c0404a' : '#f2e6c8', cx + 2, y - 32, 1, 1);
  }
  // --- tüccar: geniş şapka, sakal, kaftan, sırt çantası, fener ---
  const mx = x + 28, my = y - step;
  // sırt çantası (arkada, battaniye rulosu üstte)
  R(P.ink, mx - 7, my - 17, 6, 10); R('#7a5a3a', mx - 6, my - 16, 4, 8); R('#9a7a50', mx - 6, my - 16, 1, 8);
  R(P.ink, mx - 8, my - 20, 7, 4); R('#6a8a5a', mx - 7, my - 19, 5, 2); R('#8aaa70', mx - 7, my - 19, 5, 1);
  // bacaklar / çizmeler
  R(P.ink, mx - 3, my - 5, 7, 5);
  R('#3a2a22', mx - 2, my - 4, 2, 4); R('#3a2a22', mx + 1 + step, my - 4, 2, 4);
  // kaftan
  R(P.ink, mx - 4, my - 16, 9, 12);
  R('#2e6a6a', mx - 3, my - 15, 7, 10);
  R('#4a9a8a', mx - 3, my - 15, 2, 10); R('#1e4a4a', mx + 3, my - 15, 1, 10);
  R('#e0a020', mx - 3, my - 9, 7, 1); R('#ffe79a', mx, my - 9, 1, 1);
  R(P.ink, mx + 2, my - 8, 3, 3); R('#c9902a', mx + 2, my - 8, 2, 2);
  // kafa: yüz + sakal
  R(P.ink, mx - 3, my - 22, 8, 8);
  R('#e8b88a', mx - 2, my - 21, 6, 4); R('#c08860', mx - 2, my - 18, 6, 1);
  R(P.ink, mx + 2, my - 20, 1, 1);
  R('#d8d0c0', mx - 2, my - 18, 6, 3); R('#fffaf0', mx - 1, my - 18, 2, 1); R('#a8a090', mx + 2, my - 16, 2, 1);
  R('#c07050', mx + 4, my - 19, 1, 1);
  // şapka: geniş kenar + tüy
  R(P.ink, mx - 6, my - 24, 13, 3); R('#5a3a24', mx - 5, my - 23, 11, 1);
  R(P.ink, mx - 3, my - 28, 8, 5); R('#6a4a2e', mx - 2, my - 27, 6, 4); R('#8a6a44', mx - 2, my - 27, 6, 1);
  R('#c0404a', mx - 2, my - 25, 6, 1);
  R('#ffd24a', mx - 4, my - 30, 1, 4); R('#ffe79a', mx - 5, my - 31, 1, 2);
  // elde fener: sopa ucunda, sallanır
  const sw = Math.round(Math.sin(G.time * 3) * 1);
  R(P.ink, mx + 5, my - 14, 1, 6); R(P.ink, mx + 5, my - 15, 5, 1);
  const lx = mx + 8 + sw, ly = my - 14;
  R(P.ink, lx - 2, ly, 5, 6); R('#ffd24a', lx - 1, ly + 1, 3, 4); R('#fff4c0', lx, ly + 2, 1, 2);
  glow(lx, ly + 3, 'rgba(255,210,120,0.55)', 14, 0.6 + 0.15 * Math.sin(G.time * 5));
  // gelince başında altın işaret (mal kaldıysa)
  if (!moving && !M.goods.every(g => g.sold)) {
    const ey = my - 40 + (Math.floor(G.time * 3) % 2);
    R(P.ink, mx - 1, ey - 1, 4, 9); R('#ffd24a', mx, ey, 2, 5); R('#ffd24a', mx, ey + 6, 2, 1);
  }
}

function drawStructure(s) {
  const x = Math.round(s.x), y = Math.round(s.y);
  const pop = s.buildT > 0 ? Math.round(s.buildT * 8) : 0;
  const white = s.hurtT > 0;
  const R = (c, px, py, w, h) => { ctx.fillStyle = white ? '#fff' : c; ctx.fillRect(px, py, w, h); };
  if (s.type === 'direk') {
    // direk: taban, gövde, tepesinde yeşil haçlı fener (şifa verirken yanıp söner)
    const lit = s.on && Math.floor(G.time * 6) % 2 ? '#d8fff0' : '#5fe0b8';
    R(P.ink, x - 4, y + pop, 9, 3); R(P.metalD, x - 3, y + 1 + pop, 7, 1);
    R(P.ink, x - 1, y - 12 + pop, 3, 13); R(P.metal, x, y - 11 + pop, 1, 11);
    R(P.ink, x - 4, y - 19 + pop, 9, 8); R('#16695a', x - 3, y - 18 + pop, 7, 6);
    R(lit, x, y - 18 + pop, 1, 6); R(lit, x - 3, y - 16 + pop, 7, 2);
  } else if (s.type === 'sondaj') {
    // sondaj: üç ayak, sarı motor kutusu, dönen burgu ucu (çalışırken titrer)
    const j = s.on ? Math.floor(G.time * 30) % 2 : 0, bx = x + j, ph = s.on ? Math.floor(G.time * 14) : 0;
    pline(bx - 4, y - 9 + pop, bx - 7, y + 2 + pop, P.ink); pline(bx + 4, y - 9 + pop, bx + 7, y + 2 + pop, P.ink);
    pline(bx - 3, y - 9 + pop, bx - 6, y + 2 + pop, P.metalD); pline(bx + 3, y - 9 + pop, bx + 6, y + 2 + pop, P.metalD);
    R(P.ink, bx - 5, y - 16 + pop, 11, 8); R('#c9902a', bx - 4, y - 15 + pop, 9, 6); R('#ffd24a', bx - 4, y - 15 + pop, 9, 1); R(P.ink, bx - 2, y - 13 + pop, 5, 1);
    R(P.ink, bx - 1, y - 8 + pop, 3, 12);
    for (let i = 0; i < 5; i++) R((i + ph) % 2 ? P.metal : P.metalD, bx, y - 8 + i * 2 + pop, 1, 2);
    R(P.ink, bx - 2, y + 2 + pop, 5, 2); R('#dfe6f0', bx, y + 3 + pop, 1, 1);
  }
  if (s.hp < s.maxHp) {
    const w = 12, f = Math.max(0, s.hp / s.maxHp);
    ctx.fillStyle = P.ink; ctx.fillRect(x - w / 2 - 1, y - 17, w + 2, 3);
    ctx.fillStyle = f < 0.35 ? P.bad : '#5fe0b8'; ctx.fillRect(x - w / 2, y - 16, Math.round(w * f), 1);
  }
}

// Yem Zili: uçarken düz, çalarken iki yana sallanır
function drawBell(b) {
  const x = Math.round(b.x) + (b.left > 0 ? 0 : Math.round(Math.sin(G.time * 24) * 1.4)), y = Math.round(b.y);
  ctx.fillStyle = P.ink; ctx.fillRect(x - 2, y - 5, 5, 8); ctx.fillRect(x - 4, y, 9, 3);
  ctx.fillStyle = '#e0a020'; ctx.fillRect(x - 1, y - 4, 3, 5); ctx.fillRect(x - 3, y + 1, 7, 1);
  ctx.fillStyle = '#ffe07a'; ctx.fillRect(x - 1, y - 4, 1, 3);
  ctx.fillStyle = '#ff9a4a'; ctx.fillRect(x, y + 2, 1, 1);
}

function drawRock(k) {
  const R = MAT_RAMP[k.mat] || MAT_RAMP.stone, x = Math.round(k.x) - 6, y = Math.round(k.y) - 6;
  ctx.fillStyle = R[0]; ctx.fillRect(x + 1, y, 10, 12); ctx.fillRect(x, y + 1, 12, 10);
  ctx.fillStyle = R[2]; ctx.fillRect(x + 1, y + 1, 10, 10);
  ctx.fillStyle = R[3]; ctx.fillRect(x + 1, y + 1, 10, 2); ctx.fillRect(x + 1, y + 1, 2, 8);
  ctx.fillStyle = R[1]; ctx.fillRect(x + 3, y + 8, 8, 3);
  ctx.fillStyle = R[4]; ctx.fillRect(x + 2, y + 1, 3, 1);
}

const CHEST_GLOW = { wood: 'rgba(255,210,74,0.3)', iron: 'rgba(223,230,240,0.25)', mimic: 'rgba(223,230,240,0.25)', gold: 'rgba(255,230,120,0.45)', arms: 'rgba(255,138,58,0.35)', ore: 'rgba(120,160,255,0.35)', supply: 'rgba(236,74,74,0.3)', cursed: 'rgba(255,58,106,0.4)', ancient: 'rgba(90,255,234,0.45)' };
// ---------- düşmanlar ----------
const EN_OFFSET = { rodent: 1, bug: 1, spitter: 2, flyer: -2, boomer: 1, brute: 1, worm: 0, glarer: -3, lurker: 2, howler: 1, shade: 0 };
const DIE_T = e => e.d.dieT || (e.d.boss ? 0.9 : 0.42), MOB_F = {};
// Kıvılcım Sineği'nin ışığı doğduğu biyoma göre
const FLY_GLOW = { 6: 'rgba(255,130,50,0.4)', 9: 'rgba(150,120,255,0.4)', 11: 'rgba(110,190,255,0.4)', 19: 'rgba(255,240,200,0.4)', 24: 'rgba(255,180,70,0.4)' };
// çizim parametreleri: sprite karesi, ayak noktası, ölçek, flip
function enemyPose(e, alpha) {
  const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
  const frames = SPR[e.type] || MOB_F[e.type] || (MOB_F[e.type] = [0, 1].map(() => ({ w: e.d.r * 2 + 6, h: e.d.r * 2 + 6 }))); // yalnız 3B modeli olan tür: ölçü kutusu
  let fi = Math.floor(e.anim) % 2;
  if (e.type === 'lurker') fi = e.tongue > 0 ? 1 : 0;
  else if (e.type === 'howler') fi = e.howlT > 0 ? 1 : fi;
  else if (e.type === 'glarer') fi = (e.blindCd < 0.6 || e.flashT > 0) ? 1 : 0;
  const f = frames[fi];
  const flip = e.face < 0;
  const wind = e.wind || 0, lunge = e.lunge || 0;
  let ox = x + lunge * 3 * e.face - wind * 2 * e.face;
  let oy = (e.d.boss || e.type === 'brute') ? y - 2 : y - 1;
  if (e.hitT > 0) { ox += (e.hitDx || 0) * 1.5; oy += (e.hitDy || 0) * 1.5; }
  // hızdan ezilme/gerilme
  const spd = e.d.speed || 1;
  const hx = clamp(Math.abs(e.vx || 0) / spd, 0, 1.4), hy = clamp(Math.abs(e.vy || 0) / spd, 0, 1.4);
  let sx = 1 + hx * 0.1 - hy * 0.08, sy = 1 + hy * 0.1 - hx * 0.08;
  // hazırlık: çökmek; hamle: ileri uzamak
  sx += -wind * 0.14 + lunge * 0.16; sy += wind * 0.16 - lunge * 0.12;
  // uçanlar süzülür
  if (e.d.fly) oy += Math.sin(e.anim * 0.9 + e.wob) * 1.5;
  // Tükürgen ateşten önce şişer
  if (e.d.ranged && e.fireCd < 0.35 && e.st === 'ranged') { const k = 1 - e.fireCd / 0.35; sx += k * 0.2; sy += k * 0.25; }
  // Uluyan çığlıkta titrer
  if (e.howlT > 0) { ox += (Math.floor(G.time * 30) % 2) ? 1 : -1; sy += 0.1; }
  if (e.d.boss) { sx = 1 + (sx - 1) * 0.5; sy = 1 + (sy - 1) * 0.5; }
  // nefes: dururken hafif şişme; vuruş yediğinde kısa ezilme
  const moving = Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 4;
  if (!moving && !e.d.fly) { const br = Math.sin(G.time * 4 + e.breathe) * 0.03; sx += br; sy -= br; }
  if (e.hitT > 0) { const k = e.hitT / 0.09; sx += k * 0.18; sy -= k * 0.14; }
  // ışınlanma sonrası: kısa şişme
  if (e.blinkT > 0) { const k = e.blinkT / 0.3; sx += k * 0.3; sy += k * 0.3; }
  sx *= e.scale || 1; sy *= e.scale || 1;
  const feet = oy + f.h / 2 + (EN_OFFSET[e.type] || 0) * 0;
  return { x, y, f, flip, ox, oy, sx, sy, feet };
}
function drawEnemy(e, alpha, camY, vh) {
  const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
  if (e.type === 'dunyaYilani') { drawSerpent(ctx, e, alpha); return; }
  const margin = hasBossArt(e) ? 240 : 90;
  if (y < camY - margin || y > camY + vh + margin) return;
  if (e.type === 'balrog') { drawBalrog(ctx, e, alpha); return; }
  if (e.type === 'ejder') { drawDragon(ctx, e, alpha); return; }
  if (hasBossArt(e)) { if (e.under) { drawMound(x, y); return; } if (drawBossArt(ctx, e, alpha)) return; }
  const frames = SPR[e.type], mob = hasMob(e);
  // 3B düşmanlar ölümü ve yerden çıkışı kendi modeliyle oynar
  if (mob && (e.dead || e.emergeT > 0 || e.sink > 0)) { drawMob(ctx, e, alpha); return; }
  if (e.dead) {
    // ölüm: beyaz flaş, sonra yana yatıp yere yayılır ve solar
    const T0 = DIE_T(e), k = clamp(1 - e.dieT / T0, 0, 1);
    const f = frames[0];
    const white = k < 0.18;
    ctx.globalAlpha = 1 - k * k;
    const sx = 1 + k * 0.7, sy = Math.max(0.12, 1 - k * 0.85);
    const ox = x + (e.dieDx || 0) * k * 8, feet = y - 1 + f.h / 2 + k * 2;
    sprScaled(f, ox, feet, sx, sy, e.face < 0, white);
    ctx.globalAlpha = 1;
    return;
  }
  if (e.under) { drawMound(x, y); return; }
  const P0 = enemyPose(e, alpha);
  const { f, flip, ox, oy, sx, sy, feet } = P0;
  if (e.emergeT > 0 || e.sink > 0) {
    const k = e.sink > 0 ? e.sink : Math.min(1, e.emergeT / 0.9);
    ctx.save(); ctx.beginPath(); ctx.rect(ox - 20, oy - 20, 40, 20 + f.h / 2 - k * f.h); ctx.clip();
    spr(f, ox, oy + k * f.h * 0.6, flip); ctx.restore();
    return;
  }
  // gölge (yere basanlar; uçanlarınki soluk ve aşağıda)
  if (mob) ; else if (!e.d.fly) shadow(ox, feet, f.w * 0.7, 0.32);
  else shadow(ox, oy + f.h / 2 + 6, f.w * 0.4, 0.15);
  if (e.trail && !mob) {
    // solucan gövdesi: kuyruktan başa, baştan gecikmeli dalga ve nabız
    const seg = SPR[e.type + 'Seg'] || SPR.wormSeg;
    for (let i = e.trail.length - 1; i >= 1; i--) {
      const q = e.trail[i], wig = Math.round(Math.sin(e.anim * 1.3 + i * 1.1) * 1);
      const ps = 1 + Math.sin(e.anim * 2.2 - i * 0.9) * 0.08;
      sprScaled(seg, q.x + (i === 1 ? 0 : wig), q.y + seg.h / 2 + (i === 1 ? wig : 0), ps, ps, false, e.hitT > 0);
    }
  }
  if (e.tongue > 0 && !mob) drawTongue(ox + e.face * 6, oy + 1, e);
  // Gölge: ışık yoksa görünmez (gözleri emissive katmanda yine parlar)
  if (e.type === 'shade') {
    const L = lightAtTile(Math.floor(x / TILE), Math.floor(y / TILE));
    ctx.globalAlpha = clamp((L - 0.12) * 2.2, 0, 1);
  }
  // cam kopya: yarı saydam, ara sıra titrer
  if (e.illusion) ctx.globalAlpha = 0.62 + (Math.floor(G.time * 9 + e.wob) % 3 === 0 ? 0.2 : 0);
  // kayanın içinden süzülen gölge: soluk ve dalgalı
  if (e.inRock) ctx.globalAlpha *= 0.45 + 0.15 * Math.sin(G.time * 6 + e.wob);
  const M3 = mob ? drawMob(ctx, e, alpha) : null, top = M3 ? M3.top : feet - f.h * sy;
  if (!M3) sprScaled(f, ox, feet, sx, sy, flip, e.hitT > 0);
  ctx.globalAlpha = 1;
  if (M3 && e.tongue > 0 && M3.pts.mouth) drawTongue(M3.x + M3.pts.mouth[0], M3.y + M3.pts.mouth[1], e);
  // Işık Bekçisi nişanı: oyuncuya kesik çizgi, süre dolarken sıklaşır
  if (e.beamT > 0) {
    const q = G.players[e.beamP];
    if (q) {
      const k = 1 - e.beamT / 0.9, n = 6 + Math.floor(k * 10);
      ctx.fillStyle = Math.floor(G.time * (8 + k * 30)) % 2 ? '#fff4c0' : '#ffd870';
      for (let i = 1; i < n; i++) { const t2 = i / n; ctx.fillRect(Math.round(x + (q.x - x) * t2), Math.round(y - 2 + (q.y - 4 - y + 2) * t2), 1, 1); }
      ctx.fillStyle = '#fff4c0'; ctx.fillRect(Math.round(q.x) - 3, Math.round(q.y) - 4, 7, 1); ctx.fillRect(Math.round(q.x), Math.round(q.y) - 7, 1, 7);
    }
  }
  // Örücü: kapatacağı hücre kırmızı yanıp söner
  if (e.sealT > 0 && Math.floor(G.time * 12) % 2) { const sx = e.sealC * TILE, sy = e.sealR * TILE; ctx.strokeStyle = '#ff5a6a'; ctx.strokeRect(sx + 0.5, sy + 0.5, 15, 15); }
  // Cevher Faresi: sırtındaki çalıntı kese
  if (e.fleeT > 0) { ctx.fillStyle = P.ink; ctx.fillRect(Math.round(ox) - 3, Math.round(oy) - 9, 6, 5); ctx.fillStyle = '#ffd870'; ctx.fillRect(Math.round(ox) - 2, Math.round(oy) - 8, 4, 3); }
  if (e.slowT > 0) {
    ctx.fillStyle = '#bff4ff';
    for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(ox - f.w / 2 + hash2(i, Math.floor(G.time * 5), 3) * f.w), Math.round(oy - f.h / 2 + hash2(i, Math.floor(G.time * 5), 7) * f.h), 1, 1);
  }
  if (e.elite) {
    // elit tacı: baş üstünde altın üç diş
    const cx = Math.round(ox), cy = Math.round(top) - 5 + (Math.floor(G.time * 3) % 2);
    ctx.fillStyle = P.ink; ctx.fillRect(cx - 4, cy - 3, 9, 5);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(cx - 3, cy, 7, 1); ctx.fillRect(cx - 3, cy - 2, 1, 2); ctx.fillRect(cx, cy - 2, 1, 2); ctx.fillRect(cx + 3, cy - 2, 1, 2);
    ctx.fillStyle = '#fff4c0'; ctx.fillRect(cx, cy - 2, 1, 1);
    // özellikler: tacın altında renkli noktalar; kalkan dolu ise mavi halka
    if (e.aff) e.aff.forEach((k, i) => { const ax = cx - (e.aff.length - 1) * 2 + i * 4; ctx.fillStyle = P.ink; ctx.fillRect(ax - 1, cy + 3, 3, 3); ctx.fillStyle = AFFIX[k].col; ctx.fillRect(ax, cy + 4, 1, 1); });
    if (e.shield > 0) { ctx.globalAlpha = 0.35 + 0.5 * e.shield / e.shieldMax; ringPx(ox, oy, Math.max(f.w, f.h) * 0.6 * sy + 2, AFFIX.kalkan.col, Math.floor(G.time * 6) % 2); ctx.globalAlpha = 1; }
  }
  if (e.hp < e.maxHp && !e.d.boss) {
    const w = Math.max(8, f.w - 4), fr = Math.max(0, e.hp / e.maxHp);
    const bx = Math.round(ox - w / 2), by = Math.round(top - 4);
    ctx.fillStyle = P.ink; ctx.fillRect(bx - 1, by - 1, w + 2, 3);
    ctx.fillStyle = e.elite ? '#ffd24a' : '#ec4a4a'; ctx.fillRect(bx, by, Math.max(1, Math.round(w * fr)), 1);
  }
}

// Çekici dili: ağızdan hedefe kalın kontur + pembe iç, ucunda topak
function drawTongue(mx, my, e) {
  pline3(mx, my, e.tx, e.ty, P.ink); pline(mx, my, e.tx, e.ty, '#e070a0');
  ctx.fillStyle = P.ink; ctx.fillRect(Math.round(e.tx) - 2, Math.round(e.ty) - 2, 5, 5);
  ctx.fillStyle = '#ff8ac0'; ctx.fillRect(Math.round(e.tx) - 1, Math.round(e.ty) - 1, 3, 3);
}

// Karakök toprak altında: kayanın içinde kıpırdayan tümsek
function drawMound(x, y) {
  const cx = Math.round(x), fy = Math.round(y + 6), w = Math.floor(G.time * 12) % 2;
  ctx.fillStyle = P.ink; ctx.fillRect(cx - 9, fy - 3 - w, 18, 4); ctx.fillRect(cx - 6, fy - 5 - w, 12, 2);
  ctx.fillStyle = '#5e3c24'; ctx.fillRect(cx - 8, fy - 2 - w, 16, 2); ctx.fillRect(cx - 5, fy - 4 - w, 10, 2);
  ctx.fillStyle = '#8e6238'; ctx.fillRect(cx - 3, fy - 4 - w, 4, 1);
  ctx.fillStyle = '#78b43c'; ctx.fillRect(cx + 2, fy - 6 - w, 1, 2); ctx.fillRect(cx - 4, fy - 6 + w, 1, 2);
}
// boss uyarıları ve saldırı görselleri: ışık katmanında çizilir, karanlıkta da okunur
const FX_COL = { root: '#b8f060', ember: '#ff7a2a', light: '#fff4c0', rise: '#b8f060', egg: '#d8f0a0', amber: '#ffb040', spike: '#ff3a6a', rock: '#c8b8a0', venom: '#5ae0c8', seed: '#78b43c', bone: '#e8dcc0', boulder: '#c8b8a0', clot: '#ff3a6a', grow: '#ff3a6a' };
const rgbaCache = new Map();
function rgba(hex, a) { const k = hex + a; let s = rgbaCache.get(k); if (!s) { s = 'rgba(' + hexToRgb(hex).join(',') + ',' + a + ')'; rgbaCache.set(k, s); } return s; }
function ringPx(x, y, r, col, dash = 0) {
  const n = Math.max(12, Math.round(r * 2.4));
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) { if (dash && (i >> dash) % 2) continue; const a = i / n * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.8), 1, 1); }
}
function dashLine(x0, y0, a, len, col, off = 0) {
  ctx.fillStyle = col;
  const o = ((off % 6) + 6) % 6;
  for (let d = 6 + o; d < len; d += 6) { ctx.fillRect(Math.round(x0 + Math.cos(a) * d), Math.round(y0 + Math.sin(a) * d), 2, 1); ctx.fillRect(Math.round(x0 + Math.cos(a) * (d + 2)), Math.round(y0 + Math.sin(a) * (d + 2)), 1, 1); }
}
function drawBossFx(e, alpha) {
  const B = e.bs, t = G.time, x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
  for (const m of B.marks) {
    const c = FX_COL[m.kind];
    if (drawKitMark(ctx, m, t, glow)) continue;
    if (m.t > 0) {
      const k = 1 - m.t / m.T, on = Math.floor(t * (6 + k * 20)) % 2 === 0;
      ctx.globalAlpha = 0.14 + k * 0.22; ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(Math.round(m.x), Math.round(m.y + 4), m.r, m.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6 + k * 0.4;
      ringPx(m.x, m.y + 4, m.r, c);
      ringPx(m.x, m.y + 4, m.r * (1.8 - k * 0.8), c, k < 0.5 ? 1 : 0);
      if (on) { ringPx(m.x, m.y + 4, m.r * 0.45, c); ctx.fillStyle = c; ctx.fillRect(Math.round(m.x), Math.round(m.y + 4), 1, 1); }
      ctx.globalAlpha = 1;
      glow(m.x, m.y + 2, rgba(c, 0.3), m.r + 4, 0.3 + k * 0.6);
      continue;
    }
    const k = m.post / 0.4, mx = Math.round(m.x), my = Math.round(m.y + 6);
    if (m.kind === 'root') {
      for (let i = -1; i <= 1; i++) { const h = Math.round((i ? 9 : 14) * k + 2); ctx.fillStyle = '#b8f060'; ctx.fillRect(mx + i * 4, my - h, 1, h); ctx.fillStyle = '#ffd060'; ctx.fillRect(mx + i * 4, my - h, 1, 1); }
      glow(m.x, m.y, 'rgba(184,240,96,0.35)', 12, k);
    } else if (m.kind === 'ember') glow(m.x, m.y, 'rgba(255,120,40,0.6)', Math.round(m.r * 1.6), k);
    else if (m.kind === 'spike') { for (let i = -1; i <= 1; i++) { const h = Math.round((i ? 7 : 11) * k + 2); ctx.fillStyle = '#ff3a6a'; ctx.fillRect(mx + i * 3, my - h, 1, h); ctx.fillStyle = '#ffd0d8'; ctx.fillRect(mx + i * 3, my - h, 1, 1); } glow(m.x, m.y, 'rgba(255,58,106,0.4)', 12, k); }
    else if (m.kind === 'venom') { glow(m.x, m.y, 'rgba(90,224,200,0.55)', Math.round(m.r * 1.6), k); ctx.globalAlpha = k * 0.6; ctx.fillStyle = '#2a8a78'; ctx.beginPath(); ctx.ellipse(mx, my - 2, m.r, m.r * 0.35, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    else if (m.kind === 'amber') glow(m.x, m.y, 'rgba(255,176,64,0.6)', Math.round(m.r * 1.6), k);
    else if (m.kind === 'egg') glow(m.x, m.y, 'rgba(216,240,160,0.5)', 10, k);
    else if (m.kind === 'light') { ctx.globalAlpha = k; ctx.fillStyle = '#fff4c0'; ctx.fillRect(mx - 3, my - 90, 7, 90); ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - 1, my - 90, 3, 90); ctx.globalAlpha = 1; glow(m.x, m.y, 'rgba(255,244,192,0.6)', 18, k); }
  }
  for (const R of B.rings) {
    ctx.globalAlpha = 1 - (R.r / R.R) * 0.6;
    ringPx(R.x, R.y, R.r, R.col); ringPx(R.x, R.y, R.r - 2, '#ffffff', 2); ringPx(R.x, R.y, R.r - 4, R.col, 1);
    ctx.globalAlpha = 1;
  }
  if (e.type === 'poseidon') drawPoseidonFx(ctx, e, x, y, t, glow);
  drawKitFx(ctx, e, x, y, t, glow, alpha);
  const A = B.act;
  if (!A) return;
  const on = Math.floor(t * 14) % 2 === 0;
  if (A.k === 'breath') {
    if (!A.fire) { if (on) { dashLine(x, y, A.a - 0.42, 78, '#ff7a2a', t * 30); dashLine(x, y, A.a + 0.42, 78, '#ff7a2a', t * 30); } glow(x + Math.cos(A.a) * 8, y + Math.sin(A.a) * 8, 'rgba(255,200,80,0.7)', Math.round(4 + e.wind * 8), 1); }
    else for (let d = 14; d < 78; d += 12) glow(x + Math.cos(A.a) * d, y + Math.sin(A.a) * d, 'rgba(255,110,30,0.4)', Math.round(d * 0.4), 0.7 + Math.sin(t * 20 + d) * 0.3);
  } else if (A.k === 'gaze') {
    const ex = x + Math.cos(A.a) * (A.len || 0), ey = y + Math.sin(A.a) * (A.len || 0);
    if (!A.fire) { if (on) dashLine(x, y, A.a, A.len || 100, '#c0b8ff', t * 40); }
    else { pline3(x, y, ex, ey, '#8060ff'); pline(x, y, ex, ey, '#ffffff'); glow(ex, ey, 'rgba(192,184,255,0.7)', 10, 1); glow(x, y, 'rgba(192,184,255,0.6)', 14, 1); }
  } else if (A.k === 'pull') {
    if (!A.fire) { const k = e.wind; ringPx(x, y, 44 * (1 - k) + 12, '#c0b8ff', 1); ringPx(x, y, 30 * (1 - k) + 8, '#b080ff'); }
    else { ctx.globalAlpha = 0.5; ringPx(x, y, 60 - (t * 90) % 50, '#b080ff', 1); ringPx(x, y, 110 - (t * 90) % 50, '#b080ff', 2); ctx.globalAlpha = 1; glow(x, y, 'rgba(176,128,255,0.5)', 20, 1); }
  } else if (A.k === 'charge') {
    if (A.stage === 'aim') { if (on || e.wind > 0.7) dashLine(x, y, A.a, 150, e.wind > 0.7 ? '#ff5a3a' : '#ffd870', -t * 60); }
    else if (A.stage === 'dash') glow(x, y, 'rgba(255,216,112,0.6)', 18, 1);
    else if (A.stage === 'daze') for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; ctx.fillStyle = i % 2 ? '#ffffff' : '#ffd870'; ctx.fillRect(Math.round(x + Math.cos(a) * 9), Math.round(y - 16 + Math.sin(a) * 3), 1, 1); }
  } else if (A.k === 'slam') { if (on) ringPx(x, y + 4, 76, '#ffd870', 2); }
  else if (A.k === 'melee') {
    // düz vuruş: önündeki yay yanıp söner (son anda kızarır); darbe anında beyaz bir savruluş
    const hit = A.done, n = Math.round(A.R * A.arc * 1.4), c = hit ? '#ffffff' : e.wind >= 0.6 ? '#ff5a3a' : e.d.col;
    if (!hit || A.T > BOSS_MELEE.rest - 0.14) {
      ctx.globalAlpha = hit ? 1 : 0.4 + e.wind * 0.6; ctx.fillStyle = c;
      for (let i = 0; i <= n; i++) { if (!hit && !on && i % 2) continue; const a = A.a - A.arc + i / n * 2 * A.arc, s = hit ? 2 : 1; ctx.fillRect(Math.round(x + Math.cos(a) * A.R), Math.round(y + Math.sin(a) * A.R), s, s); }
      if (!hit && on) { dashLine(x, y, A.a - A.arc, A.R, c); dashLine(x, y, A.a + A.arc, A.R, c); }
      ctx.globalAlpha = 1;
    }
  }
  else if (A.k === 'doom') { glow(x, y, 'rgba(255,244,192,0.5)', Math.round(14 + e.wind * 40), 0.5 + e.wind * 0.5); if (on) ringPx(x, y, 20 + e.wind * 30, '#fff4c0', 1); }
}

// ---------- oyuncu ----------
function pickTier() { return PICK_TIERS[Math.min(PICK_TIERS.length - 1, G.lvl.drill)]; }
// silah türü: namlu boyu, rengi, kalınlığı
const GUN = { blaster: [5, P.metal], sacma: [6, '#b07a42', 1], makineli: [6, '#6a7898'], alev: [5, '#e0502a', 1], tufek: [8, '#dfe6f0'], simsek: [4, '#6fd0ff'], roket: [7, '#7a8a4a', 1], kirag: [5, '#bff4ff', 1] };
function drawPlayer(p, alpha) {
  if (p.dead) { drawDowned(p, alpha); return; }
  if (p.ride) { const rd = p.ride, b = rd.board || 0; drawCab(b > 0 ? SHAFT_X : Math.round(lerp(p.px, p.x, alpha)), Math.round(lerp(p.py, p.y, alpha)), b > ELEVATOR.lever ? 0 : 1 - Math.max(0, b) / ELEVATOR.lever); }
  else if (p.iframes > 0 && p.hurtT <= 0 && Math.floor(p.iframes * 14) % 2 === 0) return;
  const x = Math.round(lerp(p.px, p.x, alpha)), y = Math.round(lerp(p.py, p.y, alpha));
  const S = playerSprites(p.helm);
  const digDown = p.dig && p.digDir[1] > 0;
  let fr = S.idle;
  if (p.up) fr = S.fly;
  else if (digDown) fr = S.crouch;
  else if (p.moving && !p.dig) { const k = Math.floor(p.walkT) % 4; fr = k === 1 ? S.wa : k === 2 ? S.wc : k === 3 ? S.wb : S.idle; }
  const flip = p.face < 0;
  const bob = (!p.moving && !p.dig && Math.floor(G.time * 2) % 2 === 0) ? 1 : 0;
  const dip = p.digAnim > 0.6 ? 1 : 0;
  // hamle: vuruş anında hedefe doğru 1px
  const lx = p.digAnim > 0.7 ? p.digDir[0] : 0, ly = p.digAnim > 0.7 ? p.digDir[1] : 0;
  const chew = p.eat && Math.floor(G.time * 14) % 2 ? 1 : 0;
  const top = y - 9 + bob + dip + ly + chew;
  const feetY = y + 6;
  // mantar: küçülme/büyüme yumuşak geçişle, ayak hizasından
  const sk = shroomScale(p);
  ctx.save();
  if (sk !== 1) { ctx.translate(x, feetY); ctx.scale(sk, sk); ctx.translate(-x, -feetY); }
  // gölge
  shadow(x, feetY, 8, 0.35);
  // partide kendi madencin: ayağının altında kask renginde halka
  if (G.mp && p === G.player) {
    ctx.fillStyle = HELMETS[p.helm % HELMETS.length].c; ctx.globalAlpha = 0.75 + 0.25 * Math.sin(G.time * 4);
    for (let dx = -9; dx <= 9; dx++) { const dy = Math.round(3 * Math.sqrt(1 - dx * dx / 81)); ctx.fillRect(x + dx, feetY - dy, 1, 1); if (dy) ctx.fillRect(x + dx, feetY + dy, 1, 1); }
    ctx.globalAlpha = 1;
  }
  // iniş ezilmesi
  let sx = 1, sy = 1;
  if (p.landT > 0) { const k = p.landT / 0.18; sx = 1 + k * 0.18; sy = 1 - k * 0.2; }
  if (p.up) { sy = 1.06; sx = 0.95; }
  const arm = drawArmAndPick(p, x + lx, top + 9, flip, 'back');
  if (sx === 1 && sy === 1) ctx.drawImage(sprCanvas(fr, flip, p.hurtT > 0), x - 6 + lx, top);
  else sprScaled(fr, x + lx, feetY, sx, sy, flip, p.hurtT > 0);
  drawArmAndPick(p, x + lx, top + 9, flip, 'front', arm);
  // omuz blaster'ı
  const sp = shoulderPos(p);
  const sxp = Math.round(sp.x - p.x + x), syp = Math.round(sp.y - p.y + y) + bob + dip;
  const ang = p.aimT > 0 ? p.aim : (p.face > 0 ? -0.35 : Math.PI + 0.35);
  const rc = (p.recoil || 0) * 1.5;
  const gd = GUN[p.wpn] || GUN.blaster, gl = gd[0];
  if (gd[2]) pline(sxp, syp + 1, sxp + Math.cos(ang) * (gl - 1 - rc), syp + 1 + Math.sin(ang) * (gl - 1 - rc), P.ink);
  pline(sxp, syp, sxp + Math.cos(ang) * (gl - rc), syp + Math.sin(ang) * (gl - rc), P.ink);
  pline(sxp, syp - 1, sxp + Math.cos(ang) * (gl - 1 - rc), syp - 1 + Math.sin(ang) * (gl - 1 - rc), gd[1]);
  if (p.flameT > 0) glow(sxp + Math.cos(ang) * 14, syp + Math.sin(ang) * 14, 'rgba(255,150,60,0.4)', 12, 0.8);
  // kalkan hücresi: mavi kabarcık; adrenalin: kırmızı titreşim
  if (p.barrier > 0) { ctx.globalAlpha = 0.35 + Math.sin(G.time * 6) * 0.15; ctx.strokeStyle = '#6fd0ff'; ctx.beginPath(); ctx.arc(x, y - 2, 11, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  if (p.adrenT > 0 && Math.floor(G.time * 12) % 2 === 0) { ctx.fillStyle = '#ff5a6a'; ctx.fillRect(x - p.face * 7, top + 4, 2, 1); ctx.fillRect(x - p.face * 8, top + 8, 3, 1); }
  // ağ: beyaz iplikler; soğuk: buz kırığı; yanma: alev dili
  if (p.webT > 0) { ctx.fillStyle = '#f0f0ff'; for (let i = 0; i < 4; i++) { const ax = x - 6 + i * 4, ay = top + 2 + ((i * 5 + Math.floor(G.time * 3)) % 9); ctx.fillRect(ax, ay, 3, 1); ctx.fillRect(ax + 1, ay - 2, 1, 5); } }
  if (p.slowT > 0) { ctx.fillStyle = '#bff4ff'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 5 + Math.floor(hash2(i, Math.floor(G.time * 6), 5) * 11), top + Math.floor(hash2(i, Math.floor(G.time * 6), 9) * 13), 1, 1); }
  if (p.burnT > 0) { const fl = Math.floor(G.time * 12) % 2; ctx.fillStyle = '#ff9a4a'; ctx.fillRect(x - 2, top - 3 - fl, 2, 3); ctx.fillRect(x + 2, top - 2 + fl, 2, 3); ctx.fillStyle = '#ffe79a'; ctx.fillRect(x - 2, top - 1 - fl, 1, 1); ctx.fillRect(x + 2, top + fl, 1, 1); }
  if (p.carrying) spr(SPR.heart, x, top - 11 + Math.round(Math.sin(G.time * 4)));
  // Arkentaş: göğüste beyaz-mavi taş
  if (hasRelic('arken')) { ctx.fillStyle = P.ink; ctx.fillRect(x - 2 + (flip ? -1 : 0), top + 8, 4, 4); ctx.fillStyle = '#8ab4d8'; ctx.fillRect(x - 1 + (flip ? -1 : 0), top + 9, 2, 2); ctx.fillStyle = Math.floor(G.time * 5) % 2 ? '#ffffff' : '#e8f4ff'; ctx.fillRect(x - 1 + (flip ? -1 : 0), top + 9, 1, 1); }
  // Altın Taç: kaskın üstünde üç dişli taç, kırmızı taş
  if (hasRelic('tac')) {
    const cy = top - 2 + (p.up ? 1 : 0);
    ctx.fillStyle = P.ink; ctx.fillRect(x - 4, cy - 3, 9, 5);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 3, cy, 7, 1); ctx.fillRect(x - 3, cy - 2, 1, 2); ctx.fillRect(x, cy - 2, 1, 2); ctx.fillRect(x + 3, cy - 2, 1, 2);
    ctx.fillStyle = Math.floor(G.time * 4) % 2 ? '#ff5a6a' : '#fff4c0'; ctx.fillRect(x, cy - 1, 1, 1);
  }
  // korku: baş üstünde titrek ünlem
  if (p.fearT > 0 && Math.floor(G.time * 8) % 2 === 0) { ctx.fillStyle = '#c08ab0'; ctx.fillRect(x - 1, top - 9, 2, 5); ctx.fillRect(x - 1, top - 3, 2, 2); }
  // zehirli mantar: yeşil kabarcıklar; hız mantarı: arkada sarı çizgiler
  const SH = p.shroom;
  if (SH && SH.k === 'zehir') for (let i = 0; i < 3; i++) { const k = (G.time * 0.9 + i * 0.33) % 1; ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 2 ? '#7ad04a' : '#b8f080'; ctx.fillRect(Math.round(x - 3 + i * 3 + Math.sin(k * 6 + i) * 1.5), Math.round(top - 2 - k * 9), 2, 2); ctx.globalAlpha = 1; }
  if (SH && SH.k === 'hiz' && p.moving) { ctx.fillStyle = '#ffe14a'; for (let i = 0; i < 3; i++) ctx.fillRect(x - p.face * (8 + ((Math.floor(G.time * 20) + i * 3) % 5)), top + 4 + i * 4, 3, 1); }
  ctx.restore();
}
// mantar ölçeği: hedef değere yumuşakça yaklaşır, geçişte hafif esner
const scaleOf = new Map();
let frameDt = 1 / 60; // son çizimden bu yana geçen oyun süresi: geçiş hızı ekran yenileme hızından bağımsız
function shroomScale(p) {
  const tg = p.shroom ? p.shroom.k === 'mini' ? SHROOM.mini : p.shroom.k === 'dev' ? SHROOM.big : 1 : 1;
  let c = scaleOf.get(p.i) ?? 1;
  c += (tg - c) * (1 - Math.exp(-frameDt * 7.7)); if (Math.abs(tg - c) < 0.01) c = tg;
  scaleOf.set(p.i, c);
  return c;
}

// baygın oyuncu: yerde yatar, kask yanıp söner; partner yaklaşınca kaldırma halkası
// asansör kabini: halat + kafes
function drawCab(x, y, lever = 1) {
  ctx.fillStyle = '#3a3230'; ctx.fillRect(x - 1, GROUND_Y - 40, 2, y - 12 - (GROUND_Y - 40));
  ctx.fillStyle = P.ink; ctx.fillRect(x - 9, y - 13, 18, 2); ctx.fillRect(x - 9, y + 8, 18, 2);
  ctx.fillRect(x - 9, y - 13, 2, 23); ctx.fillRect(x + 7, y - 13, 2, 23);
  ctx.fillStyle = '#c9a54a'; ctx.fillRect(x - 8, y - 12, 16, 1); ctx.fillRect(x - 8, y + 8, 16, 1);
  ctx.fillStyle = 'rgba(255,231,154,0.12)'; ctx.fillRect(x - 7, y - 11, 14, 19);
  // kol: yukarıdan aşağı iner; inince yeşil yanar
  const lx = x + 9, ly = y - 2, ey = Math.round(ly - 5 + lever * 10);
  ctx.fillStyle = P.ink; ctx.fillRect(lx, Math.min(ly, ey) - 1, 3, Math.abs(ey - ly) + 3);
  ctx.fillStyle = '#8a9ab8'; ctx.fillRect(lx + 1, Math.min(ly, ey), 1, Math.abs(ey - ly) + 1);
  ctx.fillStyle = lever >= 1 ? '#5ae08a' : '#ec4a4a'; ctx.fillRect(lx, ey - 1, 3, 3);
}
// maden kanaryası: küçük sarı kuş; yuva sezince ona doğru titreyen ok
function drawCanary() {
  const x = Math.round(canary.x), y = Math.round(canary.y);
  const w = Math.sin(canary.flap) > 0;
  ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 2, y - 1, 4, 3);
  ctx.fillStyle = '#e0a020'; ctx.fillRect(x - 1, w ? y - 3 : y, 2, 2);
  ctx.fillStyle = '#ff9a4a'; ctx.fillRect(G.player.face > 0 ? x + 2 : x - 3, y, 1, 1);
  ctx.fillStyle = P.ink; ctx.fillRect(G.player.face > 0 ? x + 1 : x - 2, y - 1, 1, 1);
  const t = canary.target;
  if (t) {
    const a = Math.atan2(t.y - y, t.x - x), d = 7 + Math.sin(G.time * 8) * 1.5;
    ctx.save(); ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.rotate(a);
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-2, -2); ctx.lineTo(-2, 2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function drawDowned(p, alpha) {
  if (p.gone) return;
  const x = Math.round(p.x), y = Math.round(p.y);
  const S = playerSprites(p.helm);
  shadow(x, y + 6, 10, 0.4);
  ctx.save(); ctx.translate(x, y + 4); ctx.rotate(p.face < 0 ? Math.PI / 2 : -Math.PI / 2);
  ctx.drawImage(sprCanvas(S.idle, false, false), -6, -8);
  ctx.restore();
  if (Math.floor(G.time * 3) % 2 === 0) { ctx.fillStyle = P.ink; ctx.fillRect(x - 1, y - 14, 3, 6); ctx.fillStyle = '#ec4a4a'; ctx.fillRect(x, y - 13, 1, 4); }
  const f = Math.min(1, p.reviveP);
  if (f > 0) {
    ctx.fillStyle = P.ink; ctx.fillRect(x - 9, y - 20, 19, 5);
    ctx.fillStyle = '#5fe0b8'; ctx.fillRect(x - 8, y - 19, Math.round(17 * f), 3);
  } else {
    // kalan süre çemberi (kabaca): küçük çubuk
    const k = Math.max(0, p.downT / 25);
    ctx.fillStyle = P.ink; ctx.fillRect(x - 9, y - 20, 19, 4);
    ctx.fillStyle = k < 0.3 ? '#ec4a4a' : '#f2c14e'; ctx.fillRect(x - 8, y - 19, Math.round(17 * k), 2);
  }
}

// Kazma + kol. Kazma her zaman görünür: boşta omuzda, yürürken sallanır, kazarken kaldır-indir döngüsü.
// pass 'back': arka kol (gövdenin arkasında). 'front': ön kol + kazma. Kazma açısı iki geçişte aynı hesaplanır.
function drawArmAndPick(p, x, y, flip, pass, cache) {
  const face = p.face;
  let ang, gx, gy;
  if (cache) { ({ ang, gx, gy } = cache); }
  else {
    const [dx, dy] = p.digDir;
    const digging = p.dig || p.digAnim > 0.05;
    if (digging) {
      const base = Math.atan2(dy, dx);
      const side = dx !== 0 ? -dx : -face;           // kaldırma yönü (geriye/yukarı)
      const raised = base + side * 1.7, hit = base - side * 0.12;
      const T0 = p.digInt || 0.2, t = clamp(p.digT / T0, 0, 1); // 1: yeni vurdu, 0: vuracak
      let k;                                                  // 0: kaldırılmış, 1: blokta
      if (p.digAnim > 0.55) k = 1;                            // darbe anı: kazma blokta kalır
      else if (t > 0.28) k = clamp((t - 0.28) / 0.72, 0, 1) * 0.8; // yavaşça geri kaldır (anticipation)
      else k = Math.pow(1 - t / 0.28, 1.6);                   // hızlanan iniş
      ang = raised + (hit - raised) * k;
      gx = x + dx * 2 + (dy !== 0 ? face * 2 : 0); gy = y + dy * 2 - 1;
    } else {
      // omuzda: sap yukarı-geri, yürürken hafif salınım
      const sw = p.moving ? Math.sin(p.walkT * Math.PI / 2) * 0.18 : Math.sin(G.time * 1.5) * 0.04;
      ang = face > 0 ? -2.15 + sw : -0.99 - sw;
      gx = x - face * 1; gy = y - 1;
    }
  }
  const shoulderX = x - face * 2, shoulderY = y - 4;
  if (pass === 'back') {
    // arka kol: omuzdan kabzaya
    pline(shoulderX - face * 2, shoulderY, gx - face, gy, P.skinD);
    return { ang, gx, gy };
  }
  const tier = pickTier();
  // vuruş anında iz: önceki iki açıda soluk kazma başı (hız hissi)
  if (p.digAnim > 0.5 && p.dig) {
    const [ddx, ddy] = p.digDir, side = ddx !== 0 ? -ddx : -face;
    for (let i = 1; i <= 2; i++) {
      const a2 = ang + side * 0.45 * i;
      const hx2 = gx + Math.cos(a2) * 9, hy2 = gy + Math.sin(a2) * 9, px2 = -Math.sin(a2), py2 = Math.cos(a2);
      ctx.globalAlpha = i === 1 ? 0.4 : 0.18;
      pline(hx2 - px2 * 3, hy2 - py2 * 3, hx2 + px2 * 4 + Math.cos(a2) * 1.5, hy2 + py2 * 4 + Math.sin(a2) * 1.5, tier.headL);
      ctx.globalAlpha = 1;
    }
  }
  const hx = gx + Math.cos(ang) * 9, hy = gy + Math.sin(ang) * 9;   // kazma başı merkezi
  const px = -Math.sin(ang), py = Math.cos(ang);
  // sap: kontur + ahşap
  pline3(gx, gy, hx, hy, P.ink);
  pline(gx, gy, hx, hy, tier.handle);
  pline(gx + Math.round(px), gy + Math.round(py), gx + Math.round(px) + Math.cos(ang) * 4, gy + Math.round(py) + Math.sin(ang) * 4, P.woodL);
  // baş: türüne göre ayrı biçim. L(u, v): u sap ekseni boyunca (dışa +), v ön yüz yönü (+ uç)
  const ax = Math.cos(ang), ay = Math.sin(ang), L = (u, v) => [hx + ax * u + px * v, hy + ay * u + py * v];
  const seg = (u0, v0, u1, v1, col, thick) => { const [a, b] = L(u0, v0), [c, d] = L(u1, v1); (thick ? pline3 : pline)(a, b, c, d, col); };
  const dot = (u, v, col) => { const [a, b] = L(u, v); ctx.fillStyle = col; ctx.fillRect(Math.round(a), Math.round(b), 1, 1); };
  const spin = p.dig ? Math.floor(G.time * 24) % 2 : 0;
  let tip;
  switch (p.pk) {
    case 'matkap': {   // motor gövdesi + dönen konik uç
      for (let u = -1; u <= 1; u++) seg(u, -3, u, 1, P.ink, true);
      for (let u = -1; u <= 1; u++) seg(u, -3, u, 1, u === 1 ? tier.headL : tier.head);
      seg(-1, -1, 1, -1, '#e8c040');
      seg(0, 1, 0, 6, P.ink, true); seg(-1, 2, 1, 2, P.ink, true);
      for (let v = 2; v <= 6; v++) { const w = v < 4 ? 1 : 0; seg(-w, v, w, v, (v + spin) % 2 ? tier.headL : tier.head); }
      tip = L(0, 6.5); break;
    }
    case 'genis': {    // uzun, iki ucu genişleyen çift ağız
      seg(0, -5, 0, 5, P.ink, true); seg(-2, -5, 2, -5, P.ink, true); seg(-2, 5, 2, 5, P.ink, true);
      seg(0, -5, 0, 5, tier.head); seg(-2, -5, 2, -5, tier.head); seg(-2, 5, 2, 5, tier.headL);
      seg(0, 1, 0, 5, tier.headL);
      tip = L(0, 5.5); break;
    }
    case 'balyoz': {   // ağır dikdörtgen blok, bantlı
      for (let u = -2; u <= 2; u++) seg(u, -3, u, 3, P.ink, true);
      for (let u = -2; u <= 2; u++) seg(u, -3, u, 3, tier.head);
      seg(-2, 3, 2, 3, tier.headL); seg(2, -3, 2, 3, tier.headL);
      seg(-2, -1, 2, -1, P.ink); seg(-2, 1, 2, 1, P.ink);
      tip = L(0, 3.5); break;
    }
    case 'burgu': {    // yakalı uzun vida, dönerken helezon kayar
      seg(-2, -1, 2, -1, P.ink, true); seg(-2, -1, 2, -1, tier.head);
      seg(0, -1, 0, 7, P.ink, true); seg(0, -1, 0, 7, tier.head);
      for (let v = spin; v < 7; v += 2) { seg(-1, v, 1, v + 1, tier.headL); dot(-1, v, P.ink); }
      tip = L(0, 7.5); break;
    }
    case 'akik': {     // kıvrık kan kırmızısı ağız, ortada akik taşı
      seg(0, -2, 0, 3, P.ink, true); seg(0, 3, 1.5, 6, P.ink, true); seg(1.5, 6, 3, 7, P.ink, true);
      seg(0, -2, 0, 3, '#a01830'); seg(0, 3, 1.5, 6, '#a01830'); seg(1.5, 6, 3, 7, '#ff6070');
      seg(-1, 0, -1, 4, '#ff6070');
      dot(0, 0, '#ff3050'); dot(1, 0, '#ffb0b8');
      tip = L(3, 7); break;
    }
    default: {         // madenci / kadife / hazine: kavisli çubuk (öne uzun, arkaya kısa)
      tip = [hx + px * 4 + ax * 1.5, hy + py * 4 + ay * 1.5];
      const [bx, by] = L(0, -3);
      pline3(bx, by, tip[0], tip[1], P.ink);
      pline(bx, by, tip[0], tip[1], tier.head);
      pline(hx, hy, tip[0], tip[1], tier.headL);
      if (p.pk === 'kadife') {   // uçta yumuşak kadife yastık, sapta sargı
        pline3(tip[0], tip[1], tip[0] + px, tip[1] + py, '#5a2468');
        pline(tip[0], tip[1], tip[0] + px, tip[1] + py, '#c080d8');
        dot(-1, 0, '#8a3a9a'); dot(-2, 0, '#8a3a9a');
        tip = [tip[0] + px * 1.5, tip[1] + py * 1.5];
      } else if (p.pk === 'hazine') {   // altın kaplamalı, ortada parlayan zümrüt
        seg(0, -3, 0, -1, '#ffd24a'); seg(0, 2, 0, 4, '#ffd24a');
        seg(-1, 0, 1, 0, P.ink, true); dot(0, 0, '#5fe0b8');
        if ((G.time * 2 + p.i) % 2 < 0.25) dot(1, 0, '#ffffff');
      }
    }
  }
  const tipX = tip[0], tipY = tip[1];
  if (p.pk !== 'kadife') { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(tipX), Math.round(tipY), 1, 1); }
  // ön kol + el
  pline(shoulderX, shoulderY, gx, gy, P.skin);
  pline(shoulderX, shoulderY + 1, gx, gy + 1, P.skinD);
  ctx.fillStyle = P.ink; ctx.fillRect(Math.round(gx) - 1, Math.round(gy) - 1, 3, 3);
  ctx.fillStyle = P.skin; ctx.fillRect(Math.round(gx), Math.round(gy), 1, 1);
  p.pickHead = { x: hx, y: hy, tx: tipX, ty: tipY };
  return cache;
}

function drawEmissive(r0, r1, alpha, opts) {
  const t = G.time;
  ctx.globalCompositeOperation = 'lighter';
  drawWondersGlow(ctx, r0, r1, glow);
  drawLiquidGlow(ctx, r0, r1, glow);
  drawBalrogOmen(ctx, glow);
  drawSerpentOmenGlow(ctx, glow);
  drawHallGlow(ctx, glow);
  drawHoardGlow(ctx, glow);
  // üs pencereleri ve anten ışığı
  const b = G.base, s = SPR.base;
  ctx.drawImage(s.em, Math.round(b.x - s.w / 2), GROUND_Y - s.h);
  glow(b.x - 12, GROUND_Y - 14, 'rgba(255,200,120,0.25)', 14);
  glow(b.x + 18, GROUND_Y - 14, 'rgba(255,200,120,0.25)', 14);
  if (Math.floor(t * 1.5) % 2 === 0) glow(b.x + 22, GROUND_Y - 41, 'rgba(95,224,184,0.6)', 5);
  // fenerler + kazma parıltısı
  if (!opts.hidePlayer) for (const p of G.players) {
    if (p.dead) continue;
    const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha);
    const flick = 0.2 + Math.sin(t * 17 + p.i * 3) * 0.015 + Math.sin(t * 5.3) * 0.01;
    glow(x + p.face * 5, y - 5, 'rgba(255,236,170,0.2)', 22, flick / 0.2); // tek önbellekli sprite; titreme alfa ile
    const fx = p.dig ? p.digDir[0] : p.dx, fy = p.dig ? p.digDir[1] : p.dy;
    glow(x + fx * 18, y + fy * 18, 'rgba(255,230,160,0.07)', 34);
    const S = playerSprites(p.helm);
    const ex = sprEm(S.idle, p.face < 0);
    if (ex) ctx.drawImage(ex, Math.round(x) - 6, Math.round(y) - 9);
    if (p.carrying) glow(x, y - 20, 'rgba(255,60,110,0.45)', 14);
    const tier = pickTier();
    if (tier.glow && p.pickHead) {
      const ph = p.pickHead, pulse = 0.7 + Math.sin(t * 6 + p.i) * 0.3;
      glow(ph.x, ph.y, tier.glow, 7, pulse);
      ctx.globalAlpha = 0.6 + pulse * 0.4; ctx.fillStyle = tier.headL; ctx.fillRect(Math.round(ph.tx), Math.round(ph.ty), 1, 1); ctx.globalAlpha = 1;
      // kristal/kobalt kazma ara sıra göz kırpar
      if (((t * 2 + p.i) % 1.7) < 0.1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(ph.x) - 1, Math.round(ph.y), 3, 1); ctx.fillRect(Math.round(ph.x), Math.round(ph.y) - 1, 1, 3); }
    }
    if (p.recallT > 0) glow(x, y, 'rgba(159,232,255,0.4)', 18, 0.6 + Math.sin(t * 12) * 0.3);
    // eserler: taç parıltısı, Devin Kalbi nabzı, Yaratılış Kıvılcımı kazma ışığı
    if (hasRelic('tac')) glow(x, y - 12, 'rgba(255,210,74,0.35)', 8, 0.6 + Math.sin(t * 3 + p.i) * 0.3);
    if (hasRelic('arken')) { glow(x, y, 'rgba(210,235,255,0.35)', 22, 0.7 + Math.sin(t * 2.2 + p.i) * 0.3); glow(x, y - 1, 'rgba(255,255,255,0.6)', 5, 1); if (((t * 1.5 + p.i) % 1.1) < 0.12) { ctx.fillStyle = '#ffffff'; const ax = Math.round(x + (hash2(p.i, Math.floor(t * 1.5), 2) - 0.5) * 18), ay = Math.round(y - 2 + (hash2(p.i, Math.floor(t * 1.5), 4) - 0.5) * 18); ctx.fillRect(ax - 1, ay, 3, 1); ctx.fillRect(ax, ay - 1, 1, 3); } }
    if (hasRelic('kalp') && !p.kalpUsed) { const hb = (t * 1.3 + p.i) % 1; glow(x, y, 'rgba(255,60,90,0.28)', Math.round(12 + (hb < 0.15 ? 8 : hb < 0.3 ? 4 : 0)), hb < 0.3 ? 1 : 0.5); }
    if (hasRelic('kivilcim') && p.pickHead) { const ph = p.pickHead; glow(ph.x, ph.y, 'rgba(255,240,160,0.6)', 10, 0.7 + Math.sin(t * 9 + p.i) * 0.3); if (Math.floor(t * 10 + p.i) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(ph.tx) - 1, Math.round(ph.ty), 3, 1); ctx.fillRect(Math.round(ph.tx), Math.round(ph.ty) - 1, 1, 3); } }
    if ((G.gear.active.overdrive || 0) > 0) { const sp2 = shoulderPos(p); glow(sp2.x, sp2.y, 'rgba(255,231,154,0.5)', 10, 0.6 + Math.sin(t * 25) * 0.4); }
  }
  // yıldırım sıçramaları (zincir eklentisi)
  for (const z of G.zaps) {
    const k = z.t / 0.12;
    ctx.globalAlpha = k;
    const mx = (z.x0 + z.x1) / 2 + Math.round((hash2(Math.floor(t * 40), 1, 3) - 0.5) * 6), my = (z.y0 + z.y1) / 2 + Math.round((hash2(Math.floor(t * 40), 2, 3) - 0.5) * 6);
    const zc = z.col || '#bff4ff';
    pline(z.x0, z.y0, mx, my, zc); pline(mx, my, z.x1, z.y1, zc);
    pline(z.x0, z.y0 + 1, mx, my + 1, z.col ? 'rgba(255,230,160,0.5)' : 'rgba(120,200,255,0.5)'); pline(mx, my + 1, z.x1, z.y1 + 1, z.col ? 'rgba(255,230,160,0.5)' : 'rgba(120,200,255,0.5)');
    ctx.globalAlpha = 1;
    glow(z.x1, z.y1, z.col ? 'rgba(255,240,180,0.6)' : 'rgba(150,220,255,0.5)', z.col ? 10 : 6, k);
  }
  // cevher parıltıları ve sandık/kalp
  const sparkle = hasRelic('arken');
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const tt = G.map[r * COLS + c], d = TD[tt];
    if (d.gem) { const f = 0.55 + Math.sin(t * 3 + c * 2 + r) * 0.3; glow(c * TILE + 8, r * TILE + 8, gemGlow(d.gem), 12, f); }
    if (d.ore) {
      const L = lightAtTile(c, r);
      if (L < 0.05 && !sparkle && !G.rev[r * COLS + c]) continue;
      const ph = hash2(c, r, 5) * 10;
      const k = (t * 0.8 + ph) % 3.2;
      if (k < 0.4) {
        const gx = c * TILE + 3 + Math.floor(hash2(c, r, 100) * 9), gy = r * TILE + 3 + Math.floor(hash2(c, r, 200) * 9);
        const a = (1 - Math.abs(k - 0.2) / 0.2) * (0.5 + L * 0.5);
        ctx.globalAlpha = a;
        ctx.fillStyle = ORE_RAMP[d.ore][3];
        ctx.fillRect(gx, gy - 1, 1, 3); ctx.fillRect(gx - 1, gy, 3, 1);
        ctx.globalAlpha = 1;
      }
      if (d.ore === 'crystal' || d.ore === 'cobalt') glow(c * TILE + 8, r * TILE + 8, d.ore === 'crystal' ? 'rgba(224,112,255,0.18)' : 'rgba(90,134,255,0.14)', 10);
      else if (d.ore === 'gold') glow(c * TILE + 8, r * TILE + 8, 'rgba(255,210,74,0.16)', 10, 0.7 + Math.sin(t * 3 + c) * 0.3);
    } else if (d.ember) {
      const f = 0.5 + Math.sin(t * 5 + c * 2 + r) * 0.3; glow(c * TILE + 8, r * TILE + 8, 'rgba(255,120,40,0.3)', 12, f);
      const gx = c * TILE + 3 + Math.floor(hash2(c, r, 100) * 9), gy = r * TILE + 3 + Math.floor(hash2(c, r, 200) * 9);
      ctx.globalAlpha = f; ctx.fillStyle = '#ffd24a'; ctx.fillRect(gx, gy, 1, 1); ctx.globalAlpha = 1;
    } else if (d.chest) {
      sprE(SPR.chests[d.chest], c * TILE + 8, r * TILE + 9);
      glow(c * TILE + 8, r * TILE + 9, CHEST_GLOW[d.chest] || CHEST_GLOW.wood, d.chest === 'gold' || d.chest === 'ancient' ? 14 : 10, 0.6 + Math.sin(t * 3) * 0.3);
    } else if (tt === T.HEART) {
      sprE(SPR.heart, c * TILE + 8, r * TILE + 8 + Math.round(Math.sin(t * 2)));
      glow(c * TILE + 8, r * TILE + 8, 'rgba(255,58,106,0.5)', 26, 0.7 + Math.sin(t * 2) * 0.2);
    } else if (tt === T.ARKEN) {
      // Arkentaş: dağın kalbi; beyaz-mavi nabız, dönen ışınlar ve etrafında süzülen kıvılcımlar
      const rx = c * TILE + 8, ry = r * TILE + 8, pu = 0.75 + Math.sin(t * 2.2) * 0.25;
      sprE(SPR.arken[Math.floor(t * 3) % 2], rx, ry);
      glow(rx, ry, 'rgba(210,235,255,0.55)', 46, pu); glow(rx, ry, 'rgba(255,255,255,0.7)', 16, 0.8 + Math.sin(t * 7) * 0.2);
      ctx.globalAlpha = 0.35 + Math.sin(t * 2.2) * 0.2;
      for (let i = 0; i < 6; i++) { const a = t * 0.6 + i * Math.PI / 3, L = 18 + Math.sin(t * 3 + i) * 6; pline(rx + Math.cos(a) * 8, ry + Math.sin(a) * 6, rx + Math.cos(a) * L, ry + Math.sin(a) * L * 0.8, '#e8f4ff'); }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 5; i++) { const a = t * 1.1 + i * 1.26, rr = 13 + Math.sin(t * 1.7 + i * 2) * 4; ctx.fillStyle = i % 2 ? '#ffffff' : '#bfe0ff'; ctx.fillRect(Math.round(rx + Math.cos(a) * rr), Math.round(ry + Math.sin(a) * rr * 0.7), 1, 1); }
    } else if (tt === T.RELIC) {
      const rx = c * TILE + 8, ry = r * TILE + 8 + Math.round(Math.sin(t * 1.6));
      sprE(SPR.relic, rx, ry);
      glow(rx, ry, 'rgba(255,220,120,0.5)', 30, 0.7 + Math.sin(t * 1.6) * 0.25);
      // dönen ışık zerreleri
      for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * Math.PI / 2; ctx.fillStyle = i % 2 ? '#ffffff' : '#ffd870'; ctx.fillRect(Math.round(rx + Math.cos(a) * 11), Math.round(ry + Math.sin(a) * 6), 1, 1); }
    } else if (tt === T.VAULT) {
      // kilitli kaya rozeti nabız gibi parlar: "burada bir şey var"
      const L = lightAtTile(c, r); if (L < 0.06) continue;
      glow(c * TILE + 8, r * TILE + 8, 'rgba(200,140,220,0.25)', 6, 0.5 + Math.sin(t * 2.5 + c) * 0.4);
    } else if (tt === T.AIR) {
      const k = decorAt(c, r); if (!k) continue;
      const x = c * TILE + 3 + Math.floor(hash2(c, r, 78) * 9), y = r * TILE + 16;
      const pulse = 0.5 + Math.sin(t * 2 + c * 1.7 + r) * 0.25;
      if (k === 'mush') { glow(x, y - 4, 'rgba(120,200,255,0.35)', 7, pulse); ctx.fillStyle = '#9ad8ff'; ctx.fillRect(x - 1, y - 4, 2, 1); }
      else if (k === 'crys') { glow(x, y - 4, 'rgba(224,112,255,0.35)', 8, pulse); ctx.fillStyle = '#f0b0ff'; ctx.fillRect(x, y - 5, 1, 2); }
      else if (k === 'root') { const len = 5 + Math.floor(hash2(c, r, 79) * 6); glow(x, r * TILE + len, 'rgba(150,230,120,0.3)', 5, pulse); ctx.fillStyle = '#c8ff90'; ctx.fillRect(x, r * TILE + len, 1, 1); }
      else if (k === 'icicle') { glow(x, r * TILE + 3, 'rgba(160,230,255,0.22)', 6, pulse); }
      else if (k === 'ember') { const f = 0.6 + Math.sin(t * 9 + c * 3) * 0.3; glow(x, y - 2, 'rgba(255,140,60,0.4)', 9, f); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 1, y - 2, 1, 1); if (Math.floor(t * 6 + c) % 2) ctx.fillRect(x + 1, y - 2, 1, 1); }
      else if (k === 'shard') { glow(x + 1, y - 6, 'rgba(140,120,200,0.25)', 5, pulse); }
      else if (k === 'star') { const oy = Math.round(Math.sin(t * 1.5 + c * 2 + r) * 2); glow(x, y - 8 + oy, 'rgba(140,120,255,0.45)', 7, pulse); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 8 + oy, 1, 1); }
    }
  }
  // yuvalar: uyuyanlar hafif, uyanıklar hızlı nabız
  for (const n of G.nests) {
    if (n.r < r0 || n.r > r1 || G.buried[n.r * COLS + n.c]) continue;
    const aw = n.awake, a = aw ? 0.7 + Math.sin(t * 8 + n.pulse) * 0.3 : 0.35 + Math.sin(t * 1.6 + n.pulse) * 0.15;
    glow(n.x, n.y, aw ? 'rgba(255,60,90,0.8)' : 'rgba(200,60,120,0.5)', aw ? 22 : 14, a);
    sprE(SPR.nest[aw ? Math.floor(t * 6) % 2 : Math.floor(t * 1.5) % 2], n.x, n.y + 8);
  }
  // fenerler
  for (const s2 of G.beacons) {
    const r = GROUND_ROW + s2 * STRATUM_ROWS; if (r < r0 - 2 || r > r1 + 2) continue;
    glow(BASE_X + 14, r * TILE - 3, 'rgba(255,220,120,0.5)', 16, 0.8 + Math.sin(t * 3) * 0.2);
  }
  // yapı ışıkları
  for (const s2 of G.structures) {
    if (s2.type === 'direk') {
      glow(s2.x, s2.y - 15, 'rgba(95,224,184,0.4)', s2.on ? 12 : 8, s2.on ? 0.7 + Math.sin(t * 6) * 0.3 : 0.6);
      // şifa alanı: madenci yakındayken kesik halka
      if (Math.hypot(G.player.x - s2.x, G.player.y - s2.y) < 90) {
        const R = BUILDS.direk.range, n = 40; ctx.globalAlpha = s2.on ? 0.7 : 0.35; ctx.fillStyle = '#5fe0b8';
        for (let i = 0; i < n; i++) if ((i + Math.floor(t * 4)) % 2) { const a = i / n * Math.PI * 2; ctx.fillRect(Math.round(s2.x + Math.cos(a) * R), Math.round(s2.y - 6 + Math.sin(a) * R), 1, 1); }
        ctx.globalAlpha = 1;
      }
    } else glow(s2.x, s2.y - 11, 'rgba(242,193,78,0.3)', s2.on ? 9 : 6);
  }
  for (const b2 of G.bells) { drawBell(b2); glow(b2.x, b2.y - 1, 'rgba(255,210,74,0.5)', b2.left > 0 ? 6 : Math.round(9 + Math.sin(t * 12) * 2)); }
  // fitil, gaz
  for (const b2 of G.bombs) { sprE(SPR.dynamite, b2.x, b2.y - 4); glow(b2.x, b2.y - 8, 'rgba(255,200,100,0.5)', 6); }
  for (const g of G.gas) if (!g.dead) glow(g.x, g.y, 'rgba(130,200,60,0.12)', Math.max(4, Math.round(g.rad)), Math.min(1, g.t));
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    if (G.map[r * COLS + c] !== T.GAS) continue;
    const L = lightAtTile(c, r);
    if (L < 0.08) continue;
    ctx.globalAlpha = 0.35 + Math.sin(t * 2 + c * 3 + r) * 0.2;
    ctx.fillStyle = '#9ad050';
    for (let i = 0; i < 3; i++) ctx.fillRect(c * TILE + 2 + Math.floor(hash2(c, r, 40 + i) * 12), r * TILE + 2 + Math.floor(hash2(c, r, 60 + i) * 12), 1, 1);
    ctx.globalAlpha = 1;
  }
  // düşman gözleri: karanlıkta görünür; ara sıra göz kırpar
  for (const e of G.enemies) {
    if (e.bs && !e.dead) drawBossFx(e, alpha);
    if (e.type === 'dunyaYilani') { drawSerpentGlow(ctx, e, alpha, glow); continue; }
    // ekran dışındaki düşmanın ışıması çizilmez (bossların 3B modeli her kare boşuna yeniden rasterlenmesin); drawEnemy ile aynı pay
    { const ey = lerp(e.py, e.y, alpha), m = hasBossArt(e) ? 240 : 90; if (ey < r0 * TILE - m || ey > (r1 + 1) * TILE + m) continue; }
    if (e.type === 'balrog') { drawBalrogGlow(ctx, e, alpha, glow); continue; }
    if (e.type === 'ejder') { drawDragonGlow(ctx, e, alpha, glow); continue; }
    if (hasBossArt(e) && !e.under && drawBossArtGlow(ctx, e, alpha, glow)) continue;
    if (e.emergeT > 0 || e.dead || e.under || e.sink > 0) continue;
    const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
    if (e.d.boss) {
      const rage = e.bs && e.bs.phase === 2;
      glow(x, y, rgba(e.d.col, rage ? 0.4 : 0.25), rage ? 30 : 22, 0.6 + Math.sin(t * (rage ? 8 : 3)) * 0.3);
      if (e.wind > 0) glow(x, y, 'rgba(255,255,255,0.5)', Math.round(8 + e.wind * 16), e.wind);
      if (e.flashT > 0) glow(x, y, rgba(e.d.col, 0.8), 26, Math.min(1, e.flashT));
    }
    const blink = ((t * 1.3 + e.wob) % 3.7) < 0.12 && !e.d.boss;
    if (hasMob(e)) drawMobGlow(ctx, e);
    else if (!blink) { const Q = enemyPose(e, alpha); sprEScaled(Q.f, Q.ox, Q.feet, Q.sx, Q.sy, Q.flip); }
    if (e.d.boom) { const p = G.player, d = Math.hypot(p.x - x, p.y - y); glow(x, y, 'rgba(224,112,255,0.3)', 10, 0.6 + Math.sin(t * (d < 40 ? 18 : 6)) * 0.4); }
    if (e.type === 'glarer') {
      glow(x, y, 'rgba(255,231,154,0.3)', 12, 0.7 + Math.sin(t * 4 + e.wob) * 0.3);
      if (e.flashT > 0) { const k = e.flashT / 0.35; glow(x, y, 'rgba(255,250,230,0.9)', Math.round(50 * (1.2 - k)), k); }
      else if (e.blindCd < 0.6) glow(x, y, 'rgba(255,255,255,0.6)', 8, 1 - e.blindCd / 0.6);
    }
    if (e.type === 'howler' && e.howlT > 0) { const k = e.howlT / 0.9; glow(x + e.face * 6, y, 'rgba(200,140,180,0.35)', Math.round(30 * (1.1 - k)), k); }
    if (e.type === 'shade') glow(x, y - 4, 'rgba(232,240,255,0.25)', 6, 0.5 + Math.sin(t * 7) * 0.3);
    if (e.type === 'magmite') glow(x, y, 'rgba(255,120,40,0.35)', 9, 0.6 + Math.sin(t * 8 + e.wob) * 0.3);
    if (e.type === 'voidling') { glow(x, y, 'rgba(120,100,255,0.35)', 12, 0.6 + Math.sin(t * 3 + e.wob) * 0.3); if (e.blinkT > 0) glow(x, y, 'rgba(200,190,255,0.8)', Math.round(26 * (1 - e.blinkT / 0.3) + 6), e.blinkT / 0.3); }
    if (e.type === 'frostbat') glow(x, y, 'rgba(160,220,255,0.2)', 8, 0.7);
    if (e.type === 'sinek') glow(x, y, FLY_GLOW[e.bio] || FLY_GLOW[6], 5, 0.6 + Math.sin(t * 9 + e.wob) * 0.4);
    if (e.type === 'altinBocek') glow(x, y, 'rgba(255,210,74,0.3)', 7, 0.6 + Math.sin(t * 5 + e.wob) * 0.3);
    if (e.type === 'kirpi' && e.flashT > 0) glow(x, y, 'rgba(230,200,255,0.6)', 14, e.flashT / 0.3);
    if (e.type === 'kafatasi') glow(x, y, 'rgba(255,240,200,0.35)', Math.round(5 + (1 - Math.min(1, (e.riseT ?? 2.5) / 2.5)) * 8), 0.5 + Math.sin(t * 14) * 0.3);
    if (e.type === 'voltbat') glow(x, y, 'rgba(90,160,255,0.35)', e.flashT > 0 ? 16 : 8, e.flashT > 0 ? 1 : 0.6 + Math.sin(t * 9 + e.wob) * 0.3);
    if (e.type === 'seraph' && e.beamT > 0) glow(x, y, 'rgba(255,244,192,0.7)', Math.round(10 + (1 - e.beamT / 0.9) * 14), 1);
    if (e.type === 'chronoling' && e.rewindCd < 0.8) glow(x, y, 'rgba(255,216,144,0.6)', 14, 1 - e.rewindCd / 0.8);
    if (e.type === 'leech' && e.scale > 1.05) glow(x, y, 'rgba(220,40,60,0.3)', Math.round(8 * e.scale), 0.6);
    if (e.elite) { glow(x, y, 'rgba(255,210,74,0.35)', Math.round(14 * (e.scale || 1)), 0.6 + Math.sin(t * 5 + e.wob) * 0.3); if (((t * 3 + e.wob) % 1) < 0.15) { ctx.fillStyle = '#fff4c0'; ctx.fillRect(Math.round(x + (hash2(e.wob, Math.floor(t * 3), 2) - 0.5) * 16), Math.round(y - 4 + (hash2(e.wob, Math.floor(t * 3), 4) - 0.5) * 16), 1, 1); } }
  }
  // mermiler
  for (const bl of G.bullets) {
    if (bl.blast) { const c = bl.freeze ? '#bff4ff' : '#ffb050'; pline(bl.px, bl.py, bl.x, bl.y, c); ctx.fillStyle = P.ink; ctx.fillRect(Math.round(bl.x) - 2, Math.round(bl.y) - 2, 4, 4); ctx.fillStyle = bl.freeze ? '#ffffff' : '#ffe79a'; ctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 1, 2, 2); glow(bl.x, bl.y, bl.freeze ? 'rgba(190,240,255,0.5)' : 'rgba(255,170,80,0.5)', 7); continue; }
    const col = bl.fire ? '#ff9a4a' : bl.frost ? '#bff4ff' : bl.chain ? '#c8f0ff' : '#ffe79a';
    pline(bl.px, bl.py, bl.x, bl.y, 'rgba(255,220,140,0.6)');
    ctx.fillStyle = col; ctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 1, 2, 2);
  }
  for (const bl of G.ebullets) {
    const bx = Math.round(bl.x), by = Math.round(bl.y);
    if (bl.orb) { ctx.fillStyle = '#8060ff'; ctx.fillRect(bx - 2, by - 2, 5, 5); ctx.fillStyle = Math.floor(t * 10) % 2 ? '#ffffff' : '#e0c8ff'; ctx.fillRect(bx - 1, by - 1, 3, 3); glow(bl.x, bl.y, 'rgba(176,128,255,0.5)', 10); continue; }
    if (bl.coin) { ctx.fillStyle = '#ffd870'; const w = Math.floor(t * 12 + bl.x) % 2 ? 3 : 1; ctx.fillRect(bx - (w >> 1), by - 1, w, 3); ctx.fillStyle = '#fff4c0'; ctx.fillRect(bx, by - 1, 1, 1); glow(bl.x, bl.y, 'rgba(255,216,112,0.4)', 6); continue; }
    if (bl.col) { ctx.fillStyle = bl.col; ctx.fillRect(bx - 1, by - 1, 3, 3); glow(bl.x, bl.y, rgba(bl.col, 0.35), 6); continue; }
    if (bl.web) {
      const bx = Math.round(bl.x), by = Math.round(bl.y), sp2 = Math.floor(t * 12) % 2;
      ctx.fillStyle = '#f0f0ff'; ctx.fillRect(bx - 2, by, 5, 1); ctx.fillRect(bx, by - 2, 1, 5); if (sp2) { ctx.fillRect(bx - 1, by - 1, 1, 1); ctx.fillRect(bx + 1, by + 1, 1, 1); } else { ctx.fillRect(bx + 1, by - 1, 1, 1); ctx.fillRect(bx - 1, by + 1, 1, 1); }
      glow(bl.x, bl.y, 'rgba(240,240,255,0.3)', 5);
    } else {
      ctx.fillStyle = '#9af060'; ctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 1, 3, 3);
      glow(bl.x, bl.y, 'rgba(154,240,96,0.4)', 6);
    }
  }
  // küreler
  for (const o of G.orbs) drawOrb(o.x, o.y, o.res);
  for (const o of G.deposit) if (o.t >= 0) drawOrb(o.x, o.y, o.res);
  // kıvılcımlar ve halkalar
  for (const q of G.particles) {
    if (q.dead) continue;
    if (q.type === 1) { ctx.globalAlpha = Math.min(1, q.life / q.t0 * 1.5); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
    else if (q.type === 3) {
      const k = 1 - q.life / q.t0;
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(Math.round(q.x), Math.round(q.y), 2 + q.size * k, 0, 7); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const p = G.player;
  // yakındaki alet: geri alınabilir işareti (dokun)
  if (!opts.hidePlayer && !p.dead) for (const s2 of G.structures) {
    if (BUILDS[s2.type].once || Math.hypot(s2.x - p.x, s2.y - p.y) > 40) continue;
    const x = Math.round(s2.x), y = Math.round(s2.y) - 22 + Math.round(Math.sin(t * 3) * 1.5);
    ctx.fillStyle = P.ink; ctx.fillRect(x - 3, y - 1, 7, 3); ctx.fillRect(x - 1, y - 3, 3, 7);
    ctx.fillStyle = P.helm; ctx.fillRect(x - 2, y, 5, 1);
  }
}

function drawOrb(x, y, res) {
  const R = ORE_RAMP[res];
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = R[1]; ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = R[2]; ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.fillStyle = R[3]; ctx.fillRect(x - 1, y - 1, 1, 1);
  glow(x, y, RES_COL[res], 5, 0.35);
}

// UI için: dünya -> ekran oranı
export function worldToView(x, y) { return { x: (x - G.cam.x) / view.vw, y: (y - G.cam.y) / view.vh }; }
export function viewToWorld(fx, fy) { return { x: fx * view.vw + G.cam.x, y: fy * view.vh + G.cam.y }; }
