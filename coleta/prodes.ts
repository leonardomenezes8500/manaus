// INPE PRODES (#74): the yearly deforestation map of the Legal Amazon (30 m, one class per pixel, legend in
// inpe_desmatamento.prodes_classe) clipped to the smoke region as a categorical COG in normalizado/inpe-prodes/ on R2.
// The 536 MB zip does not go to R2: its url carries the version and is public, like MapBiomas (#27). One-off job on
// this PC (needs GDAL and curl), once a year when INPE publishes a new edition:
//   node coleta/prodes.ts [zip already downloaded]
import { execFileSync } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enviar } from './lib/baixar.ts';
import { recortarCog } from './lib/raster.ts';
import { BBOX } from './regiao.ts';

export const PRODES = { edicao: 'prodes_amazonia_legal_2025_v20261019', nodata: 255, pixel: 0.00009 } as const;
const LIMITE_BYTES = 300e6; // above this the 30 m clip is resampled to 60 m by the mode (R2 has little room left)
export const prodesChave = () => `normalizado/inpe-prodes/${PRODES.edicao}_regiao.tif`;
const URL = `https://terrabrasilis.dpi.inpe.br/download/dataset/legal-amz-prodes/raster/${PRODES.edicao}.zip`;

async function principal() {
  const tmp = join(process.env.MANAUS_BUFFER || join(tmpdir(), 'manaus-buffer'), 'tmp', `prodes-${process.pid}`);
  await mkdir(tmp, { recursive: true });
  try {
    let zip = process.argv[2];
    if (!zip) {
      zip = join(tmp, `${PRODES.edicao}.zip`);
      execFileSync('curl', ['-sS', '--fail', '--retry', '5', '-o', zip, URL], { stdio: 'inherit' });
    }
    let cog = join(tmp, 'prodes.tif');
    recortarCog([`/vsizip/${zip}/${PRODES.edicao}.tif`], BBOX, cog, { categorico: true, nodata: PRODES.nodata });
    console.log(`30 m: ${(await stat(cog)).size} bytes`);
    if ((await stat(cog)).size > LIMITE_BYTES) {
      const menor = join(tmp, 'prodes60.tif');
      const tr = String(PRODES.pixel * 2);
      execFileSync(
        'gdalwarp',
        ['-q', '-tr', tr, tr, '-r', 'mode', '-of', 'COG', '-co', 'COMPRESS=DEFLATE', '-co', 'RESAMPLING=NEAREST', cog, menor],
        {
          stdio: 'inherit',
        },
      );
      cog = menor;
      console.log(`60 m: ${(await stat(cog)).size} bytes`);
    }
    await enviar(cog, prodesChave());
    console.log(prodesChave());
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
