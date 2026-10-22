import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { loadNeighbourhoods } from './bairros.ts';
import { registrar } from './lib.ts';

comBanco('carga de bairros do IBGE', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());

  test('staging → ibge.bairro, split parts collected, loading again updates', async () => {
    const a = await registrar(db, {
      chave: 'bruto/ibge-bairros/x.gpkg',
      fonte: 'ibge-bairros',
      sha256: 'a'.repeat(64),
      baixado_em: '2026-10-21T00:00:00Z',
    });
    // What ogr2ogr leaves in the staging table.
    const stage = (nome: string) =>
      db.query(`CREATE TABLE ibge.carga_bairro (cd_bairro text, nm_bairro text, cd_mun text, geom geometry(MultiPolygon, 4326));
        INSERT INTO ibge.carga_bairro VALUES
          ('1302603005001', '${nome}', '1302603', ST_Multi(ST_MakeEnvelope(-60.03, -3.14, -60.02, -3.13, 4326))),
          ('1302603005002', 'Educandos', '1302603', ST_Multi(ST_MakeEnvelope(-60.02, -3.15, -60.01, -3.14, 4326))),
          ('1302603005002', 'Educandos', '1302603', ST_Multi(ST_MakeEnvelope(-60.00, -3.15, -59.99, -3.14, 4326)))`);
    await stage('Centro');
    expect(await loadNeighbourhoods(db, a)).toBe(2);
    expect((await db.query("SELECT ST_NumGeometries(geom) AS n FROM ibge.bairro WHERE codigo = '1302603005002'")).rows[0].n).toBe(2);
    expect((await db.query("SELECT to_regclass('ibge.carga_bairro') AS t")).rows[0].t).toBeNull();

    await db.query('DELETE FROM bruto.carga');
    await stage('Centro Histórico');
    await loadNeighbourhoods(db, a);
    expect((await db.query('SELECT codigo, nome, municipio FROM ibge.bairro ORDER BY codigo')).rows).toEqual([
      { codigo: '1302603005001', nome: 'Centro Histórico', municipio: 1302603 },
      { codigo: '1302603005002', nome: 'Educandos', municipio: 1302603 },
    ]);
  });
});
