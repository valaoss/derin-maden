// Ortak mod gecikme ölçümü: başsız Chrome'da iki istemci açar, oda kurup bağlar, oynatır ve ölçer.
// Önce `npm run dev` çalışıyor olmalı. Kullanım: node scripts/net-probe.mjs [tek yön yapay gecikme ms] [süre sn]
// Ölçülenler: ping (net.rtt), girdi gecikmesi (net.delay kare), bekleme (takılma) sayısı. JITTER=ms ile dalgalanma eklenir.
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL0 = process.env.PROBE_URL || 'http://localhost:8765/';
const LAG = +(process.argv[2] || 0), SECS = +(process.argv[3] || 20), JIT = +(process.env.JITTER || 0);
const PORT = 9334;
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fall-net-'))}`,
  '--mute-audio', '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch (e) { await sleep(200); } }
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const wait = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); const w = wait.get(d.id); if (w) { wait.delete(d.id); d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

async function client() {
  const { browserContextId } = await send('Target.createBrowserContext');   // ayrı depolama: iki ayrı oyuncu
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const cdp = (m, p) => send(m, p, sessionId);
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  const ev = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await cdp('Page.navigate', { url: URL0 });
  for (let i = 0; i < 100; i++) { await sleep(200); if (await ev('!!(window.__dm && window.__dm.G && window.__dm.App.scene)').catch(() => false)) break; }
  // öğretici ve hikâye geçilmiş say (ilk açılış kartları test akışını kesmesin)
  await ev(`(() => { const m = __dm.App.meta; m.tutorialDone = true; m.introSeen = true; m.storySeen = true; })()`);
  return { ev, cdp };
}

const A = await client(), B = await client();
await A.ev('__dm.hooks.hostRoom()');
let code = '';
for (let i = 0; i < 60 && !code; i++) { await sleep(250); code = await A.ev('__dm.link.code'); }
if (!code) throw new Error('oda kurulamadı (sinyal sunucusu?)');
await B.ev(`__dm.hooks.joinRoom(${JSON.stringify(code)})`);
for (let i = 0; i < 60; i++) { await sleep(250); if (await A.ev('__dm.link.open') && await B.ev('__dm.link.open')) break; }
await sleep(800);
await A.ev('__dm.hooks.ready(true)'); await B.ev('__dm.hooks.ready(true)');
for (let i = 0; i < 80; i++) { await sleep(250); if (await A.ev(`__dm.App.scene === 'play' && __dm.net.on`) && await B.ev(`__dm.App.scene === 'play' && __dm.net.on`)) break; }
if (!(await A.ev(`__dm.App.scene`) === 'play')) throw new Error('sefer başlamadı');
// yapay gecikme: gelen her paketi LAG±JIT ms sonra işle (WebRTC'ye ağ emülasyonu uygulanmadığı için uygulama katmanında; sefer başladıktan sonra)
for (const c of [A, B]) if (LAG || JIT) await c.ev(`(() => { const L = __dm.link, fn = L.onMessage;
  L.onMessage = d => setTimeout(() => fn(d), Math.max(0, ${LAG} + (Math.random() * 2 - 1) * ${JIT})); })()`);

// her saniye iki tarafın ağ durumu örneklenir
const t0 = Date.now(); const rows = [];
while (Date.now() - t0 < SECS * 1000) {
  await sleep(1000);
  const s = await A.ev(`({ rtt: Math.round(__dm.net.rtt), delay: __dm.net.delay, stalls: __dm.net.stalls, q: __dm.net.quality, frame: __dm.net.frame, fast: __dm.link.fastOk, lead: +__dm.net.lead.toFixed(1) })`);
  const sb = await B.ev(`({ rtt: Math.round(__dm.net.rtt), delay: __dm.net.delay, stalls: __dm.net.stalls, frame: __dm.net.frame, desync: __dm.net.desync })`);
  rows.push([s, sb]);
  console.log(`t=${Math.round((Date.now() - t0) / 1000)}s  A ping ${s.rtt}ms gecikme ${s.delay} kare (${Math.round(s.delay * 1000 / 60)}ms) bekleme ${s.stalls} hızlı:${s.fast} | B ping ${sb.rtt}ms gecikme ${sb.delay} bekleme ${sb.stalls} kare farkı ${s.frame - sb.frame}${sb.desync ? ' DESYNC' : ''}`);
}
const last = rows.at(-1);
console.log(JSON.stringify({ lagOneWay: LAG, jitter: JIT, pingA: last[0].rtt, pingB: last[1].rtt, delayFrames: last[0].delay, inputLagMs: Math.round(last[0].delay * 1000 / 60), stallsA: last[0].stalls, stallsB: last[1].stalls, fastChannel: last[0].fast }));
process.exit(0);
