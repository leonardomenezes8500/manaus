import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { BBOX_CAMADAS, MANAUS } from '../regiao.ts';
import { registrar } from './lib.ts';
import { carregarMunicipios } from './municipios.ts';

// Quadrados de mentira: "Manaus" em volta do ponto de referência e um vizinho a leste.
const quadrado = (lon: number, lat: number, r: number) => ({
  type: 'Polygon',
  coordinates: [
    [
      [lon - r, lat - r],
      [lon + r, lat - r],
      [lon + r, lat + r],
      [lon - r, lat + r],
      [lon - r, lat - r],
    ],
  ],
});
// Gravata-borboleta: polígono inválido, como os que a malha simplificada às vezes traz.
const gravata = {
  type: 'Polygon',
  coordinates: [
    [
      [-61, -4],
      [-60.5, -3.5],
      [-60.5, -4],
      [-61, -3.5],
      [-61, -4],
    ],
  ],
};

comBanco('carga de municípios', () => {
  const db = new pg.Client();
  let arquivo: number;
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
    arquivo = await registrar(db, {
      chave: 'bruto/ibge-malhas/x.geojson',
      fonte: 'ibge-malhas',
      sha256: 'a'.repeat(64),
      baixado_em: '2026-10-21T00:00:00Z',
    });
  });
  afterAll(() => db.end());

  const nomes = new Map([
    [MANAUS.codigo, 'Manaus'],
    [1300000, 'Vizinho'],
    [1300001, 'Torto'],
  ]);
  const malha = (lon: number) => ({
    arquivo,
    uf: 'AM',
    geojson: {
      features: [
        { properties: { codarea: String(MANAUS.codigo) }, geometry: quadrado(lon, MANAUS.lat, 0.2) },
        { properties: { codarea: '1300000' }, geometry: quadrado(-59, MANAUS.lat, 0.2) },
        { properties: { codarea: '1300001' }, geometry: gravata },
      ],
    },
  });

  test('carrega, o ponto de Manaus cai em Manaus e recarregar não duplica', async () => {
    expect(await carregarMunicipios(db, [malha(MANAUS.lon)], nomes)).toBe(3);
    await carregarMunicipios(db, [malha(MANAUS.lon)], nomes);
    const r = await db.query('SELECT nome FROM ibge.municipio WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))', [
      MANAUS.lon,
      MANAUS.lat,
    ]);
    expect(r.rows).toEqual([{ nome: 'Manaus' }]);
    expect((await db.query('SELECT count(*)::int AS n, bool_and(ST_IsValid(geom)) AS validas FROM ibge.municipio')).rows[0]).toEqual({
      n: 3,
      validas: true,
    });
  });

  test('município sem nome desfaz a carga inteira', async () => {
    await expect(carregarMunicipios(db, [malha(0)], new Map([[MANAUS.codigo, 'Manaus']]))).rejects.toThrow('sem nome');
    const r = await db.query('SELECT ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326)) AS ok FROM ibge.municipio WHERE codigo = $3', [
      MANAUS.lon,
      MANAUS.lat,
      MANAUS.codigo,
    ]);
    expect(r.rows[0].ok).toBe(true);
  });

  test('a caixa do banco é a mesma do código', async () => {
    const r = await db.query(
      "SELECT ST_XMin(geom) AS oeste, ST_YMin(geom) AS sul, ST_XMax(geom) AS leste, ST_YMax(geom) AS norte FROM analise.regiao WHERE nome = 'influencia_fumaca'",
    );
    expect(r.rows[0]).toEqual(BBOX_CAMADAS);
  });
});
