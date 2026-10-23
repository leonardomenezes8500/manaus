import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readDbcRecords } from '@precisa-saude/datasus-dbc';
import { faixaIdade, grupoCid, idadeSih, idadeSim, lerListagem, maisNovos, nomeBruto, somarObitos, somarInternacoes } from './datasus.ts';

const fixture = (n: string) => new Uint8Array(readFileSync(join(import.meta.dirname, 'carga', '__fixtures__', n)));

test('age: SIH by COD_IDADE (2 days, 3 months, 4 years, 5 years over 100); SIM in 3 digits (unit and value)', () => {
  expect(idadeSih('4', 60)).toBe(60);
  expect(idadeSih('3', 11)).toBe(0);
  expect(idadeSih('2', 20)).toBe(0);
  expect(idadeSih('5', 3)).toBe(103);
  expect(idadeSih('0', 0)).toBeNull();
  expect(idadeSim('452')).toBe(52);
  expect(idadeSim('311')).toBe(0);
  expect(idadeSim('501')).toBe(101);
  expect(idadeSim('999')).toBeNull();
  expect(idadeSim(null)).toBeNull();
});

test('bands: the population bands of #63 split at 10 (0-9 for the school hypothesis); CID groups J, I and the rest', () => {
  expect([0, 4, 5, 9, 10, 14, 15, 59, 60, 103].map(faixaIdade)).toEqual([
    '0-4',
    '0-4',
    '5-9',
    '5-9',
    '10-14',
    '10-14',
    '15-59',
    '15-59',
    '60+',
    '60+',
  ]);
  expect(faixaIdade(null)).toBe('ignorada');
  expect([grupoCid('J841'), grupoCid('I219'), grupoCid('A46'), grupoCid(null)]).toEqual(['respiratorio', 'circulatorio', 'outro', 'outro']);
});

test('the FTP listing (IIS style) gives name, server date and size; the raw name carries the date', () => {
  const l = lerListagem('10-16-26  05:30PM                43847 RDRR2607.dbc\r\n01-31-20  02:48PM              1074211 DOAM2012.DBC\r\n');
  expect(l).toEqual([
    { nome: 'RDRR2607.dbc', data: '2026-10-16', bytes: 43847 },
    { nome: 'DOAM2012.DBC', data: '2020-01-31', bytes: 1074211 },
  ]);
  expect(nomeBruto(l[1])).toBe('DOAM2012_2020-01-31.dbc');
  expect(nomeBruto(l[1], '_prelim')).toBe('DOAM2012_prelim_2020-01-31.dbc');
});

test('what is read: the newest version of each SIH month; a final SIM year wins over its preliminary file', () => {
  const k = (n: string) => `bruto/x/2026/10/23/120000Z_${n}`;
  expect(
    maisNovos([
      k('RDAM2408_2025-10-01.dbc'),
      k('RDAM2408_2026-10-16.dbc'),
      k('RDAM2408_2026-10-16.dbc.meta.json'),
      k('DOAM2025_prelim_2026-09-28.dbc'),
      k('DOAM2025_2026-12-20.dbc'),
      k('DOAM2026_prelim_2026-09-28.dbc'),
    ]).sort((a, b) => a.chave.localeCompare(b.chave)),
  ).toEqual([
    { fonte: 'datasus-sim', periodo: '2025', chave: k('DOAM2025_2026-12-20.dbc') },
    { fonte: 'datasus-sim', periodo: '2026-preliminar', chave: k('DOAM2026_prelim_2026-09-28.dbc') },
    { fonte: 'datasus-sih', periodo: '2024-08', chave: k('RDAM2408_2026-10-16.dbc') },
  ]);
});

const residentes = async (b: Uint8Array, campo: string, mun: string) => {
  let n = 0;
  for await (const r of readDbcRecords(b)) if (r[campo] === mun) n++;
  return n;
};

test('a real SIH month (RR, 2022-06): residents of one municipality per day, group, band and sex, none lost', async () => {
  const l = await somarInternacoes(fixture('RDRR2206.dbc'), '140010');
  expect(l.reduce((s, x) => s + x.internacoes, 0)).toBe(await residentes(fixture('RDRR2206.dbc'), 'MUNIC_RES', '140010'));
  // A real record: admitted 2022-05-22, N10 (kidney), 60 years (COD_IDADE 4), SEXO 3 = female in the SIH.
  expect(l.find((x) => x.dia === '2022-05-22' && x.grupo === 'outro' && x.faixa === '60+' && x.sexo === 'F')!.internacoes).toBeGreaterThan(
    0,
  );
  expect(l.every((x) => /^\d{4}-\d\d-\d\d$/.test(x.dia) && ['M', 'F', 'ignorado'].includes(x.sexo))).toBe(true);
});

test('a real SIM year (RR, 2013): deaths of residents per day, group, band and sex, none lost', async () => {
  const l = await somarObitos(fixture('DORR2013.dbc'), '140010');
  expect(l.reduce((s, x) => s + x.obitos, 0)).toBe(await residentes(fixture('DORR2013.dbc'), 'CODMUNRES', '140010'));
  expect(l.filter((x) => x.sexo === 'M').reduce((s, x) => s + x.obitos, 0)).toBe(791);
  expect(l.every((x) => x.dia.startsWith('2013-'))).toBe(true);
});
