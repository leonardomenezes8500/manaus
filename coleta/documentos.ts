// Documents cited by pesquisa/ (#105 onwards): the law, plan or report a number comes from goes to the raw files once.
//   node coleta/documentos.ts        every row of pesquisa/documentos.csv that is not in bruto/ yet
// Prints "url → raw key" for each row; the problem or solution file cites the key. A failed download is reported and
// the next row goes on (some official sites drop connections for hours): run again later.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nomeDoDocumento } from './calendario.ts';
import { baixar, listKeys } from './lib/baixar.ts';

async function principal() {
  const [, ...linhas] = readFileSync(join(import.meta.dirname, '..', 'pesquisa', 'documentos.csv'), 'utf8')
    .trim()
    .split('\n');
  let falhas = 0;
  for (const linha of linhas) {
    const [fonte, url] = linha.split(',');
    const nome = nomeDoDocumento(url);
    const ja = (await listKeys(`bruto/${fonte}/`)).find((k) => k.key.endsWith(`Z_${nome}.gz`));
    try {
      const chave =
        ja?.key ?? (await baixar({ fonte, url, nome, coletor: 'documentos', headers: { 'User-Agent': 'Mozilla/5.0' }, gzip: true })).chave;
      console.log(`${url} → ${chave}`);
    } catch (e) {
      falhas++;
      console.error(`FALHOU ${url}: ${(e as Error).message}`);
    }
  }
  if (falhas) throw new Error(`${falhas} documento(s) sem bruto; rodar de novo mais tarde`);
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
