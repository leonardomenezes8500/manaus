---
id: 'feriado-pm25-urbano'
titulo: 'O PM2.5 medido no Centro cai no domingo e no feriado fora da seca'
fontes: 'openaq, planalto-legislacao, cmm-manaus'
espera: 'PM2.5 menor no domingo e no feriado; importa se passar de 10%; na seca o efeito some sob a fumaça'
defasagem: '0 dias'
epoca: 'só dezembro a julho (sem fumaça de queimada)'
comparacao: 'dias úteis da mesma semana'
teste: 'diferença das medianas diárias (domingo e feriado − dia útil), permutação em blocos de 7 dias'
rodada: '1'
status: 'escrita'
escrita_em: '2026-10-22'
---
## Por quê
Sem fumaça de fora, o PM2.5 do Centro vem do trânsito, da cozinha e da queima urbana. Domingo e feriado têm menos trânsito.

## Como testar
Sensor do Centro (OpenAQ) e `contexto.dia`. É um sensor barato só: serve para a direção, não para o valor.

## Resultado
Ainda não testada.
