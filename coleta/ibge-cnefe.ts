// CNEFE 2022 of Manaus (#22): the IBGE municipal CSV (zip) and its dictionary through baixar(), then the load.
// One-off job on this PC (needs unzip): node coleta/ibge-cnefe.ts
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import pg from 'pg';
import { baixar } from './lib/baixar.ts';
import { loadAddresses, parseAddress, type Address } from './carga/cnefe.ts';
import { registrar } from './carga/lib.ts';

const BASE = 'https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022';
const coletor = 'ibge-cnefe';

async function* addresses(zip: string): AsyncGenerator<Address> {
  const unzip = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
  unzip.stdout.setEncoding('latin1');
  let header: string[] | undefined;
  for await (const raw of createInterface({ input: unzip.stdout, crlfDelay: Infinity })) {
    if (!header) header = raw.split(';');
    else if (raw.trim()) yield parseAddress(header, raw);
  }
}

const db = new pg.Client();
await db.connect();
try {
  const csv = await baixar({
    fonte: 'ibge-cnefe',
    coletor,
    nome: '1302603_MANAUS.zip',
    url: `${BASE}/Arquivos_CNEFE/CSV/Municipio/13_AM/1302603_MANAUS.zip`,
    parametros: { municipio: 1302603 },
  });
  for (const [nome, path] of [
    ['Dicionario_CNEFE_Censo_2022.xls', 'Arquivos_CNEFE/CSV/Dicionario_CNEFE_Censo_2022.xls'],
    ['Agregados_por_CEP_CNEFE_Censo_2022.zip', 'Agregados_por_CEP/Agregados_por_CEP_CNEFE_Censo_2022.zip'],
  ])
    await registrar(db, await baixar({ fonte: 'ibge-cnefe', coletor, nome, url: `${BASE}/${path}` }));
  console.log('ibge.cnefe_endereco:', await loadAddresses(db, await registrar(db, csv), addresses(csv.caminho)));
} finally {
  await db.end();
}
