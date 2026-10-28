---
id: ecmwf-ads
nome: Copernicus Atmosphere Data Store (CAMS)
publicador: ECMWF / Copernicus CAMS
url: https://ads.atmosphere.copernicus.eu
acesso: api
chave: ECMWF_KEY
atualizacao: previsão global duas vezes por dia; reanálises com atraso
cobertura: global; previsão CAMS e reanálise desde 2003
licenca: licença Copernicus (uso livre, com atribuição)
tipo: modelo
confiabilidade: media
status: coletando
coleta: 365d
verificado_em: 2026-10-28
teste: 'curl -sS -H "PRIVATE-TOKEN: $ECMWF_KEY" "https://ads.atmosphere.copernicus.eu/api/retrieve/v1/jobs?limit=1"'
---
- Mesma conta e chave do CDS. O teste lista os pedidos da conta (200). Ainda não baixei dado.
- Confiabilidade média: modelo de aerossol em grade grossa (~40 km), pode errar a fumaça local. Sempre rotular como modelado.
- Reanálise EAC4 (`cams-global-reanalysis-eac4`, #89): um pedido de `particulate_matter_2.5um` de um dia em Manaus ficou pronto em ~80 s (25 KB, netCDF) em 2026-10-23; a licença do CAMS já está aceita na conta. É o mesmo modelo do SISAM do INPE.
- Coleta (#89): `coleta/cams.ts --history 2012`, neste PC, um pedido por ano (GRIB). Média do dia de Manaus em `cams.pm25_dia`, rotulada como modelada.
- Previsão arquivada (`cams-global-atmospheric-composition-forecasts`, #110): um pedido de teste de 2026-10-28 (PM2,5, rodada de 15/09/2015 00 UTC, 24 h de antecedência, 4° em volta de Manaus, GRIB) ficou pronto em 41 s (438 bytes). Valor no ponto de Manaus: 1,93 × 10⁻⁸ kg/m³ = 19,3 µg/m³, válido em 16/09/2015 00 UTC. Mesmo dado de modelo da reanálise: rotular como modelado.
