// SELVA (#41): current reading of the PurpleAir sensors from the map of the SELVA site (UEA/EducAIR), no key, every
// 10 min in the slice cron. Undocumented endpoint: it wants the page cookie and the Origin header, and only gives
// pm2.5 and temperature (no A/B channels; asking for other fields is ignored, tested 2026-10-28). Only the sensors of
// the region box go to the raw files, gzipped (~9 KB); the load keeps the Manaus metropolitan region.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import pg from 'pg';
import { guardar } from './lib/baixar.ts';
import { tentar } from './lib/tentar.ts';
import { cortar, loadSelva, parseSelva } from './carga/selva.ts';
import { registrar } from './carga/lib.ts';
import { BBOX_CAMADAS, naCaixa, RMM_BBOX } from './regiao.ts';

const SITE = 'https://appselva.com.br/';
const URL_MAPA = `${SITE}api.php?route=purpleair`;

async function mapa(): Promise<string> {
  const pagina = await fetch(SITE, { signal: AbortSignal.timeout(30_000) });
  await pagina.body?.cancel();
  if (!pagina.ok) throw new Error(`HTTP ${pagina.status} em ${SITE}`);
  const cookie = pagina.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const r = await fetch(URL_MAPA, {
    method: 'POST',
    headers: { Origin: SITE.slice(0, -1), Cookie: cookie },
    signal: AbortSignal.timeout(60_000),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${URL_MAPA}`);
  // An error page or a changed answer must not become a raw file that looks like "no sensor".
  if (!JSON.parse(texto).fields?.includes('pm2.5')) throw new Error(`resposta sem pm2.5 em ${URL_MAPA}: ${texto.slice(0, 200)}`);
  return texto;
}

const corte = cortar(await tentar(mapa), BBOX_CAMADAS);
const tmp = await mkdtemp(join(process.env.MANAUS_BUFFER || tmpdir(), 'selva-'));
try {
  const arquivo = join(tmp, 'purpleair_regiao.json.gz');
  await writeFile(arquivo, await promisify(gzip)(corte));
  const b = await guardar(arquivo, {
    fonte: 'selva-uea',
    coletor: 'selva',
    nome: 'purpleair_regiao.json.gz',
    origem: URL_MAPA,
    parametros: { caixa: BBOX_CAMADAS },
  });
  const linhas = parseSelva(corte).filter((l) => naCaixa(RMM_BBOX, l.lat, l.lon));
  const db = new pg.Client();
  await db.connect();
  try {
    const n = await loadSelva(db, await registrar(db, b), linhas);
    console.log(b.chave, `${linhas.length} sensores na RMM, ${n} leituras novas`);
  } finally {
    await db.end();
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
