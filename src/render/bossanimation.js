// Continuous joint targets, evaluated at render time. No frame indices or pose dissolves.
import { clamp } from '../core/util.js';
import { bendWing } from './bossrigs.js';

const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const mix = (a, b, k) => a + (b - a) * k;
const angular = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
function rotate(n, x, y, z, k) {
  if (!n) return;
  n.rotation.set(angular(n.rotation.x, x, k), angular(n.rotation.y, y, k), angular(n.rotation.z, z, k));
}
function position(n, x, y, z, k) { n.position.x = mix(n.position.x, x, k); n.position.y = mix(n.position.y, y, k); n.position.z = mix(n.position.z, z, k); }

export function animateBoss(r, P, dt, reset = false) {
  const t = P.t, A = P.act, kind = A?.k, dead = P.dying, live = 1 - dead;
  const k = reset ? 1 : 1 - Math.exp(-dt * 16), slow = reset ? 1 : 1 - Math.exp(-dt * 8);
  const breath = Math.sin(t * (r.type === 'madenKalbi' ? 4.3 : 1.85));
  const stride = P.stride, walking = P.walk * live, wind = P.wind * live, hit = P.hit;
  const sleeping = P.sleep ?? 0, wake = P.wake ?? 1;
  const attacking = A && kind !== 'sleep' && kind !== 'wake';
  const firing = !!(A?.fire || A?.stage === 'fire' || A?.done);
  const release = firing ? 1 : 0;
  const rest = r.torso.userData.restPosition;
  const dragon = r.type === 'ejder' || r.type === 'kavurgan';
  const flight = kind === 'soar' ? 1 : 0;
  const collapse = ease(dead * 1.3);
  const bob = Math.sin(stride * 2) * walking * 0.7 + (P.fly ? Math.sin(t * 1.6) * 1.5 : 0);
  // Root turns are continuous in 3D; the head has a smaller independent look offset.
  r.root.rotation.y = -P.yaw;
  r.root.rotation.z = P.roll || 0;
  if (r.hip) position(r.hip, -hit * 2, 28 - wind * 2 - collapse * 22 + bob, 0, k);
  const down = dragon ? sleeping * 12 + collapse * 20 : P.fly ? collapse * 20 : 0;
  position(r.torso, rest.x + (firing ? 1 : -wind) - hit * 2, rest.y - down + (r.hip ? 0 : bob), rest.z, k);
  const rs = r.torso.userData.restScale;
  r.torso.scale.set(rs.x * (1 + breath * 0.007), rs.y * (1 + breath * 0.019 * live + wind * 0.024), rs.z * (1 + breath * 0.024 * live));
  rotate(r.torso, Math.sin(stride) * walking * 0.025, Math.sin(stride) * walking * 0.055 + (kind === 'tail' ? (firing ? -0.7 : wind * 0.65) : 0), -wind * 0.055 + release * 0.055 - hit * 0.065 - collapse * 0.28, k);

  // Feet follow a planted stance half-cycle and a raised swing half-cycle.
  // Hip/knee angles are an analytic two-link solve, keeping the sole level.
  for (let i = 0; i < r.legs.length; i++) {
    const leg = r.legs[i], phase = stride + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI * 0.3 : 0);
    const p = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
    const dx = (p < 0.6 ? mix(5, -5, p / 0.6) : mix(-5, 5, ease((p - 0.6) / 0.4))) * walking;
    const lift = p < 0.6 ? 0 : Math.sin((p - 0.6) / 0.4 * Math.PI) * 5 * walking;
    const len = leg.length, dy = len * 1.91 - lift - sleeping * len * 0.68 - collapse * len * 0.85 - wind * 1.5;
    const distance = clamp(Math.hypot(dx, dy), 1, len * 1.98), bend = Math.acos(distance / (2 * len));
    const hip = Math.atan2(dx, dy) - bend;
    rotate(leg.upper, leg.side ? leg.side * 0.75 : 0, 0, hip, k);
    rotate(leg.lower, leg.side ? -leg.side * 0.45 : 0, 0, bend * 2, k);
    rotate(leg.foot, 0, 0, -hip - bend * 2, k);
  }
  let jaw = 0.06 + Math.max(0, breath) * 0.05, headPitch = -0.05 + Math.sin(t * 1.2) * 0.018;
  if (kind === 'breath') { jaw = firing ? 0.65 : 0.12 + wind * 0.2; headPitch = firing ? -(P.aimPitch || 0) : wind * 0.17; }
  if (kind === 'wings' || kind === 'gust') jaw = 0.12 + (firing ? 0.5 : wind * 0.15);
  if (kind === 'wake') jaw = Math.sin(ease((wake - 0.35) / 0.4) * Math.PI) * 0.7;
  jaw *= (1 - sleeping) * live; headPitch -= collapse * 0.5;
  if (r.head !== r.torso) rotate(r.head, 0, clamp(P.look || 0, -0.4, 0.4), headPitch, slow);
  if (r.jaw) rotate(r.jaw, 0, 0, -jaw, k);
  const blinkPhase = (t + (P.phase || 0)) % 5.7, blink = blinkPhase < 0.15 ? Math.sin(blinkPhase / 0.15 * Math.PI) : 0;
  for (const lid of r.lids || []) lid.scale.y = Math.max(0.02, sleeping > 0.5 ? 1 : blink);
  if (r.neck.length) {
    for (let i = 0; i < r.neck.length; i++) {
      // The neck leads the wake-up; the chest and wings follow it.
      const sleepNeck = P.sleep != null ? 1 - ease((wake - 0.08 - i * 0.035) / 0.42) : 0;
      rotate(r.neck[i], 0, Math.sin(t * 1.3 - i * 0.5) * 0.018 * live + sleepNeck * 0.08, -sleepNeck * (i === 0 ? 0.4 : 0.06) + breath * 0.012 * live + (kind === 'breath' ? (firing ? -0.17 : wind * 0.08) : 0) - collapse * 0.2, slow);
    }
  }
  for (let i = 0; i < r.tail.length; i++) {
    const lag = t * 1.8 - i * 0.5;
    const sweep = kind === 'tail' ? (firing ? -0.45 : wind * 0.3) * Math.sin(i * 0.3 + 0.4) : 0;
    rotate(r.tail[i], 0, sleeping * 0.35 + Math.sin(lag) * (0.055 + walking * 0.03) * live + sweep, -0.026 + Math.sin(lag * 0.7) * 0.018 + collapse * 0.035, slow);
  }
  let spread = r.type === 'balrog' ? 0.54 : 0.25;
  let flap = Math.sin(t * 1.9) * 0.055;
  if (kind === 'wings' || kind === 'gust') { spread = 0.3 + wind * 0.72; flap = firing ? -Math.sin(Math.max(0, A.T || 0) * 3) * 0.8 : wind * 0.6; }
  if (flight) { spread = 1; flap = Math.sin(t * 7) * 0.8; }
  if (P.sleep != null) { spread = ease((wake - 0.42) / 0.27) * (1 - ease((wake - 0.78) / 0.22) * 0.65); flap = Math.sin(wake * Math.PI) * 0.5; }
  spread *= live; flap = flap * live - collapse * 0.45;
  r.spread = mix(r.spread ?? spread, spread, slow); r.flap = mix(r.flap ?? flap, flap, slow);
  for (const w of r.wings) { bendWing(w, r.spread, r.flap + Math.sin(t * 2 - w.side * 0.4) * 0.025, t); w.root.rotation.y = w.side * ((1 - r.spread) * 0.6 + sleeping * 0.15); }

  for (let i = 0; i < r.arms.length; i++) {
    const arm = r.arms[i]; let shoulder = Math.sin(stride + i * Math.PI) * walking * 0.22 + 0.08, elbow = -0.28;
    if (kind === 'sword' && i === 0) {
      const u = A.stage === 'raise' ? clamp(1 - A.st / 0.8, 0, 1) : 1;
      // The downswing finishes at the simulation's impact boundary.
      if (u < 0.76) { shoulder = mix(0.08, -2.7, ease(u / 0.76)); elbow = -0.45; }
      else { shoulder = mix(-2.7, 1.22, ease((u - 0.76) / 0.24)); elbow = -0.15; }
      if (A.stage !== 'raise') shoulder = mix(1.22, 0.08, ease((0.7 - A.st) / 0.7));
    } else if (kind === 'whip' && i === 1) { shoulder = A.stage === 'wind' ? -1.6 * wind : A.stage === 'lash' ? 1.5 : 0.3; elbow = -0.65; }
    else if (kind === 'wings') { shoulder = -0.4 - wind * 0.9; elbow = -0.4; }
    else if (attacking) { shoulder = -wind * 1.8 + release * 0.9 + (kind === 'cast' ? -0.6 : 0); elbow = -0.5 - wind * 0.4; }
    shoulder += collapse * 0.7;
    rotate(arm.upper, (i ? 1 : -1) * (0.12 + (kind === 'wings' ? r.spread * 0.6 : 0)), 0, shoulder, kind === 'sword' ? (reset ? 1 : 1 - Math.exp(-dt * 38)) : k);
    rotate(arm.lower, 0, 0, elbow, k); rotate(arm.foot, 0, 0, -0.1, k);
  }
  for (let i = 0; i < r.tendrils.length; i++) for (let j = 0; j < r.tendrils[i].length; j++) {
    const n = r.tendrils[i][j], base = n.userData.restRotation;
    rotate(n, base.x, base.y + Math.sin(t * 1.5 - j * 0.65 + i * 0.7) * 0.16 * live, base.z + Math.sin(t * 2 - j * 0.6 + i) * 0.14 * live - 0.12 - wind * 0.08 + release * 0.06, slow);
  }
  for (let i = 0; i < r.cloth.length; i++) rotate(r.cloth[i], Math.sin(t * 1.8 - i * 0.4) * 0.07, 0, 0.07 + Math.sin(t * 2.3 - i * 0.45) * 0.035 + walking * 0.16 + wind * 0.12, slow);
  for (let i = 0; i < r.orbit.length; i++) {
    const n = r.orbit[i], a = t * (r.type === 'ezeli' ? 0.25 : 0.4) + i * Math.PI * 2 / r.orbit.length, radius = 30 + wind * 9;
    n.position.set(Math.cos(a) * radius, 44 + Math.sin(a) * 31 * live - collapse * 25, Math.sin(a * 2) * 16); n.rotation.set(a * 0.3, a, a * 0.5);
  }
  if (r.abdomen) { r.abdomen.rotation.y = Math.sin(t * 1.4 - 0.5) * 0.06; r.abdomen.scale.y = 1 + breath * 0.03 + wind * 0.06; }
  r.root.updateMatrixWorld(true);
}
