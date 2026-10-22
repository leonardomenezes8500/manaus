// API v0 (#34): every route through inject(), against manaus_teste with minimal data of each layer.
import pg from 'pg';
import { bancoNovo, comBanco } from '../db/teste.ts';
import { registrar } from '../coleta/carga/lib.ts';
import { fundirBairros, fundirMunicipios } from '../analise/fusao/territorio.ts';
import { criarApp } from './app.ts';

const caixa = (x: number, y: number, d: number) => `ST_Multi(ST_MakeEnvelope(${x}, ${y}, ${x + d}, ${y + d}, 4326))`;
// Teatro Amazonas.
const TEATRO = { lat: -3.1302, lon: -60.0234 };

test('/fontes and /fontes/:id read the cards; unknown id is 404', async () => {
  const app = criarApp({ db: null as any });
  const todas = (await app.inject('/fontes')).json();
  expect(todas.length).toBeGreaterThan(50);
  expect(todas.find((f: any) => f.id === 'ibge-cnefe')).toMatchObject({ status: 'verificada', publicador: 'IBGE' });
  const uma = await app.inject('/fontes/ibge-cnefe');
  expect(uma.json()).toMatchObject({ id: 'ibge-cnefe', texto: expect.stringContaining('856.226') });
  expect((await app.inject('/fontes/nao-existe')).statusCode).toBe(404);
});

comBanco('API v0 no banco', () => {
  const db = new pg.Client();
  const cep = jest.fn(async (_db: unknown, c: string) => (c === '69005000' ? { cep: c, logradouro: 'Rua X', bairro: 'Centro' } : null));
  const app = criarApp({
    db,
    altitude: async () => ({ anadem_m: 44.2, copernicus_m: 46.4 }),
    cobertura: async () => ({ ano: 2025, codigo: 24 }),
    consultarCep: cep as any,
  });

  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
    const a = await registrar(db, { chave: 'bruto/x/a', fonte: 'x', sha256: 'a'.repeat(64), baixado_em: '2026-10-21T00:00:00Z' });
    await db.query(`
      INSERT INTO ibge.municipio VALUES (1302603, 'Manaus', 'AM', ${caixa(-60.1, -3.2, 0.2)}, ${a});
      INSERT INTO ibge.bairro VALUES ('1302603005001', 'Centro', 1302603, ${caixa(-60.03, -3.14, 0.02)}, ${a}),
                                     ('1302603005002', 'Praça 14 de Janeiro', 1302603, ${caixa(-60.01, -3.12, 0.01)}, ${a});
      INSERT INTO osm.poligono (id, tags, geom, snapshot, arquivo) VALUES
        ('r1', '{"name": "Manaus", "boundary": "administrative", "admin_level": "8"}', ${caixa(-60.1, -3.2, 0.21)}, '2026-10-20', ${a}),
        ('r2', '{"name": "Centro", "boundary": "administrative", "admin_level": "10"}', ${caixa(-60.031, -3.141, 0.017)}, '2026-10-20', ${a});
      INSERT INTO ibge.setor (codigo, municipio, situacao, tipo, geom, arquivo) VALUES ('130260305000001', 1302603, 'Urbana', '0', ${caixa(-60.03, -3.14, 0.01)}, ${a});
      INSERT INTO ibge.setor_agregado (setor, tabela, variavel, valor, arquivo) VALUES ('130260305000001', 'basico', 'v0001', 812, ${a});
      INSERT INTO funai.terra_indigena (codigo, nome, fase, geom, arquivo) VALUES (1, 'TI Teste', 'Regularizada', ${caixa(-61, -3, 0.1)}, ${a});
      INSERT INTO cnuc.unidade (cd_cnuc, nome, esfera, orgao_gestor, geom, arquivo) VALUES
        ('0000.13.0001', 'APA Centro', 'Municipal', 'SEMMAS', ${caixa(-60.03, -3.14, 0.02)}, ${a});
      INSERT INTO ibge.cnefe_endereco (id, especie, setor, municipio, cep, localidade, logradouro, numero, nivel_coord, lat, lon, geom, arquivo) VALUES
        (1, 1, '130260305000001', 1302603, '69005000', 'CENTRO', 'RUA X', 10, 1, -3.13, -60.02, ST_Point(-60.02, -3.13, 4326), ${a}),
        (2, 4, '130260305000001', 1302603, '69005000', 'CENTRO', 'RUA X', 12, 1, -3.13, -60.021, ST_Point(-60.021, -3.13, 4326), ${a});
      INSERT INTO analise.fumaca_dia (dia, versao, pm25_medido_horas, horas_fu_hz, vento, focos_contados, peso_total, ranking, confianca, sinais, nota)
        VALUES ('2026-09-10', 'v0', 20, 6, '{}', 120, 55.5, '[{"nome": "Lábrea", "parcela": 0.4}]', 'media', '{}', 'heurística v0');`);
    await fundirMunicipios(db);
    await fundirBairros(db);
  }, 120_000); // a fresh database, every migration and both fusions, through the tunnel
  afterAll(() => db.end());

  test('/onde at the Teatro Amazonas: municipality, bairro (chosen + per source), tract, elevation, land cover, protected area', async () => {
    const r = await app.inject(`/onde?lat=${TEATRO.lat}&lon=${TEATRO.lon}`);
    expect(r.statusCode).toBe(200);
    const o = r.json();
    expect(o.municipio).toMatchObject({ codigo: 1302603, nome: 'Manaus' });
    expect(o.bairro.escolhido).toEqual({ nome: 'Centro', fonte: 'ibge', regra: ['implurb', 'ibge', 'osm'] });
    expect(o.bairro.por_fonte.map((f: any) => [f.fonte, f.nome])).toEqual([
      ['ibge', 'Centro'],
      ['osm', 'Centro'],
    ]);
    expect(o.setor).toEqual({ codigo: '130260305000001', situacao: 'Urbana', populacao: 812 });
    expect(o.altitude).toMatchObject({ anadem_m: 44.2, copernicus_m: 46.4 });
    expect(o.cobertura).toEqual({ ano: 2025, codigo: 24, classe: 'Área Urbanizada', fonte: 'mapbiomas-cobertura' });
    expect(o.areas_protegidas).toEqual({
      terras_indigenas: [],
      unidades: [{ cd_cnuc: '0000.13.0001', nome: 'APA Centro', esfera: 'Municipal', orgao_gestor: 'SEMMAS' }],
    });
  });

  test('/onde: a raster that fails (R2 down, file missing) does not take the answer down', async () => {
    const quebrado = criarApp({
      db,
      altitude: async () => {
        throw new Error('gdallocationinfo falhou');
      },
      cobertura: async () => ({ ano: 2025, codigo: 24 }),
    });
    const o = (await quebrado.inject(`/onde?lat=${TEATRO.lat}&lon=${TEATRO.lon}`)).json();
    expect(o.altitude).toEqual({ erro: 'indisponível agora', fontes: ['anadem', 'copernicus-dem'] });
    expect(o.cobertura.classe).toBe('Área Urbanizada');
  });

  test('/onde: invalid or outside the area is 400', async () => {
    for (const q of ['lat=abc&lon=-60', 'lat=-3.1', 'lat=10&lon=-60', 'lat=-3.1&lon=-70'])
      expect((await app.inject(`/onde?${q}`)).statusCode).toBe(400);
  });

  test('/bairros lists the entities; /bairros/:id shows the chosen value with its rule and what each source says, as GeoJSON', async () => {
    const lista = (await app.inject('/bairros')).json();
    expect(lista.map((b: any) => [b.chave, b.nome, b.fontes])).toEqual([
      ['centro', 'Centro', ['ibge', 'osm']],
      ['praca 14 de janeiro', 'Praça 14 de Janeiro', ['ibge']],
    ]);
    const b = (await app.inject(`/bairros/${lista[0].id}`)).json();
    expect(b.type).toBe('Feature');
    expect(b.geometry.type).toBe('MultiPolygon');
    expect(b.properties.escolhido.nome).toEqual({
      valor: 'Centro',
      fonte: 'ibge',
      regra: ['implurb', 'ibge', 'osm'],
      data_fonte: '2022-07-31',
    });
    expect(b.properties.escolhido.area_km2.fonte).toBe('ibge');
    expect(Object.keys(b.properties.por_fonte)).toEqual(['ibge', 'osm']);
    expect(b.properties.por_fonte.osm).toMatchObject({ nome: 'Centro', data_fonte: '2026-10-20', registro_id: 'r2' });
    expect(b.properties.por_fonte.osm.geom.type).toBe('MultiPolygon');
    expect((await app.inject('/bairros/999999')).statusCode).toBe(404);
    expect((await app.inject('/bairros/abc')).statusCode).toBe(400);
  });

  test('/municipios/:codigo: same shape, by IBGE code', async () => {
    const m = (await app.inject('/municipios/1302603')).json();
    expect(m.properties.escolhido.nome.valor).toBe('Manaus');
    expect(Object.keys(m.properties.por_fonte)).toEqual(['ibge', 'osm']);
    expect((await app.inject('/municipios/1300000')).statusCode).toBe(404);
    expect((await app.inject('/municipios/1')).statusCode).toBe(400);
  });

  test('/cep/:cep: CNEFE × BrasilAPI; malformed is 400', async () => {
    const c = (await app.inject('/cep/69005-000')).json();
    expect(c.cnefe).toMatchObject({ enderecos: 2, logradouros: ['RUA X'], localidades: ['CENTRO'], setores: ['130260305000001'] });
    expect(c.brasilapi).toEqual({ cep: '69005000', logradouro: 'Rua X', bairro: 'Centro' });
    expect((await app.inject('/cep/123')).statusCode).toBe(400);
  });

  test('/fumaca/:dia: the attribution of the day; no result is 404, bad date 400', async () => {
    const f = (await app.inject('/fumaca/2026-09-10')).json();
    expect(f).toMatchObject({ dia: '2026-09-10', versao: 'v0', confianca: 'media', focos_contados: 120, nota: 'heurística v0' });
    expect((await app.inject('/fumaca/2026-09-11')).statusCode).toBe(404);
    expect((await app.inject('/fumaca/ontem')).statusCode).toBe(400);
  });

  test('/fumaca/:dia: with v0 and v1 stored, the newest version (v1) comes back, with the wind it used', async () => {
    await db.query(`INSERT INTO analise.fumaca_dia (dia, versao, pm25_medido_horas, horas_fu_hz, vento, focos_contados, peso_total, ranking, confianca, sinais, nota, meteo)
      VALUES ('2026-09-10', 'v1', 20, 6, '{}', 80, 40.1, '[]', 'alta', '{}', 'v1', 'era5')`);
    expect((await app.inject('/fumaca/2026-09-10')).json()).toMatchObject({ versao: 'v1', meteo: 'era5', focos_contados: 80 });
  });

  test('/bairros/:id: people by age band from the census tracts of the IBGE bairro', async () => {
    const a = (await db.query('SELECT min(id) AS id FROM bruto.arquivo')).rows[0].id;
    await db.query(`UPDATE ibge.setor SET bairro = '1302603005001', bairro_nome = 'Centro' WHERE codigo = '130260305000001'`);
    await db.query(`INSERT INTO ibge.variavel (tabela, variavel, descricao, grupo) VALUES
      ('demografia', 'v01031', '0 a 4 anos', 'idade:0-4'), ('demografia', 'v01040', '60 a 69 anos', 'idade:60+')`);
    await db.query(
      `INSERT INTO ibge.setor_agregado (setor, tabela, variavel, valor, arquivo) VALUES
       ('130260305000001', 'demografia', 'v01031', 12, $1), ('130260305000001', 'demografia', 'v01040', 30, $1)`,
      [a],
    );
    const id = (await app.inject('/bairros')).json()[0].id;
    expect((await app.inject(`/bairros/${id}`)).json().properties.populacao).toMatchObject({
      setores: 1,
      idade_0_4: 12,
      idade_60_mais: 30,
    });
  });
});
