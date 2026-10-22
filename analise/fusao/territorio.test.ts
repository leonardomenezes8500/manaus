import pg from 'pg';
import { bancoNovo, comBanco } from '../../db/teste.ts';
import { registrar } from '../../coleta/carga/lib.ts';
import { divergencias, fundirBairros, fundirMunicipios } from './territorio.ts';

const caixa = (x: number, y: number, d = 0.01) => `ST_Multi(ST_MakeEnvelope(${x}, ${y}, ${x + d}, ${y + d}, 4326))`;

comBanco('fusão de municípios e bairros', () => {
  const db = new pg.Client();
  beforeAll(async () => {
    await db.connect();
    await bancoNovo(db);
    const a = await registrar(db, { chave: 'bruto/x/a', fonte: 'x', sha256: 'a'.repeat(64), baixado_em: '2026-10-21T00:00:00Z' });
    await db.query(`
      INSERT INTO ibge.municipio VALUES (1302603, 'Manaus', 'AM', ${caixa(-60.1, -3.2, 0.2)}, ${a}), (1303569, 'Rio Preto da Eva', 'AM', ${caixa(-59.8, -3.0, 0.2)}, ${a});
      INSERT INTO ibge.bairro VALUES
        ('1302603005001', 'Centro', 1302603, ${caixa(-60.03, -3.14)}, ${a}),
        ('1302603005002', 'Praça 14 de Janeiro', 1302603, ${caixa(-60.02, -3.13)}, ${a}),
        ('1302603005003', 'Jorge Teixeira', 1302603, ${caixa(-59.95, -3.05)}, ${a});
      INSERT INTO osm.poligono (id, tags, geom, snapshot, arquivo) VALUES
        ('r1', '{"name": "Manaus", "boundary": "administrative", "admin_level": "8"}', ${caixa(-60.1, -3.2, 0.21)}, '2026-10-20', ${a}),
        ('r2', '{"name": "Centro", "boundary": "administrative", "admin_level": "10"}', ${caixa(-60.0302, -3.1401)}, '2026-10-20', ${a}),
        ('r3', '{"name": "Praça 14", "boundary": "administrative", "admin_level": "10"}', ${caixa(-60.0201, -3.1301, 0.009)}, '2026-10-20', ${a}),
        ('r4', '{"name": "Monte das Oliveiras", "boundary": "administrative", "admin_level": "10"}', ${caixa(-60.08, -3.05)}, '2026-10-20', ${a}),
        ('w5', '{"building": "yes"}', ${caixa(-60.03, -3.14, 0.001)}, '2026-10-20', ${a})`);
  });
  afterAll(() => db.end());

  const contagens = async () =>
    (
      await db.query(
        'SELECT (SELECT count(*) FROM ibge.bairro) b, (SELECT count(*) FROM osm.poligono) o, (SELECT count(*) FROM ibge.municipio) m',
      )
    ).rows[0];

  test('municipalities: one entity per IBGE code, OSM joined by name and overlap', async () => {
    await fundirMunicipios(db);
    const r =
      await db.query(`SELECT e.chave, v.fonte, v.registro_id, v.metodo FROM entidade.entidade e JOIN entidade.vinculo v ON v.entidade_id = e.id
      WHERE e.tipo = 'municipio' ORDER BY 1, 2`);
    expect(r.rows).toEqual([
      { chave: '1302603', fonte: 'ibge', registro_id: '1302603', metodo: 'ancora' },
      { chave: '1302603', fonte: 'osm', registro_id: 'r1', metodo: 'nome' },
      { chave: '1303569', fonte: 'ibge', registro_id: '1303569', metodo: 'ancora' },
    ]);
    const nome = await db.query(`SELECT valor, fonte, regra FROM entidade.valor_escolhido c JOIN entidade.entidade e ON e.id = c.entidade_id
      WHERE e.chave = '1302603' AND c.campo = 'nome'`);
    expect(nome.rows).toEqual([{ valor: 'Manaus', fonte: 'ibge', regra: ['ibge', 'osm'] }]);
  });

  test('bairros: every record in some entity, same ids on a second run, layer 2 untouched', async () => {
    const antes = await contagens();
    await fundirBairros(db);
    const ids = (await db.query(`SELECT chave, id FROM entidade.entidade WHERE tipo = 'bairro' ORDER BY chave`)).rows;
    expect(ids.map((x) => x.chave)).toEqual(['centro', 'jorge teixeira', 'monte das oliveiras', 'praca 14 de janeiro']);
    const vinculos = (
      await db.query(`SELECT fonte, registro_id, metodo FROM entidade.vinculo WHERE tabela IN ('ibge.bairro', 'osm.poligono')
      AND fonte || registro_id <> 'osmr1' ORDER BY 1, 2`)
    ).rows;
    expect(vinculos).toEqual([
      { fonte: 'ibge', registro_id: '1302603005001', metodo: 'ancora' },
      { fonte: 'ibge', registro_id: '1302603005002', metodo: 'ancora' },
      { fonte: 'ibge', registro_id: '1302603005003', metodo: 'ancora' },
      { fonte: 'osm', registro_id: 'r2', metodo: 'nome' },
      { fonte: 'osm', registro_id: 'r3', metodo: 'iou' },
      { fonte: 'osm', registro_id: 'r4', metodo: 'unico' },
    ]);
    await fundirBairros(db);
    expect((await db.query(`SELECT chave, id FROM entidade.entidade WHERE tipo = 'bairro' ORDER BY chave`)).rows).toEqual(ids);
    expect(await contagens()).toEqual(antes);
  });

  test('divergence report: different names, areas off by more than 10%, single-source bairros', async () => {
    const md = await divergencias(db);
    expect(md).toContain('| praca 14 de janeiro | Praça 14 de Janeiro (ibge) / Praça 14 (osm) |');
    expect(md).toMatch(/\| praca 14 de janeiro \| ibge [\d,.]+ km² \/ osm [\d,.]+ km² \| 1[89] % \|/);
    expect(md).toContain('| jorge teixeira | ibge |');
    expect(md).toContain('| monte das oliveiras | osm |');
    expect(md).toContain('| ibge | 3 |');
  });
});
