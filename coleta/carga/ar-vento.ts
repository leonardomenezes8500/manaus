// Air and wind load (#16): OpenAQ, METAR (aviationweather + IEM) and Open-Meteo (weather + CAMS) raw files → layer 2 tables.
// Re-running never duplicates (primary keys + bruto.carga). Usage: node coleta/carga/ar-vento.ts [fonte...]
import pg from 'pg';
import { readRaw } from '../lib/baixar.ts';
import { records } from './csv.ts';
import { loadOnce, pendingFiles } from './lib.ts';
import { parseMetar, reportTime, type Metar } from './metar.ts';
import { registerSource } from './registrar.ts';

const json = (text: string) => { try { return JSON.parse(text); } catch { return undefined; } };
async function* lines(text: string) { yield* text.split('\n'); }

/** OpenAQ measurements file (sensor id comes from the file name: ..._sensor-<id>-<parameter>[_<month>].json). */
export async function loadOpenaq(db: pg.ClientBase, arquivo: number, chave: string, text: string): Promise<number> {
  const sensor = Number(chave.match(/_sensor-(\d+)-/)?.[1]);
  const results = json(text)?.results;
  if (!sensor || !Array.isArray(results)) return 0; // locations list or error text
  const rows = results.filter((r: any) => r.value !== null && r.value !== undefined);
  await db.query(
    `INSERT INTO openaq.medicao (sensor, parametro, inicio, fim, valor, unidade, arquivo)
     SELECT $1, p, i, f, v, u, $7 FROM unnest($2::text[], $3::timestamptz[], $4::timestamptz[], $5::real[], $6::text[]) AS x(p, i, f, v, u)
     ON CONFLICT DO NOTHING`,
    [sensor, rows.map((r: any) => r.parameter.name), rows.map((r: any) => r.period.datetimeFrom.utc), rows.map((r: any) => r.period.datetimeTo.utc),
      rows.map((r: any) => r.value), rows.map((r: any) => r.parameter.units), arquivo],
  );
  return rows.length;
}

async function insertMetar(db: pg.ClientBase, arquivo: number, rows: (Metar & { observado_em: string })[]) {
  const c = <K extends keyof (typeof rows)[0]>(k: K) => rows.map((r) => r[k]);
  await db.query(
    `INSERT INTO metar.observacao (estacao, observado_em, texto, vento_dir, vento_kt, rajada_kt, visibilidade_m, tempo, temperatura, orvalho, arquivo)
     SELECT e, o, t, vd, vk, rk, vm, string_to_array(tp, ' ')::text[], te, ov, $11
     FROM unnest($1::text[], $2::timestamptz[], $3::text[], $4::int[], $5::int[], $6::int[], $7::int[], $8::text[], $9::real[], $10::real[])
       AS x(e, o, t, vd, vk, rk, vm, tp, te, ov)
     ON CONFLICT DO NOTHING`,
    [c('estacao'), c('observado_em'), c('texto'), c('vento_dir'), c('vento_kt'), c('rajada_kt'), c('visibilidade_m'),
      rows.map((r) => r.tempo.join(' ')), c('temperatura'), c('orvalho'), arquivo],
  );
}

/** aviationweather raw text: one report per line, time from the ddhhmmZ group (month/year from the download time). */
export async function loadMetarRaw(db: pg.ClientBase, arquivo: number, text: string, downloaded: Date): Promise<number> {
  const rows = text.split('\n').filter((l) => /^(METAR|SPECI)?\s*SB[A-Z]{2} \d{6}Z/.test(l.trim()))
    .map((l) => { const m = parseMetar(l); return { ...m, observado_em: reportTime(m.texto, downloaded).toISOString() }; });
  if (rows.length) await insertMetar(db, arquivo, rows);
  return rows.length;
}

/** IEM CSV (station,valid,metar): time from the "valid" column (UTC). */
export async function loadMetarIem(db: pg.ClientBase, arquivo: number, text: string): Promise<number> {
  if (!text.startsWith('station,valid,metar')) return 0;
  let batch: (Metar & { observado_em: string })[] = [];
  let n = 0;
  for await (const r of records(lines(text))) {
    if (!r.metar || r.metar === 'M') continue;
    batch.push({ ...parseMetar(r.metar), observado_em: r.valid.replace(' ', 'T') + ':00Z' });
    if (batch.length === 2000) await insertMetar(db, arquivo, batch), (n += batch.length), (batch = []);
  }
  if (batch.length) await insertMetar(db, arquivo, batch), (n += batch.length);
  return n;
}

export const WEATHER_COLUMNS = ['wind_speed_10m', 'wind_direction_10m', 'wind_speed_925hPa', 'wind_direction_925hPa', 'wind_speed_850hPa',
  'wind_direction_850hPa', 'wind_speed_700hPa', 'wind_direction_700hPa', 'boundary_layer_height', 'relative_humidity_2m', 'precipitation'];
export const AIR_COLUMNS = ['pm2_5', 'pm10', 'aerosol_optical_depth', 'carbon_monoxide'];

/** Open-Meteo hourly JSON → one row per hour; columns are the API names in lowercase. */
export async function loadOpenMeteo(db: pg.ClientBase, arquivo: number, table: 'openmeteo.tempo_hora' | 'openmeteo.ar_hora', text: string, downloaded: Date): Promise<number> {
  const hourly = json(text)?.hourly;
  if (!hourly?.time?.length) return 0;
  const vars = table === 'openmeteo.tempo_hora' ? WEATHER_COLUMNS : AIR_COLUMNS;
  const cols = vars.map((v) => v.toLowerCase());
  await db.query(
    `INSERT INTO ${table} (rodada_em, valido_em, ${cols.join(', ')}, arquivo)
     SELECT $1, t, ${cols.map((c) => `x.${c}`).join(', ')}, $${vars.length + 3}
     FROM unnest($2::timestamptz[], ${vars.map((_, i) => `$${i + 3}::real[]`).join(', ')}) AS x(t, ${cols.join(', ')})
     ON CONFLICT DO NOTHING`,
    [downloaded, hourly.time.map((t: string) => t + ':00Z'), ...vars.map((v) => hourly[v] ?? hourly.time.map(() => null)), arquivo],
  );
  return hourly.time.length;
}

type Job = { fonte: string; tabela: string; load: (db: pg.ClientBase, f: { id: number; chave: string; baixado_em: Date }, text: string) => Promise<number> };
export const JOBS: Job[] = [
  { fonte: 'openaq', tabela: 'openaq.medicao', load: (db, f, t) => loadOpenaq(db, f.id, f.chave, t) },
  { fonte: 'metar-aviationweather', tabela: 'metar.observacao', load: (db, f, t) => loadMetarRaw(db, f.id, t, f.baixado_em) },
  { fonte: 'iem-asos', tabela: 'metar.observacao', load: (db, f, t) => loadMetarIem(db, f.id, t) },
  { fonte: 'open-meteo-previsao', tabela: 'openmeteo.tempo_hora', load: (db, f, t) => loadOpenMeteo(db, f.id, 'openmeteo.tempo_hora', t, f.baixado_em) },
  { fonte: 'open-meteo-qualidade-ar', tabela: 'openmeteo.ar_hora', load: (db, f, t) => loadOpenMeteo(db, f.id, 'openmeteo.ar_hora', t, f.baixado_em) },
];

async function main(only: string[]) {
  const db = new pg.Client();
  await db.connect();
  try {
    for (const job of JOBS.filter((j) => !only.length || only.includes(j.fonte))) {
      await registerSource(db, job.fonte);
      for (const f of await pendingFiles(db, job.fonte, job.tabela)) {
        const text = await readRaw(f.chave);
        console.log(job.tabela, f.chave, await loadOnce(db, f.id, job.tabela, () => job.load(db, f, text)));
      }
    }
  } finally {
    await db.end();
  }
}

if (import.meta.main) main(process.argv.slice(2)).catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
