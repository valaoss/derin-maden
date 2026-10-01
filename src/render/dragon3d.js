// Hazine Ejderi: prosedürel 3B modelin piksel çizimi. Her karede duruş -> geometri -> yazılımsal çizici.
import { createSurface, createGeo, resetGeo, camera, project, render } from './soft3d.js';
import { buildDragon, M } from './dragonrig.js';
import { dragonPose } from './dragonpose.js';
import { dragonFight } from './dragonfight.js';

export const DRAGON = { w: 152, h: 124, ox: 76, oy: 106, scale: 0.88, tilt: 12 * Math.PI / 180 };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (...c) => c.map(rgb);
// pul dokusu: sıra sıra kaydırılmış pullar ışık bandının kenarını dişler; karın altın plakalı
const scales = (u, v, i) => { const su = u / 1.8, row = Math.floor(su), sv = v * 16 + (row & 1) * 0.5; return i + ((su - row < 0.5) === (sv - Math.floor(sv) < 0.5) ? 0.045 : -0.045); };
let heat = 0;
function skin(u, v, i, out) {
  if (Math.abs(v - 0.75) >= 0.13) return scales(u, v, i);
  const f = u / 2.6, gap = f - Math.floor(f) < 0.2;
  // nefesten önce göğüs ve boğaz içeriden kızarır: önce plaka araları, sonra plakalar
  if (heat > 0.05 && u > 50 && u < 52 + heat * 34 && (gap || heat > 0.55)) { out.id = M.HOT; return gap ? 0.6 + heat * 0.4 : 0.1 + heat * 0.5; }
  out.id = M.BELLY; return gap ? i - 0.24 : i + 0.05;
}
// tonlar: 0 iç kontur, 1 gölge, 2 orta, 3 ışık, 4 parlama
const MATS = [];
MATS[M.SKIN] = { ramp: ramp('#34090c', '#5c1210', '#8a2216', '#b23a1e', '#de6a30'), px: skin };
MATS[M.LIMB] = { ramp: MATS[M.SKIN].ramp, px: scales };
MATS[M.BELLY] = { ramp: ramp('#6a3a10', '#9a5e16', '#cf9228', '#f0c04a', '#ffe690') };
MATS[M.HORN] = { ramp: ramp('#5a4634', '#8f7a5c', '#c9b68e', '#ece0c0', '#fff8e6') };
MATS[M.MEMB] = { ramp: ramp('#4a0e10', '#7a2018', '#a63c22', '#c85a2c', '#e07c3c'), back: M.MEMB_OUT };
MATS[M.MEMB_OUT] = { ramp: ramp('#24060a', '#3c0a0e', '#541210', '#701c14', '#8a2a18') };
MATS[M.MOUTH] = { ramp: ramp('#2a0408', '#4a080c', '#7a1414', '#a02a1c', '#c04a2a') };
MATS[M.SPIKE] = { ramp: ramp('#3a2410', '#6a4818', '#a07824', '#d0a83c', '#f0d070') };
MATS[M.EYE] = { ramp: ramp('#a04008', '#e07a10', '#ffb020', '#ffe060', '#fff6c0'), flat: true, glow: 1 };
MATS[M.HOT] = { ramp: ramp('#a02808', '#c83c10', '#ff7a22', '#ffb840', '#fff0a0'), flat: true, glow: 1 };
MATS[M.GOLD] = { ramp: ramp('#8a5a10', '#b8801a', '#e0a82a', '#ffd24a', '#fff0a0'), flat: true };
MATS[M.TONGUE] = { ramp: ramp('#5a0c14', '#8a1a20', '#c03a34', '#e06050', '#f08a70') };

let S, geo;
// o: dragonPose girdisi. Dönen pts: bağlantı noktaları (köken ayak hizasına göre piksel)
export function rasterDragon(o, F = 1) {
  S ||= createSurface(DRAGON.w, DRAGON.h); geo ||= createGeo();
  resetGeo(geo);
  const P = dragonPose(o), A = buildDragon(geo, P), cam = camera(o.view ?? P.view, o.tilt ?? DRAGON.tilt, DRAGON.scale, DRAGON.ox, DRAGON.oy, F), pts = {};
  render(S, geo, cam, MATS);
  for (const k in A) { const p = project(cam, A[k]); pts[k] = [p[0] - DRAGON.ox, p[1] - DRAGON.oy]; }
  return { S, P, pts };
}

let cv, cx, img, last = null;
// under(P): gövdeden önce çizilecekler (gölge). Dönen at(ad): bağlantı noktasının dünya pikseli
export function drawDragon3D(ctx, x, feet, F, o, under) {
  const key = `${o.t}:${o.wake}:${o.stir}:${o.look}:${F}`;
  if (!last || last.key !== key) {
    if (!cv) { cv = document.createElement('canvas'); cv.width = DRAGON.w; cv.height = DRAGON.h; cx = cv.getContext('2d'); img = cx.createImageData(DRAGON.w, DRAGON.h); }
    last = rasterDragon(o, F); last.key = key;
    img.data.set(last.S.rgba); cx.putImageData(img, 0, 0);
  }
  x = Math.round(x); feet = Math.round(feet);
  if (under) under(last.P);
  if (ctx) ctx.drawImage(cv, x - DRAGON.ox, feet - DRAGON.oy);
  const at = k => [x + Math.floor(last.pts[k][0]), feet + Math.floor(last.pts[k][1])];
  return { P: last.P, S: last.S, at };
}

// uyanışın son duruşu savaşın ilk karesine aktarılır (aynalı çizimden gerçek dönüşe)
let hoard = null;
export function rememberHoard(P, t) { hoard = { P, t }; }
function mirror(P) {
  const neg = a => a.map(v => -v), sw = (a, f) => [f(a[1]), f(a[0]), f(a[3]), f(a[2])];
  return { ...P, roll: -P.roll, neckY: neg(P.neckY), tailY: neg(P.tailY), head: [P.head[0], -P.head[1], -P.head[2]], feet: sw(P.feet, f => [f[0], f[1], -f[2]]), ank: sw(P.ank, a => a.slice()), pole: sw(P.pole, p => [p[0], p[1], -p[2]]), wing: { ...P.wing, lean: -P.wing.lean } };
}
// savaş: boss/state.js bu tanımla çizer
export const EJDER = {
  w: 176, h: 150, ox: 88, oy: 124, scale: DRAGON.scale, tilt: DRAGON.tilt, mats: MATS, stride: 17, shadow: 30, body: 40, hold: ['tail'], bias: 0.3, turn: 0.5,
  pose: dragonFight, build(g, P) { heat = P.heat || 0; return buildDragon(g, P); },
  seed(e, t) { return hoard && Math.abs(t - hoard.t) < 0.5 ? { P: mirror(hoard.P), view: Math.PI - hoard.P.view } : null; },
};
