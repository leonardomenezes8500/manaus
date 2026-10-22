-- Census tracts 2022 (#21), layer 2: IBGE tract mesh and the per-tract aggregates, long format.
CREATE TABLE ibge.setor (
  codigo       char(15) PRIMARY KEY,         -- CD_SETOR
  municipio    integer NOT NULL,             -- CD_MUN
  situacao     text,                         -- Urbana | Rural (empty in a few tracts of the mesh)
  tipo         char(1) NOT NULL,             -- CD_TIPO (0 = não especial; see the IBGE dictionary)
  area_km2     real,
  bairro       text,                         -- CD_BAIRRO (IBGE 2022 neighbourhood, may be empty)
  bairro_nome  text,
  geom         geometry(MultiPolygon, 4326) NOT NULL, -- from SIRGAS 2000 (EPSG:4674)
  arquivo      bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON ibge.setor (municipio);
CREATE INDEX ON ibge.setor USING gist (geom);

-- What each aggregate variable means (IBGE dictionary, 2026-05-20 edition).
CREATE TABLE ibge.variavel (
  tabela    text NOT NULL,                   -- basico, demografia...
  variavel  text NOT NULL,                   -- v0001...
  descricao text NOT NULL,
  PRIMARY KEY (tabela, variavel)
);
INSERT INTO ibge.variavel VALUES
  ('basico', 'v0001', 'Total de pessoas'),
  ('basico', 'v0002', 'Total de domicílios (DPPO + DPPV + DPPUO + DPIO + DCCM + DCSM)'),
  ('basico', 'v0003', 'Total de domicílios particulares (DPPO + DPPV + DPPUO + DPIO)'),
  ('basico', 'v0004', 'Total de domicílios coletivos (DCCM + DCSM)'),
  ('basico', 'v0005', 'Média de moradores em domicílios particulares ocupados'),
  ('basico', 'v0006', 'Percentual de domicílios particulares ocupados imputados'),
  ('basico', 'v0007', 'Total de domicílios particulares ocupados (DPPO + DPIO)'),
  ('basico', 'v0008', 'Total de domicílios particulares de uso ocasional (DPPUO)'),
  ('basico', 'v0009', 'Total de domicílios particulares permanentes vagos (DPPV)');

-- One value per tract, table and variable. Values the IBGE suppresses ("X") or leaves out (".") are not stored.
CREATE TABLE ibge.setor_agregado (
  setor    char(15) NOT NULL,
  tabela   text NOT NULL,
  variavel text NOT NULL,
  valor    double precision NOT NULL,
  arquivo  bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (setor, tabela, variavel),
  FOREIGN KEY (tabela, variavel) REFERENCES ibge.variavel
);
