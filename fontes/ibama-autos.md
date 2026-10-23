---
id: ibama-autos
nome: IBAMA autos de infração
publicador: IBAMA (SIFISC)
url: https://dadosabertos.ibama.gov.br/dataset/fiscalizacao-auto-de-infracao
acesso: download
chave: nenhuma
atualizacao: diária (o arquivo testado era de 2026-10-23)
cobertura: Brasil, desde 1977; tipo da infração, valor, data, município, coordenadas e autuado
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: coletando
coleta: 30d
verificado_em: 2026-10-23
teste: 'curl -sSI "https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/SIFISC/auto_infracao/auto_infracao/auto_infracao_csv.zip"'
---
- Tema: quem deveria agir. Autos de infração do IBAMA (flora, fauna...), com valor da multa e unidade de conciliação.
- O teste (HEAD) respondeu 200 com zip de 123 MB (um CSV por ano dentro), modificado em 2026-10-23. As coordenadas também vêm à parte em `SIFISC/auto_infracao/coordenada/coordenada.csv`.
- Nome e CPF de pessoa física são dado pessoal: nunca em issue, commit ou relatório (#79, #81).
- Coleta (#81): `coleta/fiscalizacao.ts`, neste PC, à mão, uma vez por sprint enquanto o M4 durar. O CSV nacional é cortado aqui para AM, AC, RO, RR, PA, MT e AP e só o corte vai para o bruto, em gzip; tabelas `ibama.auto_infracao`.
