// INCRA land (#80): SIGEF parcels, SNCI certificates and settlements of AM, AC, RO and PA (the CAR states, #83), the
// polygons that touch the layers box, without Z and M, as one gzipped GeoPackage (3 layers) in the raw files (the 12
// per-state zips do not go to R2: they are redone daily at a fixed url). Then incra.sigef, incra.snci, incra.assentamento.
// One-off job on this PC, once a year or when a hypothesis asks (needs ogr2ogr, gzip and curl):
//   node coleta/incra.ts
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { loadOnce, registrar, stageGpkg } from './carga/lib.ts';
import { guardar } from './lib/baixar.ts';
import { BBOX as B } from './regiao.ts';

const BASE = 'https://certificacao.incra.gov.br/csv_shp/zip';
export const ESTADOS = ['AM', 'AC', 'RO', 'PA'] as const;
const UF_IBGE: Record<number, string> = { 11: 'RO', 12: 'AC', 13: 'AM', 15: 'PA' };
const CAMADAS = {
  sigef: {
    zip: 'Sigef Brasil',
    campos: 'parcela_co,situacao_i,codigo_imo,data_submi,data_aprov,status,nome_area,registro_m,registro_d,municipio_,uf_id',
  },
  snci: { zip: 'Imóvel certificado SNCI Brasil', campos: 'num_proces,num_certif,data_certi,qtd_area_p,cod_imovel,nome_imove,uf_municip' },
  assentamento: {
    zip: 'Assentamento Brasil',
    campos: 'cd_sipra,uf,nome_proje,municipio,area_hecta,capacidade,num_famili,fase,data_de_cr,forma_obte,data_obten',
  },
} as const;
type Camada = keyof typeof CAMADAS;

const numero = (c: string) => `CASE WHEN trim(${c}) ~ '^-?\\d+(\\.\\d+)?$' THEN trim(${c})::float8 END`;

/** incra.carga_* (what ogr2ogr leaves) → the three tables, replacing what was there. */
export async function loadIncra(db: pg.ClientBase, arquivo: number): Promise<Record<string, number>> {
  const n: Record<string, number> = {};
  const ufs = Object.entries(UF_IBGE)
    .map(([k, v]) => `WHEN ${k} THEN '${v}'`)
    .join(' ');
  const sql: Record<Camada, string> = {
    sigef: `INSERT INTO incra.sigef (parcela, situacao, status, codigo_imovel, nome_area, matricula, data_submissao, data_aprovacao,
              data_registro, municipio, uf, geom, arquivo)
            SELECT parcela_co, situacao_i, status, codigo_imo, nome_area, registro_m, data_submi, data_aprov, registro_d, municipio_,
              CASE uf_id ${ufs} END, ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)), $1 FROM incra.carga_sigef`,
    snci: `INSERT INTO incra.snci (processo, certificado, data_certificacao, area_ha, codigo_imovel, nome, uf, geom, arquivo)
           SELECT num_proces, num_certif, data_certi, ${numero('qtd_area_p')}, cod_imovel, nome_imove, uf_municip,
             ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)), $1 FROM incra.carga_snci`,
    assentamento: `INSERT INTO incra.assentamento (codigo, nome, municipio, uf, area_ha, capacidade, familias, fase, data_criacao,
                     forma_obtencao, data_obtencao, geom, arquivo)
                   SELECT cd_sipra, nome_proje, municipio, uf, ${numero('area_hecta')}, capacidade, num_famili, fase,
                     incra.data_br(data_de_cr), forma_obte, incra.data_br(data_obten),
                     ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)), $1 FROM incra.carga_assentamento`,
  };
  for (const c of Object.keys(CAMADAS) as Camada[])
    n[`incra.${c}`] = await loadOnce(db, arquivo, `incra.${c}`, async () => {
      await db.query(`DELETE FROM incra.${c}`);
      const r = await db.query(sql[c], [arquivo]);
      await db.query(`DROP TABLE incra.carga_${c}`);
      return r.rowCount ?? 0;
    });
  return n;
}

async function principal() {
  const tmp = await mkdtemp(join(process.env.MANAUS_BUFFER || tmpdir(), 'incra-'));
  const db = new pg.Client();
  await db.connect();
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const gpkg = join(tmp, `incra_regiao_${hoje}.gpkg`);
    for (const c of Object.keys(CAMADAS) as Camada[])
      for (const uf of ESTADOS) {
        const nome = `${CAMADAS[c].zip}_${uf}`;
        const zip = join(tmp, `${c}_${uf}.zip`);
        execFileSync('curl', ['-sS', '--fail', '--retry', '5', '-o', zip, `${BASE}/${encodeURIComponent(nome)}.zip`], { stdio: 'inherit' });
        const antes = Number(
          execFileSync('ogrinfo', ['-ro', '-so', '-al', `/vsizip/${zip}/${nome}.shp`])
            .toString()
            .match(/Feature Count: (\d+)/)![1],
        );
        execFileSync(
          'ogr2ogr',
          ['-f', 'GPKG', '-append', gpkg, `/vsizip/${zip}/${nome}.shp`, '-spat', ...[B.oeste, B.sul, B.leste, B.norte].map(String)].concat([
            '-dim',
            'XY',
            '-t_srs',
            'EPSG:4326',
            '-nlt',
            'PROMOTE_TO_MULTI',
            '-nln',
            c,
          ]),
          { stdio: 'inherit' },
        );
        console.log(`${c} ${uf}: ${antes} no shapefile`);
        await rm(zip);
      }
    execFileSync('gzip', ['-k', gpkg]);
    const b = await guardar(`${gpkg}.gz`, { fonte: 'incra-sigef', coletor: 'incra', nome: `incra_regiao_${hoje}.gpkg.gz`, origem: BASE });
    for (const c of Object.keys(CAMADAS) as Camada[]) stageGpkg(gpkg, `incra.carga_${c}`, CAMADAS[c].campos, [c]);
    console.log(await loadIncra(db, await registrar(db, b)));
    const { rows } = await db.query(
      `SELECT 'sigef' AS camada, uf, count(*)::int FROM incra.sigef GROUP BY 2 UNION ALL SELECT 'snci', uf, count(*) FROM incra.snci GROUP BY 2
       UNION ALL SELECT 'assentamento', uf, count(*) FROM incra.assentamento GROUP BY 2 ORDER BY 1, 2`,
    );
    console.table(rows);
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
