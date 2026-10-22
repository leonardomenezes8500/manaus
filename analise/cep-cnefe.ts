// CNEFE × BrasilAPI (#33): 100 random CEPs of Manaus from the CNEFE, the street and the bairro on both sides
// (CNEFE: the most common street and locality of the CEP). One request per second. One-off: node analise/cep-cnefe.ts
import { setTimeout as esperar } from 'node:timers/promises';
import pg from 'pg';
import { consultarCep } from '../coleta/brasilapi.ts';
import { normalizarNome } from './fusao/casar.ts';

const db = new pg.Client();
await db.connect();
try {
  const amostra = await db.query(
    `SELECT cep, mode() WITHIN GROUP (ORDER BY logradouro) AS logradouro, mode() WITHIN GROUP (ORDER BY localidade) AS bairro
     FROM ibge.cnefe_endereco WHERE municipio = 1302603 AND cep IS NOT NULL
       AND cep IN (SELECT cep FROM ibge.cnefe_endereco WHERE municipio = 1302603 AND cep IS NOT NULL GROUP BY cep ORDER BY md5(cep) LIMIT 100)
     GROUP BY cep ORDER BY cep`,
  );
  const n = { total: 0, achou: 0, logradouro: 0, bairro: 0, coordenada: 0 };
  const diferentes: string[] = [];
  for (const c of amostra.rows) {
    n.total++;
    const api = await consultarCep(db, c.cep);
    await esperar(1000);
    if (!api) {
      diferentes.push(`${c.cep}: não encontrado na BrasilAPI`);
      continue;
    }
    n.achou++;
    const rua = normalizarNome(api.logradouro ?? '') === normalizarNome(c.logradouro ?? '');
    const bairro = normalizarNome(api.bairro ?? '') === normalizarNome(c.bairro ?? '');
    n.logradouro += Number(rua);
    n.bairro += Number(bairro);
    n.coordenada += Number(api.lat !== null);
    if (!rua || !bairro)
      diferentes.push(`${c.cep}: CNEFE "${c.logradouro}" / "${c.bairro}" × BrasilAPI "${api.logradouro}" / "${api.bairro}"`);
  }
  console.log(n);
  console.log(diferentes.join('\n'));
} finally {
  await db.end();
}
