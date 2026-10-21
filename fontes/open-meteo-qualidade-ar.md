---
id: open-meteo-qualidade-ar
nome: Open-Meteo Air Quality
publicador: Open-Meteo (dados do CAMS)
url: https://open-meteo.com/en/docs/air-quality-api
acesso: api
chave: nenhuma
atualizacao: horária (previsão CAMS global)
cobertura: global; previsão de alguns dias e passado recente (past_days)
licenca: CC BY 4.0 (dados); API grátis só para uso não comercial
tipo: modelo
confiabilidade: media
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=-3.1&longitude=-60.02&hourly=pm2_5&forecast_days=1"'
---
- O teste devolveu PM2.5 horário para Manaus em µg/m³ (horário em GMT).
- É o modelo CAMS reempacotado, não medição: rotular como modelado. Mais fácil que o ADS, mas sem controle da versão do modelo.
