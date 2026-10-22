// v0 × v1 (#51): does v1 point elsewhere, and does it tell smoke days from clean days better? Plus how far the
// provisional GFS v1 is from the final ERA5 v1. One-off on this PC, after the season was redone with ERA5:
//   node analise/fumaca/comparar.ts [--desde 2026-08-01]   → produtos/fumaca/comparacao-v0-v1.md and .csv in R2
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { enviar } from '../../coleta/lib/baixar.ts';
import { distanceKm, rankMunicipios } from './heuristica.ts';
import { parteV1 } from './atribuir.ts';
import type { Ponto } from '../trajetoria/integrador.ts';

type Parcela = { municipio: number | null; parcela: number };

/** Σ over municipalities of the smaller of the two shares: 1 = same ranking, 0 = nothing in common. */
export function parcelaEmComum(a: Parcela[], b: Parcela[]): number {
  const pb = new Map(b.map((m) => [m.municipio, m.parcela]));
  return a.reduce((t, m) => t + Math.min(m.parcela, pb.get(m.municipio) ?? 0), 0);
}

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};

/** Weight of FU days against clean days: ratio of the medians and FU days among the top quarter of all days. */
export function separacao(dias: { fu: boolean; peso: number }[]) {
  const fu = dias.filter((d) => d.fu).map((d) => d.peso);
  const limpo = dias.filter((d) => !d.fu).map((d) => d.peso);
  const topo = [...dias].sort((a, b) => b.peso - a.peso).slice(0, Math.ceil(dias.length / 4));
  return { razao_medianas: mediana(fu) / mediana(limpo), fu_no_quartil_de_cima: topo.filter((d) => d.fu).length, dias_fu: fu.length };
}

type T = { chegada: number; nivel_hpa: number; pontos: Ponto[] };

/** Mean distance (km) between the −24 h positions of the same arrival and level in two sets; null when no pair. */
export function distancia24h(a: T[], b: T[]): number | null {
  const em24 = (t: T) => t.pontos.find((p) => p.h === -24);
  const pb = new Map(b.map((t) => [`${t.chegada}|${t.nivel_hpa}`, em24(t)]));
  const d = a.flatMap((t) => {
    const x = em24(t);
    const y = pb.get(`${t.chegada}|${t.nivel_hpa}`);
    return x && y ? [distanceKm(x.lat, x.lon, y.lat, y.lon)] : [];
  });
  return d.length ? d.reduce((s, v) => s + v, 0) / d.length : null;
}

const n2 = (v: number | null) => (v === null || Number.isNaN(v) ? '—' : v.toFixed(2).replace('.', ','));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const top3 = (r: { nome: string | null; uf: string | null; parcela: number }[]) =>
  r
    .slice(0, 3)
    .map((m) => `${m.nome ?? '?'}${m.uf ? '/' + m.uf : ''} ${pct(m.parcela)}`)
    .join(', ') || '—';

async function principal(args: string[]) {
  const desde = args.includes('--desde') ? args[args.indexOf('--desde') + 1] : '2026-08-01';
  const db = new pg.Client();
  await db.connect();
  try {
    const dias = (
      await db.query(
        `SELECT to_char(a.dia, 'YYYY-MM-DD') AS dia, a.horas_fu_hz, a.peso_total AS peso0, b.peso_total AS peso1, a.ranking->'municipios' AS r0,
                b.ranking->'municipios' AS r1, a.confianca AS c0, b.confianca AS c1, b.meteo
         FROM analise.fumaca_dia a JOIN analise.fumaca_dia b ON b.dia = a.dia AND b.versao = 'v1'
         WHERE a.versao = 'v0' AND a.dia >= $1 ORDER BY a.dia`,
        [desde],
      )
    ).rows;
    // FU = smoke reported at SBEG (METAR "FU" or "HZ" hours > 0).
    const comFu = dias.filter((d) => d.horas_fu_hz > 0);
    const s0 = separacao(dias.map((d) => ({ fu: d.horas_fu_hz > 0, peso: d.peso0 })));
    const s1 = separacao(dias.map((d) => ({ fu: d.horas_fu_hz > 0, peso: d.peso1 })));

    // GFS × ERA5 on the days that have trajectories with both winds.
    const ambos: string[] = (
      await db.query(
        `SELECT to_char(dia, 'YYYY-MM-DD') AS dia FROM analise.trajetoria WHERE dia >= $1 GROUP BY dia HAVING count(DISTINCT meteo) = 2 ORDER BY dia`,
        [desde],
      )
    ).rows.map((r) => r.dia);
    const gfsEra5 = [];
    for (const dia of ambos) {
      const traj = async (m: string) =>
        (
          await db.query(
            `SELECT extract(epoch FROM chegada_em) * 1000 AS chegada, nivel_hpa, pontos FROM analise.trajetoria WHERE dia = $1 AND meteo = $2`,
            [dia, m],
          )
        ).rows.map((r) => ({ ...r, chegada: Number(r.chegada) }));
      const [g, e] = [await parteV1(db, dia, null, null, 'gfs'), await parteV1(db, dia, null, null, 'era5')];
      gfsEra5.push({
        dia,
        comum: parcelaEmComum(
          rankMunicipios(g.weighted).map((m) => ({ municipio: m.municipio, parcela: m.share })),
          rankMunicipios(e.weighted).map((m) => ({ municipio: m.municipio, parcela: m.share })),
        ),
        km24: distancia24h(await traj('gfs'), await traj('era5')),
      });
    }

    const linhasFu = comFu.map(
      (d) =>
        `| ${d.dia} | ${d.horas_fu_hz} | ${top3(d.r0)} | ${top3(d.r1)} | ${pct(parcelaEmComum(d.r0, d.r1))} | ${d.c0} / ${d.c1} | ${d.meteo ?? '—'} |`,
    );
    const md = [
      '# Fumaça: atribuição v0 × v1',
      '',
      `De ${desde} a ${dias.at(-1)?.dia ?? '—'}: ${dias.length} dias com as duas versões, ${comFu.length} com fumaça ou névoa seca (FU/HZ) no aeroporto Eduardo Gomes.`,
      'v0 = vento sobre Manaus em linha reta (heurística). v1 = retrotrajetórias de até 72 h com vento de modelo (ERA5; GFS onde o ERA5 ainda não saiu). Nenhuma das duas é medição.',
      '',
      '## Separa os dias de fumaça dos dias limpos?',
      '',
      '| versão | peso mediano FU ÷ sem FU | dias FU no quarto de cima |',
      '|---|---|---|',
      `| v0 | ${n2(s0.razao_medianas)} | ${s0.fu_no_quartil_de_cima} de ${s0.dias_fu} |`,
      `| v1 | ${n2(s1.razao_medianas)} | ${s1.fu_no_quartil_de_cima} de ${s1.dias_fu} |`,
      '',
      '## Dias com FU/HZ: para onde cada versão aponta',
      '',
      '| dia | horas FU/HZ | v0: 3 do topo | v1: 3 do topo | em comum | confiança v0 / v1 | vento v1 |',
      '|---|---|---|---|---|---|---|',
      ...linhasFu,
      '',
      '## GFS (provisório) × ERA5 (final) na v1',
      '',
      '| dia | parcela em comum | distância em −24 h (km) |',
      '|---|---|---|',
      ...gfsEra5.map((x) => `| ${x.dia} | ${pct(x.comum)} | ${x.km24 === null ? '—' : Math.round(x.km24)} |`),
      '',
    ].join('\n');
    const csv = [
      'dia,horas_fu_hz,peso_v0,peso_v1,parcela_em_comum,confianca_v0,confianca_v1,meteo_v1',
      ...dias.map((d) => [d.dia, d.horas_fu_hz, d.peso0, d.peso1, parcelaEmComum(d.r0, d.r1).toFixed(3), d.c0, d.c1, d.meteo].join(',')),
    ].join('\n');
    const dir = await mkdtemp(join(tmpdir(), 'comparacao-'));
    try {
      for (const [nome, texto] of [
        ['comparacao-v0-v1.md', md],
        ['comparacao-v0-v1.csv', csv + '\n'],
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
