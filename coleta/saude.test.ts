import { hoursOf, status } from './saude.ts';

test('frequency in hours', () => {
  expect([hoursOf('1h'), hoursOf('3h'), hoursOf('6h'), hoursOf('1d'), hoursOf('365d')]).toEqual([1, 3, 6, 24, 8760]);
  expect(() => hoursOf('semanal')).toThrow('bad frequency');
});

test('late when older than twice the expected interval, or when there is no file', () => {
  expect(status(5.9, 3)).toBe('OK');
  expect(status(6, 3)).toBe('OK');
  expect(status(6.1, 3)).toBe('ATRASADO');
  expect(status(null, 24)).toBe('ATRASADO');
});
