-- ANEEL (#68): DEC/FEC per group of consumers (conjunto) of the AM distributor, OFFICIAL RECORD as sent by the
-- distributor, the group-municipality map, the B1 residential tariff (without taxes and without the tariff flag, so not
-- the bill) and the monthly Manaus total (DERIVED: weighted by consumers; dec_partes = the sum of all parts).
CREATE SCHEMA aneel;
CREATE TABLE aneel.continuidade (
  conjunto      integer NOT NULL,
  conjunto_nome text NOT NULL,
  ano           integer NOT NULL,
  mes           integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  indicador     text NOT NULL,           -- DEC (h), FEC (times), NumCon and the parts (DECIP, DECIND, DECXN...)
  valor         float8 NOT NULL,
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (conjunto, ano, mes, indicador)
);
CREATE TABLE aneel.conjunto_municipio (  -- the map as of the day it was downloaded (it has no year)
  conjunto       integer NOT NULL,
  municipio      integer NOT NULL,
  municipio_nome text NOT NULL,
  arquivo        bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (conjunto, municipio)
);
CREATE TABLE aneel.tarifa_residencial (
  reh     text NOT NULL,                 -- the homologating resolution
  inicio  date NOT NULL,
  fim     date NOT NULL,
  tusd    float8 NOT NULL,               -- R$/MWh
  te      float8 NOT NULL,               -- R$/MWh
  arquivo bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (inicio, fim)
);
CREATE TABLE aneel.dec_manaus_mes (
  mes          date PRIMARY KEY,
  dec          float8 NOT NULL,          -- official DEC (since 2022 only internal causes), hours
  dec_partes   float8 NOT NULL,          -- DERIVED: the sum of every part, hours
  fec          float8 NOT NULL,
  consumidores integer NOT NULL,
  conjuntos    integer NOT NULL          -- groups wholly in Manaus that month
);
