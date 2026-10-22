// MAIAC (#54), without the Earthdata password (AppEEARS refuses the token): for each day, the MCD19A2 file of tile
// h12v09 (Manaus and ATTO) with the token, the points extracted by analise/maiac/extrair.py (Python: HDF4), the
// extracted CSV into the raw files (the HDF is not kept), then the load. One-off on this PC, at the end of a season:
//   node coleta/maiac.ts --comparacao 2026-08-01   the days with FU/HZ at SBEG since then + as many clean days
//   node coleta/maiac.ts --dias 2026-09-23,2026-10-12
import { execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { guardar } from './lib/baixar.ts';
import { loadMaiac, mediaDoDia, parseMaiac } from './carga/maiac.ts';
import { registrar } from './carga/lib.ts';
import { tentar } from './lib/tentar.ts';
import { MANAUS } from './regiao.ts';

export const PONTOS = [`manaus:${MANAUS.lat}:${MANAUS.lon}`, 'atto:-2.181583:-59.021861']; // ATTO-Campina (AERONET site)
const EXTRATOR = join(import.meta.dirname, '..', 'analise', 'maiac', 'extrair.py');

/** URL of the h12v09 MCD19A2 file of a UTC day, from NASA CMR. */
async function granulo(dia: string): Promise<{ id: string; url: string } | null> {
  const q = `short_name=MCD19A2&version=061&temporal=${dia}T00:00:00Z,${dia}T23:59:59Z&bounding_box=-60.1,-3.2,-59,-2.1&page_size=10`;
  const r = await (await tentar(() => fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?${q}`))).json();
  const g = r.feed.entry.find((e: any) => e.title.includes('.h12v09.'));
  const url = g?.links.map((l: any) => l.href).find((h: string) => h.endsWith('.hdf'));
  return g && url ? { id: g.title, url } : null;
}

async function dia(db: pg.ClientBase, d: string, tmp: string): Promise<number> {
  const g = await granulo(d);
  if (!g) return (console.log(`${d}: sem arquivo h12v09 no CMR`), 0);
  const hdf = join(tmp, `${g.id}.hdf`);
  const res = await tentar(async () => {
    const r = await fetch(g.url, { headers: { Authorization: `Bearer ${process.env.EARTHDATA_TOKEN}` } });
    if (!r.ok || !r.body) throw new Error(`HTTP ${r.status} em ${g.id}`);
    return r;
  });
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(hdf));
  const csv = execFileSync(
    'uv',
    ['run', '-q', '--no-project', '--python', '3.12', '--with', 'pyhdf', '--with', 'numpy', 'python', '-I', EXTRATOR, hdf, ...PONTOS],
    {
      maxBuffer: 16 << 20,
    },
  ).toString();
  await rm(hdf);
  const local = join(tmp, `${g.id}.csv`);
  await writeFile(local, csv);
  const b = await guardar(local, {
    fonte: 'nasa-maiac',
    coletor: 'maiac',
    nome: `${g.id}.csv`,
    origem: g.url,
    parametros: { granulo: g.id, pontos: PONTOS },
  });
  const linhas = mediaDoDia(parseMaiac(csv));
  await loadMaiac(db, await registrar(db, b), linhas);
  console.log(d, g.id, linhas.map((l) => `${l.ponto}/${l.satelite} ${l.aod_550} (${l.pixels})`).join('; ') || 'nenhum pixel bom');
  return linhas.length;
}

async function principal(args: string[]) {
  if (!process.env.EARTHDATA_TOKEN) throw new Error('falta EARTHDATA_TOKEN');
  const db = new pg.Client();
  await db.connect();
  const tmp = await mkdtemp(join(tmpdir(), 'maiac-'));
  try {
    let dias: string[];
    if (args[0] === '--comparacao') {
      // FU/HZ days at SBEG and, spread over the same period, as many days without it.
      const r = await db.query(
        `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, horas_fu_hz > 0 AS fu FROM analise.fumaca_dia WHERE versao = 'v0' AND dia >= $1 ORDER BY dia`,
        [args[1] ?? '2026-08-01'],
      );
      const fu = r.rows.filter((x) => x.fu).map((x) => x.dia);
      const limpos = r.rows.filter((x) => !x.fu).map((x) => x.dia);
      const passo = Math.max(1, Math.floor(limpos.length / Math.max(1, fu.length)));
      dias = [...fu, ...limpos.filter((_, i) => i % passo === 0).slice(0, fu.length)].sort();
    } else if (args[0] === '--dias') {
      dias = (args[1] ?? '').split(',').filter((d) => /^\d{4}-\d\d-\d\d$/.test(d));
    } else throw new Error('uso: --comparacao AAAA-MM-DD | --dias AAAA-MM-DD,...');
    let falhas = 0;
    for (const d of dias) {
      try {
        await dia(db, d, tmp);
      } catch (e) {
        falhas++;
        console.error('ERRO', d, (e as Error).message);
      }
    }
    if (falhas) throw new Error(`${falhas} de ${dias.length} dias falharam`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
