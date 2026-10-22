import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from './lib.ts';
import { loadOsm, md5Of, snapshotOf } from './osm.ts';

test('snapshot date from the dated Geofabrik name; anything else is an error', () => {
  expect(snapshotOf('norte-261020.osm.pbf')).toBe('2026-10-20');
  expect(() => snapshotOf('norte-latest.osm.pbf')).toThrow();
  expect(() => snapshotOf('')).toThrow();
});

test('md5 file: first field', () => {
  expect(md5Of('194F7A379E482F71EDDC006AD0D68B40  norte-261020.osm.pbf\n')).toBe('194f7a379e482f71eddc006ad0d68b40');
  expect(() => md5Of('<html>')).toThrow();
});

comBanco('carga do OSM', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());

  // What ogr2ogr leaves in the staging tables (OSM driver, default osmconf.ini, other_tags as hstore text).
  const stage = (name: string) =>
    db.query(`CREATE TABLE osm.points (ogc_fid serial, osm_id text, name text, highway text, other_tags text, geom geometry(Point, 4326));
      CREATE TABLE osm.lines (ogc_fid serial, osm_id text, name text, highway text, z_order int, other_tags text, geom geometry(LineString, 4326));
      CREATE TABLE osm.multipolygons (ogc_fid serial, osm_id text, osm_way_id text, name text, building text, boundary text, admin_level text,
        other_tags text, geom geometry(MultiPolygon, 4326));
      INSERT INTO osm.points (osm_id, name, other_tags, geom) VALUES ('1', '${name}', '"amenity"=>"school","addr:street"=>"Rua X"', ST_Point(-60, -3.1, 4326));
      INSERT INTO osm.lines (osm_id, name, highway, z_order, geom) VALUES ('2', 'Avenida Djalma Batista', 'primary', 7, ST_MakeLine(ST_Point(-60, -3.1, 4326), ST_Point(-60.01, -3.09, 4326)));
      INSERT INTO osm.multipolygons (osm_id, osm_way_id, building, admin_level, boundary, geom) VALUES
        (NULL, '3', 'yes', NULL, NULL, ST_Multi(ST_MakeEnvelope(-60.001, -3.101, -60, -3.1, 4326))),
        ('4', NULL, NULL, '8', 'administrative', ST_Multi(ST_MakeEnvelope(-60.8, -3.2, -59.1, -1.9, 4326)))`);

  test('staging → osm tables with every tag; the next snapshot replaces the tables', async () => {
    const arquivo = (k: string) =>
      registrar(db, {
        chave: `bruto/geofabrik-norte/${k}`,
        fonte: 'geofabrik-norte',
        sha256: 'a'.repeat(64),
        baixado_em: '2026-10-21T00:00:00Z',
      });
    await stage('Escola A');
    expect(await loadOsm(db, await arquivo('a.pbf'), '2026-10-20')).toBe(4);
    expect((await db.query('SELECT id, name, amenity, tags FROM osm.ponto')).rows).toEqual([
      { id: 'n1', name: 'Escola A', amenity: 'school', tags: { name: 'Escola A', amenity: 'school', 'addr:street': 'Rua X' } },
    ]);
    expect((await db.query('SELECT id, highway, tags FROM osm.linha')).rows).toEqual([
      { id: 'w2', highway: 'primary', tags: { name: 'Avenida Djalma Batista', highway: 'primary' } },
    ]);
    expect((await db.query('SELECT id, building, admin_level FROM osm.poligono ORDER BY id')).rows).toEqual([
      { id: 'r4', building: null, admin_level: '8' },
      { id: 'w3', building: 'yes', admin_level: null },
    ]);
    expect((await db.query("SELECT to_regclass('osm.points') AS t")).rows[0].t).toBeNull();

    await stage('Escola B');
    await loadOsm(db, await arquivo('b.pbf'), '2026-10-27');
    expect((await db.query('SELECT name, snapshot::text FROM osm.ponto')).rows).toEqual([{ name: 'Escola B', snapshot: '2026-10-27' }]);
  });
});
