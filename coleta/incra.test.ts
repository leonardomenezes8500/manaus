import pg from 'pg';
import { bancoNovo, comBanco } from '../db/teste.ts';
import { registrar } from './carga/lib.ts';
import { loadIncra } from './incra.ts';

comBanco('carga do INCRA', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('SIGEF, SNCI and settlements: dates and areas as they come (dd/mm/aaaa text, numbers as text), bad dates null', async () => {
    // What ogr2ogr leaves from the AM shapefiles: real attribute rows, geometries replaced.
    const caixa = `ST_Multi(ST_MakeEnvelope(-60, -3, -59.9, -2.9, 4326))`;
    await db.query(`
      CREATE TABLE incra.carga_sigef (parcela_co text, situacao_i text, codigo_imo text, data_submi date, data_aprov date, status text,
        nome_area text, registro_m text, registro_d date, municipio_ integer, uf_id integer, geom geometry(MultiPolygon, 4326));
      INSERT INTO incra.carga_sigef VALUES ('4ef44742-7c86-4875-8707-0720d4f6ca7c', 'REGISTRADA', '0121061078241', '2021-07-05',
        '2021-07-05', 'REGISTRADA', 'PROJETO DE ASSENTAMENTO PORTO ALONSO - Parte 1', '19974', '2021-11-22', 1300706, 13, ${caixa});
      CREATE TABLE incra.carga_snci (num_proces text, num_certif text, data_certi date, qtd_area_p text, cod_imovel text,
        nome_imove text, uf_municip text, geom geometry(MultiPolygon, 4326));
      INSERT INTO incra.carga_snci VALUES ('54270.000119/2013-54', '151303000005-96', '2013-03-13', '1098.2333', '9501658752792',
        'FAZENDA RIO GRANDE', 'AM', ${caixa});
      CREATE TABLE incra.carga_assentamento (cd_sipra text, uf text, nome_proje text, municipio text, area_hecta text,
        capacidade integer, num_famili integer, fase integer, data_de_cr text, forma_obte text, data_obten text, geom geometry(MultiPolygon, 4326));
      INSERT INTO incra.carga_assentamento VALUES
        ('AM0083000', 'AM', 'PAE PURUS', 'BERURI', '473461.7009', 2600, 2428, 5, '08/08/2006', 'Discriminação', '20/02/1984', ${caixa}),
        ('AM0000000', 'AM', 'SEM DATA', 'BERURI', '', 0, 0, 3, '31/02/2006', NULL, '', ${caixa});`);
    const arquivo = await registrar(db, {
      chave: 'bruto/incra-sigef/x',
      fonte: 'incra-sigef',
      sha256: 'd'.repeat(64),
      baixado_em: '2026-10-23T00:00:00Z',
    });
    expect(await loadIncra(db, arquivo)).toEqual({ 'incra.sigef': 1, 'incra.snci': 1, 'incra.assentamento': 2 });
    expect((await db.query('SELECT situacao, data_aprovacao::text, uf, municipio FROM incra.sigef')).rows).toEqual([
      { situacao: 'REGISTRADA', data_aprovacao: '2021-07-05', uf: 'AM', municipio: 1300706 },
    ]);
    expect((await db.query('SELECT certificado, data_certificacao::text, area_ha, uf FROM incra.snci')).rows).toEqual([
      { certificado: '151303000005-96', data_certificacao: '2013-03-13', area_ha: 1098.2333, uf: 'AM' },
    ]);
    expect(
      (await db.query('SELECT codigo, area_ha, data_criacao::text, data_obtencao::text FROM incra.assentamento ORDER BY codigo')).rows,
    ).toEqual([
      { codigo: 'AM0000000', area_ha: null, data_criacao: null, data_obtencao: null },
      { codigo: 'AM0083000', area_ha: 473461.7009, data_criacao: '2006-08-08', data_obtencao: '1984-02-20' },
    ]);
  });
});
