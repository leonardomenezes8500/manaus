import { cobertura, letivo, ordenar } from './salas-ar-limpo.ts';

test('order: biggest weight first, ties by code', () => {
  const xs = [
    { codigo: 3, peso: 10 },
    { codigo: 1, peso: 50 },
    { codigo: 2, peso: 10 },
  ];
  expect(ordenar(xs).map((x) => x.codigo)).toEqual([1, 2, 3]);
});

test('coverage of the first N: each key (school or census tract) counted once, share of the city total', () => {
  // Two health units 1 km from the same tract: the tract counts once.
  const valor = new Map([
    ['s1', { criancas: 10, idosos: 5 }],
    ['s2', { criancas: 20, idosos: 0 }],
    ['s3', { criancas: 70, idosos: 15 }],
  ]);
  const ordenados = [{ chaves: ['s2', 's1'] }, { chaves: ['s1'] }, { chaves: ['s3'] }];
  expect(cobertura(ordenados, valor, [1, 2, 10])).toEqual([
    { n: 1, campo: 'criancas', coberto: 30, total: 100, parcela: 0.3 },
    { n: 1, campo: 'idosos', coberto: 5, total: 20, parcela: 0.25 },
    { n: 2, campo: 'criancas', coberto: 30, total: 100, parcela: 0.3 },
    { n: 2, campo: 'idosos', coberto: 5, total: 20, parcela: 0.25 },
    { n: 3, campo: 'criancas', coberto: 100, total: 100, parcela: 1 },
    { n: 3, campo: 'idosos', coberto: 20, total: 20, parcela: 1 },
  ]);
});

test('school day: weekday, no holiday, from the start of the year to Dec 15, out of recess and of the remote period', () => {
  const d = (dia: string, o: Partial<Parameters<typeof letivo>[0]> = {}) => ({
    dia,
    fim_de_semana: false,
    feriado: null,
    escola: null,
    ...o,
  });
  expect(letivo(d('2025-09-10'), '2025-02-05')).toBe(true);
  expect(letivo(d('2025-09-13', { fim_de_semana: true }), '2025-02-05')).toBe(false);
  expect(letivo(d('2025-09-05', { feriado: 'Elevação do Amazonas' }), '2025-02-05')).toBe(false);
  expect(letivo(d('2025-02-04'), '2025-02-05')).toBe(false);
  expect(letivo(d('2024-02-05'), undefined)).toBe(true); // no start in the calendar: Feb 5
  expect(letivo(d('2025-12-16'), '2025-02-05')).toBe(false);
  expect(letivo(d('2025-06-25', { escola: 'Recesso escolar de julho da rede municipal' }), '2025-02-05')).toBe(false);
  expect(letivo(d('2020-10-01'), '2020-02-05')).toBe(false); // remote (Covid-19)
  expect(letivo(d('2021-08-23'), undefined)).toBe(true);
  expect(letivo(d('2026-10-09', { escola: 'Aulas suspensas na rede municipal (fumaça)' }), '2026-02-04')).toBe(true);
});
