// Weight of v1 by distance (#99): v1 as it is against dilution by corridor width and a narrower corridor, scored on
// the measured PM2.5 (sensor in the Centro) and the FU/HZ days (#51). Nothing in the database changes: the variants
// are weighed in memory and only new files go to R2. One-off on this PC:
//   node analise/fumaca/peso-distancia.ts [--desde 2026-08-01]   → produtos/fumaca/comparacao-peso-distancia.md and .csv
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { enviar } from '../../coleta/lib/baixar.ts';
import { MANAUS } from '../../coleta/regiao.ts';
import { sorteio, spearman } from '../cruzar.ts';
import { dadosV1 } from './atribuir.ts';
import { separacao } from './comparar.ts';
import type { Weighted } from './heuristica.ts';
import { PARAMS_V1, pesarFocosV1, type ParamsV1 } from './v1.ts';

export const VARIANTES: Record<string, ParamsV1> = {
  v1: PARAMS_V1,
  dilui: { ...PARAMS_V1, diluicao: 1 },
  estreito: { ...PARAMS_V1, corredorFracao: 0.1 },
  'dilui+estreito': { ...PARAMS_V1, diluicao: 1, corredorFracao: 0.1 },
};
const LESTE = -52; // the old east edge of the box: east of it is the Cerrado of MA, PI and TO

/** Total weight and how much of it is east of −52. */
export function resumoPeso(w: Weighted[]) {
  const total = w.reduce((t, s) => t + s.weight, 0);
  return { total, leste: w.reduce((t, s) => t + (s.lon > LESTE ? s.weight : 0), 0) };
}

/**
 * Spearman of each variant's daily weight with the measured PM2.5, and a paired bootstrap over the days of
 * (ρ variant − ρ base): 95% interval. If it holds 0, the variant is not better than the base.
 */
export function rhoContraBase(base: number[], variante: number[], pm: number[], n = 1000, semente = 99) {
  const rnd = sorteio(semente);
  const difs: number[] = [];
  for (let k = 0; k < n; k++) {
    const idx = pm.map(() => Math.floor(rnd() * pm.length));
    const p = idx.map((i) => pm[i]);
    difs.push(
      spearman(
        idx.map((i) => variante[i]),
        p,
      ) -
        spearman(
          idx.map((i) => base[i]),
          p,
        ),
    );
  }
  difs.sort((a, b) => a - b);
  return { rho: spearman(variante, pm), ic95: [difs[Math.floor(0.025 * n)], difs[Math.floor(0.975 * n)]] as [number, number] };
}

const n2 = (v: number) => (Number.isNaN(v) ? '—' : v.toFixed(2).replace('.', ','));
const pct = (v: number) => `${Math.round(v * 100)}%`;

async function principal(args: string[]) {
  const desde = args.includes('--desde') ? args[args.indexOf('--desde') + 1] : '2026-08-01';
  const db = new pg.Client();
  await db.connect();
  try {
    const dias = (
      await db.query(
        `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, meteo, peso_total, pm25_medido_media, horas_fu_hz FROM analise.fumaca_dia
         WHERE versao = 'v1' AND dia >= $1 AND pm25_medido_horas >= 12 ORDER BY dia`,
        [desde],
      )
    ).rows;
    const nomes = Object.keys(VARIANTES);
    const linhas: { dia: string; pm: number; fu: number; guardado: number; v: Record<string, { total: number; leste: number }> }[] = [];
    for (const d of dias) {
      const { trajs, spots } = await dadosV1(db, d.dia, d.meteo);
      const v = Object.fromEntries(nomes.map((k) => [k, resumoPeso(pesarFocosV1(MANAUS, trajs, spots, VARIANTES[k]))]));
      linhas.push({ dia: d.dia, pm: Number(d.pm25_medido_media), fu: d.horas_fu_hz, guardado: Number(d.peso_total), v });
      console.log(d.dia, nomes.map((k) => `${k} ${v[k].total.toFixed(1)}`).join(' '));
    }
    // The base recomputed here must be the v1 stored in the database.
    const desvio = Math.max(...linhas.map((l) => Math.abs(l.v.v1.total - l.guardado) / Math.max(1, l.guardado)));
    const pm = linhas.map((l) => l.pm);
    const base = linhas.map((l) => l.v.v1.total);
    const agosto = linhas.filter((l) => l.dia.slice(5, 7) === '08');
    const frac = (ls: typeof linhas, k: string) => ls.reduce((t, l) => t + l.v[k].leste, 0) / ls.reduce((t, l) => t + l.v[k].total, 0);
    const tabela = nomes.map((k) => {
      const tot = linhas.map((l) => l.v[k].total);
      const r = rhoContraBase(base, tot, pm);
      const s = separacao(linhas.map((l) => ({ fu: l.fu > 0, peso: l.v[k].total })));
      return `| ${k} | ${n2(r.rho)} | ${k === 'v1' ? '—' : `${n2(r.ic95[0])} a ${n2(r.ic95[1])}`} | ${n2(s.razao_medianas)} | ${s.fu_no_quartil_de_cima} de ${s.dias_fu} | ${pct(frac(linhas, k))} | ${agosto.length ? pct(frac(agosto, k)) : '—'} |`;
    });
    const md = [
      '# Fumaça: peso da v1 pela distância (#99)',
      '',
      `De ${linhas[0]?.dia ?? '—'} a ${linhas.at(-1)?.dia ?? '—'}: ${linhas.length} dias com v1 e PM2.5 medido (12 h ou mais), ${linhas.filter((l) => l.fu > 0).length} com FU/HZ no aeroporto Eduardo Gomes.`,
      'Variantes calculadas só para comparar; o relatório segue com a v1. dilui = o peso de cada foco é dividido por quanto o corredor alargou até ali (25 km na saída, 25 km + 20% do caminho depois). estreito = corredor de 25 km + 10% do caminho (a v1 usa 20%).',
      `A v1 recalculada aqui difere da guardada no banco em até ${pct(desvio)} num dia.`,
      '',
      '| versão | ρ com PM2.5 medido | ρ − ρ da v1 (IC 95%) | peso mediano FU ÷ sem FU | dias FU no quarto de cima | peso a leste de −52 | idem, agosto |',
      '|---|---|---|---|---|---|---|',
      ...tabela,
      '',
      'ρ = correlação de Spearman entre o peso total do dia e o PM2.5 médio medido no dia (1 sensor barato no Centro, OpenAQ). IC por bootstrap pareado dos dias (1.000 sorteios): se inclui o zero, a variante não é melhor nem pior que a v1 com estes dados.',
      '',
    ].join('\n');
    const csv = [
      ['dia', 'pm25_medido', 'horas_fu_hz', ...nomes.flatMap((k) => [`peso_${k}`, `leste_${k}`])].join(','),
      ...linhas.map((l) =>
        [l.dia, l.pm.toFixed(1), l.fu, ...nomes.flatMap((k) => [l.v[k].total.toFixed(2), l.v[k].leste.toFixed(2)])].join(','),
      ),
    ].join('\n');
    const dir = await mkdtemp(join(tmpdir(), 'peso-distancia-'));
    try {
      for (const [nome, texto] of [
        ['comparacao-peso-distancia.md', md],
        ['comparacao-peso-distancia.csv', csv + '\n'],
      ]) {
        await writeFile(join(dir, nome), texto);
        await enviar(join(dir, nome), `produtos/fumaca/${nome}`, { sobrescrever: true });
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    console.log(md);
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
