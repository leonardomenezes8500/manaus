import { conjuntosSoManaus, decManaus } from './aneel.ts';

test('only the groups wholly in Manaus count (a group shared with another municipality is out)', () => {
  const csv = [
    '"Dat";"Ide";"Cod";"Nom";"UF"',
    '"2026-09-09";"13004";"1302603";"Manaus";"AM"',
    '"2026-09-09";"17371";"1302603";"Manaus";"AM"',
    '"2026-09-09";"17371";"1303569";"Rio Preto da Eva";"AM"',
    '"2026-09-09";"9";"1301209";"Coari";"AM"',
  ].join('\r\n');
  expect(conjuntosSoManaus(csv)).toEqual(new Set([13004]));
});

test('monthly DEC of Manaus weighted by consumers; the derived DEC sums every part, the official one does not', () => {
  const l = (conjunto: number, indicador: string, valor: number) => ({ conjunto, ano: 2023, mes: 8, indicador, valor });
  const linhas = [
    l(1, 'NumCon', 300),
    l(1, 'DEC', 2),
    l(1, 'FEC', 1),
    l(1, 'DECIP', 0.5),
    l(1, 'DECIND', 1.5),
    l(1, 'DECXN', 3), // a blackout from outside
    l(2, 'NumCon', 100),
    l(2, 'DEC', 6),
    l(2, 'FEC', 3),
    l(2, 'DECIND', 6),
    l(3, 'NumCon', 900),
    l(3, 'DEC', 50), // not in Manaus
  ];
  expect(decManaus(linhas, new Set([1, 2]))).toEqual([
    { mes: '2023-08-01', dec: 3, dec_partes: 5.25, fec: 1.5, consumidores: 400, conjuntos: 2 },
  ]);
});
