// Solution rule (#104): pesquisa/solucoes/<id>.md, classified by pesquisa/criterio-solucoes.md.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkFields, lerCatalogo, type Card } from '../fontes/catalogo.ts';

const OBRIGATORIOS = ['id', 'titulo', 'problemas', 'proposta_por', 'fonte', 'status'];
const NA_CLASSIFICACAO = ['atua_em', 'teste_local', 'classificada_em'];
const VALORES = {
  status: ['rascunho', 'com-evidencia', 'revisado'],
  // sem-classe: acts on the cause and is not speculative, but body, law or budget are not checked yet (criterion)
  classificacao: ['pratica', 'paliativa', 'especulativa', 'sem-classe'],
  atua_em: ['causa', 'efeito'],
};
const ROTULO = /^- \[(medido|modelado|registro|terceiros)\]/;

/** Problems of one solution; `texto` = the whole file, `criterioEm` = escrito_em of the criterion. */
export function validarSolucao(s: Card, texto: string, arquivo: string, criterioEm: string): string[] {
  const erros = checkFields(s, arquivo, s.classificacao ? [...OBRIGATORIOS, ...NA_CLASSIFICACAO] : OBRIGATORIOS, VALORES);
  if (s.classificacao && s.classificada_em) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.classificada_em)) erros.push('classificada_em não é AAAA-MM-DD');
    else if (s.classificada_em < criterioEm) erros.push(`classificada_em antes do critério (${criterioEm})`);
  }
  if (s.classificacao) {
    if (s.classificacao === 'pratica' && s.atua_em === 'efeito') erros.push('pratica com atua_em efeito');
    if (s.classificacao === 'paliativa' && s.atua_em === 'causa') erros.push('paliativa com atua_em causa');
    if (s.classificacao === 'sem-classe' && s.atua_em === 'efeito') erros.push('sem-classe com atua_em efeito');
  }
  // `#` starts a comment in the front matter reader, so "issue #84" would silently lose the rest of the value.
  for (const l of (texto.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '').split('\n'))
    if (/\s#\d/.test(l)) erros.push(`# antes de número corta o valor: ${l}`);
  return [...erros, ...evidenciasSemRotulo(texto)];
}

/** Lines under "## Evidências" that do not start with a label (problems and solutions). */
export function evidenciasSemRotulo(texto: string): string[] {
  const secao = texto.split(/^## /m).find((sec) => sec.startsWith('Evidências')) ?? '';
  return secao
    .split('\n')
    .slice(1)
    .filter((l) => l.startsWith('- ') && !ROTULO.test(l))
    .map((l) => `evidência sem rótulo: ${l}`);
}

const CLASSE: Record<string, string> = {
  pratica: 'prática',
  paliativa: 'paliativa',
  especulativa: 'especulativa',
  'sem-classe': 'sem classe (falta conferir)',
};

/** pesquisa/solucoes-resumo.md from the front matter: one row per solution, practical first. */
export function tabelaResumo(sols: Card[]): string {
  const ordem = ['pratica', 'sem-classe', 'paliativa', 'especulativa', ''];
  const celula = (t: string | undefined) => (t ?? '').replaceAll('|', '/');
  const linhas = [...sols]
    .sort((a, b) => ordem.indexOf(a.classificacao ?? '') - ordem.indexOf(b.classificacao ?? '') || a.id.localeCompare(b.id))
    .map(
      (s) =>
        `| [${celula(s.titulo)}](solucoes/${s.id}.md)${s.proposta_por === 'este projeto' ? ' (proposta deste projeto)' : ''} | ${CLASSE[s.classificacao] ?? 'sem classe'} | ${celula(s.atua_em)} | ${celula(s.quem_se_beneficia)} | ${celula(s.teste_local)} |`,
    );
  return [
    '# Soluções da fumaça: tabela-resumo',
    '',
    'Gerada do front matter de `pesquisa/solucoes/` por `node pesquisa/solucoes.ts` (#117), com o critério de `pesquisa/criterio-solucoes.md`. Não editar à mão.',
    '',
    '| solução | classe | onde age | quem se beneficia | teste local |',
    '|---|---|---|---|---|',
    ...linhas,
    '',
  ].join('\n');
}

if (import.meta.main)
  writeFileSync(
    join(import.meta.dirname, 'solucoes-resumo.md'),
    tabelaResumo(lerCatalogo(join(import.meta.dirname, 'solucoes')).map((d) => d.card)),
  );
