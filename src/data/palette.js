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
  dirt:     ['#1e120c', '#3b2418', '#5c3a24', '#7d5433', '#a8784c'],
  stone:    ['#16131a', '#2f2a31', '#4a4349', '#6a6166', '#948a8c'],
  moss:     ['#0e1a10', '#1f3a22', '#2f5a30', '#4a7a3c', '#7ab058'],
  hard:     ['#0f1220', '#1f2638', '#2f3a54', '#46577c', '#6f86ad'],
  ice:      ['#0e1a2a', '#1e4a6a', '#2f7a9a', '#5ab0cc', '#bff4ff'],
  bone:     ['#1a1410', '#4a3e30', '#7a6a52', '#a89478', '#e0d0b0'],
  magma:    ['#1a0808', '#3a1410', '#5a2018', '#8a3020', '#d05a2a'],
  dense:    ['#0c0714', '#1f1230', '#2f1c45', '#48306a', '#6a4a92'],
  obsidian: ['#050408', '#120e1a', '#1c1628', '#2c2440', '#4a3e68'],
  void:     ['#03020a', '#0a0818', '#120e28', '#1c1840', '#3a3080'],
  bedrock:  ['#07050b', '#110d18', '#1a1524', '#241d31', '#30283f'],
  found:    ['#0f0c16', '#2a2c3c', '#3e4256', '#5a6078', '#8a92aa'],
  vault:    ['#0a0810', '#2a1e2e', '#3e2c44', '#5a4262', '#8a6a8e'],
};
// Arka duvar (kazılmış boşluk) rampaları — koyu, düşük kontrast
export const WALL_RAMP = {
  dirt:     ['#0e0806', '#1a0f0a', '#24160e', '#2e1d13'],
  stone:    ['#0b0a0d', '#141216', '#1c191e', '#252127'],
  moss:     ['#070c08', '#0c160e', '#122014', '#182a1a'],
  hard:     ['#07080f', '#0e111c', '#141a28', '#1b2334'],
  ice:      ['#070c12', '#0c1a26', '#122634', '#183242'],
  bone:     ['#0c0a08', '#181410', '#221c16', '#2c241c'],
  magma:    ['#0c0404', '#180808', '#220c0a', '#2e100c'],
  dense:    ['#06030a', '#0d0716', '#140b20', '#1c1029'],
  obsidian: ['#030205', '#07050c', '#0b0812', '#100c1a'],
  void:     ['#020108', '#04030e', '#070516', '#0a081e'],
  bedrock:  ['#040306', '#08060b', '#0c0a10', '#100d15'],
  vault:    ['#06040a', '#0c0812', '#120c1a', '#181022'],
};

export const ORE_RAMP = {
  iron:    ['#5a2e14', '#b06a34', '#e8a060', '#ffe0b0'],
  water:   ['#123a5a', '#2c8ac4', '#6fd0ff', '#e4f8ff'],
  cobalt:  ['#141c5a', '#2c48c8', '#5a86ff', '#c4d4ff'],
  crystal: ['#3a0e52', '#9030c8', '#e070ff', '#ffd8ff'],
  gold:    ['#5a3a08', '#c08a1a', '#ffd24a', '#fff4c0'],
};

export const RES_COL = { iron: '#e8a060', water: '#6fd0ff', cobalt: '#5a86ff', crystal: '#e070ff', gold: '#ffd24a' };

// Biyomlar (10): isim, HUD kısaltması, karanlık rengi, süs türü, parçacık efekti
// decor: 'mush' mantar, 'crys' kristal, 'root' kök sarkıtı, 'icicle' buz sarkıtı, 'bone' kemik, 'ember' kor, 'shard' obsidyen, 'star' boşluk ışığı
// fx: 'spore' sporlar, 'snow' kar tanesi, 'ember' yükselen kor, 'ash' kül, 'star' yıldız tozu
export const STRATA = [
  { name: 'Toprak Katmanı',    short: 'TOPRAK',   dark: [10, 6, 12],  decor: 'mush',   fx: null,    tint: null },
  { name: 'Taş Damarları',     short: 'TAŞ',      dark: [8, 7, 12],   decor: 'mush',   fx: null,    tint: null },
  { name: 'Kök Ormanı',        short: 'KÖK',      dark: [5, 10, 6],   decor: 'root',   fx: 'spore', tint: 'rgba(60,140,60,0.05)' },
  { name: 'Kobalt Mağaraları', short: 'KOBALT',   dark: [5, 7, 16],   decor: 'crys',   fx: null,    tint: null },
  { name: 'Buz Katmanı',       short: 'BUZ',      dark: [6, 10, 18],  decor: 'icicle', fx: 'snow',  tint: 'rgba(120,200,255,0.06)' },
  { name: 'Kemik Çukuru',      short: 'KEMİK',    dark: [10, 8, 6],   decor: 'bone',   fx: 'ash',   tint: null },
  { name: 'Kor Katmanı',       short: 'KOR',      dark: [14, 4, 3],   decor: 'ember',  fx: 'ember', tint: 'rgba(255,90,30,0.07)' },
  { name: 'Kristal Yatağı',    short: 'KRİSTAL',  dark: [9, 4, 16],   decor: 'crys',   fx: null,    tint: 'rgba(200,100,255,0.04)' },
  { name: 'Obsidyen Derinliği', short: 'OBSİDYEN', dark: [4, 3, 8],   decor: 'shard',  fx: 'ash',   tint: null },
  { name: 'Boşluk Çekirdeği',  short: 'BOŞLUK',   dark: [3, 2, 10],   decor: 'star',   fx: 'star',  tint: 'rgba(80,60,255,0.06)' },
];
