-- Convenção do banco (#5):
--   camada 2: um esquema por fonte (firms, ibge, osm...), sem misturar fontes; geometria sempre em EPSG:4326
--             (o SRID original fica anotado no card da fonte, em fontes/);
--   camada 3: esquema entidade (liga as fontes, guarda o que cada uma diz e escolhe por regra de prioridade);
--   analise:  resultados derivados (ex.: atribuição da fumaça).
-- Horários em timestamptz (UTC). Migração só acrescenta (tabela, coluna com nulo ou default, índice): a imagem
-- anterior tem que continuar funcionando se o deploy voltar a versão.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA bruto;

-- Um arquivo do bruto imutável no R2 (gravado por baixar()).
CREATE TABLE bruto.arquivo (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chave      text NOT NULL UNIQUE, -- chave no R2, ex.: bruto/firms/2026-10-21/...
  fonte      text NOT NULL,
  sha256     text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  baixado_em timestamptz NOT NULL
);

-- O que já foi carregado de cada arquivo, para a carga não ler duas vezes.
CREATE TABLE bruto.carga (
  arquivo      bigint NOT NULL REFERENCES bruto.arquivo,
  tabela       text NOT NULL, -- ex.: firms.foco
  carregado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (arquivo, tabela)
);
