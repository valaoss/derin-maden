// Girdi: joystick (sabit ya da yüzen) + klavye.
// Sabit: taban hep aynı yerde, alt bölgede kendi tarafına basınca yön sabit merkeze göre.
// Yüzen: basılan yerde doğar; parmak yarıçapı aşınca taban parmağı izler.
// Joystick bölgesi dışındaki kısa ve hareketsiz dokunuş "tap" olarak iletilir (yuvalara inşa vb).
export const input = { x: 0, y: 0, mag: 0, active: false, taps: [], keyboard: false };
const HOLD_MS = 480; // basılı tutma: partner işareti
let holdTO = 0;

const keys = {};
let stickId = null, ox = 0, oy = 0, sx = 0, sy = 0, t0 = 0, moved = 0;
let stickEl, knobEl, surface;
const RADIUS = 56, DEAD = 6;
const SIDE = { sag: 'right', sol: 'left', orta: 'center' }, HEIGHT = { alcak: 180, orta: 262, yuksek: 350 };
let fixed = true, side = 'right', bottom = 262;
const ZONE_TOP = 0.42; // ekranın bu oranından aşağısı joystick bölgesi

// sabit taban yeri: pos 'auto' solak ayarını izler; 'sag' | 'sol' | 'orta'. h: 'alcak' | 'orta' | 'yuksek'
export function setStickMode(fix, pos, h, left) {
  fixed = !!fix; side = SIDE[pos] || (left ? 'left' : 'right'); bottom = HEIGHT[h] || 262;
  if (!stickEl) return;
  stickEl.classList.toggle('fixed', fixed);
  const st = stickEl.style; st.left = st.top = st.right = st.bottom = '';
  if (!fixed) return;
  st.bottom = `calc(var(--sab) + ${bottom}px)`;
  if (side === 'center') st.left = '50%'; else st[side] = `calc(var(--sa${side[0]}) + 78px)`;
}
export function initInput(el, stick, knob) {
  surface = el; stickEl = stick; knobEl = knob;
  setStickMode(fixed, side === 'right' ? 'sag' : side === 'left' ? 'sol' : 'orta');
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
  // masaüstü: sağ tık = işaret
  el.addEventListener('contextmenu', e => { e.preventDefault(); pushTap(e.clientX, e.clientY, true); });
}

let tapId = null, tx = 0, ty = 0, stickTap = false;
function down(e) {
  e.preventDefault();
  const r = surface.getBoundingClientRect();
  const fy = (e.clientY - r.top) / r.height, fx = (e.clientX - r.left) / r.width;
  const zone = fy >= ZONE_TOP && (!fixed || side === 'center' || (fx >= 0.5) === (side === 'right'));
  if (stickId === null && zone) {
    stickId = e.pointerId; t0 = performance.now(); moved = 0; stickTap = true;
    if (fixed) { const b = stickEl.getBoundingClientRect(); ox = b.left; oy = b.top; }
    else { ox = e.clientX; oy = e.clientY; stickEl.style.left = (ox - r.left) + 'px'; stickEl.style.top = (oy - r.top) + 'px'; }
    stickEl.classList.add('on');
    move(e);
    armHold(e.pointerId, ox, oy, true);
    return;
  }
  // üst bölge: yalnızca tap adayı
  tapId = e.pointerId; tx = e.clientX; ty = e.clientY; t0 = performance.now(); moved = 0;
  armHold(e.pointerId, tx, ty, false);
}
// basılı tutma: parmak kıpırdamadıysa işaret bırak (joystick bölgesinde de çalışır: çubuk itilmediyse)
function armHold(id, x, y, stick) {
  clearTimeout(holdTO);
  holdTO = setTimeout(() => {
    if (stick) { if (stickId === id && stickTap) { pushTap(x, y, true); stickTap = false; } }
    else if (tapId === id && moved < 12) { pushTap(x, y, true); tapId = null; }
  }, HOLD_MS);
}
function move(e) {
  if (e.pointerId === tapId) { moved = Math.max(moved, Math.hypot(e.clientX - tx, e.clientY - ty)); return; }
  if (e.pointerId !== stickId) return;
  e.preventDefault();
  sx = e.clientX; sy = e.clientY;
  let dx = sx - ox, dy = sy - oy, dd = Math.hypot(dx, dy);
  if (dd > 10) stickTap = false;
  if (!fixed && dd > RADIUS) {
    // yüzen taban parmağı izler: kontrol ekran kenarında kaybolmaz
    const k = (dd - RADIUS) / dd; ox += dx * k; oy += dy * k;
    const r = surface.getBoundingClientRect();
    stickEl.style.left = (ox - r.left) + 'px'; stickEl.style.top = (oy - r.top) + 'px';
    dx = sx - ox; dy = sy - oy; dd = RADIUS;
  }
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
    if (performance.now() - t0 < 260 && moved < 12) pushTap(tx, ty);
    return;
  }
  if (e.pointerId !== stickId) return;
  // joystick bölgesinde kısa, hareketsiz dokunuş da tap sayılır (yüzeydeki yuvalar için)
  if (stickTap && performance.now() - t0 < 220) pushTap(ox, oy);
  release();
}
function pushTap(x, y, long = false) {
  const r = surface.getBoundingClientRect();
  input.taps.push({ x: (x - r.left) / r.width, y: (y - r.top) / r.height, long });
}
function release() {
  clearTimeout(holdTO);
  stickId = null; stickTap = false; input.x = input.y = input.mag = 0; input.active = false;
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
  if (input.active) {
    // eksen kilidi: kardinale yakın itişte zayıf eksen sıfır (köşelere sürtünme azalır)
    let x = input.x, y = input.y; const ax = Math.abs(x), ay = Math.abs(y);
    if (Math.min(ax, ay) < Math.max(ax, ay) * 0.5) { if (ax > ay) { x = Math.sign(x); y = 0; } else { y = Math.sign(y); x = 0; } }
    return { x, y, mag: input.mag };
  }
  return { x: 0, y: 0, mag: 0 };
}
export function keyPressed(k) { if (keys[k]) { keys[k] = false; return true; } return false; }
