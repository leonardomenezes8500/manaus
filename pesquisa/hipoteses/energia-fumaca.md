---
id: 'energia-fumaca'
titulo: 'Falta mais luz em Manaus nos meses de fumaça'
fontes: 'aneel-dados-abertos, ons-dados-abertos'
espera: 'DEC e FEC dos conjuntos de Manaus maiores nos meses de fumaça; importa se passar de 15%'
defasagem: '0 meses'
epoca: 'anomalia mensal (mesmo mês de outros anos)'
comparacao: 'os mesmos meses de anos sem fumaça'
teste: 'Spearman entre os dias de fumaça do mês e a anomalia do DEC, com permutação dos anos'
rodada: '2'
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-22'
confianca: 'baixa'
resultado: 'Spearman entre os dias com FU do mês e a anomalia do DEC de Manaus (soma de todas as partes, derivado; mesmo mês dos outros anos), 14 anos: -0.06; p = 0.6275, p ajustado (BH da rodada 2) = 0.6275, não passa na correção'
---
## Por quê
Queimada perto de linha de transmissão causa desligamento.

## Como testar
DEC/FEC da ANEEL e ocorrências do ONS.

## Resultado
Spearman entre os dias com FU do mês e a anomalia do DEC de Manaus (soma de todas as partes, derivado; mesmo mês dos outros anos), 14 anos: -0.06; p = 0.6275, p ajustado (BH da rodada 2) = 0.6275, não passa na correção. Confiança baixa: não passa na correção. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-22. Números em produtos/contexto/rodada-2.csv.
