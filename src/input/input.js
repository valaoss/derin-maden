// Girdi: ekranın herhangi bir yerinde beliren yüzen joystick + klavye.
// Kısa ve hareketsiz dokunuş "tap" olarak iletilir (yuvalara inşa vb).
export const input = { x: 0, y: 0, mag: 0, active: false, taps: [], keyboard: false };

const keys = {};
let stickId = null, ox = 0, oy = 0, sx = 0, sy = 0, t0 = 0, moved = 0;
let stickEl, knobEl, surface;
const RADIUS = 46, DEAD = 7;

export function initInput(el, stick, knob) {
  surface = el; stickEl = stick; knobEl = knob;
  el.addEventListener('pointerdown', down, { passive: false });
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys[k] = true; input.keyboard = true;
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; release(); });
}

function down(e) {
  if (stickId !== null) return;
  e.preventDefault();
  stickId = e.pointerId; ox = sx = e.clientX; oy = sy = e.clientY; t0 = performance.now(); moved = 0;
  const r = surface.getBoundingClientRect();
  stickEl.style.transform = `translate(${ox - r.left}px, ${oy - r.top}px)`;
  knobEl.style.transform = 'translate(0px,0px)';
  stickEl.classList.add('on');
}
function move(e) {
  if (e.pointerId !== stickId) return;
  e.preventDefault();
  sx = e.clientX; sy = e.clientY;
  let dx = sx - ox, dy = sy - oy;
  const d = Math.hypot(dx, dy);
  moved = Math.max(moved, d);
  // joystick merkezi parmağı takip eder (uzun sürüklemelerde geri dönmek kolay olsun)
  if (d > RADIUS * 1.35) {
    const k = (d - RADIUS * 1.35) / d; ox += dx * k; oy += dy * k; dx = sx - ox; dy = sy - oy;
    const r = surface.getBoundingClientRect();
    stickEl.style.transform = `translate(${ox - r.left}px, ${oy - r.top}px)`;
  }
  const dd = Math.hypot(dx, dy);
  const kx = dd > RADIUS ? dx / dd * RADIUS : dx, ky = dd > RADIUS ? dy / dd * RADIUS : dy;
  knobEl.style.transform = `translate(${kx}px, ${ky}px)`;
  if (dd < DEAD) { input.x = input.y = input.mag = 0; input.active = false; return; }
  input.x = dx / dd; input.y = dy / dd;
  input.mag = Math.min(1, (dd - DEAD) / (RADIUS * 0.55 - DEAD));
  input.active = true;
}
function up(e) {
  if (e.pointerId !== stickId) return;
  const dt = performance.now() - t0;
  if (dt < 260 && moved < 12) {
    const r = surface.getBoundingClientRect();
    input.taps.push({ x: (sx - r.left) / r.width, y: (sy - r.top) / r.height });
  }
  release();
}
function release() {
  stickId = null; input.x = input.y = input.mag = 0; input.active = false;
  if (stickEl) stickEl.classList.remove('on');
}
export function cancelStick() { release(); }

export function readMove() {
  let kx = 0, ky = 0;
  if (keys.a || keys.arrowleft) kx -= 1;
  if (keys.d || keys.arrowright) kx += 1;
  if (keys.w || keys.arrowup) ky -= 1;
  if (keys.s || keys.arrowdown) ky += 1;
  if (kx || ky) { const m = Math.hypot(kx, ky); return { x: kx / m, y: ky / m, mag: 1 }; }
  if (input.active) return { x: input.x, y: input.y, mag: input.mag };
  return { x: 0, y: 0, mag: 0 };
}
export function keyPressed(k) { if (keys[k]) { keys[k] = false; return true; } return false; }
