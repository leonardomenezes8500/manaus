-- Public forests (#75), layer 2: the Cadastro Nacional de Florestas Públicas of the SFB (2025 edition), polygons that
-- touch the smoke region box. Tipo A = with a destination (TI, UC, settlement, military), tipo B = without one
-- (arrecadated glebas). A polygon is cut where designations overlap, so "TI / RESEX" is one piece of both.
-- Overlap with funai.terra_indigena and cnuc.unidade is a fusion case (see 013); here the two stay apart.
CREATE SCHEMA sfb;
CREATE TABLE sfb.floresta_publica (
  id           serial PRIMARY KEY,
  nome         text,
  categoria    text,                  -- TI, PARNA, GLEBA ARRECADADA, PA / APA ...
  protecao     text,                  -- e.g. SEM DESTINACAO, PROTECAO INTEGRAL, USO SUSTENTAVEL
  tipo         char(1) NOT NULL,      -- A (destinada) or B (não destinada)
  governo      text,                  -- FEDERAL, ESTADUAL, MUNICIPAL
  classe       text,
  orgao        text,
  sobreposicao boolean,               -- sobreposic (SIM/NÃO)
  ano_criacao  smallint,              -- year taken from anocriacao, which comes as 1991-10-29, 24-04-2008...; null when empty
  estagio      text,
  uf           text,
  municipio    text,
  area_ha      double precision,
  geom         geometry(MultiPolygon, 4326) NOT NULL,
  arquivo      bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON sfb.floresta_publica USING gist (geom);
CREATE INDEX ON sfb.floresta_publica (uf, tipo);
