// Boss seslendirmelerini ElevenLabs ile üretir: assets/voice/<boss>-<an>.mp3 (şimdilik oyuna dahil değil)
// Anahtar yalnızca ortam değişkeninden okunur, dosyaya yazılmaz.
// Kullanım: ELEVENLABS_API_KEY=... node scripts/boss-voices.mjs [boss] [--force]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { VOICE } from '../src/data/voicelines.js';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('ELEVENLABS_API_KEY tanımlı değil'); process.exit(1); }
const FORCE = process.argv.includes('--force');
const ONLY = process.argv.slice(2).find(a => !a.startsWith('--'));
// ElevenLabs hazır sesleri
const VOICES = {
  adam: 'pNInz6obpgDQGcFmaJgB', callum: 'N2lVS1w4EtoT3dr4eOWO', brian: 'nPczCjzI2devNBz1zQrb', george: 'JBFqnCBsd6RMkjVDRZzb',
  daniel: 'onwK4e9ZLuTAKqWW03F9', lily: 'pFZP5JQG7iQjIQuC4Bku', sarah: 'EXAVITQu4vr4xnSDxMaL', arnold: 'VR6AewLTigWG4xSOukaG',
};
const MODEL = process.env.ELEVEN_MODEL || 'eleven_multilingual_v2';
const OUT = 'assets/voice';
mkdirSync(OUT, { recursive: true });

let made = 0, skipped = 0, failed = 0, chars = 0;
for (const [type, V] of Object.entries(VOICE)) {
  if (ONLY && type !== ONLY) continue;
  for (const [ev, text] of Object.entries(V.lines)) {
    const file = `${OUT}/${type}-${ev}.mp3`;
    if (existsSync(file) && !FORCE) { skipped++; continue; }
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[V.voice]}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true } }),
    });
    if (!r.ok) { failed++; console.error(type, ev, r.status, (await r.text()).slice(0, 300)); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(file, buf); made++; chars += text.length;
    console.log(type, ev, V.voice, (buf.length / 1024).toFixed(0) + ' KB');
  }
}
console.log(`üretilen ${made}, atlanan ${skipped}, hatalı ${failed}, karakter ${chars}`);
if (failed) process.exit(1);
