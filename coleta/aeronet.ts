// AERONET (#53): daily mean AOD (print_web_data_v3, AVG=20, no key), levels 1.5 and 2.0, through baixar(), then the load.
//   node coleta/aeronet.ts                   slice cron 1x/day: last 7 days of the active sites
//   node coleta/aeronet.ts --history 2012    one-off on this PC: one request per site, year and level
import pg from 'pg';
import { baixar, readRaw } from './lib/baixar.ts';
import { loadAeronet, parseAeronet } from './carga/aeronet.ts';
import { registrar } from './carga/lib.ts';
import { tentar } from './lib/tentar.ts';

const ATIVOS = ['ATTO-Campina', 'Amazon_ATTO_Tower'];
const TODOS = [...ATIVOS, 'Manaus_EMBRAPA'];
const NIVEIS = { '1.5': 'AOD15', '2.0': 'AOD20' } as const;

const url = (site: string, ini: string, fim: string, nivel: keyof typeof NIVEIS) => {
  const [a, m, d] = ini.split('-').map(Number);
  const [a2, m2, d2] = fim.split('-').map(Number);
  return `https://aeronet.gsfc.nasa.gov/cgi-bin/print_web_data_v3?site=${site}&year=${a}&month=${m}&day=${d}&year2=${a2}&month2=${m2}&day2=${d2}&${NIVEIS[nivel]}=1&AVG=20&if_no_html=1`;
};

async function principal(args: string[]) {
  const hoje = new Date().toISOString().slice(0, 10);
  const pedidos: [string, string, string, keyof typeof NIVEIS][] = [];
  if (args[0] === '--history') {
    for (let ano = Number(args[1] ?? 2012); ano <= Number(hoje.slice(0, 4)); ano++)
      for (const site of TODOS) for (const n of ['1.5', '2.0'] as const) pedidos.push([site, `${ano}-01-01`, `${ano}-12-31`, n]);
  } else {
    const ini = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    for (const site of ATIVOS) for (const n of ['1.5', '2.0'] as const) pedidos.push([site, ini, hoje, n]);
  }
  const db = new pg.Client();
  await db.connect();
  let falhas = 0;
  try {
    for (const [site, ini, fim, nivel] of pedidos) {
      try {
        const b = await tentar(() =>
          baixar({
            fonte: 'aeronet',
            coletor: 'aeronet',
            nome: `${site}_${ini}_${fim}_${nivel.replace('.', '')}.txt`,
            url: url(site, ini, fim, nivel),
            parametros: { site, ini, fim, nivel },
          }),
        );
        const n = await loadAeronet(db, await registrar(db, b), parseAeronet(await readRaw(b.chave)));
        console.log(b.chave, `${n} dias`);
      } catch (e) {
        falhas++;
        console.error('ERRO', site, ini, nivel, (e as Error).message);
      }
    }
  } finally {
    await db.end();
  }
  if (falhas) throw new Error(`${falhas} de ${pedidos.length} pedidos falharam`);
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
