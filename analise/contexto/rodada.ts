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
import { benjaminiHochberg, mediana, permutacaoBlocos, permutacaoGrupos, sorteio, spearman } from '../cruzar.ts';

/** BH (FDR q) over the main tests of one round. */
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

type Teste = { efeito: number; p: number; n: number; anos: number; texto: (e: number) => string; unidade: string };
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

const TESTES: Record<string, (db: pg.Client) => Promise<Teste>> = {
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

async function principal(args: string[]) {
  const rodada = args[args.indexOf('--rodada') + 1];
  const dir = join(import.meta.dirname, '../../pesquisa/hipoteses');
  const hips = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => ({ f, card: lerFrontMatter(readFileSync(join(dir, f), 'utf8')) }))
    .filter((h) => h.card.rodada === rodada && h.card.status === 'escrita');
  const db = new pg.Client();
  await db.connect();
  const feitos = [];
  try {
    for (const h of hips) {
      const t = TESTES[h.card.id];
      if (!t) throw new Error(`sem teste escrito para ${h.card.id}`);
      feitos.push({ id: h.card.id, f: h.f, ...(await t(db)) });
      console.log(h.card.id, feitos.at(-1)!.efeito, feitos.at(-1)!.p);
    }
  } finally {
    await db.end();
  }
  const hoje = new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10);
  const fechados = fecharRodada(feitos);
  const linhas = ['id,n,anos,efeito,unidade,p,p_ajustado,passa_bh,confianca,permutacoes,semente,banco,testada_em'];
  for (const r of fechados) {
    const confianca = grauDeConfianca({ passa: r.passa, segundoRecorte: false, medido: true, mecanismo: true, anos: r.anos });
    const frase = `${r.texto(r.efeito)}; p = ${r.p.toFixed(4)}, p ajustado (BH da rodada ${rodada}) = ${r.p_ajustado.toFixed(4)}, ${r.passa ? 'passa' : 'não passa'} na correção`;
    const detalhe = `${frase}. Confiança ${confianca}: ${r.anos < 8 ? 'menos de 8 anos de dado' : r.passa ? 'falta um segundo recorte independente' : 'não passa na correção'}. Dado medido; ${N} permutações, semente ${SEMENTE}, banco ${process.env.PGDATABASE} em ${hoje}. Números em produtos/contexto/rodada-${rodada}.csv.`;
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
        confianca,
        N,
        SEMENTE,
        process.env.PGDATABASE,
        hoje,
      ].join(','),
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
