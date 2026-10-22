---
id: fifa-api
nome: FIFA (API de competições e jogos)
publicador: FIFA
url: https://api.fifa.com/api/v3/
acesso: api
chave: nenhuma
atualizacao: durante as competições
cobertura: mundo, Copas do Mundo desde 1930
licenca: sem licença declarada (uso para consulta)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-22
teste: 'curl -sS "https://api.fifa.com/api/v3/competitions/17?language=en"'
---
- O teste devolveu JSON da competição 17 ("FIFA World Cup"). É a API que o site da FIFA usa, sem documentação pública: guardar o bruto de cada pedido.
- Serve para o calendário esportivo (#61): datas das Copas e dos jogos do Brasil.
- A CBF ficou sem card: em 2026-10-22 o site dela falhou na verificação do certificado (cadeia incompleta). Tentar de novo na #61.
