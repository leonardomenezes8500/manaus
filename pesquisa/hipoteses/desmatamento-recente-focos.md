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
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
Depois do corte raso, a vegetação derrubada seca e é queimada para limpar a área, muitas vezes por alguns anos seguidos. A área desmatada há muito tempo já virou pasto e queima menos por km².

## Como testar
Focos do arquivo FIRMS (VIIRS S-NPP, 2012–2025) na caixa da região, classificados pelo ano do desmatamento no PRODES. Área de cada classe pelo mesmo mapa. Exploratório: a floresta em pé como terceiro grupo e o MODIS desde 2008.

## Resultado
Ainda não testada.
