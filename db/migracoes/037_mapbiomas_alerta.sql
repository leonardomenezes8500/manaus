-- MapBiomas Alerta (#82), layer 2: validated deforestation alerts (CC BY 4.0, MapBiomas) from the public WFS of the
-- platform, the alerts that touch the layers box. MEASURED (satellite, checked by an analyst). The link to the CAR is
-- made here by geometry (#84), not through the API (that one asks for an account and a token).
CREATE SCHEMA mapbiomas_alerta;
CREATE TABLE mapbiomas_alerta.alerta (
  codigo        integer PRIMARY KEY,   -- CodeAlerta
  fontes        text,                  -- the warning systems behind it, e.g. {DETERB-AMAZONIA,GLAD,SAD}
  bioma         text,
  estado        text,
  uf            text,
  municipio     text,
  area_ha       double precision,
  ano           smallint,              -- AnoDetec
  detectado_em  date,                  -- DataDetec
  imagem_antes  timestamptz,
  imagem_depois timestamptz,
  publicado_em  timestamptz,
  vetor_pressao text,                  -- VPressao (agriculture, mining...)
  geom          geometry(MultiPolygon, 4326) NOT NULL,
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON mapbiomas_alerta.alerta USING gist (geom);
CREATE INDEX ON mapbiomas_alerta.alerta (detectado_em);
