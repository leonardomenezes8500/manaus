import { tentar } from './tentar.ts';

const falha = (msg: string, vezes: number) => {
  let n = 0;
  return async () => {
    n++;
    if (n <= vezes) throw new Error(msg);
    return n;
  };
};

test('server and network errors are retried; the result comes back', async () => {
  expect(await tentar(falha('HTTP 500 em https://x', 2), { vezes: 3, esperaMs: 1 })).toBe(3);
  expect(await tentar(falha('fetch failed', 1), { vezes: 3, esperaMs: 1 })).toBe(2);
});

test('gives up after the last try; other errors are not retried', async () => {
  await expect(tentar(falha('HTTP 503 em https://x', 5), { vezes: 3, esperaMs: 1 })).rejects.toThrow('HTTP 503');
  const f = falha('HTTP 404 em https://x', 1);
  await expect(tentar(f, { vezes: 3, esperaMs: 1 })).rejects.toThrow('HTTP 404');
});
