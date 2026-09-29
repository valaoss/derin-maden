# FALL

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

- **Gürültü ölçeri:** Kazma, silah ve dinamit gürültü üretir; derinlik çarpanı vardır. Sessiz kalınca söner, kampta (yüzey) hızla sıfırlanır.
  Seviyeler: **Sessiz → Kıpırtı (25) → Uyanış (50) → Öfke (75, elitler) → Av (100 birkaç saniye sürerse derinliğine göre bir boss uyanır).**
- **Bosslar (her 4 biyomda bir, %50 canda öfkelenir):** yerde yanıp sönen uyarılar, adı ve unvanıyla afiş, can çubuğunda adı.
  - **Karakök**, Toprağın Düğümü: kök mızrakları, toprağa dalıp altından çıkar (altındayken vurulmaz); öfkede kökçük çağırır.
  - **Kavurgan**, Kül ve Kemik Ejderi: kor nefesi (koni, öfkede seni izler), kül yağmuru; öfkede kemik halkası.
  - **Ötegöz**, Boşluğa Bakan: güdümlü boşluk küreleri, çekim bakışı, ışınlanma; öfkede kayada kesilen tarayan ışın.
  - **Taçsız Sultan**, Altın Sarayın Laneti: kayayı yararak hücum (sonra sersemler), asa şok halkası, altın yelpazesi; öfkede çift hücum.
  - **Ezelî**, Çekirdeğin Rüyası: yargı sütunları, Kıyamet Halkası (kayanın arkasına saklan); öfkede iki Işık Bekçisi.
- **Yuvalar:** Her biyomda 2-3 kovan kayaya gömülüdür. Uyanık yuva yakınındaki oyuncuya düşman çıkarır (menzil seviyeyle büyür).
  Yuvayı kazma ya da mermiyle yık: ganimet düşer, ölçer düşer. Yakın yuva kalmadıysa yüksek gürültüde kayadan sızma olur.
- **Fenerler (amaç):** Bir biyomun tüm yuvaları yıkılınca Fener dikilir. Fenerler kalıcı ilerleme sayacıdır; her sefer yüzeyden
  başlar (kaldığın biyomdan devam şimdilik kapalı). Final hedef en dipteki Kalp Kristali'ni yüzeye taşımak.
- **Düşmanlar seni avlar:** Üs canı yok, kamp güvenli bölgedir; düşman yüzeye çıkamaz. Akış alanı oyunculara doğru çözülür,
  yeraltında oyuncu kalmazsa düşmanlar izi kaybedip kayaya çekilir.
- **Düşme ve kaldırma:** Can bitince ölmezsin, bayılırsın. Partner 1.6 sn yanında durursa kaldırır (%50 can); 25 sn içinde kaldırılmazsan
  partner kampa dönene kadar beklersin. Herkes düşerse sefer biter. Tek oyunculuda düşmek seferi bitirir; **İkinci Nefes** perk'i ve
  kamptaki **Sağlık Sigortası** sefer başına bir kez kendin kalkmanı sağlar.
- **Taşınabilir aletler:** Yüzey yuvaları kaldırıldı. Atölye > Üret'ten Nöbetçi, Alev Kulesi ve Havan
  üretilir; kemerden durduğun yere (tünel içi dahil) kurulur, dokunup geri alınır. Aynı anda en fazla 2 (perk ile 3);
  sınırda en eski alet kemere döner.
- **Öz:** yıkılan yuva ×6, fener ×20, derinlik, sandık, cevher. Kontratlar: `waves` yerine `nests` (yuva yık).
- **Asansör (sefer içi):** Merkez şaft. Bir biyoma ilk ulaştığında istasyonu açılır ve şaft oraya kadar kazılır; şaftta durunca
  ASANSÖR düğmesi çıkar, Kamp ya da açılmış biyomu seç, kabin seni taşır (kabinde hasar yok, Kalp Kristali ile yavaş). Her biyomda git-gel yok.
  İstasyonlar şaftta platform + fener olarak görünür ve çevresini aydınlatır; en yakın istasyon ekran dışındaysa şaft hizasında altın kenar oku gösterir.
  Sonuç ekranında **ANA MENÜ** düğmesi vardır.
- **Yönetmen (düşman temposu):** Düşmanlar tek bir bütçeden karışık gruplar halinde gelir (4+ kişide bir ağır, 3+ kişide bir menzilli);
  önceki grup büyük ölçüde ölmeden yenisi gelmez, sahadaki sınır 3 sn'de en çok 1 artar. Uyanış ve üstünde 80-110 sn'de bir **DALGA**
  4 sn önceden duyurulur (turuncu ok), 3 grup gelir, ardından 18 sn nefes arası. Düşman canı biyom başına ×1.13, hasarı +%8;
  derin elitler özellik kazanır (Kalkanlı, Hızlı, Yenilenen, Patlayan, Bölünen).
- **Market:** fiyatlar katlanır; son seviyeler bandın derin cevherini (Yeşim → Opal → İnci → Akik → Yıldız → Kara Elmas → Ezel Kehribarı)
  ve bu seferde yakılmış Fener ister (en çok 8). Her silahın 5 ustalık seviyesi, her aletin 5 seviyesi var; üretim fiyatı derinlikle artar.
- **Sandıklar:** Ahşap, Demir, Altın, Silah, Cevher, Erzak, Lanetli (3 elit bekçi, güçlü kalıntı), Kadim ve Taklitçi (sandık kılığında saldırır).
  Kalıntılar Sıradan / Nadir / Efsanevi (50+).
- **Test düğmesi:** adrese `?test` eklenince Atölye'de TEST ∞: her cevherden 99999, tüm şemalar, Fener kilidi açık.
- **Roller:** Madenci kartında seçilir; Kazıcı (kazma %20 hızlı, kazı gürültüsü %25 az), Nişancı (blaster hasarı +%25, menzil +12),
  Mühendis (alet sınırı +1, aletler %40 dayanıklı). Co-op'ta partnerin rolü koltuk kartında görünür.
- **Maden olayları:** Yeraltında ve ölçer sessiz değilken 55-95 sn'de bir olay: **Sarsıntı** (uyarıdan 2.5 sn sonra tavan çöker),
  **Gaz sızıntısı** (yakın boşluklara bulut), **Karartma** (18 sn fener yarı menzil). Deterministik; iki tarafta da aynı anda olur.
- **Maden kanaryası (Kamp):** yerel oyuncuyu izleyen kuş; 11 blok içindeki gizli yuvayı sezip ok gösterir, gürültü eşiğe yaklaşınca öter.
- **Ölüm yankısı:** Tek oyunculuda bayılıp cevherli çantan kaldıysa, sonraki seferde aynı derinlikte parlayan çanta olarak bekler.
- **Kontrol hissi:** Ayarlar > **Sabit joystick** (varsayılan) ya da yüzen joystick (ekranın alt yarısında dokunduğun yerde doğar, sabit kalır); sabit tabanın yeri
  (Otomatik/Sağ/Sol/Orta) ve yüksekliği (Alçak/Orta/Yüksek) ayarlardan seçilir.
  Kardinale yakın itişte eksen kilidi, köşede kaydırma (bloke olunca açık şeride hızla kayıp aynı karede ilerler), kutu 9×11.
- **Ana menü (sade):** üstte madenci çipi (ad, kask, rol → Madenci kartı) + ayar dişlisi; büyük KAZMAYA BAŞLA / DEVAM ET; kademe tek satırda döngü;
  BİRLİKTE · GÜNÜN MADENİ · KAMP üçlü karo; altta eser rafı ve rekor satırı.
- **Fotoğraf modu:** Duraklat > Fotoğraf Çek; HUD'suz kare + filigran, telefonda paylaşım menüsü, masaüstünde PNG indirme.

- **30 biyom, ~1080 m, karışık sıra:** Toprak hep ilk, Yaratılış Çekirdeği 20., Sıfır Noktası hep son; aradakiler tohuma göre zorluk bantları içinde
  yer değiştirir (`biomeOrder(seed)`: [1-2] [3-5] [6-7] [8-9] [10-11] [12-14] [15-18]). Ana kaya sertliği derinlikle artar (Boşluk 60 → Yaratılış 350),
  iki yeni kazma kademesi (Yıldız Demiri, Yaratılış Kazması). Her biyomun imza düşmanı yuvalardan sık çıkar; derin biyomların imzaları yalnız kendi biyomunda.
- **Derin biyomlar (10-19), her birinin kendine özgü taşı:**
  - **Cıva Denizi:** cıva cebi → altın verir ama yakındaysan zehirler; gümüş buhar, tavandan cıva damlaları.
  - **Fırtına Damarı:** yıldırım damarı → kırılınca 48 px içindeki düşmanları 40 hasarla çarpar, çok yakındaysan seni de; kobalt verir.
  - **★ Altın Saray (efsanevi):** 200 vuruşluk kapılarla mühürlü salon; sütunlar, altın döşeme, iki sandık; Altın Muhafız (altın düşürür).
  - **Mantar Uçurumu:** spor kesesi → yakın oyuncuyu iyileştirir, düşmanı 3.5 sn uyuşturur; dev parlayan mantarlar.
  - **Cam Katedrali:** cam zincirleme kırılır (komşu camlar da dökülür, ganimet yok, gürültü ×1.5); dikey nefler, Cam Gölgesi duvardan geçer.
  - **★ Uyuyan Dev (efsanevi):** göğüs boşluğunda nabız taşı → 30 can ve 3 kristal, ama ölçer +40 (Dev uyanır); ekran tonu nabız gibi atar.
  - **Zaman Kırığı:** zaman taşı → 80 px içindeki düşman 5 sn donar, sen 5 sn ×1.45 hızlanırsın; Zaman Gözü ışınlanır.
  - **Kan Gölü:** kan damarı → 3 demir + 20 can, ölçer +25; tehlike çarpanı en yüksek; Kan Sülüğü kayada yüzer.
  - **Yankı Boşluğu:** her gürültü ×2; sessiz taş ölçeri 30 düşürür; Yankıcı korkutur.
  - **★ Yaratılış Çekirdeği (efsanevi):** yaratılış tohumu → çevredeki 8 sıradan kaya altın/kristale döner; Kalp Kristali burada; Işık Bekçisi kör eder.
- **Öte Yüz ve İlk Taş (20-29):** çekirdeğin öbür tarafı.
  - **Sağır Mağaralar:** düşmanlar görmez, son sese koşar; tuzak taşı onları başka yere çeker. Kör Avcı.
  - **Gelgit Kuyuları:** su dakikada bir yükselir; suda yavaşlarsın, silah ateş etmez. Batak Yılanbalığı suda yapışır.
  - **Yaşayan Kaya:** kazılan tünel 20 sn'de kapanır; sinir düğümü 40 sn durdurur. Örücü arkandaki tüneli örer.
  - **★ Ters Saray (efsanevi):** baş aşağı salon, Kara Elmas avizeler, taht tavanda (Aynalı Taç). Kalkanlı Muhafız önden gelen vuruşu keser.
  - **Kehribar Mezarı:** kehribar kırılınca ganimet ya da uyanan elit. Diriltici ölen dostlarını geri getirir.
  - **Mıknatıs Çekirdeği:** bol demir; Demir Kene mermileri kendine çeker ve mermiye dayanıklıdır.
  - **Açlık Yatağı:** damarlar 15 sn'de bir kararır; Cevher Faresi çantandan çalıp kaçar, Tozböcek sürüleri.
  - **★ Kök Tahtı (efsanevi):** taht odasında Dünya Tohumu; Yumurtacı duvara yumurta bırakır (8 sn içinde kır).
  - **Sessiz Deniz:** ölçer sönmez, durmadan dolar; ışık mantarları iyileştirir; Işık Yiyen fenerini söndürür.
  - **★ Sıfır Noktası (efsanevi):** Kalp Kristali ve Sıfır Taşı burada.
  - Yeni bosslar: **Aynasız Hükümdar** (taktığın silahı kopyalar), **Kehribar Ana** (yumurta yağmuru, reçine), **Madenin Kalbi** (duvarlardan diken, tavan çöküşü, nabız halkası).
  Efsanevi biyomlar altın afişle girilir, fazladan sandık taşır; biyoma girince kısa ipucu çıkar.
- **Efsanevi eserler (kalıcı):** her efsanevi biyomun kalbinde tek bir eser taşı; kırınca altın afiş + beyaz flaş, eser kamp rafına
  ve ana menüdeki rafa girer ve her seferde çalışır (co-op'ta iki oyuncu da kazanır; ikinci kez bulunursa altın yağmuru).
  - **Altın Taç** (Altın Saray tahtı): sıradan kaya %10 altın düşürür, sefere +12 altın; kaskta taç çizilir.
  - **Devin Kalbi** (Uyuyan Dev'in göğsü): azami can +40; bayılacağın an nabız dalgası, düşmanlar savrulur, yarı canla ayakta kalırsın (sefer başına bir).
  - **Arkentaş** (Yankı Boşluğu'nun dibinde, kayaya gömülü): kendi ışığıyla yanan beyaz-mavi oval taş (dönen ışınlar, kıvılcımlar, 9 blok ışık).
    Görüş +3, cevherler karanlıkta parıldar, ışığına giren düşman yarı hıza düşer; göğsünde taşınır.
  - **Yaratılış Kıvılcımı** (Kalp'in yanında): kazma ×2 hasar ve ışık saçar, kırılan her blok 40 px içindeki düşmanı 12 yakar.
- **Derin biyom imza davranışları:** Cıva Damlası yarı canda iki damlacığa bölünür · Yıldırım Yarasası görüşte yıldırım çarpar (ağ gibi yavaşlatır, aletleri de vurur) ·
  Altın Muhafız vuruşta 3 altın çalar, ölünce geri düşer · Spor Böceği spor bulutuyla dostlarını iyileştirir, seni yavaşlatır · Cam Gölgesi vurulunca iki cam kopya çıkarır ve aralarına karışır (kopya tek vuruşta dağılır, sayılmaz) ·
  Dev Parçası yere vurur: 80 px sarsıntı hasarı, tavandan taş düşer, aletler hasar alır · Zaman Gözü seni 3 sn önceki yerine geri sarar · Kan Sülüğü ısırınca kan emer, iyileşir ve büyür (×1.6), sen 4 sn kanarsın ·
  Yankıcı uluması ölçeri +10 yükseltir ve 150 px'teki sürüyü hızlandırır · Işık Bekçisi 0.9 sn nişan alır (kesik çizgi), görüşten çıkmazsan yargı ışını 22 hasar + körlük.

## Birlikte Kaz (2 kişi, çevrim içi)

- **Lobi:** Madenci kartı (ad + 6 kask rengi, partnerin görür). **Hızlı Eşleş** sunucusuz lobi yuvalarıyla bekleyen birini bulur, yoksa seni bekletir.
  **Oda Kur** davet linki üretir (`?oda=KOD`); telefonda paylaşım menüsü, masaüstünde panoya kopyalar; linke tıklayan doğrudan odaya düşer.
  Koltuk kartları ve HAZIR akışı; 4 haneli kod girişi yedek olarak kalır.
- **Ağ (donmaya karşı):** deterministik lockstep, ölçülen ping ve geç gelen girdilere göre kendini ayarlayan girdi gecikmesi (3-16 kare),
  sırasız DataChannel üzerinden her pakette son 8 karenin girdisi (kayıp/gecikme telafisi), hız eşitleme (önde olan %30 yavaşlar),
  yumuşak yakalama, arka plana alınan sekmede Worker zamanlayıcısıyla simülasyonun sürmesi. HUD'da ping ve bağlantı kalitesi.
  **Yerel tahmin:** planlanmış girdilerle kendi madencin ve kamera önden çizilir; girdi gecikmesi hissedilmez (simülasyon deterministik kalır).
  Ara özet karşılaştırmasıyla senkron kaybı bildirilir.
  **Yeniden bağlanma:** bağlantı kopunca sefer bitmez; 45 sn boyunca iki taraf tohumdan türeyen ortak kimlikle (`derinmaden-v4-rc-<tohum>`) yeniden buluşur
  (ev sahibi yeniden kayıt olur, misafir 2.5 sn'de bir dener), son 600 karelik yerel girdi günlükleri değiş tokuş edilir ve simülasyon kaldığı kareden sürer.
  HUD'da geri sayım; partner bilerek ayrılırsa (`bye`) sefer hemen biter.
- **Peak hissi:** Basılı tut (masaüstünde sağ tık ya da X) → partnerin ekranında işaret ve kenar oku. Hızlı mesaj çipleri
  (Buraya gel, Yardım, Kampa dönelim, İyi iş, Yuva buldum, Sessiz ol) baloncuk olarak görünür. Partner baygınsa HUD uyarır.
- Zorluk: düşman canı ×1.3, gürültü ×1.15, Öz ×1.5. Duraklatma ve kayıt kapalıdır.
- Kendi PeerJS sunucun için `.env`: `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_SECURE`, `VITE_PEER_PATH`.
  NAT arkasında kalanlar için TURN: `VITE_TURN_URL` (virgülle birden çok), `VITE_TURN_USER`, `VITE_TURN_PASS`.

## Önceki içerik (v2-v4)

- **İlk 10 biyom:** Toprak, Taş, Kök Ormanı, Kobalt, Buz, Kemik Çukuru, Kor, Kristal, Obsidyen, Boşluk Çekirdeği; her birinin kayası, süsü ve atmosferi.
- **Kazma dükkânı:** 10 kademe (Odun → Yaratılış), Keskinlik, Hızlı Sallama ve 8 kazma türü (Matkap, Geniş, Kadife Uç, Balyoz, Burgu, Hazine, Kan Akiği). **Silahlar:** Blaster, Saçmalı, Makineli, Alev Püskürtücü, Delici Tüfek, Şimşek Tabancası, Roketatar, Kırağı Topu; her madenci kendi silahını takar, güç ortak Silah Gücü seviyesinden gelir. Son kademeler ve derin türler bandın derin cevherini ister. **Eklentiler:** 3 yuva, 7 pasif + Aşırı Yük ve Nova.
- **Yaratıklar:** Kemirgen, Kabukbiti, Tükürgen, Yarasa, Kristalböcek, Kaya Devi, Maden Solucanı, Parıldak, Çekici, Uluyan, Gölge,
  Örümcek/Örümcekçik/Örümcek Ana, Kırağı, Kemikçi, Kor Böceği, Boşluk Gözü, Obsidyen Devi ve beş boss. Elitler taçlı, altın düşürür.
- **Üretim:** Dinamit, Tamir Kiti, Kalkan Hücresi, Sonar, Sessizlik Çanı, Burgu Şarjı, Dönüş Fişeği, Adrenalin; çanta en çok 1000; şemalar Kalıntı sandıklarından kalıcı açılır.
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
  partner işareti, yaratıklar, determinizm, kayıt/yükleme, biyom sırası, 20 biyomluk derin sefer, performans, efsanevi eserler + Arkentaş, imza davranışları.
- `npm run sim` — uyanış dengesi simülasyonu (biyom başına tepe gürültü, seviye süreleri, düşman ve bayılma sayıları).
