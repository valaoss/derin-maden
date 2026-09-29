// Giriş: uygulamada kayıtlar kalıcı kopyadan geri yüklendikten sonra oyun başlar
import { restoreSaves } from './core/native.js';

restoreSaves().finally(() => import('./main.js'));
