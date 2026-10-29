---
id: inep-microdados
nome: INEP microdados (Censo Escolar, Enem, Saeb)
publicador: INEP
url: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados
acesso: download
chave: nenhuma
atualizacao: anual
cobertura: Brasil, por escola, desde os anos 1990
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-28
teste: 'curl -sS -I --cacert <(cat /etc/ssl/certs/ca-certificates.crt coleta/certs/rnp-icpedu-gr46-ov-2025.pem) https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_2024.zip'
---
- Tema: educação. Cada escola com endereço, matrículas, infraestrutura (água, energia, esgoto). Arquivos grandes em zip.
- Teste de 2026-10-28 (#110): o Censo Escolar mais novo é o de 2024 (zip de 34 MB, regravado em 08/07/2026; o de 2025 dá 404). O servidor não manda o certificado intermediário (RNP ICPEdu GR46 OV TLS CA 2025, da GlobalSign); com ele, a requisição funciona. O zip tem um CSV só, `microdados_ed_basica_2024.csv` (218 MB, latin1, `;`, 426 colunas), e o dicionário em xlsx.
- Em Manaus (`CO_MUNICIPIO` 1302603): 1.107 escolas (federal 4, estadual 246, municipal 536, privada 321), 1.060 em atividade (`TP_SITUACAO_FUNCIONAMENTO` 1): federal 4, estadual 242, municipal 505, privada 309. A Sinopse Estatística da Educação Básica 2024 do INEP (tabela 3.2, baixada em 2026-10-29) dá 1.059 escolas em Manaus (4, 241, 505, 309): a diferença é uma escola estadual em atividade sem nenhuma matrícula. Tem matrícula por etapa (`QT_MAT_INF_CRE`, `QT_MAT_INF_PRE`, `QT_MAT_FUND_AI`, `QT_MAT_FUND_AF`, `QT_MAT_MED`...) e salas climatizadas (`QT_SALAS_UTILIZA_CLIMATIZADAS`, maior que zero em 1.001 das escolas em atividade).
- Não tem coordenada: só endereço (`DS_ENDERECO`, `NU_ENDERECO`, `CO_CEP`). O ponto sai do casamento com o CNEFE por CEP e número (#111).
- Carga (#111, 2026-10-29): `coleta/inep.ts` guarda o recorte de Manaus em `bruto/inep-microdados/2026/10/29/170126Z_microdados_ed_basica_2024_1302603.csv.gz` e carrega `inep.escola` (sem telefone). Ponto casado com o CNEFE para 776 das 1.060 escolas em atividade (73% das matrículas): 141 por CEP e número, 186 por nome no CEP, 208 por nome único na cidade, 241 pelo centro do CEP. As outras 284 ficam sem ponto e de fora das contas que pedem lugar.
