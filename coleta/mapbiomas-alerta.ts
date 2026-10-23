// MapBiomas Alerta (#82): validated deforestation alerts of the layers box from the public WFS of the platform (no
// token: the token is only for the API), in pages of 2000 through baixar() (gzip), all of them replaced in one
// transaction, page by page (the ~240 thousand geometries never sit in memory together).
//   node coleta/mapbiomas-alerta.ts      this PC, by hand for now (a weekly slice cron, like the DETER, is open)
import pg from 'pg';
import { registrar } from './carga/lib.ts';
import { baixar, readRaw } from './lib/baixar.ts';
import { tentar } from './lib/tentar.ts';
import { BBOX as B } from './regiao.ts';

const WFS = 'https://production.alerta.mapbiomas.org/geoserver/wfs';
const POR_PAGINA = 2000;
const UF: Record<string, string> = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPÁ: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARÁ: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPÍRITO SANTO': 'ES',
  GOIÁS: 'GO',
  MARANHÃO: 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARÁ: 'PA',
  PARAÍBA: 'PB',
  PARANÁ: 'PR',
  PERNAMBUCO: 'PE',
  PIAUÍ: 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDÔNIA: 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SÃO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
};

/** One page of the layer in the layers box (with EPSG:4326 the WFS 2.0 bbox goes lat,lon), in a stable order. */
export function urlPagina(inicio: number): string {
  const q = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'mapbiomas-alertas:dashboard_alerts-shapefile',
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    sortBy: 'CodeAlerta',
    count: String(POR_PAGINA),
    startIndex: String(inicio),
    bbox: `${B.sul},${B.oeste},${B.norte},${B.leste},urn:ogc:def:crs:EPSG::4326`,
  });
  return `${WFS}?${q}`;
}

type Feature = { geometry: object; properties: Record<string, string | number | null> };

/** One WFS page → rows. */
export function lerPagina(json: { features: Feature[] }) {
  return json.features.map(({ properties: p, geometry }) => ({
    codigo: Number(p.CodeAlerta),
    fontes: (p.Fonte as string) ?? null,
    bioma: (p.Bioma as string) ?? null,
    estado: (p.Estado as string) ?? null,
    uf: UF[String(p.Estado ?? '')] ?? null,
    municipio: (p.Municipio as string) ?? null,
    area_ha: (p.AreaHa as number) ?? null,
    ano: (p.AnoDetec as number) ?? null,
    detectado_em: (p.DataDetec as string) ?? null,
    imagem_antes: (p.DtImgAnt as string) ?? null,
    imagem_depois: (p.DtImgDep as string) ?? null,
    publicado_em: (p.PublImg as string) ?? null,
    vetor_pressao: (p.VPressao as string) ?? null,
    geom: JSON.stringify(geometry),
  }));
}

/** One page into mapbiomas_alerta.alerta (inside the caller's transaction). */
export async function gravarPagina(db: pg.ClientBase, linhas: ReturnType<typeof lerPagina>, arquivo: number): Promise<number> {
  const r = await db.query(
    `INSERT INTO mapbiomas_alerta.alerta (codigo, fontes, bioma, estado, uf, municipio, area_ha, ano, detectado_em, imagem_antes,
       imagem_depois, publicado_em, vetor_pressao, geom, arquivo)
     SELECT codigo, fontes, bioma, estado, uf, municipio, area_ha, ano, detectado_em, imagem_antes, imagem_depois, publicado_em,
            vetor_pressao, ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geom), 4326)), 3)), $2
     FROM json_to_recordset($1::json) AS r(codigo int, fontes text, bioma text, estado text, uf text, municipio text, area_ha float8,
       ano smallint, detectado_em date, imagem_antes timestamptz, imagem_depois timestamptz, publicado_em timestamptz,
       vetor_pressao text, geom text)`,
    [JSON.stringify(linhas), arquivo],
  );
  return r.rowCount ?? 0;
}

async function principal() {
  const hoje = new Date().toISOString().slice(0, 10);
  const db = new pg.Client();
  await db.connect();
  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM mapbiomas_alerta.alerta');
    let [total, n] = [0, 0];
    for (let inicio = 0; inicio === 0 || inicio < total; inicio += POR_PAGINA) {
      const nome = `alertas_${hoje}_${String(inicio).padStart(6, '0')}.geojson`;
      const url = urlPagina(inicio);
      const b = await tentar(() => baixar({ fonte: 'mapbiomas-alerta', coletor: 'mapbiomas-alerta', nome, url, gzip: true }));
      const json = JSON.parse(await readRaw(b.chave));
      if (inicio > 0 && json.numberMatched !== total) throw new Error(`o total mudou no meio: ${total} → ${json.numberMatched}`);
      total = json.numberMatched;
      n += await gravarPagina(db, lerPagina(json), await registrar(db, b));
    }
    if (n !== total) throw new Error(`MapBiomas Alerta: o WFS disse ${total} alertas e vieram ${n}`); // pages shifted while paging
    await db.query('COMMIT');
    console.log(`mapbiomas_alerta.alerta: ${n} alertas`);
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
