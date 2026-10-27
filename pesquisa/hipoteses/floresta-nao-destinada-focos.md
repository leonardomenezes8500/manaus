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
status: 'testada'
escrita_em: '2026-10-23'
testada_em: '2026-10-26'
confianca: 'alta'
resultado: 'focos por km² na floresta pública não destinada (CNFP tipo B no ano do foco) ÷ em TI e UC, AM + AC + RO, VIIRS S-NPP, 2012–2025 (média geométrica): 3.50×; p = 0.0002, p ajustado (BH da rodada 3) = 0.0004, passa na correção'
---
## Por quê
Floresta pública sem destinação não tem dono nem gestor no chão. É onde a grilagem começa: derruba, queima e depois tenta regularizar.

## Como testar
CNFP 2025 na caixa da região. Uma área só conta como destinada a partir do `anocriacao`. Focos do arquivo FIRMS (VIIRS S-NPP, 2012–2025) dentro de cada tipo. Exploratório: cada estado em separado e o tipo B por município.

## Resultado
focos por km² na floresta pública não destinada (CNFP tipo B no ano do foco) ÷ em TI e UC, AM + AC + RO, VIIRS S-NPP, 2012–2025 (média geométrica): 3.50×; p = 0.0002, p ajustado (BH da rodada 3) = 0.0004, passa na correção. Segundo recorte (MODIS): 3.45, p = 0.0002, confirma. Confiança alta: passa na correção e o segundo recorte confirma. Dado medido; 9999 permutações, semente 64, banco manaus em 2026-10-26. Números em produtos/contexto/rodada-3.csv.
