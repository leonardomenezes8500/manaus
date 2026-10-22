-- Protected areas (#30), layer 2, for the whole smoke region (analise.regiao): indigenous lands (FUNAI) and conservation
-- units (CNUC/MMA, federal, state and municipal). ICMBio and SEMA-AM own layers would be separate sources later; the
-- overlap between them is a fusion case.
CREATE SCHEMA funai;
CREATE TABLE funai.terra_indigena (
  codigo        integer PRIMARY KEY,       -- terrai_codigo
  nome          text NOT NULL,
  etnia         text,
  municipios    text,
  uf            text,
  fase          text,                      -- Regularizada, Homologada, Declarada, Delimitada, Em Estudo...
  modalidade    text,
  area_ha       double precision,
  atualizado_em date,                      -- data_atualizacao of the FUNAI record
  geom          geometry(MultiPolygon, 4326) NOT NULL,
  arquivo       bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON funai.terra_indigena USING gist (geom);

CREATE SCHEMA cnuc;
CREATE TABLE cnuc.unidade (
  cd_cnuc      text PRIMARY KEY,
  nome         text NOT NULL,
  esfera       text,                       -- Federal | Estadual | Municipal
  categoria    text,
  grupo        text,                       -- Proteção Integral | Uso Sustentável
  orgao_gestor text,
  ano_criacao  integer,
  ato          text,
  area_ha      double precision,
  uf           text,
  geom         geometry(MultiPolygon, 4326) NOT NULL,
  arquivo      bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON cnuc.unidade USING gist (geom);
