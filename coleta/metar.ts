// METAR collector (#11): hourly reports from Manaus airports SBEG (Eduardo Gomes) and SBMN (Ponta Pelada).
//   node coleta/metar.ts                          hourly: last 3 h from aviationweather.gov (raw text)
//   node coleta/metar.ts --history [SBEG|SBMN] [fromYear]   Iowa State (IEM) archive, one file per station and year
// Weather codes that matter here: FU = smoke, HZ = haze. No key needed on either source.
import { baixar } from './lib/baixar.ts';

export const STATIONS = { SBEG: 1977, SBMN: 1972 } as const; // first year in the IEM archive (archive_begin)
const PAUSE_MS = 2000; // IEM asks for gentle use
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** IEM ASOS download URL for one station and one UTC year (routine + special reports). */
export function iemUrl(station: string, year: number): string {
  const q = new URLSearchParams({
    station, data: 'metar', tz: 'Etc/UTC', format: 'onlycomma', latlon: 'no', missing: 'M', trace: 'T', direct: 'no',
    year1: String(year), month1: '1', day1: '1', year2: String(year + 1), month2: '1', day2: '1',
  });
  return `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?${q}&report_type=3&report_type=4`;
}

/** True when the report carries smoke (FU) or haze (HZ) as present weather (remarks are ignored). */
export function smokeOrHaze(metar: string): boolean {
  return /(^|\s)[-+]?(FU|HZ)(?=\s|$)/.test(metar.split(' RMK')[0]);
}

async function main(args: string[]) {
  if (args[0] !== '--history') {
    const r = await baixar({
      fonte: 'metar-aviationweather', coletor: 'metar', nome: 'SBEG-SBMN.txt',
      url: 'https://aviationweather.gov/api/data/metar?ids=SBEG,SBMN&hours=3&format=raw',
      parametros: { ids: 'SBEG,SBMN', hours: 3 },
    });
    return console.log(r.chave, r.bytes);
  }
  const last = new Date().getUTCFullYear();
  for (const [station, first] of Object.entries(STATIONS)) {
    if (args[1] && args[1] !== station) continue;
    for (let year = Number(args[2] ?? first); year <= last; year++) {
      const r = await baixar({
        fonte: 'iem-asos', coletor: 'metar', nome: `${station}_${year}.csv`, url: iemUrl(station, year),
        parametros: { station, year },
      });
      console.log(r.chave, r.bytes);
      await sleep(PAUSE_MS);
    }
  }
}

if (import.meta.main) main(process.argv.slice(2)).catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
