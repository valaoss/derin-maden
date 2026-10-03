// Boss seslerinin ölçümü (dinlemeden denetim): bant enerjileri ve zaman zarfı.
// Kullanım: node scripts/sfx-check.mjs [boss]
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const DIR = 'public/sfx/boss', ONLY = process.argv[2];
const BANDS = [[0, 120], [120, 400], [400, 1500], [1500, 5000], [5000, 20000]];
function pcm(f) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 2);
}
const db = v => (10 * Math.log10(v + 1e-12)).toFixed(0).padStart(4);
console.log('ses'.padEnd(20) + 'sn    <120  -400 -1.5k   -5k   >5k   | zarf (0.25 sn dilimler, dB)');
for (const f of readdirSync(DIR).sort()) {
  if (!f.endsWith('.mp3') || (ONLY && !f.startsWith(ONLY + '-'))) continue;
  const x = pcm(`${DIR}/${f}`), sr = 22050, N = 2048, e = BANDS.map(() => 0);
  let frames = 0;
  for (let o = 0; o + N <= x.length; o += N) {
    frames++;
    // Goertzel yerine doğrudan DFT: 64 logaritmik frekans noktası yeter
    for (let k = 0; k < 64; k++) {
      const fr = 30 * Math.pow(10000 / 30, k / 63), w = 2 * Math.PI * fr / sr; let re = 0, im = 0;
      for (let n = 0; n < N; n++) { const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / N), v = x[o + n] * h; re += v * Math.cos(w * n); im -= v * Math.sin(w * n); }
      const b = BANDS.findIndex(B => fr >= B[0] && fr < B[1]); e[b] += (re * re + im * im) * fr; // log aralıkta bant genişliği ~ frekans
    }
  }
  const tot = e.reduce((a, b) => a + b, 0), env = [];
  for (let o = 0; o < x.length; o += sr / 4 | 0) { let s = 0, n = 0; for (let i = o; i < Math.min(x.length, o + (sr / 4 | 0)); i++) { s += x[i] * x[i]; n++; } env.push(db(s / n)); }
  console.log(f.replace('.mp3', '').padEnd(20) + (x.length / sr).toFixed(1).padEnd(5) + e.map(v => (' ' + Math.round(100 * v / tot) + '%').padStart(6)).join('') + '   |' + env.join(''));
}
