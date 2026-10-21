---
id: openaq
nome: OpenAQ (API v3)
publicador: OpenAQ
url: https://docs.openaq.org
acesso: api
chave: OPENAQ_API_KEY
atualizacao: horária (depende do sensor)
cobertura: global; em Manaus 1 local (id 5040030, Centro) desde 2025-07-11
licenca: varia por local; o de Manaus é CC BY 4.0 (Greenpeace)
tipo: medicao-solo
confiabilidade: media
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS -H "X-API-Key: $OPENAQ_API_KEY" "https://api.openaq.org/v3/sensors/13574643/measurements?datetime_from=2026-10-21T16:00:00Z&datetime_to=2026-10-21T18:00:00Z"'
coleta: 1h
---
- Único local num raio de 25 km: sensor AirGradient do Greenpeace no Centro (pm1, pm25, umidade, temperatura), última leitura em 2026-10-21.
- Confiabilidade média: sensor de baixo custo, sem calibração oficial conhecida. Um ponto só não representa a cidade (#13).
- Coleta (#10): `coleta/openaq.ts` de hora em hora (últimas 6 h dos 5 sensores da location: pm1, pm25, umidade, temperatura, um003) e `--locations` 1 vez por dia (caixa da região; id novo → `NOVO SENSOR` no log). Histórico: `--history 2025-07`, um arquivo por sensor e mês (até 1000 medições por pedido; o mês tem ≤ 744 horas). Limite: 60 pedidos/min.
- O valor é a média da hora que termina em `period.datetimeTo`. Ex.: 21/10 12h–13h (Manaus) = 35,5 µg/m³.
- Buracos do próprio sensor (conferidos também em `/sensors/<id>/days`): 2025-07-16 → 2025-09-18 (64 dias), 2026-01-19 → 2026-02-02 (com 2 pequenas voltas), 2026-03-15 (1 dia), 2026-04-30 → 2026-05-14 (14 dias).
- Na caixa da região há outros 2 AirGradient (Porto Velho e Lábrea) e estações do Peru (OEFA), fora do caminho da fumaça de Manaus.
