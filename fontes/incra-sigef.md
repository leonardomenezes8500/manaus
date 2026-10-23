---
id: incra-sigef
nome: INCRA SIGEF e Acervo Fundiário
publicador: INCRA
url: https://certificacao.incra.gov.br/csv_shp/export_shp.py
acesso: download
chave: nenhuma
atualizacao: contínua
cobertura: Brasil; imóveis certificados e assentamentos
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-23
teste: 'curl -sSI "https://certificacao.incra.gov.br/csv_shp/zip/Sigef%20Brasil_AM.zip"'
---
- Tema: território e donos. Parcelas georreferenciadas e certificadas; mais confiável que o CAR.
- O teste (HEAD) respondeu 200, sem cadastro, com zip de 13,7 MB refeito no mesmo dia. Por estado há `Sigef Brasil_<UF>.zip`, `Imóvel certificado SNCI Brasil_<UF>.zip` e `Assentamento Brasil_<UF>.zip` (shapefile). Campos da parcela: código, situação, datas de submissão e aprovação, nome da área, matrícula e município; não tem o dono.
