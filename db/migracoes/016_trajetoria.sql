-- Back-trajectories (#49): the air that reached Manaus, followed 72 h back through a wind model (MODELED).
-- One row per arrival time and starting level; ERA5 and GFS versions of the same day live side by side (#51 compares).
-- Re-running a day with the same wind replaces its rows.
CREATE TABLE analise.trajetoria (
  dia        date NOT NULL,                -- Manaus day (UTC-4) of the arrival
  meteo      text NOT NULL CHECK (meteo IN ('era5', 'gfs')),
  chegada_em timestamptz NOT NULL,         -- when the air reached Manaus
  nivel_hpa  smallint NOT NULL,            -- starting level: 950/900/850 hPa ≈ 500/1000/1500 m above ground
  pontos     jsonb NOT NULL,               -- [{h, lat, lon, hpa}], one per hour, h = 0, -1 ... -72
  geom       geometry(LineString, 4326),   -- null when the trajectory stopped before the first hour
  parou_h    smallint,                     -- last whole hour reached when it left the wind box or went above 700 hPa; null = full 72 h
  gerado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia, meteo, chegada_em, nivel_hpa)
);
CREATE INDEX ON analise.trajetoria USING gist (geom);
