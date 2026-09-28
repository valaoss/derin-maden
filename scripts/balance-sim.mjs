// Headless denge simülasyonu (uyanış döngüsü): oyuncu her biyomda 60 sn kazar, gürültü/seviye/düşman/bayılma raporlanır.
// Kullanım: node scripts/balance-sim.mjs [tekrar=10]
import { App, G } from '../src/game/state.js';
import { newRun, recompute } from '../src/game/run.js';
import { updatePlayer, updateOrbs, updateDeposit, bindEnemyDamage } from '../src/game/player.js';
import { updateEnemies, damageEnemy } from '../src/game/enemies.js';
import { updatePlayerGun, updateBullets, updateStructures, updateShells } from '../src/game/combat.js';
import { updateItems } from '../src/game/items.js';
import { updateHazards } from '../src/game/hazards.js';
import { updateThreat } from '../src/game/threat.js';
import { updateParticles, updateFlashes } from '../src/game/fx.js';
import { updateFlow, forceFlow } from '../src/world/flow.js';
import { setTile } from '../src/world/map.js';
import { UPGRADES, PICK_TIERS } from '../src/data/balance.js';
import { GROUND_ROW, STRATUM_ROWS, STRATA_COUNT, TILE } from '../src/config.js';

App.settings = { sfx: false, music: false, haptics: false, shake: false };
App.meta = { lv: {}, tutorialDone: true };
bindEnemyDamage(damageEnemy);

const RUNS = +process.argv[2] || 10, STEP = 1 / 60;
const rows = [];
for (let run = 0; run < RUNS; run++) {
  newRun({ seed: 1000 + run });
  const p = G.player; p.inp = { x: 0, y: 1, mag: 1 };
  for (let s = 0; s < STRATA_COUNT; s++) {
    const rTop = GROUND_ROW + s * STRATUM_ROWS + 2;
    for (let r = GROUND_ROW; r <= rTop; r++) setTile(8, r, 0);
    p.x = 8 * TILE + 8; p.y = rTop * TILE + 8; p.px = p.x; p.py = p.y; p.hp = p.maxHp; p.dead = false; G.maxStratum = s;
    Object.assign(G.lvl, { blaster: Math.min(UPGRADES.blaster.costs.length, s), armor: Math.min(UPGRADES.armor.costs.length, s >> 1), drill: Math.min(PICK_TIERS.length - 1, s) }); recompute();
    forceFlow();
    const row = rows[s] || (rows[s] = { n: 0, peak: 0, lv2: 0, lv3: 0, lv4: 0, spawned: 0, downs: 0, hpLost: 0 });
    let t = 0, tLv2 = -1, tLv3 = -1, tLv4 = -1, spawned = 0, downs = 0, lost = 0, last = 0;
    while (t < 60) {
      G.time += STEP; t += STEP;
      if (G.hitstop > 0) { G.hitstop -= STEP; continue; }
      updateFlow(STEP); updatePlayer(STEP); updatePlayerGun(STEP); updateEnemies(STEP); updateBullets(STEP);
      updateStructures(STEP); updateShells(STEP); updateItems(STEP); updateHazards(STEP); updateThreat(STEP); updateOrbs(STEP); updateDeposit(STEP); updateParticles(STEP); updateFlashes(STEP);
      if (G.enemies.length > last) spawned += G.enemies.length - last; last = G.enemies.length;
      if (G.threat.level >= 2 && tLv2 < 0) tLv2 = t; if (G.threat.level >= 3 && tLv3 < 0) tLv3 = t; if (G.threat.level >= 4 && tLv4 < 0) tLv4 = t;
      if (p.dead) { downs++; p.dead = false; p.gone = false; p.hp = p.maxHp; G.allDownT = 0; }
      lost = Math.max(lost, p.maxHp - p.hp);
    }
    row.n++; row.peak += G.threat.peak; row.lv2 += tLv2 < 0 ? 60 : tLv2; row.lv3 += tLv3 < 0 ? 60 : tLv3; row.lv4 += tLv4 < 0 ? 60 : tLv4; row.spawned += spawned; row.downs += downs; row.hpLost += lost;
    G.enemies.length = 0; G.threat.noise = 0; G.threat.peak = 0;
  }
}
console.log('biyom | tepe gürültü | uyanış sn | öfke sn | boss sn | düşman/dk | bayılma/dk');
rows.forEach((r, s) => console.log(`${String(s).padStart(5)} | ${(r.peak / r.n).toFixed(0).padStart(12)} | ${(r.lv2 / r.n).toFixed(0).padStart(9)} | ${(r.lv3 / r.n).toFixed(0).padStart(7)} | ${(r.lv4 / r.n).toFixed(0).padStart(7)} | ${(r.spawned / r.n).toFixed(1).padStart(9)} | ${(r.downs / r.n).toFixed(2).padStart(10)}`));
