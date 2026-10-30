---
id: 'v1-sensores-selva'
titulo: 'O peso da fumaça v1 acompanha o PM2.5 da rede de sensores baratos do SELVA, não só o sensor do Centro'
fontes: 'selva-uea, purpleair, nasa-firms, ecmwf-cds'
espera: 'correlação positiva entre o peso total da v1 no dia e a mediana diária do PM2.5 dos sensores do SELVA em Manaus; importa se ρ ≥ 0,5; ρ abaixo de 0,3 contradiz a v1'
defasagem: '0 dias'
epoca: 'só a temporada do fogo (agosto a novembro)'
comparacao: 'dias da mesma temporada com pouco peso da v1'
teste: 'Spearman entre o peso total da v1 do dia e a mediana, entre os sensores do SELVA no município de Manaus com 18 h ou mais de leitura no dia, do PM2.5 médio do dia; p por permutação em blocos de 7 dias'
rodada: '7'
status: 'escrita'
escrita_em: '2026-10-28'
testada_em:
confianca:
resultado:
---
## Por quê
A v1 foi conferida com um sensor só (AirGradient do Centro, OpenAQ): ρ 0,87 na temporada de 2026 (#99). Fumaça que vem de longe chega na cidade inteira, então a rede do SELVA (~20 sensores PurpleAir em Manaus, de bairros diferentes) deve subir e descer junto com a v1. Se só o sensor do Centro acompanha, o acerto pode ser do lugar, não do modelo.

## Como testar
Leituras do SELVA (`selva.leitura`, de 10 em 10 min desde 2026-10-28; com a chave da PurpleAir, histórico desde 2019) e o peso da v1 por dia (`analise.fumaca_dia` e `analise.fumaca_foco`, versão v1). PM2.5 sem correção EPA: serve para a ordem dos dias, não para o valor. Teste principal acima. Exploratório (e diz isso): nos dias de muita fumaça, a diferença entre os sensores (coeficiente de variação) cai, porque a fumaça regional é mais uniforme que a poluição do bairro.

Só dá para testar com uns 30 dias de temporada. Com a coleta começando no fim de outubro, a temporada de 2026 talvez não chegue; sem a chave da PurpleAir, o teste pode ficar para 2027. O teste entra no `analise/contexto/rodada.ts` quando houver os dias.
Passou da rodada 6 para a 7 em 2026-10-30 (#116): o banco de trabalho (cópia de 29/10) não tinha nenhum dia com 18 h de leitura de um sensor do SELVA em Manaus, e a regra pede 30 dias ou mais de temporada. Com a coleta a cada 10 min desde 28/10, a temporada de 2026 chega no máximo a ~33 dias no fim de novembro; sem a chave da PurpleAir, o teste fica para quando houver os dias.

## Resultado
Vazio até testar.
