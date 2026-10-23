// Backup diário do banco (#5): pg_dump -Fc → backup/pg/AAAA-MM-DD.dump no R2 (dia de Manaus).
// Quem apaga os de mais de 14 dias é a regra de ciclo de vida do bucket, não o código.
// Fora do dump (#73): os dados das tabelas grandes que se refazem do bruto ou do publicador com um comando que já existe
// (a lista e os comandos estão no COMO-TRABALHAR). A estrutura delas fica. Ficam no dump o que não se refaz
// (bruto.arquivo, bruto.carga, entidade, análises) e o que o cron junta dia a dia (focos, METAR, telemetria da ANA).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diaDeManaus } from '../analise/dia.ts';
import { enviar } from './lib/baixar.ts';

const SEM_DADOS = [
  'overture.edificacao',
  'openbuildings.edificacao',
  'osm.ponto',
  'osm.linha',
  'osm.poligono',
  'ibge.cnefe_endereco',
  'ibge.setor',
  'ibge.setor_agregado',
  'inpe_desmatamento.deter',
  'sfb.floresta_publica',
  'ibama.embargo',
  'ibama.auto_infracao',
  'icmbio.embargo',
  'icmbio.auto_infracao',
  'incra.sigef',
  'incra.snci',
  'incra.assentamento',
  'mapbiomas_alerta.alerta',
];

const pasta = mkdtempSync(join(process.env.MANAUS_BUFFER || tmpdir(), 'pg-'));
const arquivo = join(pasta, 'manaus.dump');
try {
  execFileSync('pg_dump', ['-Fc', '-f', arquivo, ...SEM_DADOS.map((t) => `--exclude-table-data=${t}`)], { stdio: 'inherit' }); // conexão pelas variáveis PG*
  const chave = `backup/pg/${diaDeManaus(new Date())}.dump`;
  await enviar(arquivo, chave);
  console.log(chave);
} finally {
  rmSync(pasta, { recursive: true, force: true });
}
