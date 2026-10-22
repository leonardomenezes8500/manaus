// OSM load (#23): ogr2ogr (OSM driver) writes the Manaus area of the PBF into staging tables, then one transaction
// replaces osm.ponto, osm.linha and osm.poligono with the new snapshot.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type pg from 'pg';
import { MANAUS_BBOX as B } from '../regiao.ts';
import { loadOnce } from './lib.ts';

/** "norte-261020.osm.pbf" → "2026-10-20" (Geofabrik names the dated file YYMMDD). */
export function snapshotOf(name: string): string {
  const m = name.match(/^norte-(\d{2})(\d{2})(\d{2})\.osm\.pbf$/);
  if (!m) throw new Error(`nome inesperado do extrato: ${name}`);
  return `20${m[1]}-${m[2]}-${m[3]}`;
}

/** First field of a ".md5" file ("<hash>  <name>"). */
export function md5Of(text: string): string {
  const h = text.trim().split(/\s+/)[0].toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(h)) throw new Error('arquivo .md5 sem hash');
  return h;
}

export async function fileMd5(path: string): Promise<string> {
  const hash = createHash('md5');
  for await (const part of createReadStream(path)) hash.update(part);
  return hash.digest('hex');
}

/** PBF → osm.points / osm.lines / osm.multipolygons (staging), cut to the Manaus box. Connection from the PG* variables. */
export function stageOsm(pbf: string): void {
  // The OSM driver keeps a temporary node index; past 100 MB it goes to disk, so keep it in the buffer volume.
  const tmp = join(process.env.MANAUS_BUFFER || join(tmpdir(), 'manaus-buffer'), 'tmp');
  mkdirSync(tmp, { recursive: true });
  execFileSync(
    'ogr2ogr',
    [
      ...['-f', 'PostgreSQL', 'PG:', pbf, 'points', 'lines', 'multipolygons'],
      ...['-overwrite', '-spat', ...[B.oeste, B.sul, B.leste, B.norte].map(String), '-gt', '65536'],
      ...['-lco', 'SCHEMA=osm', '-lco', 'GEOMETRY_NAME=geom', '-lco', 'SPATIAL_INDEX=NONE'],
    ],
    { stdio: 'inherit', env: { ...process.env, CPL_TMPDIR: tmp } },
  );
}

// Every tag: the attribute columns of the OSM driver (osmconf.ini) plus its other_tags (hstore text).
const TAGS = `jsonb_strip_nulls(to_jsonb(s) - '{ogc_fid,osm_id,osm_way_id,geom,other_tags,z_order,all_tags}'::text[])
  || coalesce(hstore_to_jsonb(s.other_tags::hstore), '{}')`;

/** Staging → osm.ponto/linha/poligono (whole tables replaced), then drops the staging tables. Returns the rows loaded. */
export function loadOsm(db: pg.ClientBase, arquivo: number, snapshot: string): Promise<number> {
  return loadOnce(db, arquivo, 'osm', async () => {
    await db.query('TRUNCATE osm.ponto, osm.linha, osm.poligono');
    let n = 0;
    for (const [table, staging, id] of [
      ['osm.ponto', 'osm.points', `'n' || s.osm_id`],
      ['osm.linha', 'osm.lines', `'w' || s.osm_id`],
      ['osm.poligono', 'osm.multipolygons', `coalesce('r' || s.osm_id, 'w' || s.osm_way_id)`],
    ]) {
      const r = await db.query(
        `INSERT INTO ${table} (id, tags, geom, snapshot, arquivo) SELECT ${id}, ${TAGS}, s.geom, $1, $2 FROM ${staging} s`,
        [snapshot, arquivo],
      );
      n += r.rowCount ?? 0;
    }
    await db.query('DROP TABLE osm.points, osm.lines, osm.multipolygons');
    return n;
  });
}
