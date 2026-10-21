import { diaDeManaus } from './dia.ts';

test('03:59Z ainda é o dia anterior em Manaus', () => {
  expect(diaDeManaus(new Date('2026-10-22T03:59:59Z'))).toBe('2026-10-21');
});

test('04:00Z já é o dia seguinte', () => {
  expect(diaDeManaus(new Date('2026-10-22T04:00:00Z'))).toBe('2026-10-22');
});

test('virada de ano', () => {
  expect(diaDeManaus(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
});
