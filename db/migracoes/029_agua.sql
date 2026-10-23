-- Water and sewage (#67). OFFICIAL RECORD and MEASURED, never mixed:
-- * contexto.saneamento_setor: water source, sewage and garbage of the occupied households per census tract (Censo
--   2022, aggregates part 2, loaded into ibge.setor_agregado by coleta/ibge-populacao.ts). 'X' (suppressed) is null.
-- * sisagua.vigilancia: water samples MEASURED by the health surveillance in Manaus, one row per analysis.
-- * saneamento.indicador_ano: yearly indicators of Manaus from the SINISA (2023 on; the SNIS before it is another
--   series and is not mixed in).
CREATE VIEW contexto.saneamento_setor AS
SELECT s.codigo AS setor, s.municipio, s.bairro, s.bairro_nome,
       sum(a.valor) FILTER (WHERE v.grupo LIKE 'agua:%') AS domicilios,
       sum(a.valor) FILTER (WHERE v.grupo = 'agua:rede') AS agua_rede,
       sum(a.valor) FILTER (WHERE v.grupo = 'agua:poco') AS agua_poco,
       sum(a.valor) FILTER (WHERE v.grupo = 'agua:outra') AS agua_outra,
       sum(a.valor) FILTER (WHERE v.grupo = 'esgoto:rede') AS esgoto_rede,
       sum(a.valor) FILTER (WHERE v.grupo = 'esgoto:fossa_septica') AS esgoto_fossa_septica,
       sum(a.valor) FILTER (WHERE v.grupo = 'esgoto:fossa_rudimentar') AS esgoto_fossa_rudimentar,
       sum(a.valor) FILTER (WHERE v.grupo = 'esgoto:vala_rio') AS esgoto_vala_rio,
       sum(a.valor) FILTER (WHERE v.grupo = 'esgoto:outra') AS esgoto_outra,
       sum(a.valor) FILTER (WHERE v.grupo = 'lixo:coletado') AS lixo_coletado,
       sum(a.valor) FILTER (WHERE v.grupo = 'lixo:queimado') AS lixo_queimado,
       sum(a.valor) FILTER (WHERE v.grupo = 'lixo:outro') AS lixo_outro
FROM ibge.setor s
JOIN ibge.setor_agregado a ON a.setor = s.codigo AND a.tabela = 'caracteristicas_domicilio2'
JOIN ibge.variavel v ON v.tabela = a.tabela AND v.variavel = a.variavel
GROUP BY s.codigo;

CREATE SCHEMA sisagua;
CREATE TABLE sisagua.vigilancia (
  amostra         text NOT NULL,           -- NU_AMOSTRA
  coletado_em     timestamptz NOT NULL,
  parametro       text NOT NULL,           -- 'Turbidez (uT)', 'pH', 'Cloro residual livre (mg/L)', 'Escherichia coli'...
  resultado       float8,                  -- null when the result is text only ('Ausente', 'Presente')
  resultado_texto text NOT NULL,
  ponto           text NOT NULL,           -- TP_PONTO_COLETA: 'Cavalete/Hidrômetro', 'Reservatório de água'...
  abastecimento   text NOT NULL,           -- SAA (system), SAC, SAI
  area            text NOT NULL,           -- NO_AREA, usually the bairro
  arquivo         bigint NOT NULL REFERENCES bruto.arquivo
);
CREATE INDEX ON sisagua.vigilancia (parametro, coletado_em);

CREATE SCHEMA saneamento;
CREATE TABLE saneamento.indicador_ano (
  municipio integer NOT NULL,
  ano       integer NOT NULL,
  serie     text NOT NULL CHECK (serie IN ('SINISA')),
  modulo    text NOT NULL CHECK (modulo IN ('agua', 'esgoto')),
  indicador text NOT NULL,                 -- the column name as published (no code in the SINISA)
  valor     float8,                        -- null when the SINISA writes 'Não calculado'
  texto     text NOT NULL,
  arquivo   bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (municipio, ano, serie, modulo, indicador)
);
