-- Schools of Manaus from the INEP Censo Escolar (#111), one row per school, the newest year loaded. REGISTRO (census
-- declared by the schools). The INEP file has no coordinates: the point comes from the CNEFE (#22), see ponto_origem.
-- Phone and other contact columns of the file are not kept.
CREATE SCHEMA inep;
CREATE TABLE inep.escola (
  codigo             integer PRIMARY KEY,   -- CO_ENTIDADE
  ano                smallint NOT NULL,     -- NU_ANO_CENSO
  nome               text NOT NULL,
  rede               text NOT NULL CHECK (rede IN ('federal', 'estadual', 'municipal', 'privada')),
  situacao           text NOT NULL,         -- em atividade, paralisada, extinta, extinta no ano anterior
  localizacao        text NOT NULL,         -- urbana, rural
  endereco           text,
  numero             text,                  -- as declared: "S/N", "KM 21"...
  bairro             text,
  cep                char(8),
  salas              integer,               -- QT_SALAS_UTILIZADAS
  salas_climatizadas integer,               -- QT_SALAS_UTILIZA_CLIMATIZADAS
  mat_total          integer,               -- QT_MAT_BAS, basic education enrolments
  mat_creche         integer,
  mat_pre            integer,
  mat_fund_ai        integer,
  mat_fund_af        integer,
  mat_medio          integer,
  mat_0_3            integer,               -- enrolments by age (QT_MAT_BAS_0_3 ... _18_MAIS)
  mat_4_5            integer,
  mat_6_10           integer,
  mat_11_14          integer,
  mat_15_17          integer,
  mat_18_mais        integer,
  -- cep-numero: the one CNEFE school at the same CEP and number; cep-nome: the one at the same CEP with a similar name
  -- (the words of one name all in the other); nome-cidade: the one in the city with a similar name, within 2 km of the
  -- declared CEP when it is known; centro-cep: centre of the CNEFE addresses of the CEP, when they fit in 1 km.
  -- NULL: no point. See casador() in coleta/carga/inep.ts.
  ponto_origem       text CHECK (ponto_origem IN ('cep-numero', 'cep-nome', 'nome-cidade', 'centro-cep')),
  cnefe_id           bigint,
  geom               geometry(Point, 4326),
  arquivo            bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON inep.escola USING gist (geom);
COMMENT ON TABLE inep.escola IS 'registro (INEP Censo Escolar); ponto casado com o CNEFE, ver ponto_origem';
