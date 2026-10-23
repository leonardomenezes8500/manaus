---
id: ibama-embargos
nome: IBAMA áreas embargadas
publicador: IBAMA (SIFISC)
url: https://dadosabertos.ibama.gov.br/dataset/fiscalizacao-termo-de-embargo
acesso: download
chave: nenhuma
atualizacao: diária (o arquivo testado era de 2026-10-23)
cobertura: Brasil, todos os termos de embargo, com CPF/CNPJ e polígono quando há
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: coletando
coleta: 30d
verificado_em: 2026-10-23
teste: 'curl -sSI "https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/TERMOS_DE_EMBARGO/TERMO_EMBARGO/termo_de_embargo.csv"'
---
- Tema: ambiente, donos e quem deveria agir. Áreas embargadas por desmatamento ou queimada ilegal, com autuado, município e geometria.
- O teste (HEAD) respondeu 200 com o CSV nacional de 211 MB, modificado em 2026-10-23 (separado por ponto e vírgula, polígono em WKT em `GEOM_AREA_EMBARGADA`). O endereço antigo (`SIFISC/termo_embargo/termo_embargo/termo_embargo_csv.zip`) ainda responde, mas parou em 2026-05-03.
- Nome e CPF de pessoa física são dado pessoal: nunca em issue, commit ou relatório (#79, #81).
- Coleta (#81): `coleta/fiscalizacao.ts`, neste PC, à mão, uma vez por sprint enquanto o M4 durar. O CSV nacional é cortado aqui para AM, AC, RO, RR, PA, MT e AP e só o corte vai para o bruto, em gzip; tabelas `ibama.embargo`.
