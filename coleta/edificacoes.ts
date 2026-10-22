// Buildings (#26). One-off job on this PC (needs duckdb and ogr2ogr): node coleta/edificacoes.ts
// - Overture Maps, latest release: DuckDB reads only the Manaus box from the public GeoParquet; the clip (all columns)
//   goes to the raw files with guardar(), a FlatGeobuf with the main columns goes into the database.
// - Google Open Buildings v3: the tile that covers Manaus through baixar(); the load keeps the Manaus box.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import pg from 'pg';
import { baixar, guardar } from './lib/baixar.ts';
import { records } from './carga/csv.ts';
import { loadOpenBuildings, loadOverture, openBuildingsRow, stageOverture, type OpenBuilding } from './carga/edificacoes.ts';
import { registrar } from './carga/lib.ts';
import { MANAUS_BBOX as B } from './regiao.ts';

const coletor = 'edificacoes';
const OVERTURE = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com';
const TILE = 'https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/927_buildings.csv.gz'; // the S2 cell of Manaus

async function latestRelease(): Promise<string> {
  const xml = await (await fetch(`${OVERTURE}/?list-type=2&prefix=release/&delimiter=/`)).text();
  const all = [...xml.matchAll(/<Prefix>release\/([\d.-]+)\/<\/Prefix>/g)].map((m) => m[1]).sort();
  if (!all.length) throw new Error('nenhum release da Overture na listagem');
  return all.at(-1)!;
}

async function* openBuildings(gz: string): AsyncGenerator<OpenBuilding> {
  const gunzip = spawn('gunzip', ['-c', gz], { stdio: ['ignore', 'pipe', 'inherit'] });
  for await (const r of records(createInterface({ input: gunzip.stdout, crlfDelay: Infinity }))) {
    const row = openBuildingsRow(r);
    if (row) yield row;
  }
}

const tmp = join(process.env.MANAUS_BUFFER || join(tmpdir(), 'manaus-buffer'), 'tmp', 'overture');
await mkdir(tmp, { recursive: true });
const db = new pg.Client();
await db.connect();
try {
  const release = await latestRelease();
  const origem = `s3://overturemaps-us-west-2/release/${release}/theme=buildings/type=building/*`;
  const [parquet, fgb] = [join(tmp, 'manaus.parquet'), join(tmp, 'manaus.fgb')];
  execFileSync(
    'duckdb',
    [
      '-c',
      `INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';
       COPY (SELECT * FROM read_parquet('${origem}', hive_partitioning=1)
             WHERE bbox.xmin < ${B.leste} AND bbox.xmax > ${B.oeste} AND bbox.ymin < ${B.norte} AND bbox.ymax > ${B.sul})
         TO '${parquet}' (FORMAT parquet);
       COPY (SELECT id, subtype, class, height, num_floors, sources[1].dataset AS dataset, geometry FROM '${parquet}')
         TO '${fgb}' WITH (FORMAT GDAL, DRIVER 'FlatGeobuf', SRS 'EPSG:4326');`,
    ],
    { stdio: 'inherit' },
  );
  const clip = await guardar(parquet, {
    fonte: 'overture-maps',
    coletor,
    nome: 'edificacoes_manaus.parquet',
    origem,
    parametros: { release, bbox: B },
  });
  stageOverture(fgb);
  console.log(`overture.edificacao (${release}):`, await loadOverture(db, await registrar(db, clip), release));

  const tile = await baixar({
    fonte: 'google-open-buildings',
    coletor,
    nome: '927_buildings.csv.gz',
    url: TILE,
    parametros: { versao: 'v3' },
  });
  console.log('openbuildings.edificacao:', await loadOpenBuildings(db, await registrar(db, tile), openBuildings(tile.caminho)));
} finally {
  await db.end();
  await rm(tmp, { recursive: true, force: true });
}
