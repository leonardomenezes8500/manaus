// Protected areas load (#30): FUNAI indigenous lands from the WFS GeoJSON, CNUC units from the shapefile through
// ogr2ogr staging; and the count of season fire spots inside them, per responsible agency.
import type pg from 'pg';
import { loadOnce, stageGpkg } from './lib.ts';

type Feature = { geometry: object; properties: Record<string, any> };
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function tiRow(f: Feature) {
  const p = f.properties;
  const [d, m, a] = String(p.data_atualizacao ?? '').split('/');
  return {
    codigo: Number(p.terrai_codigo),
    nome: String(p.terrai_nome).trim(),
    etnia: texto(p.etnia_nome),
    municipios: texto(p.municipio_nome),
    uf: texto(p.uf_sigla),
    fase: texto(p.fase_ti),
    modalidade: texto(p.modalidade_ti),
    area_ha: p.superficie_perimetro_ha ?? null,
    atualizado_em: a ? `${a}-${m}-${d}` : null,
    geom: f.geometry,
  };
}

export function loadTis(db: pg.ClientBase, arquivo: number, rows: ReturnType<typeof tiRow>[]): Promise<number> {
  return loadOnce(db, arquivo, 'funai.terra_indigena', async () => {
    for (const { geom, ...r } of rows) {
      const cols = Object.keys(r);
      await db.query(
        `INSERT INTO funai.terra_indigena (${cols.join(', ')}, geom, arquivo)
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($${cols.length + 1}), 4326)), 3)), $${cols.length + 2})
         ON CONFLICT (codigo) DO UPDATE SET ${[...cols.slice(1), 'geom', 'arquivo'].map((c) => `${c} = excluded.${c}`).join(', ')}`,
        [...Object.values(r), JSON.stringify(geom), arquivo],
      );
    }
    return rows.length;
  });
}

/** CNUC shapefile (inside the zip) → cnuc.carga_unidade (staging), only the units that touch the box. */
export function stageUnidades(shp: string, caixa: { oeste: number; sul: number; leste: number; norte: number }): void {
  stageGpkg(shp, 'cnuc.carga_unidade', 'cd_cnuc,nome_uc,esfera,categoria,grupo,org_gestor,cria_ano,cria_ato,ha_total,uf', [
    '-spat',
    ...[caixa.oeste, caixa.sul, caixa.leste, caixa.norte].map(String),
  ]);
}

export function loadUnidades(db: pg.ClientBase, arquivo: number): Promise<number> {
  return loadOnce(db, arquivo, 'cnuc.unidade', async () => {
    const r = await db.query(
      `INSERT INTO cnuc.unidade (cd_cnuc, nome, esfera, categoria, grupo, orgao_gestor, ano_criacao, ato, area_ha, uf, geom, arquivo)
       SELECT cd_cnuc, trim(nome_uc), esfera, categoria, grupo, org_gestor, substring(cria_ano FROM '(\\d{4})$')::int, cria_ato,
              nullif(ha_total, '')::float8, uf, ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)), $1
       FROM cnuc.carga_unidade
       ON CONFLICT (cd_cnuc) DO UPDATE SET nome = excluded.nome, esfera = excluded.esfera, categoria = excluded.categoria,
         grupo = excluded.grupo, orgao_gestor = excluded.orgao_gestor, ano_criacao = excluded.ano_criacao, ato = excluded.ato,
         area_ha = excluded.area_ha, uf = excluded.uf, geom = excluded.geom, arquivo = excluded.arquivo`,
      [arquivo],
    );
    await db.query('DROP TABLE cnuc.carga_unidade');
    return r.rowCount ?? 0;
  });
}

/** INPE fire spots since `desde` (Manaus day): how many fell in an indigenous land, in a conservation unit, and per agency. */
export async function focosEmAreasProtegidas(db: pg.ClientBase, desde: string) {
  const r = await db.query(
    `WITH f AS (
       SELECT f.id,
              EXISTS (SELECT 1 FROM funai.terra_indigena t WHERE ST_Intersects(t.geom, f.geom)) AS em_ti,
              (SELECT array_agg(DISTINCT u.orgao_gestor || ' (' || u.esfera || ')') FROM cnuc.unidade u WHERE ST_Intersects(u.geom, f.geom)) AS ucs
       FROM inpe.foco f WHERE (f.data_hora AT TIME ZONE 'America/Manaus')::date >= $1::date)
     SELECT (SELECT count(*)::int FROM f) AS total,
            (SELECT count(*)::int FROM f WHERE em_ti) AS em_ti,
            (SELECT count(*)::int FROM f WHERE ucs IS NOT NULL) AS em_uc,
            (SELECT count(*)::int FROM f WHERE em_ti OR ucs IS NOT NULL) AS em_alguma,
            (SELECT coalesce(json_agg(json_build_object('orgao', orgao, 'focos', n) ORDER BY n DESC, orgao), '[]') FROM (
               SELECT orgao, count(*)::int AS n FROM (
                 SELECT 'FUNAI (terra indígena)' AS orgao FROM f WHERE em_ti
                 UNION ALL SELECT unnest(ucs) FROM f WHERE ucs IS NOT NULL) o GROUP BY orgao) x) AS por_orgao`,
    [desde],
  );
  return r.rows[0];
}
