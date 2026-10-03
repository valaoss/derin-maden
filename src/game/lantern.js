// Fener yağı ve mahsur madenciler.
// Yağ yer altında azalır (ekip ortak), kampta kendiliğinden dolar; biterken kemerdeki Fener Yağı kendiliğinden açılır.
// Yağ da şişe de bitince karanlık: görüş tek bloğa iner, düşman daha sert vurur, maden seni duymaya başlar.
import { TILE, COLS, ROWS, GROUND_ROW, GROUND_Y, stratumOfRow } from '../config.js';
import { T } from '../data/tiles.js';
import { OIL, MINERS } from '../data/balance.js';
import { G, App } from './state.js';
import { addNoise } from './threat.js';
import { ring, sparks, flashLight } from './fx.js';
import { sfx } from '../audio/audio.js';
import { emit } from '../core/events.js';

export const rescued = k => !!(G.meta.rescued && G.meta.rescued.includes(k));
export const oilMax = () => (OIL.full + OIL.perLamp * G.lvl.lamp) * (rescued('ece') ? OIL.ece : 1);
export const isDark = () => !G.tutorial && G.oil <= 0;
export function refillOil() { G.oil = oilMax(); G.oilWarn = false; G.dark = false; }

export function updateLantern(dt) {
  if (G.tutorial || G.over) return;
  const live = G.players.filter(p => !p.dead && !p.gone), max = oilMax();
  if (G.oil > max) G.oil = max;
  // kampta dolar
  if (live.some(p => p.y < GROUND_Y) && G.oil < max) { G.oil = Math.min(max, G.oil + max * dt / OIL.campFill); if (G.oil > max * OIL.low) G.oilWarn = false; G.dark = false; }
  const down = live.filter(p => p.y >= GROUND_Y + TILE);
  if (down.length) {
    G.oil = Math.max(0, G.oil - dt);
    if (G.oil <= max * OIL.low && !G.oilWarn) { G.oilWarn = true; emit('oilLow', G.items.yag | 0); }
    if (G.oil <= 0) {
      if ((G.items.yag | 0) > 0) {
        G.items.yag--; refillOil();
        for (const p of down) { ring(p.x, p.y, '#ffd890', 26); sparks(p.x, p.y - 6, '#ffe79a', 10, 80); flashLight(p.x, p.y, 6, 0.4); }
        sfx.heal(); emit('oilAuto', G.items.yag | 0);
      } else {
        if (!G.dark) { G.dark = true; sfx.shade(); emit('dark'); }
        const p = down[0]; addNoise(OIL.noise * dt, p.x, p.y);
      }
    }
  }
  updateCages(dt, live);
}

// ---------- mahsur madenciler ----------
function cages() {
  if (!G.cages) { G.cages = []; for (let i = GROUND_ROW * COLS; i < COLS * ROWS; i++) if (G.map[i] === T.CAGE) G.cages.push({ c: i % COLS, r: (i / COLS) | 0, near: false }); }
  return G.cages;
}
// yaklaşınca kafes haritada belirir ve içerideki kayaya vurur
function updateCages(dt, live) {
  if ((G.cageT = (G.cageT || 0) - dt) > 0) return;
  G.cageT = 1.4;
  for (const k of cages()) {
    if (G.map[k.r * COLS + k.c] !== T.CAGE) continue;
    const x = k.c * TILE + 8, y = k.r * TILE + 8, p = live.find(q => Math.hypot(q.x - x, q.y - y) < OIL.cageHear * TILE);
    if (!p) continue;
    if (!k.near) { k.near = true; G.rev[k.r * COLS + k.c] = 1; G.mapVersion++; emit('cageNear', { x, y }); }
    if (Math.hypot(G.player.x - x, G.player.y - y) < OIL.cageHear * TILE) sfx.tick();
    sparks(x, y, '#ffd24a', 2, 30);
  }
}
// kafes kırıldı: yeni madenci kampa döner (kalıcı); zaten kurtarılmışsa geride bıraktığı erzak çıkar
export function openCage(c, r, p) {
  const m = MINERS.find(q => q.st === stratumOfRow(r)), x = c * TILE + 8, y = r * TILE + 8;
  ring(x, y, '#ffd24a', 40); ring(x, y, '#ffffff', 24); sparks(x, y, '#ffe79a', 24, 130); flashLight(x, y, 8, 0.7);
  for (const q of G.players) if (!q.dead) q.hp = q.maxHp;
  refillOil();
  if (m && !rescued(m.k)) {
    G.meta.rescued = (G.meta.rescued || []).concat(m.k);
    const lm = App.meta; lm.rescued = lm.rescued || []; if (!lm.rescued.includes(m.k)) lm.rescued.push(m.k);
    sfx.victory(); emit('rescued', { k: m.k, pi: p ? p.i : 0 });
  } else {
    G.items.medkit = (G.items.medkit | 0) + 1; G.items.yag = (G.items.yag | 0) + 1;
    sfx.chest(); emit('rescued', { k: m ? m.k : '', pi: p ? p.i : 0, again: true });
  }
}
