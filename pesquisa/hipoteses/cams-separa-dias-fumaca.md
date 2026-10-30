---
id: 'cams-separa-dias-fumaca'
titulo: 'O PM2,5 diário do CAMS separa os dias de fumaça em Manaus dos outros dias da temporada'
fontes: 'ecmwf-ads, iem-asos'
espera: 'o PM2,5 do CAMS é maior nos dias com FU; importa se a AUC for 0,80 ou mais; abaixo de 0,65 contradiz o CAMS como base de um alerta'
defasagem: '0 dias'
epoca: 'só a temporada do fogo (agosto a novembro), 2012–2025'
comparacao: 'dias sem FU na mesma temporada'
teste: 'AUC (U de Mann-Whitney) do PM2,5 médio do dia de Manaus da reanálise EAC4 entre os dias com 1 hora ou mais de FU no METAR do SBEG e os outros dias; p por permutação em blocos de 7 dias'
rodada: '6'
status: 'testada'
escrita_em: '2026-10-28'
testada_em: '2026-10-30'
confianca: 'alta'
resultado: 'AUC do PM2,5 do CAMS EAC4 (modelado) entre os 96 dias com FU e os outros 1612 dias de agosto a novembro, 14 temporadas (2012–2025): 0.89 (importa a partir de 0,80; abaixo de 0,65 contradiz o CAMS como base de alerta); p = 0.0001, p ajustado (BH da rodada 6) = 0.0002, passa na correção'
---
## Por quê
Um alerta diário de fumaça para Manaus teria de sair de um modelo, porque a cidade quase não tem medição (problema `manaus-sem-medicao-do-ar`). O CAMS é o modelo à mão (o mesmo do SISAM do INPE), mas tem grade de ~40 km. Se nem a reanálise, que já usa o dado observado de satélite, separa os dias de fumaça, a previsão também não vai separar. Isso dá o teto do alerta antes de testar a previsão (`previsao-cams-amanha`).

## Como testar
PM2,5 diário da reanálise EAC4 no ponto mais perto do Centro (`cams.pm25_dia`, produto `eac4`, modelado, #89) e as horas com FU do dia de Manaus no METAR do aeroporto (`analise.serie_dia`, medido, #55). Agosto a novembro de 2012 a 2025 (14 temporadas). Teste principal acima, com a semente escrita no resultado.

Segundo recorte, independente do código FU do observador: os dias com visibilidade abaixo de 5 km sem chuva nem névoa (mesma série) no lugar dos dias com FU.

Exploratório (e diz isso): a AUC de cada ano; o limiar de PM2,5 do CAMS que acerta mais.

## Resultado
AUC do PM2,5 do CAMS EAC4 (modelado) entre os 96 dias com FU e os outros 1612 dias de agosto a novembro, 14 temporadas (2012–2025): 0.89 (importa a partir de 0,80; abaixo de 0,65 contradiz o CAMS como base de alerta); p = 0.0001, p ajustado (BH da rodada 6) = 0.0002, passa na correção. Segundo recorte (visibilidade abaixo de 5 km sem chuva nem névoa): 0.88, p = 0.0001, confirma. Confiança alta: passa na correção e o segundo recorte confirma. CAMS EAC4 modelado contra FU e visibilidade medidos no METAR; 9999 permutações, semente 64, banco manaus_m5 em 2026-10-30. Números em produtos/contexto/rodada-6.csv.
