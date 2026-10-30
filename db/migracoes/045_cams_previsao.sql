-- Archived CAMS forecast (#113): mean PM2.5 (µg/m³) forecast for each Manaus day of the fire seasons (Aug to Nov) of
-- 2015 on, 1 and 2 days ahead (00 UTC run of the day before, or of two days before), at the grid point nearest the
-- Centre. MODELED, never a measurement. Base of the alert hypothesis previsao-cams-amanha (round 6, #116).
CREATE TABLE cams.previsao_dia (
  dia          date NOT NULL,      -- Manaus day (06Z to 03Z of the next, as cams.pm25_dia)
  antecedencia smallint NOT NULL,  -- days between the run (00 UTC) and the Manaus day: 1 or 2
  pm25         double precision NOT NULL,
  PRIMARY KEY (dia, antecedencia)
);
COMMENT ON TABLE cams.previsao_dia IS 'modelado (previsão do CAMS arquivada no ADS)';
