import pg from 'pg';
import { bancoNovo, comBanco } from '../db/teste.ts';
import { registrar } from './carga/lib.ts';
import { conferirTisUcs, loadCnfp } from './cnfp.ts';

comBanco('carga do CNFP', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('tipo A/B, overlap flag and the year from the 3 date formats; TIs matched against FUNAI by area', async () => {
    // What ogr2ogr leaves from CNFP_2025.shp: real attribute rows of the AM, geometries replaced.
    await db.query(`CREATE TABLE sfb.carga_cnfp (nome text, categoria text, protecao text, tipo text, governo text, classe text,
        orgao text, sobreposic text, anocriacao text, estagio text, uf text, municipio text, area_ha float8, geom geometry(MultiPolygon, 4326));
      INSERT INTO sfb.carga_cnfp VALUES
        ('ABACAXIS', 'GLEBA ARRECADADA', 'SEM DESTINACAO', 'TIPO B', 'FEDERAL', 'GLEBAFED', 'INCRA', 'NÃO', NULL, 'ARRECADADA', 'AM',
         'BORBA/ITACOATIARA/MAUÉS/NOVA OLINDA DO NORTE', 332831.904975, ST_Multi(ST_MakeEnvelope(-59, -4, -58.5, -3.5, 4326))),
        ('ACAPURI DE CIMA', 'TI', 'USO SUSTENTAVEL', 'TIPO A', 'FEDERAL', 'TI', 'FUNAI', 'NÃO', '1991-10-29', NULL, 'AM',
         'FONTE BOA', 18393.94, ST_Multi(ST_MakeEnvelope(-60.5, -2.5, -60.4, -2.4, 4326))),
        ('AMANÃ', 'TI / RDS', 'USO SUSTENTAVEL', 'TIPO A', 'ESTADUAL', 'RDS', 'SEMA', 'SIM', '24-04-2008', NULL, 'AM',
         'MARAÃ', 100.5, ST_Multi(ST_MakeEnvelope(-62, -2, -61.9, -1.9, 4326)))`);
    const arquivo = await registrar(db, {
      chave: 'bruto/sfb-cnfp/x',
      fonte: 'sfb-cnfp',
      sha256: 'c'.repeat(64),
      baixado_em: '2026-10-23T00:00:00Z',
    });
    expect(await loadCnfp(db, arquivo)).toBe(3);
    expect((await db.query('SELECT nome, tipo, sobreposicao, ano_criacao FROM sfb.floresta_publica ORDER BY nome')).rows).toEqual([
      { nome: 'ABACAXIS', tipo: 'B', sobreposicao: false, ano_criacao: null },
      { nome: 'ACAPURI DE CIMA', tipo: 'A', sobreposicao: false, ano_criacao: 1991 },
      { nome: 'AMANÃ', tipo: 'A', sobreposicao: true, ano_criacao: 2008 },
    ]);
    // One FUNAI TI right on the CNFP TI, another where the CNFP has only a gleba.
    await db.query(
      `INSERT INTO funai.terra_indigena (codigo, nome, geom, arquivo) VALUES
      (101, 'Acapuri de Cima', ST_Multi(ST_MakeEnvelope(-60.5, -2.5, -60.4, -2.4, 4326)), $1),
      (102, 'Outra', ST_Multi(ST_MakeEnvelope(-59, -4, -58.9, -3.9, 4326)), $1)`,
      [arquivo],
    );
    expect(await conferirTisUcs(db)).toEqual({
      funai_tis: { total: 2, com_par: 1 },
      cnuc_ucs: { total: 0, com_par: 0 },
      cnfp_pecas_ti: { total: 2, com_par: 1 },
    });
  });
});
