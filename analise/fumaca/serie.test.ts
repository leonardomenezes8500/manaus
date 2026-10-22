import pg from 'pg';
import { registrar } from '../../coleta/carga/lib.ts';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { resumoAnual, type DiaSerie } from './serie.ts';

const dia = (d: string, x: Partial<DiaSerie> = {}): DiaSerie => ({
  dia: d,
  horas_fu: 0,
  horas_hz: 0,
  vis_min_sem_chuva_m: 9999,
  metar_obs: 24,
  focos_800km: 0,
  frp_800km: 0,
  cota_cm: 2000,
  aod_aeronet: null,
  aod_maiac: null,
  ...x,
});

test('annual summary: FU days, low-visibility days, spots and FRP from August to November, minimum level, mean AOD of Sep–Oct', () => {
  const r = resumoAnual([
    dia('2024-07-31', { focos_800km: 1000, horas_fu: 3 }),
    dia('2024-08-01', { focos_800km: 10, frp_800km: 50, horas_fu: 2, vis_min_sem_chuva_m: 4000, aod_aeronet: 0.4 }),
    dia('2024-09-15', { focos_800km: 20, frp_800km: 70, cota_cm: 1214, aod_aeronet: 1.2 }),
    dia('2024-11-30', { focos_800km: 5, aod_aeronet: 2 }),
    dia('2024-12-01', { focos_800km: 999 }),
  ]);
  expect(r).toEqual([{ ano: 2024, dias_fu: 2, dias_vis_5km: 1, focos_ago_nov: 35, frp_ago_nov: 120, cota_min_m: 12.14, aod_set_out: 1.2 }]);
});

test('a year without data stays empty, not zero', () => {
  const r = resumoAnual([
    dia('2019-09-01', { metar_obs: 0, horas_fu: null, vis_min_sem_chuva_m: null, focos_800km: null, frp_800km: null, cota_cm: null }),
  ]);
  expect(r).toEqual([
    { ano: 2019, dias_fu: null, dias_vis_5km: null, focos_ago_nov: null, frp_ago_nov: null, cota_min_m: null, aod_set_out: null },
  ]);
});

comBanco('série no banco', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
    const a = await registrar(db, { chave: 'k', fonte: 'x', sha256: 'a'.repeat(64), baixado_em: '2026-10-21T00:00:00Z' });
    // 2024-09-10 (Manaus): FU at 14Z, HZ at 03:30Z of the 11th (still the 10th in Manaus), rain with low visibility at 20Z.
    await db.query(
      `INSERT INTO metar.observacao (estacao, observado_em, texto, visibilidade_m, tempo, arquivo) VALUES
       ('SBEG', '2024-09-10T14:00Z', 'a', 3000, '{FU}', $1),
       ('SBEG', '2024-09-11T03:30Z', 'b', 6000, '{HZ}', $1),
       ('SBEG', '2024-09-10T20:00Z', 'c', 1500, '{-RA}', $1),
       ('SBMN', '2024-09-10T14:00Z', 'd', 500, '{FU}', $1)`,
      [a],
    );
    await db.query(
      `INSERT INTO analise.focos_dia (dia, sensor, anel, focos, frp, origem) VALUES ('2024-09-10', 'VIIRS_SNPP', '800km', 42, 300, 'SP'),
       ('2024-09-10', 'VIIRS_SNPP', 'regiao', 90, 700, 'SP'), ('2024-09-12', 'VIIRS_SNPP', 'regiao', 5, 20, 'SP')`,
    );
    await db.query(
      `INSERT INTO ana.cota_diaria (estacao, dia, consistido, cota_cm, status, arquivo) VALUES (14990000, '2024-09-10', false, 1300, 1, $1)`,
      [a],
    );
    await db.query(
      `INSERT INTO aeronet.aod_dia (site, dia, nivel, aod_500, angstrom_440_870, n, arquivo) VALUES ('ATTO-Campina', '2024-09-10', '2.0', 1.1, 1.8, 30, $1)`,
      [a],
    );
  }, 120_000);
  afterAll(() => db.end());

  test('the view joins the sources per Manaus day; a day without METAR comes with nulls; no spot near Manaus is 0, no spot in the whole region (sensor outage) is null', async () => {
    const r =
      await db.query(`SELECT to_char(dia, 'YYYY-MM-DD') AS dia, horas_fu, horas_hz, vis_min_sem_chuva_m, focos_800km, cota_cm, aod_aeronet
                              FROM analise.serie_dia WHERE dia IN ('2024-09-10', '2024-09-12', '2024-09-20') ORDER BY dia`);
    expect(r.rows).toEqual([
      { dia: '2024-09-10', horas_fu: 1, horas_hz: 1, vis_min_sem_chuva_m: 3000, focos_800km: 42, cota_cm: 1300, aod_aeronet: 1.1 },
      { dia: '2024-09-12', horas_fu: null, horas_hz: null, vis_min_sem_chuva_m: null, focos_800km: 0, cota_cm: null, aod_aeronet: null },
      { dia: '2024-09-20', horas_fu: null, horas_hz: null, vis_min_sem_chuva_m: null, focos_800km: null, cota_cm: null, aod_aeronet: null },
    ]);
  });
});
