-- AERONET (#53): aerosol optical depth from sun photometers, daily means, MEASURED from the ground. ATTO (~150 km
-- northeast of Manaus) is active; Manaus_EMBRAPA has data until about 2020.
-- The AERONET day is UTC; the photometer only measures with sun (about 10–22 UTC), so it is also the Manaus day.
CREATE SCHEMA aeronet;
CREATE TABLE aeronet.aod_dia (
  site             text NOT NULL,
  dia              date NOT NULL,
  nivel            text NOT NULL CHECK (nivel IN ('1.5', '2.0')), -- 1.5 = near real time, cloud cleared; 2.0 = final calibration
  aod_500          real,                                          -- AOD at 500 nm
  angstrom_440_870 real,                                          -- > 1.5 with high AOD = fine particles, typical of smoke
  n                integer NOT NULL,                              -- measurements in the day
  arquivo          bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (site, dia, nivel)
);
-- One value per site and day: level 2.0 when it exists, else 1.5 (the column says which).
CREATE VIEW aeronet.aod_dia_melhor AS
  SELECT DISTINCT ON (site, dia) site, dia, nivel, aod_500, angstrom_440_870, n FROM aeronet.aod_dia ORDER BY site, dia, nivel DESC;
