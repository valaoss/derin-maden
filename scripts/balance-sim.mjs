// Headless denge simülasyonu: gerçek oyun modülleri, DOM yok.
// Senaryo: oyuncu her katmana bir şaft açar, üste döner ve savunur. Dalga başına üs canı/süre raporlanır.
// Kullanım: node scripts/balance-sim.mjs [tekrar=20]   (AWAY=1: oyuncu derinde, sadece taretler savunur)
import { App, G } from '../src/game/state.js';
import { newRun, recompute } from '../src/game/run.js';
import { updatePlayer, updateOrbs, updateDeposit, bindEnemyDamage } from '../src/game/player.js';
import { updateEnemies, damageEnemy } from '../src/game/enemies.js';
import { updatePlayerGun, updateBullets, updateStructures, updateShells } from '../src/game/combat.js';
import { updateItems } from '../src/game/items.js';
import { updateHazards } from '../src/game/hazards.js';
import { updateWaves } from '../src/game/waves.js';
import { updateParticles, updateFlashes } from '../src/game/fx.js';
import { updateFlow, forceFlow } from '../src/world/flow.js';
import { setTile } from '../src/world/map.js';
import { makeStructure } from '../src/game/run.js';
import { on } from '../src/core/events.js';

App.settings = { sfx: false, music: false, haptics: false, shake: false };
App.meta = { lv: {}, tutorialDone: true };
bindEnemyDamage(damageEnemy);
let baseDown = false;
on('baseDown', () => { baseDown = true; });

const RUNS = +process.argv[2] || 20, STEP = 1 / 60;
const table = {};
for (let run = 0; run < RUNS; run++) {
  newRun({ seed: 1000 + run });
  baseDown = false;
  // oyuncu ilerledikçe güçlenir (kabaca beklenen tempo)
  const plan = [
    { wave: 1, depth: 14, lvl: { blaster: 0 }, turrets: 0 },
    { wave: 3, depth: 26, lvl: { blaster: 1 }, turrets: 1 },
    { wave: 5, depth: 40, lvl: { blaster: 2, armor: 1 }, turrets: 2 },
    { wave: 7, depth: 58, lvl: { blaster: 3, armor: 2 }, turrets: 3 },
    { wave: 9, depth: 80, lvl: { blaster: 4, armor: 3 }, turrets: 4 },
  ];
  let dug = 0;
  const p = G.player; p.inp = p.inp || { x: 0, y: 0, mag: 0 };
  for (let w = 1; w <= 12 && !baseDown; w++) {
    const stage = plan.filter(s => s.wave <= w).pop();
    Object.assign(G.lvl, stage.lvl); recompute();
    while (G.structures.length < stage.turrets) G.structures.push(makeStructure('turret', G.structures.length));
    for (; dug < stage.depth; dug++) setTile(11, 6 + dug, 0);
    G.maxStratum = Math.min(9, Math.floor(stage.depth / 36));
    // oyuncu üs yanında
    if (process.env.AWAY) { p.x = 40; p.y = 104 * 16; } else { p.x = 170; p.y = 86; } p.dead = false;
    G.wave.t = 14.1; G.wave.phase = 'calm';
    forceFlow();
    let t = 0;
    const hp0 = G.base.hp;
    while (!baseDown && t < 150) {
      G.time += STEP; t += STEP;
      if (G.hitstop > 0) { G.hitstop -= STEP; continue; }
      updateFlow(STEP); updatePlayer(STEP); updatePlayerGun(STEP); updateEnemies(STEP); updateBullets(STEP);
      updateStructures(STEP); updateShells(STEP); updateItems(STEP); updateHazards(STEP); updateWaves(STEP); updateOrbs(STEP); updateDeposit(STEP); updateParticles(STEP); updateFlashes(STEP);
      if (G.wave.phase === 'calm' && t > 20) break;
    }
    if (process.env.DEBUG && t >= +process.env.DEBUG) console.log('takılma dalga', w, 'seed', 1000 + run, G.enemies.map(e => `${e.type}@${Math.floor(e.x/16)},${Math.floor(e.y/16)}:${e.st}`).join(' '));
    const row = table[w] || (table[w] = { n: 0, lost: 0, dmg: 0, time: 0, deaths: 0 });
    row.n++; row.dmg += hp0 - G.base.hp; row.time += t; if (baseDown) row.lost++;
    if (p.dead) row.deaths++;
    G.base.hp = Math.min(G.base.maxHp, G.base.hp + 60); // dalga arası onarım varsayımı
  }
}
console.log('dalga | koşu | üs kaybı | ort. üs hasarı | ort. süre(s) | oyuncu bayıldı');
for (const w in table) {
  const r = table[w];
  console.log(`${String(w).padStart(5)} | ${String(r.n).padStart(4)} | ${String(r.lost).padStart(8)} | ${(r.dmg / r.n).toFixed(0).padStart(14)} | ${(r.time / r.n).toFixed(0).padStart(12)} | ${r.deaths}`);
}
