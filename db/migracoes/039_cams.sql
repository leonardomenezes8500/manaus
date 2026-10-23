-- CAMS reanalysis EAC4 (#89): daily mean PM2.5 and PM10 (µg/m³) of the Manaus day at the grid point nearest the Centre
-- (0.75°, ~80 km). MODELED: the global aerosol model behind the INPE SISAM, not a measurement. Second cut of the
-- round 5 health hypotheses (PM2.5 above 25 µg/m³ in place of the FU of the METAR).
CREATE SCHEMA cams;
CREATE TABLE cams.pm25_dia (
  dia     date NOT NULL,
  pm25    double precision NOT NULL,
  pm10    double precision NOT NULL,
  produto text NOT NULL,              -- eac4 (reanalysis)
  PRIMARY KEY (dia, produto)
);
