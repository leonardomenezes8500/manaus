---
id: portal-transparencia
nome: Portal da Transparência (API de dados)
publicador: CGU
url: https://api.portaldatransparencia.gov.br/swagger-ui/index.html
acesso: api
chave: TRANSPARENCIA_API_KEY
atualizacao: diária a mensal, conforme a base
cobertura: governo federal; despesas, contratos, convênios, servidores, sanções
licenca: dados abertos do governo federal
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS -H "chave-api-dados: $TRANSPARENCIA_API_KEY" "https://api.portaldatransparencia.gov.br/api-de-dados/orgaos-siafi?pagina=1"'
---
- O teste devolveu a 1ª página de órgãos SIAFI.
- Tem limite de requisições por minuto (ver a documentação) e paginação em quase toda rota.
- Só gasto federal. Estado e Prefeitura têm portais próprios (M4).
