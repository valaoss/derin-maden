// Tavan Yarasası: tüylü küçük gövde, iri kulaklar, kızıl gözler, zar kanatlar. Tavanda baş aşağı, kanatlarına sarılı asılı durur
// (gözünü ara ara açar); dalarken kanatlarını kısar. Ölünce döne döne düşer.
import { dot, line } from '../soft3d.js';
import { D, lerp, ss, at, turn, frame, ell, ball, spike, leaf } from '../boss/rig.js';
import { mobView, ramp } from './common.js';

const M = { FUR: 1, EAR: 2, MEMB: 3, MEMB2: 4, BONE: 5, EYE: 6 };
const MATS = [];
MATS[M.FUR] = { ramp: ramp('#0e0a14', '#231a30', '#3a2c4c', '#56446c', '#7a6690') };
MATS[M.EAR] = { ramp: ramp('#1a0e1a', '#3a2034', '#5c3450', '#84506e', '#b07a94'), flat: true };
MATS[M.MEMB] = { ramp: ramp('#120c1a', '#2a1c36', '#44304e', '#5e4668', '#7c6284'), back: M.MEMB2 };
MATS[M.MEMB2] = { ramp: ramp('#0c0812', '#1e1428', '#30223c', '#42304e', '#584264') };
MATS[M.BONE] = { ramp: ramp('#0a0810', '#1c1426', '#34284a', '#54446e', '#7a6a96'), flat: true, soft: true };
MATS[M.EYE] = { ramp: ramp('#7a1010', '#c02a1a', '#ff4a3a', '#ff7a5a', '#ffc0a0'), flat: true, soft: true, glow: 1 };

// kanat noktaları (omuza göre: ileri, yukarı, yana): bilek ve üç parmak ucu; açık (çırpma açısı a) ve sarılı
const OPEN = a => [[0.8, Math.sin(a + 0.25) * 4.2, Math.cos(a + 0.25) * 4.2], [1.8, Math.sin(a * 1.25) * 8.6, Math.cos(a * 1.25) * 8.6], [-1.6, Math.sin(a) * 7.6, Math.cos(a) * 7.6], [-3.4, Math.sin(a - 0.15) * 5, Math.cos(a - 0.15) * 5]];
const FOLD = [[0.6, 0.5, 1.2], [4.8, -0.9, 0.9], [4.4, -1.6, 0.2], [3.2, -2, -0.4]];

function build(g, P) {
  const A = {}, T = turn(frame([0, P.py, 0]), 0, P.pitch, P.roll), op = OPEN(P.flap), k = P.fold;
  ell(g, frame(at(T, -0.5, 0, 0), T.f, T.u, T.r), 2.7, 2, 2, M.FUR, 8, 4);
  ball(g, at(T, 2.5, 0.5, 0), 1.7, M.FUR, 6);
  dot(g, at(T, 4.2, 0.1, 0), M.EAR, 3);
  for (const s of [-1, 1]) {
    spike(g, at(T, 2.2, 1.5, s * 0.9), at(T, 1.8, 4.2, s * 2), 0.85, M.EAR, 3);
    if (P.eye > 0.5) dot(g, at(T, 3.8, 0.4, s * 0.9), M.EYE, 3);
    const w = op.map((q, i) => at(T, 0.6 + lerp(q[0], FOLD[i][0], k), 0.9 + lerp(q[1], FOLD[i][1], k), s * (1.3 + lerp(q[2], FOLD[i][2], k))));
    const sh = at(T, 0.6, 0.9, s * 1.3), hip = at(T, -2.6, -0.3, s * 0.7);
    leaf(g, w[0], w[1], w[2], M.MEMB, s); leaf(g, w[0], w[2], w[3], M.MEMB, s); leaf(g, w[0], w[3], hip, M.MEMB, s); leaf(g, sh, w[0], hip, M.MEMB, s);
    line(g, sh, w[0], M.BONE, 3); for (let i = 1; i < 4; i++) line(g, w[0], w[i], M.BONE, i === 1 ? 3 : 2);
    // ayak: asılıyken tavana tutunur
    line(g, at(T, -2.8, -0.6, s * 0.6), at(T, -4.3, -0.2, s * 0.8), M.BONE, 2);
  }
  A.head = at(T, 2.5, 2.5, 0); A.mouth = at(T, 4, -0.3, 0);
  return A;
}

function pose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, hang = e.hang === 2 && !dead, near = Math.cos(o.view) >= 0 ? 1 : -1;
  let flap = 0.15 + Math.sin(t * 17 + o.wob) * 0.75, fold = 0, pitch = 6 + 10 * o.walk, roll = 0, py = Math.sin(t * 8.5 + o.wob) * 0.6, eye = 1, rate = 45;
  if (hang) { fold = 1; flap = 0; pitch = -90; py = 1.5 + Math.sin(t * 1.6 + o.wob) * 0.12; roll = Math.sin(t * 1.1 + o.wob) * 5; eye = (t * 0.6 + o.wob) % 3.2 < 0.3 ? 1 : 0; rate = 14; }
  else if (e.st === 'dive') { fold = 0.35; flap = 0.5 + Math.sin(t * 30) * 0.2; pitch = -24; }
  if (o.lunge > 0.001 && !hang) pitch -= 16 * o.lunge;
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; roll += near * 30 * h; py -= 0.8 * h; }
  if (dead) { const d = o.dying, k = ss(0, 0.5, d); roll = near * 200 * k; pitch = lerp(pitch, -40, k); flap = 0.9; fold = 0.3 * k; py = -5 * d * d; eye = 0; rate = 60; }
  return { rate, flap, fold, pitch: pitch * D, roll: roll * D, py, eye, zoom: e.scale || 1 };
}

export const SARKAN = { w: 40, h: 40, ox: 20, oy: 20, scale: 1, tilt: 0.22, center: true, mats: MATS, stride: 20, foot: 6, top: 7, shadow: 0, body: 8, crease: 1.4, outline: [8, 5, 12], turnRate: 9, view: o => mobView(o, 0.45), pose, build };
