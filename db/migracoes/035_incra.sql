-- INCRA land (#80), layer 2: the parcels certified in SIGEF, the older SNCI certificates and the settlements
-- (assentamentos), from the per-state shapefiles of certificacao.incra.gov.br/csv_shp (AM, AC, RO, PA), the polygons
-- that touch the layers box. None of them has the owner. Dates and status as they come.
CREATE SCHEMA incra;

-- dd/mm/aaaa text → date; anything else (empty, 31/02) → null.
CREATE FUNCTION incra.data_br(t text) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t !~ '^\d{2}/\d{2}/\d{4}$' THEN RETURN NULL; END IF;
  RETURN to_date(t, 'DD/MM/YYYY');
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE TABLE incra.sigef (
  id             serial PRIMARY KEY,
  parcela        text,               -- parcela_co
  situacao       text,               -- situacao_i (e.g. REGISTRADA, NAO REGISTRADA)
  status         text,
  codigo_imovel  text,               -- código do imóvel no SNCR
  nome_area      text,
  matricula      text,               -- registro_m
  data_submissao date,
  data_aprovacao date,               -- the parcel counts from this year on (#79, sigef-menos-fogo)
  data_registro  date,
  municipio      integer,            -- IBGE code
  uf             text,
  geom           geometry(MultiPolygon, 4326) NOT NULL,
  arquivo        bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON incra.sigef USING gist (geom);

CREATE TABLE incra.snci (
  id                serial PRIMARY KEY,
  processo          text,
  certificado       text,
  data_certificacao date,
  area_ha           double precision,
  codigo_imovel     text,
  nome              text,
  uf                text,
  geom              geometry(MultiPolygon, 4326) NOT NULL,
  arquivo           bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON incra.snci USING gist (geom);

CREATE TABLE incra.assentamento (
  id             serial PRIMARY KEY,
  codigo         text,               -- cd_sipra
  nome           text,
  municipio      text,
  uf             text,
  area_ha        double precision,
  capacidade     integer,
  familias       integer,
  fase           integer,
  data_criacao   date,
  forma_obtencao text,
  data_obtencao  date,
  geom           geometry(MultiPolygon, 4326) NOT NULL,
  arquivo        bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON incra.assentamento USING gist (geom);
