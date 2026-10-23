// ANEEL (#68): power outages per group of consumers (DEC/FEC, monthly) of the AM distributor and its residential
// tariff. This PC, by hand, monthly (the files are regenerated around day 5):
//   node coleta/aneel.ts            needs the duckdb command line (the files are parquet)
// The distributor is found by CNPJ (its name changed: AME, Âmbar Amazonas). Manaus = the groups (conjuntos) whose only
// municipality is Manaus in the ANEEL map; the groups were redrawn in 2025, so Manaus is compared as one weighted total.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { splitCsv } from './carga/csv.ts';
import { registrar } from './carga/lib.ts';
import { baixar, type Baixado } from './lib/baixar.ts';

const D = 'https://dadosabertos.aneel.gov.br/dataset';
const CONT = `${D}/d5f0712e-62f6-4736-8dff-9991f10758a7/resource`;
const ARQUIVOS = {
  dec2010: `${CONT}/1706a88f-ecd6-4de9-99ee-ec240c317378/download/indicadores-continuidade-coletivos-2010-2019.parquet`,
  dec2020: `${CONT}/d7f70fb1-725c-4748-afeb-65c6a78df550/download/indicadores-continuidade-coletivos-2020-2029.parquet`,
  mapa: `${D}/db9c9f60-b3b5-4504-9dfe-2637922d53ce/resource/3f841488-80a8-42f2-a6ca-e0c593b228de/download/indqual-municipio.csv`,
  tarifa: `${D}/5a583f3e-1646-4f67-bf0f-69db4203e89e/resource/9af99ef4-376a-4493-a075-5e48ab4da51b/download/tarifas-homologadas-distribuidoras-energia-eletrica.parquet`,
};
const CNPJ = 2341467000120; // Amazonas Energia / Âmbar Amazonas
const MANAUS = 1302603;
// The parts of the DEC, disjoint: internal or external, planned or not, critical day, emergency, rationing. Since 2022
// the official DEC counts only the internal ones (DECIP + DECIND); the sum of all of them is what the household felt.
export const PARTES = ['DECIP', 'DECIPC', 'DECIND', 'DECINC', 'DECINE', 'DECINO', 'DECXP', 'DECXPC', 'DECXN', 'DECXNC'];

type Linha = { conjunto: number; ano: number; mes: number; indicador: string; valor: number };

/**
 * Monthly Manaus total, each group weighted by its number of consumers (NumCon). Only groups wholly in Manaus.
 * DERIVED: dec_partes is the sum of the parts, not an ANEEL figure.
 */
export function decManaus(linhas: Linha[], soManaus: Set<number>) {
  const por = new Map<string, Map<number, Record<string, number>>>();
  for (const l of linhas) {
    if (!soManaus.has(l.conjunto)) continue;
    const k = `${l.ano}-${String(l.mes).padStart(2, '0')}`;
    const m = por.get(k) ?? new Map();
    m.set(l.conjunto, { ...(m.get(l.conjunto) ?? {}), [l.indicador]: l.valor });
    por.set(k, m);
  }
  return [...por.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([mes, conj]) => {
      const c = [...conj.values()].filter((x) => x.NumCon > 0 && x.DEC !== undefined);
      const n = c.reduce((a, x) => a + x.NumCon, 0);
      if (!n) return [];
      const media = (f: (x: Record<string, number>) => number) => c.reduce((a, x) => a + f(x) * x.NumCon, 0) / n;
      return [
        {
          mes: `${mes}-01`,
          dec: media((x) => x.DEC),
          dec_partes: media((x) => PARTES.reduce((a, p) => a + (x[p] ?? 0), 0)),
          fec: media((x) => x.FEC ?? 0),
          consumidores: n,
          conjuntos: c.length,
        },
      ];
    });
}

/** ANEEL municipality map (latin1, ';') → the groups whose municipalities are all Manaus. */
export function conjuntosSoManaus(csv: string): Set<number> {
  const muns = new Map<number, Set<number>>();
  for (const l of csv.split(/\r?\n/).slice(1).filter(Boolean)) {
    const v = splitCsv(l, ';');
    const c = Number(v[1]);
    muns.set(c, (muns.get(c) ?? new Set()).add(Number(v[2])));
  }
  return new Set([...muns].filter(([, m]) => m.size === 1 && m.has(MANAUS)).map(([c]) => c));
}

const duckdb = (sql: string) =>
  execFileSync('duckdb', ['-csv', '-c', sql], { encoding: 'utf8', maxBuffer: 1 << 30 })
    .split('\n')
    .slice(1)
    .filter(Boolean)
    .map((l) => splitCsv(l));

async function principal() {
  const db = new pg.Client();
  await db.connect();
  try {
    const b: Record<string, Baixado & { id: number }> = {};
    for (const [k, url] of Object.entries(ARQUIVOS)) {
      const x = await baixar({ fonte: 'aneel-dados-abertos', coletor: 'aneel', nome: url.split('/').pop()!, url });
      b[k] = { ...x, id: await registrar(db, x) };
      console.log(x.chave, x.bytes);
    }
    await db.query('BEGIN');
    const linhas: Linha[] = [];
    for (const k of ['dec2010', 'dec2020']) {
      const r = duckdb(`SELECT IdeConjUndConsumidoras, DscConjUndConsumidoras, AnoIndice, NumPeriodoIndice, SigIndicador, VlrIndiceEnviado
        FROM read_parquet('${b[k].caminho}') WHERE NumCNPJ = ${CNPJ} AND NumPeriodoIndice BETWEEN 1 AND 12`);
      const col = (i: number) => r.map((v) => v[i]);
      await db.query(
        `INSERT INTO aneel.continuidade (conjunto, conjunto_nome, ano, mes, indicador, valor, arquivo)
         SELECT *, $7::bigint FROM unnest($1::int[], $2::text[], $3::int[], $4::int[], $5::text[], $6::float8[])
         ON CONFLICT (conjunto, ano, mes, indicador) DO UPDATE SET conjunto_nome = excluded.conjunto_nome, valor = excluded.valor, arquivo = excluded.arquivo`,
        [col(0), col(1), col(2), col(3), col(4), col(5), b[k].id],
      );
      for (const v of r)
        linhas.push({ conjunto: Number(v[0]), ano: Number(v[2]), mes: Number(v[3]), indicador: v[4], valor: Number(v[5]) });
      console.log(k, r.length, 'linhas');
    }
    const mapa = readFileSync(b.mapa.caminho, 'latin1');
    const soManaus = conjuntosSoManaus(mapa);
    const am = mapa
      .split(/\r?\n/)
      .slice(1)
      .map((l) => splitCsv(l, ';'))
      .filter((v) => v[4] === 'AM');
    await db.query('DELETE FROM aneel.conjunto_municipio');
    await db.query(
      `INSERT INTO aneel.conjunto_municipio (conjunto, municipio, municipio_nome, arquivo)
       SELECT *, $4::bigint FROM unnest($1::int[], $2::int[], $3::text[]) ON CONFLICT DO NOTHING`,
      [am.map((v) => v[1]), am.map((v) => v[2]), am.map((v) => v[3]), b.mapa.id],
    );
    const meses = decManaus(linhas, soManaus);
    await db.query('DELETE FROM aneel.dec_manaus_mes');
    await db.query(
      `INSERT INTO aneel.dec_manaus_mes (mes, dec, dec_partes, fec, consumidores, conjuntos)
       SELECT * FROM unnest($1::date[], $2::float8[], $3::float8[], $4::float8[], $5::int[], $6::int[])`,
      (['mes', 'dec', 'dec_partes', 'fec', 'consumidores', 'conjuntos'] as const).map((k) => meses.map((m) => m[k])),
    );
    const t = duckdb(`SELECT DISTINCT DscREH, DatInicioVigencia, DatFimVigencia, VlrTUSD, VlrTE FROM read_parquet('${b.tarifa.caminho}')
      WHERE NumCNPJDistribuidora = ${CNPJ} AND DscBaseTarifaria = 'Tarifa de Aplicação' AND DscSubGrupo = 'B1'
        AND DscModalidadeTarifaria = 'Convencional' AND DscClasse = 'Residencial' AND DscSubClasse = 'Residencial'
        AND DscDetalhe = 'Não se aplica' AND DscUnidadeTerciaria = 'MWh'`);
    await db.query('DELETE FROM aneel.tarifa_residencial');
    await db.query(
      `INSERT INTO aneel.tarifa_residencial (reh, inicio, fim, tusd, te, arquivo)
       SELECT *, $6::bigint FROM unnest($1::text[], $2::date[], $3::date[], $4::float8[], $5::float8[])`,
      [t.map((v) => v[0]), t.map((v) => v[1]), t.map((v) => v[2]), t.map((v) => v[3]), t.map((v) => v[4]), b.tarifa.id],
    );
    await db.query('COMMIT');
    console.log(`${soManaus.size} conjuntos só de Manaus, ${meses.length} meses, ${t.length} tarifas`);
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
