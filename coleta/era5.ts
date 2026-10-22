// ERA5 (#47): wind on pressure levels (u, v, ω; 1000–700 hPa; every 3 h; 0.5°) over the smoke region, from the CDS API
// with plain fetch, into the raw files through baixar(). ERA5 is a reanalysis: modeled, not measured.
//   node coleta/era5.ts                       daily (slice cron): the full days 6 to 10 days ago not yet in R2, one request per month
//   node coleta/era5.ts --history 2026-07-29  one-off on this PC: one request per month, up to 6 days ago
// The raw name carries the period (era5-pl_AAAA-MM-DD.grib or era5-pl_AAAA-MM-DD_AAAA-MM-DD.grib); the trajectory
// reader (#49) finds the file of each hour by it.
import { readFile } from 'node:fs/promises';
import { setTimeout as esperar } from 'node:timers/promises';
import { baixar, listKeys } from './lib/baixar.ts';
import { tentar } from './lib/tentar.ts';
import { BBOX } from './regiao.ts';

const API = 'https://cds.climate.copernicus.eu/api/retrieve/v1';
const DATASET = 'reanalysis-era5-pressure-levels';
export const NIVEIS = ['700', '800', '850', '900', '925', '950', '975', '1000'];
export const HORAS = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
const DIA = 86_400_000;
// ERA5T comes out ~5 days late, the newest day only up to 12 UTC: ask only full days.
const MAIS_NOVO = 6;
const MAIS_VELHO = 10;

const dias = (inicio: string, fim: string) => {
  const out = [];
  for (let t = Date.parse(inicio); t <= Date.parse(fim); t += DIA) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

/** The CDS request body for the days from `inicio` to `fim` (same month). */
export function pedido(inicio: string, fim: string) {
  if (inicio.slice(0, 7) !== fim.slice(0, 7)) throw new Error(`o pedido tem que ser do mesmo mês: ${inicio} a ${fim}`);
  return {
    inputs: {
      product_type: ['reanalysis'],
      variable: ['u_component_of_wind', 'v_component_of_wind', 'vertical_velocity'],
      pressure_level: NIVEIS,
      year: [inicio.slice(0, 4)],
      month: [inicio.slice(5, 7)],
      day: dias(inicio, fim).map((d) => d.slice(8)),
      time: HORAS,
      area: [BBOX.norte, BBOX.oeste, BBOX.sul, BBOX.leste],
      grid: ['0.5', '0.5'],
      data_format: 'grib',
      download_format: 'unarchived',
    },
  };
}

export const nomeBruto = (inicio: string, fim: string) => `era5-pl_${inicio === fim ? inicio : `${inicio}_${fim}`}.grib`;

/** Days already in R2, read from the raw names. */
export function diasCobertos(chaves: string[]): Set<string> {
  const out = new Set<string>();
  for (const k of chaves) {
    const m = k.match(/era5-pl_(\d{4}-\d\d-\d\d)(?:_(\d{4}-\d\d-\d\d))?\.grib$/);
    if (m) for (const d of dias(m[1], m[2] ?? m[1])) out.add(d);
  }
  return out;
}

/** [inicio, fim] of each month between the two days. */
export function meses(inicio: string, fim: string): [string, string][] {
  const out: [string, string][] = [];
  for (let a = inicio; a <= fim;) {
    const [y, m] = a.split('-').map(Number);
    const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const b = ultimo < fim ? ultimo : fim;
    out.push([a, b]);
    a = new Date(Date.parse(b) + DIA).toISOString().slice(0, 10);
  }
  return out;
}

export function diasQueFaltam(chaves: string[], agora = new Date()): string[] {
  const hoje = Date.parse(agora.toISOString().slice(0, 10));
  const ja = diasCobertos(chaves);
  const de = new Date(hoje - MAIS_VELHO * DIA).toISOString().slice(0, 10);
  const ate = new Date(hoje - MAIS_NOVO * DIA).toISOString().slice(0, 10);
  return dias(de, ate).filter((d) => !ja.has(d));
}

/** Missing days → one period per month, first to last missing (a day already there is fetched again; the newest wins). */
export const periodosDiarios = (faltam: string[]) => (faltam.length ? meses(faltam[0], faltam.at(-1)!) : []);

const cabecalhos = () => ({ 'PRIVATE-TOKEN': process.env.ECMWF_KEY ?? '', 'Content-Type': 'application/json' });

/** Submits the request; the job id, or null when the period is not published yet (CDS answers 400). */
export async function submeter(corpo: ReturnType<typeof pedido>, f: typeof fetch = fetch): Promise<string | null> {
  const r = await tentar(async () => {
    const r = await f(`${API}/processes/${DATASET}/execution`, { method: 'POST', headers: cabecalhos(), body: JSON.stringify(corpo) });
    if (r.status >= 500) throw new Error(`HTTP ${r.status} no CDS`);
    return r;
  });
  const j = await r.json();
  if (r.status === 400 && /is available yet/i.test(j.detail ?? '')) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status} no CDS: ${j.detail ?? j.title ?? ''}`);
  return j.jobID;
}

/** Polls the job until it is done; the link and size of the result. */
export async function esperarJob(
  job: string,
  { f = fetch, intervaloMs = 15_000, maxMs = 40 * 60_000 }: { f?: typeof fetch; intervaloMs?: number; maxMs?: number } = {},
): Promise<{ href: string; bytes: number }> {
  const json = async (u: string) => (await f(u, { headers: cabecalhos() })).json();
  const fim = Date.now() + maxMs;
  let errosSeguidos = 0;
  try {
    for (;;) {
      let status: string;
      try {
        status = (await json(`${API}/jobs/${job}`)).status;
        errosSeguidos = 0;
      } catch (e) {
        if (++errosSeguidos > 5) throw e; // a network blip is tolerated, a network that stays down is not
        await esperar(intervaloMs);
        continue;
      }
      if (status === 'successful') {
        const { asset } = await json(`${API}/jobs/${job}/results`);
        return { href: asset.value.href, bytes: asset.value['file:size'] };
      }
      if (status === 'failed' || status === 'rejected' || status === 'dismissed') throw new Error(`job ${job}: ${status}`);
      if (Date.now() > fim) throw new Error(`job ${job} não terminou em ${maxMs / 60_000} min (cancelado; fica para a próxima rodada)`);
      await esperar(intervaloMs);
    }
  } catch (e) {
    // Cancelled: a job left in the queue makes the CDS reject the next request ("maximum number queued").
    await f(`${API}/jobs/${job}`, { method: 'DELETE', headers: cabecalhos() }).catch(() => {});
    throw e;
  }
}

async function baixarPeriodo(inicio: string, fim: string, maxMs?: number): Promise<boolean> {
  const corpo = pedido(inicio, fim);
  const job = await submeter(corpo);
  if (!job) {
    console.log(`${inicio}..${fim}: ainda não publicado`);
    return false;
  }
  const { href } = await esperarJob(job, { maxMs });
  const r = await baixar({
    fonte: 'ecmwf-cds',
    coletor: 'era5',
    nome: nomeBruto(inicio, fim),
    url: href,
    parametros: { dataset: DATASET, inicio, fim, job, ...corpo.inputs },
  });
  if ((await readFile(r.caminho)).subarray(0, 4).toString() !== 'GRIB') throw new Error(`não é GRIB: ${r.chave}`);
  console.log(r.chave, r.bytes);
  return true;
}

async function principal(args: string[]) {
  if (!process.env.ECMWF_KEY) throw new Error('falta ECMWF_KEY');
  const chaves = (await listKeys('bruto/ecmwf-cds/')).map((k) => k.key);
  let periodos: [string, string][];
  const historico = args[0] === '--history';
  if (historico) {
    const ate = new Date(Date.now() - MAIS_NOVO * DIA).toISOString().slice(0, 10);
    const ja = diasCobertos(chaves);
    periodos = meses(args[1] ?? '2026-07-29', ate).filter(([a, b]) => dias(a, b).some((d) => !ja.has(d)));
  } else {
    periodos = periodosDiarios(diasQueFaltam(chaves));
  }
  const um = async ([a, b]: [string, string], maxMs?: number) =>
    baixarPeriodo(a, b, maxMs).then(
      () => 0,
      (e) => (console.error('ERRO', e.message), 1),
    );
  // One request at a time: the CDS rejects a second one queued for the same dataset. The queue passed 1.5 h on 2026-10-22.
  let falhas = 0;
  for (const p of periodos) falhas += await um(p, 3 * 60 * 60_000);
  if (falhas) throw new Error(`${falhas} de ${periodos.length} pedidos falharam`);
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
