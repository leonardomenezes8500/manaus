import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { bancoNovo, comBanco } from '../db/teste.ts';
import { registrar } from './carga/lib.ts';
import { gravarPagina, lerPagina, urlPagina } from './mapbiomas-alerta.ts';

// 2 real alerts of the public WFS (2026-10-23, layers box), as they came.
const pagina = JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', 'mapbiomas-alerta', 'pagina.json'), 'utf8'));

test('the page url: WFS 2.0, GeoJSON, a stable order, the layers box in lat,lon', () => {
  const u = new URL(urlPagina(4000));
  expect(u.searchParams.get('typeNames')).toBe('mapbiomas-alertas:dashboard_alerts-shapefile');
  expect(u.searchParams.get('sortBy')).toBe('CodeAlerta');
  expect(u.searchParams.get('startIndex')).toBe('4000');
  expect(u.searchParams.get('bbox')).toBe('-15,-74,3,-52,urn:ogc:def:crs:EPSG::4326');
});

test('a WFS page becomes rows: the code, the state and the dates', () => {
  const l = lerPagina(pagina);
  expect(l).toHaveLength(2);
  expect(l[1]).toMatchObject({
    codigo: 9,
    fontes: '{GLAD,SAD}',
    estado: 'ACRE',
    municipio: 'Xapuri',
    area_ha: 16.6278,
    ano: 2019,
    detectado_em: '2019-01-01',
    imagem_antes: '2018-10-01T14:22:22Z',
    imagem_depois: '2019-04-11T14:27:35Z',
    vetor_pressao: 'agriculture',
  });
  expect(JSON.parse(l[0].geom).type).toBe('MultiPolygon');
});

comBanco('carga do MapBiomas Alerta', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('a page goes in with its raw file; the same code twice is refused', async () => {
    const arquivo = await registrar(db, {
      chave: 'bruto/mapbiomas-alerta/p0',
      fonte: 'mapbiomas-alerta',
      sha256: 'e'.repeat(64),
      baixado_em: '2026-10-23T00:00:00Z',
    });
    expect(await gravarPagina(db, lerPagina(pagina), arquivo)).toBe(2);
    const r = await db.query('SELECT codigo, uf, ST_GeometryType(geom) AS g FROM mapbiomas_alerta.alerta ORDER BY codigo');
    expect(r.rows).toEqual([
      { codigo: 1, uf: 'MT', g: 'ST_MultiPolygon' },
      { codigo: 9, uf: 'AC', g: 'ST_MultiPolygon' },
    ]);
    await expect(gravarPagina(db, lerPagina(pagina), arquivo)).rejects.toThrow();
  });
});
