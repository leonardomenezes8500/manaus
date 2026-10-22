import pg from 'pg';
import { registrar } from '../carga/lib.ts';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { gravarPeriodos } from './gravar.ts';
import { feriadosNacionais } from './regras.ts';

comBanco('calendário no banco', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('saving twice does not duplicate; a day with two events shows both, with act and source', async () => {
    const a = await registrar(db, { chave: 'k', fonte: 'planalto-legislacao', sha256: 'a'.repeat(64), baixado_em: '2026-10-22T00:00:00Z' });
    const festa = {
      tipo: 'festa',
      nome: 'Boi Manaus',
      inicio: '2026-10-23',
      fim: '2026-10-25',
      abrangencia: 'Manaus' as const,
      fonte: 'manaus-dom',
      ato: 'Decreto 1/2026',
      url: 'https://exemplo.gov.br/d.pdf',
    };
    const aniversario = { ...festa, tipo: 'feriado', nome: 'Aniversário de Manaus', inicio: '2026-10-24', fim: '2026-10-24', ato: 'Lei X' };
    const linhas = [...feriadosNacionais(2026), festa, aniversario].map((p) => ({ ...p, arquivo: a }));
    await gravarPeriodos(db, linhas);
    await gravarPeriodos(
      db,
      linhas.map((l) => (l.nome === 'Boi Manaus' ? { ...l, ato: 'Decreto 2/2026' } : l)),
    );
    expect((await db.query('SELECT count(*)::int AS n FROM contexto.periodo')).rows[0].n).toBe(linhas.length);
    const d = (await db.query(`SELECT * FROM contexto.dia WHERE dia = '2026-10-24'`)).rows[0];
    expect(d).toMatchObject({ fim_de_semana: true, feriado: 'Aniversário de Manaus', festa: 'Boi Manaus', eleicao: null });
    expect(d.eventos).toEqual([
      expect.objectContaining({ tipo: 'feriado', nome: 'Aniversário de Manaus', ato: 'Lei X' }),
      expect.objectContaining({ tipo: 'festa', nome: 'Boi Manaus', ato: 'Decreto 2/2026', fonte: 'manaus-dom' }),
    ]);
    expect((await db.query(`SELECT feriado FROM contexto.dia WHERE dia = '2026-12-25'`)).rows[0].feriado).toBe('Natal');
  });

  test('a school holiday with a Brazil match shows in both columns (#61)', async () => {
    const base = { abrangencia: 'BR' as const, fonte: 'fifa-api', ato: 'FIFA', url: 'https://exemplo/f', arquivo: null };
    await gravarPeriodos(db, [
      {
        ...base,
        tipo: 'escola',
        nome: 'Recesso escolar de julho da rede municipal',
        inicio: '2014-06-23',
        fim: '2014-07-06',
        abrangencia: 'Manaus',
        fonte: 'semed-manaus',
      },
      { ...base, tipo: 'esporte', nome: 'Copa do Mundo masculina 2014', inicio: '2014-06-12', fim: '2014-07-13' },
      {
        ...base,
        tipo: 'esporte',
        nome: 'Copa do Mundo masculina 2014, jogo do Brasil: Brazil 1x1 Chile (pên. 3x2)',
        inicio: '2014-06-28',
        fim: '2014-06-28',
      },
    ]);
    const d = (await db.query(`SELECT escola, esporte FROM contexto.dia WHERE dia = '2014-06-28'`)).rows[0];
    expect(d).toEqual({
      escola: 'Recesso escolar de julho da rede municipal',
      esporte: 'Copa do Mundo masculina 2014; Copa do Mundo masculina 2014, jogo do Brasil: Brazil 1x1 Chile (pên. 3x2)',
    });
  });
});
