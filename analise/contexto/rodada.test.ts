import { permutacaoBlocos, sorteio } from '../cruzar.ts';
import {
  atualizarHipotese,
  fecharRodada,
  grauDeConfianca,
  segundoConfirma,
  direcaoContraria,
  inicioTemporada,
  logRazaoPorBloco,
  razaoPorAnos,
  residuoPostos,
} from './rodada.ts';

test('a round of 10 hypotheses where only 1 has a real effect: only it passes Benjamini-Hochberg', () => {
  const r = sorteio(42);
  const n = 300;
  const resultados = Array.from({ length: 10 }, (_, h) => {
    const x = Array.from({ length: n }, () => r());
    const y = x.map((v) => (h === 3 ? v : 0) + r()); // hypothesis 3: y follows x
    return { id: `h${h}`, p: permutacaoBlocos(x, y, { bloco: 7, n: 199, semente: h }) };
  });
  const f = fecharRodada(resultados, 0.1);
  expect(f.filter((x) => x.passa).map((x) => x.id)).toEqual(['h3']);
  expect(f.find((x) => x.id === 'h3')!.p_ajustado).toBeLessThan(0.1);
});

test('confidence rule of pesquisa/metodo.md', () => {
  const base = { passa: true, segundoRecorte: true, medido: true, mecanismo: true, anos: 14 };
  expect(grauDeConfianca(base)).toBe('alta');
  expect(grauDeConfianca({ ...base, segundoRecorte: false })).toBe('media');
  expect(grauDeConfianca({ ...base, passa: false })).toBe('baixa');
  expect(grauDeConfianca({ ...base, anos: 7 })).toBe('baixa');
  expect(grauDeConfianca({ ...base, medido: false })).toBe('baixa');
});

test('fire season start: first day whose 7-day mean passes the P75 of the year', () => {
  const dias = Array.from({ length: 40 }, (_, i) => ({ dia: `2024-08-${String(i + 1).padStart(2, '0')}`, focos: i < 20 ? 1 : 100 }));
  dias.splice(31); // 31 days of August
  // P75 of 20 ones and 11 hundreds is 100? No: sorted index 22 of 31 is 100, so the mean must pass 100: never.
  expect(inicioTemporada(dias)).toBeNull();
  const ok = dias.map((d, i) => ({ ...d, focos: i < 24 ? 1 : 100 }));
  // P75 = 1 now (index 22 is still a one): the first 7-day mean above 1 ends on the first day of 100.
  expect(inicioTemporada(ok)).toBe('2024-08-25');
});

test('rank residual removes a monotone driver; log ratio per block skips blocks without both groups', () => {
  const x = [1, 2, 3, 4, 5, 6];
  expect(residuoPostos([10, 20, 30, 40, 50, 60], x).every((r) => Math.abs(r) < 1e-9)).toBe(true);
  const v = [2, 1, 1, 4, 2, 2, 5];
  const g = [true, false, false, true, false, false, true];
  const b = [1, 1, 1, 2, 2, 2, 3]; // block 3 has no weekday: skipped
  expect(Math.exp(logRazaoPorBloco(v, g, b))).toBeCloseTo(2);
});

test('the result goes into the front matter and the Resultado section; the rest of the file stays', () => {
  const md = "---\nid: 'x'\nstatus: 'escrita'\nescrita_em: '2026-10-22'\n---\n## Por quê\nAlgo.\n\n## Resultado\nAinda não testada.\n";
  const novo = atualizarHipotese(md, {
    status: 'testada',
    testada_em: '2026-10-22',
    confianca: 'baixa',
    resultado: "efeito de 3% (o 'x')",
    detalhe: 'Linha 1.\nLinha 2.',
  });
  expect(novo).toBe(
    "---\nid: 'x'\nstatus: 'testada'\nescrita_em: '2026-10-22'\ntestada_em: '2026-10-22'\nconfianca: 'baixa'\nresultado: 'efeito de 3% (o ’x’)'\n---\n## Por quê\nAlgo.\n\n## Resultado\nLinha 1.\nLinha 2.\n",
  );
  expect(
    atualizarHipotese(novo, { status: 'testada', testada_em: '2026-10-23', confianca: 'media', resultado: 'r', detalhe: 'd' }),
  ).toMatch(/testada_em: '2026-10-23'\nconfianca: 'media'\nresultado: 'r'\n---/);
});

test('ratio of proportions by permuting whole years: the labelled year stands out only when its months are worse', () => {
  const u = (efeito: number) =>
    Array.from({ length: 10 }, (_, a) =>
      [9, 10, 11].map((mes) => ({ ano: 2014 + a, mes, n: 100, fora: a === 9 ? efeito : 2, rotulo: a === 9 && mes >= 10 })),
    ).flat();
  const forte = razaoPorAnos(u(10), { n: 999, semente: 3 });
  expect(Math.exp(forte.efeito)).toBeCloseTo(0.1 / (64 / 2800), 6); // 20/200 labelled against 27 months at 2 + one at 10 out of 2800
  expect(forte.p).toBeLessThan(0.15); // 1 year in 10: the smallest p a permutation of years can give is about 0.1
  expect(razaoPorAnos(u(2), { n: 199, semente: 3 }).p).toBeGreaterThan(0.5);
});

test('the second cut confirms with the same direction and p < 0.05; a ratio is read against 1', () => {
  expect(segundoConfirma({ efeito: 2.1, unidade: 'razão' }, { efeito: 1.6, p: 0.01 })).toBe(true);
  expect(segundoConfirma({ efeito: 2.1, unidade: 'razão' }, { efeito: 0.8, p: 0.01 })).toBe(false);
  expect(segundoConfirma({ efeito: 0.4, unidade: 'Spearman' }, { efeito: 0.5, p: 0.2 })).toBe(false);
  expect(segundoConfirma({ efeito: -0.4, unidade: 'Spearman' }, { efeito: -0.5, p: 0.03 })).toBe(true);
  expect(segundoConfirma({ efeito: 0.4, unidade: 'Spearman' })).toBe(false);
});

test('the effect against the written direction is flagged; no direction written, never flagged', () => {
  expect(direcaoContraria({ efeito: 0.071, unidade: 'pontos (fração)', espera: -1 })).toBe(true);
  expect(direcaoContraria({ efeito: 0.2, unidade: 'razão', espera: -1 })).toBe(false); // a ratio below 1 is "less"
  expect(direcaoContraria({ efeito: 3.5, unidade: 'razão', espera: 1 })).toBe(false);
  expect(direcaoContraria({ efeito: -0.3, unidade: 'Spearman', espera: 1 })).toBe(true);
  expect(direcaoContraria({ efeito: -0.3, unidade: 'Spearman' })).toBe(false);
});
