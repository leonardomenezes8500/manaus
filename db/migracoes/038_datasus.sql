-- Hospitalisations and deaths (#88), DATASUS SIH and SIM, residents of Manaus only and only daily totals (no microdata:
-- that stays in the raw .dbc files and is redone by coleta/datasus.ts). MEASURED (administrative records).
-- grupo: respiratorio (CID J00-J99), circulatorio (I00-I99), outro. faixa: 0-4, 5-9, 10-14, 15-59, 60+ (the bands of
-- #63 split at 10), ignorada. sexo: M, F, ignorado.
CREATE SCHEMA datasus;

-- SIH by date of admission (DT_INTER), principal diagnosis. The SIH comes by processing month: an August admission can
-- arrive in the September or October file, so analyses only use months with 6 processing months after them (sih_lido).
CREATE TABLE datasus.internacao_dia (
  dia         date NOT NULL,
  grupo       text NOT NULL,
  faixa       text NOT NULL,
  sexo        text NOT NULL,
  internacoes integer NOT NULL,
  mortes      integer NOT NULL,        -- died in hospital (MORTE)
  PRIMARY KEY (dia, grupo, faixa, sexo)
);

-- SIM by date of death (DTOBITO), underlying cause (CAUSABAS). Years after the last final one come from SIM/PRELIM.
CREATE TABLE datasus.obito_dia (
  dia    date NOT NULL,
  grupo  text NOT NULL,
  faixa  text NOT NULL,
  sexo   text NOT NULL,
  obitos integer NOT NULL,
  PRIMARY KEY (dia, grupo, faixa, sexo)
);

-- The raw files behind the two tables (the newest version of each month or year).
CREATE TABLE datasus.lido (
  fonte  text NOT NULL,                -- datasus-sih or datasus-sim
  periodo text NOT NULL,               -- SIH: processing month AAAA-MM; SIM: year AAAA (preliminar when from SIM/PRELIM)
  chave  text NOT NULL,                -- raw key in R2
  PRIMARY KEY (fonte, periodo)
);
