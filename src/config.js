// Dünya ölçüleri ve sabitler. Tüm süreler saniye, tüm mesafeler dünya pikseli.
export const TILE = 16;
export const COLS = 17;              // 0-1 ve 15-16 ana kaya, 2..14 oynanabilir
export const PLAY_MIN_COL = 2;
export const PLAY_MAX_COL = 14;
export const SURF_ROWS = 6;          // 0..5 yüzey havası, 6 ilk toprak satırı
export const STRATUM_ROWS = 36;      // v4: her biyom 36 satır
export const STRATA_COUNT = 10;      // v4: 10 biyom, çekirdek ~360 m
export const GROUND_ROW = SURF_ROWS;
export const ROWS = SURF_ROWS + STRATUM_ROWS * STRATA_COUNT + 2; // + dip ana kaya
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
export const GROUND_Y = GROUND_ROW * TILE;
export const CENTER_COL = 8;

export const STEP = 1 / 60;          // sabit simülasyon adımı

export const BASE_X = CENTER_COL * TILE + TILE / 2;
export const BASE_Y = GROUND_Y - 14;
export const PLAYER_MIN_Y = 3 * TILE + 8;

// Yüzey inşa yuvaları (sütun)
export const PAD_COLS = [3, 5, 11, 13];
export const PAD_Y = GROUND_Y - 6;

export function stratumOfRow(r) {
  if (r < GROUND_ROW) return -1;
  return Math.max(0, Math.min(STRATA_COUNT - 1, Math.floor((r - GROUND_ROW) / STRATUM_ROWS)));
}
export function depthOfY(y) { return Math.max(0, Math.floor(y / TILE) - GROUND_ROW); }
