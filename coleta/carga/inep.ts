// INEP Censo Escolar load (#111): one line of microdados_ed_basica (";", latin1) → one row of inep.escola, and the
// point of the school matched to the CNEFE (the INEP file has only the address).
import type pg from 'pg';
import { loadOnce } from './lib.ts';

const REDE: Record<string, string> = { '1': 'federal', '2': 'estadual', '3': 'municipal', '4': 'privada' };
const SITUACAO: Record<string, string> = { '1': 'em atividade', '2': 'paralisada', '3': 'extinta', '4': 'extinta no ano anterior' };
const LOCALIZACAO: Record<string, string> = { '1': 'urbana', '2': 'rural' };
const CONTAGENS = {
  salas: 'QT_SALAS_UTILIZADAS',
  salas_climatizadas: 'QT_SALAS_UTILIZA_CLIMATIZADAS',
  mat_total: 'QT_MAT_BAS',
  mat_creche: 'QT_MAT_INF_CRE',
  mat_pre: 'QT_MAT_INF_PRE',
  mat_fund_ai: 'QT_MAT_FUND_AI',
  mat_fund_af: 'QT_MAT_FUND_AF',
  mat_medio: 'QT_MAT_MED',
  mat_0_3: 'QT_MAT_BAS_0_3',
  mat_4_5: 'QT_MAT_BAS_4_5',
  mat_6_10: 'QT_MAT_BAS_6_10',
  mat_11_14: 'QT_MAT_BAS_11_14',
  mat_15_17: 'QT_MAT_BAS_15_17',
  mat_18_mais: 'QT_MAT_BAS_18_MAIS',
} as const;

export type Escola = {
  codigo: number;
  ano: number;
  nome: string;
  rede: string;
  situacao: string;
  localizacao: string;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
} & Record<keyof typeof CONTAGENS, number | null>;

const text = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/** Parses one Censo Escolar line given the header columns. */
export function parseEscola(header: string[], line: string): Escola {
  const c = line.split(';');
  const get = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`coluna ${name} não está no arquivo`);
    return c[i];
  };
  const codigo = (mapa: Record<string, string>, col: string) => {
    const v = mapa[get(col)];
    if (!v) throw new Error(`${col} desconhecido: ${get(col)}`);
    return v;
  };
  const contagens = Object.fromEntries(
    Object.entries(CONTAGENS).map(([k, col]) => [k, text(get(col)) === null ? null : Number(get(col))]),
  ) as Record<keyof typeof CONTAGENS, number | null>;
  return {
    codigo: Number(get('CO_ENTIDADE')),
    ano: Number(get('NU_ANO_CENSO')),
    nome: get('NO_ENTIDADE').trim(),
    rede: codigo(REDE, 'TP_DEPENDENCIA'),
    situacao: codigo(SITUACAO, 'TP_SITUACAO_FUNCIONAMENTO'),
    localizacao: codigo(LOCALIZACAO, 'TP_LOCALIZACAO'),
    endereco: text(get('DS_ENDERECO')),
    numero: text(get('NU_ENDERECO')),
    bairro: text(get('NO_BAIRRO')),
    cep: text(get('CO_CEP')),
    ...contagens,
  };
}

// Words that say the kind of school, not which one.
const TIPO = new Set(
  'ESCOLA ESCOLAS UNIDADE ESTADUAL MUNICIPAL CENTRO EDUCACIONAL EDUCACAO EDUC ESPECIAL EETI CMEI CETI PROF PROFA PROFESSOR PROFESSORA ENSINO INFANTIL FUNDAMENTAL MEDIO CRECHE COLEGIO INSTITUTO DOS DAS'.split(
    ' ',
  ),
);

/** The words of a school name that identify it: upper case, no accents, no kind-of-school words, 3 letters or more. */
export function palavras(nome: string): Set<string> {
  const limpo = nome
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ');
  return new Set(limpo.split(' ').filter((p) => p.length > 2 && !TIPO.has(p)));
}

export type Ensino = { id: number; cep: string | null; numero: number | null; nome: string; lat: number; lon: number };
export type Ponto = { lat: number; lon: number; origem: 'cep-numero' | 'cep-nome' | 'nome-cidade' | 'centro-cep'; cnefe: number | null };

const contem = (grande: Set<string>, pequeno: Set<string>) => pequeno.size > 0 && [...pequeno].every((p) => grande.has(p));
/** One name inside the other: every school word in the CNEFE name, or every CNEFE word (2 or more) in the school name. */
const parecido = (cnefe: Set<string>, escola: Set<string>) => contem(cnefe, escola) || (cnefe.size >= 2 && contem(escola, cnefe));
const ponto = (e: Ensino, origem: Ponto['origem']): Ponto => ({ lat: e.lat, lon: e.lon, origem, cnefe: e.id });

/** Distance in km, flat approximation (fine at city scale near the equator). */
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  111.2 * Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180));

/**
 * Matcher of a school to a point, rules in order, each one only with a single candidate: CNEFE school (especie 4) at
 * the same CEP and number; at the same CEP with a similar name (`parecido`); the only one in the city with a similar name
 * (school name of 2 words or more), and not more than 2 km from the centre of the declared CEP when that CEP is known; centre of the CEP's CNEFE
 * addresses when they fit in 1 km. `ceps`: centre and spread (km) of the addresses of each CEP.
 */
export function casador(ensino: Ensino[], ceps: Map<string, { lat: number; lon: number; km: number }>) {
  const nomes = ensino.map((e) => ({ e, p: palavras(e.nome) }));
  const unico = <T>(xs: T[]) => (xs.length === 1 ? xs[0] : undefined);
  return (escola: { nome: string; cep: string | null; numero: string | null }): Ponto | null => {
    const numero = escola.numero && /^\d+$/.test(escola.numero) ? Number(escola.numero) : null;
    const p = palavras(escola.nome);
    const cep = escola.cep ? ceps.get(escola.cep) : undefined;
    const noCep = nomes.filter((x) => x.e.cep === escola.cep);
    const mesmoNumero = numero ? unico(noCep.filter((x) => x.e.numero === numero)) : undefined;
    if (mesmoNumero) return ponto(mesmoNumero.e, 'cep-numero');
    const mesmoNome = unico(noCep.filter((x) => parecido(x.p, p)));
    if (mesmoNome) return ponto(mesmoNome.e, 'cep-nome');
    const naCidade = p.size >= 2 ? unico(nomes.filter((x) => parecido(x.p, p))) : undefined;
    if (naCidade && (!cep || km(naCidade.e, cep) <= 2)) return ponto(naCidade.e, 'nome-cidade');
    return cep && cep.km <= 1 ? { lat: cep.lat, lon: cep.lon, origem: 'centro-cep', cnefe: null } : null;
  };
}

/** Loads the schools of one raw file (once), replacing a school already there. */
export async function loadEscolas(db: pg.ClientBase, arquivo: number, escolas: (Escola & { ponto: Ponto | null })[]): Promise<number> {
  if (!escolas.length) return 0;
  const linhas = escolas.map(({ ponto: pt, ...e }) => ({
    ...e,
    ponto_origem: pt?.origem ?? null,
    cnefe_id: pt?.cnefe ?? null,
    lat: pt?.lat,
    lon: pt?.lon,
  }));
  const colunas = Object.keys(linhas[0]).filter((k) => k !== 'lat' && k !== 'lon');
  const tipos: Record<string, string> = { codigo: 'int', ano: 'smallint', cnefe_id: 'bigint', cep: 'text' };
  const tipo = (k: string) => tipos[k] ?? (k in CONTAGENS ? 'int' : 'text');
  const ja = await db.query("SELECT 1 FROM bruto.carga WHERE arquivo = $1 AND tabela = 'inep.escola'", [arquivo]);
  if (ja.rowCount) return 0;
  return loadOnce(db, arquivo, 'inep.escola', async () => {
    const r = await db.query(
      `INSERT INTO inep.escola (${colunas.join(', ')}, geom, arquivo)
       SELECT ${colunas.join(', ')}, CASE WHEN lat IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lon, lat), 4326) END, $2
       FROM jsonb_to_recordset($1) AS x(${colunas.map((k) => `${k} ${tipo(k)}`).join(', ')}, lat float8, lon float8)
       ON CONFLICT (codigo) DO UPDATE SET ${[...colunas.filter((k) => k !== 'codigo'), 'geom', 'arquivo'].map((k) => `${k} = excluded.${k}`).join(', ')}`,
      [JSON.stringify(linhas), arquivo],
    );
    return r.rowCount ?? 0;
  });
}
