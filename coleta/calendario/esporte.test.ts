import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jogosCbf, jogosFifa } from './esporte.ts';

const fixture = (f: string) => JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', f), 'utf8'));
const doc = { url: 'https://exemplo/api', bruto: 'bruto/x/k' };

test('FIFA edition: the tournament period, Brazil matches with penalties, Manaus matches on the Manaus day', () => {
  const p = jogosFifa(fixture('fifa-2014.json'), 'Copa do Mundo masculina 2014', 251164, doc);
  expect(p[0]).toMatchObject({
    nome: 'Copa do Mundo masculina 2014',
    inicio: '2014-06-12',
    fim: '2014-07-13',
    abrangencia: 'BR',
    fonte: 'fifa-api',
    bruto: 'bruto/x/k',
  });
  expect(p.filter((x) => x.abrangencia === 'Manaus').map((x) => x.inicio)).toEqual([
    '2014-06-14',
    '2014-06-18',
    '2014-06-22',
    '2014-06-25',
  ]);
  expect(p.map((x) => x.nome)).toContain('Copa do Mundo masculina 2014, jogo do Brasil: Brazil 1x1 Chile (pên. 3x2)');
  expect(p.map((x) => x.nome)).toContain('Copa do Mundo masculina 2014, em Manaus: England 1x2 Italy');
  expect(p).toHaveLength(1 + 2 + 4); // period, 2 Brazil matches, 4 in Manaus; the final (Germany x Argentina) is out
});

test('FIFA: a 21h match in Manaus is the next day in UTC but the same Manaus day; soManaus drops the period', () => {
  const lado = (c: string, s: number) => ({ IdCountry: c, TeamName: [{ Description: c }], Score: s });
  const j = {
    Date: '2016-08-05T01:00:00Z',
    Home: lado('NGA', 5),
    Away: lado('JPN', 4),
    HomeTeamPenaltyScore: null,
    AwayTeamPenaltyScore: null,
    Stadium: { CityName: [{ Description: 'Manaus' }] },
  };
  expect(jogosFifa({ Results: [j] }, 'Futebol masculino dos Jogos Rio 2016', 272231, doc, true)).toEqual([
    expect.objectContaining({
      nome: 'Futebol masculino dos Jogos Rio 2016, em Manaus: NGA 5x4 JPN',
      inicio: '2016-08-04',
      fim: '2016-08-04',
      abrangencia: 'Manaus',
    }),
  ]);
});

test('CBF table: only the matches in Manaus, with score, date and the match number in the act', () => {
  expect(jogosCbf(fixture('cbf-12587.json'), 'Campeonato Brasileiro Série D 2024', '12587', doc)).toEqual([
    expect.objectContaining({
      nome: 'Campeonato Brasileiro Série D 2024, em Manaus: Manauara 3x1 Rio Branco',
      inicio: '2024-04-27',
      fim: '2024-04-27',
      fonte: 'cbf',
      ato: 'CBF, tabela detalhada do campeonato 12587, jogo 1',
    }),
    expect.objectContaining({ nome: 'Campeonato Brasileiro Série D 2024, em Manaus: Manaus 1x0 Humaitá', inicio: '2024-05-05' }),
  ]);
});
