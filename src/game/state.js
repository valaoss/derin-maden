// Aktif sefer durumu. Tüm sistemler bu tek nesneyi paylaşır.
export let G = null;
export function setG(g) { G = g; }

// Uygulama geneli (meta, ayarlar, sahne)
export const App = {
  meta: null,
  settings: null,
  scene: 'menu',   // menu | play | results
};

// katman konumu (0..19) -> biyom kimliği (STRATA/HOST_* indeksi); sefer sırası G.order'da
export function biomeOf(s) { const o = G && G.order; return o && s >= 0 && s < o.length ? o[s] : Math.max(0, s | 0); }
