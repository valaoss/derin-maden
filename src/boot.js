// Giriş: uygulamada kayıtlar kalıcı kopyadan geri yüklendikten sonra oyun başlar
import { restoreSaves } from './core/native.js';

// ana paket yüklenemezse (ağ kesildi, eski önbellek) yükleme çubuğu sonsuza dek dönmesin: yeniden dene düğmesi
function failed() {
  const b = document.getElementById('boot'); if (!b) return;
  b.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:#07040b';
  b.innerHTML = '<div style="color:#f5ecd8;font:16px Tiny5,monospace;text-align:center;padding:24px">Oyun yüklenemedi.<br><br><button id="bootRetry" style="font:inherit;padding:10px 18px;background:#f2c14e;color:#140c1c;border:0">YENİDEN DENE</button></div>';
  document.getElementById('bootRetry').onclick = () => location.reload();
}
restoreSaves().catch(() => {}).finally(() => import('./main.js').catch(failed));
