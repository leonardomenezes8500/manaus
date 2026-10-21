// Carga de ibge.municipio (#8) a partir das malhas do IBGE (GeoJSON, propriedade codarea) e dos nomes (API de localidades).
import type pg from 'pg';

type Feicao = { properties: { codarea: string }; geometry: object };
export type Malha = { arquivo: number; uf: string; geojson: { features: Feicao[] } };

/**
 * Insere ou atualiza os municípios das malhas, na ordem dada (a última vence: Manaus em resolução máxima vai no fim).
 * Geometria corrigida com ST_MakeValid, porque a malha simplificada do IBGE pode ter auto-interseção.
 */
export async function carregarMunicipios(db: pg.ClientBase, malhas: Malha[], nomes: Map<number, string>): Promise<number> {
  let n = 0;
  await db.query('BEGIN');
  try {
    for (const m of malhas) {
      for (const f of m.geojson.features) {
        const codigo = Number(f.properties.codarea);
        const nome = nomes.get(codigo);
        if (!nome) throw new Error(`município ${codigo} sem nome na lista do IBGE`);
        await db.query(
          `INSERT INTO ibge.municipio (codigo, nome, uf, geom, arquivo)
           VALUES ($1, $2, $3, ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)), 3)), $5)
           ON CONFLICT (codigo) DO UPDATE SET nome = excluded.nome, uf = excluded.uf, geom = excluded.geom, arquivo = excluded.arquivo`,
          [codigo, nome, m.uf, JSON.stringify(f.geometry), m.arquivo],
        );
        n++;
      }
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
  return n;
}
