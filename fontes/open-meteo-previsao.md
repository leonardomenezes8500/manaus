---
id: open-meteo-previsao
nome: Open-Meteo Forecast e Historical Forecast
publicador: Open-Meteo (modelos de previsão: ECMWF, GFS, ICON etc., escolha automática)
url: https://open-meteo.com/en/docs
acesso: api
chave: nenhuma
atualizacao: horária (rodadas novas várias vezes por dia)
cobertura: global; previsão de 16 dias, `past_days` e arquivo de previsões passadas (historical-forecast-api) desde 2022
licenca: CC BY 4.0 (dados); API grátis só para uso não comercial
tipo: modelo
confiabilidade: media
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS "https://api.open-meteo.com/v1/forecast?latitude=-3.1&longitude=-60.02&hourly=wind_speed_850hPa,wind_direction_850hPa,boundary_layer_height&past_days=2&timezone=GMT"'
coleta: 6h
---
- É modelo, não medição. Variáveis (#12): vento a 10 m, 925, 850 e 700 hPa (km/h e direção **de onde sopra**), altura da camada limite, umidade e chuva, no ponto de Manaus, em UTC.
- Coleta: `coleta/open-meteo.ts` 4x/dia (`past_days=2`, `forecast_days=3`); histórico desde 2026-08-01 pela historical-forecast-api, um arquivo por mês (o pedido de 81 dias de uma vez deu timeout).
- A API às vezes responde HTTP 200 com o texto `Unexpected error while streaming data: timeoutReached`: o coletor confere o JSON e tenta de novo uma vez.
