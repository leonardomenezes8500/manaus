// Public spending by function and subfunction (#65), yearly on this PC:
//   node coleta/siconfi.ts [--de 2015] [--ate <last closed year>]
// SICONFI DCA Anexo I-E (the closed yearly balance) of the Prefeitura de Manaus and of the Estado do AM, one call per
// entity and year, plus the monthly IPCA index (SIDRA 1737) to compare years in real terms. Everything through baixar().
import pg from 'pg';
import { registrar } from './carga/lib.ts';
import { baixar, readRaw } from './lib/baixar.ts';

const DCA = 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca';
export const ENTES = { 1302603: 'Prefeitura de Manaus', 13: 'Estado do Amazonas' } as const;
const COLUNAS: Record<string, string> = {
  'Despesas Empenhadas': 'empenhado',
  'Despesas Liquidadas': 'liquidado',
  'Despesas Pagas': 'pago',
};

export type LinhaDca = { codigo: string; nome: string; coluna: string; valor: number };

/**
 * The DCA Anexo I-E items → one row per account and column. The code is inside the account text ("18 - Gestão
 * Ambiental", "06.182 - Defesa Civil", "FU18 - Demais Subfunções" from 2017, "18.999 - Demais Subfunções ..." before);
 * the total without intra-budget spending gets the code TOTAL. Match by code, never by name (names drift).
 */
export function lerDca(json: { items: { conta: string; coluna: string; valor: number }[]; hasMore?: boolean }): LinhaDca[] {
  if (json.hasMore) throw new Error('DCA com mais de uma página: ler as outras com offset'); // shortcut: never seen (max ~600 rows of 5000)
  return json.items.flatMap((i) => {
    const coluna = COLUNAS[i.coluna];
    if (!coluna) return [];
    if (/^Despesas \(?Exceto Intraorçamentárias\)?$/.test(i.conta))
      // 2015-2016 write it in parentheses
      return [{ codigo: 'TOTAL', nome: i.conta, coluna, valor: i.valor }];
    const m = i.conta.match(/^(\d{2}(?:\.\d{3})?|FU\d{2}) - (.+)$/);
    return m ? [{ codigo: m[1], nome: m[2].trim(), coluna, valor: i.valor }] : [];
  });
}

/** SIDRA answer (first item is the header) → monthly IPCA index numbers. */
export function lerIpca(json: { V: string; D3C: string }[]): { mes: string; indice: number }[] {
  return json
    .slice(1)
    .filter((l) => Number.isFinite(Number(l.V)))
    .map((l) => ({ mes: `${l.D3C.slice(0, 4)}-${l.D3C.slice(4)}-01`, indice: Number(l.V) }));
}

async function principal(args: string[]) {
  const arg = (k: string, d: number) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
  const de = arg('--de', 2015);
  const ate = arg('--ate', new Date().getUTCFullYear() - 1);
  const db = new pg.Client();
  await db.connect();
  try {
    for (let ano = de; ano <= ate; ano++)
      for (const ente of Object.keys(ENTES)) {
        const url = `${DCA}?an_exercicio=${ano}&no_anexo=DCA-Anexo%20I-E&id_ente=${ente}`;
        const b = await baixar({ fonte: 'siconfi', coletor: 'siconfi', nome: `dca-I-E_${ente}_${ano}.json`, url });
        const linhas = lerDca(JSON.parse(await readRaw(b.chave)));
        if (!linhas.length) {
          console.log(`${ente} ${ano}: DCA ainda não publicada`);
          continue;
        }
        const arquivo = await registrar(db, b);
        await db.query(
          `INSERT INTO siconfi.despesa_funcao (ente, ano, codigo, nome, coluna, valor, arquivo)
           SELECT $1, $2, * FROM unnest($3::text[], $4::text[], $5::text[], $6::numeric[], $7::bigint[])
           ON CONFLICT (ente, ano, codigo, coluna) DO UPDATE SET nome = excluded.nome, valor = excluded.valor, arquivo = excluded.arquivo`,
          [
            Number(ente),
            ano,
            ...(['codigo', 'nome', 'coluna', 'valor'] as const).map((k) => linhas.map((l) => l[k])),
            linhas.map(() => arquivo),
          ],
        );
        console.log(`${ente} ${ano}: ${linhas.length} linhas`);
      }
    const fim = new Date().toISOString().slice(0, 7).replace('-', '');
    const b = await baixar({
      fonte: 'ibge-sidra',
      coletor: 'siconfi',
      nome: 'ipca-1737-2266.json',
      url: `https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/201401-${fim}`,
    });
    const ipca = lerIpca(JSON.parse(await readRaw(b.chave)));
    const arquivo = await registrar(db, b);
    await db.query(
      `INSERT INTO ibge.ipca_mes (mes, indice, arquivo) SELECT *, $3 FROM unnest($1::date[], $2::numeric[])
       ON CONFLICT (mes) DO UPDATE SET indice = excluded.indice, arquivo = excluded.arquivo`,
      [ipca.map((l) => l.mes), ipca.map((l) => l.indice), arquivo],
    );
    console.log(`IPCA: ${ipca.length} meses, até ${ipca.at(-1)?.mes}`);
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
