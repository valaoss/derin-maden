// sagirAvci önizleme sahneleri (boss-scenes.mjs yardımcılarıyla)
export default function scenes(H) {
  const { act, aim, staged, total, timed } = H;
  const charge = { dur: 2.9, run(c, e, p, dt) {
    const L = [['listen', 0.6], ['dash', 0.9], ['skid', 0.4]]; if (c >= total(L)) return; const s = staged(c, L);
    act(e, 'charge', { stage: s.stage, st: s.st, T: 3, a: e.aimA ?? (e.aimA = aim(e, p)), fire: s.stage === 'dash' }); e.wind = s.stage === 'listen' ? s.k : 0;
    if (s.stage === 'dash') { e.x += Math.cos(e.aimA) * 160 * dt; e.y += Math.sin(e.aimA) * 160 * dt; e.lunge = 1; }
  } };
  return {
    charge,
    chargeUp: { dur: 2.9, setup(e, p) { p.x = e.x + 50; p.y = e.y - 60; }, run: charge.run },
    scream: { dur: 2, run(c, e, p) { if (c < 1.2) { act(e, 'scream', { T: 1.2 - c, stage: c < 0.6 ? 'wind' : 'fire', a: aim(e, p), fire: c >= 0.6 }); e.wind = c < 0.6 ? c / 0.6 : 0; } } },
    // dalar (sink: e.sink 0->1), altta ilerler (go: e.under), fırlar (rise: e.sink 1->0)
    burrow: { dur: 2.6, run(c, e) {
      const L = [['sink', 0.5], ['go', 0.6], ['rise', 0.6]]; if (c >= total(L)) return; const s = staged(c, L);
      act(e, 'burrow', { stage: s.stage, st: s.st, T: 4 });
      e.sink = s.stage === 'sink' ? s.k : s.stage === 'go' ? 1 : 1 - s.k; e.under = s.stage === 'go';
    } },
    tremor: timed('tremor', 1.6),
    claws: timed('claws', 1),
    listen: { dur: 5, setup(e) { e.listen = 1; }, run(c, e) { e.listen = 1; } },
  };
}
