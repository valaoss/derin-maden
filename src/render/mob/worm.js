// Maden Solucanı: boğum boğum, ıslak pembe gövde; başa yakın açık renkli kalın kuşak, sivrilen kuyruk.
// Gövde gerçekten geçtiği yolu izler (iz varlık başına tutulur), boğumlar baştan kuyruğa dalga dalga kasılır.
// Kayayı kemirirken ve ısırırken ağız halkası açılır, içindeki diş çemberi görünür. Ölürken kıvranır, sonra büzülür.
import { dot } from '../soft3d.js';
import { TAU, lerp, clamp, ss, mad, sub, norm, len, skin, spike, ring, cap } from '../boss/rig.js';
import { ramp, fr } from './common.js';

const M = { SKIN: 1, BAND: 2, MOUTH: 3, TOOTH: 4, EYE: 5 };
const MATS = [];
// boğum olukları; başa yakın kuşak (u: burundan beri uzunluk) açık ve düz
function skinPx(u, v, i, out) {
  if (u > 8.5 && u < 13.5) { out.id = M.BAND; return i + 0.04; }
  return i - (fr(u / 2.3) < 0.24 ? 0.3 : 0);
}
MATS[M.SKIN] = { ramp: ramp('#2c1220', '#5e2a40', '#96506a', '#c47c94', '#f0b4c6'), px: skinPx };
MATS[M.BAND] = { ramp: ramp('#4a2a30', '#86505a', '#bc8088', '#e2aab0', '#ffdcdc') };
MATS[M.MOUTH] = { ramp: ramp('#1c060c', '#3a0c18', '#5e1626', '#842436', '#aa3a4c'), flat: true };
MATS[M.TOOTH] = { ramp: ramp('#8a7a68', '#c0b4a0', '#e6dcc8', '#fff8e8', '#ffffff'), flat: true };
MATS[M.EYE] = { ramp: ramp('#7a1010', '#c02a1a', '#ff4a3a', '#ff7a5a', '#ffc0a0'), flat: true, soft: true, glow: 1 };

// iz: varlığın geçtiği dünya noktaları (en yenisi başta); a, b: kıvranma ve kasılma fazları
const trails = new WeakMap(), GAP = 2, KEEP = 22, SEG = 3, N = 12;
function trailOf(e) {
  let tr = trails.get(e);
  if (!tr) {
    tr = (e.trail || []).map(q => [q.x, q.y]); tr.a = tr.b = 0;
    if (!tr.length) tr.push([e.x - (e.face || 1) * 3, e.y + 4], [e.x - (e.face || 1) * 4, e.y + 10]);
    trails.set(e, tr);
  }
  const d = Math.hypot(tr[0][0] - e.x, tr[0][1] - e.y);
  if (d > 40) { tr.length = 0; tr.push([e.x - (e.face || 1) * 7, e.y + 1]); }
  else if (d >= GAP) { tr.unshift([e.x, e.y]); if (tr.length > KEEP) tr.pop(); }
  return tr;
}
// yol boyunca eşit aralıklı eklemler (baş kökende, +y yukarı); yol kısaysa gövde o kadar çıkar
function spine(e, tr) {
  const pts = [[0, 0]]; let px = e.x, py = e.y, need = SEG, i = 0;
  while (pts.length < N && i < tr.length) {
    const dx = tr[i][0] - px, dy = tr[i][1] - py, d = Math.hypot(dx, dy);
    if (d < need) { need -= d; px = tr[i][0]; py = tr[i][1]; i++; continue; }
    px += dx / d * need; py += dy / d * need; need = SEG; pts.push([px - e.x, e.y - py]);
  }
  if (pts.length < 2) pts.push([px - e.x || -(e.face || 1) * 3, e.y - py]);
  return pts;
}

const UP = [0, 0, 1];
function build(g, P, o) {
  const A = {}, e = o.e, tr = trailOf(e), pts = spine(e, tr), n = pts.length, J = [];
  tr.a += o.dt * P.wigF; tr.b += o.dt * 7;
  // baş yönü ve ağız: burun ucu başın önünde
  const h = norm([pts[0][0] - pts[1][0], pts[0][1] - pts[1][1], 0]), side = [-h[1], h[0], 0], open = P.mouth, R0 = 3.9 * P.fat;
  const head = mad([0, 0, 0], h, P.reach), tip = mad(head, h, 2.6 - open * 0.8);
  J.push({ p: tip, u: UP, rx: lerp(2.3, 3.4, open) * P.fat, ry: lerp(2.3, 3.4, open) * P.fat });
  for (let i = 0; i < n; i++) {
    // kıvranma yola dik; kasılma dalgası baştan kuyruğa
    const k = i / (N - 1), a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = a[0] - b[0], ty = a[1] - b[1], tl = Math.hypot(tx, ty) || 1;
    const wig = Math.sin(tr.a - i * 0.95 + o.wob) * P.wig * Math.min(1, i / 3), sq = 1 + Math.sin(tr.b - i * 1.15) * P.squeeze;
    const r = (i === n - 1 ? 0.9 : lerp(4.3, 1.5, ss(0.12, 1, k)) * (i === 0 ? 0.93 : 1)) * sq * P.fat;
    J.push({ p: i ? [pts[i][0] - ty / tl * wig, pts[i][1] + tx / tl * wig, Math.cos(tr.a * 0.7 - i) * P.wig * 0.4] : head, u: UP, rx: r, ry: r });
  }
  skin(g, J, 9, M.SKIN, { sub: 2, open: open > 0.12 });
  if (open > 0.12) {
    // ağız: koyu boğaz, çevresinde içe eğik diş çemberi
    const rim = lerp(2.3, 3.4, open) * P.fat, B = ring(g, mad(tip, h, -0.4), h, UP, rim, rim, 8, 0);
    cap(g, B, 8, mad(tip, h, -1.6), h, M.MOUTH);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3, d = mad(mad([0, 0, 0], side, Math.cos(a)), UP, Math.sin(a)), b = mad(tip, d, rim * 0.92); spike(g, b, mad(mad(b, h, 1.5 + open * 0.6), d, -rim * 0.5), 0.55, M.TOOTH, 3); }
  }
  // karanlıkta parlayan küçük göz beneği (başın üst yanında)
  dot(g, mad(mad(head, side, (side[1] < 0 ? -1 : 1) * R0 * 0.5), UP, R0 * 0.85), M.EYE, P.eye > 0.5 ? 3 : 0);
  A.mouth = tip; A.head = head;
  return A;
}

function pose(o) {
  const t = o.t, e = o.e, dead = o.dying > 0, w = dead ? 0 : o.walk, l = o.lunge, wd = ss(0, 1, o.wind) * (1 - l);
  // kemirme: av peşinde yerinde sayıyorsa (kayayı deliyor) çene çalışır
  const chew = !dead && w < 0.4 && (e.st === 'hunt' || e.st === 'dig') ? 0.5 + 0.5 * Math.sin(t * 15 + o.wob) : 0;
  let mouth = Math.max(chew * 0.8, wd * 0.9, l), reach = -wd * 1.4 + l * 3, wig = lerp(1, 0.45, w), wigF = lerp(3.2, 6, w), squeeze = 0.03 + 0.07 * w, fat = 1, eye = 1, rate = 30;
  if (o.hurt > 0 && !dead) { const h = o.hurt * o.hurt; wig += 1.4 * h; wigF += 8 * h; fat += 0.08 * h; mouth = Math.max(mouth, 0.5 * h); }
  if (dead) { const d = o.dying, k = ss(0.45, 1, d); wig = lerp(2.6, 0.3, k); wigF = lerp(17, 3, k); fat = lerp(1.05, 0.62, k); mouth = 0.6 * (1 - k); squeeze = 0.1 * (1 - k); eye = 1 - ss(0.3, 0.6, d); rate = 60; }
  return { rate, mouth, reach, wig, wigF, squeeze, fat, eye, tilt: 0, zoom: e.scale || 1 };
}

export const WORM = { w: 116, h: 116, ox: 58, oy: 58, scale: 1, tilt: 0, mats: MATS, stride: 20, foot: 6, top: 6, center: true, body: 12, crease: 2, outline: [20, 6, 12], view: () => 0, pose, build };
