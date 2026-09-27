// Kare çizimi: gökyüzü -> kaya -> nesneler -> ışık -> ışık yayanlar.
import { COLS, ROWS, TILE, GROUND_Y, GROUND_ROW, WORLD_W, WORLD_H, BASE_X, PAD_COLS, PAD_Y, stratumOfRow } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { P, RES_COL, ORE_RAMP, STRATA } from '../data/palette.js';
import { G } from '../game/state.js';
import { SPR, sprCanvas, sprEm, glowSprite } from './sprites.js';
import { drawTiles, flushDirty } from './tiles.js';
import { computeLight, lightWin, lightSourcesFor, glowTileSources } from '../world/light.js';
import { lampTiles, hasPerk } from '../game/run.js';
import { shoulderPos, BASE_GUN } from '../game/combat.js';
import { barricadeTarget } from '../game/economy.js';
import { tileDamage01 } from '../world/map.js';
import { hexToRgb, hash2, damp, clamp, lerp } from '../core/util.js';

export const view = { vw: 240, vh: 480, scale: 3, cssW: 0, cssH: 0 };
let cv, ctx, lightCv, lightCtx, lightImg, skyCv = null, skyW = 0;
const SKY_TOP = -176;

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
  let ty = p.y - view.vh * 0.42;
  if (p.dig && p.digDir[1] > 0) ty += 18;
  else if (p.moving && p.dy > 0.5) ty += 10;
  ty = clamp(ty, minY, maxY);
  const tx = clamp(p.x - view.vw / 2, 0, Math.max(0, WORLD_W - view.vw));
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
  // yıldızlar
  for (let i = 0; i < 26; i++) {
    const sx = Math.floor(hash2(i, 1, 9) * w), sy = Math.floor(hash2(i, 2, 9) * h * 0.4);
    x.fillStyle = hash2(i, 3, 9) < 0.3 ? '#fff4d8' : 'rgba(220,210,255,0.6)'; x.fillRect(sx, sy, 1, 1);
  }
  // güneş (ufukta, tepelerin arkasında)
  const sx = Math.floor(w * 0.72), sy = horizon + 2;
  x.fillStyle = '#f7b074'; x.beginPath(); x.arc(sx, sy, 17, 0, 7); x.fill();
  x.fillStyle = P.sun; x.beginPath(); x.arc(sx, sy, 13, 0, 7); x.fill();
  x.fillStyle = '#fff0c4'; x.beginPath(); x.arc(sx, sy, 9, 0, 7); x.fill();
  // tepeler: uzak ve yakın
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
  // ağaç siluetleri
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
  // yavaş bulutlar
  const t = G.time;
  ctx.fillStyle = 'rgba(200,120,140,0.35)';
  for (const [fx, y, w] of CLOUDS) {
    const x = Math.round(((fx * view.vw + t * 2.2) % (view.vw + w * 2)) - w);
    const yy = Math.round(SKY_TOP + y - camY);
    ctx.fillRect(x, yy, w, 2); ctx.fillRect(x + 3, yy - 2, w - 8, 2); ctx.fillRect(x + 7, yy - 3, 6, 1);
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
function spr(s, x, y, flip = false, white = false) {
  ctx.drawImage(sprCanvas(s, flip, white), Math.round(x - s.w / 2), Math.round(y - s.h / 2));
}
function sprE(s, x, y, flip = false) {
  const e = sprEm(s, flip); if (e) ctx.drawImage(e, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
}
function glow(x, y, col, r, a = 1) {
  const g = glowSprite(col, r);
  ctx.globalAlpha = a;
  ctx.drawImage(g, Math.round(x - r), Math.round(y - r));
  ctx.globalAlpha = 1;
}

// ---------- ana çizim ----------
export function render(alpha, opts = {}) {
  flushDirty();
  const cam = G.cam;
  const sh = cam.trauma * cam.trauma * 5;
  const camX = Math.round(lerp(cam.px, cam.x, alpha) + (Math.random() - 0.5) * sh + cam.kx);
  const camY = Math.round(lerp(cam.py, cam.y, alpha) + (Math.random() - 0.5) * sh + cam.ky);
  const vw = view.vw, vh = view.vh;
  const st = Math.max(0, stratumOfRow(Math.floor((camY + vh / 2) / TILE)));
  const dk = STRATA[st].dark;
  ctx.fillStyle = `rgb(${dk[0]},${dk[1]},${dk[2]})`;
  ctx.fillRect(0, 0, vw, vh);

  drawSky(camX, camY);
  ctx.save();
  ctx.translate(-camX, -camY);
  // kaya
  ctx.restore();
  drawTiles(ctx, camX, camY, vw, vh);
  ctx.save();
  ctx.translate(-camX, -camY);

  const r0 = Math.max(0, Math.floor(camY / TILE) - 1), r1 = Math.min(ROWS - 1, Math.floor((camY + vh) / TILE) + 1);
  drawTileOverlays(r0, r1);
  drawPads();
  drawBase();
  for (const s of G.structures) drawStructure(s);
  if (G.satchel) { const s = G.satchel; spr(SPR.satchel, s.x, s.y + Math.sin(G.time * 3) * 1.5); }
  // enkaz ve toz (ışıktan etkilenir)
  for (const p of G.particles) {
    if (p.dead || p.type === 1 || p.type === 3) continue;
    if (p.type === 2) { ctx.globalAlpha = Math.max(0, p.life / p.t0) * 0.7; }
    ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    ctx.globalAlpha = 1;
  }
  for (const e of G.enemies) drawEnemy(e, alpha, camY, vh);
  if (!opts.hidePlayer) drawPlayer(alpha);
  ctx.restore();

  // ---- ışık ----
  const lr0 = Math.max(0, Math.floor(camY / TILE) - 2), lr1 = Math.min(ROWS - 1, Math.floor((camY + vh) / TILE) + 2);
  const src = lightSourcesFor(G, opts.hidePlayer ? 0 : lampTiles());
  glowTileSources(G, lr0, lr1, src);
  if (G.satchel) src.push({ x: G.satchel.x, y: G.satchel.y, s: 2.5 });
  computeLight(lr0, lr1, src, opts.hidePlayer ? 0.42 : 0.26);
  drawLight(camX, camY, dk);

  // ---- ışık yayanlar ----
  ctx.save();
  ctx.translate(-camX, -camY);
  drawEmissive(r0, r1, alpha, opts);
  ctx.restore();
  if (G.wave.phase === 'warn' && !opts.hidePlayer) drawNestArrows(camX, camY);
}

// ekran dışındaki yuvalar için kenar okları
function drawNestArrows(camX, camY) {
  const vw = view.vw, vh = view.vh, t = G.time;
  const pulse = Math.floor(t * 4) % 2 === 0;
  for (const n of G.wave.nests) {
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

function drawTileOverlays(r0, r1) {
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const t = G.map[r * COLS + c];
    const x = c * TILE, y = r * TILE;
    if (t === T.BARRICADE) drawBarricade(x, y, c, r);
    else if (t === T.CHEST) spr(SPR.chest, x + 8, y + 9);
    else if (t === T.HEART) spr(SPR.heart, x + 8, y + 8 + Math.round(Math.sin(G.time * 2) * 1));
    if (TD[t].solid && G.dmg[r * COLS + c] > 0) {
      const f = tileDamage01(c, r);
      if (f > 0) ctx.drawImage(SPR.cracks[Math.min(4, Math.floor(f * 5))], x, y);
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

function drawPads() {
  const surface = G.player.y < GROUND_Y + 40;
  for (let i = 0; i < PAD_COLS.length; i++) {
    const x = PAD_COLS[i] * TILE + 8, y = GROUND_Y;
    ctx.fillStyle = P.ink; ctx.fillRect(x - 8, y - 3, 16, 3);
    ctx.fillStyle = '#5a6278'; ctx.fillRect(x - 7, y - 3, 14, 1);
    ctx.fillStyle = '#3a4058'; ctx.fillRect(x - 7, y - 2, 14, 1);
  }
}

function drawBase() {
  const b = G.base, s = SPR.base;
  const shake = b.hurtT > 0 ? Math.round((Math.random() - 0.5) * 2) : 0;
  ctx.drawImage(s.cv, Math.round(b.x - s.w / 2) + shake, GROUND_Y - s.h);
  // çatı topu
  const gx = BASE_GUN.x + shake, gy = BASE_GUN.y;
  const a = b.aim ?? -2.4, rc = (b.recoil > 0 ? b.recoil : 0) * 2;
  pline(gx + Math.cos(a) * 2, gy + Math.sin(a) * 2, gx + Math.cos(a) * (8 - rc), gy + Math.sin(a) * (8 - rc), P.ink);
  pline(gx + Math.cos(a) * 2, gy + Math.sin(a) * 2 - 1, gx + Math.cos(a) * (7 - rc), gy + Math.sin(a) * (7 - rc) - 1, P.metal);
  ctx.fillStyle = P.ink; ctx.fillRect(gx - 4, gy - 2, 8, 5);
  ctx.fillStyle = '#6a7898'; ctx.fillRect(gx - 3, gy - 1, 6, 3);
  ctx.fillStyle = '#8a9ab8'; ctx.fillRect(gx - 3, gy - 1, 6, 1);
  // hasar izleri
  const f = b.hp / b.maxHp;
  if (f < 0.6) { ctx.fillStyle = P.ink; ctx.fillRect(b.x - 18, GROUND_Y - 20, 3, 1); ctx.fillRect(b.x + 12, GROUND_Y - 14, 1, 3); }
  if (f < 0.3) { ctx.fillStyle = P.ink; ctx.fillRect(b.x - 6, GROUND_Y - 26, 4, 1); ctx.fillRect(b.x + 20, GROUND_Y - 22, 2, 2); }
}

function drawStructure(s) {
  const x = Math.round(s.x), y = Math.round(s.y);
  const pop = s.buildT > 0 ? Math.round(s.buildT * 8) : 0;
  const white = s.hurtT > 0;
  if (s.type === 'turret') {
    // tripod
    ctx.fillStyle = P.ink; ctx.fillRect(x - 5, y - 1 + pop, 11, 4);
    ctx.fillStyle = P.metalD; ctx.fillRect(x - 4, y + pop, 9, 2);
    ctx.fillStyle = P.ink; ctx.fillRect(x - 1, y - 4 + pop, 3, 4);
    // namlu
    const ax = Math.cos(s.aim), ay = Math.sin(s.aim), rc = (s.recoil > 0 ? s.recoil : 0) * 2;
    const hx = x, hy = y - 6 + pop;
    pline(hx + ax * 2, hy + ay * 2, hx + ax * (9 - rc), hy + ay * (9 - rc), P.ink);
    pline(hx + ax * 2, hy + ay * 2 - 1, hx + ax * (8 - rc), hy + ay * (8 - rc) - 1, P.metal);
    // gövde
    ctx.fillStyle = P.ink; ctx.fillRect(hx - 4, hy - 3, 9, 7);
    ctx.fillStyle = white ? '#fff' : '#6a7898'; ctx.fillRect(hx - 3, hy - 2, 7, 5);
    ctx.fillStyle = white ? '#fff' : '#8a9ab8'; ctx.fillRect(hx - 3, hy - 2, 7, 1);
    ctx.fillStyle = '#f2c14e'; ctx.fillRect(hx - 1, hy, 3, 1);
  } else {
    ctx.fillStyle = P.ink; ctx.fillRect(x - 6, y - 9 + pop, 13, 12);
    ctx.fillStyle = white ? '#fff' : '#3e5a58'; ctx.fillRect(x - 5, y - 8 + pop, 11, 10);
    ctx.fillStyle = white ? '#fff' : '#5a807a'; ctx.fillRect(x - 5, y - 8 + pop, 11, 1);
    ctx.fillStyle = P.ink; ctx.fillRect(x - 3, y - 6 + pop, 7, 7);
    ctx.fillStyle = '#1c3a34'; ctx.fillRect(x - 2, y - 5 + pop, 5, 5);
    ctx.fillStyle = P.ink; ctx.fillRect(x, y - 13 + pop, 1, 4);
  }
  if (s.hp < s.maxHp) {
    const w = 12, f = Math.max(0, s.hp / s.maxHp);
    ctx.fillStyle = P.ink; ctx.fillRect(x - w / 2 - 1, y - 17, w + 2, 3);
    ctx.fillStyle = f < 0.35 ? P.bad : '#5fe0b8'; ctx.fillRect(x - w / 2, y - 16, Math.round(w * f), 1);
  }
}

const EN_OFFSET = { rodent: 1, bug: 1, spitter: 2, flyer: -2, boomer: 1, brute: 1, boss: 0 };
function drawEnemy(e, alpha, camY, vh) {
  const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
  if (y < camY - 30 || y > camY + vh + 30) return;
  const frames = SPR[e.type], f = frames[Math.floor(e.anim) % 2];
  const flip = e.face < 0;
  const lx = (e.lunge || 0) * 3 * e.face;
  let ox = x + lx, oy = y + (EN_OFFSET[e.type] || 0) - f.h / 2 + 4;
  if (e.d.boss || e.type === 'brute') oy = y - 2;
  else oy = y - 1;
  if (e.emergeT > 0) {
    const k = Math.min(1, e.emergeT / 0.9);
    ctx.save(); ctx.beginPath(); ctx.rect(ox - 20, oy - 20, 40, 20 + f.h / 2 - k * f.h); ctx.clip();
    spr(f, ox, oy + k * f.h * 0.6, flip); ctx.restore();
    return;
  }
  spr(f, ox, oy, flip, e.hitT > 0);
  if (e.hp < e.maxHp && !e.d.boss) {
    const w = Math.max(8, f.w - 4), fr = Math.max(0, e.hp / e.maxHp);
    const bx = Math.round(ox - w / 2), by = Math.round(oy - f.h / 2 - 3);
    ctx.fillStyle = P.ink; ctx.fillRect(bx - 1, by - 1, w + 2, 3);
    ctx.fillStyle = '#ec4a4a'; ctx.fillRect(bx, by, Math.max(1, Math.round(w * fr)), 1);
  }
}

function drawPlayer(alpha) {
  const p = G.player;
  if (p.dead) return;
  if (p.iframes > 0 && p.hurtT <= 0 && Math.floor(p.iframes * 14) % 2 === 0) return;
  const x = Math.round(lerp(p.px, p.x, alpha)), y = Math.round(lerp(p.py, p.y, alpha));
  const S = SPR.player;
  let fr = S.idle;
  if (p.up) fr = S.fly;
  else if (p.moving && !p.dig) { const k = Math.floor(p.walkT) % 4; fr = k === 1 ? S.wa : k === 3 ? S.wb : S.idle; }
  const flip = p.face < 0;
  const bob = (!p.moving && Math.floor(G.time * 2) % 2 === 0) ? 1 : 0;
  const dip = p.digAnim > 0.6 ? 1 : 0;
  const top = y - 9 + bob + dip;
  // gölge
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 4, y + 6, 8, 1);
  // kazma (sadece kazarken)
  if (p.dig || p.digAnim > 0.05) drawPickaxe(p, x, top + 9);
  ctx.drawImage(sprCanvas(fr, flip, p.hurtT > 0), x - 6, top);
  // omuz blaster'ı
  const sp = shoulderPos(p);
  const sx = Math.round(sp.x - p.x + x), sy = Math.round(sp.y - p.y + y) + bob + dip;
  const ang = p.aimT > 0 ? p.aim : (p.face > 0 ? -0.35 : Math.PI + 0.35);
  const rc = (p.recoil || 0) * 1.5;
  pline(sx, sy, sx + Math.cos(ang) * (5 - rc), sy + Math.sin(ang) * (5 - rc), P.ink);
  pline(sx, sy - 1, sx + Math.cos(ang) * (4 - rc), sy - 1 + Math.sin(ang) * (4 - rc), P.metal);
  if (p.carrying) spr(SPR.heart, x, top - 11 + Math.round(Math.sin(G.time * 4)));
}

function drawPickaxe(p, x, y) {
  const [dx, dy] = p.digDir;
  const base = Math.atan2(dy, dx);
  const side = dx !== 0 ? -dx : -p.face;
  const ang = base + side * (1 - p.digAnim) * 1.25;
  const hx = x + dx * 2, hy = y + dy * 2 - 1;
  const ex = hx + Math.cos(ang) * 8, ey = hy + Math.sin(ang) * 8;
  pline(hx, hy, ex, ey, P.wood);
  const px = -Math.sin(ang), py = Math.cos(ang);
  pline(ex - px * 3, ey - py * 3, ex + px * 3 + Math.cos(ang) * 1, ey + py * 3 + Math.sin(ang) * 1, P.metal);
  ctx.fillStyle = '#e8eef8'; ctx.fillRect(Math.round(ex + px * 3), Math.round(ey + py * 3), 1, 1);
}

function drawEmissive(r0, r1, alpha, opts) {
  const t = G.time;
  ctx.globalCompositeOperation = 'lighter';
  // üs pencereleri ve anten ışığı
  const b = G.base, s = SPR.base;
  ctx.drawImage(s.em, Math.round(b.x - s.w / 2), GROUND_Y - s.h);
  glow(b.x - 12, GROUND_Y - 14, 'rgba(255,200,120,0.25)', 14);
  glow(b.x + 18, GROUND_Y - 14, 'rgba(255,200,120,0.25)', 14);
  if (Math.floor(t * 1.5) % 2 === 0) glow(b.x + 22, GROUND_Y - 41, 'rgba(95,224,184,0.6)', 5);
  // fener
  const p = G.player;
  if (!p.dead && !opts.hidePlayer) {
    const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha);
    glow(x + p.face * 5, y - 5, 'rgba(255,236,170,0.22)', 22);
    const fx = p.dig ? p.digDir[0] : p.dx, fy = p.dig ? p.digDir[1] : p.dy;
    glow(x + fx * 18, y + fy * 18, 'rgba(255,230,160,0.07)', 34);
    const fr = SPR.player.idle;
    const ex = sprEm(fr, p.face < 0);
    if (ex) ctx.drawImage(ex, Math.round(x) - 6, Math.round(y) - 9);
    if (p.carrying) glow(x, y - 20, 'rgba(255,60,110,0.45)', 14);
  }
  // cevher parıltıları ve sandık/kalp
  const sparkle = hasPerk('parlakFener');
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const tt = G.map[r * COLS + c], d = TD[tt];
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
    } else if (tt === T.CHEST) {
      sprE(SPR.chest, c * TILE + 8, r * TILE + 9);
      glow(c * TILE + 8, r * TILE + 9, 'rgba(255,210,74,0.3)', 10, 0.6 + Math.sin(t * 3) * 0.3);
    } else if (tt === T.HEART) {
      sprE(SPR.heart, c * TILE + 8, r * TILE + 8 + Math.round(Math.sin(t * 2)));
      glow(c * TILE + 8, r * TILE + 8, 'rgba(255,58,106,0.5)', 26, 0.7 + Math.sin(t * 2) * 0.2);
    }
  }
  // yuvalar (alarm): kırmızı nabız + "!" işareti — düşmanların nereden geleceği okunur olmalı
  if (G.wave.phase === 'warn') {
    for (const n of G.wave.nests) {
      const a = 0.6 + Math.sin(t * 8) * 0.3;
      glow(n.x, n.y, 'rgba(255,60,40,0.9)', 20, a);
      ctx.drawImage(SPR.cracks[4], n.c * TILE, n.r * TILE);
      const by = Math.round(n.y - 16 + Math.sin(t * 6) * 2), bx = Math.round(n.x);
      ctx.fillStyle = P.ink; ctx.fillRect(bx - 2, by - 6, 5, 9); ctx.fillRect(bx - 2, by + 4, 5, 4);
      ctx.fillStyle = '#ff5a4a'; ctx.fillRect(bx - 1, by - 5, 3, 7); ctx.fillRect(bx - 1, by + 5, 3, 2);
    }
  }
  // yapı ışıkları
  for (const s2 of G.structures) {
    if (s2.type === 'heal') glow(s2.x, s2.y - 4, 'rgba(95,224,184,0.35)', 12, 0.6 + Math.sin(t * 3) * 0.3);
    else glow(s2.x, s2.y - 6, 'rgba(242,193,78,0.2)', 6);
  }
  // düşman gözleri: karanlıkta görünür
  for (const e of G.enemies) {
    if (e.emergeT > 0) continue;
    const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
    const f = SPR[e.type][Math.floor(e.anim) % 2];
    const oy = (e.d.boss || e.type === 'brute') ? y - 2 : y - 1;
    sprE(f, x + (e.lunge || 0) * 3 * e.face, oy, e.face < 0);
    if (e.d.boom) glow(x, y, 'rgba(224,112,255,0.3)', 10);
  }
  // mermiler
  for (const bl of G.bullets) {
    const col = bl.from === 't' ? '#9fe8ff' : '#ffe79a';
    pline(bl.px, bl.py, bl.x, bl.y, bl.from === 't' ? 'rgba(120,200,255,0.6)' : 'rgba(255,220,140,0.6)');
    ctx.fillStyle = col; ctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 1, 2, 2);
  }
  for (const bl of G.ebullets) {
    ctx.fillStyle = '#9af060'; ctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 1, 3, 3);
    glow(bl.x, bl.y, 'rgba(154,240,96,0.4)', 6);
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
  // barikat yerleştirme hedefi
  const bt = barricadeTarget();
  if (bt && !opts.hidePlayer) {
    const a = 0.5 + Math.sin(t * 6) * 0.3;
    ctx.globalAlpha = a; ctx.fillStyle = P.helm;
    const x = bt.c * TILE, y = bt.r * TILE;
    for (let i = 0; i < 16; i += 4) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i, y + 15, 2, 1); ctx.fillRect(x, y + i, 1, 2); ctx.fillRect(x + 15, y + i, 1, 2); }
    ctx.globalAlpha = 1;
  }
  // boş yuvalarda inşa işareti
  if (p.y < GROUND_Y + 30 && !opts.hidePlayer && G.wave.phase !== 'active') {
    for (let i = 0; i < PAD_COLS.length; i++) {
      if (G.structures.some(s2 => s2.pad === i)) continue;
      const x = PAD_COLS[i] * TILE + 8, y = PAD_Y - 10 + Math.round(Math.sin(t * 3 + i) * 1.5);
      ctx.fillStyle = P.ink; ctx.fillRect(x - 4, y - 1, 9, 3); ctx.fillRect(x - 1, y - 4, 3, 9);
      ctx.fillStyle = P.helm; ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 3, 1, 7);
    }
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
