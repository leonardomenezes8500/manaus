// Coletor NASA FIRMS (#9): focos de calor dos 4 sensores NRT na caixa da região, pelo baixar().
//   node coleta/firms.ts                          últimos 2 dias (cron a cada 3 h; a sobreposição sai na carga, #15)
//   node coleta/firms.ts --historico 2026-08-01   de uma data até hoje, em janelas de 5 dias (máximo da API)
// Limite da chave: 5000 transações a cada 10 min; o histórico inteiro dá ~70 pedidos.
import { readFile } from 'node:fs/promises';
import { baixar } from './lib/baixar.ts';
import { bboxTexto } from './regiao.ts';

export const SENSORES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'] as const;
export const MAX_DIAS = 5;

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

async function pedir(sensor: string, dias: number, data?: string): Promise<void> {
  const r = await baixar({
    fonte: 'nasa-firms',
    coletor: 'firms',
    url: url(sensor, dias, data),
    nome: data ? `${sensor}_${data}_${dias}d.csv` : `${sensor}.csv`,
    parametros: { sensor, bbox: bboxTexto(), dias, ...(data ? { data } : {}) },
  });
  // Erro da API vem com HTTP 200 e texto no lugar do CSV: fica no bruto (é o que veio), mas a rodada falha.
  const cabecalho = (await readFile(r.caminho, 'utf8')).slice(0, 9);
  if (cabecalho !== 'latitude,') throw new Error(`${sensor}: resposta não é CSV (${r.chave})`);
  console.log(r.chave, r.bytes);
}

async function principal(args: string[]) {
  if (!process.env.FIRMS_MAP_KEY) throw new Error('falta FIRMS_MAP_KEY');
  const pedidos: [string, number, string?][] = [];
  if (args[0] === '--historico') {
    const hoje = new Date().toISOString().slice(0, 10);
    for (const j of janelas(args[1] ?? '2026-08-01', args[2] ?? hoje)) for (const s of SENSORES) pedidos.push([s, j.dias, j.data]);
  } else {
    for (const s of SENSORES) pedidos.push([s, 2]);
  }
  let falhas = 0;
  for (const p of pedidos) {
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
