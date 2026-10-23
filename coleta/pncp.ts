// PNCP (#66): procurements of every public body located in Manaus (federal, state, city), Lei 14.133 onwards.
//   node coleta/pncp.ts                       daily, slice cron: the last 3 Manaus days, published + updated
//   node coleta/pncp.ts --history 2021-01-01  this PC: yearly windows up to today, published only
// Each page goes to the raw files (gzip), then pncp.contratacao is upserted by numeroControlePNCP. The API answers 204
// (no body) when there is nothing, and 429 (HTML) when called too fast: one call every 3 s, waiting 15 s on a 429.
import { setTimeout as esperar } from 'node:timers/promises';
import pg from 'pg';
import { registrar } from './carga/lib.ts';
import { baixar, readRaw } from './lib/baixar.ts';
import { tentar } from './lib/tentar.ts';

const API = 'https://pncp.gov.br/api/consulta/v1/contratacoes';
const MODALIDADES = Array.from({ length: 19 }, (_, i) => i + 1);

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
// Sector by the body's name (there is no function field). Checked by hand on the 40 bodies with most emergencies.
const SAUDE =
  /SAUDE|SUSAM|HOSPITAL|HEMO|ONCOLOG|MEDICINA TROPICAL|DERMATOLOGIA|INSTITUTO DA MULHER|MEDICAMENTO|EBSERH|DSEI|MATERNIDADE|POLICLINICA|PRONTO SOCORRO|OSWALDO CRUZ/;
const AMBIENTE = /MEIO AMBIENTE|IPAAM|PROTECAO AMBIENTAL|IBAMA|BIODIVERSIDADE|CHICO MENDES|DEFESA CIVIL|BOMBEIRO/;

export function setorDoOrgao(razao: string, unidade = ''): 'saude' | 'ambiente' | 'outro' {
  const t = normal(`${razao} ${unidade}`);
  return SAUDE.test(t) ? 'saude' : AMBIENTE.test(t) ? 'ambiente' : 'outro';
}

type Bruto = {
  numeroControlePNCP: string;
  dataPublicacaoPncp: string;
  dataAtualizacaoGlobal: string | null;
  anoCompra: number;
  modalidadeId: number;
  amparoLegal: { codigo: number; nome: string } | null;
  situacaoCompraNome: string;
  objetoCompra: string;
  valorTotalEstimado: number | null;
  valorTotalHomologado: number | null;
  orgaoEntidade: { cnpj: string; razaoSocial: string; esferaId: string };
  unidadeOrgao: { codigoUnidade: string; nomeUnidade: string; codigoIbge: string };
};

/**
 * One API page → rows. Emergency = dispensa (modalidade 8) under Lei 14.133 art. 75, VIII (amparo 38), not annulled.
 * The PNCP has no Lei 8.666 code: emergencies of the old law (until 2023) are not here.
 */
export function lerPagina(json: { data: Bruto[] }) {
  return json.data.map((c) => ({
    numero_controle: c.numeroControlePNCP,
    publicado_em: c.dataPublicacaoPncp + '-04:00', // the API gives Brasília/Manaus local time without zone; shortcut: −04:00, an hour off for Brasília
    atualizado_em: c.dataAtualizacaoGlobal ? c.dataAtualizacaoGlobal + '-04:00' : null,
    ano_compra: c.anoCompra,
    modalidade: c.modalidadeId,
    amparo: c.amparoLegal?.codigo ?? null,
    amparo_nome: c.amparoLegal?.nome ?? null,
    situacao: c.situacaoCompraNome,
    objeto: c.objetoCompra,
    valor_estimado: c.valorTotalEstimado,
    valor_homologado: c.valorTotalHomologado,
    orgao_cnpj: c.orgaoEntidade.cnpj,
    orgao: c.orgaoEntidade.razaoSocial,
    esfera: c.orgaoEntidade.esferaId,
    unidade: c.unidadeOrgao.codigoUnidade,
    municipio_ibge: Number(c.unidadeOrgao.codigoIbge),
    setor: setorDoOrgao(c.orgaoEntidade.razaoSocial, c.unidadeOrgao.nomeUnidade),
    emergencia: c.modalidadeId === 8 && c.amparoLegal?.codigo === 38 && c.situacaoCompraNome !== 'Anulada',
  }));
}

const COLS = [
  'numero_controle',
  'publicado_em',
  'atualizado_em',
  'ano_compra',
  'modalidade',
  'amparo',
  'amparo_nome',
  'situacao',
  'objeto',
  'valor_estimado',
  'valor_homologado',
  'orgao_cnpj',
  'orgao',
  'esfera',
  'unidade',
  'municipio_ibge',
  'setor',
  'emergencia',
] as const;
const TIPOS = [
  'text',
  'timestamptz',
  'timestamptz',
  'int',
  'int',
  'int',
  'text',
  'text',
  'text',
  'numeric',
  'numeric',
  'text',
  'text',
  'text',
  'text',
  'int',
  'text',
  'boolean',
];

async function gravar(db: pg.ClientBase, linhas: ReturnType<typeof lerPagina>, arquivo: number) {
  await db.query(
    `INSERT INTO pncp.contratacao (${COLS.join(', ')}, arquivo)
     SELECT *, $${COLS.length + 1}::bigint FROM unnest(${COLS.map((_, i) => `$${i + 1}::${TIPOS[i]}[]`).join(', ')})
     ON CONFLICT (numero_controle) DO UPDATE SET ${COLS.slice(1)
       .map((c) => `${c} = excluded.${c}`)
       .join(', ')}, arquivo = excluded.arquivo`,
    [...COLS.map((c) => linhas.map((l) => l[c])), arquivo],
  );
}

/** One page through the raw files; null on 204 (nothing). */
async function pagina(url: string, nome: string) {
  for (let i = 1; ; i++) {
    await esperar(3_000);
    try {
      return await tentar(() => baixar({ fonte: 'pncp', coletor: 'pncp', nome, url, gzip: true }));
    } catch (e) {
      const m = String(e);
      if (m.includes('HTTP 204')) return null;
      if (!m.includes('HTTP 429') || i >= 8) throw e;
      await esperar(15_000);
    }
  }
}

const ymd = (d: string) => d.replaceAll('-', '');

async function janela(db: pg.ClientBase, endpoint: 'publicacao' | 'atualizacao', ini: string, fim: string): Promise<number> {
  let n = 0;
  for (const m of MODALIDADES)
    for (let p = 1, total = 1; p <= total; p++) {
      const url = `${API}/${endpoint}?dataInicial=${ymd(ini)}&dataFinal=${ymd(fim)}&codigoModalidadeContratacao=${m}&codigoMunicipioIbge=1302603&pagina=${p}&tamanhoPagina=50`;
      const b = await pagina(url, `${endpoint}_m${m}_${ymd(ini)}-${ymd(fim)}_p${p}.json`);
      if (!b) break;
      const json = JSON.parse(await readRaw(b.chave));
      total = json.totalPaginas;
      const linhas = lerPagina(json);
      await gravar(db, linhas, await registrar(db, b));
      n += linhas.length;
    }
  return n;
}

async function principal(args: string[]) {
  const dia = (t: number) => new Date(t - 4 * 3_600_000).toISOString().slice(0, 10); // Manaus day
  const db = new pg.Client();
  await db.connect();
  try {
    if (args.includes('--history')) {
      const hoje = dia(Date.now());
      for (let ini = args[args.indexOf('--history') + 1]; ini <= hoje;) {
        const fim = [`${ini.slice(0, 4)}-12-31`, hoje].sort()[0];
        console.log(ini, fim, await janela(db, 'publicacao', ini, fim));
        ini = `${Number(ini.slice(0, 4)) + 1}-01-01`;
      }
    } else {
      // The last 3 days: a weekend or a failed day is covered the next time; the upsert removes the overlap.
      const [ini, fim] = [dia(Date.now() - 3 * 86_400_000), dia(Date.now() - 86_400_000)];
      console.log('publicadas', await janela(db, 'publicacao', ini, fim), 'atualizadas', await janela(db, 'atualizacao', ini, fim));
    }
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
