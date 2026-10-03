// Boss seslendirmeleri: her bossun uyanış (spawn), öfke (rage) ve düşüş (down) repliği.
// voice: ElevenLabs sesi (scripts/boss-voices.mjs üretirken kullanır); rate: oyunda çalma hızı (düşük = kalın, ağır); echo: yankı gecikmesi (sn)
export const VOICE = {
  karakok: { voice: 'adam', rate: 0.82, echo: 0.14, lines: {
    spawn: 'Köklerim uyandı. Toprağıma kim dokundu?',
    rage: 'Seni köklerime gömeceğim!',
    down: 'Kökler kurur... ama toprak unutmaz.' } },
  kavurgan: { voice: 'callum', rate: 0.8, echo: 0.12, lines: {
    spawn: 'Küllerimden kalktım. Yanmaya hazır mısın?',
    rage: 'Kemiklerin külüme karışacak!',
    down: 'Ateşim... sönüyor...' } },
  otegoz: { voice: 'lily', rate: 0.88, echo: 0.2, lines: {
    spawn: 'Seni görüyorum, küçük madenci.',
    rage: 'Boşluk sana bakıyor. Gözünü kaçırma!',
    down: 'Göz... kapanıyor...' } },
  kordesen: { voice: 'brian', rate: 0.8, echo: 0.1, lines: {
    spawn: 'Seni duyuyorum. Kazmanın sesi beni çağırdı.',
    rage: 'Kaçamazsın! Kayayı senden iyi tanırım!',
    down: 'Sessizlik... sonunda...' } },
  ezeli: { voice: 'george', rate: 0.98, echo: 0.24, lines: {
    spawn: 'Rüyamı böldün, ölümlü. Yargılanacaksın.',
    rage: 'Işığım seni yakacak!',
    down: 'Rüya bitti... Uyan artık.' } },
  aynasiz: { voice: 'daniel', rate: 0.93, echo: 0.07, lines: {
    spawn: 'Tahtıma hoş geldin. Silahın güzelmiş; artık benim.',
    rage: 'Kendi yansımanla savaşmayı öğren!',
    down: 'Ayna... kırıldı...' } },
  kehribarAna: { voice: 'sarah', rate: 0.9, echo: 0.12, lines: {
    spawn: 'Yavrularım aç. Tam vaktinde geldin.',
    rage: 'Reçinemde sonsuza dek kalacaksın!',
    down: 'Yavrularım... beni unutmayın...' } },
  madenKalbi: { voice: 'brian', rate: 0.72, echo: 0.18, lines: {
    spawn: 'Bu maden benim bedenim. Sen de içindesin.',
    rage: 'Duvarlar kapanıyor. Nabzımı duy!',
    down: 'Kalp... duruyor...' } },
  balrog: { voice: 'callum', rate: 0.7, echo: 0.14, lines: {
    spawn: 'Karanlıkta alev uyandı. Kaç, madenci!',
    rage: 'Ateşim seni kül edecek!',
    down: 'Gölge... çekiliyor...' } },
  poseidon: { voice: 'george', rate: 0.86, echo: 0.2, lines: {
    spawn: 'Tapınağıma girmeye nasıl cüret edersin?',
    rage: 'Denizin gazabını tat!',
    down: 'Deniz... beni geri çağırıyor...' } },
  dunyaYilani: { voice: 'arnold', rate: 0.76, echo: 0.22, lines: {
    spawn: 'Deniz sustu. Çünkü ben uyandım.',
    rage: 'Seni kuşatacağım, küçük şey!',
    down: 'Kuşak... çözülüyor...' } },
  ejder: { voice: 'brian', rate: 0.86, echo: 0.12, lines: {
    spawn: 'Altınıma kim dokundu? Hırsız!',
    rage: 'Hazinemle birlikte yanacaksın!',
    down: 'Altınım... altınım...' } },
};
