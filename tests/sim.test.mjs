// Headless oyun testleri: gerçek modüller, DOM yok. Kullanım: node tests/sim.test.mjs
import { App, G } from '../src/game/state.js';
import { newRun, recompute, serialize, deserialize, pickDmg, pickInterval, modSlots, makeStructure } from '../src/game/run.js';
import { updatePlayer, updateOrbs, updateDeposit, bindEnemyDamage, breakTile } from '../src/game/player.js';
import { updateEnemies, damageEnemy, spawnEnemy, killEnemy } from '../src/game/enemies.js';
import { updatePlayerGun, updateBullets, updateStructures, updateShells, useMod } from '../src/game/combat.js';
import { buyUpgrade, buyMod, toggleMod, upgradeCost } from '../src/game/economy.js';
import { updateItems } from '../src/game/items.js';
import { updateHazards } from '../src/game/hazards.js';
import { updateWaves } from '../src/game/waves.js';
import { updateParticles, updateFlashes } from '../src/game/fx.js';
import { updateFlow, forceFlow } from '../src/world/flow.js';
import { setTile, tileAt } from '../src/world/map.js';
import { generate } from '../src/world/gen.js';
import { T, TD, HOST_TILE } from '../src/data/tiles.js';
import { ENEMIES, MODS, MOD_KEYS, PICK_TIERS, UPGRADES, WAVES, ELITE, RES_KEYS } from '../src/data/balance.js';
import { STRATA } from '../src/data/palette.js';
import { COLS, ROWS, GROUND_ROW, STRATUM_ROWS, STRATA_COUNT, TILE } from '../src/config.js';
import { on } from '../src/core/events.js';

App.settings = { sfx: false, music: false, haptics: false, shake: false };
App.meta = { lv: {}, tutorialDone: true };
bindEnemyDamage(damageEnemy);
let baseDown = false; on('baseDown', () => { baseDown = true; });
const events = {}; for (const n of ['heart', 'web', 'chill', 'stratum', 'modChanged', 'modUsed', 'perkOffer', 'toast']) on(n, () => { events[n] = (events[n] || 0) + 1; });

const STEP = 1 / 60;
let fails = 0, checks = 0;
const ok = (name, cond, info = '') => { checks++; if (!cond) { fails++; console.log('  ✗', name, info); } };
const section = n => console.log('\n## ' + n);
const finite = v => Number.isFinite(v);
function step(dt = STEP) {
  G.time += dt; G.stats.time += dt; G.frame++;
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  updateFlow(dt); updatePlayer(dt); updatePlayerGun(dt); updateEnemies(dt); updateBullets(dt); updateStructures(dt); updateShells(dt);
  updateItems(dt); updateHazards(dt); updateWaves(dt); updateOrbs(dt); updateDeposit(dt); updateParticles(dt); updateFlashes(dt);
}
const run = sec => { for (let i = 0, n = Math.round(sec / STEP); i < n; i++) step(); };
const fresh = (seed = 1) => { const g = newRun({ seed }); baseDown = false; g.player.inp = { x: 0, y: 0, mag: 0 }; return g; };
const shaft = (c, toRow) => { for (let r = GROUND_ROW; r <= toRow; r++) setTile(c, r, T.AIR); };
function hash() {
  let h = 2166136261; const mix = v => { v = Math.round(v * 8) | 0; for (let s = 0; s < 24; s += 8) { h ^= (v >>> s) & 255; h = Math.imul(h, 16777619); } };
  for (const p of G.players) { mix(p.x); mix(p.y); mix(p.hp); mix(p.dead ? 1 : 0); }
  mix(G.base.hp); mix(G.rng); mix(G.wave.num); mix(G.stats.dug); mix(G.stats.kills); mix(G.enemies.length); mix(G.mapVersion);
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
      if (t === HOST_TILE[s]) ps.host++;
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
  ok('ana kaya sertliği artar', hp(0) < hp(3) && hp(3) < hp(6) && hp(6) < hp(8) && hp(8) < hp(9), HOST_TILE.map((_, i) => hp(i)).join(','));
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

// ---------- 4. dalgalar ----------
section('Dalga kuyruğu');
{
  const seen = new Set(), sizes = [];
  for (let st = 0; st < STRATA_COUNT; st += 3) for (let w = 1; w <= 15; w++) {
    fresh(100 + st * 20 + w); G.maxStratum = st; G.wave.num = w - 1; G.wave.phase = 'calm'; G.wave.t = 0.01;
    for (let i = 0; i < 60 * 12 && G.wave.phase !== 'active'; i++) step();
    ok(`dalga ${w} başlar (biyom ${st})`, G.wave.phase === 'active' && G.wave.num === w, G.wave.phase);
    const q = G.wave.queue || [];
    const boss = w % 5 === 0;
    ok(`dalga ${w} boss ${boss ? 'var' : 'yok'}`, q.some(s => s.type === 'boss') === boss);
    const elites = q.filter(s => s.elite).length;
    ok(`dalga ${w} elit`, elites === (w >= ELITE.fromWave && !boss ? 1 : 0), `${elites}`);
    ok(`dalga ${w} türleri geçerli`, q.every(s => ENEMIES[s.type]));
    ok(`dalga ${w} izinli türler`, q.every(s => s.type === 'boss' || WAVES.allowed(w, st).includes(s.type)));
    ok(`dalga ${w} yeterince kalabalık`, q.length >= (boss ? 3 + w * 0.3 : 4 + w * 0.6), `${q.length}`);
    sizes.push(`${st}/${w}:${q.length}`);
    q.forEach(s => seen.add(s.type));
  }
  console.log('  kuyruk boyları (biyom/dalga:adet):', sizes.join(' '));
  const never = Object.keys(ENEMIES).filter(k => !seen.has(k));
  ok('her tür bir dalgada çıkar', never.length === 0, never.join(','));
}

// ---------- 5. yaratıklar ----------
section('Yaratıklar');
{
  for (const type of Object.keys(ENEMIES)) {
    fresh(300); const p = G.player; p.x = 170; p.y = 86; G.wave.num = 6; G.wave.phase = 'active'; G.wave.t = 99;
    shaft(8, GROUND_ROW + 12); forceFlow();
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
  fresh(302); const p = G.player; p.x = 170; p.y = 86; G.wave.phase = 'active'; G.wave.t = 99;
  const sp = spawnEnemy('spider', 170 + 40, 86, 6); sp.emergeT = 0; run(6);
  ok('örümcek ağ atar', p.webT > 0 || events.web > 0, `webT ${p.webT}`);
  const fb = spawnEnemy('frostbat', 170, 70, 6); fb.emergeT = 0; run(6);
  ok('kırağı dondurur', p.slowT > 0 || events.chill > 0, `slowT ${p.slowT}`);
}

// ---------- 6. determinizm ----------
section('Determinizm');
{
  const script = t => t < 10 ? { x: 0, y: 1, mag: 1 } : t < 14 ? { x: 1, y: 0, mag: 1 } : t < 18 ? { x: -1, y: 0.3, mag: 1 } : { x: 0, y: 1, mag: 1 };
  const play = () => {
    fresh(4242); const p = G.player; G.wave.t = 8; let t = 0;
    for (let i = 0; i < 60 * 40; i++) { t += STEP; Object.assign(p.inp, script(t)); step(); }
    return { h: hash(), s: JSON.stringify(serialize()), dug: G.stats.dug, kills: G.stats.kills, wave: G.wave.num };
  };
  const a = play(), b = play();
  ok('aynı tohum + aynı girdi → aynı durum', a.h === b.h && a.s === b.s, `${a.h} vs ${b.h}`);
  ok('oyuncu gerçekten kazdı', a.dug > 8, `${a.dug}`);
  ok('dalga geldi', a.wave >= 1 && a.kills >= 0, `dalga ${a.wave} kills ${a.kills}`);
}

// ---------- 7. kayıt / yükleme ----------
section('Kayıt');
{
  fresh(9); const p = G.player; G.wave.t = 20; Object.assign(p.inp, { x: 0, y: 1, mag: 1 }); run(12);
  for (const k of RES_KEYS) G.store[k] = 50; buyUpgrade('drill', p); buyMod('ricochet', p); buyMod('frost', p); G.structures.push(makeStructure('turret', 1));
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
section('Derin sefer (10 biyom, ~12 dk sim)');
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
      run(20);
      p.x = 170; p.y = 86; Object.assign(p.inp, { x: 0, y: 0, mag: 0 });
      Object.assign(G.lvl, { blaster: Math.min(UPGRADES.blaster.costs.length, s), armor: Math.min(UPGRADES.armor.costs.length, s >> 1), drill: Math.min(PICK_TIERS.length - 1, s) }); recompute();
      while (G.structures.length < Math.min(4, s)) G.structures.push(makeStructure('turret', G.structures.length));
      G.base.hp = G.base.maxHp; G.wave.phase = 'calm'; G.wave.t = 2; forceFlow();
      let t = 0; while (t < 70 && !baseDown) { step(); t += STEP; for (const e of G.enemies) { if (!finite(e.x) || !finite(e.y)) nanAt = e.type; spawnedBy[e.type] = s; } if (G.wave.phase === 'calm' && t > 15) break; }
      G.enemies.length = 0; baseDown = false;
    }
  } catch (e) { threw = e; }
  ok('derin sefer hatasız', !threw, threw && threw.stack.split('\n').slice(0, 3).join(' | '));
  ok('NaN yok', !nanAt, nanAt);
  ok('biyom afişi olayları', stratumEv >= 5, `${stratumEv}`);
  const deep = ['spider', 'frostbat', 'skitter', 'magmite', 'voidling', 'broodmother', 'ogolem'].filter(k => spawnedBy[k] === undefined);
  ok('derin türler sahada görüldü', deep.length <= 2, 'görülmedi: ' + deep.join(','));
  ok('kalp satırı ulaşılabilir', tileAt(8, G.heartRow) !== undefined && TD[tileAt(8, G.heartRow)] && G.heartRow < ROWS - 1);
}

// ---------- 9. performans ----------
section('Performans');
{
  fresh(77); G.wave.phase = 'active'; G.wave.t = 99; const p = G.player; p.x = 170; p.y = 86; shaft(8, GROUND_ROW + 30); forceFlow();
  const types = Object.keys(ENEMIES).filter(k => k !== 'boss');
  for (let i = 0; i < 60; i++) { const e = spawnEnemy(types[i % types.length], 8 * TILE + 8, (GROUND_ROW + 2 + (i % 28)) * TILE + 8, 8); e.emergeT = 0; }
  G.gear.eq = ['chain', 'split', 'boom'];
  const t0 = performance.now(); run(20); const ms = (performance.now() - t0) / (20 * 60);
  console.log(`  60 düşman + eklentiler: ${ms.toFixed(3)} ms/kare (bütçe 16.7)`);
  ok('kare bütçesi', ms < 4, `${ms.toFixed(2)} ms`);
}

console.log(`\n${checks - fails}/${checks} kontrol geçti${fails ? `, ${fails} HATA` : ''}`);
process.exit(fails ? 1 : 0);
