// Oda tabanlı eşleşme: PeerJS (WebRTC DataChannel). Oda kodu = peer kimliği.
// Varsayılan olarak PeerJS'in ücretsiz bulut sinyal sunucusu kullanılır; kendi sunucun için VITE_PEER_HOST/PORT ver.
import { Peer } from 'peerjs';

const PREFIX = 'derinmaden-v3-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan harfler yok (I/O/0/1)

export function makeCode() {
  let s = '';
  const a = new Uint32Array(4); crypto.getRandomValues(a);
  for (let i = 0; i < 4; i++) s += ALPHABET[a[i] % ALPHABET.length];
  return s;
}
export function normCode(s) { return (s || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4); }

function peerOpts() {
  const host = import.meta.env.VITE_PEER_HOST;
  const o = { debug: 0, config: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] } };
  if (host) { o.host = host; o.port = +(import.meta.env.VITE_PEER_PORT || 443); o.secure = import.meta.env.VITE_PEER_SECURE !== '0'; o.path = import.meta.env.VITE_PEER_PATH || '/'; }
  return o;
}

export const link = {
  peer: null, conn: null, host: false, code: '', open: false,
  onMessage: null, onOpen: null, onClose: null, onError: null,
};

function bindConn(c) {
  link.conn = c;
  c.on('open', () => { link.open = true; link.onOpen && link.onOpen(); });
  c.on('data', d => { link.onMessage && link.onMessage(d); });
  c.on('close', () => { link.open = false; link.onClose && link.onClose('closed'); });
  c.on('error', e => { link.onError && link.onError(String(e && e.type || e)); });
}

// Oda kur: kod üretir, misafiri bekler
export function hostRoom() {
  return new Promise((resolve, reject) => {
    closeLink();
    const code = makeCode();
    const peer = new Peer(PREFIX + code, peerOpts());
    link.peer = peer; link.host = true; link.code = code;
    peer.on('open', () => resolve(code));
    peer.on('connection', c => { if (link.conn) { c.close(); return; } bindConn(c); });
    peer.on('error', e => {
      const t = e && e.type;
      if (t === 'unavailable-id') { closeLink(); hostRoom().then(resolve, reject); return; } // kod çakıştı: yeniden dene
      link.onError && link.onError(t || 'peer'); reject(e);
    });
    peer.on('disconnected', () => { if (!link.open) peer.reconnect(); });
  });
}

// Odaya katıl
export function joinRoom(code) {
  return new Promise((resolve, reject) => {
    closeLink();
    code = normCode(code);
    const peer = new Peer(peerOpts());
    link.peer = peer; link.host = false; link.code = code;
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; reject(new Error('timeout')); closeLink(); } }, 15000);
    peer.on('open', () => {
      const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      bindConn(c);
      c.on('open', () => { if (!done) { done = true; clearTimeout(to); resolve(); } });
    });
    peer.on('error', e => { if (!done) { done = true; clearTimeout(to); reject(e); } else link.onError && link.onError(e && e.type); });
  });
}

export function send(msg) { if (link.conn && link.open) { try { link.conn.send(msg); } catch (e) { /* kapandı */ } } }

export function closeLink() {
  link.open = false;
  try { link.conn && link.conn.close(); } catch (e) { /* yok */ }
  try { link.peer && link.peer.destroy(); } catch (e) { /* yok */ }
  link.conn = null; link.peer = null; link.code = '';
}
