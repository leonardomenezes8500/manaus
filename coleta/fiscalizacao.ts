// Embargoes and infraction notices (#81): IBAMA (national CSVs: embargo terms, and the notices in one zip with a CSV
// per year) cut here to the states that touch the box, the cut gzipped into the raw files; ICMBio (two small
// shapefile zips) into the raw files as they come. Then ibama.embargo, ibama.auto_infracao, icmbio.embargo and
// icmbio.auto_infracao. By hand on this PC, once a sprint while M4 lasts (needs duckdb, ogr2ogr, unzip and curl):
//   node coleta/fiscalizacao.ts
// Personal data: see db/migracoes/036_fiscalizacao.sql. Nothing with a name or CPF goes to an issue, commit or report.
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { loadOnce, registrar, stageGpkg } from './carga/lib.ts';
import { guardar } from './lib/baixar.ts';

const IBAMA = 'https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados';
const URL_EMBARGO = `${IBAMA}/TERMOS_DE_EMBARGO/TERMO_EMBARGO/termo_de_embargo.csv`;
const URL_AUTOS = `${IBAMA}/SIFISC/auto_infracao/auto_infracao/auto_infracao_csv.zip`;
const ICMBIO =
  'https://www.gov.br/icmbio/pt-br/dados-icmbio/dados_geoespaciais/mapa-tematico-e-dados-geoestatisticos-das-unidades-de-conservacao-federais';
export const ESTADOS = ['AM', 'AC', 'RO', 'RR', 'PA', 'MT', 'AP'];

const CAMPOS = {
  embargo:
    'SEQ_TAD,SIT_CANCELADO,NUM_TAD,SER_TAD,DAT_EMBARGO,NOME_EMBARGADO,CPF_CNPJ_EMBARGADO,NUM_PROCESSO,COD_MUNICIPIO,UF,NUM_LONGITUDE_TAD,' +
    'NUM_LATITUDE_TAD,DETER_PRODES,QTD_AREA_EMBARGADA,NOME_IMOVEL,TIPO_AREA,GEOM_AREA_EMBARGADA,SIT_DESEMBARGO,TIPO_DESEMBARGO,' +
    'DAT_DESEMBARGO,NUM_AUTO_INFRACAO,OPERACAO,DES_TAD',
  auto:
    'SEQ_AUTO_INFRACAO,SIT_CANCELADO,NUM_AUTO_INFRACAO,SER_AUTO_INFRACAO,TIPO_AUTO,VAL_AUTO_INFRACAO,DAT_HORA_AUTO_INFRACAO,' +
    'DT_FATO_INFRACIONAL,DS_UNID_CONCILIACAO,COD_MUNICIPIO,UF,TIPO_INFRACAO,DES_INFRACAO,TP_PESSOA_INFRATOR,NOME_INFRATOR,' +
    'CPF_CNPJ_INFRATOR,QT_AREA,NUM_LONGITUDE_AUTO,NUM_LATITUDE_AUTO,WKT_GE_AREA_AUTUADA,UNIDADE_CONSERVACAO,OPERACAO,CD_TERMOS_EMBARGOS',
  icmbioEmbargo: 'numero_emb,serie,numero_ai,cpf_cnpj,autuado,tipo_infra,nome_uc,cnuc,municipio,uf,data,julgamento,area,processo',
  icmbioAuto: 'numero_ai,serie,tipo,valor_mult,embargo,autuado,cpf_cnpj,data,tipo_infra,nome_uc,cnuc,municipio,uf,julgamento,processo',
};

const pessoa = (c: string) => `CASE length(regexp_replace(coalesce(${c}, ''), '\\D', '', 'g')) WHEN 11 THEN 'PF' WHEN 14 THEN 'PJ' END`;
const inteiro = (c: string) => `CASE WHEN trim(${c}) ~ '^\\d+$' THEN trim(${c})::bigint END`;
const estados = `(${ESTADOS.map((u) => `'${u}'`).join(', ')})`;

export type Arquivos = { embargoIbama: number; autoIbama: number; embargoIcmbio: number; autoIcmbio: number };

/** The staging tables (what ogr2ogr leaves) → the four tables, replacing what was there. */
export async function loadFiscalizacao(db: pg.ClientBase, a: Arquivos): Promise<Record<string, number>> {
  const passos: [string, number, string, string][] = [
    [
      'ibama.embargo',
      a.embargoIbama,
      'ibama.carga_embargo',
      `INSERT INTO ibama.embargo (seq, numero, serie, data, cancelado, embargado, cpf_cnpj, pessoa, processo, municipio, uf, deter_prodes,
         area_ha, imovel, tipo_area, desembargo, tipo_desembargo, data_desembargo, auto, operacao, descricao, poligono, ponto, arquivo)
       SELECT ${inteiro('seq_tad')}, num_tad, nullif(ser_tad, ''), ibama.data_valida(dat_embargo), sit_cancelado = 'S', nome_embargado,
         cpf_cnpj_embargado, ${pessoa('cpf_cnpj_embargado')}, num_processo, ${inteiro('cod_municipio')}, uf, nullif(deter_prodes, ''),
         ibama.num_br(qtd_area_embargada), nullif(nome_imovel, ''), nullif(tipo_area, ''), nullif(sit_desembargo, ''),
         nullif(tipo_desembargo, ''), ibama.data_valida(dat_desembargo), nullif(num_auto_infracao, ''), nullif(operacao, ''),
         nullif(des_tad, ''), ibama.poligono(geom_area_embargada), ibama.ponto(num_longitude_tad, num_latitude_tad), $1
       FROM ibama.carga_embargo WHERE uf IN ${estados}`,
    ],
    [
      'ibama.auto_infracao',
      a.autoIbama,
      'ibama.carga_auto',
      `INSERT INTO ibama.auto_infracao (seq, numero, serie, cancelado, tipo_auto, valor, data, data_fato, conciliacao, municipio, uf,
         tipo_infracao, descricao, pessoa, infrator, cpf_cnpj, area_ha, uc, operacao, embargos, area, ponto, arquivo)
       SELECT ${inteiro('seq_auto_infracao')}, num_auto_infracao, nullif(ser_auto_infracao, ''), sit_cancelado = 'S', tipo_auto,
         ibama.num_br(val_auto_infracao), ibama.data_valida(dat_hora_auto_infracao), ibama.data_valida(dt_fato_infracional),
         nullif(ds_unid_conciliacao, ''), ${inteiro('cod_municipio')}, uf, nullif(tipo_infracao, ''), des_infracao,
         nullif(tp_pessoa_infrator, ''), nome_infrator, cpf_cnpj_infrator, ibama.num_br(qt_area), nullif(unidade_conservacao, ''),
         nullif(operacao, ''), nullif(cd_termos_embargos, ''), ibama.poligono(wkt_ge_area_autuada),
         ibama.ponto(num_longitude_auto, num_latitude_auto), $1
       FROM ibama.carga_auto WHERE uf IN ${estados}`,
    ],
    [
      'icmbio.embargo',
      a.embargoIcmbio,
      'icmbio.carga_embargo',
      `INSERT INTO icmbio.embargo (numero, serie, auto, cpf_cnpj, autuado, pessoa, tipo_infracao, uc, cnuc, municipio, uf, data, julgamento,
         area_ha, processo, geom, arquivo)
       SELECT numero_emb, serie, numero_ai, cpf_cnpj, autuado, ${pessoa('cpf_cnpj')}, tipo_infra, nome_uc, cnuc, municipio, uf,
         ibama.data_valida(data::text), julgamento, ibama.num_br(area), processo, g, $1
       FROM (SELECT *, ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)) AS g FROM icmbio.carga_embargo) c
       WHERE uf IN ${estados} AND g IS NOT NULL AND NOT ST_IsEmpty(g)`,
    ],
    [
      'icmbio.auto_infracao',
      a.autoIcmbio,
      'icmbio.carga_auto',
      `INSERT INTO icmbio.auto_infracao (numero, serie, tipo, valor, embargo, autuado, cpf_cnpj, pessoa, data, tipo_infracao, uc, cnuc,
         municipio, uf, julgamento, processo, geom, arquivo)
       SELECT numero_ai, serie, tipo, valor_mult, embargo, autuado, cpf_cnpj, ${pessoa('cpf_cnpj')}, ibama.data_valida(data::text),
         tipo_infra, nome_uc, cnuc, municipio, uf, julgamento, processo, ST_GeometryN(geom, 1), $1
       FROM icmbio.carga_auto WHERE uf IN ${estados}`,
    ],
  ];
  const n: Record<string, number> = {};
  for (const [tabela, arquivo, carga, sql] of passos)
    n[tabela] = await loadOnce(db, arquivo, tabela, async () => {
      await db.query(`DELETE FROM ${tabela}`);
      const r = await db.query(sql, [arquivo]);
      await db.query(`DROP TABLE ${carga}`);
      return r.rowCount ?? 0;
    });
  return n;
}

const baixar = (url: string, saida: string) =>
  execFileSync('curl', ['-sS', '--fail', '--retry', '5', '-o', saida, url], { stdio: 'inherit' });

/** One national CSV (or a folder of them) → the rows of the states, gzipped, every column as it comes. duckdb reads the quoted multi-line WKT. */
function cortar(fontes: string, saida: string, tmp: string) {
  execFileSync(
    'duckdb',
    [
      '-c',
      `SET memory_limit = '1500MB'; SET threads = 2; SET temp_directory = '${join(tmp, 'duckdb.tmp')}';
       COPY (SELECT * FROM read_csv('${fontes}', delim = ';', quote = '"', header = true, all_varchar = true, union_by_name = true)
             WHERE UF IN ${estados}) TO '${saida}' (HEADER, COMPRESSION gzip);`,
    ],
    { stdio: 'inherit' },
  );
}

/** A CSV (all text) → staging table, only the columns the load reads. */
const stageCsv = (csv: string, tabela: string, campos: string) =>
  execFileSync(
    'ogr2ogr',
    ['-f', 'PostgreSQL', 'PG:', `/vsigzip/${csv}`, '-nln', tabela, '-overwrite', '-oo', 'AUTODETECT_TYPE=NO', '-select', campos],
    { stdio: 'inherit' },
  );

async function principal() {
  const tmp = await mkdtemp(join(process.env.MANAUS_BUFFER || tmpdir(), 'fiscalizacao-'));
  const db = new pg.Client();
  await db.connect();
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const [embargo, autosZip, autos] = [join(tmp, 'embargo.csv'), join(tmp, 'autos.zip'), join(tmp, 'autos')];
    baixar(URL_EMBARGO, embargo);
    baixar(URL_AUTOS, autosZip);
    execFileSync('unzip', ['-qo', autosZip, '-d', autos]);
    const cortes = { embargo: join(tmp, `termo_de_embargo_regiao_${hoje}.csv.gz`), auto: join(tmp, `auto_infracao_regiao_${hoje}.csv.gz`) };
    cortar(embargo, cortes.embargo, tmp);
    cortar(join(autos, '*.csv'), cortes.auto, tmp);
    const zips = { embargo: join(tmp, 'embargos_icmbio_shp.zip'), auto: join(tmp, 'autos_infracao_icmbio_shp.zip') };
    baixar(`${ICMBIO}/embargos_icmbio_shp.zip`, zips.embargo);
    baixar(`${ICMBIO}/autos_infracao_icmbio_shp.zip`, zips.auto);

    const g = async (caminho: string, fonte: string, nome: string, origem: string) =>
      registrar(db, await guardar(caminho, { fonte, coletor: 'fiscalizacao', nome, origem }));
    const a: Arquivos = {
      embargoIbama: await g(cortes.embargo, 'ibama-embargos', `termo_de_embargo_regiao_${hoje}.csv.gz`, URL_EMBARGO),
      autoIbama: await g(cortes.auto, 'ibama-autos', `auto_infracao_regiao_${hoje}.csv.gz`, URL_AUTOS),
      embargoIcmbio: await g(zips.embargo, 'icmbio-fiscalizacao', `embargos_icmbio_shp_${hoje}.zip`, `${ICMBIO}/embargos_icmbio_shp.zip`),
      autoIcmbio: await g(
        zips.auto,
        'icmbio-fiscalizacao',
        `autos_infracao_icmbio_shp_${hoje}.zip`,
        `${ICMBIO}/autos_infracao_icmbio_shp.zip`,
      ),
    };
    stageCsv(cortes.embargo, 'ibama.carga_embargo', CAMPOS.embargo);
    stageCsv(cortes.auto, 'ibama.carga_auto', CAMPOS.auto);
    stageGpkg(`/vsizip/${zips.embargo}/embargos_icmbio.shp`, 'icmbio.carga_embargo', CAMPOS.icmbioEmbargo, ['-makevalid']);
    stageGpkg(`/vsizip/${zips.auto}/autos_infracao_icmbio.shp`, 'icmbio.carga_auto', CAMPOS.icmbioAuto);
    // What the load turns into null (impossible dates, unreadable WKT) or leaves out (an ICMBio embargo with no polygon).
    const { rows: perdas } = await db.query(
      `SELECT (SELECT count(*) FILTER (WHERE dat_embargo <> '' AND ibama.data_valida(dat_embargo) IS NULL) FROM ibama.carga_embargo
                WHERE uf IN ${estados})::int AS embargo_data,
              (SELECT count(*) FILTER (WHERE geom_area_embargada <> '' AND ibama.poligono(geom_area_embargada) IS NULL) FROM ibama.carga_embargo
                WHERE uf IN ${estados})::int AS embargo_wkt,
              (SELECT count(*) FILTER (WHERE dat_hora_auto_infracao <> '' AND ibama.data_valida(dat_hora_auto_infracao) IS NULL)
                 FROM ibama.carga_auto WHERE uf IN ${estados})::int AS auto_data,
              (SELECT count(*) FILTER (WHERE geom IS NULL OR ST_IsEmpty(ST_CollectionExtract(ST_MakeValid(geom), 3)))
                 FROM icmbio.carga_embargo WHERE uf IN ${estados})::int AS icmbio_embargo_sem_poligono`,
    );
    console.log('vira nulo:', perdas[0]);
    console.log(await loadFiscalizacao(db, a));
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
