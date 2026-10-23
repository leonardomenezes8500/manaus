---
id: 'embargo-fogo-depois'
titulo: 'O embargo reduz o fogo dentro da área embargada'
fontes: 'ibama-embargos, icmbio-fiscalizacao, sicar, nasa-firms'
espera: 'queda de 30% ou mais nos focos por km² da área embargada, de 1 a 3 anos depois do embargo, além da queda na comparação'
defasagem: '1 a 3 anos depois do ano do embargo (o próprio ano fica de fora)'
epoca: 'um valor por coorte (ano do embargo), anos inteiros'
comparacao: 'imóveis do CAR sem embargo no mesmo município, que também tiveram foco nos 3 anos antes, nos mesmos anos do calendário'
teste: 'por coorte (ano do embargo, 2015 a 2022), log da razão de densidade (3 anos depois ÷ 3 anos antes) nos embargados menos o mesmo log na comparação, com permutação de sinais entre as coortes'
rodada: '4'
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
O embargo proíbe usar a área e põe o autuado no radar da fiscalização. Se a regra pega, quem foi embargado para de limpar a área com fogo. O mesmo filtro nos dois grupos (ter tido foco nos 3 anos antes) evita confundir o efeito com a volta à média.

## Como testar
Focos do VIIRS S-NPP (arquivo FIRMS, #52). Entram só embargos com polígono, não cancelados e com data válida. Contas por estado só em AM, AC e RO, que estão inteiros na caixa; o PA cortado é exploratório. Segundo recorte: MODIS; e só os embargos do ICMBio.

## Resultado
Ainda não testada.
