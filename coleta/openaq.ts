// OpenAQ collector (#10): AirGradient sensor in central Manaus (location 5040030).
//   node coleta/openaq.ts                       hourly: last 6 h of measurements for every sensor of the location
//   node coleta/openaq.ts --locations           daily: locations in the region bbox; a new id logs "NOVO SENSOR"
//   node coleta/openaq.ts --history 2025-07     one file per sensor and month, from that month until now
// API limit: 60 requests/min. Each measurement "value" is the mean of the hour ending at period.datetimeTo.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { baixar } from './lib/baixar.ts';
import { bboxTexto } from './regiao.ts';

export const LOCATION = 5040030;
const API = 'https://api.openaq.org/v3';
const PAUSE_MS = 1100; // stays under 60 requests/min
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const headers = () => ({ 'X-API-Key': process.env.OPENAQ_API_KEY ?? '' });

/** Months YYYY-MM from `start` to `end` (inclusive), each with its UTC range [from, to). */
export function months(start: string, end: string): { month: string; from: string; to: string }[] {
  const out = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    const month = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ month, from: `${month}-01T00:00:00Z`, to: `${ny}-${String(nm).padStart(2, '0')}-01T00:00:00Z` });
    [y, m] = [ny, nm];
  }
  return out;
}

/** Ids in `now` that were not in `before`. */
export const newIds = (before: number[], now: number[]) => now.filter((id) => !before.includes(id));

type Sensor = { id: number; parameter: string };

async function sensors(): Promise<Sensor[]> {
  const r = await fetch(`${API}/locations/${LOCATION}`, { headers: headers(), signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} on location ${LOCATION}`);
  return (await r.json()).results[0].sensors.map((s: any) => ({ id: s.id, parameter: s.parameter.name }));
}

async function measurements(s: Sensor, from: string, to: string, name: string) {
  const r = await baixar({
    fonte: 'openaq',
    coletor: 'openaq',
    nome: name,
    headers: headers(),
    url: `${API}/sensors/${s.id}/measurements?datetime_from=${from}&datetime_to=${to}&limit=1000`,
    parametros: { location: LOCATION, sensor: s.id, parameter: s.parameter, from, to },
  });
  const j = JSON.parse(await readFile(r.caminho, 'utf8'));
  if (j.meta?.found === '>1000' || j.meta?.found > 1000) throw new Error(`${r.chave}: more than 1000 measurements, needs paging`);
  console.log(r.chave, j.results.length);
}

async function locations() {
  const r = await baixar({
    fonte: 'openaq',
    coletor: 'openaq',
    nome: 'locations-regiao.json',
    headers: headers(),
    url: `${API}/locations?bbox=${bboxTexto()}&limit=1000`,
    parametros: { bbox: bboxTexto() },
  });
  const ids: number[] = JSON.parse(await readFile(r.caminho, 'utf8')).results.map((l: any) => l.id);
  // Previous list lives in the buffer volume (survives restarts); the first run only saves it.
  const state = join(process.env.MANAUS_BUFFER || join(tmpdir(), 'manaus-buffer'), 'estado', 'openaq-locations.json');
  const before: number[] | undefined = await readFile(state, 'utf8').then(JSON.parse, () => undefined);
  if (before) for (const id of newIds(before, ids)) console.log(`NOVO SENSOR: location ${id} (${r.chave})`);
  await mkdir(dirname(state), { recursive: true });
  await writeFile(state, JSON.stringify(ids));
  console.log(r.chave, ids.length, 'locations');
}

async function main(args: string[]) {
  if (!process.env.OPENAQ_API_KEY) throw new Error('missing OPENAQ_API_KEY');
  if (args[0] === '--locations') return locations();
  const list = await sensors();
  if (args[0] === '--history') {
    for (const m of months(args[1] ?? '2025-07', new Date().toISOString().slice(0, 7))) {
      for (const s of list) {
        await measurements(s, m.from, m.to, `sensor-${s.id}-${s.parameter}_${m.month}.json`);
        await sleep(PAUSE_MS);
      }
    }
    return;
  }
  const to = new Date();
  const from = new Date(to.getTime() - 6 * 3600_000);
  const iso = (d: Date) => d.toISOString().slice(0, 19) + 'Z';
  for (const s of list) await measurements(s, iso(from), iso(to), `sensor-${s.id}-${s.parameter}.json`);
}

if (import.meta.main)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
