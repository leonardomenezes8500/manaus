import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { bancoNovo, comBanco } from '../db/teste.ts';
import { registrar } from './carga/lib.ts';
import { filtro, gravar, lerPagina } from './deter.ts';

// 3 real alerts of the WFS (2026-09-01, region box), each geometry cut to its first ring of 7 points.
const pagina = JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', 'deter', 'pagina.json'), 'utf8'));

test('the box goes lat,lon in the CQL BBOX; the weekly run adds the first image date', () => {
  expect(filtro()).toBe('BBOX(geom,-15,-74,3,-52)');
  expect(filtro('2026-07-24')).toBe("BBOX(geom,-15,-74,3,-52) AND view_date >= '2026-07-24'");
});

test('a WFS page becomes rows with the municipality code as a number', () => {
  const [l] = lerPagina(pagina);
  expect(l).toMatchObject({
    gid: '31311_curr',
    classe: 'DESMATAMENTO_CR',
    view_date: '2026-09-01',
    publish_month: '2026-09-01',
    satelite: 'AMAZONIA-1',
    uf: 'RO',
    mun_geocod: 1100189,
    area_km2: 0.09536748323036381,
    uc: null,
  });
  expect(JSON.parse(l.geom).type).toBe('MultiPolygon');
  expect(lerPagina(pagina)).toHaveLength(3);
});

comBanco('carga DETER', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('a run replaces its image-date window: the same pages twice do not double, an alert moved to _hist counts once', async () => {
    const arq = (c: string) =>
      registrar(db, { chave: `bruto/inpe-deter/${c}`, fonte: 'inpe-deter', sha256: c.repeat(64), baixado_em: '2026-10-23T00:00:00Z' });
    const linhas = lerPagina(pagina);
    const velho = { ...linhas[0], gid: '100006_hist', view_date: '2018-01-14' };
    const repetido = { ...velho, view_date: '2023-09-26', classe: 'DEGRADACAO' }; // the WFS really repeats gids
    expect(await gravar(db, [{ linhas: [velho, repetido, ...linhas], arquivo: await arq('a') }])).toBe(5);
    await gravar(db, [{ linhas, arquivo: await arq('b') }], '2026-07-24'); // weekly run, same alerts
    const movido = { ...linhas[0], gid: '900001_hist' }; // INPE moved 31311_curr to _hist
    await gravar(db, [{ linhas: [movido, linhas[1], linhas[2]], arquivo: await arq('c') }], '2026-07-24');
    const { rows } = await db.query('SELECT gid FROM inpe_desmatamento.deter ORDER BY gid, view_date');
    expect(rows.map((r) => r.gid)).toEqual(['100006_hist', '100006_hist', '31312_curr', '31313_curr', '900001_hist']);
    const { rows: g } = await db.query(
      `SELECT ST_GeometryType(geom) t, bool_and(ST_IsValid(geom)) v FROM inpe_desmatamento.deter GROUP BY 1`,
    );
    expect(g).toEqual([{ t: 'ST_MultiPolygon', v: true }]);
  });
});
