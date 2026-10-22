import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from './lib.ts';
import { aggregatesOf, ibgeNumber, loadAggregates, loadTracts } from './setores.ts';

// Header and one line copied from the real basic aggregates file (Agregados_por_setores_basico_BR, 2026-05-20).
const header = 'CD_SETOR;SITUACAO;CD_SIT;CD_TIPO;AREA_KM2;CD_REGIAO;NM_REGIAO;CD_UF;NM_UF;CD_MUN;NM_MUN;v0001;v0002;v0005;v0006'.split(';');
const ro =
  '"110001505000002";"Urbana";"1";"0";"0,5393102";"1";"Norte";"11";"Rondônia";"1100015";"Alta Floresta";"928";"376";"2,8";"0,0923"';
const am = '"130260305000001";"Urbana";"1";"0";"0,1";"1";"Norte";"13";"Amazonas";"1302603";"Manaus";"1250";"X";".";"3,1"';

test('IBGE numbers: decimal comma, "." and "X" are empty', () => {
  expect([ibgeNumber('928'), ibgeNumber('2,8'), ibgeNumber('0,0923'), ibgeNumber('.'), ibgeNumber('X'), ibgeNumber('')]).toEqual([
    928,
    2.8,
    0.0923,
    null,
    null,
    null,
  ]);
});

test('aggregates: only the UF asked, one row per variable with a value', () => {
  expect(aggregatesOf(header, ro, '13')).toEqual([]);
  expect(aggregatesOf(header, am, '13')).toEqual([
    { setor: '130260305000001', variavel: 'v0001', valor: 1250 },
    { setor: '130260305000001', variavel: 'v0006', valor: 3.1 },
  ]);
});

comBanco('carga de setores', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());

  test('staging → ibge.setor (SIRGAS square already in 4326 here), then aggregates, both idempotent', async () => {
    const a = await registrar(db, {
      chave: 'bruto/ibge-setores/x.gpkg',
      fonte: 'ibge-setores',
      sha256: 'a'.repeat(64),
      baixado_em: '2026-10-21T00:00:00Z',
    });
    // What ogr2ogr leaves in the staging table.
    await db.query(`CREATE TABLE ibge.carga_setor (cd_setor text, situacao text, cd_tipo text, area_km2 real, cd_mun text, cd_bairro text, nm_bairro text, geom geometry(MultiPolygon, 4326));
      INSERT INTO ibge.carga_setor VALUES
        ('130260305000001', 'Urbana', '0', 0.1, '1302603', '', '', ST_Multi(ST_MakeEnvelope(-60.03, -3.11, -60.01, -3.09, 4326))),
        ('130260305000002', 'Rural', '0', 0.2, '1302603', '', '', ST_Multi(ST_MakeEnvelope(-60.5, -3.5, -60.4, -3.4, 4326))),
        ('130260305000002', 'Rural', '0', 0.3, '1302603', '', '', ST_Multi(ST_MakeEnvelope(-60.3, -3.5, -60.2, -3.4, 4326)))`);
    expect(await loadTracts(db, a)).toBe(2); // the tract split in two parts becomes one row
    expect(
      (await db.query("SELECT ST_NumGeometries(geom) AS n, area_km2 FROM ibge.setor WHERE codigo = '130260305000002'")).rows[0],
    ).toEqual({ n: 2, area_km2: 0.5 });
    expect((await db.query("SELECT to_regclass('ibge.carga_setor') AS t")).rows[0].t).toBeNull();
    const b = await registrar(db, {
      chave: 'bruto/ibge-agregados-setor/b.zip',
      fonte: 'ibge-agregados-setor',
      sha256: 'b'.repeat(64),
      baixado_em: '2026-10-21T00:00:00Z',
    });
    const rows = aggregatesOf(header, am, '13');
    await loadAggregates(db, b, 'basico', rows);
    await db.query('DELETE FROM bruto.carga WHERE arquivo = $1', [b]);
    await loadAggregates(db, b, 'basico', rows);
    const r =
      await db.query(`SELECT s.municipio, s.bairro, a.valor, v.descricao FROM ibge.setor s JOIN ibge.setor_agregado a ON a.setor = s.codigo
      JOIN ibge.variavel v USING (tabela, variavel) WHERE a.variavel = 'v0001'`);
    expect(r.rows).toEqual([{ municipio: 1302603, bairro: null, valor: 1250, descricao: 'Total de pessoas' }]);
  });
});
