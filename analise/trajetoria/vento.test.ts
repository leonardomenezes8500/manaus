import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ventoDaGrade } from './grade.ts';
import { lerGribs } from './vento.ts';

// Real files cut small: GFS 2026-10-21 00Z f000/f003 (3 × 3 points, 850 and 950 hPa, GRIB2, level in Pa) and
// 6 messages of an ERA5 day (2026-10-15 00Z, 850 and 950 hPa, full region grid, GRIB1, level in hPa).
const fx = (n: string) => join(import.meta.dirname, '__fixtures__', n);
let temGdal = true;
try {
  execFileSync('gdalinfo', ['--version'], { stdio: 'ignore' });
} catch {
  temGdal = false; // the CI runner has no GDAL; the image and this PC do
}

(temGdal ? describe : describe.skip)('wind reader (gdalinfo + gdal_translate)', () => {
  test('GFS: two files become one grid with 2 times; values match gdallocationinfo', () => {
    const g = lerGribs([fx('gfs_2026102100_f003.grib'), fx('gfs_2026102100_f000.grib')]);
    expect({ lon0: g.lon0, lat0: g.lat0, dlon: g.dlon, dlat: g.dlat, nx: g.nx, ny: g.ny }).toEqual({
      lon0: -61,
      lat0: -2,
      dlon: 0.5,
      dlat: -0.5,
      nx: 3,
      ny: 3,
    });
    expect(g.niveis).toEqual([850, 950]);
    expect(g.tempos.map((t) => new Date(t).toISOString())).toEqual(['2026-10-21T00:00:00.000Z', '2026-10-21T03:00:00.000Z']);
    const vento = ventoDaGrade(g);
    const a = vento(-60.5, -2.5, 850, Date.parse('2026-10-21T00:00:00Z'))!;
    expect([a.u, a.v, a.w]).toEqual([expect.closeTo(-3.3546, 3), expect.closeTo(-1.2589, 3), expect.closeTo(0.8978, 3)]);
    const b = vento(-60.5, -2.5, 950, Date.parse('2026-10-21T03:00:00Z'))!;
    expect([b.u, b.v, b.w]).toEqual([expect.closeTo(-4.2153, 3), expect.closeTo(4.3975, 3), expect.closeTo(-0.0752, 3)]);
  });

  test('ERA5: names U/V/W and levels in hPa read the same way', () => {
    const g = lerGribs([fx('era5-pl_2026-10-15_00h.grib')]);
    expect([g.nx, g.ny, g.lon0, g.lat0]).toEqual([45, 37, -74, 3]);
    expect(g.niveis).toEqual([850, 950]);
    const a = ventoDaGrade(g)(-60, -3, 950, Date.parse('2026-10-15T00:00:00Z'))!;
    expect([a.u, a.v, a.w]).toEqual([expect.closeTo(-2.9881, 3), expect.closeTo(0.0256, 3), expect.closeTo(0.0161, 3)]);
  });
});
