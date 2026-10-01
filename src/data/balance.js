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
  elmas:    { label: 'Kara Elmas', value: 6, master: 'elmasDeri' },
  kehribar: { label: 'Ezel Kehribarı', value: 7, master: 'kehribarKalp' },
};
export const BASE_RES = ['iron', 'water', 'cobalt', 'crystal', 'gold'];
export const DEEP_ORES = ['yesim', 'opal', 'inci', 'akik', 'yildiz', 'elmas', 'kehribar'];
export const RES_KEYS = BASE_RES.concat(DEEP_ORES);

export const PLAYER = {
  speed: 62, hp: 100, hitW: 8, hitH: 11, iframes: 0.55,
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
  { name: 'Kara Elmas Kazma', dmg: 68, interval: 0.12, head: '#1a1a24', headL: '#b0b8d0', handle: '#2a2030', spark: '#e0e8ff', glow: 'rgba(200,210,255,0.7)' },
  { name: 'Ezel Kazması',     dmg: 100, interval: 0.11, head: '#c0701a', headL: '#ffd890', handle: '#4a2a10', spark: '#ffc060', glow: 'rgba(255,170,60,0.85)' },
];
// katlanan fiyatlar: her kademe bir öncekinin ~1.6 katı; derin kademeler bandın derin cevherini ister
const PICK_COSTS = [{ iron: 8 }, { iron: 20, water: 6 }, { iron: 30, gold: 10 }, { cobalt: 30, gold: 14, yesim: 3 }, { crystal: 30, cobalt: 40, opal: 3 }, { crystal: 60, gold: 50, opal: 5 },
  { crystal: 100, cobalt: 90, inci: 5 }, { crystal: 160, gold: 130, akik: 6 }, { crystal: 240, gold: 200, yildiz: 6 }, { crystal: 340, gold: 280, elmas: 7 }, { crystal: 480, gold: 400, kehribar: 8 }];

// Kazma türleri: kademeden bağımsız kafa (Atölye > KAZMA). Ekip bir kez alır, her madenci kendi türünü takar.
// dmg/int: kademe gücü ve vuruş aralığı çarpanı; derin cevherli olanlar ilgili bandın cevheriyle açılır
export const PICK_TYPES = {
  std:    { name: 'Madenci Kazması', icon: 'drill', dmg: 1, int: 1, desc: 'Dengeli; her işe yarar.' },
  matkap: { name: 'Matkap', icon: 'bit', dmg: 0.62, int: 0.5, noise: 1.3, cost: { iron: 40, water: 20 }, desc: 'Çok hızlı vurur (%24 daha hızlı kazı) ama daha gürültülü.' },
  genis:  { name: 'Geniş Kazma', icon: 'sharp', dmg: 0.85, int: 1, wide: true, cost: { iron: 40, cobalt: 24 }, desc: 'Her vuruş yandaki iki bloğa da işler: üç blok geniş tünel.' },
  kadife: { name: 'Kadife Uç', icon: 'hush', dmg: 0.9, int: 1, noise: 0.35, cost: { water: 40, crystal: 12 }, desc: 'Kazı gürültüsü üçte bire iner.' },
  balyoz: { name: 'Balyoz', icon: 'sledge', dmg: 2.2, int: 1.7, bash: 30, cost: { yesim: 5, iron: 60 }, desc: 'Ağır ve yavaş (%30 daha güçlü kazı); önündeki düşmanı 30 hasarla savurur.' },
  burgu:  { name: 'Burgu', icon: 'auger', dmg: 1, int: 1, deep: 0.7, cost: { opal: 5, cobalt: 60 }, desc: 'Her vuruş arkadaki bloğa da %70 işler: tünel iki kat hızlı ilerler.' },
  hazine: { name: 'Hazine Kazması', icon: 'gem', dmg: 0.9, int: 1, ore: 1, sense: 4, cost: { inci: 5, gold: 80 }, desc: 'Her cevher +1 düşer; gömülü cevher ve yuvayı 4 blok öteden sezer.' },
  akik:   { name: 'Kan Akiği', icon: 'heart', dmg: 1.15, int: 0.9, leech: 1, cost: { akik: 5, crystal: 120 }, desc: '%28 daha güçlü kazı; kırdığın her blok 1 can yeniler.' },
};
export const PICK_TYPE_KEYS = Object.keys(PICK_TYPES);

// Silahlar: hepsi otomatik nişan alır; güç 'Silah Gücü' seviyesinden gelir, tür çarpanları uygular (Atölye > SİLAH)
// evo: silah seviyesi WXP.evoAt olunca elindeki silah için sunulan iki evrim; seçilen, silahın değerlerinin üstüne yazılır
export const WEAPONS = {
  blaster:  { name: 'Blaster', icon: 'blaster', dmg: 1, cd: 1, range: 1, speed: 250, desc: 'Dengeli otomatik tabanca.', evo: [
    { name: 'Üçlü Blaster', desc: 'Her atışta 3 mermi (her biri %60 hasar).', pellets: 3, spread: 0.3, dmg: 0.6 },
    { name: 'Delici Blaster', desc: 'Mermi 2 düşmanı deler ve %30 sert vurur.', pierce: 2, dmg: 1.3, speed: 330 }] },
  sacma:    { name: 'Saçmalı', icon: 'shotgun', dmg: 0.42, cd: 1.7, range: 0.72, speed: 230, pellets: 5, spread: 0.55, knock: 1.8, life: 0.4, cost: { iron: 40, water: 20 }, desc: 'Yakın menzil: 5 saçma, düşmanı geri savurur.', evo: [
    { name: 'Ejder Nefesi', desc: '7 saçma; her biri düşmanı tutuşturur.', pellets: 7, burn: true },
    { name: 'Tek Kurşun', desc: 'Tek ağır mermi: 2.8 kat hasar, uzun menzil, 1 düşmanı deler.', pellets: 0, dmg: 2.8, range: 1.1, life: 0.7, knock: 3, pierce: 1 }] },
  makineli: { name: 'Makineli', icon: 'rapid', dmg: 0.42, cd: 0.36, range: 0.95, speed: 270, jitter: 0.14, cost: { iron: 40, cobalt: 24 }, desc: 'Mermi yağmuru (%17 daha çok hasar/sn), biraz dağınık.', evo: [
    { name: 'Fırtına', desc: 'Atış hızı %40 artar.', cd: 0.257 },
    { name: 'Zırh Delen', desc: 'Mermiler %30 sert vurur, 1 düşmanı deler ve dağılmaz.', dmg: 0.55, pierce: 1, jitter: 0.04 }] },
  alev:     { name: 'Alev Püskürtücü', icon: 'flame', flame: true, dmg: 0.2, cd: 0.1, range: 0.6, cost: { cobalt: 40, gold: 20 }, desc: 'Kısa menzil koni: içindeki herkesi yakar. Gazı tutuşturur!', evo: [
    { name: 'Mavi Alev', desc: 'Hasar %50, menzil %25 artar.', dmg: 0.3, range: 0.75 },
    { name: 'Yangın Hortumu', desc: 'Koni iki kat geniş; yanık silah hasarıyla birlikte büyür.', cone: 1, burnMul: 2 }] },
  tufek:    { name: 'Delici Tüfek', icon: 'rifle', dmg: 2.8, cd: 2.2, range: 1.55, speed: 480, pierce: 4, cost: { yesim: 5, crystal: 30 }, desc: 'Uzak menzil; mermi sıradaki 4 düşmanı deler.', evo: [
    { name: 'Keskin Nişancı', desc: 'Hasar %35, menzil %15 artar; kritik şansı iki katına çıkar.', dmg: 3.8, range: 1.8, crit: 2 },
    { name: 'Patlayan Mermi', desc: 'Deldiği her düşmanda küçük bir patlama.', blast: 16, quiet: true }] },
  simsek:   { name: 'Şimşek Tabancası', icon: 'chain', zap: 3, dmg: 0.95, cd: 1.1, range: 0.9, cost: { opal: 5, cobalt: 60 }, desc: 'Anında çarpar ve 3 düşmana daha sekerek geçer.', evo: [
    { name: 'Fırtına Zinciri', desc: '7 düşmana sekerek geçer.', zap: 7 },
    { name: 'Aşırı Voltaj', desc: 'Hasar %50 artar; çarptığı düşman 0.6 sn saldıramaz.', dmg: 1.43, stun: 0.6 }] },
  roket:    { name: 'Roketatar', icon: 'rocket', dmg: 2.6, cd: 2.6, range: 1.3, speed: 170, blast: 28, cost: { inci: 5, gold: 80 }, desc: 'Yavaş roket: geniş alan patlaması. Gürültülüdür.', evo: [
    { name: 'İkiz Roket', desc: 'Aynı anda 2 roket (her biri %65 hasar).', pellets: 2, spread: 0.22, dmg: 1.7 },
    { name: 'Dev Başlık', desc: 'Patlama alanı %45 büyür, hasar %20 artar.', blast: 41, dmg: 3.1 }] },
  kirag:    { name: 'Kırağı Topu', icon: 'frost', dmg: 1.2, cd: 1.1, range: 1.1, speed: 200, blast: 18, freeze: 2.5, cost: { akik: 5, water: 120 }, desc: 'Buz güllesi: küçük alan hasarı, vurduklarını 2.5 sn yarı hıza düşürür.', evo: [
    { name: 'Derin Don', desc: 'Yavaşlatma 5 sn sürer, alan %40 büyür.', freeze: 5, blast: 25 },
    { name: 'Dolu Fırtınası', desc: 'Atış hızı %45 artar.', cd: 0.76 }] },
};
export const WEAPON_KEYS = Object.keys(WEAPONS);
// evrimli silah tanımları (weaponOf): temel değerler + seçilen evrim
export const EVOLVED = Object.fromEntries(WEAPON_KEYS.map(k => [k, WEAPONS[k].evo.map(e => ({ ...WEAPONS[k], ...e }))]));
// Silah seviyesi: düşman öldürdükçe dolar (ekip ortak). Her seviyede üç karttan biri seçilir; evoAt'ta elindeki silah evrilir.
// xp: düşmanın yönetmen bedeli (elit ×3, boss sabit). Sonraki seviye için gereken: base + step × seviye
export const WXP = { base: 6, step: 4, elite: 3, boss: 20, evoAt: 3 };
export const CRIT = { base: 0.1, mul: 2 };
// kartlar: en çok max kez alınır. shot: yalnız mermi atan silah elindeyken, noFlame: alev püskürtücü dışında sunulur
export const CARDS = {
  dmg:  { name: 'Ağır Mermi', icon: 'blaster', max: 6, v: 0.1, desc: 'Silah hasarı +%10.' },
  hiz:  { name: 'Yağlı Mekanizma', icon: 'rapid', max: 6, v: 0.08, desc: 'Atış hızı +%8.' },
  krit: { name: 'Keskin Göz', icon: 'spark', max: 5, v: 0.06, desc: 'Kritik vuruş şansı +%6 (kritik iki kat vurur).' },
  cok:  { name: 'Ek Namlu', icon: 'split', max: 2, noFlame: true, desc: 'Her atışta bir mermi daha (yarım hasar).' },
  del:  { name: 'Sert Çekirdek', icon: 'pierce', max: 2, shot: true, desc: 'Mermiler bir düşmanı daha deler.' },
};
export const CARD_KEYS = Object.keys(CARDS);
// Alet seviyesi: Nöbetçi, Alev Kulesi, Havan; seviye başına hasar +%50, dayanıklılık +%40
export const TOOL_UP = { max: 5, dmg: 0.5, hp: 0.4, costs: [{ iron: 24, cobalt: 6 }, { cobalt: 40, gold: 16 }, { crystal: 60, gold: 40, opal: 3 }, { crystal: 120, gold: 90, akik: 4 }, { crystal: 220, gold: 170, elmas: 5 }] };

// Seviye 0..max. effect[lvl] mevcut seviyedeki değer.
const BLASTER_DMG = [10, 13, 16, 20, 24, 30, 38, 48, 60, 75, 92, 112, 136, 165, 200, 240];
export const BAG_CAPS = [12, 20, 32, 50, 75, 110, 160, 230, 320, 450, 620, 800, 1000];
export const UPGRADES = {
  drill: {
    name: 'Kazma', icon: 'drill',
    dmg: PICK_TIERS.map(t => t.dmg),
    interval: PICK_TIERS.map(t => t.interval),
    costs: PICK_COSTS, lock: true,
    desc: l => `${PICK_TIERS[l].name} · güç ×${PICK_TIERS[l].dmg}`,
  },
  sharp: {
    name: 'Keskinlik', icon: 'sharp',
    mult: [1, 1.15, 1.3, 1.5, 1.75, 2, 2.3, 2.6, 3], lock: true,
    costs: [{ iron: 12 }, { iron: 24, gold: 6 }, { cobalt: 30, gold: 16 }, { crystal: 40, gold: 30, opal: 3 }, { crystal: 80, gold: 60, inci: 4 }, { crystal: 140, gold: 110, akik: 5 }, { crystal: 220, gold: 180, yildiz: 5 }, { crystal: 320, gold: 260, kehribar: 6 }],
    desc: l => `Kazı gücü ×${[1, 1.15, 1.3, 1.5, 1.75, 2, 2.3, 2.6, 3][l]}`,
  },
  swing: {
    name: 'Hızlı Sallama', icon: 'swing',
    mult: [1, 0.9, 0.82, 0.74, 0.68, 0.63, 0.58], lock: true,
    costs: [{ water: 10 }, { water: 24, gold: 8 }, { cobalt: 40, gold: 24, yesim: 3 }, { crystal: 70, gold: 50, inci: 4 }, { crystal: 150, gold: 120, yildiz: 5 }, { crystal: 260, gold: 220, elmas: 6 }],
    desc: l => `Vuruş aralığı ×${[1, 0.9, 0.82, 0.74, 0.68, 0.63, 0.58][l]}`,
  },
  bag: {
    name: 'Çanta', icon: 'bag',
    cap: BAG_CAPS, lock: true,
    costs: [{ iron: 6 }, { iron: 14 }, { iron: 24, water: 8 }, { water: 20, cobalt: 10 }, { cobalt: 30, crystal: 8 }, { crystal: 30, gold: 24, yesim: 3 }, { crystal: 50, gold: 40, opal: 4 }, { cobalt: 120, crystal: 70, inci: 4 }, { crystal: 110, gold: 90, akik: 5 }, { crystal: 160, gold: 130, yildiz: 5 }, { crystal: 230, gold: 190, elmas: 6 }, { crystal: 320, gold: 260, kehribar: 6 }],
    desc: l => `Kapasite ${BAG_CAPS[l]}`,
  },
  armor: {
    name: 'Zırh', icon: 'armor',
    hp: [100, 130, 165, 205, 250, 310, 380, 460, 550, 650, 760, 880, 1000], lock: true,
    costs: [{ water: 5 }, { water: 12, iron: 10 }, { water: 20, cobalt: 10 }, { cobalt: 30, crystal: 10 }, { crystal: 30, gold: 24, yesim: 3 }, { crystal: 50, gold: 40, opal: 4 }, { crystal: 80, gold: 65, inci: 4 }, { crystal: 120, gold: 100, akik: 5 }, { crystal: 170, gold: 140, yildiz: 5 }, { crystal: 230, gold: 190, elmas: 5 }, { crystal: 300, gold: 250, elmas: 7 }, { crystal: 400, gold: 330, kehribar: 8 }],
    desc: l => `Maks can ${[100, 130, 165, 205, 250, 310, 380, 460, 550, 650, 760, 880, 1000][l]}`,
  },
  blaster: {
    name: 'Silah Gücü', icon: 'blaster',
    dmg: BLASTER_DMG,
    cd: [0.45, 0.42, 0.39, 0.36, 0.32, 0.28, 0.25, 0.22, 0.21, 0.2, 0.19, 0.18, 0.17, 0.16, 0.155, 0.15],
    range: [78, 84, 90, 96, 102, 110, 118, 126, 132, 138, 144, 148, 152, 156, 160, 164], lock: true,
    costs: [{ iron: 8 }, { iron: 16, water: 5 }, { cobalt: 12 }, { cobalt: 24, water: 10 }, { cobalt: 36, crystal: 10, yesim: 3 }, { crystal: 30, gold: 24, opal: 3 }, { crystal: 50, gold: 40, opal: 5 }, { crystal: 75, gold: 60, inci: 4 },
      { crystal: 105, gold: 85, inci: 6 }, { crystal: 140, gold: 115, akik: 5 }, { crystal: 180, gold: 150, akik: 7 }, { crystal: 230, gold: 190, yildiz: 6 }, { crystal: 290, gold: 240, elmas: 6 }, { crystal: 360, gold: 300, elmas: 8 }, { crystal: 450, gold: 380, kehribar: 8 }],
    desc: l => `Tüm silahlara işler: temel hasar ${BLASTER_DMG[l]}`,
  },
  lamp: {
    name: 'Fener', icon: 'lamp',
    radius: [7, 8.5, 10, 11.5, 13],
    costs: [{ water: 6 }, { water: 16, cobalt: 6 }, { crystal: 20 }, { crystal: 40, gold: 30, inci: 3 }],
    desc: l => `Görüş ${[7, 8.5, 10, 11.5, 13][l]} blok`,
  },
};
// Usta İşi: derin cevherle alınan tek seferlik yükseltmeler (cevher bulununca Atölye'de görünür)
Object.assign(UPGRADES, {
  muska:          { name: 'Yeşim Muska', icon: 'yesim', costs: [{ yesim: 4, iron: 40 }], desc: () => 'Azami can +30.' },
  opalNamlu:      { name: 'Opal Namlu', icon: 'opal', costs: [{ opal: 4, cobalt: 40 }], desc: () => 'Mermilerin yakar: 3 sn boyunca saniyede silah hasarının %25’i.' },
  inciFener:      { name: 'İnci Fener', icon: 'inci', costs: [{ inci: 4, crystal: 40 }], desc: () => 'Görüş +3 blok; karartma fenerini kısamaz.' },
  akikKalkan:     { name: 'Akik Kalkan', icon: 'akik', costs: [{ akik: 4, gold: 80 }], desc: () => '15 sn’de bir gelen darbeyi tamamen emer.' },
  yildizCekirdek: { name: 'Yıldız Çekirdeği', icon: 'yildiz', costs: [{ yildiz: 5, crystal: 120 }], desc: () => 'Kazma ve silah hasarı ×1.4.' },
  elmasDeri:      { name: 'Kara Elmas Deri', icon: 'elmas', costs: [{ elmas: 5, crystal: 160 }], desc: () => 'Aldığın tüm hasar %25 azalır.' },
  kehribarKalp:   { name: 'Kehribar Kalp', icon: 'kehribar', costs: [{ kehribar: 5, gold: 200 }], desc: () => 'Her 20 sn’de 80 hasar emen bir kehribar kalkanı dolar.' },
});
export const MASTER_KEYS = ['muska', 'opalNamlu', 'inciFener', 'akikKalkan', 'yildizCekirdek', 'elmasDeri', 'kehribarKalp'];
export const KEHRIBAR = { hp: 80, cd: 20 };
// Fener kilidi: uzun yükseltmelerin son seviyeleri bu seferde yakılan Fener sayısını ister (biyomun tüm yuvalarını yık)
export const BEACON_MAX = 8;
export function beaconReq(key, l) {
  const u = UPGRADES[key]; if (!u || !u.lock) return 0;
  const n = u.costs.length; return l < 3 ? 0 : Math.round(BEACON_MAX * Math.pow((l - 2) / (n - 3), 1.2));
}
export const UPGRADE_KEYS = ['bag', 'blaster', 'armor', 'lamp'];
export const PICK_KEYS = ['drill', 'sharp', 'swing'];

// Silah eklentileri: Atölye > SİLAH'tan bir kez alınır, alındığı andan itibaren hep çalışır (yuva, takma-çıkarma yok).
// İlk dördü yalnız demir ve suyla alınır; sefer başında START_MODS'tan biri bedava seçilir.
export const MODS = {
  split:    { name: 'Çatal Namlu',  icon: 'split',    cost: { iron: 14 },               desc: 'Her atışta iki yan mermi (yarım hasar).' },
  ricochet: { name: 'Sekme',        icon: 'ricochet', cost: { iron: 10, water: 4 },     desc: 'Mermiler duvardan iki kez seker.' },
  frost:    { name: 'Buz Ucu',      icon: 'frost',    cost: { water: 12 },              desc: 'İsabet düşmanı 1.5 sn yavaşlatır.' },
  rapid:    { name: 'Hızlı Ateş',   icon: 'rapid',    cost: { iron: 24, water: 10 },    desc: 'Atış hızı %30 artar.' },
  fire:     { name: 'Yakıcı',       icon: 'flame',    cost: { iron: 30, cobalt: 10 },   desc: 'İsabet 3 sn boyunca yakar (saniyede 4).' },
  homing:   { name: 'Güdümlü',      icon: 'magnet',   cost: { water: 24, cobalt: 14 },  desc: 'Mermiler yakındaki düşmana kıvrılır; ıskalamak zorlaşır.' },
  chain:    { name: 'Yıldırım',     icon: 'chain',    cost: { cobalt: 20, gold: 8 },    desc: 'İsabet yakındaki bir düşmana sıçrar (yarım hasar).' },
  stun:     { name: 'Sersemletici', icon: 'shock',    cost: { iron: 40, gold: 12 },     v: 0.5, desc: 'İsabet alan düşman 0.5 sn saldıramaz (boss hariç).' },
  leech:    { name: 'Can Çalan',    icon: 'heart',    cost: { water: 40, gold: 14 },    v: 0.02, desc: 'Silahla öldürdüğün her düşman azami canının %2’sini yeniler.' },
  boom:     { name: 'Patlayıcı',    icon: 'boom',     cost: { crystal: 14, gold: 16 },  desc: 'Mermiler küçük bir alanda patlar.' },
  nova:     { name: 'Saçılma',      icon: 'nova',     cost: { crystal: 20, gold: 22 },  n: 6, v: 0.5, desc: 'Silahla öldürdüğün düşmandan 6 mermi saçılır (yarım hasar).' },
  overdrive:{ name: 'Aşırı Yük',    icon: 'overdrive', cost: { crystal: 24, gold: 26 }, dur: 3, cd: 12, desc: 'Ateş ederken 12 sn’de bir kendiliğinden devreye girer: 3 sn üç kat atış hızı.' },
};
export const MOD_KEYS = Object.keys(MODS);
export const START_MODS = ['split', 'ricochet', 'frost'];
export const BURN = { dps: 4, t: 3 };

// schematic: true => Kalıntı sandığından çıkan şema ile açılır (kalıcı)
// Taşınabilir aletler: durduğun yere kurulur (tünel içi dahil), dokunup geri alınır. Aynı anda en fazla DEPLOY_MAX tane.
export const BUILDS = {
  turret: { name: 'Nöbetçi', icon: 'turret', cost: { iron: 10 }, hp: 80, range: 112, dmg: 12, cd: 0.6, desc: 'Yakındaki düşmanlara ateş eder.' },
  flame:  { name: 'Alev Kulesi', icon: 'flame', cost: { iron: 8, cobalt: 3 }, hp: 110, range: 46, dps: 30, schematic: true, desc: 'Kısa menzil, sürekli alan hasarı.' },
  mortar: { name: 'Havan', icon: 'mortar', cost: { iron: 12, cobalt: 4 }, hp: 90, range: 160, minRange: 30, dmg: 30, splash: 26, cd: 2.6, schematic: true, desc: 'Uzak menzil, alan hasarı.' },
};
export const BUILD_KEYS = ['turret', 'flame', 'mortar'];
export const DEPLOY_MAX = 2;
export const BARRICADE = { hp: 70 };

// Üretilen eşyalar (Atölye > Üret). Kemerden kullanılır.
export const ITEMS = {
  dynamite:  { name: 'Dinamit', icon: 'dynamite', cost: { iron: 3, water: 1 }, max: 5, desc: '2 sn sonra patlar: çevresindeki kayayı kırar, düşmanlara 60 hasar.' },
  medkit:    { name: 'Tamir Kiti', icon: 'medkit', cost: { water: 3 }, max: 3, desc: 'Anında canının %40’ını (en az 50) yeniler.' },
  recall:    { name: 'Dönüş Fişeği', icon: 'recall', cost: { water: 2, cobalt: 1 }, max: 2, schematic: true, desc: '1.5 sn sonra seni yüzeye ışınlar. Kalp Kristali ile çalışmaz.' },
  sonar:     { name: 'Sonar', icon: 'sonar', cost: { iron: 4, cobalt: 2 }, max: 3, desc: '12 blok içindeki gömülü cevher, yuva ve sandıkları açığa çıkarır.' },
  can:       { name: 'Sessizlik Çanı', icon: 'hush', cost: { water: 4, crystal: 1 }, max: 3, desc: 'Gürültüyü 35 düşürür; 10 sn boyunca gürültü yarı hızda birikir.' },
  kalkan:    { name: 'Kalkan Hücresi', icon: 'shield', cost: { cobalt: 3, water: 3 }, max: 3, desc: '12 sn boyunca gelen 80 hasarı emer.' },
  burgu:     { name: 'Burgu Şarjı', icon: 'auger', cost: { iron: 6, gold: 1 }, max: 3, desc: 'Altındaki 8 bloğu anında deler; sandığa, kalbe ve kapıya dokunmaz.' },
  adren:     { name: 'Adrenalin', icon: 'adren', cost: { crystal: 2, gold: 2 }, max: 2, schematic: true, desc: '8 sn: %40 hızlı koşarsın, kazman ve silahın iki kat vurur.' },
};
// aletler de kemer eşyasıdır: üret, durduğun yere kur
for (const k of BUILD_KEYS) ITEMS[k] = { name: BUILDS[k].name, icon: BUILDS[k].icon, cost: BUILDS[k].cost, max: 2, build: true, schematic: !!BUILDS[k].schematic, desc: BUILDS[k].desc + ' Kemerden kur, dokunup geri al.' };
export const ITEM_KEYS = ['dynamite', 'medkit', 'kalkan', 'sonar', 'can', 'burgu', 'recall', 'adren', ...BUILD_KEYS];
// üretim fiyatı ulaşılan derinlikle artar (biyom başına +%8): derinde de değerli kalır
export const ITEM_SCALE = 0.08;
export const DYNAMITE = { fuse: 2, radius: 2.2, dmg: 60, selfDmg: 14 };
export const MEDKIT = { heal: 50, frac: 0.4 };
export const RECALL = { channel: 1.5 };
export const SONAR = { radius: 12 };
export const HUSH = { drop: 35, t: 10 };
export const SHIELD = { hp: 80, t: 12 };
export const AUGER = { depth: 8 };
export const ADREN = { t: 8, speed: 1.4, dmg: 2 };

// Sandıklardan sırayla çıkan şemalar (bir kez bulunan kalıcıdır)
export const SCHEMATICS = [
  { key: 'recall', kind: 'item' }, { key: 'flame', kind: 'build' }, { key: 'adren', kind: 'item' }, { key: 'mortar', kind: 'build' },
];

// Tehlikeler: gevşek kaya (göçük) ve gaz cepleri
export const HAZARD = { fallDelay: 0.9, fallDmg: 22, fallEnemyDmg: 45, gasTime: 7, gasRadius: 22, gasDps: 7, gasBoom: 40, emberBurn: 8 };
// Uyanış (gürültü) ölçeri
export const THREAT = {
  decay: 0.7, decayPerLevel: 0.45, surfaceDecay: 9, quietAfter: 1.2, depthMul: 0.1,
  noise: { dig: 0.25, brk: 0.42, ore: 0.35, shot: 0.12, boom: 8, mine: 4, chest: 3 },
  bossDelay: 4,                     // ölçer tepedeyken bossun uyanmasına kalan süre (sn)
  range: [7, 13, 20, 30, 45],       // yuvanın uyanma menzili (tile), seviyeye göre (sessizken de yakın yuva tepki verir)
  cap: [5, 12, 18, 26, 34],          // sahadaki canlı düşman üst sınırı (yönetmen yavaşça yaklaşır)
  eliteChance: 0.3, nestRelief: 18, afterBoss: 55,
  floorPerStratum: 4, floorMax: 40, // derinde maden tam susmaz: gürültü bu tabanın altına sönmez
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
  karakok:  { name: 'Karakök', title: 'Toprağın Düğümü', col: '#78b43c', hp: 480, speed: 22, dmg: 24, r: 11, armor: 0.3, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 1.8,
    loot: [['cobalt', 4], ['iron', 4], ['crystal', 2]], lore: 'Madenin ilk kökü. Toprağa dalar, altından çıkar; yerde kök çatlarsa kaç.' },
  kavurgan: { name: 'Kavurgan', title: 'Kül ve Kemik Ejderi', col: '#ff6a1a', hp: 540, speed: 23, dmg: 26, r: 11, armor: 0.35, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 1.8,
    loot: [['cobalt', 5], ['crystal', 3], ['gold', 2]], lore: 'Kor katmanında yanan kemik. Nefesi koni, küllü yer patlar; arkasında dur.' },
  otegoz:   { name: 'Ötegöz', title: 'Boşluğa Bakan', col: '#b080ff', hp: 560, speed: 30, dmg: 22, r: 10, armor: 0.2, fly: true, dig: 99, digRate: 7, knockResist: 1, blink: true, blinkCd: 6, boss: true, cost: 0, dieT: 1.8,
    loot: [['crystal', 5], ['gold', 3]], lore: 'Karanlığın ötesinden bakar. Küreleri seni kovalar, bakışı çeker; ışınını kayayla kes.' },
  kordesen: { name: 'Kördeşen', title: 'Derinlerin Kör Kazıcısı', col: '#ffd870', hp: 640, speed: 22, dmg: 30, r: 11, armor: 0.45, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 1.8,
    loot: [['gold', 8], ['crystal', 3]], lore: 'Madeni senden önce o kazdı. Kayayı matkap gibi yararak hücum eder; duvara çarpınca sersemler.' },
  ezeli:    { name: 'Ezelî', title: 'Çekirdeğin Rüyası', col: '#fff4c0', hp: 720, speed: 26, dmg: 26, r: 11, armor: 0.3, fly: true, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 1.8,
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
  chronoling: { name: 'Zaman Gözü', hp: 85, speed: 32, dmg: 20, r: 5, fly: true, blink: true, blinkCd: 4.5, rewind: 18, rewindRange: 110, cost: 4.5 }, // seni 3 sn önceki yerine geri sarar
  leech:      { name: 'Kan Sülüğü', hp: 140, speed: 26, dmg: 16, r: 6, armor: 0.25, burrow: true, dig: 99, digRate: 7, knockResist: 0.75, drain: true, loot: [['iron', 3]], cost: 5 }, // ısırınca kan emer: iyileşir ve büyür, sen kanarsın
  echoer:     { name: 'Yankıcı', hp: 95, speed: 32, dmg: 14, r: 6, howl: true, howlRange: 110, howlCd: 5.5, echoNoise: 10, cost: 4 }, // ulumasi ölçeri yükseltir, sürüyü hızlandırır
  // v6 biyom imzaları
  korAvci:    { name: 'Kör Avcı', hp: 160, speed: 34, dmg: 42, r: 6, armor: 0.2, deaf: true, dash: 1.8, cost: 5 },                 // görmez; son sese koşar, çok sert vurur
  yilan:      { name: 'Batak Yılanbalığı', hp: 120, speed: 30, dmg: 14, r: 5, fly: true, swim: true, latch: 2.5, cost: 4 },         // suda çok hızlı; yapışır, sudan çıkana kadar yer
  orucu:      { name: 'Örücü', hp: 180, speed: 26, dmg: 16, r: 6, armor: 0.3, seal: 5, sealRange: 130, cost: 5 },                  // arkandaki tüneli örer
  kalkanli:   { name: 'Kalkanlı Muhafız', hp: 260, speed: 22, dmg: 26, r: 8, armor: 0.3, front: 0.9, dig: 99, digRate: 5, knockResist: 0.8, cost: 7 }, // önden gelen vuruşu keser
  diriltici:  { name: 'Diriltici', hp: 140, speed: 30, dmg: 12, r: 6, fly: true, revive: 6, reviveRange: 110, keepAway: 64, cost: 6 }, // ölen dostlarını diriltir, uzak durur
  kene:       { name: 'Demir Kene', hp: 200, speed: 30, dmg: 18, r: 6, magnet: 56, bulletArmor: 0.65, cost: 5 },                    // mermileri üstüne çeker; mermiye dayanıklı
  fare:       { name: 'Cevher Faresi', hp: 90, speed: 72, dmg: 6, r: 4, steal: 12, cost: 3 },                                       // çantandan çalar, kaçar
  tozbocek:   { name: 'Tozböcek', hp: 14, speed: 70, dmg: 4, r: 3, small: true, pack: 4, cost: 0.6 },                                // sürü halinde gelir
  yumurtaci:  { name: 'Yumurtacı', hp: 170, speed: 24, dmg: 14, r: 7, armor: 0.25, lay: 6, cost: 6 },                               // duvara yumurta bırakır
  isikYiyen:  { name: 'Işık Yiyen', hp: 130, speed: 40, dmg: 20, r: 5, fly: true, eatLight: 72, cost: 5 },                         // yakındayken fenerin söner
  aynasiz:  { name: 'Aynasız Hükümdar', title: 'Yansımanın Efendisi', col: '#c8d0ff', hp: 800, speed: 26, dmg: 30, r: 11, armor: 0.35, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 1.8,
    loot: [['crystal', 8], ['gold', 6], ['elmas', 2]], lore: 'Senin silahını senden iyi kullanır. Elindekine dikkat et.' },
  kehribarAna: { name: 'Kehribar Ana', title: 'Kovanların Kraliçesi', col: '#ffb040', hp: 900, speed: 20, dmg: 28, r: 11, armor: 0.3, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 1.8,
    loot: [['crystal', 10], ['gold', 8], ['kehribar', 2]], lore: 'Yumurtaları yere düşünce çatlar; reçinesi seni yere yapıştırır.' },
  madenKalbi: { name: 'Madenin Kalbi', title: 'FALL', col: '#ff3a6a', hp: 1100, speed: 16, dmg: 30, r: 12, armor: 0.3, fly: true, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 1.8,
    loot: [['crystal', 14], ['gold', 12], ['kehribar', 3]], lore: 'Maden yaşıyor. Duvarlar ona ait: duvara yaslanma, yerinde durma.' },
  balrog: { name: 'Balrog', title: 'Kadim Gölge ve Alev', col: '#ff5a1a', hp: 900, speed: 19, dmg: 32, r: 12, armor: 0.35, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 2.6, hpMul: 1.4,
    loot: [['crystal', 10], ['gold', 10], ['cobalt', 6]], lore: 'Kor Katmanının dibinde uyuyan kadim gölge. Kamçısı uzağa uzanır, kılıcı yeri yarar; gölgeye karışıp arkanda belirir.' },
  dunyaYilani: { name: 'Dünya Yılanı', title: 'Denizin Kuşağı', col: '#5ae0ff', hp: 950, speed: 0, dmg: 28, r: 12, armor: 0.3, fly: true, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 2.5, hpMul: 1.5,
    loot: [['crystal', 14], ['gold', 10], ['cobalt', 6]], lore: 'Denizin altında uyuyan kuşak. Duvardan duvara geçer, gövdesi kayayı yarar; yalnız başı vurulur. Geçeceği yol duvarda parlar.' },
  ejder: { name: 'Hazine Ejderi', title: 'Altın Yığınının Uykusu', col: '#ff8a2a', hp: 950, speed: 21, dmg: 30, r: 12, armor: 0.45, dig: 99, digRate: 7, knockResist: 1, boss: true, cost: 0, dieT: 2.5, hpMul: 1.5,
    loot: [['gold', 30], ['crystal', 8], ['cobalt', 4]], lore: 'Altın yığınına gömülü uyur, ona saldırana kadar uyanmaz. Nefesinden önce göğsü içeriden parlar: o an göğsüne vur, zırhı orada incedir.' },
  mimic:      { name: 'Taklitçi', hp: 110, speed: 50, dmg: 22, r: 6, armor: 0.2, knockResist: 0.5, cost: 4 },                         // sandık kılığında; ölünce gerçek sandık teklifi
  seraph:     { name: 'Işık Bekçisi', hp: 120, speed: 42, dmg: 16, r: 5, fly: true, blind: true, blindRange: 52, blindCd: 4, judge: 5, judgeRange: 120, loot: [['crystal', 1]], cost: 5 }, // yargı ışını: nişan alır, kaçmazsan çarpar
};

// derinlik bandı (her 4 biyom) -> boss
export const BOSS_BANDS = ['karakok', 'kavurgan', 'otegoz', 'kordesen', 'ezeli', 'aynasiz', 'kehribarAna', 'madenKalbi'];

// Elit: Öfke seviyesinde yuvalardan şansla çıkar (can ×2.2, boyut ×1.25, altın düşürür); derinde özellik kazanır
export const ELITE = { hp: 2.2, dmg: 1.6, scale: 1.25, gold: 3, fromWave: 3, affixAt: [6, 14, 22] };
export const AFFIX = {
  kalkan: { name: 'Kalkanlı', col: '#8ab4ff', shield: 0.45, refill: 3 },
  hizli:  { name: 'Hızlı', col: '#5fe0b8', speed: 1.45 },
  yenilen:{ name: 'Yenilenen', col: '#a8f070', regen: 0.05, after: 2 },
  patlar: { name: 'Patlayan', col: '#ff7a3a', boom: 26 },
  bolun:  { name: 'Bölünen', col: '#e070ff', split: 2, hp: 0.35 },
};
export const AFFIX_KEYS = Object.keys(AFFIX);

// Derinlik ölçeği: düşman canı biyom başına ×1.13 (boss ×1.1), hasarı +%8; uyanış seviyesi canı +%10
export const SCALE = { hp: 1.13, bossHp: 1.1, dmg: 0.08, lv: 0.1 };
export function enemyHpMul(st, lv, boss) { return Math.pow(boss ? SCALE.bossHp : SCALE.hp, Math.max(0, st)) * (1 + SCALE.lv * Math.max(0, lv)); }
export function enemyDmgMul(st) { return 1 + SCALE.dmg * Math.max(0, st); }
// Güç yönetmeni (power.js): ilk 'from' biyomda karışmaz; sonra ekibin hasar/sn'si beklenenin 'free' katını aşarsa düşman canı (oran^exp) katına çıkar, en çok max.
// Elit ve boss canı en az 'ekip hasar/sn × ttk' olur. lvPerBiome: beklenen Silah Gücü ilerleyişi; cardPerBiome/cardMax: silah kartlarının beklenen katkısı
export const POWER = { exp: 0.6, max: 4, from: 2, free: 1.5, eliteTtk: 3.5, bossTtk: 20, tool: 0.5, lvPerBiome: 0.5, cardPerBiome: 0.12, cardMax: 2.5 };

// Yönetmen: tek ortak bütçe, karışık gruplar, duyurulan dalgalar ve sonrasında nefes arası
export const DIRECTOR = {
  rate: [0.12, 0.35, 0.7, 1.1],       // seviye başına saniyede bütçe puanı (düşman bedeli ENEMIES.cost)
  depthRate: 0.04, mpRate: 1.4, bankMax: 30,
  squad: [[1, 2], [2, 3], [3, 4], [4, 6]],
  gap: [16, 11, 8, 6], maxWait: 14,   // gruplar arası en kısa süre; önceki grup yaşasa da en çok bu kadar beklenir
  waveMin: 2, waveEvery: [80, 110], waveWarn: 4, waveLen: 12, waveSquads: 3, rest: 18,
  capRamp: 3,                        // sahadaki sınır her 3 sn'de en çok 1 artar
};

export const WAVES = {
  firstCalm: 48, calm: 27, warn: 10, heartCalm: 12,
  budget: (wave, stratum, mult = 1) => (3.0 + wave * 2.6 + stratum * 3.4 + Math.max(0, wave - 5) * 1.0) * mult,
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

// Kalıntılar: relics.js (soylar, seviyeler, ikili ve lanetli kalıntılar)
export { PERKS, SOY, SOY_KEYS, RESONANCE } from './relics.js';

// Sandık türleri: gen derinliğe göre seçer. q: kalite (0 ahşap · 1 demir · 2 altın) — ikili/efsanevi kalıntı şansı
export const CHESTS = {
  wood:    { name: 'Ahşap Sandık', n: 3, q: 0 },
  iron:    { name: 'Demir Sandık', n: 3, q: 1, ore: 8 },
  gold:    { name: 'Altın Sandık', n: 4, q: 2, gold: 12 },
  arms:    { name: 'Silah Sandığı', n: 3, arms: true },
  ore:     { name: 'Cevher Sandığı', ore: 30 },
  supply:  { name: 'Erzak Sandığı', supply: true },
  cursed:  { name: 'Lanetli Sandık', n: 3, q: 2, curse: 3 },
  ancient: { name: 'Kadim Sandık', n: 3, q: 2, ore: 16, gold: 10 },
  mimic:   { name: 'Taklitçi', mimic: 'iron' },
};
// biyom konumuna göre sandık türü ağırlıkları
export function chestWeights(s, legend) {
  if (legend) return [['gold', 3], ['ancient', 3], ['arms', 1]];
  return [['wood', Math.max(0.5, 8 - s)], ['iron', 2 + s * 0.4], ['gold', s >= 4 ? 0.5 + s * 0.15 : 0], ['arms', s >= 1 ? 2 : 0], ['ore', 1.5], ['supply', 1.5],
    ['cursed', s >= 5 ? 1.2 : 0], ['mimic', s >= 3 ? 1.2 : 0], ['ancient', s >= 12 ? 0.6 : 0]];
}

// Efsanevi eserler: efsanevi biyomların kalbinde tek bir eser taşı; kırınca kalıcı olarak senindir (kamp rafında durur, her seferde çalışır)
export const RELICS = {
  tac:      { name: 'Altın Taç', icon: 'crown', biome: 12, desc: 'Kazdığın sıradan kaya %10 ihtimalle altın düşürür; sefere +12 altınla başlarsın. Başında taç parlar.', lore: 'Altın Saray’ın tahtında.' },
  kalp:     { name: 'Devin Kalbi', icon: 'heart', biome: 15, desc: 'Azami can +40. Bayılacağın an nabız dalgası yayılır: düşmanlar savrulur, yarı canla ayakta kalırsın (her seferde bir kez).', lore: 'Uyuyan Dev’in göğsünde.' },
  arken:    { name: 'Arkentaş', icon: 'arken', biome: 18, desc: 'Dağın kalbi. Görüşün +3 blok, cevherler karanlıkta parıldar; ışığına giren düşman yarı hıza düşer. Göğsünde yanar.', lore: 'Yankı Boşluğu’nun karanlığında, kayaya gömülü; ışığı uzaktan sızar.' },
  kivilcim: { name: 'Yaratılış Kıvılcımı', icon: 'spark', biome: 19, desc: 'Kazman iki kat vurur ve ışık saçar; kırdığın her blok yakındaki düşmanı yakar.', lore: 'Yaratılış Çekirdeği’nin dibinde, küçük bir mabette.' },
  aynaTac:  { name: 'Aynalı Taç', icon: 'crown', biome: 23, desc: 'Sana vurulan hasarın yarısı vurana yansır; silah hasarın +%15.', lore: 'Ters Saray’ın tavanında, baş aşağı tahtta.' },
  tohum:    { name: 'Dünya Tohumu', icon: 'gem', biome: 27, desc: 'Her yeni biyoma girişte ekip tamamen iyileşir; kırdığın kaya %4 ihtimalle kristal verir.', lore: 'Kök Tahtı’nın kalbinde, köklerin arasında.' },
  sifirTasi:{ name: 'Sıfır Taşı', icon: 'oz', biome: 29, desc: 'Kazma ve silah hasarın ×1.4; sefer sonunda %50 fazla Öz.', lore: 'Sıfır Noktası’nda, Kalp’in yanında.' },
};
export const RELIC_KEYS = Object.keys(RELICS);
export const RELIC_OF_BIOME = Object.fromEntries(RELIC_KEYS.map(k => [RELICS[k].biome, k]));

// Sefer içi asansör: merkez şaft, ulaşılan her biyomda istasyon
export const ELEVATOR = { speed: 230, snap: 7, noise: 3, far: 3, farRows: 4 / 3, walk: 0.14, lever: 0.14, stop: 12 };
// gezgin tüccar: ilk gelişi, sonraki gelişler arası, kampta kalma süresi (sn); fiyatlar altın
// şans kuyusu: sikke at, kuyu bir şey verir; her atış pahalanır
export const WELL = { cost: 5, step: 2, delay: 1.1, near: 16 };
export const MERCHANT = { first: 240, every: 360, jitter: 180, stay: 60, relic: 14, relicStep: 3, item: 6, mod: 20, leg: 45, legChance: 0.3 };

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
  genisCanta:{ name: 'Geniş Çanta', icon: 'bag', max: 3, costs: [25, 50, 90], desc: 'Çanta kapasitesi +10 (seviye başına).' },
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
  crafted: { icon: 'gear', text: n => `${n} eşya üret`, vals: [4, 6, 9, 12], stat: g => g.stats.crafted, oz: 8 },
};

export function ozForRun(s) {
  return Math.round(
    s.maxDepth * 0.5 + s.nests * 6 + s.beacons * 20 + s.chests * 6 + (s.victory ? 250 : 0) +
    RES_KEYS.reduce((a, k) => a + (s.collected[k] || 0) * RES[k].value, 0)
  );
}
// harita sürprizleri: yeraltı gölü (olta), portal taşı çifti (kısa ışınlanma), yenebilir mantar
export const LAKE = { chance: 0.42, w: 4, h: 3, fish: 3, bite: 1.2, biteVar: 1.4 };
export const PORTAL = { chance: 0.35, min: 5, max: 9, reach: 7, cd: 1 };
export const SHROOM = { chance: 0.6, per: 2, reach: 10, eat: 0.5, dur: 18, haste: 12, poisonT: 6, poisonDmg: 1.5, mini: 0.6, big: 1.45, miniDmg: 0.6, miniSpd: 1.15, bigSpd: 0.9, bigPick: 1.7 };
// sıvılar: her 'every' karede bir akış adımı; lav 'lavaSlow' adımda bir akar; kaynak başına toplam sınır ve adım başı akış
export const LIQUID = { every: 3, lavaSlow: 2, dry: 40, cap: [170, 120], emit: [4, 2], drain: [2, 1], lavaDmg: 7, wetSpd: 0.72 };

// Balrog: Kor Katmanı'nın ortasına inen madenciyi bir kez karşılar. dark: sisin toplanma süresi (sn), intro: alevlenme
export const BALROG = { depth: 16, dark: 7.5, intro: 2.6, drum: 1.15, aura: 28, auraDmg: 4, carve: 0.3 };
// Dünya Yılanı: Sessiz Deniz'in ortasında bir kez; duvardan duvara geçer, yalnız başı vurulur
export const SERPENT = { depth: 16, omen: 8.5, seg: 5, n: 48, speed: 150, under: 1.4, tell: 1.1, rear: 2.3, headDmg: 26, bodyDmg: 12 };
// Hazine Ejderi: Altın Saray'ın altındaki hazine salonunda altına gömülü uyur; altın ve gürültü kıpırdatır, saldırı uyandırır
export const HOARD = { noise: 6, gold: 14, decay: 1.2, stirMax: 90, intro: 3.4, weak: 2 };
