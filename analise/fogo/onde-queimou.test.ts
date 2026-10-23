import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from '../../coleta/carga/lib.ts';
import { anoProdes, categoriaCnfp, categoriaProdes, classificar, classificarFocos, somadorOnde } from './onde-queimou.ts';

test('the PRODES year goes from August to July', () => {
  expect(anoProdes('2024-07-31')).toBe(2024);
  expect(anoProdes('2024-08-01')).toBe(2025);
});

test('PRODES class → category relative to the year of the spot', () => {
  expect(categoriaProdes(24, '2024-07-31')).toBe('desm_ano'); // d2024, PRODES year 2024
  expect(categoriaProdes(24, '2024-08-01')).toBe('desm_1a3'); // same pixel, PRODES year 2025
  expect(categoriaProdes(24, '2023-07-01')).toBe('desm_depois'); // the forest was cut after the spot
  expect(categoriaProdes(13, '2016-09-01')).toBe('desm_4mais');
  expect(categoriaProdes(3, '2012-09-01')).toBe('desm_ate2007');
  expect(categoriaProdes(55, '2020-09-01')).toBe('residuo');
  expect(categoriaProdes(100, '2020-09-01')).toBe('floresta');
  expect(categoriaProdes(101, '2020-09-01')).toBe('nao_floresta');
  expect(categoriaProdes(91, '2020-09-01')).toBe('hidrografia');
  expect(categoriaProdes(null, '2020-09-01')).toBe('sem_dado');
  expect(categoriaProdes(255, '2020-09-01')).toBe('sem_dado');
});

test('one category per dimension: a spot in a TI that is also public forest counts in both; the stronger class wins', () => {
  const c = classificar(
    {
      uf: 'AM',
      ti: true,
      uc: ['Uso Sustentável', 'Proteção Integral'],
      faixa: true,
      cnfp: ['A:1991', 'B:'],
      deter: ['CICATRIZ_DE_QUEIMADA', 'DESMATAMENTO_CR'],
      prodes: 100,
    },
    '2024-09-10',
  );
  expect(c).toEqual({ uf: 'AM', ti: 'sim', uc: 'protecao_integral', protegida: 'sim', cnfp: 'B', prodes: 'floresta', deter: 'corte_raso' });
  expect(classificar({ uf: null, ti: false, uc: [], faixa: true, cnfp: [], deter: ['DEGRADACAO'], prodes: null }, '2024-09-10')).toEqual({
    uf: 'fora',
    ti: 'nao',
    uc: 'nao',
    protegida: 'faixa_10km',
    cnfp: 'nao',
    prodes: 'sem_dado',
    deter: 'outro',
  });
});

test('public forest at the time of the spot: a tipo A area created after that year still counts as without destination', () => {
  expect(categoriaCnfp(['A:2008'], 2007)).toBe('B');
  expect(categoriaCnfp(['A:2008'], 2008)).toBe('A');
  expect(categoriaCnfp(['A:'], 2001)).toBe('A'); // no creation year: taken as destined
  expect(categoriaCnfp([], 2020)).toBe('nao');
});

test('totals: each spot once per dimension, so every dimension sums to the spot count', () => {
  const s = somadorOnde();
  const base = { uf: 'AM', ti: 'nao', uc: 'nao', protegida: 'nao', cnfp: 'nao', prodes: 'floresta', deter: 'nao' };
  s.somar('2024-09-10', 'VIIRS_SNPP', { ...base, ti: 'sim' }, 10);
  s.somar('2024-09-10', 'VIIRS_SNPP', base, 5);
  const l = s.linhas();
  expect(l.filter((x) => x.dimensao === 'ti')).toEqual([
    { dia: '2024-09-10', sensor: 'VIIRS_SNPP', uf: 'AM', dimensao: 'ti', categoria: 'sim', focos: 1, frp: 10 },
    { dia: '2024-09-10', sensor: 'VIIRS_SNPP', uf: 'AM', dimensao: 'ti', categoria: 'nao', focos: 1, frp: 5 },
  ]);
  expect(l.filter((x) => x.dimensao === 'prodes')).toEqual([
    { dia: '2024-09-10', sensor: 'VIIRS_SNPP', uf: 'AM', dimensao: 'prodes', categoria: 'floresta', focos: 2, frp: 15 },
  ]);
});

let temGdal = true;
try {
  execFileSync('gdallocationinfo', ['--version'], { stdio: 'ignore' });
} catch {
  temGdal = false; // the CI runner has no GDAL
}
// 4×4 pixels of 0.025° from (-60.1, -3.1) to (-60.0, -3.0): 24 top left, 33 bottom left, 3 on the right.
const raster = join(import.meta.dirname, '..', '..', 'coleta', 'lib', '__fixtures__', 'classes.tif');

comBanco('onde caiu cada foco da v1', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  (temGdal ? test : test.skip)('PostGIS layers + PRODES raster; the DETER window is the 90 days up to the spot', async () => {
    const a = await registrar(db, { chave: 'bruto/x/a', fonte: 'x', sha256: 'e'.repeat(64), baixado_em: '2026-10-23T00:00:00Z' });
    const caixa = (x0: number, y0: number, x1: number, y1: number) => `ST_Multi(ST_MakeEnvelope(${x0}, ${y0}, ${x1}, ${y1}, 4326))`;
    await db.query(
      `INSERT INTO ibge.municipio (codigo, nome, uf, geom, arquivo) VALUES (1300000, 'X', 'AM', ${caixa(-60.1, -3.05, -60.05, -3.0)}, $1);
       INSERT INTO funai.terra_indigena (codigo, nome, geom, arquivo) VALUES (1, 'TI', ${caixa(-60.1, -3.02, -60.08, -3.0)}, $1);
       INSERT INTO sfb.floresta_publica (tipo, ano_criacao, geom, arquivo) VALUES ('A', 2020, ${caixa(-60.1, -3.02, -60.08, -3.0)}, $1);
       INSERT INTO inpe_desmatamento.deter (gid, classe, view_date, geom, arquivo) VALUES
         ('1_hist', 'DESMATAMENTO_CR', '2024-08-01', ${caixa(-60.1, -3.02, -60.08, -3.0)}, $1),
         ('2_hist', 'CICATRIZ_DE_QUEIMADA', '2024-05-01', ${caixa(-60.1, -3.02, -60.08, -3.0)}, $1),
         ('3_curr', 'DESMATAMENTO_CR', '2024-09-15', ${caixa(-60.02, -3.02, -60.0, -3.0)}, $1);
       INSERT INTO firms.foco (satelite, instrumento, adquirido_em, lat, lon, geom, frp, municipio, arquivo) VALUES
         ('N', 'VIIRS', '2024-09-10T18:00Z', -3.01, -60.09, ST_SetSRID(ST_Point(-60.09, -3.01), 4326), 5, 1300000, $1),
         ('N', 'VIIRS', '2024-09-10T18:00Z', -3.01, -60.06, ST_SetSRID(ST_Point(-60.06, -3.01), 4326), 5, 1300000, $1),
         ('N', 'VIIRS', '2024-09-10T18:00Z', -3.01, -59.98, ST_SetSRID(ST_Point(-59.98, -3.01), 4326), 5, NULL, $1),
         ('N', 'VIIRS', '2024-09-10T18:00Z', -3.01, -60.01, ST_SetSRID(ST_Point(-60.01, -3.01), 4326), 5, NULL, $1);`.replaceAll(
        '$1',
        String(a),
      ),
    );
    const ids = (await db.query('SELECT id FROM firms.foco ORDER BY lon')).rows.map((r) => Number(r.id));
    expect(await classificarFocos(db, ids, raster)).toBe(4);
    const { rows } = await db.query(
      'SELECT o.uf, ti, uc, protegida, cnfp, prodes, deter FROM analise.onde_queimou_foco o JOIN firms.foco f ON f.id = o.foco ORDER BY f.lon',
    );
    expect(rows).toEqual([
      // d2024, spot in PRODES year 2025; the public forest was created in 2020
      { uf: 'AM', ti: 'sim', uc: 'nao', protegida: 'sim', cnfp: 'A', prodes: 'desm_1a3', deter: 'corte_raso' },
      // 2.2 km east of the TI: the 10 km band
      { uf: 'AM', ti: 'nao', uc: 'nao', protegida: 'faixa_10km', cnfp: 'nao', prodes: 'desm_1a3', deter: 'nao' },
      // 7.8 km from the TI; the alert here is after the spot
      { uf: 'fora', ti: 'nao', uc: 'nao', protegida: 'faixa_10km', cnfp: 'nao', prodes: 'desm_ate2007', deter: 'nao' },
      // 11 km from the TI and off the raster
      { uf: 'fora', ti: 'nao', uc: 'nao', protegida: 'nao', cnfp: 'nao', prodes: 'sem_dado', deter: 'nao' },
    ]);
  });
});
