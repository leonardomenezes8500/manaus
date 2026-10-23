import { encaixar, lerZonas, pesoPorLinha, vrtPeso } from './area-queimada.ts';

const g = { oeste: -61, norte: -2, pixel: 0.5 };

test('the box snaps outwards to the product grid', () => {
  expect(encaixar(g, { oeste: -60.7, sul: -3.2, leste: -59.6, norte: -2.4 })).toEqual({
    oeste: -61,
    norte: -2,
    leste: -59.5,
    sul: -3.5,
    largura: 3,
    altura: 3,
  });
});

test('one weight per row: hectares per pixel by the latitude of the row center, stretched to the box by the VRT', () => {
  const e = encaixar(g, { oeste: -61, sul: -3, leste: -60, norte: -2 });
  const asc = pesoPorLinha(e, 0.5).trim().split('\n');
  expect(asc.slice(0, 5)).toEqual(['ncols 1', 'nrows 2', 'xllcorner -61', 'yllcorner -3', 'cellsize 0.5']);
  const [a, b] = asc.slice(5).map(Number);
  expect(a).toBeCloseTo(((0.5 * 111_195) ** 2 * Math.cos((2.25 * Math.PI) / 180)) / 10_000, -2); // ~309 thousand ha
  expect(b).toBeLessThan(a); // further from the equator
  expect(vrtPeso('/x/peso.asc', e, 0.5)).toContain('<DstRect xOff="0" yOff="0" xSize="2" ySize="2"/>');
});

test('zones → hectares per month, cover and cut: the box always, the ring and the state when their digits are set', () => {
  // value,sum as `gdal raster zonal-stats` writes it. 0 = not burned.
  const csv = ['value,sum', '0,999', '8,10', '20,5', '108,1', '10208,2', '10120,4'].join('\n');
  const l = lerZonas(csv, 'mapbiomas-fogo', 2024);
  const ha = (recorte: string, mes: number, cobertura: string) =>
    l.find((x) => x.recorte === recorte && x.mes === mes && x.cobertura === cobertura)?.hectares;
  expect(ha('regiao', 8, 'nao_floresta')).toBe(13); // 8 + 108 (AM) + 10208 (ring, RO)
  expect(ha('regiao', 8, 'floresta')).toBe(9); // 20 + 10120 (ring, AM)
  expect(ha('800km', 8, 'nao_floresta')).toBe(2);
  expect(ha('800km', 8, 'floresta')).toBe(4);
  expect(ha('AM', 8, 'nao_floresta')).toBe(1);
  expect(ha('AM', 8, 'floresta')).toBe(4);
  expect(ha('RO', 8, 'nao_floresta')).toBe(2); // UFS[1]
  expect(l.every((x) => x.ano === 2024 && x.produto === 'mapbiomas-fogo')).toBe(true);
  expect(lerZonas('value,sum\n10101,7\n', 'inpe-aq1km', 2025, 9)).toEqual([
    { ano: 2025, mes: 9, produto: 'inpe-aq1km', recorte: 'regiao', cobertura: 'total', hectares: 7 },
    { ano: 2025, mes: 9, produto: 'inpe-aq1km', recorte: '800km', cobertura: 'total', hectares: 7 },
    { ano: 2025, mes: 9, produto: 'inpe-aq1km', recorte: 'AM', cobertura: 'total', hectares: 7 },
  ]);
});
