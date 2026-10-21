// Ajuda dos testes que usam banco. Só rodam num banco *_teste (apagam tudo nele): no CI é o service container;
// aqui, o manaus_teste da slice pelo túnel. Os testes rodam em série (--runInBand) porque dividem o mesmo banco.
import pg from 'pg';
import { migrar } from './migrar.ts';

export const banco = process.env.PGDATABASE ?? '';
export const comBanco = (nome: string, testes: () => void) => (banco.endsWith('_teste') ? describe : describe.skip)(nome, testes);

// Esquemas que a imagem do PostGIS cria sozinha e que os testes não apagam.
const DO_SISTEMA = ['information_schema', 'public', 'tiger', 'tiger_data', 'topology'];

/** Apaga tudo o que as migrações criaram (esquemas e o registro delas). */
export async function apagarTudo(db: pg.ClientBase): Promise<void> {
  const r = await db.query("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\\_%' AND NOT (nspname = ANY($1))", [DO_SISTEMA]);
  for (const { nspname } of r.rows) await db.query(`DROP SCHEMA "${nspname}" CASCADE`);
  await db.query('DROP TABLE IF EXISTS public.migracoes');
}

/** Banco do zero com todas as migrações. */
export async function bancoNovo(db: pg.ClientBase): Promise<void> {
  await apagarTudo(db);
  await migrar(db);
}
