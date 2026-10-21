import pg from 'pg';
import { registrar } from '../../coleta/carga/lib.ts';
import { carregarMunicipios } from '../../coleta/carga/municipios.ts';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { attributeDay, dayBounds, NOTE } from './atribuir.ts';
import { seasonRows } from './relatorio.ts';

test('a Manaus day is 04:00Z to 04:00Z', () => {
  expect(dayBounds('2026-10-21')).toEqual({ start: new Date('2026-10-21T04:00:00Z'), end: new Date('2026-10-22T04:00:00Z') });
});

comBanco('atribuição v0 no banco', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
    const a = await registrar(db, { chave: 'k', fonte: 'x', sha256: 'a'.repeat(64), baixado_em: '2026-10-21T00:00:00Z' });
    // A "municipality" 150–250 km east of Manaus, a spot inside it and one to the west.
    const geometry = { type: 'Polygon', coordinates: [[[-58.8, -3.5], [-57.8, -3.5], [-57.8, -2.7], [-58.8, -2.7], [-58.8, -3.5]]] };
    await carregarMunicipios(db, [{ arquivo: a, uf: 'AM', geojson: { features: [{ properties: { codarea: '1300000' }, geometry }] } }], new Map([[1300000, 'Leste']]));
    await db.query(`INSERT INTO firms.foco (satelite, instrumento, adquirido_em, lat, lon, geom, frp, municipio, arquivo) VALUES
      ('N20', 'VIIRS', '2026-10-21T06:00Z', -3.1, -58.3, ST_SetSRID(ST_Point(-58.3, -3.1), 4326), 50, 1300000, $1),
      ('N20', 'VIIRS', '2026-10-21T06:00Z', -3.1, -61.8, ST_SetSRID(ST_Point(-61.8, -3.1), 4326), 50, NULL, $1)`, [a]);
    // Wind from the east (90°) at 20 km/h all day, at both levels; CAMS and the sensor both say a bad day.
    await db.query(`INSERT INTO openmeteo.tempo_hora (rodada_em, valido_em, wind_speed_925hpa, wind_direction_925hpa, wind_speed_850hpa, wind_direction_850hpa, arquivo)
      SELECT '2026-10-22T00:00Z', t, 20, 90, 20, 90, $1 FROM generate_series('2026-10-21T04:00Z'::timestamptz, '2026-10-22T03:00Z', '1 hour') t`, [a]);
    await db.query(`INSERT INTO openmeteo.ar_hora (rodada_em, valido_em, pm2_5, arquivo)
      SELECT '2026-10-22T00:00Z', t, 30, $1 FROM generate_series('2026-10-21T04:00Z'::timestamptz, '2026-10-22T03:00Z', '1 hour') t`, [a]);
    await db.query(`INSERT INTO openaq.medicao (sensor, parametro, inicio, fim, valor, unidade, arquivo)
      SELECT 1, 'pm25', t, t + interval '1 hour', 40, 'µg/m³', $1 FROM generate_series('2026-10-21T04:00Z'::timestamptz, '2026-10-22T03:00Z', '1 hour') t`, [a]);
    await db.query(`INSERT INTO metar.observacao (estacao, observado_em, texto, visibilidade_m, tempo, arquivo) VALUES
      ('SBEG', '2026-10-21T12:00Z', 'SBEG 211200Z 09005KT 4000 FU NSC 31/22 Q1011', 4000, '{FU}', $1)`, [a]);
  });
  afterAll(() => db.end());

  test('only the upwind spot counts; numbers, confidence and the v0 note are stored; re-running replaces the day', async () => {
    const r = await attributeDay(db, '2026-10-21');
    expect(r.counted).toBe(1);
    expect(r.ranking[0]).toMatchObject({ municipio: 1300000, nome: 'Leste', parcela: 1 });
    await attributeDay(db, '2026-10-21');
    const row = (await db.query("SELECT * FROM analise.fumaca_dia WHERE dia = '2026-10-21'")).rows;
    expect(row).toHaveLength(1);
    expect(row[0]).toMatchObject({ pm25_medido_horas: 24, horas_fu_hz: 1, visibilidade_min_m: 4000, focos_contados: 1, confianca: 'media', nota: NOTE });
    expect(row[0].pm25_medido_media).toBeCloseTo(40);
    expect(row[0].pm25_cams_media).toBeCloseTo(30);
    expect((await db.query('SELECT count(*)::int AS n FROM analise.fumaca_foco')).rows[0].n).toBe(1);
    expect((await seasonRows(db, '2026-08-01', '2026-10-21')).map((r) => r.dia)).toEqual(['2026-10-21']);
  });
});
