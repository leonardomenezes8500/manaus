-- MAIAC (#54): aerosol optical depth at 550 nm from MODIS (MCD19A2, Terra and Aqua, 1 km), MEASURED from satellite
-- (an algorithm over the image, so it has error). Only the best-quality pixels of the 3 x 3 box around each point.
CREATE SCHEMA maiac;
CREATE TABLE maiac.aod (
  ponto     text NOT NULL,                                   -- manaus (Centro) or atto
  dia       date NOT NULL,                                   -- Manaus day of the satellite pass
  satelite  text NOT NULL CHECK (satelite IN ('Terra', 'Aqua')),
  aod_550   real NOT NULL,                                   -- mean of the good pixels
  pixels    smallint NOT NULL,                               -- good pixels in the mean
  arquivo   bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (ponto, dia, satelite)
);
