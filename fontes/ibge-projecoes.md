---
id: ibge-projecoes
nome: IBGE Projeções da População (revisão 2024)
publicador: IBGE
url: https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/
acesso: download
chave: nenhuma
atualizacao: a cada revisão (a última é de 2024)
cobertura: Brasil, grandes regiões e UFs, 2000 a 2070, por sexo e idade
licenca: dados públicos do IBGE (uso livre, citar a fonte)
tipo: modelo
confiabilidade: alta
status: verificada
verificado_em: 2026-10-22
teste: 'curl -sSI "https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/projecoes_2024_tab2_grupo_quinquenal.xlsx"'
---
- O teste baixou a tabela 2 (grupo quinquenal, ~1 MB): uma linha por grupo de idade, sexo (Ambos, Homens, Mulheres) e UF, com os anos de 2000 a 2070 nas colunas.
- Projeção é modelo, não medição. Só existe por UF: para município, por idade, não há projeção (#63).
