// 3B boss tanımları: tür -> { yüzey ölçüsü, malzemeler, pose(o), build(g, P) }
import { EJDER } from '../dragon3d.js';
import { BALROG3D } from './balrog.js';
import { BALROG2 } from './balrog2.js';
import { KORDESEN } from './kordesen.js';
import { AYNASIZ } from './aynasiz.js';
import { KARAKOK } from './karakok.js';
import { OTEGOZ } from './otegoz.js';
import { MADENKALBI } from './madenkalbi.js';
import { EZELI } from './ezeli.js';
import { KAVURGAN } from './kavurgan.js';
import { KEHRIBAR } from './kehribar.js';
import { POSEIDON3D } from './poseidon.js';
import { DEV3D } from './dev.js';
import { USTABASI3D } from './ustabasi.js';
import { SAGIR3D } from './sagiravci.js';
import { PASGOLEM3D } from './pasgolem.js';

// ?balrog=1: önceki Balrog modeli (karşılaştırma için şimdilik duruyor)
const OLD_BALROG = typeof location !== 'undefined' && /[?&]balrog=1/.test(location.search) || typeof process !== 'undefined' && process.env && process.env.BALROG === '1';

export const DEFS = { ejder: EJDER, balrog: OLD_BALROG ? BALROG3D : BALROG2, kordesen: KORDESEN, aynasiz: AYNASIZ, karakok: KARAKOK, otegoz: OTEGOZ, madenKalbi: MADENKALBI, ezeli: EZELI, kavurgan: KAVURGAN, kehribarAna: KEHRIBAR, poseidon: POSEIDON3D, dev: DEV3D, ustabasi: USTABASI3D, sagirAvci: SAGIR3D, pasGolem: PASGOLEM3D };
