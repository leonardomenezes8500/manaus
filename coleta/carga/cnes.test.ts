import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from './lib.ts';
import { cortarApi, juntar, loadEstabelecimentos, parseSt } from './cnes.ts';

// Real Manaus rows of STAM2609.dbc (as readDbcRecords gives them), only the columns the reader uses.
const usf = { CNES: '2014106', CODUFMUN: '130260', COD_CEP: '69093115', TPGESTAO: 'M', TP_UNID: '02', NAT_JUR: '1244', COMPETEN: '202609' };
const clinica = {
  CNES: '9999999',
  CODUFMUN: '130260',
  COD_CEP: '69050000',
  TPGESTAO: 'E',
  TP_UNID: '36',
  NAT_JUR: '2240',
  COMPETEN: '202609',
};

test('ST row: only Manaus, management and public by legal nature (1xxx), unknown management stops the load', () => {
  expect(parseSt(usf)).toEqual({
    codigo: 2014106,
    competencia: '2026-09',
    tipo: '02',
    gestao: 'municipal',
    publico: true,
    nat_jur: '1244',
    cep: '69093115',
  });
  expect(parseSt(clinica)).toMatchObject({ gestao: 'estadual', publico: false });
  expect(parseSt({ ...usf, TPGESTAO: 'D' })).toMatchObject({ gestao: 'dupla' });
  expect(parseSt({ ...usf, CODUFMUN: '130002' })).toBeNull();
  expect(() => parseSt({ ...usf, TPGESTAO: 'X' })).toThrow('TPGESTAO');
});

// One establishment of the CNES API (apidadosabertos.saude.gov.br/cnes/estabelecimentos), contact fields included.
const api = {
  codigo_cnes: 2014106,
  nome_fantasia: 'USF N 26',
  nome_razao_social: 'MANAUS SECRETARIA MUNICIPAL DE SAUDE',
  codigo_tipo_unidade: 2,
  tipo_gestao: 'M',
  codigo_cep_estabelecimento: '69093115',
  numero_telefone_estabelecimento: '(92)36514883',
  endereco_email_estabelecimento: 'alguem@gmail.com',
  latitude_estabelecimento_decimo_grau: -3.005642961,
  longitude_estabelecimento_decimo_grau: -59.99579831,
  data_atualizacao: '2026-10-15',
};

test('API cut: no phone or e-mail; zero or missing coordinates become null', () => {
  const [c] = cortarApi([api]);
  expect(c).toEqual({
    codigo: 2014106,
    nome: 'USF N 26',
    tipo: 2,
    gestao: 'M',
    cep: '69093115',
    lat: -3.005642961,
    lon: -59.99579831,
    atualizado: '2026-10-15',
  });
  expect(JSON.stringify(cortarApi([api]))).not.toMatch(/36514883|gmail/);
  const semPonto = { ...api, latitude_estabelecimento_decimo_grau: 0, longitude_estabelecimento_decimo_grau: null };
  expect(cortarApi([semPonto])[0]).toMatchObject({ lat: null, lon: null });
});

test('join: the ST gives the universe; name and point from the API by CNES code', () => {
  const [a, b] = juntar([parseSt(usf)!, parseSt(clinica)!], cortarApi([api]));
  expect(a).toMatchObject({ codigo: 2014106, nome: 'USF N 26', lat: -3.005642961, lon: -59.99579831 });
  expect(b).toMatchObject({ codigo: 9999999, nome: null, lat: null, lon: null });
});

comBanco('carga CNES', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  }, 120_000);
  afterAll(() => db.end());

  test('replaces the whole table once per ST file; point only inside Manaus', async () => {
    const arq = (n: string) =>
      registrar(db, {
        chave: `bruto/datasus-cnes/${n}`,
        fonte: 'datasus-cnes',
        sha256: String(n.length % 10).repeat(64),
        baixado_em: '2026-10-30T12:00:00Z',
      });
    const st = await arq('STAM2609.dbc');
    const pontos = await arq('api.json.gz');
    await db.query(
      `INSERT INTO ibge.municipio (codigo, nome, uf, geom, arquivo)
       VALUES (1302603, 'Manaus', 'AM', ST_Multi(ST_MakeEnvelope(-60.5, -3.3, -59.5, -2.5, 4326)), $1)`,
      [st],
    );
    const fora = {
      ...api,
      codigo_cnes: 9999999,
      latitude_estabelecimento_decimo_grau: -15.8,
      longitude_estabelecimento_decimo_grau: -47.9,
    };
    const linhas = juntar([parseSt(usf)!, parseSt(clinica)!], cortarApi([api, fora]));
    expect(await loadEstabelecimentos(db, st, pontos, linhas)).toBe(2);
    expect(await loadEstabelecimentos(db, st, pontos, linhas)).toBe(0);
    const r = await db.query('SELECT codigo, nome, gestao, publico, ST_Y(geom) AS lat FROM cnes.estabelecimento ORDER BY codigo');
    expect(r.rows).toEqual([
      { codigo: 2014106, nome: 'USF N 26', gestao: 'municipal', publico: true, lat: -3.005642961 },
      { codigo: 9999999, nome: 'USF N 26', gestao: 'estadual', publico: false, lat: null },
    ]);
    const novo = await arq('STAM2610.dbc');
    expect(await loadEstabelecimentos(db, novo, pontos, linhas.slice(0, 1))).toBe(1);
    expect((await db.query('SELECT count(*)::int AS n FROM cnes.estabelecimento')).rows[0].n).toBe(1);
  });
});
