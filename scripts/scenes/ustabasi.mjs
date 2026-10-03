// ustabasi önizleme sahneleri (boss-scenes.mjs yardımcılarıyla)
export default function scenes(H) {
  const { act, aim } = H;
  return {
    // kazmayı fırlatır: 0.45 sn geri çekiş, ~1.6 sn kazma havada (el boş), sonra ele döner
    throw: { dur: 2.8, run(c, e, p) { const W = 0.45, T = W + 1.6; if (c < T) { act(e, 'throw', { T: T - c, stage: c < W ? 'wind' : 'away', a: aim(e, p) }); e.wind = c < W ? c / W : 0; } } },
    raise: H.timed('raise', 1),
    cage: { dur: 1.6, run(c, e, p) { if (c < 0.8) { act(e, 'cage', { T: 0.8 - c, stage: c < 0.4 ? 'wind' : 'hit', a: aim(e, p) }); e.wind = c < 0.4 ? c / 0.4 : 0; } } },
    collapse: { dur: 1.9, run(c, e, p) { if (c < 1.1) { act(e, 'collapse', { T: 1.1 - c, stage: c < 0.7 ? 'wind' : 'hit', a: aim(e, p) }); e.wind = c < 0.7 ? c / 0.7 : 0; } } },
    // feneri söndürür, çömelir; ardından ışınlanmanın titreyişi
    lamp: { dur: 1.9, run(c, e) { if (c < 0.7) act(e, 'lamp', { T: 0.7 - c }); else if (c < 1) e.blinkT = 1 - c; } },
  };
}
