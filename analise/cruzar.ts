// Crossing variables (#59): pure functions for the method in pesquisa/metodo.md. No database.
// Values may be null (no data): a pair with a null is left out.

type Num = number | null;

/** Seeded random numbers in [0, 1) (mulberry32): the same seed gives the same permutations. */
export function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ranks from 1, ties get the average rank. */
function postos(v: number[]): number[] {
  const ordem = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(v.length);
  for (let i = 0; i < ordem.length;) {
    let j = i;
    while (j + 1 < ordem.length && ordem[j + 1][0] === ordem[i][0]) j++;
    for (let k = i; k <= j; k++) r[ordem[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let c = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    c += (x[i] - mx) * (y[i] - my);
    sx += (x[i] - mx) ** 2;
    sy += (y[i] - my) ** 2;
  }
  return c / Math.sqrt(sx * sy);
}

/** Spearman correlation of the pairs where both values exist. NaN with fewer than 3 pairs. */
export function spearman(x: Num[], y: Num[]): number {
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const a = x[i];
    const b = y[i];
    if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    px.push(a);
    py.push(b);
  }
  return px.length < 3 ? NaN : pearson(postos(px), postos(py));
}

const doy = (dia: string) => (Date.parse(dia) - Date.parse(dia.slice(0, 4) + '-01-01')) / 86_400_000;

/**
 * Seasonal anomaly: each value minus the mean of the same window of the year (day of year ± `janela`) in the OTHER
 * years. Null when there is no value or no other year to compare with.
 */
export function anomalia(dias: string[], v: Num[], janela = 7): Num[] {
  const porDia = new Map<number, { ano: string; v: number }[]>();
  dias.forEach((d, i) => {
    const x = v[i];
    if (x === null) return;
    const k = Math.round(doy(d));
    porDia.set(k, [...(porDia.get(k) ?? []), { ano: d.slice(0, 4), v: x }]);
  });
  return dias.map((d, i) => {
    const x = v[i];
    if (x === null) return null;
    const k = Math.round(doy(d));
    let s = 0;
    let n = 0;
    for (let j = k - janela; j <= k + janela; j++)
      for (const o of porDia.get((j + 366) % 366) ?? []) {
        if (o.ano === d.slice(0, 4)) continue;
        s += o.v;
        n++;
      }
    return n ? x - s / n : null;
  });
}

/** Spearman between x[t] and y[t + lag], for lag = 0 … k days (the lag is chosen before, the curve is for the report). */
export function defasagens(x: Num[], y: Num[], k: number): number[] {
  return Array.from({ length: k + 1 }, (_, lag) => spearman(x.slice(0, x.length - lag), y.slice(lag)));
}

/**
 * Two-sided p-value of the Spearman correlation by permuting y in blocks of `bloco` days (days in a row are not
 * independent, so whole weeks move together). (1 + permutations at least as strong) / (n + 1).
 */
export function permutacaoBlocos(x: Num[], y: Num[], { bloco = 7, n = 999, semente = 1 } = {}): number {
  const obs = Math.abs(spearman(x, y));
  const blocos: Num[][] = [];
  for (let i = 0; i < y.length; i += bloco) blocos.push(y.slice(i, i + bloco));
  const r = sorteio(semente);
  let fortes = 0;
  for (let p = 0; p < n; p++) {
    const b = [...blocos];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    if (Math.abs(spearman(x, b.flat())) >= obs) fortes++;
  }
  return (1 + fortes) / (n + 1);
}

/** Benjamini–Hochberg over the main tests of one round: adjusted p-values (as R's p.adjust "BH") and which pass at q. */
export function benjaminiHochberg(p: number[], q = 0.1): { ajustado: number[]; rejeita: boolean[] } {
  const m = p.length;
  const ordem = p.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ajustado = new Array<number>(m);
  let min = 1;
  for (let k = m - 1; k >= 0; k--) {
    min = Math.min(min, (ordem[k][0] * m) / (k + 1));
    ajustado[ordem[k][1]] = min;
  }
  return { ajustado, rejeita: ajustado.map((a) => a <= q) };
}

export const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * Two groups (e.g. weekend × weekday, even × odd years): effect = median(group) − median(rest), two-sided p by
 * shuffling the labels, inside each block when `blocos` is given (e.g. the week of each day, so the season stays).
 * `estatistica` replaces the median difference (e.g. a log ratio); the p stays two-sided on its absolute value.
 */
export function permutacaoGrupos(
  v: number[],
  grupo: boolean[],
  {
    blocos,
    n = 999,
    semente = 1,
    estatistica,
  }: { blocos?: number[]; n?: number; semente?: number; estatistica?: (g: boolean[]) => number } = {},
) {
  const ef = estatistica ?? ((g: boolean[]) => mediana(v.filter((_, i) => g[i])) - mediana(v.filter((_, i) => !g[i])));
  const obs = ef(grupo);
  const porBloco = new Map<number, number[]>();
  v.forEach((_, i) => porBloco.set(blocos?.[i] ?? 0, [...(porBloco.get(blocos?.[i] ?? 0) ?? []), i]));
  const r = sorteio(semente);
  let fortes = 0;
  for (let k = 0; k < n; k++) {
    const g = [...grupo];
    for (const idx of porBloco.values()) {
      const rot = idx.map((i) => grupo[i]);
      for (let i = rot.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [rot[i], rot[j]] = [rot[j], rot[i]];
      }
      idx.forEach((i, j) => (g[i] = rot[j]));
    }
    if (Math.abs(ef(g)) >= Math.abs(obs)) fortes++;
  }
  return { efeito: obs, p: (1 + fortes) / (n + 1) };
}

/**
 * One value per year (e.g. a log ratio inside ÷ outside): effect = the mean, two-sided p by flipping the sign of whole
 * years at random (under no effect each year's sign is a coin toss).
 */
export function sinaisPorAnos(d: number[], { n = 999, semente = 1 } = {}): { efeito: number; p: number } {
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const obs = media(d);
  const r = sorteio(semente);
  let fortes = 0;
  for (let k = 0; k < n; k++) if (Math.abs(media(d.map((x) => (r() < 0.5 ? -x : x)))) >= Math.abs(obs)) fortes++;
  return { efeito: obs, p: (1 + fortes) / (n + 1) };
}

/**
 * Two-sided p of a statistic of a boolean label series by moving the labels in whole blocks of `bloco` days (the order
 * of the blocks is shuffled, each block stays intact): days in a row are not independent, nor are smoke days.
 */
export function rotulosEmBlocos(
  g: boolean[],
  estatistica: (g: boolean[]) => number,
  { bloco = 7, n = 999, semente = 1 } = {},
): { efeito: number; p: number } {
  const obs = estatistica(g);
  const blocos: boolean[][] = [];
  for (let i = 0; i < g.length; i += bloco) blocos.push(g.slice(i, i + bloco));
  const r = sorteio(semente);
  let fortes = 0;
  for (let k = 0; k < n; k++) {
    const b = [...blocos];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    if (Math.abs(estatistica(b.flat().slice(0, g.length))) >= Math.abs(obs)) fortes++;
  }
  return { efeito: obs, p: (1 + fortes) / (n + 1) };
}

/**
 * AUC of a score separating the true labels from the false (Mann–Whitney U / (n1 n0), ties count half). Nulls left out.
 * With `grupo` (e.g. the season of each day), only pairs inside the same group count: sum of U / sum of n1 n0.
 */
export function auc(score: Num[], rotulo: boolean[], grupo?: unknown[]): number {
  let u = 0;
  let pares = 0;
  for (const k of new Set(grupo ?? [undefined])) {
    const s: number[] = [];
    const g: boolean[] = [];
    score.forEach((x, i) => {
      if (x === null || !Number.isFinite(x) || (grupo && grupo[i] !== k)) return;
      s.push(x);
      g.push(rotulo[i]);
    });
    const n1 = g.filter(Boolean).length;
    const n0 = g.length - n1;
    const r = postos(s);
    u += r.reduce((t, x, i) => t + (g[i] ? x : 0), 0) - (n1 * (n1 + 1)) / 2;
    pares += n1 * n0;
  }
  return pares ? u / pares : NaN;
}

/**
 * Two scores for the same days: effect = AUC(a) − AUC(b), two-sided p by swapping a and b in whole blocks of `bloco` days
 * at random (under no difference each block's pair is a coin toss). Both scores are ranked first (inside each `grupo`,
 * when given), so the swap is fair; with `grupo` the AUCs count only pairs inside the same group.
 */
export function aucPareadoBlocos(
  a: Num[],
  b: Num[],
  rotulo: boolean[],
  { bloco = 7, n = 999, semente = 1, grupo }: { bloco?: number; n?: number; semente?: number; grupo?: unknown[] } = {},
) {
  const ok = a.map((x, i) => x !== null && b[i] !== null);
  const so = <T>(v: T[]) => v.filter((_, i) => ok[i]);
  const gr = grupo ? so(grupo) : so(a).map(() => 0);
  const ra = postosDentro(so(a), gr) as number[];
  const rb = postosDentro(so(b), gr) as number[];
  const g = so(rotulo);
  const obs = auc(ra, g, gr) - auc(rb, g, gr);
  const r = sorteio(semente);
  let fortes = 0;
  for (let k = 0; k < n; k++) {
    const x = [...ra];
    const y = [...rb];
    for (let i = 0; i < x.length; i += bloco)
      if (r() < 0.5) for (let j = i; j < Math.min(i + bloco, x.length); j++) [x[j], y[j]] = [y[j], x[j]];
    if (Math.abs(auc(x, g, gr) - auc(y, g, gr)) >= Math.abs(obs)) fortes++;
  }
  return { efeito: obs, p: (1 + fortes) / (n + 1) };
}

/** Ranks inside each group (e.g. the season of each day), ties averaged; a null stays null. */
export function postosDentro(v: Num[], grupo: unknown[]): Num[] {
  const r: Num[] = v.map(() => null);
  for (const g of new Set(grupo)) {
    const idx = v.map((x, i) => i).filter((i) => grupo[i] === g && v[i] !== null && Number.isFinite(v[i]));
    postos(idx.map((i) => v[i] as number)).forEach((x, k) => (r[idx[k]] = x));
  }
  return r;
}
