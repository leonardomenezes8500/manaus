// INPE DETER (#74): deforestation alerts of the smoke region from the TerraBrasilis WFS, through baixar() (gzip pages
// of 2000), then the image-date window of inpe_desmatamento.deter replaced in one transaction.
//   node coleta/deter.ts            weekly, slice cron: alerts with an image date in the last 90 days
//   node coleta/deter.ts --history  this PC: every alert in the box (~350 thousand, since 2016)
// shortcut: an alert INPE deletes or edits after its 90 days stays as it was; redo --history once a year (after August).
import pg from 'pg';
import { registrar } from './carga/lib.ts';
import { baixar, readRaw } from './lib/baixar.ts';
import { tentar } from './lib/tentar.ts';
import { BBOX as B } from './regiao.ts';

const WFS =
  'https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/ows?service=WFS&version=2.0.0&request=GetFeature' +
  '&typeNames=deter-amz:deter_amz&outputFormat=application/json&srsName=EPSG:4326&sortBy=gid,view_date,classname,mun_geocod,areamunkm'; // gid alone is not unique: a stable order for the pages
const POR_PAGINA = 2000;

/** CQL filter: the box (lat,lon in WFS 2.0 with EPSG:4326) and, in the weekly run, the first image date. */
export function filtro(desde?: string): string {
  const caixa = `BBOX(geom,${B.sul},${B.oeste},${B.norte},${B.leste})`;
  return desde ? `${caixa} AND view_date >= '${desde}'` : caixa;
}

type Feature = { geometry: object; properties: Record<string, string | number | null> };

/** One WFS page → rows. */
export function lerPagina(json: { features: Feature[] }) {
  return json.features.map(({ properties: p, geometry }) => ({
    gid: String(p.gid),
    classe: String(p.classname),
    view_date: String(p.view_date),
    publish_month: (p.publish_month as string) ?? null,
    sensor: (p.sensor as string) ?? null,
    satelite: (p.satellite as string) ?? null,
    uf: (p.uf as string) ?? null,
    mun_geocod: p.mun_geocod ? Number(p.mun_geocod) : null,
    area_km2: (p.areamunkm as number) ?? null,
    uc: (p.uc as string) ?? null,
    geom: JSON.stringify(geometry),
  }));
}

/**
 * Replaces the window in one transaction: every alert with an image date from `desde` on (or all of them) goes away and
 * the pages come in. The gid is not unique and changes from _curr to _hist, so a window replace is what never counts an
 * alert twice.
 */
export async function gravar(
  db: pg.ClientBase,
  paginas: { linhas: ReturnType<typeof lerPagina>; arquivo: number }[],
  desde?: string,
): Promise<number> {
  await db.query('BEGIN');
  try {
    await db.query("DELETE FROM inpe_desmatamento.deter WHERE view_date >= coalesce($1::date, '-infinity')", [desde ?? null]);
    let n = 0;
    for (const { linhas, arquivo } of paginas) {
      const r = await db.query(
        `INSERT INTO inpe_desmatamento.deter (gid, classe, view_date, publish_month, sensor, satelite, uf, mun_geocod, area_km2, uc, geom, arquivo)
         SELECT gid, classe, view_date, publish_month, sensor, satelite, uf, mun_geocod, area_km2, uc,
                ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geom), 4326)), 3)), $2
         FROM json_to_recordset($1::json)
           AS r(gid text, classe text, view_date date, publish_month date, sensor text, satelite text, uf text, mun_geocod int,
                area_km2 float8, uc text, geom text)`,
        [JSON.stringify(linhas), arquivo],
      );
      n += r.rowCount ?? 0;
    }
    await db.query('COMMIT');
    return n;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

async function principal(args: string[]) {
  const historico = args.includes('--history');
  const desde = historico ? undefined : new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const cql = encodeURIComponent(filtro(desde));
  const db = new pg.Client();
  await db.connect();
  try {
    const paginas = [];
    let total = 0;
    for (let inicio = 0; inicio === 0 || inicio < total; inicio += POR_PAGINA) {
      const url = `${WFS}&count=${POR_PAGINA}&startIndex=${inicio}&CQL_FILTER=${cql}`;
      const nome = `deter_${desde ?? 'historico'}_${String(inicio).padStart(6, '0')}.geojson`;
      const b = await tentar(() => baixar({ fonte: 'inpe-deter', coletor: 'deter', nome, url, gzip: true }));
      const json = JSON.parse(await readRaw(b.chave));
      total = json.numberMatched;
      paginas.push({ linhas: lerPagina(json), arquivo: await registrar(db, b) });
    }
    const vieram = paginas.reduce((n, p) => n + p.linhas.length, 0);
    if (vieram !== total) throw new Error(`DETER: o WFS disse ${total} alertas e vieram ${vieram}`); // pages shifted while paging
    const n = await gravar(db, paginas, desde);
    console.log(`inpe_desmatamento.deter: ${n} alertas ${desde ? `desde ${desde}` : 'no histórico'}`);
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
