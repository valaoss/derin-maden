// Hazine Ejderi duruşları: uyku (nefes, seğirme, aralanan göz) ve uyanış (baş kalkar, ön ayaklar iter, kalkar, kanat açar, kükrer).
// Zamanın saf fonksiyonu: kare yok, her an için eklem açıları hesaplanır. Açılar derece yazılır, radyana çevrilir.
const D = Math.PI / 180, TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const bump = (a, b, c, d, x) => ss(a, b, x) * (1 - ss(c, d, x));
function track(x, keys) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x < keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], ss(keys[i - 1][0], keys[i][0], x));
  return keys[keys.length - 1][1];
}

export const SLEEP = {
  py: 6, pitch: 1, arch: -2,
  neckP: [-8, -20, -6, 14, 16], neckY: [8, 8, 6, 4, 2], head: [4, 6, 10],
  tailP: [-8, -4, 0, 0, 0, 0, 0, 0, 0], tailY: [30, 42, 42, 34, 20, 8, 2, -4, -8],
  feet: [[-1, 0, 8.6], [-1, 0, -8.6], [21, 0, 5.5], [20, 0, -6.5]], ank: [[-4.6, 1.6], [-4.6, 1.6], [-3.4, 1.3], [-3.4, 1.3]],
  pole: [[0.3, 0.75, 0.6], [0.3, 0.75, -0.6], [-0.5, 0.5, 0.75], [-0.5, 0.5, -0.75]],
};
export const STAND = {
  py: 19.5, pitch: 4, arch: 2,
  neckP: [46, 26, 6, -22, -34], neckY: [0, 0, 0, 0, 0], head: [-16, 0, 0],
  tailP: [-10, -6, 4, 12, 18, 18, 12, 2, -10], tailY: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  feet: [[-7, 0, 6.8], [-4.5, 0, -6.8], [9, 0, 6.6], [11.5, 0, -6.6]], ank: [[-3, 4.6], [-3, 4.6], [-0.6, 2.4], [-0.6, 2.4]],
  pole: [[1, 0.1, 0.25], [1, 0.1, -0.25], [-1, 0.2, 0.3], [-1, 0.2, -0.3]],
};
export const ROAR_NECK = [-12, -14, -8, 6, 12], COIL_NECK = [-16, -10, 8, 14, 8], LOOK = [0.14, 0.2, 0.24, 0.2, 0.12];

// o: { t: dünya zamanı, wake: uyanıştan beri saniye (uykuda < 0), stir: 0..2, look: [yaw, pitch] (davetsiz misafire bakış) }
export function dragonPose(o) {
  const t = o.t, w = Math.max(0, o.wake ?? -1), stir = o.wake >= 0 ? 0 : o.stir || 0, look = o.look || [0, 0];
  // parça ağırlıkları: 0 uyku, 1 ayakta
  const kF = ss(0.38, 1.0, w), kR = ss(0.72, 1.3, w), kH = ss(0.12, 0.6, w);
  const coil = bump(1.0, 1.4, 1.42, 1.56, w), roar = bump(1.45, 1.6, 2.25, 2.7, w), lk = bump(0.5, 0.8, 1.1, 1.38, w) + 0.75 * ss(2.6, 3.05, w);
  const shiver = roar * Math.sin(w * 45);
  // nefes: uykuda ağır ve derin, ayakta hızlı ve sığ; göğüs önce, karın sonra dolar
  const ph = t * TAU / 3.2, deep = 1 - kF, b0 = Math.sin(ph), b1 = Math.sin(ph - 0.7), fast = Math.sin(t * TAU / 1.9) * kR;
  const br = [0.02 * b1 * deep, 0.05 * b1 * deep + 0.015 * fast, 0.07 * b0 * deep + 0.03 * fast + coil * 0.09 - roar * 0.03];
  // seğirme: uykuda ara sıra arka ayak ve kuyruk ucu; kıpırdanınca (stir) sıklaşır
  const dream = t % 7.3, tw = (dream < 0.5 ? Math.sin(dream / 0.5 * Math.PI) : 0) * deep;
  const P = { br, squash: 1 - kF, coins: 1 - ss(0.22, 0.4, w) };
  P.px = -9 - coil * 2.2 + roar * 3 + shiver * 0.25;
  P.py = lerp(SLEEP.py, STAND.py, kR) - coil * 1.8 + roar * 0.5 + (kF - kR) * 2.5;
  P.pitch = (lerp(SLEEP.pitch, STAND.pitch, kR) + (kF - kR) * 24 - coil * 4 + roar * 5) * D; P.roll = 0;
  P.arch = (lerp(SLEEP.arch, STAND.arch, kF) + (kF - kR) * 6 + roar * 3) * D;
  P.neckP = []; P.neckY = [];
  for (let i = 0; i < 5; i++) {
    // boyun dipten kalkar; baş geriden gelir (ağırlığını taşır)
    const k = ss(0.1 + i * 0.05, 0.62 + i * 0.07, w), over = bump(0.3, 0.7, 0.75, 1.1, w) * (2 - i) * 2;
    P.neckP.push((lerp(SLEEP.neckP[i], STAND.neckP[i], k) + over + coil * COIL_NECK[i] + roar * ROAR_NECK[i] + b0 * deep * (i ? 0.4 : 1.6) + fast * (i < 2 ? 1 : -0.6) + stir * (i === 1 ? 1.5 : 0)) * D + look[1] * lk * LOOK[i]);
    P.neckY.push(lerp(SLEEP.neckY[i], STAND.neckY[i], k) * D + look[0] * lk * LOOK[i] + Math.sin(t * 1.1 - i * 0.6) * 0.02 * kR);
  }
  P.head = [(lerp(SLEEP.head[0], STAND.head[0], kH) - coil * 10 + roar * 12) * D + look[1] * lk * 0.2, lerp(SLEEP.head[1], STAND.head[1], kH) * D + look[0] * lk * 0.12, (lerp(SLEEP.head[2], STAND.head[2], kH) + shiver * 3 + b0 * deep * 0.8) * D];
  P.jaw = roar * 0.82 + Math.abs(shiver) * 0.05 + deep * (0.02 + Math.max(0, -b0) * 0.05) + (stir >= 2 ? 0.06 : 0) + coil * 0.1;
  P.eye = o.wake >= 0 ? ss(0.02, 0.1, w) : stir >= 2 && (t % 4) < 1.4 ? 0.4 : 0;
  P.tailP = []; P.tailY = [];
  for (let i = 0; i < 9; i++) {
    // kuyruk dipten çözülür, uç kamçı gibi geriden gelir; kükremede kalkıp dalgalanır
    const k = ss(0.35 + i * 0.05, 1.0 + i * 0.08, w), lash = bump(0.7, 1.0, 1.3, 2.0, w) * Math.sin(w * 7 - i * 0.6) * 10 * (i / 8);
    const twitch = (stir ? Math.sin(t * 9 + i) * stir * 2.5 : 0) + tw * Math.sin(t * 30) * 4;
    P.tailP.push((lerp(SLEEP.tailP[i], STAND.tailP[i], k) + roar * (8 - i) * 1.3 + (i > 5 ? fast * 1.5 : 0)) * D);
    P.tailY.push((lerp(SLEEP.tailY[i], STAND.tailY[i], k) + lash + roar * Math.sin(w * 9 - i * 0.7) * 9 + (i > 5 ? twitch + Math.sin(t * 0.7 + i) * 2.5 * deep : 0) + Math.sin(t * 1.6 - i * 0.5) * 3.5 * kR * (i / 8)) * D);
  }
  // kanat: kapalı yatar; kalkınca yarı açılır, kükremede gerilir, sonra toplanır
  const open = track(w, [[0.85, 0], [1.38, 0.42], [1.47, 0.5], [1.64, 1], [2.25, 1], [3.0, 0.14]]);
  P.wing = { open, fan: track(w, [[1.0, 0], [1.42, 0.3], [1.68, 1], [2.3, 1], [3.0, 0.1]]), lean: 0.22, flap: track(w, [[0, -0.16], [0.9, -0.05], [1.4, -0.22], [1.62, 0.3], [1.9, 0.12], [2.3, 0.2], [3.0, 0]]) + b0 * deep * 0.035 + shiver * 0.02, wave: Math.sin(t * 5) * 0.25 * open };
  // ayaklar: önce ön ayaklar basar ve iter, sonra arka ayaklar toplanır
  P.feet = []; P.ank = []; P.pole = [];
  for (let i = 0; i < 4; i++) {
    const k = i < 2 ? ss(0.74 + i * 0.1, 1.12 + i * 0.1, w) : ss(0.4 + (i - 2) * 0.12, 0.74 + (i - 2) * 0.12, w), a = SLEEP.feet[i], b = STAND.feet[i];
    const flex = i === 0 ? tw * Math.sin(t * 34) * 0.6 : 0;
    P.feet.push([lerp(a[0], b[0], k) + flex + roar * (i < 2 ? 0 : 1.5), Math.sin(k * Math.PI) * 2.6, lerp(a[2], b[2], k)]);
    P.ank.push([lerp(SLEEP.ank[i][0], STAND.ank[i][0], k), lerp(SLEEP.ank[i][1], STAND.ank[i][1], k)]);
    P.pole.push(SLEEP.pole[i].map((v, j) => lerp(v, STAND.pole[i][j], k)));
  }
  // bakış açısı: uykuda üç çeyrek, kükremede profile yakın
  P.view = track(w, [[0.3, 22], [1.5, 14], [2.4, 14], [3.2, 20]]) * D;
  P.roar = roar; P.coil = coil; P.breath = b0 * deep;
  return P;
}
