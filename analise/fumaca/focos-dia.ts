// Fire spots per Manaus day (#52): the FIRMS standard archive (SP, raw .csv.gz in R2) until it ends, then the NRT in
// firms.foco, summed per day, sensor and ring into analise.focos_dia. One-off on this PC (re-run when the SP moves on):
//   node analise/fumaca/focos-dia.ts [--sensor VIIRS_SNPP|MODIS]
import pg from 'pg';
import { fimDaFonte } from '../../coleta/firms.ts';
import { listKeys, readRaw } from '../../coleta/lib/baixar.ts';
import { MANAUS } from '../../coleta/regiao.ts';
import { diaDeManaus } from '../dia.ts';
import { distanceKm } from './heuristica.ts';

export type Deteccao = { lat: number; lon: number; em: number; frp: number };
export type Sensor = 'VIIRS_SNPP' | 'MODIS';
export const ANEL_KM = 800;

/** One line of an SP CSV (columns by name) → detection. */
export function linhaSp(cab: string[], v: string[]): Deteccao {
  const c = (n: string) => v[cab.indexOf(n)];
  const t = c('acq_time').padStart(4, '0');
  return {
    lat: Number(c('latitude')),
    lon: Number(c('longitude')),
    em: Date.parse(`${c('acq_date')}T${t.slice(0, 2)}:${t.slice(2)}:00Z`),
    frp: Number(c('frp')) || 0,
  };
}

/** Sums per Manaus day and ring, one detection at a time (14 years of S-NPP do not fit in memory at once). */
export function somador(sensor: Sensor) {
  const dias = new Map<string, { focos: number; frp: number; origens: Set<string> }>();
  return {
    somar(d: Deteccao, origem: 'SP' | 'NRT') {
      const dia = diaDeManaus(new Date(d.em));
      const aneis = distanceKm(MANAUS.lat, MANAUS.lon, d.lat, d.lon) <= ANEL_KM ? ['800km', 'regiao'] : ['regiao'];
      for (const anel of aneis) {
        const x = dias.get(`${dia}|${anel}`) ?? { focos: 0, frp: 0, origens: new Set() };
        x.focos++;
        x.frp += d.frp;
        x.origens.add(origem);
        dias.set(`${dia}|${anel}`, x);
      }
    },
    linhas: () =>
      [...dias].map(([k, x]) => {
        const [dia, anel] = k.split('|');
        return { dia, sensor, anel, focos: x.focos, frp: x.frp, origem: x.origens.size === 2 ? 'SP+NRT' : [...x.origens][0] };
      }),
  };
}

/** SP counts before `corte` (first instant without archive), NRT from it on, so a detection in both is counted once. */
export function agregarFocos(sensor: Sensor, sp: Deteccao[], nrt: Deteccao[], corte: number) {
  const s = somador(sensor);
  for (const d of sp) if (d.em < corte) s.somar(d, 'SP');
  for (const d of nrt) if (d.em >= corte) s.somar(d, 'NRT');
  return s.linhas();
}

/** UTC day → the one SP file it is read from: the first (sorted) whose window covers it, so overlapping windows count once. */
export function donosDosDias(chaves: string[]): Map<string, string> {
  const dono = new Map<string, string>();
  for (const k of [...chaves].sort()) {
    const m = k.match(/_SP_(\d{4}-\d\d-\d\d)_(\d+)d\.csv\.gz$/);
    if (!m) continue;
    for (let i = 0; i < Number(m[2]); i++) {
      const dia = new Date(Date.parse(m[1]) + i * 86_400_000).toISOString().slice(0, 10);
      if (!dono.has(dia)) dono.set(dia, k);
    }
  }
  return dono;
}

export async function gravarFocosDia(db: pg.ClientBase, linhas: ReturnType<typeof agregarFocos>): Promise<void> {
  await db.query(
    `INSERT INTO analise.focos_dia (dia, sensor, anel, focos, frp, origem)
     SELECT * FROM unnest($1::date[], $2::text[], $3::text[], $4::int[], $5::real[], $6::text[])
     ON CONFLICT (dia, sensor, anel) DO UPDATE SET focos = excluded.focos, frp = excluded.frp, origem = excluded.origem, gerado_em = now()`,
    [
      linhas.map((l) => l.dia),
      linhas.map((l) => l.sensor),
      linhas.map((l) => l.anel),
      linhas.map((l) => l.focos),
      linhas.map((l) => l.frp),
      linhas.map((l) => l.origem),
    ],
  );
}

const SATELITES: Record<Sensor, string[]> = { VIIRS_SNPP: ['N'], MODIS: ['Terra', 'Aqua'] };

async function principal(args: string[]) {
  const sensores: Sensor[] = args.includes('--sensor') ? [args[args.indexOf('--sensor') + 1] as Sensor] : ['VIIRS_SNPP', 'MODIS'];
  const db = new pg.Client();
  await db.connect();
  try {
    for (const sensor of sensores) {
      if (!SATELITES[sensor]) throw new Error(`sensor inválido: ${sensor}`);
      // The cut is the day after the SP ends, 00Z.
      const corte = Date.parse((await fimDaFonte(`${sensor}_SP`)) + 'T00:00:00Z') + 86_400_000;
      const chaves = (await listKeys('bruto/nasa-firms/'))
        .map((k) => k.key)
        .filter((k) => new RegExp(`_${sensor}_SP_.*\\.csv\\.gz$`).test(k));
      const dono = donosDosDias(chaves);
      const soma = somador(sensor);
      let nSp = 0;
      for (const k of chaves) {
        const [cab, ...linhas] = (await readRaw(k)).trim().split('\n');
        const c = cab.split(',');
        for (const l of linhas) {
          const d = linhaSp(c, l.split(','));
          if (d.em >= corte || dono.get(new Date(d.em).toISOString().slice(0, 10)) !== k) continue;
          soma.somar(d, 'SP');
          nSp++;
        }
      }
      const nrt = (
        await db.query(
          `SELECT lat, lon, extract(epoch FROM adquirido_em) * 1000 AS em, coalesce(frp, 0) AS frp FROM firms.foco WHERE satelite = ANY($1) AND adquirido_em >= $2`,
          [SATELITES[sensor], new Date(corte)],
        )
      ).rows;
      for (const r of nrt) soma.somar({ lat: r.lat, lon: r.lon, em: Number(r.em), frp: r.frp }, 'NRT');
      const linhas = soma.linhas();
      await gravarFocosDia(db, linhas);
      console.log(
        `${sensor}: ${chaves.length} arquivos SP (${nSp} focos), ${nrt.length} focos NRT depois de ${new Date(corte).toISOString().slice(0, 10)} → ${linhas.length} linhas`,
      );
    }
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
