# Derin Maden

Dikey (portrait), tek elle oynanan kaz-ve-hayatta-kal roguelite. Web/PWA, vanilla JS + Canvas 2D. Tek başına ya da iki kişi çevrim içi.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:8765 (aynı ağdaki telefondan da açılır)
npm run build      # dist/ — statik olarak herhangi bir yerde yayınlanabilir
```

- `node scripts/make-icons.mjs` — PWA ikonlarını yeniden üretir.
- `npm run sim` — gerçek oyun modülleriyle headless uyanış dengesi simülasyonu (biyom başına gürültü/seviye/düşman/bayılma).
- `legacy/index.html` — ilk prototip (karşılaştırma için).

## v5: Uyanış döngüsü (dalga yok)

- **Gürültü ölçeri:** Kazma, blaster, dinamit ve mayın gürültü üretir; derinlik çarpanı vardır. Sessiz kalınca söner, kampta (yüzey) hızla sıfırlanır.
  Seviyeler: **Sessiz → Kıpırtı (25) → Uyanış (50) → Öfke (75, elitler) → Derin Ana (100 birkaç saniye sürerse, seni avlar).**
- **Yuvalar:** Her biyomda 2-3 kovan kayaya gömülüdür. Uyanık yuva yakınındaki oyuncuya düşman çıkarır (menzil seviyeyle büyür).
  Yuvayı kazma ya da mermiyle yık: ganimet düşer, ölçer düşer. Yakın yuva kalmadıysa yüksek gürültüde kayadan sızma olur.
- **Fenerler (amaç):** Bir biyomun tüm yuvaları yıkılınca Fener dikilir. Fenerler kalıcıdır; sonraki seferde **fener asansörü**
  temizlenmiş biyomların altına iner (menüden kapatılabilir). Final hedef en dipteki Kalp Kristali'ni yüzeye taşımak.
- **Düşmanlar seni avlar:** Üs canı yok, kamp güvenli bölgedir; düşman yüzeye çıkamaz. Akış alanı oyunculara doğru çözülür,
  yeraltında oyuncu kalmazsa düşmanlar izi kaybedip kayaya çekilir.
- **Düşme ve kaldırma:** Can bitince ölmezsin, bayılırsın. Partner 1.6 sn yanında durursa kaldırır (%50 can); 25 sn içinde kaldırılmazsan
  partner kampa dönene kadar beklersin. Herkes düşerse sefer biter. Tek oyunculuda düşmek seferi bitirir; **İkinci Nefes** perk'i ve
  kamptaki **Sağlık Sigortası** sefer başına bir kez kendin kalkmanı sağlar.
- **Taşınabilir aletler:** Yüzey yuvaları kaldırıldı. Atölye > Üret'ten Nöbetçi, Fener Direği (ışık + çevresinde gürültü ×0.5), Onarım,
  Alev/Buz Kulesi, Havan üretilir; kemerden durduğun yere (tünel içi dahil) kurulur, dokunup geri alınır. Aynı anda en fazla 2 (perk ile 3);
  sınırda en eski alet kemere döner.
- **Öz:** yıkılan yuva ×6, fener ×20, derinlik, sandık, cevher. Kontratlar: `waves` yerine `nests` (yuva yık).
- **Asansör (sefer içi):** Merkez şaft. Bir biyoma ilk ulaştığında istasyonu açılır ve şaft oraya kadar kazılır; şaftta durunca
  ASANSÖR düğmesi çıkar, Kamp ya da açılmış biyomu seç, kabin seni taşır (kabinde hasar yok, Kalp Kristali ile yavaş). Her biyomda git-gel yok.
- **Düşman yoğunluğu:** Sessizde bile yakın yuva (7 blok) tek tük düşman verir, kayadan sızma her seviyede; üst sınır 2/5/8/12/16,
  Uyanış'ta 1-2, Öfke'de 2-3 düşman birden çıkar. İlk biyom yeni oyuncu için daha seyrek. `npm run sim` ~20 düşman/dk gösterir.
- **Roller:** Madenci kartında seçilir; Kazıcı (kazma %20 hızlı, kazı gürültüsü %25 az), Nişancı (blaster hasarı +%25, menzil +12),
  Mühendis (alet sınırı +1, aletler %40 dayanıklı). Co-op'ta partnerin rolü koltuk kartında görünür.
- **Maden olayları:** Yeraltında ve ölçer sessiz değilken 55-95 sn'de bir olay: **Sarsıntı** (uyarıdan 2.5 sn sonra tavan çöker),
  **Gaz sızıntısı** (yakın boşluklara bulut), **Karartma** (18 sn fener yarı menzil). Deterministik; iki tarafta da aynı anda olur.
- **Maden kanaryası (Kamp):** yerel oyuncuyu izleyen kuş; 11 blok içindeki gizli yuvayı sezip ok gösterir, gürültü eşiğe yaklaşınca öter.
- **Ölüm yankısı:** Tek oyunculuda bayılıp cevherli çantan kaldıysa, sonraki seferde aynı derinlikte parlayan çanta olarak bekler.
- **Fotoğraf modu:** Duraklat > Fotoğraf Çek; HUD'suz kare + filigran, telefonda paylaşım menüsü, masaüstünde PNG indirme.

## Birlikte Kaz (2 kişi, çevrim içi)

- **Lobi:** Madenci kartı (ad + 6 kask rengi, partnerin görür). **Hızlı Eşleş** sunucusuz lobi yuvalarıyla bekleyen birini bulur, yoksa seni bekletir.
  **Oda Kur** davet linki üretir (`?oda=KOD`); telefonda paylaşım menüsü, masaüstünde panoya kopyalar; linke tıklayan doğrudan odaya düşer.
  Koltuk kartları ve HAZIR akışı; 4 haneli kod girişi yedek olarak kalır.
- **Ağ (donmaya karşı):** deterministik lockstep, ölçülen ping ve geç gelen girdilere göre kendini ayarlayan girdi gecikmesi (3-16 kare),
  sırasız DataChannel üzerinden her pakette son 8 karenin girdisi (kayıp/gecikme telafisi), hız eşitleme (önde olan %30 yavaşlar),
  yumuşak yakalama, arka plana alınan sekmede Worker zamanlayıcısıyla simülasyonun sürmesi. HUD'da ping ve bağlantı kalitesi.
  Ara özet karşılaştırmasıyla senkron kaybı bildirilir.
- **Peak hissi:** Basılı tut (masaüstünde sağ tık ya da X) → partnerin ekranında işaret ve kenar oku. Hızlı mesaj çipleri
  (Buraya gel, Yardım, Kampa dönelim, İyi iş, Yuva buldum, Sessiz ol) baloncuk olarak görünür. Partner baygınsa HUD uyarır.
- Zorluk: düşman canı ×1.3, gürültü ×1.15, Öz ×1.5. Duraklatma ve kayıt kapalıdır.
- Kendi PeerJS sunucun için `.env`: `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_SECURE`, `VITE_PEER_PATH`.
  NAT arkasında kalanlar için TURN: `VITE_TURN_URL` (virgülle birden çok), `VITE_TURN_USER`, `VITE_TURN_PASS`.

## Önceki içerik (v2-v4)

- **10 biyom, ~360 m:** Toprak, Taş, Kök Ormanı, Kobalt, Buz, Kemik Çukuru, Kor, Kristal, Obsidyen, Boşluk Çekirdeği; her birinin kayası, süsü ve atmosferi.
- **Kazma dükkânı:** 8 kademe (Odun → Boşluk), Keskinlik ve Hızlı Sallama. **Blaster eklentileri:** 3 yuva, 7 pasif + Aşırı Yük ve Nova.
- **Yaratıklar:** Kemirgen, Kabukbiti, Tükürgen, Yarasa, Kristalböcek, Kaya Devi, Maden Solucanı, Parıldak, Çekici, Uluyan, Gölge,
  Örümcek/Örümcekçik/Örümcek Ana, Kırağı, Kemikçi, Kor Böceği, Boşluk Gözü, Obsidyen Devi ve Derin Ana. Elitler taçlı, altın düşürür.
- **Üretim:** Meşale, Dinamit, Tamir Kiti, Barikat, Mayın, Dönüş Fişeği; şemalar Kalıntı sandıklarından kalıcı açılır.
- **Tehlikeler:** göçük, gaz cebi (patlamayla tutuşur), ana kaya cepleri (yalnız dinamit açar), kor taşı.
- **Kademeler**, **Günün Madeni**, **Kontratlar**, **Kamp** (kalıcı Öz yükseltmeleri).

## Kod haritası

| Klasör | İçerik |
|---|---|
| `src/data/` | Tüm denge sayıları (`balance.js`: THREAT, BUILDS, ITEMS…), tile tanımları, tek renk paleti |
| `src/world/` | Dünya üretimi (yuvalar dahil), harita, ışık yayılımı, oyunculara doğru akış alanları |
| `src/game/` | Oyuncu/kazı/düşme (`player.js`), uyanış ve yuvalar (`threat.js`), düşmanlar, savaş, ekonomi ve aletler, eşyalar, tehlikeler, işaretler (`pings.js`), komutlar, efektler, kayıt |
| `src/net/` | PeerJS eşleşme: hızlı eşleş, oda, davet linki (`peer.js`); uyarlanabilir lockstep (`lockstep.js`) |
| `src/core/` | Olay yayını ve tohumlu RNG (`rng.js`, tüm oyun rastgeleliği buradan) |
| `src/render/` | Prosedürel tile "shader"ı + chunk önbelleği, sprite'lar (kask paletleri, yuva), kare çizimi |
| `src/ui/` | DOM arayüzü (HUD, atölye, lobi, menüler, öğretici) ve stil |
| `src/audio/` | WebAudio ile sentezlenen tüm sesler ve ambiyans |

Simülasyon sabit 60 Hz adımla çalışır (ekran yenileme hızından bağımsız); geliştirme modunda
`window.__dm.tick(saniye)` simülasyonu elle ilerletir, `window.__dm.noise(v)` ölçeri ayarlar.

## Test

- `npm test` — DOM'suz oyun testleri (`tests/sim.test.mjs`): dünya üretimi, taş düşürmeleri, ekonomi, uyanış ve yuvalar, düşme/kaldırma ve aletler,
  partner işareti, yaratıklar, determinizm, kayıt/yükleme, 10 biyomluk derin sefer, performans.
- `npm run sim` — uyanış dengesi simülasyonu (biyom başına tepe gürültü, seviye süreleri, düşman ve bayılma sayıları).
