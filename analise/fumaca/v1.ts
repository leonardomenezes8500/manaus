// Smoke attribution v1 (#50): pure math, no database. Spots near the back-trajectories of the day (#49), at the time
// the air passed by them. The trajectories come from a wind model (ERA5 or GFS): modeled, not measured.
import type { Ponto } from '../trajetoria/integrador.ts';
import { bearingDeg, distanceKm, nivelConfianca, WHO_DAILY_PM25, type Spot, type Weighted } from './heuristica.ts';

/** Every tunable number of v1 lives here. */
export const PARAMS_V1 = {
  minKm: 30, // closer spots are local (urban burning), left out
  corredorKm: 25, // a spot counts if it is within 25 km + 20% of the way the air had made (trajectory error grows with distance)
  corredorFracao: 0.2,
  janelaH: 12, // ± hours around the time the air passed by the spot
  decaimentoH: 24, // weight falls as 1 / (1 + τ / 24 h)
  concordamKm: 250, // the −24 h positions agree when their mean distance to the centre is below this
  diluicao: 1, // weight × (corridor at the start ÷ corridor there)^diluicao: far spots are spread over a wider band (#99, default since #101)
} as const;
export type ParamsV1 = { [K in keyof typeof PARAMS_V1]: number };
/** v1 before #101 (no dilution with distance): kept to compare and to redo old numbers. */
export const PARAMS_V1_SEM_DILUICAO: ParamsV1 = { ...PARAMS_V1, diluicao: 0 };

export type Traj = { chegada: number; pontos: Ponto[] };
const H = 3_600_000;
const KM_GRAU = 111.195;

/** Nearest point of the path to `s` (projected on each segment between hourly points): distance, τ (hours before arriving) and path made until there. */
export function passagem(t: Traj, s: { lat: number; lon: number }) {
  const cos = Math.cos((s.lat * Math.PI) / 180);
  const xy = (p: Ponto) => [(p.lon - s.lon) * cos * KM_GRAU, (p.lat - s.lat) * KM_GRAU];
  const pts = t.pontos;
  let melhor = { distanciaKm: Math.hypot(...xy(pts[0])), tauH: -pts[0].h, caminhoKm: 0 };
  let caminho = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = xy(pts[i]);
    const [bx, by] = xy(pts[i + 1]);
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const seg = Math.sqrt(l2); // flat around the spot: hourly segments are short
    const u = l2 ? Math.min(1, Math.max(0, -(ax * (bx - ax) + ay * (by - ay)) / l2)) : 0;
    const d = Math.hypot(ax + u * (bx - ax), ay + u * (by - ay));
    if (d < melhor.distanciaKm)
      melhor = { distanciaKm: d, tauH: -(pts[i].h + u * (pts[i + 1].h - pts[i].h)), caminhoKm: caminho + u * seg };
    caminho += seg;
  }
  return melhor;
}

/**
 * For each trajectory, a spot counts if it is inside the corridor and was seen ±janelaH around the time the air passed.
 * Weight = Σ over the trajectories where it counted of FRP / (1 + τ/24 h), divided by the number of trajectories
 * (and, with `diluicao`, by how much the corridor widened there: the smoke is spread over a wider band).
 * `hours` = in how many trajectories it counted (same field the v0 uses for hours).
 */
export function pesarFocosV1(origem: { lat: number; lon: number }, trajs: Traj[], spots: Spot[], p: ParamsV1 = PARAMS_V1): Weighted[] {
  const out: Weighted[] = [];
  for (const s of spots) {
    const d = distanceKm(origem.lat, origem.lon, s.lat, s.lon);
    if (d < p.minKm) continue;
    let soma = 0;
    let n = 0;
    for (const t of trajs) {
      const ps = passagem(t, s);
      const largura = p.corredorKm + p.corredorFracao * ps.caminhoKm;
      if (ps.distanciaKm > largura) continue;
      if (Math.abs(s.at.getTime() - (t.chegada - ps.tauH * H)) > p.janelaH * H) continue;
      soma += (s.frp / (1 + ps.tauH / p.decaimentoH)) * (p.corredorKm / largura) ** p.diluicao;
      n++;
    }
    if (n)
      out.push({
        ...s,
        distanceKm: d,
        bearingDeg: bearingDeg(origem.lat, origem.lon, s.lat, s.lon),
        hours: n,
        weight: soma / trajs.length,
      });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** Do the trajectories agree? Mean distance of their −24 h positions to the centre of them. */
export function concordancia(trajs: Traj[], p: ParamsV1 = PARAMS_V1) {
  const em24 = trajs.map((t) => t.pontos.find((x) => x.h === -24)).filter((x): x is Ponto => !!x);
  if (em24.length < Math.max(2, trajs.length / 2)) return { km_medio: null, concordam: false };
  const lat = em24.reduce((a, x) => a + x.lat, 0) / em24.length;
  const lon = em24.reduce((a, x) => a + x.lon, 0) / em24.length;
  const km = em24.reduce((a, x) => a + distanceKm(lat, lon, x.lat, x.lon), 0) / em24.length;
  return { km_medio: km, concordam: km <= p.concordamKm };
}

/** Same three signals as v0, with "trajectories agree" in place of "steady wind". */
export function confiancaV1(s: {
  trajetoriasConcordam: boolean;
  spotsInSector: number;
  measuredPm25: number | null;
  modelPm25: number | null;
}) {
  return nivelConfianca({
    trajetoriasConcordam: s.trajetoriasConcordam,
    spotsInSector: s.spotsInSector >= 5,
    measuredAndModelAgree:
      s.measuredPm25 !== null && s.modelPm25 !== null && s.measuredPm25 > WHO_DAILY_PM25 === s.modelPm25 > WHO_DAILY_PM25,
  });
}
