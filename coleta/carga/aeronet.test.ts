import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from './lib.ts';
import { loadAeronet, parseAeronet } from './aeronet.ts';

// Real daily means of ATTO-Campina (level 1.5), the PI contact line removed; the 2nd row's AOD 500 nm set to -999.
const texto = readFileSync(join(import.meta.dirname, '__fixtures__', 'aeronet-atto-15.txt'), 'utf8');

test('parse: site, day from dd:mm:yyyy, level, AOD 500 nm, Ångström 440–870 and count; -999 becomes null', () => {
  expect(parseAeronet(texto)).toEqual([
    { site: 'ATTO-Campina', dia: '2026-09-30', nivel: '1.5', aod_500: 0.264956, angstrom_440_870: 1.187159, n: 71 },
    { site: 'ATTO-Campina', dia: '2026-10-01', nivel: '1.5', aod_500: null, angstrom_440_870: 1.166366, n: 61 },
  ]);
});

test('parse: HTML around the text (without if_no_html) and an answer with no data', () => {
  expect(parseAeronet(`<html><body>${texto.replaceAll('\n', '<br>\n')}</body></html>`)).toHaveLength(2);
  expect(parseAeronet(texto.split('\n').slice(0, 6).join('\n'))).toEqual([]);
});

comBanco('carga AERONET', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('idempotent load; the day view prefers level 2.0 and says which level it used', async () => {
    const a = await registrar(db, {
      chave: 'bruto/aeronet/a',
      fonte: 'aeronet',
      sha256: 'a'.repeat(64),
      baixado_em: '2026-10-22T00:00:00Z',
    });
    const b = await registrar(db, {
      chave: 'bruto/aeronet/b',
      fonte: 'aeronet',
      sha256: 'b'.repeat(64),
      baixado_em: '2026-10-22T00:00:00Z',
    });
    await loadAeronet(db, a, parseAeronet(texto));
    await loadAeronet(db, a, parseAeronet(texto));
    const l20 = parseAeronet(texto)
      .slice(0, 1)
      .map((r) => ({ ...r, nivel: '2.0' as const, aod_500: 0.25 }));
    await loadAeronet(db, b, l20);
    expect((await db.query('SELECT count(*)::int AS n FROM aeronet.aod_dia')).rows[0].n).toBe(3);
    const v = await db.query(`SELECT to_char(dia, 'YYYY-MM-DD') AS dia, nivel, aod_500 FROM aeronet.aod_dia_melhor ORDER BY dia`);
    expect(v.rows).toEqual([
      { dia: '2026-09-30', nivel: '2.0', aod_500: 0.25 },
      { dia: '2026-10-01', nivel: '1.5', aod_500: null },
    ]);
  });
});
