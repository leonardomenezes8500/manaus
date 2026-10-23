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
status: coletando
coleta: 31d
verificado_em: 2026-10-21
teste: 'curl -sS -H "chave-api-dados: $TRANSPARENCIA_API_KEY" "https://api.portaldatransparencia.gov.br/api-de-dados/orgaos-siafi?pagina=1"'
---
- O teste devolveu a 1ª página de órgãos SIAFI.
- Tem limite de requisições por minuto (ver a documentação) e paginação em quase toda rota.
- Só gasto federal. Estado e Prefeitura: os portais próprios não têm exportação utilizável (ver `am-transparencia` e `manaus-transparencia`); o gasto deles vem do SICONFI (#65) e as compras do PNCP (#66).
- Download sem chave (#90, testado em 2026-10-23): `portaldatransparencia.gov.br/download-de-dados/despesas-execucao/AAAAMM` (de 2014-01 em diante) e `orcamento-despesa/AAAA` redirecionam para zips da CGU em `dadosabertos-download.cgu.gov.br`.
- Coleta (#90): `coleta/transparencia.ts`, neste PC, uma vez por mês, pelos arquivos de download (não usa a chave da API). Só o corte das ações do fogo vai para o bruto.
