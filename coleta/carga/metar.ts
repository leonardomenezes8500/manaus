// METAR parser (#16): only the fields the analysis uses. Plain regex; the format of these fields is fixed by ICAO.
export type Metar = {
  estacao: string;
  texto: string;
  vento_dir: number | null;
  vento_kt: number | null;
  rajada_kt: number | null;
  visibilidade_m: number | null;
  tempo: string[];
  temperatura: number | null;
  orvalho: number | null;
};

const WIND = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/;
const VARIATION = /^\d{3}V\d{3}$/;
const VISIBILITY = /^(\d{4})(NDV)?$/;
// Intensity/proximity + descriptor + phenomena; a descriptor alone is valid too (VCTS, VCSH, TS).
const WEATHER =
  /^(\+|-|VC)?(?:(MI|PR|BC|DR|BL|SH|TS|FZ)((DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)*)|((DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+))$/;
const TEMPS = /^(M?\d{2})\/(M?\d{2})?$/;
// Statute miles (old IEM records rebuilt from NOAA ISD, before 2012): 7SM, 1/2SM, M1/4SM, "2 1/2SM" (joined below).
const MILES = /^M?(?:(\d+)\+)?(\d+)(?:\/(\d+))?SM$/;
const METERS_PER_MILE = 1609.34;
const temp = (t?: string) => (t ? (t.startsWith('M') ? -Number(t.slice(1)) : Number(t)) : null);

/** Report text as stored: no METAR/SPECI/COR prefix, no trailing '=', single spaces. */
export const cleanText = (s: string) =>
  s
    .trim()
    .replace(/=$/, '')
    .replace(/^(METAR|SPECI)\s+/, '')
    .replace(/\s+/g, ' ');

export function parseMetar(raw: string): Metar {
  const texto = cleanText(raw);
  const tokens = texto
    .split(' RMK')[0]
    .replace(/ (\d) (\d\/\dSM)\b/, ' $1+$2')
    .split(' ');
  const m: Metar = {
    estacao: tokens[0],
    texto,
    vento_dir: null,
    vento_kt: null,
    rajada_kt: null,
    visibilidade_m: null,
    tempo: [],
    temperatura: null,
    orvalho: null,
  };
  for (const t of tokens.slice(2)) {
    let x: RegExpMatchArray | null;
    if (m.vento_kt === null && (x = t.match(WIND))) {
      const factor = x[4] === 'MPS' ? 1.94384 : 1;
      m.vento_dir = x[1] === 'VRB' || Number(x[2]) === 0 ? null : Number(x[1]);
      m.vento_kt = Math.round(Number(x[2]) * factor);
      m.rajada_kt = x[3] ? Math.round(Number(x[3]) * factor) : null;
    } else if (VARIATION.test(t)) {
      continue;
    } else if (t === 'CAVOK') {
      m.visibilidade_m = 10000;
    } else if (m.visibilidade_m === null && (x = t.match(VISIBILITY))) {
      m.visibilidade_m = Number(x[1]) === 9999 ? 10000 : Number(x[1]);
    } else if (m.visibilidade_m === null && (x = t.match(MILES))) {
      const miles = Number(x[1] ?? 0) + (x[3] ? Number(x[2]) / Number(x[3]) : Number(x[2]));
      m.visibilidade_m = Math.min(10000, Math.round(miles * METERS_PER_MILE));
    } else if (WEATHER.test(t)) {
      m.tempo.push(t);
    } else if ((x = t.match(TEMPS))) {
      m.temperatura = temp(x[1]);
      m.orvalho = temp(x[2]);
    }
  }
  return m;
}

/** UTC time of a ddhhmmZ group, taking month and year from `reference` (the download time; the report is never later). */
export function reportTime(texto: string, reference: Date): Date {
  const g = texto.split(' ')[1]?.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  if (!g) throw new Error(`no ddhhmmZ group: ${texto}`);
  const [d, h, mi] = g.slice(1).map(Number);
  let t = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), d, h, mi));
  if (t.getTime() > reference.getTime() + 3600_000)
    t = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, d, h, mi));
  return t;
}
