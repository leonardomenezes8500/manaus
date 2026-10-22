-- Fire spots per Manaus day (#52), for the 2012–2026 series (#55). 14 years of spots do not go into firms.foco
-- (millions of rows in the shared database and the daily backup): only daily totals, computed on the PC from the
-- FIRMS standard archive (SP) in R2, and from firms.foco (NRT) after the end of the SP. MEASURED (satellite).
CREATE TABLE analise.focos_dia (
  dia      date NOT NULL,                                   -- Manaus day (UTC-4)
  sensor   text NOT NULL CHECK (sensor IN ('VIIRS_SNPP', 'MODIS')),
  anel     text NOT NULL CHECK (anel IN ('800km', 'regiao')), -- within 800 km of Manaus, or the whole smoke region box
  focos    integer NOT NULL,
  frp      real NOT NULL,                                   -- sum of FRP (MW)
  origem   text NOT NULL CHECK (origem IN ('SP', 'NRT', 'SP+NRT')), -- SP+NRT = the day where the archive ends
  gerado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia, sensor, anel)
);
