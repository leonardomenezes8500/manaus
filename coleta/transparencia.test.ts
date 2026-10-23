import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACOES, cortar, cortarMes, lerDespesa } from './transparencia.ts';

// Header and 4 real rows of the 2024-08 execution file (ISO-8859-1, as it came): one of another action, 214N national,
// 20X7 with a negative commitment, 214M in the CE.
const linhas = new TextDecoder('latin1')
  .decode(readFileSync(join(import.meta.dirname, 'carga', '__fixtures__', 'despesas-execucao-202408.csv')))
  .trim()
  .split(/\r?\n/);

test('the cut keeps the header and the rows of the fire actions only', () => {
  expect(ACOES).toEqual(expect.arrayContaining(['214M', '214N', '214P', '218X', '20X7', '21H2']));
  const c = cortar(linhas);
  expect(c).toHaveLength(4);
  expect(c[0]).toBe(linhas[0]);
  expect(c.some((l) => l.includes('"2000"'))).toBe(false);
});

test('a row: month, action, state (empty is null), the values with decimal comma and sign', () => {
  const [cab, ...rs] = cortar(linhas);
  const d = rs.map((l) => lerDespesa(cab, l));
  expect(d.find((x) => x.acao === '20X7')).toMatchObject({
    mes: '2024-08-01',
    uf: null,
    empenhado: -58509.64,
    liquidado: 7659.75,
    pago: 49920.3,
  });
  expect(d.find((x) => x.acao === '214M')).toMatchObject({ uf: 'CE', liquidado: 45000, localizador_codigo: '0023' });
  expect(d.find((x) => x.acao === '214N')!.localizador).toContain('NACIONAL');
});

test('a download that is not a zip (an HTML page with HTTP 200) fails instead of saving an empty month', async () => {
  const d = mkdtempSync(join(tmpdir(), 'transp-'));
  writeFileSync(join(d, 'mes.zip'), '<html>manutenção</html>');
  await expect(cortarMes(join(d, 'mes.zip'), join(d, 'corte.csv.gz'))).rejects.toThrow('unzip falhou');
});
