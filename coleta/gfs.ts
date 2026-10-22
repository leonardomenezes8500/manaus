// GFS 0.5° (#48): wind on pressure levels for the last days, from the NOMADS filter (no key), clipped to the smoke
// region, checked as GRIB, then into the raw files with guardar(). Same fields, levels and grid as ERA5 (#47), so the trajectory reader
// (#49) reads both the same way. GFS is a model (modeled, provisional): the day is redone with ERA5 when it comes out.
//   node coleta/gfs.ts                      slice cron 4x/day: f000 and f003 of every ready run of the last 2 days
//   node coleta/gfs.ts --desde 2026-10-12   backfill what NOMADS still keeps (~10 days)
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guardar, listKeys } from './lib/baixar.ts';
import { tentar } from './lib/tentar.ts';
import { BBOX } from './regiao.ts';

const NIVEIS = [700, 800, 850, 900, 925, 950, 975, 1000];
const PASSOS = ['000', '003'] as const;
const HORA = 3_600_000;
const PRONTA_APOS = 4 * HORA; // NOMADS has the 0.5° files about 3.5 h after the run

type Arquivo = { rodada: string; passo: string }; // rodada = AAAAMMDDHH

export function urlGfs({ rodada, passo }: Arquivo): string {
  const q = new URLSearchParams({
    dir: `/gfs.${rodada.slice(0, 8)}/${rodada.slice(8)}/atmos`,
    file: `gfs.t${rodada.slice(8)}z.pgrb2full.0p50.f${passo}`,
  });
  for (const v of ['UGRD', 'VGRD', 'VVEL']) q.set(`var_${v}`, 'on');
  for (const n of NIVEIS) q.set(`lev_${n}_mb`, 'on');
  q.set('subregion', '');
  q.set('toplat', String(BBOX.norte));
  q.set('leftlon', String(BBOX.oeste));
  q.set('rightlon', String(BBOX.leste));
  q.set('bottomlat', String(BBOX.sul));
  return `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl?${q}`;
}

export const nomeBruto = ({ rodada, passo }: Arquivo) => `gfs_${rodada}_f${passo}.grib`;

/** Runs (00/06/12/18 UTC) from `desde` (day) that should be on NOMADS at `agora`. */
export function rodadasProntas(agora: Date, desde: string): string[] {
  const out = [];
  for (let t = Date.parse(desde + 'T00:00:00Z'); t + PRONTA_APOS <= agora.getTime(); t += 6 * HORA) {
    out.push(new Date(t).toISOString().slice(0, 13).replace(/\D/g, ''));
  }
  return out;
}

export function arquivosQueFaltam(chaves: string[], rodadas: string[]): Arquivo[] {
  const ja = new Set(chaves.map((k) => k.match(/(gfs_\d{10}_f\d{3}\.grib)$/)?.[1]));
  return rodadas.flatMap((rodada) => PASSOS.map((passo) => ({ rodada, passo }))).filter((a) => !ja.has(nomeBruto(a)));
}

export function conferirGrib(inicio: Buffer, chave: string): void {
  if (inicio.subarray(0, 4).toString() !== 'GRIB') throw new Error(`não é GRIB: ${chave}`);
}

async function principal(args: string[]) {
  const desde = args[0] === '--desde' ? args[1] : new Date(Date.now() - 24 * HORA).toISOString().slice(0, 10);
  if (!/^\d{4}-\d\d-\d\d$/.test(desde ?? '')) throw new Error('uso: --desde AAAA-MM-DD');
  const chaves = (await listKeys('bruto/noaa-gfs-nomads/')).map((k) => k.key);
  const faltam = arquivosQueFaltam(chaves, rodadasProntas(new Date(), desde));
  let falhas = 0;
  const tmp = await mkdtemp(join(tmpdir(), 'gfs-'));
  for (const a of faltam) {
    try {
      // Checked before it goes to the raw files: a saved HTML page would count as done and never be asked again.
      const corpo = await tentar(async () => {
        const res = await fetch(urlGfs(a));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      });
      conferirGrib(corpo, nomeBruto(a));
      const local = join(tmp, nomeBruto(a));
      await writeFile(local, corpo);
      const r = await guardar(local, {
        fonte: 'noaa-gfs-nomads',
        coletor: 'gfs',
        nome: nomeBruto(a),
        origem: urlGfs(a),
        parametros: { ...a, caixa: BBOX },
      });
      console.log(r.chave, r.bytes);
    } catch (e) {
      falhas++;
      console.error('ERRO', nomeBruto(a), (e as Error).message);
    }
  }
  await rm(tmp, { recursive: true, force: true });
  if (falhas) throw new Error(`${falhas} de ${faltam.length} arquivos falharam`);
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
