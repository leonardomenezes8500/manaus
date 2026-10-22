// Detailed population (#63), one-off on this PC (needs unzip and ogr2ogr):
//   node coleta/ibge-populacao.ts
// Census 2022 aggregates per tract (demography, race, literacy; Brazil zips, AM rows, only the variables the views use),
// their dictionary with the group of each variable, and the yearly series: SIDRA estimates (6579) and censuses
// (202, 4709) of Manaus, plus the IBGE projection of the AM by age and sex. Everything through baixar().
import { execFileSync } from 'node:child_process';
import { createWriteStream, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { splitCsv } from './carga/csv.ts';
import { registrar } from './carga/lib.ts';
import { linhasProjecao, linhasSidra, type LinhaPop } from './carga/populacao.ts';
import { grupoDe, loadAggregates, readAggregates } from './carga/setores.ts';
import { baixar, listKeys, openRaw, readRaw, type Baixado } from './lib/baixar.ts';

const AGG = 'https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios';
const DIC = 'dicionario_de_dados_agregados_por_setores_censitarios_20260520.xlsx';
const TEMAS: Record<string, { tema: string; zip: string }> = {
  demografia: { tema: 'Demografia', zip: 'Agregados_por_setores_demografia_BR.zip' },
  cor_ou_raca: { tema: 'Cor ou Raça', zip: 'Agregados_por_setores_cor_ou_raca_BR.zip' },
  alfabetizacao: { tema: 'Alfabetização', zip: 'Agregados_por_setores_alfabetizacao_BR.zip' },
};
const MANAUS = '1302603';
const SIDRA = 'https://apisidra.ibge.gov.br/values';
const PROJ = 'https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/projecoes_2024_tab2_grupo_quinquenal.xlsx';
const coletor = 'ibge-populacao';

const tmp = mkdtempSync(join(tmpdir(), 'populacao-'));
const chaves = new Map<string, string[]>();

/** The raw file with this name if it is already in R2 (a re-run does not download again), else a new download. */
async function noBruto(db: pg.ClientBase, fonte: string, nome: string, url: string): Promise<{ id: number; chave: string }> {
  if (!chaves.has(fonte))
    chaves.set(
      fonte,
      (await listKeys(`bruto/${fonte}/`)).map((k) => k.key),
    );
  const ja = chaves
    .get(fonte)!
    .filter((k) => k.endsWith(`Z_${nome}`))
    .sort()
    .at(-1);
  if (ja) {
    const meta = JSON.parse(await readRaw(ja + '.meta.json'));
    return { id: await registrar(db, { chave: ja, fonte, sha256: meta.sha256, baixado_em: meta.baixado_em }), chave: ja };
  }
  const b: Baixado = await baixar({ fonte, coletor, nome, url });
  console.log(b.chave, b.bytes);
  return { id: await registrar(db, b), chave: b.chave };
}

async function local(chave: string): Promise<string> {
  const f = join(tmp, chave.split('/').pop()!);
  await pipeline(await openRaw(chave), createWriteStream(f));
  return f;
}

/** One sheet of an xlsx as CSV rows, through GDAL. */
function folha(xlsx: string, nome: string, csv: string): string {
  execFileSync('ogr2ogr', ['-f', 'CSV', '-oo', 'HEADERS=DISABLE', csv, xlsx, nome]);
  return readFileSync(csv, 'utf8');
}

const db = new pg.Client();
await db.connect();
try {
  // Dictionary → ibge.variavel, with the group of each variable; the variables kept are the grouped ones and, in
  // demography, also sex x age (for the exploratory cuts of the hypotheses).
  const dic = await noBruto(db, 'ibge-agregados-setor', DIC, `${AGG}/${DIC}`);
  const linhas = folha(await local(dic.chave), 'Dicionário não PCT', join(tmp, 'dic.csv'))
    .split('\n')
    .map(splitCsv);
  const manter = new Map<string, Set<string>>();
  for (const [tabela, { tema }] of Object.entries(TEMAS)) {
    const vars = linhas
      .filter((l) => l[1] === tema)
      .map((l) => ({ variavel: l[2].toLowerCase(), descricao: l[3], grupo: grupoDe(tabela, l[3]) }))
      .filter((v) => v.grupo || tabela === 'demografia');
    await db.query('UPDATE ibge.variavel SET grupo = NULL WHERE tabela = $1', [tabela]); // a variable that lost its group
    await db.query(
      `INSERT INTO ibge.variavel (tabela, variavel, descricao, grupo) SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[])
       ON CONFLICT (tabela, variavel) DO UPDATE SET descricao = excluded.descricao, grupo = excluded.grupo`,
      [tabela, vars.map((v) => v.variavel), vars.map((v) => v.descricao), vars.map((v) => v.grupo)],
    );
    manter.set(tabela, new Set(vars.map((v) => v.variavel)));
  }
  for (const [tabela, { zip }] of Object.entries(TEMAS)) {
    const z = await noBruto(db, 'ibge-agregados-setor', zip, `${AGG}/Agregados_por_Setor_csv/${zip}`);
    const rows = await readAggregates(await local(z.chave), '13', manter.get(tabela));
    console.log(`ibge.setor_agregado (${tabela}):`, await loadAggregates(db, z.id, tabela, rows));
  }

  // Yearly series.
  const serie: (LinhaPop & { arquivo: number })[] = [];
  const sidra = async (nome: string, caminho: string, tipo: LinhaPop['tipo'], fonte: string) => {
    const s = await noBruto(db, 'ibge-sidra', nome, `${SIDRA}/${caminho}`);
    for (const l of linhasSidra(JSON.parse(await readRaw(s.chave)), { local: MANAUS, tipo, fonte })) serie.push({ ...l, arquivo: s.id });
  };
  await sidra('t6579_manaus.json', `t/6579/n6/${MANAUS}/v/9324/p/all`, 'estimativa', 'SIDRA 6579');
  await sidra('t202_manaus_2000_2010.json', `t/202/n6/${MANAUS}/v/93/p/2000,2010/c2/0/c1/0`, 'censo', 'SIDRA 202');
  await sidra('t4709_manaus_2022.json', `t/4709/n6/${MANAUS}/v/93/p/2022`, 'censo', 'SIDRA 4709');
  const p = await noBruto(db, 'ibge-projecoes', 'projecoes_2024_tab2_grupo_quinquenal.xlsx', PROJ);
  const csv = folha(await local(p.chave), '2) POP_GRUPO QUINQUENAL', join(tmp, 'proj.csv'));
  for (const l of linhasProjecao(csv, 'AM', 'Projeções da População, revisão 2024')) serie.push({ ...l, arquivo: p.id });
  const c = (k: keyof (typeof serie)[number]) => serie.map((l) => l[k]);
  await db.query(
    `INSERT INTO ibge.populacao_ano (local, ano, tipo, sexo, idade, pessoas, fonte, arquivo)
     SELECT * FROM unnest($1::text[], $2::int[], $3::text[], $4::text[], $5::text[], $6::int[], $7::text[], $8::bigint[])
     ON CONFLICT (local, ano, tipo, sexo, idade) DO UPDATE SET pessoas = excluded.pessoas, fonte = excluded.fonte, arquivo = excluded.arquivo`,
    [c('local'), c('ano'), c('tipo'), c('sexo'), c('idade'), c('pessoas'), c('fonte'), c('arquivo')],
  );
  console.log('ibge.populacao_ano:', serie.length);
} finally {
  await db.end();
  rmSync(tmp, { recursive: true, force: true });
}
