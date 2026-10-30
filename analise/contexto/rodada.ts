// A round of crossings (#64), following pesquisa/metodo.md: one main test per hypothesis, Benjamini-Hochberg over the
// whole round, and the confidence rule.
//   node analise/contexto/rodada.ts --rodada 1
// Reads the hypotheses with `rodada: '1'` and `status: 'escrita'`, runs the main test each one wrote, closes the round,
// writes the result into each hypothesis file and the numbers to produtos/contexto/rodada-<n>.csv in the R2.
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { lerFrontMatter } from '../../fontes/catalogo.ts';
import { enviar, readRaw } from '../../coleta/lib/baixar.ts';
import { lerCsvCalendario } from '../../coleta/calendario/regras.ts';
import {
  anomalia,
  benjaminiHochberg,
  mediana,
  permutacaoBlocos,
  permutacaoGrupos,
  rotulosEmBlocos,
  sinaisPorAnos,
  sorteio,
  spearman,
  auc,
  aucPareadoBlocos,
  postosDentro,
} from '../cruzar.ts';
import { MANAUS } from '../../coleta/regiao.ts';

/** BH (FDR q) over the main tests of one round. */
// One CSV cell: quoted when it holds a comma, a quote or a line break (e.g. "CAMS PM2,5").
export const celula = (v: unknown): string => {
  const t = String(v ?? '');
  return /[",\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
};

export function fecharRodada<T extends { id: string; p: number }>(resultados: T[], q = 0.1) {
  const { ajustado, rejeita } = benjaminiHochberg(
    resultados.map((r) => r.p),
    q,
  );
  return resultados.map((r, i) => ({ ...r, p_ajustado: ajustado[i], passa: rejeita[i] }));
}

/**
 * alta = passes the correction, shows in a second independent cut, measured data and a clear mechanism;
 * media = passes but misses one of the other three; baixa = does not pass, under 8 years, or modeled data only.
 */
export function grauDeConfianca(s: { passa: boolean; segundoRecorte: boolean; medido: boolean; mecanismo: boolean; anos: number }) {
  if (!s.passa || s.anos < 8 || !s.medido) return 'baixa';
  return s.segundoRecorte && s.mecanismo ? 'alta' : 'media';
}

/** The value of no effect: 1 for a ratio, 0.5 for an AUC, 0 for the rest. */
const semEfeito = (unidade: string) => (unidade === 'razão' ? 1 : unidade === 'AUC' ? 0.5 : 0);

/**
 * The second independent cut (round 3: MODIS for VIIRS, AQ1km for MapBiomas Fogo, PRODES for DETER) shows the effect:
 * same direction as the main test (a ratio against 1, the rest against 0) and p < 0.05 on its own.
 */
export function segundoConfirma(principal: { efeito: number; unidade: string }, segundo?: { efeito: number; p: number }): boolean {
  if (!segundo) return false;
  const zero = semEfeito(principal.unidade);
  return segundo.p < 0.05 && Math.sign(principal.efeito - zero) === Math.sign(segundo.efeito - zero) && segundo.efeito !== zero;
}

/** The effect went the other way from the one the hypothesis wrote. */
export function direcaoContraria(r: { efeito: number; unidade: string; espera?: 1 | -1 }): boolean {
  const zero = semEfeito(r.unidade);
  return !!r.espera && Math.sign(r.efeito - zero) === -r.espera;
}

/** Round 5: day i is exposed when it or one of the `defasagem` days before had smoke. */
export function exposto(fu: boolean[], defasagem: number): boolean[] {
  return fu.map((_, i) => fu.slice(Math.max(0, i - defasagem), i + 1).some(Boolean));
}

const mediaDe = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Each value minus (or ÷) the mean of its own year. The seasonal anomaly compares with the other years, so a trend
 * (more people 60+ every year) would read as a smoke effect when smoke days pile up in the late years; this keeps
 * the comparison inside the same season of the same year.
 */
export function noAno(dias: string[], v: number[], modo: '-' | '/' = '-'): number[] {
  const soma = new Map<string, [number, number]>();
  dias.forEach((d, i) => {
    const [s, n] = soma.get(d.slice(0, 4)) ?? [0, 0];
    soma.set(d.slice(0, 4), [s + v[i], n + 1]);
  });
  return v.map((x, i) => {
    const [s, n] = soma.get(dias[i].slice(0, 4))!;
    return modo === '-' ? x - s / n : x / (s / n);
  });
}

/** (exposed ÷ not exposed in `a`) ÷ (the same in `b`): how much more group a goes up than group b. */
export function razaoDeRazoes(a: number[], b: number[], g: boolean[]): number {
  const r = (v: number[]) => mediaDe(v.filter((_, i) => g[i])) / mediaDe(v.filter((_, i) => !g[i]));
  return r(a) / r(b);
}

/**
 * School start: mean log of (days 7 to 21 after ÷ the 21 days before), one start per year; p against the same windows
 * around starts moved by whole weeks (−6 to +6, at random per year), which keeps the season and the weekdays.
 */
export function voltaAsAulas(dias: string[], v: number[], voltas: string[], { n = 999, semente = 1 } = {}) {
  const pos = new Map(dias.map((d, i) => [d, i]));
  const D = 86_400_000;
  const logRazao = (volta: string, semanas: number) => {
    const i = pos.get(new Date(Date.parse(volta) + semanas * 7 * D).toISOString().slice(0, 10));
    if (i === undefined || i < 21 || i + 21 >= v.length) return null;
    return Math.log(mediaDe(v.slice(i + 7, i + 22)) / mediaDe(v.slice(i - 21, i)));
  };
  const estat = (semanas: number[]) => {
    const l = voltas.map((x, k) => logRazao(x, semanas[k])).filter((x): x is number => x !== null);
    return mediaDe(l);
  };
  const obs = estat(voltas.map(() => 0));
  const r = sorteio(semente);
  let fortes = 0;
  for (let k = 0; k < n; k++) if (Math.abs(estat(voltas.map(() => Math.floor(r() * 13) - 6))) >= Math.abs(obs)) fortes++;
  return { efeito: obs, p: (1 + fortes) / (n + 1) };
}

/** Start of the fire season of one year: first day whose 7-day mean (that day and the 6 before) passes the year's P75. */
export function inicioTemporada(dias: { dia: string; focos: number }[]): string | null {
  const s = dias.map((d) => d.focos).sort((a, b) => a - b);
  const p75 = s[Math.floor(0.75 * (s.length - 1))];
  for (let i = 6; i < dias.length; i++) {
    const m = dias.slice(i - 6, i + 1).reduce((a, d) => a + d.focos, 0) / 7;
    if (m > p75) return dias[i].dia;
  }
  return null;
}

const postos = (v: number[]) => {
  const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(v.length);
  for (let i = 0; i < o.length;) {
    let j = i;
    while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++;
    for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
};

/** Residual of rank(y) after a straight line on rank(x): what is left of y once x (e.g. the drought) is taken out. */
export function residuoPostos(y: number[], x: number[]): number[] {
  const ry = postos(y);
  const rx = postos(x);
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length;
  const my = ry.reduce((a, b) => a + b, 0) / ry.length;
  const b = rx.reduce((a, xi, i) => a + (xi - mx) * (ry[i] - my), 0) / rx.reduce((a, xi) => a + (xi - mx) ** 2, 0);
  return ry.map((yi, i) => yi - my - b * (rx[i] - mx));
}

/** log of the median, over blocks, of mean(v in the group) ÷ mean(v out of it); blocks without both, or a zero, are skipped. */
export function logRazaoPorBloco(v: number[], g: boolean[], blocos: number[]): number {
  const por = new Map<number, { a: number[]; b: number[] }>();
  v.forEach((x, i) => {
    const k = por.get(blocos[i]) ?? { a: [], b: [] };
    (g[i] ? k.a : k.b).push(x);
    por.set(blocos[i], k);
  });
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const r = [...por.values()].filter((k) => k.a.length && k.b.length && media(k.b) > 0).map((k) => media(k.a) / media(k.b));
  return Math.log(mediana(r));
}

/** Writes the result into the front matter and the "## Resultado" section of one hypothesis file. */
export function atualizarHipotese(
  texto: string,
  r: { status: string; testada_em: string; confianca: string; resultado: string; detalhe: string },
) {
  const [, fm, corpo] = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)!;
  const campos = { status: r.status, testada_em: r.testada_em, confianca: r.confianca, resultado: r.resultado };
  let novo = fm
    .split('\n')
    .filter((l) => !/^(testada_em|confianca|resultado):/.test(l))
    .map((l) => (l.startsWith('status:') ? `status: '${campos.status}'` : l));
  novo = [...novo, ...(['testada_em', 'confianca', 'resultado'] as const).map((k) => `${k}: '${campos[k].replace(/'/g, '’')}'`)];
  return `---\n${novo.join('\n')}\n---\n${corpo.replace(/## Resultado\n[\s\S]*$/, `## Resultado\n${r.detalhe.trim()}\n`)}`;
}

/**
 * log of the ratio of proportions (out-of-standard ÷ analysed) between labelled and other months, p by permuting whole
 * years: the labels of year A move to the same months of year B (the season stays, the years change places).
 */
export function razaoPorAnos(u: { ano: number; mes: number; n: number; fora: number; rotulo: boolean }[], { n = 999, semente = 1 } = {}) {
  const anos = [...new Set(u.map((x) => x.ano))].sort();
  const rot = new Map(u.map((x) => [`${x.ano}-${x.mes}`, x.rotulo]));
  const est = (lab: (x: (typeof u)[number]) => boolean) => {
    let a = 0,
      an = 0,
      b = 0,
      bn = 0;
    for (const x of u) {
      if (lab(x)) {
        a += x.fora;
        an += x.n;
      } else {
        b += x.fora;
        bn += x.n;
      }
    }
    return Math.log(a / an / (b / bn));
  };
  const obs = est((x) => x.rotulo);
  const r = sorteio(semente);
  let fortes = 0;
  for (let k = 0; k < n; k++) {
    const p = [...anos];
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    const de = new Map(anos.map((a, i) => [a, p[i]]));
    if (Math.abs(est((x) => rot.get(`${de.get(x.ano)}-${x.mes}`) ?? false)) >= Math.abs(obs)) fortes++;
  }
  return { efeito: obs, p: (1 + fortes) / (n + 1) };
}

// ---------- the main tests of round 1 (each one as its hypothesis wrote it) ----------

type Teste = {
  efeito: number;
  p: number;
  n: number;
  anos: number;
  texto: (e: number) => string;
  unidade: string;
  segundo?: { nome: string; efeito: number; p: number }; // the same test on the second cut (round 3 on)
  espera?: 1 | -1; // the direction the hypothesis wrote (round 3 on): above or below no effect
  dado?: string; // what the data are, when not all measured (round 6: a model against a measurement)
};
const N = 9999;
const SEMENTE = 64;
const FOCOS = `SELECT dia::text, focos FROM analise.focos_dia WHERE sensor = 'VIIRS_SNPP' AND anel = '800km'`;
const dow = (dia: string) => new Date(dia + 'T12:00:00Z').getUTCDay(); // 0 = Sunday
const semana = (dia: string) => Math.floor((Date.parse(dia) / 86_400_000 + 3) / 7); // Monday-to-Sunday weeks
const somar = (dia: string, n: number) => new Date(Date.parse(dia) + n * 86_400_000).toISOString().slice(0, 10);
const doy = (dia: string) => (Date.parse(dia) - Date.parse(dia.slice(0, 4) + '-01-01')) / 86_400_000;
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(0)}%`;

/** Median of hourly PM2.5 of the Centro sensor between two UTC instants (null with under half of the hours). */
async function pm25(db: pg.Client, de: Date, ate: Date): Promise<number | null> {
  const r = await db.query(`SELECT valor FROM openaq.medicao WHERE parametro = 'pm25' AND inicio >= $1 AND inicio < $2`, [de, ate]);
  const horas = (ate.getTime() - de.getTime()) / 3_600_000;
  return r.rows.length * 2 >= horas ? mediana(r.rows.map((x) => x.valor)) : null;
}

/** Days (or nights) of an event against neighbour days, a block per event: effect and p by permuting inside the blocks. */
async function eventoContraVizinhos(db: pg.Client, eventos: { inicio: Date; horas: number }[], vizinhos: number[], razao: boolean) {
  const v: number[] = [];
  const g: boolean[] = [];
  const b: number[] = [];
  for (const [k, e] of eventos.entries()) {
    const linhas = [];
    for (const d of [0, ...vizinhos]) {
      const de = new Date(e.inicio.getTime() + d * 86_400_000);
      linhas.push({ x: await pm25(db, de, new Date(de.getTime() + e.horas * 3_600_000)), g: d === 0 });
    }
    if (linhas[0].x === null || linhas.filter((l) => l.x !== null).length < 2) continue;
    for (const l of linhas.filter((l) => l.x !== null)) {
      v.push(l.x!);
      g.push(l.g);
      b.push(k);
    }
  }
  const est = razao ? (gg: boolean[]) => Math.log(mediana(v.filter((_, i) => gg[i])) / mediana(v.filter((_, i) => !gg[i]))) : undefined;
  const r = permutacaoGrupos(v, g, { blocos: b, n: N, semente: SEMENTE, estatistica: est });
  const base = mediana(v.filter((_, i) => !g[i]));
  return { efeito: razao ? Math.exp(r.efeito) - 1 : r.efeito / base, p: r.p, n: new Set(b).size };
}

const FUMACA = 'ano de fumaça = dias com FU de agosto a novembro acima da mediana de 2012–2025';
/** Smoke years (round 2, written before looking at the data): FU days from August to November above the 2012-2025 median. */
async function anosDeFumaca(db: pg.Client): Promise<Map<number, boolean>> {
  const r = await db.query(`SELECT extract(year FROM dia)::int AS ano, count(*) FILTER (WHERE horas_fu > 0)::int AS fu
    FROM analise.serie_dia WHERE extract(month FROM dia) BETWEEN 8 AND 11 AND dia < '2026-01-01' GROUP BY 1`);
  const m = mediana(r.rows.map((l) => l.fu));
  return new Map(r.rows.map((l) => [l.ano, l.fu > m]));
}

/**
 * Round 3 (#72): log of the spot density (spots per km², analise.onde_queimou_dia ÷ analise.area_categoria_ano) of
 * category `a` ÷ category `b` of one dimension, per year, in the given states. `porAnoProdes`: spots grouped by PRODES
 * year (August to July), as the PRODES categories are; otherwise by calendar year.
 */
async function logDensidades(
  db: pg.Client,
  o: { sensor: string; ufs: string[]; dimA: string; a: string; dimB: string; b: string; de: number; ate: number; porAnoProdes?: boolean },
) {
  const ano = o.porAnoProdes ? `(extract(year FROM dia) + (extract(month FROM dia) >= 8)::int)::int` : `extract(year FROM dia)::int`;
  const { rows } = await db.query(
    `WITH f AS (SELECT ${ano} AS ano, dimensao, categoria, sum(focos)::float8 AS n FROM analise.onde_queimou_dia
                WHERE sensor = $1 AND uf = ANY($2) AND ((dimensao = $3 AND categoria = $4) OR (dimensao = $5 AND categoria = $6)) GROUP BY 1, 2, 3),
          a AS (SELECT ano, dimensao, categoria, sum(km2) AS km2 FROM analise.area_categoria_ano
                WHERE uf = ANY($2) AND ((dimensao = $3 AND categoria = $4) OR (dimensao = $5 AND categoria = $6)) GROUP BY 1, 2, 3)
     SELECT f.ano, f.dimensao = $3 AND f.categoria = $4 AS em_a, f.n / a.km2 AS densidade
     FROM f JOIN a USING (ano, dimensao, categoria) WHERE f.ano BETWEEN $7 AND $8 ORDER BY 1`,
    [o.sensor, o.ufs, o.dimA, o.a, o.dimB, o.b, o.de, o.ate],
  );
  const anos = [...new Set(rows.map((r) => r.ano))].filter((y) => rows.filter((r) => r.ano === y).length === 2);
  return anos.map((y) => {
    const da = rows.find((r) => r.ano === y && r.em_a).densidade;
    const db_ = rows.find((r) => r.ano === y && !r.em_a).densidade;
    return { ano: y, d: Math.log(da / db_) };
  });
}

const UFS_REGIAO = ['AM', 'RO', 'AC', 'PA', 'RR', 'MT'];
const INTEIROS = ['AM', 'AC', 'RO']; // the states wholly inside the region box

const TESTES: Record<string, (db: pg.Client) => Promise<Teste | { semTeste: string }>> = {
  // Spearman between the minimum level and the days with FU, August to November, 2012-2025, permuting the years.
  'cheia-seca-fumaca': async (db) => {
    const r = await db.query(`SELECT min(cota_cm) AS cota, count(*) FILTER (WHERE horas_fu > 0)::int AS fu
      FROM analise.serie_dia WHERE extract(month FROM dia) BETWEEN 8 AND 11 AND dia < '2026-01-01' GROUP BY extract(year FROM dia) ORDER BY 1`);
    const x = r.rows.map((l) => l.cota);
    const y = r.rows.map((l) => l.fu);
    return {
      efeito: spearman(x, y),
      p: permutacaoBlocos(x, y, { bloco: 1, n: N, semente: SEMENTE }),
      n: x.length,
      anos: x.length,
      unidade: 'Spearman',
      texto: (e) =>
        `Spearman entre a cota mínima de agosto a novembro e os dias com FU no METAR: ${e.toFixed(2)} (${x.length} anos, 2012–2025)`,
    };
  },
  // Even (election) × odd years: focos of August-September, the drought (minimum level of the year) taken out in ranks.
  'eleicao-focos': async (db) => {
    const r = await db.query(`WITH f AS (SELECT extract(year FROM dia::date)::int AS ano, sum(focos) AS focos FROM (${FOCOS}) x
        WHERE extract(month FROM dia::date) IN (8, 9) GROUP BY 1),
      c AS (SELECT extract(year FROM dia)::int AS ano, min(cota_cm) AS cota FROM ana.cota_dia WHERE estacao = 14990000 GROUP BY 1),
      e AS (SELECT DISTINCT extract(year FROM dia)::int AS ano FROM contexto.dia WHERE eleicao IS NOT NULL)
      SELECT f.ano, f.focos::float, c.cota, e.ano IS NOT NULL AS eleicao FROM f JOIN c USING (ano) LEFT JOIN e USING (ano)
      WHERE f.ano BETWEEN 2012 AND 2025 ORDER BY 1`);
    const res = residuoPostos(
      r.rows.map((l) => l.focos),
      r.rows.map((l) => l.cota),
    );
    const t = permutacaoGrupos(
      res,
      r.rows.map((l) => l.eleicao),
      { n: N, semente: SEMENTE },
    );
    return {
      ...t,
      n: res.length,
      anos: res.length,
      unidade: 'postos',
      texto: (e) =>
        `anos de eleição − anos sem, no resíduo dos focos de agosto e setembro depois de tirar a cota mínima: ${e.toFixed(1)} postos em ${res.length}`,
    };
  },
  // Spearman between the day the fire season starts and the day the river starts to fall, a pair per year.
  'roca-inicio-temporada': async (db) => {
    const f = (await db.query(`${FOCOS} AND dia BETWEEN '2012-01-01' AND '2026-12-31' ORDER BY dia`)).rows;
    const c = (
      await db.query(`SELECT DISTINCT ON (extract(year FROM dia)) dia::text FROM ana.cota_dia
        WHERE estacao = 14990000 AND dia >= '2012-01-01' AND extract(month FROM dia) <= 8 ORDER BY extract(year FROM dia), cota_cm DESC, dia`)
    ).rows;
    const pares = c
      .map((l) => {
        const ini = inicioTemporada(f.filter((x) => x.dia.startsWith(l.dia.slice(0, 4))));
        return ini ? { fogo: doy(ini), rio: doy(l.dia) + 1 } : null;
      })
      .filter((x) => x !== null);
    const x = pares.map((p) => p.rio);
    const y = pares.map((p) => p.fogo);
    return {
      efeito: spearman(x, y),
      p: permutacaoBlocos(x, y, { bloco: 1, n: N, semente: SEMENTE }),
      n: x.length,
      anos: x.length,
      unidade: 'Spearman',
      texto: (e) =>
        `Spearman entre o dia em que o rio começa a baixar (dia seguinte à cota máxima) e o início da temporada de focos: ${e.toFixed(2)} (${x.length} anos)`,
    };
  },
  // Focos of weekend and holiday ÷ weekdays of the same week, August to November, labels shuffled inside each week.
  'feriado-fim-de-semana-focos': async (db) => {
    const r = (
      await db.query(`SELECT f.dia, f.focos, c.fim_de_semana OR c.feriado IS NOT NULL AS folga FROM (${FOCOS}) f
        JOIN contexto.dia c ON c.dia = f.dia::date WHERE extract(month FROM c.dia) BETWEEN 8 AND 11 ORDER BY 1`)
    ).rows;
    const v = r.map((l) => l.focos);
    const g = r.map((l) => l.folga);
    const b = r.map((l) => semana(l.dia));
    const t = permutacaoGrupos(v, g, { blocos: b, n: N, semente: SEMENTE, estatistica: (gg) => logRazaoPorBloco(v, gg, b) });
    const anos = new Set(r.map((l) => l.dia.slice(0, 4))).size;
    return {
      efeito: Math.exp(t.efeito) - 1,
      p: t.p,
      n: new Set(b).size,
      anos,
      unidade: 'razão − 1',
      texto: (e) =>
        `focos no fim de semana e feriado ÷ dias úteis da mesma semana (mediana das semanas, agosto a novembro, ${anos} anos): ${pct(e)}`,
    };
  },
  // Daily median PM2.5: Sunday and holiday − weekday, December to July, permutation inside 7-day blocks.
  'feriado-pm25-urbano': async (db) => {
    const r = (
      await db.query(`SELECT c.dia::text, percentile_cont(0.5) WITHIN GROUP (ORDER BY m.valor) AS pm, c.feriado IS NOT NULL AS feriado,
          c.fim_de_semana FROM openaq.medicao m JOIN contexto.dia c ON c.dia = (m.inicio AT TIME ZONE 'America/Manaus')::date
        WHERE m.parametro = 'pm25' AND extract(month FROM c.dia) NOT IN (8, 9, 10, 11)
        GROUP BY c.dia, c.feriado, c.fim_de_semana HAVING count(*) >= 12 ORDER BY 1`)
    ).rows.filter((l) => l.feriado || dow(l.dia) !== 6); // Saturday is neither side
    const v = r.map((l) => l.pm);
    const g = r.map((l) => l.feriado || dow(l.dia) === 0);
    const t = permutacaoGrupos(v, g, { blocos: r.map((l) => semana(l.dia)), n: N, semente: SEMENTE });
    return {
      efeito: t.efeito / mediana(v.filter((_, i) => !g[i])),
      p: t.p,
      n: v.length,
      anos: 1,
      unidade: 'relativo',
      texto: (e) =>
        `PM2.5 do Centro no domingo e feriado − dia útil, dezembro a julho (${v.length} dias, desde 07/2025): ${pct(e)} da mediana do dia útil`,
    };
  },
  // Night PM2.5 (20h-02h of Manaus) of a festival night ÷ the nights a week before and after, permuting the nights.
  'festas-pm25': async (db) => {
    const noites = (
      await db.query(`SELECT dia::text FROM contexto.dia WHERE dia >= '2025-07-11' AND (festa IS NOT NULL
        OR feriado LIKE '%Aniversário de Manaus%' OR ponto_facultativo LIKE '%Carnaval%' OR to_char(dia, 'MM-DD') = '12-31') ORDER BY 1`)
    ).rows.map((l) => l.dia);
    const r = await eventoContraVizinhos(
      db,
      noites.map((d) => ({ inicio: new Date(somar(d, 1) + 'T00:00:00Z'), horas: 6 })), // 20h Manaus = 00h UTC of the next day
      [-7, 7],
      true,
    );
    return {
      ...r,
      anos: 1,
      unidade: 'razão − 1',
      texto: (e) => `PM2.5 da noite de festa ÷ noites uma semana antes e depois (${r.n} noites desde 07/2025): ${pct(e)}`,
    };
  },
  // PM2.5 during Brazil World Cup matches and FAF finals (kick-off + 2 h) − the same hours on the same weekday ±1 and ±2 weeks.
  'jogos-pm25': async (db) => {
    const csv = lerCsvCalendario(readFileSync(join(import.meta.dirname, '../../coleta/calendario/esporte_api.csv'), 'utf8'));
    const copa = csv.find((p) => p.nome === 'Copa do Mundo masculina 2026')!;
    const fifa = JSON.parse(await readRaw(copa.bruto!)) as {
      Results: { Date: string; Home: { IdCountry: string } | null; Away: { IdCountry: string } | null }[];
    };
    const jogos = fifa.Results.filter((j) => [j.Home?.IdCountry, j.Away?.IdCountry].includes('BRA')).map((j) => new Date(j.Date));
    // FAF 2026 finals, kick-off in Manaus time as published on the FAF championship page (esporte.csv has the url).
    for (const k of ['2026-02-08T17:00', '2026-03-14T15:30', '2026-03-21T15:30']) jogos.push(new Date(k + ':00-04:00'));
    const r = await eventoContraVizinhos(
      db,
      jogos.map((j) => ({ inicio: j, horas: 2 })),
      [-14, -7, 7, 14],
      false,
    );
    return {
      ...r,
      anos: 1,
      unidade: 'relativo',
      texto: (e) => `PM2.5 do Centro nas 2 horas de jogo − mesmas horas sem jogo (${r.n} jogos de 2026): ${pct(e)}`,
    };
  },
  // ---------- round 2 (S3.5.2) ----------
  // Spending of the year after a smoke year − after a year without, permuting the years (both governments, real terms).
  'gasto-ambiental-reativo': async (db) => {
    const fumaca = await anosDeFumaca(db);
    const r = (
      await db.query(`SELECT ano, sum(valor_real)::float8 AS v FROM contexto.gasto_funcao
        WHERE coluna = 'liquidado' AND codigo IN ('18', '06.182') GROUP BY ano ORDER BY ano`)
    ).rows.filter((l) => fumaca.has(l.ano - 1));
    const v = r.map((l) => l.v);
    const g = r.map((l) => fumaca.get(l.ano - 1)!);
    const t = permutacaoGrupos(v, g, { n: N, semente: SEMENTE });
    return {
      efeito: t.efeito / mediana(v.filter((_, i) => !g[i])),
      p: t.p,
      n: v.length,
      anos: v.length,
      unidade: 'relativo',
      texto: (e) =>
        `gasto real liquidado em gestão ambiental e defesa civil (Estado + Prefeitura) no ano seguinte a um ano de fumaça − no ano seguinte a um ano sem (${r[0].ano}–${r.at(-1).ano}, ${FUMACA}): ${pct(e)}`,
    };
  },
  // Share of turbidity samples above 5 uT in months with the river under 15 m (that month or the one before) ÷ the
  // same calendar months of other years, permuting the years.
  'agua-seca': async (db) => {
    const r = (
      await db.query(`WITH c AS (SELECT date_trunc('month', dia)::date AS mes, min(cota_cm) AS cota FROM ana.cota_dia
          WHERE estacao = 14990000 AND dia >= '2013-12-01' GROUP BY 1),
        t AS (SELECT date_trunc('month', coletado_em AT TIME ZONE 'America/Manaus')::date AS mes, count(*)::int AS n,
            count(*) FILTER (WHERE resultado > 5)::int AS fora
          FROM sisagua.vigilancia WHERE parametro = 'Turbidez (uT)' AND resultado IS NOT NULL GROUP BY 1)
        SELECT extract(year FROM t.mes)::int AS ano, extract(month FROM t.mes)::int AS mes, t.n, t.fora,
          coalesce(c.cota < 1500 OR c0.cota < 1500, false) AS rotulo
        FROM t LEFT JOIN c ON c.mes = t.mes LEFT JOIN c c0 ON c0.mes = (t.mes - interval '1 month')::date ORDER BY 1, 2`)
    ).rows;
    const meses = new Set(r.filter((x) => x.rotulo).map((x) => x.mes));
    const u = r.filter((x) => meses.has(x.mes));
    const t = razaoPorAnos(u, { n: N, semente: SEMENTE });
    const anos = new Set(u.map((x) => x.ano)).size;
    return {
      efeito: Math.exp(t.efeito) - 1,
      p: t.p,
      n: u.length,
      anos,
      unidade: 'razão − 1',
      texto: (e) =>
        `proporção de amostras de turbidez acima de 5 uT (vigilância, Manaus) nos meses com o rio abaixo de 15 m ÷ os mesmos meses dos outros anos (${anos} anos, ${u.length} meses): ${pct(e)}`,
    };
  },
  // Spearman between the FU days of the month and the DEC anomaly (same month of other years), permuting whole years.
  // DEC = the sum of every part (dec_partes): the official DEC left out external outages from 2022 on.
  'energia-fumaca': async (db) => {
    const r = (
      await db.query(`WITH fu AS (SELECT date_trunc('month', dia)::date AS mes, count(*) FILTER (WHERE horas_fu > 0)::int AS fu
          FROM analise.serie_dia WHERE dia BETWEEN '2012-01-01' AND '2025-12-31' GROUP BY 1)
        SELECT fu.mes::text, fu.fu, d.dec_partes FROM fu JOIN aneel.dec_manaus_mes d USING (mes) ORDER BY 1`)
    ).rows;
    if (r.length % 12) throw new Error('energia-fumaca: os anos precisam estar completos para permutar anos inteiros');
    const media = (m: string, ano: string) => {
      const o = r.filter((x) => x.mes.slice(5, 7) === m && x.mes.slice(0, 4) !== ano);
      return o.reduce((a, x) => a + x.dec_partes, 0) / o.length;
    };
    const y = r.map((x) => x.dec_partes - media(x.mes.slice(5, 7), x.mes.slice(0, 4)));
    const x = r.map((l) => l.fu);
    return {
      efeito: spearman(x, y),
      p: permutacaoBlocos(x, y, { bloco: 12, n: N, semente: SEMENTE }),
      n: r.length,
      anos: r.length / 12,
      unidade: 'Spearman',
      texto: (e) =>
        `Spearman entre os dias com FU do mês e a anomalia do DEC de Manaus (soma de todas as partes, derivado; mesmo mês dos outros anos), ${r.length / 12} anos: ${e.toFixed(2)}`,
    };
  },
};

/** Density test (round 3): log ratio per year, sign flips of the years; the effect back as a ratio. */
async function razaoDensidade(db: pg.Client, o: Parameters<typeof logDensidades>[1]) {
  const d = await logDensidades(db, o);
  const t = sinaisPorAnos(
    d.map((x) => x.d),
    { n: N, semente: SEMENTE },
  );
  return { d, efeito: Math.exp(t.efeito), p: t.p };
}

/** A density test on VIIRS S-NPP, with MODIS (same years) as the second cut. */
async function densidadeComModis(
  db: pg.Client,
  o: Omit<Parameters<typeof logDensidades>[1], 'sensor'>,
  texto: (d: { ano: number }[], e: number) => string,
  espera: 1 | -1,
) {
  const v = await razaoDensidade(db, { ...o, sensor: 'VIIRS_SNPP' });
  const m = await razaoDensidade(db, { ...o, sensor: 'MODIS' });
  return {
    efeito: v.efeito,
    p: v.p,
    n: v.d.length,
    anos: v.d.length,
    unidade: 'razão',
    texto: (e: number) => texto(v.d, e),
    segundo: { nome: 'MODIS', efeito: m.efeito, p: m.p },
    espera,
  };
}

/** FU days of August-November per year with the minimum level, joined to one yearly value `x`, Spearman on the residual. */
async function fuContraAno(db: pg.Client, porAno: { ano: number; x: number }[]) {
  const r = (
    await db.query(
      `SELECT extract(year FROM dia)::int AS ano, min(cota_cm) AS cota, count(*) FILTER (WHERE horas_fu > 0)::int AS fu
       FROM analise.serie_dia WHERE extract(month FROM dia) BETWEEN 8 AND 11 GROUP BY 1 ORDER BY 1`,
    )
  ).rows.filter((l) => porAno.some((p) => p.ano === l.ano));
  const y = residuoPostos(
    r.map((l) => l.fu),
    r.map((l) => l.cota),
  );
  const x = r.map((l) => porAno.find((p) => p.ano === l.ano)!.x);
  return { r, efeito: spearman(x, y), p: permutacaoBlocos(x, y, { bloco: 1, n: N, semente: SEMENTE }) };
}

/** FU days of each month August-November 2012-2025 against the burned area of one product, without the effect of the spots. */
async function fuContraAreaQueimada(db: pg.Client, produto: string) {
  const r = (
    await db.query(
      `WITH s AS (SELECT date_trunc('month', dia)::date AS mes, count(*) FILTER (WHERE horas_fu > 0)::int AS fu, sum(focos_800km)::int AS focos
                  FROM analise.serie_dia WHERE extract(month FROM dia) BETWEEN 8 AND 11 AND dia BETWEEN '2012-01-01' AND '2025-12-31' GROUP BY 1),
            q AS (SELECT make_date(ano, mes, 1) AS mes, sum(hectares) AS ha FROM analise.area_queimada_mes
                  WHERE produto = $1 AND recorte = '800km' GROUP BY 1)
       SELECT s.mes::text, s.fu, s.focos, coalesce(q.ha, 0) AS ha FROM s LEFT JOIN q USING (mes) ORDER BY 1`,
      [produto],
    )
  ).rows;
  if (r.length % 4) throw new Error('area-queimada-fumaca: os anos precisam ter os 4 meses');
  const y = residuoPostos(
    r.map((l) => l.fu),
    r.map((l) => l.focos),
  );
  const x = r.map((l) => l.ha);
  return { r, efeito: spearman(x, y), p: permutacaoBlocos(x, y, { bloco: 4, n: N, semente: SEMENTE }) };
}

Object.assign(TESTES, {
  // Recent deforestation (PRODES 1 to 3 years before) ÷ old (up to 2007), spots per km², per PRODES year 2013-2025
  // (VIIRS S-NPP; the PRODES year 2012 starts before the VIIRS archive), sign flips of the years.
  'desmatamento-recente-focos': (db: pg.Client): Promise<Teste> =>
    densidadeComModis(
      db,
      { ufs: UFS_REGIAO, dimA: 'prodes', a: 'desm_1a3', dimB: 'prodes', b: 'desm_ate2007', de: 2013, ate: 2025, porAnoProdes: true },
      (d, e) =>
        `focos por km² no desmatamento do PRODES de 1 a 3 anos antes ÷ no desmatamento até 2007, caixa da região, VIIRS S-NPP, anos PRODES ${d[0].ano}–${d.at(-1)!.ano} (média geométrica): ${e.toFixed(2)}×`,
      1,
    ),
  // Spearman between the FU days of August-November after the minimum level (ranks) and the clear-cut DETER area of
  // January-July within 800 km, 2017-2025, permuting the years. Second cut: the PRODES deforestation of the PRODES year
  // (August to July) within 800 km.
  'deter-antes-da-fumaca': async (db: pg.Client): Promise<Teste> => {
    const deter = (
      await db.query(
        `SELECT extract(year FROM view_date)::int AS ano, sum(area_km2) AS x FROM inpe_desmatamento.deter
         WHERE classe = 'DESMATAMENTO_CR' AND extract(month FROM view_date) BETWEEN 1 AND 7
           AND view_date BETWEEN '2017-01-01' AND '2025-12-31'
           AND geom && ST_Expand(ST_SetSRID(ST_Point($1, $2), 4326), 8)
           AND ST_DWithin(geom::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography, 800000) GROUP BY 1`,
        [MANAUS.lon, MANAUS.lat],
      )
    ).rows;
    const prodes = (
      await db.query(
        `SELECT ano::int, km2 AS x FROM analise.area_categoria_ano
         WHERE uf = '800km' AND dimensao = 'prodes' AND categoria = 'desm_ano' AND ano BETWEEN 2017 AND 2025`,
      )
    ).rows;
    const t = await fuContraAno(db, deter);
    const s = await fuContraAno(db, prodes);
    return {
      efeito: t.efeito,
      p: t.p,
      n: t.r.length,
      anos: t.r.length,
      unidade: 'Spearman',
      espera: 1,
      segundo: { nome: 'PRODES', efeito: s.efeito, p: s.p },
      texto: (e) =>
        `Spearman entre o corte raso do DETER de janeiro a julho a até 800 km e os dias com FU de agosto a novembro sem o efeito da cota mínima (postos), ${t.r.length} anos (${t.r[0].ano}–${t.r.at(-1).ano}): ${e.toFixed(2)}`,
    };
  },
  // Undesignated public forest (CNFP tipo B, A created later counts as B) ÷ TI and UC, spots per km², AM + AC + RO,
  // 2012-2025, sign flips of the years.
  'floresta-nao-destinada-focos': (db: pg.Client): Promise<Teste> =>
    densidadeComModis(
      db,
      { ufs: INTEIROS, dimA: 'cnfp', a: 'B', dimB: 'protegida', b: 'sim', de: 2012, ate: 2025 },
      (d, e) =>
        `focos por km² na floresta pública não destinada (CNFP tipo B no ano do foco) ÷ em TI e UC, AM + AC + RO, VIIRS S-NPP, ${d[0].ano}–${d.at(-1)!.ano} (média geométrica): ${e.toFixed(2)}×`,
      1,
    ),
  // Inside TIs and UCs ÷ the 10 km band around them, spots per km², region box, 2012-2025, sign flips of the years.
  'areas-protegidas-focos': (db: pg.Client): Promise<Teste> =>
    densidadeComModis(
      db,
      { ufs: UFS_REGIAO, dimA: 'protegida', a: 'sim', dimB: 'protegida', b: 'faixa_10km', de: 2012, ate: 2025 },
      (d, e) =>
        `focos por km² dentro de TI e UC ÷ na faixa de 10 km em volta, caixa da região, VIIRS S-NPP, ${d[0].ano}–${d.at(-1)!.ano} (média geométrica): ${e.toFixed(2)}×`,
      -1,
    ),
  // Spearman between the FU days of the month after the spots within 800 km (ranks) and the MapBiomas Fogo burned area
  // within 800 km, August-November 2012-2025, permuting whole years (blocks of 4 months). Second cut: AQ1km.
  'area-queimada-fumaca': async (db: pg.Client): Promise<Teste> => {
    const t = await fuContraAreaQueimada(db, 'mapbiomas-fogo');
    const s = await fuContraAreaQueimada(db, 'inpe-aq1km');
    return {
      efeito: t.efeito,
      p: t.p,
      n: t.r.length,
      anos: t.r.length / 4,
      unidade: 'Spearman',
      espera: 1,
      segundo: { nome: 'INPE AQ1km', efeito: s.efeito, p: s.p },
      texto: (e) =>
        `Spearman entre a área queimada do MapBiomas Fogo a até 800 km e os dias com FU do mês sem o efeito dos focos (postos), agosto a novembro, ${t.r.length / 4} anos: ${e.toFixed(2)}`,
    };
  },
  // Share of the year's spots in August-October, AM minus the mean of RO and AC (MODIS), 2010-2025 minus 2003-2009,
  // permuting the before/after labels of the years. No second cut: the VIIRS starts in 2012, after the ban.
  'proibicao-ipaam-2010': async (db: pg.Client): Promise<Teste> => {
    const r = (
      await db.query(
        `SELECT extract(year FROM dia)::int AS ano, uf,
                sum(focos) FILTER (WHERE extract(month FROM dia) BETWEEN 8 AND 10)::float8 / sum(focos) AS fatia
         FROM analise.onde_queimou_dia WHERE sensor = 'MODIS' AND dimensao = 'ti' AND uf IN ('AM', 'RO', 'AC')
           AND dia BETWEEN '2003-01-01' AND '2025-12-31' GROUP BY 1, 2 ORDER BY 1, 2`,
      )
    ).rows;
    const anos = [...new Set(r.map((l) => l.ano))];
    const f = (ano: number, uf: string) => r.find((l) => l.ano === ano && l.uf === uf)!.fatia;
    const d = anos.map((a) => f(a, 'AM') - (f(a, 'RO') + f(a, 'AC')) / 2);
    const g = anos.map((a) => a >= 2010);
    const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const t = permutacaoGrupos(d, g, {
      n: N,
      semente: SEMENTE,
      estatistica: (gg) => media(d.filter((_, i) => gg[i])) - media(d.filter((_, i) => !gg[i])),
    });
    return {
      efeito: t.efeito,
      p: t.p,
      n: d.length,
      anos: d.length,
      unidade: 'pontos (fração)',
      espera: -1,
      texto: (e) =>
        `fatia dos focos do ano de agosto a outubro, AM menos a média de RO e AC (MODIS), 2010–2025 menos 2003–2009: ${(100 * e).toFixed(1)} pontos percentuais`,
    };
  },
});

// ---------- round 5 (#92): health and federal spending ----------

/** Last day with 6 SIH processing months after it (an admission can arrive months later), capped at `teto`. */
async function fimDoSih(db: pg.Client, teto: string): Promise<string> {
  const { rows } = await db.query(`SELECT max(periodo) AS p FROM datasus.lido WHERE fonte = 'datasus-sih'`);
  const [a, m] = String(rows[0].p).split('-').map(Number);
  const fim = new Date(Date.UTC(a, m - 6, 0)).toISOString().slice(0, 10); // last day of the month 6 months before
  return fim < teto ? fim : teto;
}

/** Every day from `de` to `ate`: the count of `soma` (a query giving dia, n), smoke (FU in the METAR) and the CAMS PM2.5. */
async function serieDiaria(db: pg.Client, soma: string, de: string, ate: string) {
  const { rows } = await db.query(
    `WITH d AS (SELECT generate_series($1::date, $2::date, '1 day')::date AS dia)
     SELECT d.dia::text, coalesce(x.n, 0)::float8 AS n, coalesce(s.horas_fu, 0) > 0 AS fu, c.pm25
     FROM d LEFT JOIN (${soma}) x ON x.dia = d.dia LEFT JOIN analise.serie_dia s ON s.dia = d.dia
       LEFT JOIN cams.pm25_dia c ON c.dia = d.dia AND c.produto = 'eac4'
     ORDER BY 1`,
    [de, ate],
  );
  return {
    dias: rows.map((r) => r.dia as string),
    n: rows.map((r) => r.n as number),
    fu: rows.map((r) => r.fu as boolean),
    cams: rows.map((r) => r.pm25 !== null && r.pm25 > 25),
  };
}

const agoNov = (dia: string) => Number(dia.slice(5, 7)) >= 8 && Number(dia.slice(5, 7)) <= 11;

/** The relative difference of the seasonal anomaly on the days after smoke (0 to 7), August-November, blocks of 7 days. */
function depoisDaFumaca(s: Awaited<ReturnType<typeof serieDiaria>>, marca: boolean[]) {
  const anom = anomalia(s.dias, s.n, 7).map((x) => x ?? 0);
  const idx = s.dias.map((d, i) => (agoNov(d) ? i : -1)).filter((i) => i >= 0);
  const g = exposto(marca, 7);
  const base = mediaDe(idx.map((i) => s.n[i]));
  const v = noAno(
    idx.map((i) => s.dias[i]),
    idx.map((i) => anom[i]),
  );
  const est = (gg: boolean[]) => (mediaDe(v.filter((_, k) => gg[k])) - mediaDe(v.filter((_, k) => !gg[k]))) / base;
  return rotulosEmBlocos(
    idx.map((i) => g[i]),
    est,
    { n: N, semente: SEMENTE },
  );
}

async function saude(db: pg.Client, soma: string, ate: string, texto: (e: number, anos: string) => string): Promise<Teste> {
  const fim = await fimDoSih(db, ate);
  const s = await serieDiaria(db, soma, '2012-01-01', fim);
  const t = depoisDaFumaca(s, s.fu);
  const c = depoisDaFumaca(s, s.cams);
  const anos = `2012–${fim.slice(0, 4)}`;
  return {
    efeito: t.efeito,
    p: t.p,
    n: s.dias.filter(agoNov).length,
    anos: Number(fim.slice(0, 4)) - 2011,
    unidade: 'fração',
    espera: 1,
    segundo: { nome: 'CAMS PM2,5 > 25 µg/m³ (modelado)', efeito: c.efeito, p: c.p },
    texto: (e) => texto(e, anos),
  };
}

type SemTeste = { semTeste: string };

Object.assign(TESTES, {
  // Respiratory admissions (J00-J99) of Manaus residents, anomaly, days 0-7 after a FU day ÷ the others, Aug-Nov 2012-2025.
  'fumaca-internacao-respiratoria': (db: pg.Client) =>
    saude(
      db,
      `SELECT dia, sum(internacoes) AS n FROM datasus.internacao_dia WHERE grupo = 'respiratorio' GROUP BY dia`,
      '2025-12-31',
      (e, anos) =>
        `internações respiratórias de moradores de Manaus nos 0 a 7 dias depois de um dia com FU, em anomalia sazonal e contra os outros dias do mesmo ano, agosto a novembro, ${anos}: ${(100 * e).toFixed(1)}% de um dia comum`,
    ),
  // Deaths of residents 60+ with underlying cause J or I, same design, 2012-2024 (the SIM of 2025 is preliminary).
  'fumaca-obito-idoso': async (db: pg.Client): Promise<Teste> => {
    const s = await serieDiaria(
      db,
      `SELECT dia, sum(obitos) AS n FROM datasus.obito_dia WHERE faixa = '60+' AND grupo IN ('respiratorio', 'circulatorio') GROUP BY dia`,
      '2012-01-01',
      '2024-12-31',
    );
    const t = depoisDaFumaca(s, s.fu);
    const c = depoisDaFumaca(s, s.cams);
    return {
      efeito: t.efeito,
      p: t.p,
      n: s.dias.filter(agoNov).length,
      anos: 13,
      unidade: 'fração',
      espera: 1,
      segundo: { nome: 'CAMS PM2,5 > 25 µg/m³ (modelado)', efeito: c.efeito, p: c.p },
      texto: (e) =>
        `óbitos de moradores de Manaus com 60 anos ou mais por causa respiratória ou circulatória nos 0 a 7 dias depois de um dia com FU, em anomalia sazonal e contra os outros dias do mesmo ano, agosto a novembro, 2012–2024: ${(100 * e).toFixed(1)}% de um dia comum`,
    };
  },
  // Respiratory admissions: (0-4 and 60+, smoke ÷ no smoke) ÷ (5-59, smoke ÷ no smoke), days 0-7 after FU, Aug-Nov.
  // Within a band the population is the same on both sides, so the ratio of rates is the ratio of counts.
  'idade-internacao-fumaca': async (db: pg.Client): Promise<Teste> => {
    const fim = await fimDoSih(db, '2025-12-31');
    const q = (faixas: string) =>
      `SELECT dia, sum(internacoes) AS n FROM datasus.internacao_dia WHERE grupo = 'respiratorio' AND faixa IN (${faixas}) GROUP BY dia`;
    const a = await serieDiaria(db, q(`'0-4', '60+'`), '2012-01-01', fim);
    const b = await serieDiaria(db, q(`'5-9', '10-14', '15-59'`), '2012-01-01', fim);
    const idx = a.dias.map((d, i) => (agoNov(d) ? i : -1)).filter((i) => i >= 0);
    const pega = (v: number[]) =>
      noAno(
        idx.map((i) => a.dias[i]),
        idx.map((i) => v[i]),
        '/',
      );
    const teste = (marca: boolean[]) => {
      const g = exposto(marca, 7);
      return rotulosEmBlocos(
        idx.map((i) => g[i]),
        (gg) => razaoDeRazoes(pega(a.n), pega(b.n), gg),
        { n: N, semente: SEMENTE },
      );
    };
    const t = teste(a.fu);
    const c = teste(a.cams);
    return {
      efeito: t.efeito,
      p: t.p,
      n: idx.length,
      anos: Number(fim.slice(0, 4)) - 2011,
      unidade: 'razão',
      espera: 1,
      segundo: { nome: 'CAMS PM2,5 > 25 µg/m³ (modelado)', efeito: c.efeito, p: c.p },
      texto: (e) =>
        `alta das internações respiratórias de menores de 5 e de 60 anos ou mais nos 0 a 7 dias depois de um dia com FU ÷ a mesma alta de 5 a 59 anos, cada faixa contra a média do próprio ano, agosto a novembro, 2012–${fim.slice(0, 4)}: ${e.toFixed(2)}×`,
    };
  },
  // Respiratory admissions 0-9: days 7-21 after the February school start ÷ the 21 days before, against placebo starts.
  'escola-internacao-criancas': async (db: pg.Client): Promise<Teste> => {
    const fim = await fimDoSih(db, '2025-12-31');
    const s = await serieDiaria(
      db,
      `SELECT dia, sum(internacoes) AS n FROM datasus.internacao_dia WHERE grupo = 'respiratorio' AND faixa IN ('0-4', '5-9') GROUP BY dia`,
      '2012-01-01',
      fim,
    );
    // One start per year: the municipal network (urban), else the state network in the capital; remote years left out.
    const { rows } = await db.query(
      `SELECT DISTINCT ON (extract(year FROM inicio)) inicio::text AS dia FROM contexto.periodo
       WHERE tipo = 'escola' AND extract(month FROM inicio) = 2 AND nome ~ '^(Início|Abertura) do ano letivo da rede (municipal|estadual)'
         AND nome !~ '(remoto|interior)' AND inicio <= $1::date - 21
       ORDER BY extract(year FROM inicio), nome ~ 'municipal' DESC, inicio`,
      [fim],
    );
    const voltas = rows.map((r) => r.dia as string);
    const t = voltaAsAulas(s.dias, s.n, voltas, { n: N, semente: SEMENTE });
    return {
      efeito: Math.exp(t.efeito),
      p: t.p,
      n: voltas.length,
      anos: voltas.length,
      unidade: 'razão',
      espera: 1,
      texto: (e) =>
        `internações respiratórias de 0 a 9 anos de 1 a 3 semanas depois da volta às aulas de fevereiro ÷ as 3 semanas antes, ${voltas.length} anos (${voltas.map((v) => v.slice(0, 4)).join(', ')}), média geométrica: ${e.toFixed(2)}×`,
    };
  },
  // Spearman between the VIIRS spots of the year in AM + AC + RO and the August-December liquidated value of the fire
  // actions localized in those states, in reais of the last IPCA year, 2014-2025, permuting the years.
  'gasto-federal-fogo-reativo': async (db: pg.Client): Promise<Teste | SemTeste> => {
    const gasto = async (acoes: string[]) =>
      (
        await db.query(
          `SELECT extract(year FROM mes)::int AS ano, sum(liquidado_real)::float8 AS x FROM transparencia.despesa_fogo_mes_real
           WHERE acao = ANY($1) AND uf IN ('AM', 'AC', 'RO') AND extract(month FROM mes) >= 8 AND mes BETWEEN '2014-01-01' AND '2025-12-31'
           GROUP BY 1 HAVING sum(liquidado_real) > 0 ORDER BY 1`,
          [acoes],
        )
      ).rows as { ano: number; x: number }[];
    const todas = await gasto(['214M', '214N', '214P', '218X', '20X7']);
    if (todas.length < 8)
      return {
        semTeste: `o gasto liquidado de agosto a dezembro dessas ações com localizador no AM, no AC ou em RO só aparece em ${todas.length} dos 12 anos de 2014 a 2025 (${todas.map((r) => r.ano).join(', ') || 'nenhum'}): quase tudo vem localizado como nacional ou por região, sem estado`,
      };
    const focos = (
      await db.query(
        `SELECT extract(year FROM dia)::int AS ano, sum(focos)::float8 AS f FROM analise.onde_queimou_dia
         WHERE sensor = 'VIIRS_SNPP' AND dimensao = 'ti' AND uf IN ('AM', 'AC', 'RO') AND dia BETWEEN '2014-01-01' AND '2025-12-31' GROUP BY 1`,
      )
    ).rows as { ano: number; f: number }[];
    const teste = (g: { ano: number; x: number }[]) => {
      const par = g.map((r) => ({ x: focos.find((f) => f.ano === r.ano)?.f ?? 0, y: r.x }));
      const x = par.map((p) => p.x);
      const y = par.map((p) => p.y);
      return { efeito: spearman(x, y), p: permutacaoBlocos(x, y, { bloco: 1, n: N, semente: SEMENTE }), anos: g.length };
    };
    const t = teste(todas);
    const prev = await gasto(['214M']);
    const s = prev.length >= 3 ? teste(prev) : undefined;
    return {
      efeito: t.efeito,
      p: t.p,
      n: t.anos,
      anos: t.anos,
      unidade: 'Spearman',
      espera: 1,
      ...(s ? { segundo: { nome: 'só o Prevfogo (214M)', efeito: s.efeito, p: s.p } } : {}),
      texto: (e) =>
        `Spearman entre os focos do ano no AM, no AC e em RO (VIIRS S-NPP) e o gasto federal do fogo liquidado de agosto a dezembro com localizador nesses estados (reais do último ano do IPCA), ${t.anos} anos: ${e.toFixed(2)}`,
    };
  },
});

// ---------- round 6: the CAMS as base of a smoke alert (#116) ----------

/** Fire-season days (August to November) of `de` to `ate`, with the FU hours and the visibility of the METAR. */
async function temporada(db: pg.Client, extra: string, de: string, ate: string) {
  return (
    await db.query(
      `SELECT s.dia::text AS dia, s.horas_fu, s.vis_min_sem_chuva_m AS vis, ${extra}
       FROM (SELECT *, CASE WHEN lag(dia) OVER w = dia - 1 AND lag(metar_obs) OVER w > 0 THEN lag(horas_fu) OVER w END AS ontem
             FROM analise.serie_dia WINDOW w AS (ORDER BY dia)) s
       WHERE extract(month FROM s.dia) BETWEEN 8 AND 11 AND s.dia BETWEEN $1 AND $2 AND s.metar_obs > 0
       ORDER BY s.dia`,
      [de, ate],
    )
  ).rows;
}

Object.assign(TESTES, {
  // AUC of the EAC4 PM2.5 of the day between days with FU and the rest, Aug-Nov 2012-2025; labels moved in 7-day blocks.
  'cams-separa-dias-fumaca': async (db: pg.Client): Promise<Teste> => {
    const d = (
      await temporada(db, `(SELECT pm25 FROM cams.pm25_dia c WHERE c.dia = s.dia AND produto = 'eac4') AS cams`, '2012-01-01', '2025-12-31')
    ).filter((x) => x.cams !== null);
    const x = d.map((r) => r.cams as number);
    const teste = (g: boolean[]) => rotulosEmBlocos(g, (h) => auc(x, h) - 0.5, { bloco: 7, n: N, semente: SEMENTE });
    const fu = d.map((r) => r.horas_fu >= 1);
    const t = teste(fu);
    const vis = d.filter((r) => r.vis !== null);
    const xv = vis.map((r) => r.cams as number);
    const sv = rotulosEmBlocos(
      vis.map((r) => r.vis < 5000),
      (h) => auc(xv, h) - 0.5,
      { bloco: 7, n: N, semente: SEMENTE },
    );
    const anos = new Set(d.map((r) => r.dia.slice(0, 4))).size;
    return {
      efeito: t.efeito + 0.5,
      p: t.p,
      n: d.length,
      anos,
      unidade: 'AUC',
      espera: 1,
      dado: 'CAMS EAC4 modelado contra FU e visibilidade medidos no METAR',
      segundo: { nome: 'visibilidade abaixo de 5 km sem chuva nem névoa', efeito: sv.efeito + 0.5, p: sv.p },
      texto: (e) =>
        `AUC do PM2,5 do CAMS EAC4 (modelado) entre os ${fu.filter(Boolean).length} dias com FU e os outros ${fu.filter((f) => !f).length} dias de agosto a novembro, ${anos} temporadas (2012–2025): ${e.toFixed(2)} (importa a partir de 0,80; abaixo de 0,65 contradiz o CAMS como base de alerta)`,
    };
  },
  // Paired AUC difference: CAMS forecast for day D (00 UTC run of D-1) against the FU hours of D-1 ("repeat today"),
  // both ranked inside each season; the two scores swapped in whole 7-day blocks.
  'previsao-cams-amanha': async (db: pg.Client): Promise<Teste> => {
    const d = (
      await temporada(
        db,
        `(SELECT pm25 FROM cams.previsao_dia c WHERE c.dia = s.dia AND antecedencia = 1) AS prev, s.ontem`,
        '2015-01-01',
        '2025-12-31',
      )
    ).filter((x) => x.prev !== null && x.ontem !== null);
    const ano = d.map((r) => r.dia.slice(0, 4));
    const fu = d.map((r) => r.horas_fu >= 1);
    const a = postosDentro(
      d.map((r) => r.prev),
      ano,
    );
    const b = postosDentro(
      d.map((r) => r.ontem),
      ano,
    );
    const t = aucPareadoBlocos(a, b, fu, { bloco: 7, n: N, semente: SEMENTE });
    const anos = new Set(ano).size;
    return {
      efeito: t.efeito,
      p: t.p,
      n: d.length,
      anos,
      unidade: 'diferença de AUC',
      espera: 1,
      dado: 'Previsão do CAMS modelada contra FU medido no METAR',
      texto: (e) =>
        `AUC da previsão do CAMS para o dia seguinte ${auc(a, fu).toFixed(2)} contra ${auc(b, fu).toFixed(2)} de repetir as horas com FU de hoje, ${d.length} dias de agosto a novembro, ${anos} temporadas (2015–2025), postos dentro de cada temporada; diferença ${e >= 0 ? '+' : ''}${e.toFixed(2)} (importa a partir de 0,05)`,
    };
  },
});

async function principal(args: string[]) {
  const rodada = args[args.indexOf('--rodada') + 1];
  const dir = join(import.meta.dirname, '../../pesquisa/hipoteses');
  const hips = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => ({ f, card: lerFrontMatter(readFileSync(join(dir, f), 'utf8')) }))
    .filter((h) => h.card.rodada === rodada && h.card.status === 'escrita');
  // Without this, an already tested round would overwrite its csv in the R2 with only the header.
  if (!hips.length) throw new Error(`rodada ${rodada}: nenhuma hipótese com status 'escrita'`);
  const db = new pg.Client();
  await db.connect();
  const feitos = [];
  const semTeste: { id: string; f: string; motivo: string }[] = [];
  try {
    for (const h of hips) {
      const t = TESTES[h.card.id];
      if (!t) throw new Error(`sem teste escrito para ${h.card.id}`);
      const r = await t(db);
      if ('semTeste' in r) {
        semTeste.push({ id: h.card.id, f: h.f, motivo: r.semTeste });
        console.log(h.card.id, 'sem teste:', r.semTeste);
        continue;
      }
      feitos.push({ id: h.card.id, f: h.f, ...r });
      console.log(h.card.id, r.efeito, r.p);
    }
  } finally {
    await db.end();
  }
  const hoje = new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10);
  const fechados = fecharRodada(feitos);
  const linhas = [
    'id,n,anos,efeito,unidade,p,p_ajustado,passa_bh,segundo_recorte,segundo_efeito,segundo_p,confianca,permutacoes,semente,banco,testada_em',
  ];
  for (const r of fechados) {
    const segundoRecorte = segundoConfirma(r, r.segundo);
    const confianca = grauDeConfianca({ passa: r.passa, segundoRecorte, medido: true, mecanismo: !direcaoContraria(r), anos: r.anos }); // the written mechanism is for the expected direction
    const contra = direcaoContraria(r) ? ', na direção contrária à esperada: a hipótese não se confirma' : '';
    const frase = `${r.texto(r.efeito)}; p = ${r.p.toFixed(4)}, p ajustado (BH da rodada ${rodada}) = ${r.p_ajustado.toFixed(4)}, ${r.passa ? 'passa' : 'não passa'} na correção${contra}`;
    const seg = r.segundo
      ? ` Segundo recorte (${r.segundo.nome}): ${r.segundo.efeito.toFixed(2)}, p = ${r.segundo.p.toFixed(4)}, ${segundoRecorte ? 'confirma' : 'não confirma'}.`
      : '';
    const porque =
      r.anos < 8
        ? 'menos de 8 anos de dado'
        : !r.passa
          ? 'não passa na correção'
          : segundoRecorte
            ? 'passa na correção e o segundo recorte confirma'
            : r.segundo
              ? 'o segundo recorte não confirma'
              : 'falta um segundo recorte independente';
    const detalhe = `${frase}.${seg} Confiança ${confianca}: ${porque}. ${r.dado ?? 'Dado medido'}; ${N} permutações, semente ${SEMENTE}, banco ${process.env.PGDATABASE} em ${hoje}. Números em produtos/contexto/rodada-${rodada}.csv.`;
    const p = join(dir, r.f);
    writeFileSync(
      p,
      atualizarHipotese(readFileSync(p, 'utf8'), { status: 'testada', testada_em: hoje, confianca, resultado: frase, detalhe }),
    );
    linhas.push(
      [
        r.id,
        r.n,
        r.anos,
        r.efeito.toFixed(4),
        r.unidade,
        r.p.toFixed(4),
        r.p_ajustado.toFixed(4),
        r.passa,
        r.segundo?.nome ?? '',
        r.segundo?.efeito.toFixed(4) ?? '',
        r.segundo?.p.toFixed(4) ?? '',
        confianca,
        N,
        SEMENTE,
        process.env.PGDATABASE,
        hoje,
      ]
        .map(celula)
        .join(','),
    );
  }
  // What the data do not allow testing as written: sem-teste with the reason, out of the correction (the test does not change).
  for (const r of semTeste) {
    const p = join(dir, r.f);
    const motivo = `Sem teste na rodada ${rodada} (${hoje}): ${r.motivo}.`;
    writeFileSync(
      p,
      atualizarHipotese(readFileSync(p, 'utf8'), {
        status: 'sem-teste',
        testada_em: hoje,
        confianca: '',
        resultado: motivo,
        detalhe: motivo,
      }),
    );
    linhas.push(
      [r.id, '', '', '', '', '', '', '', '', '', '', 'sem-teste', N, SEMENTE, process.env.PGDATABASE, hoje].map(celula).join(','),
    );
  }
  const tmp = mkdtempSync(join(tmpdir(), 'rodada-'));
  writeFileSync(join(tmp, `rodada-${rodada}.csv`), linhas.join('\n') + '\n');
  await enviar(join(tmp, `rodada-${rodada}.csv`), `produtos/contexto/rodada-${rodada}.csv`, { sobrescrever: true });
  console.log(linhas.join('\n'));
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
