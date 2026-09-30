// Harita sürprizlerinin çizimi: yeraltı gölü (dalga, balıklar, olta), portal taşı (rünler, dönen kıvılcım),
// mantar (gözlü sap, benekli şapka) ve olay efektleri (yeme, ışınlanma, balık tutma).
import { COLS, TILE } from '../config.js';
import { P } from '../data/palette.js';
import { G } from '../game/state.js';
import { on } from '../core/events.js';

const PORTAL_COL = [['#b07aff', '#e8d4ff'], ['#3ae0d0', '#c8fff6'], ['#ff6aa8', '#ffd4e6']];
const SHROOM_COL = [['#d84050', '#ff9a9a'], ['#9a5ad8', '#d8b0ff'], ['#3a8ae8', '#a8d8ff'], ['#e8a830', '#ffe79a']];
export const SHROOM_FX = { mini: '#8ad0ff', dev: '#ff9a4a', hiz: '#ffe14a', zehir: '#7ad04a' };
const fx = [];
on('shroomEat', d => fx.push({ k: 'eat', t0: G.time, ...d }));
on('shroom', d => fx.push({ t0: G.time, pi: d.pi, eff: d.k, k: 'pop' }));
on('portal', d => { fx.push({ k: 'ring', t0: G.time, x: d.x0, y: d.y0, col: PORTAL_COL[d.hue][0] }); fx.push({ k: 'ring', t0: G.time + 0.08, x: d.x1, y: d.y1, col: PORTAL_COL[d.hue][1] }); });
on('fishDone', d => { const L = G.lakes[d.li]; if (L) fx.push({ k: 'fish', t0: G.time, pi: d.pi, x: (L.c + L.w / 2) * TILE, y: (L.r + L.h) * TILE - 10 }); });

const seen = (c, r) => G.rev[r * COLS + c];
let X;
const R = (col, x, y, w = 1, h = 1) => { X.fillStyle = col; X.fillRect(Math.round(x), Math.round(y), w, h); };

function fishPx(x, y, dir, a = 1) {
  X.globalAlpha = a;
  R(P.ink, x - 3, y - 1, 6, 3); R(P.ink, x - 3 - dir * 2, y - 1, 2, 3);
  R('#ff9a4a', x - 2, y, 4, 1); R('#ffc48a', x - 2 + (dir > 0 ? 1 : 0), y, 2, 1); R('#e0602a', x - 3 - dir, y, 1, 1);
  R('#ffffff', x + dir * 2 - (dir > 0 ? 1 : 0), y - 1, 1, 1);
  X.globalAlpha = 1;
}

function drawLake(L, i, t) {
  if (!seen(L.c, L.r + L.h - 1) && !seen(L.c + L.w - 1, L.r + L.h - 1)) return;
  const x0 = L.c * TILE, x1 = (L.c + L.w) * TILE, yb = (L.r + L.h) * TILE, ys = yb - 10;
  // kıyı sazları
  for (const [rx, h] of [[x0 + 2, 8], [x0 + 4, 6], [x1 - 3, 9], [x1 - 5, 6]]) {
    const sw = Math.round(Math.sin(t * 1.3 + rx) * 1);
    R('#2a6a3a', rx, ys - h + 4, 1, h); R('#4ab060', rx + sw, ys - h + 3, 1, 3); R('#c89a5a', rx + sw, ys - h + 1, 1, 2);
  }
  X.globalAlpha = 0.88; R('#18406e', x0, ys, x1 - x0, yb - ys); R('#0f2c52', x0, yb - 3, x1 - x0, 3); X.globalAlpha = 1;
  // balıklar: suda gezinir, arada biri zıplar
  for (let k = 0; k < L.fish; k++) {
    const ph = t * 0.5 + k * 2.1 + L.c, half = (x1 - x0) / 2 - 7, mid = (x0 + x1) / 2;
    const fxp = mid + Math.sin(ph) * half, dir = Math.cos(ph) > 0 ? 1 : -1;
    const j = (t * 0.22 + k * 0.31 + L.r * 0.07) % 1;
    if (j < 0.09) { const a = j / 0.09; fishPx(fxp, ys - Math.sin(a * Math.PI) * 10, dir); if (a > 0.85) R('#c8ecff', fxp - 2, ys - 2, 1, 1); }
    else fishPx(fxp, ys + 4 + (k % 2) * 2, dir, 0.75);
  }
  for (let x = x0; x < x1; x += 2) R('#7ac8ff', x, ys + Math.round(Math.sin(t * 2 + x * 0.25) * 0.8), 2, 1);
  for (let k = 0; k < 3; k++) R('#c8ecff', x0 + ((t * 9 + k * 27) % (x1 - x0 - 3)), ys + 3 + k * 2, 3, 1);
  // olta: kamış, misina, şamandıra; ısırınca dalar
  for (const p of G.players) {
    if (!p.fish || p.fish.li !== i) continue;
    const hx = p.x + p.face * 4, hy = p.y - 4, tx = hx + p.face * 8, ty = hy - 9;
    const bx = Math.max(x0 + 4, Math.min(x1 - 4, p.x + p.face * 18)), bite = p.fish.t < 0.35;
    const by = ys - 1 + (bite ? 2 + Math.round(Math.sin(t * 40)) : Math.round(Math.sin(t * 4) * 0.6));
    X.strokeStyle = '#8a5a2a'; X.lineWidth = 1; X.beginPath(); X.moveTo(hx + 0.5, hy + 0.5); X.lineTo(tx + 0.5, ty + 0.5); X.stroke();
    X.globalAlpha = 0.7; X.strokeStyle = '#e8f0f8'; X.beginPath(); X.moveTo(tx + 0.5, ty + 0.5); X.quadraticCurveTo((tx + bx) / 2, by - 2, bx + 0.5, by); X.stroke(); X.globalAlpha = 1;
    R(P.ink, bx - 1, by - 2, 3, 4); R('#e04040', bx, by - 1, 1, 1); R('#ffffff', bx, by, 1, 1);
    if (bite) { X.globalAlpha = 0.6; R('#c8ecff', bx - 4, ys, 2, 1); R('#c8ecff', bx + 3, ys, 2, 1); X.globalAlpha = 1; }
  }
}

function drawPortal(Pt, t) {
  const col = PORTAL_COL[Pt.hue];
  for (const [c, r] of [Pt.a, Pt.b]) {
    if (!seen(c, r)) continue;
    const cx = c * TILE + 8, by = (r + 1) * TILE;
    R(P.ink, cx - 5, by - 15, 11, 15); R(P.ink, cx - 4, by - 16, 9, 1);
    R('#4a4a66', cx - 4, by - 15, 9, 14); R('#6a6a8a', cx - 4, by - 15, 2, 14); R('#34344a', cx + 3, by - 15, 2, 14);
    R('#5a5a78', cx - 3, by - 2, 7, 1);
    const pulse = 0.55 + 0.45 * Math.sin(t * 3 + c);
    X.globalAlpha = pulse;
    R(col[0], cx - 1, by - 13, 3, 1); R(col[0], cx, by - 12, 1, 3); R(col[0], cx - 2, by - 8, 5, 1); R(col[0], cx - 2, by - 7, 1, 2); R(col[0], cx + 2, by - 7, 1, 2); R(col[1], cx, by - 5, 1, 1);
    X.globalAlpha = 1;
    for (let k = 0; k < 4; k++) {
      const a = t * 2.2 + k * Math.PI / 2 + c;
      R(k % 2 ? col[1] : col[0], cx + Math.cos(a) * 8, by - 9 + Math.sin(a) * 4, 1, 1);
    }
  }
}

function shroomPx(cx, by, hue, s = 1, sway = 0) {
  const [a, b] = SHROOM_COL[hue];
  if (s < 1) { const w = Math.max(1, Math.round(4 * s)); R(P.ink, cx - w - 1, by - w * 2 - 1, w * 2 + 2, w * 2 + 2); R(a, cx - w, by - w * 2, w * 2, w); R('#f0e6d0', cx - 1, by - w, 2, w); return; }
  R(P.ink, cx - 2, by - 5, 5, 5); R('#f0e6d0', cx - 1, by - 5, 3, 5); R(P.ink, cx - 1, by - 4, 1, 1); R(P.ink, cx + 1, by - 4, 1, 1); R('#ffb0c0', cx - 1, by - 3, 1, 1);
  const x = cx + sway;
  R(P.ink, x - 2, by - 11, 5, 1); R(P.ink, x - 3, by - 10, 7, 1); R(P.ink, x - 4, by - 9, 9, 4);
  R(a, x - 2, by - 10, 5, 1); R(a, x - 3, by - 9, 7, 2); R('#c8b8a0', x - 3, by - 7, 7, 1);
  R(b, x - 2, by - 10, 1, 1); R('#ffffff', x - 1, by - 9, 1, 1); R('#ffffff', x + 2, by - 8, 1, 1); R('#ffffff', x + 1, by - 10, 1, 1);
}

export function drawWonders(ctx, r0, r1) {
  X = ctx; const t = G.time;
  (G.lakes || []).forEach((L, i) => { if (L.r + L.h >= r0 && L.r <= r1) drawLake(L, i, t); });
  for (const Pt of G.portals || []) if ((Pt.a[1] >= r0 - 1 && Pt.a[1] <= r1 + 1) || (Pt.b[1] >= r0 - 1 && Pt.b[1] <= r1 + 1)) drawPortal(Pt, t);
  for (const s of G.shrooms || []) {
    if (s.eaten || s.r < r0 - 1 || s.r > r1 + 1 || !seen(s.c, s.r)) continue;
    shroomPx(s.c * TILE + 8, (s.r + 1) * TILE, s.hue, 1, Math.round(Math.sin(t * 1.5 + s.c) * 0.6));
    const sp = (t * 0.4 + s.c * 0.3) % 1;
    X.globalAlpha = 1 - sp; R(SHROOM_COL[s.hue][1], s.c * TILE + 8 + Math.sin(sp * 6) * 2, (s.r + 1) * TILE - 12 - sp * 10, 1, 1); X.globalAlpha = 1;
  }
}

// ışık katmanının üstü: portal ve mantar parıltısı
export function drawWondersGlow(ctx, r0, r1, glow) {
  X = ctx; const t = G.time;
  for (const Pt of G.portals || []) for (const [c, r] of [Pt.a, Pt.b]) if (r >= r0 - 1 && r <= r1 + 1 && seen(c, r)) glow(c * TILE + 8, (r + 1) * TILE - 8, PORTAL_COL[Pt.hue][0], 14, 0.35 + 0.15 * Math.sin(t * 3 + c));
  for (const s of G.shrooms || []) if (!s.eaten && s.r >= r0 - 1 && s.r <= r1 + 1 && seen(s.c, s.r)) glow(s.c * TILE + 8, (s.r + 1) * TILE - 8, SHROOM_COL[s.hue][0], 9, 0.28 + 0.1 * Math.sin(t * 2 + s.r));
}

// olay efektleri: sahne katmanında, oyunculardan sonra
export function drawWondersFx(ctx) {
  X = ctx; const t = G.time;
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i], a = t - f.t0;
    if (a < 0) continue;
    if (a > 0.9 || !(G.players[f.pi] || f.k === 'ring')) { fx.splice(i, 1); continue; }
    if (f.k === 'ring') {
      if (a > 0.45) { fx.splice(i, 1); continue; }
      const k = a / 0.45, rr = 4 + k * 16;
      X.globalAlpha = 1 - k; X.strokeStyle = f.col; X.lineWidth = 1; X.beginPath(); X.ellipse(f.x, f.y, rr, rr * 0.8, 0, 0, Math.PI * 2); X.stroke();
      for (let q = 0; q < 6; q++) { const ang = q * 1.047 + k * 2; R('#ffffff', f.x + Math.cos(ang) * rr * 0.7, f.y + Math.sin(ang) * rr * 0.6, 1, 1); }
      X.globalAlpha = 1; continue;
    }
    const p = G.players[f.pi];
    if (f.k === 'eat') {
      if (a > 0.55) { fx.splice(i, 1); continue; }
      const k = Math.min(1, a / 0.3), e = 1 - (1 - k) * (1 - k), mx = p.x + p.face * 3, my = p.y - 3;
      const x = f.x + (mx - f.x) * e, y = f.y + (my - f.y) * e - Math.sin(k * Math.PI) * 6;
      if (a < 0.4) shroomPx(x, y, f.hue, Math.max(0.3, 0.9 - a * 1.5));
      for (let q = 0; q < 3; q++) if (a > 0.15 + q * 0.1) { const b = a - 0.15 - q * 0.1; R(SHROOM_COL[f.hue][0], mx + (q - 1) * 3, my + b * 30, 1, 1); }
    } else if (f.k === 'pop') {
      const k = a / 0.9;
      X.globalAlpha = 1 - k;
      for (let q = 0; q < 8; q++) { const ang = q * 0.785 + k, rr = 5 + k * 14; R(SHROOM_FX[f.eff], p.x + Math.cos(ang) * rr, p.y - 4 + Math.sin(ang) * rr, 2, 2); }
      X.globalAlpha = 1;
    } else if (f.k === 'fish') {
      const k = Math.min(1, a / 0.6), x = f.x + (p.x - f.x) * k, y = f.y + (p.y - 6 - f.y) * k - Math.sin(k * Math.PI) * 16;
      fishPx(x, y, p.x > f.x ? 1 : -1, 1 - Math.max(0, a - 0.6) / 0.3);
      if (a < 0.3) for (let q = 0; q < 4; q++) R('#c8ecff', f.x + (q - 1.5) * 3, f.y - a * 20 * (q % 2 + 1) + a * a * 60, 1, 1);
    }
  }
}
