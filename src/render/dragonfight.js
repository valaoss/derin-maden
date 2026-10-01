// Hazine Ejderi savaş duruşları: bekleme, yürüyüş, alev nefesi, kuyruk darbesi, kanat fırtınası, havalanma/dalış, vuruş, öfke, ölüm.
// Girdi o (boss/state.js): eylem, aşama, zamanlar, hedef yönü. Açılar derece tutulur, sonda radyana çevrilir.
import { STAND, SLEEP, ROAR_NECK, COIL_NECK, LOOK } from './dragonpose.js';
import { TAU, D, lerp, clamp, ss, bump, track, aimLocal } from './boss/rig.js';

const AIM = [0.1, 0.2, 0.25, 0.2, 0.1], FIRE_NECK = [18, 6, -6, -10, -6], DEAD_NECK = [-14, -18, -8, 4, 8], DIVE_NECK = [6, 2, -2, -4, -2];
const TAIL_BACK = [10, 16, 20, 22, 22, 20, 16, 12, 8], TAIL_HIT = [14, 20, 24, 24, 22, 18, 14, 10, 6], TAIL_LOW = [-12, -8, -4, 0, 2, 2, 2, 0, 0], TAIL_HANG = [-16, -10, -6, -2, 2, 4, 4, 3, 2];
const STEP_A = 6.8, PH = [0, 0.5, 0.25, 0.75], DIE_T = 2.5;
// bir adım: 0..0.7 basar (geri kayar), 0.7..1 kalkıp öne gider
function step(ph) {
  const c = ph - Math.floor(ph);
  if (c < 0.7) return [STEP_A * (1 - 2 * c / 0.7), 0];
  const k = (c - 0.7) / 0.3, e = k * k * (3 - 2 * k);
  return [STEP_A * (2 * e - 1), Math.sin(k * Math.PI) * 2.8];
}
const add = (a, v, k) => { for (let i = 0; i < a.length; i++) a[i] += (v[i] || 0) * k; };
const to = (a, v, k) => { for (let i = 0; i < a.length; i++) a[i] = lerp(a[i], v[i] || 0, k); };

export function dragonFight(o) {
  const t = o.t, A = o.A, rage = o.rage ? 1 : 0, dead = o.dying > 0, w = dead ? 0 : o.walk;
  const near = Math.cos(o.view) >= 0 ? 1 : -1, side = clamp(Math.cos(o.view) * 4, -1, 1);
  const fast = Math.sin(t * TAU / (rage ? 1.35 : 1.9));
  const nP = STAND.neckP.map((v, i) => v + fast * (i < 2 ? 1 : -0.6)), nY = nP.map((_, i) => Math.sin(t * 1.1 - i * 0.6) * 1.1), hd = [STAND.head[0], 0, 0];
  const tP = STAND.tailP.map((v, i) => v + (i > 5 ? fast * 1.5 : 0)), tY = tP.map((_, i) => Math.sin(t * 1.6 - i * 0.5) * 3.5 * (i / 8));
  let px = -9, py = STAND.py, pitch = STAND.pitch, roll = Math.sin(t * 0.7) * 1.2, arch = STAND.arch, jaw = 0, eye = (t + o.wob) % 4.3 < 0.12 ? 0.3 : 1;
  let spin = 0, air = 0, tuck = 0, claw = 0, heat = 0, shadow = 1, squash = 0, rate = 22, lookW = 0.8, aimW = 0, aimY = 0, aimP = 0, coil = 0, roar = 0;
  const br = [0, 0.015 * fast, 0.03 * fast];
  const wing = { open: 0.14 + rage * 0.16, fan: 0.1 + rage * 0.2, flap: rage * 0.06, lean: 0.22 * side, sweep: 0, wave: 0, span: 0 };
  // kameraya yakın yandaki ayaklar geride durur (dönünce yer değiştirir)
  const feet = STAND.feet.map((f, i) => [(i < 2 ? -5.75 : 10.25) - Math.sign(f[2]) * 1.25 * side, 0, f[2]]);
  let ank = STAND.ank.map(a => a.slice()), pole = STAND.pole.map(a => a.slice());

  if (w > 0.01) {
    const c = o.ph, c2 = c * 2 * TAU;
    feet.forEach((f, i) => { const [dx, dy] = step(c + PH[i]); f[0] += dx * w; f[1] += dy * w; });
    py += (Math.sin(c2) * 0.5 - 0.7) * w; pitch += Math.sin(c2 + 1) * 1.2 * w; roll += Math.sin(c * TAU) * 2.5 * w;
    add(nP, [-9, -7, -2, 6, 8], w); nP[0] -= Math.sin(c2 + 1) * 1.2 * w;
    for (let i = 0; i < 9; i++) tY[i] += Math.sin(c * TAU - i * 0.55) * 7 * (i / 8) * w;
    for (let i = 0; i < 5; i++) nY[i] += Math.sin(c * TAU + 0.6) * 1.3 * w;
    wing.flap += Math.sin(c2) * 0.03 * w;
  }
  if (rage && o.rageT < 1.2) { coil = bump(0, 0.14, 0.2, 0.3, o.rageT); roar = bump(0.2, 0.32, 0.85, 1.15, o.rageT); }

  if (o.act === 'breath' && A) {
    const [ay, ap] = aimLocal(Math.cos(o.aim || 0), Math.sin(o.aim || 0), o.view);
    aimY = clamp(ay, -1.3, 1.3); aimP = clamp(ap, -0.7, 1); lookW = 0;
    if (o.stage === 'glow') {
      // içine çeker: göğüs şişer ve kızarır, boyun kobra gibi geri toplanır, kanatlar kalkar
      const k = ss(0, 1, o.wind);
      add(nP, COIL_NECK, 1.15 * k); hd[0] -= 10 * k; hd[2] += Math.sin(t * 38) * 1.5 * k * k;
      px -= 2.5 * k; py -= 1.2 * k; pitch += 4 * k; br[2] += 0.1 * k; br[1] += 0.04 * k;
      wing.open += 0.3 * k; wing.fan += 0.25 * k; wing.flap += 0.16 * k; jaw = 0.08 + 0.1 * k; heat = k; aimW = 0.5 * k;
      add(tP, [4, 4, 3, 2, 1], k);
    } else if (o.stage === 'fire') {
      // boyun nişan yönünde gerilir, çene ardına kadar açılır, gövde öne yüklenir ve titrer
      const f = ss(0, 0.16, o.sinceStage), dur = rage ? 2 : 1.6, left = clamp(A.st / dur, 0, 1);
      for (let i = 0; i < 5; i++) nP[i] = lerp(nP[i] + COIL_NECK[i] * 1.15, FIRE_NECK[i], f);
      hd[0] = lerp(-26, -4, f); hd[2] += Math.sin(t * 40) * 2; px += lerp(-2.5, 3.2, f) + Math.sin(t * 40) * 0.2; py += lerp(-1.2, -0.6, f); pitch += lerp(4, -2, f);
      jaw = lerp(0.18, 0.95, f); heat = 0.5 + 0.5 * left; br[2] += 0.1 * left; br[1] += 0.04 * left;
      wing.open = lerp(wing.open + 0.3, 0.85, f); wing.fan = lerp(wing.fan + 0.25, 0.8, f); wing.flap += 0.2 + Math.sin(t * 26) * 0.02;
      to(tP, [-2, 2, 4, 5, 5, 4, 3, 2, 1], f); for (let i = 0; i < 9; i++) tY[i] += Math.sin(t * 14 - i * 0.8) * 2 * f;
      feet[2][0] += 2 * f; feet[3][0] += 2 * f; aimW = lerp(0.5, 1, f); rate = 30;
    } else {
      const k = clamp(1 - A.st / 0.4, 0, 1);
      add(nP, [-6, -6, -2, 2, 4], Math.sin(k * Math.PI)); jaw = 0.3 * (1 - k); heat = 0.4 * (1 - k); aimW = 1 - k;
    }
  } else if (o.act === 'tail') {
    // arkasına bakar, kuyruğu uzak yana toplar; gövdeyi çevirip kamçı gibi yakın yana savurur
    const c = o.since, wnd = ss(0, 0.4, c) * (1 - ss(0.44, 0.52, c)), turn = ss(0.44, 0.8, c), sw = bump(0.44, 0.52, 0.72, 0.82, c);
    for (let i = 0; i < 9; i++) {
      // dönerken kuyruk geriden gelir (savrulma), durunca öne taşıp sönerek salınır
      const over = Math.sin(Math.max(0, c - 0.76 - i * 0.012) * 20) * Math.exp(-Math.max(0, c - 0.76) * 8) * 9 * (i / 8);
      tY[i] += near * (-TAIL_BACK[i] * wnd - TAIL_HIT[i] * 0.55 * sw + over);
      tP[i] = lerp(tP[i], TAIL_LOW[i], Math.max(wnd * 0.6, sw));
    }
    spin = near * (-0.35 * wnd + TAU * turn);
    add(nY, [10, 14, 16, 14, 10], near * (wnd - 0.6 * sw)); hd[1] += near * 10 * wnd; lookW *= 1 - Math.max(wnd, sw);
    py += -2.2 * wnd + 1.6 * sw; roll += near * (-4 * wnd + 7 * sw); pitch -= 3 * sw;
    for (const f of feet) f[1] += sw * 1.6;
    jaw = 0.4 * bump(0.5, 0.56, 0.75, 0.88, c); wing.open += 0.3 * sw; wing.fan += 0.2 * sw; wing.flap += 0.12 * sw; rate = 40;
  } else if (o.act === 'gust') {
    // şaha kalkar, kanatları geriye gerer; öne doğru sert bir çırpış, ardından sönen iki çırpış
    const c = o.since, up = ss(0, 0.55, c) * (1 - ss(0.6, 0.72, c)), beat = ss(0.6, 0.7, c), aft = Math.max(0, c - 0.7), cry = bump(0.62, 0.72, 0.95, 1.2, c);
    pitch += 15 * up - 3 * bump(0.62, 0.72, 0.8, 1, c); py += 1.5 * up; px += -1.5 * up + 2.5 * bump(0.62, 0.72, 0.9, 1.2, c);
    feet[2][1] += 3.5 * up; feet[3][1] += 2.5 * up; feet[2][0] -= 2 * up; feet[3][0] -= 2 * up;
    const op = track(c, [[0, 0], [0.4, 1], [1.05, 1], [1.3, 0.25]]);
    wing.open = Math.max(wing.open, op); wing.fan = Math.max(wing.fan, op);
    const osc = Math.cos(aft * TAU * 2.4) * Math.exp(-aft * 2.4);
    wing.flap = lerp(0.5 * ss(0, 0.55, c), 0.05 - 0.25 * osc, beat);
    wing.sweep = 0.25 * up - 0.85 * beat * osc; wing.wave = Math.sin(aft * TAU * 2.4 + 1) * 0.5 * beat;
    add(nP, COIL_NECK, up * 0.8); add(nP, ROAR_NECK, cry * 0.8); hd[0] += -8 * up + 8 * cry; jaw = 0.6 * cry;
    add(tP, [-8, -6, -2], up); add(tP, [6, 6, 4, 2], cry); lookW *= 1 - 0.5 * cry; rate = 30;
  } else if (o.act === 'soar') {
    const c = o.sinceStage, st = o.stage, lift = st === 'up' ? ss(0.16, 0.42, c) : 1, crouch = st === 'up' ? bump(0, 0.14, 0.18, 0.3, c) : 0;
    const wt = o.since * TAU * 2.4, s1 = Math.sin(wt), c1 = Math.cos(wt);
    air = lift; tuck = lift; shadow = 1 - lift; py -= 4 * crouch; pitch += 6 * crouch;
    if (st === 'dive') {
      // kanatlar yarı kapanır, burun aşağı, pençeler öne
      const k = ss(0, 0.2, c);
      claw = k; pitch = lerp(pitch + 12, -30, k); wing.open = lerp(1, 0.6, k); wing.fan = lerp(1, 0.5, k); wing.sweep = 0.45 * k; wing.flap = lerp(0.1 + 0.6 * s1, 0.5, k); wing.span = lerp(1, 0.55, k);
      to(nP, DIVE_NECK, k); hd[0] = lerp(hd[0], -6, k); jaw = 0.5 * k; to(tP, [4, 4, 3, 2, 2, 1, 1], k); lookW = 0; rate = 32;
    } else {
      // kanat çırpışı: aşağı vuruşta gövde yükselir, yukarı vuruşta kanat hafif toplanır
      wing.open = Math.max(wing.open, lerp(ss(0, 0.2, c), 1 - 0.2 * Math.max(0, c1), lift)); wing.fan = Math.max(wing.fan, ss(0, 0.25, o.since));
      wing.flap = lerp(0.45 * ss(0, 0.16, c), 0.1 + 0.6 * s1, lift); wing.wave = c1 * 0.6 * lift; wing.span = lift;
      py += -Math.sin(wt - 0.5) * 1.5 * lift; pitch += (st === 'up' ? 20 : 12) * lift + c1 * 2 * lift;
      to(tP, TAIL_HANG, lift * 0.9); for (let i = 0; i < 9; i++) { tP[i] += Math.sin(wt - i * 0.5) * 3 * lift * (i / 8); tY[i] += Math.sin(t * 2.2 - i * 0.6) * 6 * lift * (i / 8); }
      add(nP, [-10, -8, -4, 0, 4], lift * 0.6);
      if (st === 'hover') { const d = (rage ? 0.55 : 0.75) - (A && A.drop || 0), spit = bump(0, 0.06, 0.12, 0.26, d); jaw = 0.65 * spit; hd[0] -= 10 * spit; lookW = 1; }
    }
  } else if (o.prev === 'soar' && !o.act && o.since < 0.5) {
    // iniş: çöker, kanatlar frenler
    const k = 1 - ss(0, 0.5, o.since);
    py -= 5 * k; wing.open += 0.7 * k; wing.fan += 0.6 * k; wing.flap += 0.25 * k; add(nP, [-8, -8, -2, 4, 6], k); add(tP, [8, 6, 4, 2], k);
  }

  if (o.hurt > 0 && !dead) {
    const h = o.hurt * o.hurt, back = clamp(o.hx * Math.cos(o.view), -1, 1);
    px += back * 1.6 * h; py -= 0.8 * h; roll += near * 3 * h; add(nP, [8, 12, 8, -4, -8], h); hd[0] += 10 * h; hd[2] += Math.sin(t * 50) * 4 * h;
    jaw = Math.max(jaw, 0.45 * h); eye = 1 - 0.7 * h; wing.open += 0.12 * h; wing.flap += 0.1 * h;
    for (let i = 0; i < 9; i++) tY[i] += Math.sin(t * 28 + i) * 5 * h * (i / 8);
  }
  if (coil || roar) {
    const sh = roar * Math.sin(t * 45);
    px += -coil * 2.2 + roar * 3 + sh * 0.25; py += -coil * 1.8 + roar * 0.5; pitch += -coil * 4 + roar * 5; arch += roar * 3;
    add(nP, COIL_NECK, coil); add(nP, ROAR_NECK, roar); hd[0] += -coil * 10 + roar * 12; hd[2] += sh * 3; jaw = Math.max(jaw, roar * 0.82);
    for (let i = 0; i < 9; i++) { tP[i] += roar * (8 - i) * 1.3; tY[i] += roar * Math.sin(t * 9 - i * 0.7) * 9; }
    wing.open = Math.max(wing.open, roar); wing.fan = Math.max(wing.fan, roar); wing.flap += -0.2 * coil + 0.3 * roar;
    br[2] += coil * 0.09 - roar * 0.03; lookW *= 1 - 0.6 * roar; feet[2][0] += roar * 1.5; feet[3][0] += roar * 1.5; heat = Math.max(heat, coil * 0.8 + roar * 0.5);
  }
  if (dead) {
    // acıyla kükrer, ön ayakları çöker, karnının üstüne yığılır; en son boynu düşer, gözü kapanır
    const d = o.dying * DIE_T, pain = bump(0, 0.12, 0.45, 0.8, d), kF = ss(0.4, 0.95, d), kR = ss(0.85, 1.4, d), kN = ss(1.15, 1.8, d), wob = Math.sin(d * 9) * (1 - kR) * ss(0.2, 0.5, d);
    add(nP, ROAR_NECK, pain); hd[0] += 14 * pain; hd[2] += Math.sin(t * 45) * 3 * pain;
    py = lerp(lerp(py, 13, kF), SLEEP.py, kR); pitch = pitch * (1 - kF) - 9 * kF * (1 - kR) + kR; roll += wob * 5 + near * 7 * kR; px += wob * 1.2 + pain * 1.5;
    squash = kR; arch = lerp(arch, SLEEP.arch, kR);
    for (let i = 0; i < 4; i++) {
      const k = i < 2 ? kR : kF, S = SLEEP.feet[i];
      feet[i] = [lerp(feet[i][0], S[0], k), Math.sin(k * Math.PI) * 1.5, lerp(feet[i][2], S[2], k)];
      ank[i] = ank[i].map((v, j) => lerp(v, SLEEP.ank[i][j], k)); pole[i] = pole[i].map((v, j) => lerp(v, SLEEP.pole[i][j], k));
    }
    to(nP, DEAD_NECK, kN); add(nY, [4, 6, 6, 4, 2], near * kN); hd[0] = lerp(hd[0], 6, kN); hd[1] += near * 8 * kN; hd[2] += near * 14 * kN;
    jaw = Math.max(0.85 * pain, 0.24 * kN); eye = 1 - ss(1.5, 1.95, d); heat = pain;
    const thrash = (1 - ss(0.9, 1.7, d)) * ss(0.1, 0.4, d);
    for (let i = 0; i < 9; i++) { tP[i] = lerp(tP[i], SLEEP.tailP[i], kR); tY[i] += Math.sin(d * 11 - i * 0.7) * 10 * (i / 8) * thrash + near * [6, 10, 12, 12, 10, 8, 6, 4, 2][i] * kR; }
    wing.open = lerp(wing.open + 0.6 * pain, 0.3, kR); wing.fan = lerp(wing.fan + 0.6 * pain, 0.35, kR); wing.flap = lerp(wing.flap + 0.3 * pain - 0.3 * kF, -0.3, kR);
    br[2] += 0.05 * Math.sin(d * 5) * (1 - ss(1.6, 2.1, d)) * kR; lookW = 0; rate = 26;
  }

  // bakış: baş hedefi izler (boyun boyunca dağılır); nefeste nişan yönü
  const [ly0, lp0] = aimLocal(o.tx - Math.cos(o.view) * 21, o.ty + 26, o.view);
  const ly = clamp(ly0, -1.7, 1.7) * lookW, lp = clamp(lp0, air > 0.5 ? -1 : -0.5, 0.6) * lookW;
  if (!wing.wave) wing.wave = Math.sin(t * 5) * 0.25 * wing.open;
  return {
    rate, spin, air, tuck, claw, heat, shadow, squash, coins: 0, br, px, py, pitch: pitch * D, roll: roll * D, arch: arch * D, jaw, eye, near, wing, feet, ank, pole,
    neckP: nP.map((v, i) => v * D + lp * LOOK[i] + aimP * AIM[i] * aimW), neckY: nY.map((v, i) => v * D + ly * LOOK[i] + aimY * AIM[i] * aimW),
    head: [hd[0] * D + lp * 0.2 + aimP * 0.15 * aimW, hd[1] * D + ly * 0.12 + aimY * 0.15 * aimW, hd[2] * D],
    tailP: tP.map(v => v * D), tailY: tY.map(v => v * D),
  };
}
