// Tile tipleri ve özellikleri.
export const T = {
  AIR: 0, DIRT: 1, STONE: 2, HARD: 3, DENSE: 4, BEDROCK: 5,
  IRON: 6, WATER: 7, COBALT: 8, CRYSTAL: 9, CHEST: 10, HEART: 11, BARRICADE: 12, FOUNDATION: 13, LOOSE: 14, GAS: 15, VAULT: 16,
  // v4 biyom kayaları ve altın
  MOSS: 17, ICE: 18, BONE: 19, MAGMA: 20, OBSIDIAN: 21, VOID: 22, GOLD: 23, EMBER: 24,
  NEST: 25,
  // v5 derin biyomlar (10-19): ana kaya + biyoma özgü taş
  QUICK: 26, MERCURY: 27, STORM: 28, BOLT: 29, GILT: 30, GATE: 31, FUNGUS: 32, SPORE: 33, GLASS: 34,
  TITAN: 35, PULSE: 36, CHRONO: 37, HOURGLASS: 38, BLOOD: 39, BLOODVEIN: 40, ECHO: 41, HUSH: 42, GENESIS: 43, SEED: 44, RELIC: 45, ARKEN: 46,
  // derin cevherler (bant başına bir)
  YESIM: 47, OPAL: 48, INCI: 49, AKIK: 50, YILDIZ: 51, ELMAS: 52, KEHRIBAR: 53,
  // sandık türleri (T.CHEST: ahşap)
  CHEST_IRON: 54, CHEST_GOLD: 55, CHEST_ARMS: 56, CHEST_ORE: 57, CHEST_SUPPLY: 58, CHEST_CURSED: 59, CHEST_ANCIENT: 60, MIMIC: 61,
  // v6 biyomlar (20-29): ana kaya + biyoma özgü taş
  MUTE: 62, TIDE: 63, FLESH: 64, MIRROR: 65, AMBERROCK: 66, MAGNETROCK: 67, HUNGER: 68, ROOTWOOD: 69, SEA: 70, ZERO: 71,
  LURE: 72, CLAM: 73, NODE: 74, AMBER: 75, MAGNET: 76, EGG: 77, LUMEN: 78,
  // Şelale Mağarası ve sıvılar: ıslak kaya, su kaynağı, lav ağzı, gider
  FALLROCK: 79, SPRING: 80, LAVAVENT: 81, SINK: 82,
  // göl yatağı: gölü tutan kırılmaz ıslak kaya
  LAKEBED: 83,
  // mühür: bölüm sonundaki kırılmaz katman; bekçi yenilince kırılır
  SEAL: 84,
  // Kayıp Ekip Günlüğü sayfası: her biyomda bir tane
  PAGE: 85,
};

// mat: doku/ses/parçacık malzemesi ('host' => katmanın ana kayası); plain: sıradan kaya (damar/tehlike/dönüşüm yerleşebilir)
export const TD = [];
TD[T.AIR]      = { solid: false };
TD[T.DIRT]     = { solid: true, hp: 1, mat: 'dirt', plain: true };
TD[T.STONE]    = { solid: true, hp: 3, mat: 'stone', plain: true };
TD[T.HARD]     = { solid: true, hp: 10, mat: 'hard', plain: true };
TD[T.DENSE]    = { solid: true, hp: 24, mat: 'dense', plain: true };
TD[T.BEDROCK]  = { solid: true, hp: Infinity, mat: 'bedrock', unbreakable: true };
TD[T.IRON]     = { solid: true, hp: 2, mat: 'host', ore: 'iron', amt: 2 };
TD[T.WATER]    = { solid: true, hp: 3, mat: 'host', ore: 'water', amt: 2 };
TD[T.COBALT]   = { solid: true, hp: 8, mat: 'host', ore: 'cobalt', amt: 2 };
TD[T.CHEST]    = { solid: true, hp: 4, mat: 'host', chest: 'wood' };
TD[T.CRYSTAL]  = { solid: true, hp: 14, mat: 'host', ore: 'crystal', amt: 3 };
TD[T.HEART]    = { solid: true, hp: 36, mat: 'host', heart: true };
TD[T.BARRICADE] = { solid: true, hp: Infinity, mat: 'metal', built: true, playerUnbreakable: true };
TD[T.FOUNDATION] = { solid: true, hp: Infinity, mat: 'found', unbreakable: true };
// tehlikeler: altı boşalınca düşen gevşek kaya; kırılınca zehirli gaz salan cep
TD[T.LOOSE]    = { solid: true, hp: 2, mat: 'host', loose: true };
TD[T.GAS]      = { solid: true, hp: 3, mat: 'host', gas: true };
// kilitli kaya: ana kayadaki ceplerin kapağı; kazma işlemez, yalnız dinamit kırar
TD[T.VAULT]    = { solid: true, hp: Infinity, mat: 'vault', unbreakable: true, blastable: true };
// v4 biyom kayaları
TD[T.MOSS]     = { solid: true, hp: 2, mat: 'moss', plain: true };                                   // Kök Ormanı: yumuşak, yosunlu
TD[T.ICE]      = { solid: true, hp: 5, mat: 'ice', ore: 'water', amt: 1, iceDrop: true, plain: true }; // Buz: kırılınca 1 su bırakır
TD[T.BONE]     = { solid: true, hp: 7, mat: 'bone', plain: true };                                   // Kemik Çukuru
TD[T.MAGMA]    = { solid: true, hp: 18, mat: 'magma', plain: true };                                 // Kor Katmanı
TD[T.EMBER]    = { solid: true, hp: 12, mat: 'magma', ember: true, plain: true };                    // Kor taşı: parlar, kırılınca yakar
TD[T.OBSIDIAN] = { solid: true, hp: 40, mat: 'obsidian', plain: true };
TD[T.VOID]     = { solid: true, hp: 60, mat: 'void', plain: true };
TD[T.GOLD]     = { solid: true, hp: 6, mat: 'host', ore: 'gold', amt: 2 };
// yuva (kovan): uyanınca düşman çıkarır; kazma ve mermiyle yıkılır
TD[T.NEST]     = { solid: true, hp: 30, mat: 'host', nest: true };
// v5 derin biyomlar: ana kaya gittikçe sertleşir; her biyomun kendine özgü taşı (gem: parlayan taş deseni, glow: ışık gücü)
TD[T.QUICK]    = { solid: true, hp: 75, mat: 'quick', plain: true };                                  // Cıva Denizi
TD[T.MERCURY]  = { solid: true, hp: 6, mat: 'host', ore: 'gold', amt: 2, toxic: true, gem: ['#3a4048', '#8a96a0', '#d8e4ec', '#ffffff'] }; // cıva cebi: altın verir, zehirler
TD[T.STORM]    = { solid: true, hp: 90, mat: 'storm', plain: true };                                  // Fırtına Damarı
TD[T.BOLT]     = { solid: true, hp: 9, mat: 'host', ore: 'cobalt', amt: 2, shock: true, glow: 2.4, gem: ['#1a3a6a', '#3a8aff', '#9ad8ff', '#ffffff'] }; // yıldırım damarı
TD[T.GILT]     = { solid: true, hp: 110, mat: 'gilt', plain: true };                                  // Altın Saray
TD[T.GATE]     = { solid: true, hp: 200, mat: 'gate', gate: true };                                   // saray kapısı: çok sert ama kırılır
TD[T.FUNGUS]   = { solid: true, hp: 130, mat: 'fungus', plain: true };                                // Mantar Uçurumu
TD[T.SPORE]    = { solid: true, hp: 6, mat: 'host', spore: true, glow: 1.6, gem: ['#2a4a1a', '#5a9a3a', '#a8f070', '#f0ffd0'] }; // spor kesesi
TD[T.GLASS]    = { solid: true, hp: 155, mat: 'glass', plain: true, brittle: true };                  // Cam Katedrali: zincirleme kırılır
TD[T.TITAN]    = { solid: true, hp: 185, mat: 'titan', plain: true };                                 // Uyuyan Dev
TD[T.PULSE]    = { solid: true, hp: 40, mat: 'host', ore: 'crystal', amt: 3, pulse: true, glow: 3.4, gem: ['#5a0a1a', '#c02040', '#ff5a6a', '#ffd0d0'] }; // nabız taşı
TD[T.CHRONO]   = { solid: true, hp: 220, mat: 'chrono', plain: true };                                // Zaman Kırığı
TD[T.HOURGLASS] = { solid: true, hp: 14, mat: 'host', chrono: true, glow: 2, gem: ['#4a3010', '#b08030', '#ffd890', '#ffffff'] }; // zaman taşı: düşman donar, sen hızlanırsın
TD[T.BLOOD]    = { solid: true, hp: 260, mat: 'blood', plain: true };                                 // Kan Gölü
TD[T.BLOODVEIN] = { solid: true, hp: 16, mat: 'host', ore: 'iron', amt: 3, vamp: true, glow: 1.4, gem: ['#3a0408', '#8a0a18', '#e02a3a', '#ff9aa0'] }; // kan damarı: iyileştirir, gölü uyandırır
TD[T.ECHO]     = { solid: true, hp: 300, mat: 'echo', plain: true };                                  // Yankı Boşluğu
TD[T.HUSH]     = { solid: true, hp: 12, mat: 'host', hush: true, glow: 1.2, gem: ['#3a3a44', '#8a8aa0', '#d8d8e8', '#ffffff'] }; // sessiz taş: ölçeri düşürür
TD[T.GENESIS]  = { solid: true, hp: 350, mat: 'genesis', plain: true };                               // Yaratılış Çekirdeği
TD[T.RELIC]    = { solid: true, hp: 30, mat: 'host', relic: true, glow: 4.5 };                          // efsanevi eser taşı: biyomun kalbinde tek
TD[T.ARKEN]    = { solid: true, hp: 40, mat: 'host', relic: 'arken', glow: 9 };                       // Arkentaş: dağın kalbi, kendi ışığıyla yanar
TD[T.SEED]     = { solid: true, hp: 24, mat: 'host', seed: true, glow: 3, gem: ['#6a4a10', '#e0b040', '#fff0a0', '#ffffff'] }; // yaratılış tohumu: çevre kayayı cevhere çevirir

TD[T.YESIM] = { solid: true, hp: 5, mat: 'host', ore: 'yesim', amt: 1, glow: 1.2 };
TD[T.OPAL]     = { solid: true, hp: 12, mat: 'host', ore: 'opal', amt: 1, glow: 1.4 };
TD[T.INCI]     = { solid: true, hp: 20, mat: 'host', ore: 'inci', amt: 1, glow: 1.4 };
TD[T.AKIK]     = { solid: true, hp: 30, mat: 'host', ore: 'akik', amt: 1, glow: 1.4 };
TD[T.YILDIZ]   = { solid: true, hp: 45, mat: 'host', ore: 'yildiz', amt: 1, glow: 1.8 };
TD[T.ELMAS]    = { solid: true, hp: 60, mat: 'host', ore: 'elmas', amt: 1, glow: 1.6 };
TD[T.KEHRIBAR] = { solid: true, hp: 75, mat: 'host', ore: 'kehribar', amt: 1, glow: 2 };
TD[T.CHEST_IRON]    = { solid: true, hp: 8, mat: 'host', chest: 'iron' };
TD[T.CHEST_GOLD]    = { solid: true, hp: 12, mat: 'host', chest: 'gold' };
TD[T.CHEST_ARMS]    = { solid: true, hp: 8, mat: 'host', chest: 'arms' };
TD[T.CHEST_ORE]     = { solid: true, hp: 8, mat: 'host', chest: 'ore' };
TD[T.CHEST_SUPPLY]  = { solid: true, hp: 6, mat: 'host', chest: 'supply' };
TD[T.CHEST_CURSED]  = { solid: true, hp: 14, mat: 'host', chest: 'cursed' };
TD[T.CHEST_ANCIENT] = { solid: true, hp: 20, mat: 'host', chest: 'ancient' };
TD[T.MIMIC]         = { solid: true, hp: 8, mat: 'host', chest: 'mimic' };
// v6 biyom kayaları: sertlik derinlikle artmaya devam eder
TD[T.MUTE]       = { solid: true, hp: 370, mat: 'mute', plain: true };                                  // Sağır Mağaralar
TD[T.TIDE]       = { solid: true, hp: 390, mat: 'tide', plain: true };                                  // Gelgit Kuyuları
TD[T.FLESH]      = { solid: true, hp: 260, mat: 'flesh', plain: true };                                 // Yaşayan Kaya: yumuşak ama yeniden büyür
TD[T.MIRROR]     = { solid: true, hp: 430, mat: 'mirror', plain: true };                                // Ters Saray
TD[T.AMBERROCK]  = { solid: true, hp: 450, mat: 'amber', plain: true };                                 // Kehribar Mezarı
TD[T.MAGNETROCK] = { solid: true, hp: 470, mat: 'magnet', plain: true };                                // Mıknatıs Çekirdeği
TD[T.HUNGER]     = { solid: true, hp: 490, mat: 'hunger', plain: true };                                // Açlık Yatağı
TD[T.ROOTWOOD]   = { solid: true, hp: 510, mat: 'rootwood', plain: true };                              // Kök Tahtı
TD[T.SEA]        = { solid: true, hp: 530, mat: 'sea', plain: true };                                   // Sessiz Deniz
TD[T.ZERO]       = { solid: true, hp: 560, mat: 'zero', plain: true };                                  // Sıfır Noktası
TD[T.LURE]   = { solid: true, hp: 12, mat: 'host', lure: true, glow: 1.4, gem: ['#2a2a3a', '#6a6a8a', '#c0c0e0', '#ffffff'] };     // tuzak taşı: kırınca sağır düşmanlar oraya koşar
TD[T.CLAM]   = { solid: true, hp: 18, mat: 'host', ore: 'gold', amt: 3, glow: 1.2 };                                              // istiridye: bol altın
TD[T.NODE]   = { solid: true, hp: 30, mat: 'host', node: true, glow: 2, gem: ['#4a0a1a', '#c02a4a', '#ff8aa0', '#ffe0e8'] };      // sinir düğümü: büyümeyi durdurur
TD[T.AMBER]  = { solid: true, hp: 20, mat: 'host', amber: true, glow: 1.8, gem: ['#4a2008', '#b0601a', '#ffb040', '#fff0c0'] };   // kehribar kütlesi: ganimet ya da uyanan yaratık
TD[T.MAGNET] = { solid: true, hp: 16, mat: 'host', ore: 'iron', amt: 4, glow: 1 };                                                 // mıknatıs taşı: bol demir
TD[T.EGG]    = { solid: true, hp: 10, mat: 'host', egg: true, glow: 1.6, gem: ['#2a3a1a', '#7aa040', '#d8f0a0', '#ffffff'] };     // yumurta: kırılmazsa çatlar
TD[T.LUMEN]  = { solid: true, hp: 8, mat: 'host', lumen: true, glow: 3.2, gem: ['#0a2a3a', '#2a8ab0', '#8af0ff', '#ffffff'] };    // ışık mantarı: iyileştirir, aydınlatır
TD[T.FALLROCK] = { solid: true, hp: 8, mat: 'falls', plain: true };                                                                 // Şelale Mağarası: ıslak, yosunlu kayağan taş
TD[T.SPRING]   = { solid: true, hp: Infinity, mat: 'host', unbreakable: true, spring: 'water', glow: 1.6, gem: ['#0a2a4a', '#2a7ac8', '#8ad8ff', '#ffffff'] }; // su kaynağı
TD[T.LAVAVENT] = { solid: true, hp: Infinity, mat: 'host', unbreakable: true, spring: 'lava', glow: 2.6, gem: ['#4a0a04', '#c0301a', '#ff8a3a', '#fff0a0'] };  // lav ağzı
TD[T.SINK]     = { solid: true, hp: Infinity, mat: 'host', unbreakable: true, sink: true, gem: ['#060608', '#1a1a22', '#34343e', '#5a5a66'] };                 // gider: havuzun dibinde sıvıyı yutar
TD[T.LAKEBED]  = { solid: true, hp: Infinity, mat: 'falls', unbreakable: true };                                                     // göl yatağı: kırılırsa su havada kalırdı
TD[T.PAGE]     = { solid: true, hp: 6, mat: 'host', page: true, glow: 1.4, gem: ['#5a4020', '#b08a50', '#f0dca0', '#fffaf0'] }; // günlük sayfası: kırınca okunur
TD[T.SEAL]     = { solid: true, hp: Infinity, mat: 'seal', unbreakable: true, seal: true, glow: 1.8, gem: ['#3a0a2a', '#a02a6a', '#ff6ab0', '#ffe0f0'] }; // mühür: bekçi yenilince kırılır
export const CHEST_TILE = { wood: T.CHEST, iron: T.CHEST_IRON, gold: T.CHEST_GOLD, arms: T.CHEST_ARMS, ore: T.CHEST_ORE, supply: T.CHEST_SUPPLY, cursed: T.CHEST_CURSED, ancient: T.CHEST_ANCIENT, mimic: T.MIMIC };
export const DEEP_TILE = [T.YESIM, T.OPAL, T.INCI, T.AKIK, T.YILDIZ, T.ELMAS, T.KEHRIBAR];

export const isSolid = t => TD[t].solid;
export const isMineable = t => TD[t].solid && !TD[t].unbreakable && !TD[t].built;
export const isPlain = t => !!TD[t].plain;
// Biyomun ana kayası (cevher tile'larının etrafı ve arka duvar): 30 biyom (kimliğe göre)
export const HOST_MAT = ['dirt', 'stone', 'moss', 'hard', 'ice', 'bone', 'magma', 'dense', 'obsidian', 'void',
  'quick', 'storm', 'gilt', 'fungus', 'glass', 'titan', 'chrono', 'blood', 'echo', 'genesis',
  'mute', 'tide', 'flesh', 'mirror', 'amber', 'magnet', 'hunger', 'rootwood', 'sea', 'zero', 'falls'];
// Biyomun ana kaya tile'ı
export const HOST_TILE = [T.DIRT, T.STONE, T.MOSS, T.HARD, T.ICE, T.BONE, T.MAGMA, T.DENSE, T.OBSIDIAN, T.VOID,
  T.QUICK, T.STORM, T.GILT, T.FUNGUS, T.GLASS, T.TITAN, T.CHRONO, T.BLOOD, T.ECHO, T.GENESIS,
  T.MUTE, T.TIDE, T.FLESH, T.MIRROR, T.AMBERROCK, T.MAGNETROCK, T.HUNGER, T.ROOTWOOD, T.SEA, T.ZERO, T.FALLROCK];
