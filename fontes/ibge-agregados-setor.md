---
id: ibge-agregados-setor
nome: IBGE Agregados por setor censitário (Censo 2022)
publicador: IBGE (Censo Demográfico 2022)
url: https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/
acesso: download
chave: nenhuma
atualizacao: por censo, em lotes (o básico é de 2026-05-20; outros temas saem ao longo do tempo)
cobertura: Brasil, um CSV por tema para o país inteiro
licenca: dados públicos do IBGE (uso livre, citar a fonte)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/Agregados_por_setores_basico_BR_20260520.zip"'
---
- CSV em latin1, separado por `;`, vírgula decimal. `X` = valor suprimido e `.` = não se aplica (a carga não grava nenhum dos dois).
- Temas publicados em 2026-10-21: básico, alfabetização, características do domicílio (1 a 3), cor ou raça, demografia, domicílios e pessoas indígenas e quilombolas, óbitos, parentesco. Na #21 entrou só o básico (v0001 a v0009) do AM, em `ibge.setor_agregado`, com o significado em `ibge.variavel`.
- Conferido: a soma de v0001 (pessoas) dos setores de Manaus dá 2.063.689, igual ao SIDRA (tabela 4709).
