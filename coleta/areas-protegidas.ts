// Protected areas (#30): FUNAI indigenous lands (WFS) and CNUC conservation units (MMA shapefile) for the smoke region,
// through baixar(); then the load and the count of season fire spots inside them. One-off job (a few times a year):
//   node coleta/areas-protegidas.ts
// The FUNAI server does not send its intermediate certificate: the script restarts itself with it (coleta/certs/).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

if (!process.env.NODE_EXTRA_CA_CERTS) {
  const env = { ...process.env, NODE_EXTRA_CA_CERTS: join(import.meta.dirname, 'certs', 'sectigo-ov-r36.pem') };
  process.exit(spawnSync(process.execPath, process.argv.slice(1), { env, stdio: 'inherit' }).status ?? 1);
}

const { default: pg } = await import('pg');
const { baixar, readRaw } = await import('./lib/baixar.ts');
const { focosEmAreasProtegidas, loadTis, loadUnidades, stageUnidades, tiRow } = await import('./carga/areas-protegidas.ts');
const { registrar } = await import('./carga/lib.ts');
const { BBOX: B } = await import('./regiao.ts');

const FUNAI =
  'https://geoserver.funai.gov.br/geoserver/Funai/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=Funai:tis_poligonais' +
  `&outputFormat=application/json&srsName=EPSG:4326&bbox=${B.sul},${B.oeste},${B.norte},${B.leste},urn:ogc:def:crs:EPSG::4326`; // WFS 2.0: lat,lon
const CNUC =
  'https://dados.mma.gov.br/dataset/44b6dc8a-dc82-4a84-8d95-1b0da7c85dac/resource/6ba9a557-87e8-4882-acb7-b3e0f0ea192d/download/shp_cnuc_2025_08.zip';
const coletor = 'areas-protegidas';

const db = new pg.Client();
await db.connect();
try {
  // nginx of the FUNAI refuses the default user agent of scripts.
  const ti = await baixar({
    fonte: 'funai-terras-indigenas',
    coletor,
    nome: 'tis_poligonais.geojson',
    url: FUNAI,
    headers: { 'User-Agent': 'QGIS/3.34' },
  });
  const features = JSON.parse(await readRaw(ti.chave)).features;
  console.log('funai.terra_indigena:', await loadTis(db, await registrar(db, ti), features.map(tiRow)));

  const uc = await baixar({ fonte: 'mma-cnuc', coletor, nome: 'shp_cnuc_2025_08.zip', url: CNUC });
  stageUnidades(`/vsizip/${uc.caminho}/cnuc_2025_08.shp`, B);
  console.log('cnuc.unidade:', await loadUnidades(db, await registrar(db, uc)));

  console.log('focos INPE desde 2026-08-01:', JSON.stringify(await focosEmAreasProtegidas(db, '2026-08-01'), null, 2));
} finally {
  await db.end();
}
