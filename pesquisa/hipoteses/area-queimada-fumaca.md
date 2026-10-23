---
id: 'area-queimada-fumaca'
titulo: 'Mês com mais área queimada tem mais dias de fumaça do que o número de focos explica'
fontes: 'mapbiomas-fogo, inpe-aq1km, iem-asos, nasa-firms'
espera: 'quanto mais área queimada no anel de 800 km, mais dias com FU no mês, além do que os focos explicam; importa se a correlação for 0,3 ou mais'
defasagem: '0 (mesmo mês)'
epoca: 'meses de agosto a novembro'
comparacao: 'os outros meses de agosto a novembro, depois de tirar o efeito do número de focos'
teste: 'Spearman entre o resíduo dos dias com FU depois dos focos e a área queimada do MapBiomas Fogo no anel de 800 km, agosto a novembro, 2012–2025, com permutação em blocos por ano'
rodada: '3'
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
O foco conta pixels quentes na passagem do satélite. A área queimada mede quanto queimou de fato. Fogo grande e lento, como o de floresta, pode render poucos focos e muita fumaça.

## Como testar
MapBiomas Fogo (coleção 5.1, mensal) no anel de 800 km. O AQ1km do INPE é o segundo recorte, com o mesmo teste. Dias com FU no METAR de SBEG e focos no anel (`analise.serie_dia`). Exploratório: floresta contra não floresta, pela classe do MapBiomas Fogo.

## Resultado
Ainda não testada.
