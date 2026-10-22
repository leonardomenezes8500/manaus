import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { loadAddresses, parseAddress } from './cnefe.ts';
import { registrar } from './lib.ts';

// 5 real lines of the Manaus CNEFE file: an apartment, a school, a health unit and one address with two species.
const [head, ...lines] = readFileSync(join(import.meta.dirname, '__fixtures__', 'cnefe.csv'), 'utf8')
  .trim()
  .split('\n');
const header = head.split(';');
const rows = lines.map((l) => parseAddress(header, l));

test('parses address, tract without the trailing letter, complement and coordinates', () => {
  expect(rows[0]).toMatchObject({
    id: 100336152,
    especie: 1,
    setor: '130260305000086',
    municipio: 1302603,
    cep: '69018604',
    localidade: 'LAGO AZUL',
    logradouro: 'RUA QUARTZO AZUL',
    numero: 0,
    modificador: 'SN',
    complemento: 'BLOCO 138 APARTAMENTO 104',
    nivel_coord: 2,
    lat: -2.965788,
    lon: -59.99234,
  });
  expect(rows[1]).toMatchObject({ especie: 4, estabelecimento: 'ESCOLA IDAAM' });
  expect(rows[2]).toMatchObject({ especie: 5 });
  expect([rows[3].id === rows[4].id, rows[3].especie, rows[4].especie]).toEqual([true, 1, 6]);
});

comBanco('carga do CNEFE', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());

  test('one row per address and species; loading again adds nothing; species and tract queries work', async () => {
    const a = await registrar(db, {
      chave: 'bruto/ibge-cnefe/m.zip',
      fonte: 'ibge-cnefe',
      sha256: 'a'.repeat(64),
      baixado_em: '2026-10-21T00:00:00Z',
    });
    async function* all() {
      yield* rows;
    }
    expect(await loadAddresses(db, a, all())).toBe(5);
    await db.query('DELETE FROM bruto.carga');
    await loadAddresses(db, a, all());
    const r = await db.query(
      `SELECT e.descricao, count(*)::int AS n FROM ibge.cnefe_endereco c JOIN ibge.cnefe_especie e ON e.codigo = c.especie GROUP BY 1 ORDER BY 1`,
    );
    expect(r.rows).toEqual([
      { descricao: 'Domicílio particular', n: 2 },
      { descricao: 'Estabelecimento de ensino', n: 1 },
      { descricao: 'Estabelecimento de outras finalidades', n: 1 },
      { descricao: 'Estabelecimento de saúde', n: 1 },
    ]);
    expect((await db.query('SELECT count(DISTINCT id)::int AS n FROM ibge.cnefe_endereco')).rows[0].n).toBe(4);
  });
});
