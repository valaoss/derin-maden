// Güç ölçümü: yönetmen ekibin silahına, kartlarına, eklentilerine, kalıntılarına ve aletlerine bakıp düşman canını ayarlar.
import { UPGRADES, BUILDS, MODS, CARDS, CRIT, POWER } from '../data/balance.js';
import { G } from './state.js';
import { hasPerk, hasRelic, hasMod, roleOf, weaponOf, cardLv, toolDmgMul, pv } from './run.js';

// mermi başına hasar (anlık etkiler hariç: son direniş, adrenalin, kritik)
export function gunDmg(p) {
  const W = weaponOf(p);
  return UPGRADES.blaster.dmg[G.lvl.blaster] * W.dmg * (1 + CARDS.dmg.v * cardLv('dmg')) * (1 + pv('kalibre')) * (hasPerk('camTop') ? 1.8 : 1) * (hasPerk('gurultuTanrisi') ? 1.7 : 1) * (hasRelic('aynaTac') ? 1.15 : 1) * (hasRelic('sifirTasi') ? 1.4 : 1) * (roleOf(p).dmg || 1) * (G.lvl.yildizCekirdek ? 1.4 : 1);
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
export function gunDps(p) {
  const W = weaponOf(p), shot = !W.flame && !W.zap, cok = cardLv('cok');
  let k = W.flame ? (W.cone ? 2 : 1.5) : W.zap ? 1 + (W.zap + cok) * 0.6 : (W.pellets ? (W.pellets + cok) * 0.6 : 1 + cok * 0.4) + (hasMod('split') ? 0.5 : 0);
  if (W.blast) k *= W.quiet ? 1.3 : 1.8;
  const pierce = shot ? (W.pierce || 0) + cardLv('del') + (hasPerk('deliciIsin') ? 3 : 0) : 0;
  if (pierce) k *= 1 + Math.min(4, pierce) * 0.2;
  if (hasPerk('ciftNamlu') && shot) k *= 2;
  if (shot && hasMod('boom')) k *= 1.25;
  if (shot && hasMod('chain')) k *= 1.3;
  if (shot && hasMod('homing')) k *= 1.1;
  if (hasMod('nova')) k *= 1.15;
  if (hasMod('overdrive')) k *= 1 + 2 * MODS.overdrive.dur / MODS.overdrive.cd;
  if (hasPerk('ofke')) k *= 1 + pv('ofke') * 3;
  if (hasPerk('kor')) k *= 1 + pv('kor') * 2;
  if (hasPerk('zincirSimsek')) k *= 1 + pv('zincirSimsek') * 0.5;
  return gunDmg(p) * k * (1 + critChance(p) * (CRIT.mul - 1)) / gunCd(p);
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
  return teamDps() * (1 + pv('devAvcisi')) * (boss ? POWER.bossTtk : POWER.eliteTtk);
}
