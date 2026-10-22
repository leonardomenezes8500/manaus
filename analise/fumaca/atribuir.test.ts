import pg from 'pg';
import { registrar } from '../../coleta/carga/lib.ts';
import { carregarMunicipios } from '../../coleta/carga/municipios.ts';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { chegadas, gravarDia } from '../trajetoria/trajetorias.ts';
import { apagarV1Parcial, attributeDay, dayBounds, NOTE, NOTE_V1 } from './atribuir.ts';
import { diasSemEra5, seasonRows } from './relatorio.ts';

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
    const geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-58.8, -3.5],
          [-57.8, -3.5],
          [-57.8, -2.7],
          [-58.8, -2.7],
          [-58.8, -3.5],
        ],
      ],
    };
    await carregarMunicipios(
      db,
      [{ arquivo: a, uf: 'AM', geojson: { features: [{ properties: { codarea: '1300000' }, geometry }] } }],
      new Map([[1300000, 'Leste']]),
    );
    await db.query(
      `INSERT INTO firms.foco (satelite, instrumento, adquirido_em, lat, lon, geom, frp, municipio, arquivo) VALUES
      ('N20', 'VIIRS', '2026-10-21T06:00Z', -3.1, -58.3, ST_SetSRID(ST_Point(-58.3, -3.1), 4326), 50, 1300000, $1),
      ('N20', 'VIIRS', '2026-10-21T06:00Z', -3.1, -61.8, ST_SetSRID(ST_Point(-61.8, -3.1), 4326), 50, NULL, $1)`,
      [a],
    );
    // Wind from the east (90°) at 20 km/h all day, at both levels; CAMS and the sensor both say a bad day.
    await db.query(
      `INSERT INTO openmeteo.tempo_hora (rodada_em, valido_em, wind_speed_925hpa, wind_direction_925hpa, wind_speed_850hpa, wind_direction_850hpa, arquivo)
      SELECT '2026-10-22T00:00Z', t, 20, 90, 20, 90, $1 FROM generate_series('2026-10-21T04:00Z'::timestamptz, '2026-10-22T03:00Z', '1 hour') t`,
      [a],
    );
    await db.query(
      `INSERT INTO openmeteo.ar_hora (rodada_em, valido_em, pm2_5, arquivo)
      SELECT '2026-10-22T00:00Z', t, 30, $1 FROM generate_series('2026-10-21T04:00Z'::timestamptz, '2026-10-22T03:00Z', '1 hour') t`,
      [a],
    );
    await db.query(
      `INSERT INTO openaq.medicao (sensor, parametro, inicio, fim, valor, unidade, arquivo)
      SELECT 1, 'pm25', t, t + interval '1 hour', 40, 'µg/m³', $1 FROM generate_series('2026-10-21T04:00Z'::timestamptz, '2026-10-22T03:00Z', '1 hour') t`,
      [a],
    );
    await db.query(
      `INSERT INTO metar.observacao (estacao, observado_em, texto, visibilidade_m, tempo, arquivo) VALUES
      ('SBEG', '2026-10-21T12:00Z', 'SBEG 211200Z 09005KT 4000 FU NSC 31/22 Q1011', 4000, '{FU}', $1)`,
      [a],
    );
  }, 120_000); // a fresh database with every migration, through the tunnel
  afterAll(() => db.end());

  test('only the upwind spot counts; numbers, confidence and the v0 note are stored; re-running replaces the day', async () => {
    const r = await attributeDay(db, '2026-10-21');
    expect(r.counted).toBe(1);
    expect(r.ranking[0]).toMatchObject({ municipio: 1300000, nome: 'Leste', parcela: 1 });
    await attributeDay(db, '2026-10-21');
    const row = (await db.query("SELECT * FROM analise.fumaca_dia WHERE dia = '2026-10-21'")).rows;
    expect(row).toHaveLength(1);
    expect(row[0]).toMatchObject({
      pm25_medido_horas: 24,
      horas_fu_hz: 1,
      visibilidade_min_m: 4000,
      focos_contados: 1,
      confianca: 'media',
      nota: NOTE,
    });
    expect(row[0].pm25_medido_media).toBeCloseTo(40);
    expect(row[0].pm25_cams_media).toBeCloseTo(30);
    expect((await db.query('SELECT count(*)::int AS n FROM analise.fumaca_foco')).rows[0].n).toBe(1);
    expect((await seasonRows(db, '2026-08-01', '2026-10-21')).map((r) => r.dia)).toEqual(['2026-10-21']);
  });

  test('v1: the spot under the trajectories counts, with the wind used; re-running replaces v1 and leaves v0', async () => {
    // Every arrival comes from the east at 0.1°/h along lat -3.1: 17 h back the air is over the east spot.
    const linhas = chegadas('2026-10-21').map((t) => ({
      chegada_em: t,
      nivel_hpa: 950,
      pontos: Array.from({ length: 73 }, (_, i) => ({ h: -i, lat: -3.1, lon: -60.02 + 0.1 * i, hpa: 950 })),
      parou_h: null,
    }));
    await gravarDia(db, '2026-10-21', 'gfs', linhas);
    const r = await attributeDay(db, '2026-10-21', 'v1');
    expect(r.counted).toBe(1);
    expect(r.ranking[0]).toMatchObject({ municipio: 1300000, nome: 'Leste', parcela: 1 });
    await attributeDay(db, '2026-10-21', 'v1');
    const rows = (
      await db.query("SELECT versao, meteo, nota, focos_contados, sinais FROM analise.fumaca_dia WHERE dia = '2026-10-21' ORDER BY versao")
    ).rows;
    expect(rows.map((x) => [x.versao, x.meteo])).toEqual([
      ['v0', null],
      ['v1', 'gfs'],
    ]);
    expect(rows[1].nota).toBe(NOTE_V1);
    expect(rows[1].sinais).toHaveProperty('trajetoriasConcordam', true);
    const focos = (await db.query("SELECT versao, horas FROM analise.fumaca_foco WHERE versao = 'v1'")).rows;
    expect(focos).toHaveLength(1);
    expect(focos[0].horas).toBeGreaterThan(1); // in how many trajectories it counted
  });

  test('a partial v1 (fewer than 8 arrivals, from the 17h report) is removed when the day cannot be redone; a full one stays', async () => {
    const linhas = (n: number) =>
      chegadas('2026-10-21')
        .slice(0, n)
        .map((t) => ({
          chegada_em: t,
          nivel_hpa: 950,
          pontos: Array.from({ length: 73 }, (_, i) => ({ h: -i, lat: -3.1, lon: -60.02 + 0.1 * i, hpa: 950 })),
          parou_h: null,
        }));
    await gravarDia(db, '2026-10-21', 'gfs', linhas(4));
    await attributeDay(db, '2026-10-21', 'v1');
    expect(await apagarV1Parcial(db, '2026-10-21')).toBe(1);
    await gravarDia(db, '2026-10-21', 'gfs', linhas(8));
    await attributeDay(db, '2026-10-21', 'v1');
    expect(await apagarV1Parcial(db, '2026-10-21')).toBe(0);
    expect((await db.query("SELECT count(*)::int AS n FROM analise.fumaca_dia WHERE dia = '2026-10-21' AND versao = 'v1'")).rows[0].n).toBe(
      1,
    );
  });

  test('days to redo with ERA5: v1 still on GFS, or no v1 at all (GFS had a gap); not the ones already on ERA5', async () => {
    const copiar = (dia: string, versao: string, meteo: string | null) =>
      db.query(
        `INSERT INTO analise.fumaca_dia SELECT (r).* FROM (SELECT jsonb_populate_record(f, jsonb_build_object('dia', $1::text, 'versao', $2::text, 'meteo', $3::text)) AS r
         FROM analise.fumaca_dia f WHERE dia = '2026-10-21' AND versao = 'v0') x`,
        [dia, versao, meteo],
      );
    await copiar('2026-10-19', 'v0', null);
    await copiar('2026-10-20', 'v0', null);
    await copiar('2026-10-20', 'v1', 'era5');
    await copiar('2026-09-01', 'v0', null); // older than 30 days
    expect(await diasSemEra5(db, '2026-10-22')).toEqual(['2026-10-19', '2026-10-21']);
  });

  test('v1 without trajectories for the day is an error that says so', async () => {
    await expect(attributeDay(db, '2026-10-20', 'v1')).rejects.toThrow('sem trajetórias');
  });
});
