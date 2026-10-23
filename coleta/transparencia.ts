// Federal fire spending (#90): the monthly budget execution files of the Portal da Transparência (CGU; the download
// does not use the API key), from 2014-01 on, cut here to the fire actions (ACOES) and only the cut, gzipped, goes to
// the raw files; the yearly budget per action goes whole (it is small). Then transparencia.despesa_fogo_mes.
// By hand on this PC, once a month:   node coleta/transparencia.ts [--de 2014-01]
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createGzip } from 'node:zlib';
import { setTimeout as esperar } from 'node:timers/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import pg from 'pg';
import { splitCsv } from './carga/csv.ts';
import { guardar, listKeys, readRaw } from './lib/baixar.ts';

const PORTAL = 'https://portaldatransparencia.gov.br/download-de-dados';
// #90: the 6 of the hypothesis and every action with "incêndio" or "queimada" in its name in the yearly budgets of
// 2014 to 2026 (read on 2026-10-23).
export const ACOES = ['214M', '214N', '214P', '218X', '20X7', '21H2', '156G', '20MY', '20V9', '21BS', '21F4', '6074', '6329'];

/** Header and the rows of the fire actions. */
export function cortar(linhas: string[]): string[] {
  const [cab, ...rs] = linhas;
  const i = splitCsv(cab, ';').indexOf('Código Ação');
  if (i < 0) throw new Error('coluna "Código Ação" não encontrada');
  return [cab, ...rs.filter((l) => ACOES.includes(splitCsv(l, ';')[i]))];
}

const valor = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'));

/** One row of the cut → a row of transparencia.despesa_fogo_mes. */
export function lerDespesa(cab: string, linha: string) {
  const c = splitCsv(cab, ';');
  const v = splitCsv(linha, ';');
  const g = (nome: string) => {
    const i = c.indexOf(nome);
    if (i < 0) throw new Error(`coluna "${nome}" não encontrada`);
    return v[i];
  };
  const [ano, mes] = g('Ano e mês do lançamento').split('/');
  return {
    mes: `${ano}-${mes}-01`,
    orgao_superior: g('Nome Órgão Superior'),
    orgao: g('Nome Órgão Subordinado'),
    unidade_gestora: g('Nome Unidade Gestora'),
    acao: g('Código Ação'),
    nome_acao: g('Nome Ação'),
    plano_orcamentario: g('Plano Orçamentário'),
    uf: g('UF') || null,
    municipio: g('Município') || null,
    localizador_codigo: g('Código Localizador'),
    localizador: g('Nome Subtítulo'), // the full name; "Nome Localizador" comes cut at 45 characters
    empenhado: valor(g('Valor Empenhado (R$)')),
    liquidado: valor(g('Valor Liquidado (R$)')),
    pago: valor(g('Valor Pago (R$)')),
  };
}

/** The monthly zip → the cut, gzipped (streamed: the CSV of a month has ~60 MB). */
export async function cortarMes(zip: string, saida: string): Promise<number> {
  const unzip = spawn('unzip', ['-p', zip]);
  const saiu = new Promise<number | null>((r) => unzip.on('close', r));
  const leitor = createInterface({ input: unzip.stdout.setEncoding('latin1'), crlfDelay: Infinity });
  let cab: string | undefined;
  let i = -1;
  const fora: string[] = [];
  for await (const l of leitor) {
    if (cab === undefined) {
      cab = l;
      i = splitCsv(l, ';').indexOf('Código Ação');
      if (i < 0) throw new Error(`coluna "Código Ação" não encontrada em ${zip}`);
      fora.push(l);
    } else if (ACOES.includes(splitCsv(l, ';')[i])) fora.push(l);
  }
  // A bad zip (an HTML page with HTTP 200) must not become an empty month in the raw files: it would never be asked again.
  if ((await saiu) !== 0 || cab === undefined) throw new Error(`unzip falhou em ${zip}`);
  await pipeline(Readable.from([fora.join('\n') + '\n']), createGzip(), createWriteStream(saida));
  return fora.length - 1;
}

async function principal(args: string[]) {
  const de = args.includes('--de') ? args[args.indexOf('--de') + 1] : '2014-01';
  const tmp = await mkdtemp(join(process.env.MANAUS_BUFFER || tmpdir(), 'transparencia-'));
  const db = new pg.Client();
  await db.connect();
  try {
    const ja = (await listKeys('bruto/portal-transparencia/')).map((k) => k.key);
    // 403/404: not published (yet). 405: the CGU blocks for a while after a run of downloads (seen on 2026-10-23
    // after 2 months): wait 15 min and try again. And 20 s between files, so the block does not come.
    const curl = async (url: string, saida: string): Promise<boolean> => {
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        // A stalled or cut CGU connection (8 KB/s for 30 min, then an SSL EOF, on 2026-10-23) is retried.
        const lento = ['--retry-all-errors', '--speed-limit', '20000', '--speed-time', '60'];
        const codigo = execFileSync('curl', ['-sS', '-L', '--retry', '3', ...lento, '-o', saida, '-w', '%{http_code}', url]).toString();
        if (codigo === '200') {
          await esperar(20_000);
          return true;
        }
        if (codigo !== '405') return false;
        console.error(`HTTP 405 em ${url}: pausa de 15 min (${tentativa + 1}/5)`);
        await esperar(15 * 60_000);
      }
      throw new Error(`a CGU continua respondendo 405 em ${url}`);
    };
    // Yearly budget, whole.
    for (let ano = Number(de.slice(0, 4)); ano <= new Date().getUTCFullYear(); ano++) {
      const nome = `orcamento-despesa_${ano}.zip`;
      if (ano < new Date().getUTCFullYear() && ja.some((k) => k.endsWith(nome))) continue; // the current year changes
      const z = join(tmp, nome);
      if (await curl(`${PORTAL}/orcamento-despesa/${ano}`, z))
        await guardar(z, { fonte: 'portal-transparencia', coletor: 'transparencia', nome, origem: `${PORTAL}/orcamento-despesa/${ano}` });
    }
    // Monthly execution, cut. A month already in R2 is not asked again, except the last 3 (the CGU revises them).
    const hoje = new Date();
    const recentes = [0, 1, 2, 3].map((k) =>
      new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - k, 1)).toISOString().slice(0, 7),
    );
    for (let t = Date.UTC(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, 1); t <= hoje.getTime();) {
      const d = new Date(t);
      const am = d.toISOString().slice(0, 7);
      const nome = `despesas-execucao-fogo_${am.replace('-', '')}.csv.gz`;
      t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
      if (!recentes.includes(am) && ja.some((k) => k.endsWith(nome))) continue;
      const z = join(tmp, 'mes.zip');
      if (!(await curl(`${PORTAL}/despesas-execucao/${am.replace('-', '')}`, z))) continue;
      const saida = join(tmp, nome);
      const n = await cortarMes(z, saida);
      await guardar(saida, {
        fonte: 'portal-transparencia',
        coletor: 'transparencia',
        nome,
        origem: `${PORTAL}/despesas-execucao/${am.replace('-', '')}`,
      });
      console.log(`${am}: ${n} linhas das ações do fogo`);
      await rm(z);
    }
    // The table, rebuilt from the newest cut of each month.
    const cortes = new Map<string, string>();
    for (const k of (await listKeys('bruto/portal-transparencia/')).map((x) => x.key).sort()) {
      const m = k.match(/despesas-execucao-fogo_(\d{6})\.csv\.gz$/);
      if (m) cortes.set(m[1], k);
    }
    await db.query('BEGIN');
    await db.query('DELETE FROM transparencia.despesa_fogo_mes');
    let total = 0;
    for (const k of cortes.values()) {
      const [cab, ...rs] = (await readRaw(k)).trim().split('\n');
      const linhas = rs.map((l) => lerDespesa(cab, l));
      for (let i = 0; i < linhas.length; i += 5000)
        await db.query(
          `INSERT INTO transparencia.despesa_fogo_mes (mes, orgao_superior, orgao, unidade_gestora, acao, nome_acao, plano_orcamentario,
             uf, municipio, localizador_codigo, localizador, empenhado, liquidado, pago)
           SELECT mes, orgao_superior, orgao, unidade_gestora, acao, nome_acao, plano_orcamentario, uf, municipio, localizador_codigo,
             localizador, empenhado, liquidado, pago FROM json_populate_recordset(NULL::transparencia.despesa_fogo_mes, $1::json)`,
          [JSON.stringify(linhas.slice(i, i + 5000))],
        );
      total += linhas.length;
    }
    await db.query('COMMIT');
    console.log(`transparencia.despesa_fogo_mes: ${total} linhas de ${cortes.size} meses`);
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await db.end();
    await rm(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
