import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from './lib.ts';
import { casador, loadEscolas, palavras, parseEscola, type Ensino } from './inep.ts';

// Real Manaus rows of the 2024 Censo Escolar (microdados_ed_basica_2024.csv), only the columns the reader uses.
const header =
  'NU_ANO_CENSO;CO_MUNICIPIO;NO_ENTIDADE;CO_ENTIDADE;TP_DEPENDENCIA;TP_LOCALIZACAO;DS_ENDERECO;NU_ENDERECO;NO_BAIRRO;CO_CEP;NU_DDD;NU_TELEFONE;TP_SITUACAO_FUNCIONAMENTO;QT_SALAS_UTILIZADAS;QT_SALAS_UTILIZA_CLIMATIZADAS;QT_MAT_BAS;QT_MAT_INF_CRE;QT_MAT_INF_PRE;QT_MAT_FUND_AI;QT_MAT_FUND_AF;QT_MAT_MED;QT_MAT_BAS_0_3;QT_MAT_BAS_4_5;QT_MAT_BAS_6_10;QT_MAT_BAS_11_14;QT_MAT_BAS_15_17;QT_MAT_BAS_18_MAIS'.split(
    ';',
  );
const cmei =
  '2024;1302603;CMEI HUMBERTO DE ALENCAR CASTELO BRANCO;13025120;3;1;R. 22;S/N;PARQUE 10 DE NOVEMBRO;69055400;92;36000000;1;9;9;180;35;145;0;0;0;35;145;0;0;0;0';
const ceja = '2024;1302603;CEJA PROF AGENOR FERREIRA LIMA;13025104;2;1;AV ANDRE ARAUJO;99;ALEIXO;69060000;;;1;26;26;1200;;;;;;;;;;;';

test('parse: by column name, codes turned into words, empty counts are null, phone is not kept', () => {
  const e = parseEscola(header, cmei);
  expect(e).toEqual({
    codigo: 13025120,
    ano: 2024,
    nome: 'CMEI HUMBERTO DE ALENCAR CASTELO BRANCO',
    rede: 'municipal',
    situacao: 'em atividade',
    localizacao: 'urbana',
    endereco: 'R. 22',
    numero: 'S/N',
    bairro: 'PARQUE 10 DE NOVEMBRO',
    cep: '69055400',
    salas: 9,
    salas_climatizadas: 9,
    mat_total: 180,
    mat_creche: 35,
    mat_pre: 145,
    mat_fund_ai: 0,
    mat_fund_af: 0,
    mat_medio: 0,
    mat_0_3: 35,
    mat_4_5: 145,
    mat_6_10: 0,
    mat_11_14: 0,
    mat_15_17: 0,
    mat_18_mais: 0,
  });
  expect(JSON.stringify(e)).not.toContain('36000000');
  expect(() => parseEscola(header, cmei.replace(';3;1;R. 22', ';9;1;R. 22'))).toThrow('TP_DEPENDENCIA');
  expect(parseEscola(header, ceja)).toMatchObject({ rede: 'estadual', numero: '99', mat_total: 1200, mat_creche: null, mat_0_3: null });
});

test('name words: no accents, no school-type words, no short words', () => {
  expect([...palavras('Escola Municipal Profª Maria Conceição de Souza')].sort()).toEqual(['CONCEICAO', 'MARIA', 'SOUZA']);
  expect(palavras('CMEI')).toEqual(new Set());
  expect(palavras('EM EDUC ESPECIAL ANDRE VIDAL DE ARAUJO')).toEqual(new Set(['ANDRE', 'VIDAL', 'ARAUJO']));
});

const ensino: Ensino[] = [
  { id: 1, cep: '69060000', numero: 99, nome: 'CENTRO EDUCACIONAL DE JOVENS', lat: -3.1, lon: -60.0 },
  { id: 2, cep: '69055400', numero: 0, nome: 'CRECHE MUNICIPAL HUMBERTO CASTELO BRANCO', lat: -3.2, lon: -60.1 },
  { id: 3, cep: '69099000', numero: 10, nome: 'ESCOLA ESTADUAL SANTA LUZIA', lat: -3.3, lon: -60.2 },
  { id: 4, cep: '69099001', numero: 12, nome: 'ESCOLA SAO JOSE', lat: -3.4, lon: -60.3 },
  { id: 5, cep: '69099002', numero: 14, nome: 'COLEGIO SAO JOSE', lat: -3.5, lon: -60.4 },
  { id: 6, cep: '69011000', numero: 50, nome: 'ESCOLA ALFA BETA', lat: -3.6, lon: -60.5 },
  { id: 7, cep: '69011000', numero: 50, nome: 'ESCOLA GAMA DELTA', lat: -3.7, lon: -60.6 },
  { id: 8, cep: '69011000', numero: 0, nome: 'ESCOLA ALFA OMEGA', lat: -3.8, lon: -60.7 },
];
const ceps = new Map([
  ['69070000', { lat: -3.01, lon: -60.01, km: 0.8 }],
  ['69080000', { lat: -3.02, lon: -60.02, km: 4.2 }],
]);
const casar = casador(ensino, ceps);
const escola = (nome: string, cep: string, numero: string) => ({ nome, cep, numero });

test('rule 1: same CEP and number as a school of the CNEFE', () => {
  expect(casar(escola('CEJA PROF AGENOR FERREIRA LIMA', '69060000', '99'))).toEqual({
    lat: -3.1,
    lon: -60.0,
    origem: 'cep-numero',
    cnefe: 1,
  });
});

test('rules 1 and 2 only take a single candidate', () => {
  expect(casar(escola('ESCOLA GAMA DELTA', '69011000', '50'))).toMatchObject({ origem: 'cep-nome', cnefe: 7 }); // two at CEP and number
  expect(casar(escola('ESCOLA ALFA', '69011000', 'S/N'))).toBeNull(); // two at the CEP with ALFA
});

test('rule 2: same CEP and the words of one name all in the other (S/N schools)', () => {
  expect(casar(escola('CMEI HUMBERTO CASTELO BRANCO', '69055400', 'S/N'))).toMatchObject({ origem: 'cep-nome', cnefe: 2 });
  // the CNEFE name is the shorter one: taken when it has 2 words or more
  expect(casar(escola('CMEI HUMBERTO DE ALENCAR CASTELO BRANCO', '69055400', 'S/N'))).toMatchObject({ origem: 'cep-nome', cnefe: 2 });
  expect(casar(escola('EM ALFA OMEGA OUTRA', '69011000', 'S/N'))).toMatchObject({ cnefe: 8 });
  expect(casar(escola('CMEI HUMBERTO OUTRO', '69055400', 'S/N'))).toBeNull();
});

test('rule 3: CEP unknown, name with two words or more that only one CNEFE school has in the city', () => {
  expect(casar(escola('EE SANTA LUZIA', '69000000', 'S/N'))).toMatchObject({ origem: 'nome-cidade', cnefe: 3 });
  expect(casar(escola('ESCOLA SAO JOSE', '69000000', 'S/N'))).toBeNull(); // two schools have it
  expect(casar(escola('ESCOLA LUZIA', '69000000', 'S/N'))).toBeNull(); // one word only
  // the declared CEP is known and the named school is more than 2 km from its centre: not taken (rule 4 instead)
  expect(casar(escola('EE SANTA LUZIA', '69070000', 'S/N'))).toMatchObject({ origem: 'centro-cep' });
});

test('rule 4: centre of the CEP, only when its addresses fit in 1 km', () => {
  expect(casar(escola('ESCOLA NOVA', '69070000', '5'))).toEqual({ lat: -3.01, lon: -60.01, origem: 'centro-cep', cnefe: null });
  expect(casar(escola('ESCOLA NOVA', '69080000', '5'))).toBeNull();
});

comBanco('carga INEP', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('loads once per file, with the point when there is one', async () => {
    const a = await registrar(db, {
      chave: 'bruto/inep-microdados/x.csv.gz',
      fonte: 'inep-microdados',
      sha256: 'a'.repeat(64),
      baixado_em: '2026-10-29T16:00:00Z',
    });
    const linhas = [
      { ...parseEscola(header, cmei), ponto: { lat: -3.2, lon: -60.1, origem: 'cep-nome' as const, cnefe: 2 } },
      { ...parseEscola(header, ceja), ponto: null },
    ];
    expect(await loadEscolas(db, a, linhas)).toBe(2);
    expect(await loadEscolas(db, a, linhas)).toBe(0);
    const r = await db.query('SELECT codigo, rede, mat_4_5, ponto_origem, cnefe_id, ST_Y(geom) AS lat FROM inep.escola ORDER BY codigo');
    expect(r.rows).toEqual([
      { codigo: 13025104, rede: 'estadual', mat_4_5: null, ponto_origem: null, cnefe_id: null, lat: null },
      { codigo: 13025120, rede: 'municipal', mat_4_5: 145, ponto_origem: 'cep-nome', cnefe_id: '2', lat: -3.2 },
    ]);
  });
});
