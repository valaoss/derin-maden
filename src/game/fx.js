// Parçacıklar, kamera sarsıntısı, anlık ışık patlamaları, hit-stop.
// Az ama anlamlı: her efekt bir olayı anlatır (kırılma, isabet, ölüm, patlama).
import { G, App } from './state.js';
import { MAT_RAMP } from '../data/palette.js';

const MAX_PARTICLES = 260;
// type: 0 enkaz (yerçekimli kare), 1 kıvılcım (emissive), 2 toz (yavaş, sönen), 3 halka
export function particle(x, y, vx, vy, life, col, size = 1, type = 0, grav = 300) {
  const ps = G.particles;
  let p;
  if (ps.length >= MAX_PARTICLES) { p = ps[G.pIdx = (G.pIdx + 1) % ps.length]; }
  else { p = {}; ps.push(p); }
  p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.t0 = life; p.col = col; p.size = size; p.type = type; p.grav = grav; p.dead = false;
  return p;
}

export function debris(x, y, mat, n, spread = 1) {
  const R = MAT_RAMP[mat] || MAT_RAMP.dirt;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = (30 + Math.random() * 70) * spread;
    particle(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, Math.cos(a) * s, Math.sin(a) * s - 40,
      0.35 + Math.random() * 0.35, R[1 + (Math.random() * 3 | 0)], Math.random() < 0.3 ? 2 : 1, 0, 420);
  }
}
export function dust(x, y, n, col = 'rgba(200,180,160,0.5)') {
  for (let i = 0; i < n; i++) particle(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 16, -8 - Math.random() * 10, 0.5 + Math.random() * 0.4, col, 2 + (Math.random() * 2 | 0), 2, -10);
}
export function sparks(x, y, col, n, speed = 90) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
    particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.15 + Math.random() * 0.2, col, 1, 1, 120);
  }
}
export function ring(x, y, col, r = 20) { const p = particle(x, y, 0, 0, 0.3, col, r, 3, 0); return p; }

export function updateParticles(dt) {
  for (const p of G.particles) {
    if (p.dead) continue;
    p.life -= dt;
    if (p.life <= 0) { p.dead = true; continue; }
    p.vy += p.grav * dt;
    if (p.type === 2) { p.vx *= 0.96; p.vy *= 0.96; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}

export function shake(amount) {
  if (!App.settings.shake) return;
  G.cam.trauma = Math.min(1, G.cam.trauma + amount);
}
export function kick(dx, dy, m = 1.5) { if (!App.settings.shake) return; G.cam.kx += dx * m; G.cam.ky += dy * m; }
export function hitstop(t) { G.hitstop = Math.max(G.hitstop, t); }
export function flashLight(x, y, s, t = 0.15) { G.flashes.push({ x, y, s, t, t0: t }); }
export function updateFlashes(dt) {
  const f = G.flashes; let j = 0;
  for (let i = 0; i < f.length; i++) { f[i].t -= dt; if (f[i].t > 0) f[j++] = f[i]; }
  f.length = j;
}
