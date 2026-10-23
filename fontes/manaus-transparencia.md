---
id: manaus-transparencia
nome: Portal da Transparência da Prefeitura de Manaus
publicador: Prefeitura de Manaus
url: https://transparencia.manaus.am.gov.br/transparencia/
acesso: pagina
chave: nenhuma
atualizacao: diária a mensal
cobertura: Prefeitura de Manaus; receitas, despesas, servidores, contratos
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: candidata
---
- Tema: orçamento público. Gasto da Prefeitura por órgão e credor; ver se há exportação CSV ou API.
- Sem exportação utilizável (testado em 2026-10-23, #87): os dados saem de `servlet/transparencia.getlancamentos`, que fora de uma sessão do portal responde 200 vazio. O gasto da Prefeitura vem do SICONFI por subfunção (#65) e as compras do PNCP (#66).
