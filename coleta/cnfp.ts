// Public forests (#75): the CNFP 2025 of the Serviço Florestal Brasileiro, the polygons that touch the smoke region,
// without Z and M, as a gzipped FlatGeobuf in the raw files (guardar(); the 229 MB national zip does not go to R2:
// its url is fixed per edition). Then sfb.floresta_publica and the check against the FUNAI and CNUC areas (#30).
// One-off job on this PC, once a year (needs ogr2ogr, gzip and curl):
//   node coleta/cnfp.ts [CNFP_2025.zip already downloaded]
import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { loadOnce, registrar, stageGpkg } from './carga/lib.ts';
import { guardar } from './lib/baixar.ts';
import { BBOX as B } from './regiao.ts';

const URL = 'https://mapas.florestal.gov.br/portal/sharing/rest/content/items/2b752dfbf9254920bf8990ce363918af/data'; // CNFP_2025.zip
const CAMPOS = 'nome,categoria,protecao,tipo,governo,classe,orgao,sobreposic,anocriacao,estagio,uf,municipio,area_ha';

/** sfb.carga_cnfp (what ogr2ogr leaves) → sfb.floresta_publica. */
export function loadCnfp(db: pg.ClientBase, arquivo: number): Promise<number> {
  return loadOnce(db, arquivo, 'sfb.floresta_publica', async () => {
    await db.query('DELETE FROM sfb.floresta_publica');
    const r = await db.query(
      `INSERT INTO sfb.floresta_publica (nome, categoria, protecao, tipo, governo, classe, orgao, sobreposicao, ano_criacao,
         estagio, uf, municipio, area_ha, geom, arquivo)
       SELECT nome, categoria, protecao, right(trim(tipo), 1), governo, classe, orgao,
              CASE upper(sobreposic) WHEN 'SIM' THEN true WHEN 'NÃO' THEN false END,
              substring(anocriacao FROM '\\d{4}')::smallint, estagio, uf, municipio, area_ha,
              ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)), $1
       FROM sfb.carga_cnfp`,
      [arquivo],
    );
    await db.query('DROP TABLE sfb.carga_cnfp');
    return r.rowCount ?? 0;
  });
}

/**
 * FUNAI TIs and CNUC UCs against the CNFP: an area "has a match" when CNFP polygons of the same kind cover half of it
 * (TI: a categoria with TI in it; UC: any tipo A). And the CNFP TI pieces that no FUNAI TI covers by half.
 */
export async function conferirTisUcs(db: pg.ClientBase) {
  const cobre = (alvo: string, filtro: string) =>
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE fatia >= 0.5)::int AS com_par FROM (
       SELECT a.geom, coalesce((SELECT sum(ST_Area(ST_Intersection(a.geom, c.geom))) FROM sfb.floresta_publica c
                                WHERE ${filtro} AND ST_Intersects(a.geom, c.geom)), 0) / nullif(ST_Area(a.geom), 0) AS fatia
       FROM ${alvo} a) x`;
  const ti = `c.categoria ~ '(^|/ )TI( /|$)'`;
  const tis = await db.query(cobre('funai.terra_indigena', ti));
  const ucs = await db.query(cobre('cnuc.unidade', `c.tipo = 'A'`));
  const cnfpTis = await db.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE fatia >= 0.5)::int AS com_par FROM (
       SELECT coalesce((SELECT sum(ST_Area(ST_Intersection(c.geom, t.geom))) FROM funai.terra_indigena t
                        WHERE ST_Intersects(c.geom, t.geom)), 0) / nullif(ST_Area(c.geom), 0) AS fatia
       FROM sfb.floresta_publica c WHERE ${ti}) x`,
  );
  return { funai_tis: tis.rows[0], cnuc_ucs: ucs.rows[0], cnfp_pecas_ti: cnfpTis.rows[0] };
}

async function principal() {
  const tmp = join(process.env.MANAUS_BUFFER || join(tmpdir(), 'manaus-buffer'), 'tmp', `cnfp-${process.pid}`);
  await mkdir(tmp, { recursive: true });
  const db = new pg.Client();
  await db.connect();
  try {
    let zip = process.argv[2];
    if (!zip) {
      zip = join(tmp, 'CNFP_2025.zip');
      execFileSync('curl', ['-sS', '--fail', '--retry', '5', '-o', zip, URL], { stdio: 'inherit' });
    }
    const fgb = join(tmp, 'cnfp_2025_regiao.fgb');
    execFileSync(
      'ogr2ogr',
      ['-f', 'FlatGeobuf', fgb, `/vsizip/${zip}/CNFP_2025.shp`, '-spat', ...[B.oeste, B.sul, B.leste, B.norte].map(String)].concat([
        '-dim',
        'XY',
        '-t_srs',
        'EPSG:4326',
        '-nlt',
        'PROMOTE_TO_MULTI',
        '-nln',
        'cnfp',
      ]),
      { stdio: 'inherit' },
    );
    execFileSync('gzip', ['-k', fgb]);
    const b = await guardar(`${fgb}.gz`, { fonte: 'sfb-cnfp', coletor: 'cnfp', nome: 'cnfp_2025_regiao.fgb.gz', origem: URL });
    stageGpkg(fgb, 'sfb.carga_cnfp', CAMPOS);
    console.log('sfb.floresta_publica:', await loadCnfp(db, await registrar(db, b)));
    console.log(JSON.stringify(await conferirTisUcs(db), null, 2));
  } finally {
    await db.end();
    await rm(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
