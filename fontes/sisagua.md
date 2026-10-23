---
id: sisagua
nome: SISAGUA (qualidade da água para consumo)
publicador: Ministério da Saúde
url: https://dados.gov.br/dados/busca?termo=sisagua
acesso: download
chave: nenhuma
atualizacao: mensal
cobertura: Brasil, por município e sistema de abastecimento
licenca: não declarada
tipo: medicao-solo
confiabilidade: alta
status: coletando
verificado_em: 2026-10-22
teste: 'curl -sSI "https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SISAGUA/vigilancia_parametros_basicos_2023_csv.zip"'
coleta: 365d
---
- Tema: água e saúde. Análises de cloro, turbidez e coliformes da água distribuída em Manaus.
- O teste devolveu HTTP 200 (zip de ~150 MB). O portal da Saúde derruba a conexão daqui; os arquivos estão num bucket S3 público que não lista (nomes `<conjunto>_<ano>_csv.zip`).
- Coleta (#67): vigilância (amostra a amostra, MEDIDO), 2014 em diante, neste PC (`coleta/sisagua.ts`). O zip nacional do ano é cortado para Manaus (código IBGE de 6 dígitos, 130260) e só o recorte vai para o bruto. O ano corrente e o anterior mudam: rodar de novo. Controle mensal e "fora do padrão" ficaram de fora até uma hipótese pedir.
