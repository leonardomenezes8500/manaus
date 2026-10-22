// Wind grid in memory (#49) and its interpolation: linear in lon, lat, pressure and time.
import type { Vento } from './integrador.ts';

/** Regular grid: point (ix, iy) is at lon0 + ix·dlon, lat0 + iy·dlat; values indexed ((it·nk + ik)·ny + iy)·nx + ix. */
export type Grade = {
  lon0: number;
  lat0: number;
  dlon: number;
  dlat: number;
  nx: number;
  ny: number;
  niveis: number[]; // hPa, ascending
  tempos: number[]; // ms UTC, ascending
  u: Float32Array;
  v: Float32Array;
  w: Float32Array;
};

export function novaGrade(g: Omit<Grade, 'u' | 'v' | 'w'>): Grade {
  const n = g.nx * g.ny * g.niveis.length * g.tempos.length;
  return { ...g, u: new Float32Array(n), v: new Float32Array(n), w: new Float32Array(n) };
}

/** Index and weight of `x` between the neighbours in ascending `eixo`; null outside. */
function entre(eixo: number[], x: number): [number, number] | null {
  if (x < eixo[0] || x > eixo.at(-1)!) return null;
  let i = 0;
  while (i < eixo.length - 2 && x > eixo[i + 1]) i++;
  return eixo.length === 1 ? [0, 0] : [i, (x - eixo[i]) / (eixo[i + 1] - eixo[i])];
}

export function ventoDaGrade(g: Grade): Vento {
  const nk = g.niveis.length;
  return (lon, lat, hpa, t) => {
    const fx = (lon - g.lon0) / g.dlon;
    const fy = (lat - g.lat0) / g.dlat;
    if (!(fx >= 0 && fx <= g.nx - 1 && fy >= 0 && fy <= g.ny - 1)) return null;
    const k = entre(g.niveis, hpa);
    const tt = entre(g.tempos, t);
    if (!k || !tt) return null;
    const ix = Math.min(Math.floor(fx), g.nx - 2);
    const iy = Math.min(Math.floor(fy), g.ny - 2);
    const ax = fx - ix;
    const ay = fy - iy;
    const out = { u: 0, v: 0, w: 0 };
    // Sum over the 16 corners (2 times × 2 levels × 2 rows × 2 columns), each with its weight.
    for (let dt = 0; dt < 2; dt++)
      for (let dk = 0; dk < 2; dk++)
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const p = (dt ? tt[1] : 1 - tt[1]) * (dk ? k[1] : 1 - k[1]) * (dy ? ay : 1 - ay) * (dx ? ax : 1 - ax);
            if (!p) continue;
            const i = (((tt[0] + dt) * nk + k[0] + dk) * g.ny + iy + dy) * g.nx + ix + dx;
            out.u += p * g.u[i];
            out.v += p * g.v[i];
            out.w += p * g.w[i];
          }
    return out;
  };
}
