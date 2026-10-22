---
id: ibge-cnefe
nome: IBGE CNEFE (endereços do Censo 2022)
publicador: IBGE
url: https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/
acesso: download
chave: nenhuma
atualizacao: por censo (o CSV de Manaus é de 2024-05-17)
cobertura: Brasil, por município; endereços com coordenada e espécie (domicílio, escola, saúde, religioso...)
licenca: dados públicos do IBGE (uso livre, citar a fonte)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/Arquivos_CNEFE/CSV/Municipio/13_AM/1302603_MANAUS.zip"'
---
- Tema: território. Cada endereço de Manaus com ponto no mapa; liga endereço, CEP e setor. Base para geocodificar e para achar escolas e postos de saúde (M5).
- CSV em latin1, separado por `;`, 15 MB zipado. Carga (#22): `node coleta/ibge-cnefe.ts` → `ibge.cnefe_endereco`, uma linha por espécie presente no endereço.
- Manaus: 878.488 linhas, 856.226 endereços. Bate com a soma dos `Agregados_por_CEP` do próprio IBGE nos CEPs 69000-000 a 69099-999 (856.226; mesma contagem por espécie: 737.542 domicílios particulares, 1.743 escolas, 1.056 estabelecimentos de saúde, 7.865 religiosos).
- `COD_SETOR` vem com uma letra no fim (ex.: `…086P`); a carga guarda só os 15 dígitos, que são o código de `ibge.setor`.
- Ponto × setor (carga real, 2026-10-21): 84% dos endereços caem dentro do próprio setor e 99,2% dos que têm setor na malha ficam a menos de 20 m dele (o ponto fica na rua, que é a borda do setor; mediana de 3,5 m fora). 21.546 endereços citam 64 setores que não existem na malha final de 2022 (de 2024-11; o CNEFE é de 2024-05). Divergência para a fusão.
