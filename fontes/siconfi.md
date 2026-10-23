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
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=2025&nr_periodo=6&co_tipo_demonstrativo=RREO&id_ente=1302603"'
coleta: 365d
---
- Tema: orçamento público. Receitas, despesas por função (saúde, saneamento, gestão ambiental), dívida e pessoal da Prefeitura e do Estado, nos relatórios oficiais.
- O teste devolveu o RREO de 2025, 6º bimestre, da Prefeitura de Manaus (receita prevista inicial de R$ 10,06 bi).
- Coleta (#65): DCA Anexo I-E da Prefeitura e do Estado, 2015 em diante, uma vez por ano neste PC (`coleta/siconfi.ts`). Casar função e subfunção pelo código dentro de `conta`, nunca pelo nome. Desde 2017 só as subfunções típicas e a 122 aparecem abertas; o resto vai para `FUNN - Demais Subfunções` (em 2015–2016, `NN.999`). O RREO (bimestral) não tem pago nem código: ficou de fora; o ano corrente espera a DCA.
