import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from './lib.ts';
import { loadMaiac, mediaDoDia, parseMaiac, qaMelhor } from './maiac.ts';

// Lines as analise/maiac/extrair.py writes them (real values from MCD19A2.A2024254.h12v09, 2024-09-10).
const csv = `ponto,orbita,hora,satelite,linha,coluna,aod,qa
manaus,0,20242541215,T,370,7,-28672,0
manaus,3,20242541840,A,371,8,343,1057
manaus,3,20242541840,A,372,9,294,1
atto,1,20242541355,T,260,121,230,1
atto,1,20242541355,T,260,122,224,1
atto,3,20242541840,A,260,121,250,1
atto,0,20242540350,T,260,121,900,1`;

test('QA bits of MCD19A2: clear sky (bits 0–2 = 001), no cloud next to it (bits 5–7 = 000) and best AOD quality (bits 8–11 = 0000)', () => {
  expect(qaMelhor(1)).toBe(true);
  expect(qaMelhor(1057)).toBe(false); // adjacent to clouds, more than one cloudy neighbour
  expect(qaMelhor(3)).toBe(false); // cloudy
  expect(qaMelhor(1 | (1 << 3))).toBe(true); // water: still the best AOD quality
});

test('parse: scale 0.001, fill value left out, the UTC time of the pass (YYYYDDDHHMM) and the satellite', () => {
  const r = parseMaiac(csv);
  expect(r).toHaveLength(6);
  expect(r[1]).toEqual({ ponto: 'manaus', em: Date.parse('2024-09-10T18:40:00Z'), satelite: 'Aqua', aod: 0.294, qa: 1 });
});

test('daily mean of the good pixels per point, Manaus day and satellite; a pass at 03:50 UTC is the day before in Manaus', () => {
  expect(mediaDoDia(parseMaiac(csv))).toEqual([
    { ponto: 'atto', dia: '2024-09-09', satelite: 'Terra', aod_550: 0.9, pixels: 1 },
    { ponto: 'atto', dia: '2024-09-10', satelite: 'Aqua', aod_550: 0.25, pixels: 1 },
    { ponto: 'atto', dia: '2024-09-10', satelite: 'Terra', aod_550: 0.227, pixels: 2 },
    { ponto: 'manaus', dia: '2024-09-10', satelite: 'Aqua', aod_550: 0.294, pixels: 1 },
  ]);
});

comBanco('carga MAIAC', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('idempotent load', async () => {
    const a = await registrar(db, {
      chave: 'bruto/nasa-maiac/a',
      fonte: 'nasa-maiac',
      sha256: 'a'.repeat(64),
      baixado_em: '2026-10-22T00:00:00Z',
    });
    await loadMaiac(db, a, mediaDoDia(parseMaiac(csv)));
    await loadMaiac(db, a, mediaDoDia(parseMaiac(csv)));
    expect((await db.query('SELECT count(*)::int AS n, sum(pixels)::int AS p FROM maiac.aod')).rows[0]).toEqual({ n: 4, p: 5 });
  });
});
