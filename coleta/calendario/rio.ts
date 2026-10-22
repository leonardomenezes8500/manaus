// River seasons in Manaus (#62): MEASURED level (ana.cota_dia) + a written RULE. At or above the official flood
// threshold the day is cheia, at or below the official drought threshold it is seca; between them the 7-day trend
// decides (rising = enchente, falling = vazante). No trend without the level of 7 days before (a gap is not filled).
import type { Periodo } from './regras.ts';

export type Limiares = { cheiaCm: number; secaCm: number };

/**
 * Official thresholds at the Porto de Manaus gauge (ANA 14990000). Cheia: the "cota de inundação" of 27,50 m (SGB/CPRM
 * and Defesa Civil do AM, cotas de referência, jan/2021). Seca: there is no stable official threshold; 15,80 m is the
 * "alerta de seca" the SGB used in dec/2023 (provisional, Em aberto in #62).
 */
export const LIMIARES: Limiares = { cheiaCm: 2750, secaCm: 1580 };
export const DOC_LIMIARES = 'https://rigeo.sgb.gov.br/bitstream/doc/22012/5/Relat%c3%b3rio_final_corrig2022.pdf';
export const DOC_SECA = 'https://www.sgb.gov.br/sace/boletins/Amazonas/20231201_18-20231201%20-%20191709.pdf';
export type Epoca = 'cheia' | 'seca' | 'enchente' | 'vazante';

export function epocasDoRio(cotas: { dia: string; cm: number }[], l: Limiares): { dia: string; cm: number; epoca: Epoca | null }[] {
  const porDia = new Map(cotas.map((c) => [c.dia, c.cm]));
  return cotas.map(({ dia, cm }) => {
    if (cm >= l.cheiaCm) return { dia, cm, epoca: 'cheia' };
    if (cm <= l.secaCm) return { dia, cm, epoca: 'seca' };
    const antes = porDia.get(new Date(Date.parse(dia) - 7 * 86_400_000).toISOString().slice(0, 10));
    if (antes === undefined || antes === cm) return { dia, cm, epoca: null };
    return { dia, cm, epoca: cm > antes ? 'enchente' : 'vazante' };
  });
}

/** Consecutive days with the same season → one period (a missing day or a day without a season ends it). */
export function agruparEpocas(dias: { dia: string; epoca: Epoca | null }[]): { epoca: Epoca; inicio: string; fim: string }[] {
  const out: { epoca: Epoca; inicio: string; fim: string }[] = [];
  for (const { dia, epoca } of dias) {
    if (!epoca) continue;
    const ult = out.at(-1);
    if (ult && ult.epoca === epoca && Date.parse(dia) - Date.parse(ult.fim) === 86_400_000) ult.fim = dia;
    else out.push({ epoca, inicio: dia, fim: dia });
  }
  return out;
}

const NOMES: Record<Epoca, string> = {
  cheia: 'Cheia do Rio Negro (27,50 m ou mais)',
  seca: 'Seca do Rio Negro (15,80 m ou menos)',
  enchente: 'Enchente do Rio Negro (subindo em 7 dias)',
  vazante: 'Vazante do Rio Negro (descendo em 7 dias)',
};

/**
 * The daily level of the Porto de Manaus (ana.cota_dia) → river season periods for contexto.periodo, from 1994.
 * MEASURED (ANA) + RULE (SGB thresholds). The source is sgb-sace because the document kept in the raw files is the
 * threshold one (an SGB file under the ANA raw prefixes would mix with the ANA loads).
 */
export function periodosDoRio(cotas: { dia: string; cm: number }[]): Periodo[] {
  return agruparEpocas(epocasDoRio(cotas, LIMIARES))
    .filter((p) => p.fim >= '1994-01-01')
    .map((p) => ({
      tipo: 'epoca_rio',
      nome: NOMES[p.epoca],
      inicio: p.inicio,
      fim: p.fim,
      abrangencia: 'Manaus' as const,
      fonte: 'sgb-sace',
      ato: 'regra do #62 sobre a cota diária MEDIDA pela ANA (estação 14990000, HidroWeb e telemetria): cheia a partir da cota de inundação do SGB/Defesa Civil AM (2021), seca a partir de 15,80 m (alerta de seca do SGB, dez/2023, provisório), entre elas a tendência de 7 dias',
      url: p.epoca === 'seca' ? DOC_SECA : DOC_LIMIARES,
    }));
}
