// Registers raw files in bruto.arquivo from their .meta.json in R2 (#15). Works for any source.
//   node coleta/carga/registrar.ts <fonte> [--tudo]
// By default only the last 3 days of keys are listed; --tudo (or a source with nothing registered yet) lists everything.
import pg from 'pg';
import { listKeys, readRaw } from '../lib/baixar.ts';
import { registrar } from './lib.ts';

const RECENT_DAYS = 3;

/** Key prefixes of the last `days` UTC days for a source (raw keys are bruto/<fonte>/YYYY/MM/DD/...). */
export function recentPrefixes(fonte: string, now: Date, days = RECENT_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '/');
    return `bruto/${fonte}/${d}/`;
  });
}

/** Registers the source's raw files that are not in bruto.arquivo yet; returns how many were added. */
export async function registerSource(db: pg.ClientBase, fonte: string, all = false, now = new Date()): Promise<number> {
  const known = new Set((await db.query('SELECT chave FROM bruto.arquivo WHERE fonte = $1', [fonte])).rows.map((r) => r.chave));
  const prefixes = all || known.size === 0 ? [`bruto/${fonte}/`] : recentPrefixes(fonte, now);
  let added = 0;
  for (const prefix of prefixes) {
    for (const { key } of await listKeys(prefix)) {
      if (!key.endsWith('.meta.json')) continue;
      const chave = key.slice(0, -'.meta.json'.length);
      if (known.has(chave)) continue;
      const meta = JSON.parse(await readRaw(key));
      await registrar(db, { chave, fonte, sha256: meta.sha256, baixado_em: meta.baixado_em });
      known.add(chave);
      added++;
    }
  }
  return added;
}

async function main(args: string[]) {
  if (!args[0]) throw new Error('usage: node coleta/carga/registrar.ts <fonte> [--tudo]');
  const db = new pg.Client();
  await db.connect();
  try {
    console.log(args[0], await registerSource(db, args[0], args[1] === '--tudo'), 'new files');
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
