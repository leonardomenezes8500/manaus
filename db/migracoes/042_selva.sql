-- SELVA (UEA/EducAIR) map (#41): current reading of the PurpleAir sensors, every 10 min. MEASURED by LOW-COST sensors
-- ("sensor barato": laser counter, no official calibration, no EPA correction; it overestimates PM2.5 in dense smoke).
-- Only the sensors of the Manaus metropolitan region are loaded; the raw file keeps the whole region box.
CREATE SCHEMA selva;
CREATE TABLE selva.sensor (
  id    integer PRIMARY KEY,               -- PurpleAir sensor_index
  nome  text NOT NULL,
  geom  geometry(Point, 4326) NOT NULL
);
CREATE TABLE selva.leitura (
  sensor         integer NOT NULL REFERENCES selva.sensor,
  visto_em       timestamptz NOT NULL,     -- last_seen: when the sensor last reported (a file repeats it until the next report)
  pm25           real,                     -- PurpleAir "pm2.5" in µg/m³ as the map gives it (no A/B channels, no correction)
  temperatura_f  real,                     -- sensor's internal temperature in °F (runs hotter than the air)
  arquivo        bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (sensor, visto_em)
);
COMMENT ON TABLE selva.leitura IS 'medido, sensor barato (PurpleAir via SELVA/UEA): indicador, não dado regulatório';
