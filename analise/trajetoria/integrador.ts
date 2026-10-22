// Back-trajectory integrator (#49): pure functions, no database or GDAL. Follows a parcel of air through a wind field
// with 15-min predictor-corrector steps (the HYSPLIT scheme): lon/lat by u and v, pressure by ω.

/** Wind at a place and time: u, v in m/s (east, north), w = ω in Pa/s (positive = sinking). null = outside the data. */
export type Vento = (lon: number, lat: number, hpa: number, t: number) => { u: number; v: number; w: number } | null;
export type Ponto = { h: number; lon: number; lat: number; hpa: number };
export type Trajetoria = { pontos: Ponto[]; parou_h: number | null };

const R = 6_371_000;
const GRAU = Math.PI / 180;
const PASSO_S = 15 * 60;
export const TOPO_HPA = 700; // above the highest level we download, the trajectory stops
export const BASE_HPA = 1000; // below it the parcel stays at 1000 hPa

const mover = (p: { lon: number; lat: number; hpa: number }, w: { u: number; v: number; w: number }, dt: number) => ({
  lon: p.lon + (w.u * dt) / (R * Math.cos(p.lat * GRAU)) / GRAU,
  lat: p.lat + (w.v * dt) / R / GRAU,
  hpa: Math.min(BASE_HPA, p.hpa + (w.w * dt) / 100),
});

/**
 * From `inicio` (t in ms UTC), `horas` back in time (sentido -1, the default) or forward (+1). One point per hour,
 * the start included. Stops when the wind is missing (out of the box or of the hours) or the air goes above 700 hPa;
 * parou_h is then the last whole hour reached.
 */
export function integrar(
  vento: Vento,
  inicio: { lon: number; lat: number; hpa: number; t: number },
  { horas, sentido = -1 }: { horas: number; sentido?: -1 | 1 },
): Trajetoria {
  const dt = sentido * PASSO_S;
  const porHora = 3600 / PASSO_S;
  let p = { lon: inicio.lon, lat: inicio.lat, hpa: Math.min(BASE_HPA, inicio.hpa) };
  const pontos: Ponto[] = [{ h: 0, ...p }];
  for (let passo = 1; passo <= horas * porHora; passo++) {
    const t = inicio.t + (passo - 1) * dt * 1000;
    const v0 = vento(p.lon, p.lat, p.hpa, t);
    const p1 = v0 && mover(p, v0, dt);
    const v1 = p1 && vento(p1.lon, p1.lat, p1.hpa, t + dt * 1000);
    if (!v0 || !v1) return { pontos, parou_h: pontos.at(-1)!.h };
    p = mover(p, { u: (v0.u + v1.u) / 2, v: (v0.v + v1.v) / 2, w: (v0.w + v1.w) / 2 }, dt);
    if (p.hpa < TOPO_HPA) return { pontos, parou_h: pontos.at(-1)!.h };
    if (passo % porHora === 0) pontos.push({ h: (sentido * passo) / porHora, ...p });
  }
  return { pontos, parou_h: null };
}
