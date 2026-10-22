---
id: inpe-deter
nome: INPE DETER Amazônia (alertas de desmatamento)
publicador: INPE (TerraBrasilis)
url: https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/ows
acesso: api
chave: nenhuma
atualizacao: diária (alertas novos em poucos dias)
cobertura: Amazônia Legal, desde 2016
licenca: CC BY-SA 4.0 (TerraBrasilis)
tipo: medicao-satelite
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=deter-amz:deter_amz&count=1&outputFormat=application/json"'
---
- Tema: ambiente e fumaça. Polígonos de alerta (corte raso, degradação, cicatriz de queimada) com data e município, por WFS; liga foco de fogo a desmatamento recente.
- O teste devolveu 1 polígono em GeoJSON (count=1). Para a região, filtrar por bbox ou município.
