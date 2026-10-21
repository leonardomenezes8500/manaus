// Census tract load (#21): the tract mesh comes through ogr2ogr (GeoPackage → staging table), the aggregates
// from the IBGE CSV (latin1, ";" separated, decimal comma) in long format.
import { execFileSync } from 'node:child_process';
import type pg from 'pg';
import { loadOnce } from './lib.ts';

export type Aggregate = { setor: string; variavel: string; valor: number };

/** "1.234,5" style numbers; "." (not applicable) and "X" (suppressed) become null. */
export function ibgeNumber(v: string): number | null {
  const s = v.trim();
  if (!s || s === '.' || s.toUpperCase() === 'X') return null;
  const n = Number(s.replaceAll('.', '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** One CSV line of an aggregates file → its variables (vNNNN columns) for one tract, for the UF asked. */
export function aggregatesOf(header: string[], line: string, uf: string): Aggregate[] {
  const cells = line.split(';').map((c) => c.replace(/^"(.*)"$/, '$1'));
  const get = (name: string) => cells[header.indexOf(name)];
  if (get('CD_UF') !== uf) return [];
  const setor = get('CD_SETOR');
  return header.flatMap((h, i) => {
    if (!/^v\d{4}$/i.test(h)) return [];
    const valor = ibgeNumber(cells[i] ?? '');
    return valor === null ? [] : [{ setor, variavel: h.toLowerCase(), valor }];
  });
}

/** Loads the aggregates of one table for one file (replacing that table's rows of these tracts). */
export function loadAggregates(db: pg.ClientBase, arquivo: number, tabela: string, rows: Aggregate[]): Promise<number> {
  return loadOnce(db, arquivo, 'ibge.setor_agregado', async () => {
    for (let i = 0; i < rows.length; i += 5000) {
      const b = rows.slice(i, i + 5000);
      await db.query(
        `INSERT INTO ibge.setor_agregado (setor, tabela, variavel, valor, arquivo)
         SELECT s, $1, v, x, $5 FROM unnest($2::text[], $3::text[], $4::float8[]) AS u(s, v, x)
         ON CONFLICT (setor, tabela, variavel) DO UPDATE SET valor = excluded.valor, arquivo = excluded.arquivo`,
        [tabela, b.map((r) => r.setor), b.map((r) => r.variavel), b.map((r) => r.valor), arquivo],
      );
    }
    return rows.length;
  });
}

/** GeoPackage → ibge.carga_setor (staging, replaced every time) with ogr2ogr; connection from the PG* variables. */
export function stageTracts(gpkg: string): void {
  execFileSync(
    'ogr2ogr',
    [
      '-f',
      'PostgreSQL',
      'PG:',
      gpkg,
      '-nln',
      'ibge.carga_setor',
      '-overwrite',
      '-t_srs',
      'EPSG:4326',
      '-nlt',
      'PROMOTE_TO_MULTI',
      '-lco',
      'GEOMETRY_NAME=geom',
      '-lco',
      'SPATIAL_INDEX=NONE',
      '-select',
      'CD_SETOR,SITUACAO,CD_TIPO,AREA_KM2,CD_MUN,CD_BAIRRO,NM_BAIRRO',
    ],
    { stdio: 'inherit' },
  );
}

/** Staging table → ibge.setor (insert or update by code), then drops the staging table. */
export function loadTracts(db: pg.ClientBase, arquivo: number): Promise<number> {
  return loadOnce(db, arquivo, 'ibge.setor', async () => {
    const r = await db.query(
      // The mesh splits some tracts into several polygons (178 in AM): one row per tract, parts collected.
      `INSERT INTO ibge.setor (codigo, municipio, situacao, tipo, area_km2, bairro, bairro_nome, geom, arquivo)
       SELECT cd_setor, min(cd_mun)::int, min(situacao), min(cd_tipo), sum(area_km2), nullif(min(cd_bairro), ''), nullif(min(nm_bairro), ''),
              ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Collect(geom)), 3)), $1
       FROM ibge.carga_setor GROUP BY cd_setor
       ON CONFLICT (codigo) DO UPDATE SET municipio = excluded.municipio, situacao = excluded.situacao, tipo = excluded.tipo,
         area_km2 = excluded.area_km2, bairro = excluded.bairro, bairro_nome = excluded.bairro_nome, geom = excluded.geom,
         arquivo = excluded.arquivo`,
      [arquivo],
    );
    await db.query('DROP TABLE ibge.carga_setor');
    return r.rowCount ?? 0;
  });
}
