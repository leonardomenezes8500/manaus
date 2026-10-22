import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { novaGrade, ventoDaGrade } from './grade.ts';
import { arquivosEra5, arquivosGfs, calcularDia, chegadas, gravarDia, janela } from './trajetorias.ts';

const H = 3_600_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 13);

test('arrivals every 3 h inside the Manaus day (06Z to 03Z of the next UTC day); the wind window goes 72 h back', () => {
  expect(chegadas('2026-09-23').map(iso)).toEqual([
    '2026-09-23T06',
    '2026-09-23T09',
    '2026-09-23T12',
    '2026-09-23T15',
    '2026-09-23T18',
    '2026-09-23T21',
    '2026-09-24T00',
    '2026-09-24T03',
  ]);
  expect(janela('2026-09-23').map(iso)).toEqual(['2026-09-20T06', '2026-09-24T03']);
});

test('ERA5 files: the ones that cover every day of the window, or null when a day is missing', () => {
  const k = (n: string) => `bruto/ecmwf-cds/2026/10/22/120000Z_era5-pl_${n}.grib`;
  const chaves = [k('2026-09-01_2026-09-30'), k('2026-09-01_2026-09-30') + '.meta.json', k('2026-08-01_2026-08-31')];
  expect(arquivosEra5(chaves, '2026-09-23')).toEqual([k('2026-09-01_2026-09-30')]);
  expect(arquivosEra5(chaves, '2026-09-30')).toBeNull(); // needs 2026-10-01
  expect(arquivosEra5([...chaves, k('2026-10-01')], '2026-09-30')).toEqual([k('2026-09-01_2026-09-30'), k('2026-10-01')]);
});

test('GFS files: one per 3 h of the window, or null with a gap', () => {
  const k = (rodada: string, passo: string) => `bruto/noaa-gfs-nomads/2026/10/22/120000Z_gfs_${rodada}_f${passo}.grib`;
  const todas: string[] = [];
  for (let t = Date.parse('2026-10-17T00:00:00Z'); t <= Date.parse('2026-10-22T06:00:00Z'); t += 6 * H) {
    const r = new Date(t).toISOString().slice(0, 13).replace(/\D/g, '');
    todas.push(k(r, '000'), k(r, '003'));
  }
  const usados = arquivosGfs(todas, '2026-10-20')!;
  expect(usados).toHaveLength(32); // 2026-10-17 06Z .. 2026-10-21 03Z, every 3 h
  expect(usados[0]).toContain('gfs_2026101706_f000');
  expect(usados.at(-1)).toContain('gfs_2026102100_f003');
  expect(
    arquivosGfs(
      todas.filter((c) => !c.includes('2026101812_f003')),
      '2026-10-20',
    ),
  ).toBeNull();
  // Partial day: only the arrivals up to `ate` (here 15Z) need wind.
  const ate = Date.parse('2026-10-22T15:00:00Z');
  expect(chegadas('2026-10-22', ate).map(iso)).toEqual(['2026-10-22T06', '2026-10-22T09', '2026-10-22T12', '2026-10-22T15']);
  expect(arquivosGfs(todas, '2026-10-22')).toBeNull();
  expect(arquivosGfs(todas, '2026-10-22', Date.parse('2026-10-22T06:00:00Z'))!.at(-1)).toContain('gfs_2026102206_f000');
});

// Uniform wind from the east over the whole region and window: every trajectory goes straight east.
function gradeUniforme(dia: string) {
  const [ini, fim] = janela(dia);
  const tempos = [];
  for (let t = ini; t <= fim; t += 3 * H) tempos.push(t);
  const g = novaGrade({ lon0: -74, lat0: 3, dlon: 0.5, dlat: -0.5, nx: 45, ny: 37, niveis: [700, 850, 900, 950, 1000], tempos });
  g.u.fill(-2);
  return ventoDaGrade(g);
}

test('calcularDia: 8 arrivals × 3 levels from Manaus, 72 h each', () => {
  const linhas = calcularDia(gradeUniforme('2026-09-23'), '2026-09-23');
  expect(linhas).toHaveLength(24);
  expect(new Set(linhas.map((l) => l.nivel_hpa))).toEqual(new Set([950, 900, 850]));
  const l = linhas[0];
  expect(l.pontos).toHaveLength(73);
  expect(l.pontos[72].lon).toBeCloseTo(-60.02 + 4.67, 1); // 2 m/s from the east for 72 h ≈ 518 km
  expect(l.parou_h).toBeNull();
});

comBanco('trajetórias no banco', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('saving a day, then saving it again replaces only that day and wind', async () => {
    const linhas = calcularDia(gradeUniforme('2026-09-23'), '2026-09-23');
    await gravarDia(db, '2026-09-23', 'era5', linhas);
    await gravarDia(db, '2026-09-23', 'gfs', linhas.slice(0, 3));
    await gravarDia(db, '2026-09-23', 'era5', linhas);
    const r = await db.query(
      `SELECT meteo, count(*)::int AS n, min(ST_NPoints(geom))::int AS pontos, bool_and(ST_X(ST_EndPoint(geom)) > -56) AS leste
       FROM analise.trajetoria WHERE dia = '2026-09-23' GROUP BY meteo ORDER BY meteo`,
    );
    expect(r.rows).toEqual([
      { meteo: 'era5', n: 24, pontos: 73, leste: true },
      { meteo: 'gfs', n: 3, pontos: 73, leste: true },
    ]);
  });
});
