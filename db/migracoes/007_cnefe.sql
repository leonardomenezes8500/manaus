-- CNEFE 2022 (#22): Census addresses with coordinates, layer 2. One row per species present at an address
-- (an address with a home and a shop has two rows with the same id), as in the IBGE file.
CREATE TABLE ibge.cnefe_especie (
  codigo    smallint PRIMARY KEY,
  descricao text NOT NULL
);
INSERT INTO ibge.cnefe_especie VALUES
  (1, 'Domicílio particular'), (2, 'Domicílio coletivo'), (3, 'Estabelecimento agropecuário'),
  (4, 'Estabelecimento de ensino'), (5, 'Estabelecimento de saúde'), (6, 'Estabelecimento de outras finalidades'),
  (7, 'Edificação em construção ou reforma'), (8, 'Estabelecimento religioso');

CREATE TABLE ibge.cnefe_endereco (
  id              bigint NOT NULL,           -- COD_UNICO_ENDERECO
  especie         smallint NOT NULL REFERENCES ibge.cnefe_especie,
  setor           char(15) NOT NULL,         -- COD_SETOR without the trailing letter of the file
  municipio       integer NOT NULL,
  quadra          integer,
  face            integer,
  cep             char(8),
  localidade      text,
  logradouro      text,                      -- type + title + name, e.g. "RUA QUARTZO AZUL"
  numero          integer,                   -- 0 = no number (see modificador)
  modificador     text,                      -- SN, KM...
  complemento     text,                      -- complement pairs joined, e.g. "BLOCO 138 APARTAMENTO 104"
  estabelecimento text,                      -- DSC_ESTABELECIMENTO (name, when the IBGE published it)
  tipo_edificacao smallint,                  -- 101 casa, 102 casa de vila/condomínio, 103 apartamento, 104 outros
  nivel_coord     smallint NOT NULL,         -- 1 original, 2 apartments moved apart, 3 estimated, 4 block face, 5 locality, 6 tract
  lat             double precision NOT NULL,
  lon             double precision NOT NULL,
  geom            geometry(Point, 4326) NOT NULL,
  arquivo         bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (id, especie)
);
CREATE INDEX ON ibge.cnefe_endereco (setor);
CREATE INDEX ON ibge.cnefe_endereco (cep);
CREATE INDEX ON ibge.cnefe_endereco USING gist (geom);
