// Controle de carga (camada 2): que arquivo do bruto existe (bruto.arquivo) e para que tabela já foi lido (bruto.carga).
import { execFileSync } from 'node:child_process';
import type pg from 'pg';

export type Arquivo = { chave: string; fonte: string; sha256: string; baixado_em: string };

/** Registra o arquivo (se ainda não estiver) e devolve o id. */
export async function registrar(db: pg.ClientBase, a: Arquivo): Promise<number> {
  const r = await db.query(
    `INSERT INTO bruto.arquivo (chave, fonte, sha256, baixado_em) VALUES ($1, $2, $3, $4)
     ON CONFLICT (chave) DO UPDATE SET chave = excluded.chave RETURNING id`,
    [a.chave, a.fonte, a.sha256, a.baixado_em],
  );
  return Number(r.rows[0].id);
}

export async function marcarCarregado(db: pg.ClientBase, arquivo: number, tabela: string): Promise<void> {
  await db.query('INSERT INTO bruto.carga (arquivo, tabela) VALUES ($1, $2) ON CONFLICT DO NOTHING', [arquivo, tabela]);
}

/** Registered raw files of a source not yet loaded into `tabela`, oldest first. `suffix` filters by file extension. */
export async function pendingFiles(
  db: pg.ClientBase,
  fonte: string,
  tabela: string,
  suffix = '',
): Promise<{ id: number; chave: string; baixado_em: Date }[]> {
  const r = await db.query(
    `SELECT a.id, a.chave, a.baixado_em FROM bruto.arquivo a
     WHERE a.fonte = $1 AND a.chave LIKE $3
       AND NOT EXISTS (SELECT 1 FROM bruto.carga c WHERE c.arquivo = a.id AND c.tabela = $2)
     ORDER BY a.baixado_em, a.id`,
    [fonte, tabela, '%' + suffix],
  );
  return r.rows.map((x) => ({ id: Number(x.id), chave: x.chave, baixado_em: x.baixado_em }));
}

/** Runs `load` in one transaction and marks the file loaded in the same transaction. */
export async function loadOnce(db: pg.ClientBase, arquivo: number, tabela: string, load: () => Promise<number>): Promise<number> {
  await db.query('BEGIN');
  try {
    const n = await load();
    await marcarCarregado(db, arquivo, tabela);
    await db.query('COMMIT');
    return n;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

/** GeoPackage or FlatGeobuf → staging `table` (replaced every time) in EPSG:4326, polygons as multi, with ogr2ogr. Connection from the PG* variables. */
export function stageGpkg(gpkg: string, table: string, select: string, extra: string[] = []): void {
  execFileSync(
    'ogr2ogr',
    [
      ...['-f', 'PostgreSQL', 'PG:', gpkg, '-nln', table, '-overwrite', '-t_srs', 'EPSG:4326', '-nlt', 'PROMOTE_TO_MULTI'],
      ...['-lco', 'GEOMETRY_NAME=geom', '-lco', 'SPATIAL_INDEX=NONE', '-select', select],
      ...extra,
    ],
    { stdio: 'inherit' },
  );
}
