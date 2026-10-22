import { novaGrade, ventoDaGrade } from './grade.ts';

const H = 3_600_000;
const T0 = Date.parse('2026-09-23T00:00:00Z');

// 3 × 3 points (lon -61..-59, lat -2..-4), 2 levels, 2 times. u grows with lon, v with level, w with time.
function exemplo() {
  const g = novaGrade({ lon0: -61, lat0: -2, dlon: 1, dlat: -1, nx: 3, ny: 3, niveis: [850, 950], tempos: [T0, T0 + 3 * H] });
  for (let it = 0; it < 2; it++)
    for (let ik = 0; ik < 2; ik++)
      for (let iy = 0; iy < 3; iy++)
        for (let ix = 0; ix < 3; ix++) {
          const i = ((it * 2 + ik) * 3 + iy) * 3 + ix;
          g.u[i] = 10 + ix; // -61 → 10, -60 → 11, -59 → 12
          g.v[i] = ik === 0 ? 2 : 4; // 850 → 2, 950 → 4
          g.w[i] = it === 0 ? 0 : 0.3; // T0 → 0, T0+3h → 0.3
        }
  return g;
}

test('linear in lon/lat, in pressure and in time', () => {
  const vento = ventoDaGrade(exemplo());
  expect(vento(-60.5, -3, 850, T0)).toEqual({ u: 10.5, v: 2, w: 0 });
  expect(vento(-60, -2.5, 900, T0)!.v).toBeCloseTo(3);
  expect(vento(-60, -3, 950, T0 + 1 * H)!.w).toBeCloseTo(0.1);
  expect(vento(-59, -4, 950, T0 + 3 * H)).toEqual({ u: 12, v: 4, w: expect.closeTo(0.3) });
});

test('outside the box, the levels or the hours: no wind', () => {
  const vento = ventoDaGrade(exemplo());
  expect(vento(-61.1, -3, 900, T0)).toBeNull();
  expect(vento(-60, -1.9, 900, T0)).toBeNull();
  expect(vento(-60, -3, 960, T0)).toBeNull();
  expect(vento(-60, -3, 900, T0 - 1)).toBeNull();
  expect(vento(-60, -3, 900, T0 + 3 * H + 1)).toBeNull();
});
