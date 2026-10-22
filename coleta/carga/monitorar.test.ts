import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from './lib.ts';
import { loadMonitorar, parseMonitorar } from './monitorar.ts';

// Shortened real answer of the MonitorAr backend (/v1/estacao/proximas, 2026-10-22): one station, MP2.5 index per hour.
const resposta = (horas: [string, number | null][]) =>
  JSON.stringify([
    {
      idEstacao: 178586,
      noEstacao: 'FIOTEC - Amazonas',
      nuLatitude: '-3.112545',
      nuLongitude: '-60.011875',
      noFonteDados: 'FioAres',
      municipio: { idMunicipio: 1302603, noMunicipio: 'Manaus' },
      categoriaEstacao: { codigo: 'R', descricao: 'Regulatória' },
      poluentes: [
        {
          idPoluente: 15,
          noPoluente: 'MP₂,₅',
          medicoes: horas.map(([dtMedicao, indiceQualidadeAr]) => ({
            idMedicao: null,
            indiceQualidadeAr,
            dtMedicao,
            stDadoValidado: true,
            classificacaoIqAr: { id: 2, noClassificacao: 'Moderada' },
          })),
        },
      ],
    },
  ]);

test('parse: one row per station, pollutant and hour, with the time as given (zone not documented); null index left out', () => {
  expect(
    parseMonitorar(
      resposta([
        ['2026-10-21 08:00', 50],
        ['2026-10-21 09:00', null],
      ]),
    ),
  ).toEqual([
    {
      estacao: 178586,
      nome: 'FIOTEC - Amazonas',
      lat: -3.112545,
      lon: -60.011875,
      poluente: 15,
      hora_local: '2026-10-21 08:00',
      iqar: 50,
      classificacao: 'Moderada',
      validado: true,
    },
  ]);
});

comBanco('carga MonitorAr', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('hourly files overlap by 23 h: each hour is stored once, the newest file wins', async () => {
    const a = await registrar(db, {
      chave: 'bruto/monitorar-mma/a',
      fonte: 'monitorar-mma',
      sha256: 'a'.repeat(64),
      baixado_em: '2026-10-22T12:00:00Z',
    });
    const b = await registrar(db, {
      chave: 'bruto/monitorar-mma/b',
      fonte: 'monitorar-mma',
      sha256: 'b'.repeat(64),
      baixado_em: '2026-10-22T13:00:00Z',
    });
    await loadMonitorar(
      db,
      a,
      parseMonitorar(
        resposta([
          ['2026-10-21 08:00', 50],
          ['2026-10-21 09:00', 51],
        ]),
      ),
    );
    await loadMonitorar(
      db,
      b,
      parseMonitorar(
        resposta([
          ['2026-10-21 09:00', 52],
          ['2026-10-21 10:00', 53],
        ]),
      ),
    );
    await loadMonitorar(
      db,
      b,
      parseMonitorar(
        resposta([
          ['2026-10-21 09:00', 52],
          ['2026-10-21 10:00', 53],
        ]),
      ),
    ); // same file again: no-op
    const r = await db.query("SELECT to_char(hora_local, 'HH24') AS h, iqar, arquivo FROM monitorar.medicao ORDER BY hora_local");
    expect(r.rows.map((x) => [x.h, x.iqar, Number(x.arquivo)])).toEqual([
      ['08', 50, a],
      ['09', 52, b],
      ['10', 53, b],
    ]);
  });
});
