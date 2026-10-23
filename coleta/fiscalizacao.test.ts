import pg from 'pg';
import { bancoNovo, comBanco } from '../db/teste.ts';
import { registrar } from './carga/lib.ts';
import { loadFiscalizacao } from './fiscalizacao.ts';

// Rows as ogr2ogr leaves them (all text for the IBAMA CSVs, typed for the ICMBio shapefiles). Real formats of the AM,
// names and documents made up: no personal data in the repo.
comBanco('carga da fiscalização (IBAMA e ICMBio)', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('IBAMA embargo with WKT, impossible date and cancelled; autos with comma decimals; ICMBio by state', async () => {
    const t = `text`;
    await db.query(`
      CREATE TABLE ibama.carga_embargo (seq_tad ${t}, sit_cancelado ${t}, num_tad ${t}, ser_tad ${t}, dat_embargo ${t},
        nome_embargado ${t}, cpf_cnpj_embargado ${t}, num_processo ${t}, cod_municipio ${t}, uf ${t}, num_longitude_tad ${t},
        num_latitude_tad ${t}, deter_prodes ${t}, qtd_area_embargada ${t}, nome_imovel ${t}, tipo_area ${t}, geom_area_embargada ${t},
        sit_desembargo ${t}, tipo_desembargo ${t}, dat_desembargo ${t}, num_auto_infracao ${t}, operacao ${t}, des_tad ${t});
      INSERT INTO ibama.carga_embargo VALUES
        ('1', 'N', 'AAA1', '', '2026-10-22 16:30:10', 'FULANO DE TAL', '00000000000', 'p1', '1302603', 'AM', '-59.0469', '-3.5705', '',
         '3,6367', 'Sitio X', 'Atividade', 'POLYGON ((-59.06 -3.58, -59.04 -3.58, -59.04 -3.56, -59.06 -3.56, -59.06 -3.58))',
         '', '', '', 'AI1', '', 'Fica embargada'),
        ('2', 'N', 'AAA2', '', '2925-09-25 15:10:00', 'EMPRESA EXEMPLO LTDA', '00000000000100', 'p2', '1302603', 'AM', '-60.1', '-3.4', '',
         '', '', '', 'POLYGON ((nao e wkt))', 'S', 'Total', '2024-01-02 00:00:00', '', 'Op', ''),
        ('3', 'S', 'AAA3', 'D', '2019-05-01 10:00:00', 'BELTRANO', '11111111111', 'p3', '1100205', 'RO', '-63.9', '-8.7', 'DETER',
         '10,5', '', '', '', '', '', '', '', '', '');
      CREATE TABLE ibama.carga_auto (seq_auto_infracao ${t}, sit_cancelado ${t}, num_auto_infracao ${t}, ser_auto_infracao ${t},
        tipo_auto ${t}, val_auto_infracao ${t}, dat_hora_auto_infracao ${t}, dt_fato_infracional ${t}, ds_unid_conciliacao ${t},
        cod_municipio ${t}, uf ${t}, tipo_infracao ${t}, des_infracao ${t}, tp_pessoa_infrator ${t}, nome_infrator ${t},
        cpf_cnpj_infrator ${t}, qt_area ${t}, num_longitude_auto ${t}, num_latitude_auto ${t}, wkt_ge_area_autuada ${t},
        unidade_conservacao ${t}, operacao ${t}, cd_termos_embargos ${t});
      INSERT INTO ibama.carga_auto VALUES
        ('10', 'N', 'B1', 'A', 'Multa simples', '201000,00', '2020-03-14 11:00:00', '2020-03-13', 'Núcleo de Conciliação Ambiental/AM',
         '1302603', 'AM', 'Flora', 'Desmatar', 'PF', 'FULANO DE TAL', '00000000000', '', '-63,456667', '-7,506389', '', '', '', '');
      CREATE TABLE icmbio.carga_embargo (numero_emb ${t}, serie ${t}, numero_ai ${t}, cpf_cnpj ${t}, autuado ${t}, tipo_infra ${t},
        nome_uc ${t}, cnuc ${t}, municipio ${t}, uf ${t}, data date, julgamento ${t}, area ${t}, processo ${t}, geom geometry(MultiPolygon, 4326));
      INSERT INTO icmbio.carga_embargo VALUES
        ('E1', 'C', 'A1', '00000000000', 'FULANO', 'Flora', 'Resex X', '0000.00.0001', 'Lábrea', 'AM', '2018-07-01', '', '12,5', 'p',
         ST_Multi(ST_MakeEnvelope(-64, -7, -63.9, -6.9, 4326))),
        ('E2', 'C', 'A2', '00000000000', 'FULANO', 'Flora', 'Parna Y', '0000.00.0002', 'Brasília', 'DF', '2018-07-01', '', '1', 'p',
         ST_Multi(ST_MakeEnvelope(-48, -16, -47.9, -15.9, 4326)));
      CREATE TABLE icmbio.carga_auto (numero_ai ${t}, serie ${t}, tipo ${t}, valor_mult float8, embargo ${t}, autuado ${t},
        cpf_cnpj ${t}, data date, tipo_infra ${t}, nome_uc ${t}, cnuc ${t}, municipio ${t}, uf ${t}, julgamento ${t}, processo ${t},
        geom geometry(MultiPoint, 4326));
      INSERT INTO icmbio.carga_auto VALUES ('A1', 'C', 'Multa', 5000, 'S', 'FULANO', '00000000000', '2018-07-01', 'Flora', 'Resex X',
        '0000.00.0001', 'Lábrea', 'AM', '', 'p', ST_Multi(ST_MakePoint(-63.95, -6.95)::geometry(Point, 4326)));`);
    const arq = async (k: string) =>
      registrar(db, {
        chave: `bruto/${k}/x`,
        fonte: k,
        sha256: Buffer.from(k).toString('hex').padEnd(64, '0').slice(0, 64),
        baixado_em: '2026-10-23T00:00:00Z',
      });
    const n = await loadFiscalizacao(db, {
      embargoIbama: await arq('ibama-embargos'),
      autoIbama: await arq('ibama-autos'),
      embargoIcmbio: await arq('icmbio-fiscalizacao'),
      autoIcmbio: await arq('icmbio-autos'),
    });
    expect(n).toEqual({ 'ibama.embargo': 3, 'ibama.auto_infracao': 1, 'icmbio.embargo': 1, 'icmbio.auto_infracao': 1 });
    expect(
      (
        await db.query(`SELECT numero, data::text, cancelado, pessoa, area_ha, desembargo, poligono IS NOT NULL AS tem_poligono,
                          ponto IS NOT NULL AS tem_ponto FROM ibama.embargo ORDER BY numero`)
      ).rows,
    ).toEqual([
      {
        numero: 'AAA1',
        data: '2026-10-22',
        cancelado: false,
        pessoa: 'PF',
        area_ha: 3.6367,
        desembargo: null,
        tem_poligono: true,
        tem_ponto: true,
      },
      { numero: 'AAA2', data: null, cancelado: false, pessoa: 'PJ', area_ha: null, desembargo: 'S', tem_poligono: false, tem_ponto: true },
      {
        numero: 'AAA3',
        data: '2019-05-01',
        cancelado: true,
        pessoa: 'PF',
        area_ha: 10.5,
        desembargo: null,
        tem_poligono: false,
        tem_ponto: true,
      },
    ]);
    expect(
      (await db.query(`SELECT valor, tipo_infracao, data::text, conciliacao, ST_X(ponto) AS lon FROM ibama.auto_infracao`)).rows,
    ).toEqual([
      { valor: 201000, tipo_infracao: 'Flora', data: '2020-03-14', conciliacao: 'Núcleo de Conciliação Ambiental/AM', lon: -63.456667 },
    ]);
    expect((await db.query(`SELECT numero, area_ha FROM icmbio.embargo`)).rows).toEqual([{ numero: 'E1', area_ha: 12.5 }]);
  });
});
