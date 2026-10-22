-- Layer 3 (#31): entities. This comment is the rule; COMO-TRABALHAR.md only sums it up.
--
-- An entity is one real thing (a municipality, a bairro) that several layer-2 records describe. Layer 2 is never
-- changed by the fusion: entidade.vinculo points at its records, and entidade.valor keeps what each source says,
-- field by field, with the date of the source. Nothing is overwritten and nothing is thrown away: losing values stay.
--
-- Which value counts is an explicit rule per type and field (entidade.prioridade: sources in order). The view
-- entidade.valor_escolhido takes, per entity and field, the first source of the rule that has a value; among values of
-- the same source, the most recent. A field without a rule has no chosen value and shows in entidade.campo_sem_regra.
--
-- chave = natural key of the entity inside its type (IBGE code of a municipality, normalised name of a bairro), so a
-- new fusion run keeps the same entity ids.
CREATE SCHEMA entidade;

CREATE TABLE entidade.entidade (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo      text NOT NULL,                 -- municipio, bairro...
  chave     text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, chave)
);

-- Which layer-2 record belongs to which entity (one entity per record), and how the match was made.
CREATE TABLE entidade.vinculo (
  entidade_id bigint NOT NULL REFERENCES entidade.entidade ON DELETE CASCADE,
  fonte       text NOT NULL,               -- card id in fontes/ (short form: ibge, osm, implurb...)
  tabela      text NOT NULL,               -- e.g. ibge.bairro
  registro_id text NOT NULL,               -- primary key of the record in that table
  metodo      text NOT NULL,               -- codigo, nome, nome+iou, unico (no pair found)...
  confianca   real,                        -- e.g. the IoU of the match
  PRIMARY KEY (fonte, tabela, registro_id)
);
CREATE INDEX ON entidade.vinculo (entidade_id);

-- What each source says, field by field.
CREATE TABLE entidade.valor (
  entidade_id bigint NOT NULL REFERENCES entidade.entidade ON DELETE CASCADE,
  campo       text NOT NULL,
  valor       jsonb,
  geom        geometry(Geometry, 4326),
  fonte       text NOT NULL,
  data_fonte  date,                        -- date of the data (snapshot, census...), not of the load
  registro_id text,
  CHECK (valor IS NOT NULL OR geom IS NOT NULL)
);
CREATE INDEX ON entidade.valor (entidade_id, campo);

-- The rule: for this type and field, the sources in order of priority.
CREATE TABLE entidade.prioridade (
  tipo   text NOT NULL,
  campo  text NOT NULL,
  fontes text[] NOT NULL CHECK (cardinality(fontes) > 0),
  PRIMARY KEY (tipo, campo)
);
INSERT INTO entidade.prioridade VALUES
  ('municipio', 'nome', '{ibge,osm}'),
  ('municipio', 'area_km2', '{ibge,osm}'),
  ('municipio', 'geom', '{ibge,osm}'),
  ('bairro', 'nome', '{implurb,ibge,osm}'),
  ('bairro', 'area_km2', '{implurb,ibge,osm}'),
  ('bairro', 'geom', '{implurb,ibge,osm}');

CREATE VIEW entidade.valor_escolhido AS
SELECT DISTINCT ON (v.entidade_id, v.campo)
       v.entidade_id, e.tipo, v.campo, v.valor, v.geom, v.fonte, v.data_fonte, v.registro_id, p.fontes AS regra
FROM entidade.valor v
JOIN entidade.entidade e ON e.id = v.entidade_id
JOIN entidade.prioridade p ON p.tipo = e.tipo AND p.campo = v.campo
WHERE v.fonte = ANY (p.fontes)
ORDER BY v.entidade_id, v.campo, array_position(p.fontes, v.fonte), v.data_fonte DESC NULLS LAST;

CREATE VIEW entidade.campo_sem_regra AS
SELECT DISTINCT e.tipo, v.campo
FROM entidade.valor v
JOIN entidade.entidade e ON e.id = v.entidade_id
WHERE NOT EXISTS (SELECT 1 FROM entidade.prioridade p WHERE p.tipo = e.tipo AND p.campo = v.campo);
