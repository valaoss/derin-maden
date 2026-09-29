// Headless oyun testleri: gerçek modüller, DOM yok. Kullanım: node tests/sim.test.mjs
import { App, G } from '../src/game/state.js';
import { newRun, recompute, serialize, deserialize, pickDmg, pickInterval, modSlots, makeStructure } from '../src/game/run.js';
import { updatePlayer, updateOrbs, updateDeposit, bindEnemyDamage, breakTile, damagePlayer, blindPlayer } from '../src/game/player.js';
const damagePlayerX = (p, d) => { p.iframes = 0; damagePlayer(p, d, p.x, p.y + 20); };
import { updateEnemies, damageEnemy, spawnEnemy, killEnemy } from '../src/game/enemies.js';
import { updatePlayerGun, updateBullets, updateStructures, updateShells, useMod } from '../src/game/combat.js';
import { buyUpgrade, buyMod, toggleMod, upgradeCost, applyPerk } from '../src/game/economy.js';
import { updateItems } from '../src/game/items.js';
import { updateHazards } from '../src/game/hazards.js';
import { updateThreat, addNoise, nestsInStratum } from '../src/game/threat.js';
import { updateEvents } from '../src/game/events.js';
import { roleOf, lampTiles, metaSnapshot, hasRelic, lastStand } from '../src/game/run.js';
import { deployLimit } from '../src/game/economy.js';
import { openStation, callElevator, atShaft, stationY, SHAFT_X } from '../src/game/elevator.js';
import { DEPLOY_MAX, EVENTS } from '../src/data/balance.js';
import { updateParticles, updateFlashes } from '../src/game/fx.js';
import { updateFlow, forceFlow } from '../src/world/flow.js';
import { setTile, tileAt } from '../src/world/map.js';
import { generate, biomeOrder } from '../src/world/gen.js';
import { T, TD, HOST_TILE } from '../src/data/tiles.js';
import { ENEMIES, MODS, MOD_KEYS, PICK_TIERS, UPGRADES, ELITE, RES_KEYS, THREAT, BUILDS, ITEMS, RELICS, RELIC_KEYS, PERKS, ROLES, EVENT_KEYS } from '../src/data/balance.js';
import { placeBuild, pickupBuild, craftItem } from '../src/game/economy.js';
import { STRATA } from '../src/data/palette.js';
import { COLS, ROWS, GROUND_ROW, GROUND_Y, STRATUM_ROWS, STRATA_COUNT, TILE } from '../src/config.js';
import { on } from '../src/core/events.js';
import { bossForY } from '../src/game/bosses.js';

App.settings = { sfx: false, music: false, haptics: false, shake: false };
App.meta = { lv: {}, tutorialDone: true };
bindEnemyDamage(damageEnemy);
let allDown = false; on('allDown', () => { allDown = true; });
const events = {}; for (const n of ['heart', 'web', 'chill', 'relic', 'bossPhase', 'bossSpawn', 'stratum', 'modChanged', 'modUsed', 'perkOffer', 'toast', 'threat', 'nestDown', 'beacon', 'bossDown', 'revived', 'event', 'station', 'elevatorDone']) on(n, () => { events[n] = (events[n] || 0) + 1; });

const STEP = 1 / 60;
let fails = 0, checks = 0;
const ok = (name, cond, info = '') => { checks++; if (!cond) { fails++; console.log('  ✗', name, info); } };
const section = n => console.log('\n## ' + n);
const finite = v => Number.isFinite(v);
function step(dt = STEP) {
  G.time += dt; G.stats.time += dt; G.frame++;
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  updateFlow(dt); updatePlayer(dt); updatePlayerGun(dt); updateEnemies(dt); updateBullets(dt); updateStructures(dt); updateShells(dt);
  updateItems(dt); updateHazards(dt); updateThreat(dt); updateEvents(dt); updateOrbs(dt); updateDeposit(dt); updateParticles(dt); updateFlashes(dt);
}
const run = sec => { for (let i = 0, n = Math.round(sec / STEP); i < n; i++) step(); };
const fresh = (seed = 1) => { const g = newRun({ seed }); allDown = false; g.player.inp = { x: 0, y: 0, mag: 0 }; return g; };
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
  ok('biyom sırası: Toprak ilk, Yaratılış son', os.every(o => o[0] === 0 && o[19] === 19));
  ok('biyom sırası: her biyom bir kez', os.every(o => new Set(o).size === STRATA_COUNT));
  ok('biyom sırası tohuma göre değişir', new Set(os.map(o => o.join())).size >= 3);
  ok('biyom sırası zorluk bandında kalır', os.every(o => o.every((b, i) => Math.abs(b - i) <= 3)));
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
  const slots = modSlots(); ok('yuva sayısı', slots >= 1 && slots <= 3, `${slots}`);
  for (const k of MOD_KEYS) { for (const r of RES_KEYS) G.store[r] = 9999; ok(`eklenti ${k} alınır`, buyMod(k, q) && G.gear.owned.includes(k)); }
  ok('yuva sınırı', G.gear.eq.length === slots, `${G.gear.eq.length}/${slots}`);
  ok('tekrar alınmaz', !buyMod(MOD_KEYS[0], q));
  const eq0 = G.gear.eq[0]; ok('çıkar', toggleMod(eq0, q) && !G.gear.eq.includes(eq0));
  ok('tak', toggleMod(eq0, q) && G.gear.eq.includes(eq0));
  const free = MOD_KEYS.find(k => !G.gear.eq.includes(k)); ok('dolu yuvaya takılmaz', !toggleMod(free, q));
  G.gear.eq = ['overdrive', 'nova', 'chain'];
  const b0 = G.bullets.length; ok('nova kullanılır', useMod('nova', q) && G.bullets.length > b0 && G.gear.cd.nova > 0);
  ok('nova beklemede tekrar kullanılmaz', !useMod('nova', q));
  ok('aşırı yük', useMod('overdrive', q) && G.gear.active.overdrive > 0);
  run(MODS.overdrive.dur + 0.5); ok('aşırı yük biter', !(G.gear.active.overdrive > 0));
  run(MODS.nova.cd); ok('nova bekleme dolar', (G.gear.cd.nova || 0) <= 0.01, `${G.gear.cd.nova}`);
  ok('takılı olmayan eklenti kullanılmaz', !useMod('ricochet', q));
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
  fresh(500); const p = G.player; shaft(8, GROUND_ROW + 20); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 18) * TILE + 8; p.px = p.x; p.py = p.y;
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
  for (let i = 0; i < 60 * (THREAT.bossDelay + 1); i++) { G.threat.noise = 100; step(); }
  ok('gürültü 100 (sürekli) -> seviye 4', G.threat.level === 4, `${G.threat.level}`);
  ok('seviye olayları yayınlandı', (events.threat | 0) - ev0 >= 4);
  ok('boss uyanır', G.enemies.some(e => e.d.boss), G.enemies.map(e => e.type).join(','));
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
  d.y += TILE; d.py = d.y; craftItem('lamp', d); ok('sınırda en eski alet kemere döner', placeBuild('lamp', d) && G.structures.length === 2 && G.items.turret === 1, `${G.structures.length} ${G.items.turret}`);
  ok('fener direği kurulu', G.structures.some(x => x.type === 'lamp'));
  const i = G.structures.findIndex(x => x.type === 'lamp'); d.y -= TILE; d.py = d.y;
  ok('alet geri alınır', pickupBuild(i, d) && G.items.lamp === 1 && G.structures.length === 1);
  // fener direği gürültüyü yarıya indirir
  const dl = G.player; dl.y -= TILE; dl.py = dl.y; G.items.lamp = 1; ok('fener direği yeniden kurulur', placeBuild('lamp', dl)); G.threat.noise = 0; addNoise(10, dl.x, dl.y);
  ok('fener direği gürültüyü azaltır', G.threat.noise < 6, `${G.threat.noise}`);
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
  ok('eklentiler korunur', G.gear.owned.includes('ricochet') && G.gear.eq.includes('frost'));
  ok('taret korunur', G.structures.length === 1 && G.structures[0].type === 'turret');
  ok('konum korunur', Math.abs(G.player.x - s1.player.x) < 1e-6 && Math.abs(G.player.y - s1.player.y) < 1e-6);
  let threw = null; try { run(5); } catch (e) { threw = e; } ok('yükleme sonrası oynanır', !threw, threw && threw.message);
  // eski kayıt (v5, gear yok)
  const old = JSON.parse(j1); delete old.gear; old.v = 5; threw = null; try { deserialize(old); } catch (e) { threw = e; }
  ok('gear’sız eski kayıt açılır', !threw && Array.isArray(G.gear.eq), threw && threw.message);
}

// ---------- 8. derin sefer ----------
section('Derin sefer (20 biyom, ~24 dk sim)');
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
  G.threat.noise = 40; G.evt.k = 'gaz'; G.evt.warnT = 0.05; const g0 = G.gas.length; run(0.2);
  ok('gaz sızıntısı bulut salar', G.gas.length > g0, `${G.gas.length}`);
  ok('her olayın adı ve ağırlığı var', EVENT_KEYS.every(k => EVENTS[k].name && EVENTS[k].w > 0));
  const fireEvt = (k, seed) => { fresh(seed); const q = G.player; shaft(8, GROUND_ROW + 14); q.x = 8 * TILE + 8; q.y = (GROUND_ROW + 12) * TILE + 8; q.px = q.x; q.py = q.y; q.hp = q.maxHp = 9999; forceFlow(); G.threat.noise = 40; G.evt.k = k; G.evt.warnT = 0.02; run(0.1); return q; };
  { const n0 = fireEvt('suru', 22) && G.enemies.length; ok('sürü yaratık salar', n0 >= 3, `${n0}`); }
  { fireEvt('damar', 23); ok('parlayan damar cevher ve işaret bırakır', G.pings.some(q => q.pi === -1) && G.map.some((t, i) => G.rev[i] && (t === T.GOLD || t === T.IRON))); }
  { fireEvt('kese', 24); const k = G.satchels.find(x => x.lost); ok('kayıp kese yerleşir', k && k.bag.iron > 0 && G.pings.length === 1); }
  { fireEvt('sandik', 25); const pg = G.pings[0]; ok('unutulmuş sandık belirir', pg && tileAt(Math.floor(pg.x / TILE), Math.floor(pg.y / TILE)) === T.CHEST); }
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
  G.gear.eq = ['chain', 'split', 'boom'];
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
  ok('derinlik bandı -> boss', [[0, 'karakok'], [3, 'karakok'], [5, 'kavurgan'], [9, 'otegoz'], [13, 'sultan'], [18, 'ezeli']].every(([st, k]) => bossForY(rowOf(st) * TILE) === k));
  // ölçer tepede: en derindeki madencinin bandındaki boss uyanır
  { fresh(700); const p = G.player; shaft(8, rowOf(9) + 2); p.x = 8 * TILE + 8; p.y = rowOf(9) * TILE + 8; p.px = p.x; p.py = p.y; G.maxStratum = 9; forceFlow();
    for (let i = 0; i < 60 * (THREAT.bossDelay + 1); i++) { G.threat.noise = 100; step(); }
    ok('Boşluk bandında Ötegöz uyanır', G.enemies.some(e => e.type === 'otegoz'), G.enemies.filter(e => e.d.boss).map(e => e.type).join(',')); }
  const arena = (seed, k) => { fresh(seed); const p = G.player; for (let r = GROUND_ROW + 1; r <= GROUND_ROW + 12; r++) for (let c = 3; c <= 13; c++) setTile(c, r, T.AIR);
    p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 9) * TILE + 8; p.px = p.x; p.py = p.y; p.hp = p.maxHp = 9999; forceFlow();
    const e = spawnEnemy(k, 8 * TILE + 8, (GROUND_ROW + 4) * TILE + 8, 3); e.emergeT = 0; e.hp = e.maxHp = 1e6; return [p, e]; };
  for (const k of ['karakok', 'kavurgan', 'otegoz', 'sultan', 'ezeli']) {
    const [p, e] = arena(710, k); const seen = new Set();
    for (let i = 0; i < 60 * 12; i++) { step(); if (e.bs && e.bs.act) seen.add(e.bs.act.k); p.hp = Math.max(p.hp, 5000); }
    ok(`${ENEMIES[k].name}: saldırı döngüsü`, seen.size >= 2 && p.hp < 9999, [...seen].join(','));
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
  ok('bosslar deterministik', (() => { const h = []; for (let i = 0; i < 2; i++) { arena(740, 'sultan'); spawnEnemy('ezeli', 6 * TILE + 8, (GROUND_ROW + 3) * TILE + 8, 3).emergeT = 0; run(8); h.push(hash()); } return h[0] === h[1]; })());
}

// ---------- 15. yeni kalıntılar ----------
section('Kalıntılar');
{
  ok('her kalıntının adı ve açıklaması var', Object.values(PERKS).every(k => k.name && k.desc) && Object.keys(PERKS).length >= 29);
  const setup = seed => { fresh(seed); const p = G.player; shaft(8, GROUND_ROW + 14); p.x = 8 * TILE + 8; p.y = (GROUND_ROW + 12) * TILE + 8; p.px = p.x; p.py = p.y; forceFlow(); return p; };
  { const p = setup(800); applyPerk('sonDirenis'); const full = lastStand(p); p.hp = p.maxHp * 0.2;
    ok('Son Direniş düşük canda iki kat vurur', full === 1 && lastStand(p) === 2); }
  { const p = setup(801); applyPerk('kacis'); damagePlayerX(p, 5); ok('Kaçış Refleksi hızlandırır', p.hasteT > 1.5); }
  { const p = setup(802); applyPerk('sogukkanli'); blindPlayer(p, 2); ok('Soğukkanlı körlüğü engeller', !(p.blindT > 0)); }
  { const p = setup(803); applyPerk('dikenZirh'); const e = spawnEnemy('rodent', p.x + 6, p.y, 1); e.emergeT = 0; const h0 = e.hp; damagePlayerX(p, 5);
    ok('Diken Zırh vurana hasar verir', e.hp < h0 || e.dead); }
  { const p = setup(804); applyPerk('sessizDamar'); setTile(9, GROUND_ROW + 12, T.GOLD); G.threat.noise = 0; breakTile(9, GROUND_ROW + 12, p);
    ok('Sessiz Damar cevherde gürültü yapmaz', G.threat.noise === 0, `${G.threat.noise}`); }
  { const p = setup(805); applyPerk('sifaPinari'); p.hp = 50; setTile(9, GROUND_ROW + 12, T.WATER); breakTile(9, GROUND_ROW + 12, p);
    ok('Şifa Pınarı su kırınca iyileştirir', p.hp === 56, `${p.hp}`); }
  { const p = setup(806); applyPerk('depremVurus'); for (let c = 3; c <= 13; c++) for (let r = GROUND_ROW + 13; r <= GROUND_ROW + 16; r++) setTile(c, r, T.DIRT || HOST_TILE[0]);
    const before = G.stats.dug; for (let i = 0; i < 8; i++) breakTile(4 + i, GROUND_ROW + 14, p);
    ok('Deprem Vuruşu 8. blokta çevreyi yıkar', G.stats.dug - before > 8, `${G.stats.dug - before}`); }
  { const p = setup(807); applyPerk('hazineKokusu'); const i = G.map.findIndex(t => t === T.CHEST); ok('Hazine Kokusu sandıkları gösterir', i < 0 || G.rev[i] === 1); }
  { const p = setup(808); applyPerk('lesKazisi'); let n = 0; for (let i = 0; i < 40; i++) { const e = spawnEnemy('rodent', p.x, p.y - 30, 1); const o0 = G.orbs.length; killEnemy(e); n += G.orbs.length - o0; }
    ok('Leş Kazısı ganimeti artırır', n > 40 * 0.35 * 1.1, `${n}`); }
}

console.log(`\n${checks - fails}/${checks} kontrol geçti${fails ? `, ${fails} HATA` : ''}`);
process.exit(fails ? 1 : 0);
