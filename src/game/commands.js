// Oyuncu komutları (eşya kullan, satın al, üret, inşa et, onar, perk seç).
// UI komutu dispatch() ile verir; tek oyunculuda hemen, çok oyunculuda lockstep karesinde çalışır.
import { G } from './state.js';
import { useItem } from './items.js';
import { buyUpgrade, craftItem, buildOnPad, repairBase, applyPerk } from './economy.js';
import { emit } from '../core/events.js';

export const CMD = { USE: 'u', BUY: 'b', CRAFT: 'c', BUILD: 's', REPAIR: 'r', PERK: 'p' };

// Simülasyon içinde çalışır: pi = komutu veren oyuncu indeksi
export function execCmd(pi, cmd) {
  const p = G.players[pi];
  if (!p || G.over) return false;
  switch (cmd.t) {
    case CMD.USE: return useItem(cmd.k, p);
    case CMD.BUY: return buyUpgrade(cmd.k, p);
    case CMD.CRAFT: return craftItem(cmd.k, p);
    case CMD.BUILD: return buildOnPad(cmd.k, cmd.pad | 0, p);
    case CMD.REPAIR: return repairBase(p);
    case CMD.PERK: {
      const off = G.perkOffer;
      if (!off || off.pi !== pi || !off.keys.includes(cmd.k)) return false;
      return applyPerk(cmd.k, p);
    }
  }
  return false;
}

let queue = null; // çok oyunculu: lockstep tarafından set edilir
export function setCommandQueue(q) { queue = q; }

// UI'dan çağrılır. Dönüş: tek oyunculuda gerçek sonuç, çok oyunculuda "kuyruğa alındı"
export function dispatch(cmd) {
  if (queue) { queue(cmd); return true; }
  const ok = execCmd(G.localIdx, cmd);
  emit('cmdDone', { cmd, ok });
  return ok;
}
