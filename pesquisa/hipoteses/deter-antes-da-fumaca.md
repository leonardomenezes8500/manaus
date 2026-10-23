---
id: 'deter-antes-da-fumaca'
titulo: 'Ano com mais corte raso no 1º semestre tem mais dias de fumaça na temporada, descontada a seca'
fontes: 'inpe-deter, iem-asos, ana-telemetria'
espera: 'quanto mais corte raso no DETER de janeiro a julho, mais dias com FU de agosto a novembro, além do que a cota mínima explica; importa se a correlação for 0,5 ou mais'
defasagem: 'meses (corte de janeiro a julho, fumaça de agosto a novembro)'
epoca: 'um valor por ano'
comparacao: 'os outros anos, depois de tirar o efeito da cota mínima'
teste: 'Spearman entre o resíduo dos dias com FU depois da cota mínima (residuoPostos) e a área de corte raso do DETER no anel de 800 km, 2017–2025, permutando os anos'
rodada: '3'
status: 'testada'
escrita_em: '2026-10-23'
testada_em: '2026-10-23'
confianca: 'baixa'
resultado: 'Spearman entre o corte raso do DETER de janeiro a julho a até 800 km e os dias com FU de agosto a novembro sem o efeito da cota mínima (postos), 9 anos (2017–2025): 0.25; p = 0.5331, p ajustado (BH da rodada 3) = 0.6397, não passa na correção'
---
## Por quê
A floresta derrubada no começo do ano é queimada na seca. Se o corte cresce, a temporada de fogo tem mais combustível perto de Manaus, mesmo com a mesma seca.

## Como testar
Alertas de corte raso do DETER (desde 2016) dentro do anel de 800 km, somados de janeiro a julho. Dias com FU no METAR de SBEG e cota mínima de agosto a novembro (`analise.serie_dia`, #55). A seca já explica muito (rodada 1), por isso o teste usa o resíduo. Poucos anos: confiança baixa.

## Resultado
Spearman entre o corte raso do DETER de janeiro a julho a até 800 km e os dias com FU de agosto a novembro sem o efeito da cota mínima (postos), 9 anos (2017–2025): 0.25; p = 0.5331, p ajustado (BH da rodada 3) = 0.6397, não passa na correção. Segundo recorte (PRODES): 0.23, p = 0.5600, não confirma. Confiança baixa: não passa na correção. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-23. Números em produtos/contexto/rodada-3.csv.
