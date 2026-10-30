// Sensor network coverage (#115), by the rules of "Como avaliar" in pesquisa/solucoes/rede-oficial-medicao-ar.md and
// sensores-escolas-dado-aberto.md (#110).
//   node analise/solucoes/sensores-cobertura.ts [--ate AAAA-MM-DD]     this PC; the 14 days end the day before --ate
// Writes produtos/solucoes/sensores-cobertura.md and .csv on R2.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { enviar } from '../../coleta/lib/baixar.ts';

/**
 * Greedy pick of up to `k` new sensor sites: each time the candidate that covers the most people in tracts not covered
 * yet (ties by id). Stops early when no candidate adds anyone.
 */
export function escolherUmAUm(
  candidatos: { id: string; setores: string[] }[],
  pessoas: Map<string, number>,
  cobertos: Set<string>,
  k: number,
) {
  const ja = new Set(cobertos);
  const escolhidos: { id: string; novos: number; acumulado: number }[] = [];
  let acumulado = 0;
  while (escolhidos.length < k) {
    let melhor: { id: string; setores: string[]; novos: number } | undefined;
    for (const c of candidatos) {
      const novos = [...new Set(c.setores.filter((s) => !ja.has(s)))].reduce((s, x) => s + (pessoas.get(x) ?? 0), 0);
      if (novos > (melhor?.novos ?? 0) || (melhor && novos === melhor.novos && c.id < melhor.id)) melhor = { ...c, novos };
    }
    if (!melhor) break;
    for (const s of melhor.setores) ja.add(s);
    acumulado += melhor.novos;
    escolhidos.push({ id: melhor.id, novos: melhor.novos, acumulado });
  }
  return escolhidos;
}

// AirGradient of the Centre: OpenAQ location 5040030 (coordinates asked to the API on 2026-10-30).
const AIRGRADIENT = { lat: -3.120919, lon: -60.021406 };
const HORAS = 14 * 24;
const NO_AR = 0.8; // reading in 80% of the hours of the last 14 days
const RAIO = 2000; // m

/** Distance in metres, flat approximation (fine at city scale near the equator). */
export const metros = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  111_200 * Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180));
const num = (x: number) => Math.round(x).toLocaleString('pt-BR');
const pct = (x: number) => `${(100 * x).toFixed(1).replace('.', ',')}%`;

type Sensor = { id: string; nome: string; tipo: 'referência' | 'indicativo'; horas: number; lat: number; lon: number };

async function principal(args: string[]) {
  const i = args.indexOf('--ate');
  const ate = i >= 0 ? args[i + 1] : new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10);
  const db = new pg.Client();
  await db.connect();
  try {
    // Hours with a reading in the 14 Manaus days before `ate`.
    const janela = [ate, ate];
    const ag = await db.query(
      `SELECT count(DISTINCT date_trunc('hour', inicio))::int AS h FROM openaq.medicao WHERE parametro = 'pm25'
       AND (inicio AT TIME ZONE 'America/Manaus') >= $1::date - 14 AND (inicio AT TIME ZONE 'America/Manaus') < $2::date`,
      janela,
    );
    const fio = await db.query(
      `SELECT e.id, e.nome, ST_Y(e.geom) AS lat, ST_X(e.geom) AS lon, count(DISTINCT date_trunc('hour', m.hora_local))::int AS h
       FROM monitorar.estacao e LEFT JOIN monitorar.medicao m ON m.estacao = e.id AND m.hora_local >= $1::date - 14 AND m.hora_local < $2::date
       WHERE ST_DWithin(e.geom::geography, ST_SetSRID(ST_MakePoint(-60.02, -3.1), 4326)::geography, 40000) GROUP BY 1, 2, 3, 4`,
      janela,
    );
    const selva = await db.query(
      `SELECT s.id, s.nome, ST_Y(s.geom) AS lat, ST_X(s.geom) AS lon, count(DISTINCT date_trunc('hour', l.visto_em))::int AS h
       FROM selva.sensor s JOIN ibge.municipio m ON m.codigo = 1302603 AND ST_Intersects(m.geom, s.geom)
       LEFT JOIN selva.leitura l ON l.sensor = s.id AND (l.visto_em AT TIME ZONE 'America/Manaus') >= $1::date - 14 AND (l.visto_em AT TIME ZONE 'America/Manaus') < $2::date
       GROUP BY 1, 2, 3, 4`,
      janela,
    );
    const desde = (
      await db.query(
        `SELECT (SELECT min(hora_local)::text FROM monitorar.medicao) AS fio, (SELECT min(visto_em)::date::text FROM selva.leitura WHERE visto_em > '2026-10-01') AS selva,
           (SELECT min(inicio)::date::text FROM openaq.medicao) AS ag`,
      )
    ).rows[0];
    const sensores: Sensor[] = [
      { id: 'openaq-5040030', nome: 'AirGradient do Centro (OpenAQ)', tipo: 'indicativo', horas: ag.rows[0].h, ...AIRGRADIENT },
      ...fio.rows.map((r) => ({
        id: `monitorar-${r.id}`,
        nome: `${r.nome} (FioAres, MonitorAr)`,
        tipo: 'referência' as const,
        horas: r.h,
        lat: r.lat,
        lon: r.lon,
      })),
      ...selva.rows.map((r) => ({
        id: `selva-${r.id}`,
        nome: `${r.nome} (SELVA)`,
        tipo: 'indicativo' as const,
        horas: r.h,
        lat: r.lat,
        lon: r.lon,
      })),
    ];
    const noAr = sensores.filter((x) => x.horas >= NO_AR * HORAS);

    // Census tracts (centre) and schools within 2 km of each point, computed here (a few million distances).
    const centros = (
      await db.query(
        `SELECT codigo, ST_Y(c) AS lat, ST_X(c) AS lon FROM (SELECT codigo, ST_PointOnSurface(geom) AS c FROM ibge.setor WHERE municipio = 1302603) x`,
      )
    ).rows.map((r) => ({ id: r.codigo.trim() as string, lat: r.lat as number, lon: r.lon as number }));
    const pontosEscola = (
      await db.query(
        `SELECT codigo::text AS id, ST_Y(geom) AS lat, ST_X(geom) AS lon FROM inep.escola WHERE situacao = 'em atividade' AND geom IS NOT NULL`,
      )
    ).rows;
    const perto = async (pontos: { id: string; lat: number; lon: number }[]) =>
      new Map(
        pontos.map((p) => [
          p.id,
          {
            setores: centros.filter((c) => metros(p, c) <= RAIO).map((c) => c.id),
            escolas: pontosEscola.filter((e) => metros(p, e) <= RAIO).map((e) => e.id),
          },
        ]),
      );
    const pop = await db.query(
      `SELECT setor, coalesce(pessoas, 0)::float8 AS pessoas, coalesce(idade_0_4, 0)::float8 AS c, coalesce(idade_60_mais, 0)::float8 AS i
       FROM contexto.populacao_setor WHERE municipio = 1302603`,
    );
    const setor = new Map(pop.rows.map((r) => [r.setor.trim(), r]));
    const somaSetores = (ks: Iterable<string>) =>
      [...ks].reduce(
        (t, k) => ({ p: t.p + (setor.get(k)?.pessoas ?? 0), c: t.c + (setor.get(k)?.c ?? 0), i: t.i + (setor.get(k)?.i ?? 0) }),
        {
          p: 0,
          c: 0,
          i: 0,
        },
      );
    const total = somaSetores(setor.keys());
    const pertoSensor = await perto(noAr);
    const cobertos = (tipo?: Sensor['tipo']) =>
      new Set(noAr.filter((x) => !tipo || x.tipo === tipo).flatMap((x) => pertoSensor.get(x.id)!.setores));
    const cob = (['referência', 'indicativo', undefined] as const).map((tipo) => ({
      tipo: tipo ?? 'qualquer',
      ...somaSetores(cobertos(tipo)),
    }));

    // Candidates: public schools of the clean-air rooms universe and municipal health units, with a point.
    const cand = await db.query(
      `SELECT 'escola ' || codigo AS id, nome, ST_Y(geom) AS lat, ST_X(geom) AS lon FROM inep.escola
       WHERE situacao = 'em atividade' AND rede <> 'privada' AND geom IS NOT NULL
         AND coalesce(mat_creche, 0) + coalesce(mat_pre, 0) + coalesce(mat_fund_ai, 0) + coalesce(mat_fund_af, 0) > 0
       UNION ALL
       SELECT 'ubs ' || codigo, nome, ST_Y(geom), ST_X(geom) FROM cnes.estabelecimento WHERE tipo = '02' AND gestao = 'municipal' AND geom IS NOT NULL`,
    );
    const pertoCand = await perto(cand.rows);
    const nome = new Map(cand.rows.map((r) => [r.id, r.nome]));
    const pessoas = new Map([...setor].map(([k, v]) => [k, v.pessoas]));
    const proximos = escolherUmAUm(
      cand.rows.map((r) => ({ id: r.id, setores: pertoCand.get(r.id)!.setores })),
      pessoas,
      cobertos(),
      10,
    );

    // Schools (solution 23): pupils within 2 km of a sensor, and the next 10 sensors in schools by new pupils.
    const esc = await db.query(
      `SELECT codigo::text AS codigo, nome, rede, coalesce(mat_total, 0)::float8 AS mat, ST_Y(geom) AS lat, ST_X(geom) AS lon
       FROM inep.escola WHERE situacao = 'em atividade' AND geom IS NOT NULL`,
    );
    const mat = new Map(esc.rows.map((e) => [e.codigo, e.mat]));
    const escolasPerto = new Set(noAr.flatMap((x) => pertoSensor.get(x.id)!.escolas));
    const escCob = ['pública', 'privada'].map((r) => {
      const xs = esc.rows.filter((e) => (e.rede === 'privada') === (r === 'privada'));
      const dentro = xs.filter((e) => escolasPerto.has(e.codigo));
      return {
        rede: r,
        escolas: dentro.length,
        de: xs.length,
        alunos: dentro.reduce((t, e) => t + e.mat, 0),
        alunosDe: xs.reduce((t, e) => t + e.mat, 0),
      };
    });
    const pertoEsc = await perto(esc.rows.map((e) => ({ id: e.codigo, lat: e.lat, lon: e.lon })));
    const nomeEsc = new Map(esc.rows.map((e) => [e.codigo, `${e.nome} (${e.rede})`]));
    const proximasEscolas = escolherUmAUm(
      esc.rows.map((e) => ({ id: e.codigo, setores: pertoEsc.get(e.codigo)!.escolas })),
      mat,
      escolasPerto,
      10,
    );
    const semPonto = Number(
      (await db.query(`SELECT count(*) FROM inep.escola WHERE situacao = 'em atividade' AND geom IS NULL`)).rows[0].count,
    );

    const csv = [
      'parte,id,nome,valor1,valor2,valor3',
      ...sensores.map((x) => `sensor,${x.id},"${x.nome}",${x.horas},${x.horas >= NO_AR * HORAS ? 'no_ar' : 'fora'},${x.tipo}`),
      ...cob.map((c) => `cobertura,${c.tipo},,${c.p},${c.c},${c.i}`),
      `cobertura,total_manaus,,${total.p},${total.c},${total.i}`,
      ...proximos.map((x) => `proximo,${x.id},"${nome.get(x.id)}",${x.novos},${x.acumulado},`),
      ...proximasEscolas.map((x) => `proxima_escola,${x.id},"${nomeEsc.get(x.id)}",${x.novos},${x.acumulado},`),
    ].join('\n');
    const linhaCob = (nomeLinha: string, c: { p: number; c: number; i: number }) =>
      `| ${nomeLinha} | ${num(c.p)} (${pct(c.p / total.p)}) | ${num(c.c)} (${pct(c.c / total.c)}) | ${num(c.i)} (${pct(c.i / total.i)}) |`;
    const md = [
      '# Rede de sensores: quem está coberto hoje e onde faltam',
      '',
      `Gerado em ${new Date().toISOString().slice(0, 10)} por \`analise/solucoes/sensores-cobertura.ts\` (#115), banco \`${process.env.PGDATABASE}\`. Regras escritas antes do dado (#110), em \`pesquisa/solucoes/rede-oficial-medicao-ar.md\` e \`sensores-escolas-dado-aberto.md\`. Conta de cobertura: sem hipótese nem p-valor. Estar a 2 km de um sensor mede cobertura, não exposição nem benefício.`,
      '',
      `## [registro] Sensores e quem está "no ar" (leitura em 80% ou mais das ${HORAS} horas dos 14 dias antes de ${ate})`,
      'Referência: estação da FioAres (MonitorAr). Indicativo: sensor barato (AirGradient, SELVA), sem correção até a #42.',
      '',
      `Primeira hora com leitura no banco: FioAres ${desde.fio ?? 'nenhuma'}, SELVA ${desde.selva ?? 'nenhuma'}, AirGradient ${desde.ag ?? 'nenhuma'}. Hora sem leitura antes disso é falta da nossa coleta, não do sensor: a conta só vale depois de 14 dias de coleta de cada um (refazer na #118).`,
      '',
      '| sensor | tipo | horas com leitura | no ar |',
      '|---|---|---|---|',
      ...sensores.map((x) => `| ${x.nome} | ${x.tipo} | ${x.horas} | ${x.horas >= NO_AR * HORAS ? 'sim' : 'não'} |`),
      '',
      '## [registro] Pessoas a até 2 km de um sensor no ar (centro do setor do Censo 2022)',
      '| sensores | pessoas | crianças de 0 a 4 | idosos de 60+ |',
      '|---|---|---|---|',
      ...cob.map((c) => linhaCob(c.tipo, c)),
      linhaCob('total de Manaus', total),
      '',
      '## [registro] Os próximos 10 pontos (escolas públicas e UBS), um a um pelo maior número de pessoas novas a 2 km',
      '| ordem | ponto | pessoas novas | acumulado |',
      '|---|---|---|---|',
      ...proximos.map(
        (x, k) =>
          `| ${k + 1} | ${nome.get(x.id)} (${x.id.split(' ')[0]}) | ${num(x.novos)} | ${num(x.acumulado)} (${pct(x.acumulado / total.p)}) |`,
      ),
      '',
      '## [registro] Escolas a até 2 km de um sensor no ar (solução 23)',
      `Escolas em atividade do Censo Escolar 2024 com ponto (${semPonto} sem ponto ficam de fora). Faculdades não entram: o CNEFE não as separa.`,
      '',
      '| rede | escolas | alunos |',
      '|---|---|---|',
      ...escCob.map(
        (e) => `| ${e.rede} | ${e.escolas} de ${e.de} | ${num(e.alunos)} de ${num(e.alunosDe)} (${pct(e.alunos / e.alunosDe)}) |`,
      ),
      '',
      'Se os próximos 10 sensores fossem em escolas, escolhidas uma a uma pelo maior número de alunos novos a 2 km:',
      '',
      '| ordem | escola | alunos novos | acumulado |',
      '|---|---|---|---|',
      ...proximasEscolas.map((x, k) => `| ${k + 1} | ${nomeEsc.get(x.id)} | ${num(x.novos)} | ${num(x.acumulado)} |`),
      '',
    ].join('\n');
    const dir = await mkdtemp(join(tmpdir(), 'sensores-'));
    try {
      for (const [n, texto] of [
        ['sensores-cobertura.md', md],
        ['sensores-cobertura.csv', csv + '\n'],
      ]) {
        await writeFile(join(dir, n), texto);
        await enviar(join(dir, n), `produtos/solucoes/${n}`, { sobrescrever: true });
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
