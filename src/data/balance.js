// Tüm denge sayıları tek yerde.

export const RES = {
  iron:    { label: 'Demir',   value: 0.3 },
  water:   { label: 'Su',      value: 0.4 },
  cobalt:  { label: 'Kobalt',  value: 0.9 },
  crystal: { label: 'Kristal', value: 2.0 },
  gold:    { label: 'Altın',   value: 1.4 },
  // derin cevherler: her 4 biyomluk bantta bir tane; Atölye'de tek bir Usta İşi açar, artanı Öz'e döner
  yesim: { label: 'Yeşim', value: 2.5, master: 'muska' },
  opal:     { label: 'Ateş Opali', value: 3, master: 'opalNamlu' },
  inci:     { label: 'Boşluk İncisi', value: 3.5, master: 'inciFener' },
  akik:     { label: 'Saray Akiği', value: 4, master: 'akikKalkan' },
  yildiz:   { label: 'Yıldız Taşı', value: 5, master: 'yildizCekirdek' },
};
export const BASE_RES = ['iron', 'water', 'cobalt', 'crystal', 'gold'];
export const DEEP_ORES = ['yesim', 'opal', 'inci', 'akik', 'yildiz'];
export const RES_KEYS = BASE_RES.concat(DEEP_ORES);

export const PLAYER = {
  speed: 62, hp: 100, hitW: 9, hitH: 11, iframes: 0.55,
  surfaceRegen: 10,
  downTime: 25,      // baygın kalma süresi (partner bu sürede kaldırmalı)
  reviveTime: 1.6,   // partnerin yanında durma süresi
};

export const BASE = { hp: 400, calmRegen: 0.9, radius: 22, armor: 0.4, gun: { range: 76, dmg: 8, cd: 0.65 } };

// Kazma kademeleri: satın alınır (sırayla). Görünüm (renk, parıltı, kıvılcım) + kazı gücü + vuruş aralığı.
// her biyom kazıyı biraz ağırlaştırır: kazma hasarı / (1 + biyom × DIG_DEPTH)
export const DIG_DEPTH = 0.08;
export const PICK_TIERS = [
  { name: 'Odun Kazma',     dmg: 1,    interval: 0.22, head: '#8a5a2a', headL: '#b07a42', handle: '#5a3a1a', spark: '#d8b080', glow: null },
  { name: 'Taş Kazma',      dmg: 1.8,  interval: 0.21, head: '#6a6166', headL: '#948a8c', handle: '#6a4a2a', spark: '#c8c0c0', glow: null },
  { name: 'Demir Kazma',    dmg: 3,    interval: 0.2,  head: '#a7b0c4', headL: '#dfe6f0', handle: '#7a5a2a', spark: '#ffe79a', glow: null },
  { name: 'Altın Kazma',    dmg: 4.6,  interval: 0.19, head: '#e0a020', headL: '#ffe07a', handle: '#8a5a2a', spark: '#ffd24a', glow: 'rgba(255,200,80,0.35)' },
  { name: 'Kobalt Kazma',   dmg: 6.8,  interval: 0.18, head: '#2c48c8', headL: '#8ab0ff', handle: '#3a3a5a', spark: '#8ab0ff', glow: 'rgba(90,134,255,0.45)' },
  { name: 'Kristal Kazma',  dmg: 9.5,  interval: 0.17, head: '#9030c8', headL: '#f0b0ff', handle: '#3a1a4a', spark: '#e070ff', glow: 'rgba(224,112,255,0.55)' },
  { name: 'Obsidyen Kazma', dmg: 14,   interval: 0.16, head: '#2c2440', headL: '#8a7ab8', handle: '#1a1428', spark: '#b0a0e0', glow: 'rgba(120,90,200,0.5)' },
  { name: 'Boşluk Kazma',   dmg: 20,   interval: 0.15, head: '#1c1840', headL: '#9a90ff', handle: '#0a0818', spark: '#c0b8ff', glow: 'rgba(120,100,255,0.7)' },
  { name: 'Yıldız Demiri',  dmg: 30,   interval: 0.14, head: '#4a9ad8', headL: '#d8f8ff', handle: '#16304e', spark: '#9ad8ff', glow: 'rgba(90,180,255,0.7)' },
  { name: 'Yaratılış Kazması', dmg: 45, interval: 0.13, head: '#e0b040', headL: '#fff4e8', handle: '#3a2e3a', spark: '#fff0a0', glow: 'rgba(255,230,160,0.8)' },
];
const PICK_COSTS = [{ iron: 6 }, { iron: 14 }, { iron: 8, gold: 6 }, { cobalt: 10, gold: 4 }, { crystal: 6, cobalt: 8 }, { crystal: 10, gold: 10 }, { crystal: 16, cobalt: 12, gold: 12 }, { crystal: 24, cobalt: 16, gold: 20 }, { crystal: 40, gold: 32 }];

// Seviye 0..max. effect[lvl] mevcut seviyedeki değer.
export const UPGRADES = {
  drill: {
    name: 'Kazma', icon: 'drill',
    dmg: PICK_TIERS.map(t => t.dmg),
    interval: PICK_TIERS.map(t => t.interval),
    costs: PICK_COSTS,
    desc: l => `${PICK_TIERS[l].name} · güç ×${PICK_TIERS[l].dmg}`,
  },
  sharp: {
    name: 'Keskinlik', icon: 'sharp',
    mult: [1, 1.15, 1.3, 1.5, 1.75],
    costs: [{ iron: 10 }, { iron: 12, gold: 4 }, { cobalt: 8, gold: 8 }, { crystal: 8, gold: 12 }],
    desc: l => `Kazı gücü ×${[1, 1.15, 1.3, 1.5, 1.75][l]}`,
  },
  swing: {
    name: 'Hızlı Sallama', icon: 'swing',
    mult: [1, 0.9, 0.82, 0.74],
    costs: [{ water: 8 }, { water: 10, gold: 5 }, { cobalt: 10, gold: 10 }],
    desc: l => `Vuruş aralığı ×${[1, 0.9, 0.82, 0.74][l]}`,
  },
  bag: {
    name: 'Çanta', icon: 'bag',
    cap: [12, 18, 26, 34, 44, 56, 70],
    costs: [{ iron: 5 }, { iron: 10 }, { iron: 12, water: 4 }, { water: 8, cobalt: 5 }, { cobalt: 8, crystal: 3 }, { crystal: 6, gold: 8 }],
    desc: l => `Kapasite ${[12, 18, 26, 34, 44, 56, 70][l]}`,
  },
  armor: {
    name: 'Zırh', icon: 'armor',
    hp: [100, 130, 165, 205, 250, 310],
    costs: [{ water: 4 }, { water: 8, iron: 6 }, { water: 10, cobalt: 5 }, { cobalt: 8, crystal: 4 }, { crystal: 8, gold: 10 }],
    desc: l => `Maks can ${[100, 130, 165, 205, 250, 310][l]}`,
  },
  blaster: {
    name: 'Blaster', icon: 'blaster',
    dmg: [8, 11, 14, 18, 23, 30, 38, 48],
    cd: [0.5, 0.45, 0.4, 0.36, 0.32, 0.28, 0.25, 0.22],
    range: [78, 84, 90, 96, 102, 110, 118, 126],
    costs: [{ iron: 6 }, { iron: 8, water: 3 }, { cobalt: 5 }, { cobalt: 9, water: 4 }, { cobalt: 10, crystal: 4 }, { crystal: 8, gold: 8 }, { crystal: 14, gold: 14 }],
    desc: l => `Hasar ${[8, 11, 14, 18, 23, 30, 38, 48][l]}`,
  },
  lamp: {
    name: 'Fener', icon: 'lamp',
    radius: [7, 8.5, 10, 11.5, 13],
    costs: [{ water: 5 }, { water: 6, cobalt: 4 }, { crystal: 5 }, { crystal: 6, gold: 6 }],
    desc: l => `Görüş ${[7, 8.5, 10, 11.5, 13][l]} blok`,
  },
};
// Usta İşi: derin cevherle alınan tek seferlik yükseltmeler (cevher bulununca Atölye'de görünür)
Object.assign(UPGRADES, {
  muska:          { name: 'Yeşim Muska', icon: 'yesim', costs: [{ yesim: 3, iron: 8 }], desc: () => 'Azami can +30.' },
  opalNamlu:      { name: 'Opal Namlu', icon: 'opal', costs: [{ opal: 3, cobalt: 6 }], desc: () => 'Mermilerin yakar; eklenti yuvası harcamaz.' },
  inciFener:      { name: 'İnci Fener', icon: 'inci', costs: [{ inci: 3, crystal: 4 }], desc: () => 'Görüş +3 blok; karartma fenerini kısamaz.' },
  akikKalkan:     { name: 'Akik Kalkan', icon: 'akik', costs: [{ akik: 3, gold: 10 }], desc: () => '15 sn’de bir gelen darbeyi tamamen emer.' },
  yildizCekirdek: { name: 'Yıldız Çekirdeği', icon: 'yildiz', costs: [{ yildiz: 3, crystal: 10 }], desc: () => 'Kazma ve blaster hasarı ×1.4.' },
});
export const MASTER_KEYS = ['muska', 'opalNamlu', 'inciFener', 'akikKalkan', 'yildizCekirdek'];
export const UPGRADE_KEYS = ['bag', 'blaster', 'armor', 'lamp'];
export const PICK_KEYS = ['drill', 'sharp', 'swing'];

// Blaster eklentileri: Atölye > Blaster'dan alınır, 3 yuvaya takılır. Aktif olanlar sağ paneldeki düğmeyle kullanılır.
export const MOD_SLOTS = 3;
export const MODS = {
  ricochet: { name: 'Sekme',        icon: 'ricochet', cost: { iron: 12, gold: 4 },     desc: 'Mermiler duvardan bir kez seker.' },
  split:    { name: 'Çatal Namlu',  icon: 'split',    cost: { iron: 14, cobalt: 6 },   desc: 'Her atışta iki yan mermi (yarım hasar).' },
  frost:    { name: 'Buz Ucu',      icon: 'frost',    cost: { water: 12, cobalt: 4 },  desc: 'İsabet düşmanı 1.2 sn yavaşlatır.' },
  fire:     { name: 'Yakıcı',       icon: 'flame',    cost: { cobalt: 8, gold: 6 },    desc: 'İsabet 3 sn boyunca yakar (saniyede 4).' },
  chain:    { name: 'Yıldırım',     icon: 'chain',    cost: { cobalt: 10, gold: 8 },   desc: 'İsabet yakındaki bir düşmana sıçrar (yarım hasar).' },
  boom:     { name: 'Patlayıcı',    icon: 'boom',     cost: { crystal: 6, gold: 8 },   desc: 'Mermiler küçük bir alanda patlar.' },
  rapid:    { name: 'Hızlı Ateş',   icon: 'rapid',    cost: { iron: 16, crystal: 4 },  desc: 'Atış hızı %30 artar.' },
  overdrive:{ name: 'Aşırı Yük',    icon: 'overdrive', cost: { crystal: 8, gold: 10 }, active: true, dur: 4, cd: 18, desc: 'AKTİF: 4 sn boyunca üç kat atış hızı.' },
  nova:     { name: 'Nova',         icon: 'nova',     cost: { crystal: 12, gold: 12 }, active: true, cd: 14, desc: 'AKTİF: çevrene 14 mermilik halka.' },
};
export const MOD_KEYS = Object.keys(MODS);
export const BURN = { dps: 4, t: 3 };

// schematic: true => Kalıntı sandığından çıkan şema ile açılır (kalıcı)
// Taşınabilir aletler: durduğun yere kurulur (tünel içi dahil), dokunup geri alınır. Aynı anda en fazla DEPLOY_MAX tane.
export const BUILDS = {
  turret: { name: 'Nöbetçi', icon: 'turret', cost: { iron: 10 }, hp: 80, range: 112, dmg: 12, cd: 0.6, desc: 'Yakındaki düşmanlara ateş eder.' },
  lamp:   { name: 'Fener Direği', icon: 'lamp', cost: { iron: 4, water: 2 }, hp: 50, range: 64, desc: 'Işık verir; çevresinde gürültü yarıya iner.' },
  heal:   { name: 'Onarım', icon: 'heal', cost: { water: 8, iron: 4 }, hp: 60, range: 56, rate: 5, desc: 'Seni ve aletleri onarır.' },
  flame:  { name: 'Alev Kulesi', icon: 'flame', cost: { iron: 8, cobalt: 3 }, hp: 110, range: 46, dps: 30, schematic: true, desc: 'Kısa menzil, sürekli alan hasarı.' },
  frost:  { name: 'Buz Kulesi', icon: 'frost', cost: { water: 6, crystal: 2 }, hp: 80, range: 100, dmg: 6, cd: 0.7, slowT: 2.2, schematic: true, desc: 'Vurduğu düşmanı yarı hıza düşürür.' },
  mortar: { name: 'Havan', icon: 'mortar', cost: { iron: 12, cobalt: 4 }, hp: 90, range: 160, minRange: 30, dmg: 30, splash: 26, cd: 2.6, schematic: true, desc: 'Uzak menzil, alan hasarı.' },
};
export const BUILD_KEYS = ['turret', 'lamp', 'heal', 'flame', 'frost', 'mortar'];
export const DEPLOY_MAX = 2;
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
// aletler de kemer eşyasıdır: üret, durduğun yere kur
for (const k of BUILD_KEYS) ITEMS[k] = { name: BUILDS[k].name, icon: BUILDS[k].icon, cost: BUILDS[k].cost, max: 2, build: true, schematic: !!BUILDS[k].schematic, desc: BUILDS[k].desc + ' Kemerden kur, dokunup geri al.' };
export const ITEM_KEYS = ['torch', 'dynamite', 'medkit', 'barricade', 'mine', 'recall', ...BUILD_KEYS];
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
export const HAZARD = { fallDelay: 0.9, fallDmg: 22, fallEnemyDmg: 45, gasTime: 7, gasRadius: 22, gasDps: 7, gasBoom: 40, emberBurn: 8 };
// Uyanış (gürültü) ölçeri
export const THREAT = {
  decay: 0.7, decayPerLevel: 0.45, surfaceDecay: 9, quietAfter: 1.2, depthMul: 0.1,
  noise: { dig: 0.25, brk: 0.42, ore: 0.35, shot: 0.12, boom: 8, mine: 4, chest: 3 },
  bossDelay: 4,                     // ölçer tepedeyken bossun uyanmasına kalan süre (sn)
  range: [7, 13, 20, 30, 45],       // yuvanın uyanma menzili (tile), seviyeye göre (sessizken de yakın yuva tepki verir)
  cd: [7, 3, 2, 1.4, 1],           // yuva çıkarma aralığı (sn)
  cap: [5, 12, 18, 26, 34],          // sahadaki canlı düşman üst sınırı
  seepCd: [9, 6, 4, 3, 2.2],        // yakın yuva yoksa kayadan sızma aralığı (sessizde de tek tük)
  eliteChance: 0.3, nestRelief: 18, afterBoss: 55,
  floorPerStratum: 4, floorMax: 40, // derinde maden tam susmaz: gürültü bu tabanın altına sönmez
  seepDepth: 0.08,                   // her biyom sızmayı biraz sıklaştırır
};

// Düşmanlar: r = çarpışma yarıçapı, dig = kazabildiği maks kaya hp'si
export const ENEMIES = {
  rodent:  { name: 'Kemirgen', hp: 18, speed: 48, dmg: 6, r: 4, dig: 1, digRate: 1.3, cost: 1 },
  bug:     { name: 'Kabukbiti', hp: 50, speed: 26, dmg: 10, r: 6, armor: 0.35, cost: 2.5 },
  spitter: { name: 'Tükürgen', hp: 28, speed: 30, dmg: 9, r: 5, ranged: true, range: 72, fireCd: 1.7, cost: 2 },
  flyer:   { name: 'Yarasa', hp: 22, speed: 62, dmg: 7, r: 4, fly: true, cost: 1.5 },
  boomer:  { name: 'Kristalböcek', hp: 24, speed: 40, dmg: 26, r: 5, boom: 26, cost: 2 },
  brute:   { name: 'Kaya Devi', hp: 140, speed: 20, dmg: 22, r: 8, armor: 0.4, dig: 99, digRate: 5, knockResist: 0.85, cost: 5 },
  worm:    { name: 'Maden Solucanı', hp: 60, speed: 24, dmg: 10, r: 6, armor: 0.2, burrow: true, dig: 99, digRate: 7, knockResist: 0.7, cost: 3 },
  // bosslar (bosses.js): ölçer tepede kalınca derinliğe göre biri uyanır; %50 canda öfkelenir
  karakok:  { name: 'Karakök', title: 'Toprağın Düğümü', col: '#78b43c', hp: 480, speed: 22, dmg: 24, r: 11, armor: 0.3, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0,
    loot: [['cobalt', 4], ['iron', 4], ['crystal', 2]], lore: 'Madenin ilk kökü. Toprağa dalar, altından çıkar; yerde kök çatlarsa kaç.' },
  kavurgan: { name: 'Kavurgan', title: 'Kül ve Kemik Ejderi', col: '#ff6a1a', hp: 540, speed: 23, dmg: 26, r: 11, armor: 0.35, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0,
    loot: [['cobalt', 5], ['crystal', 3], ['gold', 2]], lore: 'Kor katmanında yanan kemik. Nefesi koni, küllü yer patlar; arkasında dur.' },
  otegoz:   { name: 'Ötegöz', title: 'Boşluğa Bakan', col: '#b080ff', hp: 560, speed: 30, dmg: 22, r: 10, armor: 0.2, fly: true, dig: 99, digRate: 7, knockResist: 1, blink: true, blinkCd: 6, boss: true, cost: 0,
    loot: [['crystal', 5], ['gold', 3]], lore: 'Karanlığın ötesinden bakar. Küreleri seni kovalar, bakışı çeker; ışınını kayayla kes.' },
  sultan:   { name: 'Taçsız Sultan', title: 'Altın Sarayın Laneti', col: '#ffd870', hp: 640, speed: 22, dmg: 30, r: 11, armor: 0.45, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0,
    loot: [['gold', 8], ['crystal', 3]], lore: 'Tacını kaybeden hükümdar. Kayayı yararak hücum eder; hücumdan sonra sersemler.' },
  ezeli:    { name: 'Ezelî', title: 'Çekirdeğin Rüyası', col: '#fff4c0', hp: 720, speed: 26, dmg: 26, r: 11, armor: 0.3, fly: true, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0,
    loot: [['gold', 6], ['crystal', 6]], lore: 'Yaratılıştan önce vardı. Işık sütunları iner; halkası geldiğinde kayanın ardına saklan.' },
  // derin katman yaratıkları: her biri farklı bir "sürpriz"
  glarer:  { name: 'Parıldak', hp: 34, speed: 34, dmg: 5, r: 5, fly: true, blind: true, blindRange: 48, blindCd: 4.5, cost: 2.5 },
  lurker:  { name: 'Çekici', hp: 70, speed: 18, dmg: 14, r: 7, armor: 0.25, pull: true, pullRange: 80, cost: 3 },
  howler:  { name: 'Uluyan', hp: 46, speed: 30, dmg: 8, r: 6, howl: true, howlRange: 90, howlCd: 6, cost: 2.5 },
  shade:   { name: 'Gölge', hp: 26, speed: 44, dmg: 12, r: 4, phase: true, cost: 2 },
  // v4 biyom yaratıkları
  spider:      { name: 'Örümcek', hp: 32, speed: 42, dmg: 8, r: 5, ranged: true, web: true, range: 64, fireCd: 2.6, spawnOnDeath: ['spiderling', 2, 0.4], cost: 2.2 },
  spiderling:  { name: 'Örümcekçik', hp: 8, speed: 66, dmg: 3, r: 3, small: true, cost: 0.5 },
  broodmother: { name: 'Örümcek Ana', hp: 240, speed: 16, dmg: 18, r: 9, armor: 0.3, ranged: true, web: true, range: 80, fireCd: 3, brood: 4.5, knockResist: 0.8, cost: 7 },
  frostbat:    { name: 'Kırağı', hp: 26, speed: 58, dmg: 6, r: 4, fly: true, chill: true, cost: 2 },
  skitter:     { name: 'Kemikçi', hp: 44, speed: 54, dmg: 9, r: 5, armor: 0.3, cost: 2.5 },
  magmite:     { name: 'Kor Böceği', hp: 40, speed: 36, dmg: 12, r: 5, boom: 22, burnTrail: true, cost: 2.5 },
  voidling:    { name: 'Boşluk Gözü', hp: 52, speed: 30, dmg: 15, r: 5, fly: true, blink: true, blinkCd: 3.6, cost: 3.5 },
  ogolem:      { name: 'Obsidyen Devi', hp: 280, speed: 18, dmg: 30, r: 9, armor: 0.55, dig: 99, digRate: 6, knockResist: 0.9, cost: 8 },
  // v5 derin biyom imza düşmanları (yalnız kendi biyomunun yuvalarından çıkar; loot: ölünce düşen cevher)
  // derin biyom imzaları: her birinin kendine özgü davranışı var (enemies.js)
  quickling:  { name: 'Cıva Damlası', hp: 70, speed: 50, dmg: 22, r: 5, boom: 24, split: 'droplet', cost: 3 },                       // yarı canda ikiye bölünür
  droplet:    { name: 'Cıva Damlacığı', hp: 16, speed: 64, dmg: 9, r: 3, boom: 12, small: true, cost: 0.6 },
  voltbat:    { name: 'Yıldırım Yarasası', hp: 60, speed: 70, dmg: 12, r: 4, fly: true, zap: true, zapRange: 64, zapCd: 2.8, cost: 3 }, // yıldırım çarpar, kazmanı kilitler
  gilded:     { name: 'Altın Muhafız', hp: 340, speed: 20, dmg: 32, r: 9, armor: 0.6, dig: 99, digRate: 5, knockResist: 0.9, stomp: true, thief: 3, loot: [['gold', 4]], cost: 9 }, // vurduğunda altın çalar
  sporeling:  { name: 'Spor Böceği', hp: 95, speed: 30, dmg: 14, r: 6, armor: 0.3, ranged: true, web: true, range: 70, fireCd: 2.2, puff: 4.5, cost: 4 }, // spor bulutu: dostları iyileştirir, seni yavaşlatır
  mirrorling: { name: 'Cam Gölgesi', hp: 70, speed: 50, dmg: 18, r: 4, phase: true, mirror: 6, cost: 3.5 },                          // vurulunca cam kopyalar çıkarır
  titanling:  { name: 'Dev Parçası', hp: 280, speed: 19, dmg: 34, r: 9, armor: 0.5, dig: 99, digRate: 5, knockResist: 0.9, stomp: true, quake: 5, quakeRange: 80, loot: [['crystal', 2], ['iron', 2]], cost: 9 }, // yere vurur: sarsıntı + tavan çöker
  chronoling: { name: 'Zaman Gözü', hp: 85, speed: 32, dmg: 20, r: 5, fly: true, blink: true, blinkCd: 2.6, rewind: 6, rewindRange: 110, cost: 4.5 }, // seni 3 sn önceki yerine geri sarar
  leech:      { name: 'Kan Sülüğü', hp: 140, speed: 26, dmg: 16, r: 6, armor: 0.25, burrow: true, dig: 99, digRate: 7, knockResist: 0.75, drain: true, loot: [['iron', 3]], cost: 5 }, // ısırınca kan emer: iyileşir ve büyür, sen kanarsın
  echoer:     { name: 'Yankıcı', hp: 95, speed: 32, dmg: 14, r: 6, howl: true, howlRange: 110, howlCd: 5.5, echoNoise: 10, cost: 4 }, // ulumasi ölçeri yükseltir, sürüyü hızlandırır
  seraph:     { name: 'Işık Bekçisi', hp: 120, speed: 42, dmg: 16, r: 5, fly: true, blind: true, blindRange: 52, blindCd: 4, judge: 5, judgeRange: 120, loot: [['crystal', 1]], cost: 5 }, // yargı ışını: nişan alır, kaçmazsan çarpar
};

// derinlik bandı (her 4 biyom) -> boss
export const BOSS_BANDS = ['karakok', 'kavurgan', 'otegoz', 'sultan', 'ezeli'];

// Elit: Öfke seviyesinde yuvalardan şansla çıkar (can ×2.2, boyut ×1.25, altın düşürür)
export const ELITE = { hp: 2.2, dmg: 1.4, scale: 1.25, gold: 3, fromWave: 3 };

export const WAVES = {
  firstCalm: 48, calm: 27, warn: 10, heartCalm: 12,
  budget: (wave, stratum, mult = 1) => (3.0 + wave * 2.6 + stratum * 3.4 + Math.max(0, wave - 5) * 1.0) * mult,
  hpScale: wave => 1 + 0.08 * (wave - 1),
  bossEvery: 5,
  spawnGap: 0.42,
  nests: 3,
  allowed(wave, stratum) {
    const a = ['rodent'];
    if (wave >= 2 || stratum >= 1) a.push('bug');
    if (stratum >= 1 || wave >= 3) a.push('spitter');
    if (stratum >= 2 || wave >= 6) a.push('flyer');
    if (stratum >= 2 || wave >= 5) a.push('boomer');
    if (stratum >= 1 && wave >= 4) a.push('brute');
    if (stratum >= 1 && wave >= 3) a.push('worm');
    if (stratum >= 2) a.push('spider');
    if (stratum >= 2 && wave >= 3) a.push('spiderling');
    if (stratum >= 3 && wave >= 3) a.push('glarer');
    if (stratum >= 3 && wave >= 4) a.push('lurker');
    if (stratum >= 4) a.push('frostbat');
    if (stratum >= 4 && wave >= 5) a.push('broodmother');
    if (stratum >= 5) a.push('skitter');
    if (stratum >= 5 || wave >= 9) a.push('howler');
    if (stratum >= 6) a.push('magmite');
    if (stratum >= 6 && wave >= 5) a.push('shade');
    if (stratum >= 8) a.push('voidling');
    if (stratum >= 8 && wave >= 6) a.push('ogolem');
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
  taretAsiri:   { name: 'Aşırı Yükleme', icon: 'turret', desc: 'Aletler %50 daha hızlı çalışır.' },
  ucuncuAlet:   { name: 'Üçüncü Alet', icon: 'base', desc: 'Aynı anda kurulu alet sınırı +1.' },
  ikinciNefes:  { name: 'İkinci Nefes', icon: 'heart', desc: 'Bayıldığında bir kez kendin kalkarsın (sefer başına).' },
  yasamOzu:     { name: 'Yaşam Özü', icon: 'heart', desc: 'Her öldürme 3 can yeniler.' },
  sokDalgasi:   { name: 'Şok Dalgası', icon: 'shock', desc: 'Hasar aldığında çevrendeki düşmanlar savrulur ve 20 hasar alır.' },
  parlakFener:  { name: 'Parlak Fener', icon: 'lamp', desc: 'Görüş +2 blok. Karanlıktaki cevherler parıldar.' },
  altinDamar:   { name: 'Altın Damarı', icon: 'gold', desc: 'Elit düşmanlar iki kat altın düşürür.' },
  dorduncuYuva: { name: 'Dördüncü Yuva', icon: 'nova', desc: 'Blaster eklenti yuvası +1.' },
  depremVurus:  { name: 'Deprem Vuruşu', icon: 'dynamite', desc: 'Kırdığın her 8. blok çevresindeki kayaları da yıkar.' },
  sessizDamar:  { name: 'Sessiz Damar', icon: 'wave', desc: 'Cevher kazmak hiç gürültü yapmaz.' },
  lesKazisi:    { name: 'Leş Kazısı', icon: 'skull', desc: 'Öldürdüğün düşman %25 ihtimalle derinliğine göre cevher düşürür.' },
  sonDirenis:   { name: 'Son Direniş', icon: 'elite', desc: 'Canın %35’in altındayken kazman ve blasterın iki kat vurur.' },
  kacis:        { name: 'Kaçış Refleksi', icon: 'boot', desc: 'Hasar aldığında 2 sn boyunca çok hızlı koşarsın.' },
  hazineKokusu: { name: 'Hazine Kokusu', icon: 'chest', desc: 'Kalıntı sandıkları karanlıkta görünür; gömülü cevherler pırıldar.' },
  simya:        { name: 'Simya', icon: 'gold', desc: 'Demir, su ve kobalt damarları %15 ihtimalle altın verir.' },
  sifaPinari:   { name: 'Şifa Pınarı', icon: 'water', desc: 'Su damarı kırmak 6 can yeniler.' },
  gazMaskesi:   { name: 'Gaz Maskesi', icon: 'heal', desc: 'Gaz bulutları ve zehirli taş sana işlemez.' },
  yuvaAvcisi:   { name: 'Yuva Avcısı', icon: 'sharp', desc: 'Yuvaları üç kat hızlı kazarsın; yıktığında gürültü 25 düşer.' },
  dikenZirh:    { name: 'Diken Zırh', icon: 'armor', desc: 'Sana vuran yakındaki düşman 15 hasar alır.' },
  ozHasadi:     { name: 'Öz Hasadı', icon: 'oz', desc: 'Sefer sonunda %25 fazla Öz kazanırsın.' },
  sogukkanli:   { name: 'Soğukkanlı', icon: 'frost', desc: 'Korku, körlük ve ağ seni etkilemez.' },
};

// Efsanevi eserler: efsanevi biyomların kalbinde tek bir eser taşı; kırınca kalıcı olarak senindir (kamp rafında durur, her seferde çalışır)
export const RELICS = {
  tac:      { name: 'Altın Taç', icon: 'crown', biome: 12, desc: 'Kazdığın sıradan kaya %10 ihtimalle altın düşürür; sefere +12 altınla başlarsın. Başında taç parlar.', lore: 'Altın Saray’ın tahtında.' },
  kalp:     { name: 'Devin Kalbi', icon: 'heart', biome: 15, desc: 'Azami can +40. Bayılacağın an nabız dalgası yayılır: düşmanlar savrulur, yarı canla ayakta kalırsın (her seferde bir kez).', lore: 'Uyuyan Dev’in göğsünde.' },
  arken:    { name: 'Arkentaş', icon: 'arken', biome: 18, desc: 'Dağın kalbi. Görüşün +3 blok, cevherler karanlıkta parıldar; ışığına giren düşman yarı hıza düşer. Göğsünde yanar.', lore: 'Yankı Boşluğu’nun karanlığında, kayaya gömülü; ışığı uzaktan sızar.' },
  kivilcim: { name: 'Yaratılış Kıvılcımı', icon: 'spark', biome: 19, desc: 'Kazman iki kat vurur ve ışık saçar; kırdığın her blok yakındaki düşmanı 12 yakar.', lore: 'Yaratılış Çekirdeği’nde, Kalp’in yanında.' },
};
export const RELIC_KEYS = Object.keys(RELICS);
export const RELIC_OF_BIOME = Object.fromEntries(RELIC_KEYS.map(k => [RELICS[k].biome, k]));

// Sefer içi asansör: merkez şaft, ulaşılan her biyomda istasyon
export const ELEVATOR = { speed: 230, snap: 7, noise: 3 };

// Roller: madenci kartında seçilir, ekipte birbirini tamamlar
export const ROLES = {
  kazici:   { name: 'Kazıcı', icon: 'drill', desc: 'Kazma %20 daha hızlı, kazı gürültüsü %25 daha az.', dig: 0.8, digNoise: 0.75 },
  nisanci:  { name: 'Nişancı', icon: 'blaster', desc: 'Blaster hasarı +%25, menzil +12.', dmg: 1.25, range: 12 },
  muhendis: { name: 'Mühendis', icon: 'turret', desc: 'Kurulu alet sınırı +1, aletler %40 daha dayanıklı.', deploy: 1, buildHp: 1.4 },
  sihhiyeci:{ name: 'Sıhhiyeci', icon: 'medkit', desc: 'Yeraltında yavaşça iyileşirsin; partnerini iki kat hızlı ve tam canla kaldırırsın.', regen: 0.6 },
  yikici:   { name: 'Yıkıcı', icon: 'dynamite', desc: 'Sefere 3 dinamitle başlarsın; dinamitin daha geniş patlar ve sana zarar vermez.', blast: 1.4 },
  kuyumcu:  { name: 'Kuyumcu', icon: 'gem', desc: 'Kobalt, kristal ve altın damarları +1 düşürür; blaster hasarı %20 az.', rare: 1, dmg: 0.8 },
};
export const ROLE_KEYS = Object.keys(ROLES);

// Dinamik maden olayları: yeraltındayken ve ölçer sessiz değilken, uyarıdan birkaç saniye sonra vurur. w: seçilme ağırlığı, good: ödül
export const EVENTS = {
  first: 40, cd: [55, 95], minLevel: 1, warn: 2.5,
  sarsinti:  { name: 'SARSINTI', sub: 'TAVANDAN UZAKLAŞ', rocks: 5, noise: 6, w: 3 },
  gaz:       { name: 'GAZ SIZINTISI', sub: 'ATEŞ ETME, UZAKLAŞ', clouds: 3, w: 3 },
  karanlik:  { name: 'KARARTMA', sub: 'FENERİN KISILIYOR', t: 18, w: 2 },
  suru:      { name: 'SÜRÜ', sub: 'KAYADAN TAŞIYORLAR', w: 3 },
  damar:     { name: 'PARLAYAN DAMAR', sub: 'YAKINDA CEVHER BELİRDİ', tiles: 5, w: 2, good: true },
  kese:      { name: 'KAYIP KESE', sub: 'ESKİ BİR MADENCİNİN ÇANTASI', w: 2, good: true },
  sandik:    { name: 'UNUTULMUŞ SANDIK', sub: 'İŞARETİ TAKİP ET', w: 1, good: true },
  sessizlik: { name: 'DERİN SESSİZLİK', sub: 'GÜRÜLTÜ YARIYA İNDİ', t: 20, drop: 40, w: 2, good: true },
};
export const EVENT_KEYS = ['sarsinti', 'gaz', 'karanlik', 'suru', 'damar', 'kese', 'sandik', 'sessizlik'];

// Kalıcı Kamp yükseltmeleri (Öz ile)
export const META = {
  erzak:     { name: 'Erzak', icon: 'iron', max: 3, costs: [20, 45, 80], desc: 'Sefere +8 demirle başla (seviye başına).' },
  genisCanta:{ name: 'Geniş Çanta', icon: 'bag', max: 3, costs: [25, 50, 90], desc: 'Çanta kapasitesi +4 (seviye başına).' },
  keskinUc:  { name: 'Keskin Uç', icon: 'drill', max: 2, costs: [40, 100], desc: 'Kazma bir kademe yukarıda başlar.' },
  tahkimat:  { name: 'Tahkimat', icon: 'base', max: 3, costs: [30, 60, 110], desc: 'Aletlerin dayanıklılığı +%30 (seviye başına).' },
  ayarliBl:  { name: 'Ayarlı Blaster', icon: 'blaster', max: 2, costs: [40, 100], desc: 'Blaster bir seviye yukarıda başlar.' },
  hazirTaret:{ name: 'Hazır Nöbetçi', icon: 'turret', max: 1, costs: [70], desc: 'Sefere kemerinde bir Nöbetçi ile başla.' },
  sigorta:   { name: 'Sağlık Sigortası', icon: 'medkit', max: 1, costs: [90], desc: 'Her seferde bir kez bayıldığında kendin kalkarsın.' },
  kanarya:   { name: 'Maden Kanaryası', icon: 'wave', max: 1, costs: [50], desc: 'Kanarya seninle iner: yakındaki gizli yuvayı sezer, gürültü eşiğe yaklaşınca öter.' },
  kalintiBil:{ name: 'Kalıntı Bilgisi', icon: 'chest', max: 1, costs: [120], desc: 'Kalıntı sandıkları 4 seçenek sunar.' },
  altinKese: { name: 'Altın Kese', icon: 'gold', max: 2, costs: [60, 140], desc: 'Sefere +4 altınla başla (seviye başına).' },
};
export const META_KEYS = Object.keys(META);

// Zafer sonrası açılan zorluk kademeleri (birikimli)
export const KADEME = [
  { name: 'Normal', desc: 'Standart sefer' },
  { name: 'Kademe 1', desc: 'Düşmanlar %20 daha dayanıklı' },
  { name: 'Kademe 2', desc: '+ Gürültü %25 daha hızlı birikir' },
  { name: 'Kademe 3', desc: '+ İki kat göçük ve gaz cebi' },
  { name: 'Kademe 4', desc: '+ Kampta iyileşme yarı hızda' },
  { name: 'Kademe 5', desc: '+ Yuvalar iki kat hızlı üretir' },
];
export function kademeMods(k = 0) {
  return { dmg: 1, hp: k >= 1 ? 1.2 : 1, noise: k >= 2 ? 1.25 : 1, hazard: k >= 3 ? 2 : 1, slowRegen: k >= 4, nestRate: k >= 5 ? 2 : 1, oz: 1 + 0.25 * k };
}

// Sefer kontratları: her seferde 2 tane, tamamlanınca bonus Öz
// vals: oyuncunun ulaştığı en derin biyom grubuna (0..3) göre hedef; minStratum: sunulması için gereken biyom
export const CONTRACTS = {
  depth:   { icon: 'depth', text: n => `${n}m derinliğe in`, vals: [40, 90, 160, 250], stat: g => g.stats.maxDepth, oz: 12 },
  kills:   { icon: 'skull', text: n => `${n} düşman yok et`, vals: [30, 60, 100, 150], stat: g => g.stats.kills, oz: 10 },
  nests:   { icon: 'wave', text: n => `${n} yuva yık`, vals: [2, 4, 6, 9], stat: g => g.stats.nests, oz: 14 },
  chests:  { icon: 'chest', text: n => `${n} kalıntı sandığı aç`, vals: [1, 2, 3, 5], stat: g => g.stats.chests, oz: 14 },
  cobalt:  { icon: 'cobalt', text: n => `${n} kobalt depola`, vals: [6, 10, 16, 24], stat: g => g.collected.cobalt, oz: 12, minStratum: 2 },
  crystal: { icon: 'crystal', text: n => `${n} kristal depola`, vals: [4, 4, 8, 12], stat: g => g.collected.crystal, oz: 16, minStratum: 5 },
  gold:    { icon: 'gold', text: n => `${n} altın depola`, vals: [4, 8, 14, 20], stat: g => g.collected.gold, oz: 14, minStratum: 1 },
  elites:  { icon: 'elite', text: n => `${n} elit düşman yok et`, vals: [1, 2, 4, 6], stat: g => g.stats.elites, oz: 14, minStratum: 1 },
  blast:   { icon: 'dynamite', text: n => `Dinamitle ${n} blok kır`, vals: [8, 14, 20, 26], stat: g => g.stats.blasted, oz: 10 },
  torches: { icon: 'torch', text: n => `${n} meşale as`, vals: [3, 5, 7, 9], stat: g => g.stats.torches, oz: 8 },
};

export function ozForRun(s) {
  return Math.round(
    s.maxDepth * 0.5 + s.nests * 6 + s.beacons * 20 + s.chests * 6 + (s.victory ? 250 : 0) +
    RES_KEYS.reduce((a, k) => a + (s.collected[k] || 0) * RES[k].value, 0)
  );
}
