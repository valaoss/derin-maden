// Boss aktörü (DOM'suz): varlığın durumundan animasyon girdisini çıkarır, duruşu yumuşatır, 3B modeli çizer.
// Her boss tanımı (defs.js): { w, h, ox, oy, scale, tilt, mats, pose(o), build(g, P) } verir.
import { STEP } from '../../config.js';
import { BALROG } from '../../data/balance.js';
import { createSurface, createGeo, resetGeo, camera, project, render } from '../soft3d.js';
import { clamp, viewOf } from './rig.js';
import { DEFS } from './defs.js';

const states = new WeakMap(), FPS = 1 / 31;
let geo = null;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// sayısal alanları hedefe yaklaştırır (eylemler arası geçiş, ağırlık hissi); a yerinde güncellenir
function ease(a, b, k) {
  for (const key in b) {
    const v = b[key];
    if (typeof v === 'number') a[key] = typeof a[key] === 'number' ? a[key] + (v - a[key]) * k : v;
    else if (v && typeof v === 'object') a[key] = ease(a[key] && typeof a[key] === 'object' ? a[key] : Array.isArray(v) ? [] : {}, v, k);
    else a[key] = v;
  }
  return a;
}
function nearest(e, players) {
  let best = null, bd = Infinity;
  for (const p of players || []) if (!p.dead) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; best = p; } }
  return best;
}

// o: duruş fonksiyonunun girdisi
function input(s, e, t, players, D) {
  const dt = clamp(t - s.t, 0, 0.1); s.t = t;
  const B = e.bs, A = B && B.act, p = nearest(e, players);
  const vx = (e.x - e.px) / STEP, vy = (e.y - e.py) / STEP, sp = e.dead ? 0 : Math.hypot(vx, vy);
  s.walk += ((sp > 3 ? 1 : 0) - s.walk) * Math.min(1, dt * 9);
  s.ph += Math.min(sp, 220) * dt / (D.stride || 30);
  s.vx += (vx - s.vx) * Math.min(1, dt * 6); s.vy += (vy - s.vy) * Math.min(1, dt * 6);
  // vuruş: kısa hitT yerine kendi süresince oynar
  if (e.hitT > 0 && t - s.hurtAt > 0.3) { s.hurtAt = t; s.hx = e.hitDx || 0; s.hy = e.hitDy || 0; }
  const phase = B ? B.phase : 1;
  if (phase === 2 && s.phase === 1) s.rageAt = t;
  s.phase = phase;
  const k = A ? A.k : null;
  if (k !== s.act) { s.prev = s.act; s.act = k; s.actAt = t; }
  const stage = A ? A.stage || '' : '';
  if (stage !== s.stage) { s.stage = stage; s.stageAt = t; }
  // yön: nişan varsa nişana, yoksa en yakın madenciye; tutulan eylemlerde gövde dönmez
  if (!e.dead && !(k && D.hold && D.hold.includes(k))) {
    const aim = A && A.a, far = p && Math.hypot(p.x - e.x, p.y - e.y) > 4;
    const yaw = Number.isFinite(aim) ? aim : far ? Math.atan2(p.y - e.y, p.x - e.x) : e.face < 0 ? Math.PI : 0;
    s.yaw += clamp(wrap(yaw - s.yaw), -dt * 5.5, dt * 5.5);
  }
  const o = {
    t, dt, e, A, act: k, stage, since: t - s.actAt, sinceStage: t - s.stageAt, prev: s.prev,
    yaw: s.yaw, face: e.face || 1, walk: s.walk, ph: s.ph, speed: sp, vx: s.vx, vy: s.vy,
    wind: e.wind || 0, lunge: e.lunge || 0, aim: A && Number.isFinite(A.a) ? A.a : null,
    hurt: clamp(1 - (t - s.hurtAt) / 0.38, 0, 1), hx: s.hx, hy: s.hy,
    dying: e.dead ? clamp(1 - e.dieT / (e.d.dieT || (e.d.boss ? 0.9 : 0.42)), 0, 1) : 0,
    intro: e.intro > 0 ? 1 - e.intro / BALROG.intro : -1,
    rage: phase === 2, rageT: t - s.rageAt, blink: e.blinkT > 0 ? e.blinkT / 0.3 : 0, fade: e.fade || 0, flash: e.flashT || 0,
    tx: p ? p.x - e.x : (e.face || 1) * 60, ty: p ? p.y - e.y : 0, wob: e.wob || 0,
  };
  const v = D.view ? D.view(o) : viewOf(s.yaw, D.bias, D.turn);
  s.view = s.view == null ? v : s.view + clamp(wrap(v - s.view), -dt * (D.turnRate || 6), dt * (D.turnRate || 6));
  o.view = s.view;
  return o;
}

// P, view: başlangıç duruşu (uyanan ejderin son karesi) -> ilk karede sıçrama olmaz
function fresh(e, t, P = null, view = null) {
  return { t, walk: 0, ph: 0, vx: 0, vy: 0, yaw: e.face < 0 ? Math.PI : 0, view, hurtAt: -9, hx: 0, hy: 0, phase: e.bs ? e.bs.phase : 1, rageAt: -9, act: null, prev: null, actAt: -9, stage: '', stageAt: -9, P, rt: P ? t - 0.001 : -9, R: null };
}

// dönen: { S, P, pts, o, D, cam } ; aynı kare içinde (ana + ışık katmanı) önbellekten gelir. D: tanım (küçük düşmanlar kendi tanımını verir)
export function rasterBoss(e, t, players, D = DEFS[e.type]) {
  if (!D) return null;
  let s = states.get(e);
  if (!s || t < s.t - 0.05) {
    const sd = D.seed && D.seed(e, t), p = nearest(e, players);
    s = fresh(e, t, sd && sd.P, sd && sd.view); states.set(e, s);
    if (!sd && p) s.yaw = Math.atan2(p.y - e.y, p.x - e.x);
  }
  if (s.R && D.owner === s && t - s.rt < FPS && t >= s.rt) return s.R;
  const dt = clamp(t - s.rt, 0, 0.1), o = input(s, e, t, players, D), target = D.pose(o);
  // tam tur dönüşler (kuyruk darbesi, matkap hücumu) bitince geri sarmasın
  if (s.P) for (const k of D.wrap || ['spin']) if (typeof s.P[k] === 'number' && typeof target[k] === 'number') s.P[k] += Math.PI * 2 * Math.round((target[k] - s.P[k]) / (Math.PI * 2));
  s.P = s.P ? ease(s.P, target, 1 - Math.exp(-dt * (target.rate || 22))) : ease({}, target, 1);
  const P = s.P;
  D.S ||= createSurface(D.w, D.h); geo ||= createGeo(16384, 32768);
  resetGeo(geo);
  const A = D.build(geo, P, o), cam = camera(o.view + (P.spin || 0), P.tilt ?? D.tilt ?? 0.2, (D.scale || 1) * (P.zoom || 1), D.ox, D.oy, 1), pts = {};
  render(D.S, geo, cam, D.mats, D);
  for (const k in A) { const q = project(cam, A[k]); pts[k] = [q[0] - D.ox, q[1] - D.oy, q[2]]; }
  D.owner = s; s.rt = t;
  return (s.R = { S: D.S, P, pts, o, D, cam, stamp: t });
}
