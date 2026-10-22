// .env.example lists every variable the code reads (#39), so a new key never lives only in someone's .env.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
// Set by the platform, the image or the test runner, never by a person in .env.
const NOT_IN_ENV = ['CI', 'PATH', 'GIT_COMMIT', 'NODE_ENV', 'NODE_EXTRA_CA_CERTS'];

const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter(
  (f) => f.endsWith('.ts') && !f.startsWith('node_modules') && !f.endsWith('.test.ts'),
);
const read = new Set(
  files.flatMap((f) =>
    [...readFileSync(join(root, f), 'utf8').matchAll(/process\.env\.([A-Z0-9_]+)|env\('([A-Z0-9_]+)'\)/g)].map((m) => m[1] ?? m[2]),
  ),
);
const listed = new Set([...readFileSync(join(root, '.env.example'), 'utf8').matchAll(/^#?\s*([A-Z0-9_]+)=/gm)].map((m) => m[1]));

test('every variable the code reads is in .env.example', () => {
  expect([...read].filter((v) => !NOT_IN_ENV.includes(v) && !listed.has(v))).toEqual([]);
  expect(read.size).toBeGreaterThan(5);
});
