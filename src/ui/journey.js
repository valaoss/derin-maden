// Sefer haritası (sonuç ekranı): kim nereden geçti, nerede ne oldu. İzler zamanla birlikte çizilir,
// harita sürüklenir, alttaki zaman çizgisinde ileri geri sarılır.
import { G, biomeOf } from '../game/state.js';
import { COLS, ROWS, TILE, GROUND_ROW, STRATUM_ROWS, STRATA_COUNT } from '../config.js';
import { TD, HOST_MAT } from '../data/tiles.js';
import { MAT_RAMP, RES_COL, STRATA, P } from '../data/palette.js';
import { HELMETS } from '../render/sprites.js';

const JUMP = 12; // yarım-tile: bundan uzun adım asansör/kampta uyanma sıçraması
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const isJump = (a, b) => Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > JUMP;

const GLYPH = {
  down:   ['#ec4a4a', ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x']],
  nest:   ['#ff5a8a', ['..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..']],
  beacon: ['#ffd48a', ['..x..', '..x..', '.xxx.', '.xxx.', 'xxxxx']],
  chest:  ['#ffd24a', ['xxxxx', 'x...x', 'xxxxx', 'x.x.x', 'xxxxx']],
  boss:   ['#ff4a3a', ['x.x.x', 'xxxxx', 'xxxxx', '.xxx.']],
  heart:  ['#ff5a8a', ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..']],
  relic:  ['#c070ff', ['.xxx.', 'xx.xx', 'x...x', 'xx.xx', '.xxx.']],
  gem:    ['#5ae08a', ['.x.', 'xxx', '.x.']],
};
export const MARK_NAMES = { down: 'Bayılma', nest: 'Yuva', beacon: 'Fener', chest: 'Sandık', boss: 'Boss', heart: 'Kalp', relic: 'Emanet', gem: 'Derin cevher' };

function glyph(ctx, k, x, y, u, col) {
  const [c0, rows] = GLYPH[k], w = rows[0].length, h = rows.length;
  const ox = Math.round(x - w * u / 2), oy = Math.round(y - h * u / 2);
  ctx.fillStyle = P.ink;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rows[j][i] === 'x') ctx.fillRect(ox + (i - 1) * u, oy + (j - 1) * u, u * 3, u * 3);
  ctx.fillStyle = col || c0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rows[j][i] === 'x') ctx.fillRect(ox + i * u, oy + j * u, u, u);
}
export function glyphURL(k) {
  const c = document.createElement('canvas'); c.width = c.height = 14;
  glyph(c.getContext('2d'), k, 7, 7, 2);
  return c.toDataURL();
}

// sefer bitince: izler, işaretler ve haritanın 1 piksel = 1 tile küçük resmi
export function snapshotJourney() {
  const J = G.journey, end = Math.round(G.stats.time * 10);
  if (!J || end < 100) return null;
  const players = G.players.map(p => {
    const pts = (J.p[p.i] || []).slice(), l = pts[pts.length - 1];
    const x = Math.round(p.x / TILE * 2), y = Math.round(p.y / TILE * 2);
    if (!p.dead && (!l || l[1] !== x || l[2] !== y)) pts.push([end, x, y]);
    let deep = pts[0] || [0, 0, GROUND_ROW * 2], dist = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (!isJump(a, b)) dist += Math.hypot(b[1] - a[1], b[2] - a[2]) / 2;
      if (b[2] > deep[2]) deep = b;
    }
    return {
      name: p.name || (G.mp ? 'MADENCİ ' + (p.i + 1) : 'SEN'), col: HELMETS[(p.helm | 0) % HELMETS.length].c, pts, deep,
      depth: Math.max(0, Math.floor(deep[2] / 2) - GROUND_ROW), dist: Math.round(dist),
      downs: J.m.filter(m => m[0] === 'down' && m[4] === p.i).length, local: p === G.player,
    };
  });
  let maxR = GROUND_ROW + 12;
  for (const q of players) for (const pt of q.pts) maxR = Math.max(maxR, pt[2] / 2);
  const rows = Math.min(ROWS, Math.ceil(maxR) + 8);
  const bg = document.createElement('canvas'); bg.width = COLS; bg.height = rows;
  const bx = bg.getContext('2d'), img = bx.createImageData(COLS, rows);
  const sky = rgb(P.sky1), tunnel = [9, 6, 13];
  for (let r = 0; r < rows; r++) {
    const host = HOST_MAT[biomeOf(Math.max(0, Math.min(STRATA_COUNT - 1, Math.floor((r - GROUND_ROW) / STRATUM_ROWS))))] || 'stone';
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c, d = TD[G.map[i]] || TD[0], seen = G.rev[i];
      const ramp = MAT_RAMP[d.mat && d.mat !== 'host' && d.mat !== 'metal' && MAT_RAMP[d.mat] ? d.mat : host] || MAT_RAMP.stone;
      let col;
      if (!d.solid) col = r < GROUND_ROW ? sky : seen ? tunnel : rgb(ramp[1]);
      else col = rgb(seen && d.ore && !d.plain ? RES_COL[d.ore] : seen && d.chest ? '#ffd24a' : ramp[seen ? 2 : 1]);
      img.data.set([col[0], col[1], col[2], 255], i * 4);
    }
  }
  bx.putImageData(img, 0, 0);
  const biomes = [];
  for (let s = 0; s < STRATA_COUNT && GROUND_ROW + s * STRATUM_ROWS < rows; s++) biomes.push({ r: GROUND_ROW + s * STRATUM_ROWS, name: STRATA[biomeOf(s)].short });
  return { bg, rows, biomes, players, marks: J.m.slice(), end };
}

// kaç nokta T anına kadar çizilmiş
function upto(pts, T) {
  let lo = 0, hi = pts.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m][0] <= T) lo = m + 1; else hi = m; }
  return lo;
}
const clock = ds => { const s = Math.floor(ds / 10); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function mountJourney(cv, J) {
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const LBL = 30, TL = 28, GAP = 6;
  let W = 0, H = 0, X0 = LBL, MW = 0, OV = 0, OVX = 0, cw = 0, rh = 0, mapH = 0, viewRows = 0;
  function layout() {
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    mapH = H - TL;
    OV = J.rows * ((W - LBL) / COLS) * 0.7 > mapH ? 22 : 0;
    OVX = W - OV; MW = OVX - (OV ? GAP : 0) - X0;
    cw = MW / COLS; rh = Math.min(cw, Math.max(cw * 0.7, mapH / J.rows));
    viewRows = mapH / rh;
  }
  layout();
  const n = J.players.length;
  J.players.forEach((q, i) => { q.off = (i - (n - 1) / 2) * 1.5; });
  const order = J.players.filter(q => !q.local).concat(J.players.filter(q => q.local));
  const dur = Math.min(12000, 4500 + J.end * 0.5);
  let T = 0, t0 = performance.now(), last = t0, playing = true, cy = 0, manual = false, drag = null;
  const maxCy = () => Math.max(0, J.rows - viewRows);

  function focusRow() {
    const heads = J.players.map(q => { const k = upto(q.pts, T); return k ? q.pts[k - 1][2] / 2 : GROUND_ROW; });
    const me = heads[J.players.findIndex(q => q.local)] ?? heads[0];
    const near = heads.filter(h => Math.abs(h - me) < viewRows * 0.6);
    return near.reduce((a, b) => a + b, 0) / near.length;
  }
  cy = Math.max(0, Math.min(maxCy(), focusRow() - viewRows * 0.45));

  function path(q, k, fx, fy, lw, col, alpha) {
    const pts = q.pts;
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < k; i++) {
      const p = pts[i], X = fx(p[1]) + q.off, Y = fy(p[2]);
      if (i === 0 || isJump(pts[i - 1], p)) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    ctx.setLineDash([2, 3]); ctx.lineWidth = Math.max(1, lw / 2); ctx.globalAlpha = alpha * 0.6;
    ctx.beginPath();
    for (let i = 1; i < k; i++) if (isJump(pts[i - 1], pts[i])) { ctx.moveTo(fx(pts[i - 1][1]) + q.off, fy(pts[i - 1][2])); ctx.lineTo(fx(pts[i][1]) + q.off, fy(pts[i][2])); }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  const label = (txt, x, y, col, align = 'left') => {
    ctx.textAlign = align; ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y);
  };

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = P.uiD; ctx.fillRect(0, 0, W, H);
    ctx.font = '10px Tiny5, monospace'; ctx.textBaseline = 'middle';
    const fx = x2 => X0 + x2 / 2 * cw, fy = y2 => (y2 / 2 - cy) * rh;
    // harita
    ctx.save(); ctx.beginPath(); ctx.rect(X0, 0, MW, mapH); ctx.clip();
    const sr = Math.floor(cy), nr = Math.min(J.rows - sr, Math.ceil(viewRows) + 2);
    ctx.drawImage(J.bg, 0, sr, COLS, nr, X0, (sr - cy) * rh, MW, nr * rh);
    ctx.strokeStyle = 'rgba(245,236,216,0.22)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (const b of J.biomes) { const y = Math.round((b.r - cy) * rh) + 0.5; ctx.moveTo(X0, y); ctx.lineTo(X0 + MW, y); }
    ctx.stroke(); ctx.setLineDash([]);
    for (const b of J.biomes) { const y = (b.r - cy) * rh + 9; if (y > -10 && y < mapH + 10) label(b.name, X0 + 4, y, 'rgba(245,236,216,0.75)'); }
    for (const q of order) { const k = upto(q.pts, T); path(q, k, fx, fy, 4.5, P.ink, 0.85); path(q, k, fx, fy, 2, q.col, 1); }
    for (const m of J.marks) {
      if (m[1] > T || !GLYPH[m[0]]) continue;
      const age = (T - m[1]) / 10, pop = age < 0.4 ? 1 + 0.8 * (1 - age / 0.4) : 1;
      glyph(ctx, m[0], fx(m[2]), fy(m[3]), 1.5 * pop, m[0] === 'gem' ? RES_COL[m[5]] : null);
    }
    for (const q of order) {
      if (q.deep[0] > T || q.depth < 4) continue;
      const x = Math.round(fx(q.deep[1]) + q.off), y = Math.round(fy(q.deep[2]));
      ctx.fillStyle = P.ink; ctx.fillRect(x - 1, y - 12, 3, 13); ctx.fillRect(x + 1, y - 13, 7, 7);
      ctx.fillStyle = q.col; ctx.fillRect(x, y - 11, 1, 11); ctx.fillRect(x + 2, y - 12, 5, 5);
      const right = x + 40 < X0 + MW;
      label(q.depth + 'm', right ? x + 9 : x - 3, y - 9, q.col, right ? 'left' : 'right');
    }
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    for (const q of order) {
      const k = upto(q.pts, T); if (!k) continue;
      const p = q.pts[k - 1], x = fx(p[1]) + q.off, y = fy(p[2]);
      const down = J.marks.some(m => m[0] === 'down' && m[4] === J.players.indexOf(q) && m[1] >= p[0] && m[1] <= T);
      if (down) continue;
      ctx.globalAlpha = 0.35 * pulse; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(x, y, 6 + pulse * 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
      if (n > 1) label(q.name.toUpperCase(), x, y - 11, q.col, 'center');
    }
    ctx.restore();
    // derinlik etiketleri
    ctx.fillStyle = P.dim;
    for (const b of J.biomes) { const y = (b.r - cy) * rh; if (y > 4 && y < mapH - 4) { ctx.textAlign = 'right'; ctx.fillText((b.r - GROUND_ROW) + 'm', X0 - 4, y); } }
    { const y = (GROUND_ROW - cy) * rh - 6; if (y > 4 && y < mapH - 4) { ctx.textAlign = 'right'; ctx.fillStyle = P.helm; ctx.fillText('KAMP', X0 - 3, y); } }
    // genel bakış şeridi
    if (OV) {
      const sy = mapH / J.rows, ox = x2 => OVX + x2 / 2 * OV / COLS, oy = y2 => y2 / 2 * sy;
      ctx.drawImage(J.bg, 0, 0, COLS, J.rows, OVX, 0, OV, mapH);
      ctx.fillStyle = 'rgba(11,7,18,0.35)'; ctx.fillRect(OVX, 0, OV, mapH);
      for (const q of order) { const k = upto(q.pts, T); const o = q.off; q.off = 0; path(q, k, ox, oy, 1, q.col, 1); q.off = o; }
      ctx.strokeStyle = P.text; ctx.lineWidth = 1; ctx.strokeRect(OVX + 0.5, Math.round(cy * sy) + 0.5, OV - 1, Math.max(4, Math.round(viewRows * sy)) - 1);
    }
    // zaman çizgisi
    const ty = mapH + TL / 2 + 2, tx0 = X0, tw = MW;
    ctx.fillStyle = P.uiL; ctx.fillRect(tx0, ty - 2, tw, 4);
    ctx.fillStyle = P.good; ctx.fillRect(tx0, ty - 2, tw * T / J.end, 4);
    for (const m of J.marks) {
      if (!GLYPH[m[0]]) continue;
      ctx.fillStyle = m[0] === 'gem' ? RES_COL[m[5]] : GLYPH[m[0]][0];
      ctx.fillRect(Math.round(tx0 + tw * m[1] / J.end) - 1, ty - 6, 2, 3);
    }
    const hx = Math.round(tx0 + tw * T / J.end);
    ctx.fillStyle = P.ink; ctx.fillRect(hx - 3, ty - 6, 6, 12);
    ctx.fillStyle = P.text; ctx.fillRect(hx - 2, ty - 5, 4, 10);
    ctx.fillStyle = P.dim; ctx.textAlign = 'right'; ctx.fillText(clock(T), X0 - 4, ty);
    if (OV) { ctx.textAlign = 'center'; ctx.fillText(clock(J.end), OVX + OV / 2, ty); }
  }

  function tick(now) {
    if (!cv.isConnected) return;
    if (cv.clientWidth !== W || cv.clientHeight !== H) layout();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) { T = Math.min(J.end, (now - t0) / dur * J.end); if (T >= J.end) playing = false; }
    if (!manual) cy += (Math.max(0, Math.min(maxCy(), focusRow() - viewRows * 0.45)) - cy) * Math.min(1, dt * 5);
    cy = Math.max(0, Math.min(maxCy(), cy));
    draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const at = e => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const scrub = x => { T = Math.max(0, Math.min(1, (x - X0) / MW)) * J.end; playing = false; manual = false; };
  cv.addEventListener('pointerdown', e => {
    const p = at(e); cv.setPointerCapture(e.pointerId);
    if (p.y > mapH) { drag = { k: 'tl' }; scrub(p.x); }
    else if (OV && p.x >= OVX) { drag = { k: 'ov' }; manual = true; cy = p.y / mapH * J.rows - viewRows / 2; }
    else { drag = { k: 'map', y: p.y, cy }; manual = true; }
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = at(e);
    if (drag.k === 'tl') scrub(p.x);
    else if (drag.k === 'ov') cy = p.y / mapH * J.rows - viewRows / 2;
    else cy = drag.cy - (p.y - drag.y) / rh;
  });
  const up = () => { drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); manual = true; cy += e.deltaY / rh * 0.5; }, { passive: false });
  return { replay() { t0 = last = performance.now(); T = 0; playing = true; manual = false; } };
}
