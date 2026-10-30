// CNES (#112): health establishments of Manaus. The newest ST file of the AM (FTP, .dbc) gives type and management;
// the CNES API gives name and point. Both go to the raw files (the API only as a cut: no phone, e-mail or CNPJ), then
// cnes.estabelecimento is replaced. On this PC, by hand, when a new month is out: `node coleta/cnes.ts`.
// Run again: an ST file already in the raw files is reused; the API is asked again only when the ST file is new.
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readDbcRecords } from '@precisa-saude/datasus-dbc';
import pg from 'pg';
import { cortarApi, juntar, loadEstabelecimentos, parseSt, type Api, type St } from './carga/cnes.ts';
import { registerSource } from './carga/registrar.ts';
import { lerListagem, nomeBruto } from './datasus.ts';
import { guardar, listKeys, openRaw, readRaw } from './lib/baixar.ts';
import { jsonComTentativas } from './lib/tentar.ts';

const fonte = 'datasus-cnes';
const FTP = 'ftp://ftp.datasus.gov.br/dissemin/publicos/CNES/200508_/Dados/ST';
const API = 'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=130260';
const PAGINA = 20; // the API's maximum

async function bytes(chave: string): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const p of await openRaw(chave)) partes.push(p as Buffer);
  return Buffer.concat(partes);
}

async function paginasDaApi(): Promise<Record<string, unknown>[]> {
  const todos: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGINA) {
    const r = await jsonComTentativas(`${API}&limit=${PAGINA}&offset=${offset}`);
    todos.push(...r.estabelecimentos);
    if (r.estabelecimentos.length < PAGINA) return todos;
  }
}

const tmp = await mkdtemp(join(tmpdir(), 'cnes-'));
const db = new pg.Client();
await db.connect();
try {
  const mais = lerListagem(execFileSync('curl', ['-sS', '--fail', `${FTP}/`], { maxBuffer: 1 << 26 }).toString())
    .filter((i) => /^STAM\d{4}\.dbc$/i.test(i.nome))
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .at(-1);
  if (!mais) throw new Error('nenhum STAM*.dbc na listagem do FTP (o formato mudou?)');
  const chaves = (await listKeys(`bruto/${fonte}/`)).map((k) => k.key);
  let stChave = chaves.find((k) => k.endsWith(`Z_${nomeBruto(mais)}`));
  if (!stChave) {
    const local = join(tmp, mais.nome);
    execFileSync('curl', ['-sS', '--fail', '--retry', '5', '-o', local, `${FTP}/${mais.nome}`]);
    stChave = (await guardar(local, { fonte, coletor: 'cnes', nome: nomeBruto(mais), origem: `${FTP}/${mais.nome}` })).chave;
  }

  const st_: St[] = [];
  for await (const rec of readDbcRecords(new Uint8Array(await bytes(stChave)))) {
    const s = parseSt(rec);
    if (s) st_.push(s);
  }

  const nomeApi = `cnes-api-130260_${st_[0].competencia}.json.gz`;
  let apiChave = chaves.find((k) => k.endsWith(`Z_${nomeApi}`));
  if (!apiChave) {
    const local = join(tmp, nomeApi);
    await writeFile(local, gzipSync(JSON.stringify(cortarApi(await paginasDaApi()))));
    apiChave = (await guardar(local, { fonte, coletor: 'cnes', nome: nomeApi, origem: API })).chave;
  }
  await registerSource(db, fonte, true);
  const id = async (chave: string) => Number((await db.query('SELECT id FROM bruto.arquivo WHERE chave = $1', [chave])).rows[0].id);
  const [st, pontos] = [await id(stChave), await id(apiChave)];
  const api: Api[] = JSON.parse(await readRaw(apiChave));

  console.log(`${stChave}: ${st_.length} em Manaus; API: ${api.length}`);
  console.log(`cnes.estabelecimento: ${await loadEstabelecimentos(db, st, pontos, juntar(st_, api))} linhas`);
  const resumo = await db.query(
    `SELECT tipo = '02' AND gestao = 'municipal' AS ubs_municipal, publico, count(*) AS n, count(nome) AS com_nome, count(geom) AS com_ponto
     FROM cnes.estabelecimento GROUP BY ROLLUP (1, 2) ORDER BY 1, 2`,
  );
  console.table(resumo.rows);
} finally {
  await db.end();
  await rm(tmp, { recursive: true, force: true });
}
