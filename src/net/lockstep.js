// Deterministik lockstep, donmaya karşı sertleştirilmiş:
// - Girdi gecikmesi ölçülen ağa göre kendini ayarlar (geç gelen girdi -> gecikme artar, bol pay -> azalır).
// - Her paket karşı tarafın henüz onaylamadığı tüm kareleri taşır; kanal yeniden iletim yapmaz (kuyruk birikmez),
//   kayıp paketi bir sonraki paket telafi eder.
// - Hız eşitleme: öndeki taraf hafifçe yavaşlar, gerideki hızlanır; kimse bekleme duvarına çarpmaz.
// - Bekleme olursa yakalama yumuşaktır (kare başına en fazla 3 adım).
import { G } from '../game/state.js';
import { readMove } from '../input/input.js';
import { execCmd, setCommandQueue } from '../game/commands.js';
import { send, link } from './peer.js';
import { emit } from '../core/events.js';

const MAX_ROWS = 48;       // pakette en fazla kare (tek UDP paketine sığar)
const MIN_DELAY = 3, MAX_DELAY = 16;

export const net = {
  on: false, idx: 0, frame: 0, delay: 5,
  local: new Map(), remote: new Map(), cmds: [], lastSched: -1, peerAck: -1, have: -1,
  hashes: new Map(), desync: false, stallT: 0, stalls: 0,
  remoteFrame: 0, remoteAt: 0, lead: 0, rtt: 0, rtts: [], pingT: 0, resendT: 0,
  slackMin: 99, adaptT: 0, calmT: 0, stallCd: 0, quality: 'iyi',
  log: [], lost: false, bye: false,
};
const LOG = 600;           // yeniden bağlanmada karşıya verilen yerel girdi geçmişi (kare)

export function startLockstep(localIdx) {
  net.on = true; net.idx = localIdx; net.frame = 0; net.delay = 5;
  net.local.clear(); net.remote.clear(); net.hashes.clear();
  net.cmds = []; net.lastSched = -1; net.desync = false; net.stallT = 0; net.stalls = 0;
  net.remoteFrame = 0; net.remoteAt = performance.now(); net.lead = 0; net.rtt = 0; net.rtts = []; net.pingT = 0; net.resendT = 0;
  net.slackMin = 99; net.adaptT = 0; net.calmT = 0; net.stallCd = 0; net.quality = 'iyi';
  net.log = []; net.lost = false; net.bye = false;
  setCommandQueue(cmd => net.cmds.push(cmd));
  // ilk DELAY kare boş girdi: iki taraf da hemen başlayabilsin
  for (let f = 0; f < net.delay; f++) { net.local.set(f, { x: 0, y: 0, m: 0, c: [] }); net.remote.set(f, { x: 0, y: 0, m: 0, c: [] }); }
  net.lastSched = net.peerAck = net.have = net.delay - 1;
  link.onMessage = onMessage;
}
export function stopLockstep() {
  net.on = false; setCommandQueue(null); link.onMessage = d => { if (d && d.t) emit('netMsg', d); };
}

function quant(v) { return Math.round(v * 127); }

// Bu karede yerel girdiyi örnekle, frame+delay için planla ve gönder
export function sampleLocal() {
  const target = net.frame + net.delay;
  if (target <= net.lastSched) return;
  const mv = readMove();
  const cmds = net.cmds.length ? net.cmds : [];
  net.cmds = [];
  // gecikme artmışsa aradaki kareleri aynı girdiyle doldur; komutlar ilk kareye
  for (let f = net.lastSched + 1; f <= target; f++) {
    const inp = { x: quant(mv.x), y: quant(mv.y), m: quant(mv.mag), c: f === net.lastSched + 1 ? cmds : [] };
    net.local.set(f, inp);
    net.log.push([f, inp.x, inp.y, inp.m, inp.c.length ? inp.c : 0]);
  }
  while (net.log.length > LOG) net.log.shift();
  net.lastSched = target;
  sendInputs();
}
// elimizdeki kesintisiz son karşı kare: karşı taraf bundan sonrasını göndermeyi sürdürür
function have() { let h = Math.max(net.have, net.frame - 1); while (net.remote.has(h + 1)) h++; return (net.have = h); }
function sendInputs() {
  net.resendT = 0;
  const L = net.log; let i = L.length; while (i > 0 && L[i - 1][0] > net.peerAck) i--;
  send(['i', net.frame, L.slice(i, i + MAX_ROWS), have()], true);
}

export function canStep() { return net.local.has(net.frame) && net.remote.has(net.frame); }

// Bu karenin girdilerini oyunculara uygula, komutları çalıştır
export function applyInputs() {
  const f = net.frame;
  const li = net.local.get(f), ri = net.remote.get(f);
  const set = (p, inp) => { p.inp.x = inp.x / 127; p.inp.y = inp.y / 127; p.inp.mag = inp.m / 127; };
  set(G.players[net.idx], li); set(G.players[1 - net.idx], ri);
  // komut sırası deterministik: önce oyuncu 0, sonra 1
  for (let pi = 0; pi < 2; pi++) {
    const inp = pi === net.idx ? li : ri;
    for (const c of inp.c) { const ok = execCmd(pi, c); if (pi === net.idx) emit('cmdDone', { cmd: c, ok }); }
  }
}

// Kare tamamlandı: sayaç, temizlik, periyodik senkron özeti
export function afterStep() {
  const f = net.frame;
  net.local.delete(f); net.remote.delete(f);
  net.frame++;
  if (f % 60 === 0) {
    const h = stateHash();
    const other = net.hashes.get(f);
    if (other !== undefined) { check(f, h, other); net.hashes.delete(f); } else net.hashes.set(f, h);
    send(['h', f, h]);
    for (const k of net.hashes.keys()) if (k < f - 600) net.hashes.delete(k);
  }
}
function check(f, mine, theirs) {
  if (mine !== theirs && !net.desync) { net.desync = true; emit('desync', f); }
}

// Her çizim karesinde (adım atılmasa da) çağrılır: ping, yeniden gönderim, gecikme uyarlaması, hız eşitleme.
// Dönüş: bu kare için zaman düzeltmesi (saniye); öndeysek negatif, gerideysek pozitif.
export function netTick(dt, stalled) {
  if (net.lost) return 0; // bağlantı kopuk: uyarlama ve hız eşitleme durur
  net.pingT += dt; net.resendT += dt; net.adaptT += dt;
  if (net.pingT >= 1) { net.pingT = 0; send(['p', performance.now(), net.slackMin], true); }
  if (net.resendT >= 0.05) sendInputs(); // sessizken bile tekrar: onay ve eksik kareler
  net.stallCd = Math.max(0, (net.stallCd || 0) - dt);
  if (stalled) {
    net.stallT += dt;
    // bekleme başladı: gecikmeyi hemen bir kademe aç (yarım saniyede en fazla bir kez)
    if (net.stallT > 0.03 && net.stallCd <= 0) { net.stallCd = 0.5; net.stalls++; net.calmT = 0; bump(+1); }
  } else net.stallT = 0;
  // saniyede bir: gelen girdilerin payına bak (iki tarafın gözlemi birleştirilir)
  if (net.adaptT >= 1) {
    net.adaptT = 0;
    if (net.slackMin <= 0) { net.calmT = 0; bump(+1); }
    else if (net.slackMin >= 4) { if (++net.calmT >= 3) { net.calmT = 0; bump(-1); } }
    else net.calmT = 0;
    net.slackMin = 99;
  }
  // hız eşitleme: karşı tarafın tahmini karesiyle farkımız. Paket yolda geçen süre kadar eskidir (ölçülen en düşük ping'in yarısı);
  // bu eklenmezse iki taraf da kendini önde sanıp birlikte yavaşlar.
  const lat = net.rtts.length ? Math.min(300, ...net.rtts) / 2 : 0;
  const est = net.remoteFrame + (performance.now() - net.remoteAt + lat) / (1000 / 60);
  net.lead = net.frame - Math.min(est, net.remoteFrame + 30);
  net.quality = net.rtt > 220 || net.delay >= 12 ? 'zayıf' : net.rtt > 110 || net.delay >= 8 ? 'orta' : 'iyi';
  if (net.lead > 2) return -dt * 0.3;   // öndeyiz: %30 yavaşla
  if (net.lead < -2) return dt * 0.3;   // gerideyiz: %30 hızlan
  return 0;
}
function bump(d) { net.delay = Math.max(MIN_DELAY, Math.min(MAX_DELAY, net.delay + d)); }

function onMessage(d) {
  if (!Array.isArray(d)) { if (d && d.t) emit('netMsg', d); return; }
  const k = d[0];
  if (k === 'i') {
    net.remoteFrame = d[1]; net.remoteAt = performance.now();
    if (d[3] > net.peerAck) net.peerAck = d[3];
    const list = d[2] || [];
    let newest = -1;
    for (const e of list) {
      const f = e[0];
      if (f > newest) newest = f;
      if (f < net.frame || net.remote.has(f)) continue;
      net.remote.set(f, { x: e[1], y: e[2], m: e[3], c: e[4] || [] });
    }
    if (newest >= 0) { const slack = newest - net.frame; if (slack < net.slackMin) net.slackMin = slack; }
  } else if (k === 'p') {
    if (typeof d[2] === 'number' && d[2] < net.slackMin) net.slackMin = d[2];
    send(['q', d[1], net.slackMin], true);
  } else if (k === 'q') {
    const r = performance.now() - d[1];
    net.rtt = net.rtt ? net.rtt * 0.7 + r * 0.3 : r;
    net.rtts.push(r); if (net.rtts.length > 8) net.rtts.shift();
    if (typeof d[2] === 'number' && d[2] < net.slackMin) net.slackMin = d[2];
  } else if (k === 'h') {
    const f = d[1], h = d[2];
    const mine = net.hashes.get(f);
    if (mine !== undefined) { check(f, mine, h); net.hashes.delete(f); } else net.hashes.set(f, h);
  } else if (k === 'rs') {
    // yeniden bağlanma: karşı tarafın son girdileri; eksik karelerimizi doldurur
    net.remoteFrame = d[1]; net.remoteAt = performance.now();
    for (const e of d[2] || []) { const f = e[0]; if (f >= net.frame && !net.remote.has(f)) net.remote.set(f, { x: e[1], y: e[2], m: e[3], c: e[4] || [] }); }
  } else if (k === 'bye') {
    net.bye = true;
    emit('peerLeft');
  }
}

// bağlantı koptu / geri geldi
export function markLost() { net.lost = true; }
export function resync() {
  net.lost = false; net.stallT = 0; net.remoteFrame = net.frame; net.remoteAt = performance.now();
  send(['rs', net.frame, net.log]);
}

// Kaba durum özeti (FNV-1a): konumlar, canlar, sayaçlar, RNG
function stateHash() {
  let h = 2166136261;
  const mix = v => { v = Math.round(v * 8) | 0; h ^= v & 255; h = Math.imul(h, 16777619); h ^= (v >>> 8) & 255; h = Math.imul(h, 16777619); h ^= (v >>> 16) & 255; h = Math.imul(h, 16777619); };
  for (const p of G.players) { mix(p.x); mix(p.y); mix(p.hp); mix(p.dead ? 1 : 0); }
  mix(G.threat.noise); mix(G.rng); mix(G.threat.level); mix(G.stats.dug); mix(G.stats.kills); mix(G.enemies.length); mix(G.mapVersion);
  for (const e of G.enemies) { mix(e.x); mix(e.y); mix(e.hp); }
  return h >>> 0;
}
