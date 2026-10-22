-- Neighbourhoods (#24), layer 2. IBGE 2022 bairros (AM). The official Prefeitura/IMPLURB layer comes later, in its own
-- schema (its site was down on 2026-10-21); the OSM ones are in osm.poligono (boundary=administrative, admin_level=10).
CREATE TABLE ibge.bairro (
  codigo    char(13) PRIMARY KEY, -- CD_BAIRRO (municipality + subdistrict + 2 digits)
  nome      text NOT NULL,
  municipio integer NOT NULL,
  geom      geometry(MultiPolygon, 4326) NOT NULL, -- from SIRGAS 2000 (EPSG:4674)
  arquivo   bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON ibge.bairro (municipio);
CREATE INDEX ON ibge.bairro USING gist (geom);
