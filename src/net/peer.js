// Eşleşme: PeerJS (WebRTC DataChannel).
// Üç yol: Hızlı Eşleş (sunucusuz lobi yuvaları), davet linki (?oda=KOD) ve eski usul 4 haneli kod.
import { Peer } from 'peerjs';
import { isNative, WEB_URL, nativeShare } from '../core/native.js';

const PREFIX = 'derinmaden-v5-';
const LOBBY = PREFIX + 'lobi-';
const LOBBY_SLOTS = 6;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan harfler yok (I/O/0/1)

export function makeCode() {
  let s = '';
  const a = new Uint32Array(4); crypto.getRandomValues(a);
  for (let i = 0; i < 4; i++) s += ALPHABET[a[i] % ALPHABET.length];
  return s;
}
export function normCode(s) { return (s || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4); }

function peerOpts() {
  const env = import.meta.env;
  const ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  // NAT arkasında kalanlar için isteğe bağlı TURN (VITE_TURN_URL, VITE_TURN_USER, VITE_TURN_PASS)
  if (env.VITE_TURN_URL) ice.push({ urls: env.VITE_TURN_URL.split(','), username: env.VITE_TURN_USER || '', credential: env.VITE_TURN_PASS || '' });
  const o = { debug: 0, config: { iceServers: ice } };
  if (env.VITE_PEER_HOST) { o.host = env.VITE_PEER_HOST; o.port = +(env.VITE_PEER_PORT || 443); o.secure = env.VITE_PEER_SECURE !== '0'; o.path = env.VITE_PEER_PATH || '/'; }
  return o;
}
// Denetim kanalı (PeerJS): sırasız ama güvenilir; oda, sohbet, senkron özeti, yeniden bağlanma.
const CHAN = { reliable: false, serialization: 'json' };
// Hızlı kanal: girdi ve ping. Yeniden iletim yok: kayıp paket beklenmez, eskimiş paket kuyrukta birikmez
// (güvenilir kanalda her kayıp, yeniden iletim süresi katlanarak saniyelere varan gecikme yaratıyordu).
const FAST = { negotiated: true, id: 101, ordered: false, maxRetransmits: 0 };

export const link = {
  peer: null, conn: null, fast: null, fastOk: false, host: false, code: '', open: false, quick: false,
  onMessage: null, onOpen: null, onClose: null, onError: null,
};

// iki taraf aynı kimlikle açar (ek sinyalleşme gerekmez); karşıdan ilk paket gelince kullanılmaya başlanır
function openFast(c) {
  if (c.fast) return;
  try {
    const dc = c.fast = c.peerConnection.createDataChannel('fast', FAST);
    let tries = 0;
    const probe = () => { if (link.fast !== dc || link.fastOk || dc.readyState !== 'open' || tries++ > 30) return; try { dc.send('["f"]'); } catch (e) { /* kapandı */ } setTimeout(probe, 300); };
    dc.onopen = () => { if (link.conn !== c) return; link.fast = dc; link.fastOk = false; probe(); };
    dc.onclose = () => { if (link.fast === dc) { link.fast = null; link.fastOk = false; } };
    dc.onmessage = e => {
      if (link.fast !== dc) return;
      link.fastOk = true;
      let d; try { d = JSON.parse(e.data); } catch (err) { return; }
      if (d[0] !== 'f') link.onMessage && link.onMessage(d);
    };
  } catch (e) { /* desteklenmiyorsa denetim kanalı yeter */ }
}
function bindConn(c) {
  link.conn = c; link.fast = null; link.fastOk = false;
  if (c.open) openFast(c);
  c.on('open', () => { link.open = true; openFast(c); link.onOpen && link.onOpen(); });
  c.on('data', d => { link.onMessage && link.onMessage(d); });
  c.on('close', () => { if (link.conn !== c) return; link.open = false; link.conn = null; link.fast = null; link.fastOk = false; link.onClose && link.onClose('closed'); });
  c.on('error', e => { link.onError && link.onError(String(e && e.type || e)); });
}

function acceptIncoming(peer) {
  peer.on('connection', c => { if (link.conn) { try { c.close(); } catch (e) { /* yok */ } return; } bindConn(c); });
}

function makePeer(id, resolve, reject, onIdTaken) {
  const peer = id ? new Peer(id, peerOpts()) : new Peer(peerOpts());
  link.peer = peer;
  peer.on('open', () => resolve(peer));
  peer.on('error', e => {
    const t = e && e.type;
    if (t === 'unavailable-id' && onIdTaken) { onIdTaken(); return; }
    if (t === 'peer-unavailable') return; // bağlantı denemeleri ayrıca dinler
    link.onError && link.onError(t || 'peer'); reject(e);
  });
  peer.on('disconnected', () => { if (!link.open) { try { peer.reconnect(); } catch (err) { /* yok */ } } });
  return peer;
}

// Kodlu oda kur: kod üretir, misafiri bekler
export function hostRoom() {
  return new Promise((resolve, reject) => {
    closeLink();
    const code = makeCode();
    link.host = true; link.code = code; link.quick = false;
    const peer = makePeer(PREFIX + code, () => resolve(code), reject, () => { closeLink(); hostRoom().then(resolve, reject); });
    acceptIncoming(peer);
  });
}

// Kodla/linkle katıl
export function joinRoom(code) {
  return new Promise((resolve, reject) => {
    closeLink();
    code = normCode(code);
    link.host = false; link.code = code; link.quick = false;
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; reject(new Error('timeout')); closeLink(); } }, 15000);
    const peer = makePeer(null, () => {
      const c = peer.connect(PREFIX + code, CHAN);
      bindConn(c);
      c.on('open', () => { if (!done) { done = true; clearTimeout(to); resolve(); } });
      peer.on('error', e => { if (e && e.type === 'peer-unavailable' && !done) { done = true; clearTimeout(to); reject(e); } });
    }, e => { if (!done) { done = true; clearTimeout(to); reject(e); } });
  });
}

// Hızlı Eşleş: önce bekleyen bir ev sahibi ara (lobi yuvaları), yoksa boş bir yuvada ev sahibi ol.
// onState('search'|'host'|'joined') ile arayüz bilgilendirilir.
export function quickMatch(onState) {
  return new Promise((resolve, reject) => {
    closeLink();
    link.quick = true; link.host = false; link.code = '';
    let done = false;
    const finish = (host) => { if (done) return; done = true; link.host = host; resolve(host); };
    onState && onState('search');
    const seeker = makePeer(null, () => {
      const order = shuffled(LOBBY_SLOTS);
      let pending = order.length;
      const tries = [];
      const giveUp = () => { if (done) return; for (const c of tries) { try { c.close(); } catch (e) { /* yok */ } } seeker.destroy(); becomeHost(); };
      seeker.on('error', e => {
        if (e && e.type === 'peer-unavailable') { if (--pending <= 0 && !link.open) giveUp(); }
      });
      for (const i of order) {
        const c = seeker.connect(LOBBY + i, CHAN);
        tries.push(c);
        c.on('open', () => {
          if (link.open || done) { try { c.close(); } catch (e) { /* yok */ } return; }
          for (const o of tries) if (o !== c) { try { o.close(); } catch (e) { /* yok */ } }
          link.code = 'L' + i;
          bindConn(c); link.open = true;
          onState && onState('joined');
          finish(false);
          link.onOpen && link.onOpen();
        });
      }
      // sinyal sunucusu hata döndürmezse 6 sn sonra yine de ev sahibi ol
      setTimeout(() => { if (!done && !link.open) giveUp(); }, 6000);
    }, reject);

    function becomeHost(slot = 0) {
      if (done) return;
      if (slot >= LOBBY_SLOTS) { reject(new Error('lobi dolu')); return; }
      link.host = true; link.code = 'L' + slot; link.quick = true;
      const peer = makePeer(LOBBY + slot, () => { onState && onState('host'); finish(true); }, reject, () => { try { peer.destroy(); } catch (e) { /* yok */ } becomeHost(slot + 1); });
      acceptIncoming(peer);
    }
  });
}

function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Davet linki
export function inviteURL(code) {
  const u = new URL(isNative ? WEB_URL : location.href); u.search = ''; u.hash = ''; u.searchParams.set('oda', code);
  return u.toString();
}
export function codeFromURL() {
  const c = normCode(new URLSearchParams(location.search).get('oda'));
  if (c) history.replaceState(null, '', location.pathname);
  return c.length === 4 ? c : '';
}
export async function shareInvite(code) {
  const url = inviteURL(code);
  if (isNative) { try { await nativeShare({ title: 'FALL', text: 'Birlikte kazalım! Oda: ' + code, url }); return 'shared'; } catch (e) { return 'cancel'; } }
  if (navigator.share) { try { await navigator.share({ title: 'FALL', text: 'Birlikte kazalım! Oda: ' + code, url }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; } }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch (e) { return 'fail'; }
}

// Sefer içi yeniden bağlanma: iki taraf da tohumdan aynı kimliği türetir; ev sahibi bu kimlikle yeniden kayıt olur, misafir ona bağlanır.
export function reconnectId(seed) { return PREFIX + 'rc-' + (seed >>> 0).toString(36); }
function dropPeer() {
  link.open = false;
  try { link.conn && link.conn.close(); } catch (e) { /* yok */ }
  try { link.peer && link.peer.destroy(); } catch (e) { /* yok */ }
  link.conn = null; link.peer = null; link.fast = null; link.fastOk = false;
}
export function reconnectHost(id) {
  return new Promise((resolve, reject) => {
    dropPeer();
    const peer = makePeer(id, () => resolve(), reject, () => reject(new Error('id')));
    acceptIncoming(peer);
  });
}
export function reconnectJoin(id, timeout = 6000) {
  return new Promise((resolve, reject) => {
    dropPeer();
    let done = false;
    const fail = e => { if (!done) { done = true; clearTimeout(to); reject(e); } };
    const to = setTimeout(() => fail(new Error('timeout')), timeout);
    const peer = makePeer(null, () => {
      const c = peer.connect(id, CHAN);
      bindConn(c);
      c.on('open', () => { if (!done) { done = true; clearTimeout(to); resolve(); } });
      peer.on('error', e => { if (e && e.type === 'peer-unavailable') fail(e); });
    }, fail);
  });
}

// fast: girdi/ping gibi anlık veri hızlı kanaldan gider; kanal hazır değilse denetim kanalına düşer
export function send(msg, fast = false) {
  if (!link.conn || !link.open) return;
  try {
    if (fast && link.fastOk && link.fast.readyState === 'open') link.fast.send(JSON.stringify(msg));
    else link.conn.send(msg);
  } catch (e) { /* kapandı */ }
}

export function closeLink() {
  link.open = false;
  try { link.conn && link.conn.close(); } catch (e) { /* yok */ }
  try { link.peer && link.peer.destroy(); } catch (e) { /* yok */ }
  link.conn = null; link.peer = null; link.fast = null; link.fastOk = false; link.code = ''; link.quick = false;
}
