// Yearly population (#63): SIDRA answers (estimates, censuses) and the IBGE projection table → ibge.populacao_ano rows.
import { splitCsv } from './csv.ts';

export type LinhaPop = {
  local: string;
  ano: number;
  tipo: 'censo' | 'estimativa' | 'projecao';
  sexo: string;
  idade: string;
  pessoas: number;
  fonte: string;
};

/** SIDRA /values JSON (first element = header): one total per year. */
export function linhasSidra(json: { V: string; D3N: string }[], o: Pick<LinhaPop, 'local' | 'tipo' | 'fonte'>): LinhaPop[] {
  return json
    .slice(1)
    .filter((r) => /^\d+$/.test(r.V))
    .map((r) => ({ ...o, ano: Number(r.D3N), sexo: 'total', idade: 'total', pessoas: Number(r.V) }));
}

const SEXO: Record<string, string> = { Ambos: 'total', Homens: 'masculino', Mulheres: 'feminino' };
const faixa = (inicio: number) => (inicio < 5 ? '0-4' : inicio < 15 ? '5-14' : inicio < 60 ? '15-59' : '60+');

/** "Projeções da População" table by 5-year group (as CSV): the rows of one UF summed into bands, plus the total. */
export function linhasProjecao(csv: string, sigla: string, fonte: string): LinhaPop[] {
  const linhas = csv.split('\n').map((l) => splitCsv(l.replace(/\r$/, '')));
  const cab = linhas.findIndex((l) => l[0]?.trim() === 'GRUPO ETÁRIO');
  if (cab < 0) throw new Error('cabeçalho da projeção não encontrado');
  const anos = linhas[cab].slice(5).map(Number);
  const soma = new Map<string, number>(); // `${ano}|${sexo}|${idade}`
  for (const l of linhas.slice(cab + 1)) {
    const inicio = parseInt(l[0]);
    if (l[3] !== sigla || !SEXO[l[1]] || Number.isNaN(inicio)) continue;
    anos.forEach((ano, i) => {
      const n = Number(l[5 + i]);
      for (const idade of [faixa(inicio), 'total']) {
        const k = `${ano}|${SEXO[l[1]]}|${idade}`;
        soma.set(k, (soma.get(k) ?? 0) + n);
      }
    });
  }
  return [...soma].map(([k, pessoas]) => {
    const [ano, sexo, idade] = k.split('|');
    return { local: sigla, ano: Number(ano), tipo: 'projecao' as const, sexo, idade, pessoas, fonte };
  });
}
