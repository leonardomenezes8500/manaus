---
id: am-transparencia
nome: Portal da Transparência do Governo do Amazonas
publicador: Governo do Amazonas (CGE)
url: https://www.transparencia.am.gov.br/
acesso: pagina
chave: nenhuma
atualizacao: diária a mensal
cobertura: Estado do AM; receitas, despesas, contratos, servidores
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: candidata
---
- Tema: orçamento público. Gasto do Estado (inclui SEMA, IPAAM, SES, SEDUC, CBMAM) por órgão e credor.
- Sem exportação utilizável (testado em 2026-10-23, #87): o portal da SEFAZ cifra os parâmetros de cada pedido e usa token de sessão; `/transparencia/api/dadosabertos/execucao?exercicio=2024` respondeu erro 500 sem eles. O gasto do Estado vem do SICONFI por subfunção (#65) e as compras do PNCP (#66).
