import { setTimeout as esperar } from 'node:timers/promises';

/** Runs `f` again on HTTP 5xx or a network failure (some public services drop now and then), waiting longer each time. */
export async function tentar<T>(f: () => Promise<T>, { vezes = 5, esperaMs = 10_000 } = {}): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await f();
    } catch (e) {
      const passageiro = /HTTP 5\d\d|fetch failed|ECONNRESET|ETIMEDOUT|ENETUNREACH|EAI_AGAIN/.test(`${e} ${(e as any)?.cause?.code ?? ''}`);
      if (i >= vezes || !passageiro) throw e;
      await esperar(esperaMs * i);
    }
  }
}
