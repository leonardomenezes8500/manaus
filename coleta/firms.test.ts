import { janelas, pedidosArquivo } from './firms.ts';

test('janelas de 5 dias cobrem o intervalo sem buraco nem sobra', () => {
  expect(janelas('2026-08-01', '2026-08-12')).toEqual([
    { data: '2026-08-01', dias: 5 },
    { data: '2026-08-06', dias: 5 },
    { data: '2026-08-11', dias: 2 },
  ]);
  expect(janelas('2026-10-21', '2026-10-21')).toEqual([{ data: '2026-10-21', dias: 1 }]);
  expect(janelas('2026-08-01', '2026-10-21').reduce((s, j) => s + j.dias, 0)).toBe(82);
});

test('intervalo invertido é erro', () => {
  expect(() => janelas('2026-08-02', '2026-08-01')).toThrow('intervalo inválido');
});

test('archive (SP): S-NPP and MODIS windows of the period, gzip, the ones already in R2 left out (the run can resume)', () => {
  const ja = ['bruto/nasa-firms/2026/10/22/140000Z_VIIRS_SNPP_SP_2024-01-01_5d.csv.gz'];
  const fimSp = {
    VIIRS_SNPP_SP: ['2012-01-20', '2026-06-30'] as [string, string],
    MODIS_SP: ['2000-11-01', '2026-07-31'] as [string, string],
  };
  expect(pedidosArquivo('2024-01-01', '2024-01-07', ja, fimSp)).toEqual([
    { sensor: 'VIIRS_SNPP_SP', dias: 2, data: '2024-01-06' },
    { sensor: 'MODIS_SP', dias: 5, data: '2024-01-01' },
    { sensor: 'MODIS_SP', dias: 2, data: '2024-01-06' },
  ]);
});

test('archive (SP): no window past the end of the archive of each sensor (an empty CSV saved there would never be asked again)', () => {
  const p = pedidosArquivo('2026-06-26', '2026-08-10', [], {
    VIIRS_SNPP_SP: ['2012-01-20', '2026-06-30'] as [string, string],
    MODIS_SP: ['2000-11-01', '2026-07-31'] as [string, string],
  });
  expect(p.filter((x) => x.sensor === 'VIIRS_SNPP_SP')).toEqual([{ sensor: 'VIIRS_SNPP_SP', dias: 5, data: '2026-06-26' }]);
  expect(p.filter((x) => x.sensor === 'MODIS_SP').at(-1)).toEqual({ sensor: 'MODIS_SP', dias: 1, data: '2026-07-31' });
});

test('archive (SP): a window whose days are all in files with other start dates is left out (a run from another start does not download again)', () => {
  const k = (n: string) => `bruto/nasa-firms/2026/10/22/140000Z_VIIRS_SNPP_SP_${n}`;
  const ja = [k('2024-01-01_5d.csv.gz'), k('2024-01-06_5d.csv.gz'), k('2024-01-11_5d.csv.gz'), k('2024-01-11_5d.csv.gz.meta.json')];
  const fimSp = {
    VIIRS_SNPP_SP: ['2012-01-20', '2026-06-30'] as [string, string],
    MODIS_SP: ['2000-11-01', '2026-07-31'] as [string, string],
  };
  // The files cover 2024-01-01..15: the windows 01-02..06 and 01-07..11 are in, 01-12..16 is not (01-16 is missing).
  expect(pedidosArquivo('2024-01-02', '2024-01-16', ja, fimSp).filter((p) => p.sensor === 'VIIRS_SNPP_SP')).toEqual([
    { sensor: 'VIIRS_SNPP_SP', dias: 5, data: '2024-01-12' },
  ]);
});

test('archive (SP): no window before the start of each archive (the S-NPP starts in 2012-01-20, MODIS in 2000-11-01)', () => {
  const periodo = {
    VIIRS_SNPP_SP: ['2012-01-20', '2026-06-30'] as [string, string],
    MODIS_SP: ['2000-11-01', '2026-07-31'] as [string, string],
  };
  const p = pedidosArquivo('2000-10-28', '2012-01-21', [], periodo);
  expect(p.filter((x) => x.sensor === 'VIIRS_SNPP_SP')).toEqual([{ sensor: 'VIIRS_SNPP_SP', dias: 2, data: '2012-01-20' }]);
  expect(p.find((x) => x.sensor === 'MODIS_SP')).toEqual({ sensor: 'MODIS_SP', dias: 5, data: '2000-11-01' });
});
