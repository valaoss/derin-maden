// Aktif sefer durumu. Tüm sistemler bu tek nesneyi paylaşır.
export let G = null;
export function setG(g) { G = g; }

// Uygulama geneli (meta, ayarlar, sahne)
export const App = {
  meta: null,
  settings: null,
  scene: 'menu',   // menu | play | results
};
