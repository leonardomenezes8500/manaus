import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { migrar } from './migrar.ts';

// Só roda num banco *_teste (apaga tudo nele). No CI é o service container; aqui, o manaus_teste da slice pelo túnel.
const banco = process.env.PGDATABASE ?? '';
const comBanco = banco.endsWith('_teste') ? describe : describe.skip;

comBanco(`migrar (${banco})`, () => {
  const db = new pg.Client();

  beforeAll(async () => {
    await db.connect();
    await db.query('DROP SCHEMA IF EXISTS bruto CASCADE; DROP TABLE IF EXISTS public.migracoes; DROP EXTENSION IF EXISTS postgis CASCADE');
  });
  afterAll(() => db.end());

  test('aplica a 001 e, rodando de novo, não faz nada', async () => {
    expect(await migrar(db)).toEqual(['001_base.sql']);
    expect(await migrar(db)).toEqual([]);
    expect((await db.query('SELECT postgis_full_version() AS v')).rows[0].v).toMatch(/POSTGIS="3/);
    expect((await db.query("SELECT to_regclass('bruto.arquivo') AS a, to_regclass('bruto.carga') AS c")).rows[0]).toEqual({ a: 'bruto.arquivo', c: 'bruto.carga' });
  });

  test('migração com erro não fica pela metade nem registrada', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
    writeFileSync(join(pasta, '001_base.sql'), 'SELECT 1');
    writeFileSync(join(pasta, '002_quebrada.sql'), 'CREATE TABLE bruto.meia (x int); SELECT nao_existe();');
    await expect(migrar(db, pasta)).rejects.toThrow('002_quebrada.sql');
    expect((await db.query("SELECT to_regclass('bruto.meia') AS t")).rows[0].t).toBeNull();
    expect((await db.query("SELECT count(*)::int AS n FROM public.migracoes WHERE nome = '002_quebrada.sql'")).rows[0].n).toBe(0);
  });
});
