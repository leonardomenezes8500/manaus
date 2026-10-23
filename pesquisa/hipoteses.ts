// Hypothesis registry (#59): pesquisa/hipoteses/<id>.md, written before collecting (pesquisa/metodo.md).
import { checkFields, type Card } from '../fontes/catalogo.ts';

const OBRIGATORIOS = ['id', 'titulo', 'fontes', 'espera', 'defasagem', 'epoca', 'comparacao', 'teste', 'rodada', 'status', 'escrita_em'];
const VALORES = { status: ['escrita', 'testada', 'sem-teste', 'descartada'], confianca: ['alta', 'media', 'baixa'] };

// Sources already collecting before the method existed (2026-10-22). A new one needs a hypothesis.
const ANTES_DO_METODO = new Set([
  'aeronet',
  'ana-telemetria',
  'ecmwf-cds',
  'geofabrik-norte',
  'ibge-localidades',
  'ibge-malhas',
  'iem-asos',
  'inpe-queimadas',
  'metar-aviationweather',
  'monitorar-mma',
  'nasa-firms',
  'noaa-gfs-nomads',
  'open-meteo-previsao',
  'open-meteo-qualidade-ar',
  'openaq',
]);

const lista = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const data = /^\d{4}-\d{2}-\d{2}$/;

/** Problems of one hypothesis; `ids` = the catalog ids. */
export function validarHipotese(h: Card, arquivo: string, ids: Set<string>): string[] {
  const erros = checkFields(h, arquivo, OBRIGATORIOS, VALORES);
  for (const f of lista(h.fontes)) if (!ids.has(f)) erros.push(`fonte fora do catálogo: ${f}`);
  if (h.escrita_em && !data.test(h.escrita_em)) erros.push('escrita_em não é AAAA-MM-DD');
  if (h.status === 'testada') {
    if (!h.confianca) erros.push('testada sem confianca');
    if (!h.resultado) erros.push('testada sem resultado');
    if (!data.test(h.testada_em ?? '')) erros.push('testada sem testada_em');
    else if (h.testada_em < h.escrita_em) erros.push('testada_em antes de escrita_em');
  }
  return erros;
}

/** Collecting sources that no hypothesis cites (the gate on the catalog). */
export function semHipotese(cards: Card[], hipoteses: Card[]): string[] {
  const citadas = new Set(hipoteses.flatMap((h) => lista(h.fontes)));
  return cards.filter((c) => c.status === 'coletando' && !ANTES_DO_METODO.has(c.id) && !citadas.has(c.id)).map((c) => c.id);
}
