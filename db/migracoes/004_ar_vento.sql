-- Air and wind (#16), layer 2: one table per source.
CREATE SCHEMA openaq;

-- One hourly mean per sensor (AirGradient, location 5040030).
CREATE TABLE openaq.medicao (
  sensor    integer NOT NULL,
  parametro text NOT NULL,              -- pm25, pm1, temperature...
  inicio    timestamptz NOT NULL,       -- period.datetimeFrom (UTC)
  fim       timestamptz NOT NULL,       -- period.datetimeTo
  valor     real NOT NULL,
  unidade   text NOT NULL,
  arquivo   bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (sensor, inicio)
);

CREATE SCHEMA metar;

-- METAR/SPECI from aviationweather.gov (recent) and the IEM archive (history): the same DECEA report, deduplicated by text.
CREATE TABLE metar.observacao (
  estacao        char(4) NOT NULL,
  observado_em   timestamptz NOT NULL,
  texto          text NOT NULL,         -- original report, without the METAR/SPECI prefix and the trailing '='
  vento_dir      smallint,              -- degrees, where the wind blows FROM; null = VRB or calm
  vento_kt       smallint,
  rajada_kt      smallint,
  visibilidade_m integer,               -- 9999 and CAVOK = 10000 (10 km or more)
  tempo          text[] NOT NULL DEFAULT '{}', -- present weather groups: FU (smoke), HZ (haze), -RA...
  temperatura    real,
  orvalho        real,
  arquivo        bigint NOT NULL REFERENCES bruto.arquivo,
  UNIQUE (estacao, observado_em, texto)
);
CREATE INDEX ON metar.observacao (observado_em);

CREATE SCHEMA openmeteo;

-- Open-Meteo forecast model at the Manaus point (MODEL). rodada_em = when we downloaded it (newest wins in the analysis).
CREATE TABLE openmeteo.tempo_hora (
  rodada_em             timestamptz NOT NULL,
  valido_em             timestamptz NOT NULL,
  wind_speed_10m        real, wind_direction_10m    real,
  wind_speed_925hpa     real, wind_direction_925hpa real,
  wind_speed_850hpa     real, wind_direction_850hpa real,
  wind_speed_700hpa     real, wind_direction_700hpa real,
  boundary_layer_height real,
  relative_humidity_2m  real,
  precipitation         real,
  arquivo               bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (valido_em, rodada_em)
);

-- CAMS air quality through Open-Meteo (MODEL, never a measurement).
CREATE TABLE openmeteo.ar_hora (
  rodada_em             timestamptz NOT NULL,
  valido_em             timestamptz NOT NULL,
  pm2_5                 real,
  pm10                  real,
  aerosol_optical_depth real,
  carbon_monoxide       real,
  arquivo               bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (valido_em, rodada_em)
);
