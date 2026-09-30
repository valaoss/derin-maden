// Articulated, nearest-pixel animation over the original painted sprites.
// The same deformation positions the body, emissive pixels and attached effects.
import { clamp } from '../core/util.js';

const PAD = 24, LIMIT = 128;
const rigs = new Map();
const frames = new Map();
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
function weights(type, x, y, A, row) {
  if (type !== 'balrog' && type !== 'ejder') {
    const nx = x / A.w, ny = y / A.h;
    const edge = smooth(0.12, 0.4, Math.abs(nx - 0.5));
    const head = (1 - smooth(0.17, 0.32, Math.abs(nx - 0.5))) * (1 - smooth(0.3, 0.48, ny));
    const torso = (1 - edge) * smooth(0.18, 0.32, ny) * (1 - smooth(0.72, 0.93, ny));
    return [edge * (1 - smooth(0.72, 0.92, ny)), head, torso, smooth(0.72, 0.91, ny) * (nx < 0.5 ? -1 : 1), smooth(0.88, 0.95, ny), 0];
  }
  if (type === 'balrog') {
    const wing = (1 - smooth(38, 65, x)) * (1 - smooth(90, 117, y));
    const head = smooth(77, 96, x) * (1 - smooth(69, 83, y)) * smooth(24, 43, y);
    const body = smooth(35, 59, x) * (1 - smooth(99, 132, y)) * (1 - head);
    const leg = smooth(101, 129, y), side = x < A.cx ? -1 : 1;
    return [wing, head, body, leg * side, smooth(127, 136, y), 0];
  }
  const eye = A.eyes[row], chest = A.chests[row];
  const head = smooth(eye[0] - 30, eye[0] - 10, x) * (1 - smooth(12, 32, Math.abs(y - eye[1])));
  const wing = (1 - smooth(67, 96, x)) * (1 - smooth(chest[1] - 20, chest[1], y));
  const tail = (1 - smooth(34, 63, x)) * smooth(chest[1], chest[1] + 18, y);
  const body = (1 - wing) * (1 - head) * (1 - tail) * (1 - smooth(124, 136, y));
  return [wing, head, body, smooth(112, 133, y) * (x < A.cx ? -1 : 1), smooth(130, 136, y), tail];
}

// Channels: wing extension/lift, head reach/lift, chest, stride, tail curl, body twist.
export function bossMotion(type, t, act = null, wind = 0, walk = 0, dying = 0, intro = 0, stir = 0) {
  // 48 distinct poses per breathing cycle; action curves have 32 subdivisions.
  const phase = Math.floor(((t % 3.2) / 3.2) * 48) / 48 * Math.PI * 2;
  const breathe = Math.sin(phase), flutter = Math.sin(phase * 2 + 0.7);
  const k = Math.round(clamp(wind, 0, 1) * 32) / 32;
  const q = [1.5 * flutter, -1.3 * breathe, 0.5 * breathe, -breathe, breathe, walk * Math.sin(phase * 4) * 2, 2 * Math.sin(phase - 0.6), 0.8 * flutter];
  let swordAngle = 0;
  if (type === 'balrog') { q[0] *= 1.5; q[4] *= 1.4; q[6] = 0; }
  if (type === 'otegoz') { q[0] *= 2; q[1] *= 2; q[4] *= 0.5; }
  if (type === 'madenKalbi') { q[4] *= 2.5; q[7] *= 1.8; }
  if (type === 'kehribarAna') { q[0] *= 1.5; q[5] *= 1.8; }
  if (type === 'ezeli') { q[0] *= 1.5; q[1] *= 1.5; q[4] *= 0.4; }
  if (act) {
    if (act.k === 'sleep') {
      q[0] = 0; q[1] = 0.5 * breathe; q[2] = 0; q[3] = -0.65 * breathe;
      q[4] = breathe * 1.8; q[5] = 0; q[6] = stir * Math.sin(phase * 6) * 2; q[7] = 0;
    } else if (act.k === 'wings' || act.k === 'gust' || act.k === 'wake' || act.k === 'soar') {
      const flap = act.k === 'soar' ? Math.sin(phase * 5) : act.done ? Math.sin(Math.PI * clamp(1 - act.T / (type === 'balrog' ? 1.3 : 0.7), 0, 1)) : -k;
      q[0] += (act.k === 'soar' ? 9 : 15) * (act.done ? flap : k);
      q[1] += (act.k === 'soar' ? 11 : 14) * flap;
      q[3] -= 2 * k; q[4] += 2 * k; q[7] += 3 * k;
    } else if (act.k === 'breath') {
      q[2] -= 3 * k; q[3] -= 3 * k; q[4] += 3.5 * k; q[0] += 4 * k;
      if (act.stage === 'fire') { q[2] = -1 + flutter; q[3] = flutter * 0.5; q[4] = 1.5 + flutter * 0.6; }
    } else if (act.k === 'tail') { q[6] += (act.done ? -1 : k) * 9; q[7] += (act.done ? -1 : k) * 4; }
    else if (act.k === 'sword' || act.k === 'whip') {
      q[2] -= k * 2; q[3] -= k * 2; q[7] -= k * 2;
      if (type === 'balrog' && act.k === 'sword' && act.stage === 'raise') swordAngle = -2.2 * (1 - k * k * (3 - 2 * k));
      if (act.stage === 'fall' || act.stage === 'lash') { q[7] += 3; q[4] -= 1.5; }
    } else if (act.k === 'shadow') { q[0] -= k * 4; q[1] += k * 3; q[4] -= k; }
    else { q[0] += k * 3; q[1] -= k * 4; q[3] -= k * 1.5; q[4] += k * 2; q[7] -= k * 2; if (act.fire || act.done) { q[7] += 3; q[1] += 2; } }
  }
  if (intro > 0) { q[0] += Math.sin(intro * Math.PI) * 12; q[1] -= Math.sin(intro * Math.PI) * 9; }
  if (dying > 0) { q[0] = -dying * 7; q[1] = dying * 8; q[3] = dying * 5; q[4] = -dying * 3; q[5] = 0; q[6] *= 1 - dying; }
  return [...q.map(n => Math.round(n * 2) / 2), Math.round(swordAngle * 32) / 32];
}

function offset(type, x, y, q, A, row) {
  const w = weights(type, x, y, A, row);
  const [wing, head, body, leg, foot, tail] = w;
  const wingSide = type === 'balrog' || type === 'ejder' ? -1 : x < A.cx ? -1 : 1;
  return [
    wingSide * wing * q[0] + head * q[2] + body * q[7] + leg * q[5] + tail * q[6],
    wing * q[1] + head * q[3] - body * q[4] + Math.abs(leg) * Math.abs(q[5]) * -0.35 * (1 - foot) + tail * q[6] * 0.5,
  ];
}

export function motionPoint(type, x, y, q, A, row = 0) {
  if (!q) return [x, y];
  const [dx, dy] = offset(type, x, y, q, A, row);
  return [x + dx, y + dy];
}

function rig(type, A, row) {
  const key = type + ':' + row;
  let r = rigs.get(key); if (r) return r;
  const w = A.w + PAD * 2, h = A.h + PAD * 2, masks = new Float32Array(w * h * 6);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) masks.set(weights(type, x - PAD, y - PAD, A, row), (y * w + x) * 6);
  r = { w, h, masks }; rigs.set(key, r); return r;
}

function swordArm(s, A) {
  if (s.swordArm) return s.swordArm;
  const cv = document.createElement('canvas'); cv.width = A.w; cv.height = A.h * 2;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(A.w, A.h * 2), mask = new Uint8Array(A.w * A.h);
  const polygons = [[[3, 26], [9, 2], [107, 12], [122, 27], [111, 40], [55, 32]], [[73, 57], [74, 29], [101, 21], [119, 43], [91, 73]]];
  const inside = (x, y, p) => { let hit = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [ax, ay] = p[i], [bx, by] = p[j]; if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit; } return hit; };
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
    if (!polygons.some(p => inside(x, y, p))) continue;
    mask[y * A.w + x] = 1;
    for (let pass = 0; pass < 2; pass++) {
      const si = (((1 + pass * A.rows) * A.h + y) * s.img.width + x) * 4, di = ((pass * A.h + y) * A.w + x) * 4;
      for (let channel = 0; channel < 4; channel++) img.data[di + channel] = s.pixels[si + channel];
    }
  }
  ctx.putImageData(img, 0, 0); return (s.swordArm = { cv, mask });
}

export function motionFrame(s, A, type, row, fr, q) {
  if (!q) return null;
  const r = rig(type, A, row), key = `${type}:${row}:${fr}:${q.join(',')}`;
  const found = frames.get(key);
  if (found) { frames.delete(key); frames.set(key, found); return found; }
  if (!s.pixels) {
    const cv = document.createElement('canvas'); cv.width = s.img.width; cv.height = s.img.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(s.img, 0, 0);
    s.pixels = ctx.getImageData(0, 0, cv.width, cv.height).data;
  }
  const cv = document.createElement('canvas'); cv.width = r.w; cv.height = r.h * 2;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(r.w, r.h * 2), dst = img.data, src = s.pixels;
  const side = -1, width = s.img.width;
  const arm = type === 'balrog' && row === 1 ? swordArm(s, A) : null;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const p = y * r.w + x, i = p * 6;
    const wing = r.masks[i], head = r.masks[i + 1], body = r.masks[i + 2], leg = r.masks[i + 3], foot = r.masks[i + 4], tail = r.masks[i + 5];
    const wingSide = type === 'balrog' || type === 'ejder' ? side : x - PAD < A.cx ? -1 : 1;
    const dx = wingSide * wing * q[0] + head * q[2] + body * q[7] + leg * q[5] + tail * q[6];
    const dy = wing * q[1] + head * q[3] - body * q[4] - Math.abs(leg) * Math.abs(q[5]) * 0.35 * (1 - foot) + tail * q[6] * 0.5;
    const sx = Math.round(x - PAD - dx), sy = Math.round(y - PAD - dy);
    if (sx < 0 || sx >= A.w || sy < 0 || sy >= A.h) continue;
    if (arm && arm.mask[sy * A.w + sx]) continue;
    // The whip beyond the gripping hand is animated as one continuous world-space curve.
    if (type === 'balrog' && row === 4 && sx > 116 && sy < 111) continue;
    // The near membrane catches light; the receding half of the chest falls into shadow.
    const light = 1 + body * (x / r.w - 0.5) * q[7] * 0.045 + wing * q[0] * 0.006;
    for (let pass = 0; pass < 2; pass++) {
      const si = ((row + pass * A.rows) * A.h * width + sy * width + fr * A.w + sx) * 4;
      const di = (p + pass * r.w * r.h) * 4;
      if (!src[si + 3]) continue;
      dst[di] = Math.min(255, src[si] * (pass ? 1 : light));
      dst[di + 1] = Math.min(255, src[si + 1] * (pass ? 1 : light));
      dst[di + 2] = Math.min(255, src[si + 2] * (pass ? 1 : light)); dst[di + 3] = src[si + 3];
    }
  }
  ctx.putImageData(img, 0, 0);
  if (arm) for (let pass = 0; pass < 2; pass++) {
    ctx.save(); ctx.translate(PAD + 79, pass * r.h + PAD + 70); ctx.rotate(q[8]);
    ctx.drawImage(arm.cv, 0, pass * A.h, A.w, A.h, -79, -70, A.w, A.h); ctx.restore();
  }
  if (frames.size >= LIMIT) frames.delete(frames.keys().next().value);
  const frame = { cv, w: r.w, h: r.h, pad: PAD }; frames.set(key, frame); return frame;
}

export function drawMotion(ctx, frame, A, glow = false) {
  ctx.drawImage(frame.cv, 0, glow ? frame.h : 0, frame.w, frame.h, -A.cx - frame.pad, -A.feet - frame.pad, frame.w, frame.h);
}
