// AERONET load (#53): print_web_data_v3 daily means (AVG=20) → aeronet.aod_dia. A day already stored for the same
// site and level is overwritten by the newer file (level 1.5 can change until 2.0 comes out).
import type pg from 'pg';
import { loadOnce } from './lib.ts';

export type AodDia = {
  site: string;
  dia: string;
  nivel: '1.5' | '2.0';
  aod_500: number | null;
  angstrom_440_870: number | null;
  n: number;
};

const num = (v: string) => (v === undefined || Number(v) === -999 || v === '' ? null : Number(v));

export function parseAeronet(texto: string): AodDia[] {
  const linhas = texto
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((l) => l.trim());
  const i = linhas.findIndex((l) => l.startsWith('AERONET_Site,'));
  if (i < 0) return [];
  const cab = linhas[i].split(',');
  const col = (n: string) => cab.indexOf(n);
  return linhas
    .slice(i + 1)
    .filter((l) => l.includes(','))
    .map((l) => {
      const v = l.split(',');
      const [d, m, a] = v[col('Date(dd:mm:yyyy)')].split(':');
      return {
        site: v[col('AERONET_Site')],
        dia: `${a}-${m}-${d}`,
        nivel: v[col('Data_Quality_Level')] === 'lev20' ? '2.0' : '1.5',
        aod_500: num(v[col('AOD_500nm')]),
        angstrom_440_870: num(v[col('440-870_Angstrom_Exponent')]),
        n: Number(v[col('N[AOD_500nm]')]) || 0,
      };
    });
}

export function loadAeronet(db: pg.ClientBase, arquivo: number, linhas: AodDia[]): Promise<number> {
  return loadOnce(db, arquivo, 'aeronet.aod_dia', async () => {
    for (const l of linhas)
      await db.query(
        `INSERT INTO aeronet.aod_dia (site, dia, nivel, aod_500, angstrom_440_870, n, arquivo) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (site, dia, nivel) DO UPDATE SET aod_500 = excluded.aod_500, angstrom_440_870 = excluded.angstrom_440_870,
           n = excluded.n, arquivo = excluded.arquivo`,
        [l.site, l.dia, l.nivel, l.aod_500, l.angstrom_440_870, l.n, arquivo],
      );
    return linhas.length;
  });
}
