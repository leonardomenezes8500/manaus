import { lerCatalogo, lerFrontMatter, validar } from './catalogo.ts';

const catalogo = lerCatalogo();

test('o catálogo tem cards', () => {
  expect(catalogo.length).toBeGreaterThan(0);
});

test.each(catalogo.map((c) => [c.arquivo, c.card] as const))('%s é válido', (arquivo, card) => {
  expect(validar(card, arquivo)).toEqual([]);
});

const ok = lerFrontMatter(`---
id: x
nome: X
publicador: P
url: https://x.org/a#b
acesso: api
chave: nenhuma
atualizacao: diária
cobertura: Brasil
licenca: CC BY 4.0
tipo: modelo
confiabilidade: alta # comentário sai
status: coletando
verificado_em: 2026-10-21
teste: 'curl -H "X-Key: $X" https://x.org'
coleta: 3h
---
corpo`);

test('lê o front matter (comentário sai, aspas saem)', () => {
  expect(ok.confiabilidade).toBe('alta');
  expect(ok.teste).toBe('curl -H "X-Key: $X" https://x.org');
  expect(validar(ok, 'x.md')).toEqual([]);
});

test('acusa campo apagado, id errado, valor fora da lista e falta de coleta', () => {
  const { nome, coleta, ...resto } = ok;
  expect(validar({ ...resto, status: 'coletando', tipo: 'chute' }, 'y.md')).toEqual([
    'falta nome',
    'id "x" ≠ nome do arquivo',
    'tipo inválido: chute',
    'falta coleta',
  ]);
});

test('verificada exige verificado_em e teste; candidata não', () => {
  const { verificado_em, teste, ...resto } = ok;
  expect(validar({ ...resto, status: 'verificada' }, 'x.md')).toEqual(['falta verificado_em (AAAA-MM-DD)', 'falta teste']);
  expect(validar({ ...resto, status: 'candidata' }, 'x.md')).toEqual([]);
});
