// Aplica db/migracoes/NNN_nome.sql em ordem, cada uma numa transação, e registra em public.migracoes (#5).
// Conexão pelas variáveis PG* (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE). Uso: npm run migrar
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const PASTA = join(import.meta.dirname, 'migracoes');
const TRAVA = 5_000_001; // pg_advisory_lock: dois migrar ao mesmo tempo esperam um pelo outro

/** Aplica as migrações que faltam e devolve os nomes aplicadas agora. */
export async function migrar(db: pg.ClientBase, pasta = PASTA): Promise<string[]> {
  const arquivos = (await readdir(pasta)).filter((a) => /^\d{3}_[a-z0-9_]+\.sql$/.test(a)).sort();
  await db.query('SELECT pg_advisory_lock($1)', [TRAVA]);
  try {
    await db.query('CREATE TABLE IF NOT EXISTS public.migracoes (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())');
    const feitas = new Set((await db.query('SELECT nome FROM public.migracoes')).rows.map((r) => r.nome));
    const aplicadas: string[] = [];
    for (const nome of arquivos.filter((a) => !feitas.has(a))) {
      await db.query('BEGIN');
      try {
        await db.query(await readFile(join(pasta, nome), 'utf8'));
        await db.query('INSERT INTO public.migracoes (nome) VALUES ($1)', [nome]);
        await db.query('COMMIT');
      } catch (e) {
        await db.query('ROLLBACK');
        throw new Error(`migração ${nome} falhou: ${(e as Error).message}`);
      }
      aplicadas.push(nome);
    }
    return aplicadas;
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [TRAVA]);
  }
}

async function principal() {
  const db = new pg.Client();
  await db.connect();
  try {
    const aplicadas = await migrar(db);
    console.log(aplicadas.length ? `aplicadas: ${aplicadas.join(', ')}` : 'nada a aplicar');
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
