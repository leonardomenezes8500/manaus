// Who should act (#91): type of burned area → public bodies, by role (prevention, inspection, firefighting, and
// management where a body only manages the land), each line with the law and the official link. Every line was read
// in the official text on 2026-10-23 (planalto.gov.br, the AM state legislature and the Manaus city council SAPL); the
// AM and Manaus texts are the original versions (later amendments not consolidated there).
//   node analise/fogo/responsavel.ts --carregar   contexto.orgao_fogo from analise/fogo/orgao-fogo.csv
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

export const AREAS = [
  'uc_federal',
  'uc_estadual',
  'ti',
  'floresta_publica_nao_destinada',
  'assentamento',
  'imovel_rural',
  'manaus_urbano',
  'sem_regra', // outside Brazil or outside the layers box
] as const;
export type Area = (typeof AREAS)[number];
type Papel = 'prevencao' | 'fiscalizacao' | 'combate' | 'gestao';
export type Linha = { sigla: string; papel: Papel; norma: string; url: string };

const P = 'https://www.planalto.gov.br/ccivil_03';
const AM = 'https://sapl.al.am.leg.br/media/sapl/public/normajuridica';
const L = {
  icmbio: `${P}/_ato2007-2010/2007/lei/l11516.htm`,
  snuc: `${P}/leis/l9985.htm`,
  mif: `${P}/_ato2023-2026/2024/lei/L14944.htm`,
  ibama: `${P}/leis/l7735.htm`,
  prevfogo: `${P}/decreto/d2661.htm`,
  funai: `${P}/leis/1950-1969/l5371.htm`,
  funaiDecreto: `${P}/_ato2019-2022/2022/decreto/D11226.htm`,
  florestas: `${P}/_ato2004-2006/2006/lei/l11284.htm`,
  incra: `${P}/_ato2019-2022/2022/decreto/D11232.htm`,
  lc140: `${P}/leis/lcp/lcp140.htm`,
  cf: `${P}/constituicao/constituicao.htm`,
  lc97: `${P}/leis/lcp/lcp97.htm`,
  seuc: `${AM}/2007/844/844_texto_integral.pdf`,
  sema: `${AM}/2015/8617/8617_texto_integral.pdf`,
  fogoUc: `${AM}/2023/12665/6437.pdf`,
  ipaam: `${AM}/2012/8240/8240_texto_integral.pdf`,
  cbmam: `${AM}/2024/13333/6987.pdf`,
  codigoManaus: 'https://sapl.cmm.am.gov.br/media/sapl/public/normajuridica/2001/3966/lei_n_605_de_24_jul_2001.pdf',
};

// Firefighting anywhere in the state: the CBMAM coordinates (in federal areas the federal body directs, Lei 14.944
// art. 11 § 6º); the Armed Forces support (LC 97 art. 16: cooperation with civil defence, not GLO, which needs art. 144 exhausted).
const COMBATE_AM: Linha[] = [
  { sigla: 'CBMAM', papel: 'combate', norma: 'CF art. 144 § 5º; Lei 14.944/2024 art. 11 § 5º; Lei-AM 6.987/2024 art. 3º', url: L.cbmam },
  { sigla: 'Forças Armadas', papel: 'combate', norma: 'LC 97/1999 art. 16 (apoio à defesa civil)', url: L.lc97 },
];
const IBAMA_MIF: Linha = {
  sigla: 'IBAMA',
  papel: 'combate',
  norma: 'Lei 7.735/1989 art. 2º, IV; Decreto 2.661/1998 art. 18 (Prevfogo)',
  url: L.ibama,
};

const REGRA: Record<Area, Linha[]> = {
  uc_federal: [
    { sigla: 'ICMBio', papel: 'prevencao', norma: 'Lei 11.516/2007 art. 1º, I; Lei 9.985/2000 art. 6º, III', url: L.icmbio },
    { sigla: 'ICMBio', papel: 'fiscalizacao', norma: 'Lei 11.516/2007 art. 1º, IV', url: L.icmbio },
    { sigla: 'ICMBio', papel: 'combate', norma: 'Lei 14.944/2024 art. 11 § 6º (o órgão federal dirige o combate)', url: L.mif },
    { sigla: 'IBAMA', papel: 'fiscalizacao', norma: 'Lei 11.516/2007 art. 1º, parágrafo único (supletivo)', url: L.icmbio },
    ...COMBATE_AM,
  ],
  uc_estadual: [
    { sigla: 'SEMA-AM', papel: 'prevencao', norma: 'LC-AM 53/2007 art. 6º, III e IV; Lei-AM 4.163/2015 art. 20, I, "f"', url: L.sema },
    { sigla: 'IPAAM', papel: 'fiscalizacao', norma: 'Lei-AM 4.163/2015 art. 20, II, "c"; Lei-AM 6.437/2023 arts. 1º e 3º', url: L.fogoUc },
    ...COMBATE_AM,
  ],
  ti: [
    { sigla: 'FUNAI', papel: 'prevencao', norma: 'Decreto 11.226/2022 Anexo I art. 2º, IX', url: L.funaiDecreto },
    { sigla: 'FUNAI', papel: 'fiscalizacao', norma: 'Lei 5.371/1967 art. 1º, VII', url: L.funai },
    { sigla: 'IBAMA', papel: 'prevencao', norma: 'Lei 7.735/1989 art. 2º, IV', url: L.ibama },
    IBAMA_MIF,
    ...COMBATE_AM,
  ],
  floresta_publica_nao_destinada: [
    { sigla: 'SFB', papel: 'gestao', norma: 'Lei 11.284/2006 art. 55, I e VII', url: L.florestas },
    { sigla: 'IBAMA', papel: 'fiscalizacao', norma: 'Lei 11.284/2006 art. 50, I e III, § 1º', url: L.florestas },
    ...COMBATE_AM,
  ],
  assentamento: [
    { sigla: 'INCRA', papel: 'gestao', norma: 'Decreto 11.232/2022 art. 1º, parágrafo único', url: L.incra },
    { sigla: 'IBAMA', papel: 'prevencao', norma: 'Lei 7.735/1989 art. 2º, IV', url: L.ibama },
    IBAMA_MIF,
    { sigla: 'IPAAM', papel: 'fiscalizacao', norma: 'LC 140/2011 art. 8º, XIII e XIV; Lei-AM 3.785/2012 art. 2º', url: L.ipaam },
    ...COMBATE_AM,
  ],
  imovel_rural: [
    { sigla: 'IPAAM', papel: 'fiscalizacao', norma: 'LC 140/2011 art. 8º, XIII e XIV; Lei-AM 3.785/2012 art. 2º', url: L.ipaam },
    { sigla: 'IBAMA', papel: 'fiscalizacao', norma: 'LC 140/2011 art. 17, §§ 2º e 3º (atribuição comum de fiscalização)', url: L.lc140 },
    { sigla: 'responsável pelo imóvel', papel: 'prevencao', norma: 'Lei 14.944/2024 art. 45, § 1º', url: L.mif },
    ...COMBATE_AM,
  ],
  manaus_urbano: [
    {
      sigla: 'SEMMAS',
      papel: 'fiscalizacao',
      norma: 'Lei Municipal 605/2001 (Código Ambiental de Manaus) art. 90, I; arts. 136, V e 138, V',
      url: L.codigoManaus,
    },
    ...COMBATE_AM,
  ],
  sem_regra: [],
};

export const responsaveis = (a: Area): Linha[] => REGRA[a];

async function principal(args: string[]) {
  if (!args.includes('--carregar')) throw new Error('uso: node analise/fogo/responsavel.ts --carregar');
  const [cab, ...linhas] = readFileSync(join(import.meta.dirname, 'orgao-fogo.csv'), 'utf8')
    .trim()
    .split('\n');
  const campos = cab.split(',');
  const rows = linhas.map((l) => Object.fromEntries(l.split(',').map((v, i) => [campos[i], v || null])));
  const papel = new Map<string, Set<string>>();
  for (const a of AREAS) for (const x of REGRA[a]) papel.set(x.sigla, (papel.get(x.sigla) ?? new Set()).add(x.papel));
  const db = new pg.Client();
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM contexto.orgao_fogo');
    await db.query(`INSERT INTO contexto.orgao_fogo SELECT * FROM json_populate_recordset(NULL::contexto.orgao_fogo, $1::json)`, [
      JSON.stringify(rows.map((r) => ({ ...r, papeis: [...(papel.get(r.sigla as string) ?? [])].sort().join(',') }))),
    ]);
    await db.query('COMMIT');
    console.log(`contexto.orgao_fogo: ${rows.length} órgãos`);
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
