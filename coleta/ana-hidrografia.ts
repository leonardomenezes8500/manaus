// ANA hydrography (#29): river reaches (BHO 2017 5k) and water bodies of the metropolitan region, from the ANA ArcGIS
// services: first the ids in the box, then batches of ids as GeoJSON through baixar(), then the load (cut to the box).
// One-off job on this PC: node coleta/ana-hidrografia.ts
import pg from 'pg';
import { baixar, readRaw } from './lib/baixar.ts';
import { loadHidro, massaRow, trechoRow } from './carga/ana.ts';
import { registrar } from './carga/lib.ts';
import { tentar } from './lib/tentar.ts';
import { RMM_BBOX as B } from './regiao.ts';

const BASE = 'https://www.snirh.gov.br/arcgis/rest/services/SPR';
const CAIXA = `geometry=${B.oeste},${B.sul},${B.leste},${B.norte}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`;
const CAMADAS = [
  { tabela: 'ana.trecho', servico: 'BHO2017_5K_TRECHODRENAGEM/FeatureServer/0', nome: 'trechos', lote: 500, row: trechoRow },
  { tabela: 'ana.massa_dagua', servico: 'Massa_dagua/MapServer/0', nome: 'massas', lote: 50, row: massaRow }, // big polygons
] as const;

const db = new pg.Client();
await db.connect();
try {
  for (const c of CAMADAS) {
    const ids: number[] = (
      await (await tentar(() => fetch(`${BASE}/${c.servico}/query?${CAIXA}&returnIdsOnly=true&f=json`))).json()
    ).objectIds.sort((a: number, b: number) => a - b);
    // A new run only asks for what is not in the table yet (the water body id is the service id; the reach id is
    // its cotrecho, so reaches are skipped only when all are there).
    const ja = new Set((await db.query(`SELECT id FROM ${c.tabela}`)).rows.map((r) => Number(r.id)));
    const faltam = c.tabela === 'ana.massa_dagua' ? ids.filter((i) => !ja.has(i)) : ja.size >= ids.length ? [] : ids;
    let n = 0;
    for (let i = 0; i < faltam.length; i += c.lote) {
      const lote = faltam.slice(i, i + c.lote);
      const b = await tentar(() =>
        baixar({
          fonte: 'ana-hidrografia',
          coletor: 'ana-hidrografia',
          nome: `${c.nome}_${lote[0]}.geojson`,
          url: `${BASE}/${c.servico}/query?objectIds=${lote.join(',')}&outFields=*&outSR=4326&f=geojson`,
          parametros: { caixa: B, ids: lote.length },
        }),
      );
      const features = JSON.parse(await readRaw(b.chave)).features;
      n += await loadHidro(db, await registrar(db, b), c.tabela, features.map(c.row));
    }
    console.log(`${c.tabela}: ${n} novos de ${faltam.length} que faltavam (${ids.length} na caixa)`);
  }
} finally {
  await db.end();
}
