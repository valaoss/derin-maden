// İnsansı iskelet: duruştan eklem konumlarını çözer; deriyi her boss kendi çizer. Yüz +x, yukarı +y, sağ el +z.
import { frame, turn, at, shift, mad, mul, ik, reach } from './rig.js';

// S: ölçüler { hip, spine, neck, shW, shY, hipW, arm: [üst, ön], leg: [uyluk, baldır], ankle }
// P: { x, y (kalça kayması), lean (öne +), twist, roll, bend: [öne, dönme, yana], head: [yukarı, sapma, yatma],
//      armR/armL: { sw (öne savurma), ab (yana açma), tw (bükme), el (dirsek) }, footR/footL: [x, y, z] }
export function biped(P, S) {
  const pel = turn(frame([P.x || 0, S.hip + (P.y || 0), 0]), P.twist || 0, -(P.lean || 0), P.roll || 0), b = P.bend || [0, 0, 0], h = P.head || [0, 0, 0];
  const waist = turn(shift(pel, 0, S.spine * 0.45, 0), b[1] * 0.5, -b[0] * 0.5, b[2] * 0.5);
  const chest = turn(shift(waist, 0, S.spine * 0.55, 0), b[1] * 0.5, -b[0] * 0.5, b[2] * 0.5);
  const head = turn(shift(chest, S.headX || 0, S.neck, 0), h[1], h[0], h[2]);
  // kol: omuzdan aşağı sarkar; ab yana açar, sw öne kaldırır, el dirseği öne büker
  const arm = (s, a) => {
    const sh = at(chest, 0, S.shY || 0, s * S.shW);
    const F = turn(frame(sh, mul(chest.u, -1), chest.f, mul(chest.r, s)), a.ab || 0, a.sw || 0, a.tw || 0);
    const el = mad(sh, F.f, S.arm[0]), fore = turn(frame(el, F.f, F.u, F.r), 0, a.el || 0), wr = mad(el, fore.f, S.arm[1]);
    return { sh, el, wr, hand: frame(wr, fore.f, fore.u, fore.r) };
  };
  const leg = (s, foot, pole) => {
    const hip = at(pel, 0, -1, s * S.hipW), ank = reach(hip, [foot[0], foot[1] + S.ankle, foot[2]], (S.leg[0] + S.leg[1]) * 0.99);
    return { hip, knee: ik(hip, ank, S.leg[0], S.leg[1], pole || [1, 0.12, s * 0.22]), ank, foot: [ank[0], ank[1] - S.ankle, ank[2]] };
  };
  return { pel, waist, chest, head, R: arm(1, P.armR || {}), L: arm(-1, P.armL || {}), legR: leg(1, P.footR, P.poleR), legL: leg(-1, P.footL, P.poleL) };
}
// bir adım: duty kadarı yerde (geri kayar), kalanı havada öne gider -> [dx, dy]
export function stride(ph, A, lift, duty = 0.62) {
  const c = ph - Math.floor(ph);
  if (c < duty) return [A * (1 - 2 * c / duty), 0];
  const k = (c - duty) / (1 - duty), e = k * k * (3 - 2 * k);
  return [A * (2 * e - 1), Math.sin(k * Math.PI) * lift];
}
