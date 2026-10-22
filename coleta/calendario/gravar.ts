// Saving the official calendar (#60): contexto.periodo, re-running replaces the same event (type, name, start, scope).
import type pg from 'pg';
import type { Periodo } from './regras.ts';

export async function gravarPeriodos(db: pg.ClientBase, linhas: (Periodo & { arquivo: number | null })[]): Promise<void> {
  const cols = ['tipo', 'nome', 'inicio', 'fim', 'abrangencia', 'fonte', 'ato', 'url', 'arquivo'] as const;
  await db.query(
    `INSERT INTO contexto.periodo (tipo, nome, inicio, fim, abrangencia, fonte, ato, url, arquivo)
     SELECT * FROM unnest($1::text[], $2::text[], $3::date[], $4::date[], $5::text[], $6::text[], $7::text[], $8::text[], $9::bigint[])
     ON CONFLICT (tipo, nome, inicio, abrangencia) DO UPDATE
       SET fim = excluded.fim, fonte = excluded.fonte, ato = excluded.ato, url = excluded.url, arquivo = excluded.arquivo`,
    cols.map((k) => linhas.map((l) => l[k] ?? null)),
  );
}
