import {
  anomalia,
  auc,
  aucPareadoBlocos,
  postosDentro,
  benjaminiHochberg,
  defasagens,
  permutacaoBlocos,
  permutacaoGrupos,
  rotulosEmBlocos,
  sinaisPorAnos,
  sorteio,
  spearman,
} from './cruzar.ts';

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

test('group test by label permutation: a real shift gives a small p, no shift a large one; labels move only inside their block', () => {
  const r = sorteio(9);
  const v = Array.from({ length: 140 }, () => r());
  const g = v.map((_, i) => i % 7 >= 5); // "weekend" days
  const comEfeito = v.map((x, i) => (g[i] ? x + 0.5 : x));
  const semana = v.map((_, i) => Math.floor(i / 7));
  expect(permutacaoGrupos(comEfeito, g, { blocos: semana, n: 199, semente: 1 }).p).toBeLessThan(0.01);
  // Without an effect, about 5% of datasets fall under 0.05 (40 random ones here).
  const falsos = Array.from({ length: 40 }, (_, k) => {
    const rk = sorteio(100 + k);
    const w = v.map(() => rk());
    return permutacaoGrupos(w, g, { blocos: semana, n: 99, semente: k }).p < 0.05;
  }).filter(Boolean).length;
  expect(falsos).toBeLessThanOrEqual(6);
  expect(permutacaoGrupos(comEfeito, g, { n: 99, semente: 2 }).efeito).toBeGreaterThan(0.3);
});

test('sign flips of whole years: 10 years all on one side give p near 2/1024; mixed signs give a large p', () => {
  const forte = sinaisPorAnos([0.5, 0.6, 0.4, 0.7, 0.5, 0.3, 0.6, 0.5, 0.4, 0.6], { n: 9999, semente: 2 });
  expect(forte.efeito).toBeCloseTo(0.51, 6);
  expect(forte.p).toBeLessThan(0.01); // only the all-positive and all-negative flips are as strong: 2 of 1024
  expect(sinaisPorAnos([0.5, -0.6, 0.4, -0.7, 0.5, -0.3, 0.6, -0.5, 0.4, -0.6], { n: 999, semente: 2 }).p).toBeGreaterThan(0.5);
});

test('labels moved in whole 7-day blocks: a shift on the labelled days gives a small p, labels unrelated to v a large p', () => {
  const r = sorteio(5);
  const n = 7 * 60;
  const g = Array.from({ length: n }, (_, i) => Math.floor(i / 7) % 3 === 0); // whole labelled weeks, like smoke weeks
  const ruido = Array.from({ length: n }, () => r());
  const comEfeito = ruido.map((x, i) => x + (g[i] ? 0.4 : 0));
  const dif = (v: number[]) => (gg: boolean[]) => {
    const m = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return m(v.filter((_, i) => gg[i])) - m(v.filter((_, i) => !gg[i]));
  };
  const forte = rotulosEmBlocos(g, dif(comEfeito), { n: 999, semente: 1 });
  expect(forte.efeito).toBeGreaterThan(0.3);
  expect(forte.p).toBeLessThan(0.01);
  expect(rotulosEmBlocos(g, dif(ruido), { n: 999, semente: 1 }).p).toBeGreaterThan(0.05);
});

test('AUC: 1 when the score splits the labels, 0.5 at random, ties count half, nulls left out', () => {
  expect(auc([1, 2, 3, 4], [false, false, true, true])).toBe(1);
  expect(auc([4, 3, 2, 1], [false, false, true, true])).toBe(0);
  expect(auc([1, 1, 1, 1], [false, true, false, true])).toBe(0.5);
  expect(auc([1, 3, 2, null], [false, true, true, false])).toBe(1);
  expect(auc([1, 2], [true, true])).toBeNaN();
  // Mann–Whitney by hand: true {2, 5}, false {1, 3, 4}: pairs won 1 + 3 = 4 of 6
  expect(auc([1, 2, 3, 4, 5], [false, true, false, false, true])).toBeCloseTo(4 / 6, 12);
});

test('paired AUC: a score that splits beats one that does not; equal scores give p = 1', () => {
  const r = sorteio(7);
  const dias = 140;
  const fu = Array.from({ length: dias }, (_, i) => Math.floor(i / 10) % 2 === 0);
  const bom = fu.map((f) => (f ? 1 : 0) + r());
  const ruim = fu.map(() => r());
  const d = aucPareadoBlocos(bom, ruim, fu);
  expect(d.efeito).toBeGreaterThan(0.4);
  expect(d.p).toBeLessThan(0.01);
  expect(aucPareadoBlocos(bom, bom, fu)).toEqual({ efeito: 0, p: 1 });
});

test('AUC inside groups: only pairs of the same group (e.g. season) count', () => {
  // Pooled, 11 (true, group B) is compared with 10 (false, group A): pooled 0.75, inside each group 1.
  const s = [1, 2, 10, 11];
  const g = [false, true, false, true];
  expect(auc(s, g)).toBe(0.75);
  expect(auc(s, g, ['A', 'A', 'B', 'B'])).toBe(1);
  expect(auc(s, g, ['A', 'B', 'A', 'B'])).toBeNaN(); // no group has both labels
  // A group with one label only adds no pair.
  expect(auc([1, 2, 5, 6], [false, true, true, true], ['A', 'A', 'B', 'B'])).toBe(1);
});

test('paired AUC inside groups: the effect is the difference of the AUCs inside the groups', () => {
  const r = sorteio(3);
  const grupo = Array.from({ length: 140 }, (_, i) => Math.floor(i / 70));
  const fu = grupo.map((_, i) => Math.floor(i / 10) % 2 === 0);
  // Score a carries a level shift between groups that pooled ranks would mix in.
  const a = fu.map((f, i) => (f ? 1 : 0) + r() + grupo[i] * 5);
  const b = fu.map(() => r());
  const d = aucPareadoBlocos(a, b, fu, { grupo });
  expect(d.efeito).toBeCloseTo(auc(a, fu, grupo) - auc(b, fu, grupo), 12);
  expect(auc(a, fu, grupo)).toBe(1);
  expect(auc(a, fu)).toBeLessThan(0.9);
  expect(aucPareadoBlocos(a, a, fu, { grupo })).toEqual({ efeito: 0, p: 1 });
});

test('ranks inside each group (e.g. each season), ties averaged; nulls stay null', () => {
  expect(postosDentro([5, 1, 9, 30, 10, null], [2015, 2015, 2015, 2016, 2016, 2016])).toEqual([2, 1, 3, 2, 1, null]);
  expect(postosDentro([1, 1, 2], [0, 0, 0])).toEqual([1.5, 1.5, 3]);
});
