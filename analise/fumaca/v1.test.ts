import { concordancia, confiancaV1, PARAMS_V1, PARAMS_V1_SEM_DILUICAO, passagem, pesarFocosV1, type Traj } from './v1.ts';

const H = 3_600_000;
const CHEGADA = Date.parse('2026-09-23T12:00:00Z');
const MANAUS = { lat: -3.1, lon: -60.02 };
const KM = 111.195; // km per degree of latitude

// Straight trajectory going south from Manaus, 1 point per hour, 0.2° (≈ 22 km) per hour, 72 h.
const sul = (chegada = CHEGADA, lon = MANAUS.lon): Traj => ({
  chegada,
  pontos: Array.from({ length: 73 }, (_, i) => ({ h: -i, lat: MANAUS.lat - 0.2 * i, lon, hpa: 950 })),
});
const foco = (lat: number, lon: number, horasAntes: number, frp = 10, id = 1) => ({
  id,
  lat,
  lon,
  at: new Date(CHEGADA - horasAntes * H),
  frp,
  municipio: 1300000 + id,
});

test('passagem: distance from the spot to the nearest point of the path (between hourly points too), τ and path length there', () => {
  // 30.5 h back the air is at lat -9.2; a spot 10 km east of that point.
  const p = passagem(sul(), { lat: MANAUS.lat - 0.2 * 30.5, lon: MANAUS.lon + 10 / (KM * Math.cos((9.2 * Math.PI) / 180)) });
  expect(p.distanciaKm).toBeCloseTo(10, 0);
  expect(p.tauH).toBeCloseTo(30.5, 1);
  expect(p.caminhoKm).toBeCloseTo(0.2 * 30.5 * KM, -1);
});

test('the corridor widens with the path: 25 km + 20% of the way the air had already made', () => {
  const t = [sul()];
  // 10 h back (~222 km of path): corridor 25 + 44 = 69 km. 60 km off counts, 80 km does not.
  const lat = MANAUS.lat - 0.2 * 10;
  const lonKm = (km: number) => MANAUS.lon + km / (KM * Math.cos((lat * Math.PI) / 180));
  expect(pesarFocosV1(MANAUS, t, [foco(lat, lonKm(60), 10)])).toHaveLength(1);
  expect(pesarFocosV1(MANAUS, t, [foco(lat, lonKm(80), 10)])).toHaveLength(0);
});

test('±12 h window around the time the air passed; spots closer than 30 km to Manaus are local and left out', () => {
  const t = [sul()];
  const lat = MANAUS.lat - 0.2 * 20; // the air passed there 20 h before arriving
  expect(pesarFocosV1(MANAUS, t, [foco(lat, MANAUS.lon, 20 + 11)])).toHaveLength(1);
  expect(pesarFocosV1(MANAUS, t, [foco(lat, MANAUS.lon, 20 - 13)])).toHaveLength(0);
  expect(pesarFocosV1(MANAUS, t, [foco(MANAUS.lat - 0.2, MANAUS.lon, 1)])).toHaveLength(0); // 22 km away
});

test('synthetic day: under the path counts, 300 km away does not, 2 of 3 trajectories give 2/3 of the weight', () => {
  const lat = MANAUS.lat - 0.2 * 24;
  const longe = MANAUS.lon + 300 / (KM * Math.cos((lat * Math.PI) / 180));
  // Third trajectory goes north: the spot to the south only counts in 2 of 3.
  const norte: Traj = { chegada: CHEGADA, pontos: sul().pontos.map((p) => ({ ...p, lat: 2 * MANAUS.lat - p.lat })) };
  const r = pesarFocosV1(
    MANAUS,
    [sul(), sul(), norte],
    [foco(lat, MANAUS.lon, 24, 30, 1), foco(lat, longe, 24, 30, 2)],
    PARAMS_V1_SEM_DILUICAO,
  );
  expect(r.map((s) => s.id)).toEqual([1]);
  expect(r[0].hours).toBe(2); // in how many trajectories it counted
  expect(r[0].weight).toBeCloseTo((30 / (1 + 24 / 24)) * (2 / 3), 3);
  expect(r[0].bearingDeg).toBeCloseTo(180, 0);
});

test('agreement: the −24 h positions close together agree; spread apart they do not', () => {
  expect(concordancia([sul(), sul(CHEGADA, -59.5), sul(CHEGADA, -60.5)]).concordam).toBe(true);
  const norte: Traj = { chegada: CHEGADA, pontos: sul().pontos.map((p) => ({ ...p, lat: 2 * MANAUS.lat - p.lat })) };
  const c = concordancia([sul(), norte]);
  expect(c.concordam).toBe(false);
  expect(c.km_medio).toBeCloseTo(0.2 * 24 * KM, -1);
});

test('confiancaV1: "trajectories agree" takes the place of "steady wind"', () => {
  const c = confiancaV1({ trajetoriasConcordam: true, spotsInSector: 9, measuredPm25: 40, modelPm25: 30 });
  expect(c).toEqual({ level: 'alta', signals: { trajetoriasConcordam: true, spotsInSector: true, measuredAndModelAgree: true } });
  expect(confiancaV1({ trajetoriasConcordam: false, spotsInSector: 1, measuredPm25: null, modelPm25: 30 }).level).toBe('baixa');
});

test('v1 dilutes by default (#101): the weight is divided by how much the corridor widened (25 km → 25 + 20% of the path); diluicao 0 is v1 before #101', () => {
  const t = [sul()];
  const s = [foco(MANAUS.lat - 0.2 * 10, MANAUS.lon, 10, 10, 1), foco(MANAUS.lat - 0.2 * 40, MANAUS.lon, 40, 10, 2)];
  const v1 = pesarFocosV1(MANAUS, t, s, PARAMS_V1_SEM_DILUICAO);
  const d = pesarFocosV1(MANAUS, t, s);
  expect(d).toEqual(pesarFocosV1(MANAUS, t, s, { ...PARAMS_V1, diluicao: 1 }));
  const largura = (h: number) => (25 + 0.2 * 0.2 * h * KM) / 25;
  for (const x of d) {
    const base = v1.find((y) => y.id === x.id)!;
    expect(x.weight).toBeCloseTo(base.weight / largura(x.id === 1 ? 10 : 40), 1);
  }
  // Same FRP: the far one (40 h, ~890 km of path) now weighs much less than the near one.
  expect(d.find((x) => x.id === 2)!.weight / d.find((x) => x.id === 1)!.weight).toBeLessThan(
    v1.find((x) => x.id === 2)!.weight / v1.find((x) => x.id === 1)!.weight / 2,
  );
});

test('narrower corridor (10% of the path): the spot 60 km to the side at 222 km of path no longer counts', () => {
  const lat = MANAUS.lat - 0.2 * 10;
  const s = [foco(lat, MANAUS.lon + 60 / (KM * Math.cos((lat * Math.PI) / 180)), 10)];
  expect(pesarFocosV1(MANAUS, [sul()], s)).toHaveLength(1);
  expect(pesarFocosV1(MANAUS, [sul()], s, { ...PARAMS_V1, corredorFracao: 0.1 })).toHaveLength(0);
});
