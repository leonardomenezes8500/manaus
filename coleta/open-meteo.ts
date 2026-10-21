// Open-Meteo collector (#12): wind aloft + boundary layer (forecast model) and CAMS air quality (MODEL, never a measurement)
// for the Manaus point.
//   node coleta/open-meteo.ts                       4x/day: hourly, past 2 days + next 3 days
//   node coleta/open-meteo.ts --history 2026-08-01  monthly files until yesterday (historical-forecast + air-quality APIs)
// Directions are meteorological: where the wind blows FROM. Times are UTC (timezone=GMT).
import { readFile } from 'node:fs/promises';
import { baixar } from './lib/baixar.ts';
import { MANAUS } from './regiao.ts';

export const WEATHER = [
  'wind_speed_10m', 'wind_direction_10m',
  'wind_speed_925hPa', 'wind_direction_925hPa',
  'wind_speed_850hPa', 'wind_direction_850hPa',
  'wind_speed_700hPa', 'wind_direction_700hPa',
  'boundary_layer_height', 'relative_humidity_2m', 'precipitation',
];
export const AIR = ['pm2_5', 'pm10', 'aerosol_optical_depth', 'carbon_monoxide'];

const point = `latitude=${MANAUS.lat}&longitude=${MANAUS.lon}&timezone=GMT`;
const weatherQuery = `${point}&hourly=${WEATHER.join(',')}&wind_speed_unit=kmh`;
const airQuery = `${point}&hourly=${AIR.join(',')}`;
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Month-sized [start, end] date ranges (inclusive) covering `start`..`end`. */
export function monthRanges(start: string, end: string): [string, string][] {
  const out: [string, string][] = [];
  let d = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (d <= last) {
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const to = monthEnd < last ? monthEnd : last;
    out.push([d.toISOString().slice(0, 10), to.toISOString().slice(0, 10)]);
    d = new Date(to.getTime() + 86_400_000);
  }
  return out;
}

/** Downloads and checks it is JSON with hourly data. One retry: the API sometimes drops the connection or answers 200
 * with a timeout text (that file stays in bruto, as it came; the load skips it). */
async function fetchJson(fonte: string, nome: string, url: string, parametros: Record<string, unknown>) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await baixar({ fonte, coletor: 'open-meteo', nome, url, parametros });
      const hours = JSON.parse(await readFile(r.caminho, 'utf8'))?.hourly?.time?.length;
      if (!hours) throw new Error(`${r.chave}: not JSON with hourly data`);
      return console.log(r.chave, hours, 'hours');
    } catch (e) {
      if (attempt === 2) throw e;
      console.error(`${nome}: ${(e as Error).message}, retrying`);
      await sleep(10_000);
    }
  }
}

async function main(args: string[]) {
  if (args[0] !== '--history') {
    const window = 'past_days=2&forecast_days=3';
    await fetchJson('open-meteo-previsao', 'manaus-tempo.json', `https://api.open-meteo.com/v1/forecast?${weatherQuery}&${window}`, { window });
    await fetchJson('open-meteo-qualidade-ar', 'manaus-ar.json', `https://air-quality-api.open-meteo.com/v1/air-quality?${airQuery}&${window}`, { window });
    return;
  }
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  for (const [from, to] of monthRanges(args[1] ?? '2026-08-01', args[2] ?? yesterday)) {
    const dates = `start_date=${from}&end_date=${to}`;
    await fetchJson('open-meteo-previsao', `manaus-tempo_${from}_${to}.json`, `https://historical-forecast-api.open-meteo.com/v1/forecast?${weatherQuery}&${dates}`, { from, to });
    await fetchJson('open-meteo-qualidade-ar', `manaus-ar_${from}_${to}.json`, `https://air-quality-api.open-meteo.com/v1/air-quality?${airQuery}&${dates}`, { from, to });
  }
}

if (import.meta.main) main(process.argv.slice(2)).catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
