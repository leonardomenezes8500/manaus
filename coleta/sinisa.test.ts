import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { indicadoresDe } from './sinisa.ts';

const csv = readFileSync(join(import.meta.dirname, '__fixtures__', 'sinisa', 'agua-2024.csv'), 'utf8');

test('SINISA sheet: the Manaus row after the identification columns; "Não calculado" stays as text', () => {
  const i = indicadoresDe(csv, '1302603');
  expect(i.find((x) => x.indicador === 'Atendimento dos domicílios totais com rede de abastecimento de água')?.valor).toBe(77.38);
  expect(i.find((x) => x.indicador === 'Atendimento da população total com rede de abastecimento de água')?.valor).toBe(97.13);
  expect(i.some((x) => x.valor === null && x.texto.startsWith('Não calculado'))).toBe(true);
  expect(i.map((x) => x.indicador)).not.toContain('Sigla');
  expect(i).toHaveLength(57); // 67 columns, 10 of identification; three header cells have line breaks
  expect(indicadoresDe(csv, '9999999')).toEqual([]);
  expect(() => indicadoresDe('a,b\n1,2', '1')).toThrow('Codigo do IBGE');
});
