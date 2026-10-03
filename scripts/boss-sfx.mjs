// Boss ses efektlerini ElevenLabs ses efekti üreticisiyle üretir ve oyuna hazırlar.
// Ham üretim: assets/sfx-raw/boss/<boss>-<an>.mp3 · işlenmiş (oyunun çaldığı): public/sfx/boss/<boss>-<an>.mp3
// İşleme (ffmpeg): baştaki sessizlik kırpılır (ses olayla aynı anda başlar), ses düzeyi eşitlenir, sonu yumuşatılır, mono 96 kb/sn.
// Bas ağırlıklı ses telefon hoparlöründe duyulmaz: öyleyse bas kısılır, orta frekans öne alınır.
// Anahtar yalnızca ortam değişkeninden (ya da .env'den) okunur, dosyaya yazılmaz.
// Kullanım: npm run sfx -- [boss] [an] [--force] [--process] [--list]
//   --force: var olanı yeniden üret · --process: üretme, yalnız ham dosyaları yeniden işle · --list: durum dökümü
// Ölçüm (dinlemeden denetim): node scripts/sfx-check.mjs [boss]
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const RAW = 'assets/sfx-raw/boss', OUT = 'public/sfx/boss';
const END = 'Isolated game sound effect, no music, no speech.';
// [süre sn, tarif]. Tarif yaratığın sesiyle başlar: patlama, alev, sarsıntı katmanlarını oyun kendi ekler.
const SOUNDS = {
  karakok: {
    spawn: [3.5, 'Giant tree monster roar: deep hollow wooden bellow, loud creaking and cracking of thick wood, roots tearing out of the ground.'],
    rage: [2.5, 'Enraged tree monster scream: furious guttural groaning roar with violent wood splintering and cracking.'],
    down: [3.5, 'Giant tree monster death groan: long descending wooden moan, trunk splitting and crashing down, dry wood crumbling.'],
    cast: [1.2, 'Short aggressive wooden creak and low growl of a root monster about to strike.'] },
  kavurgan: {
    spawn: [3.5, 'Skeletal dragon screech: raspy, hollow and hoarse monster shriek, dry bones rattling, embers crackling.'],
    rage: [2.5, 'Furious bone dragon shriek: long raspy high-pitched monster scream with rattling bones and a burst of fire.'],
    down: [3.5, 'Bone dragon death cry: long raspy dying wail fading out while its skeleton collapses into clattering bones.'],
    cast: [1.2, 'Short raspy dragon hiss and snarl with crackling embers, attack wind-up.'] },
  otegoz: {
    spawn: [3.5, 'Alien eye creature appears: eerie rising otherworldly wail with distorted whispers and a reversed whoosh. Cosmic horror.'],
    rage: [2.5, 'Cosmic horror creature shriek: piercing dissonant alien scream with warped whispers and a deep pulse.'],
    down: [3.5, 'Alien creature death: otherworldly wail pitching down into an imploding suction whoosh, whispers fading away.'],
    cast: [1.2, 'Short eerie alien chirp with a whispering magical whoosh, dark spell charge-up.'] },
  kordesen: {
    spawn: [3.5, 'Huge burrowing beast roar: deep guttural snarling animal roar, rock crumbling and heavy claws scraping stone.'],
    rage: [2.5, 'Furious giant beast roar: loud, ferocious, guttural and snarling, with claws slamming on rock.'],
    down: [3.5, 'Giant beast death: pained bellowing moan fading out, heavy body collapsing on rubble, gravel settling.'],
    cast: [1.2, 'Short deep guttural beast snarl, aggressive, attack wind-up.'] },
  ezeli: {
    spawn: [3.5, 'Deep resonant angelic choir chord swelling into a powerful burst of radiant energy, with shimmering chimes.'],
    rage: [2.5, 'Wrathful celestial being: harsh blinding choir-like blast with an electric crackle of pure energy.'],
    down: [3.5, 'Celestial being dies: radiant tone shattering like crystal, descending ethereal sigh, shimmer fading away.'],
    cast: [1.2, 'Short bright magical energy charge, resonant shimmering chime, light spell being cast.'] },
  aynasiz: {
    spawn: [3.5, 'Dark mirror king appears: large sheet of glass ringing and flexing, cold metallic resonance, a sword drawn from its scabbard, low menacing inhuman breath.'],
    rage: [2.5, 'Huge mirror shatters explosively, then a furious distorted metallic inhuman scream with ringing glass shards.'],
    down: [3.5, 'Glass creature dies: cracks spreading through glass, a final big shatter, shards raining onto a stone floor.'],
    cast: [1.2, 'Short sharp glass ring and metallic blade swish, attack wind-up.'] },
  kehribarAna: {
    spawn: [3.5, 'Giant insect queen screech: shrill piercing insect shriek with fast chitinous clicking and wet sticky tearing.'],
    rage: [2.5, 'Enraged giant insect queen: long piercing shrill screech with frantic clicking mandibles and buzzing wings.'],
    down: [3.5, 'Giant insect dies: gurgling shrill squeal fading, shell cracking, wet splatter, last weak clicks.'],
    cast: [1.2, 'Short insect chitter and hiss with a wet squelch, attack wind-up.'] },
  madenKalbi: {
    spawn: [3.5, 'Colossal stone creature awakens: deep monstrous groaning roar with loud cracking and grinding rock, a heavy heartbeat pounding underneath.'],
    rage: [2.5, 'Furious colossal stone creature roar: loud monstrous bellow with rock cracking violently and a fast pounding heartbeat.'],
    down: [3.5, 'Colossal stone creature dies: long agonized groaning moan fading out, rock cracking loudly and crumbling apart.'],
    cast: [1.2, 'Short low growl of a stone creature with a loud sharp crack of splitting rock, attack wind-up.'] },
  balrog: {
    spawn: [3.5, 'Enormous demon monster roar: ferocious, snarling and raspy, mouth wide open, echoing in a huge cavern, flames crackling around it.'],
    rage: [2.5, 'Furious demon roar bursting into flames: enormous ferocious snarling monster roar with an explosive fire whoosh.'],
    down: [3.5, 'Demon death roar: long agonized monster roar fading out, flames sputtering, huge body crashing down.'],
    cast: [1.2, 'Short deep demonic growl with a burst of fire, attack wind-up.'] },
  poseidon: {
    spawn: [3.5, 'Sea titan rises: deep powerful roar of a giant, like a war horn, with a huge water surge and water cascading down.'],
    rage: [2.5, 'Furious sea giant roar: enormous ferocious bellowing roar with a crashing tidal wave and thunder.'],
    down: [3.5, 'Sea giant dies: long deep groan fading, huge body crashing into the sea, bubbles and settling waves.'],
    cast: [1.2, 'Short heavy grunt of a giant with a water surge and a trident swing whoosh.'] },
  dunyaYilani: {
    spawn: [3.5, 'Gigantic sea serpent roar: deep reptilian roar mixed with a loud hiss, water pouring off its body.'],
    rage: [2.5, 'Enraged giant serpent: ferocious piercing reptile screech and loud hiss, water thrashing.'],
    down: [3.5, 'Giant sea serpent dies: long descending reptilian moan, massive splash, bubbling, fading hiss.'],
    cast: [1.2, 'Short menacing giant snake hiss with a water splash, strike wind-up.'] },
  ejder: {
    spawn: [3.5, 'Mighty dragon roar: long, deep, ferocious and powerful, echoing in a cave, a few gold coins clinking.'],
    rage: [2.5, 'Furious huge dragon roar: long, ferocious and snarling, followed by a blast of fire breath.'],
    down: [3.5, 'Dragon death: long pained roar fading to a rattling exhale, heavy body collapsing onto piles of gold coins.'],
    cast: [1.2, 'Dragon snarl: aggressive growling snarl of a huge dragon, attack wind-up.'] },
};

const args = process.argv.slice(2), flag = f => args.includes('--' + f), pos = args.filter(a => !a.startsWith('--'));
const [ONLY, ONLY_EV] = pos;
if (ONLY && !SOUNDS[ONLY]) { console.error('bilinmeyen boss: ' + ONLY + ' (' + Object.keys(SOUNDS).join(', ') + ')'); process.exit(1); }
const jobs = [];
for (const [type, S] of Object.entries(SOUNDS)) for (const [ev, [dur, text]] of Object.entries(S)) if ((!ONLY || ONLY === type) && (!ONLY_EV || ONLY_EV === ev)) jobs.push({ type, ev, dur, text, raw: `${RAW}/${type}-${ev}.mp3`, out: `${OUT}/${type}-${ev}.mp3` });

const ff = (bin, a) => spawnSync(bin, a, { encoding: 'utf8' });
if (ff('ffmpeg', ['-version']).error) { console.error('ffmpeg bulunamadı (PATH\'te olmalı)'); process.exit(1); }
const dbs = s => ({ mean: +(/mean_volume: (-?[\d.]+)/.exec(s) || [])[1], max: +(/max_volume: (-?[\d.]+)/.exec(s) || [])[1] });
const measure = (f, af) => dbs(ff('ffmpeg', ['-hide_banner', '-i', f, '-af', (af ? af + ',' : '') + 'volumedetect', '-f', 'null', '-']).stderr);
const durOf = f => +ff('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout;
const TRIM = 'aformat=channel_layouts=mono,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.01,highpass=f=40';
const TILT = 'bass=g=-7:f=180,equalizer=f=1100:t=o:w=2:g=4';
const MID = 'highpass=f=300:p=2,highpass=f=300:p=2';
// ortalama düzey hedefe çekilir, tepe sınırlanır: bütün boss sesleri aynı yükseklikte duyulur
function processOne(j) {
  let pre = TRIM, m = measure(j.raw, pre);
  if (!isFinite(m.mean)) return null;
  // 300 Hz üstü, toplamın 6 dB'den fazla altındaysa ses bas ağırlıklıdır
  const tilt = m.mean - measure(j.raw, pre + ',' + MID).mean > 6;
  if (tilt) { pre += ',' + TILT; m = measure(j.raw, pre); }
  const gain = Math.min(-17 - m.mean, 14);
  const r = ff('ffmpeg', ['-hide_banner', '-y', '-i', j.raw, '-af', `${pre},volume=${gain.toFixed(1)}dB,alimiter=limit=0.89:level=false,afade=t=in:d=0.008,areverse,afade=t=in:d=${j.ev === 'cast' ? 0.12 : 0.35},areverse`, '-ar', '44100', '-b:a', '96k', j.out]);
  if (r.status) { console.error(r.stderr.slice(-300)); return null; }
  const o = measure(j.out), mid = measure(j.out, MID);
  return { dur: durOf(j.out), cut: durOf(j.raw) - durOf(j.out), mean: o.mean, max: o.max, mid: mid.mean, tilt };
}
const line = (j, a) => `${(j.type + '-' + j.ev).padEnd(18)} ${a.dur.toFixed(2)} sn  baştan kırpılan ${a.cut.toFixed(2)} sn  ortalama ${a.mean} dB  tepe ${a.max} dB  300 Hz üstü ${a.mid} dB${a.tilt ? '  (bas kısıldı)' : ''}`;

if (flag('list')) {
  for (const j of jobs) console.log(`${(j.type + '-' + j.ev).padEnd(18)} ham ${existsSync(j.raw) ? 'var' : 'YOK'}  oyun ${existsSync(j.out) ? (statSync(j.out).size / 1024).toFixed(0) + ' KB, ' + durOf(j.out).toFixed(2) + ' sn' : 'YOK'}`);
  process.exit(0);
}
mkdirSync(RAW, { recursive: true }); mkdirSync(OUT, { recursive: true });
const KEY = process.env.ELEVENLABS_API_KEY, GEN = !flag('process');
if (GEN && !KEY && jobs.some(j => flag('force') || !existsSync(j.raw))) { console.error('ELEVENLABS_API_KEY tanımlı değil (.env dosyasına ELEVENLABS_API_KEY=... satırı ekle)'); process.exit(1); }

let made = 0, failed = 0, secs = 0, stop = false;
for (const j of jobs) {
  if (GEN && !stop && (flag('force') || !existsSync(j.raw))) {
    const body = { text: j.text + ' ' + END, duration_seconds: j.dur, prompt_influence: 0.5 };
    if (process.env.ELEVEN_SFX_MODEL) body.model_id = process.env.ELEVEN_SFX_MODEL;
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      failed++; console.error(j.type, j.ev, r.status, (await r.text()).slice(0, 300));
      // yetki ya da kota hatasında gerisini deneme
      if (r.status === 401 || r.status === 402 || r.status === 403 || r.status === 429) stop = true;
      continue;
    }
    writeFileSync(j.raw, Buffer.from(await r.arrayBuffer())); made++; secs += j.dur;
  }
  if (!existsSync(j.raw)) continue;
  if (!GEN || flag('force') || !existsSync(j.out) || statSync(j.out).mtimeMs < statSync(j.raw).mtimeMs) {
    const a = processOne(j);
    if (a) console.log(line(j, a)); else { failed++; console.error(j.type, j.ev, 'işlenemedi'); }
  }
}
const have = jobs.filter(j => existsSync(j.out)).length;
console.log(`üretilen ${made} (${secs.toFixed(1)} sn), hatalı ${failed}, hazır ${have}/${jobs.length}`);
if (failed) process.exit(1);
