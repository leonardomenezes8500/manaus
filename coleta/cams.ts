// CAMS reanalysis EAC4 (#89): PM2.5 and PM10 every 3 h at Manaus, from the Copernicus ADS (same API, account and key
// as the CDS of the ERA5, #47), one request per year in GRIB through baixar(), then the daily mean of the Manaus day at
// the grid point nearest the Centre in cams.pm25_dia. MODELED (it is the model behind the INPE SISAM), never measured.
//   node coleta/cams.ts --history 2012      this PC, by hand; the ADS queue can take long (the wait runs in the background)
// Archived forecast (#113): one request per fire season, PM2.5 of the Manaus day 1 and 2 days ahead in cams.previsao_dia.
//   node coleta/cams.ts --previsao 2015
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { esperarJob, submeter } from './era5.ts';
import { baixar, listKeys, openRaw } from './lib/baixar.ts';
import { gdalR2Env } from './lib/raster.ts';
import { tentar } from './lib/tentar.ts';
import { MANAUS } from './regiao.ts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ADS = { api: 'https://ads.atmosphere.copernicus.eu/api/retrieve/v1', dataset: 'cams-global-reanalysis-eac4' };
const H = 3_600_000;
const CAMPO: Record<string, 'pm25' | 'pm10'> = { PM2P5: 'pm25', PM10: 'pm10' };

/** One year, 2° around Manaus (N, W, S, E), every 3 h. */
export function pedidoAno(ano: number) {
  const r = (x: number) => Math.round(x * 100) / 100;
  return {
    inputs: {
      variable: ['particulate_matter_2.5um', 'particulate_matter_10um'],
      date: [`${ano}-01-01/${ano}-12-31`],
      time: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
      area: [r(MANAUS.lat + 2), r(MANAUS.lon - 2), r(MANAUS.lat - 2), r(MANAUS.lon + 2)],
      data_format: 'grib',
    },
  };
}

/**
 * Archived CAMS forecast (#113): the 00 UTC runs that cover the Manaus days of the fire season (Aug to Nov) of `ano`
 * with 1 and 2 days ahead, PM2.5 only. Lead 30 to 51 h = the Manaus day after the run (06Z to 03Z, as the EAC4 day);
 * 54 to 75 h = two days after.
 */
export function pedidoPrevisao(ano: number) {
  return {
    inputs: {
      variable: ['particulate_matter_2.5um'],
      date: [`${ano}-07-30/${ano}-11-29`],
      time: ['00:00'],
      leadtime_hour: Array.from({ length: 16 }, (_, i) => String(30 + 3 * i)),
      type: ['forecast'],
      area: pedidoAno(ano).inputs.area,
      data_format: 'grib',
    },
  };
}

export type Registro = { t: number; campo: 'pm25' | 'pm10'; valor: number; rodada: number };

/** The value of every band at the grid point nearest Manaus (gdallocationinfo picks the pixel), in µg/m³. */
export function lerGrib(arquivo: string): Registro[] {
  const info = JSON.parse(execFileSync('gdalinfo', ['-json', arquivo], { maxBuffer: 256 << 20, env: gdalR2Env() }).toString());
  const valores = execFileSync('gdallocationinfo', ['-valonly', '-wgs84', arquivo, String(MANAUS.lon), String(MANAUS.lat)], {
    env: gdalR2Env(),
    maxBuffer: 64 << 20,
  })
    .toString()
    .trim()
    .split('\n')
    .map(Number);
  return info.bands.flatMap((b: { metadata: { '': Record<string, string> } }, i: number) => {
    const m = b.metadata[''];
    const campo = CAMPO[m.GRIB_ELEMENT];
    return campo && Number.isFinite(valores[i])
      ? [{ t: parseInt(m.GRIB_VALID_TIME) * 1000, campo, valor: valores[i] * 1e9, rodada: parseInt(m.GRIB_REF_TIME) * 1000 }]
      : [];
  });
}

/** Mean of each Manaus day (UTC−4: 06Z of the day to 03Z of the next), only days with all 8 times of both fields. */
export function mediaDiaria(r: Registro[]) {
  const dias = new Map<string, { pm25: number[]; pm10: number[] }>();
  for (const x of r) {
    const dia = new Date(x.t - 4 * H - 2 * H).toISOString().slice(0, 10); // 06Z..03Z(+1) → the same Manaus day
    const d = dias.get(dia) ?? { pm25: [], pm10: [] };
    d[x.campo].push(x.valor);
    dias.set(dia, d);
  }
  const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  return [...dias]
    .filter(([, d]) => d.pm25.length === 8 && d.pm10.length === 8)
    .map(([dia, d]) => ({ dia, pm25: media(d.pm25), pm10: media(d.pm10), produto: 'eac4' }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

/** Mean PM2.5 forecast of each Manaus day per days ahead (Manaus day minus the run's date), only with all 8 times. */
export function mediaPrevisao(r: Registro[]) {
  const grupos = new Map<string, { dia: string; antecedencia: number; v: number[] }>();
  for (const x of r) {
    if (x.campo !== 'pm25') continue;
    const dia = new Date(x.t - 4 * H - 2 * H).toISOString().slice(0, 10);
    const antecedencia = (Date.parse(dia) - Date.parse(new Date(x.rodada).toISOString().slice(0, 10))) / (24 * H);
    const g = grupos.get(`${dia}|${antecedencia}`) ?? { dia, antecedencia, v: [] };
    g.v.push(x.valor);
    grupos.set(`${dia}|${antecedencia}`, g);
  }
  return [...grupos.values()]
    .filter((g) => g.v.length === 8)
    .map(({ dia, antecedencia, v }) => ({ dia, antecedencia, pm25: v.reduce((s, x) => s + x, 0) / 8 }))
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.antecedencia - b.antecedencia);
}

async function principal(args: string[]) {
  if (!process.env.ECMWF_KEY) throw new Error('falta ECMWF_KEY');
  const prev = args.includes('--previsao');
  const de = Number(args[args.indexOf(prev ? '--previsao' : '--history') + 1] ?? (prev ? 2015 : 2012));
  const ads = prev ? { ...ADS, dataset: 'cams-global-atmospheric-composition-forecasts' } : ADS;
  const pedido = prev ? pedidoPrevisao : pedidoAno;
  const nome = (ano: number) => (prev ? `cams-previsao_pm25_${ano}.grib` : `cams-eac4_pm_${ano}.grib`);
  const prefixo = prev ? 'cams-previsao_' : 'cams-eac4_';
  const noBruto = () =>
    listKeys('bruto/ecmwf-ads/').then((l) => l.map((k) => k.key).filter((k) => k.endsWith('.grib') && k.includes(`Z_${prefixo}`)));
  const ja = await noBruto();
  // One request at a time, newest year last: a year not published yet answers 400 and is skipped.
  for (let ano = de; ano <= new Date().getUTCFullYear() - 1; ano++) {
    if (ja.some((k) => k.endsWith(nome(ano)))) continue;
    const job = await submeter(pedido(ano), fetch, ads);
    if (!job) {
      console.log(`${ano}: ainda não publicado`);
      continue;
    }
    const { href } = await esperarJob(job, { api: ads.api, maxMs: 3 * 60 * 60_000 });
    // The object store drops a connection now and then ("fetch failed" twice on 2026-10-23): retried.
    const b = await tentar(() =>
      baixar({ fonte: 'ecmwf-ads', coletor: 'cams', nome: nome(ano), url: href, parametros: pedido(ano).inputs }),
    );
    console.log(b.chave, b.bytes);
  }
  // Every year in R2 → one list of values → the daily means (a Manaus day can cross the new year).
  const tmp = await mkdtemp(join(process.env.MANAUS_BUFFER || tmpdir(), 'cams-'));
  const registros: Registro[] = [];
  try {
    // A year asked twice (an upload that waited in pendente/) would double its days: only the newest file of each name.
    const maisNovo = new Map((await noBruto()).sort().map((k) => [k.replace(/^.*\/\d{6}Z_/, ''), k]));
    for (const k of maisNovo.values()) {
      const local = join(tmp, 'a.grib');
      const partes: Buffer[] = [];
      for await (const p of await openRaw(k)) partes.push(p as Buffer);
      await writeFile(local, Buffer.concat(partes));
      registros.push(...lerGrib(local));
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  const db = new pg.Client();
  await db.connect();
  try {
    await db.query('BEGIN');
    if (prev) {
      const linhas = mediaPrevisao(registros);
      await db.query('DELETE FROM cams.previsao_dia');
      await db.query(`INSERT INTO cams.previsao_dia SELECT * FROM json_populate_recordset(NULL::cams.previsao_dia, $1::json)`, [
        JSON.stringify(linhas),
      ]);
      const porAno = Object.groupBy(linhas, (l) => `${l.dia.slice(0, 4)} ${l.antecedencia} dia(s)`);
      console.log(
        `cams.previsao_dia: ${linhas.length} linhas`,
        Object.entries(porAno).map(([k, v]) => `${k}: ${v!.length}`),
      );
    } else {
      const linhas = mediaDiaria(registros);
      await db.query("DELETE FROM cams.pm25_dia WHERE produto = 'eac4'");
      await db.query(`INSERT INTO cams.pm25_dia SELECT * FROM json_populate_recordset(NULL::cams.pm25_dia, $1::json)`, [
        JSON.stringify(linhas),
      ]);
      console.log(`cams.pm25_dia: ${linhas.length} dias (${linhas[0]?.dia} a ${linhas.at(-1)?.dia})`);
    }
    await db.query('COMMIT');
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
