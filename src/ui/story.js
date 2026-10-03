// Hikâye arayüzü: açılış kartları, Selvi'nin defteri, ansiklopedi, ekrandaki hedef satırı, perde afişleri ve telsiz.
import { STRATUM_ROWS, STRATA_COUNT, TILE, GROUND_ROW, stratumOfRow } from '../config.js';
import { ENEMIES } from '../data/balance.js';
import { INTRO, ACTS, PAGES, EPILOGUE, actOf, radioLine } from '../data/story.js';
import { G, App } from '../game/state.js';
import { on } from '../core/events.js';
import { saveMeta } from '../core/save.js';
import { nestsInStratum, nestTotalInStratum } from '../game/threat.js';
import { sfx } from '../audio/audio.js';
import { banner, tap, hideScreens } from './ui.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const up = s => s.toLocaleUpperCase('tr-TR');
const meta = () => App.meta;

// ---------- not kartı: defter sayfası ve telsiz (oyunu durdurmaz, dokununca kapanır) ----------
let noteTO = 0;
export function note(head, text, secs = 6) {
  const el = $('#note'); if (!el) return;
  el.innerHTML = `<div class="nh">${esc(head)}</div><div class="nt">${esc(text)}</div>`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(noteTO); noteTO = setTimeout(() => el.classList.remove('on'), secs * 1000);
}

// ---------- açılış ----------
export function showIntro(done) {
  const s = $('#story'); let i = 0;
  const draw = () => {
    const C = INTRO[i];
    s.innerHTML = `<div class="plate rivets panel intro">
      <div class="ik">${i + 1} / ${INTRO.length}</div><h2>${C.k}</h2><p>${esc(C.t)}</p>
      <div style="display:flex;gap:10px"><button class="btn dark" id="iSkip" style="flex:1">ATLA</button><button class="btn" id="iNext" style="flex:1.4">${i < INTRO.length - 1 ? 'DEVAM' : 'KAZMAYA BAŞLA'}</button></div></div>`;
    tap($('#iNext'), () => { sfx.click(); if (++i >= INTRO.length) finish(); else draw(); });
    tap($('#iSkip'), finish);
  };
  const finish = () => { s.classList.remove('on'); const m = meta(); m.introSeen = true; saveMeta(m); done && done(); };
  hideScreens(); draw(); s.classList.add('on');
}

// ---------- defter ----------
export function showJournal(back) {
  const s = $('#story'), got = meta().pages || [];
  s.innerHTML = `<div class="plate rivets panel" style="max-height:100%">
    <h2>SELVİ’NİN DEFTERİ</h2><div class="sub">${got.length}/${PAGES.length} sayfa · her biyomda bir sayfa saklı</div>
    <div class="jlist">${PAGES.map((t, i) => got.includes(i)
      ? `<div class="plate jpage"><b>${i * STRATUM_ROWS}m</b><span>${esc(t)}</span></div>`
      : `<div class="plate jpage lock"><b>${i * STRATUM_ROWS}m</b><span>Bu sayfa hâlâ kayada.</span></div>`).join('')}</div>
    ${(meta().wins | 0) ? `<div class="sec">SON</div>${EPILOGUE.slice(0, Math.min(EPILOGUE.length, (meta().maxKademe | 0) + 1)).map(t => `<div class="plate jpage end"><span>${esc(t)}</span></div>`).join('')}` : ''}
    <button class="btn dark" id="jBack">GERİ</button></div>`;
  tap($('#jBack'), () => { s.classList.remove('on'); back(); });
  hideScreens(); s.classList.add('on');
}

// ---------- ansiklopedi ----------
function traits(d) {
  const t = [];
  if (d.boss) return d.lore || '';
  if (d.fly) t.push('uçar'); if (d.ranged) t.push('uzaktan tükürür'); if (d.phase) t.push('kayanın içinden geçer'); if (d.boom) t.push('patlar');
  if (d.pack) t.push(d.pack + "'li sürü"); if (d.dig >= 99) t.push('her kayayı kazar'); else if (d.dig) t.push('toprağı kazar'); if (d.armor) t.push('zırhlı');
  if (d.howl) t.push('uluyup korkutur'); if (d.blind) t.push('gözü kamaştırır'); if (d.blink) t.push('ışınlanır'); if (d.brood) t.push('yavru bırakır'); if (d.deaf) t.push('sağır: sesi izler');
  if (d.timid) t.push('ürkek'); if (!d.dmg) t.push('zararsız');
  return t.length ? up(t[0][0]) + t.join(', ').slice(1) + '.' : 'Madende dolaşır.';
}
export function showCodex(back) {
  const s = $('#story'), C = meta().codex || {}, keys = Object.keys(ENEMIES).filter(k => !ENEMIES[k].hidden);
  const seen = keys.filter(k => C[k]), bosses = seen.filter(k => ENEMIES[k].boss), rest = seen.filter(k => !ENEMIES[k].boss);
  const row = k => `<div class="plate row"><div class="main"><div class="name">${esc(ENEMIES[k].name)}${ENEMIES[k].title ? ' · <small>' + esc(ENEMIES[k].title) + '</small>' : ''} <small class="cn">${C[k]} yenildi</small></div><div class="eff">${esc(traits(ENEMIES[k]))}</div></div></div>`;
  s.innerHTML = `<div class="plate rivets panel" style="max-height:100%">
    <h2>ANSİKLOPEDİ</h2><div class="sub">${seen.length}/${keys.length} yaratık · yendikçe sayfası açılır</div>
    <div class="jlist">${bosses.length ? '<div class="sec">BEKÇİLER VE BOSSLAR</div>' + bosses.map(row).join('') : ''}${rest.length ? '<div class="sec">YARATIKLAR</div>' + rest.map(row).join('') : ''}${seen.length ? '' : '<div class="sub">Henüz kimseyi yenmedin.</div>'}</div>
    <button class="btn dark" id="cxBack">GERİ</button></div>`;
  tap($('#cxBack'), () => { s.classList.remove('on'); back(); });
  hideScreens(); s.classList.add('on');
}

// ---------- ekrandaki hedef: üstte ana amaç (kalbe kalan), altta sıradaki adım ----------
export function goalLines() {
  const p = G.player, row = Math.floor(p.y / TILE), st = stratumOfRow(row), depth = Math.max(0, row - GROUND_ROW);
  if (G.tutorial) return null;
  const heartM = G.heartRow - GROUND_ROW;
  if (p.carrying) return { main: `YÜZEYE ${depth}m`, sub: 'KALBİ TAŞI', hot: true };
  const main = `KALBE ${Math.max(0, heartM - depth)}m`;
  const keeper = G.enemies.find(e => e.keeper && !e.dead);
  if (keeper) return { main, sub: 'BEKÇİYİ YEN', hot: true };
  const S = (G.seals || []).filter(o => o.st !== 'done' && !o.temple).sort((a, b) => a.bot - b.bot)[0];
  const gs = Math.max(0, st), left = nestsInStratum(gs), tot = nestTotalInStratum(gs);
  if (S && st >= 0 && (S.heart ? st >= STRATA_COUNT - 1 : stratumOfRow(S.bot) === st)) return { main, sub: (S.heart ? 'KAFES: ' : 'MÜHÜR: ') + up(ENEMIES[S.by] ? ENEMIES[S.by].name : 'BEKÇİ') };
  if (st < 0) return { main, sub: S ? `MÜHÜR ${S.bot - GROUND_ROW}m` : 'DERİNE İN' };
  if (G.beacons.includes(gs)) return { main, sub: 'BİYOM TEMİZ', done: true };
  return { main, sub: tot ? `YUVA ${tot - left}/${tot}` : 'YUVA ARA' };
}

// ---------- sefer başı telsiz ----------
export function radioAtStart() {
  if (!G || G.tutorial) return;
  const [who, line] = radioLine(meta());
  const A = ACTS[actOf(G.startStratum | 0)];
  setTimeout(() => { if (G && !G.over) note('TELSİZ · ' + who, line, 7); }, 5600);
  if (!(meta().runs | 0)) setTimeout(() => { if (G && !G.over) note('PERDE I · ' + A.name, A.open, 6); }, 13000);
}
export const epilogueFor = k => EPILOGUE.slice(0, Math.min(EPILOGUE.length, (k | 0) + 1));

// ---------- olaylar ----------
export function bindStory() {
  on('page', d => {
    if (!G || (d.pi >= 0 && d.pi !== G.localIdx)) return;
    const m = meta(); m.pages = m.pages || [];
    const fresh = !m.pages.includes(d.s);
    if (fresh) { m.pages.push(d.s); m.pages.sort((a, b) => a - b); saveMeta(m); }
    note(`SELVİ’NİN DEFTERİ · ${m.pages.length}/${PAGES.length}`, PAGES[d.s] || '', 8);
    if (fresh) sfx.chest();
  });
  on('stratum', s => {
    const i = ACTS.findIndex(A => A.from === s && s > 0);
    if (i > 0) setTimeout(() => { banner('PERDE ' + ['I', 'II', 'III', 'IV'][i], ACTS[i].name, 'gold'); setTimeout(() => note('PERDE ' + ['I', 'II', 'III', 'IV'][i], ACTS[i].open, 6), 2600); }, 3200);
  });
  on('sealBroken', d => {
    const m = meta();
    if (!d.temple) { m.keepers = m.keepers || []; if (!m.keepers.includes(d.by)) { m.keepers.push(d.by); saveMeta(m); } }
    // perde kapanışı: ikinci, dördüncü, altıncı mühür ve kalbin kafesi
    const n = (G.seals || []).filter(o => !o.temple && !o.heart && o.st === 'done').length;
    const act = d.heart ? 3 : !d.temple && n % 2 === 0 ? n / 2 - 1 : -1;
    if (act >= 0 && ACTS[act]) setTimeout(() => note('PERDE SONU', ACTS[act].close, 6), 4200);
  });
  on('killed', k => { const m = meta(); m.codex = m.codex || {}; m.codex[k] = (m.codex[k] | 0) + 1; });
}
// sefer sonu: kalıcı ilerleme (kırılan en çok mühür, son sefer bayılmayla mı bitti)
export function storyRunEnd(m, victory) {
  if (!G || G.tutorial) return;
  const n = (G.seals || []).filter(o => !o.temple && o.st === 'done').length;
  m.sealMax = Math.max(m.sealMax | 0, n); m.lastDown = !victory;
}
