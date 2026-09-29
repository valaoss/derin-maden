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
const L_WC =   ['..ktgk.ktgk.', '..kbbkkbbk..', '...kk..kk...'];   // yürüyüş: adım ortası
const L_CROUCH = ['..ktggktggk.', '..kbbbkbbbk.', '...kk...kk..']; // çömelme (aşağı kazarken)
// partner paleti: turuncu tulum, turkuaz kask
const P2_PAL = { y: '#5fe0b8', Y: '#a8f5dc', o: '#2a8a70', t: '#e07a4a', T: '#ffb080', g: '#8a3a1a' };
// Kask/tulum renkleri: oyuncu seçer (ayarlar), ortak seferde iki taraf da görür
export const HELMETS = [
  { name: 'Sarı',    c: '#f2c14e', pal: {} },
  { name: 'Turkuaz', c: '#5fe0b8', pal: P2_PAL },
  { name: 'Kırmızı', c: '#ec4a4a', pal: { y: '#ec4a4a', Y: '#ff9a8a', o: '#8a1e28', t: '#3a3a5a', T: '#6a6a8a', g: '#1a1a2a' } },
  { name: 'Mor',     c: '#c070ff', pal: { y: '#c070ff', Y: '#e8b0ff', o: '#6a2a9a', t: '#2fb39a', T: '#6fd8c0', g: '#1a6a5a' } },
  { name: 'Turuncu', c: '#ff8a3a', pal: { y: '#ff8a3a', Y: '#ffc08a', o: '#a04a10', t: '#4a6aa0', T: '#8aa0d0', g: '#2a3a60' } },
  { name: 'Beyaz',   c: '#f5ecd8', pal: { y: '#f5ecd8', Y: '#ffffff', o: '#a497b4', t: '#8a3a5a', T: '#c07a9a', g: '#4a1a30' } },
];
export function playerSprites(helm) { return SPR.playerSets[(helm | 0) % SPR.playerSets.length] || SPR.player; }

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

// Karakök: yosun taçlı kök düğümü; çekik kehribar gözler, çatlak kor ağız, kök pençeler
const KARAKOK_PAL = { q: '#2a1a12', Q: '#5e3c24', U: '#8e6238', n: '#3a6428', N: '#78b43c', e: '#ff9a2a', E: '#fff0a0', o: '#ff7a1a', O: '#ffd060' };
const KARAKOK_A = [
  '.........kk.....kk.........',
  '........kNNk...kNNk........',
  '....kk..kNnk.k.knNk..kk....',
  '...kNNk.knk.kNk.knk.kNNk...',
  '....knkkkkkkknkkkkkkknk....',
  '...kkNnnQQnnnNnnnQQnnNkk...',
  '..kQQnNQQUQQnNnQQUQQNnQQk..',
  '..kQUQQQQUUQQQQQUUQQQQUQk..',
  '.kQUQQkkQQQQQQQQQQQkkQQUQk.',
  '.kQUQQkeEkkQQqQQkkEekQQUQk.',
  '.kQQQQkeeEEkqkqkEEeekQQQQk.',
  '.kQUQQQkkkkQqQqQkkkkQQQUQk.',
  'kQQQqQQQQQQQkkkQQQQQQQqQQQk',
  'kQUQQqQQQQQkoOokQQQQQqQQUQk',
  'kQQQQqqQQQkoOOOokQQQqqQQQQk',
  'kqQQQQqQQQQkoOokQQQQqQQQQqk',
  '.kqQQQQQQqQQkkkQQqQQQQQQqk.',
  '.kkqqQQQqqqQQQQQqqqQQQqqkk.',
  'kQkkkqqqkkkqqqqqkkkqqqkkkQk',
  'QQk.kQQk.kQQkkkQQk.kQQk.kQQ',
  'kk..kQk..kQQk.kQQk..kQk..kk',
  '....kk...kkk...kkk...kk....',
];
const KARAKOK_B = [
  '.........kk.....kk.........',
  '........kNNk...kNNk........',
  '....kk..kNnk.k.knNk..kk....',
  '...kNNk.knk.kNk.knk.kNNk...',
  '....knkkkkkkknkkkkkkknk....',
  '...kkNnnQQnnnNnnnQQnnNkk...',
  '..kQQnNQQUQQnNnQQUQQNnQQk..',
  '..kQUQQQQUUQQQQQUUQQQQUQk..',
  '.kQUQQkkQQQQQQQQQQQkkQQUQk.',
  '.kQUQQkeEkkQQqQQkkEekQQUQk.',
  '.kQQQQkeeEEkqkqkEEeekQQQQk.',
  '.kQUQQQkkkkQqQqQkkkkQQQUQk.',
  'kQQQqQQQQQQQkkkQQQQQQQqQQQk',
  'kQUQQqQQQQQkoOokQQQQQqQQUQk',
  'kQQQQqqQQQkoOOOokQQQqqQQQQk',
  'kqQQQQqQQQQkoOokQQQQqQQQQqk',
  '.kqQQQQQQqQQkkkQQqQQQQQQqk.',
  '.kkqqQQQqqqQQQQQqqqQQQqqkk.',
  'kQkkkqqqkkkqqqqqkkkqqqkkkQk',
  'kQkkkQQk.kQQkkkQQk.kQQkkkQk',
  '.kkQkQk...kQk.kQk...kQkQkk.',
  '...kk......kk.kk......kk...',
];
// Kavurgan: boynuzlu kemik kafatası, alev gözler, kor dolu kaburga
const KAVURGAN_PAL = { B: '#e8dcc0', b: '#a8987a', c: '#2a1410', f: '#ff6a1a', F: '#ffd060' };
const KAVURGAN_A = [
  '.kk.....................kk.',
  'kBk.....................kBk',
  'kBBk...................kBBk',
  '.kBBk.................kBBk.',
  '..kBBk..kkkkkkkkkkk..kBBk..',
  '..kbBBkkBBBBBBBBBBBkkBBbk..',
  '...kbBBBBbbBBBBBbbBBBBbk...',
  '....kBBbkkkbBBBbkkkbBBk....',
  '....kBbkFFfkbBbkfFFkbBk....',
  '....kBbkfFFkbBbkFFfkbBk....',
  '.....kBbkkkbBBBbkkkbBk.....',
  '.....kBBBBBBBkBBBBBBBk.....',
  '......kBkBkBkBkBkBkBk......',
  '......kkfFFFFFFFFFfkk......',
  '......kBkBkBkBkBkBkBk......',
  '.......kbbbbbbbbbbbk.......',
  '....kkkkkkkkkkkkkkkkkkk....',
  '...kBkcfckBkcfckBkcfckBk...',
  '..kBkcfFckBkfFfkBkcFfckBk..',
  '..kBkcffckBkcfckBkcffckBk..',
  '..kbkkckkkbkkckkbkkkckkbk..',
  '.kBk..kBk..kBkBk..kBk..kBk.',
  'kBBk..kBk..kkkkk..kBk..kBBk',
  'kkk...kkk.........kkk...kkk',
];
const KAVURGAN_B = [
  '.kk.....................kk.',
  'kBk.....................kBk',
  'kBBk...................kBBk',
  '.kBBk.................kBBk.',
  '..kBBk..kkkkkkkkkkk..kBBk..',
  '..kbBBkkBBBBBBBBBBBkkBBbk..',
  '...kbBBBBbbBBBBBbbBBBBbk...',
  '....kBBbkkkbBBBbkkkbBBk....',
  '....kBbkfFFkbBbkFFfkbBk....',
  '....kBbkFFfkbBbkfFFkbBk....',
  '.....kBbkkkbBBBbkkkbBk.....',
  '.....kBBBBBBBkBBBBBBBk.....',
  '......kBkBkBkBkBkBkBk......',
  '......kkFFfFFFFFfFFkk......',
  '......kBkBkBkBkBkBkBk......',
  '.......kbbbbbbbbbbbk.......',
  '....kkkkkkkkkkkkkkkkkkk....',
  '...kBkcfckBkcfckBkcfckBk...',
  '..kBkcfFckBkfFfkBkcFfckBk..',
  '..kBkcffckBkcfckBkcffckBk..',
  '..kbkkckkkbkkckkbkkkckkbk..',
  '..kBk.kBk..kBkBk..kBk.kBk..',
  '.kBBk.kBBk.kkkkk.kBBk.kBBk.',
  '.kkk..kkkk.......kkkk..kkk.',
];
// Ötegöz: dev göz, dikey yarık bebek, et kapaklar, ucu parlayan dokunaçlar
const OTEGOZ_PAL = { v: '#3a2460', V: '#6a4a9a', L: '#9a7ac8', w: '#e8e0f0', i: '#7a6aff', I: '#c0b8ff', p: '#0a0414', x: '#d080ff' };
const OTEGOZ_A = [
  '.........kkkkkkkkk.........',
  '......kkkVVVVVVVVVkkk......',
  '.....kVVLLLLLLLLLLLVVk.....',
  '....kVLLVVVVVVVVVVVLLVk....',
  '...kVLVkkkkkkkkkkkkkVLVk...',
  '...kVVkwwwwwwwwwwwwwkVVk...',
  '..kVVkwwwiiiiiiiiiwwwkVVk..',
  '..kVkwwiiIIIIIIIIIiiwwkVk..',
  '.kVVkwiiIIiiiiiiiIIiiwkVVk.',
  '.kVkwwiIIiiiipiiiiIIiwwkVk.',
  '.kVkwwiIiiiipppiiiiIiwwkVk.',
  '.kVkwwiIiiiipppiiiiIiwwkVk.',
  '.kVkwwiiiiiipppiiiiiiwwkVk.',
  '.kVVkwwiiiiiipiiiiiiwwkVVk.',
  '..kVkwwwiiiiiiiiiiiwwwkVk..',
  '..kVVkwwwwwwwwwwwwwwwkVVk..',
  '...kVVkkkkkkkkkkkkkkkVVk...',
  '...kvVVVVvVVVVVVVvVVVVvk...',
  '....kvvVvkvVvkvVvkvVvvk....',
  '....kVk.kVk.kVk.kVk.kVk....',
  '...kVk..kVk.kVk.kVk..kVk...',
  '...kvk...kVkkVkkVk...kvk...',
  '...kxk...kxk.x.kxk...kxk...',
  '....k.....k..k..k.....k....',
];
const OTEGOZ_B = [
  '.........kkkkkkkkk.........',
  '......kkkVVVVVVVVVkkk......',
  '.....kVVLLLLLLLLLLLVVk.....',
  '....kVLLVVVVVVVVVVVLLVk....',
  '...kVLVkkkkkkkkkkkkkVLVk...',
  '...kVVkwwwwwwwwwwwwwkVVk...',
  '..kVVkwwwiiiiiiiiiwwwkVVk..',
  '..kVkwwiiIIIIIIIIIiiwwkVk..',
  '.kVVkwiiIIiiiiiiiIIiiwkVVk.',
  '.kVkwwiIIiiiipiiiiIIiwwkVk.',
  '.kVkwwiIiiiipppiiiiIiwwkVk.',
  '.kVkwwiIiiiipppiiiiIiwwkVk.',
  '.kVkwwiiiiiipppiiiiiiwwkVk.',
  '.kVVkwwiiiiiipiiiiiiwwkVVk.',
  '..kVkwwwiiiiiiiiiiiwwwkVk..',
  '..kVVkwwwwwwwwwwwwwwwkVVk..',
  '...kVVkkkkkkkkkkkkkkkVVk...',
  '...kvVVVVvVVVVVVVvVVVVvk...',
  '....kvvVvkvVvkvVvkvVvvk....',
  '...kVk..kVk.kVk.kVk..kVk...',
  '...kVk...kVkkVkkVk...kVk...',
  '....kvk..kVk.v.kVk..kvk....',
  '....kxk.kxk..x..kxk.kxk....',
  '.....k...k...k...k...k.....',
];
// Taçsız Sultan: kırık taç, karanlık yüz, kızıl gözler, apoletli zırh ve pelerin
const SULTAN_PAL = { a: '#ffd870', A: '#c09030', z: '#8a5a18', c: '#5a1428', C: '#9a2a48', f: '#1a0c14', e: '#ff4a3a', j: '#40e0c0' };
const SULTAN_A = [
  '..........k..k.............',
  '.........kak.a.kk..........',
  '.........kaakakaak.........',
  '.........kAjAjAjAk.........',
  '.........kkkkkkkkk.........',
  '.........kAfffffAk.........',
  '.........kfeefeefk.........',
  '.........kAfffffAk.........',
  '..........kAfffAk..........',
  '...kkkk...kkaaakk...kkkk...',
  '..kaaAAkkkaAAaAAakkkAAaak..',
  '.kaAAAAaAaAzzjzzAaAaAAAAak.',
  '.kAAzzAkaAAAzzzAAAakAzzAAk.',
  '..kkkkkcaAzAAAAAzAackkkkk..',
  '..kcCkkcaAAzAAAzAAackkCck..',
  '..kCkaAkkkkkkkkkkkkkAakCk..',
  '..kCkaakaAAzaaazAAakaakCk..',
  '..kCkkkkaAzaAAAazAakkkkCk..',
  '..kCCk.kaAAkkkkkAAak.kCCk..',
  '..kcCk.kaAAk...kAAak.kCck..',
  '..kccck.kaAk...kAak.kccck..',
  '...kkkk.kkkk...kkkk.kkkk...',
];
const SULTAN_B = [
  '..........k..k.............',
  '.........kak.a.kk..........',
  '.........kaakakaak.........',
  '.........kAjAjAjAk.........',
  '.........kkkkkkkkk.........',
  '.........kAfffffAk.........',
  '.........kfeefeefk.........',
  '.........kAfffffAk.........',
  '..........kAfffAk..........',
  '...kkkk...kkaaakk...kkkk...',
  '..kaaAAkkkaAAaAAakkkAAaak..',
  '.kaAAAAaAaAzzjzzAaAaAAAAak.',
  '.kAAzzAkaAAAzzzAAAakAzzAAk.',
  '..kkkkkcaAzAAAAAzAackkkkk..',
  '..kcCkkcaAAzAAAzAAackkCck..',
  '..kCkaAkkkkkkkkkkkkkAakCk..',
  '..kCkaakaAAzaaazAAakaakCk..',
  '..kCkkkkaAzaAAAazAakkkkCk..',
  '..kCCk.kaAAkkkkkAAak.kCCk..',
  '..kcCk..kaAk...kAak..kCck..',
  '..kccck.kaAk...kAak.kccck..',
  '...kkkk.kkk.....kkk.kkkk...',
];
// Ezelî: hale, altı kanat, altın maske, tek büyük göz
const EZELI_PAL = { H: '#ffe8a0', w: '#f0ecff', W: '#a898d0', g: '#ffd870', G: '#b08a30', e: '#ffffff', E: '#c070ff', p: '#2a0a40' };
const EZELI_A = [
  '........kkkkkkkkkkk........',
  '......kkHHHHHHHHHHHkk......',
  '.....kHk...........kHk.....',
  '......kkHHHHHHHHHHHkk......',
  'kk......kkkkkkkkkkk......kk',
  'kWkk.......kkkkk.......kkWk',
  'kwWWkk....kgggggk....kkWWwk',
  '.kwwWWkk.kgGGGGGgk.kkWWwwk.',
  '.kwwwwWWkgGkkkkkGgkWWwwwwk.',
  '..kkkwwwkgkeeeeekgkwwwkkk..',
  'kWWWkkwkgGkeEEEekGgkwkkWWWk',
  'kwwwwWkgGGkeEpEekGGgkWwwwwk',
  '.kkwwwWkgGkeEEEekGgkWwwwkk.',
  '..kwwwwkgGGkeeekGGgkwwwwk..',
  'kWkkkwwkkgGGkkkGGgkkwwkkkWk',
  'kwWWWkkwkgGeGGGeGgkwkkWWWwk',
  '.kwwwWWkkkgGGGGGgkkkWWwwwk.',
  '..kkwwwWkkkgggggkkkWwwwkk..',
  '....kkwwWk.kkkkk.kWwwkk....',
  '......kkkk..kgk..kkkk......',
  '...........kgGgk...........',
  '............kgk............',
  '.............k.............',
];
const EZELI_B = [
  '........kkkkkkkkkkk........',
  '......kkHHHHHHHHHHHkk......',
  '.....kHk...........kHk.....',
  '......kkHHHHHHHHHHHkk......',
  'kk......kkkkkkkkkkk......kk',
  'kWkk.......kkkkk.......kkWk',
  'kwWWkk....kgggggk....kkWWwk',
  '.kwwWWkk.kgGGGGGgk.kkWWwwk.',
  '.kwwwwWWkgGkkkkkGgkWWwwwwk.',
  '..kkkwwwkgkeeeeekgkwwwkkk..',
  'kWWWkkwkgGkeEEEekGgkwkkWWWk',
  'kwwwwWkgGGkeEpEekGGgkWwwwwk',
  '.kkwwwWkgGkeEEEekGgkWwwwkk.',
  '..kwwwwkgGGkeeekGGgkwwwwk..',
  '.kWkkkwkkgGGkkkGGgkkwkkkWk.',
  'kwWWWkkwkgGeGGGeGgkwkkWWWwk',
  'kwwwWWkkkgGGGGGgkkkWWwwwk..',
  '.kkkwwWkkkkgggggkkkkWwwkkk.',
  '...kkwwWk.kkkkk.kWwwkk.....',
  '.....kkkk...kgk...kkkk.....',
  '...........kgGgk...........',
  '............kgk............',
  '.............k.............',
];

// Parıldak: uçan tek göz feneri; B karesinde göz kısılır (parlamadan önce)
const GLARE_PAL = { j: '#8a6a2a', J: '#d8b060', e: '#fff8d0', E: '#ffe79a', i: '#3a2a10' };
const GLARE_A = [
  '.....kkk.....',
  '...kkJJJkk...',
  '..kJJJJJJJk..',
  '.kJJeeeeeJJk.',
  '.kJeeEEEeeJk.',
  'kJJeEEiEEeJJk',
  'kJJeEEiEEeJJk',
  '.kJeeEEEeeJk.',
  '.kJJeeeeeJJk.',
  '..kjJJJJJjk..',
  '...kkjjjkk...',
  '....k...k....',
];
const GLARE_B = [
  '.....kkk.....',
  '...kkJJJkk...',
  '..kJJJJJJJk..',
  '.kJJJJJJJJJk.',
  '.kJJeeeeeJJk.',
  'kJJeEEEEEeJJk',
  'kJJeeeeeeeJJk',
  '.kJJJJJJJJJk.',
  '.kJJJJJJJJJk.',
  '..kjJJJJJjk..',
  '...kkjjjkk...',
  '...k.....k...',
];
// Çekici: geniş ağızlı, yere yapışık kurbağa-böcek; B karesi ağız açık
const LURK_PAL = { l: '#2e4a2a', L: '#4a7a44', N: '#8ab070', d: '#3a1a2a', D: '#c04a6a' };
const LURK_A = [
  '....kkkkkkkk....',
  '..kkLLLLLLLLkk..',
  '.kLLNNLLLLNNLLk.',
  'kLLNrNLLLLNrNLLk',
  'kLLLLLLLLLLLLLLk',
  'kLLLLLLLLLLLLLLk',
  'kllkkkkkkkkkkllk',
  '.kllllllllllllk.',
  '..kk.kk..kk.kk..',
];
const LURK_B = [
  '....kkkkkkkk....',
  '..kkLLLLLLLLkk..',
  '.kLLNNLLLLNNLLk.',
  'kLLNrNLLLLNrNLLk',
  'kLLLLLLLLLLLLLLk',
  'kLLkkkkkkkkkkLLk',
  'kllkddDDDDddkllk',
  '.kllkkkkkkkkllk.',
  '..kk.kk..kk.kk..',
];
// Uluyan: sırtı kabarık, uzun çeneli; B karesinde ağız sonuna kadar açık
const HOWL_PAL = { u: '#4a2a44', U: '#7a4a70', F: '#a878a0', W: '#f5ecd8' };
const HOWL_A = [
  '.......kk......',
  '......kUUk..kk.',
  '..kkkkUUUUkkUk.',
  '.kUUUUUUUUUUUk.',
  'kUUFFUUUUrUUUUk',
  'kUUFFUUUUUUUUUk',
  'kuUUUUUUkWWWWk.',
  'kuuUUUUUkkkkk..',
  '.kuuuuuuuuk....',
  '..kuk.kuuk.....',
  '..kk...kk......',
];
const HOWL_B = [
  '.......kk......',
  '......kUUk..kk.',
  '..kkkkUUUUkkUk.',
  '.kUUUUUUUUUUUk.',
  'kUUFFUUUUrUUUUk',
  'kUUFFUUUUkWWWWk',
  'kuUUUUUUkkkkkk.',
  'kuuUUUUUkWWWWk.',
  '.kuuuuuuukkkk..',
  '..kuk.kuuk.....',
  '..kk...kk......',
];
// Gölge: ışıkta beliren ince siluet; sadece gözleri karanlıkta parlar
const SHADE_PAL = { s: '#2a1e3a', S: '#4a3a6a', X: '#e8f0ff' };
const SHADE_A = [
  '...kkkk...',
  '..kSSSSk..',
  '.kSXSSXSk.',
  '.kSSSSSSk.',
  '..kSSSSk..',
  '.kSSssSSk.',
  'kSSsssSSSk',
  'kSsssssSSk',
  '.kssssssk.',
  '..ks.ssk..',
  '..k..k....',
  '.....k....',
];
const SHADE_B = [
  '...kkkk...',
  '..kSSSSk..',
  '.kSXSSXSk.',
  '.kSSSSSSk.',
  '..kSSSSk..',
  '.kSSssSSk.',
  'kSSsssSSSk',
  'kSsssssSSk',
  '.kssssssk.',
  '..kss.sk..',
  '....k.k...',
  '....k.....',
];

// ---------------- v4 BİYOM YARATIKLARI ----------------
// Örümcek: geniş karın, 4 çift bacak; B karesinde bacaklar değişir
const SPIDER_PAL = { i: '#3a2650', I: '#6a4a8a', L: '#9a7ac0', f: '#e8e0ff' };
const SPIDER_A = [
  'k....kkkkk....k',
  '.k..kIIIIIk..k.',
  '..kkILLIILIkk..',
  '.kIIIIrIrIIIIk.',
  'kIiIIIIIIIIIiIk',
  'k.kiiiIIIiiik.k',
  'k..kk.kkk.kk..k',
  'k.k...k.k...k.k',
];
const SPIDER_B = [
  '.k...kkkkk...k.',
  'k.k.kIIIIIk.k.k',
  '.k.kILLIILIk.k.',
  '..kIIIIrIrIIIk.',
  '.kIiIIIIIIIIiIk',
  'k.kiiiIIIiiik.k',
  '.k.kk.kkk.kk.k.',
  'k....k...k....k',
];
const SPIDERLING_A = ['k.kkk.k', '.kIrIk.', 'k.kkk.k', '.k...k.'];
const SPIDERLING_B = ['.kkkk.k', 'kkIrIk.', '..kkkkk', '.k..k..'];
// Örümcek Ana: dev karın, sırtta yumurta kesesi (beyaz noktalar), B karesi karın nabzı
const BROOD_PAL = { i: '#2a1a3e', I: '#4a2a6a', L: '#7a4aa0', E: '#f0e8ff', e: '#c8b8e0' };
const BROOD_A = [
  '.......kkkkkkkk.......',
  '.....kkIIEeEeIIkk.....',
  'k...kIIIeEeEeEIIIk...k',
  '.k.kIIIIIIIIIIIIIIk.k.',
  '..kIILLIIIIIIIIIIIIk..',
  '.kIIIIIIkkIrIrIIIIIIk.',
  'kIiIIIIIkIIIIIIIIIIiIk',
  'k.kiiiIIIIIIIIIIiiik.k',
  'k..kkiiiiiiiiiiiikk..k',
  'k.k..kkkkkkkkkkkk..k.k',
  '.k.k..k.k....k.k..k.k.',
  'k..k.k..k....k..k.k..k',
];
const BROOD_B = [
  '.......kkkkkkkk.......',
  '.....kkIIeEeEIIkk.....',
  '.k..kIIIEeEeEeIIIk..k.',
  'k.k.kIIIIIIIIIIIIIk.k.',
  '.kkIILLIIIIIIIIIIIIkk.',
  '..kIIIIIkkIrIrIIIIIIk.',
  '.kIiIIIIkIIIIIIIIIIiIk',
  'k.kiiiIIIIIIIIIIiiik.k',
  'k..kkiiiiiiiiiiiikk..k',
  '.k.k.kkkkkkkkkkkk.k.k.',
  'k.k...k.k....k.k...k.k',
  '.k..k...k....k...k..k.',
];
// Kırağı: buz yarasası (Yarasa şekli, soğuk palet, beyaz göz)
const FROSTBAT_PAL = { B: '#9ad8ff', X: '#4a8ab0', r: '#e8f8ff' };
// Kemikçi: kemik zırhlı hızlı böcek, çok bacaklı
const SKIT_PAL = { n: '#8a7a5a', N: '#d0c0a0', W: '#f0e8d8', d: '#5a4a3a' };
const SKIT_A = [
  '....kkkkkkkk...',
  '..kkNNNNNNNNkk.',
  '.kNWNNNNNNNNNNk',
  'kNNNNNNNrNNNNkk',
  'kdnNNNNNNNNNNdk',
  '.kdddnnnnnnddk.',
  '..kkdkdkdkdkk..',
  '..k.k.k.k.k.k..',
];
const SKIT_B = SKIT_A.slice(0, 6).concat(['..kdkdkdkdkdk..', '...k.k.k.k.k...']);
// Kor Böceği: kara kabuk, kor damarları (emissive O), kırılan kabuk çatlakları
const MAGMITE_PAL = { c: '#3a1410', C: '#5a2018', O: '#ff9a4a', o: '#d05a2a' };
const MAGMITE_A = [
  '....kkkkk....',
  '..kkCCCCCkk..',
  '.kCCOoCCoOCk.',
  'kCCoCCCCCCoCk',
  'kCcCCCrCCCCck',
  'kccOccccccOck',
  '.kccccccccck.',
  '..kk.kk.kk...',
];
const MAGMITE_B = MAGMITE_A.slice(0, 7).concat(['...kk.kk.kk..']);
// Boşluk Gözü: tek dev göz, etrafında yüzen mor tentakeller; B karesi göz kısık
const VOID_PAL = { v: '#1c1840', V: '#3a3080', e: '#c0b8ff', E: '#ffffff', p: '#7a6aff' };
const VOID_A = [
  '.p...kkk...p.',
  '..p.kVVVk.p..',
  '...kVeeeVk...',
  '.kkVeEEEeVkk.',
  'kVVVeEkEeVVVk',
  'kVVVeEEEeVVVk',
  '.kkVVeeeVVkk.',
  '..pkVVVVVkp..',
  '.p..kkkkk..p.',
  'p....p.p....p',
];
const VOID_B = [
  '..p..kkk..p..',
  '.p..kVVVk..p.',
  '...kVVVVVk...',
  '.kkVVeeeVVkk.',
  'kVVVeEkEeVVVk',
  'kVVVVeeeVVVVk',
  '.kkVVVVVVVkk.',
  '...kVVVVVk...',
  '..p.kkkkk.p..',
  '.p...p.p...p.',
];
// Obsidyen Devi: Kaya Devi şekli, obsidyen paleti, mor gözler
const OGOLEM_PAL = { q: '#120e1a', Q: '#2c2440', U: '#4a3e68', r: '#c0a0ff' };
// ---------------- v5 DERİN BİYOM YARATIKLARI (özgün gövdeler) ----------------
// Cıva Damlası: titreyen sıvı metal damlası; B karesinde yayılır
const QUICK_PAL = { c: '#3a4048', C: '#8a96a0', Q: '#d8e4ec' };
const QUICK_A = [
  '.....kk.....',
  '....kQCk....',
  '...kQCCCk...',
  '..kQCCCCCk..',
  '.kQQCCCCCCk.',
  'kQWQCCcCCCCk',
  'kQQCCCcCCcCk',
  'kCCCrCCCrCCk',
  'kCCCCCCCCCck',
  '.kCCcccccck.',
  '..kkkkkkkk..',
];
const QUICK_B = [
  '............',
  '............',
  '....kkkk....',
  '..kkQCCCkk..',
  '.kQQCCCCCCk.',
  'kQWQCCcCCCCk',
  'kQQCCcCCcCCk',
  'kCCrCCCCCrCk',
  'kCCCCCCCCCck',
  '.kCCcccccck.',
  '..kkkkkkkk..',
];
// Yıldırım Yarasası: çentikli şimşek kanatlar, beyaz çekirdek
const VOLT_PAL = { B: '#3a8aff', X: '#16304e', Z: '#9ad8ff' };
const VOLT_A = [
  'kk....kk....kk',
  'kZk..kBBk..kZk',
  '.kZkkBWWBkkZk.',
  '..kZZBrrBZZk..',
  '...kkBWWBkk...',
  '....kZBBZk....',
  '.....kkkk.....',
  '....k....k....',
  '...kZ....Zk...',
];
const VOLT_B = [
  '......kk......',
  '.....kBBk.....',
  '....kBWWBk....',
  '..kkkBrrBkkk..',
  '.kZZZBWWBZZZk.',
  'kZk.kZBBZk.kZk',
  'kk...kkkk...kk',
  '.....k..k.....',
  '....kZ..Zk....',
];
// Altın Muhafız: sorguçlu miğfer, vizör gözler, kalkan ve topuz
const GILD_PAL = { q: '#4a3010', Q: '#b88a2a', U: '#ffd870' };
const GILD_A = [
  '......kRRk......',
  '.....kRRRRk.....',
  '....kkUUUUkk....',
  '...kUQQQQQQUk...',
  '...kQQkkkkQQk...',
  '...kQkrkkrkQk...',
  '..kkQQQQQQQQkk..',
  '.kUQkQUUUUQkQUk.',
  'kUQQkQQUUQQkQQUk',
  'kUqQkQQQQQQkqqqk',
  'kqqQkqQQQQqkkkk.',
  '.kkkkqqQQqqk....',
  '....kqqkkqqk....',
  '...kqqqk.kqqqk..',
  '...kkkkk.kkkkk..',
];
const GILD_B = GILD_A.slice(0, 11).concat([
  '....kqqqkqqk....',
  '.....kqqk.kqqk..',
  '....kqqqk.kqqqk.',
  '....kkkkk.kkkkk.',
]);
// Spor Böceği: benekli mantar şapkalı böcek, yan tarafta spor deliği
const SPORE_PAL = { a: '#2e1a34', A: '#6a3e6a', L: '#a8f070', u: '#120a14', m: '#c890e8', M: '#f0d0ff' };
const SPORE_A = [
  '....kkkkk....',
  '..kkmMmmmkk..',
  '.kmmmmMmmmmk.',
  'kmMmmmmmmMmmk',
  'kkkkkkkkkkkkk',
  '.kAAAAaAAAAk.',
  'kLAAArAAArAAk',
  'kAaAAAAaAAAak',
  '.kaaaaaaaaak.',
  '..kukukukuk..',
  '.k.k.k.k.k...',
];
const SPORE_B = SPORE_A.slice(0, 10).concat(['...k.k.k.k.k.']);
// Cam Gölgesi: köşeli cam kıymık gövde, yüzeyleri değişen yansımalar
const MIRROR_PAL = { s: '#2e5a68', S: '#5a98a8', X: '#d8f8ff' };
const MIRROR_A = [
  '....kk....',
  '...kXSk...',
  '..kSXSSk..',
  '.kSSrSrSk.',
  '..kSSSSk..',
  '.kXSSSSSk.',
  'kSSXssSSSk',
  'kSsssXssSk',
  'kSssssssSk',
  '.kssXsssk.',
  '..kss.sk..',
  '..kX.kXk..',
  '...k..k...',
];
const MIRROR_B = [
  '....kk....',
  '...kSXk...',
  '..kSSXSk..',
  '.kSSrSrSk.',
  '..kSSSSk..',
  '.kSSSSXSk.',
  'kSSSssXSSk',
  'kSsXsssssk',
  'kSssssssSk',
  '.kssssXsk.',
  '..ks.ssk..',
  '..kXk.Xk..',
  '...k..k...',
];
// Dev Parçası: yosunlu kaya yumruğu, tek parlayan çatlak göz
const TITAN_PAL = { q: '#1e2a22', Q: '#4a6250', U: '#7a9a78', g: '#a8c850' };
const TITAN_A = [
  '.....kkkkkkk.....',
  '...kkUUgUUUUkk...',
  '..kUUQQQQQQQUUk..',
  '.kUQQQkkkkkQQQUk.',
  '.kQQQkrrrrrkQQQk.',
  'kkQQQkkkkkkkQQQkk',
  'kUQkQQQQgQQQQkQUk',
  'kQQkQQQQQQQQQkQQk',
  'kQqkqQQQQQQQqkQqk',
  'kqqkqqqQQQqqqkqqk',
  '.kk.kqqqqqqqqk.kk',
  '....kqqqkqqqqk...',
  '...kqqqk.kqqqk...',
  '...kkkkk.kkkkk...',
];
const TITAN_B = TITAN_A.slice(0, 11).concat([
  '....kqqqqkqqqk...',
  '....kqqqk.kqqk...',
  '....kkkkk.kkkkk..',
]);
// Zaman Gözü: kum saati gövde, ortasında göz, etrafında süzülen kum taneleri
const CHRONO_PAL = { v: '#2a2010', V: '#7a6030', b: '#c8a860', e: '#ffd890', E: '#ffffff' };
const CHRONO_A = [
  '.kkkkkkkkk.',
  '.kbVVVVVbk.',
  '..kVeeeVk..',
  '..kVeeeVk..',
  '...kVeVk...',
  '....kek....',
  '...kVEVk...',
  '..kVErEVk..',
  '..kVEEEVk..',
  '..kVVeVVk..',
  '.kbVeeeVbk.',
  '.kkkkkkkkk.',
  '.e...e...e.',
];
const CHRONO_B = [
  '.kkkkkkkkk.',
  '.kbVVVVVbk.',
  '..kVeeeVk..',
  '..kVVeVVk..',
  '...kVeVk...',
  '....kek....',
  '...kVeVk...',
  '..kVErEVk..',
  '..kVEEEVk..',
  '..kVeeeVk..',
  '.kbVeeeVbk.',
  '.kkkkkkkkk.',
  'e..e...e..e',
];
// Kan Sülüğü: halka dişli emici ağız, kızıl halkalı gövde
const LEECH_PAL = { p: '#4e0c12', P: '#c02a30', Q: '#ff6a70' };
const LEECH_A = [
  '...kkkkk...',
  '..kpPPPPkk.',
  '.kpPQPPPkWk',
  'kpPPPPPPkkk',
  'kpPQPPPPkrk',
  'kpPPPPPPkkk',
  'kpPQPPPPkrk',
  '.kpPPPPPkkk',
  '..kppPPPkWk',
  '...kkkkkkk.',
];
const LEECH_B = [
  '...kkkkk...',
  '..kpPPPPkkk',
  '.kpPQPPPkWk',
  'kpPPPPPPkkk',
  'kpPQPPPPkrk',
  'kpPPPPPPkWk',
  'kpPQPPPPkrk',
  '.kpPPPPPkkk',
  '..kppPPPkWk',
  '...kkkkkkk.',
];
const LEECH_SEG = [
  '..kkkkk..',
  '.kpPPPPk.',
  'kpPQPPPPk',
  'kPPPPPpPk',
  'kpPPPPPPk',
  'kpPQPPPPk',
  '.kppPPPk.',
  '..kkkkk..',
];
// Yankıcı: çan gövdeli, eş merkezli halkalı ağız; ulurken halkalar genişler
const ECHOER_PAL = { u: '#262234', U: '#3a3450', F: '#5e5880', n: '#8a86b0', W: '#f5ecd8' };
const ECHOER_A = [
  '...kkkkkk....',
  '..kUUUUUUk...',
  '.kUFrFFrFUk..',
  '.kUUUUUUUUkk.',
  'kkUnUUUUUnUUk',
  'kUnUnUUUnUnUk',
  'kUnUnUWUnUnUk',
  'kUnUnUUUnUnUk',
  'kkUnUUUUUnUUk',
  '.kuUUUUUUUuk.',
  '..kuuuuuuuk..',
  '...kk...kk...',
];
const ECHOER_B = [
  '...kkkkkk....',
  '..kUUUUUUk...',
  '.kUFrFFrFUk..',
  '.kUUUUUUUUkk.',
  'kkUnnnnnnnUUk',
  'kUnUUUUUUUnUk',
  'kUnUWWWWWUnUk',
  'kUnUUUUUUUnUk',
  'kkUnnnnnnnUUk',
  '.kuUUUUUUUuk.',
  '..kuuuuuuuk..',
  '..kk.....kk..',
];
// Işık Bekçisi: haleli kanatlı göz; kanatlar çırpar
const SERAPH_PAL = { j: '#a898b0', J: '#fff4e8', e: '#ffffff', E: '#ffe79a', i: '#3a2e3a', H: '#ffd870' };
const SERAPH_A = [
  '.....HHHHH.....',
  '....H.....H....',
  'kk...kkkkk...kk',
  'kJk.kJEEEJk.kJk',
  'kJJkJEeeeEJkJJk',
  'kJJJJEeieEJJJJk',
  '.kJJkJEeeeEJJk.',
  '..kk.kJEEEJk.kk',
  '......kkkkk....',
  '.....J.....J...',
  '....J.......J..',
];
const SERAPH_B = [
  '.....HHHHH.....',
  '....H.....H....',
  '.....kkkkk.....',
  '....kJEEEJk....',
  '..kkJEeeeEJkk..',
  '.kJJJEeieEJJJk.',
  'kJJkJEeeeEJkJJk',
  'kk..kkJEEEJkk.kk',
  '......kkkkk....',
  '.....J.....J...',
  '......J...J....',
];

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
// efsanevi eser taşı: altın çerçeveli, içi ışık
const RELIC = [
  '....kkkk....',
  '..kkGGGGkk..',
  '.kGGWWWWGGk.',
  '.kGWWZZWWGk.',
  'kGGWZZZZWGGk',
  'kGGWZZZZWGGk',
  'kGGWWZZWWGGk',
  '.kGGWWWWGGk.',
  '.kGGgGGgGGk.',
  '..kkGGGGkk..',
  '...kkggkk...',
  '....kkkk....',
];
// Arkentaş: oval, içi ışık ve buz mavisi damarlar; iki karede parıltı yer değiştirir
const ARKEN_A = [
  '....kkkkkk....',
  '..kkBBWWBBkk..',
  '.kBWWZWWWWBk..',
  'kBWZZWWBWWWBk.',
  'kBWZWWWWBWWBk.',
  'kBWWWBWWWZWBk.',
  'kBWWWWBWZZWBk.',
  '.kBWWWWWWZWBk.',
  '..kBBWWWWBBk..',
  '...kkkBBkkk...',
  '.....kkkk.....',
];
const ARKEN_B = [
  '....kkkkkk....',
  '..kkBBWWBBkk..',
  '.kBWWWWWZWBk..',
  'kBWWWBWWZZWBk.',
  'kBWWBWWWWZWBk.',
  'kBWZWWWBWWWBk.',
  'kBWZZWBWWWWBk.',
  '.kBWZWWWWWWBk.',
  '..kBBWWWWBBk..',
  '...kkkBBkkk...',
  '.....kkkk.....',
];
const ARKEN_PAL = { B: '#8ab4d8', W: '#e8f4ff', Z: '#ffffff' };
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
  crown: [
    '..........', '.k..kk..k.', 'kGkkGGkkGk', 'kGGkGGkGGk', 'kGGGGGGGGk',
    'kGRGGGGRGk', 'kGGGGGGGGk', 'kGGGGGGGGk', 'kkkkkkkkkk', '..........'],
  spark: [
    '....k.....', '...kYk....', '.k.kYk.k..', '..kkYkk...', 'kYYYWYYYk.',
    '..kkYkk...', '.k.kYk.k..', '...kYk....', '....k.....', '..........'],
  arken: [
    '..........', '...kkkk...', '..kBWWBk..', '.kBWZWWBk.', '.kWWWZWWk.',
    '.kWZWWWWk.', '.kBWWWZBk.', '..kBWWBk..', '...kkkk...', '..........'],
  gear: [
    '...k..k...', '..kmkkmk..', '.kmmmmmmk.', 'kkmmkkmmkk', '.kmk..kmk.',
    '.kmk..kmk.', 'kkmmkkmmkk', '.kmmmmmmk.', '..kmkkmk..', '...k..k...'],
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
  sharp: [
    '........kk', '.......kWk', '......kWWk', '.....kWWk.', '....kWWk..',
    '...kWWk...', 'kk.kWk....', 'kHkkk.....', '.kHk......', '..kk......'],
  swing: [
    '...kkkk...', '..kWWWWk..', '.kWk..kWkk', '.kk....kWk', '.......kkk',
    'kkk.......', 'kWk....kk.', 'kkWk..kWk.', '..kWWWWk..', '...kkkk...'],
  ricochet: [
    'kk........', 'kWk.......', 'kWWk......', 'kWWWk.....', 'kWWWWk....',
    'kWWk.k....', 'kWkkWk.kk.', 'kk..kWkWk.', '.....kWWk.', '......kkk.'],
  split: [
    'k...k...k.', 'kWk.kWk.kW', 'kWk.kWk.kW', '.kWkWWkWk.', '..kWWWWk..',
    '...kWWk...', '...kWWk...', '...kWWk...', '...kkkk...', '..........'],
  boom: [
    '....k.....', '.k.kOk.k..', '..kOFOk...', 'kkOFYFOkk.', '.kFYYYFk..',
    'kkOFYFOkk.', '..kOFOk...', '.k.kOk.k..', '....k.....', '..........'],
  rapid: [
    '..........', 'kkk.kkk.kk', 'kYYkYYkYYk', 'kkk.kkk.kk', '..........',
    '.kkk.kkk..', '.kYYkYYk..', '.kkk.kkk..', '..........', '..........'],
  overdrive: [
    '...kkkk...', '..kYYYYk..', '.kYYkkYYk.', 'kYYkWkYYYk', 'kYkWWkkYYk',
    'kYkWWWWkYk', 'kYYkkWkYYk', '.kYYkkYYk.', '..kYYYYk..', '...kkkk...'],
  nova: [
    '....k.....', '.k.kIk.k..', '..kIWIk...', 'kkIWWWIkk.', '.kWWWWWk..',
    'kkIWWWIkk.', '..kIWIk...', '.k.kIk.k..', '....k.....', '..........'],
  elite: [
    '..........', 'k...k...k.', 'kY.kYk.Yk.', 'kYkYYYkYk.', 'kYYYYYYYk.',
    'kYYYYYYYk.', 'kYYkYkYYk.', 'kkkkkkkkk.', '..........', '..........'],
  hand: [
    '...kk.......', '..kWWk......', '..kWWk......', '..kWWkkkk...', '..kWWkWWkkk.',
    'kkkWWkWWkWWk', 'kWWWWWWWWWWk', 'kWWWWWWWWWWk', '.kWWWWWWWWk.', '..kWWWWWWWk.',
    '...kWWWWWk..', '...kkkkkkk..'],
};
const ORE_ICON_SHAPES = {
  gold: ['..........', '..kkkkkk..', '.kddccbbk.', 'kdccccbbak', 'kcccbbbaak',
    'kccbbbaaak', '.kbbbaaak.', '..kkkkkk..', '..........', '..........'],
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
  } else s = makeSprite(ICONS[name] || ICONS.gem, { C: '#e070ff', V: '#9030c8', Y: P.helm, O: '#ff9a4a', F: '#e0502a', I: '#bff4ff', D: '#3a7ac8', B: '#8ab4d8', Z: '#ffffff' });
  let cv = s.cv;
  if (scale > 1) {
    cv = document.createElement('canvas'); cv.width = s.w * scale; cv.height = s.h * scale;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s.cv, 0, 0, cv.width, cv.height);
  }
  return (iconCache[key] = cv.toDataURL());
}

// yuva (kovan): etli mor kütle, nabız gibi atan gözenekler (2 kare)
const NEST_PAL = { n: '#3a1a3a', N: '#5a2a58', m: '#7a3a70', r: '#ff3a6a', R: '#ff8ab0', k: '#140c1c' };
const NEST_A = [
  '..kkkkkkkkkkkk..',
  '.knNNNNNNNNNNnk.',
  'knNmmNNNmmNNNNnk',
  'knNmrmNNmrmNNNnk',
  'knNNmNNNNmNNNNnk',
  'knNNNNNmmNNNmmnk',
  'knNmmNNmrmNNmrnk',
  'knNmrmNNmNNNNmnk',
  'knNNmNNNNNNNNNnk',
  'knNNNNmmNNNNNNnk',
  'knNNNNmrmNNmmNnk',
  'knNNNNNmNNmrmNnk',
  'knNmmNNNNNNmNNnk',
  'knNmrmNNNNNNNNnk',
  '.knNNNNNNNNNNnk.',
  '..kkkkkkkkkkkk..',
];
const NEST_B = NEST_A.map(row => row.replace(/r/g, 'R'));

export function buildSprites() {
  const pTop = P_TOP;

  const mk = (legs, pal = {}) => makeSprite(pTop.concat(legs), pal, 'w');
  SPR.nest = [makeSprite(NEST_A, NEST_PAL, 'r'), makeSprite(NEST_B, NEST_PAL, 'R')];
  SPR.playerSets = HELMETS.map(h => ({ idle: mk(L_IDLE, h.pal), wa: mk(L_WA, h.pal), wb: mk(L_WB, h.pal), wc: mk(L_WC, h.pal), fly: mk(L_FLY, h.pal), crouch: mk(L_CROUCH, h.pal) }));
  SPR.player = SPR.playerSets[0]; SPR.player2 = SPR.playerSets[1];
  SPR.glarer = [makeSprite(GLARE_A, GLARE_PAL, 'eEi'), makeSprite(GLARE_B, GLARE_PAL, 'eE')];
  SPR.lurker = [makeSprite(LURK_A, LURK_PAL, 'r'), makeSprite(LURK_B, LURK_PAL, 'rD')];
  SPR.howler = [makeSprite(HOWL_A, HOWL_PAL, 'r'), makeSprite(HOWL_B, HOWL_PAL, 'rW')];
  SPR.shade = [makeSprite(SHADE_A, SHADE_PAL, 'X'), makeSprite(SHADE_B, SHADE_PAL, 'X')];
  SPR.rodent = [makeSprite(ROD_A, ROD_PAL, 'r'), makeSprite(ROD_B, ROD_PAL, 'r')];
  SPR.bug = [makeSprite(BUG_A, BUG_PAL, 'r'), makeSprite(BUG_B, BUG_PAL, 'r')];
  SPR.spitter = [makeSprite(SPIT_A, SPIT_PAL, 'rz'), makeSprite(SPIT_B, SPIT_PAL, 'rz')];
  SPR.flyer = [makeSprite(BAT_A, BAT_PAL, 'r'), makeSprite(BAT_B, BAT_PAL, 'r')];
  SPR.boomer = [makeSprite(BOOM_A, BOOM_PAL, 'rCQ'), makeSprite(BOOM_B, BOOM_PAL, 'rCQ')];
  SPR.brute = [makeSprite(BRUTE_A, BRUTE_PAL, 'r'), makeSprite(BRUTE_B, BRUTE_PAL, 'r')];
  SPR.karakok = [makeSprite(KARAKOK_A, KARAKOK_PAL, 'eEoO'), makeSprite(KARAKOK_B, KARAKOK_PAL, 'eEoO')];
  SPR.kavurgan = [makeSprite(KAVURGAN_A, KAVURGAN_PAL, 'fF'), makeSprite(KAVURGAN_B, KAVURGAN_PAL, 'fF')];
  SPR.otegoz = [makeSprite(OTEGOZ_A, OTEGOZ_PAL, 'iIx'), makeSprite(OTEGOZ_B, OTEGOZ_PAL, 'iIx')];
  SPR.sultan = [makeSprite(SULTAN_A, SULTAN_PAL, 'ej'), makeSprite(SULTAN_B, SULTAN_PAL, 'ej')];
  SPR.ezeli = [makeSprite(EZELI_A, EZELI_PAL, 'HeE'), makeSprite(EZELI_B, EZELI_PAL, 'HeE')];
  SPR.spider = [makeSprite(SPIDER_A, SPIDER_PAL, 'r'), makeSprite(SPIDER_B, SPIDER_PAL, 'r')];
  SPR.spiderling = [makeSprite(SPIDERLING_A, SPIDER_PAL, 'r'), makeSprite(SPIDERLING_B, SPIDER_PAL, 'r')];
  SPR.broodmother = [makeSprite(BROOD_A, BROOD_PAL, 'rE'), makeSprite(BROOD_B, BROOD_PAL, 'rE')];
  SPR.frostbat = [makeSprite(BAT_A, FROSTBAT_PAL, 'r'), makeSprite(BAT_B, FROSTBAT_PAL, 'r')];
  SPR.skitter = [makeSprite(SKIT_A, SKIT_PAL, 'r'), makeSprite(SKIT_B, SKIT_PAL, 'r')];
  SPR.magmite = [makeSprite(MAGMITE_A, MAGMITE_PAL, 'rOo'), makeSprite(MAGMITE_B, MAGMITE_PAL, 'rOo')];
  SPR.voidling = [makeSprite(VOID_A, VOID_PAL, 'eEp'), makeSprite(VOID_B, VOID_PAL, 'eEp')];
  SPR.ogolem = [makeSprite(BRUTE_A, OGOLEM_PAL, 'r'), makeSprite(BRUTE_B, OGOLEM_PAL, 'r')];
  SPR.quickling = [makeSprite(QUICK_A, QUICK_PAL, 'rW'), makeSprite(QUICK_B, QUICK_PAL, 'rW')];
  SPR.voltbat = [makeSprite(VOLT_A, VOLT_PAL, 'rWZ'), makeSprite(VOLT_B, VOLT_PAL, 'rWZ')];
  SPR.gilded = [makeSprite(GILD_A, GILD_PAL, 'r'), makeSprite(GILD_B, GILD_PAL, 'r')];
  SPR.sporeling = [makeSprite(SPORE_A, SPORE_PAL, 'rL'), makeSprite(SPORE_B, SPORE_PAL, 'rL')];
  SPR.mirrorling = [makeSprite(MIRROR_A, MIRROR_PAL, 'r'), makeSprite(MIRROR_B, MIRROR_PAL, 'r')];
  SPR.titanling = [makeSprite(TITAN_A, TITAN_PAL, 'r'), makeSprite(TITAN_B, TITAN_PAL, 'r')];
  SPR.chronoling = [makeSprite(CHRONO_A, CHRONO_PAL, 'rEe'), makeSprite(CHRONO_B, CHRONO_PAL, 'rEe')];
  SPR.leech = [makeSprite(LEECH_A, LEECH_PAL, 'r'), makeSprite(LEECH_B, LEECH_PAL, 'r')];
  SPR.echoer = [makeSprite(ECHOER_A, ECHOER_PAL, 'rW'), makeSprite(ECHOER_B, ECHOER_PAL, 'rW')];
  SPR.seraph = [makeSprite(SERAPH_A, SERAPH_PAL, 'eEH'), makeSprite(SERAPH_B, SERAPH_PAL, 'eEH')];
  SPR.chest = makeSprite(CHEST, { G: '#ffd24a' }, 'G');
  SPR.relic = makeSprite(RELIC, { G: '#ffd24a', g: '#a8701e', W: '#fff4c0', Z: '#ffffff' }, 'WZ');
  SPR.droplet = SPR.quickling;
  SPR.arken = [makeSprite(ARKEN_A, ARKEN_PAL, 'BWZ'), makeSprite(ARKEN_B, ARKEN_PAL, 'BWZ')];
  SPR.heart = makeSprite(HEART, { x: '#ff3a6a', X: '#ff8aa8', Z: '#ffffff', z: '#a01a40' }, 'xXZz');
  SPR.satchel = makeSprite(SATCHEL, { G: '#ffd24a' }, 'G');
  SPR.worm = [makeSprite(WORM_HEAD_A, WORM_PAL, 'r'), makeSprite(WORM_HEAD_B, WORM_PAL, 'r')];
  SPR.wormSeg = makeSprite(WORM_SEG, WORM_PAL);
  SPR.leechSeg = makeSprite(LEECH_SEG, LEECH_PAL);
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
  // bayrak direği (bayrağın kendisi renderer'da dalgalanır)
  R(K, 8, 10, 1, 15);
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
