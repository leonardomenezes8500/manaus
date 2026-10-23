import { linhasProjecao, linhasSidra } from './populacao.ts';

test('SIDRA values → one row per year (the first row of the answer is the header; "..." is no data)', () => {
  const json = [
    { V: 'Valor', D3N: 'Ano' },
    { V: '1802014', D3N: '2010' },
    { V: '...', D3N: '2011' },
  ];
  expect(linhasSidra(json, { local: '1302603', tipo: 'censo', fonte: 'SIDRA 202' })).toEqual([
    { local: '1302603', ano: 2010, tipo: 'censo', sexo: 'total', idade: 'total', pessoas: 1802014, fonte: 'SIDRA 202' },
  ]);
});

test('projection table → the bands of one UF by sex, and the total as the sum of the groups', () => {
  const csv = [
    'GRUPO ETÁRIO,SEXO,CÓD.,SIGLA,LOCAL,"2024","2025"',
    ' 00-04,Ambos,"13",AM,Amazonas,"10","11"',
    ' 05-09,Ambos,"13",AM,Amazonas,"20","21"',
    ' 10-14,Ambos,"13",AM,Amazonas,"30","31"',
    ' 55-59,Ambos,"13",AM,Amazonas,"40","41"',
    ' 90+,Ambos,"13",AM,Amazonas,"5","6"',
    ' 00-04,Homens,"13",AM,Amazonas,"6","6"',
    ' 00-04,Ambos,"11",RO,Rondônia,"99","99"',
  ].join('\n');
  const r = linhasProjecao(csv, 'AM', 'Projeções da População, revisão 2024');
  const v = (ano: number, sexo: string, idade: string) => r.find((x) => x.ano === ano && x.sexo === sexo && x.idade === idade)?.pessoas;
  expect(v(2024, 'total', '0-4')).toBe(10);
  expect(v(2024, 'total', '5-14')).toBe(50);
  expect(v(2024, 'total', '15-59')).toBe(40);
  expect(v(2024, 'total', '60+')).toBe(5);
  expect(v(2024, 'total', 'total')).toBe(105);
  expect(v(2025, 'masculino', '0-4')).toBe(6);
  expect(r.every((x) => x.local === 'AM' && x.tipo === 'projecao')).toBe(true);
});
