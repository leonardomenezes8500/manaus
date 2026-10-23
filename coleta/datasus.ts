// Hospitalisations and deaths (#88): DATASUS SIH (RDAMaamm.dbc, one file per processing month) and SIM (DOAMaaaa.dbc,
// final years and the preliminary ones) of the AM, from 2012 on, as they come into the raw files (FTP: curl, then
// guardar()). The server date goes into the raw name, so a month DATASUS rewrites becomes a new file. Then the daily
// totals of Manaus residents, rebuilt from the newest version of every file: datasus.internacao_dia and datasus.obito_dia.
// By hand on this PC, once a month (DATASUS publishes ~2 months late):  node coleta/datasus.ts
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDbcRecords } from '@precisa-saude/datasus-dbc';
import pg from 'pg';
import { guardar, listKeys, openRaw } from './lib/baixar.ts';

const FTP = 'ftp://ftp.datasus.gov.br/dissemin/publicos';
export const MANAUS_RES = '130260'; // MUNIC_RES / CODMUNRES: IBGE code with 6 digits
// ano: the year a file covers (only 2012 on); sufixo: marks a preliminary SIM year in the raw name.
const PASTAS = [
  {
    fonte: 'datasus-sih',
    pasta: 'SIHSUS/200801_/Dados',
    re: /^RDAM(\d\d)\d\d\.dbc$/i,
    ano: (m: RegExpMatchArray) => `20${m[1]}`,
    sufixo: '',
  },
  { fonte: 'datasus-sim', pasta: 'SIM/CID10/DORES', re: /^DOAM(\d{4})\.dbc$/i, ano: (m: RegExpMatchArray) => m[1], sufixo: '' },
  { fonte: 'datasus-sim', pasta: 'SIM/PRELIM/DORES', re: /^DOAM(\d{4})\.dbc$/i, ano: (m: RegExpMatchArray) => m[1], sufixo: '_prelim' },
];

export type Item = { nome: string; data: string; bytes: number };

/** IIS-style FTP listing ("10-16-26  05:30PM   43847 RDRR2607.dbc") → name, server date, size. */
export function lerListagem(texto: string): Item[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.match(/^(\d\d)-(\d\d)-(\d\d)\s+\S+\s+(\d+)\s+(\S+)$/))
    .filter((m) => m !== null)
    .map((m) => ({ nome: m[5], data: `20${m[3]}-${m[1]}-${m[2]}`, bytes: Number(m[4]) }));
}

/** Raw name: the server date (a rewritten month becomes a new file) and _prelim for a preliminary SIM year. */
export const nomeBruto = (i: Item, sufixo = '') => `${i.nome.replace(/\.dbc$/i, '')}${sufixo}_${i.data}.dbc`;

/**
 * The raw keys to read: the newest version of each SIH month and SIM year; a final SIM year wins over its preliminary
 * file (both stay in the raw files, only one is counted).
 */
export function maisNovos(chaves: string[]): { fonte: string; periodo: string; chave: string }[] {
  const por = new Map<string, { fonte: string; periodo: string; chave: string; ordem: string }>();
  for (const k of chaves) {
    const nome = k.replace(/^.*Z_/, '');
    const m = nome.match(/^(RDAM\d{4}|DOAM\d{4})(_prelim)?_(\d{4}-\d\d-\d\d)\.dbc$/i);
    if (!m) continue;
    const sih = m[1].toUpperCase().startsWith('RD');
    const periodo = sih ? `20${m[1].slice(4, 6)}-${m[1].slice(6, 8)}` : `${m[1].slice(4)}${m[2] ? '-preliminar' : ''}`;
    const ordem = `${m[2] ? 0 : 1}|${m[3]}`; // final before preliminary, then the newest server date
    const id = m[1].toUpperCase();
    const atual = por.get(id);
    if (!atual || ordem > atual.ordem) por.set(id, { fonte: sih ? 'datasus-sih' : 'datasus-sim', periodo, chave: k, ordem });
  }
  return [...por.values()].map(({ ordem: _, ...x }) => x);
}

/** SIH age in years from COD_IDADE (2 days, 3 months, 4 years, 5 years over 100) and IDADE. */
export function idadeSih(cod: string | null, idade: number | null): number | null {
  if (idade === null) return null;
  return cod === '2' ? 0 : cod === '3' ? Math.floor(idade / 12) : cod === '4' ? idade : cod === '5' ? 100 + idade : null;
}

/** SIM age, 3 digits: unit (0 minutes, 1 hours, 2 days, 3 months, 4 years, 5 years over 100) and value. */
export function idadeSim(s: string | null): number | null {
  const m = s?.match(/^([0-5])(\d\d)$/);
  if (!m) return null;
  const v = Number(m[2]);
  return m[1] === '3' ? Math.floor(v / 12) : m[1] === '4' ? v : m[1] === '5' ? 100 + v : 0;
}

export const faixaIdade = (anos: number | null) =>
  anos === null ? 'ignorada' : anos < 5 ? '0-4' : anos < 10 ? '5-9' : anos < 15 ? '10-14' : anos < 60 ? '15-59' : '60+';

export const grupoCid = (cid: string | null) => (cid?.startsWith('J') ? 'respiratorio' : cid?.startsWith('I') ? 'circulatorio' : 'outro');

type Chave = { dia: string; grupo: string; faixa: string; sexo: string };
function somador<T extends object>(zero: () => T) {
  const m = new Map<string, Chave & T>();
  return {
    em: (k: Chave) => {
      const id = `${k.dia}|${k.grupo}|${k.faixa}|${k.sexo}`;
      if (!m.has(id)) m.set(id, { ...k, ...zero() });
      return m.get(id)!;
    },
    linhas: () => [...m.values()],
  };
}

/** One SIH file → daily totals of the residents of `mun` (admission date, principal diagnosis). SEXO 3 is female in the SIH. */
export async function somarInternacoes(dbc: Uint8Array, mun: string) {
  const s = somador(() => ({ internacoes: 0, mortes: 0 }));
  for await (const r of readDbcRecords(dbc)) {
    const d = String(r.DT_INTER ?? '').match(/^(\d{4})(\d\d)(\d\d)$/);
    // IDENT 5 = long-stay continuation AIH, not a new admission (as the TabNet counts; ~1 in 15 thousand in the AM files).
    if (r.MUNIC_RES !== mun || !d || r.IDENT === '5') continue;
    const x = s.em({
      dia: `${d[1]}-${d[2]}-${d[3]}`,
      grupo: grupoCid(r.DIAG_PRINC as string | null),
      faixa: faixaIdade(idadeSih(r.COD_IDADE as string | null, r.IDADE as number | null)),
      sexo: r.SEXO === '1' ? 'M' : r.SEXO === '3' ? 'F' : 'ignorado',
    });
    x.internacoes++;
    if (Number(r.MORTE) === 1) x.mortes++;
  }
  return s.linhas();
}

/** One SIM file → daily deaths of the residents of `mun` (date of death, underlying cause). */
export async function somarObitos(dbc: Uint8Array, mun: string) {
  const s = somador(() => ({ obitos: 0 }));
  for await (const r of readDbcRecords(dbc)) {
    const d = String(r.DTOBITO ?? '').match(/^(\d\d)(\d\d)(\d{4})$/);
    if (r.CODMUNRES !== mun || !d) continue;
    s.em({
      dia: `${d[3]}-${d[2]}-${d[1]}`,
      grupo: grupoCid(r.CAUSABAS as string | null),
      faixa: faixaIdade(idadeSim(r.IDADE as string | null)),
      sexo: r.SEXO === '1' ? 'M' : r.SEXO === '2' ? 'F' : 'ignorado',
    }).obitos++;
  }
  return s.linhas();
}

const somarEm = <T extends Chave>(alvo: Map<string, T>, linhas: T[], campos: (keyof T)[]) => {
  for (const l of linhas) {
    const id = `${l.dia}|${l.grupo}|${l.faixa}|${l.sexo}`;
    const a = alvo.get(id);
    if (!a) alvo.set(id, { ...l });
    else for (const c of campos) (a[c] as number) += l[c] as number;
  }
};

async function bytesDoBruto(chave: string): Promise<Uint8Array> {
  const partes: Buffer[] = [];
  for await (const p of await openRaw(chave)) partes.push(p as Buffer);
  return new Uint8Array(Buffer.concat(partes));
}

async function principal() {
  const tmp = await mkdtemp(join(process.env.MANAUS_BUFFER || tmpdir(), 'datasus-'));
  const db = new pg.Client();
  await db.connect();
  try {
    // 1. Raw: every AM file from 2012 on whose server date is not in R2 yet.
    const noBruto = new Set(
      [...(await listKeys('bruto/datasus-sih/')), ...(await listKeys('bruto/datasus-sim/'))].map((k) => k.key.replace(/^.*Z_/, '')),
    );
    for (const p of PASTAS) {
      const lista = lerListagem(execFileSync('curl', ['-sS', '--fail', `${FTP}/${p.pasta}/`], { maxBuffer: 1 << 28 }).toString());
      if (!lista.length) throw new Error(`listagem de ${p.pasta} não reconhecida (o FTP mudou de formato?)`);
      for (const i of lista) {
        const m = i.nome.match(p.re);
        if (!m || p.ano(m) < '2012' || noBruto.has(nomeBruto(i, p.sufixo))) continue;
        const local = join(tmp, i.nome);
        execFileSync('curl', ['-sS', '--fail', '--retry', '5', '-o', local, `${FTP}/${p.pasta}/${i.nome}`]);
        const b = await guardar(local, {
          fonte: p.fonte,
          coletor: 'datasus',
          nome: nomeBruto(i, p.sufixo),
          origem: `${FTP}/${p.pasta}/${i.nome}`,
        });
        console.log(b.chave, b.bytes);
        await rm(local);
      }
    }
    // 2. The newest raw version of each period, then the daily totals rebuilt from all of them.
    const novos = maisNovos([...(await listKeys('bruto/datasus-sih/')), ...(await listKeys('bruto/datasus-sim/'))].map((x) => x.key));
    const internacoes = new Map<string, Awaited<ReturnType<typeof somarInternacoes>>[number]>();
    const obitos = new Map<string, Awaited<ReturnType<typeof somarObitos>>[number]>();
    for (const n of novos) {
      const b = await bytesDoBruto(n.chave);
      if (n.fonte === 'datasus-sih') somarEm(internacoes, await somarInternacoes(b, MANAUS_RES), ['internacoes', 'mortes']);
      else somarEm(obitos, await somarObitos(b, MANAUS_RES), ['obitos']);
    }
    await db.query('BEGIN');
    for (const [tabela, linhas] of [
      ['datasus.internacao_dia', [...internacoes.values()]],
      ['datasus.obito_dia', [...obitos.values()]],
    ] as const) {
      await db.query(`DELETE FROM ${tabela}`);
      for (let i = 0; i < linhas.length; i += 20_000)
        await db.query(`INSERT INTO ${tabela} SELECT * FROM json_populate_recordset(NULL::${tabela}, $1::json)`, [
          JSON.stringify(linhas.slice(i, i + 20_000)),
        ]);
    }
    await db.query('DELETE FROM datasus.lido');
    await db.query(`INSERT INTO datasus.lido SELECT * FROM json_populate_recordset(NULL::datasus.lido, $1::json)`, [JSON.stringify(novos)]);
    await db.query('COMMIT');
    console.log(`datasus.internacao_dia: ${internacoes.size} linhas; datasus.obito_dia: ${obitos.size} linhas; ${novos.length} arquivos`);
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await db.end();
    await rm(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main)
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
