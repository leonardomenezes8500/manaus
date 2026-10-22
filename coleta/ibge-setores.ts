// Census tracts 2022 (#21): AM tract mesh (geoftp) + basic aggregates per tract (Brazil file, AM rows kept) + the
// IBGE dictionary, all through baixar(); then the load. One-off job on this PC (needs ogr2ogr and unzip):
//   node coleta/ibge-setores.ts
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import pg from 'pg';
import { baixar } from './lib/baixar.ts';
import { registrar } from './carga/lib.ts';
import { aggregatesOf, loadAggregates, loadTracts, stageTracts, type Aggregate } from './carga/setores.ts';

const AM = '13';
const MESH =
  'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/setores/gpkg/UF/AM/AM_setores_CD2022.gpkg';
const AGG = 'https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios';
const coletor = 'ibge-setores';

async function readAggregates(zip: string): Promise<Aggregate[]> {
  const unzip = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
  unzip.stdout.setEncoding('latin1');
  const lines = createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  let header: string[] | undefined;
  const out: Aggregate[] = [];
  for await (const line of lines) {
    if (!header) header = line.split(';').map((h) => h.replace(/^"(.*)"$/, '$1'));
    else out.push(...aggregatesOf(header, line, AM));
  }
  return out;
}

const db = new pg.Client();
await db.connect();
try {
  const mesh = await baixar({
    fonte: 'ibge-setores',
    coletor,
    nome: 'AM_setores_CD2022.gpkg',
    url: MESH,
    parametros: { uf: 'AM', censo: 2022 },
  });
  const basic = await baixar({
    fonte: 'ibge-agregados-setor',
    coletor,
    nome: 'Agregados_por_setores_basico_BR_20260520.zip',
    url: `${AGG}/Agregados_por_Setor_csv/Agregados_por_setores_basico_BR_20260520.zip`,
    parametros: { tabela: 'basico' },
  });
  const dictionary = await baixar({
    fonte: 'ibge-agregados-setor',
    coletor,
    nome: 'dicionario_de_dados_agregados_por_setores_censitarios_20260520.xlsx',
    url: `${AGG}/dicionario_de_dados_agregados_por_setores_censitarios_20260520.xlsx`,
  });
  await registrar(db, dictionary);

  stageTracts(mesh.caminho);
  console.log('ibge.setor:', await loadTracts(db, await registrar(db, mesh)));
  const rows = await readAggregates(basic.caminho);
  console.log('ibge.setor_agregado (basico):', await loadAggregates(db, await registrar(db, basic), 'basico', rows));
} finally {
  await db.end();
}
