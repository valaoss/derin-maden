// PixelLab boss pipeline: 8-direction character + 16-frame animations.
// usage: node scripts/pixellab-boss.mjs create <boss> | anim <boss> <action> [dirs] | sheet <boss> | status <jobId> | balance
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = 'https://api.pixellab.ai/v2';
const STATE = path.join(ROOT, 'scripts', 'pixellab-state.json');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(s => s.trim())));
const KEY = process.env.PIXELLAB_API_KEY || env.PIXELLAB_API_KEY;
if (!KEY) throw new Error('PIXELLAB_API_KEY missing');

const DIRS8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const SIZE = 128;

export const BOSSES = {
  balrog: {
    description: 'Balrog demon of fire and shadow: towering muscular humanoid, skin of cracked black obsidian with molten lava glowing through the cracks, mane of roaring flames, huge ragged smoke-shadow wings, curved horns, burning eyes, holding a flaming sword in right hand and a fire whip in left hand, dark fantasy, menacing, side view game boss',
    anims: {
      idle: 'breathing idle, flames flicker on the mane, wings sway slowly, ember sparks rising',
      walk: 'heavy stomping walk, each step shakes the ground, wings folded, flames trailing',
      sword: 'raises flaming sword high overhead with both hands then slams it down into the ground, fire eruption',
      whip: 'cracks the fire whip forward in a wide lashing arc, sparks flying',
      wings: 'spreads enormous shadow wings wide and roars, embers rain from the wings',
      hurt: 'staggers back, flinches from being hit, lava cracks flare',
      die: 'falls to knees, flames extinguish, crumbles into cooling black rock and ash',
      whip2: 'winds up the left arm behind the back, then lashes a long burning whip forward in a huge overhead arc, body twisting with the swing, the whip trailing fire',
      roar: 'throws both arms wide open and unfurls its gigantic shadow wings to full span, head thrown back roaring at the sky, a storm of embers bursting out of the wings',
      intro: 'rises up from a crouch, spreads wings and roars to the sky, flames burst from the whole body',
      shadow: 'dissolves into black smoke and shadow from the feet upward, vanishing',
    },
  },
  karakok: {
    description: 'Karakök, the Knot of the Earth: a colossal ancient root monster, its hunched body a writhing knot of black gnarled tree roots and dark soil, hollow glowing green eyes, a mouth of splintered wood, thick root arms ending in claw-like tendrils, glowing green sap veins, moss and pale fungus, standing on tangled root legs, dark fantasy, side view game boss',
    anims: {
      idle: 'breathing idle, roots slowly writhe and creak, green sap glow pulses, small dirt falls off',
      walk: 'lumbering walk dragging itself forward on root legs, roots crawl along the ground',
      spikes: 'raises both root arms high then slams them into the ground, roots erupt and soil bursts upward',
      burrow: 'twists and drills down into the ground, sinking until only roots remain, dirt flying',
      rise: 'bursts up out of the ground explosively, soil and rocks flying, roots spreading wide',
      summon: 'chest of roots opens like a cage, green light pours out, small creatures crawl out',
      hurt: 'recoils from a hit, bark splinters fly off, green sap sprays',
      die: 'roots wither and dry out, glow fades, the body cracks and collapses into a heap of dead wood and dust',
    },
  },
  kavurgan: {
    description: 'Kavurgan, the Dragon of Ash and Bone: a skeletal dragon-like beast of blackened charred bones, exposed ribcage with glowing orange embers burning inside, horned skull head with burning eyes, ash smoke rising from the bones, tattered charred wing bones, standing on four clawed legs, joints glowing red hot, dark fantasy, side view game boss',
    template: 'lion',
    anims: {
      idle: 'breathing idle, embers glow and pulse inside the ribcage, ash smoke drifts up, tail sways',
      walk: 'prowling walk on four clawed bone legs, embers trailing, ash puffing from the joints',
      breath: 'rears its skull back gathering fire in the throat, then breathes a huge cone of ember fire forward',
      embers: 'rears up on hind legs and roars at the sky, a column of burning ash and embers erupts upward from its back',
      bones: 'shakes its whole body violently, bone shards and burning fragments fly outward in all directions',
      hurt: 'flinches from a hit, bones rattle, embers scatter',
      die: 'the fire inside dies out, bones turn grey, the skeleton collapses into a pile of ash and bones',
    },
  },
  sultan: {
    description: 'Crownless Sultan, Curse of the Golden Palace: an undead Ottoman sultan, tall gaunt figure in a tattered gold-embroidered crimson kaftan, skeletal grey face with hollow glowing golden eyes, a bare white turban with an empty crown socket on top, long dark beard, holding a curved golden shamshir sword in the right hand and a jeweled scepter in the left, gold coins spilling from the robes, faint ghostly golden aura, dark fantasy, side view game boss',
    anims: {
      idle: 'breathing idle, robes sway, golden aura flickers, coins occasionally drop from the robes',
      walk: 'slow regal stride forward, kaftan flowing, scepter tapping the ground',
      charge: 'crouches low pointing the shamshir forward, then lunges into a furious charging run with the sword thrust ahead, robes streaming behind',
      slam: 'raises the jeweled scepter high with both hands then smashes it into the ground, a golden shockwave ring bursts outward',
      coins: 'sweeps the arm in a wide arc, flinging a fan of glittering gold coins forward',
      daze: 'staggers dizzily after a missed charge, head swaying, turban tilting, stars of gold spinning around the head',
      hurt: 'recoils from a hit, bones rattle, coins and cloth scraps fly off',
      die: 'drops the sword and scepter, sinks to his knees, crumbles into a pile of gold coins and dust, the turban rolls away',
    },
  },
  aynasiz: {
    description: 'Mirrorless Monarch, Lord of Reflections: a tall faceless king whose body is made of shattered mirror shards and dark blue-silver glass, jagged reflective plate armor with cracks glowing pale blue, a crown of broken glass spikes, a smooth black void where the face should be with two faint white points, a long cape of hanging mirror fragments, holding a mirror-glass staff in the right hand, cold pale light, dark fantasy, side view game boss',
    anims: {
      idle: 'breathing idle, mirror shards shift and glint, the cape fragments sway and chime, faint reflections flicker across the armor',
      walk: 'slow menacing walk forward, cape of mirror fragments swinging, glass armor plates sliding over each other',
      mirror: 'raises the free hand and a glowing mirror pane forms in front of it, a reflection appears in the pane, then the pane fires bright white bolts forward',
      step: 'the whole body shatters into hundreds of mirror shards that scatter and spin in the air, then the shards rush back together and the king reforms',
      shards: 'crosses the arms over the chest then throws them wide, a ring of razor glass shards bursts outward from the body in all directions',
      hurt: 'recoils from a hit, glass shards crack and fly off the body, the void face flickers',
      die: 'the armor cracks all over, shards fall away piece by piece, the crown shatters and the figure collapses into a pile of broken glass',
    },
  },
  kehribarAna: {
    description: 'Amber Mother, Queen of the Hives: a giant insect queen boss, bulky wasp-like body encased in translucent glowing orange amber, six chitinous dark brown legs, a huge swollen egg sac abdomen glowing from inside with pale eggs visible, four tattered membrane wings, a crowned insect head with large black compound eyes and dripping mandibles, small ancient insects trapped inside the amber of the body, dark fantasy, side view game boss',
    anims: {
      idle: 'breathing idle, the egg sac abdomen pulses and glows, wings twitch, mandibles drip resin, legs shift',
      walk: 'heavy six-legged crawl forward, abdomen dragging and swaying, wings buzzing briefly',
      eggs: 'rears up and the egg sac contracts, lobs three glowing pale eggs high into the air forward in an arc',
      resin: 'the head lunges forward and the mandibles open wide, spits a thick stream of sticky orange resin forward',
      amber: 'raises the front legs and screeches, wings flare wide and glow, amber light shines down from above and amber drops begin to fall',
      hurt: 'recoils from a hit, amber cracks and glowing fragments chip off the body, legs scramble',
      die: 'the egg sac bursts, the amber body cracks and shatters, the queen collapses onto its side with legs curling up, amber shards scatter',
    },
  },
  madenKalbi: {
    description: 'Heart of the Mine, FALL: a colossal living heart boss of dark red glowing gemstone and raw ore, shaped like a real anatomical heart made of crystal, pulsing crimson light from deep inside, thick veins of black stone and copper ore running over the surface, jagged rock and crystal spikes growing from it, broken chains and mine rails embedded in its flesh, small floating red crystal shards orbiting around it, hovering in the air, dark fantasy, side view game boss',
    anims: {
      idle: 'hovering idle, the heart beats slowly with a double pulse, crimson light swells and fades, crystal shards orbit, stone veins glow',
      move: 'drifts forward through the air, trailing red light and dust, the orbiting shards stream behind',
      spikes: 'the heart clenches tight and the veins flash bright, long jagged stone spikes shoot out of its surface in all directions then retract',
      fall: 'the heart swells and shudders violently, rock dust and small stones shake loose and fall from above',
      beat: 'the heart squeezes smaller and darker, then explodes outward with a massive red shockwave pulse of light, veins blazing',
      hurt: 'the heart flinches and cracks spread across the crystal, red light leaks out, shards scatter',
      die: 'the beating slows and stutters, cracks spread everywhere, the heart splits open releasing a flood of red light then crumbles into dark stone and dust',
    },
  },
  dunyaYilani: { description: 'World Serpent: a gargantuan ancient serpent with obsidian scales, glowing rune markings, massive fanged jaws, coiled body, dark fantasy, side view game boss', anims: {} },
  ejder: {
    description: 'Treasure Dragon, Sleep of the Golden Hoard: a massive four-legged western dragon boss, copper-red scales with a bronze sheen, a bright golden belly with gold coins and gems stuck to it, large bat-like wings folded along the back, long ivory curved horns, a long spiked tail, a lion-like maw with ivory fangs, amber eyes, embers glowing in the throat, standing proudly, dark fantasy, side view game boss',
    anims: {
      idle: 'breathing idle, chest rises and falls, tail sways slowly, wings shift, embers glow in the throat, a coin falls off the belly',
      walk: 'heavy four-legged stride forward, claws gripping the ground, tail swinging, wings tucked',
      breath: 'the chest glows brighter and brighter from inside, the head rears back, then the jaws open and a huge torrent of orange fire pours forward',
      tail: 'spins the body slightly and whips the long spiked tail around in a wide arc forward',
      gust: 'spreads the wings wide and beats them powerfully forward, raising a storm of dust and gold coins',
      soar: 'crouches then leaps into the air, wings beating hard, hovering high with legs tucked, then dives down claws first',
      wake: 'lies curled asleep on a pile of gold coins with the tail wrapped around, then the eyes open, the head lifts, it shakes off coins and rises to stand on all fours with wings stretching',
      hurt: 'recoils from a hit, scales and coins fly off, roars in pain',
      die: 'staggers, the wings droop, collapses onto the belly, the head drops to the ground and the ember glow in the throat fades out',
    },
  },
  ezeli: {
    description: 'Ezeli the Eternal, Dream of the Core: a primordial angelic being older than creation, a tall veiled figure of pale golden light with no visible face, wrapped in flowing white and cream robes, surrounded by two slowly turning concentric golden halo rings covered in open watching eyes, four great wings made of pure light with feathers fading into sparks, floating in the air with no legs, trailing motes of starlight, radiant, holy and unknowable, dark fantasy, side view game boss',
    anims: {
      idle: 'hovering idle, the halo rings slowly rotate, wings beat gently, robes drift, the eyes on the rings blink one by one, starlight motes fall',
      move: 'glides forward through the air, wings spread wide and sweeping, rings tilt into the motion, robes trailing behind',
      pillars: 'raises both arms, the eyes on the rings all open and flash, beams of golden light shoot down from above like judgement pillars striking the ground',
      doom: 'folds the wings inward and gathers light into the chest, the rings spin faster and faster, then everything bursts outward in a huge expanding ring of white-gold light',
      summon: 'spreads the wings and lifts the arms, two small winged guardians of light form from sparks beside the figure and fly out',
      hurt: 'flinches and flickers, the light dims for a moment, cracks of darkness appear on the halo rings and sparks scatter',
      die: 'the rings shatter one after another, the wings burn away into sparks, the figure folds inward and collapses into a single point of light that fades out',
    },
  },
  otegoz: {
    description: 'Ötegöz, the Gazer at the Void: a giant floating eyeball boss, one huge violet iris with a slit black pupil looking to the right, the eyeball wrapped in dark purple void-flesh and writhing shadow tentacles hanging below, smaller glowing violet eyes on the tentacle tips, drifting wisps of void energy, no legs, hovering in the air, dark fantasy, side view game boss',
    anims: {
      idle: 'hovering idle, bobbing gently in the air, tentacles drift and sway, pupil looks around, void wisps swirl',
      orbs: 'pupil contracts and flashes, three glowing violet void orbs form in front of the eye and shoot forward',
      pull: 'iris widens and glows intensely, a swirling vortex of purple energy is drawn inward toward the eye, tentacles stretch forward',
      gaze: 'the eye narrows then fires a wide sweeping violet beam of light from the pupil, the beam sweeps across',
      blink: 'the eye squeezes shut, folds in on itself into a point of violet light and vanishes',
      hurt: 'the eyeball flinches and squints, tentacles recoil, violet ichor sprays',
      die: 'the iris cracks and goes dark, the eye deflates and bursts, tentacles go limp and dissolve into void smoke',
    },
  },
};

const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
// birden çok kuyruk aynı anda çalışır: dosyadaki güncel durumla birleştirilir
const merge = (a, b) => { if (!a || typeof b !== 'object' || Array.isArray(b)) return b; for (const k in b) a[k] = merge(a[k], b[k]); return a; };
const save = () => { const cur = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {}; fs.writeFileSync(STATE, JSON.stringify(merge(cur, state), null, 2)); };

let curKey = KEY;
async function api(method, p, body) {
  const r = await fetch(API + p, { method, headers: { Authorization: `Bearer ${curKey}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
  if (!r.ok) throw new Error(`${method} ${p} ${r.status}: ${txt.slice(0, 800)}`);
  return j;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitJob(id, label) {
  for (;;) {
    const j = await api('GET', `/background-jobs/${id}`);
    const st = j.status || j.job?.status;
    process.stdout.write(`\r${label}: ${st} ${j.progress ?? ''}   `);
    if (st === 'completed') { console.log(); return j; }
    if (st === 'failed') { console.log(); throw new Error(`${label} failed: ${JSON.stringify(j).slice(0, 800)}`); }
    await sleep(8000);
  }
}

const keyOf = i => (i > 1 ? env[`PIXELLAB_API_KEY_${i}`] : KEY);
async function create(boss, keyIdx = 1) {
  const B = BOSSES[boss]; if (!B) throw new Error('unknown boss ' + boss);
  const res = await api('POST', '/create-character-v3', {
    description: B.description, name: boss, image_size: { width: SIZE, height: SIZE }, view: 'side', template_id: B.template || 'mannequin',
    detail: 'highly detailed', outline: 'selective outline', no_background: true,
  });
  console.log(JSON.stringify(res).slice(0, 600));
  state[boss] = { ...(state[boss] || {}), characterId: res.character_id, createJob: res.background_job_id, key: keyIdx, anims: state[boss]?.anims || {} };
  save();
  await waitJob(res.background_job_id, `${boss} character`);
  await downloadRotations(boss);
}

async function downloadRotations(boss) {
  const S = state[boss]; const c = await api('GET', `/characters/${S.characterId}`);
  const dir = path.join(ROOT, 'tmp', 'pixellab', boss, 'rot'); fs.mkdirSync(dir, { recursive: true });
  const rots = c.rotations || c.character?.rotations || c.rotation_urls || {};
  for (const [d, u] of Object.entries(rots)) {
    const url = typeof u === 'string' ? u : u.url || u.image_url;
    if (!url) continue;
    fs.writeFileSync(path.join(dir, `${d}.png`), Buffer.from(await (await fetch(url)).arrayBuffer()));
  }
  fs.writeFileSync(path.join(dir, '..', 'character.json'), JSON.stringify(c, null, 2));
  console.log('rotations ->', dir, Object.keys(rots));
}

async function anim(boss, action, dirs = DIRS8) {
  const B = BOSSES[boss], S = state[boss]; if (!S?.characterId) throw new Error('create first');
  const text = B.anims[action]; if (!text) throw new Error('unknown action ' + action);
  S.anims[action] = S.anims[action] || { jobs: {} };
  let groupId = S.anims[action].groupId;
  for (const d of dirs) {
    if (S.anims[action].jobs[d]) continue;
    const res = await api('POST', '/characters/animations', {
      character_id: S.characterId, mode: 'v3', animation_name: action, action_description: text, frame_count: 16,
      directions: [d], keep_first_frame: false, ...(groupId ? { animation_group_id: groupId } : {}),
    });
    groupId = groupId || res.animation_group_id;
    S.anims[action].groupId = groupId; S.anims[action].jobs[d] = res.background_job_ids?.[0] || res.background_job_id; save();
    console.log(`${boss}/${action}/${d} job ${res.background_job_ids?.[0]}`);
  }
  for (const d of dirs) await waitJob(S.anims[action].jobs[d], `${boss}/${action}/${d}`);
}

async function sheet(boss) {
  const S = state[boss];
  const r = await fetch(`${API}/characters/${S.characterId}/spritesheet`, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`sheet ${r.status} ${await r.text()}`);
  const out = path.join(ROOT, 'tmp', 'pixellab', boss); fs.mkdirSync(out, { recursive: true });
  const zip = path.join(out, 'sheet.zip'); fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
  console.log('sheet ->', zip);
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === 'balance') { curKey = keyOf(+(a || 1)); console.log(JSON.stringify(await api('GET', '/balance'))); }
else if (cmd === 'create') { curKey = keyOf(+(b || 1)); await create(a, +(b || 1)); }
else if (cmd === 'rot') { curKey = keyOf(state[a]?.key || 1); await downloadRotations(a); }
else if (cmd === 'anim') await anim(a, b, c ? c.split(',') : undefined);
else if (cmd === 'sheet') await sheet(a);
else if (cmd === 'status') console.log(JSON.stringify(await api('GET', `/background-jobs/${a}`), null, 1).slice(0, 3000));
else if (cmd === 'char') console.log(JSON.stringify(await api('GET', `/characters/${state[a].characterId}`), null, 1).slice(0, 4000));
else console.log('usage: create|anim|sheet|status|char|balance');

// Standalone mode (any account): animate the local 128px rotation with /animate-with-text-v3.
// node scripts/pixellab-boss.mjs anim2 <boss> <action> <dir> [keyIndex] [frames]
export async function anim2(boss, action, dir, keyIdx = 1, frames = 16) {
  const key = keyIdx > 1 ? env[`PIXELLAB_API_KEY_${keyIdx}`] : KEY;
  const B = BOSSES[boss], text = B.anims[action]; if (!text) throw new Error('unknown action ' + action);
  const img = fs.readFileSync(path.join(ROOT, 'tmp', 'pixellab', boss, 'rot', `${dir}.png`)).toString('base64');
  const hdr = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const st = (state[boss].sa ??= {}); st[action] ??= {};
  let jobId = st[action][dir]?.job;
  if (!jobId) {
    const r = await fetch(`${API}/animate-with-text-v3`, { method: 'POST', headers: hdr, body: JSON.stringify({ first_frame: { type: 'base64', base64: img }, action: text, frame_count: frames, no_background: true }) });
    const j = await r.json(); if (!r.ok) throw new Error(`anim2 ${r.status} ${JSON.stringify(j).slice(0, 500)}`);
    jobId = j.background_job_id; st[action][dir] = { job: jobId, key: keyIdx }; save();
    console.log(`${boss}/${action}/${dir} standalone job ${jobId} (key ${keyIdx})`);
  }
  for (;;) {
    const j = await (await fetch(`${API}/background-jobs/${jobId}`, { headers: hdr })).json();
    process.stdout.write(`\r${boss}/${action}/${dir}: ${j.status}   `);
    if (j.status === 'completed') {
      console.log(); const out = path.join(ROOT, 'tmp', 'pixellab', boss, 'anim', action, dir); fs.mkdirSync(out, { recursive: true });
      const imgs = j.last_response.images || [];
      imgs.forEach((im, i) => fs.writeFileSync(path.join(out, `${i}.png`), Buffer.from(im.base64, 'base64')));
      console.log(imgs.length, 'frames ->', out, 'usage', JSON.stringify(j.usage)); return;
    }
    if (j.status === 'failed') { console.log(); throw new Error(JSON.stringify(j).slice(0, 800)); }
    await sleep(6000);
  }
}
if (cmd === 'anim2') await anim2(a, b, c, +(process.argv[6] || 1), +(process.argv[7] || 16));
// Sequential queue for one account: node scripts/pixellab-boss.mjs queue <keyIndex> boss/action/dir[:frames] ...
if (cmd === 'queue') {
  for (const item of process.argv.slice(4)) {
    const [spec, fr] = item.split(':'), [boss, action, dir] = spec.split('/');
    for (let tries = 0; tries < 400; tries++) {
      try { await anim2(boss, action, dir, +a, +(fr || 16)); break; }
      catch (e) { if (!/429/.test(e.message)) { console.log('ERR', item, e.message.slice(0, 200)); break; } await sleep(20000); }
    }
  }
}
