// Arayüz akış testleri: oyunu başsız Chrome'da gerçek tıklamalarla gezer, "buton var ama işe yaramıyor / ekranda yok /
// çıkış yolu yok" türü mantık hatalarını yakalar. Web ve uygulama (?native) davranışı ayrı ayrı sınanır.
// Ortak mod testleri iki ayrı oyuncu açar ve yalnızca arayüzü kullanır (kod yazıp KATIL'a basmak gibi).
// Kullanım: npm run test:ui   (kendi vite sunucusunu açar; ortak mod için internet gerekir: PeerJS sinyal sunucusu)
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8791, CDP_PORT = 9335, BASE = `http://localhost:${PORT}/`;
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
if (!CHROME) throw new Error('Chrome bulunamadı: CHROME ortam değişkeniyle yolunu ver');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fall-ui-'))}`,
  '--mute-audio', '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch (e) { /* yok */ } try { process.kill(-vite.pid); } catch (e) { /* yok */ } };
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));

let failed = 0, passed = 0;
const results = [];
function check(name, ok, info = '') {
  if (ok) passed++; else failed++;
  results.push(`${ok ? '  ✓' : '  ✗'} ${name}${ok || !info ? '' : '  → ' + info}`);
  console.log(results.at(-1));
}

// ---------- CDP ----------
for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch (e) { /* açılıyor */ } await sleep(200); }
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch (e) { await sleep(200); } }
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const wait = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); const w = wait.get(d.id); if (w) { wait.delete(d.id); d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

// Yeni bir oyuncu (ayrı depolama). native: uygulama davranışı. fresh: ilk açılış (öğretici/hikâye görülmemiş).
async function player({ native = false, fresh = false } = {}) {
  const { browserContextId } = await send('Target.createBrowserContext');
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
  await cdp('Page.navigate', { url: BASE + (native ? '?native' : '') });
  for (let i = 0; i < 100; i++) { await sleep(150); if (await ev(`!!(window.__dm && window.__dm.App && window.__dm.App.scene === 'menu' && document.querySelector('#menu.on'))`).catch(() => false)) break; }
  if (!fresh) await ev(`(() => { const m = __dm.App.meta; m.tutorialDone = true; m.introSeen = true; __dm.UI.showMenu(false); })()`);
  const P = {
    ev, native,
    // görünür mü: boyutu var, gizli değil, kapalı bir <details> içinde değil, ekranın yatay sınırında
    visible: sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
      if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      const d = e.closest('details'); if (d && !d.open && !e.closest('summary')) return false;
      const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.left >= -1 && r.right <= innerWidth + 1; })()`),
    // gerçek kullanıcı gibi: görünmüyorsa basılamaz
    async tap(sel) {
      if (!(await P.visible(sel))) throw new Error('görünmeyen butona basılamaz: ' + sel);
      await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({ block: 'center' }); e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); e.click(); })()`);
      await sleep(120);
    },
    async type(sel, text) {
      if (!(await P.visible(sel))) throw new Error('görünmeyen alana yazılamaz: ' + sel);
      await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); e.value = ''; })()`);
      await cdp('Input.insertText', { text });
      await ev(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new Event('input', { bubbles: true }))`);
    },
    text: sel => ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`),
    screen: () => ev(`[...document.querySelectorAll('.screen.on')].map(s => s.id).join(',')`),
    scene: () => ev('__dm.App.scene'),
    // o an ekranda basılabilir butonlar
    buttons: () => ev(`[...document.querySelectorAll('.screen.on button')].filter(b => b.checkVisibility() && b.getBoundingClientRect().width > 4).map(b => b.id || b.textContent.trim().slice(0, 20))`),
    async until(fn, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(150); } return false; },
  };
  return P;
}
const inMenu = P => P.until(async () => (await P.screen()).includes('menu') && await P.visible('#mNew'));

// ---------- tek oyunculu ekran akışları (web ve uygulama) ----------
for (const native of [false, true]) {
  const tag = native ? '[uygulama]' : '[web]';
  console.log(`\n${tag} menü ve ekranlar`);
  const P = await player({ native });
  await P.until(() => P.visible('#mNew'), 4000);
  check(`${tag} menüde KAZMAYA BAŞLA ve BİRLİKTE görünür`, await P.visible('#mNew') && await P.visible('#mCoop'), `ekran: ${await P.screen()} butonlar: ${(await P.buttons()).join(' | ')}`);

  // her alt ekran açılır ve menüye dönülebilir (çıkmaz ekran yok)
  for (const [btn, back, name] of [['#mSet', null, 'Ayarlar'], ['#mMe', '#pOk', 'Madenci kartı'], ['#mCamp', '#cBack', 'Kamp'], ['#mCoop', '#rBack', 'Birlikte']]) {
    await P.tap(btn);
    const btns = await P.buttons();
    let backSel = back;
    if (!backSel) backSel = await P.ev(`(() => { const b = [...document.querySelectorAll('.screen.on button')].find(b => /GERİ|TAMAM|KAPAT/.test(b.textContent)); return b ? '#' + (b.id || (b.id = 'tmpBack')) : ''; })()`);
    check(`${tag} ${name} ekranı açılıyor ve çıkış butonu var`, btns.length > 0 && !!backSel && await P.visible(backSel), `butonlar: ${btns.join(' | ')}`);
    if (backSel) await P.tap(backSel);
    check(`${tag} ${name} → menüye dönülüyor`, await inMenu(P), await P.screen());
  }

  // Birlikte ekranı: üç yol da görünür ve kullanılabilir olmalı
  await P.tap('#mCoop');
  check(`${tag} Birlikte: HIZLI EŞLEŞ görünür`, await P.visible('#rQuick'));
  check(`${tag} Birlikte: ODA KUR görünür`, await P.visible('#rHost'));
  check(`${tag} Birlikte: ODAYA KATIL kod alanı açıkça görünür`, await P.visible('#rCode'));
  check(`${tag} Birlikte: KATIL butonu görünür`, await P.visible('#rJoin'));
  await P.type('#rCode', 'k7');
  check(`${tag} kod alanı büyük harfe çevirir`, (await P.ev(`document.querySelector('#rCode').value`)) === 'K7');
  await P.tap('#rJoin');
  check(`${tag} eksik kodla KATIL uyarı verir, ekranda kalır`, await P.visible('#rCode') && /4 haneli/.test(await P.ev('document.body.innerText')));
  await P.type('#rCode', 'k7p-x1o0');
  check(`${tag} kod alanı karışan harfleri ve fazlasını atar`, (await P.ev(`document.querySelector('#rCode').value`)) === 'K7PX', await P.ev(`document.querySelector('#rCode').value`));
  const msg = (await P.ev(`import('/src/net/peer.js').then(m => m.invitePayload('H4ZM', ${native}))`)).text;
  await P.type('#rCode', msg);
  check(`${tag} paylaşılan mesajın tamamı yapıştırılınca kod alınır`, (await P.ev(`document.querySelector('#rCode').value`)) === 'H4ZM', await P.ev(`document.querySelector('#rCode').value`));

  // Oda kur: kod görünür, paylaş butonu doğru, uygulamada link yok
  await P.tap('#rHost');
  const hosted = await P.until(async () => /^[A-Z2-9]{4}$/.test((await P.text('.codeline b')).trim()), 15000);
  check(`${tag} ODA KUR → 4 haneli kod ekranda`, hosted, await P.text('.lobby'));
  const shareTxt = await P.text('#rShare');
  check(`${tag} paylaş butonu ${native ? 'KODU PAYLAŞ' : 'DAVET LİNKİ PAYLAŞ'}`, native ? /KODU PAYLAŞ/.test(shareTxt) : /DAVET LİNKİ/.test(shareTxt), shareTxt);
  const payload = await P.ev(`import('/src/net/peer.js').then(m => m.invitePayload(${JSON.stringify((await P.text('.codeline b')).trim())}))`);
  if (native) check(`${tag} davet metninde link/adres yok, kod ve yol tarifi var`, !payload.url && !/https?:|github/i.test(payload.text) && /ODAYA KATIL/.test(payload.text) && /[A-Z2-9]{4}/.test(payload.text), JSON.stringify(payload));
  else check(`${tag} davet linki odaya götürür`, /[?&]oda=[A-Z2-9]{4}/.test(payload.url || ''), JSON.stringify(payload));
  await P.tap('#rLeave');
  check(`${tag} odadan İPTAL → menü`, await inMenu(P));

  // tek oyunculu sefer: başla, duraklat, devam, bitir, menüye dön
  await P.tap('#mNew');
  check(`${tag} KAZMAYA BAŞLA → sefer başlar`, await P.until(async () => (await P.scene()) === 'play'));
  await P.ev(`__dm.hooks.pause(true)`);
  check(`${tag} duraklat menüsünde DEVAM ve SEFERİ BİTİR görünür`, await P.until(() => P.visible('#pRes')) && await P.visible('#pEnd'));
  await P.tap('#pRes');
  check(`${tag} DEVAM → oyun sürer`, await P.until(async () => !(await P.ev('__dm.G.paused'))));
  await P.ev(`__dm.hooks.pause(true)`); await P.until(() => P.visible('#pEnd'));
  await P.tap('#pEnd');
  check(`${tag} SEFERİ BİTİR önce onay ister`, /EMİN/.test(await P.text('#pEnd')) && await P.visible('#pRes'));
  await P.tap('#pEnd');
  check(`${tag} onaydan sonra sonuç ekranı ve ANA MENÜ butonu`, await P.until(() => P.visible('#rMenu'), 8000), (await P.buttons()).join(' | '));
  if (await P.visible('#rMenu')) await P.tap('#rMenu');
  check(`${tag} sonuçtan ANA MENÜ → menü`, await inMenu(P));

  // ilk açılış: öğretici menüsünde de BİRLİKTE ve katılma yolu var
  const F = await player({ native, fresh: true });
  check(`${tag} ilk açılışta BİRLİKTE görünür`, await F.until(() => F.visible('#mCoop'), 6000), `ekran: ${await F.screen()} butonlar: ${(await F.buttons()).join(' | ')}`);
  await F.tap('#mCoop');
  check(`${tag} ilk açılışta da ODAYA KATIL alanı görünür`, await F.visible('#rCode') && await F.visible('#rJoin'));
}

// ---------- ortak mod: iki oyuncu yalnızca arayüzle eşleşir ----------
console.log('\n[ortak mod] arayüzle eşleşme');
async function readyAndPlay(A, B, tag) {
  const bothOpen = await A.until(async () => (await A.visible('#rReady')) && (await B.visible('#rReady')), 20000);
  check(`${tag}: iki tarafta da HAZIRIM butonu çıkar`, bothOpen, `A: ${await A.text('.lobby .lhead')} | B: ${await B.text('.lobby .lhead')}`);
  if (!bothOpen) return;
  await A.tap('#rReady'); await B.tap('#rReady');
  const playing = await A.until(async () => (await A.scene()) === 'play' && (await B.scene()) === 'play', 15000);
  check(`${tag}: ikisi de HAZIRIM → sefer başlar`, playing);
  if (playing) {
    const moving = await A.until(async () => (await A.ev('__dm.net.frame')) > 120 && (await B.ev('__dm.net.frame')) > 120, 10000);
    check(`${tag}: kareler iki tarafta da ilerler (takılma yok)`, moving, `A ${await A.ev('__dm.net.frame')} B ${await B.ev('__dm.net.frame')}`);
    check(`${tag}: eşzamanlılık bozulmadı`, !(await A.ev('__dm.net.desync')) && !(await B.ev('__dm.net.desync')));
  }
}
{
  // uygulamadaki oyuncu oda kurar, uygulamadaki arkadaşı kodu ODAYA KATIL'a yazar
  const A = await player({ native: true }), B = await player({ native: true });
  await A.tap('#mCoop'); await A.tap('#rHost');
  await A.until(async () => /^[A-Z2-9]{4}$/.test((await A.text('.codeline b')).trim()), 15000);
  const code = (await A.text('.codeline b')).trim();
  await B.tap('#mCoop'); await B.type('#rCode', code.toLowerCase()); await B.tap('#rJoin');
  await readyAndPlay(A, B, '[uygulama] oda kur + kodla katıl');
}
{
  // yanlış kod: anlaşılır hata ve geri dönüş yolu
  const B = await player({ native: true });
  await B.tap('#mCoop'); await B.type('#rCode', 'ZZZZ'); await B.tap('#rJoin');
  const err = await B.until(async () => /bulunamadı|SORUN/i.test(await B.text('.lobby')), 20000);
  check('[uygulama] olmayan kod → "oda bulunamadı" hatası', err, await B.text('.lobby'));
  const back = await B.ev(`(() => { const b = document.querySelector('#rLeave'); return !!b; })()`);
  check('[uygulama] hata ekranından GERİ dönülür', back && (await B.tap('#rLeave'), await inMenu(B)));
}
{
  // hızlı eşleş: biri bekler, diğeri bulur
  // iki arkadaş neredeyse aynı anda basar (en sık durum); eşleştikleri kişi gerçekten birbirleri olmalı
  for (const [gap, label] of [[300, 'aynı anda'], [8000, 'biri beklerken']]) {
    const A = await player({ native: true }), B = await player();
    const na = 'TA' + Math.random().toString(36).slice(2, 6), nb = 'TB' + Math.random().toString(36).slice(2, 6);
    await A.ev(`__dm.App.settings.name = '${na}'`); await B.ev(`__dm.App.settings.name = '${nb}'`);
    await A.tap('#mCoop'); await A.tap('#rQuick');
    await sleep(gap);
    await B.tap('#mCoop'); await B.tap('#rQuick');
    const paired = await A.until(async () => (await A.text('.seats')).includes(nb) && (await B.text('.seats')).includes(na), 25000);
    check(`[uygulama+web] hızlı eşleş (${label}): iki oyuncu birbirini bulur`, paired, `A: ${(await A.text('.lobby')).replace(/\s+/g, ' ')} | B: ${(await B.text('.lobby')).replace(/\s+/g, ' ')}`);
    if (paired) await readyAndPlay(A, B, `[uygulama+web] hızlı eşleş (${label})`);
  }
}

console.log(`\n${passed} geçti, ${failed} kaldı`);
cleanup();
process.exit(failed ? 1 : 0);
