// Fire spot load (#15): raw FIRMS and INPE CSVs → firms.foco and inpe.foco. Re-running never duplicates
// (ON CONFLICT DO NOTHING + bruto.carga). Usage: node coleta/carga/focos.ts   (registers new raw files first)
import { createInterface } from 'node:readline';
import pg from 'pg';
import { openRaw } from '../lib/baixar.ts';
import { BBOX } from '../regiao.ts';
import { records } from './csv.ts';
import { loadOnce, pendingFiles } from './lib.ts';
import { registerSource } from './registrar.ts';

const BATCH = 5000;
const num = (v: string | undefined) => (v === undefined || v === '' ? null : Number(v));
const inBox = (lat: number, lon: number) => lon >= BBOX.oeste && lon <= BBOX.leste && lat >= BBOX.sul && lat <= BBOX.norte;

export type FirmsRow = {
  satelite: string; instrumento: string; adquirido_em: string; lat: number; lon: number;
  frp: number | null; confianca: string; dia_noite: string; brilho: number | null; versao: string;
};

/** One FIRMS CSV record (VIIRS or MODIS columns) → row. acq_time is HHMM without leading zeros. */
export function firmsRow(r: Record<string, string>): FirmsRow {
  const hhmm = r.acq_time.padStart(4, '0');
  return {
    satelite: r.satellite, instrumento: r.instrument,
    adquirido_em: `${r.acq_date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`,
    lat: Number(r.latitude), lon: Number(r.longitude), frp: num(r.frp), confianca: r.confidence, dia_noite: r.daynight,
    brilho: num(r.bright_ti4 ?? r.brightness), versao: r.version,
  };
}

export type InpeRow = {
  id: string; data_hora: string; satelite: string; lat: number; lon: number; municipio_inpe: string; estado: string; pais: string;
  municipio_id: number | null; numero_dias_sem_chuva: number | null; precipitacao: number | null; risco_fogo: number | null;
  bioma: string; frp: number | null;
};

export function inpeRow(r: Record<string, string>): InpeRow {
  return {
    id: r.id, data_hora: r.data_hora_gmt.replace(' ', 'T') + 'Z', satelite: r.satelite, lat: Number(r.lat), lon: Number(r.lon),
    municipio_inpe: r.municipio, estado: r.estado, pais: r.pais, municipio_id: num(r.municipio_id),
    numero_dias_sem_chuva: num(r.numero_dias_sem_chuva), precipitacao: num(r.precipitacao), risco_fogo: num(r.risco_fogo),
    bioma: r.bioma, frp: num(r.frp),
  };
}

const column = <T, K extends keyof T>(rows: T[], k: K) => rows.map((r) => r[k]);

async function insertFirms(db: pg.ClientBase, arquivo: number, rows: FirmsRow[]) {
  const c = (k: keyof FirmsRow) => column(rows, k);
  await db.query(
    `INSERT INTO firms.foco (satelite, instrumento, adquirido_em, lat, lon, geom, frp, confianca, dia_noite, brilho, versao, arquivo)
     SELECT s, i, t, la, lo, ST_SetSRID(ST_Point(lo, la), 4326), f, c, d, b, v, $11
     FROM unnest($1::text[], $2::text[], $3::timestamptz[], $4::float8[], $5::float8[], $6::real[], $7::text[], $8::text[], $9::real[], $10::text[])
       AS u(s, i, t, la, lo, f, c, d, b, v)
     ON CONFLICT DO NOTHING`,
    [c('satelite'), c('instrumento'), c('adquirido_em'), c('lat'), c('lon'), c('frp'), c('confianca'), c('dia_noite'), c('brilho'), c('versao'), arquivo],
  );
}

async function insertInpe(db: pg.ClientBase, arquivo: number, rows: InpeRow[]) {
  const c = (k: keyof InpeRow) => column(rows, k);
  await db.query(
    `INSERT INTO inpe.foco (id, data_hora, satelite, lat, lon, geom, municipio_inpe, estado, pais, municipio_id,
                            numero_dias_sem_chuva, precipitacao, risco_fogo, bioma, frp, arquivo)
     SELECT id, t, s, la, lo, ST_SetSRID(ST_Point(lo, la), 4326), mu, e, p, mi, nd, pr, rf, b, f, $15
     FROM unnest($1::uuid[], $2::timestamptz[], $3::text[], $4::float8[], $5::float8[], $6::text[], $7::text[], $8::text[],
                 $9::int[], $10::real[], $11::real[], $12::real[], $13::text[], $14::real[])
       AS u(id, t, s, la, lo, mu, e, p, mi, nd, pr, rf, b, f)
     ON CONFLICT DO NOTHING`,
    [c('id'), c('data_hora'), c('satelite'), c('lat'), c('lon'), c('municipio_inpe'), c('estado'), c('pais'), c('municipio_id'),
      c('numero_dias_sem_chuva'), c('precipitacao'), c('risco_fogo'), c('bioma'), c('frp'), arquivo],
  );
}

export const TABLES = {
  'firms.foco': { fonte: 'nasa-firms', header: 'latitude,', parse: firmsRow, insert: insertFirms },
  'inpe.foco': { fonte: 'inpe-queimadas', header: 'id,lat,lon,', parse: inpeRow, insert: insertInpe },
} as const;
export type Table = keyof typeof TABLES;

/**
 * Loads one raw file (its lines) into `table` in one transaction and marks it loaded. Only spots inside the region box
 * are kept. A file that is not the expected CSV (API error text) is marked loaded with 0 rows, so it is not retried forever.
 */
export function loadLines(db: pg.ClientBase, arquivo: number, table: Table, lines: AsyncIterable<string>): Promise<number> {
  const t = TABLES[table];
  // Attach the iterator right away: readline drops the lines it emits before anyone listens (e.g. during BEGIN).
  const iterator = lines[Symbol.asyncIterator]();
  return loadOnce(db, arquivo, table, async () => {
    const first = await iterator.next();
    if (first.done || !first.value.startsWith(t.header)) {
      console.error(`arquivo ${arquivo}: not the expected CSV, skipped`);
      return 0;
    }
    const all = (async function* () { yield first.value; yield* { [Symbol.asyncIterator]: () => iterator }; })();
    let n = 0;
    let batch: any[] = [];
    for await (const rec of records(all)) {
      const row = t.parse(rec);
      if (!inBox(row.lat, row.lon)) continue;
      batch.push(row);
      if (batch.length === BATCH) await t.insert(db, arquivo, batch), (n += batch.length), (batch = []);
    }
    if (batch.length) await t.insert(db, arquivo, batch), (n += batch.length);
    await db.query(
      `UPDATE ${table} f SET municipio = m.codigo FROM ibge.municipio m
       WHERE f.arquivo = $1 AND f.municipio IS NULL AND ST_Contains(m.geom, f.geom)`,
      [arquivo],
    );
    return n;
  });
}

/** Loads every registered raw file of the table's source that is not loaded yet. */
export async function loadPending(db: pg.ClientBase, table: Table): Promise<void> {
  for (const f of await pendingFiles(db, TABLES[table].fonte, table, '.csv')) {
    const lines = createInterface({ input: await openRaw(f.chave), crlfDelay: Infinity });
    console.log(table, f.chave, await loadLines(db, f.id, table, lines), 'rows in the box');
  }
}

async function main() {
  const db = new pg.Client();
  await db.connect();
  try {
    for (const table of Object.keys(TABLES) as Table[]) {
      await registerSource(db, TABLES[table].fonte);
      await loadPending(db, table);
    }
  } finally {
    await db.end();
  }
}

if (import.meta.main) main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
