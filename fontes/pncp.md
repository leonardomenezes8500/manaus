---
id: pncp
nome: PNCP (Portal Nacional de Contratações Públicas)
publicador: Ministério da Gestão (Governo Federal)
url: https://pncp.gov.br/api/consulta/swagger-ui/index.html
acesso: api
chave: nenhuma
atualizacao: diária
cobertura: Brasil, todas as esferas, desde 2021 (obrigatório pela Lei 14.133)
licenca: dados públicos (licença não declarada)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20261001&dataFinal=20261020&codigoModalidadeContratacao=6&codigoMunicipioIbge=1302603&pagina=1&tamanhoPagina=10"'
---
- Tema: orçamento público. Licitações, contratos e atas de Prefeitura, Estado e órgãos federais, filtráveis por município do IBGE.
- O teste devolveu os pregões eletrônicos publicados de 1 a 20/10/2026 com município 1302603 (ex.: Comando do Exército, R$ 65 mi estimados).
