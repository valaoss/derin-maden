// PixelLab sprite bossları: yürürken gidilen yola bağlı kare ilerler, dururken ilk kare nefes alır.
// Saldırı hazırlığında çöker ve titrer, hamlede ileri uzar; vurulunca beyaz parlar, öfkede rengine bürünür.
// Dönüş anlık ama kısa bir sıçramayla; ölümde önce parlar, sonra kararıp yere gömülerek söner.
// Sayfanın alt yarısı parlayan piksellerdir: ışık katmanında toplanarak çizilir (göz, alev, kor).
import { STEP } from '../config.js';
import { BOSS_ART } from '../data/bossart.js';
import { G } from '../game/state.js';
import { clamp } from '../core/util.js';

const sheets = {};
function sheet(type) {
  const A = BOSS_ART[type]; if (!A) return null;
  let s = sheets[type];
  if (!s) {
    s = sheets[type] = { ready: false };
    const img = new Image();
    img.onload = () => { s.img = img; s.ready = true; };
    img.src = `./boss/${type}.png`;
  }
  return s.ready ? s : null;
}
// beyaz ya da renkli siluet (vuruş, öfke, kararma); kare başına önbellekli
function tint(s, A, sx, sy, col) {
  const key = sx + ',' + sy + col; s.tints = s.tints || {};
  let c = s.tints[key];
  if (!c) {
    c = s.tints[key] = document.createElement('canvas'); c.width = A.w; c.height = A.h;
    const x = c.getContext('2d');
    x.drawImage(s.img, sx, sy, A.w, A.h, 0, 0, A.w, A.h);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, A.w, A.h);
  }
  return c;
}

// oyun açılırken yüklenir: boss ortaya çıktığında hazır olsun
if (typeof Image !== 'undefined') for (const t in BOSS_ART) sheet(t);

const RS = new WeakMap();
// kare seçimi ve dönüşüm: ana ve ışık katmanı aynı pozu kullanır
function pose(e, alpha, upd) {
  const A = BOSS_ART[e.type], t = G.time;
  let s = RS.get(e);
  if (!s) { s = { ph: 0, t, face: e.face || 1, flipT: -9, walk: 0 }; RS.set(e, s); }
  if (upd) {
    const dt = clamp(t - s.t, 0, 0.1); s.t = t;
    const sp = e.dead ? 0 : Math.hypot(e.x - e.px, e.y - e.py) / STEP;
    s.walk += ((sp > 3 ? 1 : 0) - s.walk) * Math.min(1, dt * 10);
    s.ph += Math.min(sp, 220) * dt / 34;   // bir adım döngüsü ~34 px
    if ((e.face || 1) !== s.face) { s.face = e.face || 1; s.flipT = t; }
  }
  const B = e.bs, act = B && B.act;
  let row = 0, fr = 0;
  if (A.fly) fr = 1 + Math.floor(t * 9) % A.walk;
  else if (s.walk > 0.5) fr = 1 + Math.floor(s.ph * A.walk) % A.walk;
  // Balrog kılıcı: kaldırış ve iniş saldırı karelerine bağlanır
  if (act && A.atk && act.k === 'sword') {
    row = 1;
    const k = act.stage === 'raise' ? clamp(1 - act.st / 0.8, 0, 1) * 0.55 : 0.55 + clamp(1 - act.st / 0.7, 0, 1) * 0.45;
    fr = Math.min(A.atk - 1, Math.floor(k * A.atk));
  }
  const wind = e.wind || 0, lunge = e.lunge || 0, fk = clamp((t - s.flipT) / 0.28, 0, 1);
  let sx = 1 + wind * 0.07 + lunge * 0.08, sy = 1 - wind * 0.09 - lunge * 0.05;
  if (fr === 0 && row === 0 && !A.fly) { const br = Math.sin(t * 2.4 + (e.wob || 0)) * 0.018; sx -= br; sy += br; }
  if (fk < 1) { const q = Math.sin(fk * Math.PI); sx -= q * 0.06; sy += q * 0.06; }
  const dying = e.dead ? clamp(1 - e.dieT / (e.d.dieT || 0.9), 0, 1) : 0;
  let ox = 0, oy = 0;
  if (wind > 0.5 && !e.dead) ox += Math.floor(t * 30) % 2 ? 1 : -1;
  ox += lunge * 4 * (e.face || 1);
  if (e.hitT > 0) { ox += (e.hitDx || 0) * 1.5; oy += (e.hitDy || 0) * 1.5; }
  if (fk < 1) oy -= Math.sin(fk * Math.PI) * 4;
  if (A.fly) oy += Math.sin(t * 1.8 + (e.wob || 0)) * 2;
  const x = e.px + (e.x - e.px) * alpha + ox, y = e.py + (e.y - e.py) * alpha + oy;
  // ayak çizgisi: yerdekiler hücrenin tabanına basar, uçan gövde ortasından asılır
  const feet = A.fly ? y + (A.feet - A.top) / 2 : y + 8;
  return { A, s, row, fr, sx, sy, x, feet, F: (e.face || 1) * A.face, dying, rage: !!(B && B.phase === 2), t };
}

function place(ctx, P) {
  ctx.save();
  ctx.translate(Math.round(P.x), Math.round(P.feet));
  ctx.scale(P.F * P.sx, P.sy);
}
const src = (P, glow) => [P.fr * P.A.w, (P.row + (glow ? P.A.rows : 0)) * P.A.h];

export const hasBossArt = e => !!BOSS_ART[e.type];

// ana katman: false dönerse sayfa henüz yüklenmedi (eski çizim kullanılır)
export function drawBossArt(ctx, e, alpha, a0 = 1) {
  const s = sheet(e.type); if (!s) return false;
  const P = pose(e, alpha, true), A = P.A, [sx, sy] = src(P);
  let a = a0;
  if (P.dying > 0.55) a *= 1 - (P.dying - 0.55) / 0.45;
  if (a <= 0.01) return true;
  const emerge = e.emergeT > 0 ? Math.min(1, e.emergeT / 0.9) : e.sink > 0 ? e.sink : 0;
  const sink = Math.max(emerge, P.dying > 0.2 ? (P.dying - 0.2) / 0.8 * 0.5 : 0);
  // gölge
  if (!A.fly && sink < 0.9) { ctx.globalAlpha = 0.3 * a * (1 - sink); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(Math.round(P.x), Math.round(P.feet) - 1, (A.w * 0.3) | 0, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.save();
  if (sink > 0 && !A.fly) { ctx.beginPath(); ctx.rect(P.x - A.w, P.feet - A.h * 2, A.w * 2, A.h * 2); ctx.clip(); }
  place(ctx, P);
  if (sink > 0) ctx.translate(0, (A.feet - A.top) * sink);
  ctx.globalAlpha = a;
  ctx.drawImage(s.img, sx, sy, A.w, A.h, -A.cx, -A.feet, A.w, A.h);
  // öfke: kendi renginde nabız; ölüm: önce beyaz parlar, sonra kararır; vuruş: beyaz
  if (P.rage && !e.dead) { ctx.globalAlpha = a * (0.12 + 0.1 * Math.sin(P.t * 7)); ctx.drawImage(tint(s, A, sx, sy, e.d.col), -A.cx, -A.feet); }
  if (P.dying > 0) { ctx.globalAlpha = a * (P.dying < 0.15 ? 0.9 : Math.min(0.85, (P.dying - 0.15) * 1.6)); ctx.drawImage(tint(s, A, sx, sy, P.dying < 0.15 ? '#ffffff' : '#0a0406'), -A.cx, -A.feet); }
  else if (e.hitT > 0) { ctx.globalAlpha = a * 0.75; ctx.drawImage(tint(s, A, sx, sy, '#ffffff'), -A.cx, -A.feet); }
  ctx.restore(); ctx.restore();
  ctx.globalAlpha = 1;
  return true;
}

// ışık katmanı: parlayan pikseller toplanarak çizilir, parıltı noktalarında hale
export function drawBossArtGlow(ctx, e, alpha, glow, a0 = 1) {
  const s = sheet(e.type); if (!s) return false;
  const P = pose(e, alpha, false), A = P.A, [sx, sy] = src(P, true);
  const a = a0 * (P.dying ? Math.max(0, 1 - P.dying * 1.6) : 1) * (e.emergeT > 0 ? 1 - Math.min(1, e.emergeT / 0.9) : 1);
  if (a <= 0.01) return true;
  const pulse = 0.75 + 0.25 * Math.sin(P.t * (P.rage ? 7 : 3.2));
  place(ctx, P);
  ctx.globalAlpha = a * pulse * 0.8;
  ctx.drawImage(s.img, sx, sy, A.w, A.h, -A.cx, -A.feet, A.w, A.h);
  ctx.restore(); ctx.globalAlpha = 1;
  const col = e.d.col;
  for (const [gx, gy] of A.glow) glow(P.x + (gx - A.cx) * P.F * P.sx, P.feet + (gy - A.feet) * P.sy, col, 9, a * pulse * 0.7);
  const cy = P.feet - (A.feet - A.top) * 0.5;
  glow(P.x, cy, col, P.rage ? 34 : 26, a * (P.rage ? 0.45 : 0.3));
  if (e.wind > 0) glow(P.x, cy, '#ffffff', Math.round(10 + e.wind * 18), e.wind * a);
  if (e.flashT > 0) glow(P.x, cy, col, 30, Math.min(1, e.flashT) * a);
  return true;
}
