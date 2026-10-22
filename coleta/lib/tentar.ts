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

/** GET `url` as JSON with tentar(): a 5xx, or a 200 whose body is not JSON (the gateway's HTML page), is tried again. */
export function jsonComTentativas(url: string, opcoes?: Parameters<typeof tentar>[1]): Promise<any> {
  return tentar(async () => {
    const r = await fetch(url);
    const texto = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
    try {
      return JSON.parse(texto);
    } catch {
      throw new Error(`HTTP 502 em ${url}: a resposta não é JSON`); // a gateway page sent as 200
    }
  }, opcoes);
}
