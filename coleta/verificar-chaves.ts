// Verificador de chaves (#6): uma requisição real e barata por chave e a foto em estado/chaves.md no R2.
// Nunca imprime valor de chave: erros passam por semSegredos(). Sai com código 1 se alguma chave falhou.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expiraEm, situacao, tabela, type Resultado } from './lib/chaves.ts';
import { enviar, semSegredos } from './lib/baixar.ts';

const env = (nome: string) => {
  const v = process.env[nome];
  if (!v) throw new Error('falta no ambiente');
  return v;
};

/** GET com timeout; erro se o status não for o esperado. */
async function pedir(url: string, headers: Record<string, string>, esperado = 200): Promise<Response> {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (r.status !== esperado) {
    await r.body?.cancel();
    throw new Error(`HTTP ${r.status} em ${new URL(url).host}`);
  }
  return r;
}

const ecmwf = (host: string) => () =>
  pedir(`https://${host}/api/retrieve/v1/jobs?limit=1`, { 'PRIVATE-TOKEN': env('ECMWF_KEY') });

const verificacoes: [string, () => Promise<unknown>][] = [
  ['FIRMS_MAP_KEY', async () => {
    // Chave inválida dá 403; válida devolve o JSON de cota.
    const r = await pedir(`https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=${env('FIRMS_MAP_KEY')}`, {});
    if (!('transaction_limit' in (await r.json()))) throw new Error('resposta sem transaction_limit');
  }],
  ['OPENAQ_API_KEY', () => pedir('https://api.openaq.org/v3/locations/5040030', { 'X-API-Key': env('OPENAQ_API_KEY') })],
  ['EARTHDATA_TOKEN', async () => {
    const auth = { Authorization: `Bearer ${env('EARTHDATA_TOKEN')}` };
    const busca = await pedir('https://cmr.earthdata.nasa.gov/search/granules.json?short_name=MCD19A2&page_size=1&sort_key=-start_date', auth);
    const links: { href: string }[] = (await busca.json()).feed?.entry?.[0]?.links ?? [];
    const arquivo = links.find((l) => l.href.startsWith('https://') && l.href.endsWith('.hdf'))?.href;
    if (!arquivo) throw new Error('CMR sem arquivo MCD19A2');
    // HEAD no LP DAAC passa até sem token; só o GET exige login, então 100 bytes.
    await (await pedir(arquivo, { ...auth, Range: 'bytes=0-99' }, 206)).arrayBuffer();
  }],
  ['ECMWF_KEY (CDS)', ecmwf('cds.climate.copernicus.eu')],
  ['ECMWF_KEY (ADS)', ecmwf('ads.atmosphere.copernicus.eu')],
  ['TRANSPARENCIA_API_KEY', () =>
    pedir('https://api.portaldatransparencia.gov.br/api-de-dados/orgaos-siafi?pagina=1', { 'chave-api-dados': env('TRANSPARENCIA_API_KEY') })],
];

const agora = new Date();
const resultados: Resultado[] = await Promise.all(
  verificacoes.map(async ([chave, verificar]) => {
    let expira: Date | undefined;
    try {
      if (chave === 'EARTHDATA_TOKEN') expira = expiraEm(env(chave));
      await verificar();
      return { chave, ok: true, expira };
    } catch (e) {
      return { chave, ok: false, expira, detalhe: semSegredos(String((e as Error).message)) };
    }
  }),
);

const md = tabela(resultados, agora);
console.log(md);
const pasta = mkdtempSync(join(process.env.MANAUS_BUFFER || tmpdir(), 'chaves-'));
try {
  writeFileSync(join(pasta, 'chaves.md'), md);
  await enviar(join(pasta, 'chaves.md'), 'estado/chaves.md', { sobrescrever: true });
} finally {
  rmSync(pasta, { recursive: true, force: true });
}
if (resultados.some((r) => situacao(r, agora) === 'FALHA')) process.exitCode = 1;
