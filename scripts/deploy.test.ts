import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SHA = 'a'.repeat(40);
const ANTERIOR = 'b'.repeat(40);

// Pasta como a da slice, com um `docker` falso que registra as chamadas, falha o `up` quando a tag é UP_FALHA
// e falha a migração (`run`) quando MIGRA_FALHA está definido.
function pasta() {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-'));
  for (const [de, para] of [['compose.prod.yaml', 'compose.prod.yaml'], ['scripts/deploy.sh', 'deploy.sh']]) copyFileSync(de, join(dir, para));
  writeFileSync(join(dir, 'docker'), `#!/usr/bin/env bash
echo "$* $(sed -n 's/^APP_TAG=//p' .env)" >> docker.log
[[ $* == *" up "* && -n \${UP_FALHA:-} ]] && grep -q "^APP_TAG=$UP_FALHA" .env && exit 1
[[ $* == *" run "* && -n \${MIGRA_FALHA:-} ]] && exit 1
exit 0
`);
  chmodSync(join(dir, 'docker'), 0o755);
  const arquivos = createHash('sha256').update(readFileSync(join(dir, 'compose.prod.yaml'))).update(readFileSync(join(dir, 'deploy.sh'))).digest('hex');
  return { dir, arquivos };
}

function deploy(dir: string, comando: string, stdin: string, env: Record<string, string> = {}) {
  return spawnSync('bash', [join(dir, 'deploy.sh')], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, SSH_ORIGINAL_COMMAND: comando, ...env },
  });
}

const ler = (dir: string, a: string) => (existsSync(join(dir, a)) ? readFileSync(join(dir, a), 'utf8') : '');

test('deploy ok: .env 600 com os secrets entre aspas simples + APP_TAG, pull, banco, migração, up e log', () => {
  const { dir, arquivos } = pasta();
  const r = deploy(dir, `${SHA} ${arquivos}`, 'R2_BUCKET=manaus\nFIRMS_MAP_KEY=a$b c\n');
  expect(r.status).toBe(0);
  expect(ler(dir, '.env')).toBe(`R2_BUCKET='manaus'\nFIRMS_MAP_KEY='a$b c'\nAPP_TAG=${SHA}\n`);
  expect(statSync(join(dir, '.env')).mode & 0o777).toBe(0o600);
  expect(ler(dir, 'docker.log').trim().split('\n').map((l) => l.replace(/^compose -f compose.prod.yaml | \w+$/g, ''))).toEqual([
    'pull -q',
    'up -d --wait --wait-timeout 120 db',
    'run --rm -T coletor node db/migrar.ts',
    'up -d --wait --wait-timeout 120',
  ]);
  expect(ler(dir, 'deploys.log')).toMatch(new RegExp(`${SHA} ok\\n$`));
});

test.each([
  ['sha curto', `abc ${'0'.repeat(64)}`, 'A=SEGREDO\n'],
  ['comando a mais vira lixo no sha', `${SHA}; rm -rf / x`, 'A=SEGREDO\n'],
  ['nome minúsculo', null, 'a=SEGREDO\n'],
  ['sem =', null, 'SEGREDO\n'],
  ['aspas simples', null, "A=SEGREDO'y\n"],
  ['retorno de carro', null, 'A=SEGREDO\ry\n'],
  ['APP_TAG pelo stdin', null, 'APP_TAG=SEGREDO\n'],
])('recusa (%s) sem mexer em nada', (_, comando, stdin) => {
  const { dir, arquivos } = pasta();
  writeFileSync(join(dir, '.env'), `APP_TAG=${ANTERIOR}\n`);
  const r = deploy(dir, comando ?? `${SHA} ${arquivos}`, stdin);
  expect(r.status).toBe(2);
  expect(r.stderr + r.stdout).not.toContain('SEGREDO');
  expect(ler(dir, '.env')).toBe(`APP_TAG=${ANTERIOR}\n`);
  expect(ler(dir, 'docker.log')).toBe('');
});

test('compose/deploy.sh instalados diferentes do repo: pede reinstalação', () => {
  const { dir } = pasta();
  const r = deploy(dir, `${SHA} ${'0'.repeat(64)}`, 'A=1\n');
  expect(r.status).toBe(3);
  expect(r.stderr).toContain('reinstalar');
  expect(ler(dir, 'docker.log')).toBe('');
});

test('não ficou saudável: volta a tag anterior, sobe de novo e sai com erro', () => {
  const { dir, arquivos } = pasta();
  writeFileSync(join(dir, '.env'), `APP_TAG=${ANTERIOR}\n`);
  const r = deploy(dir, `${SHA} ${arquivos}`, 'A=1\n', { UP_FALHA: SHA });
  expect(r.status).toBe(1);
  expect(ler(dir, '.env')).toBe(`A='1'\nAPP_TAG=${ANTERIOR}\n`);
  expect(ler(dir, 'docker.log').trim().split('\n').at(-1)).toMatch(new RegExp(`up -d --wait .*${ANTERIOR}$`));
  expect(ler(dir, 'deploys.log')).toMatch(new RegExp(`${SHA} rollback ${ANTERIOR}\\n$`));
});

test('migração falhou: não troca o coletor, volta a tag anterior e sai com erro', () => {
  const { dir, arquivos } = pasta();
  writeFileSync(join(dir, '.env'), `APP_TAG=${ANTERIOR}\n`);
  const r = deploy(dir, `${SHA} ${arquivos}`, 'A=1\n', { MIGRA_FALHA: '1' });
  expect(r.status).toBe(1);
  expect(ler(dir, '.env')).toBe(`A='1'\nAPP_TAG=${ANTERIOR}\n`);
  expect(ler(dir, 'docker.log')).not.toMatch(new RegExp(`up -d --wait --wait-timeout 120 ${SHA}`));
  expect(ler(dir, 'deploys.log')).toMatch(new RegExp(`${SHA} rollback ${ANTERIOR}\\n$`));
});
