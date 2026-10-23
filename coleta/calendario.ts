// Official calendar load (#60), one-off on this PC (re-run when a CSV gets a new year):
//   node coleta/calendario.ts [--ate 2026]
// Rule dates (regras.ts) for 1994 to --ate, plus every coleta/calendario/<tipo>.csv. Each official document goes to
// the raw files once through baixar() (a document already there is reused), then contexto.periodo is written.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { registrar } from './carga/lib.ts';
import { gravarPeriodos } from './calendario/gravar.ts';
import { eleicoes, feriadosLocais, feriadosNacionais, fogoIpaam, lerCsvCalendario, roca, type Periodo } from './calendario/regras.ts';
import { periodosDoRio } from './calendario/rio.ts';
import { baixar, listKeys, readRaw } from './lib/baixar.ts';

const DIR = join(import.meta.dirname, 'calendario');

/** Raw name of a document: a short hash of the url (two laws can share a file name) + the file name. */
export const nomeDoDocumento = (url: string) =>
  `${createHash('sha1').update(url).digest('hex').slice(0, 8)}_${(new URL(url).pathname.split('/').pop() || 'index').replace(/[^\w.-]/g, '-')}`;

async function principal(args: string[]) {
  const ate = Number(args.includes('--ate') ? args[args.indexOf('--ate') + 1] : new Date().getUTCFullYear());
  const periodos: Periodo[] = [];
  for (let ano = 1994; ano <= ate; ano++)
    periodos.push(...feriadosNacionais(ano), ...feriadosLocais(ano), ...eleicoes(ano), ...fogoIpaam(ano), ...roca(ano));
  for (const f of readdirSync(DIR).filter((f) => f.endsWith('.csv')))
    periodos.push(...lerCsvCalendario(readFileSync(join(DIR, f), 'utf8')));

  const db = new pg.Client();
  await db.connect();
  try {
    // River seasons (#62): derived from the measured level of the Porto de Manaus, redone on every run.
    const cotas = await db.query(
      `SELECT dia::text, cota_cm AS cm FROM ana.cota_dia WHERE estacao = 14990000 AND dia >= '1993-12-01' ORDER BY dia`,
    );
    periodos.push(...periodosDoRio(cotas.rows));
    const arquivo = new Map<string, number>(); // url → bruto.arquivo id
    const chaves = new Map<string, string[]>(); // fonte → raw keys
    for (const p of periodos) {
      if (arquivo.has(p.url)) continue;
      if (!chaves.has(p.fonte))
        chaves.set(
          p.fonte,
          (await listKeys(`bruto/${p.fonte}/`)).map((k) => k.key),
        );
      const nome = nomeDoDocumento(p.url);
      const ja = p.bruto || chaves.get(p.fonte)!.find((k) => k.endsWith(`Z_${nome}`) || k.endsWith(`Z_${nome}.gz`));
      let id: number;
      if (ja) {
        const meta = JSON.parse(await readRaw(ja + '.meta.json'));
        id = await registrar(db, { chave: ja, fonte: p.fonte, sha256: meta.sha256, baixado_em: meta.baixado_em });
      } else {
        // gzip: some official pages are huge HTML (13.9 MB per COB page)
        const b = await baixar({
          fonte: p.fonte,
          coletor: 'calendario',
          nome,
          url: p.url,
          headers: { 'User-Agent': 'Mozilla/5.0' },
          gzip: true,
        });
        console.log(b.chave, b.bytes);
        id = await registrar(db, b);
      }
      arquivo.set(p.url, id);
    }
    await db.query('BEGIN');
    await db.query(`DELETE FROM contexto.periodo WHERE tipo = 'epoca_rio'`);
    await gravarPeriodos(
      db,
      periodos.map((p) => ({ ...p, arquivo: arquivo.get(p.url)! })),
    );
    await db.query('COMMIT');
    console.log(`${periodos.length} eventos, ${arquivo.size} documentos`);
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
