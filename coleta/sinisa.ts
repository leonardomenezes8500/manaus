// SINISA (#67): yearly water and sewage indicators of Manaus, from the Ministério das Cidades spreadsheets.
//   node coleta/sinisa.ts      this PC, once a year (needs unzip and ogr2ogr; a new year = a new line in ZIPS)
// One zip per year and module, with an xlsx per theme; only the "Indicadores ... Base Municipal" one is read, and only
// the Manaus row is kept. gov.br answers 403 to curl's default User-Agent. The SNIS (until 2022) is another series.
import { execFileSync } from 'node:child_process';
import { createWriteStream, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { splitCsv } from './carga/csv.ts';
import { registrar } from './carga/lib.ts';
import { baixar, openRaw } from './lib/baixar.ts';

const G = 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa';
const ZIPS = [
  { ano: 2023, modulo: 'agua', url: `${G}/arquivos/SINISA_Resultados_Ref2023.zip` },
  { ano: 2023, modulo: 'esgoto', url: `${G}/resultados-sinisa/SINISA_ESGOTO_Planilhas_2023_v2.zip` },
  { ano: 2024, modulo: 'agua', url: `${G}/resultados-sinisa/SINISA_Resultados_Ref2024.zip` },
  { ano: 2024, modulo: 'esgoto', url: `${G}/resultados-sinisa/SINISA_ESGOTO_Planilhas_2024.zip` },
] as const;

/** The sheet as CSV → the indicators of one municipality (columns after the identification ones, up to "Sigla"). */
export function indicadoresDe(csv: string, ibge: string): { indicador: string; valor: number | null; texto: string }[] {
  // A header cell may hold line breaks: physical lines are joined while a quote is open.
  const linhas: string[][] = [];
  let aberto = '';
  for (const l of csv.split(/\r?\n/)) {
    aberto = aberto ? `${aberto} ${l}` : l;
    if ((aberto.match(/"/g)?.length ?? 0) % 2 === 0) {
      linhas.push(splitCsv(aberto));
      aberto = '';
    }
  }
  const cab = linhas.find((l) => /^C[oó]digo do IBGE$/i.test(l[0]?.trim() ?? ''));
  if (!cab) throw new Error('cabeçalho "Codigo do IBGE" não encontrado');
  const linha = linhas.find((l) => l[0]?.trim() === ibge);
  if (!linha) return [];
  const ini = cab.findIndex((h) => h.trim() === 'Sigla') + 1 || 10;
  return cab.slice(ini).flatMap((h, i) => {
    const texto = (linha[ini + i] ?? '').trim();
    const n = Number(texto);
    return h.trim() ? [{ indicador: h.trim(), valor: texto !== '' && Number.isFinite(n) ? n : null, texto }] : [];
  });
}

async function principal() {
  const tmp = mkdtempSync(join(tmpdir(), 'sinisa-'));
  const db = new pg.Client();
  await db.connect();
  try {
    for (const z of ZIPS) {
      const b = await baixar({
        fonte: 'sinisa',
        coletor: 'sinisa',
        nome: z.url.split('/').pop()!,
        url: z.url,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const zip = join(tmp, 'z.zip');
      await pipeline(await openRaw(b.chave), createWriteStream(zip));
      const entrada = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' })
        .split('\n')
        .find((n) => /Indicadores_Base Municipal.*\.xlsx$/.test(n));
      if (!entrada) throw new Error(`${z.url}: sem a planilha de indicadores da base municipal`);
      execFileSync('sh', ['-c', 'unzip -p "$1" "$2" > "$3"', 'sh', zip, entrada, join(tmp, 'i.xlsx')]);
      // 2024 has one sheet of indicators; 2023 splits them by theme. Every sheet but the methodological note.
      const folhas = [...execFileSync('ogrinfo', ['-q', join(tmp, 'i.xlsx')], { encoding: 'utf8' }).matchAll(/^\d+: (.+?) \(/gm)]
        .map((m) => m[1])
        .filter((f) => !/^Nota/.test(f));
      const porNome = new Map<string, ReturnType<typeof indicadoresDe>[number]>();
      for (const f of folhas) {
        execFileSync('ogr2ogr', ['-f', 'CSV', '-oo', 'HEADERS=DISABLE', join(tmp, 'i.csv'), join(tmp, 'i.xlsx'), f]);
        for (const x of indicadoresDe(readFileSync(join(tmp, 'i.csv'), 'utf8'), '1302603')) porNome.set(x.indicador, x);
        rmSync(join(tmp, 'i.csv'));
      }
      const ind = [...porNome.values()];
      const arquivo = await registrar(db, b);
      await db.query(
        `INSERT INTO saneamento.indicador_ano (municipio, ano, serie, modulo, indicador, valor, texto, arquivo)
         SELECT 1302603, $1, 'SINISA', $2, * , $6::bigint FROM unnest($3::text[], $4::float8[], $5::text[])
         ON CONFLICT (municipio, ano, serie, modulo, indicador) DO UPDATE SET valor = excluded.valor, texto = excluded.texto, arquivo = excluded.arquivo`,
        [z.ano, z.modulo, ind.map((i) => i.indicador), ind.map((i) => i.valor), ind.map((i) => i.texto), arquivo],
      );
      console.log(z.ano, z.modulo, `${ind.length} indicadores`, entrada);
    }
  } finally {
    await db.end();
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
