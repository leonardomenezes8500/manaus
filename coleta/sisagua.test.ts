import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerVigilancia } from './sisagua.ts';

test('surveillance samples of Manaus: by header name, decimal comma, text-only results kept as text, local time', () => {
  const a = lerVigilancia(readFileSync(join(import.meta.dirname, '__fixtures__', 'sisagua', 'vigilancia.csv'), 'utf8'));
  expect(a.map((x) => [x.parametro, x.resultado, x.coletado_em])).toEqual([
    ['Turbidez (uT)', expect.any(Number), '2023-02-14T06:24:00-04:00'],
    ['Escherichia coli', null, '2023-06-28T10:03:00-04:00'],
    ['pH', 5.45, '2023-01-16T07:20:00-04:00'],
  ]);
  expect(a[0]).toMatchObject({ amostra: '519', ponto: 'Cavalete/Hidrômetro', abastecimento: 'SAA' });
  expect(a[1].resultado_texto).toMatch(/AUSENTE|Ausente/);
  expect(() => lerVigilancia('"X";"Y"\n"1";"2"\n')).toThrow('NU_AMOSTRA');
});
