// Daily smoke report (#18, #50): analise.fumaca_dia → produtos/fumaca/AAAA-MM-DD/ in R2 (relatorio.md, atribuicao.json,
// focos.geojson, mapa.html). Runs the attribution first: v0 always (kept for the comparison, #51), then the day's
// trajectories and v1, which is what the report shows. Without wind for the trajectories, the report falls back to v0.
//   node analise/fumaca/relatorio.ts --refazer-era5        redo with ERA5 the recent days whose v1 is not on ERA5 yet
//   node analise/fumaca/relatorio.ts --ontem               closes yesterday (cron 08h)
//   node analise/fumaca/relatorio.ts --hoje                partial of today (cron 17h)
//   node analise/fumaca/relatorio.ts --dia 2026-10-21
//   node analise/fumaca/relatorio.ts --temporada 2026-08-01   every day until yesterday + temporada-2026.md (--resumo: only the .md)
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { enviar, listKeys } from '../../coleta/lib/baixar.ts';
import { MANAUS } from '../../coleta/regiao.ts';
import { diaDeManaus } from '../dia.ts';
import { apagarV1Parcial, attributeDay, dayBounds, NOTE, NOTE_V1, type Versao } from './atribuir.ts';
import { PARAMS, WHO_DAILY_PM25 } from './heuristica.ts';
import { PARAMS_V1 } from './v1.ts';
import { arquivosEra5, trajetoriasDoDia } from '../trajetoria/trajetorias.ts';

const COMPASS = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
/** Direction in words (Portuguese compass, 8 points). */
export const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

const n1 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toFixed(1).replace('.', ','));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const br = (dia: string) => dia.split('-').reverse().join('/');

type VentoV0 = { de_graus: number; velocidade_kmh: number; constancia: number; horas_com_dado: number };
type VentoV1 = {
  meteo: string;
  trajetorias: number;
  chegadas: number;
  concordancia_km: number | null;
  horas_media?: number;
  niveis: string;
};

export type DayRow = {
  dia: string;
  versao?: Versao;
  meteo?: string | null;
  pm25_medido_media: number | null;
  pm25_medido_max: number | null;
  pm25_medido_horas: number;
  pm25_cams_media: number | null;
  pm25_cams_max: number | null;
  horas_fu_hz: number;
  visibilidade_min_m: number | null;
  vento: VentoV0 | VentoV1;
  focos_contados: number;
  ranking: { municipios: { nome: string | null; uf: string | null; parcela: number; focos: number }[] };
  confianca: string;
  sinais: Record<string, boolean>;
};

const ventoUsado = (meteo: string | null | undefined) => (meteo === 'era5' ? 'ERA5' : 'GFS, provisório');

/** The report, at most 15 lines. `partial` = the day is not over yet. */
export function buildReport(r: DayRow, partial: boolean): string {
  const v1 = r.versao === 'v1';
  const who =
    r.pm25_medido_media === null ? '' : `, ${n1(r.pm25_medido_media / WHO_DAILY_PM25)}× a diretriz diária da OMS (${WHO_DAILY_PM25} µg/m³)`;
  const top = r.ranking.municipios
    .slice(0, 3)
    .map((m, i) => `${i + 1}. ${m.nome ?? '?'}${m.uf ? '/' + m.uf : ''}: ${pct(m.parcela)} (${m.focos} focos)`);
  const signals = [
    v1
      ? r.sinais.trajetoriasConcordam
        ? 'trajetórias concordam'
        : 'trajetórias divergem'
      : r.sinais.steadyWind
        ? 'vento constante'
        : 'vento mudou no dia',
    r.sinais.spotsInSector
      ? v1
        ? 'há focos no caminho do ar'
        : 'há focos no setor do vento'
      : v1
        ? 'poucos focos no caminho do ar'
        : 'poucos focos no setor',
    r.sinais.measuredAndModelAgree ? 'medido e modelo concordam' : 'medido e modelo não concordam (ou falta dado)',
  ];
  let vento: string;
  if (v1) {
    const v = r.vento as VentoV1;
    vento = `- **Trajetórias** (${ventoUsado(r.meteo)}): ${v.trajetorias} retrotrajetórias de até 72 h saindo de Manaus (${v.chegadas} horários de chegada${
      v.horas_media === undefined ? '' : `; em média ${Math.round(v.horas_media)} h dentro da caixa do vento`
    }${v.concordancia_km === null ? '' : `; em −24 h ficam a ${Math.round(v.concordancia_km)} km do centro delas, em média`}).`;
  } else {
    const v = r.vento as VentoV0;
    vento = `- **Vento** (925/850 hPa, modelo): de ${compass(v.de_graus)} (${Math.round(v.de_graus)}°), ${Math.round(v.velocidade_kmh)} km/h.`;
  }
  return [
    `# Fumaça em Manaus: ${br(r.dia)}${partial ? ' (parcial, até as 17h)' : ''}`,
    '',
    `- **Ar medido** (1 sensor barato no Centro, OpenAQ): PM2.5 médio ${n1(r.pm25_medido_media)} µg/m³, máximo ${n1(r.pm25_medido_max)} (${r.pm25_medido_horas} h com dado)${who}.`,
    `- **Ar no modelo** (CAMS, não é medição): PM2.5 médio ${n1(r.pm25_cams_media)} µg/m³, máximo ${n1(r.pm25_cams_max)}.`,
    `- **Aeroporto Eduardo Gomes:** ${r.horas_fu_hz} h com fumaça ou névoa seca (FU/HZ); visibilidade mínima ${r.visibilidade_min_m === null ? '—' : n1(r.visibilidade_min_m / 1000) + ' km'}.`,
    vento,
    `- **De onde veio** (${r.focos_contados} focos contados):`,
    ...(top.length ? top.map((t) => `  ${t}`) : [v1 ? '  nenhum foco no caminho do ar.' : '  nenhum foco no setor do vento.']),
    `- **Quanto confiar:** ${r.confianca} (${signals.join('; ')}).`,
    '',
    `_${v1 ? NOTE_V1 : NOTE}_ Mapa: \`mapa.html\`. Dados: \`atribuicao.json\`, \`focos.geojson\`.`,
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

export type TrajOut = { nivel_hpa: number; pontos: [number, number][] }; // [lat, lon]

/**
 * Self-contained Leaflet page (no build), data embedded. Spot times are ISO UTC; the page shows them in Manaus time.
 * v0 draws the wind sector; v1 draws the day's trajectories (colour by starting level).
 */
export function buildMap(r: DayRow, spots: SpotOut[], trajetorias: TrajOut[] = []): string {
  const v1 = r.versao === 'v1';
  const nota = v1 ? NOTE_V1 : NOTE;
  const data = JSON.stringify({
    manaus: MANAUS,
    sector: v1 ? null : sector((r.vento as VentoV0).de_graus),
    trajetorias: v1 ? trajetorias : [],
    spots,
    r: { dia: r.dia, medido: r.pm25_medido_media, cams: r.pm25_cams_media },
  }).replaceAll('<', '\\u003c');
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
<div id="mapa" role="region" aria-label="Mapa dos focos de calor e ${v1 ? 'das trajetórias do ar' : 'do setor do vento'}"></div>
<script>
const d = ${data};
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const f = (v) => (v === null ? '—' : num.format(v));
const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Manaus', dateStyle: 'short', timeStyle: 'short' });
const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(d.r.dia + 'T00:00:00Z'));
const mapa = L.map('mapa');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap' }).addTo(mapa);
${
  v1
    ? `// Trajectories: dark blue = ~500 m (950 hPa), blue = ~1000 m (900 hPa), light blue = ~1500 m (850 hPa).
const COR = { 950: '#1e3a8a', 900: '#2563eb', 850: '#60a5fa' };
const linhas = d.trajetorias.map((t) => L.polyline(t.pontos, { color: COR[t.nivel_hpa] ?? '#2563eb', weight: 2, opacity: 0.7 }).addTo(mapa)
  .bindTooltip('Caminho do ar que chegou a Manaus (saída a ' + t.nivel_hpa + ' hPa, até 72 h para trás; para na borda da caixa do vento)'));
mapa.fitBounds(L.featureGroup(linhas.length ? linhas : [L.marker([d.manaus.lat, d.manaus.lon])]).getBounds(), { padding: [12, 12], maxZoom: 7 });`
    : `const setor = L.polygon(d.sector, { color: '#2563eb', weight: 1, fillOpacity: 0.08 }).addTo(mapa)
  .bindTooltip('Setor de onde o vento veio (±${PARAMS.sectorDeg}°, até ${PARAMS.maxKm} km)');
mapa.fitBounds(setor.getBounds(), { padding: [12, 12] });`
}
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
  innerHTML: ar + '<br><small>Círculo maior e mais vermelho = foco com mais peso no dia (amarelo = menos). ' + ${JSON.stringify(
    v1 ? nota + ' Linhas azuis = caminho do ar (mais escura = mais baixa).' : nota,
  )} + ' Lista completa em focos.geojson.</small>',
});
nota.addTo(mapa);
</script></body></html>
`;
}

/** temporada-2026.md: one line per day (the newest version of it). */
export function buildSeason(rows: DayRow[]): string {
  const lines = rows.map(
    (r) =>
      `| ${r.dia} | ${r.versao === 'v1' ? `v1 (${r.meteo === 'era5' ? 'ERA5' : 'GFS'})` : 'v0'} | ${n1(r.pm25_medido_media)} | ${n1(r.pm25_cams_media)} | ${r.horas_fu_hz} | ${
        r.ranking.municipios
          .slice(0, 3)
          .map((m) => `${m.nome ?? '?'}${m.uf ? '/' + m.uf : ''} ${pct(m.parcela)}`)
          .join(', ') || '—'
      } |`,
  );
  return [
    '# Fumaça em Manaus: temporada 2026',
    '',
    `PM2.5 medido = 1 sensor barato no Centro (OpenAQ); CAMS = modelo. FU/HZ = horas com fumaça ou névoa seca no aeroporto Eduardo Gomes. ${NOTE} ${NOTE_V1}`,
    '',
    '| dia | versão | PM2.5 medido (µg/m³) | PM2.5 CAMS (µg/m³) | horas FU/HZ | 3 municípios do topo |',
    '|---|---|---|---|---|---|',
    ...lines,
    '',
  ].join('\n');
}

/** Stored days between two dates (newest version of each), oldest first, with `dia` as text (YYYY-MM-DD). */
export async function seasonRows(db: pg.ClientBase, first: string, last: string): Promise<DayRow[]> {
  return (
    await db.query(
      `SELECT DISTINCT ON (f.dia) f.*, to_char(f.dia, 'YYYY-MM-DD') AS dia FROM analise.fumaca_dia f
       WHERE f.dia BETWEEN $1 AND $2 ORDER BY f.dia, f.versao DESC`,
      [first, last],
    )
  ).rows;
}

async function readDay(db: pg.ClientBase, dia: string, versao: Versao): Promise<DayRow> {
  return (
    await db.query(`SELECT *, to_char(dia, 'YYYY-MM-DD') AS dia FROM analise.fumaca_dia WHERE dia = $1 AND versao = $2`, [dia, versao])
  ).rows[0];
}

async function readTrajectories(db: pg.ClientBase, dia: string, meteo: string): Promise<TrajOut[]> {
  return (
    await db.query(
      `SELECT nivel_hpa, (SELECT json_agg(json_build_array(p->'lat', p->'lon')) FROM jsonb_array_elements(pontos) p) AS pontos
       FROM analise.trajetoria WHERE dia = $1 AND meteo = $2 ORDER BY chegada_em, nivel_hpa`,
      [dia, meteo],
    )
  ).rows;
}

async function readSpots(db: pg.ClientBase, dia: string, versao: Versao): Promise<SpotOut[]> {
  return (
    await db.query(
      `SELECT f.lat, f.lon, ff.peso, coalesce(f.frp, 0) AS frp, to_char(f.adquirido_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS em,
            m.nome || '/' || m.uf AS municipio, ff.distancia_km
     FROM analise.fumaca_foco ff JOIN firms.foco f ON f.id = ff.foco LEFT JOIN ibge.municipio m ON m.codigo = f.municipio
     WHERE ff.dia = $1 AND ff.versao = $2 ORDER BY ff.peso DESC`,
      [dia, versao],
    )
  ).rows;
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

/** v0, then trajectories + v1 (`meteo` forces the wind; `partial` = day not over). Returns the version shown. */
export async function reportDay(db: pg.ClientBase, dia: string, partial: boolean, meteo?: 'era5' | 'gfs'): Promise<Versao> {
  await attributeDay(db, dia, 'v0');
  let versao: Versao = 'v1';
  try {
    await trajetoriasDoDia(db, dia, meteo, partial);
    await attributeDay(db, dia, 'v1');
  } catch (e) {
    versao = 'v0';
    // A partial v1 from the 17h run would otherwise stay as the day's answer in the API and the season table.
    if (!partial) await apagarV1Parcial(db, dia);
    console.error(`${dia}: sem v1 (${(e as Error).message}); o relatório fica com a v0`);
  }
  const row = await readDay(db, dia, versao);
  const spots = await readSpots(db, dia, versao);
  const trajetorias = versao === 'v1' ? await readTrajectories(db, dia, row.meteo!) : [];
  await publish(
    {
      'relatorio.md': buildReport(row, partial) + '\n',
      'atribuicao.json': JSON.stringify({ ...row, parcial: partial, parametros: versao === 'v1' ? PARAMS_V1 : PARAMS }, null, 1),
      'focos.geojson': JSON.stringify(buildGeojson(spots)),
      'mapa.html': buildMap(row, spots, trajetorias),
    },
    `produtos/fumaca/${dia}`,
  );
  console.log(`produtos/fumaca/${dia}/`, versao, row.meteo ?? '', row.confianca, spots.length, 'focos');
  return versao;
}

/** Days of the 30 before `hoje` that have v0 but no v1 on ERA5: v1 on GFS, or no v1 (a GFS gap left the day on v0). */
export async function diasSemEra5(db: pg.ClientBase, hoje: string): Promise<string[]> {
  return (
    await db.query(
      `SELECT to_char(dia, 'YYYY-MM-DD') AS dia FROM analise.fumaca_dia a
       WHERE versao = 'v0' AND dia >= $1::date - 30 AND dia < $1::date
         AND NOT EXISTS (SELECT 1 FROM analise.fumaca_dia b WHERE b.dia = a.dia AND b.versao = 'v1' AND b.meteo = 'era5')
       ORDER BY dia`,
      [hoje],
    )
  ).rows.map((r) => r.dia);
}

/** The days above that ERA5 now covers: trajectories, v1 and products again. */
async function refazerComEra5(db: pg.ClientBase, agora: Date) {
  const chaves = (await listKeys('bruto/ecmwf-cds/')).map((k) => k.key);
  for (const dia of (await diasSemEra5(db, diaDeManaus(agora))).filter((d) => arquivosEra5(chaves, d)))
    await reportDay(db, dia, false, 'era5');
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
      if (args[0] === '--temporada')
        for (let t = Date.parse(first); t <= Date.parse(last); t += 86_400_000)
          await reportDay(db, new Date(t).toISOString().slice(0, 10), false);
      const rows = await seasonRows(db, first, last);
      await publish({ [`temporada-${first.slice(0, 4)}.md`]: buildSeason(rows) }, 'produtos/fumaca');
      return console.log(`produtos/fumaca/temporada-${first.slice(0, 4)}.md`, rows.length, 'dias');
    }
    if (args[0] === '--refazer-era5') return await refazerComEra5(db, now);
    if (args[0] === '--hoje') return await reportDay(db, diaDeManaus(now), true);
    if (args[0] === '--ontem') return await reportDay(db, diaDeManaus(new Date(now.getTime() - 86_400_000)), false);
    if (args[0] === '--dia' && /^\d{4}-\d{2}-\d{2}$/.test(args[1] ?? '')) return await reportDay(db, args[1], dayBounds(args[1]).end > now);
    throw new Error('usage: relatorio.ts --ontem | --hoje | --dia AAAA-MM-DD | --temporada AAAA-MM-DD | --refazer-era5');
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
