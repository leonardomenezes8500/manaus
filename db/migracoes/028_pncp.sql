-- PNCP (#66): procurements of the public bodies located in Manaus, all spheres, as published (Lei 14.133 onwards;
-- the PNCP has no Lei 8.666 code). OFFICIAL RECORD. setor and emergencia come from the written rules in coleta/pncp.ts.
CREATE SCHEMA pncp;
CREATE TABLE pncp.contratacao (
  numero_controle  text PRIMARY KEY,         -- numeroControlePNCP
  publicado_em     timestamptz NOT NULL,     -- dataPublicacaoPncp
  atualizado_em    timestamptz,
  ano_compra       integer NOT NULL,
  modalidade       integer NOT NULL,         -- 8 dispensa, 9 inexigibilidade, 6 pregão eletrônico...
  amparo           integer,                  -- amparo legal; 38 = Lei 14.133, art. 75, VIII (emergência)
  amparo_nome      text,
  situacao         text NOT NULL,            -- 'Divulgada no PNCP', 'Anulada', 'Revogada', 'Suspensa'
  objeto           text NOT NULL,
  valor_estimado   numeric,
  valor_homologado numeric,                  -- often null or 0: count records rather than sum values
  orgao_cnpj       text NOT NULL,
  orgao            text NOT NULL,            -- razaoSocial (nomeUnidade comes with broken accents)
  esfera           text NOT NULL,            -- F federal, E estadual, M municipal, N
  unidade          text NOT NULL,
  municipio_ibge   integer NOT NULL,
  setor            text NOT NULL CHECK (setor IN ('saude', 'ambiente', 'outro')),
  emergencia       boolean NOT NULL,
  arquivo          bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON pncp.contratacao (publicado_em);
