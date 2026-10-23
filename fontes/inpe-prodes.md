---
id: inpe-prodes
nome: INPE PRODES Amazônia (desmatamento anual)
publicador: INPE (TerraBrasilis)
url: https://terrabrasilis.dpi.inpe.br/downloads/
acesso: download
chave: nenhuma
atualizacao: anual
cobertura: Amazônia Legal, desde 1988 (raster com o ano de cada pixel desde 2000)
licenca: CC BY-SA 4.0 (TerraBrasilis)
tipo: medicao-satelite
confiabilidade: alta
status: coletando
verificado_em: 2026-10-23
teste: 'curl -sSI "https://terrabrasilis.dpi.inpe.br/download/dataset/legal-amz-prodes/raster/prodes_amazonia_legal_2025_v20261019.zip"'
coleta: 365d
---
- Tema: ambiente. Taxa oficial e polígonos de desmatamento por ano (também por WFS, geoserver prodes-legal-amz).
- Coleta (#74): `coleta/prodes.ts`, neste PC, uma vez por ano. O raster "PRODES completo" (`prodes_amazonia_legal_2025_v20261019.zip`, 536 MB, a lista sai de `/business/api/v1/download/all`) tem um GeoTIFF de 1 GB, pixel de 0,00009° em SIRGAS 2000. Classes: 0 a 25 = desmatamento do ano (d2000 é tudo até 2000; não há 1, 3 nem 5), 50 a 65 = resíduo, 91 = hidrografia, 100 = vegetação nativa florestal, 101 = não florestal, 255 = sem dado. O recorte da caixa da região vai como COG categórico para `normalizado/inpe-prodes/`; o zip não vai para o R2 (url com versão, pública).
- Recorte de 2026-10-23: em 30 m o COG da caixa deu 332 MB e passou do limite de 0,3 GB, então foi reamostrado para 60 m pela moda (146 MB). Conferido: 3 polígonos d2025 do AC no WFS `prodes-legal-amz:yearly_deforestation` caem na classe 25; de 300 alertas de corte raso do DETER do ano PRODES 2024, 75% caem em d2024, 14% em d2023 e 9% em floresta.
