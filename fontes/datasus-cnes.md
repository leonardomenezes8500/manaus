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
verificado_em: 2026-10-21
teste: 'curl -sS --list-only "ftp://ftp.datasus.gov.br/dissemin/publicos/CNES/200508_/Dados/ST/"'
---
- Tema: saúde. Cadastro de hospitais, UBS e clínicas com endereço, leitos e tipo; base para o mapa da rede de saúde de Manaus.
- O teste listou a pasta; o mais novo do AM era STAM2609.dbc (setembro de 2026). A API REST (apidadosabertos.saude.gov.br) cortou a conexão daqui em 2026-10-21.
