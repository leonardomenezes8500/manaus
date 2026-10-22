import { arquivosQueFaltam, conferirGrib, nomeBruto, rodadasProntas, urlGfs } from './gfs.ts';

test('filter URL: UGRD, VGRD and VVEL on the 8 levels from 1000 to 700 hPa, the region box', () => {
  const u = new URL(urlGfs({ rodada: '2026102112', passo: '003' }));
  expect(u.origin + u.pathname).toBe('https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl');
  const q = u.searchParams;
  expect(q.get('dir')).toBe('/gfs.20261021/12/atmos');
  expect(q.get('file')).toBe('gfs.t12z.pgrb2full.0p50.f003');
  for (const v of ['UGRD', 'VGRD', 'VVEL']) expect(q.get(`var_${v}`)).toBe('on');
  for (const n of [700, 800, 850, 900, 925, 950, 975, 1000]) expect(q.get(`lev_${n}_mb`)).toBe('on');
  expect([q.get('toplat'), q.get('leftlon'), q.get('rightlon'), q.get('bottomlat')]).toEqual(['3', '-74', '-52', '-15']);
  expect(nomeBruto({ rodada: '2026102112', passo: '003' })).toBe('gfs_2026102112_f003.grib');
});

test('runs ready at a given UTC time: 4 h after the run, back to the start day', () => {
  // 10:30 UTC: the 06 run is ready (06+4 = 10), the 12 run is not.
  expect(rodadasProntas(new Date('2026-10-22T10:30:00Z'), '2026-10-21')).toEqual([
    '2026102100',
    '2026102106',
    '2026102112',
    '2026102118',
    '2026102200',
    '2026102206',
  ]);
  expect(rodadasProntas(new Date('2026-10-22T09:59:00Z'), '2026-10-22')).toEqual(['2026102200']);
});

test('missing files: f000 and f003 of each run not yet in R2', () => {
  const chaves = ['bruto/noaa-gfs-nomads/2026/10/22/043000Z_gfs_2026102200_f000.grib'];
  expect(arquivosQueFaltam(chaves, ['2026102200', '2026102206'])).toEqual([
    { rodada: '2026102200', passo: '003' },
    { rodada: '2026102206', passo: '000' },
    { rodada: '2026102206', passo: '003' },
  ]);
});

test('a body that does not start with GRIB is refused (NOMADS can answer 200 with HTML)', () => {
  expect(() => conferirGrib(Buffer.from('GRIB\0\0\0\x02'), 'k')).not.toThrow();
  expect(() => conferirGrib(Buffer.from('<html>data not available</html>'), 'k')).toThrow('não é GRIB');
});
