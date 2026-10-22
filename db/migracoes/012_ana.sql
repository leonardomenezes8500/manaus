-- ANA (#29), layer 2: water level of the Rio Negro at Manaus (station 14990000) and hydrography of the metropolitan region.
CREATE SCHEMA ana;

-- Daily level from the historical series (HidroSerieHistorica, 1902–2014): one row per day and consistency level.
CREATE TABLE ana.cota_diaria (
  estacao    integer NOT NULL,
  dia        date NOT NULL,
  consistido boolean NOT NULL,            -- NivelConsistencia 2 (consolidated) or 1 (raw)
  cota_cm    real NOT NULL,               -- some months have half centimetres
  status     smallint,                    -- ANA: 0 blank, 1 real, 2 estimated, 3 doubtful, 4 dry gauge
  arquivo    bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (estacao, dia, consistido)
);

-- Telemetry (DadosHidrometeorologicos): a reading every 15 minutes, raw (not consolidated), since 2005 (full from 2015).
CREATE TABLE ana.leitura (
  estacao  integer NOT NULL,
  hora     timestamptz NOT NULL,
  nivel_cm real,
  chuva_mm real,
  arquivo  bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (estacao, hora)
);

-- One level per day: consolidated series > raw series > mean of the telemetry readings of the Manaus day.
CREATE VIEW ana.cota_dia AS
SELECT DISTINCT ON (estacao, dia) estacao, dia, cota_cm, fonte, consistido
FROM (
  SELECT estacao, dia, cota_cm, 'serie_historica' AS fonte, consistido, CASE WHEN consistido THEN 1 ELSE 2 END AS ordem
  FROM ana.cota_diaria
  UNION ALL
  SELECT estacao, (hora AT TIME ZONE 'America/Manaus')::date, round(avg(nivel_cm)::numeric, 1)::real, 'telemetria', false, 3
  FROM ana.leitura WHERE nivel_cm IS NOT NULL GROUP BY 1, 2
) x
ORDER BY estacao, dia, ordem;

-- Hydrography (BHO 2017 5k and the water bodies of the ANA), cut to the metropolitan region box.
CREATE TABLE ana.trecho (
  id             integer PRIMARY KEY,     -- cotrecho
  nome           text,
  cobacia        text,                    -- Otto basin code
  strahler       smallint,
  dominialidade  text,                    -- Federal | Estadual
  comprimento_km double precision,
  geom           geometry(MultiLineString, 4326) NOT NULL,
  arquivo        bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON ana.trecho USING gist (geom);

CREATE TABLE ana.massa_dagua (
  id            integer PRIMARY KEY,      -- FID of the ANA service
  nome          text,
  tipo          text,                     -- Natural | Artificial
  dominialidade text,
  area_km2      double precision,         -- whole water body, before the cut
  geom          geometry(MultiPolygon, 4326) NOT NULL,
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON ana.massa_dagua USING gist (geom);
