// Required fields of pesquisa/ (#20): same rule as the source catalog, other field lists.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkFields, lerCatalogo, lerFrontMatter } from '../fontes/catalogo.ts';

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
