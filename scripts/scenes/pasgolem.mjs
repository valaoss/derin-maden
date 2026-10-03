// pasGolem önizleme sahneleri (boss-scenes.mjs yardımcılarıyla)
export default function scenes(H) {
  const { act, aim, staged, total } = H;
  const pol = v => ({ dur: 2.6, run(c, e) { if (c < 2.1) { act(e, 'polarity', { T: 2.1 - c, stage: c < 0.6 ? 'wind' : 'pulse', pol: v }); e.wind = c < 0.6 ? c / 0.6 : 0; } } });
  return {
    magnet: { dur: 3.6, run(c, e) { if (c < 3) act(e, 'magnet', { T: 3 - c, stage: 'hold' }); } },
    magnetPush: { dur: 3.6, run(c, e) { if (c < 3) act(e, 'magnet', { T: 3 - c, stage: 'hold', pol: -1 }); } },
    polarity: pol(1),
    polarityPush: pol(-1),
    scrap: { dur: 1.6, run(c, e) { if (c < 0.8) act(e, 'scrap', { T: 0.8 - c }); } },
    absorb: { dur: 2.6, run(c, e) { if (c < 2) act(e, 'absorb', { T: 2 - c, pol: 1 }); } },
    rail: { dur: 3.8, run(c, e, p, dt) {
      const L = [['aim', 0.8], ['dash', 1.1], ['daze', 1.2]]; if (c >= total(L)) return; const s = staged(c, L);
      act(e, 'rail', { stage: s.stage, st: s.st, T: 4, a: e.aimA ?? (e.aimA = aim(e, p)), pol: 1, fire: s.stage === 'dash' }); e.wind = s.stage === 'aim' ? s.k : 0;
      if (s.stage === 'dash') { e.x += Math.cos(e.aimA) * 150 * dt; e.y += Math.sin(e.aimA) * 150 * dt; e.lunge = 1; p.x = e.x + 80; }
    } },
  };
}
