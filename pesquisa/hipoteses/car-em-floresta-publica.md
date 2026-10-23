---
id: 'car-em-floresta-publica'
titulo: 'CAR declarado sobre floresta pública não destinada queima mais por km²'
fontes: 'sicar, sfb-cnfp, nasa-firms'
espera: 'razão de densidade de focos (CAR em floresta pública tipo B ÷ CAR fora de floresta pública) acima de 2'
defasagem: '0 (mesmo ano)'
epoca: 'um valor por ano (o ano inteiro)'
comparacao: 'área de CAR fora de floresta pública, no mesmo estado e ano'
teste: 'log da razão de densidade por ano, 2016 a 2025, com permutação de sinais entre os anos'
rodada: '4'
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
É o caminho da grilagem: declara no CAR uma área de floresta pública sem destinação, derruba e queima, e depois tenta regularizar.

## Como testar
CAR de AM, AC e RO; floresta pública tipo B no ano do foco (CNFP 2025, tipo A criada depois conta como B). Focos do VIIRS S-NPP. O CAR é a base de hoje: se o arquivo trouxer a data de inscrição, o imóvel só conta a partir dela; se não trouxer, isso fica escrito como limite. Segundo recorte: MODIS; o PA cortado.

## Resultado
Ainda não testada.
