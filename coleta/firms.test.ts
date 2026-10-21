import { janelas } from './firms.ts';

test('janelas de 5 dias cobrem o intervalo sem buraco nem sobra', () => {
  expect(janelas('2026-08-01', '2026-08-12')).toEqual([
    { data: '2026-08-01', dias: 5 },
    { data: '2026-08-06', dias: 5 },
    { data: '2026-08-11', dias: 2 },
  ]);
  expect(janelas('2026-10-21', '2026-10-21')).toEqual([{ data: '2026-10-21', dias: 1 }]);
  expect(janelas('2026-08-01', '2026-10-21').reduce((s, j) => s + j.dias, 0)).toBe(82);
});

test('intervalo invertido é erro', () => {
  expect(() => janelas('2026-08-02', '2026-08-01')).toThrow('intervalo inválido');
});
