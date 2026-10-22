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
- Cliente (#33): `consultarCep()` e `consultarCnpj()` em `coleta/brasilapi.ts`, sob demanda. Cada resposta vai para o bruto; a mesma consulta com menos de 30 dias sai do bruto, sem rede. Linhas em `brasilapi.cep` e `brasilapi.cnpj` (o CNPJ traz sócios e contatos: ficam só em `dados`).
- 100 CEPs de Manaus sorteados do CNEFE (2026-10-21, `node analise/cep-cnefe.ts`): todos achados e todos com coordenada; o logradouro bate em 63 e o bairro em 82. O CNEFE usa o nome que o recenseador anotou (`RUA 47`, `RUA B`, `COMPENSA II`, `CIDADE NOVA IV`) e a BrasilAPI o nome oficial dos Correios e o bairro oficial; em CEP que cobre várias ruas, a rua mais comum do CNEFE nem sempre é a do CEP.
