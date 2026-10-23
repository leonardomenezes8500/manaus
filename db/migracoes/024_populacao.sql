-- Detailed population (#63): age, sex, race and literacy per census tract (Censo 2022, OFFICIAL RECORD), and the
-- yearly series (census, IBGE estimate, IBGE projection).
-- The group of each dictionary variable ('idade:0-4', 'sexo:feminino', 'cor:parda', 'alfabetizados:15+', 'nao_alfabetizados:15+', 'total'),
-- read from its text by coleta/carga/setores.ts (grupoDe); crossed variables (sex x age...) have no group.
ALTER TABLE ibge.variavel ADD COLUMN grupo text;
CREATE SCHEMA IF NOT EXISTS contexto; -- also created by 023 (calendar)

CREATE TABLE ibge.populacao_ano (
  local   text NOT NULL,                  -- IBGE code of the municipality, or the UF abbreviation (projections: only by UF)
  ano     smallint NOT NULL,
  tipo    text NOT NULL CHECK (tipo IN ('censo', 'estimativa', 'projecao')),
  sexo    text NOT NULL CHECK (sexo IN ('total', 'masculino', 'feminino')),
  idade   text NOT NULL,                  -- 'total' or a band ('0-4', '5-14', '15-59', '60+')
  pessoas integer NOT NULL,
  fonte   text NOT NULL,                  -- e.g. 'SIDRA 6579', 'Projeções da População, revisão 2024'
  arquivo bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (local, ano, tipo, sexo, idade)
);

-- One tract per row: people by age band, sex, race and the literate from 15 on (Censo 2022). Suppressed values ("X")
-- are not stored, so a band can be missing in small tracts.
CREATE VIEW contexto.populacao_setor AS
SELECT s.codigo AS setor, s.municipio, s.bairro, s.bairro_nome,
       sum(a.valor) FILTER (WHERE a.tabela = 'basico' AND a.variavel = 'v0001') AS pessoas,
       sum(a.valor) FILTER (WHERE v.grupo = 'idade:0-4') AS idade_0_4,
       sum(a.valor) FILTER (WHERE v.grupo = 'idade:5-14') AS idade_5_14,
       sum(a.valor) FILTER (WHERE v.grupo = 'idade:15-59') AS idade_15_59,
       sum(a.valor) FILTER (WHERE v.grupo = 'idade:60+') AS idade_60_mais,
       sum(a.valor) FILTER (WHERE v.grupo = 'sexo:masculino') AS homens,
       sum(a.valor) FILTER (WHERE v.grupo = 'sexo:feminino') AS mulheres,
       sum(a.valor) FILTER (WHERE v.grupo = 'cor:branca') AS branca,
       sum(a.valor) FILTER (WHERE v.grupo = 'cor:preta') AS preta,
       sum(a.valor) FILTER (WHERE v.grupo = 'cor:amarela') AS amarela,
       sum(a.valor) FILTER (WHERE v.grupo = 'cor:parda') AS parda,
       sum(a.valor) FILTER (WHERE v.grupo = 'cor:indígena') AS indigena,
       sum(a.valor) FILTER (WHERE v.grupo = 'alfabetizados:15+') AS alfabetizados_15_mais,
       sum(a.valor) FILTER (WHERE v.grupo = 'nao_alfabetizados:15+') AS nao_alfabetizados_15_mais
FROM ibge.setor s
LEFT JOIN ibge.setor_agregado a ON a.setor = s.codigo
LEFT JOIN ibge.variavel v ON v.tabela = a.tabela AND v.variavel = a.variavel
GROUP BY s.codigo;

-- The same per IBGE bairro (only where the IBGE has bairros, as in Manaus).
CREATE VIEW contexto.populacao_bairro AS
SELECT bairro, min(bairro_nome) AS bairro_nome, min(municipio) AS municipio, count(*)::int AS setores,
       sum(pessoas) AS pessoas, sum(idade_0_4) AS idade_0_4, sum(idade_5_14) AS idade_5_14, sum(idade_15_59) AS idade_15_59,
       sum(idade_60_mais) AS idade_60_mais, sum(homens) AS homens, sum(mulheres) AS mulheres, sum(branca) AS branca,
       sum(preta) AS preta, sum(amarela) AS amarela, sum(parda) AS parda, sum(indigena) AS indigena,
       sum(alfabetizados_15_mais) AS alfabetizados_15_mais, sum(nao_alfabetizados_15_mais) AS nao_alfabetizados_15_mais
FROM contexto.populacao_setor WHERE bairro IS NOT NULL GROUP BY bairro;
