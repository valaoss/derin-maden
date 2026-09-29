// Katmanlı dünya üretimi (v5: 20 biyom): malzeme kümeleri, cevher damarları, mağaralar, biyom özellikleri, sandıklar, çekirdek odası.
// Biyom sırası tohuma göre karışır: Toprak hep ilk, Yaratılış Çekirdeği hep son; aradakiler zorluk bantları içinde yer değiştirir.
import { COLS, ROWS, GROUND_ROW, STRATUM_ROWS, STRATA_COUNT, PLAY_MIN_COL, PLAY_MAX_COL, CENTER_COL } from '../config.js';
import { T, HOST_TILE, isPlain, DEEP_TILE } from '../data/tiles.js';
import { mulberry32, fbm, vnoise } from '../core/util.js';

// zorluk bantları: her bant kendi içinde karışır (ana kaya sertliği ve düşman gücü derinlikle artmaya devam eder)
const BANDS = [[0], [1, 2], [3, 4, 5], [6, 7], [8, 9], [10, 11], [12, 13, 14], [15, 16, 17, 18], [19]];
export function biomeOrder(seed) {
  const rnd = mulberry32((seed | 0) ^ 0x5bd1e995);
  const out = [];
  for (const band of BANDS) {
    const b = band.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    out.push(...b);
  }
  return out;
}

// biyom kimliğine göre: [malzeme olasılıkları], damar sayıları, sandık, mağara yoğunluğu, gevşek kaya/gaz çarpanı, özel yapı
const STRATA_GEN = [
  { mats: [[T.DIRT, 0.74], [T.STONE, 0.22], [T.HARD, 0.04]],                         veins: { iron: 9, water: 2 },                         chests: 1, caves: 0,    haz: 1 },
  { mats: [[T.STONE, 0.58], [T.DIRT, 0.14], [T.HARD, 0.28]],                         veins: { iron: 6, water: 5, gold: 1 },                chests: 2, caves: 0.1,  haz: 1 },
  { mats: [[T.MOSS, 0.62], [T.DIRT, 0.14], [T.STONE, 0.24]],                            veins: { iron: 5, water: 6, gold: 2, cobalt: 1 },     chests: 2, caves: 0.3,  haz: 0.8 },
  { mats: [[T.HARD, 0.6], [T.STONE, 0.22], [T.DENSE, 0.18]],                         veins: { iron: 3, water: 3, cobalt: 6, gold: 2 },     chests: 2, caves: 0.22, haz: 1.2 },
  { mats: [[T.ICE, 0.55], [T.HARD, 0.3], [T.STONE, 0.15]],                           veins: { water: 4, cobalt: 4, gold: 3 },              chests: 2, caves: 0.18, haz: 1 },
  { mats: [[T.BONE, 0.6], [T.HARD, 0.24], [T.DENSE, 0.16]],                            veins: { iron: 4, cobalt: 4, gold: 3, crystal: 1 },   chests: 2, caves: 0.28, haz: 1.6 },
  { mats: [[T.MAGMA, 0.55], [T.HARD, 0.2], [T.DENSE, 0.15], [T.EMBER, 0.1]],         veins: { cobalt: 5, gold: 4, crystal: 2 },            chests: 2, caves: 0.24, haz: 1.4 },
  { mats: [[T.DENSE, 0.6], [T.HARD, 0.3], [T.OBSIDIAN, 0.1]],                        veins: { cobalt: 3, crystal: 6, gold: 3 },            chests: 2, caves: 0.2,  haz: 1.3 },
  { mats: [[T.OBSIDIAN, 0.6], [T.DENSE, 0.3], [T.VOID, 0.1]],                        veins: { crystal: 5, gold: 4, cobalt: 3 },            chests: 3, caves: 0.26, haz: 1.5 },
  { mats: [[T.VOID, 0.62], [T.OBSIDIAN, 0.28], [T.DENSE, 0.1]],                      veins: { crystal: 7, gold: 5 },                       chests: 3, caves: 0.2,  haz: 1.2 },
  // v5 derin biyomlar
  { mats: [[T.QUICK, 0.62], [T.VOID, 0.18], [T.OBSIDIAN, 0.2]],                      veins: { gold: 5, crystal: 4, cobalt: 3 },            chests: 3, caves: 0.24, haz: 1.3, feat: 'mercury' },
  { mats: [[T.STORM, 0.66], [T.QUICK, 0.16], [T.DENSE, 0.18]],                       veins: { cobalt: 6, crystal: 4, gold: 3 },            chests: 3, caves: 0.2,  haz: 1.4, feat: 'bolt' },
  { mats: [[T.GILT, 0.78], [T.STORM, 0.08], [T.DENSE, 0.14]],                         veins: { gold: 9, crystal: 4 },                       chests: 4, caves: 0.16, haz: 1.2, feat: 'palace' },
  { mats: [[T.FUNGUS, 0.76], [T.GILT, 0.08], [T.OBSIDIAN, 0.16]],                    veins: { crystal: 5, gold: 4, water: 4 },             chests: 3, caves: 0.36,  haz: 1.5, feat: 'spore' },
  { mats: [[T.GLASS, 0.78], [T.FUNGUS, 0.06], [T.VOID, 0.16]],                          veins: { crystal: 7, gold: 4, cobalt: 3 },            chests: 3, caves: 0.3,  haz: 1.6, feat: 'cathedral' },
  { mats: [[T.TITAN, 0.76], [T.GLASS, 0.08], [T.OBSIDIAN, 0.16]],                       veins: { crystal: 6, gold: 5, cobalt: 4 },            chests: 4, caves: 0.18, haz: 1.8, feat: 'giant' },
  { mats: [[T.CHRONO, 0.68], [T.TITAN, 0.14], [T.VOID, 0.18]],                       veins: { crystal: 7, gold: 6 },                       chests: 3, caves: 0.26, haz: 1.5, feat: 'hourglass' },
  { mats: [[T.BLOOD, 0.7], [T.CHRONO, 0.1], [T.BONE, 0.2]],                          veins: { crystal: 6, gold: 6, iron: 4 },              chests: 3, caves: 0.3,  haz: 2.2, feat: 'bloodvein' },
  { mats: [[T.ECHO, 0.74], [T.BLOOD, 0.08], [T.VOID, 0.18]],                         veins: { crystal: 8, gold: 6 },                       chests: 3, caves: 0.14, haz: 1.4, feat: 'hush' },
  { mats: [[T.GENESIS, 0.72], [T.ECHO, 0.1], [T.OBSIDIAN, 0.18]],                    veins: { crystal: 10, gold: 8, cobalt: 4 },           chests: 4, caves: 0.22, haz: 1.5, feat: 'seed' },
];
const ORE_T = { iron: T.IRON, water: T.WATER, cobalt: T.COBALT, crystal: T.CRYSTAL, gold: T.GOLD };

export function generate(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const order = biomeOrder(seed);
  const map = new Uint8Array(COLS * ROWS);
  const set = (c, r, t) => { map[r * COLS + c] = t; };
  const get = (c, r) => map[r * COLS + c];
  const BOTTOM = GROUND_ROW + STRATUM_ROWS * STRATA_COUNT;
  const inPlay = (c, r) => c >= PLAY_MIN_COL && c <= PLAY_MAX_COL && r >= GROUND_ROW && r < BOTTOM;
  const plain = t => isPlain(t);
  const GEN = s => STRATA_GEN[order[s]];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r < GROUND_ROW) { set(c, r, T.AIR); continue; }
      if (c < PLAY_MIN_COL || c > PLAY_MAX_COL || r >= BOTTOM) { set(c, r, T.BEDROCK); continue; }
      // katman sınırı gürültüyle dalgalanır
      const wob = (vnoise(c * 0.35, r * 0.1, seed + 3) - 0.5) * 5;
      const s = Math.max(0, Math.min(STRATA_COUNT - 1, Math.floor((r - GROUND_ROW + wob) / STRATUM_ROWS)));
      // fbm ~[0.2,0.8] aralığında toplanır; kabaca düzgün dağılıma yay
      const n = Math.min(0.999, Math.max(0, (fbm(c * 0.28, r * 0.22, seed + s * 31) - 0.22) / 0.56));
      const mats = GEN(s).mats;
      let acc = 0, t = mats[0][0];
      for (const [mt, p] of mats) { acc += p; t = mt; if (n < acc) break; }
      set(c, r, t);
    }
  }
  // yüzeye yakın ilk iki satır hep toprak (yumuşak başlangıç)
  for (let c = PLAY_MIN_COL; c <= PLAY_MAX_COL; c++) { set(c, GROUND_ROW, T.DIRT); set(c, GROUND_ROW + 1, T.DIRT); }
  // üssün çelik temeli
  for (let c = CENTER_COL - 2; c <= CENTER_COL + 2; c++) for (let r = GROUND_ROW; r < GROUND_ROW + 2; r++) set(c, r, T.FOUNDATION);
  set(CENTER_COL - 1, GROUND_ROW + 2, T.FOUNDATION); set(CENTER_COL, GROUND_ROW + 2, T.FOUNDATION); set(CENTER_COL + 1, GROUND_ROW + 2, T.FOUNDATION);

  // mağaralar (hücresel otomat)
  for (let s = 0; s < STRATA_COUNT; s++) {
    const dens = GEN(s).caves; if (!dens) continue;
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
    const r0 = GROUND_ROW + s * STRATUM_ROWS, v = GEN(s).veins;
    for (const res in v) {
      for (let i = 0; i < v[res]; i++) {
        let minR = r0 + 2;
        if (s === 0 && res === 'water') minR = r0 + 12;
        if (s === 1 && res === 'gold') minR = r0 + 20;
        let c = PLAY_MIN_COL + Math.floor(rnd() * 13), r = minR + Math.floor(rnd() * (r0 + STRATUM_ROWS - minR));
        const len = 3 + Math.floor(rnd() * 4);
        for (let k = 0; k < len; k++) {
          if (inPlay(c, r) && get(c, r) !== T.AIR) set(c, r, ORE_T[res]);
          if (rnd() < 0.5) c += rnd() < 0.5 ? -1 : 1; else r += rnd() < 0.7 ? 1 : -1;
        }
      }
    }
  }

  // biyom özellikleri (derin biyomlar): elle tasarlanmış yapılar ve biyoma özgü taşlar
  const chests = [];
  const pickPlain = (r0, want) => {
    for (let tries = 0; tries < 60; tries++) {
      const c = PLAY_MIN_COL + Math.floor(rnd() * 13), r = r0 + 4 + Math.floor(rnd() * (STRATUM_ROWS - 8));
      if (plain(get(c, r)) && (!want || want(c, r) || tries > 40)) return [c, r];
    }
    return null;
  };
  const nearAir = (c, r) => get(c, r + 1) === T.AIR || get(c, r - 1) === T.AIR || get(c + 1, r) === T.AIR || get(c - 1, r) === T.AIR;
  const scatter = (r0, tile, n, want) => { for (let i = 0; i < n; i++) { const p = pickPlain(r0, want); if (p) set(p[0], p[1], tile); } };
  const walk = (r0, tile, n, len0, down) => {
    for (let i = 0; i < n; i++) {
      const p = pickPlain(r0); if (!p) continue;
      let [c, r] = p;
      for (let k = 0; k < len0 + Math.floor(rnd() * 3); k++) {
        if (inPlay(c, r) && plain(get(c, r))) set(c, r, tile);
        if (down) { r++; c += rnd() < 0.5 ? (rnd() < 0.5 ? -1 : 1) : 0; } else if (rnd() < 0.6) c += rnd() < 0.5 ? -1 : 1; else r += rnd() < 0.5 ? 1 : -1;
      }
    }
  };
  for (let s = 0; s < STRATA_COUNT; s++) {
    const r0 = GROUND_ROW + s * STRATUM_ROWS, feat = GEN(s).feat;
    if (!feat) continue;
    if (feat === 'mercury') {
      // cıva gölcükleri: mağara tabanına yayılmış yatay şeritler
      for (let i = 0; i < 7; i++) {
        const p = pickPlain(r0, (c, r) => get(c, r - 1) === T.AIR); if (!p) continue;
        const len = 3 + Math.floor(rnd() * 3);
        for (let k = 0; k < len; k++) if (inPlay(p[0] + k, p[1]) && plain(get(p[0] + k, p[1]))) set(p[0] + k, p[1], T.MERCURY);
      }
    } else if (feat === 'bolt') walk(r0, T.BOLT, 5, 6, true);            // yıldırım damarları: aşağı zikzak
    else if (feat === 'palace') {
      // Altın Saray: kapılarla mühürlü salon, sütunlar, altın döşeme ve iki sandık
      const h0 = r0 + 13, h1 = r0 + 23, c0 = 4, c1 = 12;
      for (let r = h0; r <= h1; r++) for (let c = c0; c <= c1; c++) {
        const edge = r === h0 || r === h1 || c === c0 || c === c1;
        set(c, r, edge ? T.GATE : T.AIR);
      }
      for (let r = h0 + 2; r <= h1 - 2; r++) { set(6, r, T.GILT); set(10, r, T.GILT); }
      for (let c = c0 + 1; c < c1; c++) { set(c, h1 - 1, c % 2 ? T.GOLD : T.GILT); if (c % 3 === 0) set(c, h0 + 1, T.GOLD); }
      set(8, h1 - 1, T.CHEST); set(8, h0 + 1, T.CHEST); chests.push([8, h1 - 1], [8, h0 + 1]);
      set(8, r0 + 19, T.GILT); set(8, r0 + 18, T.RELIC);                       // taht: Altın Taç
    } else if (feat === 'spore') scatter(r0, T.SPORE, 10, nearAir);        // spor keseleri: mağara kenarlarında
    else if (feat === 'cathedral') {
      // Cam Katedrali: uzun dikey nefler
      for (let i = 0; i < 3; i++) {
        const c = 3 + Math.floor(rnd() * 9), top = r0 + 6 + Math.floor(rnd() * 8), len = 10 + Math.floor(rnd() * 7);
        for (let r = top; r < Math.min(top + len, r0 + STRATUM_ROWS - 3); r++) { set(c, r, T.AIR); if (c + 1 <= PLAY_MAX_COL) set(c + 1, r, T.AIR); }
      }
    } else if (feat === 'giant') {
      // Uyuyan Dev: göğüs boşluğu, ortasında nabız taşı; kayada gömülü ek nabız taşları
      const hr = r0 + 18;
      for (let r = hr - 4; r <= hr + 4; r++) for (let c = CENTER_COL - 5; c <= CENTER_COL + 5; c++) {
        const dx = (c - CENTER_COL) / 5.6, dy = (r - hr) / 4.4;
        if (dx * dx + dy * dy < 1) set(c, r, T.AIR);
      }
      set(CENTER_COL, hr, T.RELIC); set(CENTER_COL - 2, hr, T.PULSE); set(CENTER_COL + 2, hr, T.PULSE); // kalp: Devin Kalbi
      scatter(r0, T.PULSE, 4);
    } else if (feat === 'hourglass') scatter(r0, T.HOURGLASS, 7);
    else if (feat === 'bloodvein') walk(r0, T.BLOODVEIN, 8, 3, false);
    else if (feat === 'hush') {
      scatter(r0, T.HUSH, 5, (c, r) => r < r0 + STRATUM_ROWS / 2); scatter(r0, T.HUSH, 4);
      // Arkentaş: biyomun dibinde, küçük bir oyuğun ortasında kayaya gömülü
      const ac = 4 + Math.floor(rnd() * 9), ar = r0 + 25 + Math.floor(rnd() * 5);
      for (let r = ar - 1; r <= ar + 1; r++) for (let c = ac - 2; c <= ac + 2; c++) if (inPlay(c, r) && plain(get(c, r))) set(c, r, T.AIR);
      set(ac, ar + 1, T.ECHO); set(ac, ar, T.ARKEN);
    }
    else if (feat === 'seed') scatter(r0, T.SEED, 6);
  }

  // tehlikeler: gevşek kaya kümeleri (tercihen mağara tavanlarında) ve gaz cepleri
  const hz = opts.hazard || 1;
  for (let s = 0; s < STRATA_COUNT; s++) {
    const r0 = GROUND_ROW + s * STRATUM_ROWS, bh = GEN(s).haz;
    const minR = s === 0 ? r0 + 14 : r0 + 2;
    const loose = Math.round((s === 0 ? 1 : 2 + Math.min(4, s)) * hz * bh), gas = Math.round((s === 0 ? 0 : 1 + Math.min(4, s)) * hz * bh);
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
  for (let s = 0; s < STRATA_COUNT; s++) {
    const r0 = GROUND_ROW + s * STRATUM_ROWS;
    for (let i = 0; i < GEN(s).chests; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const c = PLAY_MIN_COL + 1 + Math.floor(rnd() * 11);
        const r = r0 + 8 + Math.floor(rnd() * (STRATUM_ROWS - 11));
        if (!plain(get(c, r)) || chests.some(o => Math.abs(o[1] - r) < 5)) continue;
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
      const wallC = left ? PLAY_MIN_COL - 1 : PLAY_MAX_COL + 1;
      const capC = left ? PLAY_MIN_COL : PLAY_MAX_COL;
      if (get(capC, r) === T.AIR || get(capC, r) === T.CHEST) continue;
      set(capC, r, T.VAULT);
      const prize = rnd() < 0.3 ? T.CHEST : s >= 6 ? T.CRYSTAL : s >= 3 ? (rnd() < 0.5 ? T.GOLD : T.COBALT) : s >= 1 ? (rnd() < 0.5 ? T.GOLD : T.IRON) : rnd() < 0.5 ? T.IRON : T.WATER;
      set(wallC, r, prize);
      if (rnd() < 0.6) set(wallC, r + 1, s >= 4 ? T.GOLD : T.IRON);
    }
  }

  // yuvalar: her biyomda 2-3 kovan, kayaya gömülü, sandık ve birbirinden uzak
  const nests = [];
  for (let s = 0; s < STRATA_COUNT; s++) {
    const r0 = GROUND_ROW + s * STRATUM_ROWS;
    const n = s === 0 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 90; tries++) {
        const c = PLAY_MIN_COL + 1 + Math.floor(rnd() * 11);
        const r = r0 + (s === 0 ? 10 : 4) + Math.floor(rnd() * (STRATUM_ROWS - (s === 0 ? 13 : 7)));
        if (!plain(get(c, r))) continue;
        if (chests.some(o => Math.abs(o[0] - c) < 3 && Math.abs(o[1] - r) < 4)) continue;
        if (nests.some(o => Math.abs(o[1] - r) < (tries > 45 ? 4 : 7) || (Math.abs(o[0] - c) < 4 && Math.abs(o[1] - r) < 12))) continue;
        if (s === 0 && Math.abs(c - CENTER_COL) < 2 && r < r0 + 14) continue;
        if (s === STRATA_COUNT - 1 && r >= r0 + STRATUM_ROWS - 10) continue; // çekirdek odası burayı oyar
        set(c, r, T.NEST); nests.push([c, r]); break;
      }
    }
  }

  // çekirdek odası + Kalp Kristali
  const hr = BOTTOM - 6;
  for (let r = hr - 3; r <= hr + 3; r++) for (let c = CENTER_COL - 4; c <= CENTER_COL + 4; c++) {
    const dx = (c - CENTER_COL) / 4.6, dy = (r - hr) / 3.4;
    if (dx * dx + dy * dy < 1) set(c, r, T.AIR);
  }
  set(CENTER_COL, hr, T.HEART);
  set(CENTER_COL + 2, hr, T.RELIC); // Yaratılış Kıvılcımı

  // derin cevher: her biyomda bandına özgü birkaç küçük damar
  for (let s = 0; s < STRATA_COUNT; s++) {
    const r0 = GROUND_ROW + s * STRATUM_ROWS, tile = DEEP_TILE[Math.min(DEEP_TILE.length - 1, Math.floor(s / 4))];
    const spare = (c, r) => plain(get(c, r)) && get(c, r) !== HOST_TILE[order[s]]; // ana kayayı azaltmaz
    for (let i = 0; i < 3; i++) {
      let at = null;
      for (let tries = 0; tries < 60 && !at; tries++) { const c = PLAY_MIN_COL + Math.floor(rnd() * 13), r = r0 + 4 + Math.floor(rnd() * (STRATUM_ROWS - 8)); if (spare(c, r)) at = [c, r]; }
      if (!at) continue;
      set(at[0], at[1], tile);
      const dc = rnd() < 0.5 ? 1 : -1;
      if (rnd() < 0.5 && inPlay(at[0] + dc, at[1]) && spare(at[0] + dc, at[1])) set(at[0] + dc, at[1], tile);
    }
  }

  // öğretici: ilk seferde merkezin hemen altında garanti cevher
  if (opts.tutorial) {
    const tc = CENTER_COL + 3;
    for (let r = GROUND_ROW; r < GROUND_ROW + 7; r++) set(tc, r, T.DIRT);
    set(tc, GROUND_ROW + 2, T.IRON);
    set(tc, GROUND_ROW + 3, T.IRON);
    set(tc, GROUND_ROW + 5, T.IRON);
    set(tc + 1, GROUND_ROW + 5, T.IRON);
  }
  return { map, heartRow: hr, order };
}
export { HOST_TILE };
