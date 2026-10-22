// API v0 (#34): "Manaus as an API", private for now (container on the slice, through the ssh tunnel). Every answer says
// where its numbers come from: for entities, what each source says (por_fonte) and which value won and by what rule.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import type pg from 'pg';
import { consultarCep as consultarCepReal } from '../coleta/brasilapi.ts';
import { MAPBIOMAS, mapbiomasChave, r2Raster, RELEVO, valorNoPonto } from '../coleta/lib/raster.ts';
import { RMM_BBOX as B } from '../coleta/regiao.ts';
import { lerCatalogo } from '../fontes/catalogo.ts';

type Db = Pick<pg.ClientBase, 'query'>;
export type Dependencias = {
  db: Db;
  // Rasters on R2 (gdallocationinfo) and BrasilAPI (network): injected so the tests run without them.
  altitude?: (lon: number, lat: number) => Promise<{ anadem_m: number | null; copernicus_m: number | null }>;
  cobertura?: (lon: number, lat: number) => Promise<{ ano: number; codigo: number | null }>;
  consultarCep?: typeof consultarCepReal;
};

// shortcut: gdallocationinfo runs synchronously (~1 s per raster read from R2) and blocks the server meanwhile; fine for a
// private v0 with one user, move to an async spawn or a worker before the public API (M6).
const arredondar = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const altitudeReal = async (lon: number, lat: number) => ({
  anadem_m: arredondar(valorNoPonto(r2Raster(RELEVO.anadem), lon, lat, RELEVO.nodata)),
  copernicus_m: arredondar(valorNoPonto(r2Raster(RELEVO.copernicus), lon, lat, RELEVO.nodata)),
});
const coberturaReal = async (lon: number, lat: number) => ({
  ano: MAPBIOMAS.ultimo,
  codigo: valorNoPonto(r2Raster(mapbiomasChave(MAPBIOMAS.ultimo)), lon, lat, 0),
});

const FONTES = join(import.meta.dirname, '..', 'fontes');

/** An entity as GeoJSON: geometry = chosen; properties.escolhido per field (value, source, rule) and por_fonte. */
async function entidade(db: Db, tipo: string, where: string, param: string | number) {
  const e = (await db.query(`SELECT id, chave FROM entidade.entidade WHERE tipo = $1 AND ${where} = $2`, [tipo, param])).rows[0];
  if (!e) return null;
  const escolhidos = (
    await db.query(
      `SELECT campo, valor, ST_AsGeoJSON(geom, 6)::json AS geom, fonte, regra, data_fonte::text FROM entidade.valor_escolhido WHERE entidade_id = $1`,
      [e.id],
    )
  ).rows;
  const valores = (
    await db.query(
      `SELECT fonte, campo, valor, ST_AsGeoJSON(geom, 6)::json AS geom, data_fonte::text, registro_id FROM entidade.valor
       WHERE entidade_id = $1 ORDER BY fonte, campo`,
      [e.id],
    )
  ).rows;
  const escolhido: Record<string, unknown> = {};
  let geometry = null;
  for (const c of escolhidos) {
    if (c.campo === 'geom') geometry = c.geom;
    escolhido[c.campo] = { valor: c.campo === 'geom' ? undefined : c.valor, fonte: c.fonte, regra: c.regra, data_fonte: c.data_fonte };
    if (c.campo === 'geom') delete (escolhido.geom as any).valor;
  }
  const por_fonte: Record<string, Record<string, unknown>> = {};
  for (const v of valores) {
    const f = (por_fonte[v.fonte] ??= { data_fonte: v.data_fonte, registro_id: v.registro_id });
    f[v.campo] = v.campo === 'geom' ? v.geom : v.valor;
  }
  return { type: 'Feature', id: Number(e.id), geometry, properties: { id: Number(e.id), chave: e.chave, tipo, escolhido, por_fonte } };
}

export function criarApp(deps: Dependencias): FastifyInstance {
  const { db, altitude = altitudeReal, cobertura = coberturaReal, consultarCep = consultarCepReal } = deps;
  const app = Fastify({ logger: false });

  app.get('/fontes', async () => lerCatalogo(FONTES).map((c) => c.card));
  app.get<{ Params: { id: string } }>('/fontes/:id', async (req, rep) => {
    const c = lerCatalogo(FONTES).find((x) => x.card.id === req.params.id);
    if (!c) return rep.code(404).send({ erro: 'fonte não encontrada' });
    const texto = readFileSync(join(FONTES, c.arquivo), 'utf8')
      .replace(/^---\n[\s\S]*?\n---\n/, '')
      .trim();
    return { ...c.card, texto };
  });

  app.get<{ Params: { codigo: string } }>('/municipios/:codigo', async (req, rep) => {
    if (!/^\d{7}$/.test(req.params.codigo)) return rep.code(400).send({ erro: 'código IBGE tem 7 dígitos' });
    return (await entidade(db, 'municipio', 'chave', req.params.codigo)) ?? rep.code(404).send({ erro: 'município não encontrado' });
  });

  app.get('/bairros', async () => {
    const r = await db.query(
      `SELECT e.id::int, e.chave, (SELECT c.valor #>> '{}' FROM entidade.valor_escolhido c WHERE c.entidade_id = e.id AND c.campo = 'nome') AS nome,
              (SELECT array_agg(DISTINCT v.fonte ORDER BY v.fonte) FROM entidade.vinculo v WHERE v.entidade_id = e.id) AS fontes
       FROM entidade.entidade e WHERE e.tipo = 'bairro' ORDER BY e.chave`,
    );
    return r.rows;
  });
  app.get<{ Params: { id: string } }>('/bairros/:id', async (req, rep) => {
    if (!/^\d+$/.test(req.params.id)) return rep.code(400).send({ erro: 'id é um número' });
    return (await entidade(db, 'bairro', 'id', Number(req.params.id))) ?? rep.code(404).send({ erro: 'bairro não encontrado' });
  });

  app.get<{ Querystring: { lat?: string; lon?: string } }>('/onde', async (req, rep) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!req.query.lat || !req.query.lon || !Number.isFinite(lat) || !Number.isFinite(lon))
      return rep.code(400).send({ erro: 'use /onde?lat=<graus>&lon=<graus>' });
    if (lat < B.sul || lat > B.norte || lon < B.oeste || lon > B.leste)
      return rep.code(400).send({ erro: `fora da área (região metropolitana de Manaus: ${B.sul}..${B.norte}, ${B.oeste}..${B.leste})` });
    const p = 'ST_SetSRID(ST_Point($1, $2), 4326)';
    const um = async (sql: string) => (await db.query(sql, [lon, lat])).rows[0] ?? null;
    const muitos = async (sql: string) => (await db.query(sql, [lon, lat])).rows;

    const municipio = await um(
      `SELECT e.id::int, e.chave::int AS codigo, n.valor #>> '{}' AS nome FROM entidade.valor_escolhido g
       JOIN entidade.entidade e ON e.id = g.entidade_id JOIN entidade.valor_escolhido n ON n.entidade_id = e.id AND n.campo = 'nome'
       WHERE e.tipo = 'municipio' AND g.campo = 'geom' AND ST_Intersects(g.geom, ${p}) LIMIT 1`,
    );
    const b = await um(
      `SELECT e.id::int, e.chave, n.valor #>> '{}' AS nome, n.fonte, n.regra FROM entidade.valor_escolhido g
       JOIN entidade.entidade e ON e.id = g.entidade_id JOIN entidade.valor_escolhido n ON n.entidade_id = e.id AND n.campo = 'nome'
       WHERE e.tipo = 'bairro' AND g.campo = 'geom' AND ST_Intersects(g.geom, ${p}) LIMIT 1`,
    );
    // Per source: every source polygon of a bairro that has the point (sources can disagree on where the point is).
    const porFonte = await muitos(
      `SELECT v.fonte, n.valor #>> '{}' AS nome, v.registro_id, e.id::int AS entidade FROM entidade.valor v
       JOIN entidade.entidade e ON e.id = v.entidade_id
       JOIN entidade.valor n ON n.entidade_id = v.entidade_id AND n.fonte = v.fonte AND n.registro_id = v.registro_id AND n.campo = 'nome'
       WHERE e.tipo = 'bairro' AND v.campo = 'geom' AND ST_Intersects(v.geom, ${p}) ORDER BY v.fonte`,
    );
    const setor = await um(
      `SELECT s.codigo, s.situacao, a.valor::int AS populacao FROM ibge.setor s
       LEFT JOIN ibge.setor_agregado a ON a.setor = s.codigo AND a.tabela = 'basico' AND a.variavel = 'v0001'
       WHERE ST_Intersects(s.geom, ${p}) LIMIT 1`,
    );
    const tis = await muitos(`SELECT codigo, nome, fase FROM funai.terra_indigena WHERE ST_Intersects(geom, ${p}) ORDER BY nome`);
    const ucs = await muitos(`SELECT cd_cnuc, nome, esfera, orgao_gestor FROM cnuc.unidade WHERE ST_Intersects(geom, ${p}) ORDER BY nome`);
    // A raster that cannot be read (R2 down, file missing) leaves only its own field out.
    const [alt, cob] = await Promise.all([altitude(lon, lat).catch(() => null), cobertura(lon, lat).catch(() => null)]);
    const classe =
      cob?.codigo == null
        ? null
        : ((await db.query('SELECT nome FROM mapbiomas.classe WHERE codigo = $1', [cob.codigo])).rows[0]?.nome ?? null);

    return {
      ponto: { lat, lon },
      municipio,
      bairro: b && { id: b.id, chave: b.chave, escolhido: { nome: b.nome, fonte: b.fonte, regra: b.regra }, por_fonte: porFonte },
      setor,
      altitude: alt
        ? {
            ...alt,
            nota: 'modelos de 30 m: ANADEM = terreno (sem árvores nem prédios); Copernicus GLO-30 = superfície',
            fontes: ['anadem', 'copernicus-dem'],
          }
        : { erro: 'indisponível agora', fontes: ['anadem', 'copernicus-dem'] },
      cobertura: !cob
        ? { erro: 'indisponível agora', fonte: 'mapbiomas-cobertura' }
        : cob.codigo === null
          ? null
          : { ano: cob.ano, codigo: cob.codigo, classe, fonte: 'mapbiomas-cobertura' },
      areas_protegidas: { terras_indigenas: tis, unidades: ucs },
    };
  });

  app.get<{ Params: { cep: string } }>('/cep/:cep', async (req, rep) => {
    const cep = req.params.cep.replace(/\D/g, '');
    if (cep.length !== 8) return rep.code(400).send({ erro: 'CEP tem 8 dígitos' });
    const c = (
      await db.query(
        `SELECT count(DISTINCT id)::int AS enderecos,
                (array_agg(logradouro ORDER BY n DESC))[1:5] AS logradouros, (array_agg(DISTINCT localidade))[1:3] AS localidades,
                array_agg(DISTINCT setor) AS setores, ST_Y(ST_Centroid(ST_Collect(geom))) AS lat, ST_X(ST_Centroid(ST_Collect(geom))) AS lon
         FROM (SELECT *, count(*) OVER (PARTITION BY logradouro) AS n FROM ibge.cnefe_endereco WHERE cep = $1) x`,
        [cep],
      )
    ).rows[0];
    const cnefe =
      c.enderecos === 0
        ? null
        : {
            enderecos: c.enderecos,
            logradouros: [...new Set(c.logradouros as string[])],
            localidades: c.localidades,
            setores: c.setores,
            centro: { lat: c.lat, lon: c.lon },
            fonte: 'ibge-cnefe',
          };
    return { cep, cnefe, brasilapi: await consultarCep(db as pg.ClientBase, cep) };
  });

  app.get<{ Params: { dia: string } }>('/fumaca/:dia', async (req, rep) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.dia)) return rep.code(400).send({ erro: 'dia no formato AAAA-MM-DD (dia de Manaus)' });
    const r = await db.query(`SELECT *, dia::text FROM analise.fumaca_dia WHERE dia = $1 ORDER BY versao DESC LIMIT 1`, [req.params.dia]);
    return r.rows[0] ?? rep.code(404).send({ erro: 'sem atribuição para esse dia' });
  });

  return app;
}
