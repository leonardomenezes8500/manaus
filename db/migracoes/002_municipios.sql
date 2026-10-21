-- Base mínima (#8): municípios do IBGE (camada 2) e região de influência da fumaça (análise).
CREATE SCHEMA ibge;

CREATE TABLE ibge.municipio (
  codigo  integer PRIMARY KEY,           -- código IBGE de 7 dígitos
  nome    text NOT NULL,
  uf      char(2) NOT NULL,
  geom    geometry(MultiPolygon, 4326) NOT NULL,
  arquivo bigint NOT NULL REFERENCES bruto.arquivo -- malha de onde veio a geometria
);
CREATE INDEX ON ibge.municipio USING gist (geom);

CREATE SCHEMA analise;

CREATE TABLE analise.regiao (
  nome text PRIMARY KEY,
  geom geometry(Polygon, 4326) NOT NULL,
  nota text
);
-- Igual a BBOX em coleta/regiao.ts.
INSERT INTO analise.regiao VALUES
  ('influencia_fumaca', ST_MakeEnvelope(-74, -15, -52, 3, 4326), 'primeiro chute (#8): AM, RO, AC, norte da Bolívia, oeste do PA, sul de RR');
