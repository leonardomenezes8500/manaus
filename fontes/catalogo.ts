import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type Card = Record<string, string>;

const OBRIGATORIOS = ['id', 'nome', 'publicador', 'url', 'acesso', 'chave', 'atualizacao', 'cobertura', 'licenca', 'tipo', 'confiabilidade', 'status'];

const VALORES: Record<string, string[]> = {
  acesso: ['api', 'download', 'pagina'],
  tipo: ['medicao-solo', 'medicao-satelite', 'modelo', 'registro-oficial', 'colaborativo'],
  confiabilidade: ['alta', 'media', 'baixa'],
  status: ['candidata', 'verificada', 'coletando', 'descartada'],
};

// shortcut: só lê front matter plano (`chave: valor`, comentário com ` #`); trocar por um parser YAML se um card precisar de lista ou objeto.
export function lerFrontMatter(texto: string): Card {
  const bloco = texto.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const card: Card = {};
  for (const linha of bloco.split('\n')) {
    const m = linha.replace(/\s+#.*$/, '').match(/^([a-z_]+):\s*(.*)$/);
    if (m) card[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return card;
}

export function validar(card: Card, arquivo: string): string[] {
  const erros = OBRIGATORIOS.filter((c) => !card[c]).map((c) => `falta ${c}`);
  if (card.id && card.id !== arquivo.replace(/\.md$/, '')) erros.push(`id "${card.id}" ≠ nome do arquivo`);
  for (const [campo, ok] of Object.entries(VALORES)) {
    if (card[campo] && !ok.includes(card[campo])) erros.push(`${campo} inválido: ${card[campo]}`);
  }
  if (['verificada', 'coletando'].includes(card.status)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(card.verificado_em ?? '')) erros.push('falta verificado_em (AAAA-MM-DD)');
    if (!card.teste) erros.push('falta teste');
  }
  if (card.status === 'coletando' && !card.coleta) erros.push('falta coleta');
  return erros;
}

/** Cards de `fontes/` (arquivos com `_` na frente, como o modelo, ficam de fora). */
export function lerCatalogo(dir = import.meta.dirname): { arquivo: string; card: Card }[] {
  return readdirSync(dir)
    .filter((a) => a.endsWith('.md') && !a.startsWith('_'))
    .map((arquivo) => ({ arquivo, card: lerFrontMatter(readFileSync(join(dir, arquivo), 'utf8')) }));
}
