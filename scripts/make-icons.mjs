// PWA ikonlarını pixel-art olarak üretir (bağımlılık yok: elle PNG kodlama).
// Kullanım: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const PAL = {
  '.': null, k: '#140c1c', y: '#f2c14e', Y: '#ffe79a', o: '#a8701e', w: '#fff4c2',
  s: '#f0b890', S: '#b8765a', t: '#2fb39a', T: '#74efcf', g: '#16695a',
  m: '#a7b0c4', M: '#5a6278', h: '#8a5a2a', H: '#b07a42',
};
// 24x24: kask + lamba + kazma, alacakaranlık arka planı üzerinde
const ART = [
  '........................',
  '........................',
  '.........kkkkkk.........',
  '.......kkYYYyyykk.......',
  '......kYYyyyyyyyykk.....',
  '.....kYyyyyyyyyyykwk....',
  '.....kyyyyyyyyyyykwwk...',
  '....kyyyyyyyyyyyykwk....',
  '....kooooooooooooookk...',
  '...kkooooooooooooooook..',
  '.....kSsssssssssSk......',
  '.....kSssksssskssk......',
  '.....kSsssssssssSk......',
  '.....kSSssssssssSk......',
  '......kkSSssssSkk.......',
  '.....kttkkkkkkkttk......',
  '....ktTTttttttttTtk.....',
  '...ktTTtttttttttttk.....',
  '...kttttttgtttttttk.....',
  '...kgtttttgttttttgk.....',
  '....kggggggggggggk......',
  '........................',
  '........................',
  '........................',
];
const BG_TOP = [28, 29, 58], BG_BOT = [184, 99, 106];

function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function render(size) {
  const px = new Uint8Array(size * size * 4);
  const cell = size / 24;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ay = Math.floor(y / cell), ax = Math.floor(x / cell);
    const ch = ART[ay][ax];
    let c;
    if (PAL[ch]) c = hex(PAL[ch]);
    else {
      // bantlı gökyüzü (4 kademe)
      const t = Math.floor((ay / 24) * 4) / 3;
      c = BG_TOP.map((v, i) => Math.round(v + (BG_BOT[i] - v) * t));
    }
    const o = (y * size + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
  }
  return png(size, size, px);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192));
writeFileSync('public/icons/icon-512.png', render(512));
console.log('ikonlar yazıldı');
