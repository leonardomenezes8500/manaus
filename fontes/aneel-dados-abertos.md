---
id: aneel-dados-abertos
nome: ANEEL Dados Abertos
publicador: ANEEL
url: https://dadosabertos.aneel.gov.br/
acesso: api
chave: nenhuma
atualizacao: mensal a anual
cobertura: Brasil, por distribuidora e conjunto elétrico; Amazonas Energia
licenca: ODbL
tipo: registro-oficial
confiabilidade: alta
status: coletando
verificado_em: 2026-10-22
teste: 'curl -sSI "https://dadosabertos.aneel.gov.br/dataset/d5f0712e-62f6-4736-8dff-9991f10758a7/resource/d7f70fb1-725c-4748-afeb-65c6a78df550/download/indicadores-continuidade-coletivos-2020-2029.parquet"'
coleta: 365d
---
- Tema: energia. Quedas de luz (DEC/FEC), tarifas, geração (SIGA) e reclamações; API CKAN respondeu sem chave.
- O teste devolveu HTTP 200 (parquet de 30 MB). Coleta (#68), neste PC com o `duckdb`: DEC/FEC por conjunto da distribuidora do AM (pelo CNPJ: o nome mudou de AME para Âmbar Amazonas), o mapa conjunto × município e a tarifa B1 residencial. Os arquivos são refeitos todo mês por volta do dia 5; rodar de novo quando for usar.
- Desde 2022 o DEC oficial só conta as interrupções de origem interna (DECIP + DECIND). O apagão externo de 15/08/2023 só aparece em DECXN. Os conjuntos de Manaus foram redesenhados em 2025: comparar Manaus como um total ponderado, nunca conjunto a conjunto.
