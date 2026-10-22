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
status: coletando
verificado_em: 2026-10-22
teste: 'curl -sS -H "PRIVATE-TOKEN: $ECMWF_KEY" "https://cds.climate.copernicus.eu/api/retrieve/v1/jobs?limit=1"'
coleta: 1d
---
- O teste lista os pedidos da conta (200; com token falso, 401).
- Coleta (#47): `node coleta/era5.ts` (cron diário da slice) e `--history 2026-07-29` (uma vez, neste PC). Conjunto `reanalysis-era5-pressure-levels`: u, v e ω em 8 níveis (1000 a 700 hPa), de 3 em 3 h, grade de 0,5° na caixa da região de influência (45 × 37 pontos), GRIB. A API é HTTP simples: `POST .../processes/<conjunto>/execution`, consultar `/jobs/<id>` até `successful` e baixar o link de `/jobs/<id>/results`. Um dia levou ~40 s na fila em 21/10; em 22/10 cada pedido esperou ~1,5 h na fila antes de começar (o coletor espera até 3 h e faz um pedido por mês).
- Tamanho medido: 660 KB por dia (192 campos), ~0,24 GB por ano.
- Dia ainda não publicado: o pedido volta HTTP 400 ("None of the data you have requested is available yet ... latest date available ..."). O dia mais novo sai só até 12 UTC, então o coletor pede só os dias completos de 6 a 10 dias atrás.
- Cada conjunto pode exigir aceitar a licença no site antes do primeiro pedido.
- ERA5 é reanálise (modelo + observações), não medição. A mesma conta e chave servem o ADS (`ecmwf-ads`).
