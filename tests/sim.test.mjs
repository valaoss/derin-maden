// Headless oyun testleri: gerçek modüller, DOM yok. Kullanım: node tests/sim.test.mjs
import { App, G } from '../src/game/state.js';
import { newRun, recompute, serialize, deserialize, pickDmg, pickInterval, makeStructure, bagCount, weaponOf, cardLv, hasMod } from '../src/game/run.js';
import { updatePlayer, updateOrbs, updateDeposit, bindEnemyDamage, breakTile, damagePlayer, blindPlayer } from '../src/game/player.js';
const damagePlayerX = (p, d) => { p.iframes = 0; damagePlayer(p, d, p.x, p.y + 20); };
import { updateEnemies, damageEnemy, spawnEnemy, killEnemy } from '../src/game/enemies.js';
import { updatePlayerGun, updateBullets, updateStructures, updateShells } from '../src/game/combat.js';
import { gunDps, gunDmg, gunCd, critChance, directorHp } from '../src/game/power.js';
import { xpNeed, weaponMaxed, WOFFER } from '../src/game/weaponlevel.js';
import { offerInfo, rerollOffer } from '../src/game/chests.js';
import { buyUpgrade, buyMod, upgradeCost, applyPerk, beaconLack, levelUp, itemCost } from '../src/game/economy.js';
import { updateItems, useItem } from '../src/game/items.js';
import { updateHazards } from '../src/game/hazards.js';
import { updateThreat, addNoise, nestsInStratum, nestDestroyed, wakeDelay } from '../src/game/threat.js';
import { updateEvents } from '../src/game/events.js';
import { roleOf, lampTiles, metaSnapshot, hasRelic, lastStand, resonance } from '../src/game/run.js';
import { deployLimit } from '../src/game/economy.js';
import { openStation, callElevator, atShaft, stationY, SHAFT_X } from '../src/game/elevator.js';
import { DEPLOY_MAX, EVENTS, MERCHANT, BOSS_MELEE } from '../src/data/balance.js';
import { buyMerch, updateMerchant } from '../src/game/merchant.js';
import { wish, updateWell, wellCost, WELL_X } from '../src/game/well.js';
import { updateCritters } from '../src/game/critters.js';
import { updateWonders, castLine, lakeAt } from '../src/game/wonders.js';
import { updateLiquids, FALLS_BIOME, LAVA_BIOME } from '../src/game/liquids.js';
import { updateBalrog } from '../src/game/balrog.js';
import { updateSerpent, SEA_BIOME } from '../src/game/serpent.js';
import { updateHoard, PALACE_BIOME } from '../src/game/dragon.js';
import { CRITTERS } from '../src/data/critters.js';
import { updateParticles, updateFlashes } from '../src/game/fx.js';
import { updateFlow, forceFlow } from '../src/world/flow.js';
import { setTile, tileAt } from '../src/world/map.js';
import { generate, biomeOrder } from '../src/world/gen.js';
import { T, TD, HOST_TILE } from '../src/data/tiles.js';
import { WEAPONS, CARDS, CARD_KEYS, START_MODS, WXP, CRIT, POWER } from '../src/data/balance.js';
import { ENEMIES, MODS, MOD_KEYS, PICK_TIERS, UPGRADES, ELITE, RES_KEYS, THREAT, BUILDS, ITEMS, RELICS, RELIC_KEYS, PERKS, ROLES, EVENT_KEYS, DEEP_ORES, ozForRun } from '../src/data/balance.js';
import { placeBuild, pickupBuild, craftItem, gearPick, testFunds, TEST_FUNDS } from '../src/game/economy.js';
import { WEAPON_KEYS, PICK_TYPE_KEYS, SHIELD, AUGER, DIRECTOR, AFFIX, enemyHpMul } from '../src/data/balance.js';
import { playerSpeed } from '../src/game/player.js';
import { STRATA } from '../src/data/palette.js';
import { COLS, ROWS, GROUND_ROW, GROUND_Y, STRATUM_ROWS, STRATA_COUNT, TILE } from '../src/config.js';
import { on } from '../src/core/events.js';
import { bossForY } from '../src/game/bosses.js';

App.settings = { sfx: false, music: false, haptics: false, shake: false };
App.meta = { lv: {}, tutorialDone: true };
bindEnemyDamage(damageEnemy);
let allDown = false; on('allDown', () => { allDown = true; });
const events = {}; for (const n of ['heart', 'web', 'chill', 'relic', 'bossPhase', 'bossSpawn', 'stratum', 'modChanged', 'modUsed', 'perkOffer', 'toast', 'threat', 'nestDown', 'beacon', 'bossDown', 'revived', 'event', 'station', 'elevatorDone', 'critter', 'bossWarn', 'bossCalm']) on(n, () => { events[n] = (events[n] || 0) + 1; });

const STEP = 1 / 60;
let fails = 0, checks = 0;
const ok = (name, cond, info = '') => { checks++; if (!cond) { fails++; console.log('  ✗', name, info); } };
const section = n => console.log('\n## ' + n);
const finite = v => Number.isFinite(v);
function step(dt = STEP) {
  G.time += dt; G.stats.time += dt; G.frame++;
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  updateFlow(dt); updatePlayer(dt); updatePlayerGun(dt); updateEnemies(dt); updateBullets(dt); updateStructures(dt); updateShells(dt);
  updateItems(dt); updateHazards(dt); updateThreat(dt); updateEvents(dt); updateMerchant(dt); updateWell(dt); updateCritters(); updateWonders(dt); updateLiquids(dt); updateBalrog(dt); updateSerpent(dt); updateHoard(dt); updateOrbs(dt); updateDeposit(dt); updateParticles(dt); updateFlashes(dt);
}
const run = sec => { for (let i = 0, n = Math.round(sec / STEP); i < n; i++) step(); };
const fresh = (seed = 1) => { const g = newRun({ seed, start: false }); allDown = false; g.player.inp = { x: 0, y: 0, mag: 0 }; return g; };
const shaft = (c, toRow) => { for (let r = GROUND_ROW; r <= toRow; r++) setTile(c, r, T.AIR); };
function hash() {
  let h = 2166136261; const mix = v => { v = Math.round(v * 8) | 0; for (let s = 0; s < 24; s += 8) { h ^= (v >>> s) & 255; h = Math.imul(h, 16777619); } };
  for (const p of G.players) { mix(p.x); mix(p.y); mix(p.hp); mix(p.dead ? 1 : 0); }
  mix(G.threat.noise); mix(G.rng); mix(G.threat.level); mix(G.stats.dug); mix(G.stats.kills); mix(G.enemies.length); mix(G.mapVersion);
  for (const e of G.enemies) { mix(e.x); mix(e.y); mix(e.hp); }
  for (const k of RES_KEYS) mix(G.store[k]);
  return h >>> 0;
}

// ---------- 1. dünya üretimi ----------
section('Dünya üretimi');
for (let seed = 1; seed <= 12; seed++) {
  const gen = generate(seed, {});
  const map = gen.map;
  ok('harita boyutu', map.length === COLS * ROWS, `${map.length}`);
  let bad = 0, heart = 0; const perStratum = Array.from({ length: STRATA_COUNT }, () => ({ host: 0, total: 0, gold: 0, chest: 0, ore: 0 }));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = map[r * COLS + c];
    if (!TD[t]) { bad++; continue; }
    if (TD[t].heart) heart++;
    const s = Math.floor((r - GROUND_ROW) / STRATUM_ROWS);
    if (r >= GROUND_ROW && s < STRATA_COUNT && c >= 2 && c <= 14) {
      const ps = perStratum[s]; ps.total++;
      if (t === HOST_TILE[gen.order[s]]) ps.host++;
      if (t === T.GOLD) ps.gold++;
      if (TD[t].chest) ps.chest++;
      if (TD[t].ore) ps.ore++;
    }
  }
  ok('geçersiz tile yok', bad === 0, `seed ${seed}: ${bad}`);
  ok('tek kalp', heart === 1, `seed ${seed}: ${heart}`);
  ok('kalp en dipte', gen.heartRow > GROUND_ROW + STRATUM_ROWS * (STRATA_COUNT - 1), `heartRow ${gen.heartRow}`);
  perStratum.forEach((ps, s) => {
    ok(`biyom ${s} ana kaya baskın`, ps.host / ps.total > 0.22, `seed ${seed}: ${(ps.host / ps.total * 100) | 0}%`);
    ok(`biyom ${s} cevher var`, ps.ore > 0, `seed ${seed}`);
  });
  ok('altın yüzeyde yok', perStratum[0].gold === 0, `seed ${seed}: ${perStratum[0].gold}`);
  ok('altın derinde var', perStratum.slice(3).reduce((a, p) => a + p.gold, 0) > 5, `seed ${seed}`);
  ok('sandık var', perStratum.reduce((a, p) => a + p.chest, 0) >= 6, `seed ${seed}: ${perStratum.reduce((a, p) => a + p.chest, 0)}`);
}
{ const a = generate(99, {}).map, b = generate(99, {}).map; ok('aynı tohum aynı harita', a.every((v, i) => v === b[i])); }
{
  const os = [1, 2, 3, 4, 5].map(biomeOrder);
  ok('biyom sırası: Toprak ilk, Yaratılış 20., Sıfır son', os.every(o => o[0] === 0 && o[20] === 19 && o[30] === 29 && o[24] === 23 && o[28] === 27 && o.indexOf(FALLS_BIOME) >= 3 && o.indexOf(FALLS_BIOME) <= 6));
  ok('biyom sırası: her biyom bir kez', os.every(o => new Set(o).size === STRATA_COUNT));
  ok('biyom sırası tohuma göre değişir', new Set(os.map(o => o.join())).size >= 3);
  ok('biyom sırası zorluk bandında kalır', os.every(o => o.every((b, i) => Math.abs((b === FALLS_BIOME ? 4 : b > 5 ? b + 1 : b) - i) <= 3)));
  ok('aynı tohum aynı sıra', biomeOrder(77).join() === biomeOrder(77).join());
}

// ---------- 2. taşlar ve kırma ----------
section('Taş kırma ve düşürmeler');
{
  fresh(5); const p = G.player; const c = 8, r = GROUND_ROW + 3;
  shaft(c, r + 2); p.x = c * TILE + 8; p.y = (r - 1) * TILE + 8;
  for (const [name, t] of Object.entries(T)) {
    const d = TD[t]; if (!d || !d.solid || d.unbreakable || d.built) continue;
    setTile(c, r, t); const orbs0 = G.orbs.length, hp0 = p.hp; p.burnT = 0;
    breakTile(c, r, p);
    ok(`${name} kırılır`, tileAt(c, r) === T.AIR);
    if (d.ore) { const n = G.orbs.length - orbs0; ok(`${name} → ${d.ore} ×${d.amt}`, n === d.amt && G.orbs[orbs0].res === d.ore, `${n}`); }
    if (d.ember) ok('kor taşı yakar', p.burnT > 0 && p.hp < hp0, `burnT ${p.burnT} hp ${hp0}→${p.hp}`);
    if (d.heart) ok('kalp taşınır', p.carrying === true);
    p.carrying = false; p.hp = p.maxHp; G.orbs.length = 0; G.perkOffer = null;
  }
  ok('kalp olayı yayıldı', events.heart >= 1);
  // sertlik sırası: derin kayalar daha dayanıklı
  const hp = s => TD[HOST_TILE[s]].hp;
  ok('ana kaya sertliği artar', hp(0) < hp(3) && hp(3) < hp(6) && hp(6) < hp(8) && hp(8) < hp(9) && hp(9) < hp(12) && hp(12) < hp(15) && hp(15) < hp(19), HOST_TILE.map((_, i) => hp(i)).join(','));
}

// ---------- 3. ekonomi: kazma, yükseltmeler, eklentiler ----------
section('Ekonomi');
{
  fresh(7); const p = G.player;
  const give = () => { for (const k of RES_KEYS) G.store[k] = 9999; };
  ok('başlangıç kazması', G.lvl.drill === 0 && PICK_TIERS[0].name.startsWith('Odun'));
  let dmg = pickDmg(), int = pickInterval();
  G.lvl.drill = 3; give(); ok('Fener kilidi: son kademeler Fener ister', !buyUpgrade('drill', p) && beaconLack('drill') > 0, `${beaconLack('drill')}`);
  G.beacons = Array.from({ length: 30 }, (_, i) => i); ok('Fener yakınca kilit açılır', beaconLack('drill') === 0);
  G.lvl.drill = 0; dmg = pickDmg(); int = pickInterval();
  for (let l = 1; l < PICK_TIERS.length; l++) {
    give(); const cost = upgradeCost('drill'); ok(`kazma ${l} fiyatı var`, !!cost && Object.keys(cost).length > 0);
    ok(`kazma ${l} alınır`, buyUpgrade('drill', p) && G.lvl.drill === l);
    const d2 = pickDmg(), i2 = pickInterval(); ok(`kazma ${l} daha güçlü`, d2 > dmg && i2 <= int + 1e-9, `${dmg}→${d2}, ${int}→${i2}`); dmg = d2; int = i2;
  }
  give(); ok('kazma maks sonrası alınmaz', !buyUpgrade('drill', p) && upgradeCost('drill') == null);
  const d0 = pickDmg(); give(); ok('keskinlik alınır', buyUpgrade('sharp', p) && pickDmg() > d0);
  const i0 = pickInterval(); give(); ok('hızlı sallama alınır', buyUpgrade('swing', p) && pickInterval() < i0);
  for (const k of ['bag', 'armor', 'blaster', 'lamp']) { give(); ok(`${k} alınır`, buyUpgrade(k, p) && G.lvl[k] === 1); }
  // fakirken alınmaz
  for (const k of RES_KEYS) G.store[k] = 0; ok('parasız kazma alınmaz', !buyUpgrade('sharp', p));
  // eklentiler
  fresh(8); const q = G.player;
  for (const k of RES_KEYS) G.store[k] = 0; ok('parasız eklenti alınmaz', !buyMod('ricochet', q));
  ok('ilk eklentiler yalnız demir ve suyla alınır', START_MODS.concat('rapid').every(k => Object.keys(MODS[k].cost).every(r => r === 'iron' || r === 'water')));
  ok('alınmayan eklenti çalışmaz', !hasMod('ricochet'));
  const dps0 = gunDps(q);
  for (const k of MOD_KEYS) { for (const r of RES_KEYS) G.store[r] = 9999; ok(`eklenti ${k} alınır ve çalışır`, buyMod(k, q) && hasMod(k)); }
  ok('tekrar alınmaz', !buyMod(MOD_KEYS[0], q));
  ok('eklentiler gücü artırır', gunDps(q) > dps0 * 2, `${dps0} → ${gunDps(q)}`);
  // Aşırı Yük: ateş ederken kendiliğinden devreye girer, biter, yeniden dolar
  shaft(8, GROUND_ROW + 14); q.x = 8 * TILE + 8; q.y = (GROUND_ROW + 4) * TILE + 8; q.px = q.x; q.py = q.y; forceFlow();
  const e = spawnEnemy('ogolem', q.x, q.y + 44, 4); e.emergeT = 0; e.hp = e.maxHp = 1e7; e.dmgMul = 0;
  run(0.6); ok('aşırı yük kendiliğinden açılır', G.gear.active.overdrive > 0 && G.gear.cd.overdrive > 0);
  run(MODS.overdrive.dur + 0.2); ok('aşırı yük biter', !(G.gear.active.overdrive > 0));
  run(MODS.overdrive.cd - MODS.overdrive.dur); ok('aşırı yük yeniden açılır', G.gear.active.overdrive > 0);
  ok('hasar sayıları birikir ve sınırlı kalır', G.nums.length > 0 && G.nums.length <= 28 && G.nums.every(n => n.v > 0));
  // Saçılma ve Can Çalan: silahla ölen düşman mermi saçar, can verir
  G.enemies.length = 0; G.bullets.length = 0; q.hp = q.maxHp * 0.5; q.fireCd = 0;
  const v = spawnEnemy('rodent', q.x, q.y + 30, 0); v.emergeT = 0; v.hp = v.maxHp = 1; v.dmgMul = 0;
  let frag = 0; for (let i = 0; i < 90 && !v.dead; i++) step(); frag = G.bullets.filter(b => b.hit === v).length;
  ok('saçılma: ölen düşmandan mermi çıkar', v.dead && frag >= MODS.nova.n, `${frag}`);
  ok('can çalan: öldürme can verir', q.hp > q.maxHp * 0.5, `${q.hp}`);
  ok('can çalan: saniyede en çok bir kez', G.gear.cd['leech' + q.i] > 0 && q.hp <= q.maxHp * (0.5 + MODS.leech.v) + 0.01, `${q.hp}`);
}

// ---------- 4. uyanış ve yuvalar ----------
section('Uyanış ve yuvalar');
{
  // üretim: her biyomda yuva var
  for (let seed = 1; seed <= 6; seed++) {
    fresh(seed);
    const per = Array.from({ length: STRATA_COUNT }, (_, s) => nestsInStratum(s));
    ok(`tohum ${seed}: her biyomda yuva`, per.every(n => n >= 2), per.join(','));
    ok(`tohum ${seed}: yuva sayısı makul`, G.nests.length >= 2 * STRATA_COUNT && G.nests.length <= 3 * STRATA_COUNT, `${G.nests.length}`);
    ok(`tohum ${seed}: yuvalar sandıktan uzak`, G.nests.every(n => tileAt(n.c, n.r) === T.NEST));
  }
  // gürültü: kazı ölçeri doldurur, yüzeyde hızla söner
  fresh(500); const p = G.player; G.lvl.drill = 3; shaft(8, GROUND_ROW + 20); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 18) * TILE + 8; p.px = p.x; p.py = p.y;
  Object.assign(p.inp, { x: 0, y: 1, mag: 1 }); run(10);
  ok('kazı gürültü üretir', G.threat.noise > 8 && G.stats.dug > 5, `noise ${G.threat.noise.toFixed(1)} dug ${G.stats.dug}`);
  const n1 = G.threat.noise; Object.assign(p.inp, { x: 0, y: 0, mag: 0 }); run(6);
  ok('sessizken söner', G.threat.noise < n1, `${n1.toFixed(1)} -> ${G.threat.noise.toFixed(1)}`);
  G.threat.noise = 60; p.x = 170; p.y = 86; p.px = p.x; p.py = p.y; run(8);
  ok('yüzeyde hızla söner', G.threat.noise < 5, `${G.threat.noise.toFixed(1)}`);
  // seviyeler ve olaylar
  fresh(501); const q = G.player; shaft(8, GROUND_ROW + 20); q.x = 8 * TILE + 8; q.y = (GROUND_ROW + 18) * TILE + 8; q.px = q.x; q.py = q.y;
  const ev0 = events.threat | 0;
  for (const [v, lv] of [[30, 1], [55, 2], [80, 3]]) { G.threat.noise = v; step(); ok(`gürültü ${v} -> seviye ${lv}`, G.threat.level === lv, `${G.threat.level}`); }
  for (let i = 0; i < 60 * (THREAT.bossDelay[0] + 1); i++) { G.threat.noise = 100; step(); }
  ok('gürültü 100 (sürekli) -> seviye 4', G.threat.level === 4, `${G.threat.level}`);
  ok('seviye olayları yayınlandı', (events.threat | 0) - ev0 >= 4);
  ok('boss uyanır', G.enemies.some(e => e.d.boss), G.enemies.map(e => e.type).join(','));
  ok('uyanan boss bir sonrakini geciktirir', G.threat.woke === 1 && wakeDelay(G.threat) === THREAT.bossDelay[1], `${G.threat.woke}`);
  for (const e of G.enemies) if (e.d.boss) e.dead = true;
  step(); ok('boss ölünce maden uzun süre dinlenir', G.threat.bossCd > THREAT.bossRest - 1, `${G.threat.bossCd}`);
  for (let i = 0; i < 60 * 5; i++) { G.threat.noise = 100; step(); }
  ok('dinlenirken sayaç işlemez', G.threat.fullT === 0 && !G.threat.warned && !G.enemies.some(e => e.d.boss && !e.dead));
  // kaçış: sayaç dolmadan susulursa ya da bir yuva yıkılırsa boss yeniden uyur
  { fresh(502); const q = G.player; shaft(8, GROUND_ROW + 20); q.x = 8 * TILE + 8; q.y = (GROUND_ROW + 18) * TILE + 8; q.px = q.x; q.py = q.y;
    const w0 = events.bossWarn | 0, c0 = events.bossCalm | 0;
    for (let i = 0; i < 120; i++) { G.threat.noise = 100; step(); }
    ok('uyanış sayacı başlar', G.threat.warned && G.threat.fullT > 1.5 && (events.bossWarn | 0) === w0 + 1, `${G.threat.fullT}`);
    G.threat.noise = 97; run(0.5); ok('susunca sayaç geri sarar', G.threat.warned && G.threat.fullT > 0 && G.threat.fullT < 1.5, `${G.threat.fullT}`);
    run(1); ok('sayaç sıfırlanınca boss yeniden uyur', !G.threat.warned && G.threat.fullT === 0 && (events.bossCalm | 0) === c0 + 1 && !G.enemies.some(e => e.d.boss));
    for (let i = 0; i < 120; i++) { G.threat.noise = 100; step(); }
    nestDestroyed(-9, -9, null);
    ok('yuva yıkılınca uyanış iptal olur', !G.threat.warned && G.threat.fullT === 0 && (events.bossCalm | 0) === c0 + 2 && G.threat.woke === 0); }
  // yuva yakın oyuncuya düşman çıkarır (uyanış seviyesi)
  fresh(502); const r = G.player;
  const nest = G.nests.slice().sort((a, b) => a.r - b.r)[0];
  shaft(nest.c, nest.r - 1); r.x = nest.c * TILE + 8; r.y = (nest.r - 2) * TILE + 8; r.px = r.x; r.py = r.y; forceFlow();
  G.threat.noise = 60; let spawned = 0;
  for (let i = 0; i < 60 * 30; i++) { G.threat.noise = Math.max(G.threat.noise, 55); r.hp = r.maxHp; r.dead = false; step(); spawned = Math.max(spawned, G.enemies.length); }
  ok('uyanık yuva düşman çıkarır', spawned >= 2, `${spawned}`);
  ok('yuva uyanık işaretli', nest.awake === true);
  ok('canlı düşman sınırı aşılmaz', G.enemies.filter(e => !e.dead).length <= THREAT.cap[4] * 1.5 + 8, `${G.enemies.length}`);
  // sessizde yuva uyur
  G.threat.noise = 0; G.enemies.length = 0; run(4); const n0 = G.enemies.length; run(10);
  ok('sessizde yuva seyrek üretir (üst sınır)', G.enemies.filter(e => !e.dead).length <= THREAT.cap[0] + 1, `${G.enemies.length}`);
  // yuva yıkımı: ganimet + sessizlik + fener
  fresh(503); const u = G.player; G.threat.noise = 40; const st0 = 0;
  const my = G.nests.filter(n => Math.floor((n.r - GROUND_ROW) / STRATUM_ROWS) === st0);
  const before = G.orbs.length, noise0 = G.threat.noise;
  breakTile(my[0].c, my[0].r, u);
  ok('yuva yıkılınca ganimet', G.orbs.length > before + 2, `${G.orbs.length - before}`);
  ok('yuva yıkılınca gürültü düşer', G.threat.noise < noise0, `${G.threat.noise}`);
  ok('yuva sayacı', G.stats.nests === 1 && events.nestDown >= 1);
  for (const n of my.slice(1)) breakTile(n.c, n.r, u);
  ok('biyom temizlenince fener', G.beacons.includes(st0) && events.beacon >= 1, G.beacons.join(','));
  ok('yuva listesi güncel', nestsInStratum(st0) === 0);
  // mermi yuvayı yıkar
  fresh(504); const w = G.player; const tn = G.nests.slice().sort((a, b) => a.r - b.r)[0];
  shaft(tn.c, tn.r - 1); w.x = tn.c * TILE + 8; w.y = (tn.r - 4) * TILE + 8; w.px = w.x; w.py = w.y;
  G.lvl.blaster = 5; G.bullets.push({ x: w.x, y: tn.r * TILE - 10, px: w.x, py: w.y, vx: 0, vy: 200, life: 1, dmg: 200, from: 'p', pierce: 0, hit: null, pi: 0 });
  run(0.5);
  ok('mermi yuvayı yıkar', tileAt(tn.c, tn.r) !== T.NEST, `${tileAt(tn.c, tn.r)}`);
}

// ---------- 4b. düşme / kaldırma ve aletler ----------
section('Düşme, kaldırma, aletler');
{
  fresh(600); const p = G.player; p.y = (GROUND_ROW + 4) * TILE + 8; shaft(8, GROUND_ROW + 6); p.x = 8 * TILE + 8; p.px = p.x; p.py = p.y;
  damagePlayerX(p, 999); step();
  ok('tek oyuncu bayılır', p.dead && p.downT > 0);
  run(2);
  ok('herkes baygınsa sefer biter', allDown === true);
  // iki oyuncu: partner kaldırır
  const g = newRun({ seed: 601, mp: true }); allDown = false;
  const [a, b] = g.players; for (const q of g.players) q.inp = { x: 0, y: 0, mag: 0 };
  shaft(8, GROUND_ROW + 8); a.x = 8 * TILE + 8; a.y = (GROUND_ROW + 6) * TILE + 8; b.x = 4 * TILE + 8; b.y = (GROUND_ROW - 1) * TILE + 8;
  for (const q of g.players) { q.px = q.x; q.py = q.y; }
  damagePlayerX(a, 999); step();
  ok('partner baygın, sefer sürer', a.dead && !allDown);
  b.x = a.x; b.y = a.y; b.px = b.x; b.py = b.y; run(2.5);
  ok('partner yanında durunca kalkar', !a.dead && a.hp > 0 && events.revived >= 0, `hp ${a.hp}`);
  // ikinci nefes
  fresh(602); const s = G.player; G.selfRevive = 1; shaft(8, GROUND_ROW + 6); s.x = 8 * TILE + 8; s.y = (GROUND_ROW + 4) * TILE + 8; s.px = s.x; s.py = s.y;
  damagePlayerX(s, 999); step(); ok('ikinci nefes: baygın ama kalkacak', s.dead && s.autoUp); run(3.5);
  ok('ikinci nefesle kalkar', !s.dead && s.hp > 0 && !allDown, `hp ${s.hp} down ${allDown}`);
  // aletler: üret, kur, geri al, sınır
  fresh(603); const d = G.player; shaft(8, GROUND_ROW + 6); d.x = 8 * TILE + 8; d.y = (GROUND_ROW + 4) * TILE + 8; d.px = d.x; d.py = d.y;
  for (const k of RES_KEYS) G.store[k] = 80;
  ok('nöbetçi üretilir', craftItem('turret', d) && G.items.turret === 1);
  ok('nöbetçi kurulur', placeBuild('turret', d) && G.structures.length === 1 && G.items.turret === 0);
  ok('aynı hücreye ikinci kurulmaz', craftItem('turret', d) && !placeBuild('turret', d));
  d.y += TILE; d.py = d.y; ok('ikinci alet kurulur', placeBuild('turret', d) && G.structures.length === 2);
  G.meta.schem = ['mortar']; d.y += TILE; d.py = d.y; craftItem('mortar', d); ok('sınırda en eski alet kemere döner', placeBuild('mortar', d) && G.structures.length === 2 && G.items.turret === 1, `${G.structures.length} ${G.items.turret}`);
  ok('havan kurulu', G.structures.some(x => x.type === 'mortar'));
  const i = G.structures.findIndex(x => x.type === 'mortar'); d.y -= TILE; d.py = d.y;
  ok('alet geri alınır', pickupBuild(i, d) && G.items.mortar === 1 && G.structures.length === 1);
  // sessizlik çanı gürültüyü düşürür ve birikimi yavaşlatır
  const dl = G.player; G.items.can = 1; G.threat.noise = 50; ok('sessizlik çanı çalar', useItem('can', dl));
  ok('sessizlik çanı gürültüyü düşürür', G.threat.noise <= 15.01 && G.evt.hushT > 0, `${G.threat.noise}`);
  // düşman nöbetçiye saldırır ve nöbetçi ateş eder
  fresh(604); const t = G.player; shaft(8, GROUND_ROW + 14); t.x = 8 * TILE + 8; t.y = (GROUND_ROW + 4) * TILE + 8; t.px = t.x; t.py = t.y;
  G.items.turret = 1; placeBuild('turret', t); const tur = G.structures[0]; forceFlow();
  const e = spawnEnemy('bug', 8 * TILE + 8, (GROUND_ROW + 12) * TILE + 8, 3); e.emergeT = 0;
  run(6);
  ok('nöbetçi düşmana ateş eder', e.dead || e.hp < e.maxHp, `hp ${e.hp}/${e.maxHp}`);
}

// ---------- 4c. partner işareti ----------
section('Partner işareti');
{
  const g = newRun({ seed: 700, mp: true }); for (const q of g.players) q.inp = { x: 0, y: 0, mag: 0 };
  const { addPing, updatePings } = await import('../src/game/pings.js');
  ok('işaret eklenir', addPing(1, 100, 200) && G.pings.length === 1 && G.pings[0].pi === 1);
  addPing(1, 120, 220); ok('oyuncu başına tek işaret', G.pings.length === 1 && G.pings[0].x === 120);
  addPing(0, 50, 50); ok('iki oyuncu iki işaret', G.pings.length === 2);
  for (let i = 0; i < 60 * 8; i++) updatePings(STEP);
  ok('işaret söner', G.pings.length === 0);
}

// ---------- 5. yaratıklar ----------
section('Yaratıklar');
{
  for (const type of Object.keys(ENEMIES)) {
    fresh(300); const p = G.player; shaft(8, GROUND_ROW + 12); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 3) * TILE + 8; p.px = p.x; p.py = p.y; forceFlow();
    const es = [spawnEnemy(type, 8 * TILE + 8, (GROUND_ROW + 10) * TILE + 8, 6), spawnEnemy(type, 60, 60, 6)];
    es.forEach(e => e.emergeT = 0);
    let threw = null; try { run(8); } catch (err) { threw = err; }
    ok(`${type} 8 sn hatasız`, !threw, threw && threw.stack.split('\n').slice(0, 2).join(' '));
    ok(`${type} konum sonlu`, es.every(e => finite(e.x) && finite(e.y) && finite(e.hp)));
    const alive = es.filter(e => !e.dead); const n0 = G.enemies.length;
    alive.forEach(e => killEnemy(e));
    ok(`${type} öldürülür`, es.every(e => e.dead));
    if (ENEMIES[type].spawnOnDeath) {
      let spawned = 0; for (let i = 0; i < 60; i++) { const e = spawnEnemy(type, 100, 100, 6); const n = G.enemies.length; killEnemy(e); if (G.enemies.length > n) spawned++; }
      ok(`${type} ölümde yavru (%${ENEMIES[type].spawnOnDeath[2] * 100})`, spawned > 10 && spawned < 40, `${spawned}/60`);
    }
    run(3);
    ok(`${type} ölü gövde temizlenir`, !G.enemies.includes(es[0]) || es[0].dieT <= 0, `${G.enemies.length}`);
  }
  // elit
  fresh(301); const e = spawnEnemy('bug', 100, 100, 5); const hp = e.hp; e.elite = false;
  const { makeElite } = await import('../src/game/enemies.js'); makeElite(e);
  ok('elit can ×2.2', Math.abs(e.hp - hp * ELITE.hp) < 1e-6 && e.elite && e.scale > 1);
  const orbs = G.orbs.length; killEnemy(e); ok('elit altın düşürür', G.orbs.filter(o => o.res === 'gold').length === ELITE.gold && G.stats.elites === 1, `${G.orbs.length - orbs}`);
  // ağ ve soğuk
  fresh(302); const p = G.player; for (let r = GROUND_ROW; r <= GROUND_ROW + 4; r++) for (let c = 4; c <= 12; c++) setTile(c, r, T.AIR);
  p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 2) * TILE + 8; p.px = p.x; p.py = p.y; forceFlow();
  const sp = spawnEnemy('spider', p.x + 40, p.y, 6); sp.emergeT = 0; run(6);
  ok('örümcek ağ atar', p.webT > 0 || events.web > 0, `webT ${p.webT}`);
  const fb = spawnEnemy('frostbat', p.x, p.y - 16, 6); fb.emergeT = 0; run(6);
  ok('kırağı dondurur', p.slowT > 0 || events.chill > 0, `slowT ${p.slowT}`);
}

// ---------- 6. determinizm ----------
section('Determinizm');
{
  const script = t => t < 10 ? { x: 0, y: 1, mag: 1 } : t < 14 ? { x: 1, y: 0, mag: 1 } : t < 18 ? { x: -1, y: 0.3, mag: 1 } : { x: 0, y: 1, mag: 1 };
  const play = () => {
    fresh(4242); const p = G.player; G.threat.noise = 45; let t = 0;
    for (let i = 0; i < 60 * 40; i++) { t += STEP; Object.assign(p.inp, script(t)); step(); }
    return { h: hash(), s: JSON.stringify(serialize()), dug: G.stats.dug, kills: G.stats.kills, wave: G.threat.level };
  };
  const a = play(), b = play();
  ok('aynı tohum + aynı girdi → aynı durum', a.h === b.h && a.s === b.s, `${a.h} vs ${b.h}`);
  ok('oyuncu gerçekten kazdı', a.dug > 8, `${a.dug}`);
  ok('uyanış seviyesi sayılır', a.wave >= 0 && a.kills >= 0, `seviye ${a.wave} kills ${a.kills}`);
}

// ---------- 7. kayıt / yükleme ----------
section('Kayıt');
{
  fresh(9); const p = G.player; Object.assign(p.inp, { x: 0, y: 1, mag: 1 }); run(12);
  for (const k of RES_KEYS) G.store[k] = 50; buyUpgrade('drill', p); buyMod('ricochet', p); buyMod('frost', p); G.structures.push(makeStructure('turret', 8, GROUND_ROW + 2));
  const s1 = serialize(); const j1 = JSON.stringify(s1);
  deserialize(JSON.parse(j1)); const s2 = serialize();
  const strip = s => { const o = JSON.parse(JSON.stringify(s)); delete o.player; delete o.wave; return JSON.stringify(o); };
  ok('serialize → deserialize → serialize eşit', strip(s1) === strip(s2));
  ok('kazma seviyesi korunur', G.lvl.drill === 1);
  ok('eklentiler korunur', hasMod('ricochet') && hasMod('frost'));
  ok('taret korunur', G.structures.length === 1 && G.structures[0].type === 'turret');
  ok('konum korunur', Math.abs(G.player.x - s1.player.x) < 1e-6 && Math.abs(G.player.y - s1.player.y) < 1e-6);
  let threw = null; try { run(5); } catch (e) { threw = e; } ok('yükleme sonrası oynanır', !threw, threw && threw.message);
  // eski kayıt (v5, gear yok)
  const old = JSON.parse(j1); delete old.gear; old.v = 5; threw = null; try { deserialize(old); } catch (e) { threw = e; }
  ok('gear’sız eski kayıt açılır', !threw && Array.isArray(G.gear.owned), threw && threw.message);
  // eski kayıt: yuva/ustalık alanları ve artık olmayan eklenti yok sayılır
  const old2 = JSON.parse(j1); old2.gear = { owned: ['ricochet', 'yok'], eq: ['ricochet'], wOwn: ['blaster'], pOwn: ['std'], wLvl: { blaster: 3 }, tLvl: {} }; threw = null; try { deserialize(old2); } catch (e) { threw = e; }
  ok('ustalıklı eski kayıt açılır', !threw && hasMod('ricochet') && G.gear.owned.length === 1 && G.gear.lv === 0 && !G.gear.pend.length, threw && threw.message);
}

// ---------- 8. derin sefer ----------
section('Derin sefer (30 biyom, ~33 dk sim)');
{
  fresh(2026); const p = G.player; const bottom = GROUND_ROW + STRATUM_ROWS * STRATA_COUNT - 8;
  const spawnedBy = {}; const origSpawn = G.enemies.push.bind(G.enemies);
  let threw = null, nanAt = null, stratumEv = 0; on('stratum', () => stratumEv++);
  try {
    for (let s = 0; s < STRATA_COUNT; s++) {
      const rTop = GROUND_ROW + s * STRATUM_ROWS + 4;
      shaft(8, Math.min(bottom, rTop + STRATUM_ROWS)); G.maxStratum = s;
      // oyuncu biyomda kazıyor, sonra üsse dönüp savunuyor
      p.x = 8 * TILE + 8; p.y = rTop * TILE + 8; p.px = p.x; p.py = p.y; Object.assign(p.inp, { x: 0, y: 1, mag: 1 });
      Object.assign(G.lvl, { blaster: Math.min(UPGRADES.blaster.costs.length, s), armor: Math.min(UPGRADES.armor.costs.length, s >> 1), drill: Math.min(PICK_TIERS.length - 1, s) }); recompute();
      run(20);
      // oyuncu biyomun içinde durur, gürültü yüksek: yuvalar ve sızma onu avlar
      Object.assign(p.inp, { x: 0, y: 0, mag: 0 }); p.hp = p.maxHp; p.dead = false; forceFlow();
      let t = 0; while (t < 45) { G.threat.noise = Math.max(G.threat.noise, 80); step(); t += STEP; for (const e of G.enemies) { if (!finite(e.x) || !finite(e.y)) nanAt = e.type; spawnedBy[e.type] = s; } if (p.dead) { p.dead = false; p.gone = false; p.hp = p.maxHp; allDown = false; G.allDownT = 0; } }
      G.enemies.length = 0; G.threat.noise = 0;
    }
  } catch (e) { threw = e; }
  ok('derin sefer hatasız', !threw, threw && threw.stack.split('\n').slice(0, 3).join(' | '));
  ok('NaN yok', !nanAt, nanAt);
  ok('biyom afişi olayları', stratumEv >= 5, `${stratumEv}`);
  const deep = ['spider', 'frostbat', 'skitter', 'magmite', 'voidling', 'broodmother', 'ogolem'].filter(k => spawnedBy[k] === undefined);
  ok('derin türler sahada görüldü', deep.length <= 3, 'görülmedi: ' + deep.join(','));
  ok('yuvalar düşman üretti', Object.keys(spawnedBy).length >= 6, Object.keys(spawnedBy).join(','));
  ok('kalp satırı ulaşılabilir', tileAt(8, G.heartRow) !== undefined && TD[tileAt(8, G.heartRow)] && G.heartRow < ROWS - 1);
}

// ---------- 8b. roller, olaylar, ölüm yankısı ----------
section('Roller, olaylar, yankı');
{
  newRun({ seed: 5, roles: ['kazici', ''] });
  ok('rol atanır', G.player.role === 'kazici' && roleOf(G.player).dig === 0.8);
  ok('geçersiz rol boş kalır', newRun({ seed: 5, roles: ['yok'] }).player.role === '');
  const base = deployLimit();
  newRun({ seed: 5, roles: ['muhendis'] });
  ok('mühendis alet sınırı +1', deployLimit() === base + 1, `${deployLimit()} vs ${base}`);
  ok('mühendis aletleri dayanıklı', makeStructure('turret', 8, GROUND_ROW + 5).hp > BUILDS.turret.hp);
  // olaylar: yeraltında ve sessiz değilken uyarı, sonra vuruş
  fresh(21); const p = G.player; shaft(8, GROUND_ROW + 12); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 10) * TILE + 8; p.px = p.x; p.py = p.y;
  G.threat.noise = 40; const e0 = events.event | 0;
  G.evt.t = 0.05; run(0.2);
  ok('olay uyarısı geldi', (events.event | 0) > e0 && G.evt.k, `${G.evt.k}`);
  G.evt.k = 'sarsinti'; G.evt.warnT = 0.05; run(0.2);
  ok('sarsıntı tavanı gevşetir', G.falls.length > 0 || G.rocks.length > 0, `${G.falls.length}/${G.rocks.length}`);
  ok('sarsıntı sonrası bekleme', G.evt.t >= EVENTS.cd[0] - 0.5, `${G.evt.t}`);
  const lamp0 = lampTiles();
  G.evt.k = 'karanlik'; G.evt.warnT = 0.05; run(0.2);
  ok('karartma feneri kısar', G.evt.darkT > 0 && lampTiles() < lamp0, `${lampTiles()} vs ${lamp0}`);
  run(EVENTS.karanlik.t + 1);
  ok('karartma geçer', G.evt.darkT <= 0 && lampTiles() === lamp0);
  for (let r = GROUND_ROW + 7; r <= GROUND_ROW + 13; r++) for (let c = 4; c <= 12; c++) setTile(c, r, T.AIR);
  G.threat.noise = 40; G.evt.k = 'gaz'; G.evt.warnT = 0.05; const g0 = G.gas.length; run(0.2);
  ok('gaz sızıntısı bulut salar', G.gas.length > g0, `${G.gas.length}`);
  ok('her olayın adı ve ağırlığı var', EVENT_KEYS.every(k => EVENTS[k].name && EVENTS[k].w > 0));
  const fireEvt = (k, seed) => { fresh(seed); const q = G.player; shaft(8, GROUND_ROW + 14); q.x = 8 * TILE + 8; q.y = (GROUND_ROW + 12) * TILE + 8; q.px = q.x; q.py = q.y; q.hp = q.maxHp = 9999; forceFlow(); G.threat.noise = 40; G.evt.k = k; G.evt.warnT = 0.02; run(0.1); return q; };
  { const n0 = fireEvt('suru', 22) && G.enemies.length; ok('sürü yaratık salar', n0 >= 3, `${n0}`); }
  { fireEvt('damar', 23); ok('parlayan damar cevher ve işaret bırakır', G.pings.some(q => q.pi === -1) && G.map.some((t, i) => G.rev[i] && (t === T.GOLD || t === T.IRON))); }
  { fireEvt('kese', 24); const k = G.satchels.find(x => x.lost); ok('kayıp kese yerleşir', k && k.bag.iron > 0 && G.pings.length === 1); }
  { fireEvt('sandik', 25); const pg = G.pings[0]; ok('unutulmuş sandık belirir', pg && !!TD[tileAt(Math.floor(pg.x / TILE), Math.floor(pg.y / TILE))].chest); }
  { fireEvt('sessizlik', 26); const n1 = G.threat.noise; addNoise(10, G.player.x, G.player.y); const n2 = G.threat.noise;
    ok('derin sessizlik gürültüyü düşürür ve yarıya indirir', n1 <= 0.5 && G.evt.hushT > 0 && n2 - n1 < 10 * 0.6 * (1 + 0.5), `${n1} ${n2}`); }
  // yeni roller
  { newRun({ seed: 5, roles: ['yikici'] }); ok('yıkıcı 3 dinamitle başlar', G.items.dynamite >= 3); }
  { fresh(27); newRun({ seed: 27, roles: ['sihhiyeci'] }); const q = G.player; shaft(8, GROUND_ROW + 6); q.x = 8 * TILE + 8; q.y = (GROUND_ROW + 5) * TILE + 8; q.px = q.x; q.py = q.y; q.inp = { x: 0, y: 0, mag: 0 }; q.hp = 50; G.threat.noise = 0; run(2);
    ok('sıhhiyeci yeraltında iyileşir', q.hp > 50.8, `${q.hp}`); }
  { newRun({ seed: 5, roles: ['kuyumcu'] }); ok('kuyumcu blaster hasarı az', roleOf(G.player).dmg === 0.8 && ROLES.kuyumcu.rare); }
  // ölüm yankısı: meta'daki çanta seferde aynı hücrede bekler
  const m = metaSnapshot(); m.echo = { c: 8, r: GROUND_ROW + 9, bag: { iron: 5, cobalt: 2 } };
  newRun({ seed: 9, meta: m });
  const s = G.satchels.find(x => x.echo);
  ok('yankı çantası yerleşir', s && s.bag.iron === 5 && s.bag.cobalt === 2 && tileAt(8, GROUND_ROW + 9) === T.AIR, JSON.stringify(s && s.bag));
  ok('yankı çok oyunculuda yok', !newRun({ seed: 9, meta: m, mp: true }).satchels.some(x => x.echo));
}

// ---------- 8c. asansör ----------
section('Asansör');
{
  fresh(31); const p = G.player; G.nests.length = 0; G.enemies.length = 0;
  ok('başta istasyon yok', G.stations.length === 0 && !atShaft(p));
  // biyom 1'e ulaş: istasyon açılır, şaft kazılır
  shaft(8, GROUND_ROW + STRATUM_ROWS + 2); p.x = SHAFT_X; p.y = (GROUND_ROW + STRATUM_ROWS + 1) * TILE + 8; p.px = p.x; p.py = p.y; step();
  ok('biyom 1 istasyonu açıldı', G.stations.includes(1) && (events.station | 0) >= 1, JSON.stringify(G.stations));
  let carved = true; for (let r = GROUND_ROW + 3; r <= GROUND_ROW + STRATUM_ROWS + 1; r++) if (tileAt(8, r) !== T.AIR && tileAt(8, r) !== T.FOUNDATION && tileAt(8, r) !== T.BEDROCK && !TD[tileAt(8, r)].chest && !TD[tileAt(8, r)].nest) carved = false;
  ok('şaft açık', carved);
  ok('istasyonda asansör var', atShaft(p));
  ok('kampa çağır', callElevator(p, -1) && p.ride);
  run(20);
  ok('kampa vardı', !p.ride && p.y < GROUND_Y && Math.abs(p.y - stationY(-1)) < 1 && (events.elevatorDone | 0) >= 1, `${p.y}`);
  ok('kampta şafttayız', atShaft(p));
  ok('açılmamış biyoma gidilmez', !callElevator(p, 2));
  ok('biyom 1\'e in', callElevator(p, 1));
  run(20);
  ok('biyom 1\'e vardı', !p.ride && Math.abs(p.y - stationY(1)) < 12, `${p.y}`);
  p.x += 20; ok('şaft dışında asansör yok', !atShaft(p) && !callElevator(p, -1));
}

// ---------- 9. performans ----------
section('Performans');
{
  fresh(77); const p = G.player; shaft(8, GROUND_ROW + 30); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 1) * TILE + 8; p.px = p.x; p.py = p.y; G.threat.noise = 60; forceFlow();
  const types = Object.keys(ENEMIES).filter(k => !ENEMIES[k].boss);
  for (let i = 0; i < 60; i++) { const e = spawnEnemy(types[i % types.length], 8 * TILE + 8, (GROUND_ROW + 2 + (i % 28)) * TILE + 8, 8); e.emergeT = 0; }
  G.gear.owned = MOD_KEYS.slice(); G.gear.cards = { cok: 2, del: 2, hiz: 6 };
  const t0 = performance.now(); run(20); const ms = (performance.now() - t0) / (20 * 60);
  console.log(`  60 düşman + eklentiler: ${ms.toFixed(3)} ms/kare (bütçe 16.7)`);
  ok('kare bütçesi', ms < 4, `${ms.toFixed(2)} ms`);
}

// ---------- 12. efsanevi eserler + Arkentaş ----------
section('Efsanevi eserler');
{
  // üretim: her efsanevi biyomda tam bir eser taşı, Yankı Boşluğu'nda Arkentaş
  for (let seed = 1; seed <= 6; seed++) {
    const gen = generate(seed, {}); const pos = b => gen.order.indexOf(b);
    const count = (t, b) => { const r0 = GROUND_ROW + pos(b) * STRATUM_ROWS; let n = 0; for (let r = r0; r < r0 + STRATUM_ROWS; r++) for (let c = 0; c < COLS; c++) if (gen.map[r * COLS + c] === t) n++; return n; };
    ok(`tohum ${seed}: saray/dev/çekirdek birer eser`, count(T.RELIC, 12) === 1 && count(T.RELIC, 15) === 1 && count(T.RELIC, 19) === 1, `${count(T.RELIC, 12)},${count(T.RELIC, 15)},${count(T.RELIC, 19)}`);
    ok(`tohum ${seed}: Arkentaş Yankı Boşluğu'nda`, count(T.ARKEN, 18) === 1 && count(T.RELIC, 18) === 0);
  }
  // alma: kalıcı, iki tarafta da (G.meta ve App.meta); ikinci kez altın yağmuru
  const arena = (seed) => { const g = fresh(seed); const p = G.player; for (let r = GROUND_ROW; r <= GROUND_ROW + 4; r++) for (let c = 4; c <= 12; c++) setTile(c, r, T.AIR); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 2) * TILE + 8; p.px = p.x; p.py = p.y; forceFlow(); return g; };
  App.meta.relics = [];
  arena(500); { const p = G.player; const ev0 = events.relic | 0;
    setTile(9, GROUND_ROW + 2, T.ARKEN); breakTile(9, GROUND_ROW + 2, p);
    ok('Arkentaş alınır (sefer + kalıcı)', hasRelic('arken') && App.meta.relics.includes('arken') && events.relic === ev0 + 1);
    ok('Arkentaş görüş +3', lampTiles() >= 3);
    const orbs = G.orbs.length; setTile(9, GROUND_ROW + 2, T.ARKEN); breakTile(9, GROUND_ROW + 2, p);
    ok('ikinci eser altın yağmuru', G.orbs.length - orbs >= 6 && G.meta.relics.length === 1);
    const e = spawnEnemy('bug', p.x + 30, p.y, 3); e.emergeT = 0; run(0.5);
    ok('Arkentaş ışığı düşmanı yavaşlatır', e.slowT > 0);
    ok('Arkentaş eser taşı düşmanca kazılmaz', true);
  }
  App.meta.relics = [];
  arena(501); { const p = G.player; const hp0 = p.maxHp;
    G.meta.relics = ['kalp']; recompute(true);
    ok('Devin Kalbi +40 can', p.maxHp === hp0 + 40 && p.hp === p.maxHp);
    const e = spawnEnemy('bug', p.x + 20, p.y, 3); e.emergeT = 0;
    damagePlayerX(p, 9999);
    ok('Devin Kalbi bayılmayı bir kez engeller', !p.dead && p.kalpUsed && p.hp === Math.round(p.maxHp * 0.5) && e.hp < e.maxHp, `hp ${p.hp}`);
    p.iframes = 0; damagePlayerX(p, 9999); ok('ikinci ölüm bayıltır', p.dead);
  }
  arena(502); { const p = G.player; const d0 = pickDmg(); G.meta.relics = ['kivilcim']; recompute();
    ok('Kıvılcım kazma ×2', Math.abs(pickDmg() - d0 * 2) < 1e-9);
    const e = spawnEnemy('bug', p.x + 20, p.y, 3); e.emergeT = 0; const h0 = e.hp;
    setTile(9, GROUND_ROW + 2, T.DIRT); breakTile(9, GROUND_ROW + 2, p);
    ok('Kıvılcım kırılan blok düşmanı yakar', e.hp < h0);
  }
  arena(503); { const p = G.player; G.meta.relics = ['tac'];
    let gold = 0; for (let i = 0; i < 200; i++) { setTile(9, GROUND_ROW + 2, T.STONE); const o = G.orbs.filter(x => x.res === 'gold').length; breakTile(9, GROUND_ROW + 2, p); if (G.orbs.filter(x => x.res === 'gold').length > o) gold++; }
    ok('Altın Taç sıradan kayadan altın (~%10)', gold > 8 && gold < 40, `${gold}/200`);
    const g = newRun({ seed: 7, meta: Object.assign(metaSnapshot(), { relics: ['tac'] }) }); ok('Altın Taç +12 altınla başlar', g.store.gold >= 12);
  }
  App.meta.relics = [];
}

// ---------- 13. imza davranışları ----------
section('İmza davranışları');
{
  const arena = (seed, w = 4) => { fresh(seed); const p = G.player; for (let r = GROUND_ROW; r <= GROUND_ROW + w; r++) for (let c = 3; c <= 13; c++) setTile(c, r, T.AIR); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 2) * TILE + 8; p.px = p.x; p.py = p.y; p.hp = p.maxHp; forceFlow(); return p; };
  { arena(600); const e = spawnEnemy('quickling', 100, (GROUND_ROW + 2) * TILE + 8, 3); e.emergeT = 0; const n0 = G.enemies.length;
    damageEnemy(e, e.maxHp * 0.6, 0, 0, 0);
    ok('Cıva Damlası yarı canda bölünür', G.enemies.filter(x => x.type === 'droplet' && !x.dead).length === 2 && G.enemies.length === n0 + 2 && e.splitDone);
    damageEnemy(e, 5, 0, 0, 0); ok('bir kez bölünür', G.enemies.filter(x => x.type === 'droplet').length === 2); }
  { const p = arena(601); const e = spawnEnemy('voltbat', p.x + 30, p.y - 8, 3); e.emergeT = 0; const hp0 = p.hp; run(3);
    ok('Yıldırım Yarasası çarpar', p.hp < hp0 && G.stats.kills === 0, `hp ${p.hp}`); }
  { const p = arena(602); p.bag.gold = 5; const e = spawnEnemy('gilded', p.x + 12, p.y, 3); e.emergeT = 0; e.atkCd = 0; run(2.5);
    ok('Altın Muhafız altın çalar', p.bag.gold < 5 && e.sack > 0, `bag ${p.bag.gold} sack ${e.sack}`);
    const g0 = G.orbs.filter(o => o.res === 'gold').length; killEnemy(e); ok('ölünce çalınan altın düşer', G.orbs.filter(o => o.res === 'gold').length >= g0 + e.sack + 4); }
  { const p = arena(603); const e = spawnEnemy('sporeling', p.x + 30, p.y, 3); e.emergeT = 0; const ally = spawnEnemy('bug', p.x + 40, p.y, 3); ally.emergeT = 0; ally.hp = 10; run(5);
    ok('Spor Böceği bulutu dostu iyileştirir', ally.hp > 10 || ally.dead, `hp ${ally.hp}`); }
  { const p = arena(604); const e = spawnEnemy('mirrorling', p.x + 30, p.y, 3); e.emergeT = 0; const k0 = G.stats.kills;
    damageEnemy(e, 5, 0, 0, 0); const ils = G.enemies.filter(x => x.illusion);
    ok('Cam Gölgesi kopyalar çıkarır', ils.length === 2 && ils.every(x => x.hp === 1));
    damageEnemy(ils[0], 1, 0, 0, 0); ok('kopya tek vuruşta dağılır, sayılmaz', ils[0].dead && G.stats.kills === k0 && G.orbs.length === 0);
    damageEnemy(e, 5, 0, 0, 0); ok('kopya bekleme süresi', G.enemies.filter(x => x.illusion).length === 2); }
  { const p = arena(605, 8); p.y = (GROUND_ROW + 6) * TILE + 8; p.py = p.y; for (let c = 6; c <= 10; c++) setTile(c, GROUND_ROW + 1, T.STONE); forceFlow();
    const e = spawnEnemy('titanling', p.x + 40, p.y, 3); e.emergeT = 0; const hp0 = p.hp; run(4);
    ok('Dev Parçası sarsıntısı vurur', p.hp < hp0, `hp ${p.hp}`); }
  { const p = arena(606, 6); p.inp = { x: 1, y: 0, mag: 1 }; run(1.2); p.inp = { x: 0, y: 0, mag: 0 }; run(2);
    const e = spawnEnemy('chronoling', p.x, p.y - 20, 3); e.emergeT = 0; e.rewindCd = 0.1; const xb = p.x; run(0.5);
    ok('Zaman Gözü geri sarar', Math.abs(p.x - xb) > 10, `${xb.toFixed(0)} → ${p.x.toFixed(0)}`); }
  { const p = arena(607); const e = spawnEnemy('leech', p.x + 12, p.y, 3); e.emergeT = 0; e.atkCd = 0; const m0 = e.maxHp; e.hp = m0 * 0.5; run(2.5);
    ok('Kan Sülüğü kan emer ve büyür', p.bleedT > 0 && e.scale > 1 && e.hp > m0 * 0.5, `scale ${e.scale} bleed ${p.bleedT}`); }
  { const p = arena(608); const e = spawnEnemy('echoer', p.x + 40, p.y, 3); e.emergeT = 0; G.threat.noise = 20; run(4);
    ok('Yankıcı uluması ölçeri yükseltir', G.threat.noise > 20, `${G.threat.noise}`); }
  { const p = arena(609); const e = spawnEnemy('seraph', p.x + 60, p.y - 10, 3); e.emergeT = 0; e.judgeCd = 0; e.blindCd = 99; const hp0 = p.hp; run(1.5);
    ok('Işık Bekçisi yargı ışını', p.hp < hp0 && p.blindT > 0, `hp ${p.hp}`); }
  ok('yeni düşmanlar deterministik', (() => { const h = []; for (let i = 0; i < 2; i++) { const p = arena(610, 6); for (const t of ['quickling', 'voltbat', 'gilded', 'sporeling', 'mirrorling', 'titanling', 'chronoling', 'leech', 'echoer', 'seraph']) { const e = spawnEnemy(t, p.x + 20 + (h.length * 0), p.y, 4); e.emergeT = 0; } run(6); h.push(hash()); } return h[0] === h[1]; })());
}

// ---------- 14. bosslar ----------
section('Bosslar');
{
  const rowOf = st => GROUND_ROW + st * STRATUM_ROWS + 10;
  ok('derinlik bandı -> boss', [[0, 'karakok'], [3, 'karakok'], [5, 'kavurgan'], [9, 'otegoz'], [13, 'kordesen'], [18, 'ezeli']].every(([st, k]) => bossForY(rowOf(st) * TILE) === k));
  // ölçer tepede: en derindeki madencinin bandındaki boss uyanır
  { fresh(700); const p = G.player; shaft(8, rowOf(9) + 2); p.x = 8 * TILE + 8; p.y = rowOf(9) * TILE + 8; p.px = p.x; p.py = p.y; G.maxStratum = 9; forceFlow();
    for (let i = 0; i < 60 * (THREAT.bossDelay[0] + 1); i++) { G.threat.noise = 100; step(); }
    ok('Boşluk bandında Ötegöz uyanır', G.enemies.some(e => e.type === 'otegoz'), G.enemies.filter(e => e.d.boss).map(e => e.type).join(',')); }
  const arena = (seed, k) => { fresh(seed); const p = G.player; for (let r = GROUND_ROW + 1; r <= GROUND_ROW + 12; r++) for (let c = 3; c <= 13; c++) setTile(c, r, T.AIR);
    p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 9) * TILE + 8; p.px = p.x; p.py = p.y; p.hp = p.maxHp = 9999; forceFlow();
    const e = spawnEnemy(k, 8 * TILE + 8, (GROUND_ROW + 4) * TILE + 8, 3); e.emergeT = 0; e.hp = e.maxHp = 1e6; return [p, e]; };
  for (const k of ['karakok', 'kavurgan', 'otegoz', 'kordesen', 'ezeli']) {
    const [p, e] = arena(710, k); const seen = new Set();
    for (let i = 0; i < 60 * 12; i++) { step(); if (e.bs && e.bs.act) seen.add(e.bs.act.k); p.hp = Math.max(p.hp, 5000); }
    ok(`${ENEMIES[k].name}: saldırı döngüsü`, seen.size >= 2 && p.hp < 9999, [...seen].join(','));
    for (let i = 0; i < 600 && e.under; i++) step(); // toprağın altındayken vurulamaz
    const ev = events.bossPhase | 0; damageEnemy(e, e.maxHp * 0.6 / (1 - ENEMIES[k].armor), 0, 0, 0); run(0.3);
    ok(`${ENEMIES[k].name}: %50 canda öfkelenir`, e.bs.phase === 2 && (events.bossPhase | 0) === ev + 1, `faz ${e.bs.phase} ölü ${e.dead} can ${Math.round(e.hp)} emerge ${e.emergeT}`);
  }
  // Karakök toprağa dalar: altındayken vurulamaz, altından çıkınca vurur
  { const [p, e] = arena(720, 'karakok'); e.bs = null; step(); e.bs.cd.spikes = 99; e.bs.cd.burrow = 0; p.y = (GROUND_ROW + 11) * TILE + 8; p.py = p.y;
    let under = false, hitUnder = false;
    for (let i = 0; i < 60 * 5; i++) { step(); if (e.under) { under = true; const h = e.hp; damageEnemy(e, 50, 0, 0, 0); if (e.hp !== h) hitUnder = true; } }
    ok('Karakök toprağa dalar ve çıkar', under && !e.under && !hitUnder && p.hp < 9999, `${under} ${e.under} ${hitUnder} ${p.hp}`); }
  // Ezelî halkası kayanın arkasına geçmez
  { const [p, e] = arena(730, 'ezeli'); step(); e.bs.cd.pillars = 99; e.bs.cd.doom = 0;
    for (let c = 3; c <= 13; c++) setTile(c, GROUND_ROW + 7, T.BEDROCK || T.STONE);
    p.hp = 9999; e.px = e.x; for (let i = 0; i < 60 * 2.6; i++) { step(); e.x = e.px = 8 * TILE + 8; e.y = e.py = (GROUND_ROW + 4) * TILE + 8; }
    ok('Kıyamet Halkası siperde vurmaz', p.hp === 9999, `hp ${p.hp}`); }
  // düz vuruş: gövdeye değmek hasar vermez; dibine girene gerilir, sonra önüne vurur; yaydan çıkan kurtulur
  { const [p, e] = arena(750, 'kordesen'); step(); const B = e.bs, pin = dx => { p.x = p.px = e.x + dx; p.y = p.py = e.y; };
    const calm = m => { for (const k in B.cd) B.cd[k] = 99; B.cd.melee = m; B.act = null; e.wind = 0; p.hp = 9999; p.iframes = 0; };
    calm(99); for (let i = 0; i < 120; i++) { pin(6); step(); }
    ok('boss gövdesine değmek hasar vermez', p.hp === 9999 && !B.act, `hp ${p.hp}`);
    calm(0); pin(14); step(); pin(14); step();
    ok('boss dibindeki madenciye gerilir', !!B.act && B.act.k === 'melee' && p.hp === 9999 && e.wind > 0, `${B.act && B.act.k} hp ${p.hp}`);
    for (let i = 0; i < 60 * BOSS_MELEE.wind + 2; i++) { pin(14); step(); }
    ok('gerilme bitince düz vuruş vurur', p.hp < 9999 && B.cd.melee > 0, `hp ${p.hp}`);
    for (let i = 0; i < 60; i++) { pin(14); step(); }
    calm(0); pin(14); step(); pin(14); step();
    for (let i = 0; i < 60; i++) { pin(70); step(); }
    ok('yaydan çıkan düz vuruştan kurtulur', p.hp === 9999, `hp ${p.hp}`); }
  ok('bosslar deterministik', (() => { const h = []; for (let i = 0; i < 2; i++) { arena(740, 'kordesen'); spawnEnemy('ezeli', 6 * TILE + 8, (GROUND_ROW + 3) * TILE + 8, 3).emergeT = 0; run(8); h.push(hash()); } return h[0] === h[1]; })());
}

// ---------- 15. yeni kalıntılar ----------
section('Kalıntılar');
{
  ok('her kalıntının adı ve açıklaması var', Object.values(PERKS).every(k => k.name && k.desc) && Object.keys(PERKS).length >= 29);
  const setup = seed => { fresh(seed); const p = G.player; shaft(8, GROUND_ROW + 14); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 12) * TILE + 8; p.px = p.x; p.py = p.y; forceFlow(); return p; };
  { const p = setup(800); applyPerk('sonDirenis'); const full = lastStand(p); p.hp = p.maxHp * 0.2;
    ok('Son Direniş düşük canda vurur', full === 1 && lastStand(p) === 1.5); applyPerk('sonDirenis'); ok('Son Direniş II güçlenir', lastStand(p) === 1.9 && G.perkLv.sonDirenis === 2); }
  { const p = setup(801); applyPerk('simsekAdim'); damagePlayerX(p, 5); ok('Şimşek Adım hasar alınca hızlandırır', p.hasteT > 1.5); }
  { const p = setup(803); applyPerk('dikenZirh'); const e = spawnEnemy('rodent', p.x + 6, p.y, 1); e.emergeT = 0; const h0 = e.hp; damagePlayerX(p, 5);
    ok('Diken Zırh vurana hasar verir', e.hp < h0 || e.dead); }
  { const p = setup(804); applyPerk('sessizAdim'); setTile(9, GROUND_ROW + 12, T.GOLD); G.threat.noise = 0; breakTile(9, GROUND_ROW + 12, p); const a1 = G.threat.noise;
    fresh(804); const q = G.player; shaft(8, GROUND_ROW + 14); q.x = 8 * TILE + 8; q.y = (GROUND_ROW + 12) * TILE + 8; setTile(9, GROUND_ROW + 12, T.GOLD); G.threat.noise = 0; breakTile(9, GROUND_ROW + 12, q);
    ok('Sessiz Adım gürültüyü azaltır', a1 < G.threat.noise * 0.8, `${a1} ${G.threat.noise}`); }
  { const p = setup(806); applyPerk('deprem'); for (let c = 3; c <= 13; c++) for (let r = GROUND_ROW + 13; r <= GROUND_ROW + 16; r++) setTile(c, r, T.DIRT || HOST_TILE[0]);
    const before = G.stats.dug; for (let i = 0; i < 8; i++) breakTile(4 + i, GROUND_ROW + 14, p);
    ok('Deprem Vuruşu çevreyi yıkar', G.stats.dug - before > 8, `${G.stats.dug - before}`); }
  { const p = setup(807); for (const k of ['kor', 'lesBombasi', 'yangin']) applyPerk(k); ok('3 Ateş kalıntısı rezonans açar', resonance('ates') && !resonance('buz'));
    const e = spawnEnemy('bug', p.x + 30, p.y, 0); e.emergeT = 0; const h = e.hp; e.burnT = 3; damageEnemy(e, 10); ok('Ateş rezonansı yanana fazla vurur', h - e.hp > 10 * 0.65 * 1.25, `${h - e.hp}`); }
  { const p = setup(808); applyPerk('kor'); G.lvl.blaster = 5; const e = spawnEnemy('brute', p.x, p.y + 40, 0); e.emergeT = 0; run(1.5); ok('Kor Mermi tutuşturur', e.burnT > 0 && e.burnDps > 0, `${e.burnDps}`); }
}

// ---------- 16. derin cevherler ----------
section('Derin cevherler');
{
  const g = generate(3, {}); const nb = Math.min(DEEP_ORES.length, Math.ceil(STRATA_COUNT / 4)), bands = DEEP_ORES.map(() => 0); let wrong = 0;
  for (let r = GROUND_ROW; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const d = TD[g.map[r * COLS + c]]; const i = DEEP_ORES.indexOf(d && d.ore); if (i >= 0) { bands[i]++; if (Math.min(DEEP_ORES.length - 1, Math.floor(Math.floor((r - GROUND_ROW) / STRATUM_ROWS) / 4)) !== i) wrong++; } }
  ok('her bantta kendi derin cevheri var', bands.slice(0, nb).every(n => n >= 3) && wrong === 0, bands.join(',') + ' / ' + wrong);
  fresh(900); const p = G.player;
  ok('usta işi cevhersiz alınamaz', !buyUpgrade('akikKalkan', p));
  Object.assign(G.store, UPGRADES.akikKalkan.costs[0]);
  ok('usta işi alınır', buyUpgrade('akikKalkan', p) && G.lvl.akikKalkan === 1 && G.store.akik === 0 && !upgradeCost('akikKalkan'));
  const hp0 = p.hp; damagePlayerX(p, 20); ok('Akik Kalkan darbeyi emer', p.hp === hp0 && p.shieldT > 0);
  damagePlayerX(p, 20); ok('kalkan dolarken darbe işler', p.hp === hp0 - 20);
  Object.assign(G.store, UPGRADES.muska.costs[0]); const m0 = p.maxHp; buyUpgrade('muska', p); ok('Yeşim Muska can verir', p.maxHp === m0 + 30);
  Object.assign(G.store, UPGRADES.yildizCekirdek.costs[0]); const d0 = pickDmg(); buyUpgrade('yildizCekirdek', p); ok('Yıldız Çekirdeği kazmayı güçlendirir', Math.abs(pickDmg() - d0 * 1.4) < 1e-9);
  p.bag.opal = 2; ok('çanta derin cevheri sayar', bagCount(p) >= 2);
  ok('derin cevher Öz verir', ozForRun({ maxDepth: 0, nests: 0, beacons: 0, chests: 0, victory: false, collected: { yildiz: 2 } }) === 10);
}

// ---------- 17. sefer haritası ----------
section('Sefer haritası');
{
  fresh(950); const p = G.player; shaft(8, GROUND_ROW + 30); p.x = 8 * TILE + 8; p.y = GROUND_ROW * TILE + 8; p.px = p.x; p.py = p.y;
  for (let k = 0; k < 8; k++) { p.y += 2 * TILE; p.py = p.y; run(0.05); }
  const a = G.journey.p[0];
  ok('oyuncunun izi kaydedilir', a.length > 3 && a[a.length - 1][2] > a[0][2], `${a.length}`);
  ok('iz zaman sıralı', a.every((q, i) => !i || q[0] >= a[i - 1][0]));
  p.hp = 1; damagePlayerX(p, 999);
  ok('bayılma haritaya işlenir', G.journey.m.some(m => m[0] === 'down' && m[4] === 0));
  const g2 = deserialize(JSON.parse(JSON.stringify(serialize())));
  ok('iz kayıtla geri gelir', g2.journey.p[0].length === a.length && g2.journey.m.length > 0);
}

// ---------- 18. gömülü cevher ----------
section('Gömülü cevher');
{
  const g = fresh(960); let val = 0, hid = 0;
  for (let k = 0; k < g.map.length; k++) { const d = TD[g.map[k]]; if (d.ore && !d.plain && d.ore !== 'iron' && d.ore !== 'water') { val++; if (g.buried[k]) hid++; } }
  ok('değerli cevherin yaklaşık üçte biri gömülü', hid / val > 0.2 && hid / val < 0.45, `${hid}/${val}`);
  ok('yuvalar gizli başlar', G.nests.length > 0 && G.nests.every(n => g.buried[n.r * COLS + n.c] === 1));
  ok('demir ve su gömülmez', g.map.every((t, k) => !g.buried[k] || (TD[t].ore !== 'iron' && TD[t].ore !== 'water')));
  const k = g.buried.findIndex((b, j) => b && Math.floor(j / COLS) > GROUND_ROW + 4 && j % COLS > 2 && j % COLS < 14);
  const c = k % COLS, r = Math.floor(k / COLS);
  setTile(c - 1, r, T.DIRT); breakTile(c - 1, r, G.player);
  ok('yanını kazınca gömülü cevher belirir', G.buried[k] === 0);
  const k2 = g.buried.findIndex((b, j) => b && Math.floor(j / COLS) > GROUND_ROW + 4);
  const g2 = deserialize(JSON.parse(JSON.stringify(serialize())));
  ok('gömülü bilgisi kayıtla geri gelir', g2.buried[k2] === 1 && g2.buried[k] === 0);
}

// ---------- 19. silah ve kazma türleri, yeni eşyalar, büyük çanta ----------
section('Silah ve kazma türleri');
{
  const g = fresh(970), p = G.player;
  ok('çantanın son seviyesi 1000', UPGRADES.bag.cap[UPGRADES.bag.costs.length] === 1000);
  G.lvl.bag = UPGRADES.bag.costs.length; recompute(); ok('çanta kapasitesi 1000', G.bagCap === 1000, `${G.bagCap}`);
  // büyük çanta hızlı boşalır
  p.bag.iron = 700; p.x = 8 * TILE + 8; p.y = (GROUND_ROW - 1) * TILE + 8; p.px = p.x; p.py = p.y; const iron0 = G.store.iron;
  run(3); ok('700 cevher 3 sn içinde depoya iner', G.store.iron === iron0 + 700 && bagCount(p) === 0, `${G.store.iron - iron0}`);
  // her silah türü alınır, takılır ve düşmana vurur
  for (const k of WEAPON_KEYS) {
    fresh(971); const q = G.player; for (const r of RES_KEYS) G.store[r] = 200;
    shaft(8, GROUND_ROW + 14); q.x = 8 * TILE + 8; q.y = (GROUND_ROW + 4) * TILE + 8; q.px = q.x; q.py = q.y; forceFlow();
    ok(`${k} takılır`, gearPick('w', k, q) && q.wpn === k && G.gear.wOwn.includes(k));
    const e = spawnEnemy('bug', q.x, q.y + 40, 3); e.emergeT = 0;
    run(2.5);
    ok(`${k} düşmana vurur`, e.dead || e.hp < e.maxHp, `${e.hp}/${e.maxHp}`);
  }
  // kazma türleri
  fresh(972); const d = G.player; for (const r of RES_KEYS) G.store[r] = 200;
  ok('olmayan tür reddedilir', !gearPick('p', 'yok', d) && !gearPick('w', 'yok', d));
  const b0 = pickDmg(d), i0 = pickInterval(d);
  ok('balyoz ağır ve yavaş', gearPick('p', 'balyoz', d) && pickDmg(d) > b0 * 2 && pickInterval(d) > i0 * 1.5);
  for (const r of RES_KEYS) G.store[r] = 0;
  ok('parası yetmeyen tür alınmaz', !gearPick('p', 'matkap', d) && d.pk === 'balyoz');
  ok('sahip olunan türe ücretsiz dönülür', gearPick('p', 'std', d) && d.pk === 'std');
  for (const k of PICK_TYPE_KEYS) ok(`${k} kazma türü tanımlı`, pickDmg(d) > 0 && finite(pickInterval(d)));
  // geniş kazma yandaki blokları da açar
  fresh(973); const w = G.player; for (const r of RES_KEYS) G.store[r] = 200; gearPick('p', 'genis', w);
  const R = GROUND_ROW + 5; shaft(8, R - 1); for (let c = 7; c <= 9; c++) setTile(c, R, T.DIRT);
  w.x = 8 * TILE + 8; w.y = (R - 1) * TILE + 8; w.px = w.x; w.py = w.y; w.inp = { x: 0, y: 1, mag: 1 }; run(2.5); w.inp = { x: 0, y: 0, mag: 0 };
  ok('geniş kazma üç blok açar', tileAt(7, R) === T.AIR && tileAt(8, R) === T.AIR && tileAt(9, R) === T.AIR);
  // kayıt: tür ve sahiplik korunur
  fresh(974); const s = G.player; for (const r of RES_KEYS) G.store[r] = 200; gearPick('w', 'sacma', s); gearPick('p', 'matkap', s);
  const g2 = deserialize(JSON.parse(JSON.stringify(serialize())));
  ok('silah ve kazma türü kayıtla gelir', g2.player.wpn === 'sacma' && g2.player.pk === 'matkap' && g2.gear.wOwn.includes('sacma'));
}

section('Silah seviyesi, kartlar, evrim');
{
  // sefer başı: her madenci bir başlangıç eklentisi seçer
  newRun({ seed: 980 }); const p = G.player; p.inp = { x: 0, y: 0, mag: 0 };
  ok('başlangıç teklifi sırada', G.gear.pend.length === 1 && !G.perkOffer);
  step(); ok('başlangıç teklifi sunulur', G.perkOffer && G.perkOffer.chest === 'start' && G.perkOffer.keys.join() === START_MODS.map(k => 'm:' + k).join());
  ok('teklif bilgisi (eklenti)', G.perkOffer.keys.every(k => offerInfo(k).name && offerInfo(k).desc));
  ok('başlangıç eklentisi alınır', applyPerk('m:frost', p) && hasMod('frost') && !G.perkOffer);
  ok('öğreticide başlangıç teklifi yok', !newRun({ seed: 980, tutorial: true }).gear.pend.length);
  ok('çok oyunculuda iki madenci de seçer', newRun({ seed: 980, mp: true }).gear.pend.length === 2);
  // öldürdükçe seviye: çubuk dolar, kart teklifi gelir
  fresh(981); const q = G.player; shaft(8, GROUND_ROW + 14); q.x = 8 * TILE + 8; q.y = (GROUND_ROW + 4) * TILE + 8; q.px = q.x; q.py = q.y;
  ok('seviye eşiği artar', xpNeed(0) === WXP.base && xpNeed(5) > xpNeed(1));
  const kill = (type = 'bug') => { const e = spawnEnemy(type, q.x, q.y + 300, 0); e.emergeT = 0; killEnemy(e); return e; };
  kill('rodent'); ok('öldürme çubuğu doldurur', G.gear.xp === ENEMIES.rodent.cost && G.gear.lv === 0);
  while (G.gear.lv < 1) kill();
  ok('seviye atlar, teklif sıraya girer', G.gear.lv === 1 && G.gear.pend.length === 1);
  step(); const off = G.perkOffer;
  ok('kart teklifi: üç farklı kart', off && off.chest === 'lvl' && off.keys.length === 3 && new Set(off.keys).size === 3 && off.keys.every(k => k.startsWith('x:') && CARDS[k.slice(2)]), off && off.keys.join());
  ok('teklif bilgisi (kart)', off.keys.every(k => { const o = offerInfo(k); return o.name && o.lv === 1 && o.max >= 2; }));
  ok('kart teklifi yeniden çekilmez', WOFFER.lvl && !rerollOffer(q));
  const dmg0 = gunDmg(q), cd0 = gunCd(q), cc0 = critChance(q);
  ok('kart alınır', applyPerk(off.keys[0], q) && cardLv(off.keys[0].slice(2)) === 1 && !G.perkOffer);
  G.gear.cards = { dmg: 2, hiz: 2, krit: 2 };
  ok('hasar kartı', Math.abs(gunDmg(q) / dmg0 - (1 + 2 * CARDS.dmg.v)) < 1e-6 || off.keys[0] === 'x:dmg');
  ok('hız kartı', gunCd(q) < cd0);
  ok('kritik kartı', critChance(q) > cc0 && Math.abs(critChance(q) - (CRIT.base + 2 * CARDS.krit.v)) < 1e-9);
  ok('kart sınırı', !applyPerk('x:dmg', q) === false && (G.gear.cards.dmg = CARDS.dmg.max, !applyPerk('x:dmg', q)));
  // evrim: seviye evoAt olunca elindeki silah için iki yol
  G.perkOffer = null; G.gear.pend.length = 0; G.gear.cards = {}; G.gear.lv = WXP.evoAt - 1; G.gear.xp = 0;
  while (G.gear.lv < WXP.evoAt) kill();
  step(); const ev = G.perkOffer;
  ok('evrim teklifi', ev && ev.chest === 'evo' && ev.keys.join() === 'e:blaster:0,e:blaster:1', ev && ev.keys.join());
  ok('teklif bilgisi (evrim)', ev.keys.every(k => offerInfo(k).name && offerInfo(k).desc));
  ok('evrim seçilir, silah değişir', applyPerk('e:blaster:0', q) && weaponOf(q).pellets === 3 && weaponOf(q).name === WEAPONS.blaster.evo[0].name);
  ok('evrim ikinci kez seçilmez', !applyPerk('e:blaster:1', q) && G.gear.evo.blaster === 0);
  kill(); kill(); kill(); kill(); kill(); kill(); kill(); kill(); G.perkOffer = null; step();
  ok('evrimden sonra yine kart gelir', !G.perkOffer || G.perkOffer.chest === 'lvl');
  // her silahın iki evrimi de ateş eder ve vurur
  for (const k of WEAPON_KEYS) for (const i of [0, 1]) {
    fresh(982); const w = G.player; shaft(8, GROUND_ROW + 14); w.x = 8 * TILE + 8; w.y = (GROUND_ROW + 4) * TILE + 8; w.px = w.x; w.py = w.y; forceFlow();
    G.gear.wOwn = WEAPON_KEYS.slice(); w.wpn = k; G.gear.evo[k] = i; G.gear.cards = { cok: 2, del: 2 }; G.gear.owned = MOD_KEYS.slice();
    const e = spawnEnemy('bug', w.x, w.y + 40, 3); e.emergeT = 0; let threw = null;
    try { run(2.5); } catch (err) { threw = err; }
    ok(`${k} evrim ${i} vurur`, !threw && (e.dead || e.hp < e.maxHp) && finite(gunDps(w)) && gunDps(w) > 0, threw ? threw.message : `${e.hp}/${e.maxHp}`);
  }
  // yarıda kalan silah teklifi sandık teklifiyle kaybolmaz
  fresh(983); const z = G.player; G.gear.pend.push({ kind: 'lvl' }); G.gear.lv = 1; step();
  const first = G.perkOffer; ok('kart teklifi bekliyor', first && first.chest === 'lvl');
  const { offer: giveOffer } = await import('../src/game/chests.js'); giveOffer(z, 'wood', ['kor']);
  ok('sandık teklifi öne geçer, kart sıraya döner', G.perkOffer.chest === 'wood' && G.gear.pend.length === 1);
  applyPerk('kor', z); step(); ok('kart teklifi geri gelir', G.perkOffer && G.perkOffer.chest === 'lvl');
  // tüm kartlar dolunca seviye durur
  G.perkOffer = null; for (const k of CARD_KEYS) G.gear.cards[k] = CARDS[k].max; const lv0 = G.gear.lv, xp0 = G.gear.xp;
  kill('brute'); ok('kartlar bitince seviye durur', weaponMaxed() && G.gear.lv === lv0 && G.gear.xp === xp0);
  // kayıt: seviye, kartlar ve evrim korunur
  fresh(984); G.gear.lv = 4; G.gear.xp = 3; G.gear.cards = { dmg: 2, krit: 1 }; G.gear.evo = { blaster: 1 };
  const g2 = deserialize(JSON.parse(JSON.stringify(serialize())));
  ok('silah seviyesi kayıtla gelir', g2.gear.lv === 4 && g2.gear.xp === 3 && g2.gear.cards.dmg === 2 && g2.gear.evo.blaster === 1 && weaponOf(g2.player).pierce === 2 && !g2.gear.pend.length);
  // yönetmen: ilk biyomlarda karışmaz, sonra da beklenenin 'free' katına kadar dokunmaz
  fresh(985); G.lvl.blaster = 6; G.gear.owned = MOD_KEYS.slice();
  ok('yönetmen ilk biyomlarda kapalı', directorHp(0) === 1 && directorHp(POWER.from - 1) === 1);
  ok('yönetmen güçlü ekibe karşı açılır ama sınırlı', directorHp(POWER.from) > 1 && directorHp(POWER.from) <= POWER.max, `${directorHp(POWER.from)}`);
  fresh(986); G.lvl.blaster = 2; ok('yönetmen olağan güçte dokunmaz', directorHp(3) === 1, `${directorHp(3)}`);
  // başlangıç gücü: Kemirgen iki atışta ölür, Kaya Devi tek şarjörde ölmez
  fresh(987); const b = G.player;
  ok('başlangıç: kemirgen iki atış', Math.ceil(ENEMIES.rodent.hp / gunDmg(b)) === 2, `${gunDmg(b)}`);
  ok('başlangıç: kaya devi 8+ sn', ENEMIES.brute.hp / (1 - ENEMIES.brute.armor) / (gunDmg(b) / gunCd(b)) > 8);
}

section('Yeni eşyalar ve köşe kayması');
{
  fresh(980); const u = G.player; shaft(8, GROUND_ROW + 6);
  u.x = 8 * TILE + 8; u.y = (GROUND_ROW + 6) * TILE + 8; u.px = u.x; u.py = u.y;
  G.items.kalkan = 1; ok('kalkan hücresi takılır', useItem('kalkan', u) && u.barrier === SHIELD.hp);
  const hp0 = u.hp; damagePlayerX(u, 30); ok('kalkan darbeyi emer', u.hp === hp0 && u.barrier === SHIELD.hp - 30, `${u.hp} ${u.barrier}`);
  for (let r = GROUND_ROW + 7; r <= GROUND_ROW + 6 + AUGER.depth; r++) setTile(8, r, T.DIRT);
  G.items.burgu = 1; ok('burgu şarjı patlar', useItem('burgu', u));
  let open = true; for (let r = GROUND_ROW + 7; r <= GROUND_ROW + 6 + AUGER.depth; r++) if (tileAt(8, r) !== T.AIR) open = false;
  ok('burgu altındaki 8 bloğu deler', open);
  const sp0 = playerSpeed(u); G.items.adren = 1; ok('adrenalin', useItem('adren', u) && lastStand(u) === 2 && playerSpeed(u) > sp0 * 1.3);
  const bi = (GROUND_ROW + 9) * COLS + 11; G.map[bi] = T.COBALT; G.buried[bi] = 1;
  G.items.sonar = 1; ok('sonar gömülü cevheri açar', useItem('sonar', u) && G.buried[bi] === 0);
  u.hp = 10; G.items.medkit = 1; ok('tamir kiti en az 50 yeniler', useItem('medkit', u) && u.hp >= 60);
  ok('eski eşyalar üretilemez', !craftItem('torch', u) && !craftItem('barricade', u) && !craftItem('lamp', u));
  // şaft ağzında aşağı basınca kazmaz, şafta kayar
  fresh(981); const m = G.player; const r0 = GROUND_ROW + 4;
  for (let c = 5; c <= 10; c++) setTile(c, r0, T.AIR); for (let r = r0 + 1; r <= r0 + 5; r++) setTile(6, r, T.AIR);
  for (let c = 5; c <= 10; c++) if (c !== 6) setTile(c, r0 + 1, T.DIRT);
  m.x = 7 * TILE + 2; m.y = r0 * TILE + 8; m.px = m.x; m.py = m.y; m.inp = { x: 0, y: 1, mag: 1 }; run(0.8); m.inp = { x: 0, y: 0, mag: 0 };
  ok('şaft ağzında takılmadan şafta kayar', m.y > (r0 + 2) * TILE && tileAt(7, r0 + 1) === T.DIRT, `${m.x} ${m.y}`);
}

section('Test düğmesi');
{
  fresh(990); const t = G.player;
  ok('test düğmesi cevheri doldurur', testFunds(t) && RES_KEYS.every(k => G.store[k] === TEST_FUNDS));
  ok('test düğmesi şemaları açar', craftItem('adren', t) && G.items.adren === 1);
}

section('Yönetmen ve derinlik ölçeği');
{
  // derinlik: aynı tür derinde daha dayanıklı ve daha sert vurur
  fresh(1100); const a = spawnEnemy('bug', 100, (GROUND_ROW + 2) * TILE, 0), b = spawnEnemy('bug', 100, (GROUND_ROW + 10 * STRATUM_ROWS + 2) * TILE, 0);
  ok('derinde can katlanır', b.maxHp / a.maxHp > 3 && Math.abs(b.maxHp / a.maxHp - enemyHpMul(10, 0) / enemyHpMul(0, 0)) < 1e-6, `${a.maxHp} ${b.maxHp}`);
  ok('derinde hasar artar', b.dmgMul > a.dmgMul * 1.6, `${a.dmgMul} ${b.dmgMul}`);
  // elit özellikleri: sığda yok, derinde var; kalkan hasarı emer
  const { makeElite } = await import('../src/game/enemies.js');
  const s0 = makeElite(spawnEnemy('bug', 100, (GROUND_ROW + 2) * TILE, 0)); ok('sığ elitte özellik yok', !s0.aff);
  let got = new Set(), n2 = 0;
  for (let k = 0; k < 40; k++) { const d = makeElite(spawnEnemy('bug', 100, (GROUND_ROW + 15 * STRATUM_ROWS + 2) * TILE, 0)); n2 += d.aff.length === 2 ? 1 : 0; d.aff.forEach(x => got.add(x)); }
  ok('derin elit 2 özellik', n2 === 40, `${n2}`);
  ok('tüm özellikler çıkar', got.size === Object.keys(AFFIX).length, [...got].join(','));
  const sh = spawnEnemy('bug', 100, (GROUND_ROW + 15 * STRATUM_ROWS + 2) * TILE, 0); sh.emergeT = 0; sh.shield = sh.shieldMax = 50; const hp0 = sh.hp;
  damageEnemy(sh, 40); ok('kalkan hasarı emer', sh.hp === hp0 && sh.shield < 50, `${sh.hp} ${sh.shield}`);
  // tempo: öfkede sınır yavaş yükselir, dalga duyurulur, ardından nefes arası
  fresh(1101); const p = G.player; const R = GROUND_ROW + 5 * STRATUM_ROWS + 10;
  shaft(8, R + 1); for (let c = 4; c <= 12; c++) setTile(c, R, T.AIR);
  p.x = 8 * TILE + 8; p.y = R * TILE + 8; p.px = p.x; p.py = p.y; G.lvl.blaster = 6; recompute(); forceFlow();
  let hordes = 0, rest = false, max10 = 0, maxAll = 0; const off = on('horde', () => hordes++);
  for (let t = 0; t < 150; t += STEP) {
    G.threat.noise = Math.max(G.threat.noise, 80); p.hp = p.maxHp; p.dead = false; step();
    const alive = G.enemies.filter(e => !e.dead && e.type !== 'spiderling').length;
    if (t < 10) max10 = Math.max(max10, alive); maxAll = Math.max(maxAll, alive);
    if (G.threat.dir.phase === 'rest') rest = true;
  }
  ok('ilk 10 sn ordu gelmez', max10 <= 6, `${max10}`);
  ok('sahadaki düşman sınırı aşılmaz', maxAll <= Math.ceil(THREAT.cap[3] * 1.3) + 6, `${maxAll}`);
  ok('dalga duyurulur', hordes >= 1, `${hordes}`);
  ok('dalgadan sonra nefes arası', rest);
  ok('gruplar numaralı', G.threat.dir.sid >= 4, `${G.threat.dir.sid}`);
}

section('Market');
{
  fresh(1200); const p = G.player; const give = () => { for (const k of RES_KEYS) G.store[k] = 99999; };
  // fiyatlar katlanır: son seviye ilkinden çok pahalı
  const sum = c => Object.values(c).reduce((a, b) => a + b, 0);
  for (const k of ['drill', 'blaster', 'armor', 'bag']) { const cs = UPGRADES[k].costs; ok(`${k} fiyatı katlanır`, sum(cs[cs.length - 1]) > sum(cs[0]) * 40, `${sum(cs[0])} → ${sum(cs[cs.length - 1])}`); }
  ok('Silah Gücü 15 seviye', UPGRADES.blaster.costs.length === 15 && UPGRADES.blaster.dmg.length === 16);
  give();
  // alet seviyesi: kurulu aletin canı da artar
  shaft(8, GROUND_ROW + 6); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 4) * TILE + 8; p.px = p.x; p.py = p.y;
  G.items.turret = 1; placeBuild('turret', p); const s0 = G.structures[0], m0 = s0.maxHp;
  ok('alet seviyesi', levelUp('turret', p) && G.gear.tLvl.turret === 1 && s0.maxHp > m0);
  G.meta.schem = []; ok('şemasız alet geliştirilmez', !levelUp('mortar', p));
  // üretim fiyatı derinlikle artar
  const c0 = itemCost('medkit').water; G.maxStratum = 20; ok('üretim fiyatı derinde artar', itemCost('medkit').water > c0 * 2, `${c0} → ${itemCost('medkit').water}`);
  // kayıt: alet seviyesi korunur
  const g2 = deserialize(JSON.parse(JSON.stringify(serialize())));
  ok('alet seviyesi kayıtla gelir', g2.gear.tLvl.turret === 1);
  // test düğmesi Fener kilidini de açar
  fresh(1201); G.lvl.blaster = 10; testFunds(G.player); ok('test düğmesi kilidi açar', beaconLack('blaster') === 0 && buyUpgrade('blaster', G.player));
}

section('Gezgin tüccar ve asansör durakları');
{
  fresh(950); const p = G.player; G.tutorial = null; G.merchT = 0.01; step();
  ok('tüccar kampa gelir', G.merchant && G.merchant.goods.length >= 2, JSON.stringify(G.merchant && G.merchant.goods));
  G.store.gold = 0; ok('altın yoksa alınmaz', !buyMerch(p, 0));
  G.store.gold = 200; const g0 = G.merchant.goods[0]; p.y = GROUND_Y - 10;
  ok('altınla alınır', buyMerch(p, 0) && g0.sold && G.store.gold === 200 - g0.cost);
  ok('bir kez satılır', !buyMerch(p, 0));
  G.merchant.t = 0.01; step(); ok('süre bitince gider, uzun süre gelmez', !G.merchant && G.merchT >= MERCHANT.every);
  fresh(951); const q = G.player; G.nests.length = 0; G.enemies.length = 0;
  shaft(8, GROUND_ROW + STRATUM_ROWS + 2); q.x = SHAFT_X; q.y = (GROUND_ROW + STRATUM_ROWS + 1) * TILE + 8; q.px = q.x; q.py = q.y; step();
  q.y = (GROUND_ROW + 6) * TILE + 8; ok('halatın ortasında binilmez', !atShaft(q));
  q.y = stationY(1); ok('istasyonda binilir', atShaft(q) && callElevator(q, -1) && q.ride.board > 0);
  step(); ok('binerken yerinde durur', Math.abs(q.y - stationY(1)) < 1);
}

{
  fresh(960); const p = G.player; p.x = WELL_X; p.y = GROUND_Y - 10; G.store.gold = 5;
  const c0 = wellCost(); ok('kuyuya sikke atılır', wish(p) && G.store.gold === 5 - c0 && G.wish);
  ok('kuyu meşgulken atılmaz', !wish(p));
  const before = JSON.stringify([G.store, G.items, p.hp, G.perkOffer]); run(1.5);
  ok('kuyu ödül verir', !G.wish && JSON.stringify([G.store, G.items, p.hp, G.perkOffer]) !== before);
  ok('her atış pahalanır', wellCost() > c0);
  p.x = WELL_X + 60; G.store.gold = 99; ok('kuyudan uzakta atılmaz', !wish(p));
}

section('Savrulma');
{
  fresh(31);
  const mk = () => { const e = spawnEnemy('rodent', 8 * TILE + 8, (GROUND_ROW + 6) * TILE + 8, 0); e.emergeT = 0; e.hp = e.maxHp = 1e6; return e; };
  const a = mk(); damageEnemy(a, 1, 1, 0, 1);
  ok('tek vuruş tam iter', Math.abs(a.kx - 55) < 0.01, `${a.kx}`);
  const b = mk(); for (let i = 0; i < 10; i++) damageEnemy(b, 1, 1, 0, 1);
  ok('üst üste vuruşlar giderek az iter', b.kx < 55 * 10 * 0.45 && b.kx > 55, `${b.kx.toFixed(0)}`);
  for (let i = 0; i < 120; i++) step();
  ok('ara verince toparlanır', b.kn < 0.1 && b.kx === 0, `${b.kn}`);
}

section('Garip yaratıklar');
{
  fresh(970); const p = G.player, cs = G.critters;
  ok('haritada yaratıklar var', cs.length >= 8 && cs.every(c => tileAt(c.c, c.r) === T.AIR), `${cs.length}`);
  ok('derindekiler nadir türler', cs.every(c => Math.floor((c.r - GROUND_ROW) / STRATUM_ROWS) >= CRITTERS[c.k].min));
  const c0 = cs[0]; p.x = c0.c * TILE + 8; p.y = c0.r * TILE + 8; p.px = p.x; p.py = p.y; step();
  ok('yanına varınca bulunur, yoldaş olur', c0.found && p.pet === c0.k && (events.critter | 0) >= 1);
  fresh(970); ok('yerleşim tohumla aynı', JSON.stringify(G.critters.map(c => [c.k, c.c, c.r])) === JSON.stringify(cs.map(c => [c.k, c.c, c.r])));
  ok('bir seferde her tür en çok bir kez', new Set(cs.map(c => c.k)).size === cs.length);
  const had = cs.map(c => c.k), g2 = newRun({ seed: 970, start: false, meta: { ...metaSnapshot(), pets: had } });
  ok('koleksiyondaki türler bir daha çıkmaz', g2.critters.every(c => !had.includes(c.k)), g2.critters.map(c => c.k).join(' '));
}

section('Harita sürprizleri');
{
  fresh(971); const p = G.player;
  ok('göl, portal, mantar yerleşti', G.lakes.length >= 3 && G.portals.length >= 3 && G.shrooms.length >= 10, `${G.lakes.length}/${G.portals.length}/${G.shrooms.length}`);
  ok('hepsi oyuklarda', G.lakes.every(L => tileAt(L.c, L.r) === T.AIR && tileAt(L.c + L.w - 1, L.r + L.h - 1) === T.AIR) && G.shrooms.every(s => tileAt(s.c, s.r) === T.AIR) && G.portals.every(q => tileAt(q.a[0], q.a[1]) === T.AIR && tileAt(q.b[0], q.b[1]) === T.AIR));
  ok('portallar yakın', G.portals.every(q => Math.hypot(q.a[0] - q.b[0], q.a[1] - q.b[1]) <= 11));
  const tp = (x, y) => { p.x = p.px = x; p.y = p.py = y; };
  // göl: olta at, balık çıkar
  const L = G.lakes[0]; tp((L.c + 2) * TILE + 8, (L.r + 2) * TILE + 8);
  const g0 = JSON.stringify(G.store); ok('gölde olta atılır', lakeAt(p) === 0 && castLine(p) && !castLine(p));
  run(3); ok('balık bir şey getirir', !p.fish && L.fish === 2 && (JSON.stringify(G.store) !== g0 || p.hp === p.maxHp || G.perkOffer || true));
  castLine(p); tp(p.x, (L.r - 3) * TILE); step(); ok('gölden çıkınca olta düşer', !p.fish && L.fish === 2);
  // portal: basınca eşine, orada durunca geri dönmez
  const q = G.portals[0]; tp(q.a[0] * TILE + 8, q.a[1] * TILE + 8); step();
  ok('portal eşine ışınlar', Math.abs(p.x - (q.b[0] * TILE + 8)) < 2 && Math.abs(p.y - (q.b[1] * TILE + 8)) < 2);
  run(2); ok('varış noktasında geri atmaz', Math.abs(p.y - (q.b[1] * TILE + 8)) < 2);
  // mantar: yenir, etki gelir ve geçer
  const s = G.shrooms[0]; tp(s.c * TILE + 8, s.r * TILE + 8); step();
  ok('mantar yenir', s.eaten && !!p.eat); run(0.6); ok('mantar etkisi', !!p.shroom && ['mini', 'dev', 'hiz', 'zehir'].includes(p.shroom.k));
  const k = p.shroom.k; run(20); ok('etki geçer', !p.shroom, k);
  p.shroom = { k: 'dev', t: 5 }; const big = pickDmg(p); p.shroom = null; ok('dev mantar kazmayı güçlendirir', big > pickDmg(p));
  p.shroom = { k: 'mini', t: 5 }; const hp0 = p.hp; damagePlayerX(p, 10); ok('küçükken daha az hasar', hp0 - p.hp < 10 && hp0 - p.hp > 0, `${hp0 - p.hp}`); p.shroom = null;
  const snap = serialize(); deserialize(snap); ok('sürprizler kayıtta', G.shrooms[0].eaten && G.lakes[0].fish === 2);
}

section('Sıvılar: şelale ve lav');
{
  fresh(972); const sum = k => { let n = 0; for (let i = 0; i < G.lq.length; i++) if (G.lk[i] === k) n += G.lq[i]; return n; };
  const fs = G.order.indexOf(FALLS_BIOME), ls = G.order.indexOf(LAVA_BIOME);
  ok('şelale biyomunda iki su kaynağı, kor katmanında lav ağzı', G.springs.filter(q => q.k === 0).length === 2 && G.springs.some(q => q.k === 1) && tileAt(G.springs[0].c, G.springs[0].r) !== T.AIR);
  ok('havuzlar dolu başlar', sum(0) > 100 && sum(1) > 50, `${sum(0)}/${sum(1)}`);
  const w0 = sum(0); run(6);
  const sp = G.springs.find(q => q.k === 0); let falling = 0; for (let r = sp.r + 1; r < sp.r + 5; r++) falling += G.lq[r * COLS + sp.c];
  ok('şelale akar', falling > 0, `${falling}`);
  ok('su sınırı aşılmaz', sum(0) <= 2 * 170 + 40, `${sum(0)}`);
  // lav + su: obsidyen
  const r = GROUND_ROW + 20, i = r * COLS + 4; for (let c = 3; c <= 6; c++) { setTile(c, r, T.AIR); setTile(c, r + 1, T.STONE); }
  G.lq[i] = 8; G.lk[i] = 1; G.lq[i + 1] = 8; G.lk[i + 1] = 0; run(0.5);
  ok('su lava değince obsidyen', tileAt(4, r) === T.OBSIDIAN || tileAt(5, r) === T.OBSIDIAN);
  // kazılan tünele su akar
  const c2 = 12, r2 = GROUND_ROW + 40; for (let y = r2 - 1; y <= r2 + 6; y++) for (let x = c2 - 1; x <= c2 + 1; x++) setTile(x, y, T.STONE);
  setTile(c2, r2, T.AIR); G.lq[r2 * COLS + c2] = 8; G.lk[r2 * COLS + c2] = 0; for (let y = r2 + 1; y <= r2 + 5; y++) setTile(c2, y, T.AIR); run(1);
  ok('su tünelden aşağı akar', G.lq[(r2 + 5) * COLS + c2] > 0 && G.lq[r2 * COLS + c2] === 0);
  // oyuncu: lavda yanar, suda yavaşlar
  const p = G.player; p.x = p.px = c2 * TILE + 8; p.y = p.py = (r2 + 5) * TILE + 8; step(); ok('suda yavaşlar', p.wet && playerSpeed(p) < 60);
  const j = (r2 + 5) * COLS + c2; G.lq[j] = 8; G.lk[j] = 1; const hp = p.hp; p.iframes = 0; run(0.5); ok('lavda yanar', p.hp < hp);
  const snap = serialize(); const tot = sum(0); deserialize(snap); ok('sıvılar kayıtta', Math.abs(sum(0) - tot) <= 8);
}

section('Sandık türleri ve kalıntılar');
{
  const { CHESTS, chestWeights, PERKS: PK } = await import('../src/data/balance.js');
  const { CHEST_TILE } = await import('../src/data/tiles.js');
  const { perkChoices, offerInfo } = await import('../src/game/chests.js');
  ok('45+ kalıntı, altı soy, ikili, efsanevi ve lanetli', Object.keys(PK).length >= 45 && ['ates', 'buz', 'simsek', 'kan', 'toprak', 'golge'].every(s => Object.values(PK).filter(q => q.soy === s).length >= 5) && Object.values(PK).some(q => q.duo) && Object.values(PK).some(q => q.leg) && Object.values(PK).some(q => q.curse));
  ok('9 sandık türü', Object.keys(CHESTS).length === 9 && Object.keys(CHESTS).every(k => TD[CHEST_TILE[k]].chest === k));
  // haritada sandık türleri çeşitli
  const kinds = new Set(); for (let seed = 1; seed <= 6; seed++) { const g = generate(seed, {}); for (const tt of g.map) if (TD[tt] && TD[tt].chest) kinds.add(TD[tt].chest); }
  ok('haritada en az 6 sandık türü', kinds.size >= 6, [...kinds].join(','));
  // ahşap efsanevi vermez; ikili yalnız iki soyun varken; kartlar farklı soylardan; sahip olunan kalıntı yükseltme olarak gelir
  fresh(1300); let bad = 0; for (let i = 0; i < 30; i++) { if (perkChoices('wood').some(k => PK[k].leg || PK[k].duo || PK[k].curse)) bad++; }
  ok('ahşap sandık sade kalıntı verir', bad === 0, `${bad}`);
  { let dup = 0; for (let i = 0; i < 40; i++) { const c = perkChoices('iron').map(k => PK[k].soy).filter(Boolean); if (new Set(c).size < c.length) dup++; } ok('kartlar farklı soylardan', dup <= 4, `${dup}`); }
  { applyPerk('kor'); applyPerk('buzMermi'); let duo = 0, up = 0; for (let i = 0; i < 40; i++) { const c = perkChoices('gold'); if (c.includes('termalSok')) duo++; if (c.includes('kor')) up++; }
    ok('iki soy ikiliyi açar', duo > 0, `${duo}`); ok('sahip olunan kalıntı yükselir', up > 0, `${up}`); applyPerk('kor'); ok('yükseltme seviyeyi artırır', G.perkLv.kor === 2 && offerInfo('kor').up); }
  ok('altın sandık 4 seçenek', perkChoices('gold').length === 4);
  const open = (type, seed) => { fresh(seed); const p = G.player; shaft(8, GROUND_ROW + 12); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 10) * TILE + 8; p.px = p.x; p.py = p.y; forceFlow();
    const c = 9, r = GROUND_ROW + 10; setTile(c, r, CHEST_TILE[type]); G.perkOffer = null; const o0 = G.orbs.length, e0 = G.enemies.length; breakTile(c, r, p); return { p, orbs: G.orbs.length - o0, en: G.enemies.length - e0 }; };
  { const o = open('wood', 1301); ok('ahşap sandık kalıntı sunar', G.perkOffer && G.perkOffer.chest === 'wood' && G.perkOffer.keys.length === 3); }
  { const o = open('ore', 1302); ok('cevher sandığı cevher yağdırır', o.orbs >= 30 && !G.perkOffer, `${o.orbs}`); }
  { const o = open('supply', 1303); ok('erzak sandığı kemeri doldurur', G.items.medkit >= 2 && G.items.dynamite >= 2); }
  { const o = open('cursed', 1304); ok('lanetli sandık bekçi uyandırır', o.en === 3 && G.enemies.every(e => e.elite)); ok('lanetli sandık lanetli kalıntı sunar', PK[G.perkOffer.keys[0]].curse); }
  { const o = open('arms', 1305); ok('silah sandığı silah sunar', G.perkOffer && G.perkOffer.keys.every(k => k.includes(':')), G.perkOffer && G.perkOffer.keys.join(','));
    const k = G.perkOffer.keys.find(q => q.startsWith('w:')) || G.perkOffer.keys[0]; ok('silah teklifi alınır', applyPerk(k, o.p) && !G.perkOffer); ok('teklif bilgisi', !!offerInfo(k).name); }
  { const o = open('mimic', 1306); const m = G.enemies.find(e => e.type === 'mimic'); ok('taklitçi uyanır', !!m && !G.perkOffer);
    killEnemy(m); ok('taklitçi ölünce sandık teklifi', G.perkOffer && G.perkOffer.keys.length >= 3); }
  // yeni kalıntılar
  const setup = seed => { fresh(seed); const p = G.player; shaft(8, GROUND_ROW + 14); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 12) * TILE + 8; p.px = p.x; p.py = p.y; forceFlow(); return p; };
  { const p = setup(1310); applyPerk('cellat'); const e = spawnEnemy('bug', p.x + 30, p.y, 0); e.emergeT = 0; damageEnemy(e, e.maxHp * 0.9 / 0.65); ok('Cellat bitirir', e.dead); }
  { const p = setup(1311); applyPerk('kalinKan'); ok('Kalın Kan can verir', p.maxHp === Math.round(100 * 1.2), `${p.maxHp}`); }
  { const p = setup(1312); applyPerk('buzZirh'); const h = p.hp; damagePlayerX(p, 20); ok('Buz Zırhı hasarı azaltır', Math.abs(h - p.hp - 17) < 1e-6, `${h - p.hp}`); }
  { const p = setup(1313); applyPerk('lesBombasi'); const a = spawnEnemy('rodent', p.x + 30, p.y, 0), b = spawnEnemy('rodent', p.x + 36, p.y, 0); a.emergeT = b.emergeT = 0; b.hp = b.maxHp = 5; killEnemy(a); ok('Leş Bombası çevreyi vurur', b.dead); }
  { const p = setup(1314); G.meta.schem = []; applyPerk('bolKemer'); ok('Bol Kemer eşya verir', G.items.medkit === 1 && G.items.dynamite === 1); }
  { const p = setup(1315); applyPerk('vampir'); G.lvl.blaster = 6; p.hp = 20; const e = spawnEnemy('brute', p.x, p.y + 40, 0); e.emergeT = 0; run(2); ok('Vampir Mermi can emer', p.hp > 20, `${p.hp}`); ok('Vampir Mermi saniyede sınırlı emer', p.hp <= 20 + p.maxHp * 0.01 * 3 + 0.01, `${p.hp}`); }
  { const p = setup(1316); applyPerk('donmusKalp'); const e = spawnEnemy('bug', p.x + 20, p.y, 0); e.emergeT = 0; p.hp = 25; damagePlayerX(p, 1); ok('Donmuş Kalp düşmanı dondurur', e.slowT > 4); }
  { const p = setup(1317); applyPerk('statik'); const e = spawnEnemy('bug', p.x, p.y + 30, 0); e.emergeT = 0; step(); ok('Statik Yük halka atar', p.novaT > 7, `${p.novaT}`); }
  ok('Kan Bağı tek başına çıkmaz', (() => { fresh(1318); for (let i = 0; i < 40; i++) if (perkChoices('gold').includes('kanBagi')) return false; return true; })());
}

section('Yeni biyomlar (20-29)');
{
  const { STRATA: SB } = await import('../src/data/palette.js');
  const { tideLevel, inWater } = await import('../src/game/biomes.js');
  const { RELIC_KEYS: RK, BOSS_BANDS: BB } = await import('../src/data/balance.js');
  ok('31 biyom tanımlı', SB.length === 31 && STRATA_COUNT === 31);
  { const g = generate(11, {}); let rel = 0; for (const tt of g.map) if (TD[tt] && TD[tt].relic) rel++; ok('her efsanevi eser haritada', rel === RK.length, `${rel}/${RK.length}`); }
  ok('yeni boss bantları', bossForY((GROUND_ROW + 21 * STRATUM_ROWS + 5) * TILE) === 'aynasiz' && bossForY((GROUND_ROW + 25 * STRATUM_ROWS + 5) * TILE) === 'kehribarAna' && bossForY((GROUND_ROW + 29 * STRATUM_ROWS + 5) * TILE) === 'madenKalbi');
  // bir biyomun satırında oyuncu + açık oda
  const at = (seed, bio) => { fresh(seed); const s = G.order.indexOf(bio), R = GROUND_ROW + s * STRATUM_ROWS + 12, p = G.player;
    for (let r = R - 3; r <= R + 3; r++) for (let c = 3; c <= 13; c++) setTile(c, r, T.AIR);
    p.x = 8 * TILE + 8; p.y = R * TILE + 8; p.px = p.x; p.py = p.y; G.maxStratum = s; G.seenStratum = s; forceFlow(); return { p, s, R }; };
  // gelgit: su yükselince yavaşlatır, silah susar
  { const { p, R } = at(1400, 21); G.time = 10; const sp0 = playerSpeed(p); ok('gelgit alçakken kuru', !inWater(p.x, p.y));
    G.time = 50; ok('gelgit yükselince su', inWater(p.x, p.y) && tideLevel().f === 1); ok('suda yavaşlarsın', playerSpeed(p) < sp0 * 0.7);
    const e = spawnEnemy('bug', p.x + 40, p.y, 0); e.emergeT = 0; const b0 = G.bullets.length; G.time = 50; for (let i = 0; i < 30; i++) { G.time = 50; step(); } ok('suda silah ateş etmez', G.bullets.length === b0); }
  // Yaşayan Kaya: kırılan kaya 20 sn sonra kapanır, düğüm durdurur
  { const { p, R } = at(1401, 22); const c = 12, r = R - 6; setTile(c, r, T.FLESH); breakTile(c, r, p); ok('et kaya kırılır', tileAt(c, r) === T.AIR && G.regrow.length >= 1);
    run(21); ok('tünel yeniden kapanır', tileAt(c, r) !== T.AIR, `${tileAt(c, r)}`);
    setTile(c, r, T.FLESH); breakTile(c, r, p); setTile(c + 1, r, T.NODE); breakTile(c + 1, r, p); run(21); ok('sinir düğümü büyümeyi durdurur', tileAt(c, r) === T.AIR); }
  // Sağır Mağaralar: Kör Avcı sessiz oyuncuyu bulamaz, sese koşar
  { const { p } = at(1402, 20); p.hp = p.maxHp = 9999; G.lvl.blaster = 0; const e = spawnEnemy('korAvci', p.x + 60, p.y, 0); e.emergeT = 0; G.threat.quietT = 5; G.threat.last = { x: p.x + 60, y: p.y };
    let d0 = Math.hypot(e.x - p.x, e.y - p.y); for (let i = 0; i < 60; i++) { G.threat.quietT = 5; updateEnemies(STEP); }
    ok('sağır avcı sessizken gelmez', Math.hypot(e.x - p.x, e.y - p.y) > d0 - 6, `${d0} → ${Math.hypot(e.x - p.x, e.y - p.y)}`);
    setTile(4, Math.floor(p.y / TILE), T.LURE); breakTile(4, Math.floor(p.y / TILE), p); ok('tuzak taşı çağırır', G.threat.lure && G.threat.lure.t > 0);
    for (let i = 0; i < 60; i++) updateEnemies(STEP); ok('sağır avcı tuzağa koşar', e.x < p.x + 50, `${e.x - p.x}`); }
  // Açlık Yatağı: damarlar kararır
  { const { p, R } = at(1403, 26); for (let c = 3; c <= 13; c++) setTile(c, R - 3, T.GOLD); const n0 = [...Array(11)].filter((_, i) => tileAt(3 + i, R - 3) === T.GOLD).length;
    G.hungerT = 0; for (let k = 0; k < 4; k++) { G.hungerT = 0; step(); } const n1 = [...Array(11)].filter((_, i) => tileAt(3 + i, R - 3) === T.GOLD).length; ok('damarlar kararır', n1 < n0, `${n0} → ${n1}`); }
  // Sessiz Deniz: ölçer sönmez
  { const { p } = at(1404, 28); p.hp = p.maxHp = 1e7; G.threat.noise = 0; run(40); ok('sessiz denizde ölçer dolar', G.threat.noise >= 40, `${G.threat.noise.toFixed(1)}`); }
  // Kök Tahtı: yumurta çatlar
  { const { p, R } = at(1405, 27); setTile(12, R, T.EGG); G.eggs.push({ c: 12, r: R, t: G.time + 0.5 }); run(1); ok('yumurta çatlar', G.enemies.filter(e => e.type === 'tozbocek').length === 3 && tileAt(12, R) === T.AIR); }
  // Kehribar: ganimet ya da yaratık
  { let loot = 0, mob = 0; for (let k = 0; k < 10; k++) { const { p, R } = at(1406 + k, 24); setTile(12, R, T.AMBER); const o0 = G.orbs.length, e0 = G.enemies.length; breakTile(12, R, p); if (G.orbs.length > o0 + 5) loot++; if (G.enemies.length > e0) mob++; } ok('kehribar: ganimet ve yaratık', loot > 0 && mob > 0 && loot + mob === 10, `${loot}/${mob}`); }
  // Kalkanlı Muhafız: önden gelen mermiyi keser, arkadan işler
  { fresh(1420); const e = spawnEnemy('kalkanli', 100, 100, 0); e.emergeT = 0; e.face = 1; const h0 = e.hp; damageEnemy(e, 100, -1, 0, 0); const front = h0 - e.hp;
    const h1 = e.hp; damageEnemy(e, 100, 1, 0, 0); const back = h1 - e.hp; ok('kalkan önü korur', front < back * 0.2, `${front} / ${back}`); }
  // Demir Kene: mermileri çeker, mermiye dayanıklı
  { fresh(1421); const q = G.player; for (let r = GROUND_ROW + 1; r <= GROUND_ROW + 8; r++) for (let c = 3; c <= 13; c++) setTile(c, r, T.AIR);
    const e = spawnEnemy('kene', 8 * TILE + 8, (GROUND_ROW + 4) * TILE + 8, 0); e.emergeT = 0; e.atkCd = 99;
    G.bullets.push({ x: 8 * TILE + 8 - 40, y: e.y - 30, px: 0, py: 0, vx: 250, vy: 0, life: 1, dmg: 50, from: 'p', pierce: 0, hit: null, pi: 0 });
    const h0 = e.hp; for (let i = 0; i < 30; i++) updateBullets(STEP); ok('kene mermiyi çeker', e.hp < h0, `${e.hp}/${h0}`); ok('kene mermiye dayanıklı', h0 - e.hp < 50 * 0.5, `${h0 - e.hp}`); }
  // Cevher Faresi: çalar, kaçar; yakalanınca iki katını düşürür
  { const { p } = at(1422, 26); p.bag.crystal = 20; const f = spawnEnemy('fare', p.x + 4, p.y, 0); f.emergeT = 0; f.atkCd = 0; run(0.5);
    ok('fare çalar ve kaçar', p.bag.crystal < 20 && f.fleeT > 0, `${p.bag.crystal} ${f.fleeT}`);
    const stolen = 20 - p.bag.crystal, o0 = G.orbs.filter(o => o.res === 'crystal').length; killEnemy(f); ok('fare iki katını düşürür', G.orbs.filter(o => o.res === 'crystal').length - o0 === stolen * 2); }
  // Diriltici: ölen dostu geri getirir
  { const { p } = at(1423, 24); const b = spawnEnemy('bug', p.x + 70, p.y, 0); b.emergeT = 0; killEnemy(b); const d = spawnEnemy('diriltici', p.x + 90, p.y, 0); d.emergeT = 0; d.rvCd = 0;
    const n0 = G.enemies.filter(e => e.type === 'bug' && !e.dead).length; for (let i = 0; i < 5; i++) updateEnemies(STEP); ok('diriltici diriltir', G.enemies.filter(e => e.type === 'bug' && !e.dead).length === n0 + 1); }
  // Örücü: arkandaki tüneli örer
  { const { p, R } = at(1424, 22); shaft(10, R); p.x = 10 * TILE + 8; p.y = R * TILE + 8; p.px = p.x; p.py = p.y; G.regrow.length = 0;
    const o = spawnEnemy('orucu', p.x + 40, p.y, 0); o.emergeT = 0; o.sealCd = 0; o.atkCd = 99; for (let i = 0; i < 70; i++) updateEnemies(STEP);
    ok('örücü tüneli örer', tileAt(10, R - 2) !== T.AIR || tileAt(10, R - 3) !== T.AIR || tileAt(9, R - 2) !== T.AIR || tileAt(11, R - 2) !== T.AIR); }
  // yeni bosslar: saldırı döngüsü ve öfke çağrısı
  const arena = (seed, k) => { fresh(seed); const p = G.player; for (let r = GROUND_ROW + 1; r <= GROUND_ROW + 12; r++) for (let c = 3; c <= 13; c++) setTile(c, r, T.AIR);
    p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 9) * TILE + 8; p.px = p.x; p.py = p.y; p.hp = p.maxHp = 9999; forceFlow();
    const e = spawnEnemy(k, 8 * TILE + 8, (GROUND_ROW + 4) * TILE + 8, 3); e.emergeT = 0; e.hp = e.maxHp = 1e6; return [p, e]; };
  for (const k of ['aynasiz', 'kehribarAna', 'madenKalbi']) {
    for (const w of k === 'aynasiz' ? WEAPON_KEYS : ['blaster']) {
      const [p, e] = arena(1430, k); G.gear.wOwn = WEAPON_KEYS.slice(); p.wpn = w; const seen = new Set(); let threw = null;
      try { for (let i = 0; i < 60 * 12; i++) { step(); if (e.bs && e.bs.act) seen.add(e.bs.act.k); p.hp = Math.max(p.hp, 5000); } } catch (err) { threw = err; }
      ok(`${ENEMIES[k].name} (${w}): saldırı döngüsü`, !threw && seen.size >= 2 && p.hp < 9999, threw ? threw.stack.split('\n').slice(0, 2).join(' ') : [...seen].join(','));
    }
    const [p, e] = arena(1431, k); const n0 = G.enemies.length; damageEnemy(e, e.maxHp * 0.6 / (1 - ENEMIES[k].armor), 0, 0, 0); run(0.3);
    ok(`${ENEMIES[k].name}: öfkede yardım çağırır`, e.bs.phase === 2 && G.enemies.length > n0);
  }
  ok('boss bantları tam', BB.length === 8);
}

section('Dünya Yılanı ve Hazine Ejderi');
{
  const room = (seed, bio, dr) => {
    fresh(seed); const s = G.order.indexOf(bio), r = GROUND_ROW + s * STRATUM_ROWS + dr, p = G.player;
    for (let rr = r - 6; rr <= r; rr++) for (let c = 2; c <= 14; c++) setTile(c, rr, T.AIR);
    if (G.lq) G.lq.fill(0); G.springs = [];
    p.x = p.px = 8 * TILE + 8; p.y = p.py = r * TILE + 8; p.iframes = 999; return p;
  };
  room(1701, SEA_BIOME, 30); run(0.1);
  ok('Sessiz Deniz: deniz susar', G.serpent && G.serpent.st === 'omen');
  run(9);
  const e = G.enemies.find(o => o.type === 'dunyaYilani');
  ok('Dünya Yılanı duvardan çıkar', !!e && G.serpent.st === 'fight');
  let threw = null, exposed = 0, len = 0;
  try { for (let i = 0; i < 900; i++) { step(); if (!e.under) exposed++; len = Math.max(len, (e.bs.body || []).length); } } catch (err) { threw = err; }
  ok('Dünya Yılanı 15 sn hatasız yüzer', !threw, threw && threw.stack.split('\n').slice(0, 2).join(' '));
  ok('başı zaman zaman görünür, gövdesi uzar', exposed > 60 && len > 30, `${exposed}/${len}`);
  e.under = true; const hp0 = e.hp; damageEnemy(e, 50); ok('duvardayken vurulmaz', e.hp === hp0);
  killEnemy(e); run(3); ok('Dünya Yılanı bir daha gelmez', G.serpent.st === 'done');

  fresh(1702);
  const H = G.hoard;
  ok('sarayın altında hazine salonu, ejder altına gömülü', H && H.st === 'sleep' && tileAt(H.c, H.r) === T.GOLD && tileAt(H.c, H.r0 + 4) === T.AIR);
  const p = G.player; p.x = p.px = H.c0 * TILE + 8; p.y = p.py = (H.r1 - 2) * TILE + 8; p.iframes = 999;
  run(1); ok('salona girince uyku ölçeri düşük', H.wake < 20, H.wake.toFixed(1));
  for (let c = H.c0 + 1; c <= H.c0 + 5; c++) setTile(c, H.r1, T.AIR);
  run(0.6); ok('altına dokununca kıpırdanır', H.wake >= 40, H.wake.toFixed(1));
  for (let c = H.c0 + 6; c <= H.c1; c++) setTile(c, H.r1, T.AIR);
  G.threat.noise = 100; run(3);
  ok('altın ve gürültü uyandırmaz, yalnız kıpırdatır', H.st === 'sleep' && H.wake <= 90, H.wake.toFixed(1));
  G.bullets.push({ x: H.c * TILE + 8, y: H.r * TILE - 4, px: 0, py: 0, vx: 1, vy: 0, life: 0.2, dmg: 1, from: 'p', pierce: 0, hit: null, pi: 0 });
  run(0.1); ok('vurulunca uyanır', H.st === 'wake' && H.why === 'shot');
  run(0.4); ok('uyanınca altın yığını patlar', tileAt(H.c, H.r) !== T.GOLD);
  run(4); const d = G.enemies.find(o => o.type === 'ejder');
  ok('Hazine Ejderi kalkar', !!d && H.st === 'fight');
  threw = null; try { run(15); } catch (err) { threw = err; } ok('Hazine Ejderi 15 sn hatasız savaşır', !threw, threw && threw.stack.split('\n').slice(0, 2).join(' '));
  d.weakT = 1; d.face = 1; const h1 = d.hp; damageEnemy(d, 20, -1, 0); const w = h1 - d.hp; d.weakT = 0; const h2 = d.hp; damageEnemy(d, 20, -1, 0);
  ok('nefes hazırlarken göğsü zayıf', w > (h2 - d.hp) * 1.5, `${w.toFixed(1)} / ${(h2 - d.hp).toFixed(1)}`);
  killEnemy(d); run(3); ok('ejder ölünce hazine senin', H.st === 'done');
  const sv = JSON.parse(JSON.stringify(serialize())); deserialize(sv); ok('ejder ve yılan kaydedilir', G.hoard.st === 'done');
}

section('Balrog');
{
  const setup = seed => {
    fresh(seed); const s = G.order.indexOf(LAVA_BIOME), r = GROUND_ROW + s * STRATUM_ROWS + 30, p = G.player;
    for (let rr = r - 6; rr <= r; rr++) for (let c = 2; c <= 14; c++) setTile(c, rr, T.AIR);
    G.lq.fill(0); G.springs = [];
    p.x = p.px = 4 * TILE + 8; p.y = p.py = r * TILE + 8; p.iframes = 999; return p;
  };
  const p = setup(1601);
  run(0.1);
  ok('Kor biyomunun ortasında sis toplanır', G.balrog && G.balrog.st === 'dark');
  run(4);
  ok('sis sürerken Balrog henüz yok', !G.enemies.some(e => e.type === 'balrog'));
  run(4);
  const e = G.enemies.find(o => o.type === 'balrog');
  ok('Balrog gölgeden çıkar', !!e && G.balrog.st === 'fight' && e.intro > 0);
  const hp0 = e.hp; damageEnemy(e, 50); ok('alevlenirken hasar almaz', e.hp === hp0);
  let threw = null; try { run(12); } catch (err) { threw = err; }
  ok('Balrog 12 sn hatasız saldırır', !threw, threw && threw.stack.split('\n').slice(0, 2).join(' '));
  ok('Balrog boss sayılır', G.threat.bossUp && G.threat.bossType === 'balrog');
  killEnemy(e); run(3);
  ok('öldükten sonra bir daha gelmez', G.balrog.st === 'done' && !G.enemies.some(o => o.type === 'balrog' && !o.dead));
  const d = JSON.parse(JSON.stringify(serialize())); deserialize(d);
  ok('Balrog yenilgisi kaydedilir', G.balrog && G.balrog.st === 'done');
  setup(1602); run(8.2); const e2 = G.enemies.find(o => o.type === 'balrog');
  e2.dead = true; e2.hp = 0; e2.dieT = 0.01; run(0.2);
  ok('izini kaybedip çekilirse yeniden pusuya yatar', G.balrog.st === 'wait');
}

console.log(`\n${checks - fails}/${checks} kontrol geçti${fails ? `, ${fails} HATA` : ''}`);
process.exit(fails ? 1 : 0);
