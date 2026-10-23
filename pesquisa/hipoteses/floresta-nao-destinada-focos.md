---
id: 'floresta-nao-destinada-focos'
titulo: 'Floresta pública não destinada tem mais foco por km² do que terra indígena e unidade de conservação'
fontes: 'sfb-cnfp, nasa-firms'
espera: 'mais focos por km² na floresta pública tipo B do que em TI e UC, no mesmo estado e ano; importa se a razão passar de 2'
defasagem: '0 (mesmo ano)'
epoca: 'um valor por ano (o ano inteiro)'
comparacao: 'TI e UC no mesmo estado e ano'
teste: 'log da razão de densidade (tipo B ÷ TI e UC) por ano, AM, AC e RO juntos, com permutação de sinais entre os anos'
rodada: '3'
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
Floresta pública sem destinação não tem dono nem gestor no chão. É onde a grilagem começa: derruba, queima e depois tenta regularizar.

## Como testar
CNFP 2025 na caixa da região. Uma área só conta como destinada a partir do `anocriacao`. Focos do arquivo FIRMS (VIIRS S-NPP, 2012–2025) dentro de cada tipo. Exploratório: cada estado em separado e o tipo B por município.

## Resultado
Ainda não testada.
