// dev önizleme sahneleri (boss-scenes.mjs yardımcılarıyla)
export default function scenes(H) {
  const { act, aim } = H;
  return {
    pulse: { dur: 2, run(c, e, p) { if (c < 1.3) { act(e, 'pulse', { T: 1.3 - c, stage: c < 0.8 ? 'wind' : 'fire', a: aim(e, p), fire: c >= 0.8 }); e.wind = c < 0.8 ? c / 0.8 : 0; } } },
    fist: { dur: 1.6, setup(e, p) { p.x = e.x + 40; }, run(c, e, p) { if (c < 1) { act(e, 'fist', { T: 1 - c, stage: c < 0.55 ? 'wind' : 'hit', a: aim(e, p), fire: c >= 0.55 }); e.wind = c < 0.55 ? c / 0.55 : 0; } } },
    inhale: { dur: 2.8, run(c, e, p) { if (c < 2.2) { act(e, 'inhale', { T: 2.2 - c, stage: c < 1.6 ? 'suck' : 'blow', a: aim(e, p), fire: c >= 1.6 }); e.wind = c < 1.6 ? c / 1.6 : 0; } } },
    veins: { dur: 1.6, run(c, e) { if (c < 1) { act(e, 'veins', { T: 1 - c, fire: c >= 0.35 }); e.wind = Math.min(1, c / 0.35); } } },
    heart: { dur: 3.4, run(c, e) { if (c < 2.8) act(e, 'heart', { T: 2.8 - c, stage: 'open' }); } },
  };
}
