---
id: datasus-cnes
nome: DATASUS CNES (estabelecimentos de saúde)
publicador: Ministério da Saúde (DATASUS)
url: ftp://ftp.datasus.gov.br/dissemin/publicos/CNES/200508_/Dados/ST/
acesso: download
chave: nenhuma
atualizacao: mensal
cobertura: Brasil, por UF e mês, desde 2005 (arquivos STAMaamm.dbc para o AM)
licenca: dados públicos do SUS (licença não declarada)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-28
teste: 'curl -sS "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=130260&codigo_tipo_unidade=2&limit=20&offset=0"'
---
- Tema: saúde. Cadastro de hospitais, UBS e clínicas com endereço, leitos e tipo; base para o mapa da rede de saúde de Manaus.
- O teste listou a pasta; o mais novo do AM era STAM2609.dbc (setembro de 2026). A API REST (apidadosabertos.saude.gov.br) cortou a conexão daqui em 2026-10-21.
- Teste de 2026-10-28 (#110): o arquivo ST do AM de set/2026 (`STAM2609.dbc`, 3.416 estabelecimentos, 1.735 em Manaus) tem tipo (`TP_UNID`), gestão (`TPGESTAO`), esfera (`ESFERA_A`) e CEP, mas não tem coordenada. Em Manaus há 206 com `TP_UNID` 02 (centro de saúde ou unidade básica) e gestão municipal.
- A API REST respondeu nesse dia (200, JSON) com tipo, gestão, esfera, endereço, latitude e longitude por estabelecimento, em páginas de até 20. Ela traz também telefone e e-mail do estabelecimento: a carga (#112) guarda só código, nome, tipo, gestão e ponto.
