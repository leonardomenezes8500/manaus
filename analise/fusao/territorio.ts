// Fusion of municipalities and bairros (#32): layer-2 records → entidade.* (layer 3), plus the divergence report.
// Layer 2 is only read. Each run rebuilds the links and values of the type, keeping entity ids by chave.
import type pg from 'pg';
import { casar, type Grupo, type Registro } from './casar.ts';

type Fonte = { fonte: string; tabela: string; sql: string }; // sql returns id, nome, geom, data_fonte

const MANAUS = 1302603;
const FONTES: Record<'municipio' | 'bairro', Fonte[]> = {
  municipio: [
    { fonte: 'ibge', tabela: 'ibge.municipio', sql: `SELECT codigo::text AS id, nome, geom, NULL::date AS data_fonte FROM ibge.municipio` },
    {
      fonte: 'osm',
      tabela: 'osm.poligono',
      sql: `SELECT id, name AS nome, geom, snapshot AS data_fonte FROM osm.poligono
            WHERE boundary = 'administrative' AND admin_level = '8' AND name IS NOT NULL`,
    },
  ],
  // implurb (official Prefeitura layer) comes first in the rule when it exists (#24: site down on 2026-10-21).
  bairro: [
    {
      fonte: 'ibge',
      tabela: 'ibge.bairro',
      sql: `SELECT codigo AS id, nome, geom, DATE '2022-07-31' AS data_fonte FROM ibge.bairro WHERE municipio = ${MANAUS}`,
    },
    {
      fonte: 'osm',
      tabela: 'osm.poligono',
      sql: `SELECT p.id, p.name AS nome, p.geom, p.snapshot AS data_fonte FROM osm.poligono p, ibge.municipio m
            WHERE m.codigo = ${MANAUS} AND p.boundary = 'administrative' AND p.admin_level = '10' AND p.name IS NOT NULL
              AND ST_Intersects(p.geom, m.geom) AND NOT ST_Touches(p.geom, m.geom)`,
    },
  ],
};

async function fundir(db: pg.ClientBase, tipo: 'municipio' | 'bairro', chaveDe: (g: Grupo) => string): Promise<number> {
  const fontes = FONTES[tipo];
  const prioridade = (await db.query('SELECT fontes FROM entidade.prioridade WHERE tipo = $1 AND campo = $2', [tipo, 'geom'])).rows[0]
    .fontes;
  await db.query('BEGIN');
  try {
    await db.query('CREATE TEMP TABLE reg (fonte text, tabela text, id text, nome text, geom geometry, data_fonte date) ON COMMIT DROP');
    for (const f of fontes)
      await db.query(`INSERT INTO reg SELECT $1, $2, id, nome, ST_MakeValid(geom), data_fonte FROM (${f.sql}) s`, [f.fonte, f.tabela]);
    const registros: (Registro & { tabela: string })[] = (await db.query('SELECT fonte, tabela, id, nome FROM reg ORDER BY fonte, id'))
      .rows;
    // IoU of every pair of records of different sources that touch, keyed in priority order.
    const pares = await db.query(
      `SELECT a.fonte || ':' || a.id || '|' || b.fonte || ':' || b.id AS k,
              ST_Area(ST_Intersection(a.geom, b.geom)) / NULLIF(ST_Area(ST_Union(a.geom, b.geom)), 0) AS iou
       FROM reg a JOIN reg b ON array_position($1::text[], a.fonte) < array_position($1::text[], b.fonte) AND ST_Intersects(a.geom, b.geom)`,
      [prioridade],
    );
    const grupos = casar(registros, prioridade, new Map(pares.rows.map((r) => [r.k, Number(r.iou)])));
    const tabela = new Map(registros.map((r) => [`${r.fonte}:${r.id}`, r.tabela]));

    await db.query(`DELETE FROM entidade.vinculo v USING entidade.entidade e WHERE e.id = v.entidade_id AND e.tipo = $1`, [tipo]);
    await db.query(`DELETE FROM entidade.valor v USING entidade.entidade e WHERE e.id = v.entidade_id AND e.tipo = $1`, [tipo]);
    for (const g of grupos) {
      const id = (
        await db.query(
          `INSERT INTO entidade.entidade (tipo, chave) VALUES ($1, $2) ON CONFLICT (tipo, chave) DO UPDATE SET tipo = excluded.tipo RETURNING id`,
          [tipo, chaveDe(g)],
        )
      ).rows[0].id;
      for (const m of g.membros) {
        const t = tabela.get(`${m.fonte}:${m.id}`);
        await db.query(`INSERT INTO entidade.vinculo VALUES ($1, $2, $3, $4, $5, $6)`, [id, m.fonte, t, m.id, m.metodo, m.confianca]);
        await db.query(
          `INSERT INTO entidade.valor (entidade_id, campo, valor, geom, fonte, data_fonte, registro_id)
           SELECT $1, c.campo, c.valor, c.geom, r.fonte, r.data_fonte, r.id FROM reg r,
             LATERAL (VALUES ('nome', to_jsonb(r.nome), NULL::geometry),
                             ('area_km2', to_jsonb(round((ST_Area(r.geom::geography) / 1e6)::numeric, 3)), NULL),
                             ('geom', NULL, r.geom)) AS c(campo, valor, geom)
           WHERE r.fonte = $2 AND r.id = $3`,
          [id, m.fonte, m.id],
        );
      }
    }
    // Entities left without any record (a source dropped it) go away; their history is in the raw files.
    await db.query(
      `DELETE FROM entidade.entidade e WHERE e.tipo = $1 AND NOT EXISTS (SELECT 1 FROM entidade.vinculo v WHERE v.entidade_id = e.id)`,
      [tipo],
    );
    await db.query('COMMIT');
    return grupos.length;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

/** One entity per IBGE code; OSM municipal boundaries (admin_level=8) join by name and overlap. */
export const fundirMunicipios = (db: pg.ClientBase) =>
  fundir(db, 'municipio', (g) => g.membros.find((m) => m.fonte === 'ibge')?.id ?? `osm:${g.chave}`);

/** Bairros of Manaus from every source; chave = normalised name of the anchor record. */
export const fundirBairros = (db: pg.ClientBase) => fundir(db, 'bairro', (g) => g.chave);

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/** Markdown report of the bairros: count per source, different names, areas off by more than 10%, single-source ones. */
export async function divergencias(db: pg.ClientBase, agora = new Date()): Promise<string> {
  const q = async (sql: string) => (await db.query(sql)).rows;
  const base = `FROM entidade.entidade e JOIN entidade.valor v ON v.entidade_id = e.id WHERE e.tipo = 'bairro'`;
  const porFonte = await q(`SELECT v.fonte, count(DISTINCT e.id)::int AS n ${base} AND v.campo = 'nome' GROUP BY 1 ORDER BY 1`);
  const nomes = await q(`SELECT e.chave, string_agg(v.valor #>> '{}' || ' (' || v.fonte || ')', ' / ' ORDER BY v.fonte) AS nomes
    ${base} AND v.campo = 'nome' GROUP BY e.chave HAVING count(DISTINCT v.valor) > 1 ORDER BY 1`);
  const areas =
    await q(`SELECT e.chave, array_agg(v.fonte ORDER BY v.fonte) AS fontes, array_agg((v.valor #>> '{}')::float8 ORDER BY v.fonte) AS km2
    ${base} AND v.campo = 'area_km2' GROUP BY e.chave HAVING count(*) > 1
    AND (max((v.valor #>> '{}')::float8) - min((v.valor #>> '{}')::float8)) > 0.1 * max((v.valor #>> '{}')::float8) ORDER BY 1`);
  const sozinhos = await q(
    `SELECT e.chave, min(v.fonte) AS fonte ${base} AND v.campo = 'nome' GROUP BY e.chave HAVING count(*) = 1 ORDER BY 1`,
  );
  const linhas = [
    '# Divergências entre fontes: bairros de Manaus',
    '',
    `Gerado por analise/fusao/fundir.ts em ${agora.toISOString().slice(0, 16)}Z a partir de entidade.* (camada 3). Regra de prioridade: entidade.prioridade.`,
    '',
    '## Bairros por fonte',
    '| fonte | bairros |',
    '|---|---|',
    ...porFonte.map((r) => `| ${r.fonte} | ${r.n} |`),
    '',
    `## Nomes diferentes (${nomes.length})`,
    '| bairro | nomes |',
    '|---|---|',
    ...nomes.map((r) => `| ${r.chave} | ${r.nomes} |`),
    '',
    `## Área diferente em mais de 10% (${areas.length})`,
    '| bairro | áreas | diferença |',
    '|---|---|---|',
    ...areas.map((r) => {
      const km2: number[] = r.km2;
      const dif = Math.round((100 * (Math.max(...km2) - Math.min(...km2))) / Math.max(...km2));
      return `| ${r.chave} | ${r.fontes.map((f: string, i: number) => `${f} ${fmt(km2[i])} km²`).join(' / ')} | ${dif} % |`;
    }),
    '',
    `## Só numa fonte (${sozinhos.length})`,
    '| bairro | fonte |',
    '|---|---|',
    ...sozinhos.map((r) => `| ${r.chave} | ${r.fonte} |`),
  ];
  return linhas.join('\n') + '\n';
}
