// Neighbourhoods (#24): IBGE 2022 bairros of the AM (GeoPackage) and the two municipal laws that draw the Manaus
// bairros (text only, no map: kept in the raw files for the fusion), all through baixar(); then the IBGE load.
// One-off job on this PC (needs ogr2ogr): node coleta/bairros.ts
import pg from 'pg';
import { baixar } from './lib/baixar.ts';
import { loadNeighbourhoods, stageNeighbourhoods } from './carga/bairros.ts';
import { registrar } from './carga/lib.ts';

const coletor = 'bairros';
const IBGE =
  'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/gpkg/UF/AM/AM_bairros_CD2022.gpkg';
const SAPL = 'https://sapl.cmm.am.gov.br/media/sapl/public/normajuridica';
const LAWS = [
  ['lei_n_1401_de_14_jan_2010.pdf', `${SAPL}/2010/3859/lei_n_1401_de_14_jan_2010_.pdf`], // creates and bounds the bairros
  ['lei_n_3592_de_22_dez_2025.pdf', `${SAPL}/2025/8241/lei_n_3592_de_22_dez_2025.pdf`], // new bairro Colônia Japonesa
];

const db = new pg.Client();
await db.connect();
try {
  for (const [nome, url] of LAWS) await registrar(db, await baixar({ fonte: 'cmm-manaus', coletor, nome, url }));
  const gpkg = await baixar({
    fonte: 'ibge-bairros',
    coletor,
    nome: 'AM_bairros_CD2022.gpkg',
    url: IBGE,
    parametros: { uf: 'AM', censo: 2022 },
  });
  stageNeighbourhoods(gpkg.caminho);
  console.log('ibge.bairro:', await loadNeighbourhoods(db, await registrar(db, gpkg)));
} finally {
  await db.end();
}
