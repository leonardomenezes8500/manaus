-- OpenStreetMap (#23), layer 2: the Manaus area of the weekly Geofabrik "norte" extract. Each load replaces the three
-- tables with the new snapshot (older snapshots stay in the raw files). tags = every OSM tag of the object; the main
-- ones are also columns. While loading, ogr2ogr writes its layers as osm.points, osm.lines and osm.multipolygons
-- (staging, dropped after the load).
CREATE EXTENSION IF NOT EXISTS hstore; -- other_tags from ogr2ogr is hstore text

CREATE SCHEMA osm;

CREATE TABLE osm.ponto (
  id       text PRIMARY KEY, -- n<node id>
  name     text GENERATED ALWAYS AS (tags->>'name') STORED,
  amenity  text GENERATED ALWAYS AS (tags->>'amenity') STORED,
  shop     text GENERATED ALWAYS AS (tags->>'shop') STORED,
  place    text GENERATED ALWAYS AS (tags->>'place') STORED,
  highway  text GENERATED ALWAYS AS (tags->>'highway') STORED,
  tags     jsonb NOT NULL,
  geom     geometry(Point, 4326) NOT NULL,
  snapshot date NOT NULL, -- date of the Geofabrik extract
  arquivo  bigint NOT NULL REFERENCES bruto.arquivo
);

CREATE TABLE osm.linha (
  id       text PRIMARY KEY, -- w<way id>
  name     text GENERATED ALWAYS AS (tags->>'name') STORED,
  highway  text GENERATED ALWAYS AS (tags->>'highway') STORED,
  waterway text GENERATED ALWAYS AS (tags->>'waterway') STORED,
  railway  text GENERATED ALWAYS AS (tags->>'railway') STORED,
  tags     jsonb NOT NULL,
  geom     geometry(LineString, 4326) NOT NULL,
  snapshot date NOT NULL,
  arquivo  bigint NOT NULL REFERENCES bruto.arquivo
);

-- Closed ways and multipolygon relations (buildings, land use, boundaries...).
CREATE TABLE osm.poligono (
  id          text PRIMARY KEY, -- w<way id> or r<relation id>
  name        text GENERATED ALWAYS AS (tags->>'name') STORED,
  building    text GENERATED ALWAYS AS (tags->>'building') STORED,
  landuse     text GENERATED ALWAYS AS (tags->>'landuse') STORED,
  amenity     text GENERATED ALWAYS AS (tags->>'amenity') STORED,
  "natural"   text GENERATED ALWAYS AS (tags->>'natural') STORED,
  leisure     text GENERATED ALWAYS AS (tags->>'leisure') STORED,
  boundary    text GENERATED ALWAYS AS (tags->>'boundary') STORED,
  admin_level text GENERATED ALWAYS AS (tags->>'admin_level') STORED,
  tags        jsonb NOT NULL,
  geom        geometry(MultiPolygon, 4326) NOT NULL,
  snapshot    date NOT NULL,
  arquivo     bigint NOT NULL REFERENCES bruto.arquivo
);

CREATE INDEX ON osm.ponto USING gist (geom);
CREATE INDEX ON osm.linha USING gist (geom);
CREATE INDEX ON osm.poligono USING gist (geom);
