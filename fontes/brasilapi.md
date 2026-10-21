---
id: brasilapi
nome: BrasilAPI
publicador: BrasilAPI (projeto comunitário)
url: https://brasilapi.com.br/docs
acesso: api
chave: nenhuma
atualizacao: na hora da consulta (repassa a fonte de origem)
cobertura: Brasil; CEP, CNPJ, bancos, feriados e outros
licenca: código MIT; o dado segue a licença da fonte de origem (Correios, Receita etc.)
tipo: registro-oficial
confiabilidade: media
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://brasilapi.com.br/api/cep/v2/69005000"'
---
- O teste devolveu o CEP do Centro de Manaus com código IBGE e coordenada (via `open-cep`).
- É um repasse de registros oficiais: confiabilidade média porque depende do provedor de cada consulta e não tem SLA. Usar com cache (#33).
