// Collection health (#19): for every "coletando" card, the newest raw file in R2 and its age against the expected
// frequency (age > 2× expected = ATRASADO), plus recent errors from the logs and buffer/memory use → estado/saude.md.
// Cron every 6 h. Nothing here prints secrets: log lines already went through the collectors' own filters.
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lerCatalogo } from '../fontes/catalogo.ts';
import { enviar, listKeys } from './lib/baixar.ts';

/** "3h", "1d", "365d" → hours. */
export function hoursOf(freq: string): number {
  const m = freq.match(/^(\d+)\s*(h|d)$/);
  if (!m) throw new Error(`bad frequency: ${freq}`);
  return Number(m[1]) * (m[2] === 'd' ? 24 : 1);
}

/** OK while the newest file is younger than twice the expected interval. */
export const status = (ageHours: number | null, expectedHours: number) =>
  ageHours !== null && ageHours <= 2 * expectedHours ? 'OK' : 'ATRASADO';

/** Newest raw data key of a source: looks at the last few daily prefixes first, then the whole source. */
async function newest(fonte: string, expectedHours: number, now: Date): Promise<{ key: string; modified: Date } | undefined> {
  const days = Math.min(30, Math.ceil((2 * expectedHours) / 24) + 1);
  const pick = (ks: { key: string; modified: Date }[]) =>
    ks.filter((k) => !k.key.endsWith('.meta.json')).sort((a, b) => b.modified.getTime() - a.modified.getTime())[0];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '/');
    const found = pick(await listKeys(`bruto/${fonte}/${d}/`));
    if (found) return found;
  }
  return pick(await listKeys(`bruto/${fonte}/`)) ?? pick(await listKeys(`normalizado/${fonte}/`)); // PRODES keeps only the COG
}

// Reads a versioned public url and keeps only totals in the database (#76): nothing in R2 to date.
const FORA_DO_R2 = new Set(['mapbiomas-fogo']);

const fmtAge = (h: number | null) => (h === null ? '—' : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);

export async function recentErrors(logs: string, now: Date): Promise<string[]> {
  const days = [0, 1].map((i) => new Date(now.getTime() - 4 * 3600_000 - i * 86_400_000).toISOString().slice(0, 10)); // Manaus days
  const files = (await readdir(logs).catch(() => [] as string[]))
    .filter((f) => !f.startsWith('saude-') && days.some((d) => f.endsWith(`-${d}.log`)))
    .sort(); // own logs quote older errors
  const out: string[] = [];
  for (const f of files) {
    const errors = (await readFile(join(logs, f), 'utf8')).split('\n').filter((l) => /ERRO|NOVO SENSOR/.test(l));
    for (const l of errors.slice(-3)) out.push(`${f}: ${l.slice(0, 200)}`);
  }
  return out;
}

async function folderBytes(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0,
    files = 0;
  for (const f of await readdir(dir, { recursive: true }).catch(() => [] as string[])) {
    const s = await stat(join(dir, f)).catch(() => undefined);
    if (s?.isFile()) {
      bytes += s.size;
      files++;
    }
  }
  return { bytes, files };
}

const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`;

async function main() {
  const now = new Date();
  const rows: string[] = [];
  let late = 0;
  for (const { card } of lerCatalogo()
    .filter((c) => c.card.status === 'coletando')
    .sort((a, b) => a.card.id.localeCompare(b.card.id))) {
    if (FORA_DO_R2.has(card.id)) {
      rows.push(`| ${card.id} | (url pública, nada no R2) | — | ${card.coleta} | fora do R2 |`);
      continue;
    }
    const expected = hoursOf(card.coleta);
    const last = await newest(card.id, expected, now);
    const age = last ? (now.getTime() - last.modified.getTime()) / 3600_000 : null;
    const s = status(age, expected);
    if (s !== 'OK') late++;
    rows.push(`| ${card.id} | ${last ? last.key.split('/').at(-1) : '—'} | ${fmtAge(age)} | ${card.coleta} | ${s} |`);
  }
  const buffer = process.env.MANAUS_BUFFER || join(tmpdir(), 'manaus-buffer');
  const [all, pending] = await Promise.all([folderBytes(buffer), folderBytes(join(buffer, 'pendente'))]);
  const memory = await readFile('/sys/fs/cgroup/memory.current', 'utf8').then(
    (v) => mb(Number(v)),
    () => '—',
  );
  const limit = await readFile('/sys/fs/cgroup/memory.max', 'utf8').then(
    (v) => (v.trim() === 'max' ? 'sem limite' : mb(Number(v))),
    () => '—',
  );
  const errors = await recentErrors(process.env.MANAUS_LOGS || '/dados/logs', now);
  const md = [
    '# Saúde da coleta',
    '',
    `Gerado por coleta/saude.ts em ${now.toISOString().slice(0, 16)}Z. ATRASADO = o último arquivo tem mais que 2× a frequência esperada.`,
    '',
    '| fonte | último arquivo | idade | esperado | situação |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    `Buffer: ${mb(all.bytes)} em ${all.files} arquivos; pendentes de envio ao R2: ${pending.files}. Memória do coletor: ${memory} (limite ${limit}).`,
    '',
    '## Erros recentes nos logs (hoje e ontem, até 3 por arquivo)',
    ...(errors.length ? errors.map((e) => `- ${e}`) : ['- nenhum']),
    '',
  ].join('\n');
  console.log(md);
  const dir = await mkdtemp(join(tmpdir(), 'saude-'));
  try {
    await writeFile(join(dir, 'saude.md'), md);
    await enviar(join(dir, 'saude.md'), 'estado/saude.md', { sobrescrever: true });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  if (late) process.exitCode = 1;
}

if (import.meta.main)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
