// SISAGUA (#67): water quality samples taken by the health surveillance (vigilância) in Manaus, one row per analysis.
//   node coleta/sisagua.ts [--de 2014] [--ate <this year>]      this PC, by hand (the current year changes: re-run)
// The Ministry publishes one national zip per year (85-212 MB) in a public S3 bucket that does not list. Each zip is
// downloaded here, cut to Manaus (IBGE code with 6 digits, 130260) and only the cut goes to the raw files (guardar()).
import { spawn } from 'node:child_process';
import { createWriteStream, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { splitCsv } from './carga/csv.ts';
import { registrar } from './carga/lib.ts';
import { guardar } from './lib/baixar.ts';

const S3 = 'https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SISAGUA';
export const MANAUS6 = '130260';

export type Analise = {
  amostra: string;
  coletado_em: string;
  parametro: string;
  resultado: number | null;
  resultado_texto: string;
  ponto: string;
  abastecimento: string;
  area: string;
};

/** The Manaus cut (header + lines) → analyses. Decimal comma; a result like "Ausente" stays only as text. */
export function lerVigilancia(texto: string): Analise[] {
  const [cab, ...linhas] = texto.split(/\r?\n/).filter(Boolean);
  const h = splitCsv(cab, ';');
  const i = (k: string) => {
    const j = h.indexOf(k);
    if (j < 0) throw new Error(`coluna ${k} não existe`);
    return j;
  };
  const [am, dt, hr, pa, re, po, ab, ar, mu] = [
    'NU_AMOSTRA',
    'DT_COLETA',
    'HR_COLETA',
    'PARAMETRO',
    'RESULTADO',
    'TP_PONTO_COLETA',
    'TP_ABASTECIMENTO',
    'NO_AREA',
    'CO_MUNICIPIO_IBGE',
  ].map(i);
  return linhas
    .map((l) => splitCsv(l, ';'))
    .filter((v) => v[mu] === MANAUS6)
    .map((v) => {
      const n = Number(v[re].replace(',', '.'));
      return {
        amostra: v[am],
        coletado_em: `${v[dt].slice(0, 10).replaceAll('/', '-')}T${v[hr] || '00:00'}:00-04:00`, // local time of Manaus
        parametro: v[pa],
        resultado: v[re] !== '' && Number.isFinite(n) ? n : null,
        resultado_texto: v[re],
        ponto: v[po],
        abastecimento: v[ab],
        area: v[ar],
      };
    });
}

/** Streams the national CSV inside the zip and keeps the header and the lines of Manaus (latin1 → UTF-8). */
async function recortar(zip: string): Promise<string> {
  const unzip = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
  unzip.stdout.setEncoding('latin1');
  const out: string[] = [];
  for await (const l of createInterface({ input: unzip.stdout, crlfDelay: Infinity }))
    if (!out.length || l.includes(`";"${MANAUS6}";`)) out.push(l);
  return out.join('\n') + '\n';
}

async function principal(args: string[]) {
  const arg = (k: string, d: number) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
  const tmp = mkdtempSync(join(tmpdir(), 'sisagua-'));
  const db = new pg.Client();
  await db.connect();
  try {
    for (let ano = arg('--de', 2014); ano <= arg('--ate', new Date().getUTCFullYear()); ano++) {
      const url = `${S3}/vigilancia_parametros_basicos_${ano}_csv.zip`;
      const zip = join(tmp, 'v.zip');
      const r = await fetch(url);
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status} em ${url}`);
      await pipeline(Readable.fromWeb(r.body as any), createWriteStream(zip));
      const csv = join(tmp, `vigilancia_${ano}_manaus.csv`);
      writeFileSync(csv, await recortar(zip));
      rmSync(zip);
      const b = await guardar(csv, { fonte: 'sisagua', coletor: 'sisagua', nome: `vigilancia_${ano}_manaus.csv`, origem: url });
      const linhas = lerVigilancia(readFileSync(csv, 'utf8'));
      const arquivo = await registrar(db, b);
      await db.query('BEGIN');
      await db.query('DELETE FROM sisagua.vigilancia WHERE extract(year FROM coletado_em AT TIME ZONE $1) = $2', ['America/Manaus', ano]);
      const k = (c: keyof Analise) => linhas.map((l) => l[c]);
      for (let i = 0; i < linhas.length; i += 5000) {
        const fatia = (c: keyof Analise) => k(c).slice(i, i + 5000);
        await db.query(
          `INSERT INTO sisagua.vigilancia (amostra, coletado_em, parametro, resultado, resultado_texto, ponto, abastecimento, area, arquivo)
           SELECT *, $9::bigint FROM unnest($1::text[], $2::timestamptz[], $3::text[], $4::float8[], $5::text[], $6::text[], $7::text[], $8::text[])`,
          [
            ...(['amostra', 'coletado_em', 'parametro', 'resultado', 'resultado_texto', 'ponto', 'abastecimento', 'area'] as const).map(
              fatia,
            ),
            arquivo,
          ],
        );
      }
      await db.query('COMMIT');
      console.log(ano, b.chave, `${linhas.length} análises`);
    }
  } finally {
    await db.end();
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
