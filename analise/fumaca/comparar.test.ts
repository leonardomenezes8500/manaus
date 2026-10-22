import { distancia24h, parcelaEmComum, separacao } from './comparar.ts';

test('shared share of two rankings: the same is 1, nothing in common is 0, a municipality only in one counts nothing', () => {
  const a = [
    { municipio: 1, parcela: 0.6 },
    { municipio: 2, parcela: 0.4 },
  ];
  expect(parcelaEmComum(a, a)).toBeCloseTo(1);
  expect(parcelaEmComum(a, [{ municipio: 3, parcela: 1 }])).toBe(0);
  expect(
    parcelaEmComum(a, [
      { municipio: 1, parcela: 0.3 },
      { municipio: 3, parcela: 0.7 },
    ]),
  ).toBeCloseTo(0.3);
  expect(parcelaEmComum([], a)).toBe(0);
});

test('FU days against clean days: ratio of the medians and how many FU days fall in the top quartile', () => {
  // 8 clean days with weight 1..8, 4 FU days with weight 20..23: every FU day is in the top quartile (top 3 of 12).
  const dias = [
    ...Array.from({ length: 8 }, (_, i) => ({ fu: false, peso: i + 1 })),
    ...Array.from({ length: 4 }, (_, i) => ({ fu: true, peso: 20 + i })),
  ];
  const s = separacao(dias);
  expect(s.razao_medianas).toBeCloseTo(21.5 / 4.5);
  expect(s.fu_no_quartil_de_cima).toBe(3);
  expect(s.dias_fu).toBe(4);
  // A version that does not separate: same weights on both sides.
  expect(separacao(dias.map((d) => ({ ...d, peso: 5 }))).razao_medianas).toBe(1);
});

test('GFS × ERA5: mean distance of the −24 h positions of the same arrival and level', () => {
  const t = (lat: number) => ({
    chegada: 0,
    nivel_hpa: 950,
    pontos: [
      { h: 0, lat: -3.1, lon: -60, hpa: 950 },
      { h: -24, lat, lon: -60, hpa: 950 },
    ],
  });
  expect(distancia24h([t(-5)], [t(-6)])).toBeCloseTo(111.2, 0);
  expect(distancia24h([t(-5)], [{ ...t(-6), nivel_hpa: 900 }])).toBeNull(); // no pair
});
