// Tile tipleri ve özellikleri.
export const T = {
  AIR: 0, DIRT: 1, STONE: 2, HARD: 3, DENSE: 4, BEDROCK: 5,
  IRON: 6, WATER: 7, COBALT: 8, CRYSTAL: 9, CHEST: 10, HEART: 11, BARRICADE: 12, FOUNDATION: 13, LOOSE: 14, GAS: 15, VAULT: 16,
  // v4 biyom kayaları ve altın
  MOSS: 17, ICE: 18, BONE: 19, MAGMA: 20, OBSIDIAN: 21, VOID: 22, GOLD: 23, EMBER: 24,
  NEST: 25,
};

// mat: doku/ses/parçacık malzemesi ('host' => katmanın ana kayası)
export const TD = [];
TD[T.AIR]      = { solid: false };
TD[T.DIRT]     = { solid: true, hp: 1, mat: 'dirt' };
TD[T.STONE]    = { solid: true, hp: 3, mat: 'stone' };
TD[T.HARD]     = { solid: true, hp: 10, mat: 'hard' };
TD[T.DENSE]    = { solid: true, hp: 24, mat: 'dense' };
TD[T.BEDROCK]  = { solid: true, hp: Infinity, mat: 'bedrock', unbreakable: true };
TD[T.IRON]     = { solid: true, hp: 2, mat: 'host', ore: 'iron', amt: 2 };
TD[T.WATER]    = { solid: true, hp: 3, mat: 'host', ore: 'water', amt: 2 };
TD[T.COBALT]   = { solid: true, hp: 8, mat: 'host', ore: 'cobalt', amt: 2 };
TD[T.CHEST]    = { solid: true, hp: 4, mat: 'host', chest: true };
TD[T.CRYSTAL]  = { solid: true, hp: 14, mat: 'host', ore: 'crystal', amt: 2 };
TD[T.HEART]    = { solid: true, hp: 36, mat: 'host', heart: true };
TD[T.BARRICADE] = { solid: true, hp: Infinity, mat: 'metal', built: true, playerUnbreakable: true };
TD[T.FOUNDATION] = { solid: true, hp: Infinity, mat: 'found', unbreakable: true };
// tehlikeler: altı boşalınca düşen gevşek kaya; kırılınca zehirli gaz salan cep
TD[T.LOOSE]    = { solid: true, hp: 2, mat: 'host', loose: true };
TD[T.GAS]      = { solid: true, hp: 3, mat: 'host', gas: true };
// kilitli kaya: ana kayadaki ceplerin kapağı; kazma işlemez, yalnız dinamit kırar
TD[T.VAULT]    = { solid: true, hp: Infinity, mat: 'vault', unbreakable: true, blastable: true };
// v4 biyom kayaları
TD[T.MOSS]     = { solid: true, hp: 2, mat: 'moss' };                                   // Kök Ormanı: yumuşak, yosunlu
TD[T.ICE]      = { solid: true, hp: 5, mat: 'ice', ore: 'water', amt: 1, iceDrop: true }; // Buz: kırılınca 1 su bırakır
TD[T.BONE]     = { solid: true, hp: 7, mat: 'bone' };                                   // Kemik Çukuru
TD[T.MAGMA]    = { solid: true, hp: 18, mat: 'magma' };                                 // Kor Katmanı
TD[T.EMBER]    = { solid: true, hp: 12, mat: 'magma', ember: true };                    // Kor taşı: parlar, kırılınca yakar
TD[T.OBSIDIAN] = { solid: true, hp: 40, mat: 'obsidian' };
TD[T.VOID]     = { solid: true, hp: 60, mat: 'void' };
TD[T.GOLD]     = { solid: true, hp: 6, mat: 'host', ore: 'gold', amt: 2 };
// yuva (kovan): uyanınca düşman çıkarır; kazma ve mermiyle yıkılır
TD[T.NEST]     = { solid: true, hp: 30, mat: 'host', nest: true };

export const isSolid = t => TD[t].solid;
export const isMineable = t => TD[t].solid && !TD[t].unbreakable && !TD[t].built;
// Biyomun ana kayası (cevher tile'larının etrafı ve arka duvar): 10 biyom
export const HOST_MAT = ['dirt', 'stone', 'moss', 'hard', 'ice', 'bone', 'magma', 'dense', 'obsidian', 'void'];
// Biyomun ana kaya tile'ı
export const HOST_TILE = [T.DIRT, T.STONE, T.MOSS, T.HARD, T.ICE, T.BONE, T.MAGMA, T.DENSE, T.OBSIDIAN, T.VOID];
