---
id: inpe-aq1km
nome: INPE AQ1km (área queimada mensal, 1 km)
publicador: INPE (Programa Queimadas)
url: https://dataserver-coids.inpe.br/queimadas/queimadas/area_queimada/colecao2/
acesso: download
chave: nenhuma
atualizacao: mensal (até o mês passado)
cobertura: América do Sul, pixel de 0,01°, de 2002-09 até hoje
licenca: dados públicos do INPE (licença não declarada)
tipo: medicao-satelite
confiabilidade: alta
status: coletando
verificado_em: 2026-10-23
teste: 'curl -sSI "https://dataserver-coids.inpe.br/queimadas/queimadas/area_queimada/colecao2/tif/2026_09_AQM_modis.tif"'
coleta: 31d
---
- Tema: fumaça. Cicatriz de queimada por mês, do MODIS, independente do MapBiomas Fogo. Coleção 2, reprocessada em 2026-02, é a que o INPE recomenda.
- O teste devolveu 200 para o GeoTIFF de setembro de 2026 (`tif/AAAA_MM_AQM_modis.tif`, ~0,9 MB por mês). A pasta `csv/` só tem área por bioma; `shp/` tem os polígonos.
- Coleta (#76): `analise/fogo/area-queimada.ts --produto inpe-aq1km`, neste PC, à mão, uma vez por mês na temporada. Cada mês vai para o bruto pelo `baixar()` uma vez; as rodadas seguintes leem do R2. Totais em `analise.area_queimada_mes` (cobertura `total`: o AQ1km não separa floresta).
