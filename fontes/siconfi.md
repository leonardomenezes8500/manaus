---
id: siconfi
nome: Tesouro SICONFI (API de dados contábeis)
publicador: Tesouro Nacional
url: https://apidatalake.tesouro.gov.br/docs/siconfi/
acesso: api
chave: nenhuma
atualizacao: bimestral (RREO) e quadrimestral (RGF); anual (DCA)
cobertura: todos os entes; Prefeitura de Manaus e Estado do AM desde 2015
licenca: dados públicos do Tesouro (licença não declarada)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=2025&nr_periodo=6&co_tipo_demonstrativo=RREO&id_ente=1302603"'
---
- Tema: orçamento público. Receitas, despesas por função (saúde, saneamento, gestão ambiental), dívida e pessoal da Prefeitura e do Estado, nos relatórios oficiais.
- O teste devolveu o RREO de 2025, 6º bimestre, da Prefeitura de Manaus (receita prevista inicial de R$ 10,06 bi).
