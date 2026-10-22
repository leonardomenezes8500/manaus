import { anomalia, benjaminiHochberg, defasagens, permutacaoBlocos, sorteio, spearman } from './cruzar.ts';

// Ten years of days with the same yearly cycle and independent noise: the trap the method exists for.
function sazonal(semente: number) {
  const r = sorteio(semente);
  const dias: string[] = [];
  const v: number[] = [];
  for (let t = Date.parse('2012-01-01'); t < Date.parse('2022-01-01'); t += 86_400_000) {
    const d = new Date(t);
    const doy = (t - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000;
    dias.push(d.toISOString().slice(0, 10));
    v.push(Math.sin((2 * Math.PI * doy) / 365) + 0.5 * (r() - 0.5));
  }
  return { dias, v };
}

test('two series that only share the season come out linked raw, and stop being linked after the seasonal anomaly', () => {
  const a = sazonal(1);
  const b = sazonal(2);
  expect(spearman(a.v, b.v)).toBeGreaterThan(0.6);
  expect(permutacaoBlocos(a.v, b.v, { bloco: 7, n: 199, semente: 3 })).toBeLessThan(0.05);
  const xa = anomalia(a.dias, a.v);
  const xb = anomalia(b.dias, b.v);
  expect(Math.abs(spearman(xa, xb))).toBeLessThan(0.1);
  expect(permutacaoBlocos(xa, xb, { bloco: 7, n: 199, semente: 3 })).toBeGreaterThan(0.05);
});

test('y = x three days later: the lag with the strongest correlation is 3', () => {
  const r = sorteio(7);
  const x = Array.from({ length: 400 }, () => r());
  const y = x.map((_, i) => (i >= 3 ? x[i - 3] : r()));
  const c = defasagens(x, y, 7);
  expect(c).toHaveLength(8);
  expect(c.indexOf(Math.max(...c))).toBe(3);
});

test('Benjamini-Hochberg with known p-values (same as R p.adjust "BH")', () => {
  const r = benjaminiHochberg([0.01, 0.02, 0.03, 0.04, 0.05, 0.5], 0.05);
  expect(r.ajustado.map((p) => +p.toFixed(4))).toEqual([0.06, 0.06, 0.06, 0.06, 0.06, 0.5]);
  expect(r.rejeita).toEqual([false, false, false, false, false, false]);
  expect(benjaminiHochberg([0.04, 0.01, 0.03, 0.005], 0.05).rejeita).toEqual([true, true, true, true]);
  expect(benjaminiHochberg([0.001, 0.2, 0.3], 0.1).rejeita).toEqual([true, false, false]);
});

test('block permutation: the same seed gives the same p-value', () => {
  const a = sazonal(4).v.slice(0, 300);
  const b = sazonal(5).v.slice(0, 300);
  const p = (semente: number) => permutacaoBlocos(a, b, { bloco: 7, n: 99, semente });
  expect(p(11)).toBe(p(11));
});

test('Spearman with ties uses average ranks; nulls drop the pair', () => {
  expect(spearman([1, 2, 2, 3], [1, 2, 3, 4])).toBeCloseTo(0.9487, 4);
  expect(spearman([1, 2, null, 3], [3, 2, 9, 1])).toBeCloseTo(-1);
});
