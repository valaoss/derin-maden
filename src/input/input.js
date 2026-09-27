// Girdi: ekranın altında sabit duran joystick + klavye.
// Joystick dışındaki kısa ve hareketsiz dokunuş "tap" olarak iletilir (yuvalara inşa vb).
export const input = { x: 0, y: 0, mag: 0, active: false, taps: [], keyboard: false };

const keys = {};
let stickId = null, ox = 0, oy = 0, sx = 0, sy = 0, t0 = 0, moved = 0;
let stickEl, knobEl, surface;
const RADIUS = 46, DEAD = 7, GRAB = 88; // GRAB: merkezden bu uzaklığa kadar dokunuş joystick'i tutar

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

function center() {
  const r = stickEl.getBoundingClientRect();
  return { x: r.left, y: r.top };
}
function down(e) {
  e.preventDefault();
  const c = center();
  if (stickId === null && Math.hypot(e.clientX - c.x, e.clientY - c.y) <= GRAB) {
    stickId = e.pointerId; ox = c.x; oy = c.y;
    stickEl.classList.add('on');
    move(e);
    return;
  }
  // joystick dışı dokunuş: sadece tap adayı
  tapId = e.pointerId; tx = e.clientX; ty = e.clientY; t0 = performance.now(); moved = 0;
}
let tapId = null, tx = 0, ty = 0;
function move(e) {
  if (e.pointerId === tapId) { moved = Math.max(moved, Math.hypot(e.clientX - tx, e.clientY - ty)); return; }
  if (e.pointerId !== stickId) return;
  e.preventDefault();
  sx = e.clientX; sy = e.clientY;
  const dx = sx - ox, dy = sy - oy;
  const dd = Math.hypot(dx, dy);
  const kx = dd > RADIUS ? dx / dd * RADIUS : dx, ky = dd > RADIUS ? dy / dd * RADIUS : dy;
  knobEl.style.transform = `translate(${kx}px, ${ky}px)`;
  if (dd < DEAD) { input.x = input.y = input.mag = 0; input.active = false; return; }
  input.x = dx / dd; input.y = dy / dd;
  input.mag = Math.min(1, (dd - DEAD) / (RADIUS * 0.55 - DEAD));
  input.active = true;
}
function up(e) {
  if (e.pointerId === tapId) {
    tapId = null;
    if (performance.now() - t0 < 260 && moved < 12) {
      const r = surface.getBoundingClientRect();
      input.taps.push({ x: (tx - r.left) / r.width, y: (ty - r.top) / r.height });
    }
    return;
  }
  if (e.pointerId !== stickId) return;
  release();
}
function release() {
  stickId = null; input.x = input.y = input.mag = 0; input.active = false;
  if (stickEl) { stickEl.classList.remove('on'); knobEl.style.transform = 'translate(0px,0px)'; }
}
export function setStickVisible(v) { if (stickEl) stickEl.classList.toggle('show', v); }
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
