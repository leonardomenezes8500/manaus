import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { loadOpenBuildings, loadOverture, openBuildingsRow } from './edificacoes.ts';
import { registrar } from './lib.ts';

// Two real rows of the Open Buildings v3 tile 927 (the first falls in Manaus) and one moved to Belém.
const square = (x: number, y: number) =>
  `POLYGON((${x} ${y}, ${x + 0.0001} ${y}, ${x + 0.0001} ${y + 0.0001}, ${x} ${y + 0.0001}, ${x} ${y}))`;
const rec = (lat: number, lon: number, code: string) => ({
  latitude: String(lat),
  longitude: String(lon),
  area_in_meters: '49.3501',
  confidence: '0.8263',
  geometry: square(lon, lat),
  full_plus_code: code,
});

test('Open Buildings row: kept only inside the Manaus box, numbers parsed', () => {
  expect(openBuildingsRow(rec(-3.02748536, -59.94505446, '6882X3F3+2X4F'))).toEqual({
    codigo: '6882X3F3+2X4F',
    area_m2: 49.3501,
    confianca: 0.8263,
    wkt: square(-59.94505446, -3.02748536),
  });
  expect(openBuildingsRow(rec(-1.45, -48.5, '6982XXXX+XXXX'))).toBeNull();
});

comBanco('carga de edificações', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());
  const arquivo = (k: string, fonte: string) =>
    registrar(db, { chave: `bruto/${fonte}/${k}`, fonte, sha256: 'a'.repeat(64), baixado_em: '2026-10-21T00:00:00Z' });

  test('Open Buildings: inserted once, loading again adds nothing', async () => {
    const a = await arquivo('927.csv.gz', 'google-open-buildings');
    async function* rows() {
      yield openBuildingsRow(rec(-3.02748536, -59.94505446, '6882X3F3+2X4F'))!;
      yield openBuildingsRow(rec(-2.84378603, -60.7310327, '679X5749+FHPH'))!;
      // The tile has a few multipolygons (4 of 2.3 million).
      yield { ...openBuildingsRow(rec(-3.1, -60.0, '6882VX2X+XXXX'))!, wkt: `MULTIPOLYGON((${square(-60, -3.1).slice(8, -1)}))` };
    }
    expect(await loadOpenBuildings(db, a, rows())).toBe(3);
    await db.query('DELETE FROM bruto.carga');
    await loadOpenBuildings(db, a, rows());
    const r = await db.query(
      `SELECT codigo, confianca, round(ST_Area(geom::geography)) > 0 AS area FROM openbuildings.edificacao ORDER BY 1`,
    );
    expect(r.rows).toEqual([
      { codigo: '679X5749+FHPH', confianca: 0.8263, area: true },
      { codigo: '6882VX2X+XXXX', confianca: 0.8263, area: true },
      { codigo: '6882X3F3+2X4F', confianca: 0.8263, area: true },
    ]);
  });

  test('Overture: staging (what ogr2ogr leaves) → overture.edificacao; the next release replaces the table', async () => {
    const stage = (id: string) =>
      db.query(`CREATE TABLE overture.carga_edificacao (id text, subtype text, class text, height float8, num_floors int, dataset text,
          geom geometry(MultiPolygon, 4326));
        INSERT INTO overture.carga_edificacao VALUES ('${id}', 'residential', 'house', 6.5, 2, 'OpenStreetMap',
          ST_Multi(ST_MakeEnvelope(-60.0, -3.1, -59.9999, -3.0999, 4326)))`);
    await stage('a1');
    expect(await loadOverture(db, await arquivo('r1.parquet', 'overture-maps'), '2026-09-23.0')).toBe(1);
    expect((await db.query('SELECT id, classe, altura, andares, dataset, release FROM overture.edificacao')).rows).toEqual([
      { id: 'a1', classe: 'house', altura: 6.5, andares: 2, dataset: 'OpenStreetMap', release: '2026-09-23.0' },
    ]);
    expect((await db.query("SELECT to_regclass('overture.carga_edificacao') AS t")).rows[0].t).toBeNull();
    await stage('b2');
    await loadOverture(db, await arquivo('r2.parquet', 'overture-maps'), '2026-10-21.0');
    expect((await db.query('SELECT id, release FROM overture.edificacao')).rows).toEqual([{ id: 'b2', release: '2026-10-21.0' }]);
  });
});
