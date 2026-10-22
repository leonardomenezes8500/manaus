// Buildings load (#26): Open Buildings rows from the tile CSV, Overture from the FlatGeobuf clip through ogr2ogr staging.
import type pg from 'pg';
import { MANAUS_BBOX as B } from '../regiao.ts';
import { loadOnce, stageGpkg } from './lib.ts';

export type OpenBuilding = { codigo: string; area_m2: number; confianca: number; wkt: string };

/** One record of an Open Buildings v3 CSV → a row, or null when its centroid is outside the Manaus box. */
export function openBuildingsRow(r: Record<string, string>): OpenBuilding | null {
  const lat = Number(r.latitude);
  const lon = Number(r.longitude);
  if (!(lat >= B.sul && lat <= B.norte && lon >= B.oeste && lon <= B.leste)) return null;
  return { codigo: r.full_plus_code, area_m2: Number(r.area_in_meters), confianca: Number(r.confidence), wkt: r.geometry };
}

/** Inserts in batches (ON CONFLICT DO NOTHING) and marks the file loaded, in one transaction. */
export function loadOpenBuildings(db: pg.ClientBase, arquivo: number, rows: AsyncIterable<OpenBuilding>): Promise<number> {
  return loadOnce(db, arquivo, 'openbuildings.edificacao', async () => {
    let n = 0;
    let batch: OpenBuilding[] = [];
    const flush = async () => {
      await db.query(
        `INSERT INTO openbuildings.edificacao (codigo, area_m2, confianca, geom, arquivo)
         SELECT c, a, k, ST_Multi(ST_GeomFromText(w, 4326)), $5 FROM unnest($1::text[], $2::float8[], $3::real[], $4::text[]) AS u(c, a, k, w)
         ON CONFLICT DO NOTHING`,
        [batch.map((r) => r.codigo), batch.map((r) => r.area_m2), batch.map((r) => r.confianca), batch.map((r) => r.wkt), arquivo],
      );
      n += batch.length;
      batch = [];
    };
    for await (const r of rows) {
      batch.push(r);
      if (batch.length === 5000) await flush();
    }
    if (batch.length) await flush();
    return n;
  });
}

/** FlatGeobuf clip → overture.carga_edificacao (staging). */
export function stageOverture(fgb: string): void {
  stageGpkg(fgb, 'overture.carga_edificacao', 'id,subtype,class,height,num_floors,dataset');
}

/** Staging → overture.edificacao (whole table replaced by this release), then drops the staging table. */
export function loadOverture(db: pg.ClientBase, arquivo: number, release: string): Promise<number> {
  return loadOnce(db, arquivo, 'overture.edificacao', async () => {
    if (Number((await db.query('SELECT count(*) AS n FROM overture.carga_edificacao')).rows[0].n) === 0)
      throw new Error('recorte da Overture vazio: a tabela fica como estava');
    await db.query('TRUNCATE overture.edificacao');
    const r = await db.query(
      `INSERT INTO overture.edificacao (id, subtipo, classe, altura, andares, dataset, geom, release, arquivo)
       SELECT id, subtype, class, height, num_floors, dataset, geom, $1, $2 FROM overture.carga_edificacao`,
      [release, arquivo],
    );
    await db.query('DROP TABLE overture.carga_edificacao');
    return r.rowCount ?? 0;
  });
}
