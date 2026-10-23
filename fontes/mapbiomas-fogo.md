---
id: mapbiomas-fogo
nome: MapBiomas Fogo (cicatrizes de queimada)
publicador: MapBiomas
url: https://plataforma.brasil.mapbiomas.org/fogo
acesso: download
chave: nenhuma
atualizacao: mensal (monitor) e anual (coleção)
cobertura: Brasil, 30 m, desde 1985
licenca: CC BY 4.0
tipo: medicao-satelite
confiabilidade: alta
status: coletando
verificado_em: 2026-10-23
teste: 'curl -sSI "https://storage.googleapis.com/mapbiomas-public/initiatives/brasil/collection_10/fire-col5/mapbiomas_fire_collection5_monthly_burned_v1/burned_monthly_2024.tif"'
coleta: 365d
---
- Tema: fumaça. Área queimada por mês e por tipo de vegetação; complementa os focos do INPE.
- Coleta (#76): `analise/fogo/area-queimada.ts`, neste PC, uma vez por ano (coleção nova). Coleção 5: `burned_monthly_<ano>.tif` (mês da queima, 1 a 12) e `burned_coverage_<ano>.tif` (classe da cobertura que queimou), mesma grade de 0,00027°, 73 a 83 MB por ano, lidos por janela pelo `/vsicurl/`. Nada vai para o R2 (url pública com versão): só os totais por mês, recorte e cobertura em `analise.area_queimada_mes`.
