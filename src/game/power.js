// Güç ölçümü: yönetmen ekibin silahına, ustalığına, kalıntılarına ve aletlerine bakıp düşman canını ayarlar.
import { UPGRADES, BUILDS, WEAPON_UP, POWER } from '../data/balance.js';
import { G } from './state.js';
import { hasPerk, hasRelic, hasMod, roleOf, weaponOf, weaponLvl, toolDmgMul, pv } from './run.js';

// mermi başına hasar (anlık etkiler hariç: son direniş, adrenalin)
export function gunDmg(p) {
  const W = weaponOf(p), wl = weaponLvl(p.wpn || 'blaster');
  return UPGRADES.blaster.dmg[G.lvl.blaster] * W.dmg * (1 + WEAPON_UP.dmg * wl) * (1 + pv('kalibre')) * (hasPerk('camTop') ? 1.8 : 1) * (hasPerk('gurultuTanrisi') ? 1.7 : 1) * (hasRelic('aynaTac') ? 1.15 : 1) * (hasRelic('sifirTasi') ? 1.4 : 1) * (roleOf(p).dmg || 1) * (G.lvl.yildizCekirdek ? 1.4 : 1);
}
// atış aralığı (anlık etkiler hariç: öfke, aşırı yük)
export function gunCd(p) {
  const W = weaponOf(p), wl = weaponLvl(p.wpn || 'blaster');
  let cd = (W.flame ? W.cd : UPGRADES.blaster.cd[G.lvl.blaster] * W.cd) * (1 - WEAPON_UP.cd * wl);
  if (hasMod('rapid')) cd *= 0.7;
  cd /= 1 + pv('hizliTetik');
  return cd;
}
// sürekli hasar/sn tahmini: çoklu mermi, delme, alan ve eklentiler kabaca sayılır
export function gunDps(p) {
  const W = weaponOf(p);
  let k = W.pellets ? W.pellets * 0.6 : W.zap ? 1 + W.zap * 0.6 : W.flame ? 1.5 : W.blast ? 1.8 : 1;
  if (W.pierce || hasPerk('deliciIsin')) k *= 1 + Math.min(4, (W.pierce || 0) + (hasPerk('deliciIsin') ? 3 : 0)) * 0.2;
  if (hasPerk('ciftNamlu') && !W.flame && !W.zap) k *= 2;
  if (hasMod('split') && !W.pellets && !W.flame && !W.zap) k *= 1.5;
  if (hasMod('boom')) k *= 1.25;
  if (hasMod('chain')) k *= 1.3;
  if (hasPerk('ofke')) k *= 1 + pv('ofke') * 3;
  if (hasPerk('kor')) k *= 1 + pv('kor') * 2;
  if (hasPerk('zincirSimsek')) k *= 1 + pv('zincirSimsek') * 0.5;
  return gunDmg(p) * k / gunCd(p);
}
function toolDps(s) {
  const b = BUILDS[s.type], m = toolDmgMul(s.type);
  return (b.dps ? b.dps : b.dmg / b.cd * (b.splash ? 1.8 : 1)) * m;
}
// ekibin toplam gücü (ayakta olan madenciler + kurulu aletler)
export function teamDps() {
  let d = 0;
  for (const p of G.players) if (!p.dead) d += gunDps(p);
  for (const s of G.structures) d += toolDps(s) * POWER.tool;
  return d;
}
// bu derinlikte beklenen tek madenci gücü: Silah Gücü ve ustalığın olağan ilerleyişi
export function expectedDps(st) {
  const L = Math.min(UPGRADES.blaster.dmg.length - 1, Math.floor(st * POWER.lvPerBiome));
  return UPGRADES.blaster.dmg[L] / UPGRADES.blaster.cd[L] * (1 + WEAPON_UP.dmg * Math.min(WEAPON_UP.max, st * POWER.wlPerBiome));
}
// sıradan düşman can çarpanı: ekip beklenenden güçlüyse yükselir (asla düşmez)
export function directorHp(st) {
  const n = Math.max(1, G.players.filter(p => !p.dead).length);
  const r = teamDps() / n / expectedDps(Math.max(0, st));
  return Math.min(POWER.max, Math.max(1, Math.pow(r, POWER.exp)));
}
// elit/boss can tabanı: ekibin tam isabetle en az bu kadar saniye ateş etmesi gerekir
export function ttkFloor(boss) {
  return teamDps() * (1 + pv('devAvcisi')) * (boss ? POWER.bossTtk : POWER.eliteTtk);
}
