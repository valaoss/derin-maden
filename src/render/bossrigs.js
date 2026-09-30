// Authored 3D creatures. Every joint carries real geometry; no billboard body parts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const materials = new Map();
const ramp = new THREE.DataTexture(new Uint8Array([65, 125, 190, 245]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const grainPixels = new Uint8Array(64 * 64 * 4);
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
  const n = Math.sin(x * 73.13 + y * 191.7) * 43758.5453, v = 185 + Math.floor((n - Math.floor(n)) * 70), i = (y * 64 + x) * 4;
  grainPixels.set([v, v, v, 255], i);
}
const grain = new THREE.DataTexture(grainPixels, 64, 64); grain.magFilter = THREE.NearestFilter; grain.needsUpdate = true;
function material(color, glow = false) {
  const key = color + ':' + glow;
  if (!materials.has(key)) materials.set(key, glow
    ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    : new THREE.MeshToonMaterial({ color, map: grain, gradientMap: ramp, side: THREE.DoubleSide }));
  return materials.get(key);
}
function mesh(parent, geometry, color, glow = false) {
  const m = new THREE.Mesh(geometry, material(color, glow)); parent.add(m); m.userData.glow = glow; return m;
}
function joint(parent, name, x = 0, y = 0, z = 0) {
  const g = new THREE.Bone(); g.name = name; g.position.set(x, y, z); parent.add(g); return g;
}
function ell(parent, color, x, y, z, sx, sy, sz, detail = 12, glow = false) {
  const g = new THREE.SphereGeometry(1, detail, 8); g.scale(sx, sy, sz); g.translate(x, y, z); return mesh(parent, g, color, glow);
}
function rod(parent, color, a, b, r1, r2 = r1, glow = false, sides = 7) {
  const av = V(...a), bv = V(...b), d = bv.clone().sub(av);
  const g = new THREE.CylinderGeometry(r2, r1, d.length(), sides, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate(...av.add(bv).multiplyScalar(0.5).toArray()); return mesh(parent, g, color, glow);
}
function horn(parent, color, points, radius) {
  for (let i = 1; i < points.length; i++) rod(parent, color, points[i - 1], points[i], radius * (1 - (i - 1) / points.length), i === points.length - 1 ? 0.06 : radius * (1 - i / points.length));
}
function anchor(parent, name, x, y, z) { const p = new THREE.Object3D(); p.name = name; p.position.set(x, y, z); parent.add(p); return p; }
function plates(parent, color, center, radii, rows, columns, glow = false) {
  // Overlapping diamond scutes follow the curved surface instead of a flat texture.
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = (i + (j % 2) * 0.5) / columns * Math.PI * 2, h = (j / (rows - 1) - 0.5) * 1.65;
    const r = Math.sqrt(Math.max(0.12, 1 - h * h));
    const g = new THREE.OctahedronGeometry(1); g.scale(radii[0] * 0.22, radii[1] / rows * 0.7, 0.8);
    g.rotateY(a); g.translate(center[0] + Math.sin(a) * radii[0] * r, center[1] + h * radii[1], center[2] + Math.cos(a) * radii[2] * r);
    mesh(parent, g, color, glow);
  }
}
function limb(parent, name, position, length, radius, color, claw) {
  const upper = joint(parent, name, ...position);
  ell(upper, color, 0, -length * 0.38, 0, radius, length * 0.58, radius * 0.9);
  const lower = joint(upper, name + '-lower', 0, -length, 0);
  ell(lower, color, 1, -length * 0.38, 0, radius * 0.75, length * 0.55, radius * 0.7);
  const foot = joint(lower, name + '-foot', 0, -length, 0);
  ell(foot, color, 3, 1.3, 0, radius * 1.25, 2.6, radius);
  for (let i = -1; i <= 1; i++) rod(foot, claw, [4, 1.4, i * radius * 0.6], [radius * 2 + 2, 0, i * radius * 0.65], 1, 0.05);
  return { upper, lower, foot, length, rest: position };
}
function wing(parent, side, color, bone, size, x, y, z) {
  const root = joint(parent, 'wing-' + side, x, y, z);
  const positions = new Float32Array(9 * 6 * 3), indices = [];
  for (let f = 0; f < 8; f++) for (let u = 0; u < 5; u++) { const a = f * 6 + u; indices.push(a, a + 6, a + 1, a + 1, a + 6, a + 7); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(indices);
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(9 * 6 * 2).map((_, i) => i % 2 ? Math.floor(i / 2) % 6 / 5 : Math.floor(i / 12) / 8), 2));
  const skin = mesh(root, g, color); skin.frustumCulled = false;
  const ribs = [];
  for (let i = 0; i < 5; i++) {
    const rib = mesh(root, new THREE.CylinderGeometry(0.3, 1.15, 1, 5), bone); ribs.push(rib);
  }
  const tip = ell(root, bone, 0, 0, 0, 1.3, 1.3, 1.3);
  const arm = mesh(root, new THREE.CylinderGeometry(1.15, 2.5, 1, 7), bone); arm.userData.moving = true;
  return { root, side, size, skin, ribs, tip, arm };
}
export function bendWing(w, spread, flap, time) {
  const p = w.skin.geometry.attributes.position, s = w.size, side = w.side;
  const wrist = V(-s * (0.12 + (1 - spread) * 0.25), s * (0.23 + spread * 0.26), side * s * (0.17 + spread * 0.4));
  const ends = [];
  for (let f = 0; f < 5; f++) {
    const k = f / 4;
    ends.push(f === 4 ? V(-s * 0.03, -s * 0.26, side * 3) : V(-s * (0.07 + k * 0.73 + (1 - spread) * 0.18), s * (0.58 - k * 1.08) + flap * s * (0.15 + k * 0.1), side * s * (0.38 + spread * 0.95) * (1 - k * 0.36)));
    const end = ends[f], d = end.clone().sub(wrist), rib = w.ribs[f];
    rib.position.copy(wrist).add(end).multiplyScalar(0.5); rib.scale.y = d.length(); rib.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  }
  for (let f = 0; f < 9; f++) {
    const end = f % 2 ? ends[(f - 1) / 2].clone().lerp(ends[(f + 1) / 2], 0.5).lerp(wrist, 0.19) : ends[f / 2];
    for (let u = 0; u < 6; u++) {
      const t = u / 5, v = wrist.clone().lerp(end, t);
      // Membranes lag behind their rigid leading edges; the scalloped edge stays taut.
      v.y -= Math.sin(t * Math.PI) * s * 0.08;
      v.x += Math.sin(time * 3.8 - t * 3 - f * 0.5) * Math.sin(t * Math.PI) * (0.6 + spread);
      p.setXYZ(f * 6 + u, v.x, v.y, v.z);
    }
  }
  w.tip.position.copy(wrist); p.needsUpdate = true; w.skin.geometry.computeVertexNormals();
  w.arm.position.copy(wrist).multiplyScalar(0.5); w.arm.scale.y = wrist.length(); w.arm.quaternion.setFromUnitVectors(V(0, 1, 0), wrist.clone().normalize());
  w.root.rotation.x = side * flap * 0.42;
}
function chain(parent, name, start, count, length, radius, color, spikeColor) {
  const nodes = []; let p = joint(parent, name + '-base', ...start);
  for (let i = 0; i < count; i++) {
    const g = i ? joint(p, name + i, -length, 0, 0) : p, r = radius * Math.pow(1 - i / count, 0.8);
    rod(g, color, [1, 0, 0], [-length - 1, 0, 0], r, Math.max(0.35, r * 0.82));
    if (spikeColor) horn(g, spikeColor, [[-length * 0.45, r * 0.7, 0], [-length * 0.8, r + 4 * (1 - i / count), 0], [-length, r + 5 * (1 - i / count), 0]], r * 0.3);
    nodes.push(g); p = g;
  }
  return nodes;
}
function skull(parent, color, hornColor, eyeColor, scale = 1) {
  const g = joint(parent, 'head'); g.scale.setScalar(scale);
  const lids = [];
  ell(g, color, 3, 0, 0, 11, 7, 6); ell(g, color, 13, -2, 0, 10, 3.8, 4.2);
  for (const side of [-1, 1]) {
    ell(g, '#140e13', 5.5, 1, side * 5.5, 4.3, 2.4, 0.8);
    ell(g, eyeColor, 7, 1.4, side * 6.15, 2.5, 0.9, 0.55, 8, true);
    ell(g, '#130908', 8, 1.4, side * 6.6, 0.45, 1.05, 0.2, 8);
    const lid = joint(g, 'eyelid' + side, 7, 1.4, side * 6.7); ell(lid, color, 0, 0, 0, 3, 1.4, 0.45); lids.push(lid);
    horn(g, hornColor, [[-2, 3, side * 4], [-9, 9, side * 8], [-18, 12, side * 8], [-22, 11, side * 6]], 2.8);
    rod(g, color, [1, 4, side * 5.2], [12, 3.6, side * 4.9], 2.1, 0.6);
    for (let i = 0; i < 5; i++) rod(g, hornColor, [8 + i * 2.7, -4, side * 3.2], [8 + i * 2.7, -6.2, side * 3], 0.65, 0.02);
    ell(g, '#160b09', 20.7, -0.6, side * 2.7, 1.1, 0.8, 0.7);
  }
  const jaw = joint(g, 'jaw', 0, -3, 0);
  ell(jaw, color, 11, -2, 0, 11.5, 2.1, 3.8); ell(jaw, '#7d211c', 11, -0.1, 0, 9, 0.65, 2.8);
  for (let s of [-1, 1]) for (let i = 0; i < 5; i++) rod(jaw, hornColor, [7 + i * 2.7, 0, s * 3], [7 + i * 2.7, 1.5, s * 3], 0.5, 0.01);
  return { head: g, jaw, lids, eyes: anchor(g, 'eyes', 8, 1.5, 6), mouth: anchor(g, 'mouth', 22, -4, 0) };
}
function dragon(r, ash = false, serpent = false) {
  const col = ash ? '#48413c' : serpent ? '#174455' : '#812b20', hi = ash ? '#a28c6a' : serpent ? '#438590' : '#bb6132', bone = ash ? '#ddcba4' : '#d8bb82';
  const body = r.torso = joint(r.root, 'chest', -9, serpent ? 0 : 28, 0);
  if (!serpent) {
    ell(body, col, -4, 0, 0, 27, 15, 14, 16); ell(body, hi, 10, -5, 0, 15, 10, 11);
    plates(body, ash ? '#796e59' : '#995037', [-4, 0, 0], [26, 15, 14], 9, 17);
    for (let i = 0; i < 7; i++) { const x = -27 + i * 7; horn(body, bone, [[x, 11, 0], [x - 4, 21 - Math.abs(i - 4), 0], [x - 6, 19, 0]], 2.5); }
    r.tail = chain(body, 'tail', [-28, -1, 0], 10, 6, 7, col, bone);
    r.wings = [-1, 1].map(s => wing(body, s, ash ? '#403331' : '#753025', col, ash ? 47 : 66, 1, 8, s * 8));
    for (const x of [-24, 14]) for (const s of [-1, 1]) r.legs.push(limb(r.root, 'leg' + x + s, [x, 26, s * 11], 12, x < 0 ? 5.7 : 4, col, bone));
  }
  r.neck = [];
  let n = body;
  for (let i = 0; i < 3; i++) {
    n = joint(n, 'neck' + i, i ? 9 : 17, i ? 6 : 8, 0);
    ell(n, col, 3, 2, 0, 9, 7 - i, 7 - i);
    for (let j = 0; j < 3; j++) ell(n, hi, j * 3, -4 + i, 0, 1.3, 1, 5.4 - i);
    horn(n, bone, [[0, 6, 0], [-3, 13 - i, 0], [-6, 11 - i, 0]], 1.8);
    r.neck.push(n);
  }
  const h = skull(n, col, bone, serpent ? '#a0ffff' : '#ffdb58', serpent ? 1.1 : 1);
  Object.assign(r, h); r.head.position.set(7, 4, 0); r.anchors = { eyes: h.eyes, mouth: h.mouth, chests: anchor(body, 'chests', 13, 1, 10) };
  if (serpent) { r.root.scale.setScalar(0.74); body.position.set(-35, -12, 0); }
  else if (ash) r.root.scale.setScalar(0.8);
}
function humanoid(r, kind) {
  const bal = kind === 'balrog', tree = kind === 'karakok', mirror = kind === 'aynasiz';
  const color = bal ? '#252329' : tree ? '#4b3924' : mirror ? '#414c71' : '#493232';
  const armor = bal ? '#494044' : tree ? '#71804b' : mirror ? '#a4bed1' : '#b38a40';
  const light = bal ? '#ff9b24' : tree ? '#b5e878' : mirror ? '#d6eaff' : '#ffe194';
  const height = bal ? 1.18 : 1;
  r.root.scale.setScalar(height);
  const hip = r.hip = joint(r.root, 'pelvis', 0, 28, 0);
  ell(hip, color, -2, 0, 0, 10, 9, 12);
  const torso = r.torso = joint(hip, 'spine', 0, 8, 0);
  ell(torso, color, -2, 10, 0, 12, 18, bal ? 21 : 18); ell(torso, armor, 6, 14, 0, 5, 10, 16);
  if (bal) for (const s of [-1, 1]) {
    ell(torso, '#3d3639', 8, 18, s * 8, 5, 7, 9);
    for (let j = 0; j < 5; j++) horn(torso, '#ff6923', [[10, 20 - j * 4, s * 1.5], [12, 19 - j * 4, s * 5], [10, 17 - j * 4, s * 11]], 0.45);
  }
  plates(torso, armor, [-2, 11, 0], [12, 17, 18], 6, 9);
  for (let s of [-1, 1]) {
    for (let i = 0; i < 4; i++) rod(torso, light, [9.5, 20 - i * 4, s * 2], [9, 18 - i * 4, s * (9 - i)], 0.45, 0.25, bal);
    const arm = limb(torso, 'arm' + s, [0, 20, s * 19], 13, 5.8, color, armor); r.arms.push(arm);
    ell(arm.upper, armor, 0, -1, 0, 8, 7, 7);
    for (let i = 0; i < 3; i++) horn(arm.upper, armor, [[-2 + i * 3, 4, s * 2], [-5 + i * 3, 10 + i * 2, s * 6], [-8 + i * 2, 12 + i * 2, s * 8]], 2.4);
    r.legs.push(limb(r.root, 'leg' + s, [-1, 27, s * 8], 12, 5.5, color, armor));
  }
  const head = r.head = joint(torso, 'head', bal ? 6 : 1, bal ? 30 : 32, 0);
  ell(head, color, 1, 0, 0, 8, 9, 8); ell(head, armor, 6, 0, 0, 5, 6, 6);
  for (let s of [-1, 1]) {
    ell(head, light, 8.8, 2, s * 4.2, 1.6, 1.05, 1.7, 8, true);
    rod(head, color, [9, 4, s * 1], [7, 4.5, s * 7], 1.4, 1.4);
    if (bal) horn(head, '#67605a', [[-1, 6, s * 6], [-7, 13, s * 13], [-9, 20, s * 16], [-3, 23, s * 14], [1, 21, s * 11]], 3.5);
    else if (tree) for (let i = 0; i < 3; i++) horn(head, armor, [[-2, 5, s * 5], [-9 - i * 4, 17 + i * 3, s * (10 + i * 3)], [-4 - i * 7, 26 + i * 2, s * (13 + i * 3)]], 2.4 - i * 0.5);
    else for (let i = 0; i < 3; i++) horn(head, armor, [[-5 + i * 5, 7, s * 6], [-7 + i * 5, 15 + (i === 1 ? 5 : 0), s * 7]], 1.6);
  }
  r.jaw = joint(head, 'jaw', 4, -4, 0); ell(r.jaw, color, 3, -1, 0, 5, 3, 5);
  r.anchors = { eyes: anchor(head, 'eyes', 9, 2, 4), mouth: anchor(r.jaw, 'mouth', 8, 0, 0), chests: anchor(torso, 'chests', 12, 14, 0), hand: anchor(r.arms[1].foot, 'hand', 3, 0, 0) };
  if (bal) {
    r.wings = [-1, 1].map(s => wing(torso, s, '#352a30', '#66504b', 61, -9, 22, s * 11));
    const hand = r.arms[0].foot;
    r.sword = joint(hand, 'sword', 3, 0, 0);
    rod(r.sword, '#5f402b', [0, -5, 0], [0, 6, 0], 1.8); rod(r.sword, '#b97b37', [-5, 5, 0], [5, 5, 0], 1.3);
    rod(r.sword, '#ed6420', [0, 7, 0], [0, 48, 0], 3.7, 0.1, true, 4);
    rod(r.sword, '#ffe3a0', [0, 7, 0.7], [0, 44, 0.7], 1.25, 0.02, true, 4);
    r.sword.rotation.z = -0.4;
    for (let i = 0; i < 11; i++) horn(torso, '#fb7123', [[-6, 10 + i * 2, (i % 3 - 1) * 9], [-12, 17 + i * 2, (i % 3 - 1) * 10], [-10, 24 + i * 2, (i % 3 - 1) * 8]], 1.5);
  } else if (tree) {
    for (let s of [-1, 1]) for (let i = 0; i < 4; i++) r.tendrils.push(chain(r.arms[s > 0 ? 1 : 0].foot, 'root' + s + i, [0, 0, (i - 1.5) * 2], 5, 3.8, 1.7, color));
  } else {
    const weapon = r.arms[0].foot;
    rod(weapon, armor, [2, -9, 0], [2, 36, 0], 1.3);
    if (mirror) { const g = new THREE.OctahedronGeometry(8); g.scale(0.55, 1.8, 1); g.translate(2, 36, 0); mesh(weapon, g, light); }
    else { ell(weapon, armor, 2, 37, 0, 7, 7, 6); ell(weapon, light, 7, 37, 0, 2, 3, 2, 8, true); }
    // Segmented mantle: each strip has its own delayed sway.
    for (let i = 0; i < 7; i++) { const strip = joint(torso, 'mantle' + i, -11, 22, (i - 3) * 5); r.cloth.push(strip); rod(strip, mirror ? '#2e335a' : '#671f2e', [0, 0, 0], [-4, -43, 0], 2.8, 4.3); rod(strip, armor, [-4, -38, 1], [-4, -43, 1], 0.5); }
  }
}
function queen(r) {
  r.torso = joint(r.root, 'thorax', 0, 31, 0);
  ell(r.torso, '#392b27', 0, 0, 0, 16, 16, 14);
  r.abdomen = joint(r.torso, 'abdomen', -21, -2, 0); ell(r.abdomen, '#ba7328', -5, 0, 0, 24, 19, 20);
  plates(r.abdomen, '#e5ab48', [-5, 0, 0], [24, 19, 20], 7, 12);
  for (let s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const leg = limb(r.root, 'leg' + s + i, [12 - i * 15, 29, s * 10], 15, 2.5, '#684424', '#ead090'); leg.side = s; r.legs.push(leg);
  }
  const h = skull(r.torso, '#684022', '#efc56e', '#ffef9c', 0.8); Object.assign(r, h); h.head.position.set(16, 5, 0);
  for (let s of [-1, 1]) r.tendrils.push(chain(h.head, 'antenna' + s, [-2, 6, s * 5], 6, 3.7, 1.1, '#dba748'));
  r.anchors = { eyes: h.eyes, mouth: h.mouth, chests: anchor(r.torso, 'chests', 10, 0, 12) };
}
function cosmic(r, kind) {
  const eye = kind === 'otegoz', heart = kind === 'madenKalbi';
  r.torso = joint(r.root, 'core', 0, 44, 0);
  const body = eye ? '#44335c' : heart ? '#492735' : '#d1c5a1', light = eye ? '#b8a0ff' : heart ? '#ff6288' : '#fff5c7';
  ell(r.torso, body, 0, 0, 0, eye ? 20 : 14, eye ? 19 : 24, 18);
  if (eye) {
    ell(r.torso, '#d9b9c9', 16, 0, 0, 6, 13, 13);
    ell(r.torso, light, 21, 0, 0, 2, 8, 8, 16, true); ell(r.torso, '#140e27', 23, 0, 0, 1, 6, 2);
    for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9; const c = chain(r.torso, 'tentacle' + i, [-8, Math.sin(a) * 15, Math.cos(a) * 15], 7, 5, 3, body); c[0].rotation.x = a; r.tendrils.push(c); }
  } else {
    plates(r.torso, heart ? '#965668' : '#e4d5b0', [0, 0, 0], [14, 24, 18], 7, 10);
    ell(r.torso, light, 13, 2, 0, 4, 13, 8, 12, true);
    for (let s of [-1, 1]) r.arms.push(limb(r.torso, 'arm' + s, [0, 14, s * 19], 13, 3, body, light));
    for (let i = 0; i < 9; i++) {
      const satellite = joint(r.root, 'satellite' + i); const g = new THREE.OctahedronGeometry(heart ? 7 : 4); g.scale(0.75, 1.6, 1); mesh(satellite, g, i % 3 ? body : light, i % 3 === 0); r.orbit.push(satellite);
    }
    if (!heart) { r.wings = [-1, 1].map(s => wing(r.torso, s, '#b0a791', '#fff0c0', 46, -3, 10, s * 9)); for (let i = 0; i < 6; i++) r.tendrils.push(chain(r.torso, 'ribbon' + i, [-3, -18, (i - 2.5) * 4], 6, 4, 1.8, '#9c947f')); }
  }
  r.head = r.torso;
  r.anchors = { eyes: anchor(r.torso, 'eyes', 22, 0, 0), mouth: anchor(r.torso, 'mouth', 23, -4, 0), chests: anchor(r.torso, 'chests', 15, 0, 0) };
}
function batch(root) {
  // Merge rigid details per bone/material. Hundreds of scutes cost a few draw calls.
  root.traverse(node => {
    const groups = new Map();
    for (const child of [...node.children]) if (child.isMesh && child.geometry.attributes.position.usage !== THREE.DynamicDrawUsage && !child.name && !child.userData.moving) {
      const key = child.material.uuid; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(child);
    }
    for (const children of groups.values()) if (children.length > 1) {
      const parts = children.map(m => { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); return g.applyMatrix4(m.matrix); });
      const merged = mergeGeometries(parts); const result = new THREE.Mesh(merged, children[0].material); result.userData.glow = children[0].userData.glow;
      children.forEach(m => { node.remove(m); m.geometry.dispose(); }); parts.forEach(g => g.dispose()); node.add(result);
    }
  });
}
export function createBossRig(type) {
  const r = { root: new THREE.Group(), type, legs: [], arms: [], wings: [], tail: [], neck: [], tendrils: [], cloth: [], orbit: [], anchors: {} };
  if (['ejder', 'kavurgan', 'dunyaYilani'].includes(type)) dragon(r, type === 'kavurgan', type === 'dunyaYilani');
  else if (['balrog', 'karakok', 'sultan', 'aynasiz'].includes(type)) humanoid(r, type);
  else if (type === 'kehribarAna') queen(r);
  else cosmic(r, type);
  for (const w of r.wings) { w.ribs.forEach(m => { m.userData.moving = true; }); w.tip.userData.moving = true; }
  batch(r.root);
  if (type === 'dunyaYilani') {
    const geometry = new THREE.BufferGeometry(), count = 64, sides = 12, indices = [];
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * sides * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * sides * 2), 2));
    for (let i = 0; i < count - 1; i++) for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + (j + 1) % sides; indices.push(a, b, a + sides, b, b + sides, a + sides); }
    geometry.setIndex(indices);
    r.body = new THREE.Group(); r.body.matrixAutoUpdate = false; r.root.add(r.body);
    r.bodyMesh = mesh(r.body, geometry, '#285464'); r.bodyMesh.frustumCulled = false;
    const fins = new THREE.BufferGeometry(); fins.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 9), 3).setUsage(THREE.DynamicDrawUsage));
    fins.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 6), 2));
    r.finMesh = mesh(r.body, fins, '#548891'); r.finMesh.frustumCulled = false;
  }
  r.root.traverse(n => { n.userData.restPosition = n.position.clone(); n.userData.restRotation = n.rotation.clone(); n.userData.restScale = n.scale.clone(); });
  r.meshes = []; r.root.traverse(n => { if (n.isMesh) r.meshes.push(n); });
  return r;
}

export function bendSerpent(r, points, x, y) {
  if (!r.body) return;
  const p = r.bodyMesh.geometry.attributes.position, uv = r.bodyMesh.geometry.attributes.uv, f = r.finMesh.geometry.attributes.position;
  const n = Math.min(points.length, 64), sides = 12;
  r.body.visible = n > 1;
  // Cancel the head's yaw/roll: the body follows the world-space spine.
  r.body.matrix.copy(r.root.matrixWorld).invert();
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = a[1] - b[1], d = Math.hypot(dx, dy) || 1;
    let nx = -dy / d, ny = dx / d; if (ny < 0) { nx = -nx; ny = -ny; }
    const radius = 3 + 10.5 * Math.pow(1 - i / n, 0.55), cx = points[i][0] - x, cy = y - points[i][1];
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2, ridge = i % 2 ? 0.96 : 1;
      p.setXYZ(i * sides + j, cx + nx * Math.cos(angle) * radius * ridge, cy + ny * Math.cos(angle) * radius * ridge, Math.sin(angle) * radius);
      uv.setXY(i * sides + j, (i % 8) / 8, j / sides);
    }
    f.setXYZ(i * 3, cx + nx * radius - dx / d * 3, cy + ny * radius - dy / d * 3, 0);
    f.setXYZ(i * 3 + 1, cx + nx * (radius + 5) + dx / d * 2, cy + ny * (radius + 5) + dy / d * 2, 0);
    f.setXYZ(i * 3 + 2, cx + nx * radius + dx / d * 4, cy + ny * radius + dy / d * 4, 0);
  }
  p.needsUpdate = uv.needsUpdate = f.needsUpdate = true;
  r.bodyMesh.geometry.setDrawRange(0, Math.max(0, n - 1) * sides * 6); r.bodyMesh.geometry.computeVertexNormals();
  r.finMesh.geometry.setDrawRange(0, n * 3); r.finMesh.geometry.computeVertexNormals();
  r.root.updateMatrixWorld(true);
}
