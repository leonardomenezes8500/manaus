import { daPascoa, eleicoes, feriadosLocais, feriadosNacionais, lerCsvCalendario, pascoa } from './regras.ts';

test('Easter of known years, and the dates counted from it', () => {
  expect(pascoa(2024)).toBe('2024-03-31');
  expect(pascoa(2025)).toBe('2025-04-20');
  expect(pascoa(2026)).toBe('2026-04-05');
  expect(daPascoa(2026)).toEqual({
    carnavalSegunda: '2026-02-16',
    carnavalTerca: '2026-02-17',
    cinzas: '2026-02-18',
    sextaSanta: '2026-04-03',
    corpusChristi: '2026-06-04',
  });
});

test('national holidays by law: 20 November only from 2024, 2 November national from 2003, each with its act', () => {
  const dias = (ano: number) => feriadosNacionais(ano).map((f) => f.inicio);
  expect(dias(2023)).not.toContain('2023-11-20');
  expect(dias(2024)).toContain('2024-11-20');
  expect(dias(2002)).not.toContain('2002-11-02');
  expect(dias(2003)).toContain('2003-11-02');
  expect(dias(1994)).toEqual(['1994-01-01', '1994-04-21', '1994-05-01', '1994-09-07', '1994-10-12', '1994-11-15', '1994-12-25']);
  const tiradentes = (ano: number) => feriadosNacionais(ano).find((f) => f.inicio.endsWith('-04-21'))!.ato;
  expect(tiradentes(1994)).toBe('Lei 1.266/1950, art. 3º');
  expect(tiradentes(2010)).toBe('Lei 662/1949, art. 1º (redação da Lei 10.607/2002)');
  for (const f of feriadosNacionais(2026)) expect(f).toMatchObject({ tipo: 'feriado', abrangencia: 'BR', fonte: 'planalto-legislacao' });
  expect(feriadosNacionais(2026).every((f) => f.url.startsWith('https://www.planalto.gov.br/'))).toBe(true);
});

test('election rounds: before the 1997 amendment, the Sunday rule, and 2020 postponed', () => {
  const datas = (ano: number) => eleicoes(ano).map((e) => [e.nome, e.inicio]);
  expect(datas(1994)).toEqual([
    ['Eleições gerais, 1º turno', '1994-10-03'],
    ['Eleições gerais, 2º turno', '1994-11-15'],
  ]);
  expect(datas(2022)).toEqual([
    ['Eleições gerais, 1º turno', '2022-10-02'],
    ['Eleições gerais, 2º turno', '2022-10-30'],
  ]);
  expect(datas(2024)).toEqual([
    ['Eleições municipais, 1º turno', '2024-10-06'],
    ['Eleições municipais, 2º turno', '2024-10-27'],
  ]);
  expect(datas(2020)).toEqual([
    ['Eleições municipais, 1º turno', '2020-11-15'],
    ['Eleições municipais, 2º turno', '2020-11-29'],
  ]);
  expect(eleicoes(2023)).toEqual([]);
});

test('CSV of yearly documents: one event per line; a line without the document url fails', () => {
  const ok = [
    'tipo,nome,inicio,fim,abrangencia,fonte,ato,url,bruto',
    'festa,Festival de Parintins,2024-06-28,2024-06-30,AM,x,Decreto 1/2024,https://exemplo.gov.br/d.pdf,',
  ].join('\n');
  expect(lerCsvCalendario(ok)).toEqual([
    {
      tipo: 'festa',
      nome: 'Festival de Parintins',
      inicio: '2024-06-28',
      fim: '2024-06-30',
      abrangencia: 'AM',
      fonte: 'x',
      ato: 'Decreto 1/2024',
      url: 'https://exemplo.gov.br/d.pdf',
      bruto: '',
    },
  ]);
  expect(() => lerCsvCalendario(ok.replace(',https://exemplo.gov.br/d.pdf,', ',,'))).toThrow('linha 2: falta url');
  expect(() => lerCsvCalendario(ok.replace('2024-06-30', '2024-06-27'))).toThrow('linha 2: fim antes do início');
  expect(() => lerCsvCalendario(ok.replace(',AM,', ',SP,'))).toThrow('linha 2: abrangencia inválida');
});

test('AM and Manaus holidays by law, from the year each law applies; Manaus municipal days of the pandemic left empty', () => {
  const de = (ano: number) => feriadosLocais(ano).map((f) => `${f.abrangencia} ${f.inicio} ${f.nome}`);
  expect(de(1994)).toEqual([
    'AM 1994-09-05 Elevação do Amazonas à categoria de Província',
    'Manaus 1994-09-05 Elevação do Amazonas à categoria de Província',
    'Manaus 1994-10-24 Elevação de Manaus à categoria de Cidade (aniversário de Manaus)',
  ]);
  expect(de(1999)).toEqual(
    expect.arrayContaining([
      'Manaus 1999-02-16 Carnaval, terça-feira',
      'Manaus 1999-02-17 Quarta-feira de Cinzas (até 12h)',
      'Manaus 1999-12-08 Nossa Senhora da Conceição',
    ]),
  );
  expect(de(2006).some((d) => d.includes('Corpus Christi'))).toBe(true);
  expect(de(2006).some((d) => d.includes('Paixão'))).toBe(false);
  expect(de(2007)).toEqual(
    expect.arrayContaining(['Manaus 2007-04-06 Sexta-feira da Paixão', 'Manaus 2007-11-20 Dia da Consciência Negra']),
  );
  expect(de(2010)).toContain('AM 2010-11-20 Dia da Consciência Negra');
  expect(de(2020)).toContain('Manaus 2020-02-25 Carnaval, terça-feira');
  expect(de(2020).some((d) => d.startsWith('Manaus 2020-10-24'))).toBe(false);
  expect(de(2021).filter((d) => d.startsWith('Manaus'))).toEqual([]);
  expect(de(2022)).toContain('Manaus 2022-10-24 Elevação de Manaus à categoria de Cidade (aniversário de Manaus)');
  const aniv = feriadosLocais(2026).find((f) => f.inicio === '2026-10-24')!;
  expect(aniv).toMatchObject({ fonte: 'cmm-manaus', ato: 'Lei Orgânica do Município de Manaus (1990), art. 437' });
});
