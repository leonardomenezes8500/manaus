-- Who should act (#91): the public bodies of the fire rule (analise/fogo/responsavel.ts), loaded from
-- analise/fogo/orgao-fogo.csv. cnpj comes from pncp.contratacao when the body has a contract there; papeis is the
-- union of its roles in the rule (prevencao, fiscalizacao, combate, gestao).
CREATE TABLE contexto.orgao_fogo (
  sigla      text PRIMARY KEY,
  orgao      text NOT NULL,
  esfera     text NOT NULL,           -- federal, estadual, municipal, privado
  cnpj       text,
  fonte_cnpj text NOT NULL,
  papeis     text NOT NULL
);

-- Ready filters for the chain report (#93). Contracts of the fire bodies in the PNCP per month.
CREATE VIEW contexto.contrato_orgao_fogo_mes AS
SELECT o.sigla, date_trunc('month', c.publicado_em)::date AS mes, count(*)::int AS contratos,
       sum(c.valor_homologado) AS valor_homologado, count(*) FILTER (WHERE c.emergencia)::int AS emergenciais
FROM contexto.orgao_fogo o JOIN pncp.contratacao c ON c.orgao_cnpj = o.cnpj
GROUP BY 1, 2;

-- State (13) and Prefeitura de Manaus (1302603) spending by subfunction (SICONFI): 541 preservação e conservação
-- ambiental, 542 controle ambiental, 182 defesa civil. Spending per state or municipal body has no usable source (#87).
CREATE VIEW contexto.gasto_fogo_subfuncao AS
SELECT ente, ano, codigo, nome, coluna, valor, valor_real, reais_de
FROM contexto.gasto_funcao WHERE codigo IN ('18.541', '18.542', '06.182');
