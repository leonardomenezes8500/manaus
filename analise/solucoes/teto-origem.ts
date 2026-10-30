// Origin effect ceiling (#109): how much of the season's smoke each origin solution could touch at most.
//   node analise/solucoes/teto-origem.ts [--de 2026-08-01] [--ate 2026-11-30]
// Share of the v1 weight (modeled) by type of area and by public body (rule of #91, AM only), and by each onde-queimou
// category; then, satellite only and without wind, the share of the spots by category in the smoke years against the
// others (measured). Writes produtos/solucoes/teto-origem.md and .csv on R2.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { enviar } from '../../coleta/lib/baixar.ts';
import { BBOX_CAMADAS, bboxTexto } from '../../coleta/regiao.ts';
import { responsaveis } from '../fogo/responsavel.ts';
import { areaDoFoco } from '../fumaca/cadeia.ts';

export type Grupo = {
  peso: number;
  uf: string | null;
  fora_caixa: boolean;
  municipio: string | null;
  urbano: boolean;
  uc_esfera: string | null;
  ti: boolean;
  assentamento: string | null;
  cnfp: string | null;
  prodes: string | null;
  deter: string | null;
  uc: string | null;
};
type Parcela = { chave: string; peso: number; parcela: number };
const DIMENSOES = ['uf', 'ti', 'uc', 'cnfp', 'prodes', 'deter'] as const;

function parcelas(m: Map<string, number>, total: number): Parcela[] {
  return [...m]
    .map(([chave, peso]) => ({ chave, peso, parcela: peso / total }))
    .sort((a, b) => b.peso - a.peso || a.chave.localeCompare(b.chave));
}
const somar = (m: Map<string, number>, k: string, x: number) => m.set(k, (m.get(k) ?? 0) + x);

/** Shares of the weight by area (#91), by body (each body once per area, whatever its roles) and by category. */
export function teto(grupos: Grupo[]) {
  const total = grupos.reduce((s, g) => s + g.peso, 0);
  const area = new Map<string, number>();
  const orgao = new Map<string, number>();
  const papeis = new Map<string, Set<string>>();
  const dim = Object.fromEntries(DIMENSOES.map((d) => [d, new Map<string, number>()])) as Record<
    (typeof DIMENSOES)[number],
    Map<string, number>
  >;
  for (const g of grupos) {
    const a = areaDoFoco(g);
    somar(area, a, g.peso);
    for (const l of responsaveis(a)) papeis.set(l.sigla, (papeis.get(l.sigla) ?? new Set()).add(l.papel));
    for (const sigla of new Set(responsaveis(a).map((l) => l.sigla))) somar(orgao, sigla, g.peso);
    for (const d of DIMENSOES) somar(dim[d], d === 'ti' ? (g.ti ? 'sim' : 'nao') : (g[d] ?? 'sem_dado'), g.peso);
  }
  return {
    total,
    porArea: parcelas(area, total),
    porOrgao: parcelas(orgao, total).map((o) => ({ ...o, papeis: [...papeis.get(o.chave)!] })),
    porDimensao: Object.fromEntries(DIMENSOES.map((d) => [d, parcelas(dim[d], total)])) as Record<(typeof DIMENSOES)[number], Parcela[]>,
  };
}

/** Satellite only: the share of each category in the smoke years and in the other years, per dimension. */
export function porAnos(linhas: { ano: number; dimensao: string; categoria: string; focos: number }[], anosFumaca: number[]) {
  const t = new Map<string, { fumaca: number; outros: number }>();
  const tot = new Map<string, { fumaca: number; outros: number }>();
  for (const l of linhas) {
    const lado = anosFumaca.includes(l.ano) ? 'fumaca' : 'outros';
    const k = `${l.dimensao}|${l.categoria}`;
    for (const [m, chave] of [
      [t, k],
      [tot, l.dimensao],
    ] as const) {
      const x = m.get(chave) ?? { fumaca: 0, outros: 0 };
      x[lado] += l.focos;
      m.set(chave, x);
    }
  }
  return [...t]
    .map(([k, x]) => {
      const [dimensao, categoria] = k.split('|');
      const s = tot.get(dimensao)!;
      return { dimensao, categoria, fumaca: s.fumaca ? x.fumaca / s.fumaca : 0, outros: s.outros ? x.outros / s.outros : 0 };
    })
    .sort((a, b) => a.dimensao.localeCompare(b.dimensao) || b.fumaca - a.fumaca);
}

const ANOS_FUMACA = [2015, 2023, 2024]; // the years with the most FU days in the 2012–2025 series (#55)
const AREA_TEXTO: Record<string, string> = {
  uc_federal: 'unidade de conservação federal',
  uc_estadual: 'unidade de conservação estadual',
  ti: 'terra indígena',
  floresta_publica_nao_destinada: 'floresta pública não destinada',
  assentamento: 'assentamento do INCRA',
  imovel_rural: 'imóvel rural (pendente #84: sem o CAR, é todo o resto da terra no AM)',
  manaus_urbano: 'área urbana de Manaus',
  sem_regra: 'sem regra: fora do AM, fora da caixa das camadas ou foco não classificado',
};
const PAPEL: Record<string, string> = {
  prevencao: 'prevenção',
  fiscalizacao: 'fiscalização',
  combate: 'combate',
  gestao: 'gestão da terra',
};
const pct = (x: number) => `${(100 * x).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

async function principal(args: string[]) {
  const arg = (n: string, padrao: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : padrao);
  const de = arg('--de', '2026-08-01');
  const ate = arg('--ate', '2026-11-30');
  const db = new pg.Client();
  await db.connect();
  try {
    // Parallel hash joins outgrow the db container's /dev/shm on the season query ("could not resize shared memory").
    await db.query('SET max_parallel_workers_per_gather = 0');
    // One row per combination of the attributes the rule reads, so only the sums cross the tunnel. The spatial lookups
    // run only where the rule can use them (AM spots).
    const { rows: grupos } = await db.query(
      `WITH f AS (
         SELECT ff.peso, coalesce(oq.uf, m.uf) AS uf, m.nome = 'Manaus' AS manaus,
                coalesce(oq.prodes = 'fora_caixa', false) OR NOT f.geom && ST_MakeEnvelope(${bboxTexto(BBOX_CAMADAS)}, 4326) AS fora_caixa,
                oq.ti = 'sim' AS ti, oq.uc, oq.cnfp, oq.prodes, oq.deter, f.geom
         FROM analise.fumaca_foco ff JOIN firms.foco f ON f.id = ff.foco LEFT JOIN ibge.municipio m ON m.codigo = f.municipio
           LEFT JOIN analise.onde_queimou_foco oq ON oq.foco = ff.foco
         WHERE ff.versao = 'v1' AND ff.dia BETWEEN $1 AND $2)
       SELECT sum(peso)::float8 AS peso, uf, fora_caixa, CASE WHEN manaus THEN 'Manaus' END AS municipio,
              CASE WHEN uf = 'AM' AND manaus THEN EXISTS (SELECT 1 FROM ibge.setor s WHERE s.situacao = 'Urbana' AND ST_Contains(s.geom, f.geom)) ELSE false END AS urbano,
              CASE WHEN uf = 'AM' AND uc <> 'nao' THEN (SELECT u.esfera FROM cnuc.unidade u WHERE ST_Intersects(u.geom, f.geom) ORDER BY u.esfera = 'Federal' DESC LIMIT 1) END AS uc_esfera,
              coalesce(ti, false) AS ti,
              CASE WHEN uf = 'AM' AND NOT fora_caixa AND EXISTS (SELECT 1 FROM incra.assentamento a WHERE ST_Intersects(a.geom, f.geom)) THEN 'sim' END AS assentamento,
              cnfp, prodes, deter, uc
       FROM f GROUP BY 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12`,
      [de, ate],
    );
    const { rows: anos } = await db.query(
      `SELECT extract(year FROM dia)::int AS ano, dimensao, categoria, sum(focos)::int AS focos FROM analise.onde_queimou_dia
       WHERE sensor = 'VIIRS_SNPP' AND extract(month FROM dia) BETWEEN 8 AND 11 AND dia BETWEEN '2012-01-01' AND '2025-12-31'
         AND dimensao IN ('protegida', 'cnfp', 'prodes', 'deter') GROUP BY 1, 2, 3
       UNION ALL
       SELECT extract(year FROM dia)::int, 'uf', uf, sum(focos)::int FROM analise.onde_queimou_dia
       WHERE sensor = 'VIIRS_SNPP' AND extract(month FROM dia) BETWEEN 8 AND 11 AND dia BETWEEN '2012-01-01' AND '2025-12-31'
         AND dimensao = 'ti' GROUP BY 1, 2, 3`,
    );
    const t = teto(grupos);
    const sat = porAnos(anos, ANOS_FUMACA);

    const csv = [
      'secao,chave,papeis,parcela,parcela_outros_anos',
      ...t.porArea.map((x) => `area,${x.chave},,${x.parcela.toFixed(4)},`),
      ...t.porOrgao.map((x) => `orgao,${x.chave},${x.papeis.join('|')},${x.parcela.toFixed(4)},`),
      ...Object.entries(t.porDimensao).flatMap(([d, xs]) => xs.map((x) => `${d},${x.chave},,${x.parcela.toFixed(4)},`)),
      ...sat.map((x) => `satelite_${x.dimensao},${x.categoria},,${x.fumaca.toFixed(4)},${x.outros.toFixed(4)}`),
    ].join('\n');
    const md = [
      `# Teto de efeito na origem: quanto da fumaça cada solução poderia tocar`,
      '',
      `Gerado em ${new Date().toISOString().slice(0, 10)} por \`analise/solucoes/teto-origem.ts\` (#109), banco \`${process.env.PGDATABASE}\`. Temporada de ${de} a ${ate}.`,
      '',
      `É um teto: a fatia da fumaça que vem de focos onde a solução ou o órgão age. Ninguém tira 100% do fogo de um tipo de área, então o efeito real é menor.`,
      '',
      `## [modelado] Peso da v1 por tipo de área (regra da #91)`,
      'A v1 junta focos medidos por satélite com trajetórias de vento modeladas, então é modelo. A regra só tem órgãos e leis do AM.',
      '',
      '| tipo de área | fatia do peso |',
      '|---|---|',
      ...t.porArea.map((x) => `| ${AREA_TEXTO[x.chave] ?? x.chave} | ${pct(x.parcela)} |`),
      '',
      `## [modelado] Fatia máxima por órgão`,
      'Um órgão conta uma vez em cada tipo de área, com qualquer papel. As fatias se sobrepõem (vários órgãos agem na mesma área).',
      '',
      '| órgão | papéis | fatia máxima |',
      '|---|---|---|',
      ...t.porOrgao.map((x) => `| ${x.chave} | ${x.papeis.map((p) => PAPEL[p]).join(', ')} | ${pct(x.parcela)} |`),
      '',
      `## [modelado] Peso da v1 por categoria do onde caiu (#77)`,
      ...Object.entries(t.porDimensao).flatMap(([d, xs]) => ['', `**${d}:** ${xs.map((x) => `${x.chave} ${pct(x.parcela)}`).join('; ')}`]),
      '',
      `## [medido] Só satélite, sem vento: focos VIIRS de agosto a novembro, 2012–2025`,
      `Fatia dos focos da região (#77) em cada categoria, nos anos de muita fumaça (${ANOS_FUMACA.join(', ')}) e nos outros.`,
      '',
      '| dimensão | categoria | anos de fumaça | outros anos |',
      '|---|---|---|---|',
      ...sat.map((x) => `| ${x.dimensao} | ${x.categoria} | ${pct(x.fumaca)} | ${pct(x.outros)} |`),
      '',
    ].join('\n');
    const dir = await mkdtemp(join(tmpdir(), 'teto-'));
    try {
      for (const [nome, texto] of [
        ['teto-origem.md', md],
        ['teto-origem.csv', csv + '\n'],
      ]) {
        await writeFile(join(dir, nome), texto);
        await enviar(join(dir, nome), `produtos/solucoes/${nome}`, { sobrescrever: true });
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    console.log(md);
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
