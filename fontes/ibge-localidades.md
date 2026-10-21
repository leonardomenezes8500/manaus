---
id: ibge-localidades
nome: IBGE Localidades (API v1)
publicador: IBGE
url: https://servicodados.ibge.gov.br/api/docs/localidades
acesso: api
chave: nenhuma
atualizacao: anual (quando muda a divisão territorial)
cobertura: Brasil; estados, municípios, distritos
licenca: dados públicos do IBGE (uso livre, citar a fonte)
tipo: registro-oficial
confiabilidade: alta
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS "https://servicodados.ibge.gov.br/api/v1/localidades/estados/AM/municipios"'
coleta: 365d
---
- Dá o nome de cada código IBGE (a malha só tem `codarea`). Coletado junto com `ibge-malhas` pelo `coleta/ibge-municipios.ts` (#8).
