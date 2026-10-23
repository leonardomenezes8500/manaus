import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerDca, lerIpca } from './siconfi.ts';

const fx = (f: string) => JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', 'siconfi', f), 'utf8'));
const valor = (l: ReturnType<typeof lerDca>, codigo: string, coluna = 'liquidado') =>
  l.find((x) => x.codigo === codigo && x.coluna === coluna)?.valor;

test('DCA of 2015: função, subfunção, the "999" rest and the total in parentheses; RP columns are dropped', () => {
  const l = lerDca(fx('dca-manaus-2015.json'));
  expect(valor(l, '18')).toBe(18962479.38);
  expect(valor(l, '06.182')).toBe(2020185.79);
  expect(l.find((x) => x.codigo === '18.999')?.nome).toBe('Demais Subfunções Gestão Ambiental');
  expect(valor(l, 'TOTAL')).toBe(3911578105.7);
  expect(new Set(l.map((x) => x.coluna))).toEqual(new Set(['empenhado', 'liquidado', 'pago']));
});

test('DCA of 2024: the same codes; 122 opened inside the função; the função equals its parts', () => {
  const l = lerDca(fx('dca-manaus-2024.json'));
  expect(valor(l, '18')).toBe(28877262.5);
  expect(valor(l, '06.182', 'pago')).toBe(9773397.72);
  const partes = l.filter((x) => x.codigo.startsWith('18.') && x.coluna === 'liquidado').reduce((a, x) => a + x.valor, 0);
  expect(partes).toBeCloseTo(28877262.5, 2);
  expect(() => lerDca({ ...fx('dca-manaus-2024.json'), hasMore: true })).toThrow('offset');
});

test('IPCA from SIDRA: header and "..." skipped, month as a date', () => {
  expect(lerIpca(fx('ipca.json'))).toEqual([
    { mes: '2014-01-01', indice: 3836.37 },
    { mes: '2014-02-01', indice: 3862.84 },
  ]);
});
