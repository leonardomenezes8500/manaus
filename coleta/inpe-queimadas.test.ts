import { historyFiles } from './inpe-queimadas.ts';

test('closed months come as monthly files, the current month day by day', () => {
  expect(historyFiles('2026-08-01', '2026-10-03')).toEqual([
    { kind: 'mensal', date: '202608' },
    { kind: 'mensal', date: '202609' },
    { kind: 'diario', date: '20261001' },
    { kind: 'diario', date: '20261002' },
    { kind: 'diario', date: '20261003' },
  ]);
});

test('a start inside the current month only fetches daily files from that day', () => {
  expect(historyFiles('2026-10-02', '2026-10-03')).toEqual([
    { kind: 'diario', date: '20261002' },
    { kind: 'diario', date: '20261003' },
  ]);
});
