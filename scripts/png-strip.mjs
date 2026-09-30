// Tile PNG frames into one scaled strip: node scripts/png-strip.mjs <out.png> <scale> <in1.png> <in2.png> ...
import fs from 'node:fs';
import zlib from 'node:zlib';

export function decode(buf) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), ct = buf[25];
  let p = 8; const idat = [];
  while (p < buf.length) { const l = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8); if (t === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + l)); p += 12 + l; }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 1, st = w * bpp, d = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4); let prev = Buffer.alloc(st);
  for (let y = 0; y < h; y++) {
    const f = d[y * (st + 1)], row = Buffer.from(d.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)));
    for (let i = 0; i < st; i++) {
      const a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, s = x * bpp; px[o] = row[s]; px[o + 1] = row[bpp > 2 ? s + 1 : s]; px[o + 2] = row[bpp > 2 ? s + 2 : s]; px[o + 3] = bpp === 4 ? row[s + 3] : 255; }
    prev = row;
  }
  return { w, h, px };
}

export function encode(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return (~c) >>> 0; };
  const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]);
}

export function strip(imgs, S = 1, cols = imgs.length) {
  const cw = Math.max(...imgs.map(i => i.w)), chh = Math.max(...imgs.map(i => i.h)), rows = Math.ceil(imgs.length / cols);
  const W = cw * S * cols, H = chh * S * rows, out = Buffer.alloc(W * H * 4);
  imgs.forEach((im, n) => {
    const ox = (n % cols) * cw * S + ((cw - im.w) >> 1) * S, oy = Math.floor(n / cols) * chh * S + (chh - im.h) * S;
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const si = (y * im.w + x) * 4; if (!im.px[si + 3]) continue; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) im.px.copy(out, ((oy + y * S + dy) * W + ox + x * S + dx) * 4, si, si + 4); }
  });
  return encode(W, H, out);
}

if (process.argv[1]?.endsWith('png-strip.mjs')) {
  const [out, S, ...files] = process.argv.slice(2);
  fs.writeFileSync(out, strip(files.map(f => decode(fs.readFileSync(f))), +S || 1));
}
