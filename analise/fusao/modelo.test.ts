// Layer 3 model (#31): the view entidade.valor_escolhido picks by the written rule, and nothing any source says is lost.
import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';

comBanco('modelo de fusão (camada 3)', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());

  const entidade = async (tipo: string, chave: string) =>
    Number((await db.query('INSERT INTO entidade.entidade (tipo, chave) VALUES ($1, $2) RETURNING id', [tipo, chave])).rows[0].id);
  const valor = (id: number, campo: string, v: unknown, fonte: string, data: string) =>
    db.query(`INSERT INTO entidade.valor (entidade_id, campo, valor, fonte, data_fonte, registro_id) VALUES ($1, $2, $3, $4, $5, 'r')`, [
      id,
      campo,
      JSON.stringify(v),
      fonte,
      data,
    ]);
  const escolhido = async (id: number, campo: string) =>
    (await db.query('SELECT valor, fonte, regra FROM entidade.valor_escolhido WHERE entidade_id = $1 AND campo = $2', [id, campo])).rows[0];

  test('two sources disagree: the rule picks; the top source has no value: the next one; same source: the latest', async () => {
    const centro = await entidade('bairro', 'centro');
    await valor(centro, 'nome', 'Centro', 'osm', '2026-10-20');
    await valor(centro, 'nome', 'Centro Histórico', 'ibge', '2022-08-01');
    expect(await escolhido(centro, 'nome')).toEqual({ valor: 'Centro Histórico', fonte: 'ibge', regra: ['implurb', 'ibge', 'osm'] });

    const japiim = await entidade('bairro', 'japiim');
    await valor(japiim, 'nome', 'Japiim', 'osm', '2026-10-20');
    expect((await escolhido(japiim, 'nome')).fonte).toBe('osm');

    await valor(japiim, 'nome', 'Japiim I', 'osm', '2026-10-27');
    expect((await escolhido(japiim, 'nome')).valor).toBe('Japiim I');
  });

  test('a field without a rule has no chosen value and is listed; every value stays in entidade.valor', async () => {
    const centro = Number((await db.query("SELECT id FROM entidade.entidade WHERE chave = 'centro'")).rows[0].id);
    await valor(centro, 'apelido', 'Centrão', 'osm', '2026-10-20');
    expect(await escolhido(centro, 'apelido')).toBeUndefined();
    expect((await db.query('SELECT tipo, campo FROM entidade.campo_sem_regra')).rows).toEqual([{ tipo: 'bairro', campo: 'apelido' }]);
    expect((await db.query('SELECT count(*)::int AS n FROM entidade.valor')).rows[0].n).toBe(5);
  });

  test('a layer-2 record is linked to one entity only', async () => {
    const a = await entidade('municipio', '1302603');
    const b = await entidade('municipio', '1300000');
    const vinculo = (id: number) =>
      db.query(
        `INSERT INTO entidade.vinculo (entidade_id, fonte, tabela, registro_id, metodo) VALUES ($1, 'ibge', 'ibge.municipio', '1302603', 'codigo')`,
        [id],
      );
    await vinculo(a);
    await expect(vinculo(b)).rejects.toThrow(/duplicate key/);
  });
});
