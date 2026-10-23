import { AREAS, responsaveis } from './responsavel.ts';

test('every type of area has at least one body, and every line has its law and an official link', () => {
  for (const a of AREAS.filter((x) => x !== 'sem_regra')) {
    const l = responsaveis(a);
    expect(l.length).toBeGreaterThan(0);
    for (const x of l) {
      expect(x.norma).toMatch(/(Lei|Decreto|LC|CF)/);
      expect(x.url).toMatch(/^https:\/\/(www\.planalto\.gov\.br|sapl\.al\.am\.leg\.br|sapl\.cmm\.am\.gov\.br)\//);
      expect(['prevencao', 'fiscalizacao', 'combate', 'gestao']).toContain(x.papel);
    }
  }
  expect(responsaveis('sem_regra')).toEqual([]);
});

test('the rule: federal UC is ICMBio; state UC is SEMA (management) and IPAAM (inspection); TI is FUNAI and IBAMA', () => {
  const quem = (a: Parameters<typeof responsaveis>[0], papel: string) =>
    responsaveis(a)
      .filter((x) => x.papel === papel)
      .map((x) => x.sigla);
  expect(quem('uc_federal', 'fiscalizacao')).toContain('ICMBio');
  expect(quem('uc_estadual', 'prevencao')).toEqual(['SEMA-AM']);
  expect(quem('uc_estadual', 'fiscalizacao')).toEqual(['IPAAM']);
  expect(quem('ti', 'combate')).toEqual(expect.arrayContaining(['IBAMA', 'CBMAM']));
  expect(quem('imovel_rural', 'fiscalizacao')).toEqual(['IPAAM', 'IBAMA']); // IBAMA by the common duty (LC 140, art. 17, § 3º)
  expect(quem('assentamento', 'gestao')).toEqual(['INCRA']); // land only: no fire role written for INCRA
  expect(quem('manaus_urbano', 'fiscalizacao')).toEqual(['SEMMAS']);
});
