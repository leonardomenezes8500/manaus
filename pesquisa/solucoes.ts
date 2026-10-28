// Solution rule (#104): pesquisa/solucoes/<id>.md, classified by pesquisa/criterio-solucoes.md.
import { checkFields, type Card } from '../fontes/catalogo.ts';

const OBRIGATORIOS = ['id', 'titulo', 'problemas', 'proposta_por', 'fonte', 'status'];
const NA_CLASSIFICACAO = ['atua_em', 'teste_local', 'classificada_em'];
const VALORES = {
  status: ['rascunho', 'com-evidencia', 'revisado'],
  classificacao: ['pratica', 'paliativa', 'especulativa'],
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
  }
  const evidencias = texto.split(/^## /m).find((sec) => sec.startsWith('Evidências')) ?? '';
  for (const linha of evidencias.split('\n').slice(1))
    if (linha.startsWith('- ') && !ROTULO.test(linha)) erros.push(`evidência sem rótulo: ${linha}`);
  return erros;
}
