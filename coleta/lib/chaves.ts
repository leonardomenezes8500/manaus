// Regras do verificador de chaves (#6). O script que faz as requisições é coleta/verificar-chaves.ts.

export const DIAS_PARA_RENOVAR = 30;

export type Resultado = { chave: string; ok: boolean; expira?: Date; detalhe?: string };

/** Data de expiração (`exp`) de um JWT, sem validar assinatura. */
export function expiraEm(jwt: string): Date {
  const exp = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString()).exp;
  if (typeof exp !== 'number') throw new Error('JWT sem exp');
  return new Date(exp * 1000);
}

export function diasRestantes(expira: Date, agora: Date): number {
  return Math.floor((expira.getTime() - agora.getTime()) / 86_400_000);
}

export function situacao(r: Resultado, agora: Date): 'OK' | 'FALHA' | 'RENOVAR' {
  if (!r.ok) return 'FALHA';
  return r.expira && diasRestantes(r.expira, agora) < DIAS_PARA_RENOVAR ? 'RENOVAR' : 'OK';
}

/** Conteúdo de `estado/chaves.md`. */
export function tabela(resultados: Resultado[], agora: Date): string {
  const linhas = resultados.map((r) =>
    [
      r.chave,
      situacao(r, agora),
      r.expira ? r.expira.toISOString().slice(0, 10) : '—',
      r.expira ? String(diasRestantes(r.expira, agora)) : '—',
      agora.toISOString().slice(0, 16) + 'Z',
      r.detalhe ?? '',
    ].join(' | ').replace(/ \| $/, ''),
  );
  return [
    '# Chaves',
    '',
    `Gerado por coleta/verificar-chaves.ts. \`RENOVAR\` = faltam menos de ${DIAS_PARA_RENOVAR} dias para expirar.`,
    '',
    'chave | situação | expira em | dias restantes | verificado em | detalhe',
    '--- | --- | --- | --- | --- | ---',
    ...linhas,
    '',
  ].join('\n');
}
