// Controle de carga (camada 2): que arquivo do bruto existe (bruto.arquivo) e para que tabela já foi lido (bruto.carga).
import type pg from 'pg';

export type Arquivo = { chave: string; fonte: string; sha256: string; baixado_em: string };

/** Registra o arquivo (se ainda não estiver) e devolve o id. */
export async function registrar(db: pg.ClientBase, a: Arquivo): Promise<number> {
  const r = await db.query(
    `INSERT INTO bruto.arquivo (chave, fonte, sha256, baixado_em) VALUES ($1, $2, $3, $4)
     ON CONFLICT (chave) DO UPDATE SET chave = excluded.chave RETURNING id`,
    [a.chave, a.fonte, a.sha256, a.baixado_em],
  );
  return Number(r.rows[0].id);
}

export async function jaCarregado(db: pg.ClientBase, arquivo: number, tabela: string): Promise<boolean> {
  return (await db.query('SELECT 1 FROM bruto.carga WHERE arquivo = $1 AND tabela = $2', [arquivo, tabela])).rowCount! > 0;
}

export async function marcarCarregado(db: pg.ClientBase, arquivo: number, tabela: string): Promise<void> {
  await db.query('INSERT INTO bruto.carga (arquivo, tabela) VALUES ($1, $2) ON CONFLICT DO NOTHING', [arquivo, tabela]);
}
