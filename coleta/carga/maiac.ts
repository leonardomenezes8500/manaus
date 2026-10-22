// MAIAC load (#54): the CSV that analise/maiac/extrair.py writes from an MCD19A2 file → daily mean of the
// best-quality pixels per point, Manaus day and satellite → maiac.aod.
import type pg from 'pg';
import { diaDeManaus } from '../../analise/dia.ts';
import { loadOnce } from './lib.ts';

const FILL = -28672;
const ESCALA = 0.001;

/** MCD19A2 AOD_QA: cloud mask (bits 0–2) clear, adjacency (bits 5–7) normal, AOD quality (bits 8–11) best. */
export const qaMelhor = (qa: number) => (qa & 0b111) === 0b001 && ((qa >> 5) & 0b111) === 0 && ((qa >> 8) & 0b1111) === 0;

/** Pass time YYYYDDDHHMM (UTC, day of year) → ms. */
const hora = (s: string) => Date.UTC(Number(s.slice(0, 4)), 0, Number(s.slice(4, 7)), Number(s.slice(7, 9)), Number(s.slice(9, 11)));

export function parseMaiac(csv: string) {
  return csv
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => l.split(','))
    .filter((v) => Number(v[6]) !== FILL)
    .map((v) => ({
      ponto: v[0],
      em: hora(v[2]),
      satelite: v[3] === 'A' ? ('Aqua' as const) : ('Terra' as const),
      aod: Math.round(Number(v[6]) * ESCALA * 1000) / 1000,
      qa: Number(v[7]),
    }));
}

export function mediaDoDia(linhas: ReturnType<typeof parseMaiac>) {
  const por = new Map<string, number[]>();
  for (const l of linhas.filter((x) => qaMelhor(x.qa))) {
    const k = `${l.ponto}|${diaDeManaus(new Date(l.em))}|${l.satelite}`;
    por.set(k, [...(por.get(k) ?? []), l.aod]);
  }
  return [...por]
    .map(([k, v]) => {
      const [ponto, dia, satelite] = k.split('|');
      return { ponto, dia, satelite, aod_550: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 1000) / 1000, pixels: v.length };
    })
    .sort((a, b) => (a.ponto + a.dia + a.satelite).localeCompare(b.ponto + b.dia + b.satelite));
}

export function loadMaiac(db: pg.ClientBase, arquivo: number, linhas: ReturnType<typeof mediaDoDia>): Promise<number> {
  return loadOnce(db, arquivo, 'maiac.aod', async () => {
    for (const l of linhas)
      await db.query(
        `INSERT INTO maiac.aod (ponto, dia, satelite, aod_550, pixels, arquivo) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (ponto, dia, satelite) DO UPDATE SET aod_550 = excluded.aod_550, pixels = excluded.pixels, arquivo = excluded.arquivo`,
        [l.ponto, l.dia, l.satelite, l.aod_550, l.pixels, arquivo],
      );
    return linhas.length;
  });
}
