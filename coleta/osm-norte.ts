// OSM (#23): the dated Geofabrik "norte" extract and its .md5 through baixar(), md5 checked, then the Manaus area
// replaces osm.ponto/linha/poligono. Weekly on the slice (coleta/crontab); needs ogr2ogr.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { baixar } from './lib/baixar.ts';
import { fileMd5, loadOsm, md5Of, snapshotOf, stageOsm } from './carga/osm.ts';
import { registrar } from './carga/lib.ts';

const BASE = 'https://download.geofabrik.de/south-america/brazil';
const fonte = 'geofabrik-norte';
const coletor = 'osm-norte';

// "latest" redirects to the dated file (norte-YYMMDD.osm.pbf): download that one, so the name says the snapshot.
const head = await fetch(`${BASE}/norte-latest.osm.pbf`, { method: 'HEAD', redirect: 'manual' });
const nome = (head.headers.get('location') ?? '').split('/').pop() ?? '';
const snapshot = snapshotOf(nome);

const md5 = await baixar({ fonte, coletor, nome: `${nome}.md5`, url: `${BASE}/${nome}.md5` });
const pbf = await baixar({ fonte, coletor, nome, url: `${BASE}/${nome}`, parametros: { snapshot } });
const esperado = md5Of(await readFile(md5.caminho, 'utf8'));
if ((await fileMd5(pbf.caminho)) !== esperado) throw new Error(`md5 não bate em ${pbf.chave}`);

const db = new pg.Client();
await db.connect();
try {
  await registrar(db, md5);
  const arquivo = await registrar(db, pbf);
  stageOsm(pbf.caminho);
  console.log(`osm (${snapshot}):`, await loadOsm(db, arquivo, snapshot));
} finally {
  await db.end();
}
