---
id: mapbiomas-alerta
nome: MapBiomas Alerta (desmatamento validado)
publicador: MapBiomas
url: https://production.alerta.mapbiomas.org/geoserver/wfs
acesso: api
chave: nenhuma
atualizacao: semanal
cobertura: Brasil, desde 2019
licenca: CC BY 4.0
tipo: medicao-satelite
confiabilidade: alta
status: coletando
coleta: 30d
verificado_em: 2026-10-23
teste: 'curl -s "https://production.alerta.mapbiomas.org/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=mapbiomas-alertas:dashboard_alerts-shapefile&resultType=hits&srsName=EPSG:4326&bbox=-15,-74,3,-52"'
---
- Tema: ambiente e donos. Alertas validados com laudo e cruzamento com CAR e embargos. A API pede cadastro e token; o WFS público do GeoServer, não.
- O teste devolveu `numberMatched="239860"` alertas na caixa da região (com EPSG:4326 o `bbox` vai em lat,lon). Camada `dashboard_alerts-shapefile`, campos `CodeAlerta`, `AreaHa`, `DataDetec`, `DtImgAnt`, `DtImgDep`, `Municipio`, `Estado`. A ligação com o código do CAR só vem pela API; aqui ela é feita pela geometria (#82, #84).
- Coleta (#82): `coleta/mapbiomas-alerta.ts`, neste PC, à mão (cron semanal na slice em aberto). Páginas de 2000 alertas da caixa das camadas em GeoJSON com gzip pelo `baixar()`; a tabela `mapbiomas_alerta.alerta` é trocada inteira numa transação. Atribuição: MapBiomas Alerta (CC BY 4.0).
