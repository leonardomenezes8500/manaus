import { escolherUmAUm } from './sensores-cobertura.ts';

test('one by one: each pick covers the most people not covered yet; ties by id; stops when nothing new', () => {
  const pessoas = new Map([
    ['a', 100],
    ['b', 80],
    ['c', 50],
    ['d', 30],
  ]);
  const candidatos = [
    { id: 'escola 1', setores: ['a', 'b'] }, // 180, but a is already covered: 80
    { id: 'ubs 1', setores: ['c', 'd'] }, // 80
    { id: 'ubs 2', setores: ['b', 'c'] }, // 130
    { id: 'escola 2', setores: ['a'] }, // 0
  ];
  expect(escolherUmAUm(candidatos, pessoas, new Set(['a']), 10)).toEqual([
    { id: 'ubs 2', novos: 130, acumulado: 130 },
    { id: 'ubs 1', novos: 30, acumulado: 160 },
  ]);
  expect(escolherUmAUm(candidatos, pessoas, new Set(), 1)).toEqual([{ id: 'escola 1', novos: 180, acumulado: 180 }]);
});
