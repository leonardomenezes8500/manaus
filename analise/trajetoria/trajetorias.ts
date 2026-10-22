// Back-trajectories of a Manaus day (#49): 8 arrivals (every 3 h) × 3 starting levels, 72 h back, from the wind files
// in R2 (ERA5 when it covers the whole window, else GFS), into analise.trajetoria.
//   npm run trajetorias -- --dia 2026-09-23 [--meteo era5|gfs]
import { createWriteStream, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { listKeys, openRaw } from '../../coleta/lib/baixar.ts';
import { MANAUS } from '../../coleta/regiao.ts';
import { integrar, type Ponto, type Vento } from './integrador.ts';
import { ventoDaGrade } from './grade.ts';
import { lerGribs } from './vento.ts';

const H = 3_600_000;
export const HORAS = 72;
export const NIVEIS_SAIDA = [950, 900, 850]; // ≈ 500, 1000 and 1500 m above ground
export type Meteo = 'era5' | 'gfs';
export type Linha = { chegada_em: number; nivel_hpa: number; pontos: Ponto[]; parou_h: number | null };

/** Arrival times (ms UTC) inside the Manaus day: 06Z to 21Z of the day, 00Z and 03Z of the next; up to `ate` (partial day). */
export function chegadas(dia: string, ate = Infinity): number[] {
  const t0 = Date.parse(dia + 'T06:00:00Z');
  return Array.from({ length: 8 }, (_, i) => t0 + i * 3 * H).filter((t) => t <= ate);
}

/** First and last instant of wind the day needs. */
export function janela(dia: string, ate?: number): [number, number] {
  const c = chegadas(dia, ate);
  return [c[0] - HORAS * H, c.at(-1)!];
}

const diaUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

/** ERA5 raw keys that cover every UTC day of the window (the newest download of a day wins), or null. */
export function arquivosEra5(chaves: string[], dia: string, ate?: number): string[] | null {
  const porDia = new Map<string, string>();
  for (const k of [...chaves].sort()) {
    const m = k.match(/era5-pl_(\d{4}-\d\d-\d\d)(?:_(\d{4}-\d\d-\d\d))?\.grib$/);
    if (!m) continue;
    for (let t = Date.parse(m[1]); t <= Date.parse(m[2] ?? m[1]); t += 24 * H) porDia.set(diaUtc(t), k);
  }
  const [ini, fim] = janela(dia, ate);
  const usados = new Set<string>();
  for (let t = Date.parse(diaUtc(ini)); t <= fim; t += 24 * H) {
    const k = porDia.get(diaUtc(t));
    if (!k) return null;
    usados.add(k);
  }
  return [...usados];
}

/** GFS raw keys, one per 3 h of the window (valid time = run + step), or null when one is missing. */
export function arquivosGfs(chaves: string[], dia: string, ate?: number): string[] | null {
  const porHora = new Map<number, string>();
  for (const k of [...chaves].sort()) {
    const m = k.match(/gfs_(\d{4})(\d\d)(\d\d)(\d\d)_f(\d{3})\.grib$/);
    if (m) porHora.set(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4]) + Number(m[5]) * H, k);
  }
  const [ini, fim] = janela(dia, ate);
  const out = [];
  for (let t = ini; t <= fim; t += 3 * H) {
    const k = porHora.get(t);
    if (!k) return null;
    out.push(k);
  }
  return out;
}

export function calcularDia(vento: Vento, dia: string, ate?: number): Linha[] {
  return chegadas(dia, ate).flatMap((t) =>
    NIVEIS_SAIDA.map((hpa) => {
      const r = integrar(vento, { lon: MANAUS.lon, lat: MANAUS.lat, hpa, t }, { horas: HORAS });
      return { chegada_em: t, nivel_hpa: hpa, pontos: r.pontos, parou_h: r.parou_h };
    }),
  );
}

export async function gravarDia(db: pg.ClientBase, dia: string, meteo: Meteo, linhas: Linha[]): Promise<void> {
  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM analise.trajetoria WHERE dia = $1 AND meteo = $2', [dia, meteo]);
    for (const l of linhas) {
      const coords = l.pontos.map((p) => [round(p.lon, 4), round(p.lat, 4)]);
      await db.query(
        `INSERT INTO analise.trajetoria (dia, meteo, chegada_em, nivel_hpa, pontos, geom, parou_h)
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::int > 1 THEN ST_SetSRID(ST_GeomFromGeoJSON($7), 4326) END, $8)`,
        [
          dia,
          meteo,
          new Date(l.chegada_em),
          l.nivel_hpa,
          JSON.stringify(l.pontos.map((p) => ({ h: p.h, lat: round(p.lat, 4), lon: round(p.lon, 4), hpa: round(p.hpa, 1) }))),
          coords.length,
          JSON.stringify({ type: 'LineString', coordinates: coords }),
          l.parou_h,
        ],
      );
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

const round = (x: number, casas: number) => Math.round(x * 10 ** casas) / 10 ** casas;

/**
 * Wind files of the day (ERA5 if complete, else GFS, unless `meteo` is forced) → trajectories in the database.
 * `parcial`: the day is not over, so only the arrivals that already have GFS wind (the latest ones first dropped).
 */
export async function trajetoriasDoDia(
  db: pg.ClientBase,
  dia: string,
  meteo?: Meteo,
  parcial = false,
): Promise<{ meteo: Meteo; chegadas: number }> {
  const era5 =
    meteo !== 'gfs' && !parcial
      ? arquivosEra5(
          (await listKeys('bruto/ecmwf-cds/')).map((k) => k.key),
          dia,
        )
      : null;
  let gfs: string[] | null = null;
  let ate: number | undefined;
  if (!era5 && meteo !== 'era5') {
    const chaves = (await listKeys('bruto/noaa-gfs-nomads/')).map((k) => k.key);
    for (const t of parcial ? chegadas(dia).reverse() : [undefined]) {
      gfs = arquivosGfs(chaves, dia, t);
      ate = t;
      if (gfs) break;
    }
  }
  const usado: Meteo | null = era5 ? 'era5' : gfs ? 'gfs' : null;
  if (!usado) throw new Error(`${dia}: falta vento ${meteo ?? 'ERA5 ou GFS'} para as 72 h`);
  const tmp = mkdtempSync(join(tmpdir(), 'trajetorias-'));
  try {
    const locais = [];
    for (const [i, k] of (era5 ?? gfs)!.entries()) {
      const local = join(tmp, `${i}.grib`);
      await pipeline(await openRaw(k), createWriteStream(local));
      locais.push(local);
    }
    const linhas = calcularDia(ventoDaGrade(lerGribs(locais)), dia, ate);
    await gravarDia(db, dia, usado, linhas);
    return { meteo: usado, chegadas: linhas.length / NIVEIS_SAIDA.length };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function principal(args: string[]) {
  const arg = (n: string) => args[args.indexOf(n) + 1];
  const dia = arg('--dia');
  const meteo = args.includes('--meteo') ? (arg('--meteo') as Meteo) : undefined;
  if (!/^\d{4}-\d\d-\d\d$/.test(dia ?? '') || (meteo && !['era5', 'gfs'].includes(meteo)))
    throw new Error('uso: npm run trajetorias -- --dia AAAA-MM-DD [--meteo era5|gfs]');
  const db = new pg.Client();
  await db.connect();
  try {
    const r = await trajetoriasDoDia(db, dia, meteo);
    console.log(`${dia}: ${r.chegadas} chegadas × ${NIVEIS_SAIDA.length} níveis com ${r.meteo}`);
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
