---
id: funai-terras-indigenas
nome: FUNAI Terras Indígenas (geoserver)
publicador: FUNAI
url: https://geoserver.funai.gov.br/geoserver/Funai/ows
acesso: api
chave: nenhuma
atualizacao: irregular (cada TI tem a data da última atualização; a mais nova é de 2026-08-31)
cobertura: Brasil; limite, fase, etnia e município de cada terra indígena
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS --cacert coleta/certs/sectigo-ov-r36.pem -A QGIS/3.34 "https://geoserver.funai.gov.br/geoserver/Funai/ows?service=WFS&version=2.0.0&request=GetCapabilities"'
---
- Tema: território e quem deveria agir. WFS, camada `Funai:tis_poligonais` em GeoJSON. Com EPSG:4326, o bbox do WFS 2.0 vai em lat,lon.
- Dois cuidados: o servidor não manda o certificado intermediário (está em `coleta/certs/`; o script se relança com `NODE_EXTRA_CA_CERTS`) e o nginx recusa o user agent padrão de scripts (usar `QGIS/3.34`).
- Carga (#30): `node coleta/areas-protegidas.ts` → `funai.terra_indigena`: 313 TIs na região de influência (254 regularizadas, 21 declaradas, 18 delimitadas, 8 em estudo, 7 encaminhadas RI, 5 homologadas).
