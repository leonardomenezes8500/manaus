// Smoke attribution v0 (#17): pure math, no database. A heuristic, not a trajectory: it assumes the wind measured
// (modelled) over Manaus blows in a straight line all the way to the fire. Trajectories come in M3.

/** Every tunable number of v0 lives here. */
export const PARAMS = {
  sectorDeg: 30, // a spot counts if its bearing from Manaus is within ±30° of where the wind comes from
  minKm: 30, // closer spots are local (urban burning), left out
  maxKm: 800,
  windowH: 12, // ± hours around the straight-line arrival time
  decayKm: 200, // weight falls as 1 / (1 + d / 200 km)
  minSpeedKmh: 5, // floor so travel time does not explode on calm hours
} as const;

const R = 6371; // km
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Initial bearing from point 1 to point 2, degrees clockwise from north (0..360). */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest angle between two directions (0..180). */
export const angleDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

export type Wind = { speedKmh: number; fromDeg: number };

/** Vector mean of winds given as (speed, direction it blows FROM). `steadiness` = 1 when all agree, 0 when they cancel. */
export function meanWind(winds: Wind[]): Wind & { steadiness: number } {
  if (!winds.length) return { speedKmh: 0, fromDeg: 0, steadiness: 0 };
  let u = 0,
    v = 0,
    s = 0;
  for (const w of winds) {
    u += w.speedKmh * Math.sin(rad(w.fromDeg));
    v += w.speedKmh * Math.cos(rad(w.fromDeg));
    s += w.speedKmh;
  }
  u /= winds.length;
  v /= winds.length;
  const speed = Math.hypot(u, v);
  return { speedKmh: speed, fromDeg: (deg(Math.atan2(u, v)) + 360) % 360, steadiness: s ? speed / (s / winds.length) : 0 };
}

export type Spot = { id: number; lat: number; lon: number; at: Date; frp: number; municipio: number | null };
export type Hour = { start: Date; wind: Wind };
export type Weighted = Spot & { distanceKm: number; bearingDeg: number; hours: number; weight: number };

/**
 * For each hour of the day, spots upwind of Manaus whose straight-line arrival matches the hour (±windowH) count.
 * Weight = FRP × 1/(1 + d/decayKm) × (hours counted / 24).
 */
export function weighSpots(origin: { lat: number; lon: number }, hours: Hour[], spots: Spot[], p = PARAMS): Weighted[] {
  const out: Weighted[] = [];
  for (const s of spots) {
    const d = distanceKm(origin.lat, origin.lon, s.lat, s.lon);
    if (d < p.minKm || d > p.maxKm) continue;
    const b = bearingDeg(origin.lat, origin.lon, s.lat, s.lon);
    let counted = 0;
    for (const h of hours) {
      if (angleDiff(b, h.wind.fromDeg) > p.sectorDeg) continue;
      const travelH = d / Math.max(h.wind.speedKmh, p.minSpeedKmh);
      const arrival = s.at.getTime() + travelH * 3600_000; // when the smoke would reach Manaus
      if (Math.abs(arrival - h.start.getTime()) <= p.windowH * 3600_000) counted++;
    }
    if (counted)
      out.push({ ...s, distanceKm: d, bearingDeg: b, hours: counted, weight: s.frp * (1 / (1 + d / p.decayKm)) * (counted / 24) });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** Sum of weight per municipality (null = outside Brazil), with share of the total, biggest first. */
export function rankMunicipios(spots: Weighted[]): { municipio: number | null; weight: number; share: number; spots: number }[] {
  const by = new Map<number | null, { weight: number; spots: number }>();
  for (const s of spots) {
    const m = by.get(s.municipio) ?? { weight: 0, spots: 0 };
    m.weight += s.weight;
    m.spots++;
    by.set(s.municipio, m);
  }
  const total = spots.reduce((t, s) => t + s.weight, 0);
  return [...by].map(([municipio, m]) => ({ municipio, ...m, share: total ? m.weight / total : 0 })).sort((a, b) => b.weight - a.weight);
}

export const WHO_DAILY_PM25 = 15; // µg/m³, WHO 2021 guideline (24-hour mean)

/** "How much to trust it": three yes/no signals; 3 = alta, 2 = media, 0–1 = baixa. */
export function confidence(s: { steadiness: number; spotsInSector: number; measuredPm25: number | null; modelPm25: number | null }) {
  const signals = {
    steadyWind: s.steadiness >= 0.7,
    spotsInSector: s.spotsInSector >= 5,
    measuredAndModelAgree:
      s.measuredPm25 !== null && s.modelPm25 !== null && s.measuredPm25 > WHO_DAILY_PM25 === s.modelPm25 > WHO_DAILY_PM25,
  };
  return nivelConfianca(signals);
}

/** 3 signals yes = alta, 2 = media, 0–1 = baixa (shared by v0 and v1). */
export function nivelConfianca<T extends Record<string, boolean>>(signals: T) {
  const yes = Object.values(signals).filter(Boolean).length;
  return { level: yes === 3 ? 'alta' : yes === 2 ? 'media' : 'baixa', signals };
}
