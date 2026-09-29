# iOS / App Store

Oyun Capacitor ile `ios/` altında yerel bir iOS uygulamasına sarılı. Web sürümü (GitHub Pages) aynen çalışmaya devam eder.

- Paket kimliği: `com.valaoss.derinmaden` (`capacitor.config.json` ve Xcode'da değiştirilebilir, App Store'a yüklendikten sonra değişmez)
- Yalnızca dikey, tam ekran, durum çubuğu gizli; iPhone + iPad
- Titreşim: Capacitor Haptics · Kayıt: localStorage + Preferences yedeği · Paylaşım: yerel paylaşım menüsü
- Davet linkleri web adresine gider (`valaoss.github.io/derin-maden/?oda=KOD`); uygulama ve web birlikte oynayabilir
- Gizlilik ve destek sayfası: `https://valaoss.github.io/derin-maden/gizlilik.html` (oyunda Ayarlar → Gizlilik ve destek)

## Mac'te derleme

```bash
npm ci
npm run ios          # web derlemesi + ios/ ile eşitleme
npx cap open ios     # Xcode'u açar
```

Xcode'da: App hedefi → Signing & Capabilities → Team seç → Product → Archive → Distribute App → App Store Connect.
Her yeni yüklemede Build numarasını (CURRENT_PROJECT_VERSION) artır.

## App Store Connect

- Gizlilik politikası ve destek URL'si: yukarıdaki `gizlilik.html`
- App Privacy: "Veri toplanmıyor" (Data Not Collected)
- Şifreleme: Info.plist'te `ITSAppUsesNonExemptEncryption = false` (yalnızca standart şifreleme)
- Yaş derecelendirmesi: hafif fantastik şiddet
- Ekran görüntüleri: 6.9" iPhone (1320×2868) ve 13" iPad (2064×2752)
- Dil: Türkçe

## Çevrimiçi (önerilir)

Varsayılan olarak herkese açık PeerJS sunucusu kullanılır ve TURN yoktur. Mobil ağlarda bağlantı için derlemeden önce ortam değişkenleri:
`VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_PASS` ve isteğe bağlı kendi PeerServer'ın için `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`.
