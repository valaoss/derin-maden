// iOS (Capacitor) köprüsü: web'de hiçbir şey yapmaz, eklentiler yalnızca uygulamada yüklenir.
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const WEB_URL = 'https://valaoss.github.io/derin-maden/';

// Kayıtlar: localStorage hızlı önbellek, Preferences (UserDefaults) kalıcı kopya; iOS depolamayı temizlerse geri yüklenir
const KEYS = ['derinMaden.meta.v4', 'derinMaden.run.v4', 'derinMaden.settings.v1'];
const prefs = () => import('@capacitor/preferences').then(m => m.Preferences);
export async function restoreSaves() {
  if (!isNative) return;
  try {
    const P = await prefs();
    for (const key of KEYS) {
      if (localStorage.getItem(key) != null) continue;
      const { value } = await P.get({ key });
      if (value != null) localStorage.setItem(key, value);
    }
  } catch (e) { /* yok */ }
}
export function persist(key, value) {
  if (!isNative) return;
  prefs().then(P => value == null ? P.remove({ key }) : P.set({ key, value })).catch(() => {});
}

// Titreşim: iOS'ta navigator.vibrate yok; süreyi darbe gücüne çevir
let haptics = null;
export function nativeHaptic(ms) {
  const d = Array.isArray(ms) ? Math.max(...ms) : ms;
  const style = d <= 15 ? 'LIGHT' : d <= 40 ? 'MEDIUM' : 'HEAVY';
  (haptics || (haptics = import('@capacitor/haptics').then(m => m.Haptics)))
    .then(H => H.impact({ style })).catch(() => {});
}

// Paylaşım menüsü (davet linki / fotoğraf)
export async function nativeShare(opts) {
  const { Share } = await import('@capacitor/share');
  await Share.share(opts);
}
export async function nativeShareImage(blob, name) {
  const [{ Filesystem, Directory }, data] = await Promise.all([
    import('@capacitor/filesystem'),
    new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); }),
  ]);
  const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
  await nativeShare({ title: 'Derin Maden', files: [uri] });
}
