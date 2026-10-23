import { join } from 'node:path';
import { lerGrib, mediaDiaria, pedidoAno } from './cams.ts';

// A real EAC4 request (2024-09-01 and 02, every 3 h, PM2.5 and PM10, 2° around Manaus), as it came from the ADS.
const fixture = join(import.meta.dirname, 'carga', '__fixtures__', 'cams-eac4_2024-09-01_2024-09-02.grib');

test('one request per year: PM2.5 and PM10 every 3 h, 2° around Manaus (N, W, S, E), GRIB', () => {
  expect(pedidoAno(2015).inputs).toMatchObject({
    variable: ['particulate_matter_2.5um', 'particulate_matter_10um'],
    date: ['2015-01-01/2015-12-31'],
    time: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
    area: [-1.1, -62.02, -5.1, -58.02],
    data_format: 'grib',
  });
});

test('the grid point nearest Manaus, in µg/m³; a Manaus day (UTC−4) only with its 8 values, 06Z to 03Z of the next', () => {
  const r = lerGrib(fixture);
  expect(r).toHaveLength(32); // 2 days × 8 times × 2 fields
  expect(r.every((x) => x.valor > 0 && x.valor < 1000)).toBe(true); // kg/m³ × 1e9
  const dias = mediaDiaria(r);
  expect(dias.map((d) => d.dia)).toEqual(['2024-09-01']); // 08-31 has 2 values, 09-02 has 6
  const pm25 = r.filter((x) => x.campo === 'pm25' && x.t >= Date.UTC(2024, 8, 1, 6) && x.t <= Date.UTC(2024, 8, 2, 3));
  expect(dias[0].pm25).toBeCloseTo(pm25.reduce((s, x) => s + x.valor, 0) / 8, 6);
  expect(dias[0].pm10).toBeGreaterThan(dias[0].pm25);
});
