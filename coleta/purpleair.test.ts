import { CAMPOS, urlSensores } from './purpleair.ts';
import { RMM_BBOX } from './regiao.ts';

test('the API box is north-west and south-east corners, outdoor sensors, with the A/B channels', () => {
  const u = new URL(urlSensores(RMM_BBOX));
  expect(Object.fromEntries(['nwlng', 'nwlat', 'selng', 'selat', 'location_type'].map((k) => [k, u.searchParams.get(k)]))).toEqual({
    nwlng: '-64',
    nwlat: '0.1',
    selng: '-57.8',
    selat: '-4.5',
    location_type: '0',
  });
  expect(u.searchParams.get('fields')!.split(',')).toEqual(CAMPOS);
  expect(CAMPOS).toEqual(expect.arrayContaining(['pm2.5_cf_1_a', 'pm2.5_cf_1_b', 'humidity']));
});
