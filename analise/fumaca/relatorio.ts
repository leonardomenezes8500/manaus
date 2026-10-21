// Daily smoke report (#18): analise.fumaca_dia → produtos/fumaca/AAAA-MM-DD/ in R2 (relatorio.md, atribuicao.json,
// focos.geojson, mapa.html). Runs the attribution first.
//   node analise/fumaca/relatorio.ts --ontem               closes yesterday (cron 08h)
//   node analise/fumaca/relatorio.ts --hoje                partial of today (cron 17h)
//   node analise/fumaca/relatorio.ts --dia 2026-10-21
//   node analise/fumaca/relatorio.ts --temporada 2026-08-01   every day until yesterday + temporada-2026.md (--resumo: only the .md)
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { enviar } from '../../coleta/lib/baixar.ts';
import { MANAUS } from '../../coleta/regiao.ts';
import { diaDeManaus } from '../dia.ts';
import { attributeDay, dayBounds, NOTE, VERSION } from './atribuir.ts';
import { PARAMS, WHO_DAILY_PM25 } from './heuristica.ts';

const COMPASS = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
/** Direction in words (Portuguese compass, 8 points). */
export const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

const n1 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toFixed(1).replace('.', ','));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const br = (dia: string) => dia.split('-').reverse().join('/');

export type DayRow = {
  dia: string; pm25_medido_media: number | null; pm25_medido_max: number | null; pm25_medido_horas: number;
  pm25_cams_media: number | null; pm25_cams_max: number | null; horas_fu_hz: number; visibilidade_min_m: number | null;
  vento: { de_graus: number; velocidade_kmh: number; constancia: number; horas_com_dado: number };
  focos_contados: number; ranking: { municipios: { nome: string | null; uf: string | null; parcela: number; focos: number }[] };
  confianca: string; sinais: Record<string, boolean>;
};

/** The report, at most 15 lines. `partial` = the day is not over yet. */
export function buildReport(r: DayRow, partial: boolean): string {
  const who = r.pm25_medido_media === null ? '' : `, ${n1(r.pm25_medido_media / WHO_DAILY_PM25)}× a diretriz diária da OMS (${WHO_DAILY_PM25} µg/m³)`;
  const top = r.ranking.municipios.slice(0, 3).map((m, i) => `${i + 1}. ${m.nome ?? '?'}${m.uf ? '/' + m.uf : ''}: ${pct(m.parcela)} (${m.focos} focos)`);
  const signals = [
    r.sinais.steadyWind ? 'vento constante' : 'vento mudou no dia',
    r.sinais.spotsInSector ? 'há focos no setor do vento' : 'poucos focos no setor',
    r.sinais.measuredAndModelAgree ? 'medido e modelo concordam' : 'medido e modelo não concordam (ou falta dado)',
  ];
  return [
    `# Fumaça em Manaus: ${br(r.dia)}${partial ? ' (parcial, até as 17h)' : ''}`,
    '',
    `- **Ar medido** (1 sensor barato no Centro, OpenAQ): PM2.5 médio ${n1(r.pm25_medido_media)} µg/m³, máximo ${n1(r.pm25_medido_max)} (${r.pm25_medido_horas} h com dado)${who}.`,
    `- **Ar no modelo** (CAMS, não é medição): PM2.5 médio ${n1(r.pm25_cams_media)} µg/m³, máximo ${n1(r.pm25_cams_max)}.`,
    `- **Aeroporto Eduardo Gomes:** ${r.horas_fu_hz} h com fumaça ou névoa seca (FU/HZ); visibilidade mínima ${r.visibilidade_min_m === null ? '—' : n1(r.visibilidade_min_m / 1000) + ' km'}.`,
    `- **Vento** (925/850 hPa, modelo): de ${compass(r.vento.de_graus)} (${Math.round(r.vento.de_graus)}°), ${Math.round(r.vento.velocidade_kmh)} km/h.`,
    `- **De onde veio** (${r.focos_contados} focos contados):`,
    ...(top.length ? top.map((t) => `  ${t}`) : ['  nenhum foco no setor do vento.']),
    `- **Quanto confiar:** ${r.confianca} (${signals.join('; ')}).`,
    '',
    `_${NOTE}_ Mapa: \`mapa.html\`. Dados: \`atribuicao.json\`, \`focos.geojson\`.`,
  ].join('\n');
}

export type SpotOut = { lat: number; lon: number; peso: number; frp: number; em: string; municipio: string | null; distancia_km: number };

export const buildGeojson = (spots: SpotOut[]) => ({
  type: 'FeatureCollection',
  features: spots.map(({ lat, lon, ...p }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: p })),
});

/** Wind sector: from Manaus toward where the wind comes from, ±sectorDeg, out to maxKm. [lat, lon] pairs. */
export function sector(fromDeg: number): [number, number][] {
  const pts: [number, number][] = [[MANAUS.lat, MANAUS.lon]];
  for (let a = fromDeg - PARAMS.sectorDeg; a <= fromDeg + PARAMS.sectorDeg; a += 5) {
    const r = (a * Math.PI) / 180;
    const dLat = (PARAMS.maxKm / 111.19) * Math.cos(r);
    const dLon = (PARAMS.maxKm / (111.19 * Math.cos((MANAUS.lat * Math.PI) / 180))) * Math.sin(r);
    pts.push([MANAUS.lat + dLat, MANAUS.lon + dLon]);
  }
  pts.push([MANAUS.lat, MANAUS.lon]);
  return pts;
}

/** Self-contained Leaflet page (no build), data embedded. Spot times are ISO UTC; the page shows them in Manaus time. */
export function buildMap(r: DayRow, spots: SpotOut[]): string {
  const data = JSON.stringify({ manaus: MANAUS, sector: sector(r.vento.de_graus), spots, r: { dia: r.dia, medido: r.pm25_medido_media, cams: r.pm25_cams_media } }).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fumaça em Manaus ${br(r.dia)}</title>
<link rel="preconnect" href="https://unpkg.com">
<link rel="preconnect" href="https://tile.openstreetmap.org">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#mapa{height:100%;margin:0;font-family:system-ui,sans-serif}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.nota{background:#fff;padding:6px 8px;border-radius:4px;max-width:320px;font-size:13px;line-height:1.35;text-wrap:pretty}
</style>
</head><body>
<h1 class="sr">Fumaça em Manaus, ${br(r.dia)}: de onde veio</h1>
<div id="mapa" role="region" aria-label="Mapa dos focos de calor e do setor do vento"></div>
<script>
const d = ${data};
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const f = (v) => (v === null ? '—' : num.format(v));
const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Manaus', dateStyle: 'short', timeStyle: 'short' });
const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(d.r.dia + 'T00:00:00Z'));
const mapa = L.map('mapa');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap' }).addTo(mapa);
const setor = L.polygon(d.sector, { color: '#2563eb', weight: 1, fillOpacity: 0.08 }).addTo(mapa)
  .bindTooltip('Setor de onde o vento veio (±${PARAMS.sectorDeg}°, até ${PARAMS.maxKm} km)');
mapa.fitBounds(setor.getBounds(), { padding: [12, 12] });
// Colour and size by rank, so one very strong spot does not flatten the others; heaviest drawn last (on top).
const ordered = [...d.spots].sort((a, b) => a.peso - b.peso);
ordered.forEach((s, i) => {
  const t = ordered.length > 1 ? i / (ordered.length - 1) : 1;
  const cor = 'rgb(' + Math.round(250 - 65 * t) + ',' + Math.round(204 - 176 * t) + ',' + Math.round(21 + 7 * t) + ')';
  L.circleMarker([s.lat, s.lon], { radius: 3 + 7 * t, color: '#7f1d1d', weight: 0.5, fillColor: cor, fillOpacity: 0.85 })
    .addTo(mapa).bindPopup((s.municipio ?? 'fora do Brasil') + '<br>peso ' + f(s.peso) + ' · FRP ' + f(s.frp) + ' MW<br>' + hora.format(new Date(s.em)) + ' · ' + f(s.distancia_km) + ' km');
});
const ar = '<b>Manaus, ' + dia + '</b><br>PM2.5 medido (sensor barato): ' + f(d.r.medido) + ' µg/m³<br>PM2.5 CAMS (modelo): ' + f(d.r.cams) + ' µg/m³';
L.marker([d.manaus.lat, d.manaus.lon], { title: 'Manaus', alt: 'Manaus' }).addTo(mapa).bindPopup(ar);
const nota = L.control({ position: 'bottomleft' });
nota.onAdd = () => Object.assign(L.DomUtil.create('div', 'nota'), {
  innerHTML: ar + '<br><small>Círculo maior e mais vermelho = foco com mais peso no dia (amarelo = menos). ' + ${JSON.stringify(NOTE)} + ' Lista completa em focos.geojson.</small>',
});
nota.addTo(mapa);
</script></body></html>
`;
}

/** temporada-2026.md: one line per day. */
export function buildSeason(rows: DayRow[]): string {
  const lines = rows.map((r) => `| ${r.dia} | ${n1(r.pm25_medido_media)} | ${n1(r.pm25_cams_media)} | ${r.horas_fu_hz} | ${r.ranking.municipios.slice(0, 3).map((m) => `${m.nome ?? '?'}${m.uf ? '/' + m.uf : ''} ${pct(m.parcela)}`).join(', ') || '—'} |`);
  return [
    '# Fumaça em Manaus: temporada 2026',
    '',
    `PM2.5 medido = 1 sensor barato no Centro (OpenAQ); CAMS = modelo. FU/HZ = horas com fumaça ou névoa seca no aeroporto Eduardo Gomes. ${NOTE}`,
    '',
    '| dia | PM2.5 medido (µg/m³) | PM2.5 CAMS (µg/m³) | horas FU/HZ | 3 municípios do topo |',
    '|---|---|---|---|---|',
    ...lines,
    '',
  ].join('\n');
}

/** Stored days between two dates, oldest first, with `dia` as text (YYYY-MM-DD). */
export async function seasonRows(db: pg.ClientBase, first: string, last: string): Promise<DayRow[]> {
  return (await db.query(
    `SELECT f.*, to_char(f.dia, 'YYYY-MM-DD') AS dia FROM analise.fumaca_dia f WHERE f.versao = $1 AND f.dia BETWEEN $2 AND $3 ORDER BY f.dia`,
    [VERSION, first, last],
  )).rows;
}

async function readDay(db: pg.ClientBase, dia: string): Promise<DayRow> {
  const r = (await db.query(`SELECT *, to_char(dia, 'YYYY-MM-DD') AS dia FROM analise.fumaca_dia WHERE dia = $1 AND versao = $2`, [dia, VERSION])).rows[0];
  return r;
}

async function readSpots(db: pg.ClientBase, dia: string): Promise<SpotOut[]> {
  return (await db.query(
    `SELECT f.lat, f.lon, ff.peso, coalesce(f.frp, 0) AS frp, to_char(f.adquirido_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS em,
            m.nome || '/' || m.uf AS municipio, ff.distancia_km
     FROM analise.fumaca_foco ff JOIN firms.foco f ON f.id = ff.foco LEFT JOIN ibge.municipio m ON m.codigo = f.municipio
     WHERE ff.dia = $1 AND ff.versao = $2 ORDER BY ff.peso DESC`, [dia, VERSION])).rows;
}

async function publish(files: Record<string, string>, prefix: string) {
  const dir = await mkdtemp(join(tmpdir(), 'fumaca-'));
  try {
    for (const [name, text] of Object.entries(files)) {
      await writeFile(join(dir, name), text);
      await enviar(join(dir, name), `${prefix}/${name}`, { sobrescrever: true });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function reportDay(db: pg.ClientBase, dia: string, partial: boolean) {
  await attributeDay(db, dia);
  const row = await readDay(db, dia);
  const spots = await readSpots(db, dia);
  await publish({
    'relatorio.md': buildReport(row, partial) + '\n',
    'atribuicao.json': JSON.stringify({ ...row, parcial: partial, parametros: PARAMS }, null, 1),
    'focos.geojson': JSON.stringify(buildGeojson(spots)),
    'mapa.html': buildMap(row, spots),
  }, `produtos/fumaca/${dia}`);
  console.log(`produtos/fumaca/${dia}/`, row.confianca, spots.length, 'focos');
}

async function main(args: string[]) {
  const db = new pg.Client();
  await db.connect();
  try {
    const now = new Date();
    if (args[0] === '--temporada' || args[0] === '--resumo') {
      const first = args[1] ?? '2026-08-01';
      const last = diaDeManaus(new Date(now.getTime() - 86_400_000));
      // --resumo: only the season table, from the days already stored.
      if (args[0] === '--temporada') for (let t = Date.parse(first); t <= Date.parse(last); t += 86_400_000) await reportDay(db, new Date(t).toISOString().slice(0, 10), false);
      const rows = await seasonRows(db, first, last);
      await publish({ [`temporada-${first.slice(0, 4)}.md`]: buildSeason(rows) }, 'produtos/fumaca');
      return console.log(`produtos/fumaca/temporada-${first.slice(0, 4)}.md`, rows.length, 'dias');
    }
    if (args[0] === '--hoje') return await reportDay(db, diaDeManaus(now), true);
    if (args[0] === '--ontem') return await reportDay(db, diaDeManaus(new Date(now.getTime() - 86_400_000)), false);
    if (args[0] === '--dia' && /^\d{4}-\d{2}-\d{2}$/.test(args[1] ?? '')) return await reportDay(db, args[1], dayBounds(args[1]).end > now);
    throw new Error('usage: relatorio.ts --ontem | --hoje | --dia AAAA-MM-DD | --temporada AAAA-MM-DD');
  } finally {
    await db.end();
  }
}

if (import.meta.main) main(process.argv.slice(2)).catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
