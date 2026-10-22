---
id: 'jogos-pm25'
titulo: 'O PM2.5 do Centro cai durante jogo do Brasil e sobe depois'
fontes: 'fifa-api, faf-amazonas, openaq'
espera: 'PM2.5 menor nas horas do jogo e maior nas 3 horas seguintes; importa se passar de 15%'
defasagem: '0 a 3 horas'
epoca: 'mesma hora do mesmo dia da semana nas 4 semanas em volta'
comparacao: 'as mesmas horas em dias sem jogo, nas 4 semanas em volta'
teste: 'diferença das medianas horárias (jogo − sem jogo), permutando os dias'
rodada: '1'
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-22'
confianca: 'baixa'
resultado: 'PM2.5 do Centro nas 2 horas de jogo − mesmas horas sem jogo (8 jogos de 2026): -54%; p = 0.2494, p ajustado (BH da rodada 1) = 0.5819, não passa na correção'
---
## Por quê
Em jogo do Brasil as ruas esvaziam; depois do jogo todo mundo sai ao mesmo tempo.

## Como testar
Jogos da FIFA e da FAF (#61) e o sensor do Centro (OpenAQ). Se o sensor não cobrir nenhuma Copa, fica sem teste até ter.

## Resultado
PM2.5 do Centro nas 2 horas de jogo − mesmas horas sem jogo (8 jogos de 2026): -54%; p = 0.2494, p ajustado (BH da rodada 1) = 0.5819, não passa na correção. Confiança baixa: menos de 8 anos de dado. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-22. Números em produtos/contexto/rodada-1.csv.
