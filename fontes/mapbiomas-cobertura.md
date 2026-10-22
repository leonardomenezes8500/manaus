---
id: mapbiomas-cobertura
nome: MapBiomas Cobertura e Uso da Terra (Coleção 11)
publicador: MapBiomas
url: https://brasil.mapbiomas.org/downloads/mapas-para-download-geotiff/
acesso: download
chave: nenhuma
atualizacao: anual (uma coleção por ano; a 11 é de 2026-08, cobre 1985 a 2025)
cobertura: Brasil, 30 m, um raster por ano desde 1985
licenca: CC BY 4.0 (citar "Projeto MapBiomas – Coleção 11 da Série Anual de Mapas de Cobertura e Uso da Terra do Brasil")
tipo: medicao-satelite
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://storage.googleapis.com/mapbiomas-public/initiatives/brasil/collection11/lulc/coverage/brazil_coverage/brazil_coverage-col11_2025.tif"'
---
- Tema: território e ambiente. Mapa anual de floresta, pasto, área urbana e água; mostra como Manaus cresceu sobre a floresta. É classificação de imagem de satélite (modelada a partir de medição).
- Um GeoTIFF do Brasil por ano (~700 MB, em blocos, sem overviews nem nodata), lido por janela via `/vsicurl/` (`GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR` deixa o acesso 10× mais rápido). A Coleção 10 continua noutra pasta (`collection_10/...`); as duas discordam bastante nos anos antigos, então fica uma coleção só.
- Recorte (#27): `node coleta/mapbiomas.ts` → `normalizado/mapbiomas/col11/cobertura_AAAA.tif` no R2 (41 COGs da RM de Manaus, 672 MB no total, overviews por vizinho mais próximo para não estragar os códigos). Legenda em `mapbiomas.classe`. Consulta por ponto: `valorNoPonto()` em `coleta/lib/raster.ts`.
- Pontos (1985 e 2025): Teatro Amazonas = 24 (Área Urbanizada); Reserva Ducke e um ponto ao norte (-60,20; -2,60) = 3 (Formação Florestal).
- Área urbana de Manaus (classe 24 dentro do limite do IBGE), nossa conta × estatística do MapBiomas: 1985 17.010 × 16.929 ha; 2000 24.185 × 24.070; 2025 28.411 × 28.266. Todos os anos ficam 0,5% acima (área do pixel numa esfera e traçado do limite).
