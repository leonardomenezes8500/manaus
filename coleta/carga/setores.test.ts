import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from './lib.ts';
import { aggregatesOf, grupoDe, ibgeNumber, loadAggregates, loadTracts } from './setores.ts';

// Header and one line copied from the real basic aggregates file (Agregados_por_setores_basico_BR, 2026-05-20).
const header = 'CD_SETOR;SITUACAO;CD_SIT;CD_TIPO;AREA_KM2;CD_REGIAO;NM_REGIAO;CD_UF;NM_UF;CD_MUN;NM_MUN;v0001;v0002;v0005;v0006'.split(';');
const ro =
  '"110001505000002";"Urbana";"1";"0";"0,5393102";"1";"Norte";"11";"Rondônia";"1100015";"Alta Floresta";"928";"376";"2,8";"0,0923"';
const am = '"130260305000001";"Urbana";"1";"0";"0,1";"1";"Norte";"13";"Amazonas";"1302603";"Manaus";"1250";"X";".";"3,1"';

test('IBGE numbers: decimal comma, "." and "X" are empty', () => {
  expect([ibgeNumber('928'), ibgeNumber('2,8'), ibgeNumber('0,0923'), ibgeNumber('.'), ibgeNumber('X'), ibgeNumber('')]).toEqual([
    928,
    2.8,
    0.0923,
    null,
    null,
    null,
  ]);
});

test('aggregates: only the UF asked, one row per variable with a value', () => {
  expect(aggregatesOf(header, ro, '13')).toEqual([]);
  expect(aggregatesOf(header, am, '13')).toEqual([
    { setor: '130260305000001', variavel: 'v0001', valor: 1250 },
    { setor: '130260305000001', variavel: 'v0006', valor: 3.1 },
  ]);
});

test('aggregates of the other themes: 5-digit variables (V01006), and only the variables asked', () => {
  const h = ['CD_SETOR', 'CD_UF', 'V01006', 'V01031', 'V01032'];
  expect(aggregatesOf(h, '130260305000001;13;100;8;X', '13')).toEqual([
    { setor: '130260305000001', variavel: 'v01006', valor: 100 },
    { setor: '130260305000001', variavel: 'v01031', valor: 8 },
  ]);
  expect(aggregatesOf(h, '130260305000001;13;100;8;9', '13', new Set(['v01031']))).toEqual([
    { setor: '130260305000001', variavel: 'v01031', valor: 8 },
  ]);
  // The household files (#67) call the key just "setor".
  expect(aggregatesOf(['setor', 'V00111'], '"130260305000001";"250"', '13')).toEqual([
    { setor: '130260305000001', variavel: 'v00111', valor: 250 },
  ]);
  // The demography, race and literacy files have no CD_UF and call the column "CD_setor": the UF is the start of the code.
  const real = ['CD_setor', 'V01006', 'V01031'];
  expect(aggregatesOf(real, '"130260305000001";"100";"8"', '13')).toHaveLength(2);
  expect(aggregatesOf(real, '"110001505000002";"928";"30"', '13')).toEqual([]);
});

test('dictionary text → group (age band, sex, race, literate); crossed variables have no group; bands add up to the total', () => {
  const dic: [string, string, string][] = [
    ['demografia', 'v01006', 'Quantidade de moradores'],
    ['demografia', 'v01007', 'Sexo masculino'],
    ['demografia', 'v01008', 'Sexo feminino'],
    ['demografia', 'v01009', 'Sexo masculino, 0 a 4 anos'],
    ['demografia', 'v01031', '0 a 4 anos'],
    ['demografia', 'v01032', '5 a 9 anos'],
    ['demografia', 'v01033', '10 a 14 anos'],
    ['demografia', 'v01034', '15 a 19 anos'],
    ['demografia', 'v01039', '50 a 59 anos'],
    ['demografia', 'v01040', '60 a 69 anos'],
    ['demografia', 'v01041', '70 anos ou mais'],
    ['cor_ou_raca', 'v01320', 'Cor ou raça é parda'],
    ['cor_ou_raca', 'v01325', 'Sexo masculino, Cor ou raça é parda'],
    ['alfabetizacao', 'v00644', '15 a 19 anos'], // everyone aged 15-19 (repeats the demography table)
    ['alfabetizacao', 'v00748', 'Pessoas alfabetizadas, 15 a 19 anos'],
    ['alfabetizacao', 'v00900', '15 anos ou mais, Morador sabe ler e escrever'],
    ['alfabetizacao', 'v00901', '15 anos ou mais, Morador não sabe ler e escrever'],
    ['caracteristicas_domicilio2', 'v00111', 'Domicílios Particulares Permanentes Ocupados, Utiliza rede geral de distribuição'],
    ['caracteristicas_domicilio2', 'v00113', 'Domicílios Particulares Permanentes Ocupados, Utiliza poço raso, freático ou cacimba'],
    [
      'caracteristicas_domicilio2',
      'v00312',
      'Domicílios Particulares Permanentes Ocupados, Destinação do esgoto do banheiro ou sanitário ou buraco para dejeções é fossa rudimentar ou buraco',
    ],
    ['caracteristicas_domicilio2', 'v00399', 'Domicílios Particulares Permanentes Ocupados, Lixo queimado na propriedade'],
    [
      'caracteristicas_domicilio2',
      'v00463',
      'Domicílios Particulares Permanentes Ocupados, Tem ligação à rede geral mas utiliza principalmente outra forma',
    ], // not one of the groups
  ];
  expect(dic.map(([t, , d]) => grupoDe(t, d))).toEqual([
    'total',
    'sexo:masculino',
    'sexo:feminino',
    null,
    'idade:0-4',
    'idade:5-14',
    'idade:5-14',
    'idade:15-59',
    'idade:15-59',
    'idade:60+',
    'idade:60+',
    'cor:parda',
    null,
    null,
    null,
    'alfabetizados:15+',
    'nao_alfabetizados:15+',
    'agua:rede',
    'agua:poco',
    'esgoto:fossa_rudimentar',
    'lixo:queimado',
    null,
  ]);
  // A synthetic tract: the age bands add up to the total.
  const valor: Record<string, number> = { v01006: 100, v01031: 8, v01032: 9, v01033: 10, v01034: 30, v01039: 30, v01040: 8, v01041: 5 };
  const soma = dic
    .filter(([t, v, d]) => t === 'demografia' && grupoDe(t, d)?.startsWith('idade:') && v in valor)
    .reduce((a, [, v]) => a + valor[v], 0);
  expect(soma).toBe(valor.v01006);
});

comBanco('carga de setores', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
  });
  afterAll(() => db.end());

  test('staging → ibge.setor (SIRGAS square already in 4326 here), then aggregates, both idempotent', async () => {
    const a = await registrar(db, {
      chave: 'bruto/ibge-setores/x.gpkg',
      fonte: 'ibge-setores',
      sha256: 'a'.repeat(64),
      baixado_em: '2026-10-21T00:00:00Z',
    });
    // What ogr2ogr leaves in the staging table.
    await db.query(`CREATE TABLE ibge.carga_setor (cd_setor text, situacao text, cd_tipo text, area_km2 real, cd_mun text, cd_bairro text, nm_bairro text, geom geometry(MultiPolygon, 4326));
      INSERT INTO ibge.carga_setor VALUES
        ('130260305000001', 'Urbana', '0', 0.1, '1302603', '', '', ST_Multi(ST_MakeEnvelope(-60.03, -3.11, -60.01, -3.09, 4326))),
        ('130260305000002', 'Rural', '0', 0.2, '1302603', '', '', ST_Multi(ST_MakeEnvelope(-60.5, -3.5, -60.4, -3.4, 4326))),
        ('130260305000002', 'Rural', '0', 0.3, '1302603', '', '', ST_Multi(ST_MakeEnvelope(-60.3, -3.5, -60.2, -3.4, 4326)))`);
    expect(await loadTracts(db, a)).toBe(2); // the tract split in two parts becomes one row
    expect(
      (await db.query("SELECT ST_NumGeometries(geom) AS n, area_km2 FROM ibge.setor WHERE codigo = '130260305000002'")).rows[0],
    ).toEqual({ n: 2, area_km2: 0.5 });
    expect((await db.query("SELECT to_regclass('ibge.carga_setor') AS t")).rows[0].t).toBeNull();
    const b = await registrar(db, {
      chave: 'bruto/ibge-agregados-setor/b.zip',
      fonte: 'ibge-agregados-setor',
      sha256: 'b'.repeat(64),
      baixado_em: '2026-10-21T00:00:00Z',
    });
    const rows = aggregatesOf(header, am, '13');
    await loadAggregates(db, b, 'basico', rows);
    await db.query('DELETE FROM bruto.carga WHERE arquivo = $1', [b]);
    await loadAggregates(db, b, 'basico', rows);
    const r =
      await db.query(`SELECT s.municipio, s.bairro, a.valor, v.descricao FROM ibge.setor s JOIN ibge.setor_agregado a ON a.setor = s.codigo
      JOIN ibge.variavel v USING (tabela, variavel) WHERE a.variavel = 'v0001'`);
    expect(r.rows).toEqual([{ municipio: 1302603, bairro: null, valor: 1250, descricao: 'Total de pessoas' }]);
  });
});
