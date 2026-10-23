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
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20261001&dataFinal=20261020&codigoModalidadeContratacao=6&codigoMunicipioIbge=1302603&pagina=1&tamanhoPagina=10"'
coleta: 1d
---
- Tema: orçamento público. Licitações, contratos e atas de Prefeitura, Estado e órgãos federais, filtráveis por município do IBGE.
- O teste devolveu os pregões eletrônicos publicados de 1 a 20/10/2026 com município 1302603 (ex.: Comando do Exército, R$ 65 mi estimados).
- Coleta (#66): `/v1/contratacoes/publicacao` (e `/atualizacao` no cron) com `codigoMunicipioIbge=1302603`, uma modalidade por chamada (obrigatório), páginas de 10 a 50, janela de até 365 dias, 204 sem corpo quando não há nada e 429 se apertar (1 chamada a cada 3 s). `/v1/contratos` e `/v1/atas` ignoram o município. Só Lei 14.133: 2021 só tem órgãos federais, o Estado entra no 2º semestre de 2023 e a Prefeitura quase só em 2024.
