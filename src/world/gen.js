// Katmanlı dünya üretimi: malzeme kümeleri, cevher damarları, mağaralar, sandıklar, çekirdek odası.
import { COLS, ROWS, GROUND_ROW, STRATUM_ROWS, STRATA_COUNT, PLAY_MIN_COL, PLAY_MAX_COL, CENTER_COL } from '../config.js';
import { T } from '../data/tiles.js';
import { mulberry32, fbm, vnoise } from '../core/util.js';

// katman başına: [malzeme olasılıkları], damar sayıları
const STRATA_GEN = [
  { mats: [[T.DIRT, 0.74], [T.STONE, 0.22], [T.HARD, 0.04]], veins: { iron: 7, water: 1 }, chests: 1, caves: 0 },
  { mats: [[T.STONE, 0.58], [T.DIRT, 0.14], [T.HARD, 0.28]], veins: { iron: 4, water: 4, cobalt: 1 }, chests: 2, caves: 0.1 },
  { mats: [[T.HARD, 0.58], [T.STONE, 0.24], [T.DENSE, 0.18]], veins: { iron: 2, water: 2, cobalt: 5, crystal: 1 }, chests: 2, caves: 0.22 },
  { mats: [[T.DENSE, 0.6], [T.HARD, 0.4]], veins: { water: 1, cobalt: 2, crystal: 5 }, chests: 1, caves: 0.2 },
];
const ORE_T = { iron: T.IRON, water: T.WATER, cobalt: T.COBALT, crystal: T.CRYSTAL };

export function generate(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const map = new Uint8Array(COLS * ROWS);
  const set = (c, r, t) => { map[r * COLS + c] = t; };
  const get = (c, r) => map[r * COLS + c];
  const inPlay = (c, r) => c >= PLAY_MIN_COL && c <= PLAY_MAX_COL && r >= GROUND_ROW && r < GROUND_ROW + STRATUM_ROWS * STRATA_COUNT;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r < GROUND_ROW) { set(c, r, T.AIR); continue; }
      if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r >= GROUND_ROW + STRATUM_ROWS * STRATA_COUNT) { set(c, r, T.BEDROCK); continue; }
      // katman sınırı gürültüyle dalgalanır
      const wob = (vnoise(c * 0.35, r * 0.1, seed + 3) - 0.5) * 5;
      const s = Math.max(0, Math.min(STRATA_COUNT - 1, Math.floor((r - GROUND_ROW + wob) / STRATUM_ROWS)));
      // fbm ~[0.2,0.8] aralığında toplanır; kabaca düzgün dağılıma yay
      const n = Math.min(0.999, Math.max(0, (fbm(c * 0.28, r * 0.22, seed + s * 31) - 0.22) / 0.56));
      const mats = STRATA_GEN[s].mats;
      let acc = 0, t = mats[0][0];
      // gürültüyü kümülatif olasılığa eşle -> kümeler halinde malzeme
      for (const [mt, p] of mats) { acc += p; t = mt; if (n < acc) break; }
      set(c, r, t);
    }
  }
  // yüzeye yakın ilk iki satır hep toprak (yumuşak başlangıç)
  for (let c = PLAY_MIN_COL; c <= PLAY_MAX_COL; c++) { set(c, GROUND_ROW, T.DIRT); set(c, GROUND_ROW + 1, T.DIRT); }
  // üssün çelik temeli: düşmanlar üssün dibinden çıkamaz, yüzeyde yürümek zorunda kalır
  for (let c = CENTER_COL - 2; c <= CENTER_COL + 2; c++) for (let r = GROUND_ROW; r < GROUND_ROW + 2; r++) set(c, r, T.FOUNDATION);
  set(CENTER_COL - 1, GROUND_ROW + 2, T.FOUNDATION); set(CENTER_COL, GROUND_ROW + 2, T.FOUNDATION); set(CENTER_COL + 1, GROUND_ROW + 2, T.FOUNDATION);

  // mağaralar (hücresel otomat)
  for (let s = 0; s < STRATA_COUNT; s++) {
    const dens = STRATA_GEN[s].caves; if (!dens) continue;
    const r0 = GROUND_ROW + s * STRATUM_ROWS + 3, r1 = r0 + STRATUM_ROWS - 6;
    let cells = [];
    for (let r = r0; r < r1; r++) for (let c = PLAY_MIN_COL + 1; c < PLAY_MAX_COL; c++) {
      const on = vnoise(c * 0.5, r * 0.5, seed + 90 + s) < 0.35 + dens * 0.6 && rnd() < dens * 2.4;
      cells.push([c, r, on]);
    }
    let grid = new Map(cells.map(([c, r, on]) => [c + ',' + r, on]));
    for (let it = 0; it < 3; it++) {
      const ng = new Map();
      for (const [k, on] of grid) {
        const [c, r] = k.split(',').map(Number);
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && grid.get((c + dx) + ',' + (r + dy))) n++;
        ng.set(k, on ? n >= 3 : n >= 5);
      }
      grid = ng;
    }
    for (const [k, on] of grid) if (on) { const [c, r] = k.split(',').map(Number); set(c, r, T.AIR); }
  }

  // cevher damarları (rastgele yürüyüş)
  for (let s = 0; s < STRATA_COUNT; s++) {
    const r0 = GROUND_ROW + s * STRATUM_ROWS, v = STRATA_GEN[s].veins;
    for (const res in v) {
      for (let i = 0; i < v[res]; i++) {
        let minR = r0 + 2;
        if (s === 0 && res === 'water') minR = r0 + 12;
        let c = PLAY_MIN_COL + Math.floor(rnd() * 13), r = minR + Math.floor(rnd() * (r0 + STRATUM_ROWS - minR));
        const len = 3 + Math.floor(rnd() * 4);
        for (let k = 0; k < len; k++) {
          if (inPlay(c, r) && get(c, r) !== T.AIR) set(c, r, ORE_T[res]);
          if (rnd() < 0.5) c += rnd() < 0.5 ? -1 : 1; else r += rnd() < 0.7 ? 1 : -1;
        }
      }
    }
  }

  // tehlikeler: gevşek kaya kümeleri (tercihen mağara tavanlarında) ve gaz cepleri
  const hz = opts.hazard || 1;
  const plain = t => t === T.DIRT || t === T.STONE || t === T.HARD || t === T.DENSE;
  for (let s = 0; s < STRATA_COUNT; s++) {
    const r0 = GROUND_ROW + s * STRATUM_ROWS;
    const minR = s === 0 ? r0 + 14 : r0 + 2;
    const loose = Math.round((s === 0 ? 1 : 2 + s) * hz), gas = Math.round((s === 0 ? 0 : 1 + s) * hz);
    for (let i = 0; i < loose; i++) {
      let c = 0, r = 0;
      for (let tries = 0; tries < 40; tries++) {
        c = PLAY_MIN_COL + Math.floor(rnd() * 13); r = minR + Math.floor(rnd() * (r0 + STRATUM_ROWS - 2 - minR));
        if (plain(get(c, r)) && (tries > 25 || get(c, r + 1) === T.AIR)) break;
      }
      const len = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < len; k++) if (inPlay(c + k, r) && plain(get(c + k, r))) set(c + k, r, T.LOOSE);
    }
    for (let i = 0; i < gas; i++) {
      const c = PLAY_MIN_COL + 1 + Math.floor(rnd() * 11), r = minR + Math.floor(rnd() * (r0 + STRATUM_ROWS - 2 - minR));
      if (plain(get(c, r))) set(c, r, T.GAS);
      if (rnd() < 0.5 && plain(get(c + 1, r))) set(c + 1, r, T.GAS);
    }
  }

  // kalıntı sandıkları: katmanın alt yarısında, kayaya gömülü
  const chests = [];
  for (let s = 0; s < STRATA_COUNT; s++) {
    const r0 = GROUND_ROW + s * STRATUM_ROWS;
    for (let i = 0; i < STRATA_GEN[s].chests; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const c = PLAY_MIN_COL + 1 + Math.floor(rnd() * 11);
        const r = r0 + 10 + Math.floor(rnd() * (STRATUM_ROWS - 13));
        if (get(c, r) === T.AIR || chests.some(o => Math.abs(o[1] - r) < 5)) continue;
        set(c, r, T.CHEST); chests.push([c, r]); break;
      }
    }
  }

  // ana kaya cepleri: kenar duvarlarında kilitli kayayla kapatılmış küçük hazine odacıkları (yalnız dinamit açar)
  for (let s = 0; s < STRATA_COUNT; s++) {
    const r0 = GROUND_ROW + s * STRATUM_ROWS;
    const n = s === 0 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const left = rnd() < 0.5;
      const r = r0 + 4 + Math.floor(rnd() * (STRATUM_ROWS - 8));
      const wallC = left ? PLAY_MIN_COL - 1 : PLAY_MAX_COL + 1;   // ana kaya sütunu
      const capC = left ? PLAY_MIN_COL : PLAY_MAX_COL;            // oyun alanı kenarı: kilit kapağı
      if (get(capC, r) === T.AIR || get(capC, r) === T.CHEST) continue;
      set(capC, r, T.VAULT);
      // cep içeriği: katman cevheri veya sandık; alt hücre ikinci ödül
      const prize = rnd() < 0.3 ? T.CHEST : s >= 2 ? T.CRYSTAL : s === 1 ? T.COBALT : rnd() < 0.5 ? T.IRON : T.WATER;
      set(wallC, r, prize);
      if (rnd() < 0.6) set(wallC, r + 1, s >= 2 ? T.COBALT : T.IRON);
      // cep tavanında ipucu: kırık çizgi olarak gevşek kaya değil, hemen üst hücre kapak kalır
    }
  }

  // çekirdek odası + Kalp Kristali
  const hr = GROUND_ROW + STRATUM_ROWS * STRATA_COUNT - 6;
  for (let r = hr - 3; r <= hr + 3; r++) for (let c = CENTER_COL - 4; c <= CENTER_COL + 4; c++) {
    const dx = (c - CENTER_COL) / 4.6, dy = (r - hr) / 3.4;
    if (dx * dx + dy * dy < 1) set(c, r, T.AIR);
  }
  set(CENTER_COL, hr, T.HEART);

  // öğretici: ilk seferde merkezin hemen altında garanti cevher
  if (opts.tutorial) {
    const tc = CENTER_COL + 3;
    for (let r = GROUND_ROW; r < GROUND_ROW + 7; r++) set(tc, r, T.DIRT);
    set(tc, GROUND_ROW + 2, T.IRON);
    set(tc, GROUND_ROW + 3, T.IRON);
    set(tc, GROUND_ROW + 5, T.IRON);
    set(tc + 1, GROUND_ROW + 5, T.IRON);
  }
  return { map, heartRow: hr };
}
