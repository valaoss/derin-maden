// Tüm denge sayıları tek yerde.

export const RES = {
  iron:    { label: 'Demir',   value: 0.3 },
  water:   { label: 'Su',      value: 0.4 },
  cobalt:  { label: 'Kobalt',  value: 0.9 },
  crystal: { label: 'Kristal', value: 2.0 },
};
export const RES_KEYS = ['iron', 'water', 'cobalt', 'crystal'];

export const PLAYER = {
  speed: 62, hp: 100, hitW: 10, hitH: 12, iframes: 0.55,
  surfaceRegen: 10, respawn: 4,
};

export const BASE = { hp: 400, calmRegen: 0.9, radius: 22, armor: 0.4, gun: { range: 76, dmg: 8, cd: 0.65 } };

// Seviye 0..max. effect[lvl] mevcut seviyedeki değer.
export const UPGRADES = {
  drill: {
    name: 'Matkap', icon: 'drill',
    dmg: [1, 1.6, 2.5, 3.8, 5.5, 8],
    interval: [0.22, 0.21, 0.2, 0.19, 0.18, 0.17],
    costs: [{ iron: 6 }, { iron: 12 }, { iron: 10, cobalt: 4 }, { iron: 14, cobalt: 8 }, { cobalt: 10, crystal: 4 }],
    desc: l => `Kazı gücü ×${[1, 1.6, 2.5, 3.8, 5.5, 8][l]}`,
  },
  bag: {
    name: 'Çanta', icon: 'bag',
    cap: [12, 18, 26, 34, 44, 56],
    costs: [{ iron: 5 }, { iron: 10 }, { iron: 12, water: 4 }, { water: 8, cobalt: 5 }, { cobalt: 8, crystal: 3 }],
    desc: l => `Kapasite ${[12, 18, 26, 34, 44, 56][l]}`,
  },
  armor: {
    name: 'Zırh', icon: 'armor',
    hp: [100, 130, 165, 205, 250],
    costs: [{ water: 4 }, { water: 8, iron: 6 }, { water: 10, cobalt: 5 }, { cobalt: 8, crystal: 4 }],
    desc: l => `Maks can ${[100, 130, 165, 205, 250][l]}`,
  },
  blaster: {
    name: 'Blaster', icon: 'blaster',
    dmg: [8, 11, 14, 18, 23, 30],
    cd: [0.5, 0.45, 0.4, 0.35, 0.3, 0.26],
    range: [78, 84, 90, 96, 102, 110],
    costs: [{ iron: 6 }, { iron: 8, water: 3 }, { cobalt: 5 }, { cobalt: 9, water: 4 }, { cobalt: 10, crystal: 4 }],
    desc: l => `Hasar ${[8, 11, 14, 18, 23, 30][l]}`,
  },
  lamp: {
    name: 'Fener', icon: 'lamp',
    radius: [7, 8.5, 10, 11.5],
    costs: [{ water: 5 }, { water: 6, cobalt: 4 }, { crystal: 5 }],
    desc: l => `Görüş ${[7, 8.5, 10, 11.5][l]} blok`,
  },
};
export const UPGRADE_KEYS = ['drill', 'bag', 'blaster', 'armor', 'lamp'];

// Kazma kademeleri: matkap seviyesiyle birlikte kazmanın görünümü değişir (renk, parıltı, kıvılcım)
export const PICK_TIERS = [
  { name: 'Odun Kazma',    head: '#8a5a2a', headL: '#b07a42', handle: '#5a3a1a', spark: '#d8b080', glow: null },
  { name: 'Taş Kazma',     head: '#6a6166', headL: '#948a8c', handle: '#6a4a2a', spark: '#c8c0c0', glow: null },
  { name: 'Demir Kazma',   head: '#a7b0c4', headL: '#dfe6f0', handle: '#7a5a2a', spark: '#ffe79a', glow: null },
  { name: 'Altın Kazma',   head: '#e0a020', headL: '#ffe07a', handle: '#8a5a2a', spark: '#ffd24a', glow: 'rgba(255,200,80,0.35)' },
  { name: 'Kobalt Kazma',  head: '#2c48c8', headL: '#8ab0ff', handle: '#3a3a5a', spark: '#8ab0ff', glow: 'rgba(90,134,255,0.45)' },
  { name: 'Kristal Kazma', head: '#9030c8', headL: '#f0b0ff', handle: '#3a1a4a', spark: '#e070ff', glow: 'rgba(224,112,255,0.55)' },
];

// schematic: true => Kalıntı sandığından çıkan şema ile açılır (kalıcı)
export const BUILDS = {
  turret: { name: 'Taret', icon: 'turret', cost: { iron: 10 }, hp: 80, range: 112, dmg: 12, cd: 0.6, desc: 'Yakındaki düşmanlara ateş eder' },
  heal:   { name: 'Onarım', icon: 'heal', cost: { water: 8, iron: 4 }, hp: 60, range: 56, rate: 5, desc: 'Üssü, taretleri ve seni onarır' },
  flame:  { name: 'Alev Tareti', icon: 'flame', cost: { iron: 8, cobalt: 3 }, hp: 110, range: 46, dps: 30, schematic: true, desc: 'Kısa menzil, sürekli alan hasarı' },
  frost:  { name: 'Buz Tareti', icon: 'frost', cost: { water: 6, crystal: 2 }, hp: 80, range: 100, dmg: 6, cd: 0.7, slowT: 2.2, schematic: true, desc: 'Vurduğu düşmanı yarı hıza düşürür' },
  mortar: { name: 'Havan', icon: 'mortar', cost: { iron: 12, cobalt: 4 }, hp: 90, range: 160, minRange: 30, dmg: 30, splash: 26, cd: 2.6, schematic: true, desc: 'Uzak menzil, alan hasarı' },
};
export const BUILD_KEYS = ['turret', 'heal', 'flame', 'frost', 'mortar'];
export const BARRICADE = { cost: { iron: 3 }, hp: 70 };

// Üretilen eşyalar (Atölye > Üret). Kemerden kullanılır.
export const ITEMS = {
  torch:     { name: 'Meşale', icon: 'torch', cost: { iron: 1 }, max: 9, desc: 'Tünel duvarına as: kalıcı ışık.' },
  dynamite:  { name: 'Dinamit', icon: 'dynamite', cost: { iron: 3, water: 1 }, max: 5, desc: '2 sn sonra patlar: çevresindeki kayayı kırar, düşmanlara 60 hasar.' },
  medkit:    { name: 'Tamir Kiti', icon: 'medkit', cost: { water: 3 }, max: 3, desc: 'Anında 50 can yeniler.' },
  barricade: { name: 'Barikat', icon: 'barricade', cost: BARRICADE.cost, max: 9, desc: 'Tünele koy: düşmanı durdurur, sen içinden geçersin.' },
  mine:      { name: 'Mayın', icon: 'mine', cost: { iron: 2, cobalt: 1 }, max: 5, schematic: true, desc: 'Tünele göm: ilk yaklaşan düşmanda patlar (45 alan hasarı).' },
  recall:    { name: 'Dönüş Fişeği', icon: 'recall', cost: { water: 2, cobalt: 1 }, max: 2, schematic: true, desc: '1.5 sn sonra seni yüzeye ışınlar. Kalp Kristali ile çalışmaz.' },
};
export const ITEM_KEYS = ['torch', 'dynamite', 'medkit', 'barricade', 'mine', 'recall'];
export const DYNAMITE = { fuse: 2, radius: 2.2, dmg: 60, selfDmg: 14 };
export const MINE = { arm: 0.8, trigger: 11, radius: 26, dmg: 45 };
export const MEDKIT = { heal: 50 };
export const RECALL = { channel: 1.5 };
export const TORCH = { light: 4.6 };

// Sandıklardan sırayla çıkan şemalar (bir kez bulunan kalıcıdır)
export const SCHEMATICS = [
  { key: 'recall', kind: 'item' }, { key: 'mine', kind: 'item' },
  { key: 'flame', kind: 'build' }, { key: 'frost', kind: 'build' }, { key: 'mortar', kind: 'build' },
];

// Tehlikeler: gevşek kaya (göçük) ve gaz cepleri
export const HAZARD = { fallDelay: 0.9, fallDmg: 22, fallEnemyDmg: 45, gasTime: 7, gasRadius: 22, gasDps: 7, gasBoom: 40 };
export const REPAIR = { cost: { iron: 5 }, amount: 70 };

// Düşmanlar: r = çarpışma yarıçapı, dig = kazabildiği maks kaya hp'si
export const ENEMIES = {
  rodent:  { name: 'Kemirgen', hp: 18, speed: 48, dmg: 6, r: 4, dig: 1, digRate: 1.3, cost: 1 },
  bug:     { name: 'Kabukbiti', hp: 50, speed: 26, dmg: 10, r: 6, armor: 0.35, cost: 2.5 },
  spitter: { name: 'Tükürgen', hp: 28, speed: 30, dmg: 9, r: 5, ranged: true, range: 72, fireCd: 1.7, cost: 2 },
  flyer:   { name: 'Yarasa', hp: 22, speed: 62, dmg: 7, r: 4, fly: true, cost: 1.5 },
  boomer:  { name: 'Kristalböcek', hp: 24, speed: 40, dmg: 26, r: 5, boom: 26, cost: 2 },
  brute:   { name: 'Kaya Devi', hp: 140, speed: 20, dmg: 22, r: 8, armor: 0.4, dig: 99, digRate: 5, knockResist: 0.85, cost: 5 },
  worm:    { name: 'Maden Solucanı', hp: 60, speed: 24, dmg: 10, r: 6, armor: 0.2, burrow: true, dig: 99, digRate: 7, knockResist: 0.7, cost: 3 },
  boss:    { name: 'Derin Ana', hp: 540, speed: 21, dmg: 28, r: 11, armor: 0.3, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0 },
  // derin katman yaratıkları: her biri farklı bir "sürpriz"
  glarer:  { name: 'Parıldak', hp: 34, speed: 34, dmg: 5, r: 5, fly: true, blind: true, blindRange: 48, blindCd: 4.5, cost: 2.5 },   // kör edici parlama
  lurker:  { name: 'Çekici', hp: 70, speed: 18, dmg: 14, r: 7, armor: 0.25, pull: true, pullRange: 80, cost: 3 },                      // dilini uzatıp çeker
  howler:  { name: 'Uluyan', hp: 46, speed: 30, dmg: 8, r: 6, howl: true, howlRange: 90, howlCd: 6, cost: 2.5 },                      // korkutucu çığlık: yavaşlatır
  shade:   { name: 'Gölge', hp: 26, speed: 44, dmg: 12, r: 4, phase: true, cost: 2 },                                                // karanlıkta görünmez, ışıkta belirir
};

export const WAVES = {
  firstCalm: 55, calm: 38, warn: 13, heartCalm: 16,
  budget: (wave, stratum, mult = 1) => (0.6 + wave * 1.75 + stratum * 2.8 + Math.max(0, wave - 6) * 0.6) * mult,
  hpScale: wave => 1 + 0.09 * (wave - 1),
  bossEvery: 6,
  allowed(wave, stratum) {
    const a = ['rodent'];
    if (wave >= 3 || stratum >= 1) a.push('bug');
    if (stratum >= 1 || wave >= 5) a.push('spitter');
    if (stratum >= 2 || wave >= 8) a.push('flyer');
    if (stratum >= 2 || wave >= 7) a.push('boomer');
    if (stratum >= 1 && wave >= 5) a.push('brute');
    if (stratum >= 1 && wave >= 4) a.push('worm');
    if (stratum >= 2 && wave >= 4) a.push('glarer');
    if (stratum >= 2 && wave >= 5) a.push('lurker');
    if (stratum >= 3 || wave >= 9) a.push('howler');
    if (stratum >= 3 && wave >= 6) a.push('shade');
    return a;
  },
};

// Kalıntı perk'leri
export const PERKS = {
  kazmaDarbesi: { name: 'Kazma Darbesi', icon: 'drill', desc: 'Kazı vuruşların önündeki düşmana da 18 hasar verir.' },
  miknatis:     { name: 'Mıknatıs', icon: 'magnet', desc: 'Cevherleri 3 kat uzaktan çekersin.' },
  zincir:       { name: 'Zincirleme Kırılım', icon: 'chain', desc: 'Kırdığın blok %35 ihtimalle arkasındakini de kırar.' },
  damar:        { name: 'Damar Avcısı', icon: 'gem', desc: 'Her cevher +1 fazla düşürür.' },
  ciftNamlu:    { name: 'Çift Namlu', icon: 'blaster', desc: 'Blaster aynı anda iki mermi atar.' },
  delici:       { name: 'Delici Mermi', icon: 'pierce', desc: 'Mermilerin bir düşmanı delip geçer.' },
  hafifBot:     { name: 'Hafif Botlar', icon: 'boot', desc: 'Hareket hızın %20 artar.' },
  derinCep:     { name: 'Derin Cepler', icon: 'bag', desc: 'Çanta kapasitesi +12.' },
  taretAsiri:   { name: 'Aşırı Yükleme', icon: 'turret', desc: 'Taretler %50 daha hızlı ateş eder.' },
  kaleUs:       { name: 'Kale Üs', icon: 'base', desc: 'Üs maks canı +120 ve tamamen onarılır.' },
  yasamOzu:     { name: 'Yaşam Özü', icon: 'heart', desc: 'Her öldürme 3 can yeniler.' },
  sokDalgasi:   { name: 'Şok Dalgası', icon: 'shock', desc: 'Hasar aldığında çevrendeki düşmanlar savrulur ve 20 hasar alır.' },
  parlakFener:  { name: 'Parlak Fener', icon: 'lamp', desc: 'Görüş +2 blok. Karanlıktaki cevherler parıldar.' },
};

// Kalıcı Kamp yükseltmeleri (Öz ile)
export const META = {
  erzak:     { name: 'Erzak', icon: 'iron', max: 3, costs: [20, 45, 80], desc: 'Sefere +8 demirle başla (seviye başına).' },
  genisCanta:{ name: 'Geniş Çanta', icon: 'bag', max: 3, costs: [25, 50, 90], desc: 'Çanta kapasitesi +4 (seviye başına).' },
  keskinUc:  { name: 'Keskin Uç', icon: 'drill', max: 2, costs: [40, 100], desc: 'Matkap bir seviye yukarıda başlar.' },
  tahkimat:  { name: 'Tahkimat', icon: 'base', max: 3, costs: [30, 60, 110], desc: 'Üs maks canı +60 (seviye başına).' },
  ayarliBl:  { name: 'Ayarlı Blaster', icon: 'blaster', max: 2, costs: [40, 100], desc: 'Blaster bir seviye yukarıda başlar.' },
  hazirTaret:{ name: 'Hazır Taret', icon: 'turret', max: 1, costs: [70], desc: 'Sefere kurulu bir taretle başla.' },
  kalintiBil:{ name: 'Kalıntı Bilgisi', icon: 'chest', max: 1, costs: [120], desc: 'Kalıntı sandıkları 4 seçenek sunar.' },
};
export const META_KEYS = Object.keys(META);

// Zafer sonrası açılan zorluk kademeleri (birikimli)
export const KADEME = [
  { name: 'Normal', desc: 'Standart sefer' },
  { name: 'Kademe 1', desc: 'Düşmanlar %20 daha dayanıklı' },
  { name: 'Kademe 2', desc: '+ Dalgalar arası %20 daha kısa' },
  { name: 'Kademe 3', desc: '+ İki kat göçük ve gaz cebi' },
  { name: 'Kademe 4', desc: '+ Üs sakin fazda kendini onarmaz' },
  { name: 'Kademe 5', desc: '+ Derin Ana her 4 dalgada bir' },
];
export function kademeMods(k = 0) {
  return { hp: k >= 1 ? 1.2 : 1, calm: k >= 2 ? 0.8 : 1, hazard: k >= 3 ? 2 : 1, noRegen: k >= 4, bossEvery: k >= 5 ? 4 : 6, oz: 1 + 0.25 * k };
}

// Sefer kontratları: her seferde 2 tane, tamamlanınca bonus Öz
// vals: oyuncunun ulaştığı en derin katmana göre hedef; minStratum: sunulması için gereken katman
export const CONTRACTS = {
  depth:   { icon: 'depth', text: n => `${n}m derinliğe in`, vals: [30, 50, 70, 90], stat: g => g.stats.maxDepth, oz: 12 },
  kills:   { icon: 'skull', text: n => `${n} düşman yok et`, vals: [20, 35, 50, 70], stat: g => g.stats.kills, oz: 10 },
  waves:   { icon: 'wave', text: n => `${n} dalga temizle`, vals: [3, 5, 7, 9], stat: g => g.stats.wavesCleared, oz: 12 },
  chests:  { icon: 'chest', text: n => `${n} kalıntı sandığı aç`, vals: [1, 2, 3, 4], stat: g => g.stats.chests, oz: 14 },
  cobalt:  { icon: 'cobalt', text: n => `${n} kobalt depola`, vals: [6, 10, 14, 18], stat: g => g.collected.cobalt, oz: 12, minStratum: 1 },
  crystal: { icon: 'crystal', text: n => `${n} kristal depola`, vals: [4, 4, 6, 8], stat: g => g.collected.crystal, oz: 16, minStratum: 2 },
  blast:   { icon: 'dynamite', text: n => `Dinamitle ${n} blok kır`, vals: [8, 14, 20, 26], stat: g => g.stats.blasted, oz: 10 },
  torches: { icon: 'torch', text: n => `${n} meşale as`, vals: [3, 5, 7, 9], stat: g => g.stats.torches, oz: 8 },
};

export function ozForRun(s) {
  return Math.round(
    s.maxDepth * 0.6 + s.wavesCleared * 4 + s.chests * 6 + (s.victory ? 150 : 0) +
    s.collected.iron * RES.iron.value + s.collected.water * RES.water.value +
    s.collected.cobalt * RES.cobalt.value + s.collected.crystal * RES.crystal.value
  );
}
