// Burned area per month (#76) in the ring of 800 km around Manaus, the region box and each state, into
// analise.area_queimada_mes. One-off job on this PC (needs GDAL 3.12+ for `gdal raster calc` and `zonal-stats`):
//   node analise/fogo/area-queimada.ts [--de 2012] [--ate 2025] [--aq-ate AAAA-MM] [--produto mapbiomas-fogo|inpe-aq1km]
// MapBiomas Fogo is read by window from its public, versioned url and not copied to R2 (as in #27). The AQ1km months
// are small (~0.9 MB) and go to the raw store through baixar() once; later runs read them back from R2.
// How: a zones raster on the product grid, value = 10000·ring + 100·state + class code of the pixel (MapBiomas: month,
// +12 when the land cover was forest; AQ1km: 1 when burned), and `gdal raster zonal-stats` sums a weights raster in
// hectares per pixel (one value per row, by latitude) over each zone value.
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { baixar, listKeys } from '../../coleta/lib/baixar.ts';
import { gdalR2Env, haPorPixel, r2Raster } from '../../coleta/lib/raster.ts';
import { BBOX_CAMADAS as BBOX, MANAUS, UFS } from '../../coleta/regiao.ts';
import { ANEL_KM } from '../fumaca/focos-dia.ts';

const FOGO = 'https://storage.googleapis.com/mapbiomas-public/initiatives/brasil/collection_10/fire-col5';
const AQ = 'https://dataserver-coids.inpe.br/queimadas/queimadas/area_queimada/colecao2/tif';
// Grids: MapBiomas Fogo (monthly and coverage share it, the coverage starts 35 rows higher) and AQ1km.
export const GRADES = {
  'mapbiomas-fogo': { oeste: -74.543819243749326, norte: 6.787221129165045, pixel: 0.000269494585236 },
  'inpe-aq1km': { oeste: -83.005, norte: 13.005, pixel: 0.01 },
} as const;
const FLORESTA = [3, 5, 6, 49]; // MapBiomas classes of the Floresta group: formação florestal, mangue, floresta alagável, restinga arbórea

type Grade = { oeste: number; norte: number; pixel: number };
type Caixa = { oeste: number; sul: number; leste: number; norte: number };

/** The box snapped outwards to the grid: extent and size in pixels. */
export function encaixar(g: Grade, c: Caixa) {
  const col0 = Math.floor((c.oeste - g.oeste) / g.pixel);
  const lin0 = Math.floor((g.norte - c.norte) / g.pixel);
  const col1 = Math.ceil((c.leste - g.oeste) / g.pixel);
  const lin1 = Math.ceil((g.norte - c.sul) / g.pixel);
  return {
    oeste: g.oeste + col0 * g.pixel,
    norte: g.norte - lin0 * g.pixel,
    leste: g.oeste + col1 * g.pixel,
    sul: g.norte - lin1 * g.pixel,
    largura: col1 - col0,
    altura: lin1 - lin0,
  };
}

/** One column of hectares per pixel, by the latitude of each row's center, as an ASCII grid. */
export function pesoPorLinha(e: ReturnType<typeof encaixar>, pixel: number): string {
  const linhas = Array.from({ length: e.altura }, (_, i) => haPorPixel(pixel, e.norte - (i + 0.5) * pixel).toFixed(6));
  return [`ncols 1`, `nrows ${e.altura}`, `xllcorner ${e.oeste}`, `yllcorner ${e.sul}`, `cellsize ${pixel}`, ...linhas].join('\n') + '\n';
}

/** VRT that stretches the one-column grid to the whole box (nearest: each row keeps its value). */
export function vrtPeso(coluna: string, e: ReturnType<typeof encaixar>, pixel: number): string {
  return `<VRTDataset rasterXSize="${e.largura}" rasterYSize="${e.altura}">
  <SRS>EPSG:4326</SRS>
  <GeoTransform>${e.oeste}, ${pixel}, 0, ${e.norte}, 0, ${-pixel}</GeoTransform>
  <VRTRasterBand dataType="Float32" band="1">
    <SimpleSource>
      <SourceFilename relativeToVRT="0">${coluna}</SourceFilename>
      <SourceBand>1</SourceBand>
      <SrcRect xOff="0" yOff="0" xSize="1" ySize="${e.altura}"/>
      <DstRect xOff="0" yOff="0" xSize="${e.largura}" ySize="${e.altura}"/>
    </SimpleSource>
  </VRTRasterBand>
</VRTDataset>
`;
}

export type Linha = { ano: number; mes: number; produto: string; recorte: string; cobertura: string; hectares: number };

/**
 * zonal-stats CSV (value,sum) → rows per cut. Zone 0 is "not burned". Every burned zone counts for the region box, for
 * the ring when 10000 is set and for its state when the hundreds are set (1 = UFS[0] ...).
 */
export function lerZonas(csv: string, produto: keyof typeof GRADES, ano: number, mesDoArquivo?: number): Linha[] {
  const soma = new Map<string, Linha>();
  for (const l of csv.trim().split('\n').slice(1)) {
    const [v, s] = l.split(',').map(Number);
    if (!v || !s) continue;
    const classe = v % 100;
    const uf = Math.floor((v % 10000) / 100);
    const cortes = ['regiao', ...(v >= 10000 ? ['800km'] : []), ...(uf ? [UFS[uf - 1]] : [])];
    const mes = produto === 'inpe-aq1km' ? mesDoArquivo! : classe > 12 ? classe - 12 : classe;
    const cobertura = produto === 'inpe-aq1km' ? 'total' : classe > 12 ? 'floresta' : 'nao_floresta';
    for (const recorte of cortes) {
      const k = `${mes}|${recorte}|${cobertura}`;
      const r = soma.get(k) ?? { ano, mes, produto, recorte, cobertura, hectares: 0 };
      r.hectares += s;
      soma.set(k, r);
    }
  }
  return [...soma.values()];
}

const gdal = (args: string[]) => execFileSync('gdal', args, { stdio: ['ignore', 'ignore', 'inherit'], env: gdalR2Env() });

/** States (100·position in UFS, municipality by municipality: no union in the slice database) and the ring (+10000) burned into a UInt16 raster on the product grid. */
export function zonasFixas(tmp: string, e: ReturnType<typeof encaixar>, pixel: number, nome: string): string {
  const saida = join(tmp, `zonas_${nome}.tif`);
  const base = ['-te', ...[e.oeste, e.sul, e.leste, e.norte].map(String), '-tr', String(pixel), String(pixel)];
  const casos = UFS.map((uf, i) => `WHEN '${uf}' THEN ${(i + 1) * 100}`).join(' ');
  execFileSync(
    'gdal_rasterize',
    [...base, '-ot', 'UInt16', '-init', '0', '-a', 'z', '-co', 'COMPRESS=DEFLATE', '-co', 'TILED=YES', '-co', 'BIGTIFF=YES']
      .concat(['-sql', `SELECT CASE uf ${casos} END AS z, geom FROM ibge.municipio WHERE uf IN (${UFS.map((u) => `'${u}'`).join(',')})`])
      .concat(['PG:', saida]),
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  const anel = `SELECT 10000 AS z, ST_Buffer(ST_SetSRID(ST_MakePoint(${MANAUS.lon}, ${MANAUS.lat}), 4326)::geography, ${ANEL_KM * 1000})::geometry AS geom`;
  execFileSync('gdal_rasterize', ['-add', '-a', 'z', '-sql', anel, 'PG:', saida], { stdio: ['ignore', 'ignore', 'inherit'] });
  return saida;
}

export async function somar(tmp: string, zonas: string, peso: string, nome: string): Promise<string> {
  const csv = join(tmp, `${nome}.csv`);
  gdal(['raster', 'zonal-stats', '-q', '--overwrite', '-i', peso, '--zones', zonas, '--stat', 'sum', '-o', csv]);
  const { readFile } = await import('node:fs/promises');
  return readFile(csv, 'utf8');
}

async function gravar(db: pg.ClientBase, linhas: Linha[], ano: number, produto: string, mes?: number) {
  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM analise.area_queimada_mes WHERE ano = $1 AND produto = $2 AND ($3::int IS NULL OR mes = $3)', [
      ano,
      produto,
      mes ?? null,
    ]);
    await db.query(
      `INSERT INTO analise.area_queimada_mes SELECT * FROM json_populate_recordset(NULL::analise.area_queimada_mes, $1::json)`,
      [JSON.stringify(linhas)],
    );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

async function principal(args: string[]) {
  const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
  const [de, ate] = [Number(arg('--de', '2012')), Number(arg('--ate', '2025'))];
  const mesPassado = new Date(Date.now() - 4 * 3_600_000);
  mesPassado.setUTCDate(0);
  const aqAte = arg('--aq-ate', mesPassado.toISOString().slice(0, 7));
  const tmp = await mkdtemp(join(process.env.MANAUS_BUFFER || tmpdir(), 'area-queimada-'));
  const db = new pg.Client();
  await db.connect();
  try {
    const produtos = (['mapbiomas-fogo', 'inpe-aq1km'] as const).filter((p) => !args.includes('--produto') || arg('--produto', '') === p);
    for (const produto of produtos) {
      const g = GRADES[produto];
      const e = encaixar(g, BBOX);
      const coluna = join(tmp, `peso_${produto}.asc`);
      await writeFile(coluna, pesoPorLinha(e, g.pixel));
      const peso = join(tmp, `peso_${produto}.vrt`);
      await writeFile(peso, vrtPeso(coluna, e, g.pixel));
      const fixas = zonasFixas(tmp, e, g.pixel, produto);
      const te = ['-te', ...[e.oeste, e.sul, e.leste, e.norte].map(String), '-tr', String(g.pixel), String(g.pixel)];
      if (produto === 'mapbiomas-fogo') {
        for (let ano = de; ano <= ate; ano++) {
          const [m, k] = [join(tmp, 'mes.vrt'), join(tmp, 'cobertura.vrt')];
          execFileSync('gdalbuildvrt', [
            '-q',
            '-overwrite',
            ...te,
            m,
            `/vsicurl/${FOGO}/mapbiomas_fire_collection5_monthly_burned_v1/burned_monthly_${ano}.tif`,
          ]);
          execFileSync('gdalbuildvrt', [
            '-q',
            '-overwrite',
            ...te,
            k,
            `/vsicurl/${FOGO}/mapbiomas_fire_collection5_annual_burned_coverage_v1/burned_coverage_${ano}.tif`,
          ]);
          const zonas = join(tmp, 'zonas_ano.vrt');
          const floresta = FLORESTA.map((c) => `(K==${c})`).join('+');
          gdal(
            [
              'raster',
              'calc',
              '-q',
              '--overwrite',
              '-i',
              `M=${m}`,
              '-i',
              `K=${k}`,
              '-i',
              `Z=${fixas}`,
              '--ot',
              'UInt16',
              '-f',
              'VRT',
              '-o',
              zonas,
            ].concat(['--calc', `(M>0)*(M+12*(${floresta})+Z)`]),
          );
          const linhas = lerZonas(await somar(tmp, zonas, peso, `fogo_${ano}`), produto, ano);
          await gravar(db, linhas, ano, produto);
          console.log(
            `${produto} ${ano}: ${Math.round(linhas.filter((l) => l.recorte === '800km').reduce((s, l) => s + l.hectares, 0))} ha no anel`,
          );
        }
      } else {
        const noBruto = (await listKeys('bruto/inpe-aq1km/')).map((o) => o.key).filter((k) => !k.endsWith('.meta.json'));
        for (let ano = de; `${ano}-01` <= aqAte; ano++)
          for (let mes = 1; mes <= 12 && `${ano}-${String(mes).padStart(2, '0')}` <= aqAte; mes++) {
            const nome = `${ano}_${String(mes).padStart(2, '0')}_AQM_modis.tif`;
            const chave = noBruto.find((k) => k.endsWith(`Z_${nome}`));
            const fonte = chave
              ? r2Raster(chave)
              : (await baixar({ fonte: 'inpe-aq1km', url: `${AQ}/${nome}`, nome, coletor: 'analise/fogo/area-queimada.ts' })).caminho;
            const a = join(tmp, 'aq.vrt');
            execFileSync('gdalbuildvrt', ['-q', '-overwrite', ...te, a, fonte], { env: gdalR2Env() });
            const zonas = join(tmp, 'zonas_mes.vrt');
            gdal([
              'raster',
              'calc',
              '-q',
              '--overwrite',
              '-i',
              `A=${a}`,
              '-i',
              `Z=${fixas}`,
              '--ot',
              'UInt16',
              '-f',
              'VRT',
              '-o',
              zonas,
              '--calc',
              '(A==1)*(1+Z)',
            ]);
            const linhas = lerZonas(await somar(tmp, zonas, peso, `aq_${ano}_${mes}`), produto, ano, mes);
            await gravar(db, linhas, ano, produto, mes);
          }
        console.log(`${produto}: até ${aqAte}`);
      }
    }
  } finally {
    await db.end();
    await rm(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
