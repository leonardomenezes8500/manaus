---
id: 'fogo-recorrente-embargado'
titulo: 'Imóvel com fogo recorrente tem mais chance de já ter sido embargado'
fontes: 'sicar, ibama-embargos, icmbio-fiscalizacao, nasa-firms'
espera: 'razão de chances acima de 2 para o imóvel com foco em 3 ou mais dos 5 anos de 2021 a 2025 ter um embargo'
defasagem: '0 (embargo em qualquer data até o fim de 2025)'
epoca: 'os 5 anos inteiros de 2021 a 2025'
comparacao: 'imóveis do CAR com foco em só 1 desses 5 anos, no mesmo município'
teste: 'razão de chances de Mantel-Haenszel por município, com permutação do rótulo "recorrente" dentro de cada município'
rodada: '4'
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
Fogo que volta ano após ano no mesmo imóvel é manejo com fogo (pasto, limpeza de derrubada), não acidente. É o que a fiscalização deveria pegar primeiro.

## Como testar
Focos do VIIRS S-NPP dentro de cada imóvel do CAR, AM, AC e RO. Segundo recorte: só imóveis com mais de 100 ha (o pixel do VIIRS cobre uns 14 ha); MODIS.

## Resultado
Ainda não testada.
