// CNES load (#112): the monthly ST file of the AM (.dbc) gives the universe of Manaus establishments with type and
// management; the name and the point come from the CNES API, joined by CNES code (the ST file has no name nor coordinates).
import type pg from 'pg';
import { loadOnce } from './lib.ts';

export const MANAUS = '130260'; // CODUFMUN: IBGE code with 6 digits
const GESTAO: Record<string, string> = { M: 'municipal', E: 'estadual', D: 'dupla' };

export type St = {
  codigo: number;
  competencia: string;
  tipo: string;
  gestao: string;
  publico: boolean;
  nat_jur: string;
  cep: string | null;
};

/** One record of STAMaamm.dbc → one establishment, or null when it is not in Manaus. */
export function parseSt(r: Record<string, unknown>): St | null {
  if (r.CODUFMUN !== MANAUS) return null;
  const gestao = GESTAO[r.TPGESTAO as string];
  if (!gestao) throw new Error(`TPGESTAO desconhecido: ${r.TPGESTAO} (CNES ${r.CNES})`);
  const comp = String(r.COMPETEN);
  const natJur = String(r.NAT_JUR ?? '');
  return {
    codigo: Number(r.CNES),
    competencia: `${comp.slice(0, 4)}-${comp.slice(4, 6)}`,
    tipo: String(r.TP_UNID),
    gestao,
    publico: natJur.startsWith('1'), // legal nature 1xxx = public administration
    nat_jur: natJur,
    cep: (r.COD_CEP as string | null) ?? null,
  };
}

export type Api = {
  codigo: number;
  nome: string;
  tipo: number;
  gestao: string;
  cep: string | null;
  lat: number | null;
  lon: number | null;
  atualizado: string;
};

const coord = (v: unknown) => (typeof v === 'number' && v !== 0 ? v : null);

/** API establishments → the cut kept in the raw files: no phone, e-mail or CNPJ; zero coordinates are null. */
export function cortarApi(xs: Record<string, unknown>[]): Api[] {
  return xs.map((x) => {
    const lat = coord(x.latitude_estabelecimento_decimo_grau);
    const lon = coord(x.longitude_estabelecimento_decimo_grau);
    return {
      codigo: Number(x.codigo_cnes),
      nome: String(x.nome_fantasia),
      tipo: Number(x.codigo_tipo_unidade),
      gestao: String(x.tipo_gestao),
      cep: (x.codigo_cep_estabelecimento as string | null) ?? null,
      lat: lat === null || lon === null ? null : lat,
      lon: lat === null || lon === null ? null : lon,
      atualizado: String(x.data_atualizacao),
    };
  });
}

export type Linha = St & { nome: string | null; lat: number | null; lon: number | null };

/** The ST establishments with name and point from the API (null when the API does not have the code). */
export function juntar(st: St[], api: Api[]): Linha[] {
  const porCodigo = new Map(api.map((a) => [a.codigo, a]));
  return st.map((s) => {
    const a = porCodigo.get(s.codigo);
    return { ...s, nome: a?.nome ?? null, lat: a?.lat ?? null, lon: a?.lon ?? null };
  });
}

/**
 * Replaces cnes.estabelecimento with the establishments of one ST file (once per file). `pontos`: raw file of the API cut.
 * A point outside the Manaus municipality is dropped (geocode of the CNES is declared, sometimes the state capital default).
 */
export async function loadEstabelecimentos(db: pg.ClientBase, arquivo: number, pontos: number, linhas: Linha[]): Promise<number> {
  const ja = await db.query("SELECT 1 FROM bruto.carga WHERE arquivo = $1 AND tabela = 'cnes.estabelecimento'", [arquivo]);
  if (ja.rowCount) return 0;
  return loadOnce(db, arquivo, 'cnes.estabelecimento', async () => {
    await db.query('DELETE FROM cnes.estabelecimento');
    const r = await db.query(
      `INSERT INTO cnes.estabelecimento (codigo, competencia, nome, tipo, gestao, publico, nat_jur, cep, geom, arquivo, arquivo_ponto)
       SELECT x.codigo, x.competencia, x.nome, x.tipo, x.gestao, x.publico, x.nat_jur, x.cep,
         CASE WHEN ST_Intersects(m.geom, ST_SetSRID(ST_MakePoint(x.lon, x.lat), 4326)) THEN ST_SetSRID(ST_MakePoint(x.lon, x.lat), 4326) END,
         $2, $3
       FROM jsonb_to_recordset($1) AS x(codigo int, competencia text, nome text, tipo text, gestao text, publico boolean,
         nat_jur text, cep text, lat float8, lon float8)
       LEFT JOIN ibge.municipio m ON m.codigo = 1302603`,
      [JSON.stringify(linhas), arquivo, pontos],
    );
    return r.rowCount ?? 0;
  });
}
