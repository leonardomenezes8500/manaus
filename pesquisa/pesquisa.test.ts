// Required fields of pesquisa/ (#20): same rule as the source catalog, other field lists.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkFields, lerCatalogo, lerFrontMatter } from '../fontes/catalogo.ts';
import { semHipotese, validarHipotese } from './hipoteses.ts';

const STATUS = ['rascunho', 'com-evidencia', 'revisado'];
const RULES = {
  problemas: { required: ['id', 'titulo', 'tema', 'status', 'atualizado_em'], allowed: { status: STATUS } },
  solucoes: {
    required: ['id', 'titulo', 'problemas', 'proposta_por', 'fonte', 'status'],
    allowed: { status: STATUS, classificacao: ['pratica', 'paliativa', 'especulativa'] },
  },
};

for (const [folder, rule] of Object.entries(RULES)) {
  const docs = lerCatalogo(join(import.meta.dirname, folder));
  if (docs.length)
    test.each(docs.map((d) => [`${folder}/${d.arquivo}`, d] as const))('%s has the required fields', (_, d) => {
      expect(checkFields(d.card, d.arquivo, rule.required, rule.allowed)).toEqual([]);
      if (d.card.atualizado_em) expect(d.card.atualizado_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
}

test('the models themselves pass the rule (empty classificacao is allowed)', () => {
  for (const folder of ['problemas', 'solucoes'] as const) {
    const doc = lerFrontMatter(readFileSync(join(import.meta.dirname, folder, '_modelo.md'), 'utf8'));
    expect(checkFields(doc, doc.id + '.md', RULES[folder].required, RULES[folder].allowed)).toEqual([]);
  }
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
