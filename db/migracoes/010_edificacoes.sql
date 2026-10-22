-- Buildings (#26), layer 2, cut to the Manaus box (municipality + ~5 km). The OSM ones are in osm.poligono
-- (building is not null). The fusion of the three is in M7.

-- Overture Maps: each release replaces the table (older clips stay in the raw files).
CREATE SCHEMA overture;
CREATE TABLE overture.edificacao (
  id      text PRIMARY KEY,               -- Overture GERS id
  subtipo text,                           -- subtype: residential, commercial...
  classe  text,                           -- class: house, apartments...
  altura  double precision,               -- height (m), when known
  andares integer,                        -- num_floors
  dataset text,                           -- first source: OpenStreetMap, Microsoft ML Buildings, Google Open Buildings...
  geom    geometry(MultiPolygon, 4326) NOT NULL,
  release text NOT NULL,                  -- e.g. 2026-10-21.0
  arquivo bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON overture.edificacao USING gist (geom);

-- Google Open Buildings v3 (static: footprints detected by a model on satellite images, with a confidence score).
CREATE SCHEMA openbuildings;
CREATE TABLE openbuildings.edificacao (
  codigo    text PRIMARY KEY,             -- full_plus_code of the centroid
  area_m2   double precision NOT NULL,
  confianca real NOT NULL,                -- 0.65 to 1 (the model's confidence; modelled, not measured)
  geom      geometry(MultiPolygon, 4326) NOT NULL, -- a few footprints come as multipolygons
  arquivo   bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON openbuildings.edificacao USING gist (geom);
