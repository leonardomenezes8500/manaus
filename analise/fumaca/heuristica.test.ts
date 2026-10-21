import { angleDiff, bearingDeg, confidence, distanceKm, meanWind, PARAMS, rankMunicipios, weighSpots, type Hour, type Spot } from './heuristica.ts';

const MANAUS = { lat: -3.1, lon: -60.02 };

test('distance and bearing with known pairs', () => {
  expect(distanceKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1); // 1° on the equator
  expect(distanceKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 6);
  expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 6);
  expect(bearingDeg(0, 0, -1, 0)).toBeCloseTo(180, 6);
  expect(bearingDeg(0, 0, 0, -1)).toBeCloseTo(270, 6);
  // Manaus → Porto Velho (-8.76, -63.90): ~760 km to the SSW.
  expect(distanceKm(MANAUS.lat, MANAUS.lon, -8.76, -63.9)).toBeGreaterThan(740);
  expect(distanceKm(MANAUS.lat, MANAUS.lon, -8.76, -63.9)).toBeLessThan(780);
  expect(bearingDeg(MANAUS.lat, MANAUS.lon, -8.76, -63.9)).toBeGreaterThan(200);
  expect(bearingDeg(MANAUS.lat, MANAUS.lon, -8.76, -63.9)).toBeLessThan(220);
});

test('the sector crosses north (350°–10°)', () => {
  expect(angleDiff(355, 5)).toBe(10);
  expect(angleDiff(5, 355)).toBe(10);
  expect(angleDiff(350, 20)).toBe(30);
  expect(angleDiff(0, 180)).toBe(180);
});

test('vector mean of winds: same direction keeps it; opposite ones cancel', () => {
  const a = meanWind([{ speedKmh: 20, fromDeg: 350 }, { speedKmh: 20, fromDeg: 10 }]);
  expect(angleDiff(a.fromDeg, 0)).toBeLessThan(1e-6);
  expect(a.speedKmh).toBeCloseTo(20 * Math.cos((10 * Math.PI) / 180), 6);
  expect(meanWind([{ speedKmh: 10, fromDeg: 90 }, { speedKmh: 10, fromDeg: 270 }]).steadiness).toBeCloseTo(0, 6);
});

// A day of steady wind FROM the southeast (135°) at 20 km/h.
const day = new Date('2026-10-21T04:00:00Z');
const hours: Hour[] = Array.from({ length: 24 }, (_, h) => ({ start: new Date(day.getTime() + h * 3600_000), wind: { speedKmh: 20, fromDeg: 135 } }));
/** Point at `km` from Manaus on `bearing` (small-angle approximation, good enough for tests). */
const at = (bearing: number, km: number) => ({
  lat: MANAUS.lat + (km / 111.19) * Math.cos((bearing * Math.PI) / 180),
  lon: MANAUS.lon + (km / (111.19 * Math.cos((MANAUS.lat * Math.PI) / 180))) * Math.sin((bearing * Math.PI) / 180),
});
const spot = (id: number, bearing: number, km: number, hoursBefore: number, municipio: number | null = 1): Spot =>
  ({ id, ...at(bearing, km), at: new Date(day.getTime() + 12 * 3600_000 - hoursBefore * 3600_000), frp: 10, municipio });

test('synthetic: with wind from SE, the spot to the SE counts and the one to the NW does not', () => {
  const se = spot(1, 135, 200, 10); // 200 km at 20 km/h = 10 h of travel: arrives at noon
  const nw = spot(2, 315, 200, 10);
  const r = weighSpots(MANAUS, hours, [se, nw]);
  expect(r.map((s) => s.id)).toEqual([1]);
  expect(r[0].hours).toBe(24); // arrival at noon is within ±12 h of every hour of the day
  expect(r[0].weight).toBeCloseTo(10 * (1 / (1 + 200 / PARAMS.decayKm)) * 1, 2);
});

test('time window, distance limits and sector edge', () => {
  const late = spot(3, 135, 200, -40); // detected after the day: arrival far outside the window
  const near = spot(4, 135, 20, 1); // under 30 km: local
  const far = spot(5, 135, 900, 45); // over 800 km
  const edge = spot(6, 135 + 31, 200, 10); // just outside ±30°
  expect(weighSpots(MANAUS, hours, [late, near, far, edge])).toEqual([]);
  const partial = spot(7, 135, 200, 10 + 18); // arrives 18 h before noon = 18:00 the day before: counts in the first hours only
  const r = weighSpots(MANAUS, hours, [partial]);
  expect(r[0].hours).toBeGreaterThan(0);
  expect(r[0].hours).toBeLessThan(24);
});

test('sum by municipality with share, outside Brazil as null', () => {
  const r = weighSpots(MANAUS, hours, [spot(1, 135, 200, 10, 10), spot(2, 140, 200, 10, 10), spot(3, 130, 200, 10, null)]);
  const ranking = rankMunicipios(r);
  expect(ranking.map((m) => [m.municipio, m.spots])).toEqual([[10, 2], [null, 1]]);
  expect(ranking[0].share).toBeCloseTo(2 / 3, 2);
  expect(ranking.reduce((t, m) => t + m.share, 0)).toBeCloseTo(1, 6);
});

test('confidence from three signals', () => {
  expect(confidence({ steadiness: 0.9, spotsInSector: 50, measuredPm25: 40, modelPm25: 30 }).level).toBe('alta');
  expect(confidence({ steadiness: 0.9, spotsInSector: 50, measuredPm25: 40, modelPm25: 10 }).level).toBe('media');
  expect(confidence({ steadiness: 0.2, spotsInSector: 2, measuredPm25: null, modelPm25: 30 }).level).toBe('baixa');
});
