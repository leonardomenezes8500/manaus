// Elevation (#28): ANADEM v1 (ANA/UFRGS, terrain, 30 m) and Copernicus DEM GLO-30 (surface, 30 m) clipped to the
// Manaus metropolitan region as COGs on R2, read tile by tile over HTTP (no full download), then the elevation of
// three known points in both. One-off job on this PC (needs GDAL): node coleta/relevo.ts
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enviar, listKeys } from './lib/baixar.ts';
import { copernicusTiles, r2Raster, recortarCog, RELEVO, valorNoPonto } from './lib/raster.ts';
import { RMM_BBOX } from './regiao.ts';

// MGRS zones 20M (lon -66..-60) and 21M (-60..-54), lat 0..-8.13.
const ANADEM = ['20M', '21M'].map((z) => `/vsicurl/https://metadados.snirh.gov.br/files/anadem_v1_tiles/anadem_v1_${z}.tif`);
const COPERNICUS = copernicusTiles(RMM_BBOX).map((t) => `/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/${t}/${t}.tif`);
const PONTOS = [
  ['Teatro Amazonas', -60.0234, -3.1302],
  ['Praia da Ponta Negra', -60.1006, -3.0705],
  ['Encontro das Águas', -59.9023, -3.1361],
] as const;

const tmp = join(process.env.MANAUS_BUFFER || join(tmpdir(), 'manaus-buffer'), 'tmp', 'relevo');
await mkdir(tmp, { recursive: true });
try {
  const existe = new Set((await listKeys('normalizado/')).map((k) => k.key));
  for (const [chave, fontes] of [
    [RELEVO.anadem, ANADEM],
    [RELEVO.copernicus, COPERNICUS],
  ] as const) {
    if (existe.has(chave)) continue;
    const cog = join(tmp, 'relevo.tif');
    recortarCog([...fontes], RMM_BBOX, cog, { categorico: false, nodata: RELEVO.nodata });
    await enviar(cog, chave);
    await rm(cog);
    console.log(chave);
  }
  console.log('ponto\tanadem_m\tcopernicus_m');
  for (const [nome, lon, lat] of PONTOS) {
    const [a, c] = [RELEVO.anadem, RELEVO.copernicus].map((k) => valorNoPonto(r2Raster(k), lon, lat, RELEVO.nodata));
    console.log(`${nome}\t${a?.toFixed(1)}\t${c?.toFixed(1)}`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
