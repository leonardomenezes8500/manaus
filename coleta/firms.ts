// Coletor NASA FIRMS (#9): focos de calor dos 4 sensores NRT na caixa da região, pelo baixar().
//   node coleta/firms.ts                          últimos 2 dias (cron a cada 3 h; a sobreposição sai na carga, #15)
//   node coleta/firms.ts --historico 2026-08-01   de uma data até hoje, em janelas de 5 dias (máximo da API)
//   node coleta/firms.ts --arquivo 2012-01-20 [fim]   arquivo padrão (SP) da S-NPP e do MODIS, em gzip, para a série (#52, #77);
//                                                     retoma de onde parou (pula as janelas que já estão no R2)
// Limite da chave: 5000 transações a cada 10 min; o histórico inteiro dá ~70 pedidos, o arquivo ~2.100.
import { setTimeout as esperar } from 'node:timers/promises';
import { baixar, listKeys, readRaw } from './lib/baixar.ts';
import { bboxTexto } from './regiao.ts';

export const SENSORES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'] as const;
export const MAX_DIAS = 5;
export const SENSORES_SP = ['VIIRS_SNPP_SP', 'MODIS_SP'] as const;
const nomeArquivo = (sensor: string, data: string, dias: number) => `${sensor}_${data}_${dias}d.csv`;

/**
 * SP windows of the period for both sensors, inside each archive (`periodoSp`, [first, last] day from data_availability),
 * minus the ones whose days are all in R2 already (stored as .csv.gz, any start date). A window past the end would come
 * back empty, be saved, and then be skipped for good once the archive grows; one before the start is a wasted request.
 */
export function pedidosArquivo(
  inicio: string,
  fim: string,
  chaves: string[],
  periodoSp: Record<(typeof SENSORES_SP)[number], [string, string]>,
) {
  const ja = new Set<string>(); // `${sensor}|${day}`
  for (const k of chaves) {
    const m = k.match(/Z_(\w+_SP)_(\d{4}-\d\d-\d\d)_(\d+)d\.csv\.gz$/);
    if (m) for (let i = 0; i < Number(m[3]); i++) ja.add(`${m[1]}|${somarDias(m[2], i)}`);
  }
  return SENSORES_SP.flatMap((sensor) => {
    const [de, ate] = [
      inicio > periodoSp[sensor][0] ? inicio : periodoSp[sensor][0],
      fim < periodoSp[sensor][1] ? fim : periodoSp[sensor][1],
    ];
    return de > ate
      ? []
      : janelas(de, ate)
          .map((j) => ({ sensor: sensor as string, dias: j.dias, data: j.data }))
          .filter((p) => !Array.from({ length: p.dias }, (_, i) => somarDias(p.data, i)).every((d) => ja.has(`${p.sensor}|${d}`)));
  });
}

const somarDias = (dia: string, n: number) => new Date(Date.parse(dia) + n * 86_400_000).toISOString().slice(0, 10);

/** Janelas de até `max` dias, de `inicio` até `fim` (inclusive), no formato da API (data inicial + nº de dias). */
export function janelas(inicio: string, fim: string, max = MAX_DIAS): { data: string; dias: number }[] {
  const dia = 86_400_000;
  const a = Date.parse(inicio + 'T00:00:00Z');
  const b = Date.parse(fim + 'T00:00:00Z');
  if (!(a <= b)) throw new Error(`intervalo inválido: ${inicio} a ${fim}`);
  const saida = [];
  for (let t = a; t <= b; t += max * dia) {
    saida.push({ data: new Date(t).toISOString().slice(0, 10), dias: Math.min(max, (b - t) / dia + 1) });
  }
  return saida;
}

const url = (sensor: string, dias: number, data?: string) =>
  `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${process.env.FIRMS_MAP_KEY}/${sensor}/${bboxTexto()}/${dias}${data ? '/' + data : ''}`;

async function pedir(sensor: string, dias: number, data?: string, gzip = false): Promise<void> {
  const r = await baixar({
    fonte: 'nasa-firms',
    coletor: 'firms',
    url: url(sensor, dias, data),
    nome: data ? nomeArquivo(sensor, data, dias) : `${sensor}.csv`,
    parametros: { sensor, bbox: bboxTexto(), dias, ...(data ? { data } : {}) },
    gzip,
  });
  // Erro da API vem com HTTP 200 e texto no lugar do CSV: fica no bruto (é o que veio), mas a rodada falha.
  const cabecalho = (await readRaw(r.chave)).slice(0, 9);
  if (cabecalho !== 'latitude,') throw new Error(`${sensor}: resposta não é CSV (${r.chave})`);
  console.log(r.chave, r.bytes);
}

/** First and last day (AAAA-MM-DD) of a FIRMS source, e.g. VIIRS_SNPP_SP, from the API data_availability. */
export async function periodoDaFonte(fonte: string): Promise<[string, string]> {
  const csv = await (await fetch(`https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/${process.env.FIRMS_MAP_KEY}/ALL`)).text();
  const m = csv.match(new RegExp(`^${fonte},([\\d-]+),([\\d-]+)`, 'm'));
  if (!m) throw new Error(`${fonte} não encontrado no data_availability`);
  return [m[1], m[2]];
}

export const fimDaFonte = async (fonte: string) => (await periodoDaFonte(fonte))[1];

async function principal(args: string[]) {
  if (!process.env.FIRMS_MAP_KEY) throw new Error('falta FIRMS_MAP_KEY');
  const pedidos: [string, number, string?, boolean?][] = [];
  if (args[0] === '--arquivo') {
    const fim = args[2] ?? new Date().toISOString().slice(0, 10);
    const chaves = (await listKeys('bruto/nasa-firms/')).map((k) => k.key);
    const periodoSp = { VIIRS_SNPP_SP: await periodoDaFonte('VIIRS_SNPP_SP'), MODIS_SP: await periodoDaFonte('MODIS_SP') };
    for (const p of pedidosArquivo(args[1] ?? '2012-01-20', fim, chaves, periodoSp)) pedidos.push([p.sensor, p.dias, p.data, true]);
  } else if (args[0] === '--historico') {
    const hoje = new Date().toISOString().slice(0, 10);
    for (const j of janelas(args[1] ?? '2026-08-01', args[2] ?? hoje)) for (const s of SENSORES) pedidos.push([s, j.dias, j.data]);
  } else {
    for (const s of SENSORES) pedidos.push([s, 2]);
  }
  let falhas = 0;
  for (const p of pedidos) {
    // The archive is ~2,100 requests: a short pause keeps well under 5,000 per 10 min.
    if (p[3]) await esperar(150);
    try {
      await pedir(...p);
    } catch (e) {
      falhas++;
      console.error('ERRO', (e as Error).message);
    }
  }
  if (falhas) throw new Error(`${falhas} de ${pedidos.length} pedidos falharam`);
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
