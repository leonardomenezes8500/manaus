// The "cadeia completa" of a day (#93): day → spots → areas and land → embargoes and notices → hospitalisations →
// bodies and spending, each item with its label (measured, modeled, official record, rule) and its source (card and
// table or raw file). Reads what M3 and M4 put in the database; no new source.
//   node analise/fumaca/cadeia.ts --dia AAAA-MM-DD     → produtos/fumaca/cadeia/AAAA-MM-DD.json and .md on R2
// The API route /cadeia/:dia returns the same JSON (montarCadeia). The CAR link (property code, embargoes on the
// property) waits for the CAR download (#83, #84): until then it says "pendente".
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type pg from 'pg';
import { enviar } from '../../coleta/lib/baixar.ts';
import { BBOX_CAMADAS, bboxTexto } from '../../coleta/regiao.ts';
import { type Area, responsaveis } from '../fogo/responsavel.ts';

export type Fisc = {
  orgao: string;
  numero: string;
  data: string | null;
  pessoa: string | null;
  nome: string | null;
  tipo?: string | null;
  arquivo: string;
};
export type Foco = {
  foco: number;
  peso: number;
  lat: number;
  lon: number;
  municipio: string | null;
  uf: string | null;
  fora_caixa: boolean;
  urbano: boolean; // inside an urban census tract (IBGE)
  uc_esfera: string | null;
  ti: boolean;
  assentamento: string | null;
  cnfp: string | null;
  prodes: string | null;
  deter: string | null;
  sigef: string | null;
  alerta: number | null;
  arquivo_foco: string;
  embargos: Fisc[];
  autos: Fisc[];
};
export type Insumos = {
  dia: string;
  ar: {
    fu_horas: number | null;
    pm25_centro: { media: number; max: number; horas: number } | null;
    iqar_fioares_max: number | null;
    cams_pm25: number | null;
  };
  focos_total: number;
  focos: Foco[];
  saude:
    | { publicado: false; esperado_em: string; efeito_rodada5: string | null }
    | {
        publicado: true;
        parcial: boolean;
        internacoes: number;
        media_outros_anos: number;
        anos: string;
        arquivo: string;
        efeito_rodada5: string | null;
      };
  gasto: { mes: { acao: string; uf: string | null; liquidado: number }[]; ano: { acao: string; uf: string | null; liquidado: number }[] };
  contratos: { sigla: string; contratos: number; valor: number }[];
};
type Rotulo = 'medido' | 'modelado' | 'registro oficial' | 'regra' | 'sem dado';
export type Elo = { titulo: string; itens: { texto: string; rotulo: Rotulo; fonte: string }[] };

/** The type of area of a spot, in the order of the rule (#91): the first that applies wins. */
export function areaDoFoco(
  f: Pick<Foco, 'fora_caixa' | 'uf' | 'prodes' | 'uc_esfera' | 'ti' | 'municipio' | 'urbano' | 'assentamento' | 'cnfp'>,
): Area {
  if (f.fora_caixa || !f.uf || f.uf === 'fora') return 'sem_regra';
  // The rule (#91) names AM agencies and laws; a spot not classified by onde-queimou has no area at all.
  if (f.uf !== 'AM' || f.prodes === null) return 'sem_regra';
  if (f.uc_esfera === 'Federal') return 'uc_federal';
  if (f.ti) return 'ti';
  if (f.uc_esfera === 'Estadual') return 'uc_estadual';
  if (f.municipio === 'Manaus' && f.urbano) return 'manaus_urbano';
  if (f.assentamento) return 'assentamento';
  if (f.cnfp === 'B') return 'floresta_publica_nao_destinada';
  return 'imovel_rural'; // shortcut: any other land in Brazil is taken as a rural property until the CAR (#84) says which
}

const n0 = (x: number) => Math.round(x).toLocaleString('pt-BR');
const n1 = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const reais = (x: number) =>
  x < 1e6
    ? `R$ ${Math.round(x / 1e3).toLocaleString('pt-BR')} mil`
    : `R$ ${(x / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} milhões`;
/**
 * Personal data (#81): an individual only by the term number. A CNPJ is not enough: an MEI or sole trader is named
 * after the person (often with the CPF), so only names with a company form and no long digit run are shown.
 */
export const nomePublico = (pessoa: string | null, nome: string | null) =>
  pessoa === 'PJ' &&
  !!nome &&
  !/\d{5}/.test(nome) &&
  /\b(LTDA|S\.?\/?A\.?|EIRELI|CIA|COMPANHIA|COOPERATIVA|ASSOCIA[CÇ][AÃ]O|FUNDA[CÇ][AÃ]O|INSTITUTO|PREFEITURA|MUNIC[IÍ]PIO|ESTADO)\b/i.test(
    nome,
  )
    ? nome
    : null;
const quem = (x: Fisc) => `${x.orgao} nº ${x.numero}${x.data ? ` de ${x.data}` : ''}${nomePublico(x.pessoa, x.nome) ? `, ${x.nome}` : ''}`;
const PAPEL = { prevencao: 'prevenção', fiscalizacao: 'fiscalização', combate: 'combate', gestao: 'gestão da terra' } as const;

export function montarElos(i: Insumos): Elo[] {
  const { ar } = i;
  const dia: Elo = {
    titulo: 'Dia',
    itens: [
      ar.fu_horas === null
        ? { texto: 'Aeroporto Eduardo Gomes: sem METAR', rotulo: 'sem dado', fonte: 'iem-asos (analise.serie_dia)' }
        : {
            texto: `Aeroporto Eduardo Gomes: ${ar.fu_horas} h com fumaça (FU) no METAR`,
            rotulo: 'medido',
            fonte: 'iem-asos (analise.serie_dia)',
          },
      ar.pm25_centro
        ? {
            texto: `PM2,5 no sensor do Centro: média ${n1(ar.pm25_centro.media)} µg/m³, máximo ${n1(ar.pm25_centro.max)} (${ar.pm25_centro.horas} h)`,
            rotulo: 'medido',
            fonte: 'openaq (analise.fumaca_dia)',
          }
        : { texto: 'PM2,5 no sensor do Centro: sem dado', rotulo: 'sem dado', fonte: 'openaq' },
      ar.iqar_fioares_max === null
        ? { texto: 'FioAres: sem dado (a coleta começou em 21/10/2026)', rotulo: 'sem dado', fonte: 'monitorar (monitorar.medicao)' }
        : { texto: `FioAres: IQAr máximo ${n0(ar.iqar_fioares_max)}`, rotulo: 'medido', fonte: 'monitorar (monitorar.medicao)' },
      ar.cams_pm25 === null
        ? {
            texto: 'PM2,5 do CAMS: sem dado (a reanálise chega com uns 6 meses de atraso)',
            rotulo: 'sem dado',
            fonte: 'ecmwf-ads (cams.pm25_dia)',
          }
        : { texto: `PM2,5 do CAMS: ${n1(ar.cams_pm25)} µg/m³ (modelado)`, rotulo: 'modelado', fonte: 'ecmwf-ads (cams.pm25_dia)' },
    ],
  };
  const focos: Elo = {
    titulo: 'Focos',
    itens: [
      {
        texto: `${n0(i.focos_total)} focos na atribuição v1 do dia; os ${i.focos.length} de maior peso abaixo`,
        rotulo: 'modelado',
        fonte: 'nasa-firms (analise.fumaca_foco)',
      },
      ...i.focos.map((f) => ({
        texto: `foco ${f.foco} (peso na v1, modelado: ${n1(f.peso)}): ${f.municipio ?? 'fora do Brasil'}${f.uf ? `/${f.uf}` : ''} (${f.lat.toFixed(3)}, ${f.lon.toFixed(3)})`,
        rotulo: 'medido' as Rotulo,
        fonte: `nasa-firms (${f.arquivo_foco})`,
      })),
    ],
  };
  const areas: Elo = {
    titulo: 'Áreas e imóveis',
    itens: i.focos.map((f) => {
      const a = areaDoFoco(f);
      if (!f.fora_caixa && f.prodes === null)
        return {
          texto: `foco ${f.foco}: onde caiu ainda não classificado (node analise/fogo/onde-queimou.ts --dia ${i.dia})`,
          rotulo: 'sem dado' as Rotulo,
          fonte: 'analise.onde_queimou_foco',
        };
      const partes = f.fora_caixa
        ? ['fora da caixa das camadas']
        : [
            `área pela regra da #91 (sem o CAR): ${a.replace(/_/g, ' ')}`,
            f.prodes ? `PRODES ${f.prodes.replace(/_/g, ' ')}` : null,
            f.deter && f.deter !== 'nao' ? `DETER ${f.deter.replace(/_/g, ' ')} nos 90 dias antes` : null,
            f.cnfp && f.cnfp !== 'nao' ? `floresta pública tipo ${f.cnfp}` : null,
            f.assentamento ? `assentamento ${f.assentamento}` : null,
            f.sigef ? `parcela SIGEF ${f.sigef}` : null,
            f.alerta ? `alerta MapBiomas ${f.alerta}` : null,
            'imóvel do CAR: pendente (#83)',
          ];
      return {
        texto: `foco ${f.foco}: ${partes.filter(Boolean).join('; ')}`,
        rotulo: 'registro oficial' as Rotulo,
        fonte: 'inpe-prodes, inpe-deter, sfb-cnfp, incra-sigef, mapbiomas-alerta (analise.onde_queimou_foco e tabelas de cada fonte)',
      };
    }),
  };
  const fisc = i.focos.flatMap((f) => [
    ...f.embargos.map((x) => ({ f, x, tipo: 'embargo' })),
    ...f.autos.map((x) => ({ f, x, tipo: 'auto' })),
  ]);
  const fiscalizacao: Elo = {
    titulo: 'Embargos e autos',
    itens: fisc.length
      ? fisc.map(({ f, x, tipo }) => ({
          texto: `foco ${f.foco}: ${tipo === 'embargo' ? 'embargo' : 'auto de infração'} ${quem(x)}${x.tipo ? ` (${x.tipo})` : ''}`,
          rotulo: 'registro oficial' as Rotulo,
          fonte: `${x.orgao === 'IBAMA' ? (tipo === 'embargo' ? 'ibama-embargos' : 'ibama-autos') : 'icmbio-fiscalizacao'} (${x.arquivo})`,
        }))
      : [
          {
            texto: 'nenhum embargo ou auto no lugar desses focos',
            rotulo: 'registro oficial',
            fonte: 'ibama-embargos, ibama-autos, icmbio-fiscalizacao',
          },
        ],
  };
  const s = i.saude;
  const saude: Elo = {
    titulo: 'Internações',
    itens: [
      s.publicado
        ? {
            texto: `internações respiratórias de moradores de Manaus nos 0 a 7 dias depois: ${n0(s.internacoes)}, contra ${n1(s.media_outros_anos)} em média na mesma janela de ${s.anos}${s.parcial ? ' (o mês ainda pode crescer com o processamento)' : ''}`,
            rotulo: 'registro oficial',
            fonte: `datasus-sih (${s.arquivo})`,
          }
        : {
            texto: `internações: ainda não publicado (o DATASUS deve publicar o mês por volta de ${s.esperado_em})`,
            rotulo: 'sem dado',
            fonte: 'datasus-sih',
          },
      {
        texto: s.efeito_rodada5 ? `efeito médio na rodada 5: ${s.efeito_rodada5}` : 'efeito médio: a rodada 5 ainda não rodou',
        rotulo: s.efeito_rodada5 ? 'medido' : 'sem dado', // our test over measured DATASUS counts
        fonte: 'pesquisa/hipoteses/fumaca-internacao-respiratoria.md (#92)',
      },
    ],
  };
  const tipos = [...new Set(i.focos.map(areaDoFoco))];
  const orgaos: Elo = {
    titulo: 'Órgãos e gastos',
    itens: [
      ...tipos.map((a) => {
        const l = responsaveis(a);
        return {
          texto: l.length
            ? `${a.replace(/_/g, ' ')}: ${l.map((x) => `${x.sigla} (${PAPEL[x.papel]}; ${x.norma})`).join('; ')}`
            : `${a.replace(/_/g, ' ')}: sem regra (ela é do AM: foco em outro estado, fora do Brasil, fora da caixa das camadas ou não classificado)`,
          rotulo: 'regra' as Rotulo,
          fonte: 'analise/fogo/responsavel.ts (#91)',
        };
      }),
      ...['mes', 'ano'].map((k) => {
        const g = i.gasto[k as 'mes' | 'ano'];
        const total = g.reduce((t, x) => t + x.liquidado, 0);
        const comUf = g.reduce((t, x) => t + (x.uf ? x.liquidado : 0), 0);
        return {
          texto: `gasto federal do fogo liquidado ${k === 'mes' ? 'no mês' : 'no ano até o mês'}, no país: ${reais(total)}; com estado no localizador: ${reais(comUf)} (o resto vem como nacional ou por região)`,
          rotulo: 'registro oficial' as Rotulo,
          fonte: 'portal-transparencia (transparencia.despesa_fogo_mes)',
        };
      }),
      {
        texto: i.contratos.length
          ? `contratações no PNCP desses órgãos no mês, de qualquer assunto (não só fogo): ${i.contratos.map((c) => `${c.sigla} ${c.contratos} (${reais(c.valor)})`).join('; ')}`
          : 'nenhum contrato desses órgãos no PNCP no mês',
        rotulo: 'registro oficial',
        fonte: 'pncp (contexto.contrato_orgao_fogo_mes)',
      },
    ],
  };
  return [dia, focos, areas, fiscalizacao, saude, orgaos];
}

export function textoCadeia(i: Insumos, elos: Elo[]): string {
  const linhas = [`# Cadeia completa: ${i.dia.split('-').reverse().join('/')}`, ''];
  for (const e of elos) {
    linhas.push(`## ${e.titulo}`, '');
    for (const it of e.itens) linhas.push(`- ${it.texto}. _(${it.rotulo}; fonte: ${it.fonte})_`);
    linhas.push('');
  }
  linhas.push(
    '_Um dia sozinho não prova nada: as ligações (fumaça e internação, fogo e embargo) são testadas nas rodadas de cruzamentos (pesquisa/hipoteses), com anos inteiros e correção para muitos testes. Nome de pessoa física não aparece: só o número do termo ou do auto._',
  );
  return linhas.join('\n') + '\n';
}

/** Everything the links need, from the database (the `top` spots of largest weight). */
export async function buscarInsumos(db: Pick<pg.ClientBase, 'query'>, dia: string, top = 20): Promise<Insumos> {
  const q = async (sql: string, p: unknown[] = [dia]) => (await db.query(sql, p)).rows;
  const [d] = await q(
    `SELECT (SELECT horas_fu FROM analise.serie_dia WHERE dia = $1) AS fu,
            (SELECT json_build_object('media', pm25_medido_media, 'max', pm25_medido_max, 'horas', pm25_medido_horas)
               FROM analise.fumaca_dia WHERE dia = $1 AND pm25_medido_media IS NOT NULL ORDER BY versao DESC LIMIT 1) AS centro,
            (SELECT max(iqar) FROM monitorar.medicao WHERE poluente = 15 AND hora_local::date = $1) AS fioares,
            (SELECT pm25 FROM cams.pm25_dia WHERE dia = $1 AND produto = 'eac4') AS cams,
            (SELECT count(*)::int FROM analise.fumaca_foco WHERE dia = $1 AND versao = 'v1') AS total`,
  );
  const focos = await q(
    `SELECT ff.foco::int, ff.peso, f.lat, f.lon, m.nome AS municipio, coalesce(oq.uf, m.uf) AS uf, coalesce(oq.prodes = 'fora_caixa', false) OR NOT f.geom && ST_MakeEnvelope(${bboxTexto(BBOX_CAMADAS)}, 4326) AS fora_caixa,
            EXISTS (SELECT 1 FROM ibge.setor s WHERE s.situacao = 'Urbana' AND ST_Contains(s.geom, f.geom)) AS urbano,
            (SELECT u.esfera FROM cnuc.unidade u WHERE ST_Intersects(u.geom, f.geom) ORDER BY u.esfera = 'Federal' DESC LIMIT 1) AS uc_esfera,
            coalesce(oq.ti = 'sim', false) AS ti,
            (SELECT a.nome FROM incra.assentamento a WHERE ST_Intersects(a.geom, f.geom) LIMIT 1) AS assentamento,
            oq.cnfp, oq.prodes, oq.deter,
            (SELECT s.codigo_imovel FROM incra.sigef s WHERE ST_Intersects(s.geom, f.geom) LIMIT 1) AS sigef,
            (SELECT a.codigo FROM mapbiomas_alerta.alerta a WHERE ST_Intersects(a.geom, f.geom) ORDER BY a.detectado_em DESC LIMIT 1) AS alerta,
            (SELECT chave FROM bruto.arquivo WHERE id = f.arquivo) AS arquivo_foco,
            coalesce((SELECT json_agg(x ORDER BY x.data DESC) FROM (
               SELECT 'IBAMA' AS orgao, e.numero, e.data::text, e.pessoa, e.embargado AS nome, b.chave AS arquivo
               FROM ibama.embargo e JOIN bruto.arquivo b ON b.id = e.arquivo WHERE ST_Intersects(e.poligono, f.geom) AND NOT e.cancelado
               UNION ALL
               SELECT 'ICMBio', e.numero, e.data::text, e.pessoa, e.autuado, b.chave FROM icmbio.embargo e JOIN bruto.arquivo b ON b.id = e.arquivo
               WHERE ST_Intersects(e.geom, f.geom)) x), '[]') AS embargos,
            coalesce((SELECT json_agg(x ORDER BY x.data DESC) FROM (
               SELECT 'IBAMA' AS orgao, a.numero, a.data::text, a.pessoa, a.infrator AS nome, a.tipo_infracao AS tipo, b.chave AS arquivo
               FROM ibama.auto_infracao a JOIN bruto.arquivo b ON b.id = a.arquivo
               WHERE a.ponto && ST_Expand(f.geom, 0.01) AND ST_DWithin(a.ponto::geography, f.geom::geography, 1000) AND NOT a.cancelado
               ORDER BY a.data DESC LIMIT 5) x), '[]') AS autos
     FROM analise.fumaca_foco ff JOIN firms.foco f ON f.id = ff.foco LEFT JOIN ibge.municipio m ON m.codigo = f.municipio
       LEFT JOIN analise.onde_queimou_foco oq ON oq.foco = ff.foco
     WHERE ff.dia = $1 AND ff.versao = 'v1' ORDER BY ff.peso DESC LIMIT ${Number(top)}`,
  );
  // Hospitalisations of the days 0-7 after: published when the SIH has read the month of the 7th day.
  const fim = new Date(Date.parse(dia) + 7 * 86_400_000).toISOString().slice(0, 10);
  const [sih] = await q(`SELECT max(periodo) AS ultimo FROM datasus.lido WHERE fonte = 'datasus-sih'`, []);
  const efeito = (() => {
    try {
      const m = readFileSync(join(import.meta.dirname, '../../pesquisa/hipoteses/fumaca-internacao-respiratoria.md'), 'utf8').match(
        /^resultado: '(.*)'$/m,
      );
      return m ? m[1] : null;
    } catch {
      return null;
    }
  })();
  let saude: Insumos['saude'];
  if (!sih?.ultimo || fim.slice(0, 7) > sih.ultimo) {
    const [a, mm] = fim.slice(0, 7).split('-').map(Number);
    saude = { publicado: false, esperado_em: new Date(Date.UTC(a, mm + 1, 1)).toISOString().slice(0, 7), efeito_rodada5: efeito };
  } else {
    const [r] = await q(
      `WITH j AS (SELECT extract(year FROM dia)::int AS ano, sum(internacoes) AS n FROM datasus.internacao_dia
                  WHERE grupo = 'respiratorio' AND to_char(dia, 'MM-DD') BETWEEN to_char($1::date, 'MM-DD') AND to_char($2::date, 'MM-DD')
                  GROUP BY 1)
       SELECT (SELECT n FROM j WHERE ano = extract(year FROM $1::date))::float8 AS n,
              (SELECT avg(n) FROM j WHERE ano BETWEEN 2012 AND extract(year FROM $1::date) - 1)::float8 AS media,
              (SELECT chave FROM datasus.lido WHERE fonte = 'datasus-sih' AND periodo = to_char($2::date, 'YYYY-MM')) AS arquivo`,
      [dia, fim],
    );
    const [ua, um] = String(sih.ultimo).split('-').map(Number);
    saude = {
      publicado: true,
      parcial: Date.UTC(ua, um - 1, 1) < Date.UTC(Number(fim.slice(0, 4)), Number(fim.slice(5, 7)) + 5, 1),
      internacoes: r.n ?? 0,
      media_outros_anos: r.media ?? 0,
      anos: `2012–${Number(dia.slice(0, 4)) - 1}`,
      arquivo: r.arquivo ?? 'datasus.internacao_dia',
      efeito_rodada5: efeito,
    };
  }
  const gasto = async (de: string) =>
    (
      await q(
        `SELECT acao, uf, sum(liquidado)::float8 AS liquidado FROM transparencia.despesa_fogo_mes
         WHERE mes BETWEEN $1::date AND date_trunc('month', $2::date) GROUP BY 1, 2 ORDER BY 3 DESC`,
        [de, dia],
      )
    ).map((r) => ({ acao: r.acao, uf: r.uf, liquidado: r.liquidado }));
  const siglas = [...new Set(focos.flatMap((f) => responsaveis(areaDoFoco(f as Foco)).map((x) => x.sigla)))];
  const contratos = await q(
    `SELECT sigla, contratos, coalesce(valor_homologado, 0)::float8 AS valor FROM contexto.contrato_orgao_fogo_mes
     WHERE mes = date_trunc('month', $1::date) AND sigla = ANY($2) ORDER BY 2 DESC`,
    [dia, siglas],
  );
  return {
    dia,
    ar: { fu_horas: d.fu, pm25_centro: d.centro, iqar_fioares_max: d.fioares, cams_pm25: d.cams },
    focos_total: d.total,
    focos: focos as Foco[],
    saude,
    gasto: { mes: await gasto(dia.slice(0, 7) + '-01'), ano: await gasto(dia.slice(0, 4) + '-01-01') },
    contratos: contratos as Insumos['contratos'],
  };
}

export async function montarCadeia(db: Pick<pg.ClientBase, 'query'>, dia: string) {
  const insumos = await buscarInsumos(db, dia);
  return { dia, elos: montarElos(insumos) };
}

async function principal(args: string[]) {
  const dia = args[args.indexOf('--dia') + 1];
  if (!/^\d{4}-\d\d-\d\d$/.test(dia ?? '')) throw new Error('uso: node analise/fumaca/cadeia.ts --dia AAAA-MM-DD');
  const { default: pgReal } = await import('pg');
  const db = new pgReal.Client();
  await db.connect();
  try {
    const insumos = await buscarInsumos(db, dia);
    const elos = montarElos(insumos);
    const tmp = await mkdtemp(join(tmpdir(), 'cadeia-'));
    await writeFile(join(tmp, `${dia}.json`), JSON.stringify({ dia, elos }, null, 2));
    await writeFile(join(tmp, `${dia}.md`), textoCadeia(insumos, elos));
    for (const ext of ['json', 'md'])
      await enviar(join(tmp, `${dia}.${ext}`), `produtos/fumaca/cadeia/${dia}.${ext}`, { sobrescrever: true });
    console.log(textoCadeia(insumos, elos));
  } finally {
    await db.end();
  }
}

if (import.meta.main)
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
