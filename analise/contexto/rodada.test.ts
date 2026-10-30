import { permutacaoBlocos, rotulosEmBlocos, sorteio } from '../cruzar.ts';
import {
  celula,
  atualizarHipotese,
  fecharRodada,
  grauDeConfianca,
  segundoConfirma,
  exposto,
  noAno,
  razaoDeRazoes,
  voltaAsAulas,
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
  // an AUC is read against 0.5
  expect(segundoConfirma({ efeito: 0.7, unidade: 'AUC' }, { efeito: 0.6, p: 0.01 })).toBe(true);
  expect(segundoConfirma({ efeito: 0.7, unidade: 'AUC' }, { efeito: 0.4, p: 0.01 })).toBe(false);
  expect(direcaoContraria({ efeito: 0.45, unidade: 'AUC', espera: 1 })).toBe(true);
  expect(direcaoContraria({ efeito: 0.55, unidade: 'AUC', espera: 1 })).toBe(false);
});

test('the effect against the written direction is flagged; no direction written, never flagged', () => {
  expect(direcaoContraria({ efeito: 0.071, unidade: 'pontos (fração)', espera: -1 })).toBe(true);
  expect(direcaoContraria({ efeito: 0.2, unidade: 'razão', espera: -1 })).toBe(false); // a ratio below 1 is "less"
  expect(direcaoContraria({ efeito: 3.5, unidade: 'razão', espera: 1 })).toBe(false);
  expect(direcaoContraria({ efeito: -0.3, unidade: 'Spearman', espera: 1 })).toBe(true);
  expect(direcaoContraria({ efeito: -0.3, unidade: 'Spearman' })).toBe(false);
});

test('round 5: a day is exposed when it or one of the 7 before had smoke; effects as a share of the mean and as a ratio of ratios', () => {
  const fu = [false, true, false, false, false, false, false, false, false, false];
  expect(exposto(fu, 7)).toEqual([false, true, true, true, true, true, true, true, true, false]);
  expect(exposto(fu, 0)).toEqual(fu);
  const jovens = [10, 20, 20, 10];
  const outros = [10, 15, 15, 10];
  expect(razaoDeRazoes(jovens, outros, [false, true, true, false])).toBeCloseTo(2 / 1.5, 6);
});

test('round 5: the school start against the same windows moved by whole weeks (placebo starts), one start per year', () => {
  // 3 years of a daily series that jumps 50% from the 7th day after each start on.
  const dias: string[] = [];
  for (let t = Date.UTC(2015, 0, 1); t < Date.UTC(2018, 0, 1); t += 86_400_000) dias.push(new Date(t).toISOString().slice(0, 10));
  const voltas = ['2015-02-05', '2016-02-11', '2017-02-03'];
  const v = dias.map((d) =>
    voltas.some(
      (x) =>
        d.slice(0, 4) === x.slice(0, 4) &&
        d >= x &&
        Date.parse(d) - Date.parse(x) >= 7 * 86_400_000 &&
        Date.parse(d) - Date.parse(x) <= 21 * 86_400_000,
    )
      ? 15
      : 10,
  );
  const t = voltaAsAulas(dias, v, voltas, { n: 999, semente: 1 });
  expect(Math.exp(t.efeito)).toBeCloseTo(1.5, 6); // geometric mean of (days 7-21 after ÷ 21 days before)
  expect(t.p).toBeLessThan(0.05);
});

test('CSV cell: a label with a comma or a quote is quoted, the rest is left as is', () => {
  expect(['CAMS PM2,5 > 25', 'diz "sim"', 0.5, '', undefined].map(celula)).toEqual(['"CAMS PM2,5 > 25"', '"diz ""sim"""', '0.5', '', '']);
});

test('a yearly trend with smoke days in the late years is no smoke effect once each day is compared within its year', () => {
  const r = sorteio(7);
  const dias: string[] = [];
  const v: number[] = [];
  const g: boolean[] = [];
  for (let ano = 2012; ano <= 2024; ano++)
    for (let d = 0; d < 122; d++) {
      dias.push(new Date(Date.UTC(ano, 7, 1 + d)).toISOString().slice(0, 10));
      v.push(100 * 1.04 ** (ano - 2012) + 10 * (r() - 0.5)); // grows 4% a year, no smoke effect at all
      g.push(r() < (ano >= 2022 ? 0.5 : 0.05)); // smoke mostly in the last years
    }
  const dif = (x: number[]) => (gg: boolean[]) =>
    x.filter((_, i) => gg[i]).reduce((a, b) => a + b, 0) / gg.filter(Boolean).length -
    x.filter((_, i) => !gg[i]).reduce((a, b) => a + b, 0) / gg.filter((y) => !y).length;
  expect(rotulosEmBlocos(g, dif(v), { n: 199 }).p).toBeLessThan(0.05); // the trap: the trend looks like an effect
  const dentro = noAno(dias, v);
  expect(Math.abs(dentro.slice(0, 122).reduce((a, b) => a + b, 0))).toBeLessThan(1e-9); // each year averages 0
  expect(rotulosEmBlocos(g, dif(dentro), { n: 199 }).p).toBeGreaterThan(0.05);
  expect(noAno(['2020-08-01', '2020-08-02'], [10, 30], '/')).toEqual([0.5, 1.5]);
});
