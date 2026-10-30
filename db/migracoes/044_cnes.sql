-- Health establishments of Manaus from the CNES (#112), one row per establishment of the newest ST file loaded (the
-- whole table is replaced each month). REGISTRO (declared by the establishments to the Ministry of Health).
-- Type and management from the monthly ST file (.dbc); name and point from the CNES API, joined by code.
-- Phone, e-mail and CNPJ are not kept.
CREATE SCHEMA cnes;
CREATE TABLE cnes.estabelecimento (
  codigo        integer PRIMARY KEY,   -- CNES
  competencia   char(7) NOT NULL,      -- month of the ST file, AAAA-MM
  nome          text,                  -- nome_fantasia of the API; NULL when the API does not have the code
  -- TP_UNID: 01 posto de saúde, 02 centro de saúde/unidade básica (UBS), 04 policlínica, 05 hospital geral,
  -- 07 hospital especializado, 22 consultório isolado, 36 clínica especializada, 73 pronto atendimento (table in the TabNet)
  tipo          char(2) NOT NULL,
  gestao        text NOT NULL CHECK (gestao IN ('municipal', 'estadual', 'dupla')),  -- TPGESTAO
  publico       boolean NOT NULL,      -- legal nature (NAT_JUR) 1xxx: public administration
  nat_jur       text NOT NULL,
  cep           char(8),
  -- coordinates declared to the CNES (API); NULL when missing, zero or outside the Manaus municipality
  geom          geometry(Point, 4326),
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo,  -- ST file
  arquivo_ponto bigint NOT NULL REFERENCES bruto.arquivo   -- API cut
);
CREATE INDEX ON cnes.estabelecimento USING gist (geom);
COMMENT ON TABLE cnes.estabelecimento IS 'registro (DATASUS CNES); tipo e gestão do arquivo ST, nome e ponto da API';
