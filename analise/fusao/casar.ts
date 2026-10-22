// Matching of layer-2 records into entities (#32): normalised name first, overlap (IoU) second, no forced pairs.

const ABREVIACOES: Record<string, string> = {
  sta: 'santa',
  sto: 'santo',
  sra: 'senhora',
  pq: 'parque',
  vl: 'vila',
  cj: 'conjunto',
  conj: 'conjunto',
  jd: 'jardim',
  res: 'residencial',
  dr: 'doutor',
  pres: 'presidente',
  prof: 'professor',
  av: 'avenida',
  tv: 'travessa',
  trav: 'travessa',
  al: 'alameda',
  est: 'estrada',
  rod: 'rodovia',
};
const NUMEROS: Record<string, string> = {
  um: '1',
  dois: '2',
  tres: '3',
  quatro: '4',
  cinco: '5',
  seis: '6',
  sete: '7',
  oito: '8',
  nove: '9',
  dez: '10',
  onze: '11',
  doze: '12',
  treze: '13',
  quatorze: '14',
  catorze: '14',
  quinze: '15',
};

/** Lower case, no accents or punctuation, number words as digits, common abbreviations spelled out. */
export function normalizarNome(nome: string): string {
  const s = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\bn\.?\s*sra\b/g, 'nossa senhora')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return s
    .split(' ')
    .map((t) => ABREVIACOES[t] ?? NUMEROS[t] ?? t)
    .join(' ');
}

export type Registro = { fonte: string; id: string; nome: string };
export type Membro = Registro & { metodo: 'ancora' | 'nome' | 'iou' | 'unico'; confianca: number | null };
export type Grupo = { chave: string; membros: Membro[] };

export const IOU_MINIMO = 0.7;

/**
 * Groups records of several sources into entities. The first source of `prioridade` that has records anchors one
 * group per record; each record of the next sources joins the group with the same normalised name that it overlaps
 * (any IoU > 0), else the group it overlaps best with IoU ≥ 0.7, else it stays alone. A group takes at most one
 * record per source. `iou` keys are "fonte:id|fonte:id" in priority order; pairs that do not touch are absent.
 */
export function casar(registros: Registro[], prioridade: string[], iou: Map<string, number>): Grupo[] {
  const fontes = prioridade.filter((f) => registros.some((r) => r.fonte === f));
  const grupos: { nome: string; membros: Membro[] }[] = [];
  const sozinhos: { nome: string; membros: Membro[] }[] = [];
  const chaveDe = (r: Registro) => `${r.fonte}:${r.id}`;
  const iouCom = (g: { membros: Membro[] }, r: Registro) =>
    Math.max(0, ...g.membros.map((m) => iou.get(`${chaveDe(m)}|${chaveDe(r)}`) ?? 0));

  for (const [i, fonte] of fontes.entries()) {
    for (const r of registros.filter((x) => x.fonte === fonte)) {
      const nome = normalizarNome(r.nome);
      if (i === 0) {
        grupos.push({ nome, membros: [{ ...r, metodo: 'ancora', confianca: null }] });
        continue;
      }
      const livres = grupos.filter((g) => !g.membros.some((m) => m.fonte === fonte));
      const porNome = livres.find((g) => g.nome === nome && iouCom(g, r) > 0);
      if (porNome) {
        porNome.membros.push({ ...r, metodo: 'nome', confianca: iouCom(porNome, r) });
        continue;
      }
      const melhor = livres.map((g) => ({ g, v: iouCom(g, r) })).sort((a, b) => b.v - a.v)[0];
      if (melhor && melhor.v >= IOU_MINIMO) melhor.g.membros.push({ ...r, metodo: 'iou', confianca: melhor.v });
      else sozinhos.push({ nome, membros: [{ ...r, metodo: 'unico', confianca: null }] });
    }
  }

  // chave = normalised name of the first member; repeated names get " 2", " 3"...
  const vistos = new Map<string, number>();
  return [...grupos, ...sozinhos].map(({ nome, membros }) => {
    const n = (vistos.get(nome) ?? 0) + 1;
    vistos.set(nome, n);
    return { chave: n === 1 ? nome : `${nome} ${n}`, membros };
  });
}
