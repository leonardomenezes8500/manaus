// Neighbourhood load (#24): the IBGE 2022 bairros GeoPackage through ogr2ogr (staging) into ibge.bairro.
import type pg from 'pg';
import { loadOnce, stageGpkg } from './lib.ts';

/** GeoPackage → ibge.carga_bairro (staging, replaced every time). */
export function stageNeighbourhoods(gpkg: string): void {
  stageGpkg(gpkg, 'ibge.carga_bairro', 'CD_BAIRRO,NM_BAIRRO,CD_MUN');
}

/** Staging → ibge.bairro (insert or update by code), then drops the staging table. */
export function loadNeighbourhoods(db: pg.ClientBase, arquivo: number): Promise<number> {
  return loadOnce(db, arquivo, 'ibge.bairro', async () => {
    const r = await db.query(
      `INSERT INTO ibge.bairro (codigo, nome, municipio, geom, arquivo)
       SELECT cd_bairro, min(nm_bairro), min(cd_mun)::int, ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Collect(geom)), 3)), $1
       FROM ibge.carga_bairro GROUP BY cd_bairro
       ON CONFLICT (codigo) DO UPDATE SET nome = excluded.nome, municipio = excluded.municipio, geom = excluded.geom,
         arquivo = excluded.arquivo`,
      [arquivo],
    );
    await db.query('DROP TABLE ibge.carga_bairro');
    return r.rowCount ?? 0;
  });
}
