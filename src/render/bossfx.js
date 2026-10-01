// Boss döngü yeteneklerinin görselleri (ışık katmanında çizilir, karanlıkta da okunur):
// yerde kalan alanlar, ışık çizgileri, uçan kaya, ayna yansımaları ve eylem uyarıları. Oyun tarafı: game/bosskits.js
import { TILE } from '../config.js';
import { G } from '../game/state.js';
import { ghost3D } from './boss/actor.js';

const TAU = Math.PI * 2;
function nearestOf(o) { let best = null, bd = Infinity; for (const q of G.players) if (!q.dead) { const d = Math.hypot(q.x - o.x, q.y - o.y); if (d < bd) { bd = d; best = q; } } return best; }
const hash = n => { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };
const px = (ctx, x, y, w = 1, h = 1) => ctx.fillRect(Math.round(x), Math.round(y), w, h);
function seg(ctx, x0, y0, x1, y1, col, w = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); ctx.fillStyle = col;
  for (let i = 0; i <= n; i++) px(ctx, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, w, w);
}
function dash(ctx, x0, y0, a, len, col, off = 0) {
  ctx.fillStyle = col; const o = ((off % 6) + 6) % 6, ca = Math.cos(a), sa = Math.sin(a);
  for (let d = 4 + o; d < len; d += 6) { px(ctx, x0 + ca * d, y0 + sa * d, 2, 1); px(ctx, x0 + ca * (d + 2), y0 + sa * (d + 2)); }
}
function oval(ctx, x, y, r, col, skip = 0) {
  const n = Math.max(12, Math.round(r * 2.4)); ctx.fillStyle = col;
  for (let i = 0; i < n; i++) { if (skip && (i >> skip) % 2) continue; const a = i / n * TAU; px(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); }
}
function beam(ctx, L, glow, a = 1) {
  const x1 = L.x + Math.cos(L.a) * L.len, y1 = L.y + Math.sin(L.a) * L.len;
  ctx.globalAlpha = a; seg(ctx, L.x, L.y, x1, y1, '#fff4c0', 3); seg(ctx, L.x, L.y, x1, y1, '#ffffff'); ctx.globalAlpha = 1;
  for (let d = 0; d <= L.len; d += 40) glow(L.x + Math.cos(L.a) * d, L.y + Math.sin(L.a) * d, 'rgba(255,244,192,0.5)', 12, a);
}

// işaretin türe özel çizimi; true: genel çizim atlanır
export function drawKitMark(ctx, m, t, glow) {
  const mx = Math.round(m.x), my = Math.round(m.y + 6);
  if (m.kind === 'grow') {
    // kapanacak boşluk: karo çerçevesi yanıp söner, içi dolar
    if (m.t <= 0) return true;
    const k = 1 - m.t / m.T, x0 = m.c * TILE, y0 = m.row * TILE, on = Math.floor(t * (6 + k * 20)) % 2 === 0;
    ctx.globalAlpha = 0.15 + k * 0.4; ctx.fillStyle = '#ff3a6a'; ctx.fillRect(x0, y0, TILE, TILE);
    ctx.globalAlpha = on ? 1 : 0.5; ctx.fillRect(x0, y0, TILE, 1); ctx.fillRect(x0, y0 + TILE - 1, TILE, 1); ctx.fillRect(x0, y0, 1, TILE); ctx.fillRect(x0 + TILE - 1, y0, 1, TILE);
    ctx.globalAlpha = 1;
    return true;
  }
  if (m.t > 0) return false;
  const k = m.post / 0.4;
  if (m.kind === 'bone') {
    for (let i = -1; i <= 1; i++) { const h = Math.round((i ? 8 : 13) * k + 2); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(mx + i * 3, my - h, 2, h); ctx.fillStyle = '#ffffff'; ctx.fillRect(mx + i * 3, my - h, 1, 1); }
    glow(m.x, m.y, 'rgba(232,220,192,0.35)', 11, k);
  } else if (m.kind === 'clot') glow(m.x, m.y, 'rgba(255,58,106,0.6)', 14, k);
  else if (m.kind === 'seed') glow(m.x, m.y, 'rgba(120,180,60,0.5)', 14, k);
  else return false;
  return true;
}

const ZONE = {
  // diken çalısı: koyu yeşil öbek, sivri uçlar
  bramble(ctx, z, t, glow, a) {
    ctx.globalAlpha = 0.3 * a; ctx.fillStyle = '#1c3010'; ctx.beginPath(); ctx.ellipse(Math.round(z.x), Math.round(z.y + 4), z.r, z.r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = a;
    for (let i = 0; i < 12; i++) {
      const an = hash(i + 1) * TAU, d = Math.sqrt(hash(i + 20)) * (z.r - 2), x = z.x + Math.cos(an) * d, y = z.y + 4 + Math.sin(an) * d * 0.8, h = 3 + Math.round(hash(i + 40) * 3 + Math.sin(t * 3 + i) * 0.6);
      ctx.fillStyle = '#4a7a24'; px(ctx, x, y - h, 1, h); px(ctx, x - 1, y - h + 2); px(ctx, x + 1, y - h + 1); ctx.fillStyle = '#b8f060'; px(ctx, x, y - h);
    }
    ctx.globalAlpha = 1; oval(ctx, z.x, z.y + 4, z.r, 'rgba(120,180,60,0.7)', 1);
  },
  // kül bulutu: ağır ağır dönen gri öbekler, içinde tek tük kor
  ash(ctx, z, t, glow, a) {
    for (let i = 0; i < 9; i++) {
      const an = i * 2.4 + t * (0.25 + hash(i) * 0.3), d = z.r * (0.25 + 0.6 * hash(i + 7)), r = 7 + hash(i + 3) * 5;
      ctx.globalAlpha = 0.3 * a; ctx.fillStyle = i % 2 ? '#4a4240' : '#6a605c';
      ctx.beginPath(); ctx.arc(Math.round(z.x + Math.cos(an) * d), Math.round(z.y + Math.sin(an) * d * 0.8), r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = a; ctx.fillStyle = '#ff9a4a';
    for (let i = 0; i < 4; i++) { const q = (t * 0.5 + hash(i + 11)) % 1; px(ctx, z.x + (hash(i + 30) - 0.5) * z.r * 1.4, z.y + z.r * 0.6 - q * z.r * 1.4); }
    ctx.globalAlpha = 1;
  },
  // arı sürüsü: düzensiz dönen noktalar
  swarm(ctx, z, t, glow, a) {
    glow(z.x, z.y, 'rgba(255,176,64,0.35)', 14, a);
    ctx.globalAlpha = a;
    for (let i = 0; i < 16; i++) {
      const r = z.r * (0.3 + 0.8 * hash(i + 2)), x = z.x + Math.cos(t * (5 + hash(i) * 5) + i * 1.9) * r, y = z.y + Math.sin(t * (6 + hash(i + 5) * 5) + i * 2.3) * r * 0.8;
      ctx.fillStyle = i % 3 ? '#ffd060' : '#2a1a08'; px(ctx, x, y, i % 4 ? 1 : 2, 1);
    }
    ctx.globalAlpha = 1;
  },
  // petek tuzağı: kurulurken yanıp söner, sonra soluk ışır
  comb(ctx, z, t, glow, a) {
    if (z.arm > 0 && Math.floor(t * 12) % 2) return;
    const R = 7, p = [];
    for (let i = 0; i < 6; i++) p.push([z.x + Math.cos(i * TAU / 6) * R, z.y + 4 + Math.sin(i * TAU / 6) * R * 0.8]);
    ctx.globalAlpha = a;
    for (let i = 0; i < 6; i++) seg(ctx, p[i][0], p[i][1], p[(i + 1) % 6][0], p[(i + 1) % 6][1], '#ffb040');
    ctx.fillStyle = '#fff0c0'; px(ctx, z.x, z.y + 4); px(ctx, z.x - 3, z.y + 3); px(ctx, z.x + 3, z.y + 5);
    ctx.globalAlpha = 1; glow(z.x, z.y + 4, 'rgba(255,176,64,0.3)', 9, a * (0.6 + 0.4 * Math.sin(t * 4 + z.x)));
  },
};

export function drawKitFx(ctx, e, x, y, t, glow, alpha) {
  const B = e.bs, on = Math.floor(t * 14) % 2 === 0;
  for (const z of B.zones) ZONE[z.kind](ctx, z, t, glow, Math.min(1, z.t / 0.8, (z.T - z.t) / 0.3 + 0.2));
  for (const L of B.lines) {
    if (L.t <= 0) { beam(ctx, L, glow, Math.max(0, L.post / 0.25)); continue; }
    const k = 1 - L.t / L.T, lock = L.tgt == null || L.t <= L.lock, c = lock && k > 0.5 ? '#ff5a3a' : '#fff4c0';
    if (L.node) {
      // ışık tohumu: nabız gibi atan elmas
      const r = 2 + Math.round(k * 2);
      ctx.fillStyle = '#ffffff'; px(ctx, L.x - r, L.y, r * 2 + 1, 1); px(ctx, L.x, L.y - r, 1, r * 2 + 1); ctx.fillStyle = '#fff4c0'; px(ctx, L.x - 1, L.y - 1, 3, 3);
      glow(L.x, L.y, 'rgba(255,244,192,0.6)', 8 + r * 2, 0.6 + 0.4 * Math.sin(t * 12));
    }
    if (on || lock) { ctx.globalAlpha = 0.5 + k * 0.5; dash(ctx, L.x, L.y, L.a, L.len, c, -t * 50); if (!L.node) { const nx = -Math.sin(L.a) * L.w, ny = Math.cos(L.a) * L.w; dash(ctx, L.x + nx, L.y + ny, L.a, L.len, c, t * 50); dash(ctx, L.x - nx, L.y - ny, L.a, L.len, c, t * 50); } ctx.globalAlpha = 1; }
  }
  for (const s of B.shots) {
    // kaya: dönerek uçan köşeli parça
    const bx = Math.round(s.x), by = Math.round(s.y), f = Math.floor(t * 14) % 2;
    ctx.fillStyle = '#3a3028'; ctx.fillRect(bx - 4, by - 4, 9, 9); ctx.fillStyle = '#8a7a68'; ctx.fillRect(bx - 3, by - 3, 7, 7);
    ctx.fillStyle = '#c8b8a0'; ctx.fillRect(bx - 3 + f * 2, by - 3, 3, 2); ctx.fillStyle = '#5a4c40'; ctx.fillRect(bx + 1 - f * 3, by + 1, 3, 2);
  }
  for (const im of B.images) {
    // ayna yansıması: kralın soluk, titrek kopyası; kırılmadan önce parlar
    const k = 1 - im.t / im.T, a = (0.3 + 0.4 * k) * (k > 0.75 && on ? 1.3 : 1) * (0.85 + 0.15 * Math.sin(t * 30 + im.x));
    ghost3D(ctx, e, alpha, im.x + Math.sin(t * 40 + im.y) * (k > 0.75 ? 1 : 0), im.y, Math.min(1, a), im.face !== (e.face || 1));
    glow(im.x, im.y - 16, 'rgba(200,208,255,0.5)', Math.round(14 + k * 12), 0.4 + 0.5 * k);
    if (k > 0.6) { const q = nearestOf(im); if (q && (on || k > 0.85)) dash(ctx, im.x, im.y - 2, Math.atan2(q.y - 3 - im.y, q.x - im.x), 40, k > 0.85 ? '#ff5a3a' : '#e0e8ff', -t * 50); }
  }
  const A = B.act;
  if (!A) return;
  if (A.k === 'spiral') {
    if (!A.fire) { oval(ctx, x, y, 40 * (1 - e.wind) + 10, '#c0b8ff', 1); oval(ctx, x, y, 26 * (1 - e.wind) + 6, '#b080ff'); }
    else glow(x, y, 'rgba(176,128,255,0.6)', 18, 0.7 + 0.3 * Math.sin(t * 30));
  } else if (A.k === 'stare') {
    if (!A.fire && e.wind < 1) { oval(ctx, x, y, 70 * (1 - e.wind) + 18, '#c0b8ff', 1); oval(ctx, x, y, 44 * (1 - e.wind) + 14, '#ffffff', 2); glow(x, y, 'rgba(192,184,255,0.5)', Math.round(12 + e.wind * 22), 0.5 + 0.5 * e.wind); }
    else if (A.fire) {
      // göz açık: kızıl bakış, çevrede dönen ışınlar
      glow(x, y, 'rgba(255,70,60,0.75)', 34, 0.8 + 0.2 * Math.sin(t * 24));
      for (let i = 0; i < 10; i++) dash(ctx, x, y, i * TAU / 10 + t * 0.6, 110, on ? '#ff5a3a' : '#ffb0a0', -t * 80);
    }
  } else if (A.k === 'wheel' && A.lens) {
    for (let i = 0; i < A.n; i++) {
      const a = A.a + i * TAU / A.n, len = A.lens[i] || 0;
      if (!A.fire) { if (on || e.wind > 0.7) dash(ctx, x, y, a, len, e.wind > 0.7 ? '#ff5a3a' : '#fff4c0', -t * 40); }
      else beam(ctx, { x, y, a, len }, glow, 0.9);
    }
    glow(x, y, 'rgba(255,244,192,0.6)', 20, A.fire ? 1 : e.wind);
  } else if (A.k === 'reflect') {
    // ayna kalkanı: gövdeyle madenci arasında parlayan cam yay; vurulunca çakar
    const q = nearestOf(e), a0 = q ? Math.atan2(q.y - 3 - (y - 14), q.x - x) : (e.face || 1) > 0 ? 0 : Math.PI, lit = A.fire ? 1 : on ? e.wind : 0;
    if (lit > 0) {
      ctx.globalAlpha = lit;
      for (let i = -9; i <= 9; i++) { const a = a0 + i * 0.13, r = 24 + Math.sin(t * 9 + i) * 0.6; ctx.fillStyle = (i + Math.floor(t * 12)) % 3 ? '#c8d0ff' : '#ffffff'; px(ctx, x + Math.cos(a) * r, y - 14 + Math.sin(a) * r * 1.25, 2, 2); }
      ctx.globalAlpha = 1;
      glow(x + Math.cos(a0) * 20, y - 14 + Math.sin(a0) * 24, 'rgba(200,208,255,0.55)', e.flashT > 0 ? 30 : 20, A.fire ? 0.6 + 0.4 * Math.sin(t * 10) : lit * 0.5);
    }
  } else if (A.k === 'drill') {
    if (A.stage === 'wind') { if (on) oval(ctx, x, y, 34, '#ffd870', 2); }
    else if (A.stage === 'spin') { glow(x, y, 'rgba(255,216,112,0.5)', 26, 1); for (let i = 0; i < 8; i++) { const a = t * 16 + i * TAU / 8, r = 16 + (i % 2) * 6; ctx.fillStyle = i % 2 ? '#c8b8a0' : '#ffd870'; px(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 2, 2); } }
    else for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; ctx.fillStyle = i % 2 ? '#ffffff' : '#ffd870'; px(ctx, x + Math.cos(a) * 9, y - 16 + Math.sin(a) * 3); }
  } else if (A.k === 'boulder' && A.stage === 'lift') {
    const bx = Math.round(x + (e.face || 1) * 8), by = Math.round(y - 8 - e.wind * 10);
    ctx.fillStyle = '#3a3028'; ctx.fillRect(bx - 4, by - 4, 9, 9); ctx.fillStyle = '#8a7a68'; ctx.fillRect(bx - 3, by - 3, 7, 7); ctx.fillStyle = '#c8b8a0'; ctx.fillRect(bx - 3, by - 3, 3, 2);
  } else if (A.k === 'ash' && !A.done) glow(x + (e.face || 1) * 14, y - 10, 'rgba(255,150,70,0.6)', Math.round(6 + e.wind * 14), 0.4 + 0.6 * e.wind);
}

