// Tile tipleri ve özellikleri.
export const T = {
  AIR: 0, DIRT: 1, STONE: 2, HARD: 3, DENSE: 4, BEDROCK: 5,
  IRON: 6, WATER: 7, COBALT: 8, CRYSTAL: 9, CHEST: 10, HEART: 11, BARRICADE: 12, FOUNDATION: 13, LOOSE: 14, GAS: 15,
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

export const isSolid = t => TD[t].solid;
export const isMineable = t => TD[t].solid && !TD[t].unbreakable && !TD[t].built;
// Katmanın ana kayası (cevher tile'larının etrafı ve arka duvar)
export const HOST_MAT = ['dirt', 'stone', 'hard', 'dense'];
