// Oyuncu komutları (eşya kullan, satın al, üret, inşa et, onar, perk seç).
// UI komutu dispatch() ile verir; tek oyunculuda hemen, çok oyunculuda lockstep karesinde çalışır.
import { G } from './state.js';
import { useItem } from './items.js';
import { buyUpgrade, craftItem, pickupBuild, applyPerk, buyMod, toggleMod, gearPick, testFunds, levelUp } from './economy.js';
import { useMod } from './combat.js';
import { addPing } from './pings.js';
import { callElevator } from './elevator.js';
import { emit } from '../core/events.js';

export const CMD = { USE: 'u', BUY: 'b', CRAFT: 'c', PICKUP: 'k', PERK: 'p', MODBUY: 'mb', MODEQ: 'me', MODUSE: 'mu', PING: 'g', ELEV: 'el', GEAR: 'gr', TEST: 'tx', LVUP: 'lu' };

// Simülasyon içinde çalışır: pi = komutu veren oyuncu indeksi
export function execCmd(pi, cmd) {
  const p = G.players[pi];
  if (!p || G.over) return false;
  switch (cmd.t) {
    case CMD.USE: return useItem(cmd.k, p);
    case CMD.BUY: return buyUpgrade(cmd.k, p);
    case CMD.CRAFT: return craftItem(cmd.k, p);
    case CMD.PICKUP: return pickupBuild(cmd.i | 0, p);
    case CMD.PING: return addPing(pi, Math.round(+cmd.x || 0), Math.round(+cmd.y || 0));
    case CMD.ELEV: return callElevator(p, cmd.to | 0);
    case CMD.MODBUY: return buyMod(cmd.k, p);
    case CMD.MODEQ: return toggleMod(cmd.k, p);
    case CMD.MODUSE: return useMod(cmd.k, p);
    case CMD.GEAR: return gearPick(cmd.g === 'w' ? 'w' : 'p', String(cmd.k), p);
    case CMD.TEST: return testFunds(p);
    case CMD.LVUP: return levelUp(cmd.g === 'w' ? 'w' : 't', String(cmd.k), p);
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
