// INPE Queimadas collector (#14): official daily fire spots for Brazil (all satellites, CSV).
//   node coleta/inpe-queimadas.ts                       daily: yesterday's file (Manaus day)
//   node coleta/inpe-queimadas.ts --history 2026-08-01  monthly files for closed months + daily files for the current month
// The daily folder only keeps ~30 days; the monthly folder keeps the season (~100 MB per month).
import { readFile } from 'node:fs/promises';
import { baixar } from './lib/baixar.ts';
import { diaDeManaus } from '../analise/dia.ts';

const BASE = 'https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv';
const HEADER = 'id,lat,lon,data_hora_gmt,satelite';

/** Files to fetch for the history: closed months as monthly files, the current month day by day until `yesterday`. */
export function historyFiles(start: string, yesterday: string): { kind: 'mensal' | 'diario'; date: string }[] {
  const out: { kind: 'mensal' | 'diario'; date: string }[] = [];
  const currentMonth = yesterday.slice(0, 7);
  let d = new Date(start.slice(0, 7) + '-01T00:00:00Z');
  for (; d.toISOString().slice(0, 7) < currentMonth; d.setUTCMonth(d.getUTCMonth() + 1)) {
    out.push({ kind: 'mensal', date: d.toISOString().slice(0, 7).replace('-', '') });
  }
  const first = start > currentMonth ? start : currentMonth + '-01';
  for (let t = Date.parse(first + 'T00:00:00Z'); t <= Date.parse(yesterday + 'T00:00:00Z'); t += 86_400_000) {
    out.push({ kind: 'diario', date: new Date(t).toISOString().slice(0, 10).replaceAll('-', '') });
  }
  return out;
}

async function fetchFile(kind: 'mensal' | 'diario', date: string) {
  const name = `focos_${kind}_br_${date}.csv`;
  const r = await baixar({
    fonte: 'inpe-queimadas', coletor: 'inpe-queimadas', nome: name,
    url: `${BASE}/${kind}/Brasil/${name}`, parametros: { kind, date },
  });
  const head = (await readFile(r.caminho, 'utf8')).slice(0, HEADER.length);
  if (head !== HEADER) throw new Error(`${r.chave}: not the INPE CSV`);
  console.log(r.chave, r.bytes);
}

async function main(args: string[]) {
  const yesterday = diaDeManaus(new Date(Date.now() - 86_400_000));
  const files = args[0] === '--history'
    ? historyFiles(args[1] ?? '2026-08-01', yesterday)
    : [{ kind: 'diario' as const, date: yesterday.replaceAll('-', '') }];
  for (const f of files) await fetchFile(f.kind, f.date);
}

if (import.meta.main) main(process.argv.slice(2)).catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
