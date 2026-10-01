// Basit çevrimdışı önbellek: önce ağ, olmazsa önbellek (güncellemeler hemen gelir).
// Yalnız başarılı yanıtlar saklanır; sayfa dışı istek (js/css) asla index.html ile karşılanmaz; eski sürüm dosyaları budanır.
const CACHE = 'derin-maden-v2', MAX = 80;
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
async function keep(req, res) {
  const ca = await caches.open(CACHE);
  await ca.put(req, res);
  const ks = await ca.keys();
  for (let i = 0; i < ks.length - MAX; i++) await ca.delete(ks[i]);
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  const nav = req.mode === 'navigate';
  e.respondWith(
    fetch(req, nav ? { cache: 'no-cache' } : undefined).then(r => { if (r.ok && r.type === 'basic') e.waitUntil(keep(req, r.clone())); return r; })
      .catch(() => caches.match(req).then(r => r || (nav ? caches.match('./') : Response.error())))
  );
});
