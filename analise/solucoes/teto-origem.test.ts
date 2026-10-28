import { porAnos, teto, type Grupo } from './teto-origem.ts';

const am: Grupo = {
  peso: 0,
  uf: 'AM',
  fora_caixa: false,
  municipio: 'Lábrea',
  urbano: false,
  uc_esfera: null,
  ti: false,
  assentamento: null,
  cnfp: 'nao',
  prodes: 'floresta',
  deter: 'nao',
  uc: 'nao',
};

test('the shares of the season weight by area and by body follow the rule of #91', () => {
  const t = teto([
    { ...am, peso: 3, ti: true },
    { ...am, peso: 1, uf: 'PA' },
  ]);
  expect(t.total).toBe(4);
  expect(t.porArea).toEqual([
    { chave: 'ti', peso: 3, parcela: 0.75 },
    { chave: 'sem_regra', peso: 1, parcela: 0.25 },
  ]);
  const funai = t.porOrgao.find((o) => o.chave === 'FUNAI')!;
  expect(funai).toEqual({ chave: 'FUNAI', peso: 3, parcela: 0.75, papeis: ['prevencao', 'fiscalizacao'] });
});

test('a body with several roles in one area counts the weight once; across areas it adds up', () => {
  const t = teto([
    { ...am, peso: 2, uc_esfera: 'Federal' },
    { ...am, peso: 1, ti: true },
    { ...am, peso: 1, cnfp: 'B' },
  ]);
  expect(t.porOrgao.find((o) => o.chave === 'ICMBio')!.peso).toBe(2);
  // IBAMA: supplementary inspection in the federal UC, prevention and fighting in the TI, inspection in the B forest
  expect(t.porOrgao.find((o) => o.chave === 'IBAMA')!.peso).toBe(4);
  expect(t.porOrgao.find((o) => o.chave === 'SFB')!.peso).toBe(1);
});

test('every dimension adds up to the whole weight', () => {
  const t = teto([
    { ...am, peso: 1, prodes: 'desm_1a3' },
    { ...am, peso: 3, uf: 'PA', prodes: 'floresta', cnfp: 'B' },
  ]);
  for (const d of Object.values(t.porDimensao)) expect(d.reduce((s, x) => s + x.parcela, 0)).toBeCloseTo(1);
  expect(t.porDimensao.prodes).toEqual([
    { chave: 'floresta', peso: 3, parcela: 0.75 },
    { chave: 'desm_1a3', peso: 1, parcela: 0.25 },
  ]);
  expect(t.porDimensao.ti.map((x) => x.chave)).toEqual(['nao']);
});

test('satellite only: share of each category in the smoke years against the other years', () => {
  const r = porAnos(
    [
      { ano: 2015, dimensao: 'cnfp', categoria: 'B', focos: 30 },
      { ano: 2015, dimensao: 'cnfp', categoria: 'nao', focos: 70 },
      { ano: 2019, dimensao: 'cnfp', categoria: 'B', focos: 10 },
      { ano: 2019, dimensao: 'cnfp', categoria: 'nao', focos: 90 },
    ],
    [2015],
  );
  expect(r).toEqual([
    { dimensao: 'cnfp', categoria: 'nao', fumaca: 0.7, outros: 0.9 },
    { dimensao: 'cnfp', categoria: 'B', fumaca: 0.3, outros: 0.1 },
  ]);
});
