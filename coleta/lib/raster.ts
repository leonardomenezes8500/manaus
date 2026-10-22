// Rasters (#27, #28): COG clips made on this PC and the point query, the same here and in the API on the slice
// (GDAL reads the COG straight from R2 through /vsis3/).
import { execFileSync, spawnSync } from 'node:child_process';

/** GDAL settings to read R2 as S3, from the R2_* variables. */
export function gdalR2Env(): NodeJS.ProcessEnv {
  const e = process.env;
  return {
    ...e,
    AWS_S3_ENDPOINT: `${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    AWS_ACCESS_KEY_ID: e.R2_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: e.R2_SECRET_ACCESS_KEY,
    AWS_REGION: 'auto',
    AWS_VIRTUAL_HOSTING: 'FALSE',
    GDAL_DISABLE_READDIR_ON_OPEN: 'EMPTY_DIR',
  };
}

export const r2Raster = (chave: string) => `/vsis3/${process.env.R2_BUCKET}/${chave}`;

/** Pixel value at (lon, lat); null outside the raster or when it is `nodata`. */
export function valorNoPonto(raster: string, lon: number, lat: number, nodata: number): number | null {
  const r = spawnSync('gdallocationinfo', ['-wgs84', raster, String(lon), String(lat)], { env: gdalR2Env(), encoding: 'utf8' });
  if (r.status !== 0) {
    if (/off this file/i.test(r.stdout)) return null;
    throw new Error(
      `gdallocationinfo falhou em ${raster}: ${r.stderr
        .split('\n')
        .filter((l) => !/^ERROR 1: lib/.test(l))
        .join(' ')
        .trim()}`,
    );
  }
  const m = r.stdout.match(/Value:\s*(\S+)/);
  if (!m) throw new Error(`gdallocationinfo sem valor em ${raster}`);
  const v = Number(m[1]);
  return v === nodata ? null : v;
}

/**
 * Clips `fontes` (one raster, or tiles mosaicked through a VRT) to the box and writes a COG in EPSG:4326.
 * `categorico`: nearest neighbour for the overviews, so class codes survive zooming out.
 */
export function recortarCog(
  fontes: string[],
  caixa: { oeste: number; sul: number; leste: number; norte: number },
  saida: string,
  opcoes: { categorico: boolean; nodata: number },
): void {
  const env = { ...gdalR2Env(), GDAL_HTTP_MAX_RETRY: '5', GDAL_HTTP_RETRY_DELAY: '3' };
  let entrada = fontes[0];
  if (fontes.length > 1) {
    entrada = `${saida}.vrt`;
    execFileSync('gdalbuildvrt', ['-q', entrada, ...fontes], { env, stdio: 'inherit' });
  }
  execFileSync(
    'gdal_translate',
    [
      ...['-q', '-projwin', ...[caixa.oeste, caixa.norte, caixa.leste, caixa.sul].map(String), '-a_nodata', String(opcoes.nodata)],
      ...['-of', 'COG', '-co', 'COMPRESS=DEFLATE', '-co', `RESAMPLING=${opcoes.categorico ? 'NEAREST' : 'AVERAGE'}`],
      ...(opcoes.categorico ? [] : ['-co', 'PREDICTOR=YES']),
      entrada,
      saida,
    ],
    { env, stdio: 'inherit' },
  );
}

/** Count per value (0–255) from `gdalinfo -hist` of a Byte band (256 buckets from -0.5 to 255.5). */
export function histograma(gdalinfo: string): number[] {
  const m = gdalinfo.match(/256 buckets from -0\.5 to 255\.5:\s*\n\s*([\d ]+)/);
  if (!m) throw new Error('gdalinfo sem o histograma de 256 classes');
  return m[1].trim().split(/\s+/).map(Number);
}

const M_POR_GRAU = (Math.PI * 6_371_008.8) / 180; // mean Earth radius; shortcut: sphere, ~0.3% off at Manaus, fine for areas by class

/** Hectares of one pixel of `grau` × `grau` degrees at latitude `lat`. */
export const haPorPixel = (grau: number, lat: number) => ((grau * M_POR_GRAU) ** 2 * Math.cos((lat * Math.PI) / 180)) / 10_000;

/** MapBiomas Collection 11 land cover COGs on R2 (#27): one per year, Manaus metropolitan region. 0 = no data. */
export const MAPBIOMAS = { primeiro: 1985, ultimo: 2025, pixel: 0.000269494585 } as const;
export const mapbiomasChave = (ano: number) => `normalizado/mapbiomas/col11/cobertura_${ano}.tif`;

/** Copernicus DEM GLO-30 tiles (1° × 1°, named by the south-west corner) that cover the box, north to south, west to east. */
export function copernicusTiles(caixa: { oeste: number; sul: number; leste: number; norte: number }): string[] {
  const nomes: string[] = [];
  for (let lat = Math.ceil(caixa.norte) - 1; lat >= Math.floor(caixa.sul); lat--) {
    for (let lon = Math.floor(caixa.oeste); lon < Math.ceil(caixa.leste); lon++) {
      const ns = `${lat < 0 ? 'S' : 'N'}${String(Math.abs(lat)).padStart(2, '0')}`;
      const ew = `${lon < 0 ? 'W' : 'E'}${String(Math.abs(lon)).padStart(3, '0')}`;
      nomes.push(`Copernicus_DSM_COG_10_${ns}_00_${ew}_00_DEM`);
    }
  }
  return nomes;
}

/** Elevation COGs on R2 (#28), Manaus metropolitan region, nodata -9999. ANADEM is terrain; Copernicus is surface (trees, buildings). */
export const RELEVO = {
  anadem: 'normalizado/anadem/anadem_v1_rmm.tif',
  copernicus: 'normalizado/copernicus-dem/glo30_rmm.tif',
  nodata: -9999,
} as const;
