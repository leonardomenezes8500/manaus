// MapBiomas Collection 11 (#27): annual land cover 1985–2025 clipped to the Manaus metropolitan region as COGs in
// normalizado/mapbiomas/col11/ on R2 (years already there are skipped), then the urban area of Manaus per year
// (class 24 inside the municipality) to compare with the MapBiomas statistics. One-off job on this PC (needs GDAL):
//   node coleta/mapbiomas.ts                 every missing year, then the urban area table
//   node coleta/mapbiomas.ts --anos 1995-2004  only the clips of these years (to run a few processes side by side)
import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enviar, listKeys } from './lib/baixar.ts';
import { gdalR2Env, haPorPixel, histograma, MAPBIOMAS, mapbiomasChave, r2Raster, recortarCog } from './lib/raster.ts';
import { MANAUS, RMM_BBOX } from './regiao.ts';

const fonte = (ano: number) =>
  `/vsicurl/https://storage.googleapis.com/mapbiomas-public/initiatives/brasil/collection11/lulc/coverage/brazil_coverage/brazil_coverage-col11_${ano}.tif`;
const URBANO = 24;

const tmp = join(process.env.MANAUS_BUFFER || join(tmpdir(), 'manaus-buffer'), 'tmp', `mapbiomas-${process.pid}`);
await mkdir(tmp, { recursive: true });
try {
  const faixa = process.argv[process.argv.indexOf('--anos') + 1]?.match(/^(\d{4})-(\d{4})$/);
  const [de, ate] =
    process.argv.includes('--anos') && faixa ? [Number(faixa[1]), Number(faixa[2])] : [MAPBIOMAS.primeiro, MAPBIOMAS.ultimo];
  if (process.argv.includes('--anos') && !faixa) throw new Error('uso: --anos AAAA-AAAA');
  const anos = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  const existe = new Set((await listKeys('normalizado/mapbiomas/col11/')).map((k) => k.key));
  for (const ano of anos) {
    if (existe.has(mapbiomasChave(ano))) continue;
    const cog = join(tmp, `cobertura_${ano}.tif`);
    recortarCog([fonte(ano)], RMM_BBOX, cog, { categorico: true, nodata: 0 });
    await enviar(cog, mapbiomasChave(ano));
    await rm(cog);
    console.log(`${ano}: ${mapbiomasChave(ano)}`);
  }

  // Urban area of the municipality, only in the full run (every year is there): the COG cut by the IBGE boundary, then the histogram.
  if (!process.argv.includes('--anos')) {
    const limite = join(tmp, 'manaus.geojson');
    execFileSync('ogr2ogr', ['-f', 'GeoJSON', limite, 'PG:', '-sql', `SELECT geom FROM ibge.municipio WHERE codigo = ${MANAUS.codigo}`]);
    const ha = haPorPixel(MAPBIOMAS.pixel, -2.55); // latitude of the middle of the municipality
    console.log('ano\turbano_ha');
    for (const ano of anos) {
      const recorte = join(tmp, 'recorte.tif');
      execFileSync(
        'gdalwarp',
        ['-q', '-overwrite', '-cutline', limite, '-crop_to_cutline', '-dstnodata', '0', r2Raster(mapbiomasChave(ano)), recorte],
        {
          env: gdalR2Env(),
          stdio: ['ignore', 'ignore', 'inherit'],
        },
      );
      // No .aux.xml next to the clip: gdalinfo would reuse the histogram of the year before.
      const pam = { ...process.env, GDAL_PAM_ENABLED: 'NO' };
      const h = histograma(execFileSync('gdalinfo', ['-hist', recorte], { stdio: ['ignore', 'pipe', 'ignore'], env: pam }).toString());
      console.log(`${ano}\t${Math.round(h[URBANO] * ha)}`);
    }
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
