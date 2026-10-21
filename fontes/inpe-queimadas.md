---
id: inpe-queimadas
nome: INPE Programa Queimadas (focos de calor)
publicador: INPE (Programa Queimadas / BDQueimadas)
url: https://terrabrasilis.dpi.inpe.br/queimadas/portal/
acesso: download
chave: nenhuma
atualizacao: diária (o arquivo do dia cresce ao longo do dia; o do dia anterior fica completo)
cobertura: Brasil; pasta diária com ~30 dias, pasta mensal com a temporada, anual desde 1998
licenca: dados públicos do governo federal (citar INPE)
tipo: medicao-satelite
confiabilidade: alta
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_20261020.csv"'
coleta: 1d
---
- É o número oficial que governo e imprensa usam. Todos os satélites no mesmo CSV (`satelite`): NOAA-20/21, NPP-375, GOES-19, AQUA_M-T (o **satélite de referência** das séries oficiais), TERRA, METOP, MSG. Traz município, estado, bioma, dias sem chuva, risco de fogo e FRP.
- Coleta (#14): `coleta/inpe-queimadas.ts` todo dia, o arquivo do dia anterior (~2–10 MB). Histórico: `--history 2026-08-01` = mensais fechados (`focos_mensal_br_AAAAMM.csv`, 100–120 MB) + diários do mês corrente. A pasta diária só guarda ~30 dias (em 2026-10-21 começava em 2026-09-20).
- A carga (#15) guarda só os focos da caixa da região (o bruto tem o Brasil inteiro).
