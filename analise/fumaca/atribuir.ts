// Smoke attribution v0 (#17): "where did today's smoke come from?" for one Manaus day, from the layer 2 tables.
//   npm run fumaca -- --dia 2026-10-21
// Writes analise.fumaca_dia and analise.fumaca_foco (re-running the day replaces it). All numbers are in heuristica.ts.
import pg from 'pg';
import { MANAUS } from '../../coleta/regiao.ts';
import { confidence, meanWind, PARAMS, rankMunicipios, weighSpots, type Hour, type Spot } from './heuristica.ts';

export const VERSION = 'v0';
export const NOTE = 'Heurística v0: vento sobre Manaus (925/850 hPa, modelo) em linha reta até os focos; não é trajetória.';

/** UTC bounds of a Manaus day (UTC-4, no daylight saving). */
export function dayBounds(dia: string): { start: Date; end: Date } {
  const start = new Date(`${dia}T04:00:00Z`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

const H = 3600_000;

export async function attributeDay(db: pg.ClientBase, dia: string) {
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
  const weighted = weighSpots(
    MANAUS,
    hours,
    spots.rows.map((r): Spot => ({ id: Number(r.id), lat: r.lat, lon: r.lon, at: r.adquirido_em, frp: r.frp, municipio: r.municipio })),
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

  const dayWind = meanWind(hours.map((h) => h.wind));
  const vento = {
    de_graus: dayWind.fromDeg,
    velocidade_kmh: dayWind.speedKmh,
    constancia: dayWind.steadiness,
    horas_com_dado: hours.length,
    niveis: '925+850 hPa (modelo)',
  };
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const conf = confidence({
    steadiness: dayWind.steadiness,
    spotsInSector: weighted.length,
    measuredPm25: num(measured.media),
    modelPm25: num(model.media),
  });

  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM analise.fumaca_dia WHERE dia = $1 AND versao = $2', [dia, VERSION]);
    await db.query(
      `INSERT INTO analise.fumaca_dia (dia, versao, pm25_medido_media, pm25_medido_max, pm25_medido_horas, pm25_cams_media, pm25_cams_max,
         horas_fu_hz, visibilidade_min_m, vento, focos_contados, peso_total, ranking, confianca, sinais, nota)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        dia,
        VERSION,
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
        NOTE,
      ],
    );
    await db.query(
      `INSERT INTO analise.fumaca_foco (dia, versao, foco, peso, distancia_km, azimute, horas)
       SELECT $1, $2, f, p, d, a, h FROM unnest($3::bigint[], $4::real[], $5::real[], $6::real[], $7::int[]) AS x(f, p, d, a, h)`,
      [
        dia,
        VERSION,
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
  return { dia, hours: hours.length, counted: weighted.length, total, ranking, confianca: conf, measured, model, metar, vento };
}

async function main(args: string[]) {
  const i = args.indexOf('--dia');
  const dia = i >= 0 ? args[i + 1] : undefined;
  if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error('usage: npm run fumaca -- --dia AAAA-MM-DD');
  const db = new pg.Client();
  await db.connect();
  try {
    const r = await attributeDay(db, dia);
    console.log(NOTE);
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
