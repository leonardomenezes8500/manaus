import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hoursOf, recentErrors, status } from './saude.ts';

test('frequency in hours', () => {
  expect([hoursOf('10min'), hoursOf('1h'), hoursOf('3h'), hoursOf('6h'), hoursOf('1d'), hoursOf('365d')]).toEqual([
    1 / 6,
    1,
    3,
    6,
    24,
    8760,
  ]);
  expect(() => hoursOf('semanal')).toThrow('bad frequency');
});

test('late when older than twice the expected interval, or when there is no file', () => {
  expect(status(5.9, 3)).toBe('OK');
  expect(status(6, 3)).toBe('OK');
  expect(status(6.1, 3)).toBe('ATRASADO');
  expect(status(null, 24)).toBe('ATRASADO');
});

test('recent errors skip the health check own logs, which quote older errors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'logs-'));
  const now = new Date('2026-10-23T20:00:00Z');
  await writeFile(join(dir, 'firms-2026-10-23.log'), 'ok\n== firms ERRO código 1\n');
  await writeFile(join(dir, 'saude-2026-10-23.log'), '- teste-r2-2026-10-21.log: == teste-r2 ERRO código 1\n');
  expect(await recentErrors(dir, now)).toEqual(['firms-2026-10-23.log: == firms ERRO código 1']);
  await rm(dir, { recursive: true });
});
