-- Public spending by function and subfunction (#65): SICONFI DCA Anexo I-E of the Prefeitura de Manaus (1302603) and
-- of the Estado do AM (13), OFFICIAL RECORD in current reais, plus the monthly IPCA (IBGE SIDRA 1737) for real terms.
CREATE SCHEMA IF NOT EXISTS siconfi;
CREATE TABLE siconfi.despesa_funcao (
  ente    integer NOT NULL,              -- IBGE code: 1302603 Manaus, 13 AM
  ano     integer NOT NULL,
  codigo  text NOT NULL,                 -- '18' função, '06.182' subfunção, 'FU18'/'18.999' the rest of a função, 'TOTAL'
  nome    text NOT NULL,                 -- as published that year (names drift: match by code)
  coluna  text NOT NULL CHECK (coluna IN ('empenhado', 'liquidado', 'pago')),
  valor   numeric NOT NULL,              -- R$ of that year, without intra-budget spending
  arquivo bigint NOT NULL REFERENCES bruto.arquivo,
  PRIMARY KEY (ente, ano, codigo, coluna)
);

CREATE TABLE ibge.ipca_mes (
  mes     date PRIMARY KEY,              -- first day of the month
  indice  numeric NOT NULL,              -- IPCA index number (dec/1993 = 100)
  arquivo bigint NOT NULL REFERENCES bruto.arquivo
);

-- Spending of a year in reais of the last complete IPCA year (each year by its mean index: spending is a flow).
CREATE VIEW contexto.gasto_funcao AS
WITH media AS (SELECT extract(year FROM mes)::int AS ano, avg(indice) AS indice FROM ibge.ipca_mes GROUP BY 1 HAVING count(*) = 12),
     ref AS (SELECT ano, indice FROM media ORDER BY ano DESC LIMIT 1)
SELECT d.ente, d.ano, d.codigo, d.nome, d.coluna, d.valor, round(d.valor * ref.indice / m.indice, 2) AS valor_real, ref.ano AS reais_de
FROM siconfi.despesa_funcao d JOIN media m ON m.ano = d.ano CROSS JOIN ref;
