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
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS -H "X-API-Key: $OPENAQ_API_KEY" "https://api.openaq.org/v3/locations?coordinates=-3.1,-60.02&radius=25000&limit=5"'
---
- Único local num raio de 25 km: sensor AirGradient do Greenpeace no Centro (pm1, pm25, umidade, temperatura), última leitura em 2026-10-21.
- Confiabilidade média: sensor de baixo custo, sem calibração oficial conhecida. Um ponto só não representa a cidade (#13).
