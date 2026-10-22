---
id: ana-hidrografia
nome: ANA, hidrografia (BHO 2017 5k e massas d'água)
publicador: ANA (SNIRH)
url: https://www.snirh.gov.br/arcgis/rest/services/SPR
acesso: api
chave: nenhuma
atualizacao: estática (BHO 2017 v01.05; massas d'água v2019)
cobertura: Brasil; trechos de drenagem com código Otto e massas d'água (rios largos, lagos, represas)
licenca: dados públicos da ANA (licença não declarada)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://www.snirh.gov.br/arcgis/rest/services/SPR/BHO2017_5K_TRECHODRENAGEM/FeatureServer/0/query?geometry=-60.1,-3.2,-59.9,-3.0&geometryType=esriGeometryEnvelope&inSR=4326&returnCountOnly=true&f=json"'
---
- Tema: água e território. Serviços ArcGIS REST (não há WFS). O de massas d'água não pagina (máximo 1.000 por pedido): a carga pede os ids na caixa e depois baixa por lotes de ids.
- Carga (#29): `node coleta/ana-hidrografia.ts` → `ana.trecho` (6.025 trechos, 59.765 km) e `ana.massa_dagua` (3.874 massas, 22.713 km² dentro da caixa), recortados na caixa da RM. Maiores massas: UHE Balbina, Rio Amazonas, Lago de Coari, Lago Manacapuru.
- A BHO atual (BHO 6, 2022) só existe em arquivo de 4 GB (18.387 trechos na caixa de Manaus); o recorte remoto não funciona em tempo razoável. Se precisar do detalhe, baixar uma vez neste PC.
