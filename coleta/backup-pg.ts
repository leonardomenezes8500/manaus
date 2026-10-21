// Backup diário do banco (#5): pg_dump -Fc → backup/pg/AAAA-MM-DD.dump no R2 (dia de Manaus).
// Quem apaga os de mais de 14 dias é a regra de ciclo de vida do bucket, não o código.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diaDeManaus } from '../analise/dia.ts';
import { enviar } from './lib/baixar.ts';

const pasta = mkdtempSync(join(process.env.MANAUS_BUFFER || tmpdir(), 'pg-'));
const arquivo = join(pasta, 'manaus.dump');
try {
  execFileSync('pg_dump', ['-Fc', '-f', arquivo], { stdio: 'inherit' }); // conexão pelas variáveis PG*
  const chave = `backup/pg/${diaDeManaus(new Date())}.dump`;
  await enviar(arquivo, chave);
  console.log(chave);
} finally {
  rmSync(pasta, { recursive: true, force: true });
}
