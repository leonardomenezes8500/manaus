// ANA (#29): level of the Rio Negro at Manaus (station 14990000) through the old ANA web service, then the load.
//   node coleta/ana.ts             telemetry of the last 3 days (daily, coleta/crontab)
//   node coleta/ana.ts --history   historical series 1902–2014 (one request) + telemetry year by year since 2005
import pg from 'pg';
import { baixar, readRaw } from './lib/baixar.ts';
import { loadCotas, loadLeituras, parseSerieHistorica, parseTelemetria } from './carga/ana.ts';
import { registrar } from './carga/lib.ts';
import { tentar } from './lib/tentar.ts';

const URL = 'https://telemetriaws1.ana.gov.br/ServiceANA.asmx';
const ESTACAO = 14990000;
const fonte = 'ana-telemetria';
const coletor = 'ana';
const br = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

async function telemetria(db: pg.Client, inicio: Date, fim: Date, nome: string): Promise<number> {
  const b = await tentar(() =>
    baixar({
      fonte,
      coletor,
      nome,
      url: `${URL}/DadosHidrometeorologicos?codEstacao=${ESTACAO}&dataInicio=${br(inicio)}&dataFim=${br(fim)}`,
      parametros: { estacao: ESTACAO, inicio: br(inicio), fim: br(fim) },
    }),
  );
  return loadLeituras(db, await registrar(db, b), parseTelemetria(await readRaw(b.chave)));
}

const db = new pg.Client();
await db.connect();
try {
  const hoje = new Date();
  if (process.argv.includes('--history')) {
    const s = await baixar({
      fonte,
      coletor,
      nome: `serie_historica_${ESTACAO}.xml`,
      url: `${URL}/HidroSerieHistorica?codEstacao=${ESTACAO}&dataInicio=01/01/1900&dataFim=${br(hoje)}&tipoDados=1&nivelConsistencia=`,
      parametros: { estacao: ESTACAO, tipoDados: 1 },
    });
    console.log('ana.cota_diaria:', await loadCotas(db, await registrar(db, s), parseSerieHistorica(await readRaw(s.chave))));
    for (let ano = 2005; ano <= hoje.getUTCFullYear(); ano++) {
      const fim = ano === hoje.getUTCFullYear() ? hoje : new Date(Date.UTC(ano, 11, 31));
      console.log(`ana.leitura ${ano}:`, await telemetria(db, new Date(Date.UTC(ano, 0, 1)), fim, `telemetria_${ESTACAO}_${ano}.xml`));
    }
  } else {
    const inicio = new Date(hoje.getTime() - 3 * 86_400_000);
    console.log('ana.leitura:', await telemetria(db, inicio, hoje, `telemetria_${ESTACAO}.xml`));
  }
} finally {
  await db.end();
}
