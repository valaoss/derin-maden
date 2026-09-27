// El çizimi pixel-art sprite'lar. Her karakter tek bir palet rengine karşılık gelir.
// Emissive karakterler ayrı bir katmana da basılır (karanlıkta parlayan gözler vb).
import { P, ORE_RAMP } from '../data/palette.js';

const BASE_PAL = {
  k: P.ink, y: P.helm, Y: P.helmL, o: P.helmD, t: P.suit, T: P.suitL, g: P.suitD,
  s: P.skin, S: P.skinD, w: P.lamp, b: P.boot, m: P.metal, M: P.metalD, h: P.wood, H: P.woodL,
  r: P.eye, W: '#ffffff', R: '#ec4a4a', G: '#5fe0b8', V: '#6a4a92',
};

export function makeSprite(rows, pal = {}, emissive = '') {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  let em = null, ex = null;
  if (emissive) { em = document.createElement('canvas'); em.width = w; em.height = h; ex = em.getContext('2d'); }
  const full = Object.assign({}, BASE_PAL, pal);
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x];
    if (ch === '.' || ch === ' ') continue;
    const col = full[ch]; if (!col) continue;
    cx.fillStyle = col; cx.fillRect(x, y, 1, 1);
    if (ex && emissive.includes(ch)) { ex.fillStyle = col; ex.fillRect(x, y, 1, 1); }
  }
  return { cv, em, w, h, flip: null, emFlip: null, white: null };
}

function flipCanvas(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c;
}
function whiteCanvas(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return c;
}
export function sprCanvas(s, flip, white) {
  if (white) { if (!s.white) s.white = whiteCanvas(s.cv); if (flip) { if (!s.whiteFlip) s.whiteFlip = flipCanvas(s.white); return s.whiteFlip; } return s.white; }
  if (!flip) return s.cv;
  if (!s.flip) s.flip = flipCanvas(s.cv);
  return s.flip;
}
export function sprEm(s, flip) {
  if (!s.em) return null;
  if (!flip) return s.em;
  if (!s.emFlip) s.emFlip = flipCanvas(s.em);
  return s.emFlip;
}

// ---------------- OYUNCU (sağa bakar) ----------------
const P_TOP = [
  '....kkkk....',
  '...kYYyyk...',
  '..kYyyyyykk.',
  '..kyyyyyykwk',
  '.kooooooookk',
  '..kSssssk...',
  '..kSssksk...',
  '.kMkSsssk...',
  'kMMktTTttk..',
  'kMMktTTtttk.',
  'kMMkttttgsk.',
  '.kkkgggggk..',
];
const L_IDLE = ['...ktgktgk..', '...kbbkbbk..', '....kk.kk...'];
const L_WA =   ['..ktgk.ktgk.', '..kbbk.kbbk.', '...kk...kk..'];
const L_WB =   ['....ktggk...', '....kbbbk...', '.....kkk....'];
const L_FLY =  ['...ktgktgk..', '...kbbkbbk..', '...k.kk.k...'];

export const SPR = {};

// ---------------- DÜŞMANLAR (sağa bakar) ----------------
const ROD_PAL = { f: '#6e4430', F: '#9c6a44', p: '#d8a27a', n: '#d88a8a' };
const ROD_A = [
  '......kkk....',
  '.....kFpFk...',
  '...kkkFFFkk..',
  '..kfFFFFFFFk.',
  '.kffFFFFFFrFk',
  'nkfffFFFFFFFk',
  'n.kffpppppWWk',
  '..kkfkkkkfkk.',
  '...kk....kk..',
];
const ROD_B = ROD_A.slice(0, 7).concat(['..kfkkkkkkfk.', '..kk......kk.']);

const BUG_PAL = { a: '#24472e', A: '#3f7a44', L: '#8ac470', u: '#16241c' };
const BUG_A = [
  '...kkkkkkk....',
  '..kLLAAAAAk...',
  '.kLAAAAAAAAkk.',
  'kLAAAAaAAAAkuk',
  'kAAAAAaAAAAkrk',
  'kaAAAAaAAAakuk',
  '.kaaaaaaaaakk.',
  '..kukukukuk...',
  '.k.k.k.k.k....',
];
const BUG_B = BUG_A.slice(0, 8).concat(['..k.k.k.k.k...']);

const SPIT_PAL = { v: '#4a2266', V: '#7a44a8', x: '#c890e8', z: '#9af060' };
const SPIT_A = [
  '....kkkk....',
  '...kxxVVk...',
  '..kxVVVVVk..',
  '..kVVVVrVVk.',
  '.kVVVVVVVkzk',
  '.kVVVVVVVVzk',
  'kvVVVVVVVVk.',
  'kvvVVVVVVvk.',
  'kvvvvvvvvvk.',
  '.kkkkkkkkk..',
];
const SPIT_B = [
  '............',
  '....kkkk....',
  '..kkxxVVkk..',
  '.kxVVVVrVVk.',
  '.kVVVVVVVkzk',
  'kVVVVVVVVVzk',
  'kvVVVVVVVVVk',
  'kvvvVVVVVvvk',
  'kvvvvvvvvvvk',
  '.kkkkkkkkkk.',
];

const BAT_PAL = { B: '#6a5490', X: '#3e2f5c' };
const BAT_A = [
  'kk..........kk',
  'kXk...kk...kXk',
  '.kXXkkBBkkXXk.',
  '..kXXBBBBXXk..',
  '...kkBrBrBk...',
  '....kBBBBk....',
  '.....kkkk.....',
];
const BAT_B = [
  '......kk......',
  '....kkBBkk....',
  '...kBBBBBBk...',
  '..kXkBrBrkXk..',
  '.kXXkBBBBkXXk.',
  'kXXk.kkkk.kXXk',
  'kk..........kk',
];

const BOOM_PAL = { c: '#4a1a60', C: '#e070ff', Q: '#ffd8ff' };
const BOOM_A = [
  '...Q..C.....',
  '..kCk.kCk...',
  '..kCCkCCk.Q.',
  '.kkcCkCckkCk',
  'kcccccccccCk',
  'kccccccccrck',
  'kcccccccccck',
  '.kkccccccck.',
  '..kk.kk.kk..',
];
const BOOM_B = BOOM_A.slice(0, 8).concat(['...kk.kk.kk.']);

const BRUTE_PAL = { q: '#3e3434', Q: '#5e5252', U: '#8a7c78' };
const BRUTE_A = [
  '......kkkkk.......',
  '....kkUUQQQkk.....',
  '...kUQQQQQQQQk....',
  '..kUQQQQQQrQQQk...',
  '..kQQQQqQQQQQQk...',
  '.kkQQQqQQQQQQQkk..',
  'kUUkQQQQQQQQQkUUk.',
  'kQQkqQQQrQQQqkQQk.',
  'kQqkqQQQQrQQqkQqk.',
  'kqqkqqQQQQQqqkqqk.',
  '.kk.kqqqqqqqqk.kk.',
  '....kqqqkqqqqk....',
  '....kqqk.kqqk.....',
  '...kqqqk.kqqqk....',
  '...kkkkk.kkkkk....',
];
const BRUTE_B = BRUTE_A.slice(0, 11).concat([
  '....kqqqqkqqqk....',
  '.....kqqk.kqqk....',
  '....kqqqk.kqqqk...',
  '....kkkkk.kkkkk...',
]);

const BOSS_PAL = { a: '#5a1632', A: '#8e2a48', U: '#c24a64', m: '#1a0610', W: '#f5ecd8' };
const BOSS_A = [
  '.......kkkkkkkkkk.......',
  '.....kkUUAAAAAAAAkk.....',
  '....kUAAaaaaaaaaaAAk....',
  '...kUAaaarraaaarraaAk...',
  '..kUAaaaarraaaarraaaAk..',
  '..kAaaaaaaaaaaaaaaaaaAk.',
  '.kAaarraaaaaaaaaaarraaAk',
  '.kAaarraakkkkkkkkaarraak',
  '.kAaaaaakWmWmWmWmkaaaaak',
  'kAaaaaakmmmmmmmmmmkaaaak',
  'kAaaaaakmmmmmmmmmmkaaaak',
  'kAaaaaakWmWmWmWmWkaaaaak',
  '.kAaaaaakkkkkkkkkaaaaak.',
  '.kAAaaaaaaaaaaaaaaaaAk..',
  '..kkAAaaaaaaaaaaaAAkk...',
  '.kaakkAAAAAAAAAAAkkaak..',
  'kaak..kkkkkkkkkkk..kaak.',
  'kkk.................kkk.',
];
const BOSS_B = BOSS_A.slice(0, 15).concat([
  '..kaakAAAAAAAAAAAkaak...',
  '.kaak.kkkkkkkkkkk.kaak..',
  '.kkk...............kkk..',
]);

// ---------------- DÜNYA OBJELERİ ----------------
const CHEST = [
  '..kkkkkkkk..',
  '.kHHHHHHHHk.',
  'kHhhhhhhhhHk',
  'kmmmmmmmmmmk',
  'khhhhGGhhhhk',
  'khhhhGkhhhhk',
  'kHhhhhhhhhHk',
  'kmmmmmmmmmmk',
  'kHhhhhhhhhHk',
  '.kkkkkkkkkk.',
];
const HEART = [
  '.....kk.....',
  '....kXZk....',
  '...kXXZxk...',
  '...kXZxxk...',
  '..kXXZxxxk..',
  '..kXZxxxxk..',
  '.kXXZxxxxzk.',
  '.kXZxxxxxzk.',
  '.kXZxxxxzzk.',
  '..kXxxxxzk..',
  '..kXxxxzzk..',
  '...kxxxzk...',
  '...kxxzzk...',
  '....kxzk....',
  '.....kk.....',
];
const SATCHEL = [
  '..kkkk..',
  '.kk..kk.',
  'kkkkkkkk',
  'kHHHHHHk',
  'kHhGGhHk',
  'kHhhhhHk',
  '.khhhhk.',
  '..kkkk..',
];

const WORM_PAL = { p: '#7a3a56', P: '#c07890', Q: '#e8a8c0' };
const WORM_HEAD_A = [
  '...kkkkk...',
  '..kpPPPPk..',
  '.kpPPQPPPk.',
  'kpPPPPPrPkk',
  'kpPPPPPPkWk',
  'kpPPPPPPPk.',
  'kpPPPPPPkWk',
  '.kpPPPPPPkk',
  '..kppppPk..',
  '...kkkkk...',
];
const WORM_HEAD_B = WORM_HEAD_A.slice(0, 4).concat(['kpPPPPPPPkW', 'kpPPPPPPPk.', 'kpPPPPPPPkW']).concat(WORM_HEAD_A.slice(7));
const WORM_SEG = [
  '..kkkkk..',
  '.kPPQPPk.',
  'kpPQPPPPk',
  'kpPPPPPPk',
  'kpPPPPPPk',
  'kppPPPPPk',
  'kpppppppk',
  '.kpppppk.',
  '..kkkkk..',
];
const FIRE_PAL = { O: '#ff9a4a', F: '#e0502a', Y: '#ffe79a' };
const TORCH_A = ['..Y...', '.YOY..', '.OFO..', '..F...', '.kmk..', '.kMk..', '..h...', '..h...', '..h...', '.kk...'];
const TORCH_B = ['......', '..Y...', '.YOO..', '.OFO..', '.kmk..', '.kMk..', '..h...', '..h...', '..h...', '.kk...'];
const DYN = ['..Y..', '..k..', '.kkk.', 'kRRRk', 'kRWRk', 'kRRRk', 'kmmmk', 'kRRRk', '.kkk.'];
const MINE_W = ['...kRk...', '.kkmmmkk.', 'kmMMMMMmk', 'kkkkkkkkk'];

// ---------------- İKONLAR (UI, 10x10) ----------------
const ICONS = {
  heart: [
    '.kk...kk..', 'kRRk.kRRk.', 'kRWRkRRRk.', 'kRRRRRRRk.', 'kRRRRRRRk.',
    '.kRRRRRk..', '..kRRRk...', '...kRk....', '....k.....', '..........'],
  base: [
    '....kk....', '...kmmk...', '..kmmmmk..', '..kmwwmk..', '.kkmmmmkk.',
    '.kMMMMMMk.', '.kMmmmmMk.', '.kMmkkmMk.', '.kMmkkmMk.', '.kkkkkkkk.'],
  bag: [
    '...kkkk...', '..kk..kk..', '.kkkkkkkk.', 'kHHHHHHHHk', 'kHhhhhhhHk',
    'kHhkGGkhHk', 'kHhhhhhhHk', 'kHhhhhhhHk', '.khhhhhhk.', '..kkkkkk..'],
  drill: [
    '..kkkkk...', '.kmmmmmk..', 'kmMk.kmmk.', 'kMk..khmk.', 'kk..khk.k.',
    '...khk....', '..khk.....', '.khk......', 'khk.......', 'kk........'],
  blaster: [
    '..........', '..........', '.kkkkkkkk.', 'kmmmmmmmmk', 'kMMMMkkkk.',
    'kMhhk.....', 'kMhhk.....', '.khhk.....', '..kk......', '..........'],
  armor: [
    'kkkkkkkkk.', 'ktTTTTTtk.', 'ktTTTTTtk.', 'ktttttttk.', 'ktttgtttk.',
    '.kttgttk..', '.ktttttk..', '..kttgk...', '...kgk....', '....k.....'],
  lamp: [
    '....kk....', '..kkwwkk..', '.kwwwwwwk.', '.kwwWwwwk.', '.kwwwwwwk.',
    '..kwwwwk..', '...kmmk...', '...kMMk...', '...kmmk...', '....kk....'],
  turret: [
    '..........', '...kkkk...', '..kmmmmkkk', '..kmMMmmmk', '..kmmmmkkk',
    '...kkkk...', '...kMMk...', '..kMkkMk..', '.kMk..kMk.', '.kk....kk.'],
  heal: [
    '...kkkk...', '...kGGk...', '...kGGk...', 'kkkkGGkkkk', 'kGGGGGGGGk',
    'kGGGGGGGGk', 'kkkkGGkkkk', '...kGGk...', '...kGGk...', '...kkkk...'],
  barricade: [
    'kk......kk', 'kMkkkkkkMk', 'kMhHHHHhMk', 'kMkkkkkkMk', 'kMhHHHHhMk',
    'kMkkkkkkMk', 'kMhHHHHhMk', 'kMkkkkkkMk', 'kMk....kMk', 'kk......kk'],
  magnet: [
    'kkkk..kkkk', 'kWWk..kWWk', 'kRRk..kRRk', 'kRRk..kRRk', 'kRRkkkkRRk',
    'kRRRRRRRRk', '.kRRRRRRk.', '..kkkkkk..', '..........', '..........'],
  chain: [
    '..........', '.kkkk.....', 'kmMMmk....', 'kMkkkkkk..', 'kmMkmMMmk.',
    '.kkkMkkMk.', '...kmMMmkk', '....kkkkMk', '......kmMk', '.......kk.'],
  gem: [
    '....k.....', '...kWk.k..', '...kCkkCk.', '..kkCVkkCk', '.kWkVVVkVk',
    '.kCVVVkkk.', '.kVVVkk...', '..kVkk....', '...kk.....', '..........'],
  pierce: [
    '......kk..', '.....kWWk.', '....kWWWk.', '...kWWWk..', 'kk.kWWk...',
    'kGkkWk....', '.kGGk.....', '..kGGk....', '...kkGk...', '......k...'],
  boot: [
    '..kkkk....', '..kHHk....', '..kHHk....', '..kHHk....', '..kHHkkk..',
    '..kHHHHHk.', '.kHHHHHHHk', '.kbbbbbbbk', '.kkkkkkkkk', '..........'],
  shock: [
    '....kkkk..', '...kYYYk..', '..kYYYk...', '.kYYYkkk..', 'kYYYYYYk..',
    'kkkYYYk...', '..kYYk....', '.kYYk.....', '.kYk......', '.kk.......'],
  chest: [
    '..........', '.kkkkkkkk.', 'kHHHHHHHHk', 'kmmmmmmmmk', 'khhhGGhhhk',
    'khhhGkhhhk', 'kmmmmmmmmk', 'kHhhhhhhHk', '.kkkkkkkk.', '..........'],
  oz: [
    '....k.....', '...kGk....', '..kGWGk...', 'kkGWWWGkk.', 'kGWWWWWGk.',
    'kkGWWWGkk.', '..kGWGk...', '...kGk....', '....k.....', '..........'],
  wave: [
    '..kkkkkk..', '.kVVVVVVk.', 'kVVVVVVVVk', 'kVrrVVrrVk', 'kVrrVVrrVk',
    'kVVVVVVVVk', '.kVkVVkVk.', '.kVkkkkVk.', '..kk..kk..', '..........'],
  depth: [
    '...kkkk...', '...kWWk...', '...kWWk...', '...kWWk...', 'kkkkWWkkkk',
    '.kWWWWWWk.', '..kWWWWk..', '...kWWk...', '....kk....', '..........'],
  pause: [
    '..........', '.kkk.kkk..', '.kWk.kWk..', '.kWk.kWk..', '.kWk.kWk..',
    '.kWk.kWk..', '.kWk.kWk..', '.kkk.kkk..', '..........', '..........'],
  skull: [
    '..kkkkkk..', '.kWWWWWWk.', 'kWWWWWWWWk', 'kWkkWWkkWk', 'kWkkWWkkWk',
    'kWWWkkWWWk', '.kWWWWWWk.', '..kWkWkWk.', '..kkkkkkk.', '..........'],
  torch: [
    '.....Y....', '....YOY...', '...YOFOY..', '...OFFFO..', '....OFO...',
    '...kmmmk..', '....khk...', '....khk...', '....khk...', '....kkk...'],
  dynamite: [
    '.......Y..', '......YO..', '.....k....', '..kkkkk...', '.kRRRRRk..',
    '.kRWRRRk..', '.kRRRRRk..', '.kmmmmmk..', '.kRRRRRk..', '..kkkkk...'],
  medkit: [
    '..kkkkkk..', '.kWWWWWWk.', 'kWWWRRWWWk', 'kWWWRRWWWk', 'kWRRRRRRWk',
    'kWRRRRRRWk', 'kWWWRRWWWk', 'kWWWRRWWWk', '.kWWWWWWk.', '..kkkkkk..'],
  mine: [
    '..........', '..........', '....RR....', '....kk....', '..kkkkkk..',
    '.kmmmmmmk.', 'kmMMMMMMmk', 'kMMMMMMMMk', '.kkkkkkkk.', '..........'],
  recall: [
    '....kk....', '...kIIk...', '..kIIIIk..', '.kIIIIIIk.', 'kkkkIIkkkk',
    '...kIIk...', '...kDDk...', '...kDDk...', '..kDDDDk..', '..kkkkkk..'],
  flame: [
    '....Y.....', '...YOY....', '..YOOOY.Y.', '..OFFOOYO.', '.OFFFFOOO.',
    '.OFFFFFFO.', '.kkkkkkkk.', '.kmmmmmmk.', '.kMMMMMMk.', '.kkkkkkkk.'],
  frost: [
    '....I.....', '.I..I..I..', '..I.I.I...', '...III....', 'IIIIWIIII.',
    '...III....', '..I.I.I...', '.I..I..I..', '....I.....', '..........'],
  mortar: [
    '......kkk.', '.....kmmmk', '....kmMMk.', '...kmMMk..', '..kmMMk...',
    '.kkMMkk...', 'kMMMMMMk..', 'kMmmmmMk..', 'kkkkkkkk..', '..........'],
  schematic: [
    'kkkkkkkk..', 'kDDDDDDk..', 'kDIDDIDkk.', 'kDIIIIDkDk', 'kDDIDDDkDk',
    'kDIIIIDkDk', 'kDDDDDDkDk', 'kkkkkkkkDk', '.kDDDDDDDk', '.kkkkkkkkk'],
  contract: [
    '.kkkkkkk..', 'kHHHHHHHk.', '.khhhhhhk.', '.khkkkkhk.', '.khhhhhhk.',
    '.khkkkhhk.', '.khhhhhhk.', '.khkkkkhk.', 'kHHHHHHHk.', '.kkkkkkk..'],
  daily: [
    '.k....k...', 'kkkkkkkkk.', 'kRRRRRRRk.', 'kkkkkkkkk.', 'kWWWWWWWk.',
    'kWkWkWkWk.', 'kWWWWWWWk.', 'kWkWkWWWk.', 'kWWWWWWWk.', 'kkkkkkkkk.'],
  kademe: [
    '..kkkkkk..', '.kRRRRRRk.', 'kRRRRRRRRk', 'kRkkRRkkRk', 'kRkkRRkkRk',
    'kRRRkkRRRk', '.kRRRRRRk.', '..kRkRkRk.', '..kkkkkkk.', '..........'],
  check: [
    '..........', '........kk', '.......kGk', '......kGk.', 'kk...kGk..',
    'kGk.kGk...', '.kGkGk....', '..kGk.....', '...k......', '..........'],
  hand: [
    '...kk.......', '..kWWk......', '..kWWk......', '..kWWkkkk...', '..kWWkWWkkk.',
    'kkkWWkWWkWWk', 'kWWWWWWWWWWk', 'kWWWWWWWWWWk', '.kWWWWWWWWk.', '..kWWWWWWWk.',
    '...kWWWWWk..', '...kkkkkkk..'],
};
const ORE_ICON_SHAPES = {
  iron: ['..........', '...kkkk...', '..kcddck..', '.kccdcbbk.', 'kcccbbbbak',
    'kbcbbbbaak', 'kbbbbaaak.', '.kkaaakk..', '...kkk....', '..........'],
  water: ['....kk....', '...kdck...', '...kcck...', '..kcdcbk..', '.kcdccbbk.',
    '.kcdcbbbk.', '.kcccbbak.', '..kbbbak..', '...kkkk...', '..........'],
  cobalt: ['....kk....', '...kdck...', '..kdccbk..', '..kdcbbk..', '..kccbak..',
    '..kcbbak..', '..kcbaak..', '...kbak...', '....kk....', '..........'],
  crystal: ['....k.....', '...kdk.k..', '...kdkkck.', '..kkdcbkck', '.kdkcbbkbk',
    '.kdcbbakak', '.kcbbaak..', '..kbaak...', '...kkk....', '..........'],
};

const iconCache = {};
export function iconURL(name, scale = 1) {
  const key = name + '@' + scale;
  if (iconCache[key]) return iconCache[key];
  let s;
  if (ORE_ICON_SHAPES[name]) {
    const r = ORE_RAMP[name];
    s = makeSprite(ORE_ICON_SHAPES[name], { a: r[0], b: r[1], c: r[2], d: r[3] });
  } else s = makeSprite(ICONS[name] || ICONS.gem, { C: '#e070ff', V: '#9030c8', Y: P.helm, O: '#ff9a4a', F: '#e0502a', I: '#bff4ff', D: '#3a7ac8' });
  let cv = s.cv;
  if (scale > 1) {
    cv = document.createElement('canvas'); cv.width = s.w * scale; cv.height = s.h * scale;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s.cv, 0, 0, cv.width, cv.height);
  }
  return (iconCache[key] = cv.toDataURL());
}

export function buildSprites() {
  const pTop = P_TOP;
  const mk = legs => makeSprite(pTop.concat(legs), {}, 'w');
  SPR.player = { idle: mk(L_IDLE), wa: mk(L_WA), wb: mk(L_WB), fly: mk(L_FLY) };
  SPR.rodent = [makeSprite(ROD_A, ROD_PAL, 'r'), makeSprite(ROD_B, ROD_PAL, 'r')];
  SPR.bug = [makeSprite(BUG_A, BUG_PAL, 'r'), makeSprite(BUG_B, BUG_PAL, 'r')];
  SPR.spitter = [makeSprite(SPIT_A, SPIT_PAL, 'rz'), makeSprite(SPIT_B, SPIT_PAL, 'rz')];
  SPR.flyer = [makeSprite(BAT_A, BAT_PAL, 'r'), makeSprite(BAT_B, BAT_PAL, 'r')];
  SPR.boomer = [makeSprite(BOOM_A, BOOM_PAL, 'rCQ'), makeSprite(BOOM_B, BOOM_PAL, 'rCQ')];
  SPR.brute = [makeSprite(BRUTE_A, BRUTE_PAL, 'r'), makeSprite(BRUTE_B, BRUTE_PAL, 'r')];
  SPR.boss = [makeSprite(BOSS_A, BOSS_PAL, 'r'), makeSprite(BOSS_B, BOSS_PAL, 'r')];
  SPR.chest = makeSprite(CHEST, { G: '#ffd24a' }, 'G');
  SPR.heart = makeSprite(HEART, { x: '#ff3a6a', X: '#ff8aa8', Z: '#ffffff', z: '#a01a40' }, 'xXZz');
  SPR.satchel = makeSprite(SATCHEL, { G: '#ffd24a' }, 'G');
  SPR.worm = [makeSprite(WORM_HEAD_A, WORM_PAL, 'r'), makeSprite(WORM_HEAD_B, WORM_PAL, 'r')];
  SPR.wormSeg = makeSprite(WORM_SEG, WORM_PAL);
  SPR.torch = [makeSprite(TORCH_A, FIRE_PAL, 'YOF'), makeSprite(TORCH_B, FIRE_PAL, 'YOF')];
  SPR.dynamite = makeSprite(DYN, {}, 'Y');
  SPR.mine = makeSprite(MINE_W, {}, 'R');
  SPR.loose = buildLoose();
  SPR.cracks = buildCracks();
  SPR.base = buildBase();
  SPR.glow = {};
}

// Gevşek kaya: yatay kırık levha + alt kenarda asılı çakıllar (sabit desen, okunur)
function buildLoose() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const x = c.getContext('2d');
  const D = 'rgba(10,6,14,0.8)', L = 'rgba(255,240,220,0.22)';
  const px = (col, a, b, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  // iki yatay fay çizgisi (hafif zikzak)
  const f1 = [5, 5, 6, 6, 6, 5, 5, 4, 4, 5, 5, 6, 6, 5, 5, 5], f2 = [11, 11, 10, 10, 11, 11, 12, 12, 11, 11, 10, 10, 11, 11, 12, 12];
  for (let i = 1; i < 15; i++) { px(D, i, f1[i]); px(L, i, f1[i] + 1); if (i % 5) { px(D, i, f2[i]); px(L, i, f2[i] + 1); } }
  // dikey kısa kırıklar
  px(D, 4, 7, 1, 3); px(D, 10, 2, 1, 3); px(D, 12, 7, 1, 3); px(D, 7, 13, 1, 2);
  // alt kenar çakılları
  px(D, 3, 15, 2, 1); px(D, 9, 15, 3, 1); px(L, 3, 14, 2, 1); px(L, 9, 14, 3, 1);
  return c;
}

// Kazı çatlakları: 3 aşama, deterministik
function buildCracks() {
  const out = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts = [];
  for (let stage = 0; stage < 5; stage++) {
    const branches = [1, 2, 4, 6, 9][stage];
    while (pts.length < branches) {
      let x = 8, y = 8; const path = [];
      const ang = rnd() * Math.PI * 2, len = 4 + rnd() * 5;
      for (let i = 0; i < len; i++) {
        x += Math.cos(ang + (rnd() - 0.5) * 1.2); y += Math.sin(ang + (rnd() - 0.5) * 1.2);
        path.push([Math.round(x), Math.round(y)]);
      }
      pts.push(path);
    }
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const x = c.getContext('2d');
    for (const path of pts) for (const [px, py] of path) {
      if (px < 1 || py < 1 || px > 14 || py > 14) continue;
      x.fillStyle = 'rgba(10,6,14,0.85)'; x.fillRect(px, py, 1, 1);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(px + 1, py + 1, 1, 1);
    }
    out.push(c);
  }
  return out;
}

// Üs: maden kulesi (headframe) + kabin. 56x52, alt kenarı zemine oturur.
function buildBase() {
  const W = 56, H = 52;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const em = document.createElement('canvas'); em.width = W; em.height = H;
  const e = em.getContext('2d');
  const R = (col, px, py, w, h, ctx = x) => { ctx.fillStyle = col; ctx.fillRect(px, py, w, h); };
  const K = P.ink;
  // kule ayakları (A-çerçeve)
  const leg = (x0, y0, x1, y1, col) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) { const px = Math.round(x0 + (x1 - x0) * i / n), py = Math.round(y0 + (y1 - y0) * i / n);
      R(K, px - 1, py, 3, 1); R(col, px, py, 1, 1); }
  };
  leg(16, 44, 26, 6, '#8a6a5a'); leg(40, 44, 30, 6, '#8a6a5a');
  for (let yy = 16; yy < 44; yy += 9) { const t = (yy - 6) / 38; const a = Math.round(26 - 10 * t), b = Math.round(30 + 10 * t); R(K, a, yy - 1, b - a + 1, 3); R('#6a4e44', a + 1, yy, b - a - 1, 1); }
  // tekerlek
  x.fillStyle = K; x.beginPath(); x.arc(28, 8, 6.5, 0, 7); x.fill();
  x.fillStyle = '#a7b0c4'; x.beginPath(); x.arc(28, 8, 5, 0, 7); x.fill();
  x.fillStyle = K; x.beginPath(); x.arc(28, 8, 3.5, 0, 7); x.fill();
  R('#5a6278', 27, 3, 2, 10); R('#5a6278', 23, 7, 10, 2); R('#dfe6f0', 27, 7, 2, 2);
  // kablo
  R('#2a2230', 33, 8, 1, 30);
  // kabin
  R(K, 4, 28, 48, 24); R('#4a5a78', 5, 29, 46, 22); R('#5e7090', 5, 29, 46, 2);
  for (let px = 8; px < 50; px += 8) R('#3a4862', px, 31, 1, 20);
  // çatı
  R(K, 2, 24, 52, 5); R('#b8543a', 3, 25, 50, 3); R('#e07a4a', 3, 25, 50, 1);
  // pencereler (emissive)
  for (const wx of [9, 38]) { R(K, wx - 1, 33, 10, 8); R('#ffd48a', wx, 34, 8, 6); R('#fff0c0', wx, 34, 8, 2); R(K, wx + 3, 34, 1, 6);
    R('#ffd48a', wx, 34, 8, 6, e); }
  // kapı + şaft ağzı
  R(K, 22, 36, 12, 16); R('#1a1422', 23, 37, 10, 15); R('#2a2233', 23, 37, 10, 2);
  // perçinler
  for (let px = 6; px < 52; px += 6) R('#8a9ab8', px, 49, 1, 1);
  // anten + ışık
  R(K, 48, 12, 3, 13); R('#a7b0c4', 49, 13, 1, 11);
  R(K, 47, 9, 5, 4); R('#5fe0b8', 48, 10, 3, 2); R('#5fe0b8', 48, 10, 3, 2, e);
  // bayrak
  R(K, 8, 10, 1, 15); R('#f2c14e', 9, 10, 8, 5); R('#a8701e', 9, 14, 8, 1);
  return { cv: c, em, w: W, h: H };
}

// yumuşak ışık halesi (additive), renge göre önbellekli
export function glowSprite(color, r) {
  const key = color + r;
  if (SPR.glow[key]) return SPR.glow[key];
  const c = document.createElement('canvas'); c.width = c.height = r * 2;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
  return (SPR.glow[key] = c);
}
