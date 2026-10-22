// ANA load (#29): the two XML answers of the old web service (historical series, telemetry) and the GeoJSON of the
// hydrography services. The XML is flat (one element per row, one tag per field), so a regex is enough.
import type pg from 'pg';
import { RMM_BBOX as B } from '../regiao.ts';
import { loadOnce } from './lib.ts';

const linhas = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);
const campo = (bloco: string, nome: string) => bloco.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1].trim() || null;
const num = (v: string | null) => (v === null ? null : Number(v));

export type Cota = { estacao: number; dia: string; consistido: boolean; cota_cm: number; status: number | null };

/** HidroSerieHistorica (tipoDados=1): one row per month with Cota01..Cota31 → one row per day with a value. */
export function parseSerieHistorica(xml: string): Cota[] {
  // A month can come three times per level: the daily mean (MediaDiaria=1) and the 7h and 17h readings. One per month and level:
  // the mean, else the earliest reading.
  const meses = new Map<string, string>();
  for (const b of linhas(xml, 'SerieHistorica')) {
    const k = `${campo(b, 'DataHora')!.slice(0, 7)}|${campo(b, 'NivelConsistencia')}`;
    const atual = meses.get(k);
    const melhor = (x: string) => [campo(x, 'MediaDiaria') === '1' ? 0 : 1, campo(x, 'DataHora')!].join(' ');
    if (!atual || melhor(b) < melhor(atual)) meses.set(k, b);
  }
  return [...meses.values()].flatMap((b) => {
    const mes = campo(b, 'DataHora')!.slice(0, 8); // "YYYY-MM-"
    const base = { estacao: Number(campo(b, 'EstacaoCodigo')), consistido: campo(b, 'NivelConsistencia') === '2' };
    return Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).flatMap((d) => {
      const v = campo(b, `Cota${d}`);
      return v === null ? [] : [{ ...base, dia: mes + d, cota_cm: Number(v), status: num(campo(b, `Cota${d}Status`)) }];
    });
  });
}

export type Leitura = { estacao: number; hora: string; nivel_cm: number | null; chuva_mm: number | null };

/** DadosHidrometeorologicos: DataHora is Brasília time. shortcut: fixed UTC−3, but readings of 2015–2019 may follow the old summer time; check against the Porto table if those years matter. */
export function parseTelemetria(xml: string): Leitura[] {
  const vistas = new Set<string>();
  return linhas(xml, 'DadosHidrometereologicos').flatMap((b) => {
    const hora = campo(b, 'DataHora')!;
    if (vistas.has(hora)) return []; // the service repeats some readings
    vistas.add(hora);
    return [
      {
        estacao: Number(campo(b, 'CodEstacao')),
        hora: new Date(`${hora.replace(' ', 'T')}-03:00`).toISOString(),
        nivel_cm: num(campo(b, 'Nivel')),
        chuva_mm: num(campo(b, 'Chuva')),
      },
    ];
  });
}

export function loadCotas(db: pg.ClientBase, arquivo: number, rows: Cota[]): Promise<number> {
  return loadOnce(db, arquivo, 'ana.cota_diaria', async () => {
    for (let i = 0; i < rows.length; i += 5000) {
      const b = rows.slice(i, i + 5000);
      await db.query(
        `INSERT INTO ana.cota_diaria (estacao, dia, consistido, cota_cm, status, arquivo)
         SELECT *, $6 FROM unnest($1::int[], $2::date[], $3::bool[], $4::real[], $5::smallint[])
         ON CONFLICT (estacao, dia, consistido) DO UPDATE SET cota_cm = excluded.cota_cm, status = excluded.status, arquivo = excluded.arquivo`,
        [
          b.map((r) => r.estacao),
          b.map((r) => r.dia),
          b.map((r) => r.consistido),
          b.map((r) => r.cota_cm),
          b.map((r) => r.status),
          arquivo,
        ],
      );
    }
    return rows.length;
  });
}

export function loadLeituras(db: pg.ClientBase, arquivo: number, rows: Leitura[]): Promise<number> {
  return loadOnce(db, arquivo, 'ana.leitura', async () => {
    for (let i = 0; i < rows.length; i += 5000) {
      const b = rows.slice(i, i + 5000);
      await db.query(
        `INSERT INTO ana.leitura (estacao, hora, nivel_cm, chuva_mm, arquivo)
         SELECT *, $5 FROM unnest($1::int[], $2::timestamptz[], $3::real[], $4::real[])
         ON CONFLICT (estacao, hora) DO UPDATE SET nivel_cm = excluded.nivel_cm, chuva_mm = excluded.chuva_mm, arquivo = excluded.arquivo`,
        [b.map((r) => r.estacao), b.map((r) => r.hora), b.map((r) => r.nivel_cm), b.map((r) => r.chuva_mm), arquivo],
      );
    }
    return rows.length;
  });
}

type Feature = { id: number; geometry: object; properties: Record<string, any> };
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const trechoRow = (f: Feature) => ({
  id: Number(f.properties.COTRECHO),
  nome: texto(f.properties.NORIOCOMP) ?? texto(f.properties.NOORIGINAL),
  cobacia: texto(f.properties.COBACIA),
  strahler: f.properties.NUSTRAHLER ?? null,
  dominialidade: texto(f.properties.DEDOMINIAL),
  comprimento_km: f.properties.NUCOMPTREC ?? null,
  geom: f.geometry,
});

export const massaRow = (f: Feature) => ({
  id: Number(f.id),
  nome: texto(f.properties.nmoriginal),
  tipo: texto(f.properties.detipomass),
  dominialidade: texto(f.properties.dedominial),
  area_km2: f.properties.nuareakm2 ?? null,
  geom: f.geometry,
});

/** Inserts features (ON CONFLICT DO NOTHING), geometry cut to the metropolitan region box. */
export function loadHidro(
  db: pg.ClientBase,
  arquivo: number,
  tabela: 'ana.trecho' | 'ana.massa_dagua',
  rows: (ReturnType<typeof trechoRow> | ReturnType<typeof massaRow>)[],
): Promise<number> {
  const caixa = `ST_MakeEnvelope(${B.oeste}, ${B.sul}, ${B.leste}, ${B.norte}, 4326)`;
  // Lines: ST_ClipByBox2D, because ST_Intersection of a horizontal line with a box comes out empty in GEOS 3.9 (the slice).
  const corte =
    tabela === 'ana.trecho'
      ? (g: string) => `ST_CollectionExtract(ST_ClipByBox2D(${g}, ${caixa}), 2)`
      : (g: string) => `ST_CollectionExtract(ST_Intersection(ST_MakeValid(${g}), ${caixa}), 3)`;
  return loadOnce(db, arquivo, tabela, async () => {
    for (const r of rows) {
      const { geom, ...cols } = r;
      const nomes = Object.keys(cols);
      await db.query(
        `INSERT INTO ${tabela} (${nomes.join(', ')}, geom, arquivo)
         SELECT ${nomes.map((_, i) => `$${i + 1}`).join(', ')}, g, $${nomes.length + 2}
         FROM (SELECT ST_Multi(${corte(`ST_SetSRID(ST_GeomFromGeoJSON($${nomes.length + 1}), 4326)`)}) AS g) x
         WHERE NOT ST_IsEmpty(g)
         ON CONFLICT (id) DO NOTHING`,
        [...Object.values(cols), JSON.stringify(geom), arquivo],
      );
    }
    return rows.length;
  });
}
