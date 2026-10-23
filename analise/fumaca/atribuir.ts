// Smoke attribution (#17, #50): "where did today's smoke come from?" for one Manaus day, from the layer 2 tables.
//   npm run fumaca -- --dia 2026-10-21 [--v1]
// v0 = straight-line wind heuristic (numbers in heuristica.ts); v1 = spots near the day's back-trajectories (v1.ts),
// which must be in analise.trajetoria already (npm run trajetorias). Writes analise.fumaca_dia and analise.fumaca_foco;
// re-running a day replaces that version only.
import pg from 'pg';
import { MANAUS } from '../../coleta/regiao.ts';
import { confidence, meanWind, PARAMS, rankMunicipios, weighSpots, type Hour, type Spot, type Weighted } from './heuristica.ts';
import { concordancia, confiancaV1, PARAMS_V1, pesarFocosV1, type Traj } from './v1.ts';

export const VERSION = 'v0';
export const NOTE = 'Heurística v0: vento sobre Manaus (925/850 hPa, modelo) em linha reta até os focos; não é trajetória.';
export const NOTE_V1 =
  'Atribuição v1: retrotrajetórias de até 72 h saindo de Manaus a ~500, 1000 e 1500 m, com vento de modelo; contam os focos perto do caminho do ar, na hora em que ele passou.';
export type Versao = 'v0' | 'v1';

/** UTC bounds of a Manaus day (UTC-4, no daylight saving). */
export function dayBounds(dia: string): { start: Date; end: Date } {
  const start = new Date(`${dia}T04:00:00Z`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

const H = 3600_000;

type Parte = { weighted: Weighted[]; vento: object; conf: { level: string; signals: object }; meteo: string | null; nota: string };

const toSpot = (r: any): Spot => ({ id: Number(r.id), lat: r.lat, lon: r.lon, at: r.adquirido_em, frp: r.frp, municipio: r.municipio });

/** v1: the day's trajectories (ERA5 when there, else GFS, or the one forced) and the spots seen while that air was on its way. */
export async function parteV1(
  db: pg.ClientBase,
  dia: string,
  measured: number | null,
  model: number | null,
  forcado?: 'era5' | 'gfs',
): Promise<Parte> {
  const meteo = (
    await db.query(
      `SELECT meteo FROM analise.trajetoria WHERE dia = $1 AND ($2::text IS NULL OR meteo = $2) GROUP BY meteo ORDER BY meteo = 'era5' DESC LIMIT 1`,
      [dia, forcado ?? null],
    )
  ).rows[0]?.meteo;
  if (!meteo) throw new Error(`${dia}: sem trajetórias (rode npm run trajetorias -- --dia ${dia})`);
  const trajs: Traj[] = (
    await db.query(
      `SELECT extract(epoch FROM chegada_em) * 1000 AS chegada, pontos FROM analise.trajetoria WHERE dia = $1 AND meteo = $2 ORDER BY chegada_em, nivel_hpa`,
      [dia, meteo],
    )
  ).rows.map((r) => ({ chegada: Number(r.chegada), pontos: r.pontos }));
  const chegadas = trajs.map((t) => t.chegada);
  const horasAtras = Math.max(...trajs.map((t) => -t.pontos.at(-1)!.h));
  const spots = await db.query(
    `SELECT id, lat, lon, adquirido_em, coalesce(frp, 0) AS frp, municipio FROM firms.foco WHERE adquirido_em >= $1 AND adquirido_em <= $2`,
    [new Date(Math.min(...chegadas) - (horasAtras + PARAMS_V1.janelaH) * H), new Date(Math.max(...chegadas) + PARAMS_V1.janelaH * H)],
  );
  const weighted = pesarFocosV1(MANAUS, trajs, spots.rows.map(toSpot));
  const c = concordancia(trajs);
  return {
    weighted,
    vento: {
      meteo,
      trajetorias: trajs.length,
      chegadas: new Set(chegadas).size,
      concordancia_km: c.km_medio,
      // Hours each trajectory stayed inside the wind box (the east edge is 16° from Manaus since #56; it was 8°).
      horas_media: trajs.reduce((a, t) => a - t.pontos.at(-1)!.h, 0) / trajs.length,
      niveis: '950/900/850 hPa (modelo)',
    },
    conf: confiancaV1({ trajetoriasConcordam: c.concordam, spotsInSector: weighted.length, measuredPm25: measured, modelPm25: model }),
    meteo,
    nota: NOTE_V1,
  };
}

/** v0: hourly wind over Manaus in a straight line to the spots. */
async function parteV0(db: pg.ClientBase, dia: string, measured: number | null, model: number | null): Promise<Parte> {
  const { start, end } = dayBounds(dia);
  // Hourly wind: newest download for each hour, vector mean of 925 and 850 hPa.
  const wind = await db.query(
    `SELECT DISTINCT ON (valido_em) valido_em, wind_speed_925hpa AS s925, wind_direction_925hpa AS d925,
            wind_speed_850hpa AS s850, wind_direction_850hpa AS d850
     FROM openmeteo.tempo_hora WHERE valido_em >= $1 AND valido_em < $2 ORDER BY valido_em, rodada_em DESC`,
    [start, end],
  );
  const hours: Hour[] = wind.rows
    .filter((r) => r.s925 !== null && r.s850 !== null)
    .map((r) => ({
      start: r.valido_em,
      wind: meanWind([
        { speedKmh: r.s925, fromDeg: r.d925 },
        { speedKmh: r.s850, fromDeg: r.d850 },
      ]),
    }));
  // Spots that could arrive during the day: up to maxKm / minSpeed hours earlier, ± the window.
  const back = (PARAMS.maxKm / PARAMS.minSpeedKmh + PARAMS.windowH) * H;
  const spots = await db.query(
    `SELECT id, lat, lon, adquirido_em, coalesce(frp, 0) AS frp, municipio FROM firms.foco
     WHERE adquirido_em >= $1 AND adquirido_em < $2
       AND ST_DWithin(geom::geography, ST_SetSRID(ST_Point($3, $4), 4326)::geography, $5)`,
    [new Date(start.getTime() - back), new Date(end.getTime() + PARAMS.windowH * H), MANAUS.lon, MANAUS.lat, PARAMS.maxKm * 1000 + 1000],
  );
  const weighted = weighSpots(MANAUS, hours, spots.rows.map(toSpot));
  const dayWind = meanWind(hours.map((h) => h.wind));
  return {
    weighted,
    vento: {
      de_graus: dayWind.fromDeg,
      velocidade_kmh: dayWind.speedKmh,
      constancia: dayWind.steadiness,
      horas_com_dado: hours.length,
      niveis: '925+850 hPa (modelo)',
    },
    conf: confidence({ steadiness: dayWind.steadiness, spotsInSector: weighted.length, measuredPm25: measured, modelPm25: model }),
    meteo: null,
    nota: NOTE,
  };
}

export async function attributeDay(db: pg.ClientBase, dia: string, versao: Versao = 'v0') {
  const { start, end } = dayBounds(dia);
  const measured = (
    await db.query(
      `SELECT avg(valor) AS media, max(valor) AS max, count(*)::int AS horas FROM openaq.medicao
     WHERE parametro = 'pm25' AND fim > $1 AND fim <= $2`,
      [start, end],
    )
  ).rows[0];
  const model = (
    await db.query(
      `SELECT avg(pm2_5) AS media, max(pm2_5) AS max FROM (
       SELECT DISTINCT ON (valido_em) pm2_5 FROM openmeteo.ar_hora WHERE valido_em >= $1 AND valido_em < $2 ORDER BY valido_em, rodada_em DESC) x`,
      [start, end],
    )
  ).rows[0];
  const metar = (
    await db.query(
      `SELECT count(DISTINCT date_trunc('hour', observado_em)) FILTER (WHERE EXISTS (SELECT 1 FROM unnest(tempo) t WHERE t ~ '(FU|HZ)'))::int AS fu_hz,
            min(visibilidade_m) AS vis_min
     FROM metar.observacao WHERE estacao = 'SBEG' AND observado_em >= $1 AND observado_em < $2`,
      [start, end],
    )
  ).rows[0];
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const { weighted, vento, conf, meteo, nota } = await (versao === 'v1' ? parteV1 : parteV0)(
    db,
    dia,
    num(measured.media),
    num(model.media),
  );
  const total = weighted.reduce((t, s) => t + s.weight, 0);

  const names = new Map((await db.query('SELECT codigo, nome, uf FROM ibge.municipio')).rows.map((r) => [r.codigo, r]));
  const ranking = rankMunicipios(weighted).map((m) => ({
    municipio: m.municipio,
    nome: m.municipio === null ? 'fora do Brasil' : names.get(m.municipio)?.nome,
    uf: names.get(m.municipio ?? -1)?.uf ?? null,
    peso: m.weight,
    parcela: m.share,
    focos: m.spots,
  }));
  const top = weighted.slice(0, 20).map((s) => ({
    foco: s.id,
    lat: s.lat,
    lon: s.lon,
    em: s.at,
    frp: s.frp,
    municipio: s.municipio,
    peso: s.weight,
    distancia_km: s.distanceKm,
  }));

  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM analise.fumaca_dia WHERE dia = $1 AND versao = $2', [dia, versao]);
    await db.query(
      `INSERT INTO analise.fumaca_dia (dia, versao, pm25_medido_media, pm25_medido_max, pm25_medido_horas, pm25_cams_media, pm25_cams_max,
         horas_fu_hz, visibilidade_min_m, vento, focos_contados, peso_total, ranking, confianca, sinais, nota, meteo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        dia,
        versao,
        measured.media,
        measured.max,
        measured.horas,
        model.media,
        model.max,
        metar.fu_hz,
        metar.vis_min,
        vento,
        weighted.length,
        total,
        JSON.stringify({ municipios: ranking, focos: top }),
        conf.level,
        conf.signals,
        nota,
        meteo,
      ],
    );
    await db.query(
      `INSERT INTO analise.fumaca_foco (dia, versao, foco, peso, distancia_km, azimute, horas)
       SELECT $1, $2, f, p, d, a, h FROM unnest($3::bigint[], $4::real[], $5::real[], $6::real[], $7::int[]) AS x(f, p, d, a, h)`,
      [
        dia,
        versao,
        weighted.map((s) => s.id),
        weighted.map((s) => s.weight),
        weighted.map((s) => s.distanceKm),
        weighted.map((s) => s.bearingDeg),
        weighted.map((s) => s.hours),
      ],
    );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
  return { dia, versao, meteo, counted: weighted.length, total, ranking, confianca: conf, measured, model, metar, vento };
}

/** Removes the day's v1 if it came from fewer than 8 arrivals (the 17h partial); the rows removed (0 or 1). */
export async function apagarV1Parcial(db: pg.ClientBase, dia: string): Promise<number> {
  // fumaca_foco goes with it (ON DELETE CASCADE).
  const r = await db.query(`DELETE FROM analise.fumaca_dia WHERE dia = $1 AND versao = 'v1' AND (vento->>'chegadas')::int < 8`, [dia]);
  return r.rowCount ?? 0;
}

async function main(args: string[]) {
  const i = args.indexOf('--dia');
  const dia = i >= 0 ? args[i + 1] : undefined;
  if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error('usage: npm run fumaca -- --dia AAAA-MM-DD [--v1]');
  const versao: Versao = args.includes('--v1') ? 'v1' : 'v0';
  const db = new pg.Client();
  await db.connect();
  try {
    const r = await attributeDay(db, dia, versao);
    console.log(r.versao === 'v1' ? NOTE_V1 : NOTE);
    console.log(JSON.stringify({ ...r, ranking: r.ranking.slice(0, 5) }, null, 1));
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
