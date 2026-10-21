import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { loadMetarIem, loadMetarRaw, loadOpenaq, loadOpenMeteo } from './ar-vento.ts';
import { loadOnce, pendingFiles, registrar } from './lib.ts';
import { parseMetar, reportTime } from './metar.ts';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, '__fixtures__', name), 'utf8');
const iem = fixture('metar-iem.csv')
  .trim()
  .split('\n')
  .slice(1)
  .map((l) => l.split(',')[2]);

test('the fixture has 20 real METARs from the IEM raw file', () => expect(iem).toHaveLength(20));

test.each([
  [
    'SBEG 010239Z 13004KT 4000 FU NSC 30/25 Q1011',
    { vento_dir: 130, vento_kt: 4, visibilidade_m: 4000, tempo: ['FU'], temperatura: 30, orvalho: 25 },
  ],
  ['SBEG 051000Z VRB01KT 5000 BR FU NSC 23/21 Q1013', { vento_dir: null, vento_kt: 1, visibilidade_m: 5000, tempo: ['BR', 'FU'] }],
  ['SBEG 010300Z 00000KT CAVOK 25/24 Q1012', { vento_dir: null, vento_kt: 0, visibilidade_m: 10000, tempo: [] }],
  ['SBEG 011900Z VRB03KT 9999 SCT030 FEW035TCU SCT050 32/26 Q1008', { vento_dir: null, vento_kt: 3, visibilidade_m: 10000 }],
  ['SBEG 100200Z 02006KT 9999 -RA VCTS SCT025 FEW030CB 24/23 Q1012', { vento_dir: 20, tempo: ['-RA', 'VCTS'] }],
  [
    'SBEG 091629Z 02012G28KT 330V060 0400 R11/0800 +TSRA BKN006 FEW023CB BKN100 23/23 Q1014',
    { vento_kt: 12, rajada_kt: 28, visibilidade_m: 400, tempo: ['+TSRA'] },
  ],
  ['SBEG 301300Z 21003KT 4000 HZ FEW015 SCT330 29/23 Q1016', { visibilidade_m: 4000, tempo: ['HZ'] }],
  [
    'METAR SBMN 212100Z 17003KT 9999 SCT025 FEW030TCU 33/25 Q1007=',
    { estacao: 'SBMN', texto: 'SBMN 212100Z 17003KT 9999 SCT025 FEW030TCU 33/25 Q1007' },
  ],
  ['SBEG 010000Z 11002KT 9999 FEW020 M01/M03 Q1011 RMK FU', { temperatura: -1, orvalho: -3, tempo: [] }],
  // Old IEM records rebuilt from NOAA ISD (before 2012): miles, no present weather.
  ['SBEG 200100Z AUTO 00000KT 6SM 30/23 A2985 RMK T03000230 IEM_DS3505', { vento_kt: 0, visibilidade_m: 9656, temperatura: 30 }],
  ['SBEG 200100Z AUTO 00000KT 2 1/2SM 30/23 A2985', { visibilidade_m: 4023 }],
  ['SBEG 200100Z AUTO 00000KT 1/2SM 30/23 A2985', { visibilidade_m: 805 }],
  ['SBEG 200100Z AUTO 00000KT 7SM 30/23 A2985', { visibilidade_m: 10000 }],
])('%s', (metar, expected) => expect(parseMetar(metar)).toMatchObject(expected));

test('every fixture METAR parses wind, visibility and temperature', () => {
  for (const m of iem.map(parseMetar)) {
    expect(m.vento_kt).not.toBeNull();
    expect(m.visibilidade_m).not.toBeNull();
    expect(m.temperatura).not.toBeNull();
  }
  expect(iem.map(parseMetar).filter((m) => m.tempo.some((t) => /FU|HZ/.test(t)))).toHaveLength(8);
});

test('report time takes month and year from the download, and goes back a month across the turn', () => {
  expect(reportTime('SBEG 212100Z 1', new Date('2026-10-21T21:55:00Z')).toISOString()).toBe('2026-10-21T21:00:00.000Z');
  expect(reportTime('SBEG 302300Z 1', new Date('2026-11-01T00:30:00Z')).toISOString()).toBe('2026-10-30T23:00:00.000Z');
});

comBanco('carga de ar e vento', () => {
  const db = new pg.Client();
  const file = (fonte: string, chave: string) =>
    registrar(db, { chave, fonte, sha256: 'a'.repeat(64), baixado_em: '2026-10-21T22:00:00Z' });
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());
  const count = async (t: string) => (await db.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
  const twice = async (id: number, tabela: string, load: () => Promise<number>) => {
    await loadOnce(db, id, tabela, load);
    await load(); // a second run inserts nothing
  };

  test('OpenAQ: sensor from the file name, idempotent', async () => {
    const chave = 'bruto/openaq/2026/10/21/215251Z_sensor-13574643-pm25.json';
    const id = await file('openaq', chave);
    await twice(id, 'openaq.medicao', () => loadOpenaq(db, id, chave, fixture('openaq-pm25.json')));
    expect(await count('openaq.medicao')).toBe(4);
    expect(await loadOpenaq(db, id, 'bruto/openaq/x_locations-regiao.json', '{"results":[]}')).toBe(0);
    expect(await pendingFiles(db, 'openaq', 'openaq.medicao')).toEqual([]);
  });

  test('METAR: IEM and aviationweather are the same report, kept once', async () => {
    const a = await file('iem-asos', 'bruto/iem-asos/a.csv');
    await twice(a, 'metar.observacao', () => loadMetarIem(db, a, fixture('metar-iem.csv')));
    expect(await count('metar.observacao')).toBe(20);
    const b = await file('metar-aviationweather', 'bruto/metar-aviationweather/b.txt');
    await twice(b, 'metar.observacao', () => loadMetarRaw(db, b, fixture('metar-aviationweather.txt'), new Date('2026-10-21T21:56:00Z')));
    const n = fixture('metar-aviationweather.txt').trim().split('\n').length;
    expect(await count('metar.observacao')).toBe(20 + n);
    const same = `SBEG 011900Z VRB03KT 9999 SCT030 FEW035TCU SCT050 32/26 Q1008`;
    await loadMetarRaw(db, b, `METAR ${same}=`, new Date('2024-01-01T19:30:00Z'));
    expect(await count('metar.observacao')).toBe(20 + n);
    expect((await db.query("SELECT count(*)::int AS n FROM metar.observacao WHERE tempo && '{FU,HZ}'")).rows[0].n).toBe(8);
  });

  test('Open-Meteo weather and CAMS: one row per hour and download, idempotent', async () => {
    const t = await file('open-meteo-previsao', 'bruto/open-meteo-previsao/t.json');
    await twice(t, 'openmeteo.tempo_hora', () =>
      loadOpenMeteo(db, t, 'openmeteo.tempo_hora', fixture('open-meteo-tempo.json'), new Date('2026-10-21T21:58:51Z')),
    );
    const a = await file('open-meteo-qualidade-ar', 'bruto/open-meteo-qualidade-ar/a.json');
    await twice(a, 'openmeteo.ar_hora', () =>
      loadOpenMeteo(db, a, 'openmeteo.ar_hora', fixture('open-meteo-ar.json'), new Date('2026-10-21T21:58:57Z')),
    );
    expect([await count('openmeteo.tempo_hora'), await count('openmeteo.ar_hora')]).toEqual([4, 4]);
    const r = (
      await db.query(
        'SELECT wind_direction_850hpa, pm2_5 FROM openmeteo.tempo_hora JOIN openmeteo.ar_hora USING (valido_em) ORDER BY valido_em LIMIT 1',
      )
    ).rows[0];
    expect(r.wind_direction_850hpa).toBe(JSON.parse(fixture('open-meteo-tempo.json')).hourly.wind_direction_850hPa[0]);
    expect(r.pm2_5).toBeCloseTo(JSON.parse(fixture('open-meteo-ar.json')).hourly.pm2_5[0], 3);
    expect(await loadOpenMeteo(db, t, 'openmeteo.tempo_hora', 'Unexpected error while streaming data: timeoutReached', new Date())).toBe(0);
  });
});
