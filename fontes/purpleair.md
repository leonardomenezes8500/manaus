---
id: purpleair
nome: PurpleAir (API v1)
publicador: PurpleAir, Inc.
url: https://api.purpleair.com
acesso: api
chave: PURPLEAIR_API_KEY
atualizacao: 2 min (tempo real); histórico por sensor
cobertura: global; ~34 sensores na área de Manaus (UEA, Sema-AM, MPAM, FAS, UFAM), os mais antigos de 2019-2020
licenca: termos de uso da PurpleAir (dados públicos dos donos; ver data license)
tipo: medicao-solo
confiabilidade: media
status: candidata
---
- Candidata: sem chave ainda. Sem chave a API responde `ApiKeyMissingError` (testado em 2026-10-21). A chave é grátis, mas cada chamada gasta "pontos": a conta nova ganha um lote; depois é pago (barato). Os donos dos sensores (UEA/EducAIR) podem conseguir acesso sem custo.
- É a fonte de verdade por trás do SELVA (`selva-uea`). A API dá canais A e B, umidade e histórico (`/v1/sensors/:id/history`), o que permite aplicar a correção EPA para fumaça.
- Sensor barato (laser). Em fumaça densa superestima PM2.5 sem correção. Medição de solo, não modelo.
- 2026-10-28: sem chave continua `ApiKeyMissingError` (testado de novo). Gancho pronto (#41): `coleta/purpleair.ts` pede `/v1/sensors` da RMM, sensores externos, com `pm2.5_cf_1_a`, `pm2.5_cf_1_b`, umidade e temperatura (o que a correção EPA usa) e grava o bruto. Fora do cron até o usuário decidir o custo.
- Quando a chave chegar: `PURPLEAIR_API_KEY` no `.env` local e `gh secret set PURPLEAIR_API_KEY`, linha `SEGREDO_PURPLEAIR_API_KEY` no job `deploy` do `ci.yml`; rodar `node coleta/purpleair.ts` uma vez e, com a resposta real, passar o card a `verificada` (com `teste` e `verificado_em`), conferir no painel quantos pontos a chamada gastou, criar `purpleair.*` e a carga (como `selva.*`), o histórico (`/v1/sensors/:id/history`), a linha no `verificar-chaves.ts` e a linha do cron (comentada no `coleta/crontab`).
