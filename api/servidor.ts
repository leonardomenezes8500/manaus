// API v0 (#34): the HTTP server. On the slice it is the api service of compose.prod.yaml (port only on 127.0.0.1;
// from this PC through the ssh tunnel). Here: node api/servidor.ts  (PG* from .env; API_HOST/API_PORT optional)
import pg from 'pg';
import { criarApp } from './app.ts';

const db = new pg.Pool({ max: 4 });
const app = criarApp({ db });
await app.listen({ host: process.env.API_HOST ?? '127.0.0.1', port: Number(process.env.API_PORT ?? 3010) });
console.log(`API em http://${process.env.API_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? 3010}`);

// As PID 1 in the container, SIGTERM has no default action: close by hand so docker stop is quick.
for (const sinal of ['SIGTERM', 'SIGINT'] as const)
  process.on(sinal, () => {
    void app
      .close()
      .then(() => db.end())
      .finally(() => process.exit(0));
  });
