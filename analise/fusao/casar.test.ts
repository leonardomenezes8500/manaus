import { casar, normalizarNome, type Registro } from './casar.ts';

test('name normalisation: accents, case, hyphens, number words and common abbreviations (real pairs IBGE × OSM)', () => {
  const pares = [
    ['Colônia Terra Nova', 'Colonia Terra Nova'],
    ['Tarumã-Açu', 'Tarumã-Açú'],
    ['Santa Luzia', 'Santa Lúzia'],
    ['Santo Antônio', 'Santo Antonio'],
    ['Parque 10 de Novembro', 'Parque Dez de Novembro'],
    ['Nossa Senhora das Graças', 'N. Sra. das Graças'],
    ['Conjunto Vieiralves', 'Cj. Vieiralves'],
    // Street names, CNEFE × BrasilAPI.
    ['AVENIDA JOAQUIM NABUCO', 'Av. Joaquim Nabuco'],
    ['TRAVESSA SAO JOAO', 'Tv. São João'],
    ['ESTRADA DO TURISMO', 'Est. do Turismo'],
    ['ALAMEDA COSME FERREIRA', 'Al. Cosme Ferreira'],
  ];
  for (const [a, b] of pares) expect(normalizarNome(a)).toBe(normalizarNome(b));
  expect(normalizarNome('  Tarumã-Açu ')).toBe('taruma acu');
  expect(normalizarNome('Praça 14 de Janeiro')).not.toBe(normalizarNome('Praça 14'));
});

const r = (fonte: string, id: string, nome: string): Registro => ({ fonte, id, nome });

test('matching: same name first, then the best overlap ≥ 0.7; whatever has no pair stays alone', () => {
  const registros = [
    r('ibge', '1', 'Centro'),
    r('ibge', '2', 'Praça 14 de Janeiro'),
    r('ibge', '3', 'Jorge Teixeira'),
    r('osm', 'a', 'Centro'),
    r('osm', 'b', 'Praça 14'),
    r('osm', 'c', 'Monte das Oliveiras'),
  ];
  // IoU between records of different sources (only the pairs that touch).
  const iou = new Map([
    ['ibge:1|osm:a', 0.86],
    ['ibge:2|osm:b', 0.81],
    ['ibge:2|osm:a', 0.05],
    ['ibge:3|osm:c', 0.3],
  ]);
  const grupos = casar(registros, ['implurb', 'ibge', 'osm'], iou);
  expect(grupos).toEqual([
    {
      chave: 'centro',
      membros: [
        { ...registros[0], metodo: 'ancora', confianca: null },
        { ...registros[3], metodo: 'nome', confianca: 0.86 },
      ],
    },
    {
      chave: 'praca 14 de janeiro',
      membros: [
        { ...registros[1], metodo: 'ancora', confianca: null },
        { ...registros[4], metodo: 'iou', confianca: 0.81 },
      ],
    },
    { chave: 'jorge teixeira', membros: [{ ...registros[2], metodo: 'ancora', confianca: null }] },
    { chave: 'monte das oliveiras', membros: [{ ...registros[5], metodo: 'unico', confianca: null }] },
  ]);
});

test('matching: one record of a source joins one group only; the same name with no overlap does not match', () => {
  const registros = [r('ibge', '1', 'São Jorge'), r('ibge', '2', 'São Jorge'), r('osm', 'a', 'São Jorge')];
  const grupos = casar(registros, ['ibge', 'osm'], new Map([['ibge:2|osm:a', 0.9]]));
  expect(grupos.map((g) => [g.chave, g.membros.map((m) => `${m.fonte}:${m.id}`)])).toEqual([
    ['sao jorge', ['ibge:1']],
    ['sao jorge 2', ['ibge:2', 'osm:a']],
  ]);
});
