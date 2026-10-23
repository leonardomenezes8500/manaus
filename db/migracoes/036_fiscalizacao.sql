-- Embargoes and infraction notices (#81), layer 2: IBAMA (national CSVs cut to AM, AC, RO, RR, PA, MT and AP) and
-- ICMBio (federal protected areas, shapefiles). Personal data: the tables keep what the agencies publish (name and CPF
-- or CNPJ); products, reports and the API show a name only for companies (pessoa = 'PJ'), people by the term number.
-- Impossible dates (before 1970 or in the future) and unreadable WKT become null; the load prints how many.
CREATE SCHEMA ibama;
CREATE SCHEMA icmbio;

-- '3,6367', '-59.04', '201000,00' → number; anything else → null.
CREATE FUNCTION ibama.num_br(t text) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN trim(t) ~ '^-?\d+([.,]\d+)?$' THEN replace(trim(t), ',', '.')::float8 END
$$;

-- 'AAAA-MM-DD[ hh:mm:ss]' → date, null when unreadable, before 1970 or after today (typos like 2925 exist).
CREATE FUNCTION ibama.data_valida(t text) RETURNS date LANGUAGE plpgsql STABLE AS $$
DECLARE d date;
BEGIN
  IF t !~ '^\d{4}-\d{2}-\d{2}' THEN RETURN NULL; END IF;
  d := left(t, 10)::date;
  RETURN CASE WHEN d BETWEEN '1970-01-01' AND current_date THEN d END;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

-- WKT (SIRGAS or WGS 84, the same here) → valid polygons, null when unreadable or empty.
CREATE FUNCTION ibama.poligono(t text) RETURNS geometry(MultiPolygon, 4326) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE g geometry;
BEGIN
  IF coalesce(trim(t), '') = '' THEN RETURN NULL; END IF;
  g := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromText(t), 4326)), 3));
  RETURN CASE WHEN ST_IsEmpty(g) THEN NULL ELSE g END;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE FUNCTION ibama.ponto(lon text, lat text) RETURNS geometry(Point, 4326) LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN ibama.num_br(lon) BETWEEN -75 AND -28 AND ibama.num_br(lat) BETWEEN -35 AND 6
              THEN ST_SetSRID(ST_MakePoint(ibama.num_br(lon), ibama.num_br(lat)), 4326) END
$$;

CREATE TABLE ibama.embargo (
  id               serial PRIMARY KEY,
  seq              bigint,              -- SEQ_TAD
  numero           text,                -- NUM_TAD
  serie            text,
  data             date,
  cancelado        boolean,             -- SIT_CANCELADO
  embargado        text,                -- name as published (personal data: see the top)
  cpf_cnpj         text,
  pessoa           text,                -- PF (11 digits) or PJ (14 digits)
  processo         text,
  municipio        integer,             -- IBGE code
  uf               text,
  deter_prodes     text,
  area_ha          double precision,
  imovel           text,
  tipo_area        text,
  desembargo       text,                -- SIT_DESEMBARGO as it comes
  tipo_desembargo  text,
  data_desembargo  date,
  auto             text,                -- NUM_AUTO_INFRACAO
  operacao         text,
  descricao        text,
  poligono         geometry(MultiPolygon, 4326),
  ponto            geometry(Point, 4326),
  arquivo          bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON ibama.embargo USING gist (poligono);
CREATE INDEX ON ibama.embargo USING gist (ponto);
CREATE INDEX ON ibama.embargo (uf, data);

CREATE TABLE ibama.auto_infracao (
  id            serial PRIMARY KEY,
  seq           bigint,
  numero        text,
  serie         text,
  cancelado     boolean,
  tipo_auto     text,
  valor         double precision,
  data          date,                  -- DAT_HORA_AUTO_INFRACAO
  data_fato     date,
  conciliacao   text,                  -- DS_UNID_CONCILIACAO
  municipio     integer,
  uf            text,
  tipo_infracao text,                  -- Flora, Fauna, Pesca...
  descricao     text,
  pessoa        text,                  -- TP_PESSOA_INFRATOR
  infrator      text,
  cpf_cnpj      text,
  area_ha       double precision,
  uc            text,
  operacao      text,
  embargos      text,                  -- CD_TERMOS_EMBARGOS
  area          geometry(MultiPolygon, 4326),
  ponto         geometry(Point, 4326),
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON ibama.auto_infracao USING gist (ponto);
CREATE INDEX ON ibama.auto_infracao (uf, data);

CREATE TABLE icmbio.embargo (
  id            serial PRIMARY KEY,
  numero        text,
  serie         text,
  auto          text,
  cpf_cnpj      text,
  autuado       text,
  pessoa        text,
  tipo_infracao text,
  uc            text,
  cnuc          text,
  municipio     text,
  uf            text,
  data          date,
  julgamento    text,
  area_ha       double precision,
  processo      text,
  geom          geometry(MultiPolygon, 4326) NOT NULL,
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON icmbio.embargo USING gist (geom);

CREATE TABLE icmbio.auto_infracao (
  id            serial PRIMARY KEY,
  numero        text,
  serie         text,
  tipo          text,
  valor         double precision,
  embargo       text,
  autuado       text,
  cpf_cnpj      text,
  pessoa        text,
  data          date,
  tipo_infracao text,
  uc            text,
  cnuc          text,
  municipio     text,
  uf            text,
  julgamento    text,
  processo      text,
  geom          geometry(Point, 4326) NOT NULL,
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON icmbio.auto_infracao USING gist (geom);
