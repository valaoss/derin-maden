// Deterministik lockstep: iki taraf da aynı tohum ve aynı girdi dizisiyle aynı simülasyonu çalıştırır.
// Girdi, örneklendiği kareden DELAY kare sonrasına planlanır (gecikme gizleme). Karşı tarafın girdisi gelmeden kare ilerlemez.
import { G } from '../game/state.js';
import { readMove } from '../input/input.js';
import { execCmd, setCommandQueue } from '../game/commands.js';
import { send, link } from './peer.js';
import { emit } from '../core/events.js';

export const net = {
  on: false, idx: 0, frame: 0, delay: 4,
  local: new Map(), remote: new Map(), cmds: [],
  hashes: new Map(), desync: false, stallT: 0, remoteAhead: 0, rtt: 0,
};

export function startLockstep(localIdx) {
  net.on = true; net.idx = localIdx; net.frame = 0;
  net.local.clear(); net.remote.clear(); net.hashes.clear();
  net.cmds = []; net.desync = false; net.stallT = 0; net.remoteAhead = 0;
  setCommandQueue(cmd => net.cmds.push(cmd));
  // ilk DELAY kare boş girdi: iki taraf da hemen başlayabilsin
  for (let f = 0; f < net.delay; f++) { net.local.set(f, { x: 0, y: 0, m: 0, c: [] }); net.remote.set(f, { x: 0, y: 0, m: 0, c: [] }); }
  link.onMessage = onMessage;
}
export function stopLockstep() {
  net.on = false; setCommandQueue(null); link.onMessage = d => { if (d && d.t) emit('netMsg', d); };
}

function quant(v) { return Math.round(v * 127); }

// Bu karede yerel girdiyi örnekle, frame+delay için planla ve gönder
export function sampleLocal() {
  const target = net.frame + net.delay;
  if (net.local.has(target)) return;
  const mv = readMove();
  const inp = { x: quant(mv.x), y: quant(mv.y), m: quant(mv.mag), c: net.cmds.length ? net.cmds : [] };
  net.cmds = [];
  net.local.set(target, inp);
  send(['i', target, inp.x, inp.y, inp.m, inp.c.length ? inp.c : 0]);
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

function onMessage(d) {
  if (!Array.isArray(d)) { if (d && d.t) emit('netMsg', d); return; }
  const k = d[0];
  if (k === 'i') {
    const f = d[1];
    if (f < net.frame) return;
    net.remote.set(f, { x: d[2], y: d[3], m: d[4], c: d[5] || [] });
    net.remoteAhead = f - net.frame;
  } else if (k === 'h') {
    const f = d[1], h = d[2];
    const mine = net.hashes.get(f);
    if (mine !== undefined) { check(f, mine, h); net.hashes.delete(f); } else net.hashes.set(f, h);
  } else if (k === 'bye') {
    emit('peerLeft');
  }
}

// Kaba durum özeti (FNV-1a): konumlar, canlar, sayaçlar, RNG
function stateHash() {
  let h = 2166136261;
  const mix = v => { v = Math.round(v * 8) | 0; h ^= v & 255; h = Math.imul(h, 16777619); h ^= (v >>> 8) & 255; h = Math.imul(h, 16777619); h ^= (v >>> 16) & 255; h = Math.imul(h, 16777619); };
  for (const p of G.players) { mix(p.x); mix(p.y); mix(p.hp); mix(p.dead ? 1 : 0); }
  mix(G.base.hp); mix(G.rng); mix(G.wave.num); mix(G.stats.dug); mix(G.stats.kills); mix(G.enemies.length); mix(G.mapVersion);
  for (const e of G.enemies) { mix(e.x); mix(e.y); mix(e.hp); }
  return h >>> 0;
}
