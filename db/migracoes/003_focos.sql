-- Fire spots (#15), layer 2: one table per source, never mixed. Names follow the issue (Portuguese, like the rest of the schema).
CREATE SCHEMA firms;

CREATE TABLE firms.foco (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  satelite     text NOT NULL,             -- N (Suomi NPP), N20, N21, Terra, Aqua
  instrumento  text NOT NULL,             -- VIIRS | MODIS
  adquirido_em timestamptz NOT NULL,      -- acq_date + acq_time (UTC)
  lat          double precision NOT NULL,
  lon          double precision NOT NULL,
  geom         geometry(Point, 4326) NOT NULL,
  frp          real,                      -- fire radiative power (MW)
  confianca    text,                      -- VIIRS: l/n/h; MODIS: 0-100
  dia_noite    char(1),                   -- D | N
  brilho       real,                      -- VIIRS bright_ti4; MODIS brightness (K)
  versao       text,                      -- ex.: 2.0NRT, 6.1NRT
  municipio    integer REFERENCES ibge.municipio, -- ST_Contains; null = outside Brazil
  arquivo      bigint NOT NULL REFERENCES bruto.arquivo,
  UNIQUE (satelite, adquirido_em, lat, lon)
);
CREATE INDEX ON firms.foco (adquirido_em);
CREATE INDEX ON firms.foco USING gist (geom);

CREATE SCHEMA inpe;

-- Only spots inside the region box are loaded (the raw file has all of Brazil).
CREATE TABLE inpe.foco (
  id                    uuid PRIMARY KEY,  -- id from the INPE CSV (same spot in daily and monthly files)
  data_hora             timestamptz NOT NULL,
  satelite              text NOT NULL,
  lat                   double precision NOT NULL,
  lon                   double precision NOT NULL,
  geom                  geometry(Point, 4326) NOT NULL,
  municipio_inpe        text,              -- as written by INPE
  estado                text,
  pais                  text,
  municipio_id          integer,           -- IBGE code given by INPE
  numero_dias_sem_chuva real,
  precipitacao          real,
  risco_fogo            real,
  bioma                 text,
  frp                   real,
  municipio             integer REFERENCES ibge.municipio, -- ours, ST_Contains; null = outside Brazil
  arquivo               bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON inpe.foco (data_hora);
CREATE INDEX ON inpe.foco USING gist (geom);
