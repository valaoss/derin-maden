// Biyom havası: her biyoma özgü küçük, seyrek bir canlılık (solucan, ateş böceği, damla, kıvılcım...).
// Açığa çıkmış boş hücrelerde, hücre konumundan türetilen sabit yerlerde; simülasyona dokunmaz.
import { COLS, ROWS, TILE, GROUND_ROW, stratumOfRow } from '../config.js';
import { T, TD } from '../data/tiles.js';
import { G, biomeOf } from '../game/state.js';
import { hash2 } from '../core/util.js';

let X;
const R = (col, x, y, w = 1, h = 1) => { X.fillStyle = col; X.fillRect(Math.round(x), Math.round(y), w, h); };
const A = (a, f) => { X.globalAlpha = Math.max(0, Math.min(1, a)); f(); X.globalAlpha = 1; };
const blink = (t, h, per = 3) => ((t + h * 17) % per) / per;

// at: floor (altı dolu), ceil (üstü dolu), wall (yanı dolu), air (her yer); d: yoğunluk
const AMB = [
  { at: 'floor', d: 0.05, f: (x, y, t, h) => { const k = blink(t, h, 5); if (k > 0.5) return; const up = Math.round(Math.sin(k * Math.PI * 2) * 2 + 2); R('#e08a90', x, y + 16 - up, 1, up); R('#f0b0b0', x + (Math.floor(t * 4) % 2), y + 15 - up, 1, 1); } },        // toprak: solucan
  { at: 'ceil', d: 0.06, f: (x, y, t, h) => { const k = blink(t, h, 4); A(1 - k, () => R('#8a8490', x, y + k * 16, 1, 1)); } },                                  // taş: toz sızıntısı
  { at: 'air', d: 0.03, f: (x, y, t, h) => { const on = Math.sin(t * 3 + h * 20) > 0.2; if (on) { R('#d8ff70', x + Math.sin(t * 0.8 + h * 9) * 4, y + 6 + Math.cos(t * 0.6 + h * 7) * 3); } } }, // kök: ateş böceği
  { at: 'wall', d: 0.07, f: (x, y, t, h) => { const k = blink(t, h, 3); if (k < 0.12) { const s = k < 0.06 ? 1 : 0; R('#9ad8ff', x, y + 6); if (s) { R('#4a8aff', x - 1, y + 6); R('#4a8aff', x + 1, y + 6); R('#4a8aff', x, y + 5); R('#4a8aff', x, y + 7); } } } }, // kobalt: parıltı
  { at: 'floor', d: 0.08, f: (x, y, t, h) => { if (blink(t, h, 2.5) < 0.15) R('#ffffff', x, y + 15); } },                                                         // buz: kırağı pırıltısı
  { at: 'wall', d: 0.025, f: (x, y, t, h) => { const k = blink(t, h, 6); if (k > 0.1 && k < 0.6) { R('#c02a2a', x, y + 7); R('#c02a2a', x + 2, y + 7); } } },   // kemik: karanlıkta gözler
  { at: 'floor', d: 0.06, f: (x, y, t, h) => { const k = blink(t, h, 2); A(1 - k, () => R(k < 0.4 ? '#ffd24a' : '#ff7a2a', x + Math.sin(k * 8) * 1.5, y + 15 - k * 18)); } }, // kor: yükselen kıvılcım
  { at: 'wall', d: 0.06, f: (x, y, t, h) => { const k = blink(t, h, 3.5); if (k < 0.1) { R('#f0b0ff', x, y + 6); R('#c070ff', x - 1, y + 6); R('#c070ff', x + 1, y + 6); } } }, // kristal
  { at: 'wall', d: 0.05, f: (x, y, t, h) => { const k = blink(t, h, 4); if (k < 0.25) A(0.6, () => R('#e8e8ff', x, y + 2 + k * 40, 1, 3)); } },                  // obsidyen: kayan yansıma
  { at: 'air', d: 0.03, f: (x, y, t, h) => { const k = blink(t, h, 5); A(Math.sin(k * Math.PI), () => R('#8a6aff', x + Math.sin(k * 6) * 2, y + 14 - k * 14)); } },  // boşluk: süzülen zerre
  { at: 'ceil', d: 0.05, f: (x, y, t, h) => { const k = blink(t, h, 3); R('#c8d4dc', x, y + (k < 0.5 ? 0 : (k - 0.5) * 32), 1, k < 0.5 ? 1 + k * 2 : 2); } },    // cıva: gümüş damla
  { at: 'wall', d: 0.04, f: (x, y, t, h) => { if (blink(t, h, 2.2) < 0.06) { R('#9ad8ff', x, y + 4); R('#3a8aff', x + 1, y + 5); R('#9ad8ff', x, y + 6); R('#3a8aff', x + 1, y + 7); } } }, // fırtına: kıvılcım
  { at: 'air', d: 0.04, f: (x, y, t, h) => { const k = blink(t, h, 4); if (Math.floor(t * 6 + h * 9) % 3) A(1 - k, () => R('#ffe79a', x + Math.sin(t + h * 5) * 3, y + k * 16)); } }, // saray: altın tozu
  { at: 'air', d: 0.035, f: (x, y, t, h) => { const k = blink(t, h, 6); A(Math.sin(k * Math.PI) * 0.8, () => R('#e08aff', x + Math.sin(k * 9 + h) * 3, y + 16 - k * 16, 2, 2)); } }, // mantar: spor
  { at: 'floor', d: 0.05, f: (x, y, t, h) => { const k = blink(t, h, 5); if (k < 0.3) { const cs = ['#ff7a7a', '#ffe14a', '#7aff9a', '#7ab0ff']; R(cs[Math.floor(k * 13) % 4], x, y + 15, 2, 1); } } }, // cam: kırılan ışık
  { at: 'floor', d: 0.06, f: (x, y, t) => { const k = (t % 1.6) / 1.6; if (k < 0.12) R('#8a6a5a', x, y + 14 - Math.sin(k / 0.12 * Math.PI) * 2); } },            // dev: nabızla zıplayan toz
  { at: 'ceil', d: 0.05, f: (x, y, t, h) => { const k = blink(t, h, 3); R('#e0b060', x, y, 1, Math.min(16, k * 30)); } },                                           // zaman: kum akışı
  { at: 'ceil', d: 0.04, f: (x, y, t, h) => { const k = blink(t, h, 3.5); R('#a01020', x, y + (k < 0.4 ? 0 : (k - 0.4) * 26), 1, 2); } },                         // kan: damla
  { at: 'air', d: 0.012, f: (x, y, t, h) => { const k = blink(t, h, 5); if (k < 0.4) A(0.4 - k, () => { X.strokeStyle = '#a8a4d0'; X.beginPath(); X.arc(x, y + 8, 2 + k * 20, 0, Math.PI * 2); X.stroke(); }); } }, // yankı: halka
  { at: 'air', d: 0.03, f: (x, y, t, h) => { const k = blink(t, h, 5); A(Math.sin(k * Math.PI), () => R('#fff0c0', x + Math.sin(k * 5 + h) * 2, y + 14 - k * 12)); } },  // yaratılış: altın zerre
  { at: 'air', d: 0.03, f: (x, y, t, h) => A(0.5, () => R('#9a9aa8', x + Math.sin(t * 0.3 + h * 8) * 1, y + 6 + Math.sin(t * 0.2 + h) * 1)) },              // sağır: asılı kalan toz
  { at: 'ceil', d: 0.05, f: (x, y, t, h) => { const k = blink(t, h, 2.6); R('#8ad0e8', x, y + k * 16, 1, 2); } },                                                   // gelgit: damla
  { at: 'wall', d: 0.06, f: (x, y, t, h) => { const k = (t * 1.2 + h) % 1; A(0.3 + 0.5 * Math.abs(Math.sin(k * Math.PI)), () => { R('#c02a4a', x, y + 5, 1, 3); R('#c02a4a', x + 1, y + 8, 1, 2); }); } }, // yaşayan: atan damar
  { at: 'floor', d: 0.05, f: (x, y, t, h) => { const k = blink(t, h, 4); A(1 - k, () => R('#e8eeff', x, y + 15 - k * 16)); } },                                    // ters saray: yukarı düşen toz
  { at: 'air', d: 0.03, f: (x, y, t, h) => A(0.5 + 0.4 * Math.sin(t * 2 + h * 9), () => R('#ffb040', x + Math.sin(t * 0.5 + h * 7) * 3, y + 7 + Math.cos(t * 0.4 + h * 3) * 2)) }, // kehribar: süzülen ışık
  { at: 'wall', d: 0.08, f: (x, y, t, h) => { const j = Math.floor(t * 8 + h * 13) % 7 === 0 ? 1 : 0; R('#5a5a66', x + j, y + 6); R('#5a5a66', x + 1 + j, y + 9); } }, // mıknatıs: seğiren demir tozu
  { at: 'air', d: 0.025, f: (x, y, t, h) => { for (let q = 0; q < 2; q++) R('#1a1a10', x + Math.cos(t * 7 + q * 3 + h * 9) * 3, y + 8 + Math.sin(t * 9 + q * 2) * 2); } }, // açlık: sinekler
  { at: 'air', d: 0.025, f: (x, y, t, h) => { const k = blink(t, h, 6); R(k < 0.5 ? '#6ab04a' : '#a8c050', x + Math.sin(k * 10) * 4, y + k * 16, 2, 1); } },       // kök tahtı: düşen yaprak
  { at: 'air', d: 0.05, f: (x, y, t, h) => A(0.4 + 0.5 * Math.sin(t * 1.5 + h * 11), () => R('#5ae0ff', x + Math.sin(t * 0.3 + h * 6) * 4, y + 8 + Math.sin(t * 0.25 + h * 4) * 4)) }, // deniz: plankton
  { at: 'air', d: 0.04, f: (x, y, t, h) => { if (Math.floor(t * 12 + h * 30) % 9 === 0) R('#ffffff', x + hash2(Math.floor(t * 12), h * 99, 1) * 8, y + hash2(h * 99, Math.floor(t * 12), 2) * 14); } }, // sıfır: parazit
  { at: 'ceil', d: 0.07, f: (x, y, t, h) => { const k = blink(t, h, 2.2); A(1 - k * 0.5, () => R('#9ae0ff', x, y + k * 16, 1, 2)); } },                             // şelale: damla
];

export function drawAmbient(ctx, r0, r1) {
  X = ctx; const t = G.time, map = G.map, rev = G.rev;
  const sol = i => TD[map[i]].solid;
  for (let r = Math.max(GROUND_ROW + 1, r0); r <= Math.min(ROWS - 2, r1); r++) {
    const b = biomeOf(stratumOfRow(r)), E = AMB[b]; if (!E) continue;
    for (let c = 2; c < COLS - 2; c++) {
      const i = r * COLS + c; if (map[i] !== T.AIR || !rev[i]) continue;
      const h = hash2(c, r, 211 + b); if (h >= E.d) continue;
      const ok = E.at === 'air' || (E.at === 'floor' && sol(i + COLS)) || (E.at === 'ceil' && sol(i - COLS)) || (E.at === 'wall' && (sol(i - 1) || sol(i + 1)));
      if (!ok) continue;
      const x = c * TILE + (E.at === 'wall' ? (sol(i - 1) ? 1 : 14) : 3 + Math.floor(h / E.d * 10)), y = r * TILE;
      if (G.lq && G.lq[i] > 2) continue;
      E.f(x, y, t, h / E.d);
    }
  }
}
