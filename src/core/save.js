// Kalıcı veri: meta ilerleme, ayarlar, devam eden sefer.
const META_KEY = 'derinMaden.meta.v4';
const RUN_KEY = 'derinMaden.run.v4';
const SET_KEY = 'derinMaden.settings.v1';
const LEGACY_META = 'derinMadenMetaV3';

function read(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* depolama yok */ } }
function remove(k) { try { localStorage.removeItem(k); } catch (e) { /* yok */ } }

export function loadMeta() {
  const m = read(META_KEY);
  const base = { oz: 0, runs: 0, bestDepth: 0, bestWave: 0, wins: 0, tutorialDone: false, lv: {}, maxStratum: 0 };
  if (m) return Object.assign(base, m, { lv: Object.assign({}, m.lv) });
  // eski sürümden göç: havuz -> Öz
  const old = read(LEGACY_META);
  if (old) { base.oz = old.pool | 0; base.runs = old.runs | 0; base.bestDepth = old.best | 0; base.tutorialDone = base.runs > 0; }
  return base;
}
export const saveMeta = m => write(META_KEY, m);

export function loadSettings() {
  return Object.assign({ sfx: true, music: true, haptics: true, shake: true, lefty: false, name: '', helm: 0, role: 'kazici' }, read(SET_KEY) || {});
}
export const saveSettings = s => write(SET_KEY, s);

export const loadRun = () => read(RUN_KEY);
export const saveRun = r => write(RUN_KEY, r);
export const clearRun = () => remove(RUN_KEY);
