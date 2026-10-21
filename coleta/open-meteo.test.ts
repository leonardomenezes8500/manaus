import { monthRanges } from './open-meteo.ts';

test('month ranges split at month ends and stop at the end date', () => {
  expect(monthRanges('2026-08-01', '2026-10-20')).toEqual([
    ['2026-08-01', '2026-08-31'],
    ['2026-09-01', '2026-09-30'],
    ['2026-10-01', '2026-10-20'],
  ]);
  expect(monthRanges('2026-08-15', '2026-08-15')).toEqual([['2026-08-15', '2026-08-15']]);
  expect(monthRanges('2026-12-30', '2027-01-02')).toEqual([
    ['2026-12-30', '2026-12-31'],
    ['2027-01-01', '2027-01-02'],
  ]);
});
