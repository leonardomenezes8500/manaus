import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { splitCsv } from './csv.ts';
import { firmsRow, inpeRow, loadLines } from './focos.ts';
import { pendingFiles, registrar } from './lib.ts';
import { carregarMunicipios } from './municipios.ts';
import { BBOX, naCaixa } from '../regiao.ts';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, '__fixtures__', name), 'utf8');
async function* lines(text: string) {
  yield* text.split('\n');
}

test('splitCsv handles quotes and empty fields', () => {
  expect(splitCsv('a,"b,c",,"d ""e"""')).toEqual(['a', 'b,c', '', 'd "e"']);
});

test('FIRMS VIIRS and MODIS rows (acq_time without leading zeros)', () => {
  const head =
    'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight'.split(',');
  const r = firmsRow(
    Object.fromEntries(
      head.map((h, i) => [h, '-3.88631,-60.9296,313.65,0.51,0.41,2026-10-20,516,N20,VIIRS,n,2.0NRT,290.57,1.59,N'.split(',')[i]]),
    ),
  );
  expect(r).toEqual({
    satelite: 'N20',
    instrumento: 'VIIRS',
    adquirido_em: '2026-10-20T05:16:00Z',
    lat: -3.88631,
    lon: -60.9296,
    frp: 1.59,
    confianca: 'n',
    dia_noite: 'N',
    brilho: 313.65,
    versao: '2.0NRT',
  });
  expect(
    firmsRow({
      latitude: '1',
      longitude: '2',
      brightness: '300',
      acq_date: '2026-10-20',
      acq_time: '9',
      satellite: 'Terra',
      instrument: 'MODIS',
      confidence: '92',
      version: '6.1NRT',
      frp: '',
      daynight: 'N',
    }),
  ).toMatchObject({ adquirido_em: '2026-10-20T00:09:00Z', brilho: 300, frp: null });
});

test('INPE row', () => {
  const head =
    'id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,municipio_id,estado_id,pais_id,numero_dias_sem_chuva,precipitacao,risco_fogo,bioma,frp'.split(
      ',',
    );
  const line =
    '94caef0c-9982-37a4-8a3f-846429532e14,  -1.055300, -53.395800,2026-10-20 00:00:00,GOES-19,ALMEIRIM,PARÁ,Brasil,1500503,15,33,21.0,0.0,0.94,Amazônia,137.0';
  const rec = Object.fromEntries(head.map((h, i) => [h, splitCsv(line)[i].trim()]));
  expect(inpeRow(rec)).toMatchObject({
    data_hora: '2026-10-20T00:00:00Z',
    lat: -1.0553,
    lon: -53.3958,
    municipio_id: 1500503,
    risco_fogo: 0.94,
    frp: 137,
  });
});

comBanco('carga de focos', () => {
  const db = new pg.Client();
  const arquivo = (chave: string) => registrar(db, { chave, fonte: 'x', sha256: 'a'.repeat(64), baixado_em: '2026-10-21T00:00:00Z' });
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
    // "Município" de mentira cobrindo os focos de Autazes/Manaus da amostra VIIRS (-3.88, -60.93).
    const m = await arquivo('bruto/ibge-malhas/m.geojson');
    const geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-61, -4],
          [-60.8, -4],
          [-60.8, -3.8],
          [-61, -3.8],
          [-61, -4],
        ],
      ],
    };
    await carregarMunicipios(
      db,
      [{ arquivo: m, uf: 'AM', geojson: { features: [{ properties: { codarea: '1300000' }, geometry }] } }],
      new Map([[1300000, 'Teste']]),
    );
  });
  afterAll(() => db.end());
  const count = async (t: string) => (await db.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;

  test('FIRMS: loads, sets the municipality, and loading the same spots again changes nothing', async () => {
    const a = await arquivo('bruto/nasa-firms/a.csv');
    expect(await loadLines(db, a, 'firms.foco', lines(fixture('firms-viirs.csv')))).toBe(5);
    expect(await loadLines(db, a, 'firms.foco', lines(fixture('firms-viirs.csv')))).toBe(5); // tries, conflicts
    const b = await arquivo('bruto/nasa-firms/b.csv'); // overlap of day_range=2: same spots in a new file
    await loadLines(db, b, 'firms.foco', lines(fixture('firms-viirs.csv')));
    await loadLines(db, await arquivo('bruto/nasa-firms/c.csv'), 'firms.foco', lines(fixture('firms-modis.csv')));
    expect(await count('firms.foco')).toBe(10);
    expect((await db.query('SELECT count(*)::int AS n FROM firms.foco WHERE municipio = 1300000')).rows[0].n).toBe(2);
    expect((await db.query("SELECT count(*)::int AS n FROM bruto.carga WHERE tabela = 'firms.foco'")).rows[0].n).toBe(3);
  });

  test('the FIRMS archive (.csv.gz, #52) is never picked for firms.foco: only the NRT .csv files are', async () => {
    const k = (n: string) => `bruto/nasa-firms/2026/10/22/140000Z_${n}`;
    for (const [i, n] of ['VIIRS_SNPP_SP_2024-09-02_5d.csv.gz', 'VIIRS_SNPP_NRT.csv'].entries())
      await registrar(db, { chave: k(n), fonte: 'nasa-firms', sha256: String(i).repeat(64), baixado_em: '2026-10-22T14:00:00Z' });
    const p = (await pendingFiles(db, 'nasa-firms', 'firms.foco', '.csv')).map((f) => f.chave);
    expect(p).toContain(k('VIIRS_SNPP_NRT.csv'));
    expect(p).not.toContain(k('VIIRS_SNPP_SP_2024-09-02_5d.csv.gz'));
  });

  test('INPE: only spots inside the region box are kept; error text is skipped but marked', async () => {
    const a = await arquivo('bruto/inpe-queimadas/a.csv');
    expect(await loadLines(db, a, 'inpe.foco', lines(fixture('inpe.csv')))).toBe(await expectedInpe());
    await loadLines(db, a, 'inpe.foco', lines(fixture('inpe.csv')));
    expect(await count('inpe.foco')).toBe(await expectedInpe());
    const erro = await arquivo('bruto/inpe-queimadas/erro.csv');
    expect(await loadLines(db, erro, 'inpe.foco', lines('<html>503</html>'))).toBe(0);
    expect((await db.query('SELECT 1 FROM bruto.carga WHERE arquivo = $1', [erro])).rowCount).toBe(1);
  });
});

/** Rows of the INPE fixture inside the spots box (BBOX: lon -74..-44 since #56, lat -15..3). */
async function expectedInpe() {
  const [, ...rows] = fixture('inpe.csv')
    .trim()
    .split('\n')
    .map((l) => splitCsv(l));
  return rows.filter((r) => naCaixa(BBOX, +r[1], +r[2])).length;
}

comBanco('carga de focos a partir de um arquivo (readline)', () => {
  const db = new pg.Client();
  beforeAll(() => db.connect());
  afterAll(() => db.end());

  test('a readline over a file is read in full even though BEGIN runs first', async () => {
    const a = await registrar(db, {
      chave: 'bruto/nasa-firms/rl.csv',
      fonte: 'x',
      sha256: 'b'.repeat(64),
      baixado_em: '2026-10-21T00:00:00Z',
    });
    const lines = createInterface({
      input: createReadStream(join(import.meta.dirname, '__fixtures__', 'firms-modis.csv')),
      crlfDelay: Infinity,
    });
    expect(await loadLines(db, a, 'firms.foco', lines)).toBe(5);
  });
});
