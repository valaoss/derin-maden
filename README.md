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

## Kod haritası

| Klasör | İçerik |
|---|---|
| `src/data/` | Tüm denge sayıları (`balance.js`), tile tanımları, tek renk paleti |
| `src/world/` | Dünya üretimi, harita, ışık yayılımı, düşman akış alanları |
| `src/game/` | Oyuncu/kazı, düşmanlar, savaş, dalgalar, ekonomi, efektler, kayıt |
| `src/render/` | Prosedürel tile "shader"ı + chunk önbelleği, sprite'lar, kare çizimi |
| `src/ui/` | DOM arayüzü (HUD, atölye, menüler, öğretici) ve stil |
| `src/audio/` | WebAudio ile sentezlenen tüm sesler ve ambiyans |

Simülasyon sabit 60 Hz adımla çalışır (ekran yenileme hızından bağımsız); geliştirme modunda
`window.__dm.tick(saniye)` simülasyonu elle ilerletir.
