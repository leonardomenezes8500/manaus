// CNEFE 2022 load (#22): one CSV line (";" separated) → one row of ibge.cnefe_endereco.
import type pg from 'pg';
import { loadOnce } from './lib.ts';

export type Address = {
  id: number;
  especie: number;
  setor: string;
  municipio: number;
  quadra: number | null;
  face: number | null;
  cep: string | null;
  localidade: string | null;
  logradouro: string | null;
  numero: number | null;
  modificador: string | null;
  complemento: string | null;
  estabelecimento: string | null;
  tipo_edificacao: number | null;
  nivel_coord: number;
  lat: number;
  lon: number;
};

const text = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const int = (v: string | undefined) => (v && v.trim() ? Number.parseInt(v, 10) : null);

/** Parses one CNEFE line given the header columns. */
export function parseAddress(header: string[], line: string): Address {
  const c = line.split(';');
  const get = (name: string) => c[header.indexOf(name)];
  const pairs = [1, 2, 3, 4, 5]
    .map((i) => [text(get(`NOM_COMP_ELEM${i}`)), text(get(`VAL_COMP_ELEM${i}`))].filter(Boolean).join(' '))
    .filter(Boolean);
  return {
    id: Number(get('COD_UNICO_ENDERECO')),
    especie: Number(get('COD_ESPECIE')),
    setor: get('COD_SETOR').slice(0, 15),
    municipio: Number(get('COD_MUNICIPIO')),
    quadra: int(get('NUM_QUADRA')),
    face: int(get('NUM_FACE')),
    cep: text(get('CEP')),
    localidade: text(get('DSC_LOCALIDADE')),
    logradouro: [get('NOM_TIPO_SEGLOGR'), get('NOM_TITULO_SEGLOGR'), get('NOM_SEGLOGR')].map(text).filter(Boolean).join(' ') || null,
    numero: int(get('NUM_ENDERECO')),
    modificador: text(get('DSC_MODIFICADOR')),
    complemento: pairs.join(' ') || null,
    estabelecimento: text(get('DSC_ESTABELECIMENTO')),
    tipo_edificacao: int(get('COD_TIPO_ESPECI')),
    nivel_coord: Number(get('NV_GEO_COORD')),
    lat: Number(get('LATITUDE')),
    lon: Number(get('LONGITUDE')),
  };
}

const COLUMNS = [
  'id',
  'especie',
  'setor',
  'municipio',
  'quadra',
  'face',
  'cep',
  'localidade',
  'logradouro',
  'numero',
  'modificador',
  'complemento',
  'estabelecimento',
  'tipo_edificacao',
  'nivel_coord',
  'lat',
  'lon',
] as const;
const TYPES = [
  'bigint',
  'smallint',
  'text',
  'int',
  'int',
  'int',
  'text',
  'text',
  'text',
  'int',
  'text',
  'text',
  'text',
  'smallint',
  'smallint',
  'float8',
  'float8',
];

/** Inserts addresses in batches (ON CONFLICT DO NOTHING) and marks the file loaded, all in one transaction. */
export async function loadAddresses(db: pg.ClientBase, arquivo: number, rows: AsyncIterable<Address>): Promise<number> {
  return loadOnce(db, arquivo, 'ibge.cnefe_endereco', async () => {
    let n = 0;
    let batch: Address[] = [];
    const flush = async () => {
      await db.query(
        `INSERT INTO ibge.cnefe_endereco (${COLUMNS.join(', ')}, geom, arquivo)
         SELECT ${COLUMNS.map((c) => `u.${c}`).join(', ')}, ST_SetSRID(ST_Point(u.lon, u.lat), 4326), $${COLUMNS.length + 1}
         FROM unnest(${COLUMNS.map((_, i) => `$${i + 1}::${TYPES[i]}[]`).join(', ')}) AS u(${COLUMNS.join(', ')})
         ON CONFLICT DO NOTHING`,
        [...COLUMNS.map((c) => batch.map((r) => r[c])), arquivo],
      );
      n += batch.length;
      batch = [];
    };
    for await (const r of rows) {
      batch.push(r);
      if (batch.length === 5000) await flush();
    }
    if (batch.length) await flush();
    return n;
  });
}
