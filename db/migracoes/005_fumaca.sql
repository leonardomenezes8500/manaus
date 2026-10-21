-- Smoke attribution (#17): derived results. Re-running a day replaces its rows (they come from layer 2).
CREATE TABLE analise.fumaca_dia (
  dia                date NOT NULL,          -- Manaus day (UTC-4)
  versao             text NOT NULL,          -- v0 = straight-line wind heuristic
  gerado_em          timestamptz NOT NULL DEFAULT now(),
  pm25_medido_media  real,                   -- OpenAQ AirGradient (MEASURED, low-cost sensor), µg/m³
  pm25_medido_max    real,
  pm25_medido_horas  integer NOT NULL,
  pm25_cams_media    real,                   -- CAMS via Open-Meteo (MODEL), µg/m³
  pm25_cams_max      real,
  horas_fu_hz        integer NOT NULL,       -- SBEG hours with smoke (FU) or haze (HZ)
  visibilidade_min_m integer,
  vento              jsonb NOT NULL,         -- mean wind 925/850 hPa, steadiness, hours with data
  focos_contados     integer NOT NULL,
  peso_total         real NOT NULL,
  ranking            jsonb NOT NULL,         -- [{municipio, nome, uf, peso, parcela, focos}], top 20 spots
  confianca          text NOT NULL CHECK (confianca IN ('alta', 'media', 'baixa')),
  sinais             jsonb NOT NULL,
  nota               text NOT NULL,          -- says it is the v0 heuristic
  PRIMARY KEY (dia, versao)
);

-- Every spot that counted for the day, with its weight (the map colours spots by it).
CREATE TABLE analise.fumaca_foco (
  dia          date NOT NULL,
  versao       text NOT NULL,
  foco         bigint NOT NULL REFERENCES firms.foco,
  peso         real NOT NULL,
  distancia_km real NOT NULL,
  azimute      real NOT NULL,              -- bearing from Manaus, degrees
  horas        smallint NOT NULL,          -- hours of the day in which it counted
  PRIMARY KEY (dia, versao, foco),
  FOREIGN KEY (dia, versao) REFERENCES analise.fumaca_dia ON DELETE CASCADE
);
