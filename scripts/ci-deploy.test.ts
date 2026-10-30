import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('ci-deploy: manda SEGREDO_<NOME> como NOME=valor, pula vazios, sha e hash dos arquivos no comando', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-deploy-'));
  writeFileSync(join(dir, 'ssh'), `#!/usr/bin/env bash\necho "$*" > "${dir}/args"; cat > "${dir}/stdin"\n`);
  chmodSync(join(dir, 'ssh'), 0o755);
  const sha = 'c'.repeat(40);
  const r = spawnSync('bash', ['scripts/ci-deploy.sh'], {
    encoding: 'utf8',
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      HOME: dir,
      GITHUB_SHA: sha,
      SSH_KEY: 'chave',
      KNOWN_HOSTS: 'hosts',
      DESTINO: 'u@h',
      SEGREDO_FIRMS_MAP_KEY: 'a$b c',
      SEGREDO_R2_BUCKET: '',
    },
  });
  expect(r.stderr).toBe('');
  expect(r.status).toBe(0);
  expect(readFileSync(join(dir, 'stdin'), 'utf8')).toBe('FIRMS_MAP_KEY=a$b c\n');
  expect(readFileSync(join(dir, 'args'), 'utf8')).toMatch(
    new RegExp(`^-o ServerAliveInterval=30 -o ServerAliveCountMax=10 -i ${dir}/\\.ssh/deploy u@h ${sha} [0-9a-f]{64}\\n$`),
  );
  expect(readFileSync(join(dir, '.ssh/deploy'), 'utf8')).toBe('chave\n');
});
