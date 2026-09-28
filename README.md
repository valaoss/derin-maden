# Derin Maden

Dikey (portrait), tek elle oynanan kaz-ve-savun roguelite. Web/PWA, vanilla JS + Canvas 2D.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:8765 (aynı ağdaki telefondan da açılır)
npm run build      # dist/ — statik olarak herhangi bir yerde yayınlanabilir
```

- `node scripts/make-icons.mjs` — PWA ikonlarını yeniden üretir.
- `node scripts/balance-sim.mjs 20` — gerçek oyun modülleriyle headless dalga dengesi simülasyonu
  (`AWAY=1` ile oyuncu derindeyken sadece taretlerin savunduğu senaryo).
- `legacy/index.html` — ilk prototip (karşılaştırma için).

## v4 içeriği

- **10 biyom, ~360 m:** Toprak, Taş, Kök Ormanı, Kobalt, Buz, Kemik Çukuru, Kor, Kristal, Obsidyen, Boşluk Çekirdeği.
  Her biyomun kendi ana kayası, arka duvar rengi, süsleri (kök sarkıtı, buz sarkıtı, kemik, kor, obsidyen kıymığı, ışık zerresi)
  ve atmosfer parçacığı (spor, kar, kor, kül, yıldız tozu) var. Kalp Kristali en dipte.
- **Yeni taşlar:** Yosun (2), Buz (5, kırılınca su verir), Kemik (7), Kor Taşı (12, parlar, kırılınca yakar), Kor (18), Obsidyen (40), Boşluk (60).
  Yeni cevher **Altın**: 2. biyomdan itibaren; kazma ve eklenti alımlarının anahtarı.
- **Kazma dükkânı (Atölye > Kazma):** 8 kademe sırayla satın alınır: Odun, Taş, Demir, Altın, Kobalt, Kristal, Obsidyen, Boşluk.
  Üstüne Keskinlik (güç ×1.75'e kadar) ve Hızlı Sallama (aralık ×0.74'e kadar) yükseltmeleri.
- **Blaster eklentileri (Atölye > Blaster):** 3 yuva (Kalıntı perki ile 4). Pasif: Sekme, Çatal Namlu, Buz Ucu, Yakıcı, Yıldırım, Patlayıcı, Hızlı Ateş.
  Aktif: Aşırı Yük (4 sn üç kat atış), Nova (14 mermilik halka). Aktifler ekranın sağındaki panelden (klavyede Q/E) kullanılır.
- **Dalgalar:** bütçe yaklaşık iki kat, dalgalar arası daha kısa, 3 yuva, doğuş aralığı 0.42 sn, boss her 5 dalgada.
  Dalga 3'ten sonra her dalgada bir **elit** (can ×2.2, taçlı, altın düşürür).
- **Yeni yaratıklar:** Örümcek (ağ atar, yavaşlatır), Örümcekçik (sürü), Örümcek Ana (yumurtlar), Kırağı (dondurur),
  Kemikçi (zırhlı ve hızlı), Kor Böceği (patlar, kor izi), Boşluk Gözü (yanına ışınlanır), Obsidyen Devi.
- **Animasyon:** düşmanlarda nefes alma ve vuruş ezilmesi, kazma iz efekti, elit aurası ve tacı, ışınlanma halkası,
  ağ/soğuk/yanma durum efektleri, yıldırım sıçramaları, biyom renk tonu.

## v3 içeriği

- **Kazma kademeleri:** Odun, Taş, Demir, Altın, Kobalt, Kristal. Matkap seviyesiyle kazma rengi, kıvılcımı ve
  vuruş sesi değişir; Altın ve üstü parlar. Kazma her zaman eldedir: omuzda taşınır, kazarken kaldır-vur döngüsüyle sallanır.
- **Yeni yaratıklar:** Parıldak (kör edici parlama), Çekici (dil uzatıp çeker), Uluyan (korkutan çığlık, sürüyü hızlandırır),
  Gölge (karanlıkta görünmez). Derin katmanlarda çıkar; her birinin kendi sesi vardır.
- **Düşman animasyonları:** hıza göre ezilme/gerilme, saldırı öncesi geri çekilme, flaş + yayılma ölümü, gölgeler.
- **Ana kaya cepleri:** Kenar duvarlarında kilitli kayayla kapalı odacıklar; yalnız dinamit açar, içinde cevher veya sandık.
- **Dinamik joystick:** Ekranın alt yarısında nereye basılırsa merkez orasıdır.
- **Ortam:** Parlayan mantar ve kristaller, damlayan su, üs bacası dumanı, dönen makara, dalgalanan bayrak, alarmda kızaran gök.
- **Birlikte Kaz (2 kişi, çevrim içi):** Menüden oda kurulur, 4 haneli kod paylaşılır, misafir kodla katılır.
  Bağlantı PeerJS/WebRTC ile doğrudan cihazlar arasındadır (sunucu gerekmez, eşleşme PeerJS bulutu üzerinden).
  Simülasyon deterministik lockstep ile iki tarafta aynı çalışır; ara özet karşılaştırmasıyla senkron kaybı bildirilir.
  Zorluk tek kişiye göre yüksektir: düşman bütçesi 1.7x, can 1.3x, kısa sakin süre, yarı üs onarımı, Öz 1.5x;
  ortaklar 20 kareden uzaklaşırsa dalga sayacı hızlanır. Duraklatma ve kayıt kapalıdır.
  Kendi PeerJS sunucun için `.env`: `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_SECURE`, `VITE_PEER_PATH`.

## v2 içeriği

- **Üretim (Atölye > Üret):** Meşale, Dinamit, Tamir Kiti, Barikat, Mayın, Dönüş Fişeği. Üretilen eşyalar
  joystick'in karşı köşesindeki kemerden dokunarak kullanılır (masaüstünde 1–6 tuşları).
- **Şemalar:** Kalıntı sandıkları sırayla Dönüş Fişeği, Mayın, Alev Tareti, Buz Tareti ve Havan şemalarını açar; bir kez bulunan kalıcıdır.
- **Tehlikeler:** Altı boşalan gevşek kaya sallanıp düşer; gaz cepleri kırılınca zehirli bulut salar ve patlamayla tutuşur.
- **Maden Solucanı:** 2. katmandan itibaren, kayanın içinden oyuncuyu avlar ve arkasında tünel bırakır.
- **Kademeler:** Zafer sonrası açılan birikimli zorluk seviyeleri (Öz çarpanı ile).
- **Günün Madeni:** Her gün herkes için aynı harita, günlük rekor. **Kontratlar:** her seferde 2 bonus Öz hedefi.

## Kod haritası

| Klasör | İçerik |
|---|---|
| `src/data/` | Tüm denge sayıları (`balance.js`), tile tanımları, tek renk paleti |
| `src/world/` | Dünya üretimi, harita, ışık yayılımı, düşman akış alanları |
| `src/game/` | Oyuncu/kazı, düşmanlar, savaş, dalgalar, ekonomi, eşyalar (`items.js`), tehlikeler (`hazards.js`), komutlar (`commands.js`), efektler, kayıt |
| `src/net/` | PeerJS oda bağlantısı (`peer.js`) ve deterministik lockstep (`lockstep.js`) |
| `src/core/` | Olay yayını ve tohumlu RNG (`rng.js`, tüm oyun rastgeleliği buradan) |
| `src/render/` | Prosedürel tile "shader"ı + chunk önbelleği, sprite'lar, kare çizimi |
| `src/ui/` | DOM arayüzü (HUD, atölye, menüler, öğretici) ve stil |
| `src/audio/` | WebAudio ile sentezlenen tüm sesler ve ambiyans |

Simülasyon sabit 60 Hz adımla çalışır (ekran yenileme hızından bağımsız); geliştirme modunda
`window.__dm.tick(saniye)` simülasyonu elle ilerletir.
