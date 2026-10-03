// 3B çizilen küçük düşmanlar: tür -> tanım (boss tanımlarıyla aynı biçim; foot: ayak hizası, top: tepe, body: gömülme boyu)
import { SPIDER, SPIDERLING, BROODMOTHER } from './spider.js';
import { FROG } from './frog.js';
import { WORM } from './worm.js';
import { BRUTE, OGOLEM } from './golem.js';
import { SARKAN } from './bat.js';
import { flyDef } from './fly.js';
import { shellDef, snailDef } from './shell.js';
import { urchinDef } from './quill.js';
import { BONES, SKULL } from './bones.js';
import { BEETLE } from './beetle.js';
import { PIRANA } from './fish.js';
import { DEFS as CRAWL } from './crawl.js';
import { DEFS as FLYERS } from './flyers.js';
import { DEFS as SPIRITS } from './spirits.js';
import { DEFS as GUARDS } from './guards.js';
import { DEFS as SPIT } from './spit.js';

// görünüşü doğduğu biyoma göre değişen türler (kabuk, diken, ışık rengi): biyom -> tanım
const SKINS = { kabuklu: shellDef, salyangoz: snailDef, sinek: flyDef, kirpi: urchinDef };
export const MOBS = { spider: SPIDER, spiderling: SPIDERLING, broodmother: BROODMOTHER, lurker: FROG, worm: WORM, brute: BRUTE, ogolem: OGOLEM,
  sarkan: SARKAN, kemikYigini: BONES, kafatasi: SKULL, altinBocek: BEETLE, pirana: PIRANA };
for (const k in SKINS) MOBS[k] = SKINS[k]();
Object.assign(MOBS, CRAWL, FLYERS, SPIRITS, GUARDS, SPIT);
export const mobOf = e => SKINS[e.type] ? SKINS[e.type](e.bio) : MOBS[e.type];
