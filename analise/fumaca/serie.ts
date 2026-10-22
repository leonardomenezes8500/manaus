// Smoke series 2012–2026 (#55): analise.serie_dia → produtos/fumaca/serie-2012-2026.csv (one day per line) and
// serie-2012-2026.md (one year per line). One-off on this PC: node analise/fumaca/serie.ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { enviar } from '../../coleta/lib/baixar.ts';

export type DiaSerie = {
  dia: string;
  horas_fu: number | null;
  horas_hz: number | null;
  vis_min_sem_chuva_m: number | null;
  metar_obs: number | null;
  focos_800km: number | null;
  frp_800km: number | null;
  cota_cm: number | null;
  aod_aeronet: number | null;
  aod_maiac: number | null;
};

const soma = (xs: (number | null)[]) => (xs.some((x) => x !== null) ? xs.reduce<number>((a, x) => a + (x ?? 0), 0) : null);
const media = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 1000) / 1000 : null;
};

/** One line per year. The season is August to November. A year (or column) without any data is null, never zero. */
export function resumoAnual(dias: DiaSerie[]) {
  const anos = [...new Set(dias.map((d) => Number(d.dia.slice(0, 4))))].sort();
  return anos.map((ano) => {
    const doAno = dias.filter((d) => Number(d.dia.slice(0, 4)) === ano);
    const comMetar = doAno.filter((d) => d.metar_obs);
    const temporada = doAno.filter((d) => d.dia.slice(5, 7) >= '08' && d.dia.slice(5, 7) <= '11');
    const setOut = doAno.filter((d) => d.dia.slice(5, 7) === '09' || d.dia.slice(5, 7) === '10');
    const cotas = doAno.map((d) => d.cota_cm).filter((x): x is number => x !== null);
    return {
      ano,
      dias_fu: comMetar.length ? comMetar.filter((d) => (d.horas_fu ?? 0) > 0).length : null,
      dias_vis_5km: comMetar.length ? comMetar.filter((d) => d.vis_min_sem_chuva_m !== null && d.vis_min_sem_chuva_m < 5000).length : null,
      focos_ago_nov: soma(temporada.map((d) => d.focos_800km)),
      frp_ago_nov: soma(temporada.map((d) => d.frp_800km)),
      cota_min_m: cotas.length ? Math.min(...cotas) / 100 : null,
      aod_set_out: media(setOut.map((d) => d.aod_aeronet)),
    };
  });
}

const f = (v: number | null, casas = 0) => (v === null ? '—' : v.toFixed(casas).replace('.', ','));

async function principal() {
  const db = new pg.Client();
  await db.connect();
  try {
    const dias: DiaSerie[] = (
      await db.query(
        `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, horas_fu, horas_hz, vis_min_sem_chuva_m, metar_obs, focos_800km, frp_800km, cota_cm,
                aod_aeronet, angstrom_440_870, aeronet_site, aod_maiac FROM analise.serie_dia ORDER BY dia`,
      )
    ).rows;
    const anos = resumoAnual(dias);
    const csv = [
      'dia,horas_fu,horas_hz,vis_min_sem_chuva_m,metar_obs,focos_800km,frp_800km,cota_cm,aod_aeronet,angstrom_440_870,aeronet_site,aod_maiac',
      ...dias.map((d: any) =>
        Object.values(d)
          .map((v) => (v === null ? '' : v))
          .join(','),
      ),
    ].join('\n');
    const md = [
      '# Fumaça em Manaus: série 2012–2026',
      '',
      'Um ano por linha. Tudo é medição: METAR do aeroporto Eduardo Gomes (FU = fumaça; visibilidade sem chuva nem névoa), focos VIIRS S-NPP a até 800 km (FIRMS), cota do Rio Negro (ANA 14990000), AOD do AERONET (Manaus_EMBRAPA ou ATTO). Temporada = agosto a novembro. "—" = sem dado (não é zero).',
      '',
      '| ano | dias com FU | dias com visibilidade < 5 km | focos ago–nov | FRP ago–nov (GW) | cota mínima (m) | AOD set–out |',
      '|---|---|---|---|---|---|---|',
      ...anos.map(
        (a) =>
          `| ${a.ano} | ${f(a.dias_fu)} | ${f(a.dias_vis_5km)} | ${f(a.focos_ago_nov)} | ${f(a.frp_ago_nov === null ? null : a.frp_ago_nov / 1000, 1)} | ${f(a.cota_min_m, 2)} | ${f(a.aod_set_out, 2)} |`,
      ),
      '',
      'Dia a dia: `serie-2012-2026.csv`.',
      '',
    ].join('\n');
    const dir = await mkdtemp(join(tmpdir(), 'serie-'));
    try {
      for (const [nome, texto] of [
        ['serie-2012-2026.csv', csv + '\n'],
        ['serie-2012-2026.md', md],
      ]) {
        await writeFile(join(dir, nome), texto);
        await enviar(join(dir, nome), `produtos/fumaca/${nome}`, { sobrescrever: true });
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    console.log(md);
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
