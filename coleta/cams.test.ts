import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { lerGrib, mediaDiaria, mediaPrevisao, pedidoAno, pedidoPrevisao } from './cams.ts';

// A real EAC4 request (2024-09-01 and 02, every 3 h, PM2.5 and PM10, 2° around Manaus), as it came from the ADS.
const fixture = join(import.meta.dirname, 'carga', '__fixtures__', 'cams-eac4_2024-09-01_2024-09-02.grib');
// A real archived forecast request (#113): runs of 2015-09-14 and 15 at 00 UTC, PM2.5, leads 30 to 75 h.
const previsao = join(import.meta.dirname, 'carga', '__fixtures__', 'cams-previsao_2015-09-14_2015-09-15.grib');
let temGdal = true;
try {
  execFileSync('gdalinfo', ['--version'], { stdio: 'ignore' });
} catch {
  temGdal = false; // the CI runner has no GDAL; this PC does
}

test('one request per year: PM2.5 and PM10 every 3 h, 2° around Manaus (N, W, S, E), GRIB', () => {
  expect(pedidoAno(2015).inputs).toMatchObject({
    variable: ['particulate_matter_2.5um', 'particulate_matter_10um'],
    date: ['2015-01-01/2015-12-31'],
    time: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
    area: [-1.1, -62.02, -5.1, -58.02],
    data_format: 'grib',
  });
});

(temGdal ? test : test.skip)(
  'the grid point nearest Manaus, in µg/m³; a Manaus day (UTC−4) only with its 8 values, 06Z to 03Z of the next',
  () => {
    const r = lerGrib(fixture);
    expect(r).toHaveLength(32); // 2 days × 8 times × 2 fields
    expect(r.every((x) => x.valor > 0 && x.valor < 1000)).toBe(true); // kg/m³ × 1e9
    const dias = mediaDiaria(r);
    expect(dias.map((d) => d.dia)).toEqual(['2024-09-01']); // 08-31 has 2 values, 09-02 has 6
    const pm25 = r.filter((x) => x.campo === 'pm25' && x.t >= Date.UTC(2024, 8, 1, 6) && x.t <= Date.UTC(2024, 8, 2, 3));
    expect(dias[0].pm25).toBeCloseTo(pm25.reduce((s, x) => s + x.valor, 0) / 8, 6);
    expect(dias[0].pm10).toBeGreaterThan(dias[0].pm25);
  },
);

test('forecast: one request per season, 00 UTC runs from 2 days before Aug 1, leads 30 to 75 h every 3 h', () => {
  const p = pedidoPrevisao(2015).inputs;
  expect(p).toMatchObject({ date: ['2015-07-30/2015-11-29'], time: ['00:00'], area: pedidoAno(2015).inputs.area, data_format: 'grib' });
  expect([p.leadtime_hour[0], p.leadtime_hour.at(-1), p.leadtime_hour.length]).toEqual(['30', '75', 16]);
});

(temGdal ? test : test.skip)('forecast: mean of the Manaus day per days ahead (day minus the run date), 8 values each', () => {
  const r = lerGrib(previsao);
  expect(r).toHaveLength(32); // 2 runs × 16 leads
  expect(new Date(r[0].rodada).toISOString()).toBe('2015-09-14T00:00:00.000Z');
  const dias = mediaPrevisao(r);
  expect(dias.map((d) => `${d.dia} ${d.antecedencia}`)).toEqual(['2015-09-15 1', '2015-09-16 1', '2015-09-16 2', '2015-09-17 2']);
  const um = r.filter((x) => x.rodada === Date.UTC(2015, 8, 14) && x.t <= Date.UTC(2015, 8, 16, 3));
  expect(dias[0].pm25).toBeCloseTo(um.reduce((s, x) => s + x.valor, 0) / 8, 6);
  expect(mediaPrevisao(r.slice(1))).toHaveLength(3); // a day missing one time is dropped
});
