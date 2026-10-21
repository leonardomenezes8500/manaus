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
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS -H "PRIVATE-TOKEN: $ECMWF_KEY" "https://ads.atmosphere.copernicus.eu/api/retrieve/v1/jobs?limit=1"'
---
- Mesma conta e chave do CDS. O teste lista os pedidos da conta (200). Ainda não baixei dado.
- Confiabilidade média: modelo de aerossol em grade grossa (~40 km), pode errar a fumaça local. Sempre rotular como modelado.
