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
| `src/game/` | Oyuncu/kazı, düşmanlar, savaş, dalgalar, ekonomi, eşyalar (`items.js`), tehlikeler (`hazards.js`), efektler, kayıt |
| `src/render/` | Prosedürel tile "shader"ı + chunk önbelleği, sprite'lar, kare çizimi |
| `src/ui/` | DOM arayüzü (HUD, atölye, menüler, öğretici) ve stil |
| `src/audio/` | WebAudio ile sentezlenen tüm sesler ve ambiyans |

Simülasyon sabit 60 Hz adımla çalışır (ekran yenileme hızından bağımsız); geliştirme modunda
`window.__dm.tick(saniye)` simülasyonu elle ilerletir.
