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
status: coletando
verificado_em: 2026-10-23
teste: 'curl -sS "https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=deter-amz:deter_amz&count=1&outputFormat=application/json"'
coleta: 7d
---
- Tema: ambiente e fumaça. Polígonos de alerta (corte raso, degradação, cicatriz de queimada) com data e município, por WFS; liga foco de fogo a desmatamento recente.
- O teste devolveu 1 polígono em GeoJSON (count=1). Para a região, filtrar por bbox ou município.
- Coleta (#74): `coleta/deter.ts`, WFS com `CQL_FILTER` (o `bbox` da URL não combina com filtro; no CQL o `BBOX(geom,sul,oeste,norte,leste)` vai em lat,lon), páginas de 2.000 com `sortBy=gid`, GeoJSON em gzip no bruto. Em 2026-10-22: 354.041 alertas na caixa da região, 7.996 com imagem dos últimos 90 dias. O `gid` termina em `_curr` (ano PRODES corrente, desde 1º de agosto, numeração própria) ou `_hist`; ao virar `_hist` o alerta ganha outro `gid`, e o `gid` também se repete entre alertas diferentes (ex.: dois `100006_hist`, de 2018 e de 2023). Por isso cada rodada substitui a janela inteira de datas, sem upsert. Histórico carregado em 2026-10-23: 354.041 alertas, 74 min.
