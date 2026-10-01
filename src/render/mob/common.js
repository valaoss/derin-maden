// Küçük 3B düşmanların ortak yardımcıları: renk rampası, doku gürültüsü, bakış açısı.
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const ramp = (...c) => c.map(rgb), fr = x => x - Math.floor(x);
export const noise = (a, b) => fr(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
// dört yöne (ve aralarına) gerçekten döner: gittiği ya da saldırdığı yöne bakar. Sağa/sola giderken üç çeyrek yan,
// aşağı giderken yüzü kameraya, yukarı giderken sırtı kameraya. Savrulurken ve dururken son yönünü korur
const dirs = new WeakMap();
export function mobView(o, bias = 0.38) {
  const e = o.e, dx = e.x - e.px, dy = e.y - e.py;
  let a = dirs.get(e); if (a === undefined) a = o.face >= 0 ? 0 : Math.PI;
  if (!e.dead) {
    if (e.st === 'ranged' || e.st === 'pull' || e.tongue > 0 || o.wind > 0) a = Math.atan2(o.ty, o.tx);
    else if (o.speed > 3 && !e.kx && !e.ky) a = Math.atan2(dy, dx);
    else if (Math.abs(Math.cos(a)) > 0.5 && (Math.cos(a) >= 0 ? 1 : -1) !== o.face) a = o.face >= 0 ? 0 : Math.PI;
  }
  dirs.set(e, a);
  return a + Math.cos(a) * bias;
}
