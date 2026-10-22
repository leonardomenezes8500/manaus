import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { focosEmAreasProtegidas, loadTis, loadUnidades, tiRow } from './areas-protegidas.ts';
import { registrar } from './lib.ts';

const caixa = (x: number, y: number, d = 0.1) => ({
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [x, y],
        [x + d, y],
        [x + d, y + d],
        [x, y + d],
        [x, y],
      ],
    ],
  ],
});

// One real feature of the FUNAI WFS (Funai:tis_poligonais, 2026-10-21), geometry replaced.
const ti = {
  type: 'Feature',
  geometry: caixa(-60.5, -2.5),
  properties: {
    gid: 1,
    terrai_codigo: 101,
    terrai_nome: 'Acapuri de Cima',
    etnia_nome: 'Kokama',
    municipio_nome: 'Fonte Boa',
    uf_sigla: 'AM',
    superficie_perimetro_ha: 18393.9411,
    fase_ti: 'Regularizada',
    modalidade_ti: 'Tradicionalmente ocupada',
    data_atualizacao: '05/09/2023',
  },
};

test('FUNAI feature → row (date dd/mm/yyyy to ISO)', () => {
  expect(tiRow(ti)).toEqual({
    codigo: 101,
    nome: 'Acapuri de Cima',
    etnia: 'Kokama',
    municipios: 'Fonte Boa',
    uf: 'AM',
    fase: 'Regularizada',
    modalidade: 'Tradicionalmente ocupada',
    area_ha: 18393.9411,
    atualizado_em: '2023-09-05',
    geom: caixa(-60.5, -2.5),
  });
});

comBanco('carga de terras indígenas e unidades de conservação', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());
  const arquivo = (k: string) =>
    registrar(db, { chave: `bruto/x/${k}`, fonte: 'x', sha256: 'a'.repeat(64), baixado_em: '2026-10-21T00:00:00Z' });

  test('TIs and UCs load (twice = same); season fire spots counted per area and per agency', async () => {
    expect(await loadTis(db, await arquivo('ti.json'), [tiRow(ti)])).toBe(1);
    // What ogr2ogr leaves from the CNUC shapefile.
    await db.query(`CREATE TABLE cnuc.carga_unidade (cd_cnuc text, nome_uc text, esfera text, categoria text, grupo text, org_gestor text,
        cria_ano text, cria_ato text, ha_total text, uf text, geom geometry(MultiPolygon, 4326));
      INSERT INTO cnuc.carga_unidade VALUES
        ('0000.13.0981', 'RDS AMANÃ', 'Estadual', 'Reserva de Desenvolvimento Sustentável', 'Uso Sustentável',
         'SECRETARIA DE ESTADO DO MEIO AMBIENTE DO AMAZONAS - AM', '06-08-1998', 'Decreto 19.021', '2303458.24', 'AM',
         ST_Multi(ST_MakeEnvelope(-60.45, -2.45, -60.3, -2.3, 4326))),
        ('0000.00.0001', 'PARNA ANAVILHANAS', 'Federal', 'Parque', 'Proteção Integral',
         'INSTITUTO CHICO MENDES DE CONSERVAÇÃO DA BIODIVERSIDADE', '02-06-1981', 'Decreto 86.061', '350469.80', 'AM',
         ST_Multi(ST_MakeEnvelope(-61, -2.8, -60.9, -2.7, 4326)))`);
    expect(await loadUnidades(db, await arquivo('cnuc.zip'))).toBe(2);
    expect((await db.query('SELECT cd_cnuc, ano_criacao, area_ha FROM cnuc.unidade ORDER BY 1')).rows).toEqual([
      { cd_cnuc: '0000.00.0001', ano_criacao: 1981, area_ha: 350469.8 },
      { cd_cnuc: '0000.13.0981', ano_criacao: 1998, area_ha: 2303458.24 },
    ]);

    // Spots: one in the TI only, one in the TI and the state RDS (overlap), one in nothing, one before the season.
    const f = await arquivo('focos.csv');
    await db.query(
      `INSERT INTO inpe.foco (id, data_hora, satelite, lat, lon, geom, arquivo) VALUES
        (gen_random_uuid(), '2026-09-01T18:00Z', 'AQUA_M-T', -2.48, -60.48, ST_Point(-60.48, -2.48, 4326), $1),
        (gen_random_uuid(), '2026-09-02T18:00Z', 'AQUA_M-T', -2.42, -60.42, ST_Point(-60.42, -2.42, 4326), $1),
        (gen_random_uuid(), '2026-09-03T18:00Z', 'AQUA_M-T', -3.5, -61.5, ST_Point(-61.5, -3.5, 4326), $1),
        (gen_random_uuid(), '2026-07-01T18:00Z', 'AQUA_M-T', -2.48, -60.48, ST_Point(-60.48, -2.48, 4326), $1)`,
      [f],
    );
    expect(await focosEmAreasProtegidas(db, '2026-08-01')).toEqual({
      total: 3,
      em_ti: 2,
      em_uc: 1,
      em_alguma: 2,
      por_orgao: [
        { orgao: 'FUNAI (terra indígena)', focos: 2 },
        { orgao: 'SECRETARIA DE ESTADO DO MEIO AMBIENTE DO AMAZONAS - AM (Estadual)', focos: 1 },
      ],
    });
  });
});
