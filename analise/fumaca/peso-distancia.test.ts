import { resumoPeso, rhoContraBase, VARIANTES } from './peso-distancia.ts';
import { PARAMS_V1 } from './v1.ts';

const w = (lon: number, weight: number) => ({
  id: 1,
  lat: -5,
  lon,
  at: new Date(0),
  frp: 1,
  municipio: null,
  distanceKm: 0,
  bearingDeg: 0,
  hours: 1,
  weight,
});

test('the base is v1 untouched; total weight and the part east of −52', () => {
  expect(VARIANTES.v1).toBe(PARAMS_V1);
  expect(resumoPeso([w(-60, 2), w(-48, 3), w(-52.5, 1)])).toEqual({ total: 6, leste: 3 });
});

test('bootstrap of ρ − ρ base: same series gives 0; a series that follows the PM2.5 beats a shuffled one', () => {
  const pm = Array.from({ length: 40 }, (_, i) => i);
  const ruido = pm.map((i) => (i * 17) % 40);
  expect(rhoContraBase(ruido, ruido, pm).ic95).toEqual([0, 0]);
  const r = rhoContraBase(ruido, pm, pm);
  expect(r.rho).toBeCloseTo(1);
  expect(r.ic95[0]).toBeGreaterThan(0);
});
