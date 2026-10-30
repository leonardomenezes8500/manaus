// INEP Censo Escolar (#111): the national zip is cut to Manaus, only the cut goes to the raw files, then the load into
// inep.escola with the point matched to the CNEFE. One-off job on this PC (needs unzip). The INEP server does not send
// its intermediate certificate, so:
//   NODE_EXTRA_CA_CERTS=coleta/certs/rnp-icpedu-gr46-ov-2025.pem node coleta/inep.ts
// Run again (e.g. on production after the merge): the cut already in the raw files is reused.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { createGzip } from 'node:zlib';
import pg from 'pg';
import { casador, loadEscolas, parseEscola } from './carga/inep.ts';
import { registrar } from './carga/lib.ts';
import { registerSource } from './carga/registrar.ts';
import { guardar, listKeys, openRaw } from './lib/baixar.ts';
import { tentar } from './lib/tentar.ts';

const ANO = 2024;
const MUNICIPIO = '1302603';
const URL = `https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_${ANO}.zip`;
const NOME = `microdados_ed_basica_${ANO}_${MUNICIPIO}.csv.gz`;
const fonte = 'inep-microdados';

/** Downloads the national zip and stores the Manaus lines (header kept, latin1 as in the file) as a raw file. */
async function cortar() {
  const dir = await mkdtemp(join(tmpdir(), 'inep-'));
  try {
    const zip = join(dir, 'censo.zip');
    await tentar(async () => {
      const res = await fetch(URL);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} em ${URL}`);
      await pipeline(Readable.fromWeb(res.body as any), createWriteStream(zip));
    });
    const unzip = spawn('unzip', ['-p', zip, `*microdados_ed_basica_${ANO}.csv`], { stdio: ['ignore', 'pipe', 'inherit'] });
    unzip.stdout.setEncoding('latin1');
    let col = -1;
    const linhas: string[] = [];
    for await (const l of createInterface({ input: unzip.stdout, crlfDelay: Infinity })) {
      if (col < 0) col = l.split(';').indexOf('CO_MUNICIPIO');
      else if (l.split(';')[col] !== MUNICIPIO) continue;
      linhas.push(l);
    }
    const corte = join(dir, NOME);
    await pipeline(Readable.from([Buffer.from(linhas.join('\n') + '\n', 'latin1')]), createGzip(), createWriteStream(corte));
    return await guardar(corte, {
      fonte,
      coletor: 'inep',
      nome: NOME,
      origem: URL,
      parametros: { ano: ANO, municipio: Number(MUNICIPIO) },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const db = new pg.Client();
await db.connect();
try {
  await registerSource(db, fonte, true); // the cut may be in the R2 but not yet in this database (production after the merge)
  const ja = (await listKeys(`bruto/${fonte}/`)).find((k) => k.key.endsWith(`Z_${NOME}`));
  const r = await db.query('SELECT id FROM bruto.arquivo WHERE chave = $1', [ja?.key ?? '']);
  const arquivo = r.rowCount ? Number(r.rows[0].id) : await registrar(db, await cortar());
  const chave = (await db.query('SELECT chave FROM bruto.arquivo WHERE id = $1', [arquivo])).rows[0].chave;

  const ensino = await db.query(
    'SELECT id::float8 AS id, cep, numero, estabelecimento AS nome, lat, lon FROM ibge.cnefe_endereco WHERE especie = 4 AND estabelecimento IS NOT NULL',
  );
  const ceps = await db.query(
    `SELECT cep, avg(lat) AS lat, avg(lon) AS lon, greatest(max(lat) - min(lat), max(lon) - min(lon)) * 111 AS km
     FROM ibge.cnefe_endereco WHERE cep IS NOT NULL GROUP BY cep`,
  );
  const casar = casador(ensino.rows, new Map(ceps.rows.map((c) => [c.cep, c])));

  const raw = await openRaw(chave);
  raw.setEncoding('latin1');
  let header: string[] | undefined;
  const escolas = [];
  for await (const l of createInterface({ input: raw, crlfDelay: Infinity })) {
    if (!header) header = l.split(';');
    else if (l.trim()) {
      const e = parseEscola(header, l);
      escolas.push({ ...e, ponto: casar(e) });
    }
  }
  console.log(`${chave}: ${escolas.length} escolas; inep.escola: ${await loadEscolas(db, arquivo, escolas)} linhas`);
  const resumo = await db.query(
    `SELECT rede, count(*) AS escolas, count(geom) AS com_ponto, count(*) FILTER (WHERE ponto_origem = 'cep-numero') AS cep_numero,
       count(*) FILTER (WHERE ponto_origem = 'cep-nome') AS cep_nome, count(*) FILTER (WHERE ponto_origem = 'nome-cidade') AS nome_cidade,
       count(*) FILTER (WHERE ponto_origem = 'centro-cep') AS centro_cep, sum(mat_total) AS matriculas
     FROM inep.escola WHERE situacao = 'em atividade' GROUP BY ROLLUP (rede) ORDER BY rede`,
  );
  console.table(resumo.rows);
} finally {
  await db.end();
}
