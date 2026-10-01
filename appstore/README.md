# FALL: App Store yayın paketi

Bu klasör mağaza için gereken her şeyi içerir. Sıra: önce Mac'te derleyip yükle (1), sonra App Store Connect'te sayfayı doldur (2), göndermeden önce 4. bölümdeki kararları ver.

| Ne | Nerede |
|---|---|
| Xcode projesi (oyun içinde, ikon ve açılış ekranı hazır) | `ios/App/App.xcodeproj` |
| Ekran görüntüleri, iPhone 6.9" (1320×2868), 6 adet | `appstore/screenshots/tr/iphone-6.9_*.png` |
| Ekran görüntüleri, iPad 13" (2064×2752), 6 adet | `appstore/screenshots/tr/ipad-13_*.png` |
| Aynı görüntülerin İngilizce başlıklı hali | `appstore/screenshots/en-US/` |
| Mağaza metinleri (Türkçe, İngilizce) | `appstore/metadata/tr/`, `appstore/metadata/en-US/` |
| İnceleme notu (Apple'a) | `appstore/metadata/review_information/notes.txt` |
| Uygulama ikonu 1024×1024 | `appstore/icon/AppIcon-1024.png` (Xcode projesinde zaten var) |

## 1. Mac'te derle ve yükle

Gerekenler: güncel Xcode (App Store'dan), Xcode'a Apple Developer hesabınla giriş (Xcode → Settings → Accounts), internet (Xcode ilk açılışta Capacitor paketini GitHub'dan indirir).

1. Zip'i aç, `ios/App/App.xcodeproj` dosyasına çift tıkla.
2. Soldan **App** projesi → **App** hedefi → **Signing & Capabilities** → **Team** olarak hesabını seç.
3. Önce bir simülatörde ya da kendi telefonunda çalıştır (▶), oyunun açıldığını gör.
4. Üstteki cihaz listesinden **Any iOS Device (arm64)** seç.
5. **Product → Archive**. Bitince açılan pencerede **Distribute App → App Store Connect → Upload**.
6. Derleme 10-30 dakika içinde App Store Connect'te **TestFlight** sekmesinde görünür.

Zip'te web derlemesi ve Capacitor eklentileri hazır geldiği için Mac'te Node kurmana gerek yok. Oyunu sonradan değiştirirsen: Node 20+ kur, proje klasöründe `npm ci` ve `npm run ios` çalıştır, Xcode'da **Build** numarasını bir artır, yeniden Archive et.

Paket kimliği `com.baranbulduk.fall`. Değiştirmek istersen ilk yüklemeden önce `capacitor.config.json` ve Xcode'da değiştir; yüklendikten sonra değişmez.

## 2. App Store Connect

**Apps → + → New App**

| Alan | Değer |
|---|---|
| Platform | iOS |
| Name | `metadata/tr/name.txt` (FALL; İngilizce sayfada "FALL: Deep Mine", yalın FALL orada başka hesapta) |
| Primary Language | Turkish |
| Bundle ID | com.baranbulduk.fall (listede yoksa önce developer.apple.com → Identifiers'da oluştur; Xcode ilk Archive'da kendisi de oluşturur) |
| SKU | fall-ios-1 |

**Sürüm sayfası (1.0)**

| Alan | Dosya |
|---|---|
| Screenshots, iPhone 6.9" | `screenshots/tr/iphone-6.9_01…06` sırayla sürükle |
| Screenshots, iPad 13" | `screenshots/tr/ipad-13_01…06` |
| Promotional Text | `metadata/tr/promotional_text.txt` |
| Description | `metadata/tr/description.txt` |
| Keywords | `metadata/tr/keywords.txt` |
| Support URL | `metadata/tr/support_url.txt` |
| Marketing URL | `metadata/tr/marketing_url.txt` |
| Copyright | `metadata/copyright.txt` (kendi adın ya da şirketinle değiştir) |
| Build | Yüklediğin derlemeyi seç |

İngilizce sayfa eklemek istersen dil menüsünden **English (U.S.)** ekle ve aynı alanları `metadata/en-US/` ve `screenshots/en-US/` ile doldur. Açıklamada oyun içi dilin Türkçe olduğu yazıyor.

**App Information**

| Alan | Değer |
|---|---|
| Subtitle | `metadata/tr/subtitle.txt` |
| Category | Games; alt kategoriler Action ve Adventure |
| Content Rights | Üçüncü taraf içerik yok (kullanılan kütüphane ve yazı tipi açık lisanslı) |
| Age Rating | Aşağıdaki yanıtlar |

**Yaş derecelendirmesi anketi**

| Soru | Yanıt |
|---|---|
| Cartoon or Fantasy Violence | Frequent/Intense (sürekli yaratık vurma var; kan ve gerçekçi şiddet yok) |
| Horror/Fear Themes | Infrequent/Mild |
| Diğer bütün içerik soruları | None |
| Unrestricted Web Access, Gambling, Loot Boxes, Advertising | No |
| User-Generated Content, Messaging and Chat | No (yalnız altı hazır mesaj var, serbest yazı yok) |
| Made for Kids | No |

**App Privacy**

- Privacy Policy URL: `metadata/tr/privacy_url.txt`
- Data collection: **Data Not Collected**. Oyun hesap, reklam, analitik içermez; ortak modda cihazlar birbirine doğrudan bağlanır.

**Pricing and Availability:** fiyatı ve ülkeleri sen seç (ücretsiz için vergi ve banka bilgisi gerekmez). AB'de yayınlayacaksan **Digital Services Act** bölümünde tüccar durumunu bildirmen istenir.

**App Review Information**

- Sign-in required: No
- Notes: `metadata/review_information/notes.txt` içeriğini yapıştır
- Contact: kendi adın, telefonun, e-postan

Şifreleme sorusu çıkmaz: `Info.plist` içinde `ITSAppUsesNonExemptEncryption = false` var.

Son adım: **Add for Review → Submit**.

## 3. İsteğe bağlı: metinleri ve görüntüleri tek komutla yükle

Mac'te fastlane kuruluysa (`brew install fastlane`), proje kökünde:

```bash
fastlane deliver --username APPLE_KIMLIGIN
```

`fastlane/Deliverfile` bu klasördeki metinleri ve ekran görüntülerini yükler; derlemeyi yüklemez, incelemeye göndermez. Bu yolu denemedim; çalışmazsa 2. bölümdeki elle yol geçerli.

## 4. Göndermeden önce karar vermen gerekenler

1. **Uygulama adı.** Mağazada adlar tekildir; yalın "FALL" büyük olasılıkla alınmış, bu yüzden "FALL: Derin Maden" yazdım. Ana ekrandaki ikon adı yine FALL.
2. **Balrog ve Arkentaş adları.** İkisi de Tolkien eserlerinden; hak sahipleri marka konusunda hassas. Mağaza metinlerinde ve ekran görüntülerinde bu adları kullanmadım ama oyunun içinde duruyorlar. Yayından önce yeniden adlandırmanı öneririm.
3. **Ortak mod bağlantısı.** Herkese açık PeerJS sunucusu kullanılıyor ve TURN yok; bazı mobil ağlarda iki cihaz bağlanamayabilir. Ayrıntı: `docs/ios.md`.
4. **iPad.** Uygulama iPhone + iPad olarak ayarlı; iPad'de oyun ekranın ortasında telefon genişliğinde bir sütunda çalışır. Yalnız iPhone istersen Xcode'da App hedefi → General → Supported Destinations'dan iPad'i kaldır (o zaman iPad görüntüleri gerekmez). İlk yayından sonra iPad desteği kaldırılamaz.

## Ekran görüntülerini yeniden üretmek

```bash
npm run dev
```

```bash
npm run shots
```

Sahneler `scripts/store-scenes.mjs`, başlıklar aynı dosyada `CAPTIONS` içinde.
