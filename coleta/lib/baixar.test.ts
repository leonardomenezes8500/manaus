import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readdir, rm, utimes, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { mockClient } from 'aws-sdk-client-mock';
import { baixar, enviar, enviarPendentes, guardar, limparCache, listKeys, readRaw, urlSemChaves } from './baixar.ts';

// S3 de mentira: guarda em memória e respeita If-None-Match: *
const s3 = mockClient(S3Client);
let r2: Map<string, { corpo: Buffer; metadata?: Record<string, string> }>;
let redeCaiNoProximo = false;
let atrasoNoProximo = 0; // ms: holds one upload so another process can overtake it

async function corpo(b: any): Promise<Buffer> {
  if (Buffer.isBuffer(b) || b instanceof Uint8Array) return Buffer.from(b);
  const partes: Buffer[] = [];
  for await (const p of b) partes.push(Buffer.from(p));
  return Buffer.concat(partes);
}

let servidor: Server;
let base: string;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

beforeAll(async () => {
  servidor = createServer((req, res) => {
    if (req.url?.startsWith('/erro')) return res.writeHead(500).end('falhou');
    res.end(`malha ${req.url}`);
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(servidor.address() as any).port}`;
});
afterAll(() => servidor.close());

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'baixar-'));
  Object.assign(process.env, {
    MANAUS_BUFFER: dir,
    R2_BUCKET: 'teste',
    R2_ACCOUNT_ID: 'conta',
    R2_ACCESS_KEY_ID: 'id',
    R2_SECRET_ACCESS_KEY: 'segredo-do-r2',
    FIRMS_MAP_KEY: 'chave-firms-123',
    GIT_COMMIT: 'abc1234',
  });
  r2 = new Map();
  redeCaiNoProximo = false;
  s3.reset();
  s3.on(PutObjectCommand).callsFake(async (i) => {
    if (redeCaiNoProximo) {
      redeCaiNoProximo = false;
      throw new Error('ECONNRESET');
    }
    if (atrasoNoProximo) {
      const ms = atrasoNoProximo;
      atrasoNoProximo = 0;
      await new Promise((ok) => setTimeout(ok, ms));
    }
    if (i.IfNoneMatch === '*' && r2.has(i.Key))
      throw Object.assign(new Error('existe'), { name: 'PreconditionFailed', $metadata: { httpStatusCode: 412 } });
    r2.set(i.Key, { corpo: await corpo(i.Body), metadata: i.Metadata });
    return { ETag: '"x"' };
  });
  s3.on(HeadObjectCommand).callsFake(async (i) => ({ Metadata: r2.get(i.Key)?.metadata }));
  s3.on(GetObjectCommand).callsFake(async (i) => ({ Body: Readable.from([r2.get(i.Key)!.corpo]) }));
  // Pages of 2 keys, to exercise the continuation token.
  s3.on(ListObjectsV2Command).callsFake(async (i) => {
    const keys = [...r2.keys()].filter((k) => k.startsWith(i.Prefix)).sort();
    const start = Number(i.ContinuationToken ?? 0);
    const page = keys.slice(start, start + 2);
    const more = start + 2 < keys.length;
    return {
      Contents: page.map((Key) => ({ Key, Size: r2.get(Key)!.corpo.length, LastModified: quando })),
      IsTruncated: more,
      NextContinuationToken: more ? String(start + 2) : undefined,
    };
  });
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const quando = new Date('2026-10-21T15:04:05Z');
const malha = () => ({
  fonte: 'ibge-malhas',
  url: `${base}/malha?formato=geojson`,
  nome: 'manaus.json',
  coletor: 'teste',
  parametros: { municipio: 1302603 },
});

test('grava arquivo + meta na chave datada', async () => {
  const r = await baixar(malha(), quando);
  expect(r.chave).toBe('bruto/ibge-malhas/2026/10/21/150405Z_manaus.json');
  expect(r2.get(r.chave)!.corpo.toString()).toBe('malha /malha?formato=geojson');
  const meta = JSON.parse(r2.get(r.chave + '.meta.json')!.corpo.toString());
  expect(meta).toEqual({
    url: `${base}/malha?formato=geojson`,
    baixado_em: '2026-10-21T15:04:05.000Z',
    http_status: 200,
    bytes: 28,
    sha256: sha('malha /malha?formato=geojson'),
    coletor: { nome: 'teste', commit: 'abc1234' },
    parametros: { municipio: 1302603 },
  });
  expect(s3.commandCalls(PutObjectCommand).every((c) => c.args[0].input.IfNoneMatch === '*')).toBe(true);
  expect(await readdir(join(dir, 'cache/bruto/ibge-malhas/2026/10/21'))).toHaveLength(2);
});

test('guardar: a local file (e.g. a clip made here) goes to the dated key with the same meta, the origin as url', async () => {
  const local = join(dir, 'recorte.parquet');
  await writeFile(local, 'prédios');
  const r = await guardar(
    local,
    { fonte: 'overture', nome: 'manaus.parquet', coletor: 'teste', origem: 's3://bucket/release/x', parametros: { release: 'x' } },
    quando,
  );
  expect(r.chave).toBe('bruto/overture/2026/10/21/150405Z_manaus.parquet');
  expect(r2.get(r.chave)!.corpo.toString()).toBe('prédios');
  expect(JSON.parse(r2.get(r.chave + '.meta.json')!.corpo.toString())).toEqual({
    url: 's3://bucket/release/x',
    baixado_em: '2026-10-21T15:04:05.000Z',
    bytes: Buffer.byteLength('prédios'),
    sha256: sha('prédios'),
    coletor: { nome: 'teste', commit: 'abc1234' },
    parametros: { release: 'x' },
  });
  expect(r.caminho).toBe(join(dir, 'cache', r.chave));
});

test('não sobrescreve: segunda escrita na mesma chave é recusada', async () => {
  await baixar(malha(), quando);
  const outro = join(dir, 'outro');
  await writeFile(outro, 'diferente');
  await expect(enviar(outro, 'bruto/ibge-malhas/2026/10/21/150405Z_manaus.json')).rejects.toMatchObject({ name: 'PreconditionFailed' });
  await expect(enviar(outro, 'bruto/x', { sobrescrever: true })).rejects.toThrow('só é permitido em estado/ e produtos/');
  await enviar(outro, 'estado/saude.md');
  await expect(enviar(outro, 'estado/saude.md', { sobrescrever: true })).resolves.toBeUndefined();
  await enviar(outro, 'produtos/fumaca/2026-10-21/relatorio.md');
  await expect(enviar(outro, 'produtos/fumaca/2026-10-21/relatorio.md', { sobrescrever: true })).resolves.toBeUndefined();
});

test('listKeys walks every page; readRaw reads from the cache or, without it, from R2', async () => {
  const a = await baixar(malha(), quando);
  await baixar(malha(), new Date(quando.getTime() + 1000));
  const keys = (await listKeys('bruto/ibge-malhas/')).map((k) => k.key);
  expect(keys).toHaveLength(4); // 2 files + 2 metas, in 2 pages
  expect(await readRaw(a.chave)).toBe('malha /malha?formato=geojson');
  await rm(join(dir, 'cache'), { recursive: true });
  expect(await readRaw(a.chave)).toBe('malha /malha?formato=geojson');
});

test('a chave some do meta (query e caminho)', async () => {
  const r = await baixar({ ...malha(), url: `${base}/api/chave-firms-123/area?MAP_KEY=chave-firms-123&api_key=xyz&dia=1` }, quando);
  const texto = r2.get(r.chave + '.meta.json')!.corpo.toString();
  expect(texto).not.toMatch(/chave-firms-123|xyz/);
  expect(JSON.parse(texto).url).toBe(`${base}/api/REMOVIDO/area?MAP_KEY=REMOVIDO&api_key=REMOVIDO&dia=1`);
  expect(urlSemChaves('https://x.org/a?token=t1&Key=k2')).toBe('https://x.org/a?token=REMOVIDO&Key=REMOVIDO');
});

test('HTTP 500 não deixa lixo nem no buffer nem no R2', async () => {
  await expect(baixar({ ...malha(), url: `${base}/erro` }, quando)).rejects.toThrow('HTTP 500');
  expect(r2.size).toBe(0);
  expect(await readdir(dir, { recursive: true }).then((a) => a.filter((f) => !f.endsWith('tmp')))).toEqual([]);
});

test('falha de envio deixa o arquivo em pendente/ e ele sobe no próximo baixar()', async () => {
  redeCaiNoProximo = true;
  await expect(baixar(malha(), quando)).rejects.toThrow('pendente/');
  expect(r2.size).toBe(0);
  expect(await readdir(join(dir, 'pendente/bruto/ibge-malhas/2026/10/21'))).toHaveLength(2);

  await baixar(malha(), new Date('2026-10-21T16:00:00Z'));
  expect([...r2.keys()].sort()).toEqual([
    'bruto/ibge-malhas/2026/10/21/150405Z_manaus.json',
    'bruto/ibge-malhas/2026/10/21/150405Z_manaus.json.meta.json',
    'bruto/ibge-malhas/2026/10/21/160000Z_manaus.json',
    'bruto/ibge-malhas/2026/10/21/160000Z_manaus.json.meta.json',
  ]);
  expect(await readdir(join(dir, 'pendente/bruto/ibge-malhas/2026/10/21'))).toEqual([]);
});

test('reenvio de algo que já chegou (resposta perdida) não trava a fila', async () => {
  redeCaiNoProximo = true;
  await expect(baixar(malha(), quando)).rejects.toThrow();
  // o arquivo chegou ao R2 com o mesmo sha256, mas o cliente não soube
  r2.set('bruto/ibge-malhas/2026/10/21/150405Z_manaus.json', {
    corpo: Buffer.from(''),
    metadata: { sha256: sha('malha /malha?formato=geojson') },
  });
  await baixar(malha(), new Date('2026-10-21T16:00:00Z'));
  expect(r2.has('bruto/ibge-malhas/2026/10/21/150405Z_manaus.json.meta.json')).toBe(true);
});

test('cache com mais de 7 dias sai do buffer', async () => {
  await mkdir(join(dir, 'cache/bruto/f'), { recursive: true });
  await writeFile(join(dir, 'cache/bruto/f/velho'), '');
  await writeFile(join(dir, 'cache/bruto/f/novo'), '');
  const oitoDias = new Date(Date.now() - 8 * 86_400_000);
  await utimes(join(dir, 'cache/bruto/f/velho'), oitoDias, oitoDias);
  await limparCache();
  expect(await readdir(join(dir, 'cache/bruto/f'))).toEqual(['novo']);
});

test('two processes sending the same pending file at once: both finish without error, the file goes up once', async () => {
  redeCaiNoProximo = true;
  await expect(baixar(malha(), quando)).rejects.toThrow('pendente/');
  atrasoNoProximo = 100; // process A stalls on its first upload; B sends everything and moves the files to the cache
  const a = enviarPendentes();
  await new Promise((ok) => setTimeout(ok, 20));
  await enviarPendentes();
  await a; // A finds its files gone: someone else sent them, not an error
  expect([...r2.keys()].sort()).toEqual([
    'bruto/ibge-malhas/2026/10/21/150405Z_manaus.json',
    'bruto/ibge-malhas/2026/10/21/150405Z_manaus.json.meta.json',
  ]);
  expect(await readdir(join(dir, 'pendente/bruto/ibge-malhas/2026/10/21'))).toEqual([]);
});
