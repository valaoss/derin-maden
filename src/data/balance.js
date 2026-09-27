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

export const BUILDS = {
  turret: { name: 'Taret', icon: 'turret', cost: { iron: 10 }, hp: 80, range: 112, dmg: 12, cd: 0.6, desc: 'Yakındaki düşmanlara ateş eder' },
  heal:   { name: 'Onarım', icon: 'heal', cost: { water: 8, iron: 4 }, hp: 60, range: 56, rate: 5, desc: 'Üssü, taretleri ve seni onarır' },
};
export const BARRICADE = { cost: { iron: 3 }, hp: 70 };
export const REPAIR = { cost: { iron: 5 }, amount: 70 };

// Düşmanlar: r = çarpışma yarıçapı, dig = kazabildiği maks kaya hp'si
export const ENEMIES = {
  rodent:  { name: 'Kemirgen', hp: 18, speed: 48, dmg: 6, r: 4, dig: 1, digRate: 1.3, cost: 1 },
  bug:     { name: 'Kabukbiti', hp: 50, speed: 26, dmg: 10, r: 6, armor: 0.35, cost: 2.5 },
  spitter: { name: 'Tükürgen', hp: 28, speed: 30, dmg: 9, r: 5, ranged: true, range: 72, fireCd: 1.7, cost: 2 },
  flyer:   { name: 'Yarasa', hp: 22, speed: 62, dmg: 7, r: 4, fly: true, cost: 1.5 },
  boomer:  { name: 'Kristalböcek', hp: 24, speed: 40, dmg: 26, r: 5, boom: 26, cost: 2 },
  brute:   { name: 'Kaya Devi', hp: 140, speed: 20, dmg: 22, r: 8, armor: 0.4, dig: 99, digRate: 5, knockResist: 0.85, cost: 5 },
  boss:    { name: 'Derin Ana', hp: 540, speed: 21, dmg: 28, r: 11, armor: 0.3, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0 },
};

export const WAVES = {
  firstCalm: 55, calm: 38, warn: 13, heartCalm: 16,
  budget: (wave, stratum) => 0.6 + wave * 1.75 + stratum * 2.8 + Math.max(0, wave - 6) * 0.6,
  hpScale: wave => 1 + 0.09 * (wave - 1),
  bossEvery: 6,
  allowed(wave, stratum) {
    const a = ['rodent'];
    if (wave >= 3 || stratum >= 1) a.push('bug');
    if (stratum >= 1 || wave >= 5) a.push('spitter');
    if (stratum >= 2 || wave >= 8) a.push('flyer');
    if (stratum >= 2 || wave >= 7) a.push('boomer');
    if (stratum >= 1 && wave >= 5) a.push('brute');
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

export function ozForRun(s) {
  return Math.round(
    s.maxDepth * 0.6 + s.wavesCleared * 4 + s.chests * 6 + (s.victory ? 150 : 0) +
    s.collected.iron * RES.iron.value + s.collected.water * RES.water.value +
    s.collected.cobalt * RES.cobalt.value + s.collected.crystal * RES.crystal.value
  );
}
