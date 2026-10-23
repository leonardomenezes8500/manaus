import { agruparEpocas, epocasDoRio, LIMIARES as LIMIAR, periodosDoRio } from './rio.ts';

// A daily series around a date, rising or falling `passoCm` per day, ending (or peaking) at `cm` on `dia`.
function serie(dia: string, cm: number, passoCm: number, dias = 21) {
  return Array.from({ length: dias }, (_, i) => ({
    dia: new Date(Date.parse(dia) + (i - dias + 1) * 86_400_000).toISOString().slice(0, 10),
    cm: cm - passoCm * (dias - 1 - i),
  }));
}

test('known marks with the official thresholds: the 2021 flood is cheia, the 2023 and 2024 droughts are seca', () => {
  const e = (s: { dia: string; cm: number }[]) => new Map(epocasDoRio(s, LIMIAR).map((x) => [x.dia, x.epoca]));
  expect(e(serie('2021-06-16', 3002, 2)).get('2021-06-16')).toBe('cheia');
  expect(e(serie('2023-10-26', 1270, -10)).get('2023-10-26')).toBe('seca');
  expect(e(serie('2024-10-09', 1211, -12)).get('2024-10-09')).toBe('seca');
});

test('between the thresholds the 7-day trend decides: rising is enchente, falling is vazante', () => {
  const e = (s: { dia: string; cm: number }[]) => new Map(epocasDoRio(s, LIMIAR).map((x) => [x.dia, x.epoca]));
  expect(e(serie('2026-03-15', 2400, 5)).get('2026-03-15')).toBe('enchente');
  expect(e(serie('2026-08-15', 2300, -15)).get('2026-08-15')).toBe('vazante');
});

test('a day without 7 days of history before it has no trend: only the thresholds apply; a gap is not filled', () => {
  const r = epocasDoRio(
    [
      { dia: '2026-03-01', cm: 2400 },
      { dia: '2026-03-02', cm: 3000 },
    ],
    LIMIAR,
  );
  expect(r).toEqual([
    { dia: '2026-03-01', cm: 2400, epoca: null },
    { dia: '2026-03-02', cm: 3000, epoca: 'cheia' },
  ]);
});

test('consecutive days of the same season become one period; a day without a season breaks it', () => {
  const dias = [
    { dia: '2026-01-01', cm: 0, epoca: 'enchente' as const },
    { dia: '2026-01-02', cm: 0, epoca: 'enchente' as const },
    { dia: '2026-01-03', cm: 0, epoca: null },
    { dia: '2026-01-04', cm: 0, epoca: 'enchente' as const },
    { dia: '2026-01-05', cm: 0, epoca: 'cheia' as const },
    { dia: '2026-01-07', cm: 0, epoca: 'cheia' as const }, // 01-06 missing: a new period
  ];
  expect(agruparEpocas(dias)).toEqual([
    { epoca: 'enchente', inicio: '2026-01-01', fim: '2026-01-02' },
    { epoca: 'enchente', inicio: '2026-01-04', fim: '2026-01-04' },
    { epoca: 'cheia', inicio: '2026-01-05', fim: '2026-01-05' },
    { epoca: 'cheia', inicio: '2026-01-07', fim: '2026-01-07' },
  ]);
});

test('periods for the calendar: one per run, named, with the threshold document', () => {
  const p = periodosDoRio(serie('2023-10-26', 1270, -20, 30));
  expect(p.map((x) => [x.nome, x.inicio, x.fim])).toEqual([
    ['Vazante do Rio Negro (descendo em 7 dias)', '2023-10-04', '2023-10-10'],
    ['Seca do Rio Negro (15,80 m ou menos)', '2023-10-11', '2023-10-26'],
  ]);
  expect(p[1]).toMatchObject({ tipo: 'epoca_rio', abrangencia: 'Manaus', fonte: 'sgb-sace', url: expect.stringContaining('20231201') });
});
