---
id: 'desmatamento-recente-focos'
titulo: 'O foco cai mais no desmatamento recente do que no antigo e na floresta em pé'
fontes: 'inpe-prodes, nasa-firms'
espera: 'mais focos por km² no desmatamento do PRODES de 1 a 3 anos antes do que no desmatamento até 2007; importa se a razão passar de 3'
defasagem: '1 a 3 anos (ano do desmatamento antes do ano do foco)'
epoca: 'um valor por ano (o ano inteiro)'
comparacao: 'o desmatamento antigo (até 2007) e a floresta em pé, no mesmo ano'
teste: 'log da razão de densidade (focos por km², recente ÷ antigo) por ano, 2012–2025 (VIIRS S-NPP), com permutação de sinais entre os anos'
rodada: '3'
status: 'testada'
escrita_em: '2026-10-23'
testada_em: '2026-10-23'
confianca: 'alta'
resultado: 'focos por km² no desmatamento do PRODES de 1 a 3 anos antes ÷ no desmatamento até 2007, caixa da região, VIIRS S-NPP, anos PRODES 2013–2025 (média geométrica): 18.02×; p = 0.0002, p ajustado (BH da rodada 3) = 0.0004, passa na correção'
---
## Por quê
Depois do corte raso, a vegetação derrubada seca e é queimada para limpar a área, muitas vezes por alguns anos seguidos. A área desmatada há muito tempo já virou pasto e queima menos por km².

## Como testar
Focos do arquivo FIRMS (VIIRS S-NPP, 2012–2025) na caixa da região, classificados pelo ano do desmatamento no PRODES. Área de cada classe pelo mesmo mapa. Exploratório: a floresta em pé como terceiro grupo e o MODIS desde 2008.

## Resultado
focos por km² no desmatamento do PRODES de 1 a 3 anos antes ÷ no desmatamento até 2007, caixa da região, VIIRS S-NPP, anos PRODES 2013–2025 (média geométrica): 18.02×; p = 0.0002, p ajustado (BH da rodada 3) = 0.0004, passa na correção. Segundo recorte (MODIS): 10.80, p = 0.0002, confirma. Confiança alta: passa na correção e o segundo recorte confirma. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-23. Números em produtos/contexto/rodada-3.csv.
