import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { RMM_BBOX } from '../regiao.ts';
import { registrar } from './lib.ts';
import { cortar, loadSelva, parseSelva } from './selva.ts';

// Shortened real answer of the SELVA map (api.php?route=purpleair, 2026-10-28): the PurpleAir /v1/sensors format.
const resposta = (data: unknown[][]) =>
  JSON.stringify({
    api_version: 'V1.2.3-1.1.45',
    time_stamp: 1793213421,
    data_time_stamp: 1793213404,
    max_age: 0,
    fields: ['sensor_index', 'last_seen', 'name', 'latitude', 'longitude', 'temperature', 'pm2.5'],
    data,
  });
const uea: unknown[] = [31509, 1793213339, 'UEA-EST', -3.091649, -60.01759, 107, 45.8];
const atto: unknown[] = [296063, 1793213317, '(IPAM) Torre Atto 2', -2.1469, -59.0053, 89, 35.2];
const peru: unknown[] = [262733, 1765380503, 'Presa-estribo-izquierdo', -9.538631, -77.03746, 62, 0];
const semPm: unknown[] = [1634, 1551832187, 'Sem PM', -3.1, -60.0, null, null];

test('parse: one row per sensor, last_seen as UTC time, temperature kept in °F as it comes', () => {
  expect(parseSelva(resposta([uea, semPm]))).toEqual([
    {
      sensor: 31509,
      nome: 'UEA-EST',
      lat: -3.091649,
      lon: -60.01759,
      visto_em: '2026-10-28T18:48:59.000Z',
      pm25: 45.8,
      temperatura_f: 107,
    },
    { sensor: 1634, nome: 'Sem PM', lat: -3.1, lon: -60, visto_em: '2019-03-06T00:29:47.000Z', pm25: null, temperatura_f: null },
  ]);
});

test('parse reads the columns by name, not by position', () => {
  const j = {
    fields: ['pm2.5', 'name', 'sensor_index', 'longitude', 'latitude', 'last_seen'],
    data: [[45.8, 'UEA-EST', 31509, -60.01759, -3.091649, 1793213339]],
  };
  expect(parseSelva(JSON.stringify(j))[0]).toMatchObject({ sensor: 31509, pm25: 45.8, lat: -3.091649, temperatura_f: null });
});

test('cut keeps the answer as it is, only the sensors inside the box', () => {
  const j = JSON.parse(cortar(resposta([uea, peru, atto]), RMM_BBOX));
  expect(j.data).toEqual([uea, atto]);
  expect(j.fields).toHaveLength(7);
  expect(j.data_time_stamp).toBe(1793213404);
});

comBanco('carga SELVA', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('a reading that repeats in the next file is stored once; a new last_seen is a new reading', async () => {
    const arq = (x: string) =>
      registrar(db, { chave: `bruto/selva-uea/${x}`, fonte: 'selva-uea', sha256: x.repeat(64), baixado_em: '2026-10-28T20:10:00Z' });
    const a = await arq('a');
    const b = await arq('b');
    expect(await loadSelva(db, a, parseSelva(resposta([uea, atto])))).toBe(2);
    const novo = [31509, 1793213459, 'UEA-EST novo nome', -3.091649, -60.01759, 108, 47];
    expect(await loadSelva(db, b, parseSelva(resposta([novo, atto])))).toBe(1); // atto did not report again
    expect(await loadSelva(db, b, parseSelva(resposta([novo, atto])))).toBe(0); // same file again: no-op
    const r = await db.query('SELECT sensor, pm25, arquivo FROM selva.leitura ORDER BY sensor, visto_em');
    expect(r.rows.map((x) => [x.sensor, x.pm25, Number(x.arquivo)])).toEqual([
      [31509, 45.8, a],
      [31509, 47, b],
      [296063, 35.2, a],
    ]);
    const s = await db.query('SELECT nome, round(ST_Y(geom)::numeric, 6) AS lat FROM selva.sensor WHERE id = 31509');
    expect(s.rows[0]).toEqual({ nome: 'UEA-EST novo nome', lat: '-3.091649' });
  });
});
