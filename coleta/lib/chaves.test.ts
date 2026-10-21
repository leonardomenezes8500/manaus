import { expiraEm, situacao, tabela } from './chaves.ts';

const jwt = (payload: object) => ['cabecalho', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'assinatura'].join('.');

const agora = new Date('2026-10-21T12:00:00Z');

test('expiraEm lê o exp do JWT', () => {
  expect(expiraEm(jwt({ sub: 'x', exp: 1797789458 }))).toEqual(new Date('2026-12-20T17:57:38Z'));
});

test('expiraEm falha sem exp ou com JWT quebrado', () => {
  expect(() => expiraEm(jwt({ sub: 'x' }))).toThrow('sem exp');
  expect(() => expiraEm('nao-e-jwt')).toThrow();
});

test('regra dos 30 dias', () => {
  const em = (dias: number) => new Date(agora.getTime() + dias * 86_400_000);
  expect(situacao({ chave: 'a', ok: true, expira: em(30) }, agora)).toBe('OK');
  expect(situacao({ chave: 'a', ok: true, expira: em(29.9) }, agora)).toBe('RENOVAR');
  expect(situacao({ chave: 'a', ok: true }, agora)).toBe('OK');
  expect(situacao({ chave: 'a', ok: false, expira: em(100) }, agora)).toBe('FALHA');
});

test('tabela com expiração, dias restantes e detalhe', () => {
  const md = tabela(
    [
      { chave: 'EARTHDATA_TOKEN', ok: true, expira: new Date('2026-12-20T17:57:38Z') },
      { chave: 'FIRMS_MAP_KEY', ok: false, detalhe: 'HTTP 403' },
    ],
    agora,
  );
  expect(md).toContain('EARTHDATA_TOKEN | OK | 2026-12-20 | 60 | 2026-10-21T12:00Z\n');
  expect(md).toContain('FIRMS_MAP_KEY | FALHA | — | — | 2026-10-21T12:00Z | HTTP 403\n');
});
