// Yazılımsal 3B çizici: derinlik tamponlu üçgenler, bantlı (cel) ışık, piksel konturu.
// Dünya pikseli çözünürlüğünde, kenar yumuşatmasız çizer; DOM gerektirmez (Node'da da çalışır).
const FAR = -1e9, LIGHT = [-0.48, 0.72, 0.5], BIAS = 1.4;
{ const l = Math.hypot(...LIGHT); LIGHT[0] /= l; LIGHT[1] /= l; LIGHT[2] /= l; }

export function createSurface(w, h) {
  const n = w * h;
  return { w, h, z: new Float32Array(n), id: new Uint8Array(n), tone: new Uint8Array(n), rgba: new Uint8ClampedArray(n * 4) };
}
export function createGeo(maxV = 8192, maxT = 16384) {
  return { p: new Float32Array(maxV * 3), n: new Float32Array(maxV * 3), uv: new Float32Array(maxV * 2), s: new Float32Array(maxV * 5), nv: 0, t: new Uint16Array(maxT * 3), tm: new Uint8Array(maxT), nt: 0, lines: [], dots: [] };
}
export function resetGeo(g) { g.nv = g.nt = 0; g.lines.length = 0; g.dots.length = 0; }
export function vert(g, p, n, u = 0, v = 0) {
  const i = g.nv++, a = i * 3;
  g.p[a] = p[0]; g.p[a + 1] = p[1]; g.p[a + 2] = p[2]; g.n[a] = n[0]; g.n[a + 1] = n[1]; g.n[a + 2] = n[2]; g.uv[i * 2] = u; g.uv[i * 2 + 1] = v;
  return i;
}
export function tri(g, a, b, c, m) { const i = g.nt++ * 3; g.t[i] = a; g.t[i + 1] = b; g.t[i + 2] = c; g.tm[i / 3] = m; }
// derinlik sınamalı 1 piksellik çizgi ve nokta (pençe, diş, parmak kemiği, göz)
export function line(g, a, b, id, tone) { g.lines.push(a[0], a[1], a[2], b[0], b[1], b[2], id, tone); }
export function dot(g, p, id, tone, dx = 0, dy = 0) { g.dots.push(p[0], p[1], p[2], id, tone, dx, dy); }

// kamera: yaw (y ekseni), pitch (yukarıdan bakış), ölçek, köken, yön (F=-1 aynalar)
export function camera(yaw, pitch, k, ox, oy, F = 1) { return { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), k, ox, oy, F }; }
export function project(c, p) {
  const x1 = p[0] * c.cy - p[2] * c.sy, z1 = p[2] * c.cy + p[0] * c.sy;
  return [c.ox + c.F * x1 * c.k, c.oy - (p[1] * c.cp - z1 * c.sp) * c.k, (z1 * c.cp + p[1] * c.sp) * c.k];
}
const band = i => i < 0.3 ? 1 : i < 0.56 ? 2 : i < 0.83 ? 3 : 4;
const PX = { id: 0 }, BAYER = [0, 2, 3, 1];

export function render(S, g, c, mats, o = {}) {
  const { w, h, z, id, tone } = S, s = g.s;
  z.fill(FAR); id.fill(0);
  for (let i = 0; i < g.nv; i++) {
    const a = i * 3, x = g.p[a], y = g.p[a + 1], zz = g.p[a + 2], nx = g.n[a], ny = g.n[a + 1], nz = g.n[a + 2];
    const x1 = x * c.cy - zz * c.sy, z1 = zz * c.cy + x * c.sy, n1 = nx * c.cy - nz * c.sy, m1 = nz * c.cy + nx * c.sy;
    const b = i * 5, ny2 = ny * c.cp - m1 * c.sp, nz2 = m1 * c.cp + ny * c.sp;
    s[b] = c.ox + c.F * x1 * c.k; s[b + 1] = c.oy - (y * c.cp - z1 * c.sp) * c.k; s[b + 2] = (z1 * c.cp + y * c.sp) * c.k;
    s[b + 3] = c.F * n1 * LIGHT[0] + ny2 * LIGHT[1] + nz2 * LIGHT[2]; s[b + 4] = nz2;
  }
  for (let k = 0; k < g.nt; k++) {
    const a = g.t[k * 3] * 5, b = g.t[k * 3 + 1] * 5, cc = g.t[k * 3 + 2] * 5;
    let m = g.tm[k], M = mats[m], da = s[a + 3], db = s[b + 3], dc = s[cc + 3];
    // çift yüzlü (zar): kameraya dönük olmayan yüz öteki malzemeyle, ters normalle çizilir
    if (M.back && s[a + 4] < 0) { m = M.back; M = mats[m]; da = -da; db = -db; dc = -dc; }
    const ax = s[a], ay = s[a + 1], bx = s[b], by = s[b + 1], cx = s[cc], cy = s[cc + 1];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(area) < 1e-6) continue;
    const inv = 1 / area, x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    const az = s[a + 2], bz = s[b + 2], cz = s[cc + 2], ua = g.t[k * 3] * 2, ub = g.t[k * 3 + 1] * 2, uc = g.t[k * 3 + 2] * 2, px = M.px, dth = M.dither;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const w0 = ((bx - qx) * (cy - qy) - (by - qy) * (cx - qx)) * inv, w1 = ((cx - qx) * (ay - qy) - (cy - qy) * (ax - qx)) * inv, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      // yarı saydam (ışık, duman, kehribar): 2x2 desenle seyreltilir
      if (dth && BAYER[(y & 1) * 2 + (x & 1)] >= dth) continue;
      const zz = w0 * az + w1 * bz + w2 * cz, q = y * w + x; if (zz <= z[q]) continue;
      let i = 0.5 + 0.5 * (w0 * da + w1 * db + w2 * dc); PX.id = m;
      if (px) { i = px(w0 * g.uv[ua] + w1 * g.uv[ub] + w2 * g.uv[uc], w0 * g.uv[ua + 1] + w1 * g.uv[ub + 1] + w2 * g.uv[uc + 1], i, PX); if (!PX.id) continue; }   // id = 0: delik (göz kapağı aralığı)
      z[q] = zz; id[q] = PX.id; tone[q] = band(i);
    }
  }
  const put = (x, y, zz, m, t) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const q = y * w + x; if (zz + BIAS * c.k < z[q]) return; if (zz > z[q]) z[q] = zz; id[q] = m; tone[q] = t; };
  const L = g.lines;
  for (let i = 0; i < L.length; i += 8) {
    const a = project(c, [L[i], L[i + 1], L[i + 2]]), b = project(c, [L[i + 3], L[i + 4], L[i + 5]]);
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let k = 0; k <= n; k++) { const f = k / n; put(Math.floor(a[0] + (b[0] - a[0]) * f), Math.floor(a[1] + (b[1] - a[1]) * f), a[2] + (b[2] - a[2]) * f, L[i + 6], L[i + 7]); }
  }
  const D = g.dots;
  for (let i = 0; i < D.length; i += 7) { const a = project(c, [D[i], D[i + 1], D[i + 2]]); put(Math.floor(a[0]) + c.F * D[i + 5], Math.floor(a[1]) + D[i + 6], a[2], D[i + 3], D[i + 4]); }
  resolve(S, mats, o.outline || [22, 5, 8], (o.crease || 2.4) * c.k);
}

// renk: dış kontur (silüet) ve iç kontur (öndeki parçanın arkasında kalan piksel en koyu tona iner)
function resolve(S, mats, out, T) {
  const { w, h, z, id, tone, rgba } = S, hard = mats.map(m => m && !m.dither && !m.soft ? 1 : 0);
  for (let y = 0, q = 0; y < h; y++) for (let x = 0; x < w; x++, q++) {
    const o = q * 4, m = id[q], L = x > 0, R = x < w - 1, U = y > 0, B = y < h - 1;
    if (!m) {
      if ((L && hard[id[q - 1]]) || (R && hard[id[q + 1]]) || (U && hard[id[q - w]]) || (B && hard[id[q + w]])) { rgba[o] = out[0]; rgba[o + 1] = out[1]; rgba[o + 2] = out[2]; rgba[o + 3] = 255; }
      else rgba[o] = rgba[o + 1] = rgba[o + 2] = rgba[o + 3] = 0;
      continue;
    }
    let k = tone[q]; const zz = z[q];
    if (!mats[m].flat && !mats[m].dither) {
      // eğimli düz yüzeyde komşu farkları eşittir; yalnızca gerçek örtme kenarı kontur olur
      const e = (n, p, hasN, hasP) => { if (!hasN || !id[n]) return false; const a = z[n] - zz; return a > T && a - (hasP && id[p] ? zz - z[p] : 0) > T; };
      if (e(q - 1, q + 1, L, R) || e(q + 1, q - 1, R, L) || e(q - w, q + w, U, B) || e(q + w, q - w, B, U)) k = 0;
    }
    const col = mats[m].ramp[k]; rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; rgba[o + 3] = 255;
  }
}
