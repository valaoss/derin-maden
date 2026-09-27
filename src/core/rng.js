// Simülasyon RNG'si: tohumlu, durumu G içinde tutulur (kayıt/lockstep için deterministik).
// Kozmetik parçacıklar Math.random kullanabilir; oyun durumunu etkileyen her şey buradan geçer.
import { G } from '../game/state.js';

export function seedRng(seed) { G.rng = (seed ^ 0x9e3779b9) >>> 0 || 1; }

export function rnd() {
  let a = (G.rng + 0x6D2B79F5) | 0;
  G.rng = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rndInt = n => Math.floor(rnd() * n);
export const rndPick = arr => arr[Math.floor(rnd() * arr.length)];
