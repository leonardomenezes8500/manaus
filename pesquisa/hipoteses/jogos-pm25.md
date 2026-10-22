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
status: 'escrita'
escrita_em: '2026-10-22'
---
## Por quê
Em jogo do Brasil as ruas esvaziam; depois do jogo todo mundo sai ao mesmo tempo.

## Como testar
Jogos da FIFA e da FAF (#61) e o sensor do Centro (OpenAQ). Se o sensor não cobrir nenhuma Copa, fica sem teste até ter.

## Resultado
Ainda não testada.
