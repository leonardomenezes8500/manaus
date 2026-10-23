// Where each fire spot fell (#77): state, TI, UC, public forest (CNFP), PRODES class and recent DETER alert.
//   node analise/fogo/onde-queimou.ts --serie [--reusar] [--sem-serie]   this PC: the whole series (the same spots as analise.focos_dia), joined
//                                                in duckdb, PRODES read from a local copy of the COG; totals per day into
//                                                analise.onde_queimou_dia, areas into analise.area_categoria_ano and
//                                                produtos/fumaca/onde-queimou.csv
//   classificarFocos(db, ids)                    the spots of a day's v1 (relatorio.ts), in PostGIS, into analise.onde_queimou_foco
//   node analise/fogo/onde-queimou.ts --dia AAAA-MM-DD   the same for one day by hand, without redoing the report
// Both paths end in classificar(), so a spot gets the same categories in either.
import { execFileSync, spawn } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, renameSync, rmSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import pg from 'pg';
import { enviar, openRaw } from '../../coleta/lib/baixar.ts';
import { gdalR2Env, r2Raster, valoresNosPontos } from '../../coleta/lib/raster.ts';
import { PRODES, prodesChave } from '../../coleta/prodes.ts';
import { BBOX, UFS } from '../../coleta/regiao.ts';
import { diaDeManaus } from '../dia.ts';
import { focosDaSerie, type Sensor } from '../fumaca/focos-dia.ts';
import { encaixar, pesoPorLinha, somar, vrtPeso, zonasFixas } from './area-queimada.ts';

export const DIMENSOES = ['ti', 'uc', 'protegida', 'cnfp', 'prodes', 'deter'] as const;
export type Dimensao = (typeof DIMENSOES)[number];
export const JANELA_DETER_DIAS = 90;

/** PRODES year of a Manaus day: August to July, named by the year it ends in. */
export const anoProdes = (dia: string) => Number(dia.slice(0, 4)) + (Number(dia.slice(5, 7)) >= 8 ? 1 : 0);

/** PRODES class (inpe_desmatamento.prodes_classe) → category relative to the spot's PRODES year. */
export function categoriaProdes(classe: number | null, dia: string): string {
  if (classe === null || classe === PRODES.nodata) return 'sem_dado';
  if (classe === 91) return 'hidrografia';
  if (classe === 100) return 'floresta';
  if (classe === 101) return 'nao_floresta';
  if (classe >= 50 && classe <= 65) return 'residuo';
  if (classe > 25) return 'sem_dado';
  const ano = 2000 + classe;
  const k = anoProdes(dia) - ano;
  return k < 0 ? 'desm_depois' : k === 0 ? 'desm_ano' : k <= 3 ? 'desm_1a3' : ano <= 2007 ? 'desm_ate2007' : 'desm_4mais';
}

export type Atributos = {
  uf: string | null;
  ti: boolean;
  uc: string[]; // cnuc.unidade.grupo of every UC that contains the spot
  faixa: boolean; // within 10 km of a TI or UC
  cnfp: string[]; // sfb.floresta_publica as tipo:ano_criacao, e.g. 'A:2008', 'B:', 'A:'
  deter: string[]; // classes of the DETER alerts that contain it, image date in the 90 days up to the spot
  prodes: number | null;
};

/** Public forest at the time of the spot: a tipo A area created after the spot's year was still without destination (B). */
export function categoriaCnfp(pecas: string[], ano: number): string {
  const p = pecas.map((x) => x.split(':')).map(([tipo, criacao]) => (tipo === 'A' && criacao && Number(criacao) > ano ? 'B' : tipo));
  return p.includes('B') ? 'B' : p.includes('A') ? 'A' : 'nao';
}

/** The rule (written before looking at the data, #72): one category per dimension for each spot. */
export function classificar(a: Atributos, dia: string): { uf: string } & Record<Dimensao, string> {
  return {
    uf: a.uf ?? 'fora',
    ti: a.ti ? 'sim' : 'nao',
    uc: a.uc.includes('Proteção Integral') ? 'protecao_integral' : a.uc.length ? 'uso_sustentavel' : 'nao',
    protegida: a.ti || a.uc.length ? 'sim' : a.faixa ? 'faixa_10km' : 'nao',
    cnfp: categoriaCnfp(a.cnfp, Number(dia.slice(0, 4))),
    prodes: categoriaProdes(a.prodes, dia),
    deter: a.deter.includes('DESMATAMENTO_CR')
      ? 'corte_raso'
      : a.deter.includes('CICATRIZ_DE_QUEIMADA')
        ? 'cicatriz'
        : a.deter.length
          ? 'outro'
          : 'nao',
  };
}

/** Totals per day, sensor, state, dimension and category. */
export function somadorOnde() {
  const t = new Map<string, { focos: number; frp: number }>();
  return {
    somar(dia: string, sensor: string, c: ReturnType<typeof classificar>, frp: number) {
      for (const d of DIMENSOES) {
        const k = `${dia}|${sensor}|${c.uf}|${d}|${c[d]}`;
        const x = t.get(k) ?? { focos: 0, frp: 0 };
        x.focos++;
        x.frp += frp;
        t.set(k, x);
      }
    },
    linhas: () =>
      [...t].map(([k, x]) => {
        const [dia, sensor, uf, dimensao, categoria] = k.split('|');
        return { dia, sensor, uf, dimensao, categoria, focos: x.focos, frp: x.frp };
      }),
  };
}

const lista = (s: string | null) => (s ? s.split('|') : []);

/** The spots (firms.foco ids) of a day's attribution, classified in PostGIS and the PRODES COG on R2. */
export async function classificarFocos(db: pg.ClientBase, ids: number[], prodesRaster = r2Raster(prodesChave())): Promise<number> {
  if (!ids.length) return 0;
  const { rows } = await db.query(
    `SELECT f.id, f.lon, f.lat, (f.adquirido_em AT TIME ZONE 'America/Manaus')::date::text AS dia, m.uf,
            EXISTS (SELECT 1 FROM funai.terra_indigena t WHERE ST_Intersects(t.geom, f.geom)) AS ti,
            (SELECT string_agg(DISTINCT u.grupo, '|') FROM cnuc.unidade u WHERE ST_Intersects(u.geom, f.geom)) AS uc,
            -- Within 10 km of a TI or UC. In this box (latitude 3 to -15) a gap under 0.0898° is surely under 10 km and one
            -- over 0.0931° surely over, so the costly geography distance only runs in between (75 s → 3 s for a day).
            EXISTS (SELECT 1 FROM (SELECT geom FROM funai.terra_indigena UNION ALL SELECT geom FROM cnuc.unidade) p
                    WHERE p.geom && ST_Expand(f.geom, 0.0931)
                      AND (ST_DWithin(p.geom, f.geom, 0.0898)
                           OR (ST_DWithin(p.geom, f.geom, 0.0931) AND ST_DWithin(p.geom::geography, f.geom::geography, 10000)))) AS faixa,
            (SELECT string_agg(DISTINCT c.tipo || ':' || coalesce(c.ano_criacao::text, ''), '|') FROM sfb.floresta_publica c
             WHERE ST_Intersects(c.geom, f.geom)) AS cnfp,
            (SELECT string_agg(DISTINCT d.classe, '|') FROM inpe_desmatamento.deter d WHERE ST_Intersects(d.geom, f.geom)
               AND d.view_date BETWEEN (f.adquirido_em AT TIME ZONE 'America/Manaus')::date - ${JANELA_DETER_DIAS}
                                   AND (f.adquirido_em AT TIME ZONE 'America/Manaus')::date) AS deter
     FROM firms.foco f LEFT JOIN ibge.municipio m ON m.codigo = f.municipio
     WHERE f.id = ANY($1)`,
    [ids],
  );
  const prodes = valoresNosPontos(prodesRaster, rows, PRODES.nodata);
  const linhas = rows.map((r, i) => ({
    foco: r.id,
    ...classificar(
      { uf: r.uf, ti: r.ti, uc: lista(r.uc), faixa: r.faixa, cnfp: lista(r.cnfp), deter: lista(r.deter), prodes: prodes[i] },
      r.dia,
    ),
  }));
  await db.query(
    `INSERT INTO analise.onde_queimou_foco (foco, uf, ti, uc, protegida, cnfp, prodes, deter)
     SELECT foco, uf, ti, uc, protegida, cnfp, prodes, deter FROM json_populate_recordset(NULL::analise.onde_queimou_foco, $1::json)
     ON CONFLICT (foco) DO UPDATE SET uf = excluded.uf, ti = excluded.ti, uc = excluded.uc, protegida = excluded.protegida, cnfp = excluded.cnfp,
       prodes = excluded.prodes, deter = excluded.deter, classificado_em = now()`,
    [JSON.stringify(linhas)],
  );
  return linhas.length;
}

// Equal-area projection for areas and the 10 km band: South America Albers (as the IBGE uses).
const ALBERS = '+proj=aea +lat_1=-2 +lat_2=-22 +lat_0=-12 +lon_0=-54 +ellps=GRS80 +units=m +no_defs';
const paraAlbers = (g: string) => `ST_Transform(${g}, 'EPSG:4326', '${ALBERS}', always_xy := true)`;
const deAlbers = (g: string) => `ST_Transform(${g}, '${ALBERS}', 'EPSG:4326', always_xy := true)`;
const simples = (g: string) => `ST_MakeValid(ST_SimplifyPreserveTopology(${paraAlbers(g)}, 100))`;

const pg2fgb = (saida: string, sql: string) => {
  rmSync(saida, { force: true }); // the FlatGeobuf driver cannot -overwrite an existing file
  execFileSync(
    'ogr2ogr',
    [
      '-overwrite',
      '-f',
      'FlatGeobuf',
      saida,
      'PG:',
      '-sql',
      `SELECT * FROM (${sql}) x WHERE NOT ST_IsEmpty(geom)`,
      '-nlt',
      'PROMOTE_TO_MULTI',
    ],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
};

/** duckdb on a database file, inside the memory budget of this PC (shared with other sessions: an OOM here took them down). */
const duck = (base: string, sql: string) => {
  execFileSync(
    'duckdb',
    [
      base,
      '-c',
      `INSTALL spatial; LOAD spatial; SET memory_limit = '1500MB'; SET threads = 2; SET preserve_insertion_order = false;
       SET temp_directory = '${base}.tmp'; ${sql}`,
    ],
    { stdio: 'inherit' },
  );
};

/** Writes `arquivo` through a .parcial file, so a run killed halfway never leaves a file that --reusar would trust. */
async function pronto(arquivo: string, reusar: boolean, fazer: (parcial: string) => Promise<void> | void) {
  if (reusar && existsSync(arquivo)) return;
  rmSync(`${arquivo}.parcial`, { force: true });
  await fazer(`${arquivo}.parcial`);
  renameSync(`${arquivo}.parcial`, arquivo);
}

/**
 * The series: every spot of both sensors, joined in duckdb year by year (all 12 million at once did not fit in this
 * PC's memory), PRODES from a local copy of the COG, summed per day.
 */
async function serie(db: pg.ClientBase, tmp: string, reusar: boolean) {
  const focos = join(tmp, 'focos.csv');
  // Reading ~12 million spots from ~1,700 raw files takes half an hour: --reusar keeps what a failed run left.
  await pronto(focos, reusar, async (parcial) => {
    const out = createWriteStream(parcial);
    out.write('id,lon,lat,dia,sensor,frp\n');
    let id = 0;
    for (const sensor of ['MODIS', 'VIIRS_SNPP'] as Sensor[])
      for await (const d of focosDaSerie(db, sensor))
        if (!out.write(`${id++},${d.lon},${d.lat},${diaDeManaus(new Date(d.em))},${sensor},${d.frp}\n`))
          await new Promise((r) => out.once('drain', r));
    await new Promise((r) => out.end(r));
    console.log(`${id} focos na série`);
  });

  const camadas = {
    mun: 'SELECT uf, geom FROM ibge.municipio',
    ti: 'SELECT geom FROM funai.terra_indigena',
    uc: 'SELECT grupo, geom FROM cnuc.unidade',
    cnfp: 'SELECT tipo, ano_criacao, geom FROM sfb.floresta_publica',
    deter: 'SELECT classe, view_date, geom FROM inpe_desmatamento.deter',
  };
  const t = (n: string) => `ST_Read('${join(tmp, `${n}.fgb`)}')`;
  const base = join(tmp, 'onde.duckdb');
  await pronto(base, reusar, (parcial) => {
    for (const [nome, sql] of Object.entries(camadas)) pg2fgb(join(tmp, `${nome}.fgb`), sql);
    duck(
      parcial,
      `CREATE TABLE f AS SELECT *, ST_Point(lon, lat) AS g FROM read_csv('${focos}', types = {'dia': 'DATE', 'sensor': 'VARCHAR'});
       CREATE TABLE mun AS SELECT * FROM ${t('mun')}; CREATE TABLE ti AS SELECT * FROM ${t('ti')};
       CREATE TABLE uc AS SELECT * FROM ${t('uc')}; CREATE TABLE cnfp AS SELECT * FROM ${t('cnfp')};
       CREATE TABLE deter AS SELECT * FROM ${t('deter')};`,
    );
    // Each TI and UC buffered by 10 km on its own (no union): a spot in any buffer and in no TI or UC is in the band.
    // Simplified by 100 m first and on one thread: the raw outlines took this step past 2.4 GB.
    duck(
      parcial,
      `SET threads = 1; CREATE TABLE faixa AS SELECT ${deAlbers(`ST_Buffer(ST_SimplifyPreserveTopology(${paraAlbers('geom')}, 100), 10000)`)} AS geom
         FROM (SELECT geom FROM ti UNION ALL SELECT geom FROM uc);`,
    );
  });

  const soma = somadorOnde();
  let n = 0;
  for (let ano = 2000; ano <= new Date().getUTCFullYear(); ano++) {
    const juntos = join(tmp, `juntos_${ano}.csv`);
    const valores = join(tmp, `prodes_${ano}.txt`);
    // One temp table per dimension, one after the other: the peak is one spatial join of one year.
    await pronto(juntos, reusar, (parcial) =>
      duck(
        base,
        `CREATE TEMP TABLE y AS SELECT * FROM f WHERE year(dia) = ${ano};
         CREATE TEMP TABLE d AS SELECT * FROM deter WHERE view_date BETWEEN DATE '${ano}-01-01' - ${JANELA_DETER_DIAS} AND DATE '${ano}-12-31';
         CREATE TEMP TABLE j_uf AS SELECT y.id, any_value(m.uf) AS uf FROM y JOIN mun m ON ST_Intersects(m.geom, y.g) GROUP BY y.id;
         CREATE TEMP TABLE j_ti AS SELECT DISTINCT y.id FROM y JOIN ti ON ST_Intersects(ti.geom, y.g);
         CREATE TEMP TABLE j_uc AS SELECT y.id, string_agg(DISTINCT uc.grupo, '|') AS uc FROM y JOIN uc ON ST_Intersects(uc.geom, y.g) GROUP BY y.id;
         CREATE TEMP TABLE j_fx AS SELECT DISTINCT y.id FROM y JOIN faixa x ON ST_Intersects(x.geom, y.g);
         CREATE TEMP TABLE j_cn AS SELECT y.id, string_agg(DISTINCT c.tipo || ':' || coalesce(c.ano_criacao::varchar, ''), '|') AS cnfp
           FROM y JOIN cnfp c ON ST_Intersects(c.geom, y.g) GROUP BY y.id;
         -- Spatial join first, the date window after: together, duckdb ran a date-range join (every spot × every alert of
         -- 90 days) and a year took ~50 min instead of ~1.
         CREATE TEMP TABLE j_dt0 AS SELECT y.id, y.dia, d.classe, d.view_date FROM y JOIN d ON ST_Intersects(d.geom, y.g);
         CREATE TEMP TABLE j_dt AS SELECT id, string_agg(DISTINCT classe, '|') AS deter FROM j_dt0
           WHERE view_date BETWEEN dia - ${JANELA_DETER_DIAS} AND dia GROUP BY id;
         COPY (
           SELECT y.id, y.dia, y.sensor, y.frp, y.lon, y.lat, j_uf.uf, j_ti.id IS NOT NULL AS ti, j_uc.uc, j_fx.id IS NOT NULL AS faixa,
             j_cn.cnfp, j_dt.deter
           FROM y LEFT JOIN j_uf USING (id) LEFT JOIN j_ti USING (id) LEFT JOIN j_uc USING (id) LEFT JOIN j_fx USING (id)
             LEFT JOIN j_cn USING (id) LEFT JOIN j_dt USING (id)
           ORDER BY y.id) TO '${parcial}' (FORMAT csv, HEADER, DELIMITER ',');`,
      ),
    );
    // PRODES: every spot of the year in one gdallocationinfo run, in the same order (lon, lat are columns 5 and 6).
    const cog = join(tmp, 'prodes.tif');
    await pronto(cog, true, async (parcial) => pipeline(await openRaw(prodesChave()), createWriteStream(parcial)));
    await pronto(
      valores,
      reusar,
      (parcial) =>
        new Promise<void>((ok, falha) => {
          const p = spawn('sh', [
            '-c',
            `tail -n +2 '${juntos}' | cut -d, -f5,6 | tr , ' ' | gdallocationinfo -valonly -wgs84 '${cog}' > '${parcial}'`,
          ]);
          p.on('exit', () => ok()); // exit 1 when a spot is off the raster; the line count is checked below
          p.on('error', falha);
        }),
    );

    const [lj, lp] = [juntos, valores].map((f) => createInterface({ input: createReadStream(f) })[Symbol.asyncIterator]());
    await lj.next(); // header
    let k = 0;
    for (let j = await lj.next(); !j.done; j = await lj.next(), k++) {
      const p = await lp.next();
      if (p.done) throw new Error(`PRODES de ${ano} terminou antes dos focos (linha ${k})`);
      const [, dia, sensor, frp, , , uf, ti, uc, faixa, cnfp, deter] = j.value.split(',');
      const c = classificar(
        {
          uf: uf || null,
          ti: ti === 'true',
          uc: lista(uc),
          faixa: faixa === 'true',
          cnfp: lista(cnfp),
          deter: lista(deter),
          prodes: p.value.trim() === '' ? null : Number(p.value),
        },
        dia,
      );
      soma.somar(dia, sensor, c, Number(frp));
    }
    if (!(await lp.next()).done) throw new Error(`PRODES de ${ano} tem mais linhas que os focos`);
    if (k) console.log(`${ano}: ${k} focos`);
    n += k;
  }
  const linhas = soma.linhas();
  await db.query('BEGIN');
  await db.query('DELETE FROM analise.onde_queimou_dia');
  for (let i = 0; i < linhas.length; i += 50_000)
    await db.query(`INSERT INTO analise.onde_queimou_dia SELECT * FROM json_populate_recordset(NULL::analise.onde_queimou_dia, $1::json)`, [
      JSON.stringify(linhas.slice(i, i + 50_000)),
    ]);
  await db.query('COMMIT');
  console.log(`analise.onde_queimou_dia: ${linhas.length} linhas de ${n} focos`);
}

/** Areas per state and category (the density denominators): static layers in duckdb, PRODES by zonal sums. */
async function areas(db: pg.ClientBase, tmp: string) {
  const cog = r2Raster(prodesChave()); // the COG on R2 has the overviews the coarse read uses
  // Static layers per state, in duckdb on this PC (unions and the band are too heavy for the slice database).
  const ufs = UFS.map((u) => `'${u}'`).join(',');
  const t = (n: string) => `ST_Read('${join(tmp, `${n}.fgb`)}')`;
  const csvAreas = join(tmp, 'areas.csv');
  const base = join(tmp, 'areas.duckdb');
  rmSync(base, { force: true });
  duck(
    base,
    // Outlines simplified by 100 m before the unions, on one thread: the raw ones took this step past 2.4 GB, and the
    // error on an area of thousands of km² is far below 1%.
    `SET threads = 1;
       CREATE TABLE ufg AS SELECT uf, ${simples(`ST_Intersection(ST_Union_Agg(geom), ST_MakeEnvelope(${BBOX.oeste}, ${BBOX.sul}, ${BBOX.leste}, ${BBOX.norte}))`)} AS g
         FROM ${t('mun')} WHERE uf IN (${ufs}) GROUP BY uf;
       CREATE TABLE ti AS SELECT ${simples('geom')} AS g FROM ${t('ti')};
       CREATE TABLE uc AS SELECT grupo, ${simples('geom')} AS g FROM ${t('uc')};
       CREATE TABLE cnfp AS SELECT tipo || ':' || coalesce(ano_criacao::varchar, '') AS peca, ${simples('geom')} AS g FROM ${t('cnfp')};
       CREATE TABLE camada AS
         SELECT 'ti' AS d, 'sim' AS c, ST_Union_Agg(g) AS g FROM ti
         UNION ALL SELECT 'uc', 'protecao_integral', ST_Union_Agg(g) FROM uc WHERE grupo = 'Proteção Integral'
         UNION ALL SELECT 'uc', 'uso_sustentavel', ST_Union_Agg(g) FROM uc WHERE grupo <> 'Proteção Integral'
         UNION ALL SELECT 'protegida', 'sim', ST_Union_Agg(g) FROM (SELECT g FROM ti UNION ALL SELECT g FROM uc);`,
  );
  // One duckdb process per step: in a single one the memory piled up past the limit; the buffer alone peaks at ~1.8 GB.
  duck(
    base,
    `SET threads = 1; INSERT INTO camada SELECT 'protegida', 'faixa_10km', ST_Difference(ST_Buffer(g, 10000), g) FROM camada WHERE d = 'protegida';`,
  );
  duck(
    base,
    `COPY (
         SELECT u.uf, c.d AS dimensao, c.c AS categoria, ST_Area(ST_Intersection(u.g, c.g)) / 1e6 AS km2 FROM ufg u, camada c
         UNION ALL SELECT uf, 'total', 'total', ST_Area(g) / 1e6 FROM ufg
         UNION ALL SELECT u.uf, 'cnfp_peca', x.peca, sum(ST_Area(ST_Intersection(u.g, x.g))) / 1e6 FROM ufg u JOIN cnfp x ON ST_Intersects(u.g, x.g)
           GROUP BY 1, 2, 3
       ) TO '${csvAreas}' (HEADER, DELIMITER ',');`,
  );
  const lidas = (await readFile(csvAreas, 'utf8'))
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => l.split(','))
    .map(([uf, dimensao, categoria, km2]) => ({ uf, dimensao, categoria, km2: Number(km2) }));
  const estaticas = lidas.filter((r) => r.dimensao !== 'cnfp_peca');
  const cnfp = lidas.filter((r) => r.dimensao === 'cnfp_peca').map((r) => ({ uf: r.uf, peca: r.categoria, km2: r.km2 }));

  // PRODES classes per state, at 16× the COG pixel (~320 m, read from an overview; sampling is enough for a denominator).
  const info = JSON.parse(execFileSync('gdalinfo', ['-json', cog], { env: gdalR2Env() }).toString());
  const [ox, px, , oy] = info.geoTransform;
  const g = { oeste: ox, norte: oy, pixel: px * 16 };
  const e = encaixar(g, BBOX);
  const reduzido = join(tmp, 'prodes_reduzido.vrt');
  execFileSync(
    'gdalbuildvrt',
    [
      '-q',
      '-r',
      'nearest',
      '-a_srs', // the COG is SIRGAS 2000, the zones WGS 84: the same to within centimetres
      'EPSG:4326',
      '-te',
      ...[e.oeste, e.sul, e.leste, e.norte].map(String),
      '-tr',
      String(g.pixel),
      String(g.pixel),
      reduzido,
      cog,
    ],
    { env: gdalR2Env() },
  );
  await writeFile(join(tmp, 'peso_prodes.asc'), pesoPorLinha(e, g.pixel));
  await writeFile(join(tmp, 'peso_prodes.vrt'), vrtPeso(join(tmp, 'peso_prodes.asc'), e, g.pixel));
  const fixas = zonasFixas(tmp, e, g.pixel, 'prodes');
  const zonas = join(tmp, 'zonas_prodes.vrt');
  execFileSync(
    'gdal',
    [
      'raster',
      'calc',
      '-q',
      '--overwrite',
      '-i',
      `P=${reduzido}`,
      '-i',
      `Z=${fixas}`,
      '--ot',
      'UInt32',
      '-f',
      'VRT',
      '-o',
      zonas,
      '--calc',
      'Z*1000+P',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'], env: gdalR2Env() },
  );
  const csv = await somar(tmp, zonas, join(tmp, 'peso_prodes.vrt'), 'prodes_uf');
  const porClasse: { uf: string; classe: number; km2: number }[] = [];
  for (const l of csv.trim().split('\n').slice(1)) {
    const [v, s] = l.split(',').map(Number);
    const uf = Math.floor(((v / 1000) % 10000) / 100);
    if (uf && s) porClasse.push({ uf: UFS[uf - 1], classe: v % 1000, km2: s / 100 });
    if (s && Math.floor(v / 1000) >= 10000) porClasse.push({ uf: '800km', classe: v % 1000, km2: s / 100 }); // the ring, any state
  }

  const linhas = [];
  for (let ano = 2001; ano <= new Date().getUTCFullYear(); ano++) {
    for (const r of estaticas) linhas.push({ ano, ...r });
    const porCnfp = new Map<string, number>();
    for (const c of cnfp) {
      const k = `${c.uf}|${categoriaCnfp([c.peca], ano)}`;
      porCnfp.set(k, (porCnfp.get(k) ?? 0) + c.km2);
    }
    for (const [k, km2] of porCnfp) {
      const [uf, categoria] = k.split('|');
      linhas.push({ ano, uf, dimensao: 'cnfp', categoria, km2 });
    }
    const soma = new Map<string, number>();
    // The category of a pixel in a year: as for a spot on the 1st of July (end of the PRODES year).
    for (const p of porClasse) {
      const k = `${p.uf}|${categoriaProdes(p.classe, `${ano}-07-01`)}`;
      soma.set(k, (soma.get(k) ?? 0) + p.km2);
    }
    for (const [k, km2] of soma) {
      const [uf, categoria] = k.split('|');
      linhas.push({ ano, uf, dimensao: 'prodes', categoria, km2 });
    }
  }
  await db.query('BEGIN');
  await db.query('DELETE FROM analise.area_categoria_ano');
  await db.query(
    `INSERT INTO analise.area_categoria_ano SELECT * FROM json_populate_recordset(NULL::analise.area_categoria_ano, $1::json)`,
    [JSON.stringify(linhas)],
  );
  await db.query('COMMIT');
  console.log(`analise.area_categoria_ano: ${linhas.length} linhas`);
}

/** Yearly totals per state and category → produtos/fumaca/onde-queimou.csv. */
async function produto(db: pg.ClientBase, tmp: string) {
  const { rows } = await db.query(
    `SELECT extract(year FROM dia)::int AS ano, sensor, uf, dimensao, categoria, sum(focos)::int AS focos, round(sum(frp))::int AS frp
     FROM analise.onde_queimou_dia GROUP BY 1, 2, 3, 4, 5 ORDER BY 1, 2, 3, 4, 5`,
  );
  const csv = join(tmp, 'onde-queimou.csv');
  await writeFile(csv, ['ano,sensor,uf,dimensao,categoria,focos,frp', ...rows.map((r) => Object.values(r).join(','))].join('\n') + '\n');
  await enviar(csv, 'produtos/fumaca/onde-queimou.csv', { sobrescrever: true });
  console.log(`produtos/fumaca/onde-queimou.csv: ${rows.length} linhas`);
}

async function principal(args: string[]) {
  if (args[0] === '--dia') {
    const db = new pg.Client();
    await db.connect();
    try {
      const { rows } = await db.query(`SELECT foco FROM analise.fumaca_foco WHERE dia = $1 AND versao = 'v1'`, [args[1]]);
      console.log(
        `${args[1]}: ${await classificarFocos(
          db,
          rows.map((r) => Number(r.foco)),
        )} focos da v1 classificados`,
      );
    } finally {
      await db.end();
    }
    return;
  }
  if (!args.includes('--serie')) throw new Error('uso: node analise/fogo/onde-queimou.ts --serie [--reusar] | --dia AAAA-MM-DD');
  const tmp = join(process.env.MANAUS_BUFFER || tmpdir(), 'onde-queimou');
  await mkdir(tmp, { recursive: true });
  const db = new pg.Client();
  await db.connect();
  try {
    if (!args.includes('--sem-serie')) await serie(db, tmp, args.includes('--reusar')); // --sem-serie: only areas and product
    await areas(db, tmp);
    await produto(db, tmp);
    await rm(tmp, { recursive: true, force: true }); // kept after a failure, for --reusar
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
