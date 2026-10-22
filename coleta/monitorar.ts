// MonitorAr (#40): the FioAres station (Manaus) from the app backend, every hour (it only keeps 24 h), into the raw
// files through baixar(), then the load. Slice cron, hourly.
import pg from 'pg';
import { baixar, readRaw } from './lib/baixar.ts';
import { loadMonitorar, parseMonitorar } from './carga/monitorar.ts';
import { registrar } from './carga/lib.ts';
import { tentar } from './lib/tentar.ts';
import { MANAUS } from './regiao.ts';

const b = await tentar(() =>
  baixar({
    fonte: 'monitorar-mma',
    coletor: 'monitorar',
    nome: 'proximas.json',
    url: `https://monitorar-backend.mma.gov.br/v1/estacao/proximas?lat=${MANAUS.lat}&lng=${MANAUS.lon}`,
  }),
);
const linhas = parseMonitorar(await readRaw(b.chave));
const db = new pg.Client();
await db.connect();
try {
  const n = await loadMonitorar(db, await registrar(db, b), linhas);
  console.log(b.chave, `${n} horas`, linhas.at(-1)?.hora_local ?? '');
} finally {
  await db.end();
}
