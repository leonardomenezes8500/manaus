-- MonitorAr / FioAres (#40): the only reference air quality station in Manaus (Fiocruz, ILMD), hourly, MEASURED.
-- The app backend only gives the IQAr index (not µg/m³) and only the last 24 h, so it is collected every hour.
CREATE SCHEMA monitorar;
CREATE TABLE monitorar.medicao (
  estacao       integer NOT NULL,      -- idEstacao of the backend (178586 = FIOTEC - Amazonas)
  poluente      integer NOT NULL,      -- idPoluente (15 = MP2.5)
  hora_local    timestamp NOT NULL,    -- dtMedicao as the backend gives it; time zone NOT documented (Manaus or Brasília?): check with the yearly CSV
  iqar          real NOT NULL,         -- air quality index (IQAr), not a concentration
  classificacao text,
  validado      boolean,
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (estacao, poluente, hora_local)
);
CREATE TABLE monitorar.estacao (
  id    integer PRIMARY KEY,
  nome  text NOT NULL,
  geom  geometry(Point, 4326) NOT NULL
);
