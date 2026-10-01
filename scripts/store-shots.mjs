// App Store ekran görüntüleri: başsız Chrome'u DevTools protokolüyle sürer (bağımlılık yok).
// Önce `npm run dev` çalışıyor olmalı. Kullanım: node scripts/store-shots.mjs [çıktı klasörü] [sahne adı]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SCENES, CAPTIONS, PRELUDE } from './store-scenes.mjs';

const URL0 = process.env.SHOT_URL || 'http://localhost:8765/';
const OUT = resolve(process.argv[2] || 'appstore/screenshots');
const ONLY = process.argv[3] || '';
const RAW = !!process.env.SHOT_RAW;
const PORT = 9333;
const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
if (!CHROME) throw new Error('Chrome bulunamadı: CHROME ortam değişkeniyle yolunu ver');

// mağaza boyutları: w,h mantıksal piksel, s ölçek (çıktı = w*s x h*s); top/side/bottom: başlık ve çerçeve payları;
// k: çerçevedeki oyunun büyütmesi (iPad'de oyun telefon sütunu kadar yer kaplar, çerçeveyi doldursun diye büyütülür)
const DEVICES = {
  'iphone-6.9': { w: 440, h: 956, s: 3, top: 172, side: 30, bottom: 30, k: 1, font: 40, sub: 17, rad: 26 },   // 1320 x 2868
  'ipad-13': { w: 1032, h: 1376, s: 2, top: 192, side: 204, bottom: 44, k: 1.2, font: 58, sub: 25, rad: 30 },   // 2064 x 2752
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fall-shots-'))}`,
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); return v.webSocketDebuggerUrl; } catch (e) { await sleep(200); }
  }
  throw new Error('Chrome açılmadı');
}
const ws = new WebSocket(await connect());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const wait = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); const w = wait.get(d.id); if (w) { wait.delete(d.id); d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
const cdp = (m, p) => send(m, p, S);
await cdp('Page.enable'); await cdp('Runtime.enable');
async function evaluate(expression) {
  const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
const metrics = (w, h, s) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: s, mobile: true });
const shot = async () => Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64');
async function load(url) {
  await cdp('Page.navigate', { url });
  for (let i = 0; i < 100; i++) { await sleep(150); if (await evaluate('!!(window.__dm && window.__dm.App && window.__dm.App.scene === "menu")').catch(() => false)) return; }
  throw new Error('Oyun açılmadı: ' + url);
}

const font = n => readFileSync(`node_modules/@fontsource/tiny5/files/tiny5-${n}-400-normal.woff2`).toString('base64');
const FONT = font('latin'), FONT_EXT = font('latin-ext');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function frameHTML(D, png, cap) {
  const fw = D.w - D.side * 2, fh = D.h - D.top - D.bottom;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
@font-face { font-family: T5; src: url(data:font/woff2;base64,${FONT}) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F; }
@font-face { font-family: T5; src: url(data:font/woff2;base64,${FONT_EXT}) format('woff2'); unicode-range: U+0100-0130, U+0132-0151, U+0154-02FF, U+1E00-1EFF, U+20A0-20C0; }
* { margin: 0; box-sizing: border-box; }
body { width: ${D.w}px; height: ${D.h}px; overflow: hidden; background: radial-gradient(120% 70% at 50% 0%, #4a2a5e 0%, #24143a 45%, #0b0712 100%); font-family: T5, monospace; text-align: center; }
.cap { height: ${D.top}px; display: flex; flex-direction: column; justify-content: center; gap: ${Math.round(D.font * 0.25)}px; padding: ${Math.round(D.font * 0.3)}px ${Math.round(D.side * 0.6)}px 0; }
h1 { text-wrap: balance; font-weight: 400; font-size: ${D.font}px; line-height: 1; color: #ffd870; text-shadow: 0 ${Math.round(D.font / 13)}px 0 #7a4a1a, 0 0 ${D.font}px rgba(255,170,60,.35); letter-spacing: 1px; }
p { font-size: ${D.sub}px; line-height: 1.25; color: #e8dcc8; opacity: .92; }
.fr { width: ${fw}px; height: ${fh}px; margin: 0 auto; border-radius: ${D.rad}px; overflow: hidden; box-shadow: 0 0 0 ${Math.round(D.rad / 6)}px #140c1c, 0 0 0 ${Math.round(D.rad / 6) + 2}px #6a4a86, 0 ${D.rad}px ${D.rad * 3}px rgba(0,0,0,.6); background: #0b0712; }
img { width: ${fw}px; height: ${fh}px; display: block; image-rendering: pixelated; }
</style></head><body><div class="cap"><h1>${esc(cap[0])}</h1><p>${esc(cap[1])}</p></div><div class="fr"><img src="data:image/png;base64,${png.toString('base64')}"></div></body></html>`;
}

try {
  for (const [dev, D] of Object.entries(DEVICES)) {
    const fw = D.w - D.side * 2, fh = D.h - D.top - D.bottom;
    const raws = [];
    for (const [i, sc] of SCENES.entries()) {
      if (ONLY && sc.name !== ONLY) continue;
      await metrics(RAW ? D.w : Math.round(fw / D.k), RAW ? D.h : Math.round(fh / D.k), RAW ? D.s : D.s * D.k);
      await load(URL0);
      await evaluate(`(${PRELUDE.toString()})()`);
      const info = await evaluate(`(${sc.run.toString()})(${JSON.stringify({ dev })})`);
      await sleep(80);
      raws.push([i, sc, await shot()]);
      console.log(dev, sc.name, info || '');
    }
    for (const [i, sc, png] of raws) {
      for (const lang of Object.keys(CAPTIONS)) {
        const dir = join(OUT, lang); mkdirSync(dir, { recursive: true });
        const file = join(dir, `${dev}_${String(i + 1).padStart(2, '0')}_${sc.name}.png`);
        if (RAW) { writeFileSync(file, png); continue; }
        await metrics(D.w, D.h, D.s);
        await cdp('Page.navigate', { url: 'about:blank' });
        const { frameTree } = await cdp('Page.getFrameTree');
        await cdp('Page.setDocumentContent', { frameId: frameTree.frame.id, html: frameHTML(D, png, CAPTIONS[lang][sc.name]) });
        await evaluate('document.fonts.ready.then(() => new Promise(r => { const im = document.querySelector("img"); im.complete ? r() : im.onload = r; }))');
        await sleep(150);
        writeFileSync(file, await shot());
      }
    }
  }
} finally {
  ws.close(); chrome.kill();
}
