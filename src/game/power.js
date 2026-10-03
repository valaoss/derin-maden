// Güç ölçümü: yönetmen ekibin silahına, kartlarına, eklentilerine ve kalıntılarına bakıp düşman canını ayarlar.
import { UPGRADES, MODS, CARDS, CRIT, POWER } from '../data/balance.js';
import { G } from './state.js';
import { hasPerk, hasRelic, hasMod, weaponOf, cardLv, pv, resonance } from './run.js';

// mermi başına hasar (anlık etkiler hariç: son direniş, adrenalin, kritik)
export function gunDmg(p) {
  const W = weaponOf(p);
  return UPGRADES.blaster.dmg[G.lvl.blaster] * W.dmg * (1 + CARDS.dmg.v * cardLv('dmg')) * (1 + pv('kalibre')) * (hasPerk('camTop') ? 1.8 : 1) * (hasPerk('gurultuTanrisi') ? 1.7 : 1) * (hasRelic('aynaTac') ? 1.15 : 1) * (hasRelic('sifirTasi') ? 1.4 : 1) * (G.lvl.yildizCekirdek ? 1.4 : 1);
}
// atış aralığı (anlık etkiler hariç: öfke, aşırı yük)
export function gunCd(p) {
  const W = weaponOf(p);
  let cd = (W.flame ? W.cd : UPGRADES.blaster.cd[G.lvl.blaster] * W.cd) / (1 + CARDS.hiz.v * cardLv('hiz'));
  if (hasMod('rapid')) cd /= 1.3;
  cd /= 1 + pv('hizliTetik');
  return cd;
}
export function critChance(p) { return Math.min(0.9, (CRIT.base + CARDS.krit.v * cardLv('krit')) * (weaponOf(p).crit || 1)); }
// sürekli hasar/sn tahmini: çoklu mermi, delme, alan, kritik ve eklentiler kabaca sayılır
// single: tek hedefe (elit/boss) karşı; sekme, delme, alan ve öldürmeyle biriken etkiler sayılmaz
export function gunDps(p, single = false) {
  const W = weaponOf(p), shot = !W.flame && !W.zap, cok = cardLv('cok');
  let k = W.flame ? (single ? 1 : W.cone ? 2 : 1.5) : W.zap ? (single ? 1 : 1 + (W.zap + cok) * 0.6) : (W.pellets ? (W.pellets + cok) * 0.6 : 1 + cok * 0.4) + (hasMod('split') ? 0.5 : 0);
  if (W.blast && !single) k *= W.quiet ? 1.3 : 1.8;
  const pierce = shot && !single ? (W.pierce || 0) + cardLv('del') + (hasPerk('deliciIsin') ? 3 : 0) : 0;
  if (pierce) k *= 1 + Math.min(4, pierce) * 0.2;
  if (hasPerk('ciftNamlu') && shot) k *= 2;
  if (shot && hasMod('boom') && !single) k *= 1.25;
  if (shot && hasMod('chain') && !single) k *= 1.3;
  if (shot && hasMod('homing')) k *= 1.1;
  if (hasMod('nova') && !single) k *= 1.15;
  if (hasMod('overdrive')) k *= 1 + 2 * MODS.overdrive.dur / MODS.overdrive.cd;
  if (hasPerk('ofke') && !single) k *= 1 + pv('ofke') * 3;
  if (hasPerk('kor')) k *= 1 + pv('kor') * 2;
  if (hasPerk('zincirSimsek') && !single) k *= 1 + pv('zincirSimsek') * 0.5;
  return gunDmg(p) * k * (1 + critChance(p) * (CRIT.mul - 1)) / gunCd(p) * hiddenMul(p, single);
}
// koşullu ama sık devreye giren çarpanlar (yavaşlamışa Kırılgan, Cellat, Suikastçi, Leş Bombası, Son Direniş, rezonanslar):
// yönetmen bunları görmezse geç oyunda düşman kâğıttan olur. Tek hedefte (elit/boss tabanı) yalnız sürekli olanlar sayılır
export function hiddenMul(p, single = false) {
  const W = weaponOf(p);
  let m = 1;
  if (G.mp && hasPerk('kanBagi')) m *= 1 + pv('kanBagi') * 0.7;
  if (resonance('golge')) m *= 1.15;
  if (single) return m;
  if (hasPerk('kirilgan') && (hasMod('frost') || W.freeze || hasPerk('buzMermi') || hasRelic('arken'))) m *= 1 + pv('kirilgan') * 0.8;
  if (hasPerk('cellat')) m /= 1 - pv('cellat');
  if (hasPerk('suikast')) m *= 1 + (pv('suikast') - 1) * 0.35;
  if (hasPerk('lesBombasi')) m *= 1 + pv('lesBombasi') * 0.6;
  if (hasPerk('sonDirenis')) m *= 1 + (pv('sonDirenis') - 1) * 0.25;
  if (resonance('ates') && (hasMod('fire') || W.flame || W.burn || hasPerk('kor') || G.lvl.opalNamlu)) m *= 1.3;
  if (resonance('simsek')) m *= 1.15;
  if (resonance('buz') && (hasMod('frost') || W.freeze || hasPerk('buzMermi'))) m *= 1.15;
  return m;
}
// ekibin toplam gücü (ayakta olan madenciler). single: tek hedefe karşı
export function teamDps(single = false) {
  let d = 0;
  for (const p of G.players) if (!p.dead) d += gunDps(p, single);
  return d;
}
// bu derinlikte beklenen tek madenci gücü: Silah Gücü ve silah kartlarının olağan ilerleyişi
export function expectedDps(st) {
  const L = Math.min(UPGRADES.blaster.dmg.length - 1, Math.floor(st * POWER.lvPerBiome));
  return UPGRADES.blaster.dmg[L] / UPGRADES.blaster.cd[L] * (1 + CRIT.base * (CRIT.mul - 1)) * Math.min(POWER.cardMax, 1 + POWER.cardPerBiome * st);
}
// sıradan düşman can çarpanı: ilk biyomlarda karışmaz; sonra ekip beklenenin 'free' katını aşarsa yükselir (asla düşmez)
export function directorHp(st) {
  if (st < POWER.from) return 1;
  const n = Math.max(1, G.players.filter(p => !p.dead).length);
  const r = teamDps() / n / expectedDps(st) / POWER.free;
  return Math.min(POWER.max, Math.max(1, Math.pow(r, POWER.exp)));
}
// elit/boss can tabanı: ekibin tam isabetle en az bu kadar saniye ateş etmesi gerekir
export function ttkFloor(boss) {
  // Dev Avcısı'nın ek hasarı tabana katılmaz: yoksa taban o hasarı birebir yutar ve perk etkisiz kalır
  return teamDps(true) * (boss ? POWER.bossTtk : POWER.eliteTtk);
}
