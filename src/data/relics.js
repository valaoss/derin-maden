// Kalıntılar (sandıktan seçilir). Her kalıntı bir SOY'a aittir; aynı soydan 3 kalıntı REZONANS açar.
// v: seviye değerleri (I, II, III) — sahip olduğun kalıntı sandıkta yeniden çıkarsa seviyesi artar.
// duo: iki soydan birer kalıntın varken çıkan İKİLİ kalıntılar. leg: soysuz efsanevi. curse: yalnız Lanetli Sandık'tan, bedeli olan güç.
// desc: '{v}' seviye değeriyle dolar; f: 'p' yüzde, 'x' çarpan/sayı, 'b' blok (px/16)

export const SOY = {
  ates:   { name: 'ATEŞ',   col: '#ff7a3a', icon: 'flame',   res: 'Yanan düşmanlar %30 fazla hasar alır; yanma iki kat hızlı işler.' },
  buz:    { name: 'BUZ',    col: '#9ad8ff', icon: 'frost',   res: 'Yavaşlamış düşmanın canı %25’in altına inince buz gibi parçalanır (boss hariç).' },
  simsek: { name: 'ŞİMŞEK', col: '#7ab4ff', icon: 'chain',   res: 'Her 12 sn’de yakındaki 5 düşmana gökten yıldırım düşer: silah hasarının 3 katı.' },
  kan:    { name: 'KAN',    col: '#ec4a4a', icon: 'heart',   res: 'Seni bayıltacak darbe 1 canda durur, 3 sn dokunulmaz olursun (90 sn’de bir).' },
  toprak: { name: 'TOPRAK', col: '#e0b060', icon: 'drill',   res: 'Kazı gücün ×1.5; her cevher %30 ihtimalle bir fazla düşer.' },
  golge:  { name: 'GÖLGE',  col: '#b58aff', icon: 'hush',    res: 'Tüm gürültün %35 azalır; maden sessizken (ölçer 0-1) hasarın +%40.' },
};
export const SOY_KEYS = Object.keys(SOY);
export const RESONANCE = 3;

export const PERKS = {
  // ---- ATEŞ: yak, patlat
  kor:        { soy: 'ates', name: 'Kor Mermi', icon: 'flame', v: [0.2, 0.35, 0.55], f: 'p', desc: 'Mermilerin tutuşturur: 3 sn boyunca saniyede silah hasarının %{v}’i.' },
  lesBombasi: { soy: 'ates', name: 'Leş Bombası', icon: 'boom', v: [0.3, 0.5, 0.8], f: 'p', desc: 'Öldürdüğün düşman patlar: çevresine azami canının %{v}’i kadar hasar.' },
  yangin:     { soy: 'ates', name: 'Orman Yangını', icon: 'flame', v: [32, 44, 60], f: 'b', desc: 'Yanarken ölen düşman ateşini {v} blok içindeki herkese sıçratır.' },
  kalibre:    { soy: 'ates', name: 'Barut Kalibre', icon: 'blaster', v: [0.15, 0.28, 0.45], f: 'p', desc: 'Silah hasarın +%{v}.' },
  barut:      { soy: 'ates', name: 'Barut Ustası', icon: 'dynamite', v: [30, 20, 12], f: 'x', desc: 'Her {v} blokta kemerine bir dinamit girer; dinamitlerin iki kat vurur.' },
  // ---- BUZ: yavaşlat, dayan
  buzMermi:   { soy: 'buz', name: 'Buz Mermisi', icon: 'frost', v: [1, 1.6, 2.4], f: 'x', desc: 'İsabet düşmanı {v} sn yavaşlatır.' },
  kirilgan:   { soy: 'buz', name: 'Kırılgan', icon: 'crystal', v: [0.25, 0.45, 0.7], f: 'p', desc: 'Yavaşlamış düşmanlar %{v} fazla hasar alır.' },
  buzZirh:    { soy: 'buz', name: 'Buz Zırhı', icon: 'armor', v: [0.15, 0.25, 0.35], f: 'p', desc: 'Aldığın tüm hasar %{v} azalır.' },
  donmusKalp: { soy: 'buz', name: 'Donmuş Kalp', icon: 'gear', v: [60, 45, 30], f: 'x', desc: 'Canın %30’un altına düşünce çevrendeki her şey 5 sn donar ve sana vuramaz ({v} sn’de bir).' },
  buzPatlama: { soy: 'buz', name: 'Buz Patlaması', icon: 'shock', v: [2, 3, 4.5], f: 'x', desc: 'Hasar aldığında çevrendeki düşmanlar savrulur, yavaşlar ve silah hasarının {v} katını alır.' },
  // ---- ŞİMŞEK: hız, zincir
  hizliTetik: { soy: 'simsek', name: 'Hızlı Tetik', icon: 'rapid', v: [0.2, 0.35, 0.55], f: 'p', desc: 'Atış hızın +%{v}.' },
  zincirSimsek:{ soy: 'simsek', name: 'Zincir Şimşek', icon: 'chain', v: [0.3, 0.5, 0.75], f: 'p', desc: 'İsabetlerin %{v} ihtimalle yakındaki düşmana sıçrar.' },
  simsekAdim: { soy: 'simsek', name: 'Şimşek Adım', icon: 'boot', v: [0.15, 0.25, 0.35], f: 'p', desc: 'Hareket hızın +%{v}; hasar alınca 2 sn çok hızlı koşarsın.' },
  ofke:       { soy: 'simsek', name: 'Öfke', icon: 'overdrive', v: [0.06, 0.09, 0.13], f: 'p', desc: 'Her öldürme 4 sn boyunca atış hızını %{v} artırır (6 kez birikir).' },
  statik:     { soy: 'simsek', name: 'Statik Yük', icon: 'nova', v: [8, 6, 4], f: 'x', desc: 'Düşman yakındayken {v} sn’de bir çevrene 12 mermilik halka atarsın.' },
  // ---- KAN: risk ve can
  vampir:     { soy: 'kan', name: 'Vampir Mermi', icon: 'heart', v: [0.02, 0.035, 0.05], f: 'p', desc: 'Silahla verdiğin hasarın %{v}’i kadar can emersin (saniyede en çok azami canın %1’i).' },
  sonDirenis: { soy: 'kan', name: 'Son Direniş', icon: 'elite', v: [1.5, 1.9, 2.4], f: 'x', desc: 'Canın %35’in altındayken kazman ve silahın {v} kat vurur.' },
  yasamOzu:   { soy: 'kan', name: 'Yaşam Özü', icon: 'heart', v: [0.01, 0.02, 0.03], f: 'p', desc: 'Her öldürme azami canının %{v}’ini yeniler.' },
  dikenZirh:  { soy: 'kan', name: 'Diken Zırh', icon: 'armor', v: [0.1, 0.2, 0.32], f: 'p', desc: 'Sana vuran yakındaki düşman azami canının %{v}’i kadar hasar alır.' },
  kalinKan:   { soy: 'kan', name: 'Kalın Kan', icon: 'crystal', v: [0.2, 0.35, 0.55], f: 'p', desc: 'Azami can +%{v}.' },
  kanBagi:    { soy: 'kan', mp: true, name: 'Kan Bağı', icon: 'hand', v: [0.2, 0.3, 0.4], f: 'p', desc: 'Partnerine 6 blok yakınken ikiniz de %{v} fazla vurur ve saniyede %2 can yenilersiniz.' },
  // ---- TOPRAK: kazı ve cevher
  zincir:     { soy: 'toprak', name: 'Zincirleme Kırılım', icon: 'chain', v: [0.3, 0.5, 0.75], f: 'p', desc: 'Kırdığın blok %{v} ihtimalle arkasındakini de kırar.' },
  damar:      { soy: 'toprak', name: 'Damar Avcısı', icon: 'gem', v: [0.5, 1, 1.6], f: 'x', desc: 'Her cevher ortalama +{v} fazla düşer.' },
  kazmaDarbesi:{ soy: 'toprak', name: 'Kazma Darbesi', icon: 'drill', v: [1.5, 2.5, 4], f: 'x', desc: 'Kazı vuruşların önündeki düşmana silah hasarının {v} katını vurur.' },
  deprem:     { soy: 'toprak', name: 'Deprem Vuruşu', icon: 'dynamite', v: [7, 5, 3], f: 'x', desc: 'Kırdığın her {v}. blok çevresindeki kayaları da yıkar.' },
  derinCep:   { soy: 'toprak', name: 'Derin Cepler', icon: 'bag', v: [0.3, 0.55, 0.9], f: 'p', desc: 'Çanta kapasitesi +%{v}; cevherleri 3 kat uzaktan çekersin.' },
  simya:      { soy: 'toprak', name: 'Simya', icon: 'gold', v: [0.15, 0.28, 0.45], f: 'p', desc: 'Demir, su ve kobalt damarları %{v} ihtimalle altın verir.' },
  // ---- GÖLGE: sessizlik, infaz
  sessizAdim: { soy: 'golge', name: 'Sessiz Adım', icon: 'hush', v: [0.25, 0.42, 0.6], f: 'p', desc: 'Tüm kazı gürültün %{v} azalır.' },
  hayaletDeri:{ soy: 'golge', name: 'Hayalet Deri', icon: 'shield', v: [1, 1.5, 2.2], f: 'x', desc: 'Hasar aldıktan sonra {v} sn dokunulmaz olursun.' },
  cellat:     { soy: 'golge', name: 'Cellat', icon: 'skull', v: [0.12, 0.18, 0.25], f: 'p', desc: 'Canı %{v}’in altına düşen düşman anında ölür (boss hariç).' },
  yuvaAvcisi: { soy: 'golge', name: 'Yuva Avcısı', icon: 'sharp', v: [2, 3, 4], f: 'x', desc: 'Yuvaları {v} kat hızlı kazarsın; yıktığında gürültü 25 düşer.' },
  suikast:    { soy: 'golge', name: 'Suikastçi', icon: 'rifle', v: [2, 3, 4], f: 'x', desc: 'Tam canlı düşmana vurduğun ilk darbe {v} kat vurur.' },
  // ---- İKİLİ: iki soyu birleştirir
  termalSok:  { duo: ['ates', 'buz'], name: 'Termal Şok', icon: 'boom', desc: 'Hem yanan hem yavaşlamış düşmana isabet %20 ihtimalle patlar: silah hasarının 4 katı alan hasarı.' },
  ciftNamlu:  { duo: ['ates', 'simsek'], name: 'Çift Namlu', icon: 'split', desc: 'Silahın aynı anda iki mermi atar.' },
  magmaKazma: { duo: ['ates', 'toprak'], name: 'Magma Kazma', icon: 'flame', desc: 'Kırdığın her blok 2.5 blok içindeki düşmanları tutuşturur.' },
  kristalKabuk:{ duo: ['buz', 'toprak'], name: 'Kristal Kabuk', icon: 'crystal', desc: 'Kırdığın her 15 blok, azami canının %30’unu emen bir kalkan verir.' },
  deliciIsin: { duo: ['simsek', 'golge'], name: 'Delici Işın', icon: 'pierce', desc: 'Mermilerin 3 düşmanı delip geçer; menzil +%30.' },
  adrenPompa: { duo: ['kan', 'simsek'], name: 'Adrenalin Pompası', icon: 'adren', desc: 'Canın yarının altındayken atış hızın ×1.5, hareketin +%25.' },
  kanAvcisi:  { duo: ['kan', 'golge'], name: 'Kan Avcısı', icon: 'skull', desc: 'Tek vuruşta öldürdüğün her düşman azami canının %4’ünü yeniler.' },
  // ---- EFSANEVİ: soysuz, nadir
  dorduncuYuva:{ leg: true, name: 'Usta Tüfekçi', icon: 'blaster', desc: 'Silah seviyen iki kat hızlı dolar.' },
  aletUstasi: { leg: true, name: 'Alet Ustası', icon: 'turret', desc: 'Aynı anda bir alet daha kurarsın; aletler %50 daha hızlı ve güçlü.' },
  devAvcisi:  { leg: true, name: 'Dev Avcısı', icon: 'elite', v: [0.35, 0.6, 0.9], f: 'p', desc: 'Elitlere ve bosslara %{v} fazla hasar verirsin.' },
  bolKemer:   { leg: true, name: 'Bol Kemer', icon: 'gear', desc: 'Her eşyadan 2 fazla taşırsın ve açık her eşyadan birer tane kazanırsın.' },
  altinDokunus:{ leg: true, name: 'Altın Dokunuş', icon: 'crown', desc: 'Her öldürme 1 altın düşürür; elitler 6.' },
  ikinciNefes:{ leg: true, name: 'İkinci Nefes', icon: 'heart', desc: 'Bayıldığında bir kez kendin kalkarsın (sefer başına).' },
  // ---- LANETLİ: büyük güç, büyük bedel
  camTop:     { curse: true, name: 'Cam Top', icon: 'crystal', desc: 'Silah ve kazı hasarın ×1.8. Bedeli: azami canın %40 azalır.' },
  kanPakti:   { curse: true, name: 'Kan Paktı', icon: 'heart', desc: 'Her öldürme azami canının %4’ünü yeniler. Bedeli: yeraltında saniyede %1.5 can kaybedersin.' },
  gurultuTanrisi:{ curse: true, name: 'Gürültü Tanrısı', icon: 'wave', desc: 'Silah hasarın +%70. Bedeli: tüm gürültü %60 fazla.' },
  acKazma:    { curse: true, name: 'Aç Kazma', icon: 'drill', desc: 'Kazı gücün ×2.2. Bedeli: çanta kapasiten %35 azalır.' },
  kumar:      { curse: true, name: 'Kumarbaz', icon: 'chest', desc: 'Sandıklar 2 fazla seçenek sunar, yeniden çekmek bedava. Bedeli: elitler iki kat dayanıklı.' },
};
export const PERK_KEYS = Object.keys(PERKS);
export const maxLv = k => (PERKS[k].v ? PERKS[k].v.length : 1);
// seviye değerinin okunur hali
export function fmtV(k, lv) {
  const d = PERKS[k], v = d.v ? d.v[Math.max(0, lv - 1)] : 0;
  return d.f === 'p' ? String(Math.round(v * 100)) : d.f === 'b' ? String(+(v / 16).toFixed(1)) : String(+v.toFixed(2));
}
export function perkDesc(k, lv = 1, next = 0) {
  const d = PERKS[k];
  if (!d.v) return d.desc;
  return d.desc.replace('{v}', next ? `${fmtV(k, lv)} → <b>${fmtV(k, next)}</b>` : fmtV(k, lv));
}
// kalıntı türü: kart etiketi ve rengi
export function perkKind(k) { const d = PERKS[k]; return d.curse ? 'curse' : d.leg ? 'leg' : d.duo ? 'duo' : 'soy'; }
// yeniden çekme bedeli (altın)
export const REROLL = { base: 4, step: 4 };
// sandık kalitesi: 0 ahşap · 1 demir · 2 altın/kadim/lanetli — ikili ve efsanevi ağırlığı
export const OFFER_W = { duo: [0.4, 1.2, 3], leg: [0, 0.25, 1.2], up: 1.3, pull: 1.6 };
