// Tek palet: tüm dünya, karakterler ve UI buradan beslenir.
// Işık/sıcak = oyuncu, fener, cevher, üs.  Soğuk/koyu = derinlik.
export const P = {
  ink: '#140c1c',        // evrensel kontur
  night: '#0b0712',

  // gökyüzü (alacakaranlık)
  sky0: '#1c1d3a', sky1: '#2b2b52', sky2: '#4a3a66', sky3: '#7a4c6e', sky4: '#b8636a', sky5: '#e8946a',
  hill0: '#2a1f3d', hill1: '#1d1630', sun: '#ffd48a',
  grass0: '#2e5a33', grass1: '#4a8a3f', grass2: '#7cc05a',

  // oyuncu
  helm: '#f2c14e', helmL: '#ffe79a', helmD: '#a8701e',
  suit: '#2fb39a', suitL: '#74efcf', suitD: '#16695a',
  skin: '#f0b890', skinD: '#b8765a',
  lamp: '#fff4c2', boot: '#3a2a3a', metal: '#a7b0c4', metalD: '#5a6278', wood: '#8a5a2a', woodL: '#b07a42',

  // düşman ortak: kırmızı gözler (emissive)
  eye: '#ff5a4a', eyeD: '#7a1a1a',

  // UI
  ui: '#1e1628', uiL: '#3a2d4a', uiD: '#0f0a16', text: '#f5ecd8', dim: '#a497b4',
  good: '#5fe0b8', bad: '#ec4a4a', warn: '#f2c14e',
};

// Malzeme rampaları: [kontur, koyu, orta, açık, parlak]
export const MAT_RAMP = {
  dirt:    ['#1e120c', '#3b2418', '#5c3a24', '#7d5433', '#a8784c'],
  stone:   ['#16131a', '#2f2a31', '#4a4349', '#6a6166', '#948a8c'],
  hard:    ['#0f1220', '#1f2638', '#2f3a54', '#46577c', '#6f86ad'],
  dense:   ['#0c0714', '#1f1230', '#2f1c45', '#48306a', '#6a4a92'],
  bedrock: ['#07050b', '#110d18', '#1a1524', '#241d31', '#30283f'],
  found:   ['#0f0c16', '#2a2c3c', '#3e4256', '#5a6078', '#8a92aa'],
};
// Arka duvar (kazılmış boşluk) rampaları — koyu, düşük kontrast
export const WALL_RAMP = {
  dirt:    ['#0e0806', '#1a0f0a', '#24160e', '#2e1d13'],
  stone:   ['#0b0a0d', '#141216', '#1c191e', '#252127'],
  hard:    ['#07080f', '#0e111c', '#141a28', '#1b2334'],
  dense:   ['#06030a', '#0d0716', '#140b20', '#1c1029'],
  bedrock: ['#040306', '#08060b', '#0c0a10', '#100d15'],
};

export const ORE_RAMP = {
  iron:    ['#5a2e14', '#b06a34', '#e8a060', '#ffe0b0'],
  water:   ['#123a5a', '#2c8ac4', '#6fd0ff', '#e4f8ff'],
  cobalt:  ['#141c5a', '#2c48c8', '#5a86ff', '#c4d4ff'],
  crystal: ['#3a0e52', '#9030c8', '#e070ff', '#ffd8ff'],
};

export const RES_COL = { iron: '#e8a060', water: '#6fd0ff', cobalt: '#5a86ff', crystal: '#e070ff' };

export const STRATA = [
  { name: 'Toprak Katmanı',   short: 'TOPRAK',   dark: [10, 6, 12],  amb: 0.0 },
  { name: 'Taş Damarları',    short: 'TAŞ',      dark: [8, 7, 12],   amb: 0.0 },
  { name: 'Kobalt Mağaraları', short: 'KOBALT',  dark: [5, 7, 16],   amb: 0.0 },
  { name: 'Kristal Çekirdek', short: 'ÇEKİRDEK', dark: [9, 4, 16],   amb: 0.0 },
];
