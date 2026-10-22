// Sports calendar from the official APIs (#61), one-off on this PC:
//   NODE_EXTRA_CA_CERTS=coleta/calendario/sectigo-ov-r36.pem node coleta/calendario/esporte.ts
// FIFA (World Cups 1994-2026 and the football of Rio 2016 in Manaus) and CBF (national competitions 2018-2026 with
// a match in Manaus). Each API answer goes to the raw files once; the events go to esporte_api.csv (with the raw key),
// which `node coleta/calendario.ts` loads like the hand-written CSVs. The CBF server sends the wrong intermediate
// certificate: the PEM above is that intermediate (Sectigo OV R36, from the AIA of its own certificate), never -k.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { diaDeManaus } from '../../analise/dia.ts';
import { nomeDoDocumento } from '../calendario.ts';
import { baixar, listKeys, readRaw } from '../lib/baixar.ts';
import type { Periodo } from './regras.ts';

type Doc = { url: string; bruto: string };
type Lado = { IdCountry: string; TeamName: { Description: string }[]; Score: number | null };
type JogoFifa = {
  Date: string;
  Home: Lado | null;
  Away: Lado | null;
  HomeTeamPenaltyScore: number | null;
  AwayTeamPenaltyScore: number | null;
  Stadium: { CityName: { Description: string }[] } | null;
};

const time = (l: Lado | null) => l?.TeamName[0]?.Description ?? '?';
function placarFifa(j: JogoFifa) {
  const pen = j.HomeTeamPenaltyScore != null ? ` (pên. ${j.HomeTeamPenaltyScore}x${j.AwayTeamPenaltyScore})` : '';
  return `${time(j.Home)} ${j.Home?.Score ?? ''}x${j.Away?.Score ?? ''} ${time(j.Away)}${pen}`;
}

/**
 * One FIFA edition → the tournament period (Manaus day of the first match to the final), Brazil's matches and the
 * matches played in Manaus. `soManaus` for tournaments where only the Manaus matches matter (Olympic football 2016).
 */
export function jogosFifa(json: { Results: JogoFifa[] }, nome: string, idSeason: number, doc: Doc, soManaus = false): Periodo[] {
  const jogos = [...json.Results].sort((a, b) => a.Date.localeCompare(b.Date));
  const dia = (j: JogoFifa) => diaDeManaus(new Date(j.Date));
  const base = { tipo: 'esporte', fonte: 'fifa-api', ato: `FIFA, jogos da competição (idSeason ${idSeason})`, ...doc };
  const out: Periodo[] = [];
  if (!soManaus) out.push({ ...base, nome, inicio: dia(jogos[0]), fim: dia(jogos.at(-1)!), abrangencia: 'BR' });
  for (const j of jogos) {
    const emManaus = j.Stadium?.CityName[0]?.Description === 'Manaus';
    if (emManaus) out.push({ ...base, nome: `${nome}, em Manaus: ${placarFifa(j)}`, inicio: dia(j), fim: dia(j), abrangencia: 'Manaus' });
    else if (!soManaus && [j.Home?.IdCountry, j.Away?.IdCountry].includes('BRA'))
      out.push({ ...base, nome: `${nome}, jogo do Brasil: ${placarFifa(j)}`, inicio: dia(j), fim: dia(j), abrangencia: 'BR' });
  }
  return out;
}

type JogoCbf = {
  num_jogo: string;
  cidade: string;
  data: string;
  mandante: { nome: string; gols: string };
  visitante: { nome: string; gols: string };
};

/**
 * One CBF championship table (tabela-detalhada) → its matches in Manaus. The CBF date is the local date of the
 * stadium; shortcut: a match after midnight in Brasília but before it in Manaus would land a day late (none seen).
 */
export function jogosCbf(json: unknown, competicao: string, id: string, doc: Doc): Periodo[] {
  const jogos: JogoCbf[] = [];
  const andar = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(andar);
    else if (o && typeof o === 'object') {
      if ('mandante' in o && 'cidade' in o) jogos.push(o as JogoCbf);
      else Object.values(o).forEach(andar);
    }
  };
  andar(json);
  return jogos
    .filter((j) => j.cidade?.trim().toLowerCase() === 'manaus')
    .map((j) => {
      const [d, m, a] = j.data.trim().split('/');
      const placar = j.mandante.gols !== '' && j.visitante.gols !== '' ? ` ${j.mandante.gols}x${j.visitante.gols} ` : ' x ';
      const dia = `${a}-${m}-${d}`;
      return {
        tipo: 'esporte',
        nome: `${competicao}, em Manaus: ${j.mandante.nome.trim()}${placar}${j.visitante.nome.trim()}`,
        inicio: dia,
        fim: dia,
        abrangencia: 'Manaus' as const,
        fonte: 'cbf',
        ato: `CBF, tabela detalhada do campeonato ${id}, jogo ${j.num_jogo}`,
        ...doc,
      };
    });
}

// idSeason of each edition, from https://api.fifa.com/api/v3/seasons?idCompetition=17|103 (2026-10-22).
const COPAS: [comp: number, nome: string, idSeason: number][] = [
  ...(
    [
      [1994, 84],
      [1998, 1013],
      [2002, 4395],
      [2006, 9741],
      [2010, 249715],
      [2014, 251164],
      [2018, 254645],
      [2022, 255711],
      [2026, 285023],
    ] as const
  ).map(([a, s]) => [17, `Copa do Mundo masculina ${a}`, s] as [number, string, number]),
  ...(
    [
      [1995, 4654],
      [1999, 4644],
      [2003, 6929],
      [2007, 10232],
      [2011, 251475],
      [2015, 266030],
      [2019, 278513],
      [2023, 285026],
    ] as const
  ).map(([a, s]) => [103, `Copa do Mundo feminina ${a}`, s] as [number, string, number]),
];
const OLIMPICO_2016: [number, string, number][] = [
  [512, 'Futebol masculino dos Jogos Rio 2016', 272231],
  [509, 'Futebol feminino dos Jogos Rio 2016', 272253],
];
// CBF competitions in the scope (ROADMAP, M3.5): professional and women's national ones, the national teams' matches.
const CBF =
  /^(Copa do Brasil\|(Profissional|Feminino)|Campeonato Brasileiro\|Série [ABCD]|Brasileiro Feminino\|A[123]|Copa Verde\|Profissional|Copa do Nordeste\|Profissional|Supercopa do Brasil\|(Profissional|Feminino)|Copa América\|Profissional|Amistoso\|Seleção Brasileira( Feminina)?|Eliminat[oó]rias.*)$/;
const CBF_API = 'https://www.cbf.com.br/api/cbf';

const chaves = new Map<string, string[]>();
/** The raw copy of an official document (downloaded once). */
async function documento(fonte: string, url: string): Promise<Doc & { texto: string }> {
  if (!chaves.has(fonte))
    chaves.set(
      fonte,
      (await listKeys(`bruto/${fonte}/`)).map((k) => k.key),
    );
  const nome = nomeDoDocumento(url) + '.json';
  let bruto = chaves.get(fonte)!.find((k) => k.endsWith(`Z_${nome}`));
  if (!bruto) {
    bruto = (await baixar({ fonte, coletor: 'calendario', nome, url, headers: { 'User-Agent': 'Mozilla/5.0' } })).chave;
    console.log(bruto);
  }
  return { url, bruto, texto: await readRaw(bruto) };
}

const csv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

async function principal() {
  const out: Periodo[] = [];
  for (const [comp, nome, s] of [...COPAS, ...OLIMPICO_2016]) {
    const d = await documento(
      'fifa-api',
      `https://api.fifa.com/api/v3/calendar/matches?idCompetition=${comp}&idSeason=${s}&count=500&language=en`,
    );
    out.push(...jogosFifa(JSON.parse(d.texto), nome, s, d, comp !== 17 && comp !== 103));
  }
  const anos = JSON.parse((await documento('cbf', `${CBF_API}/campeonatos/anos`)).texto) as {
    campeonatos: { nome: string; categorias: { nome: string; anos: string | null; id_campeonato: string | null }[] }[];
  };
  for (const c of anos.campeonatos)
    for (const cat of c.categorias) {
      if (!cat.id_campeonato || !CBF.test(`${c.nome.trim()}|${cat.nome.trim()}`)) continue;
      const ids = cat.id_campeonato.split(',').map((s) => s.trim());
      const anosCat = cat.anos!.split(',').map((s) => s.trim());
      for (const [i, id] of ids.entries()) {
        try {
          const d = await documento('cbf', `${CBF_API}/jogos/tabela-detalhada/campeonato/${id}`);
          out.push(...jogosCbf(JSON.parse(d.texto), `${c.nome.trim()} ${cat.nome.trim()} ${anosCat[i]}`, id, d));
        } catch (e) {
          console.error(`CBF ${id} (${c.nome} ${cat.nome} ${anosCat[i]}): ${(e as Error).message}`); // e.g. the 2026 qualifiers give HTTP 500
        }
      }
    }
  out.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome));
  const cols = ['tipo', 'nome', 'inicio', 'fim', 'abrangencia', 'fonte', 'ato', 'url', 'bruto'] as const;
  writeFileSync(
    join(import.meta.dirname, 'esporte_api.csv'),
    [cols.join(','), ...out.map((p) => cols.map((c) => csv(p[c] ?? '')).join(','))].join('\n') + '\n',
  );
  console.log(`${out.length} eventos em esporte_api.csv`);
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
