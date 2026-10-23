---
id: 'areas-protegidas-focos'
titulo: 'Terra indígena e unidade de conservação têm menos foco por km² do que a faixa em volta'
fontes: 'funai-terras-indigenas, mma-cnuc, nasa-firms'
espera: 'menos focos por km² dentro de TI e UC do que na faixa de 10 km em volta delas; importa se a razão ficar abaixo de 0,5'
defasagem: '0 (mesmo ano)'
epoca: 'um valor por ano (o ano inteiro)'
comparacao: 'a faixa de 10 km em volta das TIs e UCs, fora de qualquer outra TI ou UC'
teste: 'log da razão de densidade (dentro ÷ faixa de 10 km) por ano, 2012–2025, com permutação de sinais entre os anos'
rodada: '3'
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
Área protegida tem gestor, vigilância e regra de uso, e quem mora nela não usa o fogo para abrir pasto. A faixa em volta tem a mesma floresta e o mesmo clima, sem essa proteção.

## Como testar
TIs (FUNAI) e UCs (CNUC), já no banco desde a #30, na caixa da região. Focos do arquivo FIRMS (VIIRS S-NPP, 2012–2025). Exploratório: TI contra UC, e UC de proteção integral contra uso sustentável.

## Resultado
Ainda não testada.
