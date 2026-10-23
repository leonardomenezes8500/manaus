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
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-22'
confianca: 'baixa'
resultado: 'PM2.5 do Centro no domingo e feriado − dia útil, dezembro a julho (186 dias, desde 07/2025): -58% da mediana do dia útil; p = 0.1206, p ajustado (BH da rodada 1) = 0.4221, não passa na correção'
---
## Por quê
Sem fumaça de fora, o PM2.5 do Centro vem do trânsito, da cozinha e da queima urbana. Domingo e feriado têm menos trânsito.

## Como testar
Sensor do Centro (OpenAQ) e `contexto.dia`. É um sensor barato só: serve para a direção, não para o valor.

## Resultado
PM2.5 do Centro no domingo e feriado − dia útil, dezembro a julho (186 dias, desde 07/2025): -58% da mediana do dia útil; p = 0.1206, p ajustado (BH da rodada 1) = 0.4221, não passa na correção. Confiança baixa: menos de 8 anos de dado. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-22. Números em produtos/contexto/rodada-1.csv.
