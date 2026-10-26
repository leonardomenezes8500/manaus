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
status: 'testada'
escrita_em: '2026-10-23'
testada_em: '2026-10-26'
confianca: 'baixa'
resultado: 'Spearman entre a área queimada do MapBiomas Fogo a até 800 km e os dias com FU do mês sem o efeito dos focos (postos), agosto a novembro, 14 anos: 0.00; p = 0.9942, p ajustado (BH da rodada 3) = 0.9942, não passa na correção'
---
## Por quê
O foco conta pixels quentes na passagem do satélite. A área queimada mede quanto queimou de fato. Fogo grande e lento, como o de floresta, pode render poucos focos e muita fumaça.

## Como testar
MapBiomas Fogo (coleção 5.1, mensal) no anel de 800 km. O AQ1km do INPE é o segundo recorte, com o mesmo teste. Dias com FU no METAR de SBEG e focos no anel (`analise.serie_dia`). Exploratório: floresta contra não floresta, pela classe do MapBiomas Fogo.

## Resultado
Spearman entre a área queimada do MapBiomas Fogo a até 800 km e os dias com FU do mês sem o efeito dos focos (postos), agosto a novembro, 14 anos: 0.00; p = 0.9942, p ajustado (BH da rodada 3) = 0.9942, não passa na correção. Segundo recorte (INPE AQ1km): -0.08, p = 0.8925, não confirma. Confiança baixa: não passa na correção. Dado medido; 9999 permutações, semente 64, banco manaus em 2026-10-26. Números em produtos/contexto/rodada-3.csv.
