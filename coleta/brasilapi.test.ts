import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { Readable } from 'node:stream';
import pg from 'pg';
import { bancoNovo, comBanco } from '../db/teste.ts';
import { consultarCep, consultarCnpj } from './brasilapi.ts';

// Real answers of BrasilAPI (2026-10-21), shortened.
const CEP = {
  cep: '69020030',
  state: 'AM',
  city: 'Manaus',
  neighborhood: 'Centro',
  street: 'Avenida Joaquim Nabuco',
  service: 'open-cep',
  ibge: { city: '1302603', state: '13' },
  location: { type: 'Point', coordinates: { longitude: '-60.025', latitude: '-3.10194' } },
};
const CNPJ = {
  cnpj: '04365326000173',
  razao_social: 'MUNICIPIO DE MANAUS',
  nome_fantasia: 'PREFEITURA MUNICIPAL DE MANAUS',
  situacao_cadastral: 2,
  descricao_situacao_cadastral: 'ATIVA',
  cnae_fiscal: 8411600,
  cnae_fiscal_descricao: 'Administração pública em geral',
  codigo_municipio_ibge: 1302603,
  uf: 'AM',
  cep: '69036110',
  logradouro: 'BRASIL',
  numero: '2971',
  bairro: 'COMPENSA',
};

const s3 = mockClient(S3Client);
const r2 = new Map<string, Buffer>();
let pedidos: string[] = [];
let servidor: Server;
let dir: string;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    pedidos.push(req.url!);
    if (req.url === '/api/cep/v2/69020030') return res.end(JSON.stringify(CEP));
    if (req.url === '/api/cnpj/v1/04365326000173') return res.end(JSON.stringify(CNPJ));
    res.writeHead(404).end('{"message":"não encontrado"}');
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  dir = await mkdtemp(join(tmpdir(), 'brasilapi-'));
  Object.assign(process.env, {
    BRASILAPI_URL: `http://127.0.0.1:${(servidor.address() as any).port}/api`,
    MANAUS_BUFFER: dir,
    R2_BUCKET: 'teste',
    R2_ACCOUNT_ID: 'conta',
    R2_ACCESS_KEY_ID: 'id',
    R2_SECRET_ACCESS_KEY: 'segredo',
  });
  s3.on(PutObjectCommand).callsFake(async (i) => {
    const b = i.Body;
    if (Buffer.isBuffer(b) || b instanceof Uint8Array) r2.set(i.Key, Buffer.from(b));
    else {
      const partes: Buffer[] = [];
      for await (const p of b) partes.push(Buffer.from(p));
      r2.set(i.Key, Buffer.concat(partes));
    }
    return {};
  });
  s3.on(HeadObjectCommand).resolves({});
  s3.on(GetObjectCommand).callsFake(async (i) => ({ Body: Readable.from([r2.get(i.Key)!]) }));
});
afterAll(async () => {
  servidor.close();
  await rm(dir, { recursive: true, force: true });
});

comBanco('BrasilAPI com cache no bruto', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());
  beforeEach(() => {
    pedidos = [];
  });

  test('CEP: the first call goes to the network and to the raw files; the second (< 30 days) does not', async () => {
    const a = await consultarCep(db, '69020-030');
    expect(a).toMatchObject({
      cep: '69020030',
      logradouro: 'Avenida Joaquim Nabuco',
      bairro: 'Centro',
      ibge: 1302603,
      lat: -3.10194,
      lon: -60.025,
    });
    expect([...r2.keys()].some((k) => /^bruto\/brasilapi\/.*_cep_69020030\.json$/.test(k))).toBe(true);
    expect(await consultarCep(db, '69020030')).toEqual(a);
    expect(pedidos).toEqual(['/api/cep/v2/69020030']);
    expect((await db.query('SELECT count(*)::int AS n FROM brasilapi.cep')).rows[0].n).toBe(1);
  });

  test('CEP older than 30 days: asks again', async () => {
    await db.query("UPDATE bruto.arquivo SET baixado_em = now() - interval '31 days' WHERE fonte = 'brasilapi'");
    await consultarCep(db, '69020030');
    expect(pedidos).toEqual(['/api/cep/v2/69020030']);
  });

  test('unknown CEP is null and stores nothing; malformed input is an error before any request', async () => {
    expect(await consultarCep(db, '69999999')).toBeNull();
    await expect(consultarCep(db, '6902')).rejects.toThrow('CEP inválido');
    expect(pedidos).toEqual(['/api/cep/v2/69999999']);
  });

  test('CNPJ: same cache; columns for the territory, the whole answer in dados', async () => {
    const a = await consultarCnpj(db, '04.365.326/0001-73');
    expect(a).toMatchObject({
      cnpj: '04365326000173',
      razao_social: 'MUNICIPIO DE MANAUS',
      cnae: 8411600,
      municipio_ibge: 1302603,
      cep: '69036110',
    });
    await consultarCnpj(db, '04365326000173');
    expect(pedidos).toEqual(['/api/cnpj/v1/04365326000173']);
    expect((await db.query("SELECT dados->>'bairro' AS b FROM brasilapi.cnpj")).rows[0].b).toBe('COMPENSA');
  });
});
