// Required fields of pesquisa/ (#20): same rule as the source catalog, other field lists.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkFields, lerCatalogo, lerFrontMatter } from '../fontes/catalogo.ts';
import { semHipotese, validarHipotese } from './hipoteses.ts';
import { evidenciasSemRotulo, validarSolucao } from './solucoes.ts';

const STATUS = ['rascunho', 'com-evidencia', 'revisado'];
const RULES = {
  problemas: { required: ['id', 'titulo', 'tema', 'status', 'atualizado_em'], allowed: { status: STATUS } },
};

for (const [folder, rule] of Object.entries(RULES)) {
  const docs = lerCatalogo(join(import.meta.dirname, folder));
  if (docs.length)
    test.each(docs.map((d) => [`${folder}/${d.arquivo}`, d] as const))('%s has the required fields', (_, d) => {
      expect(checkFields(d.card, d.arquivo, rule.required, rule.allowed)).toEqual([]);
      if (d.card.atualizado_em) expect(d.card.atualizado_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(evidenciasSemRotulo(readFileSync(join(import.meta.dirname, folder, d.arquivo), 'utf8'))).toEqual([]);
    });
}

test('the problem model passes the rule', () => {
  const doc = lerFrontMatter(readFileSync(join(import.meta.dirname, 'problemas', '_modelo.md'), 'utf8'));
  expect(checkFields(doc, doc.id + '.md', RULES.problemas.required, RULES.problemas.allowed)).toEqual([]);
});

test('a problem without status or with an unknown one fails', () => {
  expect(
    checkFields(
      { id: 'x', titulo: 't', tema: 'fumaca', atualizado_em: '2026-10-21' },
      'x.md',
      RULES.problemas.required,
      RULES.problemas.allowed,
    ),
  ).toEqual(['falta status']);
  expect(
    checkFields(
      { id: 'x', titulo: 't', tema: 'f', status: 'pronto', atualizado_em: '2026-10-21' },
      'x.md',
      RULES.problemas.required,
      RULES.problemas.allowed,
    ),
  ).toEqual(['status inválido: pronto']);
});

// Hypotheses (#59): written before collecting; every collecting source needs one.
describe('hipóteses', () => {
  const ids = new Set(lerCatalogo(join(import.meta.dirname, '..', 'fontes')).map((d) => d.card.id));
  const hips = lerCatalogo(join(import.meta.dirname, 'hipoteses'));

  test.each(hips.map((d) => [d.arquivo, d] as const))('hipoteses/%s follows the rule', (_, d) => {
    expect(validarHipotese(d.card, d.arquivo, ids)).toEqual([]);
  });

  test('every source in "coletando" appears in a hypothesis (the ones collecting before the method are listed)', () => {
    expect(
      semHipotese(
        lerCatalogo(join(import.meta.dirname, '..', 'fontes')).map((d) => d.card),
        hips.map((d) => d.card),
      ),
    ).toEqual([]);
  });

  const ok = {
    id: 'h',
    titulo: 't',
    fontes: 'nasa-firms, tse-dados-abertos',
    espera: 'mais focos',
    defasagem: '0',
    epoca: 'agosto a outubro',
    comparacao: 'anos sem eleição',
    teste: 'diferença de médias',
    rodada: '1',
    status: 'escrita',
    escrita_em: '2026-10-22',
  };
  test('the model passes; a missing field, a source outside the catalog, testada without confianca or tested before written fail', () => {
    expect(
      validarHipotese(
        lerFrontMatter(readFileSync(join(import.meta.dirname, 'hipoteses', '_modelo.md'), 'utf8')),
        'exemplo-hipotese.md',
        ids,
      ),
    ).toEqual([]);
    expect(validarHipotese(ok, 'h.md', ids)).toEqual([]);
    expect(validarHipotese({ ...ok, espera: '' }, 'h.md', ids)).toEqual(['falta espera']);
    expect(validarHipotese({ ...ok, fontes: 'nasa-firms, inventada' }, 'h.md', ids)).toEqual(['fonte fora do catálogo: inventada']);
    const testada = { ...ok, status: 'testada', testada_em: '2026-11-01', resultado: 'r' };
    expect(validarHipotese(testada, 'h.md', ids)).toEqual(['testada sem confianca']);
    expect(validarHipotese({ ...testada, confianca: 'alta', testada_em: '2026-10-01' }, 'h.md', ids)).toEqual([
      'testada_em antes de escrita_em',
    ]);
    expect(validarHipotese({ ...ok, status: 'pronta' }, 'h.md', ids)).toEqual(['status inválido: pronta']);
  });

  test('a new card in "coletando" with no hypothesis fails the gate', () => {
    const card = { id: 'fonte-nova', status: 'coletando' };
    expect(semHipotese([card], [ok])).toEqual(['fonte-nova']);
    expect(semHipotese([card], [{ ...ok, fontes: 'fonte-nova' }])).toEqual([]);
    expect(semHipotese([{ id: 'nasa-firms', status: 'coletando' }], [])).toEqual([]); // collecting before the method
  });
});

// Solutions (#104): classified only by the written criterion, after its date.
describe('soluções', () => {
  const ler = (...p: string[]) => readFileSync(join(import.meta.dirname, ...p), 'utf8');
  const criterioEm = lerFrontMatter(ler('criterio-solucoes.md')).escrito_em;
  const dir = join(import.meta.dirname, 'solucoes');
  const sols = lerCatalogo(dir).map((d) => ({ ...d, texto: ler('solucoes', d.arquivo) }));

  test('the criterion has a date', () => expect(criterioEm).toMatch(/^\d{4}-\d{2}-\d{2}$/));

  if (sols.length)
    test.each(sols.map((d) => [d.arquivo, d] as const))('solucoes/%s follows the criterion', (_, d) => {
      expect(validarSolucao(d.card, d.texto, d.arquivo, criterioEm)).toEqual([]);
    });

  test('the model passes (classificacao empty)', () => {
    const texto = ler('solucoes', '_modelo.md');
    const card = lerFrontMatter(texto);
    expect(validarSolucao(card, texto, card.id + '.md', criterioEm)).toEqual([]);
  });

  const base = { id: 's', titulo: 't', problemas: 'p', proposta_por: 'MPF', fonte: 'https://x.org', status: 'rascunho' };
  const classificada = {
    ...base,
    classificacao: 'pratica',
    atua_em: 'causa',
    teste_local: 'nenhum: só evidência de fora',
    classificada_em: '2026-11-05',
  };
  const corpo = '## Evidências\n- [terceiros] Caiu 30% onde foi feito (estudo, 2024).\n';
  const v = (c: Record<string, string>, t = corpo) => validarSolucao(c, `---\n---\n${t}`, 's.md', '2026-10-28');

  test('a draft without classificacao needs only the base fields', () => {
    expect(v(base)).toEqual([]);
    expect(v({ ...base, proposta_por: '' })).toEqual(['falta proposta_por']);
  });

  test('a classified solution needs atua_em, teste_local and classificada_em', () => {
    expect(v(classificada)).toEqual([]);
    expect(v({ ...base, classificacao: 'pratica' })).toEqual(['falta atua_em', 'falta teste_local', 'falta classificada_em']);
    expect(v({ ...classificada, atua_em: 'meio' })).toEqual(['atua_em inválido: meio']);
  });

  test('classified before the criterion was written fails', () => {
    expect(v({ ...classificada, classificada_em: '2026-10-27' })).toEqual(['classificada_em antes do critério (2026-10-28)']);
    expect(v({ ...classificada, classificada_em: '2026-10-28' })).toEqual([]);
  });

  test('efeito cannot be pratica and causa cannot be paliativa; especulativa goes with both', () => {
    expect(v({ ...classificada, atua_em: 'efeito' })).toEqual(['pratica com atua_em efeito']);
    expect(v({ ...classificada, classificacao: 'paliativa' })).toEqual(['paliativa com atua_em causa']);
    expect(v({ ...classificada, classificacao: 'paliativa', atua_em: 'efeito' })).toEqual([]);
    expect(v({ ...classificada, classificacao: 'especulativa' })).toEqual([]);
    expect(v({ ...classificada, classificacao: 'especulativa', atua_em: 'efeito' })).toEqual([]);
  });

  test('every line under Evidências starts with a label', () => {
    expect(v(base, '## Evidências\n- [medido] 54 dias acima da OMS.\n\n## Outra\n- sem rótulo aqui pode\n')).toEqual([]);
    expect(v(base, '## Evidências\n- [medido] ok\n- Caiu 30% (estudo).\n- [achismo] x\n')).toEqual([
      'evidência sem rótulo: - Caiu 30% (estudo).',
      'evidência sem rótulo: - [achismo] x',
    ]);
  });
});
