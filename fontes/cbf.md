---
id: cbf
nome: CBF (tabelas das competições nacionais)
publicador: Confederação Brasileira de Futebol
url: https://www.cbf.com.br/
acesso: api
chave: nenhuma
atualizacao: durante as competições
cobertura: Brasil, competições nacionais de 2018 em diante
licenca: sem licença declarada
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-22
teste: 'curl -sS --cacert <(cat /etc/ssl/certs/ca-certificates.crt coleta/calendario/sectigo-ov-r36.pem) "https://www.cbf.com.br/api/cbf/campeonatos/anos"'
---
- O teste devolveu o catálogo de campeonatos com os ids de 2018 a 2026. A tabela de cada um: `/api/cbf/jogos/tabela-detalhada/campeonato/<id>` (data, estádio, cidade, placar). API interna do site, sem documentação: o bruto de cada pedido fica guardado.
- O servidor manda a intermediária errada. Em vez de `-k`, a intermediária certa (Sectigo OV R36, baixada pelo AIA do próprio certificado) está em `coleta/calendario/sectigo-ov-r36.pem`; no Node, `NODE_EXTRA_CA_CERTS`.
- Antes de 2018 a API não tem dados (só as súmulas em PDF, 2013 em diante). As Eliminatórias de 2026 (id 12622) dão HTTP 500.
