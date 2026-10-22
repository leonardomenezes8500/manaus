---
id: 'cheia-seca-fumaca'
titulo: 'Anos de seca forte são anos de mais dias de fumaça em Manaus'
fontes: 'ana-telemetria, ana-hidroweb, iem-asos, nasa-firms'
espera: 'quanto menor a cota mínima, mais dias com FU; importa se a correlação for −0,5 ou mais forte'
defasagem: '0 (mesmo ano)'
epoca: 'um valor por ano (agosto a novembro)'
comparacao: 'os outros anos'
teste: 'Spearman entre a cota mínima e os dias com FU, 2012–2025, com permutação dos anos'
rodada: '1'
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-22'
confianca: 'media'
resultado: 'Spearman entre a cota mínima de agosto a novembro e os dias com FU no METAR: -0.76 (14 anos, 2012–2025); p = 0.0036, p ajustado (BH da rodada 1) = 0.0252, passa na correção'
---
## Por quê
Na seca a floresta e o pasto ficam mais secos, o fogo escapa e a fumaça dura mais. A série da #55 mostrou ρ = −0,72, mas sem regra escrita antes; agora o teste é o mesmo, escrito antes da rodada.

## Como testar
`analise.serie_dia` (#55). Exploratório: o mesmo com os focos no lugar da cota.

## Resultado
Spearman entre a cota mínima de agosto a novembro e os dias com FU no METAR: -0.76 (14 anos, 2012–2025); p = 0.0036, p ajustado (BH da rodada 1) = 0.0252, passa na correção. Confiança media: falta um segundo recorte independente. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-22. Números em produtos/contexto/rodada-1.csv.
