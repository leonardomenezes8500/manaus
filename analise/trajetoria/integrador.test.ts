import { distanceKm } from '../fumaca/heuristica.ts';
import { integrar, type Vento } from './integrador.ts';

const distanciaKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => distanceKm(a.lat, a.lon, b.lat, b.lon);

const H = 3_600_000;
const T0 = Date.parse('2026-09-23T12:00:00Z');
const inicio = { lon: -60, lat: -3, hpa: 950, t: T0 };

test('uniform wind: 10 m/s from the west for 72 h back puts the air 2592 km west, error < 1 km', () => {
  const vento: Vento = () => ({ u: 10, v: 0, w: 0 });
  const r = integrar(vento, inicio, { horas: 72 });
  expect(r.parou_h).toBeNull();
  expect(r.pontos).toHaveLength(73); // the start plus one point per hour
  const fim = r.pontos[72];
  expect(fim.h).toBe(-72);
  const esperadoLon = -60 - (10 * 72 * 3600) / (6_371_000 * Math.cos((3 * Math.PI) / 180)) / (Math.PI / 180);
  expect(distanciaKm(fim, { lon: esperadoLon, lat: -3 })).toBeLessThan(1);
  expect(distanciaKm(fim, inicio)).toBeCloseTo(2592, -1);
});

test('solid-body rotation: after one full turn the air is back where it started', () => {
  // Turning around (-60, 0) once every 24 h, ~1° radius, in local metres.
  const om = (2 * Math.PI) / (24 * 3600);
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const vento: Vento = (lon, lat) => ({ u: -om * lat * rad * R, v: om * (lon + 60) * rad * R * Math.cos(lat * rad), w: 0 });
  const r = integrar(vento, { lon: -59, lat: 0, hpa: 950, t: T0 }, { horas: 24 });
  expect(distanciaKm(r.pontos[24], { lon: -59, lat: 0 })).toBeLessThan(2);
  expect(distanciaKm(r.pontos[12], { lon: -61, lat: 0 })).toBeLessThan(2); // half a turn: the other side
});

test('constant ω: rising air seen backwards comes from higher pressure and stays at 1000 hPa; above 700 hPa it stops', () => {
  const sobe: Vento = () => ({ u: 0, v: 0, w: -0.05 }); // Pa/s; rising = negative ω
  const r = integrar(sobe, inicio, { horas: 72 });
  expect(r.pontos[10].hpa).toBeCloseTo(950 + (0.05 * 36_000) / 100, 3); // 968 hPa
  expect(r.pontos[72].hpa).toBe(1000);
  expect(r.parou_h).toBeNull();

  const desce: Vento = () => ({ u: 0, v: 0, w: 0.1 }); // 3.6 hPa/h: back from 950, it passes 700 after ~69.4 h
  const d = integrar(desce, inicio, { horas: 72 });
  expect(d.parou_h).toBe(-69);
  expect(d.pontos.at(-1)!.h).toBe(-69);
});

test('leaving the wind box stops the trajectory and keeps the hour', () => {
  const vento: Vento = (lon) => (lon < -62 ? null : { u: 20, v: 0, w: 0 }); // 2° west at 20 m/s ≈ 3.1 h
  const r = integrar(vento, inicio, { horas: 72 });
  expect(r.parou_h).toBe(-3);
  expect(r.pontos).toHaveLength(4);
});

test('backwards then forwards comes back to the start (non-uniform, time-varying wind), error < 1 km', () => {
  const vento: Vento = (lon, lat, _hpa, t) => ({
    u: 6 + 3 * Math.sin(lat * 2) + 2 * Math.cos((t - T0) / (10 * H)),
    v: -2 + 2 * Math.cos(lon * 1.5),
    w: 0.02 * Math.sin(lon),
  });
  const ida = integrar(vento, inicio, { horas: 48 });
  const fim = ida.pontos[48];
  const volta = integrar(vento, { lon: fim.lon, lat: fim.lat, hpa: fim.hpa, t: T0 - 48 * H }, { horas: 48, sentido: 1 });
  expect(distanciaKm(volta.pontos[48], inicio)).toBeLessThan(1);
  expect(Math.abs(volta.pontos[48].hpa - 950)).toBeLessThan(0.5);
});
