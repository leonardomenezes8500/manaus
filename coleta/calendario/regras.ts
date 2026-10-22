// Official calendar (#60): the dates that come from a rule written in law (fixed day or counted from Easter), with the
// act and the Planalto URL of each, and the reader of the CSVs of yearly documents (portarias, decrees, programmes).
import { splitCsv } from '../carga/csv.ts';

export type Periodo = {
  tipo: string;
  nome: string;
  inicio: string; // AAAA-MM-DD
  fim: string;
  abrangencia: 'BR' | 'AM' | 'Manaus';
  fonte: string; // catalog id
  ato: string;
  url: string; // official document; it goes to the raw files through baixar()
  bruto?: string; // its raw key, once downloaded
};

export const TIPOS = ['feriado', 'ponto_facultativo', 'eleicao', 'festa', 'escola', 'esporte'];
const P = 'https://www.planalto.gov.br/ccivil_03/';
const DIA = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const somar = (dia: string, n: number) => iso(Date.parse(dia) + n * DIA);

/** Easter Sunday (Gregorian, Meeus/Jones/Butcher). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(Date.UTC(ano, mes - 1, dia));
}

/** Days counted from Easter. Which of them is a holiday or a ponto facultativo depends on the act of each year. */
export function daPascoa(ano: number) {
  const p = pascoa(ano);
  return {
    carnavalSegunda: somar(p, -48),
    carnavalTerca: somar(p, -47),
    cinzas: somar(p, -46),
    sextaSanta: somar(p, -2),
    corpusChristi: somar(p, 60),
  };
}

const br = (ano: number, md: string, nome: string, ato: string, url: string): Periodo => {
  const d = `${ano}-${md}`;
  return { tipo: 'feriado', nome, inicio: d, fim: d, abrangencia: 'BR', fonte: 'planalto-legislacao', ato, url: P + url };
};

/** National holidays of a year, each with the federal law in force that year. */
export function feriadosNacionais(ano: number): Periodo[] {
  const l662 = 'Lei 662/1949, art. 1º';
  const red = ano >= 2003 ? ' (redação da Lei 10.607/2002)' : '';
  const u662 = ano >= 2003 ? 'leis/2002/l10607.htm' : 'leis/l0662.htm';
  const out = [
    br(ano, '01-01', 'Confraternização Universal', l662 + red, u662),
    ano >= 2003
      ? br(ano, '04-21', 'Tiradentes', l662 + red, u662)
      : br(ano, '04-21', 'Tiradentes', 'Lei 1.266/1950, art. 3º', 'leis/l1266.htm'),
    br(ano, '05-01', 'Dia do Trabalho', l662 + red, u662),
    br(ano, '09-07', 'Independência do Brasil', l662 + red, u662),
    br(ano, '10-12', 'Nossa Senhora Aparecida', 'Lei 6.802/1980, art. 1º', 'leis/l6802.htm'),
    // Before 2003, 2 November was a municipal "dia de guarda" (Lei 9.093/1995): it comes from the Manaus law, not from here.
    ...(ano >= 2003 ? [br(ano, '11-02', 'Finados', l662 + red, u662)] : []),
    br(ano, '11-15', 'Proclamação da República', l662 + red, u662),
    ...(ano >= 2024
      ? [br(ano, '11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'Lei 14.759/2023, art. 1º', '_ato2023-2026/2023/lei/L14759.htm')]
      : []),
    br(ano, '12-25', 'Natal', l662 + red, u662),
  ];
  return out;
}

const ALEAM = 'https://sapl.al.am.leg.br/';
const CMM = 'https://sapl.cmm.am.gov.br/media/sapl/public/normajuridica/';
const LOMAN = {
  ato: 'Lei Orgânica do Município de Manaus (1990), art. 437',
  url: CMM + '2005/6591/loman_atualizada_ate_emenda_122_19a_leg.pdf',
};

// The pandemic laws of Manaus (2.660/2020, 2.718/2020, 2.731/2021, 2.735/2021) suspended municipal holidays; which
// days were really suspended depends on a decree per day that is not in hand, so these days stay empty.
const SUSPENSOS = ['2020-08-21', '2021-12-31'];

/** AM and Manaus holidays of a year, each from its law (state: ALEAM; municipal: Câmara de Manaus). */
export function feriadosLocais(ano: number): Periodo[] {
  const p = daPascoa(ano);
  const um = (abr: 'AM' | 'Manaus', dia: string, nome: string, ato: string, url: string): Periodo => ({
    tipo: 'feriado',
    nome,
    inicio: dia,
    fim: dia,
    abrangencia: abr,
    fonte: abr === 'AM' ? 'aleam-sapl' : 'cmm-manaus',
    ato,
    url,
  });
  const out: Periodo[] = [
    um('AM', `${ano}-09-05`, 'Elevação do Amazonas à categoria de Província', 'Lei estadual 25/1977', ALEAM + 'norma/2038'),
    ...(ano >= 2010
      ? [
          um(
            'AM',
            `${ano}-11-20`,
            'Dia da Consciência Negra',
            'Lei Promulgada estadual 84/2010, art. 1º',
            ALEAM + 'media/sapl/public/normajuridica/2010/9027/9027_texto_integral.pdf',
          ),
        ]
      : []),
  ];
  const manaus: Periodo[] = [
    um('Manaus', `${ano}-09-05`, 'Elevação do Amazonas à categoria de Província', LOMAN.ato, LOMAN.url),
    um('Manaus', `${ano}-10-24`, 'Elevação de Manaus à categoria de Cidade (aniversário de Manaus)', LOMAN.ato, LOMAN.url),
    ...(ano >= 1999
      ? [
          um('Manaus', p.carnavalTerca, 'Carnaval, terça-feira', 'Lei municipal 448/1998', CMM + '1998/3871/lei_n_448_de_11_nov_1998.pdf'),
          um(
            'Manaus',
            p.cinzas,
            'Quarta-feira de Cinzas (até 12h)',
            'Lei municipal 448/1998',
            CMM + '1998/3871/lei_n_448_de_11_nov_1998.pdf',
          ),
          um(
            'Manaus',
            `${ano}-12-08`,
            'Nossa Senhora da Conceição',
            'Lei municipal 496/1999',
            CMM + '1999/3932/lei_n_496_de_05_out_1999.pdf',
          ),
        ]
      : []),
    ...(ano >= 2006
      ? [um('Manaus', p.corpusChristi, 'Corpus Christi', 'Lei municipal 970/2006', CMM + '2006/4308/lei_n_970_de_11_mai_2006.pdf')]
      : []),
    ...(ano >= 2007
      ? [
          um('Manaus', p.sextaSanta, 'Sexta-feira da Paixão', 'Lei municipal 1.001/2006', CMM + '2006/4338/lei_n_1001_de_10_jul_2006.pdf'),
          um(
            'Manaus',
            `${ano}-11-20`,
            'Dia da Consciência Negra',
            'Lei Promulgada municipal 188/2007',
            CMM + '2007/5440/lei_n_188_de_14_jun_2007.pdf',
          ),
        ]
      : []),
  ];
  return [...out, ...manaus.filter((f) => f.inicio < SUSPENSOS[0] || f.inicio > SUSPENSOS[1])].sort((a, b) =>
    a.inicio === b.inicio ? a.abrangencia.localeCompare(b.abrangencia) : a.inicio.localeCompare(b.inicio),
  );
}

/** Sundays of October of a year (ms UTC). */
const domingosDeOutubro = (ano: number) =>
  Array.from({ length: 31 }, (_, i) => Date.UTC(ano, 9, i + 1)).filter((t) => new Date(t).getUTCDay() === 0);

const turno = (nome: string, dia: string, ato: string, url: string): Periodo => ({
  tipo: 'eleicao',
  nome,
  inicio: dia,
  fim: dia,
  abrangencia: 'BR',
  fonte: 'planalto-legislacao',
  ato,
  url: P + url,
});

/**
 * National election rounds of a year (general in 1994, 1998..., municipal in 1996, 2000...). The 2nd round date is
 * national; it only happens where no candidate got a majority. General election day is also a national holiday
 * (Lei 1.266/1950, art. 1º).
 */
export function eleicoes(ano: number): Periodo[] {
  if (ano < 1994 || ano % 2) return [];
  const tipo = ano % 4 === 2 ? 'Eleições gerais' : 'Eleições municipais';
  if (ano === 1994)
    return [
      turno(`${tipo}, 1º turno`, '1994-10-03', 'Lei 8.713/1993, art. 1º', 'leis/l8713.htm'),
      turno(`${tipo}, 2º turno`, '1994-11-15', 'Lei 8.713/1993', 'leis/l8713.htm'),
    ];
  if (ano === 1996)
    return [
      turno(`${tipo}, 1º turno`, '1996-10-03', 'Lei 9.100/1995, art. 1º', 'leis/l9100.htm'),
      turno(`${tipo}, 2º turno`, '1996-11-15', 'Lei 9.100/1995, art. 3º, § 3º', 'leis/l9100.htm'),
    ];
  if (ano === 2020)
    return [
      turno(`${tipo}, 1º turno`, '2020-11-15', 'Emenda Constitucional 107/2020, art. 1º', 'Constituicao/Emendas/Emc/emc107.htm'),
      turno(`${tipo}, 2º turno`, '2020-11-29', 'Emenda Constitucional 107/2020, art. 1º', 'Constituicao/Emendas/Emc/emc107.htm'),
    ];
  // Since 1998: first Sunday of October, 2nd round on the last Sunday of October (Constitution, art. 77, EC 16/1997; Lei 9.504/1997).
  const d = domingosDeOutubro(ano);
  return [
    turno(`${tipo}, 1º turno`, iso(d[0]), 'Lei 9.504/1997, art. 1º', 'leis/l9504.htm'),
    turno(`${tipo}, 2º turno`, iso(d.at(-1)!), 'Lei 9.504/1997, art. 2º, § 1º', 'leis/l9504.htm'),
  ];
}

const COLUNAS = ['tipo', 'nome', 'inicio', 'fim', 'abrangencia', 'fonte', 'ato', 'url', 'bruto'] as const;
const data = /^\d{4}-\d{2}-\d{2}$/;

/** coleta/calendario/<tipo>.csv: one event per line, always with the url of the official document. */
export function lerCsvCalendario(texto: string): Periodo[] {
  const [cab, ...linhas] = texto.trim().split('\n');
  if (cab.trim() !== COLUNAS.join(',')) throw new Error(`cabeçalho do CSV tem que ser: ${COLUNAS.join(',')}`);
  return linhas.map((l, i) => {
    const v = splitCsv(l.replace(/\r$/, ''));
    const p = Object.fromEntries(COLUNAS.map((c, j) => [c, (v[j] ?? '').trim()])) as Periodo;
    const erro = (m: string) => new Error(`linha ${i + 2}: ${m}`);
    if (!p.url) throw erro('falta url');
    if (!TIPOS.includes(p.tipo)) throw erro(`tipo inválido: ${p.tipo}`);
    if (!['BR', 'AM', 'Manaus'].includes(p.abrangencia)) throw erro('abrangencia inválida');
    if (!data.test(p.inicio) || !data.test(p.fim)) throw erro('data não é AAAA-MM-DD');
    if (p.fim < p.inicio) throw erro('fim antes do início');
    for (const c of ['nome', 'fonte', 'ato'] as const) if (!p[c]) throw erro(`falta ${c}`);
    return p;
  });
}
