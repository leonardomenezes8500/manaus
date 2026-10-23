import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { copernicusTiles, haPorPixel, histograma, r2Raster, valoresNosPontos, valorNoPonto } from './raster.ts';

// 4×4 pixels of 0.025° from (-60.1, -3.1) to (-60.0, -3.0): urban (24) top left, river (33) bottom left, forest (3) right, one nodata (0).
const fixture = join(import.meta.dirname, '__fixtures__', 'classes.tif');
let temGdal = true;
try {
  execFileSync('gdallocationinfo', ['--version'], { stdio: 'ignore' });
} catch {
  temGdal = false; // the CI runner has no GDAL; the image and this PC do
}

(temGdal ? describe : describe.skip)('valor no ponto (gdallocationinfo)', () => {
  test('class at known points; nodata and outside the raster are null', () => {
    expect(valorNoPonto(fixture, -60.09, -3.01, 0)).toBe(24);
    expect(valorNoPonto(fixture, -60.01, -3.01, 0)).toBe(3);
    expect(valorNoPonto(fixture, -60.09, -3.09, 0)).toBe(33);
    expect(valorNoPonto(fixture, -60.04, -3.06, 0)).toBeNull();
    expect(valorNoPonto(fixture, -59, -3, 0)).toBeNull();
  });

  test('many points in one run, in order; off the raster and nodata are null', () => {
    const p = [
      { lon: -60.09, lat: -3.01 },
      { lon: -59, lat: -3 },
      { lon: -60.04, lat: -3.06 },
      { lon: -60.09, lat: -3.09 },
    ];
    expect(valoresNosPontos(fixture, p, 0)).toEqual([24, null, null, 33]);
    expect(valoresNosPontos(fixture, [], 0)).toEqual([]);
    expect(() => valoresNosPontos('/nao/existe.tif', [{ lon: -60, lat: -3 }], 0)).toThrow('gdallocationinfo falhou');
  });
});

test('R2 path for GDAL', () => {
  process.env.R2_BUCKET = 'balde';
  expect(r2Raster('normalizado/mapbiomas/col11/cobertura_2025.tif')).toBe('/vsis3/balde/normalizado/mapbiomas/col11/cobertura_2025.tif');
});

test('histogram of a Byte raster from gdalinfo -hist: count per value', () => {
  const texto = `Band 1 Block=4x4 Type=Byte, ColorInterp=Gray
    256 buckets from -0.5 to 255.5:
  0 0 0 7 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 4 0 0 0 0 0 0 0 0 4 ${'0 '.repeat(222).trim()}
  NoData Value=0`;
  const h = histograma(texto);
  expect([h.length, h[3], h[24], h[33]]).toEqual([256, 7, 4, 4]);
  expect(() => histograma('sem histograma')).toThrow();
});

test('hectares per pixel of a geographic grid at a latitude', () => {
  // MapBiomas pixel (0.000269494585°) near Manaus: about 30 m × 30 m.
  expect(haPorPixel(0.000269494585, -3.1)).toBeCloseTo(0.0896, 3);
  expect(haPorPixel(0.000269494585, -60)).toBeCloseTo(0.0896 / 2, 2);
});

test('Copernicus GLO-30 tiles that cover a box (each named by its south-west corner)', () => {
  expect(copernicusTiles({ oeste: -60.5, sul: -3.5, leste: -59.5, norte: -2.5 })).toEqual([
    'Copernicus_DSM_COG_10_S03_00_W061_00_DEM',
    'Copernicus_DSM_COG_10_S03_00_W060_00_DEM',
    'Copernicus_DSM_COG_10_S04_00_W061_00_DEM',
    'Copernicus_DSM_COG_10_S04_00_W060_00_DEM',
  ]);
  // Crossing the equator: the band 0..1 is N00.
  expect(copernicusTiles({ oeste: -58, sul: -0.5, leste: -57.5, norte: 0.1 })).toEqual([
    'Copernicus_DSM_COG_10_N00_00_W058_00_DEM',
    'Copernicus_DSM_COG_10_S01_00_W058_00_DEM',
  ]);
});
