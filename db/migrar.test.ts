import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { readdirSync } from 'node:fs';
import { migrar } from './migrar.ts';
import { apagarTudo, banco, comBanco } from './teste.ts';

const todas = readdirSync(join(import.meta.dirname, 'migracoes'))
  .filter((a) => a.endsWith('.sql'))
  .sort();

comBanco(`migrar (${banco})`, () => {
  const db = new pg.Client();

  beforeAll(async () => {
    await db.connect();
    await apagarTudo(db);
    await db.query('DROP EXTENSION IF EXISTS postgis CASCADE');
  });
  afterAll(() => db.end());

  test('aplica todas e, rodando de novo, não faz nada', async () => {
    expect(await migrar(db)).toEqual(todas);
    expect(await migrar(db)).toEqual([]);
    expect((await db.query('SELECT postgis_full_version() AS v')).rows[0].v).toMatch(/POSTGIS="3/);
    expect((await db.query("SELECT to_regclass('bruto.arquivo') AS a, to_regclass('bruto.carga') AS c")).rows[0]).toEqual({
      a: 'bruto.arquivo',
      c: 'bruto.carga',
    });
  });

  test('migração com erro não fica pela metade nem registrada', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
    for (const a of todas) writeFileSync(join(pasta, a), 'SELECT 1');
    writeFileSync(join(pasta, '999_quebrada.sql'), 'CREATE TABLE bruto.meia (x int); SELECT nao_existe();');
    await expect(migrar(db, pasta)).rejects.toThrow('999_quebrada.sql');
    expect((await db.query("SELECT to_regclass('bruto.meia') AS t")).rows[0].t).toBeNull();
    expect((await db.query("SELECT count(*)::int AS n FROM public.migracoes WHERE nome = '999_quebrada.sql'")).rows[0].n).toBe(0);
  });
});
