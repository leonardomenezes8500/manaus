import { months, newIds } from './openaq.ts';

test('months cover the range and roll over the year', () => {
  expect(months('2025-11', '2026-01')).toEqual([
    { month: '2025-11', from: '2025-11-01T00:00:00Z', to: '2025-12-01T00:00:00Z' },
    { month: '2025-12', from: '2025-12-01T00:00:00Z', to: '2026-01-01T00:00:00Z' },
    { month: '2026-01', from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' },
  ]);
  expect(months('2025-07', '2026-10')).toHaveLength(16);
});

test('newIds finds only the ids that appeared', () => {
  expect(newIds([1, 2], [2, 3, 1, 4])).toEqual([3, 4]);
  expect(newIds([1, 2], [1])).toEqual([]);
});
