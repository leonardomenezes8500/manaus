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
