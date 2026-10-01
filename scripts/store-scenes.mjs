// App Store ekran görüntüsü sahneleri: her `run` sayfanın içinde çalışır (window.__dm ile).
export const CAPTIONS = {
  tr: {
    kaz: ['KAZ, TOPLA, DERİNE İN', 'Tek elle oynanan kaz-ve-hayatta-kal macerası'],
    boss: ['DEV BOSSLARLA SAVAŞ', 'Her birinin kendine özgü beş yeteneği var'],
    biyom: ['30 BİYOMU KEŞFET', 'Her katmanın kendi taşı, yaratığı ve tehlikesi'],
    yilan: ['DERİNLERDE NE UYUYOR?', 'Gürültü yaparsan uyanırlar'],
    birlikte: ['ARKADAŞINLA BİRLİKTE KAZ', 'İki kişilik çevrim içi ortak sefer'],
    atolye: ['DONANIMINI GÜÇLENDİR', 'Kazmalar, silahlar, eklentiler ve aletler'],
  },
  'en-US': {
    kaz: ['DIG, LOOT, GO DEEPER', 'A one-handed dig-and-survive roguelite'],
    boss: ['FIGHT GIANT BOSSES', 'Each with five skills of its own'],
    biyom: ['EXPLORE 30 BIOMES', 'Every layer has its own rock, creatures and dangers'],
    yilan: ['WHAT SLEEPS BELOW?', 'Make too much noise and it wakes up'],
    birlikte: ['DIG TOGETHER', 'Two-player online co-op'],
    atolye: ['UPGRADE YOUR GEAR', 'Pickaxes, weapons, mods and tools'],
  },
};
// sayfaya bir kez yüklenen yardımcılar
export const PRELUDE = () => {
  const d = window.__dm, wait = ms => new Promise(r => setTimeout(r, ms));
  const TILE = 16, GR = 6, SR = 45;
  window.S = {
    d, wait, TILE, GR, SR,
    async start(opts, meta) {
      Object.assign(d.App.meta, { tutorialDone: true, runs: 23, bestDepth: 412 }, meta);
      d.App.settings.name = 'Deniz';
      d.hooks.newRun(opts); await wait(900);
      const c = document.querySelector('.cards button.card'); if (c) { c.click(); await wait(300); }
      await wait(3400); // sefer afişi ve kontrat bildirimi geçsin
      return d.G;
    },
    // donanım: lv 0..1 arası ilerleme
    kit(k, store) {
      const G = d.G, p = G.player, L = G.lvl;
      Object.assign(L, { drill: Math.round(10 * k), sharp: Math.round(6 * k), swing: Math.round(5 * k), bag: Math.round(8 * k), armor: Math.round(8 * k), blaster: Math.round(12 * k), lamp: 4 });
      for (const q of G.players) { q.maxHp = q.hp = [100, 130, 165, 205, 250, 310, 380, 460, 550][L.armor] || 100; }
      G.bagCap = [12, 20, 32, 50, 75, 110, 160, 230, 320][L.bag] || 12;
      Object.assign(G.store, store);
    },
    // [x, y, saniye] adımlarıyla madenciyi yürütür (kazar, ateş eder); mate: ikinci madencinin adımları
    play(seq, mate, safe) {
      const G = d.G, p = G.player, q = G.players[1];
      let mi = 0, mt = 0;
      for (const [x, y, sec] of seq) for (let i = 0, n = Math.round(sec * 60); i < n; i++) {
        p.inp.x = x; p.inp.y = y; p.inp.mag = x || y ? 1 : 0;
        if (q && mate) { while (mate[mi] && mt >= mate[mi][2]) { mt = 0; mi++; } const m = mate[mi] || [0, 0]; q.inp.x = m[0]; q.inp.y = m[1]; q.inp.mag = m[0] || m[1] ? 1 : 0; mt += 1 / 60; }
        for (const o of G.players) { o.hp = Math.max(o.hp, o.maxHp * 0.8); if (safe) o.iframes = 1; }
        d.step(1 / 60);
      }
      G.cam.snap = true;
    },
    // kareyi dondurur: simülasyon durur, çizim sürer, joystick görünür kalır
    async freeze() {
      const G = d.G; for (const q of G.players) { q.iframes = 0; q.hurtT = 0; }
      G.paused = true; await wait(120);
      document.getElementById('stick').classList.add('show');
    },
    // sandık/seviye kartı açıldıysa ilkini seçer
    async settle() {
      for (let i = 0; i < 6; i++) { const c = document.querySelector('.cards button.card'); if (!c || !c.getClientRects().length) break; c.click(); await wait(350); }
      if (d.G.paused) d.hooks.resume();
    },
    // bildirimleri ve afişi kaldırır (kare temiz çıksın)
    clean() {
      const t = document.getElementById('toasts'); if (t) { t.innerHTML = ''; t.style.display = 'none'; }
      // çanta yarı dolu görünsün
      for (const q of d.G.players) { let left = Math.round(d.G.bagCap * 0.6); for (const k in q.bag) { q.bag[k] = Math.min(q.bag[k], left); left -= q.bag[k]; } }
      const b = document.getElementById('banner'); if (b) b.classList.remove('on');
      const n = document.getElementById('netstall'); if (n) n.style.display = 'none';
      d.UI.refreshHUD(true);
    },
    // kenarı girintili oval mağara açar
    cave(cc, cr, rx, ry) {
      const G = d.G;
      for (let r = Math.floor(cr - ry - 1); r <= cr + ry + 1; r++) for (let c = 3; c <= 13; c++) {
        const k = ((c - cc) / rx) ** 2 + ((r - cr) / ry) ** 2;
        if (k < 1 + 0.22 * Math.sin(c * 2.1 + r * 1.3)) { d.put(c, r, 0); G.rev[r * 17 + c] = 1; }
      }
    },
    // madencinin çevresindeki boşluklara yaratık koyar
    mobs(types, min = 2.5, max = 5.5) {
      const G = d.G, p = G.player, pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE), free = [];
      for (let r = pr - 6; r <= pr + 6; r++) for (let c = 3; c <= 13; c++) { const k = Math.hypot(c - pc, r - pr); if (k >= min && k <= max && G.map[r * 17 + c] === 0) free.push([c, r]); }
      const out = [];
      for (const [i, t] of types.entries()) { if (!free.length) break; const [c, r] = free.splice(Math.floor(free.length * ((i * 0.37 + 0.21) % 1)), 1)[0]; out.push(d.spawn(t, c, r)); }
      return out;
    },
  };
};
export const SCENES = [
  { name: 'kaz', run: async () => {
    const { d, wait, start, play, kit, settle, mobs, clean, freeze } = window.S;
    const G = await start({ seed: 24, startStratum: 0 });
    kit(0.25, { iron: 46, water: 18, cobalt: 7, crystal: 3, gold: 12 });
    play([[0, 1, 1.2], [-1, 0, 1.5], [0, 1, 5], [1, 0, 2], [0, 1, 2.4], [-1, 0, 1.1]]);
    await settle();
    mobs(['bug', 'rodent', 'bug']);
    play([[0, 0, 0.5]], null, true); clean(); await freeze();
    return `y ${G.player.y | 0} en ${G.enemies.length}`;
  } },
  { name: 'boss', run: async () => {
    const { d, wait, start, play, kit, settle, cave, clean, freeze, TILE } = window.S;
    const G = await start({ seed: 24, startStratum: 8 }), p = G.player;
    kit(0.75, { iron: 380, water: 212, cobalt: 164, crystal: 97, gold: 143 });
    p.wpn = 'simsek'; G.gear.wOwn.push('simsek');
    play([[0, 1, 2.2]]);
    await settle();
    const pr = Math.floor(p.y / TILE);
    cave(8, pr + 3, 5.4, 6);
    p.x = p.px = 6 * TILE + 8; p.y = p.py = (pr + 6) * TILE + 8;
    G.enemies.length = 0;
    const e = d.spawn('otegoz', 9, pr + 1);
    G.threat.bossUp = true; G.threat.bossType = 'otegoz'; G.threat.noise = 100;
    play([[0, 0, 0.3]]);
    e.bs.q = ['spiral']; e.bs.cd.gap = 0; e.bs.cd.melee = 99;
    play([[1, 0, 0.3], [0, 0, 1.6]], null, true); clean(); await freeze();
    return `act ${e.bs.act && e.bs.act.k} hp ${e.hp | 0}`;
  } },
  { name: 'biyom', run: async () => {
    const { d, wait, start, play, kit, settle, mobs, clean, freeze } = window.S;
    const G = await start({ seed: 24, startStratum: 14 });
    kit(0.85, { iron: 612, water: 340, cobalt: 288, crystal: 190, gold: 256, yesim: 14, opal: 9 });
    G.player.wpn = 'makineli'; G.gear.wOwn.push('makineli');
    play([[0, 1, 2], [1, 0, 2.5], [0, 1, 3], [-1, 0, 3], [0, 1, 2.5], [1, 0, 1]]);
    await settle();
    mobs(['sporeling', 'flyer', 'sporeling', 'sporeling'], 2.5, 4.5);
    play([[0, 0, 0.7]], null, true); clean(); await freeze();
    return `y ${G.player.y | 0} en ${G.enemies.length}`;
  } },
  { name: 'yilan', run: async () => {
    const { d, wait, start, play, kit, settle, clean, freeze, TILE } = window.S;
    const G = await start({ seed: 24, startStratum: 29 }), p = G.player;
    kit(1, { iron: 940, water: 655, cobalt: 512, crystal: 430, gold: 388, yesim: 31, opal: 22, inci: 17, akik: 12 });
    p.wpn = 'tufek'; G.gear.wOwn.push('tufek');
    play([[0, 1, 2.5], [-1, 0, 1.6], [0, 1, 1.5]]);
    await settle();
    G.enemies.length = 0;
    const e = d.spawn('dunyaYilani', 0, 0); e.x = e.px = 280; e.y = e.py = p.y; e.firstRear = true; e.nextFrom = 1;
    G.serpent = { st: 'fight', t: 0 }; G.threat.bossUp = true; G.threat.bossType = 'dunyaYilani';
    let n = 0; for (; n < 1500; n++) { play([[0, 0, 1 / 60]], null, true); const sv = e.bs && e.bs.sv; if (sv && sv.m === 'rear' && sv.hold < 2.2) break; }
    clean(); await freeze();
    document.getElementById('stick').classList.remove('show'); // gövdenin üstüne denk geliyor
    return `m ${e.bs.sv.m} n ${n}`;
  } },
  { name: 'birlikte', run: async () => {
    const { d, wait, start, play, kit, settle, clean } = window.S;
    const G = await start({ seed: 24, mp: true, names: ['Deniz', 'Ada'], helms: [0, 3], localIdx: 0, startStratum: 5 });
    kit(0.5, { iron: 190, water: 96, cobalt: 71, crystal: 38, gold: 64 });
    for (const q of G.players) q.inp = q.inp || { x: 0, y: 0, mag: 0 };
    play([[0, 1, 2], [1, 0, 2], [0, 1, 2.5], [-1, 0, 1.2]], [[0, 1, 2.6], [-1, 0, 1.6], [0, 1, 2], [1, 0, 0.6], [0, 0, 9]]);
    await settle(); clean();
    d.UI.chatBubble(1, 'gj');
    await wait(300); clean();
    return `players ${G.players.length} en ${G.enemies.length}`;
  } },
  { name: 'atolye', run: async () => {
    const { d, wait, start, kit } = window.S;
    const G = await start({ seed: 24, startStratum: 0 });
    kit(0.4, { iron: 214, water: 88, cobalt: 62, crystal: 35, gold: 71, yesim: 4 });
    d.UI.refreshHUD(true);
    document.getElementById('workshopBtn').click(); await wait(500);
    const t = document.getElementById('testBtn'); if (t) t.classList.add('hide');
    return `sheet ${d.UI.sheetOpen()}`;
  } },
];
