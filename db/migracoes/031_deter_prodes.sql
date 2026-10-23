-- INPE deforestation (#74), layer 2, for the smoke region (coleta/regiao.ts BBOX).
-- DETER: alerts from the TerraBrasilis WFS (deter-amz:deter_amz). The gid is not unique (the layer joins tables with
-- their own numbering, e.g. two 100006_hist of 2018 and 2023), and an alert gets a new gid when it moves from _curr to
-- _hist. So there is no upsert: each run replaces every alert of its image-date window (coleta/deter.ts). MEASURED (satellite).
CREATE SCHEMA inpe_desmatamento;
CREATE TABLE inpe_desmatamento.deter (
  id            bigserial PRIMARY KEY,
  gid           text NOT NULL,
  classe        text NOT NULL,         -- classname: DESMATAMENTO_CR (corte raso), DEGRADACAO, CICATRIZ_DE_QUEIMADA, MINERACAO...
  view_date     date NOT NULL,         -- date of the image
  publish_month date,
  sensor        text,
  satelite      text,
  uf            text,
  mun_geocod    integer,
  area_km2      double precision,      -- areamunkm: area of the polygon inside the municipality
  uc            text,
  geom          geometry(MultiPolygon, 4326) NOT NULL,
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON inpe_desmatamento.deter USING gist (geom);
CREATE INDEX ON inpe_desmatamento.deter (view_date);

-- PRODES: the yearly map stays out of PostGIS, as a COG in normalizado/inpe-prodes/ on R2 (coleta/prodes.ts); the point
-- query reads it with valorNoPonto(). Here only the legend of the 2025 edition (.qml of the zip): d2000 is everything up
-- to 2000 and d2002, d2004 and d2006 cover two years each (there is no 1, 3 or 5).
CREATE TABLE inpe_desmatamento.prodes_classe (
  codigo smallint PRIMARY KEY,
  nome   text NOT NULL,
  ano    smallint                      -- year of the deforestation (or of the residue), null for the other classes
);
INSERT INTO inpe_desmatamento.prodes_classe
SELECT c, 'desmatamento ' || (2000 + c), 2000 + c FROM generate_series(0, 25) c WHERE c NOT IN (1, 3, 5)
UNION ALL SELECT c, 'resíduo ' || (1960 + c), 1960 + c FROM generate_series(50, 65) c
UNION ALL VALUES (91, 'hidrografia', NULL::int), (100, 'vegetação nativa florestal', NULL), (101, 'vegetação nativa não florestal', NULL);
