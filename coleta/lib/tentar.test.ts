import { jsonComTentativas, tentar } from './tentar.ts';

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

test('jsonComTentativas: an HTML error page (5xx, or 200 that is not JSON) is retried; a 4xx is not', async () => {
  const respostas = [
    new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    new Response('<html>manutenção</html>', { status: 200 }),
    new Response('{"objectIds": [1, 2]}', { status: 200 }),
  ];
  const fetchOriginal = global.fetch;
  global.fetch = jest.fn(async () => respostas.shift()!) as any;
  try {
    expect(await jsonComTentativas('https://x/query', { vezes: 3, esperaMs: 1 })).toEqual({ objectIds: [1, 2] });
    respostas.push(new Response('não', { status: 404 }));
    await expect(jsonComTentativas('https://x/query', { vezes: 3, esperaMs: 1 })).rejects.toThrow('HTTP 404');
    expect(global.fetch).toHaveBeenCalledTimes(4);
  } finally {
    global.fetch = fetchOriginal;
  }
});
