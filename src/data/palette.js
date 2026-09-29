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
  // v5 derin biyomlar
  quick:    ['#0e1014', '#2a3038', '#4a5460', '#7a8898', '#c8d8e4'],
  storm:    ['#060a14', '#0e1a30', '#16304e', '#22507a', '#4a9ad8'],
  gilt:     ['#1a1006', '#4a3010', '#7a5218', '#b88a2a', '#ffd870'],
  gate:     ['#120c04', '#3a2a10', '#6a4c1a', '#a07a2a', '#e8c060'],
  fungus:   ['#120a14', '#2e1a34', '#4a2a50', '#6a3e6a', '#a86a90'],
  glass:    ['#0a1418', '#1e3a44', '#2e5a68', '#5a98a8', '#d8f8ff'],
  titan:    ['#0c100c', '#1e2a22', '#304236', '#4a6250', '#7a9a78'],
  chrono:   ['#0c0a06', '#2a2010', '#4a3a1a', '#7a6030', '#c8a860'],
  blood:    ['#120204', '#2e060a', '#4e0c12', '#7a141c', '#c02a30'],
  echo:     ['#08070c', '#181622', '#262234', '#3a3450', '#5e5880'],
  genesis:  ['#14100c', '#3a2e3a', '#6a5a70', '#a898b0', '#fff4e8'],
  // v6 biyomlar
  mute:     ['#0c0c10', '#22242c', '#383c48', '#545a6a', '#8a90a0'],
  tide:     ['#041014', '#0c2a34', '#16444e', '#2a6a74', '#5aa8b0'],
  flesh:    ['#140406', '#3a0e16', '#5e1a26', '#8a2e3a', '#d06070'],
  mirror:   ['#0e0e16', '#2e3040', '#50546a', '#8a90aa', '#e0e8ff'],
  amber:    ['#140a02', '#3e2008', '#6a3a10', '#a8641c', '#ffb040'],
  magnet:   ['#100808', '#2e1614', '#4a2420', '#6e3a32', '#a8604e'],
  hunger:   ['#0e0e06', '#2a2a12', '#44441e', '#62622e', '#9a9a50'],
  rootwood: ['#0a0c06', '#1e2612', '#34401e', '#4e5e2e', '#7e9a50'],
  sea:      ['#02040c', '#060e22', '#0c1a3a', '#16305a', '#3a6aa8'],
  zero:     ['#101010', '#3a3a3a', '#6a6a6a', '#a8a8a8', '#ffffff'],
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
  quick:    ['#07080a', '#0e1014', '#151820', '#1c2028'],
  storm:    ['#03050a', '#070c16', '#0b1422', '#101c2e'],
  gilt:     ['#0c0804', '#181006', '#241a0a', '#30240e'],
  fungus:   ['#0a060a', '#140c16', '#1e1220', '#28182a'],
  glass:    ['#050a0c', '#0c161a', '#122226', '#1a2e34'],
  titan:    ['#060806', '#0e140f', '#141c16', '#1c261e'],
  chrono:   ['#060502', '#100c04', '#181208', '#22180a'],
  blood:    ['#080102', '#140204', '#1e0406', '#2a060a'],
  echo:     ['#040308', '#0a0810', '#100c18', '#161220'],
  genesis:  ['#0a0808', '#1a1416', '#262022', '#342c30'],
  mute:     ['#060608', '#0c0d10', '#121418', '#181b20'],
  tide:     ['#02080a', '#061216', '#0a1a20', '#0e222a'],
  flesh:    ['#0a0204', '#140408', '#1e080c', '#280c12'],
  mirror:   ['#06060a', '#0c0c14', '#12121e', '#181a28'],
  amber:    ['#0a0501', '#140a03', '#1e1005', '#281608'],
  magnet:   ['#080404', '#100808', '#180c0c', '#201010'],
  hunger:   ['#060603', '#0e0e06', '#14140a', '#1c1c0e'],
  rootwood: ['#050603', '#0a0e06', '#10160a', '#161e0e'],
  sea:      ['#010206', '#02060e', '#040a16', '#060e1e'],
  zero:     ['#080808', '#121212', '#1a1a1a', '#222222'],
  bedrock:  ['#040306', '#08060b', '#0c0a10', '#100d15'],
  vault:    ['#06040a', '#0c0812', '#120c1a', '#181022'],
};

export const ORE_RAMP = {
  iron:    ['#5a2e14', '#b06a34', '#e8a060', '#ffe0b0'],
  water:   ['#123a5a', '#2c8ac4', '#6fd0ff', '#e4f8ff'],
  cobalt:  ['#141c5a', '#2c48c8', '#5a86ff', '#c4d4ff'],
  crystal: ['#3a0e52', '#9030c8', '#e070ff', '#ffd8ff'],
  gold:    ['#5a3a08', '#c08a1a', '#ffd24a', '#fff4c0'],
  yesim:    ['#0a3a1a', '#1a8a4a', '#5ae08a', '#d8ffe0'],
  opal:     ['#4a0808', '#b01a1a', '#ff4a3a', '#ffd0c0'],
  inci:     ['#3a3a4a', '#9a9ab0', '#eeeef8', '#ffffff'],
  akik:     ['#4a0830', '#a01a6a', '#ff5ab0', '#ffd0f0'],
  yildiz:   ['#104840', '#30b0a0', '#b8fff4', '#ffffff'],
  elmas:    ['#0a0a12', '#3a3a50', '#b0b8d0', '#ffffff'],
  kehribar: ['#4a2008', '#b0601a', '#ffb040', '#fff0c0'],
};

export const RES_COL = { iron: '#e8a060', water: '#6fd0ff', cobalt: '#5a86ff', crystal: '#e070ff', gold: '#ffd24a', yesim: '#5ae08a', opal: '#ff4a3a', inci: '#eeeef8', akik: '#ff5ab0', yildiz: '#b8fff4', elmas: '#c8d0ff', kehribar: '#ffb040' };
export const TIDE_COL = 'rgba(40,120,190,0.32)';

// Biyomlar (30): isim, HUD kısaltması, karanlık rengi, süs türü, parçacık efekti, ton
// decor: 'mush' mantar, 'crys' kristal, 'root' kök sarkıtı, 'icicle' buz sarkıtı, 'bone' kemik, 'ember' kor, 'shard' obsidyen, 'star' boşluk ışığı,
//        'drip' cıva damlası, 'arc' statik kıvılcım, 'coin' altın yığını, 'shroom' dev mantar, 'pane' cam dikeni, 'vein' nabız damarı, 'gear' dişli, 'pool' kan birikintisi, 'ring' yankı halkası, 'halo' ışık zerresi
// fx: 'spore' sporlar, 'snow' kar, 'ember' kor, 'ash' kül, 'star' yıldız tozu, 'mist' cıva buharı, 'spark' kıvılcım, 'gleam' altın pırıltı, 'glint' cam parıltısı, 'sand' zaman kumu, 'blood' kan damlası, 'echo' yankı zerresi, 'halo' ışık
// sig: biyomun imza düşmanı (yuvalardan sık çıkar). legend: efsanevi biyom (altın afiş, hazine odası). noiseMul: biyomda gürültü çarpanı. pulse: ton nabız gibi atar
export const STRATA = [
  { name: 'Toprak Katmanı',    short: 'TOPRAK',   dark: [10, 6, 12],  decor: 'mush',   fx: null,    tint: null, sig: null },
  { name: 'Taş Damarları',     short: 'TAŞ',      dark: [8, 7, 12],   decor: 'mush',   fx: null,    tint: null, sig: 'bug' },
  { name: 'Kök Ormanı',        short: 'KÖK',      dark: [5, 10, 6],   decor: 'root',   fx: 'spore', tint: 'rgba(60,140,60,0.05)', sig: 'spider' },
  { name: 'Kobalt Mağaraları', short: 'KOBALT',   dark: [5, 7, 16],   decor: 'crys',   fx: null,    tint: null, sig: 'glarer' },
  { name: 'Buz Katmanı',       short: 'BUZ',      dark: [6, 10, 18],  decor: 'icicle', fx: 'snow',  tint: 'rgba(120,200,255,0.06)', sig: 'frostbat' },
  { name: 'Kemik Çukuru',      short: 'KEMİK',    dark: [10, 8, 6],   decor: 'bone',   fx: 'ash',   tint: null, sig: 'skitter' },
  { name: 'Kor Katmanı',       short: 'KOR',      dark: [14, 4, 3],   decor: 'ember',  fx: 'ember', tint: 'rgba(255,90,30,0.07)', sig: 'magmite' },
  { name: 'Kristal Yatağı',    short: 'KRİSTAL',  dark: [9, 4, 16],   decor: 'crys',   fx: null,    tint: 'rgba(200,100,255,0.04)', sig: 'boomer' },
  { name: 'Obsidyen Derinliği', short: 'OBSİDYEN', dark: [4, 3, 8],   decor: 'shard',  fx: 'ash',   tint: null, sig: 'ogolem' },
  { name: 'Boşluk Çekirdeği',  short: 'BOŞLUK',   dark: [3, 2, 10],   decor: 'star',   fx: 'star',  tint: 'rgba(80,60,255,0.06)', sig: 'voidling' },
  // v5: derin biyomlar
  { name: 'Cıva Denizi',       short: 'CIVA',     dark: [8, 9, 12],   decor: 'drip',   fx: 'mist',  tint: 'rgba(180,200,220,0.05)', sig: 'quickling', desc: 'Cıva cepleri altın verir ama zehirler.' },
  { name: 'Fırtına Damarı',    short: 'FIRTINA',  dark: [3, 6, 14],   decor: 'arc',    fx: 'spark', tint: 'rgba(60,140,255,0.06)', sig: 'voltbat', desc: 'Yıldırım damarları çevredeki düşmanı çarpar.' },
  { name: 'Altın Saray',       short: 'SARAY',    dark: [14, 9, 3],   decor: 'coin',   fx: 'gleam', tint: 'rgba(255,200,80,0.07)', sig: 'gilded', legend: true, desc: 'Kapısı 200 vuruşluk; içi altın ve sandık dolu.' },
  { name: 'Mantar Uçurumu',    short: 'MANTAR',   dark: [8, 4, 10],   decor: 'shroom', fx: 'spore', tint: 'rgba(160,80,200,0.05)', sig: 'sporeling', desc: 'Spor keseleri seni iyileştirir, düşmanı uyuşturur.' },
  { name: 'Cam Katedrali',     short: 'CAM',      dark: [4, 10, 14],  decor: 'pane',   fx: 'glint', tint: 'rgba(140,240,255,0.05)', sig: 'mirrorling', noiseMul: 1.5, desc: 'Cam zincirleme kırılır: hızlı ama gürültülü.' },
  { name: 'Uyuyan Dev',        short: 'DEV',      dark: [6, 9, 6],    decor: 'vein',   fx: 'ash',   tint: 'rgba(255,60,60,0.06)', sig: 'titanling', legend: true, pulse: true, desc: 'Nabız taşları can verir ama Dev uyanır.' },
  { name: 'Zaman Kırığı',      short: 'ZAMAN',    dark: [8, 6, 3],    decor: 'gear',   fx: 'sand',  tint: 'rgba(220,170,80,0.05)', sig: 'chronoling', desc: 'Zaman taşı düşmanı dondurur, seni hızlandırır.' },
  { name: 'Kan Gölü',          short: 'KAN',      dark: [12, 2, 4],   decor: 'pool',   fx: 'blood', tint: 'rgba(200,20,40,0.07)', sig: 'leech', desc: 'Kan damarları demir ve can verir; göl uyanır.' },
  { name: 'Yankı Boşluğu',     short: 'YANKI',    dark: [5, 4, 8],    decor: 'ring',   fx: 'echo',  tint: null, sig: 'echoer', noiseMul: 2, desc: 'Her ses iki kat; sessiz taşlar ölçeri düşürür.' },
  { name: 'Yaratılış Çekirdeği', short: 'YARATILIŞ', dark: [10, 8, 12], decor: 'halo', fx: 'halo',  tint: 'rgba(255,240,200,0.06)', sig: 'seraph', legend: true, desc: 'Tohumlar çevre kayayı cevhere çevirir. Kıvılcım burada.' },
  // v6: çekirdeğin öbür yüzü. Öte Yüz (20-23) · İlk Taş (24-27) · Son (28-29)
  { name: 'Sağır Mağaralar',   short: 'SAĞIR',    dark: [6, 6, 8],    decor: 'ring',   fx: 'echo',  tint: null, sig: 'korAvci', deaf: true, desc: 'Burada düşmanlar görmez, yalnız duyar. Sus ya da tuzak taşıyla kandır.' },
  { name: 'Gelgit Kuyuları',   short: 'GELGİT',   dark: [3, 8, 12],   decor: 'drip',   fx: 'mist',  tint: 'rgba(40,140,200,0.06)', sig: 'yilan', tide: true, desc: 'Su dakikada bir yükselir: suda yavaşlarsın, silah ateş etmez.' },
  { name: 'Yaşayan Kaya',      short: 'ET',       dark: [12, 4, 6],   decor: 'vein',   fx: 'blood', tint: 'rgba(200,60,80,0.06)', sig: 'orucu', regrow: true, pulse: true, desc: 'Kazdığın tünel 20 sn’de kapanır. Sinir düğümü büyümeyi durdurur.' },
  { name: 'Ters Saray',        short: 'TERS',     dark: [8, 8, 14],   decor: 'pane',   fx: 'glint', tint: 'rgba(200,210,255,0.05)', sig: 'kalkanli', legend: true, desc: 'Baş aşağı saray: tavandaki avizeler Kara Elmas, taht tavanda.' },
  { name: 'Kehribar Mezarı',   short: 'KEHRİBAR', dark: [12, 7, 2],   decor: 'amber',  fx: 'gleam', tint: 'rgba(255,170,60,0.06)', sig: 'diriltici', desc: 'Kehribar kırılınca içinden ganimet ya da uyanan bir yaratık çıkar.' },
  { name: 'Mıknatıs Çekirdeği', short: 'MIKNATIS', dark: [8, 5, 5],   decor: 'shard',  fx: 'spark', tint: 'rgba(255,90,90,0.04)', sig: 'kene', desc: 'Demir bol; mermiler Demir Kene’ye doğru kıvrılır.' },
  { name: 'Açlık Yatağı',      short: 'AÇLIK',    dark: [8, 8, 4],    decor: 'bone',   fx: 'ash',   tint: 'rgba(160,160,60,0.05)', sig: 'fare', sig2: 'tozbocek', hunger: true, desc: 'Damarlar zamanla kararır; Cevher Faresi çantandan çalıp kaçar.' },
  { name: 'Kök Tahtı',         short: 'TAHT',     dark: [4, 10, 5],   decor: 'root',   fx: 'spore', tint: 'rgba(90,200,90,0.06)', sig: 'yumurtaci', legend: true, desc: 'Dünya ağacının kökü. Yumurtaları 8 sn içinde kır.' },
  { name: 'Sessiz Deniz',      short: 'DENİZ',    dark: [1, 2, 6],    decor: 'lumen',  fx: 'star',  tint: 'rgba(20,40,120,0.08)', sig: 'isikYiyen', sea: true, desc: 'Burada ölçer sönmez, durmadan dolar. Hızlı ol.' },
  { name: 'Sıfır Noktası',     short: 'SIFIR',    dark: [10, 10, 10], decor: 'halo',   fx: 'halo',  tint: 'rgba(255,255,255,0.04)', sig: ['korAvci', 'kalkanli', 'diriltici', 'kene', 'yumurtaci', 'isikYiyen'], legend: true, desc: 'Her şeyin başladığı yer. Kalp burada.' },
];
