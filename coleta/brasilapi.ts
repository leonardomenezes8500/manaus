// BrasilAPI CEP and CNPJ on demand (#33). Every answer goes to the raw files through baixar(); an answer for the same
// CEP/CNPJ younger than 30 days is read back from the raw files instead of the network. The row goes to brasilapi.*.
import type pg from 'pg';
import { registrar } from './carga/lib.ts';
import { baixar, readRaw } from './lib/baixar.ts';

const CACHE_DIAS = 30;
const base = () => process.env.BRASILAPI_URL ?? 'https://brasilapi.com.br/api';
const fonte = 'brasilapi';

/** The answer for `nome` (cep_X.json, cnpj_X.json): from the raw files when recent, else from the network. null = 404. */
async function resposta(db: pg.ClientBase, nome: string, url: string): Promise<{ dados: any; arquivo: number } | null> {
  const r = await db.query(
    `SELECT id, chave FROM bruto.arquivo WHERE fonte = $1 AND chave LIKE $2 AND baixado_em > now() - make_interval(days => $3)
     ORDER BY baixado_em DESC LIMIT 1`,
    [fonte, `%Z\\_${nome}`, CACHE_DIAS],
  );
  if (r.rows.length) return { dados: JSON.parse(await readRaw(r.rows[0].chave)), arquivo: Number(r.rows[0].id) };
  try {
    const b = await baixar({ fonte, coletor: 'brasilapi', nome, url });
    return { dados: JSON.parse(await readRaw(b.chave)), arquivo: await registrar(db, b) };
  } catch (e) {
    if (/HTTP 404/.test(String(e))) return null;
    throw e;
  }
}

const digitos = (v: string, n: number, nome: string) => {
  const d = v.replace(/\D/g, '');
  if (d.length !== n) throw new Error(`${nome} inválido: ${v}`);
  return d;
};
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

export type Cep = {
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ibge: number | null;
  servico: string | null;
  lat: number | null;
  lon: number | null;
};

export async function consultarCep(db: pg.ClientBase, valor: string): Promise<Cep | null> {
  const cep = digitos(valor, 8, 'CEP');
  const r = await resposta(db, `cep_${cep}.json`, `${base()}/cep/v2/${cep}`);
  if (!r) return null;
  const d = r.dados;
  const c: Cep = {
    cep,
    logradouro: d.street || null,
    bairro: d.neighborhood || null,
    cidade: d.city || null,
    uf: d.state || null,
    ibge: num(d.ibge?.city),
    servico: d.service || null,
    lat: num(d.location?.coordinates?.latitude),
    lon: num(d.location?.coordinates?.longitude),
  };
  await db.query(
    `INSERT INTO brasilapi.cep (cep, logradouro, bairro, cidade, uf, ibge, servico, lat, lon, geom, arquivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $8::float8 IS NOT NULL THEN ST_SetSRID(ST_Point($9, $8), 4326) END, $10)
     ON CONFLICT (cep) DO UPDATE SET logradouro = excluded.logradouro, bairro = excluded.bairro, cidade = excluded.cidade, uf = excluded.uf,
       ibge = excluded.ibge, servico = excluded.servico, lat = excluded.lat, lon = excluded.lon, geom = excluded.geom, arquivo = excluded.arquivo`,
    [c.cep, c.logradouro, c.bairro, c.cidade, c.uf, c.ibge, c.servico, c.lat, c.lon, r.arquivo],
  );
  return c;
}

export type Cnpj = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao: string | null;
  cnae: number | null;
  cnae_descricao: string | null;
  municipio_ibge: number | null;
  uf: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
};

export async function consultarCnpj(db: pg.ClientBase, valor: string): Promise<Cnpj | null> {
  const cnpj = digitos(valor, 14, 'CNPJ');
  const r = await resposta(db, `cnpj_${cnpj}.json`, `${base()}/cnpj/v1/${cnpj}`);
  if (!r) return null;
  const d = r.dados;
  const c: Cnpj = {
    cnpj,
    razao_social: d.razao_social,
    nome_fantasia: d.nome_fantasia || null,
    situacao: d.descricao_situacao_cadastral || null,
    cnae: num(d.cnae_fiscal),
    cnae_descricao: d.cnae_fiscal_descricao || null,
    municipio_ibge: num(d.codigo_municipio_ibge),
    uf: d.uf || null,
    cep: d.cep || null,
    logradouro: d.logradouro || null,
    numero: d.numero || null,
    bairro: d.bairro || null,
  };
  const cols = Object.keys(c);
  await db.query(
    `INSERT INTO brasilapi.cnpj (${cols.join(', ')}, dados, arquivo) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, $${cols.length + 2})
     ON CONFLICT (cnpj) DO UPDATE SET ${[...cols.slice(1), 'dados', 'arquivo'].map((k) => `${k} = excluded.${k}`).join(', ')}`,
    [...Object.values(c), d, r.arquivo],
  );
  return c;
}
