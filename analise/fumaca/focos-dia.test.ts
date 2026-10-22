import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { agregarFocos, donosDosDias, gravarFocosDia, linhaSp } from './focos-dia.ts';

const CORTE = Date.parse('2026-07-01T00:00:00Z'); // first instant of the NRT (the SP ends on 2026-06-30)

test('SP CSV line → detection with the UTC time from acq_date + acq_time', () => {
  const cab =
    'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type'.split(
      ',',
    );
  expect(linhaSp(cab, '-8.1,-63.2,330.1,0.4,0.4,2024-09-10,0359,N,VIIRS,n,2,290.2,12.5,N,0'.split(','))).toEqual({
    lat: -8.1,
    lon: -63.2,
    em: Date.parse('2024-09-10T03:59:00Z'),
    frp: 12.5,
  });
});

test('Manaus day (03:59 UTC is still the day before), the 800 km ring inside the region, and the SP/NRT seam counted once', () => {
  const perto = { lat: -4, lon: -61, frp: 2 }; // ~150 km from Manaus
  const longe = { lat: -12, lon: -70, frp: 5 }; // ~1450 km: region only
  const sp = [
    { ...perto, em: Date.parse('2024-09-10T03:59:00Z') },
    { ...perto, em: Date.parse('2024-09-10T04:00:00Z') },
    { ...longe, em: Date.parse('2024-09-10T17:00:00Z') },
    { ...perto, em: Date.parse('2026-06-30T17:00:00Z') },
  ];
  // The NRT repeats the last SP day (same detections, provisional): only what is after the cut counts.
  const nrt = [
    { ...perto, em: Date.parse('2026-06-30T17:00:00Z') },
    { ...perto, em: Date.parse('2026-07-01T02:00:00Z') }, // still Manaus day 06-30
    { ...perto, em: Date.parse('2026-07-01T17:00:00Z') },
  ];
  const r = agregarFocos('VIIRS_SNPP', sp, nrt, CORTE);
  const k = (dia: string, anel: string) => r.find((x) => x.dia === dia && x.anel === anel);
  expect(k('2024-09-09', '800km')).toMatchObject({ focos: 1, frp: 2, origem: 'SP' });
  expect(k('2024-09-10', '800km')).toMatchObject({ focos: 1, origem: 'SP' });
  expect(k('2024-09-10', 'regiao')).toMatchObject({ focos: 2, frp: 7 });
  expect(k('2026-06-30', 'regiao')).toMatchObject({ focos: 2, origem: 'SP+NRT' });
  expect(k('2026-07-01', 'regiao')).toMatchObject({ focos: 1, origem: 'NRT' });
});

test('overlapping SP windows (two runs with other start dates): each UTC day is read from one file only', () => {
  const k = (n: string) => `bruto/nasa-firms/2026/10/22/140000Z_VIIRS_SNPP_SP_${n}.csv.gz`;
  const dono = donosDosDias([k('2024-01-02_5d'), k('2024-01-01_5d')]);
  expect(dono.get('2024-01-01')).toBe(k('2024-01-01_5d'));
  expect(dono.get('2024-01-05')).toBe(k('2024-01-01_5d'));
  expect(dono.get('2024-01-06')).toBe(k('2024-01-02_5d'));
  expect(dono.get('2024-01-07')).toBeUndefined();
});

comBanco('focos por dia no banco', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('a synthetic month is written, then written again with new numbers: one row per day, sensor and ring', async () => {
    const mes = Array.from({ length: 30 }, (_, i) => ({
      lat: -4,
      lon: -61,
      frp: 1,
      em: Date.parse('2024-09-01T17:00:00Z') + i * 86_400_000,
    }));
    await gravarFocosDia(db, agregarFocos('VIIRS_SNPP', mes, [], CORTE));
    const outro = mes.map((d) => ({ ...d, lat: -4.5 })); // a second spot each day
    await gravarFocosDia(db, agregarFocos('VIIRS_SNPP', [...mes, ...outro], [], CORTE));
    const r = await db.query(
      `SELECT anel, count(*)::int AS dias, sum(focos)::int AS focos FROM analise.focos_dia GROUP BY anel ORDER BY anel`,
    );
    expect(r.rows).toEqual([
      { anel: '800km', dias: 30, focos: 60 },
      { anel: 'regiao', dias: 30, focos: 60 },
    ]);
  });
});
