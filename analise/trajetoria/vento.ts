// Wind reader (#49): GRIB files of ERA5 (GRIB1: U/V/W, level in hPa) or GFS (GRIB2: UGRD/VGRD/VVEL, level in Pa)
// → one grid in memory. gdalinfo -json gives each band's field, level and time; gdal_translate -of ENVI gives the numbers.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { novaGrade, type Grade } from './grade.ts';

const CAMPO: Record<string, 'u' | 'v' | 'w'> = { U: 'u', V: 'v', W: 'w', UGRD: 'u', VGRD: 'v', VVEL: 'w' };

type Banda = { campo: 'u' | 'v' | 'w'; hpa: number; t: number; valores: Float32Array };

function bandasDe(arquivo: string, tmp: string): { gt: number[]; nx: number; ny: number; bandas: Banda[] } {
  const info = JSON.parse(execFileSync('gdalinfo', ['-json', arquivo], { maxBuffer: 64 << 20 }).toString());
  const bin = join(tmp, 'b.bin');
  execFileSync('gdal_translate', ['-q', '-of', 'ENVI', '-ot', 'Float32', arquivo, bin]);
  const todos = readFileSync(bin);
  const [nx, ny] = info.size;
  const bandas: Banda[] = [];
  info.bands.forEach((b: any, i: number) => {
    const m = b.metadata[''];
    const campo = CAMPO[m.GRIB_ELEMENT];
    const nivel = String(b.description).match(/^(\d+)\[(h?Pa)\]/);
    if (!campo || !nivel) return;
    const hpa = nivel[2] === 'Pa' ? Number(nivel[1]) / 100 : Number(nivel[1]);
    const ini = i * nx * ny * 4;
    bandas.push({
      campo,
      hpa,
      t: parseInt(m.GRIB_VALID_TIME) * 1000,
      valores: new Float32Array(todos.buffer.slice(todos.byteOffset + ini, todos.byteOffset + ini + nx * ny * 4)),
    });
  });
  return { gt: info.geoTransform, nx, ny, bandas };
}

/** Every file must have the same grid. A time without all three fields on every level is left out. */
export function lerGribs(arquivos: string[]): Grade {
  const tmp = mkdtempSync(join(tmpdir(), 'vento-'));
  try {
    let base: { gt: number[]; nx: number; ny: number } | undefined;
    const por = new Map<string, Float32Array>(); // `${t}|${hpa}|${campo}`
    for (const a of arquivos) {
      const { gt, nx, ny, bandas } = bandasDe(a, tmp);
      base ??= { gt, nx, ny };
      if (gt.join() !== base.gt.join() || nx !== base.nx || ny !== base.ny) throw new Error(`grade diferente em ${a}`);
      for (const b of bandas) por.set(`${b.t}|${b.hpa}|${b.campo}`, b.valores);
    }
    if (!base) throw new Error('nenhum arquivo de vento');
    const chaves = [...por.keys()].map((k) => k.split('|'));
    const niveis = [...new Set(chaves.map((k) => Number(k[1])))].sort((a, b) => a - b);
    const completo = (t: number) => niveis.every((n) => ['u', 'v', 'w'].every((c) => por.has(`${t}|${n}|${c}`)));
    const tempos = [...new Set(chaves.map((k) => Number(k[0])))].filter(completo).sort((a, b) => a - b);
    const { gt, nx, ny } = base;
    const g = novaGrade({ lon0: gt[0] + gt[1] / 2, lat0: gt[3] + gt[5] / 2, dlon: gt[1], dlat: gt[5], nx, ny, niveis, tempos });
    tempos.forEach((t, it) =>
      niveis.forEach((n, ik) => {
        for (const c of ['u', 'v', 'w'] as const) g[c].set(por.get(`${t}|${n}|${c}`)!, (it * niveis.length + ik) * nx * ny);
      }),
    );
    return g;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
