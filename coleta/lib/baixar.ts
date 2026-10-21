import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const CACHE_DIAS = 7;
const NOMES_CHAVE = ['map_key', 'api_key', 'key', 'token', 'authorization'];

let cliente: S3Client | undefined;
function s3(): S3Client {
  cliente ??= new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
  });
  return cliente;
}

function env(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`falta ${nome} no ambiente`);
  return v;
}

const buffer = (...p: string[]) => join(process.env.MANAUS_BUFFER || join(tmpdir(), 'manaus-buffer'), ...p);

/** Troca por REMOVIDO qualquer valor de segredo do ambiente que apareça no texto (ex.: FIRMS põe a chave no caminho da URL). */
export function semSegredos(texto: string): string {
  for (const [nome, valor] of Object.entries(process.env)) {
    if (valor && valor.length >= 8 && /KEY|TOKEN|SECRET|PASSWORD/i.test(nome)) texto = texto.replaceAll(valor, 'REMOVIDO');
  }
  return texto;
}

/** URL sem chaves: parâmetros com nome de chave e segredos do ambiente. */
export function urlSemChaves(url: string): string {
  const u = new URL(url);
  for (const nome of [...u.searchParams.keys()]) {
    if (NOMES_CHAVE.includes(nome.toLowerCase())) u.searchParams.set(nome, 'REMOVIDO');
  }
  return semSegredos(u.toString());
}

function commit(): string {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'desconhecido';
  }
}

const ehPrecondicao = (e: any) => e?.name === 'PreconditionFailed' || e?.$metadata?.httpStatusCode === 412;

/**
 * Envia um arquivo local ao R2 sem sobrescrever (`If-None-Match: *`): se a chave existe, dá erro.
 * `sobrescrever` só vale em `estado/` (a foto atual) e `produtos/` (derivado, refeito a partir do banco); nunca em `bruto/`.
 */
export async function enviar(caminhoLocal: string, chave: string, opcoes: { sobrescrever?: boolean; sha256?: string } = {}): Promise<void> {
  if (opcoes.sobrescrever && !/^(estado|produtos)\//.test(chave))
    throw new Error(`sobrescrever só é permitido em estado/ e produtos/: ${chave}`);
  await new Upload({
    client: s3(),
    params: {
      Bucket: env('R2_BUCKET'),
      Key: chave,
      Body: createReadStream(caminhoLocal),
      ...(opcoes.sobrescrever ? {} : { IfNoneMatch: '*' }),
      ...(opcoes.sha256 ? { Metadata: { sha256: opcoes.sha256 } } : {}),
    },
  }).done();
}

/** O objeto já está no R2 com este sha256? (envio anterior que chegou, mas a resposta se perdeu) */
async function jaEnviado(chave: string, sha256: string): Promise<boolean> {
  const r = await s3().send(new HeadObjectCommand({ Bucket: env('R2_BUCKET'), Key: chave }));
  return r.Metadata?.sha256 === sha256;
}

async function enviarIdempotente(caminho: string, chave: string, sha256: string): Promise<void> {
  try {
    await enviar(caminho, chave, { sha256 });
  } catch (e) {
    if (!ehPrecondicao(e) || !(await jaEnviado(chave, sha256))) throw e;
  }
}

/** Reenvia o que está em `buffer/pendente/` (a chave é o caminho relativo) e move para o cache. */
export async function enviarPendentes(): Promise<void> {
  const dir = buffer('pendente');
  const arquivos = (await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []))
    .filter((e) => e.isFile() && !e.name.endsWith('.meta.json'))
    .map((e) => relative(dir, join(e.parentPath, e.name)))
    .sort();
  const erros: unknown[] = [];
  for (const chave of arquivos) {
    try {
      const metaLocal = join(dir, chave + '.meta.json');
      const { sha256 } = JSON.parse(await readFile(metaLocal, 'utf8'));
      await enviarIdempotente(join(dir, chave), chave, sha256);
      await enviarIdempotente(metaLocal, chave + '.meta.json', sha256);
      await mkdir(dirname(buffer('cache', chave)), { recursive: true });
      for (const a of [chave, chave + '.meta.json']) {
        // ENOENT: outro processo já enviou e moveu
        await rename(join(dir, a), buffer('cache', a)).catch((e) => {
          if (e.code !== 'ENOENT') throw e;
        });
      }
    } catch (e) {
      // Another process (two crons at once) sent it and moved it to the cache in the meantime: not an error.
      if (
        await stat(join(dir, chave)).then(
          () => true,
          () => false,
        )
      )
        erros.push(e);
    }
  }
  if (erros.length) throw new AggregateError(erros, `${erros.length} arquivo(s) continuam em pendente/`);
}

/** Apaga do buffer (nunca do R2) o cache com mais de 7 dias. */
export async function limparCache(agora = Date.now()): Promise<void> {
  const dir = buffer('cache');
  for (const a of await readdir(dir, { recursive: true }).catch(() => [] as string[])) {
    const s = await stat(join(dir, a));
    if (s.isFile() && agora - s.mtimeMs > CACHE_DIAS * 86_400_000) await rm(join(dir, a));
  }
}

export type Download = {
  fonte: string;
  url: string;
  nome: string;
  coletor: string;
  parametros?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export type Baixado = { chave: string; caminho: string; sha256: string; bytes: number; fonte: string; baixado_em: string };

/**
 * Baixa `url` para `bruto/<fonte>/AAAA/MM/DD/<HHMMSS>Z_<nome>` no R2, com `<arquivo>.meta.json` ao lado.
 * HTTP não 2xx: não grava nada. Falha no R2: o arquivo fica em `pendente/` e sobe no próximo `baixar()`.
 * Devolve o caminho local no cache (válido por 7 dias).
 */
export async function baixar(d: Download, agora = new Date()): Promise<Baixado> {
  for (const [campo, v] of [
    ['fonte', d.fonte],
    ['nome', d.nome],
  ]) {
    if (!/^[\w][\w.-]*$/.test(v)) throw new Error(`${campo} inválido: ${v}`);
  }
  await enviarPendentes().catch(() => {}); // rede ainda fora: tenta de novo no fim

  const iso = agora.toISOString();
  const chave = `bruto/${d.fonte}/${iso.slice(0, 4)}/${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(11, 19).replaceAll(':', '')}Z_${d.nome}`;
  const tmp = buffer('tmp', `${process.pid}-${Date.now()}-${d.nome}`);
  await mkdir(dirname(tmp), { recursive: true });

  const res = await fetch(d.url, { headers: d.headers });
  if (!res.ok || !res.body) {
    await res.body?.cancel();
    throw new Error(`HTTP ${res.status} em ${urlSemChaves(d.url)}`);
  }
  const hash = createHash('sha256');
  let bytes = 0;
  try {
    await pipeline(
      Readable.fromWeb(res.body as any),
      new Transform({
        transform(parte, _, cb) {
          hash.update(parte);
          bytes += parte.length;
          cb(null, parte);
        },
      }),
      createWriteStream(tmp),
    );
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
  const sha256 = hash.digest('hex');
  const meta = {
    url: urlSemChaves(d.url),
    baixado_em: iso,
    http_status: res.status,
    bytes,
    sha256,
    coletor: { nome: d.coletor, commit: commit() },
    parametros: d.parametros ?? {},
  };

  const pendente = buffer('pendente', chave);
  await mkdir(dirname(pendente), { recursive: true });
  await writeFile(pendente + '.meta.json', semSegredos(JSON.stringify(meta, null, 2)) + '\n');
  await rename(tmp, pendente);

  await enviarPendentes();
  await limparCache();
  return { chave, caminho: buffer('cache', chave), sha256, bytes, fonte: d.fonte, baixado_em: iso };
}

/** Every key under `prefix` in R2 (all pages), with size and last-modified time. */
export async function listKeys(prefix: string): Promise<{ key: string; size: number; modified: Date }[]> {
  const out = [];
  let ContinuationToken: string | undefined;
  do {
    const r = await s3().send(new ListObjectsV2Command({ Bucket: env('R2_BUCKET'), Prefix: prefix, ContinuationToken }));
    for (const o of r.Contents ?? []) out.push({ key: o.Key!, size: o.Size ?? 0, modified: o.LastModified! });
    ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return out;
}

/** Opens a raw file as a stream: from the local cache when it is there, otherwise from R2. */
export async function openRaw(key: string): Promise<Readable> {
  const cached = buffer('cache', key);
  if (
    await stat(cached).then(
      (s) => s.isFile(),
      () => false,
    )
  )
    return createReadStream(cached);
  const r = await s3().send(new GetObjectCommand({ Bucket: env('R2_BUCKET'), Key: key }));
  return r.Body as Readable;
}

/** Reads a whole (small) raw file as text. */
export async function readRaw(key: string): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of await openRaw(key)) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}
