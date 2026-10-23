-- Federal fire spending (#90): monthly budget execution of the Portal da Transparência (CGU), only the fire actions
-- (coleta/transparencia.ts ACOES). Most of it is localized "NACIONAL" or by region, not by state: uf stays null then
-- (it enters national totals, not the states). REGISTERED (accounting records).
CREATE SCHEMA transparencia;
CREATE TABLE transparencia.despesa_fogo_mes (
  id                 bigserial PRIMARY KEY,
  mes                date NOT NULL,        -- month of the entry (first day)
  orgao_superior     text,
  orgao              text,
  unidade_gestora    text,
  acao               text NOT NULL,        -- e.g. 214M (Prevfogo, IBAMA), 214P (ICMBio), 218X (GLO), 20X7 (Forças Armadas)
  nome_acao          text,
  plano_orcamentario text,
  uf                 text,                 -- the state of the entry; null for national or regional localizers
  municipio          text,
  localizador_codigo text,
  localizador        text,                 -- full name (Nome Subtítulo), e.g. "... - NA REGIAO NORTE"
  empenhado          numeric NOT NULL,
  liquidado          numeric NOT NULL,
  pago               numeric NOT NULL
);
CREATE INDEX ON transparencia.despesa_fogo_mes (acao, mes);

-- Monthly values in reais of the last complete IPCA year (each month by its own index).
CREATE VIEW transparencia.despesa_fogo_mes_real AS
WITH ref AS (SELECT extract(year FROM mes)::int AS ano, avg(indice) AS indice FROM ibge.ipca_mes GROUP BY 1 HAVING count(*) = 12
             ORDER BY 1 DESC LIMIT 1)
SELECT d.*, round(d.liquidado * ref.indice / i.indice, 2) AS liquidado_real, ref.ano AS reais_de
FROM transparencia.despesa_fogo_mes d JOIN ibge.ipca_mes i ON i.mes = d.mes CROSS JOIN ref;
