// One shared WebGL context composites orthographic 3D creatures into the 2D world.
import * as THREE from 'three';
import { STEP } from '../config.js';
import { G } from '../game/state.js';
import { BOSS_ART } from '../data/bossart.js';
import { clamp, lerp } from '../core/util.js';
import { createBossRig, bendSerpent } from './bossrigs.js';
import { animateBoss } from './bossanimation.js';

const SIZE = 256, RESOLUTION = 256, FLOOR = 202;
const rigs = new Map(), states = new WeakMap(), scratch = new THREE.Vector3();
let renderer, scene, camera, failed = false, contextLost = false, serial = 0;
const black = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
const white = new THREE.MeshBasicMaterial({ color: 0xffe6d4, side: THREE.DoubleSide });

function init() {
  if (failed || contextLost) return false;
  if (renderer) return true;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!context) { failed = true; return false; }
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    renderer.setPixelRatio(1); renderer.setSize(RESOLUTION * 2, RESOLUTION, false); renderer.setClearColor(0x000000, 0); renderer.setScissorTest(true);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); contextLost = true; });
    canvas.addEventListener('webglcontextrestored', () => { contextLost = false; serial++; });
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-SIZE / 2, SIZE / 2, FLOOR, FLOOR - SIZE, 0.1, 1000);
    camera.position.set(0, 0, 400); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    scene.add(new THREE.HemisphereLight(0xc9d8ff, 0x34221b, 1.1));
    const key = new THREE.DirectionalLight(0xffdeb2, 2.2); key.position.set(70, 150, 120); scene.add(key);
    const rim = new THREE.DirectionalLight(0x91b8df, 1.6); rim.position.set(-100, 65, -80); scene.add(rim);
    return true;
  } catch (error) {
    failed = true; console.warn('Boss 3D renderer unavailable; using the Canvas fallback.', error); return false;
  }
}
function rig(type) {
  let r = rigs.get(type);
  if (!r) { r = createBossRig(type); rigs.set(type, r); scene.add(r.root); r.root.visible = false; }
  return r;
}
function canvas() { const cv = document.createElement('canvas'); cv.width = RESOLUTION * 2; cv.height = RESOLUTION; return cv; }
function capture(cv) { const c = cv.getContext('2d'); c.clearRect(0, 0, RESOLUTION * 2, RESOLUTION); c.drawImage(renderer.domElement, 0, 0); }
function targetYaw(e) {
  let player, nearest = Infinity;
  for (const p of G.players || []) if (!p.dead) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < nearest) { nearest = d; player = p; } }
  // A slight three-quarter presentation keeps both shoulders readable in a side-view world.
  const angle = player && nearest > 2 ? Math.atan2(player.y - e.y, player.x - e.x) : e.face < 0 ? Math.PI : 0;
  return angle + Math.cos(angle) * 0.38;
}
function prepare(e, alpha, override = {}) {
  if (!init()) return null;
  const t = override.t ?? Math.max(0, G.time + (alpha - 1) * STEP);
  let s = states.get(e);
  if (!s || t < s.time - 0.1) {
    s = { time: t, yaw: override.yaw ?? targetYaw(e), stride: 0, walk: 0, base: canvas(), stamp: -1, points: {} }; states.set(e, s);
  }
  const act = override.act ?? e.bs?.act, death = e.dead ? clamp(1 - e.dieT / (e.d?.dieT || 0.9), 0, 1) : 0;
  const stamp = `${t}:${alpha}:${act?.k}:${act?.stage}:${act?.st}:${act?.T}:${e.wind}:${e.hitT}:${death}:${override.sleep}:${override.wake}:${override.yaw}:${serial}`;
  const x = lerp(e.px ?? e.x, e.x, alpha), y = lerp(e.py ?? e.y, e.y, alpha);
  s.x = x; s.feet = y + (e.d?.fly && e.type !== 'dunyaYilani' ? 44 : 8);
  if (override.feet != null) s.feet = override.feet;
  if (s.stamp === stamp) return s;
  const dt = clamp(t - s.time, 0, 0.1), fresh = s.stamp === -1;
  const desired = override.yaw ?? targetYaw(e), delta = Math.atan2(Math.sin(desired - s.yaw), Math.cos(desired - s.yaw));
  const locked = act && ['sword', 'whip', 'breath'].includes(act.k);
  // An attack commits to its gameplay side. The head can still aim vertically.
  const yaw = locked ? (e.face < 0 ? Math.PI - 0.3 : 0.3) : desired;
  const turn = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
  s.yaw += fresh ? turn : clamp(turn * (1 - Math.exp(-dt * 6)), -dt * 3.8, dt * 3.8);
  const speed = Math.hypot(e.x - (e.px ?? e.x), e.y - (e.py ?? e.y)) / STEP;
  s.walk = lerp(s.walk, e.dead || act ? 0 : clamp(speed / 18, 0, 1), fresh ? 1 : 1 - Math.exp(-dt * 9));
  s.stride += Math.min(speed, 110) * dt / 6;
  const P = { t, yaw: override.yaw ?? s.yaw, look: delta * 0.35, stride: s.stride, walk: s.walk, act, wind: e.wind || 0, hit: e.hitT > 0 ? clamp(e.hitT / 0.15, 0, 1) : 0, dying: death, fly: !!e.d?.fly, aimPitch: act?.a ? Math.atan2(Math.sin(act.a), Math.abs(Math.cos(act.a))) : 0, ...override };
  const r = rig(e.type);
  // Rigs are shared by type, while pose history is per creature.
  if (r.owner !== s) {
    if (s.joints) r.root.traverse(n => { const p = s.joints.get(n.id); if (p) { n.position.copy(p.p); n.rotation.copy(p.r); n.scale.copy(p.s); } });
    r.owner = s;
  }
  animateBoss(r, P, dt, fresh);
  if (r.body) bendSerpent(r, override.body || [], x, override.feet ?? y);
  if (!s.joints) s.joints = new Map();
  r.root.traverse(n => { let p = s.joints.get(n.id); if (!p) { p = { p: n.position.clone(), r: n.rotation.clone(), s: n.scale.clone() }; s.joints.set(n.id, p); } else { p.p.copy(n.position); p.r.copy(n.rotation); p.s.copy(n.scale); } });
  r.root.visible = true;
  s.size = e.type === 'dunyaYilani' ? 512 : SIZE;
  camera.left = -s.size / 2; camera.right = s.size / 2; camera.top = FLOOR * s.size / SIZE; camera.bottom = (FLOOR - SIZE) * s.size / SIZE; camera.updateProjectionMatrix();
  const original = r.meshes.map(m => m.material);
  if (e.hitT > 0) for (const m of r.meshes) if (!m.userData.glow) m.material = white;
  renderer.setViewport(0, 0, RESOLUTION, RESOLUTION); renderer.setScissor(0, 0, RESOLUTION, RESOLUTION);
  renderer.render(scene, camera);
  for (let i = 0; i < r.meshes.length; i++) r.meshes[i].material = r.meshes[i].userData.glow ? original[i] : black;
  renderer.setViewport(RESOLUTION, 0, RESOLUTION, RESOLUTION); renderer.setScissor(RESOLUTION, 0, RESOLUTION, RESOLUTION);
  renderer.render(scene, camera); capture(s.base);
  for (let i = 0; i < r.meshes.length; i++) r.meshes[i].material = original[i];
  for (const [name, node] of Object.entries(r.anchors)) {
    node.getWorldPosition(scratch); s.points[name] = [scratch.x, -scratch.y, scratch.z >= -3];
  }
  r.root.visible = false; s.time = t; s.stamp = stamp; s.P = P;
  s.opacity = (1 - easeDeath(death)) * (1 - (e.fade || 0));
  s.sink = Math.max(e.sink || 0, e.emergeT > 0 ? clamp(e.emergeT / 0.9, 0, 1) : 0) * 70;
  s.stats = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  return s;
}
const easeDeath = d => clamp((d - 0.75) / 0.25, 0, 1);
export function drawBoss3D(ctx, e, alpha = 1, opacity = 1, glowing = false, override = {}) {
  if (!BOSS_ART[e.type]) return false;
  const s = prepare(e, alpha, override); if (!s) return false;
  ctx.save(); ctx.globalAlpha *= opacity * s.opacity;
  if (!glowing && !e.d?.fly) {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(s.x, s.feet, e.type === 'ejder' ? 36 : 18, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (s.sink > 0) { ctx.beginPath(); ctx.rect(s.x - SIZE / 2, s.feet - SIZE, SIZE, SIZE); ctx.clip(); }
  if (glowing) ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(s.base, glowing ? RESOLUTION : 0, 0, RESOLUTION, RESOLUTION, s.x - s.size / 2, s.feet - FLOOR * s.size / SIZE + s.sink, s.size, s.size);
  ctx.restore(); return true;
}
export function boss3DPoint(e, alpha, name, override = {}) {
  const s = prepare(e, alpha, override), p = s?.points[name]; if (!p) return null;
  return [s.x + p[0], s.feet + p[1] + s.sink, { F: Math.cos(s.P.yaw) < 0 ? -1 : 1, dying: s.P.dying }, p[2]];
}
export function boss3DStats(e) { return states.get(e)?.stats || null; }

// Not: açılışta WebGL ısınması kaldırıldı — bütün spawnlanan bosslar yazılımsal 3B (boss/actor.js) ya da PL sayfasıyla çizilir;
// bu yol yalnız yedek olarak kaldı, gerekirse ilk çizimde kendi kendine kurulur.
