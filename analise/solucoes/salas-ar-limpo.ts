// Clean-air rooms in public schools and health units (#114), by the rules of "Como avaliar" in
// pesquisa/solucoes/salas-ar-limpo-escolas-ubs.md (#110).
//   node analise/solucoes/salas-ar-limpo.ts      this PC, on the database with inep.escola and cnes.estabelecimento
// Writes produtos/solucoes/salas-ar-limpo.md and .csv on R2.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { enviar } from '../../coleta/lib/baixar.ts';

/** Biggest weight first; ties by code, so the order does not depend on the query. */
export const ordenar = <T extends { codigo: number; peso: number }>(xs: T[]) =>
  [...xs].sort((a, b) => b.peso - a.peso || a.codigo - b.codigo);

/**
 * What the first N cover. `valor`: every key of the city (a school, or a census tract) with its counts; each item covers
 * some keys, and a key covered by two items counts once. N above the number of items is cut to it.
 */
export function cobertura(ordenados: { chaves: string[] }[], valor: Map<string, Record<string, number>>, ns: number[]) {
  const campos = Object.keys(valor.values().next().value ?? {});
  const total = Object.fromEntries(campos.map((c) => [c, [...valor.values()].reduce((s, v) => s + v[c], 0)]));
  return [...new Set(ns.map((n) => Math.min(n, ordenados.length)))].flatMap((n) => {
    const chaves = new Set(ordenados.slice(0, n).flatMap((o) => o.chaves));
    return campos.map((campo) => {
      const coberto = [...chaves].reduce((s, k) => s + (valor.get(k)?.[campo] ?? 0), 0);
      return { n, campo, coberto, total: total[campo], parcela: total[campo] ? coberto / total[campo] : 0 };
    });
  });
}

// Classes remote or suspended in the municipal network (Covid-19): early recess from 2020-03-17, back to 100%
// in-person classes on 2021-08-23 (coleta/calendario/escola.csv).
const REMOTO = ['2020-03-17', '2021-08-22'];

export type Dia = { dia: string; fim_de_semana: boolean; feriado: string | null; escola: string | null };

/**
 * School day of the municipal network (provisional rule, the official calendar only has events): a weekday without a
 * holiday, from the start of the school year (`inicio`, Feb 5 when the calendar does not have it) to Dec 15, out of
 * the July recess and of the remote period. A day with classes suspended (smoke, gas leak) still counts: it was planned.
 */
export function letivo(d: Dia, inicio: string | undefined): boolean {
  const ano = d.dia.slice(0, 4);
  return (
    !d.fim_de_semana &&
    !d.feriado &&
    d.dia >= (inicio ?? `${ano}-02-05`) &&
    d.dia <= `${ano}-12-15` &&
    !d.escola?.includes('Recesso') &&
    !(d.dia >= REMOTO[0] && d.dia <= REMOTO[1])
  );
}

const ROTULO: Record<string, string> = {
  matriculas_0_14: 'matrículas de 0 a 14 anos',
  criancas_0_4: 'crianças de 0 a 4 anos',
  idosos_60_mais: 'idosos de 60+',
};
const LIMIARES = [50, 15]; // µg/m³, daily mean: Conama 506/2024 in force (provisional, #110) and WHO
const HORAS_POR_DIA = 4; // minimum school day of the LDB (800 h in 200 days)
const pct = (x: number) => `${(100 * x).toFixed(1).replace('.', ',')}%`;
const num = (x: number) => Math.round(x).toLocaleString('pt-BR');

async function principal() {
  const db = new pg.Client();
  await db.connect();
  try {
    // Schools: every active school of Manaus is in the total; the universe is the public ones with infant or primary education.
    const escolas = (
      await db.query(
        `SELECT codigo, nome, rede, coalesce(mat_0_3, 0) + coalesce(mat_4_5, 0) + coalesce(mat_6_10, 0) + coalesce(mat_11_14, 0) AS mat_0_14,
           rede <> 'privada' AND coalesce(mat_creche, 0) + coalesce(mat_pre, 0) + coalesce(mat_fund_ai, 0) + coalesce(mat_fund_af, 0) > 0 AS universo
         FROM inep.escola WHERE situacao = 'em atividade'`,
      )
    ).rows.map((e) => ({ ...e, mat_0_14: Number(e.mat_0_14) }));
    const valorEscola = new Map(escolas.map((e) => [String(e.codigo), { matriculas_0_14: e.mat_0_14 }]));
    const ordemEscolas = ordenar(escolas.filter((e) => e.universo).map((e) => ({ ...e, peso: e.mat_0_14, chaves: [String(e.codigo)] })));

    // Health units: tracts whose centre is up to 1 km away; every Manaus tract is in the total.
    const setores = await db.query(
      `SELECT setor, coalesce(idade_0_4, 0)::float8 AS criancas_0_4, coalesce(idade_60_mais, 0)::float8 AS idosos_60_mais
       FROM contexto.populacao_setor WHERE municipio = 1302603`,
    );
    const valorSetor = new Map(
      setores.rows.map((r) => [r.setor.trim(), { criancas_0_4: r.criancas_0_4, idosos_60_mais: r.idosos_60_mais }]),
    );
    const ubs = await db.query(
      `SELECT e.codigo, e.nome, coalesce(array_agg(s.codigo) FILTER (WHERE s.codigo IS NOT NULL), '{}') AS setores
       FROM cnes.estabelecimento e
       LEFT JOIN ibge.setor s ON s.municipio = 1302603 AND ST_DWithin(ST_PointOnSurface(s.geom)::geography, e.geom::geography, 1000)
       WHERE e.tipo = '02' AND e.gestao = 'municipal' AND e.geom IS NOT NULL GROUP BY e.codigo, e.nome`,
    );
    const ordemUbs = ordenar(
      ubs.rows.map((u) => {
        const chaves = (u.setores as string[]).map((x) => x.trim());
        const peso = chaves.reduce((t, k) => t + (valorSetor.get(k)?.criancas_0_4 ?? 0) + (valorSetor.get(k)?.idosos_60_mais ?? 0), 0);
        return { codigo: u.codigo, nome: u.nome, peso, chaves };
      }),
    );
    const semPontoUbs = Number(
      (await db.query(`SELECT count(*) FROM cnes.estabelecimento WHERE tipo = '02' AND gestao = 'municipal' AND geom IS NULL`)).rows[0]
        .count,
    );

    // School days with smoke (METAR FU, measured), 2012-2026; pupil-hours above the threshold (AirGradient, measured).
    const dias = await db.query(
      `SELECT c.dia::text AS dia, c.fim_de_semana, c.feriado, c.escola, s.horas_fu, s.metar_obs, a.pm25
       FROM contexto.dia c
       LEFT JOIN analise.serie_dia s USING (dia)
       LEFT JOIN (SELECT (inicio AT TIME ZONE 'America/Manaus')::date AS dia, avg(valor) AS pm25 FROM openaq.medicao
                  WHERE parametro = 'pm25' GROUP BY 1 HAVING count(*) >= 18) a USING (dia)
       WHERE c.dia BETWEEN '2012-01-01' AND current_date ORDER BY c.dia`,
    );
    const inicio = new Map<string, string>();
    for (const d of dias.rows)
      if (/Início do ano letivo da rede municipal/.test(d.escola ?? '') && !inicio.has(d.dia.slice(0, 4)))
        inicio.set(d.dia.slice(0, 4), d.dia);
    const letivos = dias.rows.filter((d) => letivo(d, inicio.get(d.dia.slice(0, 4))));
    const porAno = [...Map.groupBy(letivos, (d) => d.dia.slice(0, 4))].map(([ano, ds]) => ({
      ano,
      letivos: ds.length,
      com_metar: ds.filter((d) => d.metar_obs).length,
      com_fu: ds.filter((d) => d.horas_fu >= 1).length,
      inicio: inicio.get(ano) ?? `${ano}-02-05 (sem data no calendário)`,
    }));
    const matUniverso = ordemEscolas.reduce((t, e) => t + e.peso, 0);
    const horas = ['2025', '2026'].flatMap((ano) =>
      LIMIARES.map((limiar) => {
        const ds = letivos.filter((d) => d.dia.startsWith(ano) && d.pm25 !== null);
        const acima = ds.filter((d) => d.pm25 > limiar).length;
        return { ano, limiar, com_sensor: ds.length, acima, horas_aluno: acima * matUniverso * HORAS_POR_DIA };
      }),
    );

    // Exploratory: public purchases of air purifiers, or air conditioning for schools, in Manaus (PNCP, keyword search).
    const compras = await db.query(
      `SELECT ano_compra AS ano, CASE WHEN objeto ~* 'purificador(es)? de ar|filtro(s)? hepa' THEN 'purificador de ar' ELSE 'climatização em escola' END AS tipo,
         count(*)::int AS n, sum(coalesce(valor_homologado, valor_estimado))::float8 AS valor
       FROM pncp.contratacao WHERE municipio_ibge = 1302603
         AND (objeto ~* 'purificador(es)? de ar|filtro(s)? hepa' OR (objeto ~* 'climatiza|ar[- ]condicionado' AND objeto ~* 'escola|educa|creche|seduc|semed'))
       GROUP BY 1, 2 ORDER BY 1, 2`,
    );

    const selvaDias = Number(
      (
        await db.query(
          `SELECT count(DISTINCT dia) FROM (SELECT (visto_em AT TIME ZONE 'America/Manaus')::date AS dia, sensor FROM selva.leitura
           GROUP BY 1, 2 HAVING count(DISTINCT date_trunc('hour', visto_em)) >= 18) x`,
        )
      ).rows[0].count,
    );
    const cobEscolas = cobertura(ordemEscolas, valorEscola, [10, 50, 100]);
    const cobUbs = cobertura(ordemUbs, valorSetor, [10, 30]);
    const csv = [
      'parte,n_ou_ano,campo,valor,total,parcela',
      ...cobEscolas.map((c) => `escolas,${c.n},${c.campo},${c.coberto},${c.total},${c.parcela.toFixed(4)}`),
      ...cobUbs.map((c) => `ubs,${c.n},${c.campo},${c.coberto},${c.total},${c.parcela.toFixed(4)}`),
      ...porAno.map((a) => `dias_letivos,${a.ano},com_fu,${a.com_fu},${a.letivos},`),
      ...horas.map((h) => `horas_aluno_${h.limiar},${h.ano},dias_acima,${h.acima},${h.com_sensor},${h.horas_aluno}`),
    ].join('\n');
    const linhaCob = (c: (typeof cobEscolas)[number]) =>
      `| ${c.n} | ${ROTULO[c.campo]} | ${num(c.coberto)} | ${num(c.total)} | ${pct(c.parcela)} |`;
    const md = [
      '# Salas de ar limpo em escolas públicas e UBS: ordem e cobertura',
      '',
      `Gerado em ${new Date().toISOString().slice(0, 10)} por \`analise/solucoes/salas-ar-limpo.ts\` (#114), banco \`${process.env.PGDATABASE}\`. Regras escritas antes do dado, na seção "Como avaliar" de \`pesquisa/solucoes/salas-ar-limpo-escolas-ubs.md\` (#110). É conta de cobertura: sem hipótese nem p-valor.`,
      '',
      'A fumaça é tratada como igual na cidade toda, porque o CAMS é uma célula só sobre Manaus. A ordem diz quem tem mais gente, não quem respira mais fumaça.',
      '',
      '## [registro] Universo',
      `- Escolas públicas (federal, estadual, municipal) em atividade com educação infantil ou ensino fundamental, Censo Escolar 2024 (INEP): ${ordemEscolas.length}, com ${num(matUniverso)} matrículas de 0 a 14 anos. O total de Manaus (todas as redes, privada inclusive) é ${num(cobEscolas[0].total)}.`,
      `- UBS de gestão municipal (CNES, tipo 02, set/2026): ${ordemUbs.length} com ponto${semPontoUbs ? `, ${semPontoUbs} sem` : ''}. Crianças de 0 a 4 e idosos de 60+ dos setores do Censo 2022 cujo centro fica a até 1 km; um setor perto de duas UBS conta uma vez.`,
      '',
      '## [registro] Cobertura das N primeiras escolas (ordem: matrículas de 0 a 14 anos)',
      '| N | o quê | coberto | total de Manaus | parte |',
      '|---|---|---|---|---|',
      ...cobEscolas.map(linhaCob),
      '',
      `As 10 primeiras: ${ordemEscolas
        .slice(0, 10)
        .map((e) => `${e.nome} (${e.rede}, ${num(e.peso)})`)
        .join('; ')}.`,
      '',
      '## [registro] Cobertura das N primeiras UBS (ordem: crianças de 0 a 4 e idosos de 60+ a até 1 km)',
      '| N | o quê | coberto | total de Manaus | parte |',
      '|---|---|---|---|---|',
      ...cobUbs.map(linhaCob),
      '',
      `As 10 primeiras: ${ordemUbs
        .slice(0, 10)
        .map((u) => `${u.nome} (${num(u.peso)})`)
        .join('; ')}.`,
      '',
      '## [medido] Dias letivos com fumaça por ano (FU no METAR do aeroporto)',
      'Dia letivo (regra provisória, Em aberto): dia útil sem feriado, do início do ano letivo da rede municipal (5/2 quando o calendário não tem a data) a 15/12, fora do recesso de julho que o calendário tem e do período remoto da Covid-19 (17/03/2020 a 22/08/2021). O calendário oficial (#60) só tem eventos, não a lista dos dias letivos. Dia com fumaça: 1 hora ou mais de FU.',
      '',
      '| ano | dias letivos | com METAR | com FU | início usado |',
      '|---|---|---|---|---|',
      ...porAno.map((a) => `| ${a.ano} | ${a.letivos} | ${a.com_metar} | ${a.com_fu} | ${a.inicio} |`),
      '',
      '## [medido] Horas-aluno em dias letivos acima do limiar (AirGradient do Centro, OpenAQ)',
      `Dias letivos com média do dia (18 horas ou mais de leitura) acima do limiar × ${num(matUniverso)} matrículas de 0 a 14 anos do universo × ${HORAS_POR_DIA} h (mínimo da LDB). Um sensor só, no Centro, sem correção (#42): vale para a cidade só pela regra acima. Limiar provisório (Em aberto, #110): 50 µg/m³ (Conama 506/2024 em vigor); 15 µg/m³ (OMS).`,
      '',
      '| ano | limiar (µg/m³) | dias letivos com sensor | acima | horas-aluno |',
      '|---|---|---|---|---|',
      ...horas.map((h) => `| ${h.ano} | ${h.limiar} | ${h.com_sensor} | ${h.acima} | ${num(h.horas_aluno)} |`),
      '',
      '## [terceiros] Quanto a sala reduz',
      'Purificador HEPA: o PM2,5 dentro cai de 48 a 78% em dia de fumaça (Xiang et al., Sci Total Environ 2021, 5 casas em Seattle). Faixa de terceiros, nunca medida aqui; cai muito com janela aberta.',
      '',
      '## Exploratório',
      `- Diferença entre bairros nos dias de fumaça pelo SELVA: não feito. Só ${selvaDias} dia(s) têm 18 horas ou mais de leitura de algum sensor do SELVA, menos que os 10 dias pedidos (a coleta a cada 10 min começou no fim de outubro de 2026).`,
      `- [registro] Compras públicas em Manaus no PNCP, por palavra no objeto (purificador de ar ou filtro HEPA; climatização ou ar-condicionado com escola, educação, creche, Seduc ou Semed): ${
        compras.rows.length ? compras.rows.map((c) => `${c.ano} ${c.tipo}: ${c.n} (R$ ${num(c.valor)})`).join('; ') : 'nenhuma'
      }. Busca por palavra: pode faltar compra com outro nome e sobrar item que não é de sala.`,
      '',
    ].join('\n');
    const dir = await mkdtemp(join(tmpdir(), 'salas-'));
    try {
      for (const [nome, texto] of [
        ['salas-ar-limpo.md', md],
        ['salas-ar-limpo.csv', csv + '\n'],
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
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
