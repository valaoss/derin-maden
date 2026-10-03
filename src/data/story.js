// Hikâye: Kandilli kasabasının ışığı dağın dibindeki bir kalpten gelir. Kandiller sönüyor; Ustabaşı Selvi ve Yedinci Ekip
// kalbe inmek için kazdı ve dönmedi. Maden uyuyan bir varlığın gövdesi, bosslar onun bekçileri.
// Metinler kısa tutulur (telefonda tek bakışta okunsun).

// ilk açılışta (atlanabilir) dört kart
export const INTRO = [
  { k: 'KANDİLLİ', t: 'Kasabanın ışığı dağın dibindeki bir kalpten gelir. Yüz yıldır her gece yandı.' },
  { k: 'YEDİNCİ EKİP', t: 'Bu kış kandiller sönmeye başladı. Ustabaşı Selvi ve ekibi kalbe inmek için kazdı… ve dönmedi.' },
  { k: 'SIRA SENDE', t: 'Kaz, topla, güçlen. Ama sessiz ol: maden uyuyor ve gürültüyü duyar.' },
  { k: 'MÜHÜRLER', t: 'Her dört katmanın dibi mühürlü. Bekçisini yen, mührü kır, Kalp Kristali’ni yüzeye taşı.' },
];

// dört perde: her biri iki bölüm (sekiz biyom); açılışta afiş, kapanışta (mühür kırılınca) bir satır
export const ACTS = [
  { from: 0, name: 'KAPIDAN İÇERİ', open: 'Selvi’nin izleri burada başlıyor. Defter sayfalarını topla.', close: 'İkinci mühür kırıldı. Kandilli’den uzaklaştıkça ışık değişiyor.' },
  { from: 8, name: 'GÖZÜ OLAN TAŞLAR', open: 'Kristaller fısıldıyor. Cevap verme.', close: 'Dördüncü mühür kırıldı. Yarı yoldasın.' },
  { from: 16, name: 'UYUYANIN RÜYASI', open: 'Dev’in göğsü inip kalkıyor. Maden nefes alıyor.', close: 'Altıncı mühür kırıldı. Kalbin atışı ayaklarında.' },
  { from: 24, name: 'KALBE', open: 'Kehribarın içinde eski ekipler bekliyor. Sona az kaldı.', close: 'Kafes açıldı. Kalp Kristali senin.' },
];
export const actOf = s => ACTS.reduce((a, A, i) => (s >= A.from ? i : a), 0);

// Kayıp Ekip Günlüğü: her biyom konumunda bir sayfa (derinlik sırasıyla okunur)
export const PAGES = [
  'Gün 1. Toprak yumuşak, ekip neşeli. Doruk ilk demiri buldu; gözleri kandil gibi parladı.',
  'Kazmanın sesi duvarlarda yankılanıyor. İlkim kanaryanın sustuğunu söyledi. Önemsemedim.',
  'Bu derinlikte kök olmamalı. Bir şey yukarıdan değil, aşağıdan büyüyor.',
  'İlk mührü bulduk: taşa oyulmuş bir halka, içi nabız gibi atıyor. Altında bir şey nöbet tutuyor.',
  'Mührü geçtik ama Bora yaralı. Bekçi öldü mü, yoksa yalnız uyudu mu, bilmiyorum.',
  'Duvarlarda tırnak izleri var. Bizden önce de biri kazmış. Belki de kazınan biziz.',
  'Bu sıcak ateşin değil; nefes gibi. Kaya içeri çekiyor, dışarı veriyor. Ece “dağ uyuyor” dedi, güldük.',
  'İkinci mühür. Ece artık gülmüyor. Bora’yı kampa geri yolladık.',
  'Kristaller fısıldıyor. Gece nöbetinde biri adımı söyledi; kimse uyanık değildi.',
  'Haritaları yaktım. Yollar yer değiştiriyor; dün kazdığımız tünel bugün yok.',
  'Tamer bir yuva yıktı, maden sustu. Sessizliğin de bedeli var: her şey bizi duyuyor.',
  'Üçüncü mühür. Bekçinin gözleri vardı ama bakmıyordu. Rüya görür gibiydi.',
  'Altın taşlar, saraylar… Kim yaptı bunları? Madenciler mi, madenin kendisi mi?',
  'Ece geride kalmak istedi. “Kalbi yukarı çıkarırsak dağ ölür” diyor. Haklı mı?',
  'Camdan duvarlarda kendimi gördüm, ama yaşlıydım. Ben hiç bu kadar yaşlanmadım.',
  'Dördüncü mühür. Yarı yoldayız. Kandilli’nin ışığını burada da görüyorum: damarlarda akıyor.',
  'Bir dev uyuyor. Göğsü nabız taşlarıyla dolu. Bu kalp değil; kalbin yankısı.',
  'Kan gölünde Tamer’i kaybettik. Göl uyandı, Tamer uyumadı.',
  'Yankılar. Kendi sesimi duyuyorum, ama ben konuşmadan önce.',
  'Beşinci mühür. Buradaki taş henüz bitmemiş. Maden hâlâ kendini yapıyor.',
  'Sağır mağaralarda sessizlik bile ses çıkarıyor. İlkim kanaryasını burada bıraktı.',
  'Su yükseliyor, iniyor. Bir şey nefes alıyor; biz onun ciğerlerindeyiz.',
  'Kaya kapanıyor, kazdığımız yol iyileşiyor. Bu, iyileşen bir şeyin yarası.',
  'Altıncı mühür. Üç kişi kaldık. Doruk yukarı dönmek istiyor. Bırakamam.',
  'Kehribarın içinde böcek değil, madenciler var. Bizden önceki ekipler. Birinci Ekip… İkinci…',
  'Demir kendiliğinden bize doğru akıyor. Maden bizi çağırıyor mu, yutuyor mu?',
  'Damarlar kararıyor. Kalp zayıflıyor; kandillerin sönmesi bu yüzden.',
  'Yedinci mühür. Doruk ile İlkim’i yukarı yolladım. Yalnız ben inerim.',
  'Kökler bir tahta sarılı. Dünya ağacı değil bu: kalbe giden bir damar ağı.',
  'Sessiz deniz. Altında kuşak gibi bir şey dönüyor. Kalbin atışını ayaklarımda duyuyorum.',
  'Kalbe ulaştım. Onu alırsam Kandilli yanar, maden söner. Bırakırsam… Bulan sen ol, seçimi sen yap. — Selvi',
];

// sefer başında telsizden tek satır: ilerlemeye ve son sefere göre
export function radioLine(m) {
  const runs = m.runs | 0, seals = m.sealMax | 0, wins = m.wins | 0;
  if (m.lastDown && runs % 2) return ['KANARYA BAKICISI', 'Kanarya bütün gece sustu. Yine in; ama bu kez daha sessiz.'];
  if (wins) return ['USTA', wins > 1 ? 'Kandiller yanıyor. Ama madenden yeni bir uğultu geliyor; kademeyi yükselt.' : 'Kalbi bir kez çıkardın. Selvi’nin defterini bitirdin mi?'];
  const L = [
    'İlk mühür dördüncü katmanın dibinde. Bekçisi gürültüye bakmaz, gelir. Hazırlıklı in.',
    'Karakök’ü geçtin demek. Selvi’nin ekibi de oraya kadar gülüyordu.',
    'Kor katmanının altına inen pek olmadı. Kristaller konuşursa cevap verme.',
    'Kördeşen’in yolu açıldı. Altın saraya kanma; ejderi uyandırmadan geç.',
    'Yarı yol. Uyuyan Dev’in göğsünde nabız taşları var: can verir, ama Dev uyanır.',
    'Aynasız’ı yendin. Bundan sonrası Selvi’nin son sayfaları.',
    'Kehribar Ana düştü. Kalp çok yakın; mühür kafesini Madenin Kalbi tutuyor.',
    'Bütün mühürleri kırdın. Kalp Kristali’ni yüzeye taşı.',
  ];
  return ['USTA', L[Math.min(L.length - 1, seals)]];
}

// zafer sonrası: her kademe sonun bir satırını daha açar
export const EPILOGUE = [
  'Kalp yüzeye çıktı. Kandilli’nin kandilleri bir bir yandı. Derinde bir şey son kez nefes verdi.',
  'O gece Selvi’nin kazması kampın kapısında bulundu. Getireni kimse görmedi.',
  'Maden ölmedi. Kalbin yerinde yeni bir kıvılcım büyüyor; yüz yıl sonra başka bir ekip inecek.',
  'Kehribardaki madenciler uyandı. Hiçbiri bir gün bile yaşlanmamıştı.',
  'Usta itiraf etti: Birinci Ekip’ten tek dönen oydu. Kalbi bir kez o da çıkarmıştı.',
  'Uyuyan uyandığında Kandilli diye bir yer hiç olmamıştı. Ama ışık sende kaldı.',
];
