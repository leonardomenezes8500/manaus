import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { loadCotas, loadLeituras, loadHidro, massaRow, parseSerieHistorica, parseTelemetria, trechoRow } from './ana.ts';
import { registrar } from './lib.ts';

// Shortened real answers of the ANA web service (telemetriaws1, 2026-10-21).
const serie = `<DataTable><DocumentElement xmlns="">
  <SerieHistorica diffgr:id="SerieHistorica1" msdata:rowOrder="0">
    <EstacaoCodigo>14990000</EstacaoCodigo><NivelConsistencia>2</NivelConsistencia><DataHora>2014-02-01 00:00:00</DataHora>
    <MediaDiaria>1</MediaDiaria><Cota01>2065</Cota01><Cota02>2071.5</Cota02><Cota28>2167</Cota28>
    <Cota01Status>1</Cota01Status><Cota02Status>2</Cota02Status><Cota28Status>1</Cota28Status><DataIns>2019-12-03 00:00:00</DataIns>
  </SerieHistorica>
  <SerieHistorica diffgr:id="SerieHistorica3" msdata:rowOrder="2">
    <EstacaoCodigo>14990000</EstacaoCodigo><NivelConsistencia>2</NivelConsistencia><DataHora>2014-02-01 07:00:00</DataHora>
    <MediaDiaria>0</MediaDiaria><Cota01>2063</Cota01><Cota01Status>1</Cota01Status>
  </SerieHistorica>
  <SerieHistorica diffgr:id="SerieHistorica4" msdata:rowOrder="3">
    <EstacaoCodigo>14990000</EstacaoCodigo><NivelConsistencia>1</NivelConsistencia><DataHora>2014-01-01 17:00:00</DataHora>
    <MediaDiaria>0</MediaDiaria><Cota31>1990</Cota31><Cota31Status>1</Cota31Status>
  </SerieHistorica>
  <SerieHistorica diffgr:id="SerieHistorica5" msdata:rowOrder="4">
    <EstacaoCodigo>14990000</EstacaoCodigo><NivelConsistencia>1</NivelConsistencia><DataHora>2014-01-01 07:00:00</DataHora>
    <MediaDiaria>0</MediaDiaria><Cota31>1985</Cota31><Cota31Status>1</Cota31Status>
  </SerieHistorica>
  <SerieHistorica diffgr:id="SerieHistorica2" msdata:rowOrder="1">
    <EstacaoCodigo>14990000</EstacaoCodigo><NivelConsistencia>1</NivelConsistencia><DataHora>2014-02-01 00:00:00</DataHora>
    <Cota01>2060</Cota01><Cota02 /><Cota01Status>1</Cota01Status><Cota02Status>0</Cota02Status>
  </SerieHistorica>
</DocumentElement></DataTable>`;
const telemetria = `<DataTable><DocumentElement xmlns="">
  <DadosHidrometereologicos diffgr:id="DadosHidrometereologicos1" msdata:rowOrder="0">
    <CodEstacao>14990000</CodEstacao><DataHora>2026-10-21 20:45:00 </DataHora><Vazao /><Nivel>1694.00</Nivel><Chuva>0.00</Chuva>
  </DadosHidrometereologicos>
  <DadosHidrometereologicos diffgr:id="DadosHidrometereologicos2" msdata:rowOrder="1">
    <CodEstacao>14990000</CodEstacao><DataHora>2026-10-21 20:30:00 </DataHora><Vazao /><Nivel /><Chuva>1.20</Chuva>
  </DadosHidrometereologicos>
  <DadosHidrometereologicos diffgr:id="DadosHidrometereologicos3" msdata:rowOrder="2">
    <CodEstacao>14990000</CodEstacao><DataHora>2026-10-21 20:30:00 </DataHora><Vazao /><Nivel>1690.00</Nivel><Chuva>1.20</Chuva>
  </DadosHidrometereologicos>
</DocumentElement></DataTable>`;

test('historical series: one row per day and level; the daily mean wins over the 7h/17h readings, else the earliest reading', () => {
  expect(parseSerieHistorica(serie)).toEqual([
    { estacao: 14990000, dia: '2014-02-01', consistido: true, cota_cm: 2065, status: 1 },
    { estacao: 14990000, dia: '2014-02-02', consistido: true, cota_cm: 2071.5, status: 2 },
    { estacao: 14990000, dia: '2014-02-28', consistido: true, cota_cm: 2167, status: 1 },
    { estacao: 14990000, dia: '2014-01-31', consistido: false, cota_cm: 1985, status: 1 },
    { estacao: 14990000, dia: '2014-02-01', consistido: false, cota_cm: 2060, status: 1 },
  ]);
  expect(parseSerieHistorica('<DataTable><Error>Sem dados para esta estação</Error></DataTable>')).toEqual([]);
});

test('telemetry: Brasília time (UTC−3) to UTC, empty level is null, one reading per time (the first: newest first)', () => {
  expect(parseTelemetria(telemetria)).toEqual([
    { estacao: 14990000, hora: '2026-10-21T23:45:00.000Z', nivel_cm: 1694, chuva_mm: 0 },
    { estacao: 14990000, hora: '2026-10-21T23:30:00.000Z', nivel_cm: null, chuva_mm: 1.2 },
  ]);
});

const linha = {
  type: 'LineString',
  coordinates: [
    [-60.1, -3.1],
    [-60.0, -3.1],
  ],
};
const quadrado = {
  type: 'Polygon',
  coordinates: [
    [
      [-60.1, -3.2],
      [-60.0, -3.2],
      [-60.0, -3.1],
      [-60.1, -3.2],
    ],
  ],
};

test('hydrography features (ArcGIS GeoJSON of the ANA services)', () => {
  expect(
    trechoRow({
      id: 634,
      geometry: linha,
      properties: {
        COTRECHO: 442361,
        NORIOCOMP: 'Rio Igapó-açu',
        COBACIA: '472371',
        NUSTRAHLER: 5,
        DEDOMINIAL: 'Estadual',
        NUCOMPTREC: 12.67,
      },
    }),
  ).toEqual({
    id: 442361,
    nome: 'Rio Igapó-açu',
    cobacia: '472371',
    strahler: 5,
    dominialidade: 'Estadual',
    comprimento_km: 12.67,
    geom: linha,
  });
  expect(trechoRow({ id: 1, geometry: linha, properties: { COTRECHO: 9, NORIOCOMP: ' ' } }).nome).toBeNull();
  expect(
    massaRow({
      id: 16,
      geometry: quadrado,
      properties: { nmoriginal: 'Rio Negro', detipomass: 'Natural', dedominial: 'Federal', nuareakm2: 3.9 },
    }),
  ).toEqual({ id: 16, nome: 'Rio Negro', tipo: 'Natural', dominialidade: 'Federal', area_km2: 3.9, geom: quadrado });
});

comBanco('carga da ANA', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());
  const arquivo = (k: string) =>
    registrar(db, { chave: `bruto/ana/${k}`, fonte: 'ana-telemetria', sha256: 'a'.repeat(64), baixado_em: '2026-10-21T00:00:00Z' });

  test('one value per day: consolidated > raw > daily mean of the telemetry (Manaus day); loading again changes nothing', async () => {
    const a = await arquivo('serie.xml');
    await loadCotas(db, a, parseSerieHistorica(serie));
    await db.query('DELETE FROM bruto.carga');
    await loadCotas(db, a, parseSerieHistorica(serie));
    const t = await arquivo('tele.xml');
    await loadLeituras(db, t, [
      { estacao: 14990000, hora: '2014-02-01T12:00:00Z', nivel_cm: 2000, chuva_mm: 0 },
      { estacao: 14990000, hora: '2014-02-03T12:00:00Z', nivel_cm: 2080, chuva_mm: 0 },
      { estacao: 14990000, hora: '2014-02-03T15:00:00Z', nivel_cm: 2090, chuva_mm: 0 },
      { estacao: 14990000, hora: '2014-02-04T03:30:00Z', nivel_cm: 3000, chuva_mm: 0 }, // 23:30 of Feb 3 in Manaus
    ]);
    const r = await db.query(`SELECT dia::text, cota_cm, fonte, consistido FROM ana.cota_dia WHERE dia < '2014-02-05' ORDER BY dia`);
    expect(r.rows).toEqual([
      { dia: '2014-01-31', cota_cm: 1985, fonte: 'serie_historica', consistido: false },
      { dia: '2014-02-01', cota_cm: 2065, fonte: 'serie_historica', consistido: true },
      { dia: '2014-02-02', cota_cm: 2071.5, fonte: 'serie_historica', consistido: true },
      { dia: '2014-02-03', cota_cm: 2390, fonte: 'telemetria', consistido: false },
    ]);
    expect((await db.query('SELECT count(*)::int AS n FROM ana.cota_diaria')).rows[0].n).toBe(5);
  });

  test('hydrography: features inserted once, cut to the box', async () => {
    const a = await arquivo('trechos.json');
    const row = trechoRow({ id: 1, geometry: linha, properties: { COTRECHO: 9, NORIOCOMP: 'Igarapé do Mindu' } });
    expect(await loadHidro(db, a, 'ana.trecho', [row, row])).toBe(2);
    expect((await db.query('SELECT id, nome FROM ana.trecho')).rows).toEqual([{ id: 9, nome: 'Igarapé do Mindu' }]);
  });
});
