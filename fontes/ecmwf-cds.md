---
id: ecmwf-cds
nome: Copernicus Climate Data Store (ERA5)
publicador: ECMWF / Copernicus C3S
url: https://cds.climate.copernicus.eu
acesso: api
chave: ECMWF_KEY
atualizacao: diária, com ~5 dias de atraso (ERA5T)
cobertura: global, desde 1940 (ERA5)
licenca: licença Copernicus (uso livre, com atribuição)
tipo: modelo
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS -H "PRIVATE-TOKEN: $ECMWF_KEY" "https://cds.climate.copernicus.eu/api/retrieve/v1/jobs?limit=1"'
---
- O teste lista os pedidos da conta (200; com token falso, 401). Ainda não baixei dado: isso fica para o S3.1.
- Cada conjunto pode exigir aceitar a licença no site antes do primeiro pedido.
- ERA5 é reanálise (modelo + observações), não medição. A mesma conta e chave servem o ADS (`ecmwf-ads`).
