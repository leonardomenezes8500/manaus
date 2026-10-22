-- BrasilAPI (#33), layer 2: CEP and CNPJ asked on demand (no bulk collection: the rate limit is unknown). Every answer
-- is a raw file (bruto/brasilapi/..._cep_<cep>.json); an answer younger than 30 days is read back from there.
CREATE SCHEMA brasilapi;

CREATE TABLE brasilapi.cep (
  cep        char(8) PRIMARY KEY,
  logradouro text,
  bairro     text,
  cidade     text,
  uf         char(2),
  ibge       integer,                      -- municipality code
  servico    text,                         -- provider behind the answer (open-cep, correios, viacep...)
  lat        double precision,             -- only when the provider has it
  lon        double precision,
  geom       geometry(Point, 4326),
  arquivo    bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON brasilapi.cep USING gist (geom);

CREATE TABLE brasilapi.cnpj (
  cnpj           char(14) PRIMARY KEY,
  razao_social   text NOT NULL,
  nome_fantasia  text,
  situacao       text,                     -- descricao_situacao_cadastral (ATIVA, BAIXADA...)
  cnae           integer,                  -- main activity
  cnae_descricao text,
  municipio_ibge integer,
  uf             char(2),
  cep            char(8),
  logradouro     text,
  numero         text,
  bairro         text,
  dados          jsonb NOT NULL,           -- the whole answer (it has partners and contacts: stays out of the API)
  arquivo        bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON brasilapi.cnpj (cep);
